import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listItems, GraphError } from '../_lib/graph.ts';
import { LIST_IDS, mapAprobacion, aprobacionSelectFields, fechasHoy } from '../_lib/lists.ts';
import { readSession } from '../_lib/session.ts';

/** Bandeja de aprobaciones pendientes del mes actual (Aprobada=NO y Rechazada=NO). */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!readSession(req.headers.cookie)) {
    return res.status(401).json({ error: 'no_session' });
  }

  const mesAno = fechasHoy().mesAno;
  try {
    const rows = await listItems(LIST_IDS.aprobaciones, {
      select: aprobacionSelectFields(),
      filter: `fields/FechaMesAnoGen_AP eq '${mesAno}'`,
    });
    // Filtro en memoria (los flags son columnas no indexadas → no combinables en $filter).
    const aprobaciones = rows
      .map(mapAprobacion)
      .filter((a) => a.Aprobada_AP === 'NO' && a.Rechazada_AP === 'NO');
    return res.status(200).json(aprobaciones);
  } catch (err) {
    console.error('aprobaciones GET error', err);
    const status = err instanceof GraphError ? 502 : 500;
    return res.status(status).json({ error: 'server_error' });
  }
}
