import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listItems, getItem, createItem, updateItem, GraphError } from '../_lib/graph.js';
import {
  LIST_IDS,
  mapRepuestoTecnico,
  repuestoTecnicoSelectFields,
  mapStock,
  stockSelectFields,
  mapTecnicos,
  tecnicosSelectFields,
  STOCK_EDIT_ROLES,
} from '../_lib/lists.js';
import { readSession } from '../_lib/session.js';

interface Body {
  action?: 'edit' | 'transfer' | 'reingreso';
  id?: number | string;
  cantidad?: number | string;
  toTecnico?: string; // destino en transfer
}

const odataEscape = (v: string) => v.replace(/'/g, "''");

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = readSession(req.headers.cookie);
  if (!session) return res.status(401).json({ error: 'no_session' });

  // ── GET: repuestos por técnico (activos) + técnicos para el picker ──
  if (req.method === 'GET') {
    try {
      const [rows, tecRows] = await Promise.all([
        listItems(LIST_IDS.repuestosTecnico, { select: repuestoTecnicoSelectFields(), filter: `fields/Status_RT eq 'Activo'`, top: 2000 }),
        listItems(LIST_IDS.usuarios, { select: tecnicosSelectFields(), top: 999 }),
      ]);
      const stockTecnicos = rows.map(mapRepuestoTecnico);
      const tecnicos = mapTecnicos(tecRows);
      return res.status(200).json({ stockTecnicos, tecnicos });
    } catch (err) {
      console.error('stock-tecnicos GET error', err);
      const status = err instanceof GraphError ? 502 : 500;
      return res.status(status).json({ error: 'server_error' });
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!STOCK_EDIT_ROLES.has(session.rol)) {
    return res.status(403).json({ error: 'forbidden', message: 'No tenés permiso para editar el stock de técnicos.' });
  }

  const body = (req.body ?? {}) as Body;
  const id = Number(body.id);
  const cantidad = Number(body.cantidad);
  if (!id) return res.status(400).json({ error: 'invalid_id' });

  try {
    if (body.action === 'edit') return await edit(id, cantidad, res);
    if (body.action === 'transfer') return await transfer(id, cantidad, body.toTecnico, res);
    if (body.action === 'reingreso') return await reingreso(id, cantidad, res);
    return res.status(400).json({ error: 'invalid', message: 'Acción de stock técnico desconocida' });
  } catch (err) {
    console.error('stock-tecnicos POST error', err);
    const status = err instanceof GraphError ? 502 : 500;
    return res.status(status).json({ error: 'server_error' });
  }
}

// ── Editar cantidad (Cantidad_RT es TEXT) ──
async function edit(id: number, cantidad: number, res: VercelResponse) {
  if (!Number.isFinite(cantidad) || cantidad < 0) return res.status(400).json({ error: 'invalid', message: 'Cantidad inválida' });
  await updateItem(LIST_IDS.repuestosTecnico, id, { Cantidad_RT: String(Math.round(cantidad)) });
  return res.status(200).json({ ID: id, Cantidad_RT: Math.round(cantidad) });
}

// ── Transferir a otro técnico (fiel a Screen_StockTecnicos, bt transfer) ──
async function transfer(id: number, cantidad: number, toTecnico: string | undefined, res: VercelResponse) {
  const destino = toTecnico?.trim();
  if (!destino) return res.status(400).json({ error: 'invalid', message: 'Falta el técnico destino' });
  if (!Number.isFinite(cantidad) || cantidad <= 0) return res.status(400).json({ error: 'invalid', message: 'Cantidad inválida' });

  const raw = await getItem(LIST_IDS.repuestosTecnico, id, repuestoTecnicoSelectFields());
  if (!raw) return res.status(404).json({ error: 'not_found', message: 'El repuesto no existe' });
  const src = mapRepuestoTecnico(raw);
  if (cantidad > src.Cantidad_RT) {
    return res.status(400).json({ error: 'invalid', message: `El técnico solo tiene ${src.Cantidad_RT}` });
  }
  if (destino === src.Tecnico_RT) return res.status(400).json({ error: 'invalid', message: 'Elegí un técnico distinto' });
  const repuesto = String(raw.Repuesto_RT ?? '');

  // Suma al destino primero (si falla el descuento, queda duplicado recuperable, no perdido).
  const destinoRows = (
    await listItems(LIST_IDS.repuestosTecnico, { select: repuestoTecnicoSelectFields(), filter: `fields/Tecnico_RT eq '${odataEscape(destino)}'` })
  ).map(mapRepuestoTecnico);
  const existente = destinoRows.find((r) => r.Concat_RT.toLowerCase() === src.Concat_RT.toLowerCase());
  if (existente) {
    await updateItem(LIST_IDS.repuestosTecnico, existente.ID, { Cantidad_RT: String(existente.Cantidad_RT + cantidad) });
  } else {
    await createItem(LIST_IDS.repuestosTecnico, {
      Title: 'Wash Inn',
      Tecnico_RT: destino,
      Concat_RT: src.Concat_RT,
      Codigo_RT: src.Codigo_RT ?? '',
      Repuesto_RT: repuesto,
      Cantidad_RT: String(cantidad),
      Status_RT: 'Activo',
    });
  }
  await updateItem(LIST_IDS.repuestosTecnico, id, { Cantidad_RT: String(src.Cantidad_RT - cantidad) });
  return res.status(200).json({ ID: id, restante: src.Cantidad_RT - cantidad, toTecnico: destino });
}

// ── Reingresar a 04.Stock (match por Item_ST = Concat_RT; crea si no existe) ──
async function reingreso(id: number, cantidad: number, res: VercelResponse) {
  if (!Number.isFinite(cantidad) || cantidad <= 0) return res.status(400).json({ error: 'invalid', message: 'Cantidad inválida' });

  const raw = await getItem(LIST_IDS.repuestosTecnico, id, repuestoTecnicoSelectFields());
  if (!raw) return res.status(404).json({ error: 'not_found', message: 'El repuesto no existe' });
  const src = mapRepuestoTecnico(raw);
  if (cantidad > src.Cantidad_RT) {
    return res.status(400).json({ error: 'invalid', message: `El técnico solo tiene ${src.Cantidad_RT}` });
  }

  // Descuenta del técnico.
  await updateItem(LIST_IDS.repuestosTecnico, id, { Cantidad_RT: String(src.Cantidad_RT - cantidad) });

  // Suma al depósito: 04.Stock con Item_ST = Concat_RT. Ojo: la columna interna
  // del nombre del item es `Lodge_ST` (no `Item_ST`).
  const matches = (
    await listItems(LIST_IDS.stock, { select: stockSelectFields(), filter: `fields/Lodge_ST eq '${odataEscape(src.Concat_RT)}'` })
  ).map(mapStock);
  const stockRow = matches.find((s) => s.Status_ST === 'Activo') ?? matches[0];
  if (stockRow) {
    await updateItem(LIST_IDS.stock, stockRow.ID, { Cantidad_ST: String(stockRow.Cantidad_ST + cantidad) });
  } else {
    await createItem(LIST_IDS.stock, {
      Lodge_ST: src.Concat_RT,
      Tipo_ST: 'REPUESTO',
      Nro_ST: src.Codigo_RT ?? '',
      Cantidad_ST: String(cantidad),
      Status_ST: 'Activo',
    });
  }
  return res.status(200).json({ ID: id, restante: src.Cantidad_RT - cantidad });
}
