import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listItems, createItem, updateItem, getItem, GraphError } from '../_lib/graph.js';
import { LIST_IDS, mapRepuestoAbm, canEditAbm } from '../_lib/lists.js';
import { readSession } from '../_lib/session.js';

/**
 * ABM de repuestos (lista 11.Respuestos) — vive en Configuración.
 *  - GET               → catálogo de repuestos activos.
 *  - POST create/update/baja (gate canEditAbm(rol, 'Repuestos')):
 *      create → alta (Nombre_RP, Codigo_RP, Marca_RP, Precio_RP).
 *      update → modificación de esos campos.
 *      baja   → Status_RP = 'Inactivo' (soft-delete, no se borra la fila).
 *
 * NOTA: el stock NO se administra acá — vive en la lista 04.Stock. `Precio_RP` es una
 * columna NUMBER (2 decimales); si todavía no existe en SharePoint el write falla con
 * GraphError y el GET la devuelve 0.
 */

interface RepuestoInput {
  nombre?: string;
  codigo?: string;
  marca?: string;
  precio?: number | string;
}
interface Body extends RepuestoInput {
  action?: 'create' | 'update' | 'baja';
  id?: number | string;
}

/** Precio válido (número finito ≥ 0) a 2 decimales, o null si es inválido. */
function parsePrecio(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number(String(raw).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

/** Traduce el input del front a columnas internas de 11.Respuestos. */
function toFields(input: RepuestoInput): Record<string, unknown> {
  const f: Record<string, unknown> = {};
  if (input.nombre !== undefined) f.Nombre_RP = input.nombre.trim();
  if (input.codigo !== undefined) f.Codigo_RP = input.codigo.trim();
  if (input.marca !== undefined) f.Marca_RP = input.marca.trim();
  if (input.precio !== undefined) {
    const p = parsePrecio(input.precio);
    if (p != null) f.Precio_RP = p;
  }
  return f;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = readSession(req.headers.cookie);
  if (!session) return res.status(401).json({ error: 'no_session' });

  if (req.method === 'GET') {
    try {
      // Sin $select (Precio_RP puede no existir aún) ni $filter (Status_RP no indexada):
      // filtramos activos en memoria.
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

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  if (!canEditAbm(session.rol, 'Repuestos')) {
    return res.status(403).json({ error: 'forbidden', message: 'Tu rol no puede editar repuestos.' });
  }

  const body = (req.body ?? {}) as Body;
  try {
    if (body.action === 'create') return await create(body, res);
    if (body.action === 'update') return await update(body, res);
    if (body.action === 'baja') return await baja(body, res);
    return res.status(400).json({ error: 'invalid', message: 'Acción de repuesto desconocida' });
  } catch (err) {
    console.error('repuestos POST error', err);
    const status = err instanceof GraphError ? 502 : 500;
    return res.status(status).json({ error: 'server_error' });
  }
}

async function create(body: Body, res: VercelResponse) {
  const nombre = body.nombre?.trim();
  if (!nombre) return res.status(400).json({ error: 'invalid', message: 'Falta el nombre del repuesto' });
  const codigo = body.codigo?.trim() ?? '';
  const created = mapRepuestoAbm(
    await createItem(LIST_IDS.repuestos, {
      Title: 'sumar',
      Status_RP: 'Activo',
      // ConcatRepuesto_RP es la etiqueta que consume el catálogo de compras.
      ConcatRepuesto_RP: codigo ? `${codigo} - ${nombre}` : nombre,
      ...toFields(body),
    })
  );
  return res.status(201).json(created);
}

async function update(body: Body, res: VercelResponse) {
  const id = Number(body.id);
  if (!id) return res.status(400).json({ error: 'invalid_id' });
  const current = await getItem(LIST_IDS.repuestos, id);
  if (!current) return res.status(404).json({ error: 'not_found', message: 'El repuesto no existe' });
  const fields = toFields(body);
  // Recalcular ConcatRepuesto_RP si cambió nombre o código.
  const nombre = body.nombre?.trim() ?? String(current.Nombre_RP ?? '').trim();
  const codigo = body.codigo?.trim() ?? String(current.Codigo_RP ?? '').trim();
  fields.ConcatRepuesto_RP = codigo ? `${codigo} - ${nombre}` : nombre;
  await updateItem(LIST_IDS.repuestos, id, fields);
  const updated = mapRepuestoAbm((await getItem(LIST_IDS.repuestos, id))!);
  return res.status(200).json(updated);
}

async function baja(body: Body, res: VercelResponse) {
  const id = Number(body.id);
  if (!id) return res.status(400).json({ error: 'invalid_id' });
  await updateItem(LIST_IDS.repuestos, id, { Status_RP: 'Inactivo' });
  return res.status(200).json({ ID: id, Status_RP: 'Inactivo' });
}
