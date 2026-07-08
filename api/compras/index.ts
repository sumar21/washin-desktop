import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listItems, createItem, GraphError } from '../_lib/graph.js';
import {
  LIST_IDS,
  mapPedidoCompra,
  pedidoCompraSelectFields,
  mapDetalleCompra,
  detalleCompraSelectFields,
  fechasHoy,
  APP_VERSION,
} from '../_lib/lists.js';
import { readSession } from '../_lib/session.js';

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

  // ── Listar compras (cabeceras + sus líneas) ──────────────────────────────
  if (req.method === 'GET') {
    // `?mes=MM/YYYY` para ver un mes puntual (default: mes actual), o
    // `?meses=MM/YYYY,MM/YYYY` para ver varios meses a la vez (fetch en paralelo
    // + merge). Devolvemos TODOS los estados (incl. Recibida/Anulado/Rechazada)
    // para que el filtro de estado del front funcione; el front decide qué ocultar.
    const mesesParam = typeof req.query.meses === 'string' ? req.query.meses : undefined;
    const mesParam = typeof req.query.mes === 'string' ? req.query.mes : undefined;
    const meses = mesesParam
      ? mesesParam.split(',').map((m) => m.trim()).filter((m) => /^\d{2}\/\d{4}$/.test(m))
      : [mesParam && /^\d{2}\/\d{4}$/.test(mesParam) ? mesParam : currentMesAno()];
    // Fallback defensivo: si `meses` venía pero sin ningún valor válido, usar el mes actual.
    const targetMeses = meses.length > 0 ? meses : [currentMesAno()];
    try {
      const results = await Promise.all(
        targetMeses.map(async (mesAno) => {
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
          return { pedidoRows, detalleRows };
        })
      );
      const pedidos = results.flatMap((r) => r.pedidoRows.map(mapPedidoCompra));
      const detalles = results
        .flatMap((r) => r.detalleRows.map(mapDetalleCompra))
        .filter((d) => d.Rechazada_DC !== 'SI');
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
