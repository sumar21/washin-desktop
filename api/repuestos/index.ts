import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listItems, getItem, updateItem, GraphError } from '../_lib/graph.js';
import { LIST_IDS, mapRepuestoAbm, REPUESTO_PRECIO_EDIT_ROLES } from '../_lib/lists.js';
import { readSession } from '../_lib/session.js';

/**
 * ABM de repuestos con precio (lista 11.Respuestos).
 *  - GET            → catálogo de repuestos activos { ID, Nombre_RP, Codigo_RP, Stock_RP,
 *                     Status_RP, ConcatRepuesto_RP, Precio_RP }.
 *  - POST update-precio → actualiza Precio_RP de un repuesto (gate Admin / Jefe Taller).
 *
 * `Precio_RP` es una columna NUEVA que el usuario debe crear a mano en SharePoint
 * (número, 2 decimales). Hasta que exista, el GET la devuelve como 0 y el PATCH la
 * escribe igual (el write fallará con GraphError hasta que la columna exista — ver [id].ts).
 */

interface Body {
  action?: 'update-precio';
  id?: number | string;
  precio?: number | string;
}

/** Precio válido (número finito ≥ 0) redondeado a 2 decimales, o null si es inválido. */
export function parsePrecio(raw: unknown): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = readSession(req.headers.cookie);
  if (!session) return res.status(401).json({ error: 'no_session' });

  if (req.method === 'GET') {
    try {
      // Sin $select (Precio_RP puede no existir aún) y sin $filter (Status_RP no está
      // indexada) — filtramos activos en memoria, igual que el catálogo de compras.
      const rows = await listItems(LIST_IDS.repuestos);
      const repuestos = rows
        .map(mapRepuestoAbm)
        .filter((r) => r.Status_RP === 'Activo')
        .sort((a, b) => a.Nombre_RP.localeCompare(b.Nombre_RP, 'es'));
      return res.status(200).json(repuestos);
    } catch (err) {
      console.error('repuestos GET error', err);
      const status = err instanceof GraphError ? 502 : 500;
      return res.status(status).json({ error: 'server_error' });
    }
  }

  if (req.method === 'POST') {
    const body = (req.body ?? {}) as Body;
    if (body.action !== 'update-precio') {
      return res.status(400).json({ error: 'invalid', message: 'Acción de repuesto desconocida' });
    }
    if (!REPUESTO_PRECIO_EDIT_ROLES.has(session.rol)) {
      return res.status(403).json({ error: 'forbidden', message: 'No tenés permiso para editar el precio' });
    }
    const id = Number(body.id);
    if (!id) return res.status(400).json({ error: 'invalid_id' });
    const precio = parsePrecio(body.precio);
    if (precio == null) {
      return res.status(400).json({ error: 'invalid', message: 'El precio debe ser un número mayor o igual a 0' });
    }
    try {
      const current = await getItem(LIST_IDS.repuestos, id);
      if (!current) return res.status(404).json({ error: 'not_found', message: 'El repuesto no existe' });
      // Precio_RP es una columna NUMBER (número, 2 decimales) → se escribe como número.
      await updateItem(LIST_IDS.repuestos, id, { Precio_RP: precio });
      return res.status(200).json({ ID: id, Precio_RP: precio });
    } catch (err) {
      console.error('repuestos POST error', err);
      const status = err instanceof GraphError ? 502 : 500;
      return res.status(status).json({ error: 'server_error' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method_not_allowed' });
}
