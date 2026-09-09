// GET /api/novedades            -> todas las novedades (20.Novedades)
// GET /api/novedades?id=<id>    -> evidencia (archivos) de una novedad
//
// Las carga el técnico desde la mobile; acá el back-office las revisa y da el OK.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GraphError } from '../_lib/graph.js';
import { listarNovedades, evidenciaDe } from '../_lib/novedades.js';
import { readSession } from '../_lib/session.js';
import { puedeAccederModulo } from '../_lib/permisos.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = readSession(req.headers.cookie);
  if (!session) return res.status(401).json({ error: 'no_session' });

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  try {
    if (!(await puedeAccederModulo(session.rol, 'Novedades'))) {
      return res
        .status(403)
        .json({ error: 'forbidden', message: 'Tu rol no tiene habilitado el módulo Novedades.' });
    }

    const rawId = req.query.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (id) return res.status(200).json(await evidenciaDe(id));

    return res.status(200).json(await listarNovedades());
  } catch (err) {
    console.error('novedades GET error', err);
    const status = err instanceof GraphError ? 502 : 500;
    return res.status(status).json({ error: 'server_error' });
  }
}
