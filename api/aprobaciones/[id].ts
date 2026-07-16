import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listItems, getItem, updateItem, GraphError } from '../_lib/graph.js';
import {
  LIST_IDS,
  mapAprobacion,
  aprobacionSelectFields,
  mapPedidoCompra,
  pedidoCompraSelectFields,
  mapDetalleCompra,
  detalleCompraSelectFields,
  fechasHoy,
} from '../_lib/lists.js';
import {
  applyTransferFromAprobacion,
  transferAprobacionSelectFields,
  applyCambioMaquinaFromAprobacion,
  cambioMaquinaAprobacionSelectFields,
} from '../_lib/maquinaMoves.js';
import { readSession, type SessionPayload } from '../_lib/session.js';
import { puedeAccederModulo } from '../_lib/permisos.js';

function odataEscape(v: string): string {
  return v.replace(/'/g, "''");
}

interface Body {
  action?: 'approve' | 'reject';
  reason?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = readSession(req.headers.cookie);
  if (!session) return res.status(401).json({ error: 'no_session' });

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const rawId = req.query.id;
  const id = Number(Array.isArray(rawId) ? rawId[0] : rawId);
  if (!id) return res.status(400).json({ error: 'invalid_id' });

  const { action, reason } = (req.body ?? {}) as Body;

  try {
    if (!(await puedeAccederModulo(session.rol, 'Mis Aprobaciones'))) {
      return res.status(403).json({ error: 'forbidden', message: 'Tu rol no tiene habilitado el módulo Mis Aprobaciones.' });
    }
    const aprobRaw = await getItem(LIST_IDS.aprobaciones, id, aprobacionSelectFields());
    if (!aprobRaw) return res.status(404).json({ error: 'not_found', message: 'La solicitud no existe' });
    const aprob = mapAprobacion(aprobRaw);

    if (action === 'approve') return await approve(id, aprob, res, session);
    if (action === 'reject') return await reject(id, aprob, reason ?? '', res, session);
    return res.status(400).json({ error: 'invalid', message: 'Acción de aprobación desconocida' });
  } catch (err) {
    console.error('aprobaciones [id] POST error', err);
    const status = err instanceof GraphError ? 502 : 500;
    return res.status(status).json({ error: 'server_error' });
  }
}

async function approve(
  id: number,
  aprob: ReturnType<typeof mapAprobacion>,
  res: VercelResponse,
  session: SessionPayload
) {
  const f = fechasHoy();

  // Transferencia de Maquina: aplica el movimiento (08.DetalleMaquina + 04.Stock + encendido +
  // bitácora 10.Incidentes) leyendo los campos _AP de la solicitud.
  if (aprob.TipoAprobacion_AP === 'Transferencia de Maquina') {
    const raw = await getItem(LIST_IDS.aprobaciones, id, transferAprobacionSelectFields());
    if (raw) await applyTransferFromAprobacion(raw, session.usuario);
    await updateItem(LIST_IDS.aprobaciones, id, {
      Aprobada_AP: 'SI',
      Status_AP: 'Aprobada',
      Fecha_AP: f.fecha,
      FechaMes_AP: f.mes,
      FechaMesAno_AP: f.mesAno,
      FechaAno_AP: f.ano,
      Hora_AP: f.hora,
      User_AP: session.usuario,
    });
    return res.status(200).json({ ID: id, Status_AP: 'Aprobada' });
  }

  // Cambio de Maquina: descuenta del stock la máquina de reemplazo y marca el incidente Aprobada.
  if (aprob.TipoAprobacion_AP === 'Cambio de Maquina') {
    const raw = await getItem(LIST_IDS.aprobaciones, id, cambioMaquinaAprobacionSelectFields());
    if (raw) await applyCambioMaquinaFromAprobacion(raw);
    await updateItem(LIST_IDS.aprobaciones, id, {
      Aprobada_AP: 'SI',
      Status_AP: 'Aprobada',
      Fecha_AP: f.fecha,
      FechaMes_AP: f.mes,
      FechaMesAno_AP: f.mesAno,
      FechaAno_AP: f.ano,
      Hora_AP: f.hora,
      User_AP: session.usuario,
    });
    return res.status(200).json({ ID: id, Status_AP: 'Aprobada' });
  }

  // Cabecera + líneas del pedido (IDCompra_AP = ID numérico del pedido).
  if (aprob.IDCompra_AP) {
    const pedidoRaw = await getItem(LIST_IDS.pedidoCompras, Number(aprob.IDCompra_AP), pedidoCompraSelectFields());
    if (pedidoRaw) {
      const pedido = mapPedidoCompra(pedidoRaw);
      await updateItem(LIST_IDS.pedidoCompras, pedido.ID, { Status_PC: 'Aprobada' });
      const detalles = await listItems(LIST_IDS.detalleCompra, {
        select: detalleCompraSelectFields(),
        filter: `fields/IDCompra_DC eq '${odataEscape(pedido.IDUnivoco_PC)}'`,
      });
      for (const d of detalles.map(mapDetalleCompra)) {
        if (d.Status_DC === 'Pendiente') await updateItem(LIST_IDS.detalleCompra, d.ID, { Status_DC: 'Aprobada' });
      }
    }
  }

  await updateItem(LIST_IDS.aprobaciones, id, {
    Aprobada_AP: 'SI',
    Status_AP: 'Aprobada',
    Fecha_AP: f.fecha,
    FechaMes_AP: f.mes,
    FechaMesAno_AP: f.mesAno,
    FechaAno_AP: f.ano,
    Hora_AP: f.hora,
    User_AP: session.usuario,
  });

  return res.status(200).json({ ID: id, Status_AP: 'Aprobada' });
}

async function reject(
  id: number,
  aprob: ReturnType<typeof mapAprobacion>,
  reason: string,
  res: VercelResponse,
  session: SessionPayload
) {
  const f = fechasHoy();

  if (aprob.TipoAprobacion_AP === 'Compra' && aprob.IDCompra_AP) {
    const pedidoRaw = await getItem(LIST_IDS.pedidoCompras, Number(aprob.IDCompra_AP), pedidoCompraSelectFields());
    if (pedidoRaw) {
      const pedido = mapPedidoCompra(pedidoRaw);
      await updateItem(LIST_IDS.pedidoCompras, pedido.ID, { Status_PC: 'Rechazada', Filtrar_PC: 'SI' });
      const detalles = await listItems(LIST_IDS.detalleCompra, {
        select: detalleCompraSelectFields(),
        filter: `fields/IDCompra_DC eq '${odataEscape(pedido.IDUnivoco_PC)}'`,
      });
      for (const d of detalles.map(mapDetalleCompra)) {
        await updateItem(LIST_IDS.detalleCompra, d.ID, { Status_DC: 'Rechazada', Rechazada_DC: 'SI' });
      }
    }
  }

  // Cambio de Maquina: al rechazar, se revierte el incidente a 'Pendiente' (limpiando la máquina
  // de reemplazo) para poder gestionar otro cambio. Mejora sobre el msapp, que lo dejaba atascado
  // en 'En Aprobacion' sin salida. El incidente se referencia por IDMaquina_AP.
  if (aprob.TipoAprobacion_AP === 'Cambio de Maquina') {
    const raw = await getItem(LIST_IDS.aprobaciones, id, cambioMaquinaAprobacionSelectFields());
    const incidenteId = Number(raw?.IDMaquina_AP);
    if (incidenteId) {
      await updateItem(LIST_IDS.incidentes, incidenteId, { Status_IN: 'Pendiente', MaquinaAsignada_IN: '' });
    }
  }

  await updateItem(LIST_IDS.aprobaciones, id, {
    Status_AP: 'Rechazada',
    Rechazada_AP: 'SI',
    InfoRechazo_AP: reason.trim(),
    Fecha_AP: f.fecha,
    Hora_AP: f.hora,
    User_AP: session.usuario,
  });

  return res.status(200).json({ ID: id, Status_AP: 'Rechazada' });
}
