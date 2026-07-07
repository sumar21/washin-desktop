import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listItems, GraphError } from '../_lib/graph.js';
import {
  LIST_IDS,
  mapRuta,
  rutaSelectFields,
  mapResumenCircuito,
  resumenCircuitoSelectFields,
  mapDetalleCircuito,
  detalleCircuitoSelectFields,
  mapEdificioAbm,
  edificioAbmSelectFields,
  mapFrecuencias,
  mapGruposVent,
  mapRolesActivos,
  abmAccess,
} from '../_lib/lists.js';
import { readSession } from '../_lib/session.js';

/**
 * Bundle de los ABMs de Configuración (Rutas ⟶ Circuitos ⟶ Edificios) + catálogos.
 * Solo lectura acá; los writes (con validaciones + gate de acceso) van en los
 * endpoints por recurso. Devuelve `access` para que el front arme las pestañas.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = readSession(req.headers.cookie);
  if (!session) return res.status(401).json({ error: 'no_session' });

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  try {
    const [rutaRows, circRows, detRows, edifRows, frecRows, grupoRows, rolRows] = await Promise.all([
      listItems(LIST_IDS.rutas, { select: rutaSelectFields(), filter: `fields/Status_RT eq 'Activo'`, top: 999 }),
      listItems(LIST_IDS.resumenCircuito, { select: resumenCircuitoSelectFields(), filter: `fields/Status_RC eq 'Activo'`, top: 999 }),
      listItems(LIST_IDS.detalleCircuito, { select: detalleCircuitoSelectFields(), filter: `fields/Status_DC eq 'Activo'`, top: 2000 }),
      listItems(LIST_IDS.edificios, { select: edificioAbmSelectFields(), filter: `fields/Status eq 'ALTA'`, top: 999 }),
      listItems(LIST_IDS.frecuencias, { top: 999 }),
      listItems(LIST_IDS.gruposVent, { top: 999 }),
      listItems(LIST_IDS.roles, { top: 999 }),
    ]);

    const rutas = rutaRows.map(mapRuta).sort((a, b) => a.NroRuta - b.NroRuta);
    const circuitos = circRows.map(mapResumenCircuito).sort((a, b) => a.NroCircuito - b.NroCircuito);
    const detalles = detRows.map(mapDetalleCircuito);
    const edificios = edifRows
      .map(mapEdificioAbm)
      .filter((e) => e.Edificio !== '')
      .sort((a, b) => a.Edificio.localeCompare(b.Edificio, 'es'));
    const frecuencias = mapFrecuencias(frecRows);
    const grupos = mapGruposVent(grupoRows);
    const roles = mapRolesActivos(rolRows);

    return res.status(200).json({
      rutas,
      circuitos,
      detalles,
      edificios,
      frecuencias,
      grupos,
      roles,
      access: abmAccess(session.rol),
    });
  } catch (err) {
    console.error('abm GET error', err);
    const status = err instanceof GraphError ? 502 : 500;
    return res.status(status).json({ error: 'server_error' });
  }
}
