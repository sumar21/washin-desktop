import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listItems, GraphError } from './_lib/graph.js';
import {
  LIST_IDS,
  mapRegistro,
  registrosSelectFields,
  mapDetalleCompra,
  detalleCompraSelectFields,
  mapDescanso,
  descansoSelectFields,
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
  const hoy = fechasHoy().fecha; // dd/mm/yyyy en hora de Argentina

  try {
    const [registrosRows, comprasRows, descansosRows] = await Promise.all([
      listItems(LIST_IDS.registros, {
        select: registrosSelectFields(),
        filter: `fields/MesA_x00f1_o eq '${mesAno}'`,
      }),
      listItems(LIST_IDS.detalleCompra, {
        select: detalleCompraSelectFields(),
        filter: `fields/FechaMesAno_DC eq '${mesAno}'`,
      }),
      // Descansos de HOY (Fecha_HD no está indexada → listItems agrega el header Prefer).
      listItems(LIST_IDS.horasDescanso, {
        select: descansoSelectFields(),
        filter: `fields/Fecha_HD eq '${hoy}'`,
      }),
    ]);

    return res.status(200).json({
      visitas: registrosRows.map(mapRegistro),
      comprasDelMes: comprasRows.map(mapDetalleCompra),
      descansosHoy: descansosRows.map(mapDescanso),
    });
  } catch (err) {
    console.error('home error', err);
    const status = err instanceof GraphError ? 502 : 500;
    return res.status(status).json({ error: 'server_error' });
  }
}
