import type { VercelRequest, VercelResponse } from '@vercel/node';
import { updateItem, GraphError } from '../_lib/graph.js';
import { LIST_IDS, fechasHoy, desglosarFechaDDMMYYYY, APP_VERSION } from '../_lib/lists.js';
import { readSession } from '../_lib/session.js';

interface Body {
  action?: 'assign' | 'delete';
  tecnico?: string; // Concat_Nombre_Apellido
  idTecnico?: number | string;
  proximaLimpieza?: string; // dd/mm/yyyy
  frecuencia?: number | string; // días
  idEdificio?: number | string;
  esIncidente?: 'SI' | 'NO';
  frecuenciaChanged?: boolean;
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
    if (body.action === 'assign') return await assign(id, body, res);
    if (body.action === 'delete') return await softDelete(id, res);
    return res.status(400).json({ error: 'invalid', message: 'Acción de ventilación desconocida' });
  } catch (err) {
    console.error('ventilaciones [id] POST error', err);
    const status = err instanceof GraphError ? 502 : 500;
    return res.status(status).json({ error: 'server_error' });
  }
}

// ── Asignar técnico (+ próxima fecha + frecuencia) ────────────────────────
// Fiel a la PowerApp: setea Estado→Asignada, técnico, nueva próxima fecha, sellos
// de asignación y Orden_VE="3". Si la ventilación fue adelantada por un técnico
// (EsIncidente="SI") y cambió la frecuencia, corrige también la del edificio.
async function assign(id: number, body: Body, res: VercelResponse) {
  const tecnico = body.tecnico?.trim();
  const idTecnico = Number(body.idTecnico);
  const proxima = body.proximaLimpieza?.trim();
  if (!tecnico || !idTecnico) return res.status(400).json({ error: 'invalid', message: 'Falta el técnico' });
  if (!proxima) return res.status(400).json({ error: 'invalid', message: 'Falta la próxima fecha de limpieza' });

  const f = fechasHoy();
  const { mesAno, ano } = desglosarFechaDDMMYYYY(proxima);
  const frecuencia = Number(body.frecuencia);
  const idEdificio = Number(body.idEdificio);

  if (body.frecuenciaChanged && body.esIncidente === 'SI' && frecuencia && idEdificio) {
    await updateItem(LIST_IDS.edificios, idEdificio, { Frecuencia_ED: frecuencia });
  }

  await updateItem(LIST_IDS.ventilaciones, id, {
    Estado_VE: 'Asignada',
    Asignado_VE: tecnico,
    IDAsignado_VE: idTecnico,
    ProximaLimpieza_VE: proxima,
    FechaAnoProxima_VE: ano,
    FechaMesAnoProxima_VE: mesAno,
    // La fecha programada por el técnico (estado Programada) queda obsoleta al re-asignar:
    // se limpia para que la grilla muestre la nueva ProximaLimpieza, no la vieja.
    FechaProgramada_VE: '',
    FechaAsignado_VE: f.fecha,
    HoraAsignado_VE: f.hora,
    VersionAsignado_VE: APP_VERSION,
    Orden_VE: '3',
  });

  return res.status(200).json({ ID: id, Estado_VE: 'Asignada', Asignado_VE: tecnico });
}

// ── Baja lógica (Estado_VE="Eliminada", como la PowerApp) ─────────────────
async function softDelete(id: number, res: VercelResponse) {
  await updateItem(LIST_IDS.ventilaciones, id, { Estado_VE: 'Eliminada' });
  return res.status(200).json({ ID: id, Estado_VE: 'Eliminada' });
}
