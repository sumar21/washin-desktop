import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listItems, createItem, updateItem, GraphError } from '../_lib/graph.ts';
import { LIST_IDS, mapStock, stockSelectFields, STOCK_EDIT_ROLES } from '../_lib/lists.ts';
import { readSession } from '../_lib/session.ts';

interface AddStockBody {
  tipo?: string;
  item?: string;
  marca?: string;
  codigo?: string;
  cantidad?: number;
  nroSerie?: string;
  idMaquina?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = readSession(req.headers.cookie);
  if (!session) return res.status(401).json({ error: 'no_session' });

  if (req.method === 'GET') {
    try {
      const rows = await listItems(LIST_IDS.stock, {
        select: stockSelectFields(),
        filter: `fields/Status_ST eq 'Activo'`,
      });
      return res.status(200).json(rows.map(mapStock));
    } catch (err) {
      console.error('stock GET error', err);
      const status = err instanceof GraphError ? 502 : 500;
      return res.status(status).json({ error: 'server_error' });
    }
  }

  if (req.method === 'POST') {
    if (!STOCK_EDIT_ROLES.has(session.rol)) {
      return res.status(403).json({ error: 'forbidden', message: 'No tenés permiso para agregar stock' });
    }

    const body = (req.body ?? {}) as AddStockBody;
    const { tipo, item, cantidad } = body;
    if (!tipo?.trim() || !item?.trim() || !cantidad || cantidad <= 0) {
      return res.status(400).json({ error: 'invalid', message: 'Faltan datos del item o la cantidad' });
    }
    if (body.nroSerie || body.idMaquina) {
      // 04.Stock no tiene columnas para serie/ID de máquina — eso vive en
      // 08.DetalleMaquina. Alta de máquinas requiere escribir ambas listas;
      // no implementado todavía (ver docs/modules.md, flujo D).
      return res.status(501).json({
        error: 'not_implemented',
        message: 'Agregar máquinas (con Nro Serie / ID Máquina) todavía no está implementado — solo repuestos.',
      });
    }

    // 04.Stock guarda Tipo_ST en MAYÚSCULAS (LAVADORA/REPUESTO), pero el catálogo real
    // trae segmentos en Title Case (Lavadora/Repuesto) — normalizamos al escribir/matchear.
    const tipoUpper = tipo.toUpperCase();
    try {
      const existingRows = await listItems(LIST_IDS.stock, {
        select: stockSelectFields(),
        filter: `fields/Status_ST eq 'Activo' and fields/Tipo_ST eq '${tipoUpper}'`,
      });
      const existing = existingRows
        .map(mapStock)
        .find((r) => r.Item_ST.toLowerCase() === item.trim().toLowerCase());

      if (existing) {
        const nuevaCantidad = existing.Cantidad_ST + cantidad;
        await updateItem(LIST_IDS.stock, existing.ID, { Cantidad_ST: String(nuevaCantidad) });
        return res.status(200).json({ ...existing, Cantidad_ST: nuevaCantidad });
      }

      const created = await createItem(LIST_IDS.stock, {
        Lodge_ST: item.trim(),
        Tipo_ST: tipoUpper,
        Marca_ST: body.marca ?? '',
        Nro_ST: body.codigo ?? '',
        Cantidad_ST: String(cantidad),
        Status_ST: 'Activo',
        ConcatStock_ST: `${tipo} - ${item.trim()}`,
      });
      return res.status(201).json(mapStock(created));
    } catch (err) {
      console.error('stock POST error', err);
      const status = err instanceof GraphError ? 502 : 500;
      return res.status(status).json({ error: 'server_error' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method_not_allowed' });
}
