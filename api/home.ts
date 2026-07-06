import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listItems, GraphError } from './_lib/graph.js';
import {
  LIST_IDS,
  mapRegistro,
  registrosSelectFields,
  mapDetalleCompra,
  detalleCompraSelectFields,
  fechasHoy,
} from './_lib/lists.js';
import { readSession } from './_lib/session.js';

function currentMesAno(): string {
  return fechasHoy().mesAno; // mm/yyyy en hora de Argentina (ver fechasHoy)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  if (!readSession(req.headers.cookie)) {
    return res.status(401).json({ error: 'no_session' });
  }

  const mesAno = currentMesAno();

  try {
    const [registrosRows, comprasRows] = await Promise.all([
      listItems(LIST_IDS.registros, {
        select: registrosSelectFields(),
        filter: `fields/MesA_x00f1_o eq '${mesAno}'`,
      }),
      listItems(LIST_IDS.detalleCompra, {
        select: detalleCompraSelectFields(),
        filter: `fields/FechaMesAno_DC eq '${mesAno}'`,
      }),
    ]);

    return res.status(200).json({
      visitas: registrosRows.map(mapRegistro),
      comprasDelMes: comprasRows.map(mapDetalleCompra),
    });
  } catch (err) {
    console.error('home error', err);
    const status = err instanceof GraphError ? 502 : 500;
    return res.status(status).json({ error: 'server_error' });
  }
}
