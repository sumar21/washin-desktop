import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listItems, GraphError } from '../_lib/graph.ts';
import { LIST_IDS, mapUsuario, modulosPermitidos, permisosSelectFields } from '../_lib/lists.ts';
import { createSessionCookie } from '../_lib/session.ts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const { usuario, password } = (req.body ?? {}) as { usuario?: string; password?: string };
  if (!usuario?.trim() || !password?.trim()) {
    return res.status(400).json({ error: 'empty', message: 'Usuario y contraseña son obligatorios' });
  }

  try {
    const rows = await listItems(LIST_IDS.usuarios, {
      select: ['field_1', 'field_4', 'Nombre', 'Apellido', 'Concat_Nombre_Apellido', 'Rol', 'Status'],
    });
    const match = rows
      .map(mapUsuario)
      .find(
        (u) =>
          u.Usuario.toLowerCase() === usuario.trim().toLowerCase() &&
          u.Contrasena === password &&
          u.Status === 'ALTA'
      );

    if (!match) {
      return res.status(401).json({ error: 'invalid', message: 'Usuario o contraseña incorrectos' });
    }

    res.setHeader(
      'Set-Cookie',
      createSessionCookie({ usuario: match.Usuario, rol: match.Rol, nombre: match.Nombre, apellido: match.Apellido })
    );

    const permisoRows = await listItems(LIST_IDS.permisosDesktop, { select: permisosSelectFields() });
    const modulos = modulosPermitidos(permisoRows, match.Rol);

    return res.status(200).json({
      usuario: match.Usuario,
      nombre: match.Nombre,
      apellido: match.Apellido,
      rol: match.Rol,
      modulos,
    });
  } catch (err) {
    console.error('login error', err);
    const status = err instanceof GraphError ? 502 : 500;
    return res.status(status).json({ error: 'server_error', message: 'No se pudo validar contra SharePoint' });
  }
}
