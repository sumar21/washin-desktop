import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listItems, GraphError } from '../_lib/graph.js';
import { LIST_IDS, mapAprobacion, aprobacionSelectFields } from '../_lib/lists.js';
import { readSession } from '../_lib/session.js';

const odataEscape = (v: string) => v.replace(/'/g, "''");

/** Los últimos N meses en formato `MM/YYYY`, que es como se guarda FechaMesAnoGen_AP. */
function ultimosMeses(n: number, hoy = new Date()): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    out.push(`${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`);
  }
  return out;
}

/**
 * Bandeja de aprobaciones: últimos 12 meses, TODOS los estados.
 *
 * Antes devolvía sólo las pendientes (`Aprobada='NO' && Rechazada='NO'`) del mes actual, pero la
 * pantalla ofrece filtros por estado (En Aprobacion / Aprobada / Rechazada) y por los últimos 12
 * meses: filtrar por Aprobada devolvía siempre vacío, porque esas filas nunca llegaban al front.
 * La ventana es la misma que ofrece `last12MesesOptions` en src/lib/filters.ts — si una crece,
 * la otra también.
 */
const MESES_VENTANA = 12;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!readSession(req.headers.cookie)) {
    return res.status(401).json({ error: 'no_session' });
  }

  // `or` sobre UNA sola columna: es lo único que SharePoint tolera sin índice (combinar dos
  // columnas no indexadas con `and` responde 400).
  const filter = ultimosMeses(MESES_VENTANA)
    .map((m) => `fields/FechaMesAnoGen_AP eq '${odataEscape(m)}'`)
    .join(' or ');

  try {
    const rows = await listItems(LIST_IDS.aprobaciones, {
      select: aprobacionSelectFields(),
      filter,
      top: 2000,
    });
    // Pendientes primero (son las accionables), después por fecha de generación descendente.
    const aprobaciones = rows.map(mapAprobacion).sort((a, b) => {
      const pend = (x: typeof a) => (x.Aprobada_AP === 'NO' && x.Rechazada_AP === 'NO' ? 0 : 1);
      if (pend(a) !== pend(b)) return pend(a) - pend(b);
      return b.ID - a.ID;
    });
    return res.status(200).json(aprobaciones);
  } catch (err) {
    console.error('aprobaciones GET error', err);
    const status = err instanceof GraphError ? 502 : 500;
    return res.status(status).json({ error: 'server_error' });
  }
}
