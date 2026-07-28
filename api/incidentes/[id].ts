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
  mapFotoIncidente,
  fotoIncidenteSelectFields,
  fechasHoy,
  APP_VERSION,
} from '../_lib/lists.js';
import { readSession, type SessionPayload } from '../_lib/session.js';
import { puedeAccederModulo } from '../_lib/permisos.js';

// Estados desde los que un Admin puede anular (baja lógica) un incidente: los
// abiertos. Los resueltos/cerrados (Resuelto, Aprobada, Rechazada) y los ya
// anulados no se tocan.
// 'En Aprobacion' excluido: un reclamo que ya avanzó a aprobación no se anula.
const ESTADOS_ANULABLES = ['A Revisar', 'Pendiente', 'Asignado'];

interface Body {
  action?: 'assign' | 'cambiar-tecnico' | 'desasignar' | 'cambio-maquina' | 'generar-compra' | 'anular' | 'edit';
  tecnico?: string;
  fechaAsignada?: string;
  maquinaConcat?: string; // ConcatMaquinaIncidente de la máquina de reemplazo
  idMaquinaReemplazo?: string;
  tipoCompra?: 'repuesto' | 'maquina';
  item?: string; // repuesto o ConcatMaquina a comprar
  segmento?: string;
  // Edición de un incidente "A Revisar" (mismos campos que el alta).
  edificio?: string;
  codigoEdificio?: string;
  descripcion?: string;
  idMaquina?: string;
  /** Motivo de la anulación (obligatorio en la acción 'anular') → DescripcionAnulado_IN. */
  motivo?: string;
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
  const rawId = req.query.id;
  const id = Number(Array.isArray(rawId) ? rawId[0] : rawId);
  if (!id) return res.status(400).json({ error: 'invalid_id' });

  // ── GET: fotos del incidente (12.FotoIncidentes) ────────────────────────
  // LAZY a propósito: Foto_FI es base64 de cientos de KB por fila. Nunca en el listado
  // general (mismo criterio que ImagenGral de 01.Registros).
  if (req.method === 'GET') {
    if (!(await puedeAccederModulo(session.rol, 'Incidentes'))) {
      return res.status(403).json({ error: 'forbidden', message: 'Tu rol no tiene habilitado el módulo Incidentes.' });
    }
    try {
      const fotos = (
        await listItems(LIST_IDS.fotoIncidentes, {
          select: fotoIncidenteSelectFields(),
          filter: `fields/IDIncidente_FI eq '${id}'`, // columna TEXTO → valor entrecomillado
          top: 20,
        })
      )
        .map(mapFotoIncidente)
        .filter((f) => f.Foto_FI)
        .sort((a, b) => b.ID - a.ID); // última primero
      return res.status(200).json({ fotos });
    } catch (err) {
      console.error('incidentes GET fotos error', err);
      return res.status(err instanceof GraphError ? 502 : 500).json({ error: 'server_error' });
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const body = (req.body ?? {}) as Body;

  try {
    if (!(await puedeAccederModulo(session.rol, 'Incidentes'))) {
      return res.status(403).json({ error: 'forbidden', message: 'Tu rol no tiene habilitado el módulo Incidentes.' });
    }
    if (body.action === 'assign') return await assign(id, body, res);
    if (body.action === 'cambiar-tecnico') return await cambiarTecnico(id, body, res);
    if (body.action === 'desasignar') return await desasignar(id, res);
    if (body.action === 'cambio-maquina') return await cambioMaquina(id, body, res);
    if (body.action === 'generar-compra') return await generarCompra(id, body, res, session);
    if (body.action === 'anular') return await anular(id, body, res, session);
    if (body.action === 'edit') return await editIncidente(id, body, res);
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

// ── Transferir / cambiar técnico (NO toca stock ni el tipo NoResuelto_IN) ─
// Fiel al msapp (Screen_Incidentes PopUpCambiarTecnico / IMG_TransferirTecnico):
// sólo reasigna el técnico y define el estado destino como
//   Status_IN = If(AC, 'A Revisar', 'Asignado'),
//   AC = NoResuelto_IN ∈ {'Atencion al Cliente', 'Reportado Por Tecnico'}.
// Los incidentes 'A Revisar' (triaje pendiente en la MOBILE) conservan su estado
// 'A Revisar': el desktop NO presume repuesto (no descuenta stock) ni fuerza el tipo.
async function cambiarTecnico(id: number, body: Body, res: VercelResponse) {
  const tecnico = body.tecnico?.trim();
  if (!tecnico) return res.status(400).json({ error: 'invalid', message: 'Falta el técnico' });
  const incRaw = await getItem(LIST_IDS.incidentes, id, incidenteSelectFields());
  if (!incRaw) return res.status(404).json({ error: 'not_found', message: 'El incidente no existe' });
  const inc = mapIncidente(incRaw);
  const esAtencionCliente =
    inc.NoResuelto_IN === 'Atencion al Cliente' || inc.NoResuelto_IN === 'Reportado Por Tecnico';
  const status = esAtencionCliente ? 'A Revisar' : 'Asignado';
  await updateItem(LIST_IDS.incidentes, id, { TecnicoAsignado_IN: tecnico, Status_IN: status });
  return res.status(200).json({ ID: id, Status_IN: status, TecnicoAsignado_IN: tecnico });
}

// ── Desasignar: saca el técnico de un incidente "A Revisar" ──────────────
// Paridad con el PowerApps de la MOBILE (Screen_Incidentes.pa.yaml, botón "Continuar"):
// el único lugar donde PowerApps borraba la asignación era el "No Resuelto" del técnico
// —`TecnicoAsignado_IN: Blank()`— y siempre sobre un incidente en "A Revisar", es decir
// ANTES de que el desktop comprometiera stock. Acá replicamos ese caso: el aviso
// "revisá esto" se manda por error o el técnico no va más, y el reclamo vuelve al pool.
//
// Gate deliberado en 'A Revisar': un 'Asignado' YA descontó de 04.Stock los repuestos de
// 13.RepuestosIncidentes (ver assign/descontarRepuestos). Desasignarlo sin reintegrar
// dejaría stock comprometido en el aire y lo volvería a descontar al reasignar. Ese caso
// no existía en PowerApps y no se habilita acá: para un asignado se usa 'cambiar-tecnico'.
async function desasignar(id: number, res: VercelResponse) {
  const incRaw = await getItem(LIST_IDS.incidentes, id, incidenteSelectFields());
  if (!incRaw) return res.status(404).json({ error: 'not_found', message: 'El incidente no existe' });
  const inc = mapIncidente(incRaw);
  if (inc.Status_IN !== 'A Revisar') {
    return res.status(409).json({
      error: 'invalid_state',
      message: 'Solo se puede desasignar un incidente en estado "A Revisar". Para uno ya asignado, usá "Cambiar técnico".',
    });
  }
  // FechaAsignada_IN se limpia junto con el técnico: sin técnico no hay fecha de asignación.
  // Columnas TEXTO → se vacían con '' (SharePoint no acepta null en estas columnas).
  await updateItem(LIST_IDS.incidentes, id, { TecnicoAsignado_IN: '', FechaAsignada_IN: '' });
  return res.status(200).json({ ID: id, Status_IN: inc.Status_IN, TecnicoAsignado_IN: '' });
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

// ── Anular incidente (baja lógica) — SOLO Admin, Status_IN -> 'Anulado' ───
// Mismo patrón que la anulación de visitas del Home (baja lógica + gate Admin
// server-side). El estado 'Anulado' ya existe en el msapp (Screen_Incidentes).
async function anular(id: number, body: Body, res: VercelResponse, session: SessionPayload) {
  if (session.rol !== 'Admin') {
    return res.status(403).json({ error: 'forbidden', message: 'Sólo un Admin puede anular un reclamo.' });
  }
  // Motivo OBLIGATORIO: antes el desktop anulaba sin dejar rastro y DescripcionAnulado_IN quedaba
  // vacía (verificado: los 14 anulados desde el desktop no tienen motivo, contra 378 de la mobile
  // que sí). Misma columna que escribe la mobile (input_obsAnular → DescripcionAnulado_IN).
  const motivo = body.motivo?.trim();
  if (!motivo) {
    return res.status(400).json({ error: 'invalid', message: 'Indicá el motivo de la anulación.' });
  }
  const incRaw = await getItem(LIST_IDS.incidentes, id, incidenteSelectFields());
  if (!incRaw) return res.status(404).json({ error: 'not_found', message: 'El incidente no existe' });
  const inc = mapIncidente(incRaw);
  if (inc.Resuelto_IN === 'SI' || !ESTADOS_ANULABLES.includes(inc.Status_IN)) {
    return res.status(409).json({ error: 'invalid_state', message: 'Este reclamo no se puede anular por su estado.' });
  }
  // Resuelto_IN se deja en 'NO' a propósito (decisión ya tomada: un anulado no es un resuelto y
  // ensuciaría los KPIs). Los consumidores filtran por Status_IN !== 'Anulado'.
  await updateItem(LIST_IDS.incidentes, id, {
    Status_IN: 'Anulado',
    DescripcionAnulado_IN: motivo,
    UsuarioAnulado_IN: session.usuario, // auditoría del autor (columna creada a mano en SharePoint)
  });
  return res.status(200).json({ ID: id, Status_IN: 'Anulado', DescripcionAnulado_IN: motivo });
}

// ── Editar un incidente "A Revisar" ───────────────────────────────────────
// Solo se pueden editar los que siguen en "A Revisar" (todavía sin triaje): edificio, máquina,
// descripción del problema y técnico a avisar. Mismos campos que el alta. Si ya avanzó de estado
// (Asignado/En Aprobacion/Resuelto/…) no se edita: cambiar de técnico/máquina tiene sus propias
// acciones (cambiar-tecnico, cambio-maquina).
async function editIncidente(id: number, body: Body, res: VercelResponse) {
  const edificio = body.edificio?.trim();
  const descripcion = body.descripcion?.trim();
  if (!edificio || !descripcion) {
    return res.status(400).json({ error: 'invalid', message: 'Falta el edificio o la descripción' });
  }
  const incRaw = await getItem(LIST_IDS.incidentes, id, incidenteSelectFields());
  if (!incRaw) return res.status(404).json({ error: 'not_found', message: 'El incidente no existe' });
  const inc = mapIncidente(incRaw);
  if (inc.Status_IN !== 'A Revisar') {
    return res.status(409).json({
      error: 'invalid_state',
      message: 'Solo se pueden editar los incidentes en estado "A Revisar".',
    });
  }
  // ConcatMaquina_IN + IDMaquina_IN son la IDENTIDAD de la máquina del incidente, y de ellas
  // depende que la mobile pueda encontrar la unidad en 08.DetalleMaquina al resolver un cambio de
  // máquina (findMaquinaDM). Se escriben SOLO si vienen definidas: el modal manda `undefined`
  // cuando no logró precargar la máquina (p. ej. incidentes viejos de la mobile, que guardan la
  // clave de MODELO), y pisarlas con '' borraba esa identidad para siempre en una edición que solo
  // quería corregir la descripción. Mandar '' explícito sí las limpia (cambio de edificio).
  await updateItem(LIST_IDS.incidentes, id, {
    NombreEdificio_IN: edificio,
    CodigoEdifcio_IN: body.codigoEdificio?.trim() ?? '',
    ...(body.maquinaConcat !== undefined && { ConcatMaquina_IN: body.maquinaConcat.trim() }),
    ...(body.idMaquina !== undefined && { IDMaquina_IN: body.idMaquina.trim() }),
    DescripcionCarga_IN: descripcion,
    TecnicoAsignado_IN: body.tecnico?.trim() ?? '',
  });
  const updated = mapIncidente((await getItem(LIST_IDS.incidentes, id, incidenteSelectFields()))!);
  return res.status(200).json(updated);
}
