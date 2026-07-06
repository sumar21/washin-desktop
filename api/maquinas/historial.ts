import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listItems, GraphError } from '../_lib/graph.js';
import { LIST_IDS, mapHistorial, historialSelectFields } from '../_lib/lists.js';
import { readSession } from '../_lib/session.js';

function odataEscape(v: string): string {
  return v.replace(/'/g, "''");
}

/**
 * Historial de una máquina = incidentes de 10.Incidentes cuya máquina coincide
 * (por `ConcatMaquina_IN` o `MaquinaAsignada_IN` == ConcatMaquinaIncidente_DM).
 * Se pasa el concat por query (?concat=...).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!readSession(req.headers.cookie)) {
    return res.status(401).json({ error: 'no_session' });
  }

  const raw = req.query.concat;
  const concat = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  if (!concat) return res.status(400).json({ error: 'invalid', message: 'Falta la máquina (concat)' });

  try {
    const esc = odataEscape(concat);
    const rows = await listItems(LIST_IDS.incidentes, {
      select: historialSelectFields(),
      filter: `fields/ConcatMaquina_IN eq '${esc}' or fields/MaquinaAsignada_IN eq '${esc}'`,
    });
    const historial = rows.map(mapHistorial).sort((a, b) => b.ID - a.ID);
    return res.status(200).json(historial);
  } catch (err) {
    console.error('maquinas historial error', err);
    const status = err instanceof GraphError ? 502 : 500;
    return res.status(status).json({ error: 'server_error' });
  }
}
