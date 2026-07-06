import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listItems, GraphError } from '../_lib/graph.js';
import { LIST_IDS, modulosPermitidos, permisosSelectFields } from '../_lib/lists.js';
import { readSession } from '../_lib/session.js';

/** Rehidrata la sesión al recargar la página (App.tsx la llama en el arranque). */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const session = readSession(req.headers.cookie);
  if (!session) {
    return res.status(401).json({ error: 'no_session' });
  }

  try {
    const permisoRows = await listItems(LIST_IDS.permisosDesktop, { select: permisosSelectFields() });
    const modulos = modulosPermitidos(permisoRows, session.rol);

    return res.status(200).json({
      usuario: session.usuario,
      nombre: session.nombre,
      apellido: session.apellido,
      rol: session.rol,
      modulos,
    });
  } catch (err) {
    console.error('me error', err);
    const status = err instanceof GraphError ? 502 : 500;
    return res.status(status).json({ error: 'server_error' });
  }
}
