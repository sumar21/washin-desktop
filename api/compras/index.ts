import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listItems, createItem, GraphError } from '../_lib/graph.ts';
import {
  LIST_IDS,
  mapPedidoCompra,
  pedidoCompraSelectFields,
  mapDetalleCompra,
  detalleCompraSelectFields,
  fechasHoy,
  APP_VERSION,
} from '../_lib/lists.ts';
import { readSession } from '../_lib/session.ts';

interface NewLine {
  item?: string;
  marca?: string;
  cantidad?: number;
}
interface NewCompraBody {
  segmento?: string;
  observaciones?: string;
  lines?: NewLine[];
}

/** mm/yyyy del mes actual (mismas fechas que Text(Today(),"[$-es-ES]mm/yyyy")). */
function currentMesAno(): string {
  return fechasHoy().mesAno;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = readSession(req.headers.cookie);
  if (!session) return res.status(401).json({ error: 'no_session' });

  // ── Listar compras del mes (cabeceras activas + sus líneas) ──────────────
  if (req.method === 'GET') {
    const mesAno = currentMesAno();
    try {
      const [pedidoRows, detalleRows] = await Promise.all([
        listItems(LIST_IDS.pedidoCompras, {
          select: pedidoCompraSelectFields(),
          filter: `fields/FechaMesAno_PC eq '${mesAno}'`,
        }),
        listItems(LIST_IDS.detalleCompra, {
          select: detalleCompraSelectFields(),
          filter: `fields/FechaMesAno_DC eq '${mesAno}'`,
        }),
      ]);
      // Filtro compuesto en memoria: SharePoint rechaza $filter con `and` sobre
      // dos columnas no indexadas. Cabeceras: Filtrar_PC="NO"; líneas: no rechazadas.
      const pedidos = pedidoRows.map(mapPedidoCompra).filter((p) => p.Filtrar_PC === 'NO');
      const detalles = detalleRows.map(mapDetalleCompra).filter((d) => d.Rechazada_DC !== 'SI');
      return res.status(200).json({ pedidos, detalles });
    } catch (err) {
      console.error('compras GET error', err);
      const status = err instanceof GraphError ? 502 : 500;
      return res.status(status).json({ error: 'server_error' });
    }
  }

  // ── Crear compra (cabecera 05 + líneas 06, todo Pendiente) ───────────────
  if (req.method === 'POST') {
    const body = (req.body ?? {}) as NewCompraBody;
    const segmento = body.segmento?.trim();
    const lines = (body.lines ?? []).filter((l) => l.item?.trim() && (l.cantidad ?? 0) > 0);
    if (!segmento || lines.length === 0) {
      return res.status(400).json({ error: 'invalid', message: 'Falta el segmento o los items del pedido' });
    }

    const f = fechasHoy();
    const totalQty = lines.reduce((s, l) => s + (l.cantidad ?? 0), 0);
    const idUnivoco = `${session.usuario.slice(0, 3)} - ${f.stamp} - ${f.fecha}`;

    try {
      const createdPedido = await createItem(LIST_IDS.pedidoCompras, {
        Title: 'Washinn',
        Status_PC: 'Pendiente',
        Segmento_PC: segmento,
        Cantidad_PC: String(totalQty),
        Edificio_PC: 'Washinn',
        Observaciones_PC: body.observaciones?.trim() ?? '',
        Fecha_PC: f.fecha,
        FechaMes_PC: f.mes,
        FechaMesAno_PC: f.mesAno,
        FechaAno_PC: f.ano,
        Usuario_PC: session.usuario,
        Version_PC: APP_VERSION,
        IDUnivoco_PC: idUnivoco,
        Filtrar_PC: 'NO',
        Hora_PC: f.hora,
      });

      const createdDetalles = [];
      for (const l of lines) {
        const created = await createItem(LIST_IDS.detalleCompra, {
          Title: 'Washinn',
          Cantidad_DC: String(l.cantidad),
          Item_DC: l.item!.trim(),
          Segmento_DC: segmento,
          Status_DC: 'Pendiente',
          IDCompra_DC: idUnivoco,
          Fecha_DC: f.fecha,
          FechaMesAno_DC: f.mesAno,
          FechaAno_DC: f.ano,
          Marca_DC: l.marca?.trim() ?? '',
        });
        createdDetalles.push(mapDetalleCompra(created));
      }

      return res.status(201).json({
        pedido: mapPedidoCompra(createdPedido),
        detalles: createdDetalles,
      });
    } catch (err) {
      console.error('compras POST error', err);
      const status = err instanceof GraphError ? 502 : 500;
      return res.status(status).json({ error: 'server_error' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method_not_allowed' });
}
