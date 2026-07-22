import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createItem, updateItem, getItem, GraphError } from '../_lib/graph.js';
import { LIST_IDS, mapEdificioAbm, edificioAbmSelectFields, canEditAbm, canDeleteAbm } from '../_lib/lists.js';
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
  // Coordenadas. Par 1 → Latitud/Longitud (NUMBER, full precision) + Latitud_ED/Longitud_ED
  // (TEXT truncado). Par 2 (edificios que abarcan mucho) → SOLO Latitud2_ED/Longitud2_ED (TEXT);
  // en el schema NO existe columna numérica para el par 2.
  latitud1?: string;
  longitud1?: string;
  latitud2?: string;
  longitud2?: string;
}

interface Body extends EdificioInput {
  action?: 'create' | 'update' | 'baja';
  id?: number | string;
}

/**
 * Redondeo de coordenada del msapp (mobile Screen_CrearEdificios): TRUNCA a 3 decimales por texto
 * (toma los 3 primeros dígitos tras el separador, SIN redondear) y usa COMA como separador decimal
 * — es el formato que consume el geofencing de la mobile (Latitud_ED, etc.).
 * OJO: NO es Math.floor (que en coordenadas negativas —las nuestras— daría otro valor); es truncado
 * por string, tal cual la PowerApps original.  "-34.567890" → "-34,567"   "-58,4" → "-58,4"
 */
function truncar3Coma(raw: string): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const norm = s.replace(',', '.');
  const dot = norm.indexOf('.');
  const truncado = dot === -1 ? norm : norm.slice(0, dot + 1) + norm.slice(dot + 1, dot + 4);
  return truncado.replace('.', ',');
}

/** Número full-precision de una coordenada tipeada (acepta "." o ","). null si vacío/ inválido. */
function coordNumero(raw: string): number | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
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
  // Par 1: número full-precision + string truncado (lo que lee el geofencing).
  if (input.latitud1 !== undefined) {
    f.Latitud = coordNumero(input.latitud1);
    f.Latitud_ED = truncar3Coma(input.latitud1);
  }
  if (input.longitud1 !== undefined) {
    f.Longitud = coordNumero(input.longitud1);
    f.Longitud_ED = truncar3Coma(input.longitud1);
  }
  // Par 2: solo string truncado (no hay columna numérica en el schema).
  if (input.latitud2 !== undefined) f.Latitud2_ED = truncar3Coma(input.latitud2);
  if (input.longitud2 !== undefined) f.Longitud2_ED = truncar3Coma(input.longitud2);
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
    if (body.action === 'baja') {
      // La baja necesita permiso extra: Supervisor Líder edita edificios pero NO los da de baja.
      if (!canDeleteAbm(session.rol, 'Edificios')) {
        return res.status(403).json({ error: 'forbidden', message: 'Tu rol no puede dar de baja edificios.' });
      }
      return await baja(body, res);
    }
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
