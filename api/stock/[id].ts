import type { VercelRequest, VercelResponse } from '@vercel/node';
import { updateItem, GraphError } from '../_lib/graph.js';
import { LIST_IDS, STOCK_EDIT_ROLES } from '../_lib/lists.js';
import { readSession } from '../_lib/session.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const session = readSession(req.headers.cookie);
  if (!session) return res.status(401).json({ error: 'no_session' });
  if (!STOCK_EDIT_ROLES.has(session.rol)) {
    return res.status(403).json({ error: 'forbidden', message: 'No tenés permiso para editar stock' });
  }

  const id = req.query.id;
  const stockId = Number(Array.isArray(id) ? id[0] : id);
  if (!stockId) return res.status(400).json({ error: 'invalid_id' });

  const { cantidad } = (req.body ?? {}) as { cantidad?: number };
  if (cantidad == null || cantidad < 0) {
    return res.status(400).json({ error: 'invalid', message: 'Cantidad inválida' });
  }

  try {
    await updateItem(LIST_IDS.stock, stockId, { Cantidad_ST: String(cantidad) });
    return res.status(200).json({ ID: stockId, Cantidad_ST: cantidad });
  } catch (err) {
    console.error('stock PATCH error', err);
    const status = err instanceof GraphError ? 502 : 500;
    return res.status(status).json({ error: 'server_error' });
  }
}
