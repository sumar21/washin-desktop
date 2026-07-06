import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listItems, GraphError } from '../_lib/graph.js';
import { LIST_IDS, mapMaquina, maquinaSelectFields, sortMaquinas } from '../_lib/lists.js';
import { readSession } from '../_lib/session.js';

/**
 * Parque de máquinas (08.DetalleMaquina). Trae **todas** las máquinas activas
 * (Status_DM ≠ ELIMINADA) — sin el tope de 2000 registros de la PowerApp, porque
 * `listItems` pagina siguiendo `@odata.nextLink`. Se devuelven ordenadas por
 * Edificio → Segmento → alfabético, y la lista de edificios (con su código) para
 * el selector de transferencia.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!readSession(req.headers.cookie)) {
    return res.status(401).json({ error: 'no_session' });
  }

  try {
    const rows = await listItems(LIST_IDS.detalleMaquina, { select: maquinaSelectFields(), top: 999 });
    const maquinas = sortMaquinas(rows.map(mapMaquina).filter((m) => m.Status_DM !== 'ELIMINADA'));

    // Edificios (con código) derivados de las máquinas — alimenta el selector de destino.
    const edifMap = new Map<string, string>();
    for (const m of maquinas) {
      if (m.Edificio_DM && !edifMap.has(m.Edificio_DM)) edifMap.set(m.Edificio_DM, m.CodigoEdificio_DM ?? '');
    }
    const edificios = [...edifMap.entries()]
      .map(([edificio, codigo]) => ({ edificio, codigo }))
      .sort((a, b) => a.edificio.localeCompare(b.edificio, 'es'));

    return res.status(200).json({ maquinas, edificios });
  } catch (err) {
    console.error('maquinas GET error', err);
    const status = err instanceof GraphError ? 502 : 500;
    return res.status(status).json({ error: 'server_error' });
  }
}
