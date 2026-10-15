// GET  /api/calendario?meses=09/2026,10/2026,11/2026[&ventilaciones=1]
//        -> { eventos, ventilaciones? }
//        `meses` son los que la grilla tiene a la vista (el mes + los días de borde de los
//        vecinos). `ventilaciones` (Asignadas y Programadas) se pide una sola vez: no depende del
//        mes (ver _lib/calendario.ts). El widget del Home no las pide: ya las tiene el store.
// POST /api/calendario  { titulo, descripcion?, fecha, horaInicio?, horaFin? }  -> evento creado
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GraphError } from '../_lib/graph.js';
import {
  listarEventos,
  listarVentilacionesAgendadas,
  crearEvento,
  validarEvento,
  esMesValido,
} from '../_lib/calendario.js';
import { readSession } from '../_lib/session.js';
import { puedeAccederModulo } from '../_lib/permisos.js';

/** La grilla mensual nunca muestra más de 3 meses; el tope evita pedir el historial entero. */
const MAX_MESES = 3;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = readSession(req.headers.cookie);
  if (!session) return res.status(401).json({ error: 'no_session' });

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  try {
    if (!(await puedeAccederModulo(session.rol, 'Calendario'))) {
      return res
        .status(403)
        .json({ error: 'forbidden', message: 'Tu rol no tiene habilitado el módulo Calendario.' });
    }

    if (req.method === 'GET') {
      const rawMeses = req.query.meses;
      const meses = [
        ...new Set(
          String(Array.isArray(rawMeses) ? rawMeses[0] : (rawMeses ?? ''))
            .split(',')
            .map((m) => m.trim())
            .filter(Boolean),
        ),
      ];
      if (meses.length === 0 || meses.length > MAX_MESES || !meses.every(esMesValido)) {
        return res.status(400).json({ error: 'invalid', message: 'Meses inválidos' });
      }
      // `abiertas=1` es el nombre que usaba la 1.2.0: una pestaña abierta con ese bundle sigue
      // pidiendo así y hace `r.realizadas.filter(...)`. Se le contesta con las mismas
      // Asignadas/Programadas y `realizadas: []` para que no se rompa hasta que recargue.
      const compat120 = req.query.abiertas === '1';
      const conVentilaciones = req.query.ventilaciones === '1' || compat120;

      const [eventos, ventilaciones] = await Promise.all([
        listarEventos(meses),
        conVentilaciones ? listarVentilacionesAgendadas() : Promise.resolve(undefined),
      ]);
      return res.status(200).json({
        eventos,
        ...(ventilaciones ? { ventilaciones } : {}),
        ...(compat120 ? { abiertas: ventilaciones, realizadas: [] } : { realizadas: [] }),
      });
    }

    const v = validarEvento((req.body ?? {}) as Record<string, unknown>);
    if ('error' in v) return res.status(400).json({ error: 'invalid', message: v.error });
    return res.status(201).json(await crearEvento(v.data, session.usuario));
  } catch (err) {
    console.error(`calendario ${req.method} error`, err);
    const status = err instanceof GraphError ? 502 : 500;
    return res.status(status).json({ error: 'server_error' });
  }
}
