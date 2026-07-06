import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listItems, getItem, createItem, updateItem, GraphError } from '../_lib/graph.ts';
import {
  LIST_IDS,
  mapPedidoCompra,
  pedidoCompraSelectFields,
  mapDetalleCompra,
  detalleCompraSelectFields,
  mapStock,
  stockSelectFields,
  fechasHoy,
  isMachineSegment,
  APP_VERSION,
} from '../_lib/lists.ts';
import { readSession, type SessionPayload } from '../_lib/session.ts';

function odataEscape(v: string): string {
  return v.replace(/'/g, "''");
}

interface EditBody {
  observaciones?: string;
  updates?: { detalleId: number; cantidad: number }[];
  adds?: { item: string; marca?: string; cantidad: number }[];
  removes?: number[];
}
interface ActionBody {
  action?: 'approve-request' | 'receive' | 'anular';
  observacion?: string;
  lines?: { detalleId: number; cantidadReal: number; nroSerie?: string; idMaquina?: string }[];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = readSession(req.headers.cookie);
  if (!session) return res.status(401).json({ error: 'no_session' });

  const rawId = req.query.id;
  const id = Number(Array.isArray(rawId) ? rawId[0] : rawId);
  if (!id) return res.status(400).json({ error: 'invalid_id', message: 'Identificador de compra inválido' });

  try {
    if (req.method === 'PATCH') return await editCompra(id, req, res);
    if (req.method === 'POST') {
      const action = (req.body as ActionBody)?.action;
      if (action === 'approve-request') return await mandarAAprobar(id, res, session);
      if (action === 'receive') return await recibir(id, req, res, session);
      if (action === 'anular') return await anular(id, res);
      return res.status(400).json({ error: 'invalid', message: 'Acción de compra desconocida' });
    }
  } catch (err) {
    console.error(`compras [id] ${req.method} error`, err);
    const status = err instanceof GraphError ? 502 : 500;
    return res.status(status).json({ error: 'server_error' });
  }

  res.setHeader('Allow', 'PATCH, POST');
  return res.status(405).json({ error: 'method_not_allowed' });
}

// ── Editar pedido (líneas + observaciones), estando aún Pendiente ─────────
async function editCompra(id: number, req: VercelRequest, res: VercelResponse) {
  const pedidoRaw = await getItem(LIST_IDS.pedidoCompras, id, pedidoCompraSelectFields());
  if (!pedidoRaw) return res.status(404).json({ error: 'not_found', message: 'La compra no existe' });
  const pedido = mapPedidoCompra(pedidoRaw);

  const body = (req.body ?? {}) as EditBody;
  const f = fechasHoy();

  // Quitar líneas: soft-delete (Anulado + Rechazada) para excluirlas del listado.
  for (const detalleId of body.removes ?? []) {
    await updateItem(LIST_IDS.detalleCompra, detalleId, { Status_DC: 'Anulado', Rechazada_DC: 'SI' });
  }
  // Actualizar cantidades de líneas existentes.
  for (const u of body.updates ?? []) {
    if (u.cantidad > 0) await updateItem(LIST_IDS.detalleCompra, u.detalleId, { Cantidad_DC: String(u.cantidad) });
  }
  // Agregar líneas nuevas.
  for (const a of body.adds ?? []) {
    if (!a.item?.trim() || a.cantidad <= 0) continue;
    await createItem(LIST_IDS.detalleCompra, {
      Title: 'Washinn',
      Cantidad_DC: String(a.cantidad),
      Item_DC: a.item.trim(),
      Segmento_DC: pedido.Segmento_PC,
      Status_DC: 'Pendiente',
      IDCompra_DC: pedido.IDUnivoco_PC,
      Fecha_DC: f.fecha,
      FechaMesAno_DC: f.mesAno,
      FechaAno_DC: f.ano,
      Marca_DC: a.marca?.trim() ?? '',
    });
  }

  const total =
    (body.updates ?? []).reduce((s, u) => s + (u.cantidad > 0 ? u.cantidad : 0), 0) +
    (body.adds ?? []).reduce((s, a) => s + (a.cantidad > 0 ? a.cantidad : 0), 0);

  await updateItem(LIST_IDS.pedidoCompras, id, {
    Cantidad_PC: String(total),
    Observaciones_PC: body.observaciones?.trim() ?? '',
  });

  return res.status(200).json({ ID: id, Cantidad_PC: total });
}

// ── Mandar a aprobar: crea 07.Aprobaciones + pedido → En Aprobacion ──────
async function mandarAAprobar(id: number, res: VercelResponse, session: SessionPayload) {
  const pedidoRaw = await getItem(LIST_IDS.pedidoCompras, id, pedidoCompraSelectFields());
  if (!pedidoRaw) return res.status(404).json({ error: 'not_found', message: 'La compra no existe' });
  const pedido = mapPedidoCompra(pedidoRaw);
  if (pedido.Status_PC !== 'Pendiente') {
    return res.status(409).json({ error: 'conflict', message: 'Solo se pueden mandar a aprobar compras pendientes' });
  }

  const f = fechasHoy();
  // IDCompra_AP guarda el ID numérico del pedido (no IDUnivoco_PC) — así lo lee la UI.
  await createItem(LIST_IDS.aprobaciones, {
    Title: 'Washinn',
    Status_AP: 'En Aprobacion',
    TipoAprobacion_AP: 'Compra',
    IDCompra_AP: String(id),
    ConcatAprobacion_AP: `Compras - ${id}`,
    Rechazada_AP: 'NO',
    Aprobada_AP: 'NO',
    FechaGen_AP: f.fecha,
    FechaMesAnoGen_AP: f.mesAno,
    FechaMesGen_AP: f.mes,
    FechaAnoGen_AP: f.ano,
    UserGen_AP: session.usuario,
    HoraGen_AP: f.hora,
    VersionGen_AP: APP_VERSION,
  });

  await updateItem(LIST_IDS.pedidoCompras, id, { Status_PC: 'En Aprobacion' });
  return res.status(200).json({ ID: id, Status_PC: 'En Aprobacion' });
}

// ── Anular: líneas → Anulado, cabecera → Anulado + Filtrar SI ─────────────
async function anular(id: number, res: VercelResponse) {
  const pedidoRaw = await getItem(LIST_IDS.pedidoCompras, id, pedidoCompraSelectFields());
  if (!pedidoRaw) return res.status(404).json({ error: 'not_found', message: 'La compra no existe' });
  const pedido = mapPedidoCompra(pedidoRaw);

  const detalles = await listItems(LIST_IDS.detalleCompra, {
    select: detalleCompraSelectFields(),
    filter: `fields/IDCompra_DC eq '${odataEscape(pedido.IDUnivoco_PC)}'`,
  });
  for (const d of detalles.map(mapDetalleCompra)) {
    await updateItem(LIST_IDS.detalleCompra, d.ID, { Rechazada_DC: 'SI', Status_DC: 'Anulado' });
  }

  await updateItem(LIST_IDS.pedidoCompras, id, { Status_PC: 'Anulado', Filtrar_PC: 'SI' });
  return res.status(200).json({ ID: id, Status_PC: 'Anulado' });
}

// ── Recibir: ingreso a stock (04.Stock) + máquinas (08.DetalleMaquina) ────
async function recibir(id: number, req: VercelRequest, res: VercelResponse, session: SessionPayload) {
  const pedidoRaw = await getItem(LIST_IDS.pedidoCompras, id, pedidoCompraSelectFields());
  if (!pedidoRaw) return res.status(404).json({ error: 'not_found', message: 'La compra no existe' });
  const pedido = mapPedidoCompra(pedidoRaw);
  if (pedido.Status_PC !== 'Aprobada') {
    return res.status(409).json({ error: 'conflict', message: 'Solo se pueden recibir compras aprobadas' });
  }

  const body = (req.body ?? {}) as ActionBody;
  const f = fechasHoy();

  // Líneas aprobadas de la compra (fuente de verdad server-side).
  const detalles = (
    await listItems(LIST_IDS.detalleCompra, {
      select: detalleCompraSelectFields(),
      filter: `fields/IDCompra_DC eq '${odataEscape(pedido.IDUnivoco_PC)}'`,
    })
  )
    .map(mapDetalleCompra)
    .filter((d) => d.Status_DC === 'Aprobada');

  const byId = new Map((body.lines ?? []).map((l) => [l.detalleId, l]));

  // Stock activo, indexado por nombre de item (columna interna Lodge_ST).
  const stock = (await listItems(LIST_IDS.stock, { select: stockSelectFields(), filter: `fields/Status_ST eq 'Activo'` })).map(mapStock);
  const stockByItem = new Map(stock.map((s) => [s.Item_ST.trim().toLowerCase(), s]));

  // Cabecera → Recibida.
  await updateItem(LIST_IDS.pedidoCompras, id, {
    Status_PC: 'Recibida',
    Filtrar_PC: 'SI',
    ObservacionRecibida_PC: body.observacion?.trim() ?? '',
  });

  for (const d of detalles) {
    const line = byId.get(d.ID);
    const qreal = Math.max(0, Math.floor(line?.cantidadReal ?? d.Cantidad_DC));

    await updateItem(LIST_IDS.detalleCompra, d.ID, {
      Status_DC: 'Recibida',
      CantidadIngresada_DC: String(qreal),
    });

    if (qreal <= 0) continue;

    // Ingreso a 04.Stock: sumar si existe (match por nombre), crear si no.
    const key = d.Item_DC.trim().toLowerCase();
    const existing = stockByItem.get(key);
    if (existing) {
      const nueva = existing.Cantidad_ST + qreal;
      await updateItem(LIST_IDS.stock, existing.ID, { Cantidad_ST: String(nueva) });
      existing.Cantidad_ST = nueva; // por si otra línea toca el mismo item
    } else {
      const created = mapStock(
        await createItem(LIST_IDS.stock, {
          Title: 'Washinn',
          Status_ST: 'Activo',
          Tipo_ST: d.Segmento_DC.toUpperCase(),
          Cantidad_ST: String(qreal),
          Lodge_ST: d.Item_DC,
          Marca_ST: d.Marca_DC ?? '',
          FechaUltMod_ST: f.fecha,
          FechaMesUltMod_ST: f.mesAno,
          UserMod_ST: session.usuario,
          VersionMod_ST: APP_VERSION,
          ModuloAgregado_ST: 'Compra',
          ConcatStock_ST: `${d.Segmento_DC} - ${d.Item_DC}`,
        })
      );
      stockByItem.set(key, created);
    }

    // Máquinas (no repuesto/cargadora/expendedora/encendedora): una fila por unidad en 08.DetalleMaquina.
    if (isMachineSegment(d.Segmento_DC)) {
      for (let u = 0; u < qreal; u++) {
        const createdMaq = await createItem(LIST_IDS.detalleMaquina, {
          Title: 'Sumar',
          FechaIngreso_DM: f.fecha,
          FechaMesAnoIngreso_DM: f.mesAno,
          Status_DM: 'DEPOSITO',
          Segmentp_DM: d.Segmento_DC, // OJO: nombre interno real (typo en SharePoint) de Segmento_DM
          CodigoEdificio_DM: 'C-9999',
          Edificio_DM: 'Wash Inn',
          ConcatMaquina_DM: d.Item_DC,
          Marca_DM: d.Marca_DC ?? '',
        });
        const rowId = Number(createdMaq.id);
        // La serie/ID se toman del input si vinieron (solo para la 1ra unidad), si no se autogeneran del RowID.
        const nroSerie = u === 0 && line?.nroSerie?.trim() ? line.nroSerie.trim() : String(rowId);
        const idMaquina = u === 0 && line?.idMaquina?.trim() ? line.idMaquina.trim() : String(rowId);
        await updateItem(LIST_IDS.detalleMaquina, rowId, {
          IDMaquina_DM: idMaquina,
          NroSerie_DM: nroSerie,
          ConcatMaquina_DM: `${d.Segmento_DC} - ${idMaquina}`,
          ConcatMaquinaIncidente_DM: `${d.Segmento_DC} - ${idMaquina}`,
        });
      }
    }
  }

  return res.status(200).json({ ID: id, Status_PC: 'Recibida' });
}
