// POST /api/novedades/[id]  { action: "resolver" | "anular", comentario? }
//
// "resolver" es el OK del back-office: el recurso está comprado/listo. No genera pedido de compra
// ni aprobación — el módulo es sólo el canal de aviso que hoy es un grupo de WhatsApp.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GraphError } from '../_lib/graph.js';
import { cambiarEstado, listarNovedades } from '../_lib/novedades.js';
import { fechasHoy, APP_VERSION } from '../_lib/lists.js';
import { readSession } from '../_lib/session.js';
import { puedeAccederModulo } from '../_lib/permisos.js';

interface Body {
  action?: 'resolver' | 'anular';
  comentario?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = readSession(req.headers.cookie);
  if (!session) return res.status(401).json({ error: 'no_session' });

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const rawId = req.query.id;
  const id = Number(Array.isArray(rawId) ? rawId[0] : rawId);
  if (!id) return res.status(400).json({ error: 'invalid_id' });

  const { action, comentario } = (req.body ?? {}) as Body;
  if (action !== 'resolver' && action !== 'anular') {
    return res.status(400).json({ error: 'invalid', message: 'Acción desconocida' });
  }

  try {
    if (!(await puedeAccederModulo(session.rol, 'Novedades'))) {
      return res
        .status(403)
        .json({ error: 'forbidden', message: 'Tu rol no tiene habilitado el módulo Novedades.' });
    }

    // Una novedad ya cerrada no se vuelve a procesar: sin este gate, "dar el OK" dos veces pisa
    // quién y cuándo la resolvió, que es justamente la trazabilidad que reemplaza al WhatsApp.
    const actual = (await listarNovedades()).find((n) => n.ID === id);
    if (!actual) return res.status(404).json({ error: 'not_found', message: 'La novedad no existe' });
    if (actual.Estado !== 'Pendiente') {
      return res.status(409).json({
        error: 'ya_cerrada',
        message: `La novedad ya está ${actual.Estado.toLowerCase()}.`,
      });
    }

    const f = fechasHoy();
    await cambiarEstado(
      id,
      action === 'resolver' ? 'Resuelto' : 'Anulado',
      session.usuario,
      String(comentario ?? '').trim(),
      f.fecha,
      f.hora,
      APP_VERSION,
    );
    return res.status(200).json({ ID: id, Estado: action === 'resolver' ? 'Resuelto' : 'Anulado' });
  } catch (err) {
    console.error('novedades [id] POST error', err);
    const status = err instanceof GraphError ? 502 : 500;
    return res.status(status).json({ error: 'server_error' });
  }
}
