import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listItems, createItem, updateItem, GraphError } from '../_lib/graph.js';
import {
  LIST_IDS,
  mapRuta,
  rutaSelectFields,
  mapResumenCircuito,
  resumenCircuitoSelectFields,
  mapDetalleCircuito,
  detalleCircuitoSelectFields,
  canEditAbm,
} from '../_lib/lists.js';
import { readSession } from '../_lib/session.js';

interface Body {
  action?: 'create' | 'delete';
  nroRuta?: number | string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = readSession(req.headers.cookie);
  if (!session) return res.status(401).json({ error: 'no_session' });
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!canEditAbm(session.rol, 'Rutas')) {
    return res.status(403).json({ error: 'forbidden', message: 'Tu rol no puede editar rutas.' });
  }

  const body = (req.body ?? {}) as Body;
  try {
    if (body.action === 'create') return await create(body, res);
    if (body.action === 'delete') return await remove(body, res);
    return res.status(400).json({ error: 'invalid', message: 'Acción de ruta desconocida' });
  } catch (err) {
    console.error('abm/rutas error', err);
    const status = err instanceof GraphError ? 502 : 500;
    return res.status(status).json({ error: 'server_error' });
  }
}

// ── Crear ruta ────────────────────────────────────────────────────────────
async function create(body: Body, res: VercelResponse) {
  const nroRuta = Number(body.nroRuta);
  if (!body.nroRuta || !Number.isInteger(nroRuta) || nroRuta <= 0) {
    return res.status(400).json({ error: 'invalid', message: 'El número de ruta tiene que ser un entero positivo' });
  }
  const activas = (await listItems(LIST_IDS.rutas, { select: rutaSelectFields(), filter: `fields/Status_RT eq 'Activo'`, top: 999 })).map(mapRuta);
  if (activas.some((r) => r.NroRuta === nroRuta)) {
    return res.status(409).json({ error: 'invalid', message: `Ya existe la ruta ${nroRuta}` });
  }
  await createItem(LIST_IDS.rutas, {
    Title: 'sumar',
    Status_RT: 'Activo',
    NroRuta_RT: nroRuta,
    CantidadCircuitos_RT: 0,
    CantEdificios_RT: 0,
  });
  return res.status(201).json({ nroRuta });
}

// ── Eliminar ruta (cascada: circuitos + sus detalles) ─────────────────────
async function remove(body: Body, res: VercelResponse) {
  const nroRuta = Number(body.nroRuta);
  if (!nroRuta) return res.status(400).json({ error: 'invalid', message: 'Falta la ruta' });

  const [rutaRows, circRows, detRows] = await Promise.all([
    listItems(LIST_IDS.rutas, { select: rutaSelectFields(), filter: `fields/Status_RT eq 'Activo'`, top: 999 }),
    listItems(LIST_IDS.resumenCircuito, { select: resumenCircuitoSelectFields(), filter: `fields/Status_RC eq 'Activo'`, top: 999 }),
    listItems(LIST_IDS.detalleCircuito, { select: detalleCircuitoSelectFields(), filter: `fields/Status_DC eq 'Activo'`, top: 2000 }),
  ]);
  const ruta = rutaRows.map(mapRuta).find((r) => r.NroRuta === nroRuta);
  if (!ruta) return res.status(404).json({ error: 'not_found', message: 'La ruta no existe o ya fue eliminada' });

  const circuitos = circRows.map(mapResumenCircuito).filter((c) => c.NroRuta === nroRuta);
  const nrosCircuito = new Set(circuitos.map((c) => c.NroCircuito));
  const detalles = detRows.map(mapDetalleCircuito).filter((d) => nrosCircuito.has(d.NroCircuito));

  // Cascada de baja lógica: detalles → circuitos → ruta.
  for (const d of detalles) await updateItem(LIST_IDS.detalleCircuito, d.ID, { Status_DC: 'Eliminado' });
  for (const c of circuitos) await updateItem(LIST_IDS.resumenCircuito, c.ID, { Status_RC: 'Eliminado' });
  await updateItem(LIST_IDS.rutas, ruta.ID, { Status_RT: 'Eliminada' });

  return res.status(200).json({ nroRuta, circuitosEliminados: circuitos.length, edificiosLiberados: detalles.length });
}
