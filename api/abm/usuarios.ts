import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listItems, createItem, updateItem, getItem, GraphError } from '../_lib/graph.js';
import { LIST_IDS, mapUsuario, usuarioAbmSelectFields, canEditAbm, mapRolesActivos } from '../_lib/lists.js';
import { readSession } from '../_lib/session.js';

/**
 * ABM de usuarios (lista `Usuarios`) — vive en Configuración, SOLO Admin.
 *
 * El msapp NO tiene un ABM de usuarios: sólo lee la lista para el login
 * (Screen_Login) y los pickers de técnicos. Este ABM administra esa misma
 * lista con el modelo de datos documentado (Usuario/Contraseña/Nombre/
 * Apellido/Rol/Teléfono/Email/Status).
 *  - GET  → usuarios ALTA (nunca devuelve la contraseña).
 *  - POST create/update/baja (gate canEditAbm(rol,'Usuarios') = Admin).
 *
 * NOTA de seguridad: la contraseña se guarda en texto plano (columna field_4)
 * para que el login existente (api/auth/login.ts, comparación plana) siga
 * funcionando — es deuda heredada del msapp. Migrar a hash (bcrypt/argon2) es
 * un trabajo aparte. El GET nunca expone field_4; en edición, contraseña vacía
 * = se mantiene la actual.
 */

/** Roles válidos = catálogo activo de ABM.Roles (el mismo que puebla el desplegable del front). */
async function rolesValidos(): Promise<string[]> {
  return mapRolesActivos(await listItems(LIST_IDS.roles, { top: 999 }));
}

interface UsuarioInput {
  usuario?: string;
  contrasena?: string;
  nombre?: string;
  apellido?: string;
  rol?: string;
  telefono?: string;
  email?: string;
}
interface Body extends UsuarioInput {
  action?: 'create' | 'update' | 'baja';
  id?: number | string;
}

/** input del front → columnas internas de Usuarios (field_1=usuario, field_4=password). */
function toFields(input: UsuarioInput): Record<string, unknown> {
  const f: Record<string, unknown> = {};
  if (input.usuario !== undefined) f.field_1 = input.usuario.trim();
  // La contraseña sólo se escribe si viene con valor (vacío en edición = se mantiene).
  if (input.contrasena !== undefined && input.contrasena !== '') f.field_4 = input.contrasena;
  if (input.nombre !== undefined) f.Nombre = input.nombre.trim();
  if (input.apellido !== undefined) f.Apellido = input.apellido.trim();
  if (input.rol !== undefined) f.Rol = input.rol.trim();
  if (input.telefono !== undefined) f.Telefono = input.telefono.trim();
  if (input.email !== undefined) f.Correo = input.email.trim();
  return f;
}

/** Proyección segura al front — nunca incluye la contraseña. */
function safe(u: ReturnType<typeof mapUsuario>) {
  return {
    ID: u.ID,
    Usuario: u.Usuario,
    Nombre: u.Nombre,
    Apellido: u.Apellido,
    Concat_Nombre_Apellido: u.Concat_Nombre_Apellido,
    Rol: u.Rol,
    Status: u.Status,
    Telefono: u.Telefono,
    Email: u.Email,
  };
}

const concat = (nombre: string, apellido: string) => `${nombre} ${apellido}`.replace(/\s+/g, ' ').trim();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = readSession(req.headers.cookie);
  if (!session) return res.status(401).json({ error: 'no_session' });

  // Admin-only en TODOS los métodos (la lista contiene credenciales).
  if (!canEditAbm(session.rol, 'Usuarios')) {
    return res.status(403).json({ error: 'forbidden', message: 'Solo un Admin puede administrar usuarios.' });
  }

  if (req.method === 'GET') {
    try {
      const usuarios = (await listItems(LIST_IDS.usuarios, { select: usuarioAbmSelectFields() }))
        .map(mapUsuario)
        .filter((u) => u.Status === 'ALTA')
        .sort((a, b) => a.Concat_Nombre_Apellido.localeCompare(b.Concat_Nombre_Apellido, 'es'));
      return res.status(200).json(usuarios.map(safe));
    } catch (err) {
      console.error('abm/usuarios GET error', err);
      const status = err instanceof GraphError ? 502 : 500;
      return res.status(status).json({ error: 'server_error' });
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const body = (req.body ?? {}) as Body;
  try {
    if (body.action === 'create') return await create(body, res);
    if (body.action === 'update') return await update(body, res);
    if (body.action === 'baja') return await baja(body, res);
    return res.status(400).json({ error: 'invalid', message: 'Acción de usuario desconocida' });
  } catch (err) {
    console.error('abm/usuarios POST error', err);
    const status = err instanceof GraphError ? 502 : 500;
    return res.status(status).json({ error: 'server_error' });
  }
}

async function create(body: Body, res: VercelResponse) {
  const usuario = body.usuario?.trim();
  const nombre = body.nombre?.trim();
  if (!usuario) return res.status(400).json({ error: 'invalid', message: 'Falta el usuario' });
  if (!nombre) return res.status(400).json({ error: 'invalid', message: 'Falta el nombre' });
  if (!body.contrasena) return res.status(400).json({ error: 'invalid', message: 'Falta la contraseña' });
  if (!body.rol || !(await rolesValidos()).includes(body.rol)) return res.status(400).json({ error: 'invalid', message: 'Rol inválido' });

  // Usuario (field_1) único.
  const existentes = (await listItems(LIST_IDS.usuarios, { select: usuarioAbmSelectFields() })).map(mapUsuario);
  if (existentes.some((u) => u.Usuario.toLowerCase() === usuario.toLowerCase())) {
    return res.status(409).json({ error: 'invalid', message: `Ya existe el usuario "${usuario}"` });
  }

  const apellido = body.apellido?.trim() ?? '';
  const created = mapUsuario(
    await createItem(LIST_IDS.usuarios, {
      Title: usuario,
      Status: 'ALTA',
      Concat_Nombre_Apellido: concat(nombre, apellido),
      ...toFields(body),
    })
  );
  return res.status(201).json(safe(created));
}

async function update(body: Body, res: VercelResponse) {
  const id = Number(body.id);
  if (!id) return res.status(400).json({ error: 'invalid_id' });
  if (body.rol !== undefined && !(await rolesValidos()).includes(body.rol)) {
    return res.status(400).json({ error: 'invalid', message: 'Rol inválido' });
  }
  const current = await getItem(LIST_IDS.usuarios, id, usuarioAbmSelectFields());
  if (!current) return res.status(404).json({ error: 'not_found', message: 'El usuario no existe' });
  const prev = mapUsuario(current);

  // Unicidad del usuario si cambió.
  const nuevoUsuario = body.usuario?.trim();
  if (nuevoUsuario && nuevoUsuario.toLowerCase() !== prev.Usuario.toLowerCase()) {
    const existentes = (await listItems(LIST_IDS.usuarios, { select: usuarioAbmSelectFields() })).map(mapUsuario);
    if (existentes.some((u) => u.ID !== id && u.Usuario.toLowerCase() === nuevoUsuario.toLowerCase())) {
      return res.status(409).json({ error: 'invalid', message: `Ya existe el usuario "${nuevoUsuario}"` });
    }
  }

  const fields = toFields(body);
  const nombre = body.nombre?.trim() ?? prev.Nombre;
  const apellido = body.apellido?.trim() ?? prev.Apellido;
  fields.Concat_Nombre_Apellido = concat(nombre, apellido);
  await updateItem(LIST_IDS.usuarios, id, fields);
  const updated = mapUsuario((await getItem(LIST_IDS.usuarios, id, usuarioAbmSelectFields()))!);
  return res.status(200).json(safe(updated));
}

async function baja(body: Body, res: VercelResponse) {
  const id = Number(body.id);
  if (!id) return res.status(400).json({ error: 'invalid_id' });
  await updateItem(LIST_IDS.usuarios, id, { Status: 'BAJA' });
  return res.status(200).json({ ID: id, Status: 'BAJA' });
}
