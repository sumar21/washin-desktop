import { listItems, getItem, createItem, updateItem } from './graph.ts';
import {
  LIST_IDS,
  mapMaquina,
  maquinaSelectFields,
  mapStock,
  stockSelectFields,
  fechasHoy,
  APP_VERSION,
  type MaquinaRow,
} from './lists.ts';

export const DEPOSITO = 'Wash Inn';

/** Segmentos cuyo stock en 04.Stock se matchea por el NOMBRE del segmento (no por ConcatMaquina). */
const STOCK_BY_SEGMENT = new Set(['encendedora', 'encendedor', 'cargadora', 'expendedora']);

export function isEncendedora(segmento: string): boolean {
  const s = segmento.trim().toLowerCase();
  return s === 'encendedora' || s === 'encendedor';
}

/** Clave con la que la máquina se cuenta en 04.Stock (segmento para consumibles, ConcatMaquina para el resto). */
function stockKeyOf(m: MaquinaRow): string {
  return STOCK_BY_SEGMENT.has(m.Segmento_DM.trim().toLowerCase()) ? m.Segmento_DM : m.ConcatMaquina_DM;
}

/** Ajuste ±1 en 04.Stock (match por Item_ST = key, trim+lower). Best-effort, clamp ≥0. */
async function ajustarStock(key: string, delta: number): Promise<void> {
  if (!key) return;
  const rows = (await listItems(LIST_IDS.stock, { select: stockSelectFields(), filter: `fields/Status_ST eq 'Activo'` })).map(mapStock);
  const k = key.trim().toLowerCase();
  const row = rows.find((r) => r.Item_ST.trim().toLowerCase() === k);
  if (!row) return;
  await updateItem(LIST_IDS.stock, row.ID, { Cantidad_ST: String(Math.max(0, row.Cantidad_ST + delta)) });
}

/** Crea el incidente resuelto que documenta la transferencia (bitácora). */
async function bitacoraTransferencia(m: MaquinaRow, edificio: string, codigo: string, motivo: string, usuario: string): Promise<void> {
  const f = fechasHoy();
  await createItem(LIST_IDS.incidentes, {
    Title: 'Wash inn',
    NoResuelto_IN: 'Transferencia',
    Categoria_IN: 'Transferencia',
    Resuelto_IN: 'SI',
    Status_IN: 'Resuelto',
    Fecha_IN: f.fecha,
    FechaMesAno_IN: f.mesAno,
    FechaResuelto_IN: f.fecha,
    NombreEdificio_IN: edificio,
    CodigoEdifcio_IN: codigo, // nombre interno real (typo "Edifcio")
    ConcatMaquina_IN: m.ConcatMaquinaIncidente_DM,
    IDMaquina_IN: m.IDMaquina_DM,
    MotivoTransferencia_IN: motivo,
    TecnicoAsignado_IN: ' - ',
    User_IN: usuario,
    Version_IN: APP_VERSION,
    Hora_IN: f.hora,
    HoraResuelto_IN: f.hora,
  });
}

/** Máquinas activas del edificio destino (match en memoria por nombre trimeado — el dato real trae espacios). */
async function machinesInBuilding(edificio: string): Promise<MaquinaRow[]> {
  const target = edificio.trim().toLowerCase();
  const all = (await listItems(LIST_IDS.detalleMaquina, { select: maquinaSelectFields(), top: 999 })).map(mapMaquina);
  return all.filter((m) => m.Status_DM !== 'ELIMINADA' && m.Edificio_DM.trim().toLowerCase() === target);
}

export interface TransferInput {
  maquina: MaquinaRow;
  destino: string; // edificio destino (tal como lo eligió el usuario)
  codigoDestino: string;
  motivo: string;
  encendidoElegido: string; // tipo de encendido elegido (encendedora, o edificio sin encendedora)
  usuario: string;
}

/**
 * Aplica una transferencia de máquina replicando la PowerApp original:
 * - a Depósito → DEPOSITO, sin encendido, +1 stock.
 * - a un edificio → INSTALADA, −1 stock si venía de Depósito, y el encendido según:
 *     · encendedora → el tipo elegido, y **propaga** ese tipo a TODAS las máquinas del edificio destino.
 *     · máquina normal → si el edificio ya tiene encendedora, **hereda** su encendido; si no, usa el elegido.
 * - genera un 10.Incidentes resuelto (bitácora).
 * Se usa igual desde el traslado directo (Admin) y desde la aprobación (Jefe Taller).
 */
export async function applyMaquinaTransfer(input: TransferInput): Promise<void> {
  const { maquina, destino, codigoDestino, motivo, encendidoElegido, usuario } = input;
  const vaADeposito = destino.trim() === DEPOSITO;
  const veniaDeDeposito = maquina.Edificio_DM.trim() === DEPOSITO;
  const key = stockKeyOf(maquina);

  if (vaADeposito) {
    await updateItem(LIST_IDS.detalleMaquina, maquina.ID, {
      Status_DM: 'DEPOSITO',
      Encendido_DM: '',
      Edificio_DM: destino,
      Motivo_DM: motivo,
      CodigoEdificio_DM: codigoDestino,
    });
    if (!veniaDeDeposito) await ajustarStock(key, +1);
  } else {
    const destMachines = await machinesInBuilding(destino);
    const destEncendedora = destMachines.find((m) => isEncendedora(m.Segmento_DM));
    const esEnc = isEncendedora(maquina.Segmento_DM);

    // Propagación: mover una encendedora reescribe el encendido de todas las máquinas del destino.
    if (esEnc) {
      for (const dm of destMachines) {
        if (dm.ID === maquina.ID) continue;
        await updateItem(LIST_IDS.detalleMaquina, dm.ID, { Encendido_DM: encendidoElegido });
      }
    }

    // Encendido de la máquina movida.
    let encendido: string;
    if (esEnc) encendido = encendidoElegido;
    else if (!destEncendedora) encendido = encendidoElegido;
    else encendido = destEncendedora.Encendido_DM ?? '';

    await updateItem(LIST_IDS.detalleMaquina, maquina.ID, {
      Status_DM: 'INSTALADA',
      Edificio_DM: destino,
      Encendido_DM: encendido,
      Motivo_DM: motivo,
      CodigoEdificio_DM: codigoDestino,
    });
    if (veniaDeDeposito) await ajustarStock(key, -1);
  }

  await bitacoraTransferencia(maquina, destino, codigoDestino, motivo, usuario);
}

/** Baja de máquina: ELIMINADA + −1 stock + bitácora "Baja de Maquina". */
export async function applyMaquinaBaja(maquina: MaquinaRow, motivo: string, usuario: string): Promise<void> {
  await updateItem(LIST_IDS.detalleMaquina, maquina.ID, { Status_DM: 'ELIMINADA', Motivo_DM: motivo });
  await ajustarStock(stockKeyOf(maquina), -1);
  const f = fechasHoy();
  await createItem(LIST_IDS.incidentes, {
    Title: 'Wash inn',
    NoResuelto_IN: 'Baja de Maquina',
    Categoria_IN: 'Baja de Maquina',
    Resuelto_IN: 'SI',
    Status_IN: 'Resuelto',
    Fecha_IN: f.fecha,
    FechaMesAno_IN: f.mesAno,
    FechaResuelto_IN: f.fecha,
    NombreEdificio_IN: maquina.Edificio_DM,
    CodigoEdifcio_IN: maquina.CodigoEdificio_DM ?? '',
    ConcatMaquina_IN: maquina.ConcatMaquinaIncidente_DM,
    IDMaquina_IN: maquina.IDMaquina_DM,
    MotivoTransferencia_IN: motivo,
    TecnicoAsignado_IN: ' - ',
    User_IN: usuario,
    Version_IN: APP_VERSION,
    Hora_IN: f.hora,
    HoraResuelto_IN: f.hora,
  });
}

/** Campos del select para aplicar una aprobación "Cambio de Maquina". */
export const cambioMaquinaAprobacionSelectFields = (): string[] => ['IDMaquina_AP', 'MaquinaAprobacion_AP'];

/**
 * Aplica una aprobación "Cambio de Maquina" aprobada: descuenta del stock la máquina de
 * reemplazo (match 08.DetalleMaquina por ConcatMaquinaIncidente_DM → ConcatMaquina_DM →
 * 04.Stock −1) y marca el incidente (IDMaquina_AP) como Aprobada, listo para asignar.
 */
export async function applyCambioMaquinaFromAprobacion(aprobFields: Record<string, unknown>): Promise<void> {
  const incidenteId = Number(aprobFields.IDMaquina_AP);
  const maquinaConcatInc = String(aprobFields.MaquinaAprobacion_AP ?? '').trim();
  if (maquinaConcatInc) {
    const all = (await listItems(LIST_IDS.detalleMaquina, { select: maquinaSelectFields(), top: 999 })).map(mapMaquina);
    const maquina = all.find((m) => m.ConcatMaquinaIncidente_DM.trim() === maquinaConcatInc);
    if (maquina) await ajustarStock(maquina.ConcatMaquina_DM, -1);
  }
  if (incidenteId) await updateItem(LIST_IDS.incidentes, incidenteId, { Status_IN: 'Aprobada' });
}

/** Campos para crear la aprobación "Transferencia de Maquina" (Jefe Taller). */
export function buildTransferAprobacionFields(input: Omit<TransferInput, 'usuario'> & { usuario: string }) {
  const { maquina, destino, motivo, encendidoElegido, usuario } = input;
  const f = fechasHoy();
  return {
    Title: 'Washinn',
    Status_AP: 'En Aprobacion',
    TipoAprobacion_AP: 'Transferencia de Maquina',
    IDMaquina_AP: maquina.IDMaquina_DM,
    IDRegistroDM_AP: String(maquina.ID),
    EdificioDestino_AP: destino,
    SegmentoTranferir_AP: maquina.Segmento_DM,
    SegMarcMod_AP: maquina.ConcatMaquina_DM,
    IDMaquinaTransferencia_AP: maquina.IDMaquina_DM,
    TipoEncendido_AP: encendidoElegido,
    EdificioSelect_AP: maquina.Edificio_DM,
    ConcatAprobacion_AP: `Transferencia de Maquina - ${maquina.ConcatMaquinaIncidente_DM}`,
    MaquinaAprobacion_AP: maquina.ConcatMaquinaIncidente_DM,
    Motivo_AP: motivo,
    Rechazada_AP: 'NO',
    Aprobada_AP: 'NO',
    FechaGen_AP: f.fecha,
    FechaMesAnoGen_AP: f.mesAno,
    FechaMesGen_AP: f.mes,
    FechaAnoGen_AP: f.ano,
    UserGen_AP: usuario,
    HoraGen_AP: f.hora,
    VersionGen_AP: APP_VERSION,
    Version_AP: APP_VERSION,
  };
}

/** Campos del select para leer una aprobación de Transferencia y poder aplicarla. */
export const transferAprobacionSelectFields = (): string[] => [
  'IDRegistroDM_AP',
  'EdificioDestino_AP',
  'SegmentoTranferir_AP',
  'SegMarcMod_AP',
  'TipoEncendido_AP',
  'EdificioSelect_AP',
  'Motivo_AP',
  'MaquinaAprobacion_AP',
];

/**
 * Aplica una aprobación "Transferencia de Maquina" ya aprobada: mueve la máquina
 * (IDRegistroDM_AP) al edificio destino con la misma lógica de encendido/stock/bitácora.
 */
export async function applyTransferFromAprobacion(aprobFields: Record<string, unknown>, usuario: string): Promise<void> {
  const maquinaId = Number(aprobFields.IDRegistroDM_AP);
  if (!maquinaId) return;
  const raw = await getItem(LIST_IDS.detalleMaquina, maquinaId, maquinaSelectFields());
  if (!raw) return;
  const maquina = mapMaquina(raw);
  const destino = String(aprobFields.EdificioDestino_AP ?? '');

  // Código del edificio destino: la aprobación no lo guarda; se deriva de las máquinas del destino.
  let codigo = '';
  if (destino.trim() !== DEPOSITO) {
    const dm = await machinesInBuilding(destino);
    codigo = dm[0]?.CodigoEdificio_DM ?? '';
  }

  await applyMaquinaTransfer({
    maquina,
    destino,
    codigoDestino: codigo,
    motivo: String(aprobFields.Motivo_AP ?? ''),
    encendidoElegido: String(aprobFields.TipoEncendido_AP ?? ''),
    usuario,
  });
}
