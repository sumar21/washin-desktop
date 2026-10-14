// POST /api/calendario/[id]
//   { action: "editar", titulo, descripcion?, fecha, horaInicio?, horaFin? }
//   { action: "realizar" | "anular" }
//
// Sólo se tocan eventos Pendientes: uno realizado o anulado queda cerrado, igual que una novedad.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GraphError } from '../_lib/graph.js';
import { obtenerEvento, editarEvento, cambiarEstadoEvento, validarEvento } from '../_lib/calendario.js';
import { readSession } from '../_lib/session.js';
import { puedeAccederModulo } from '../_lib/permisos.js';

type Accion = 'editar' | 'realizar' | 'anular';
const ACCIONES: Accion[] = ['editar', 'realizar', 'anular'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = readSession(req.headers.cookie);
  if (!session) return res.status(401).json({ error: 'no_session' });

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const rawId = req.query.id;
  const id = Number(Array.isArray(rawId) ? rawId[0] : rawId);
  // -1 o 1.5 pasaban el `!id` y Graph los rechazaba con un 400 que salía como 502.
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'invalid_id' });

  const body = (req.body ?? {}) as Record<string, unknown>;
  const action = body.action as Accion;
  if (!ACCIONES.includes(action)) {
    return res.status(400).json({ error: 'invalid', message: 'Acción desconocida' });
  }

  try {
    if (!(await puedeAccederModulo(session.rol, 'Calendario'))) {
      return res
        .status(403)
        .json({ error: 'forbidden', message: 'Tu rol no tiene habilitado el módulo Calendario.' });
    }

    const actual = await obtenerEvento(id);
    if (!actual) return res.status(404).json({ error: 'not_found', message: 'El evento no existe' });
    if (actual.Estado !== 'Pendiente') {
      return res.status(409).json({
        error: 'ya_cerrado',
        message: `El evento ya está ${actual.Estado.toLowerCase()}.`,
      });
    }

    if (action === 'editar') {
      const v = validarEvento(body);
      if ('error' in v) return res.status(400).json({ error: 'invalid', message: v.error });
      await editarEvento(id, v.data, session.usuario);
      return res.status(200).json({ ID: id });
    }

    const estado = action === 'realizar' ? 'Realizado' : 'Anulado';
    await cambiarEstadoEvento(id, estado, session.usuario);
    return res.status(200).json({ ID: id, Estado: estado });
  } catch (err) {
    console.error('calendario [id] POST error', err);
    const status = err instanceof GraphError ? 502 : 500;
    return res.status(status).json({ error: 'server_error' });
  }
}
