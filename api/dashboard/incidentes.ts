import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listItems, GraphError, type SharePointItem } from '../_lib/graph.js';
import {
  LIST_IDS,
  mapIncidente,
  incidenteSelectFields,
  mapRepuestoIncidente,
  repuestoIncidenteSelectFields,
  fechasHoy,
} from '../_lib/lists.js';
import { readSession } from '../_lib/session.js';

/**
 * Dashboard de Incidentes (GET, read-only) — SCOPED al rango de meses pedido.
 *
 * Query: `?desde=MM/YYYY&hasta=MM/YYYY`. Sin params → mes actual. Trae SOLO los
 * incidentes de los meses del rango (ya NO ~12 fijos) + los repuestos de esos
 * incidentes (13.RepuestosIncidentes, con `Precio_RI` — columna nueva → default 0).
 *
 * Estrategia: se filtra server-side con un OR sobre `FechaMesAno_IN` (incidentes) /
 * `FechaMes_RI` (repuestos) de los meses del rango. Estas columnas no están
 * indexadas — `listItems` ya agrega el header `HonorNonIndexedQueriesWarningMayFailRandomly`.
 * Si el OR falla (p. ej. demasiados meses → Graph lo rechaza) se cae a `top:999` +
 * filtro en memoria por el rango. Los repuestos se acotan siempre en memoria al set
 * de incidentes del rango (join por `IDIncidente_RI`), descartando huérfanos.
 */

/** Clave mensual ordenable a partir de {y, m}: y*100 + m. */
function ymKey(y: number, m: number): number {
  return y * 100 + m;
}

/** 'mm/yyyy' → {y, m} o null. */
function parseMesAno(s: string): { y: number; m: number } | null {
  const mm = s.trim().match(/^(\d{1,2})\/(\d{4})$/);
  if (!mm) return null;
  return { y: Number(mm[2]), m: Number(mm[1]) };
}

/** 'dd/mm/yyyy' → {y, m} o null. */
function parseDmyMonth(s: string): { y: number; m: number } | null {
  const mm = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!mm) return null;
  return { y: Number(mm[3]), m: Number(mm[2]) };
}

/** Lista de meses {y, m, mesAno} en el rango inclusivo [a..b] (ordenados asc). */
function monthsInRange(a: { y: number; m: number }, b: { y: number; m: number }): { y: number; m: number; mesAno: string }[] {
  let lo = a.y * 12 + (a.m - 1);
  let hi = b.y * 12 + (b.m - 1);
  if (lo > hi) [lo, hi] = [hi, lo];
  const out: { y: number; m: number; mesAno: string }[] = [];
  for (let idx = lo; idx <= hi; idx++) {
    const y = Math.floor(idx / 12);
    const m = (idx % 12) + 1;
    out.push({ y, m, mesAno: `${String(m).padStart(2, '0')}/${y}` });
  }
  return out;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = readSession(req.headers.cookie);
  if (!session) return res.status(401).json({ error: 'no_session' });

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  // Rango de meses. Default (sin params o inválidos) = mes actual.
  const desdeParam = typeof req.query.desde === 'string' ? req.query.desde : '';
  const hastaParam = typeof req.query.hasta === 'string' ? req.query.hasta : '';
  const curMesAno = fechasHoy().mesAno;
  const desde = parseMesAno(desdeParam) ?? parseMesAno(curMesAno)!;
  const hasta = parseMesAno(hastaParam) ?? desde;
  const months = monthsInRange(desde, hasta);
  const monthKeys = new Set(months.map((mo) => ymKey(mo.y, mo.m)));
  const minKey = Math.min(...monthKeys);
  const maxKey = Math.max(...monthKeys);

  /** ¿El incidente cae dentro del rango de meses? (por FechaMesAno_IN o Fecha_IN). */
  const incInRange = (i: ReturnType<typeof mapIncidente>): boolean => {
    const p = parseMesAno(i.FechaMesAno_IN) ?? parseDmyMonth(i.Fecha_IN);
    if (!p) return false;
    const k = ymKey(p.y, p.m);
    return k >= minKey && k <= maxKey;
  };

  try {
    // ── Incidentes: OR sobre FechaMesAno_IN; fallback a top:999 + memoria ──
    const orIncidentes = months.map((mo) => `fields/FechaMesAno_IN eq '${mo.mesAno}'`).join(' or ');
    let incRows: SharePointItem[];
    try {
      incRows = await listItems(LIST_IDS.incidentes, {
        select: incidenteSelectFields(),
        filter: orIncidentes,
        top: 999,
      });
    } catch (err) {
      if (!(err instanceof GraphError)) throw err;
      // El OR de muchos meses puede ser rechazado por Graph — caé a traer todo.
      incRows = await listItems(LIST_IDS.incidentes, { select: incidenteSelectFields(), top: 999 });
    }
    const incidentes = incRows
      .map(mapIncidente)
      .filter(incInRange) // acota el fallback y descarta bordes por si el OR trae de más
      .sort((a, b) => b.ID - a.ID);

    const incIds = new Set(incidentes.map((i) => i.IDIncidente));

    // ── Repuestos: OR sobre FechaMes_RI; fallback a top:999 + memoria ──
    const orRepuestos = months.map((mo) => `fields/FechaMes_RI eq '${mo.mesAno}'`).join(' or ');
    let repRows: SharePointItem[];
    try {
      repRows = await listItems(LIST_IDS.repuestosIncidentes, {
        select: repuestoIncidenteSelectFields(),
        filter: orRepuestos,
        top: 999,
      });
    } catch (err) {
      if (!(err instanceof GraphError)) throw err;
      repRows = await listItems(LIST_IDS.repuestosIncidentes, { select: repuestoIncidenteSelectFields(), top: 999 });
    }
    let repuestos = repRows.map(mapRepuestoIncidente).filter((r) => incIds.has(r.IDIncidente_RI));

    // Robustez: si el filtro por FechaMes_RI no matcheó ningún repuesto de los
    // incidentes del rango (p. ej. formato de fecha distinto en la columna) pero sí
    // hay incidentes, recargamos sin filtro y acotamos por IDIncidente_RI.
    if (repuestos.length === 0 && incidentes.length > 0) {
      const allRep = await listItems(LIST_IDS.repuestosIncidentes, {
        select: repuestoIncidenteSelectFields(),
        top: 999,
      });
      repuestos = allRep.map(mapRepuestoIncidente).filter((r) => incIds.has(r.IDIncidente_RI));
    }

    return res.status(200).json({ incidentes, repuestos });
  } catch (err) {
    console.error('dashboard/incidentes GET error', err);
    const status = err instanceof GraphError ? 502 : 500;
    return res.status(status).json({ error: 'server_error' });
  }
}
