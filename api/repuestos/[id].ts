import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getItem, updateItem, GraphError } from '../_lib/graph.js';
import { LIST_IDS, REPUESTO_PRECIO_EDIT_ROLES } from '../_lib/lists.js';
import { readSession } from '../_lib/session.js';

/**
 * PATCH /api/repuestos/:id → actualiza el precio (Precio_RP) de un repuesto de la
 * lista 11.Respuestos. Gate por rol (Admin / Jefe Taller). `Precio_RP` es una columna
 * NUEVA (número, 2 decimales) que el usuario debe crear a mano en SharePoint; el write
 * fallará con GraphError hasta que la columna exista.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const session = readSession(req.headers.cookie);
  if (!session) return res.status(401).json({ error: 'no_session' });
  if (!REPUESTO_PRECIO_EDIT_ROLES.has(session.rol)) {
    return res.status(403).json({ error: 'forbidden', message: 'No tenés permiso para editar el precio' });
  }

  const rawId = req.query.id;
  const id = Number(Array.isArray(rawId) ? rawId[0] : rawId);
  if (!id) return res.status(400).json({ error: 'invalid_id' });

  const precioRaw = (req.body ?? {}).precio;
  const precio = Number(precioRaw);
  if (!Number.isFinite(precio) || precio < 0) {
    return res.status(400).json({ error: 'invalid', message: 'El precio debe ser un número mayor o igual a 0' });
  }
  const precio2 = Math.round(precio * 100) / 100; // 2 decimales

  try {
    const current = await getItem(LIST_IDS.repuestos, id);
    if (!current) return res.status(404).json({ error: 'not_found', message: 'El repuesto no existe' });
    // Precio_RP es una columna NUMBER (número, 2 decimales) → se escribe como número.
    await updateItem(LIST_IDS.repuestos, id, { Precio_RP: precio2 });
    return res.status(200).json({ ID: id, Precio_RP: precio2 });
  } catch (err) {
    console.error('repuestos PATCH error', err);
    const status = err instanceof GraphError ? 502 : 500;
    return res.status(status).json({ error: 'server_error' });
  }
}
