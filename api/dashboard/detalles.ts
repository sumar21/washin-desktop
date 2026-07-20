import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listItems, GraphError } from '../_lib/graph.js';
import { LIST_IDS, mapDetalle, detalleSelectFields, fechasHoy } from '../_lib/lists.js';
import { readSession } from '../_lib/session.js';

/** Orden numérico de un 'mm/yyyy' (yyyy*12+mm), o null si no parsea. */
function mesAnoOrd(s?: string): number | null {
  const m = s?.trim().match(/^(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return Number(m[2]) * 12 + Number(m[1]);
}

/** 'mm/yyyy' del mes actual en hora de Argentina. */
function mesActual(): string {
  return fechasHoy().mesAno;
}

/**
 * Lista de meses ('mm/yyyy') en el rango [desde..hasta] inclusive. Si falta o es
 * inválido alguno de los extremos, cae al mes actual (rango mínimo = 1 mes → fetch
 * chico y rápido). Acota a 24 meses por las dudas para no armar filtros gigantes.
 */
function mesesEnRango(desde?: string, hasta?: string): string[] {
  const fallback = mesActual();
  let a = mesAnoOrd(desde) ?? mesAnoOrd(fallback)!;
  let b = mesAnoOrd(hasta) ?? mesAnoOrd(fallback)!;
  if (a > b) [a, b] = [b, a];
  const out: string[] = [];
  for (let ord = a; ord <= b && out.length < 24; ord++) {
    const y = Math.floor((ord - 1) / 12);
    const m = ord - y * 12;
    out.push(`${String(m).padStart(2, '0')}/${y}`);
  }
  return out.length ? out : [fallback];
}

/**
 * Detalle por ÍTEM (02.Detalles) del rango de meses elegido para el Dashboard de
 * Visitas → vista "Detalle" (tabla plana, una fila por ítem del checklist). Espejo de
 * api/dashboard/visitas.ts pero sobre 02.Detalles filtrando FechaMesAno_D.
 *
 * OJO VOLUMEN: 02.Detalles es ~8x los registros → este endpoint se llama LAZY (solo
 * cuando el usuario abre la vista Detalle), nunca en la carga inicial del dashboard.
 * Acepta `?desde=mm/yyyy&hasta=mm/yyyy`; sin params trae solo el mes actual.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  if (!readSession(req.headers.cookie)) {
    return res.status(401).json({ error: 'no_session' });
  }

  const desde = typeof req.query.desde === 'string' ? req.query.desde : undefined;
  const hasta = typeof req.query.hasta === 'string' ? req.query.hasta : undefined;
  const meses = mesesEnRango(desde, hasta);
  const filter = meses.map((m) => `fields/FechaMesAno_D eq '${m}'`).join(' or ');

  try {
    const rows = await listItems(LIST_IDS.detalles, {
      select: detalleSelectFields(),
      filter,
    });

    return res.status(200).json({ detalles: rows.map(mapDetalle) });
  } catch (err) {
    console.error('dashboard/detalles error', err);
    const status = err instanceof GraphError ? 502 : 500;
    return res.status(status).json({ error: 'server_error' });
  }
}
