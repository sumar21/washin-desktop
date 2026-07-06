import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listItems, GraphError } from '../_lib/graph.ts';
import { LIST_IDS, mapTecnicos, tecnicosSelectFields } from '../_lib/lists.ts';
import { readSession } from '../_lib/session.ts';

/** Técnicos disponibles para asignar stock (Usuarios activos, rol Tecnico o Jefe Taller). */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  if (!readSession(req.headers.cookie)) {
    return res.status(401).json({ error: 'no_session' });
  }

  try {
    const rows = await listItems(LIST_IDS.usuarios, { select: tecnicosSelectFields() });
    return res.status(200).json(mapTecnicos(rows));
  } catch (err) {
    console.error('tecnicos GET error', err);
    const status = err instanceof GraphError ? 502 : 500;
    return res.status(status).json({ error: 'server_error' });
  }
}
