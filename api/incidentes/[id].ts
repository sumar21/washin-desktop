import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listItems, getItem, createItem, updateItem, GraphError } from '../_lib/graph.js';
import {
  LIST_IDS,
  mapIncidente,
  incidenteSelectFields,
  mapRepuestoIncidente,
  repuestoIncidenteSelectFields,
  mapStock,
  stockSelectFields,
  fechasHoy,
  APP_VERSION,
} from '../_lib/lists.js';
import { readSession, type SessionPayload } from '../_lib/session.js';
import { puedeAccederModulo } from '../_lib/permisos.js';

interface Body {
  action?: 'assign' | 'cambiar-tecnico' | 'cambio-maquina' | 'generar-compra';
  tecnico?: string;
  fechaAsignada?: string;
  maquinaConcat?: string; // ConcatMaquinaIncidente de la máquina de reemplazo
  idMaquinaReemplazo?: string;
  tipoCompra?: 'repuesto' | 'maquina';
  item?: string; // repuesto o ConcatMaquina a comprar
  segmento?: string;
}

/** Descuenta de 04.Stock los repuestos del incidente (match Item_ST = Repuesto_RI, clamp ≥0). */
async function descontarRepuestos(incidenteId: number): Promise<void> {
  const reps = (
    await listItems(LIST_IDS.repuestosIncidentes, {
      select: repuestoIncidenteSelectFields(),
      filter: `fields/IDIncidente_IN eq '${incidenteId}'`,
    })
  ).map(mapRepuestoIncidente);
  if (reps.length === 0) return;
  const stock = (await listItems(LIST_IDS.stock, { select: stockSelectFields(), filter: `fields/Status_ST eq 'Activo'` })).map(mapStock);
  for (const r of reps) {
    const key = r.Repuesto_RI.trim().toLowerCase();
    const row = stock.find((s) => s.Item_ST.trim().toLowerCase() === key);
    if (!row) continue;
    const nueva = Math.max(0, row.Cantidad_ST - r.Cantidad_RI);
    await updateItem(LIST_IDS.stock, row.ID, { Cantidad_ST: String(nueva) });
    row.Cantidad_ST = nueva; // por si otro repuesto toca la misma fila
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = readSession(req.headers.cookie);
  if (!session) return res.status(401).json({ error: 'no_session' });
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const rawId = req.query.id;
  const id = Number(Array.isArray(rawId) ? rawId[0] : rawId);
  if (!id) return res.status(400).json({ error: 'invalid_id' });

  const body = (req.body ?? {}) as Body;

  try {
    if (!(await puedeAccederModulo(session.rol, 'Incidentes'))) {
      return res.status(403).json({ error: 'forbidden', message: 'Tu rol no tiene habilitado el módulo Incidentes.' });
    }
    if (body.action === 'assign') return await assign(id, body, res);
    if (body.action === 'cambiar-tecnico') return await cambiarTecnico(id, body, res);
    if (body.action === 'cambio-maquina') return await cambioMaquina(id, body, res);
    if (body.action === 'generar-compra') return await generarCompra(id, body, res, session);
    return res.status(400).json({ error: 'invalid', message: 'Acción de incidente desconocida' });
  } catch (err) {
    console.error('incidentes [id] POST error', err);
    const status = err instanceof GraphError ? 502 : 500;
    return res.status(status).json({ error: 'server_error' });
  }
}

// ── Asignar técnico (+ descuento de stock de los repuestos) ───────────────
async function assign(id: number, body: Body, res: VercelResponse) {
  const tecnico = body.tecnico?.trim();
  if (!tecnico) return res.status(400).json({ error: 'invalid', message: 'Falta el técnico' });
  const f = fechasHoy();
  await updateItem(LIST_IDS.incidentes, id, {
    FechaAsignada_IN: body.fechaAsignada?.trim() || f.fecha,
    Status_IN: 'Asignado',
    TecnicoAsignado_IN: tecnico,
  });
  await descontarRepuestos(id);
  return res.status(200).json({ ID: id, Status_IN: 'Asignado', TecnicoAsignado_IN: tecnico });
}

// ── Cambiar técnico (sin tocar stock ni status más allá de Asignado) ─────
async function cambiarTecnico(id: number, body: Body, res: VercelResponse) {
  const tecnico = body.tecnico?.trim();
  if (!tecnico) return res.status(400).json({ error: 'invalid', message: 'Falta el técnico' });
  await updateItem(LIST_IDS.incidentes, id, { TecnicoAsignado_IN: tecnico, Status_IN: 'Asignado' });
  return res.status(200).json({ ID: id, TecnicoAsignado_IN: tecnico });
}

// ── Cambio de máquina → genera 07.Aprobaciones + incidente En Aprobacion ─
async function cambioMaquina(id: number, body: Body, res: VercelResponse) {
  const maquinaConcat = body.maquinaConcat?.trim();
  if (!maquinaConcat) return res.status(400).json({ error: 'invalid', message: 'Falta la máquina de reemplazo' });

  const incRaw = await getItem(LIST_IDS.incidentes, id, incidenteSelectFields());
  if (!incRaw) return res.status(404).json({ error: 'not_found', message: 'El incidente no existe' });

  const f = fechasHoy();
  await createItem(LIST_IDS.aprobaciones, {
    Title: 'Washinn',
    Status_AP: 'En Aprobacion',
    TipoAprobacion_AP: 'Cambio de Maquina',
    IDMaquina_AP: String(id), // el approve lee este ID para actualizar el incidente
    ConcatAprobacion_AP: `Cambio de Maquina - ${body.idMaquinaReemplazo?.trim() || maquinaConcat}`,
    MaquinaAprobacion_AP: maquinaConcat,
    Rechazada_AP: 'NO',
    Aprobada_AP: 'NO',
    FechaGen_AP: f.fecha,
    FechaMesAnoGen_AP: f.mesAno,
    FechaMesGen_AP: f.mes,
    FechaAnoGen_AP: f.ano,
    VersionGen_AP: APP_VERSION,
  });

  await updateItem(LIST_IDS.incidentes, id, { Status_IN: 'En Aprobacion', MaquinaAsignada_IN: maquinaConcat });
  return res.status(200).json({ ID: id, Status_IN: 'En Aprobacion' });
}

// ── Generar compra desde el incidente (repuesto o máquina), ya Aprobada ──
async function generarCompra(id: number, body: Body, res: VercelResponse, session: SessionPayload) {
  const item = body.item?.trim();
  const segmento = body.segmento?.trim() || (body.tipoCompra === 'repuesto' ? 'Repuesto' : '');
  if (!item || !segmento) return res.status(400).json({ error: 'invalid', message: 'Falta el item o el segmento a comprar' });

  const incRaw = await getItem(LIST_IDS.incidentes, id, incidenteSelectFields());
  if (!incRaw) return res.status(404).json({ error: 'not_found', message: 'El incidente no existe' });
  const inc = mapIncidente(incRaw);

  const f = fechasHoy();
  const idUnivoco = `${session.usuario.slice(0, 3)} - ${f.stamp} - ${f.fecha}`;

  await createItem(LIST_IDS.pedidoCompras, {
    Title: 'Washinn',
    Status_PC: 'Aprobada',
    Cantidad_PC: '1',
    Segmento_PC: segmento,
    Edificio_PC: inc.NombreEdificio_IN,
    Fecha_PC: f.fecha,
    FechaMes_PC: f.mes,
    FechaMesAno_PC: f.mesAno,
    FechaAno_PC: f.ano,
    Usuario_PC: session.usuario,
    Version_PC: APP_VERSION,
    IDUnivoco_PC: idUnivoco,
    Filtrar_PC: 'NO',
    Hora_PC: f.hora,
    IDIncidenteCompra_PC: String(id),
  });

  await createItem(LIST_IDS.detalleCompra, {
    Title: 'Washinn',
    IDCompra_DC: idUnivoco,
    Status_DC: 'Aprobada',
    Item_DC: item,
    Cantidad_DC: '1',
    Segmento_DC: segmento,
    Fecha_DC: f.fecha,
    FechaMesAno_DC: f.mesAno,
    FechaAno_DC: f.ano,
  });

  return res.status(201).json({ ID: id, compra: idUnivoco });
}
