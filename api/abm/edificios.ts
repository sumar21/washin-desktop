import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createItem, updateItem, getItem, GraphError } from '../_lib/graph.js';
import { LIST_IDS, mapEdificioAbm, edificioAbmSelectFields, canEditAbm } from '../_lib/lists.js';
import { readSession } from '../_lib/session.js';
import { cascadeBajaEdificio, cascadeUpdateEdificio } from '../_lib/cascadas.js';

interface EdificioInput {
  edificio?: string; // Micasa (nombre)
  codigo?: string; // C_x00f3_digo
  direccion?: string;
  horario?: string; // HoraVisita
  encargado?: string;
  celular?: string; // Celular (NUMBER)
  correo?: string;
  observaciones?: string;
  grupo?: string; // GrupoVentilacion_ED
  frecuencia?: string; // Frecuencia_ED (NUMBER)
}

interface Body extends EdificioInput {
  action?: 'create' | 'update' | 'baja';
  id?: number | string;
}

/** Traduce el input del front a columnas internas, respetando tipos (Celular/Frecuencia_ED = NUMBER). */
function toFields(input: EdificioInput): Record<string, unknown> {
  const f: Record<string, unknown> = {};
  if (input.edificio !== undefined) f.Micasa = input.edificio.trim();
  if (input.codigo !== undefined) f.C_x00f3_digo = input.codigo.trim();
  if (input.direccion !== undefined) f.Direccion = input.direccion.trim();
  if (input.horario !== undefined) f.HoraVisita = input.horario.trim();
  if (input.encargado !== undefined) f.Encargado = input.encargado.trim();
  if (input.correo !== undefined) f.Correo = input.correo.trim();
  if (input.observaciones !== undefined) f.Observaciones = input.observaciones.trim();
  if (input.grupo !== undefined) f.GrupoVentilacion_ED = input.grupo.trim();
  if (input.celular !== undefined) {
    const n = Number(String(input.celular).replace(/\D/g, ''));
    f.Celular = Number.isFinite(n) && n > 0 ? n : null;
  }
  if (input.frecuencia !== undefined) {
    const n = Number(input.frecuencia);
    f.Frecuencia_ED = Number.isFinite(n) && n > 0 ? n : null;
  }
  return f;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = readSession(req.headers.cookie);
  if (!session) return res.status(401).json({ error: 'no_session' });
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!canEditAbm(session.rol, 'Edificios')) {
    return res.status(403).json({ error: 'forbidden', message: 'Tu rol no puede editar edificios.' });
  }

  const body = (req.body ?? {}) as Body;
  try {
    if (body.action === 'create') return await create(body, res);
    if (body.action === 'update') return await update(body, res);
    if (body.action === 'baja') return await baja(body, res);
    return res.status(400).json({ error: 'invalid', message: 'Acción de edificio desconocida' });
  } catch (err) {
    console.error('abm/edificios error', err);
    const status = err instanceof GraphError ? 502 : 500;
    return res.status(status).json({ error: 'server_error' });
  }
}

async function create(body: Body, res: VercelResponse) {
  const nombre = body.edificio?.trim();
  if (!nombre) return res.status(400).json({ error: 'invalid', message: 'Falta el nombre del edificio' });
  const created = mapEdificioAbm(
    await createItem(LIST_IDS.edificios, {
      Title: '[sumar]',
      Status: 'ALTA',
      Ventilaciones_ED: 'NO',
      ...toFields(body),
    })
  );
  return res.status(201).json(created);
}

async function update(body: Body, res: VercelResponse) {
  const id = Number(body.id);
  if (!id) return res.status(400).json({ error: 'invalid_id' });
  const current = await getItem(LIST_IDS.edificios, id, edificioAbmSelectFields());
  if (!current) return res.status(404).json({ error: 'not_found', message: 'El edificio no existe' });
  const prev = mapEdificioAbm(current);
  await updateItem(LIST_IDS.edificios, id, toFields(body));
  const updated = mapEdificioAbm((await getItem(LIST_IDS.edificios, id, edificioAbmSelectFields()))!);
  await cascadeUpdateEdificio(prev, updated);
  return res.status(200).json(updated);
}

async function baja(body: Body, res: VercelResponse) {
  const id = Number(body.id);
  if (!id) return res.status(400).json({ error: 'invalid_id' });
  const current = await getItem(LIST_IDS.edificios, id, edificioAbmSelectFields());
  if (!current) return res.status(404).json({ error: 'not_found', message: 'El edificio no existe' });
  const prev = mapEdificioAbm(current);
  if (prev.Codigo && String(current.Status) === 'ALTA') {
    await cascadeBajaEdificio(prev.Codigo);
  }
  await updateItem(LIST_IDS.edificios, id, { Status: 'BAJA' });
  return res.status(200).json({ ID: id, Status: 'BAJA' });
}
