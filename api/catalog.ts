import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listItems, GraphError } from './_lib/graph.js';
import {
  LIST_IDS,
  buildCatalog,
  itemComprasSelectFields,
  repuestosSelectFields,
  maquinasCompraSelectFields,
} from './_lib/lists.js';
import { readSession } from './_lib/session.js';

/**
 * Catálogo para armar una compra / alta de stock:
 * - `segmentos`: valores reales del combo (99.ABM_ItemCompras.Item_IC activos).
 * - `items`: repuestos (11.Respuestos) + máquinas (99.ABM_MaquinasCompra), con su segmento.
 * Reemplaza el mock `mockStockCatalog`.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!readSession(req.headers.cookie)) {
    return res.status(401).json({ error: 'no_session' });
  }

  try {
    const [segRows, repuestoRows, maquinaRows] = await Promise.all([
      listItems(LIST_IDS.itemCompras, { select: itemComprasSelectFields() }),
      listItems(LIST_IDS.repuestos, { select: repuestosSelectFields() }),
      listItems(LIST_IDS.maquinasCompra, { select: maquinasCompraSelectFields() }),
    ]);
    return res.status(200).json(buildCatalog(segRows, repuestoRows, maquinaRows));
  } catch (err) {
    console.error('catalog error', err);
    const status = err instanceof GraphError ? 502 : 500;
    return res.status(status).json({ error: 'server_error' });
  }
}
