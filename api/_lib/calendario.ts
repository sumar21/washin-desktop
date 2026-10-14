// Calendario (21.EventosCalendario + 19.Ventilaciones) — lado escritorio.
//
// Vista tipo Google Calendar para gerencia: muestra las ventilaciones y deja cargar eventos
// propios del equipo. Funcionalidad NUEVA: no existe en la PowerApp, así que no hay paridad que
// respetar. La mobile no lee esta lista.
//
// Ninguna consulta crece con el historial:
//   - Ventilaciones ABIERTAS: se piden por estado, sin filtrar por mes, y el front las ubica en
//     memoria según el estado. Son ~una por edificio del circuito (finalizar una crea exactamente
//     una Pendiente nueva), así que el set sólo crece si se suman edificios.
//   - Ventilaciones REALIZADAS y eventos: sólo los meses visibles, filtrados en SharePoint por la
//     columna mm/yyyy (`FechaMesAnoFinalizacion_VE` / `FechaMesAno_EC`, esta última indexada).
import { listItems, createItem, updateItem, getItem, resolveListIdByName } from './graph.js';
import {
  LIST_IDS,
  APP_VERSION,
  mapVentilacion,
  ventilacionSelectFields,
  desglosarFechaDDMMYYYY,
  fechasHoy,
  VENTILACIONES_ABIERTAS_FILTER,
  type VentilacionRow,
} from './lists.js';

const LISTA = '21.EventosCalendario';

export const ESTADOS_EVENTO = ['Pendiente', 'Realizado', 'Anulado'] as const;
export type EstadoEvento = (typeof ESTADOS_EVENTO)[number];

export interface EventoRow {
  ID: number;
  Titulo: string;
  Descripcion: string;
  Fecha: string;
  FechaMesAno: string;
  /** Vacía = evento de todo el día. */
  HoraInicio: string;
  HoraFin: string;
  Estado: string;
  Usuario: string;
  FechaCarga: string;
  HoraCarga: string;
  UsuarioMod?: string;
  FechaMod?: string;
  HoraMod?: string;
}

// Nombres INTERNOS reales de la lista, verificados contra el tenant. Dos no coinciden con el
// visible: "HoraCarga_EC" se creó primero como Hora_EC (SharePoint fija el interno con el primer
// nombre) y la de la fecha de edición es FechaMod_EC. No existe VersionMod_EC: escribirla haría
// fallar el PATCH entero (§3 del CLAUDE.md raíz).
const SELECT = [
  'Titulo_EC', 'Descripcion_EC', 'Fecha_EC', 'FechaMesAno_EC', 'HoraInicio_EC', 'HoraFin_EC',
  'Estado_EC', 'FechaCarga_EC', 'Hora_EC', 'UserCarga_EC', 'UserMod_EC', 'FechaMod_EC', 'HoraMod_EC',
];

const txt = (v: unknown) => String(v ?? '').trim();

function mapEvento(item: Record<string, unknown> & { id: string }): EventoRow {
  return {
    ID: Number(item.id),
    Titulo: txt(item.Titulo_EC),
    Descripcion: txt(item.Descripcion_EC),
    Fecha: txt(item.Fecha_EC),
    FechaMesAno: txt(item.FechaMesAno_EC),
    HoraInicio: txt(item.HoraInicio_EC),
    HoraFin: txt(item.HoraFin_EC),
    Estado: txt(item.Estado_EC) || 'Pendiente',
    Usuario: txt(item.UserCarga_EC),
    FechaCarga: txt(item.FechaCarga_EC),
    HoraCarga: txt(item.Hora_EC),
    UsuarioMod: txt(item.UserMod_EC) || undefined,
    FechaMod: txt(item.FechaMod_EC) || undefined,
    HoraMod: txt(item.HoraMod_EC) || undefined,
  };
}

// ── Validación ────────────────────────────────────────────────────────────

const MES_RE = /^(0[1-9]|1[0-2])\/\d{4}$/;
const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Límite de SharePoint para "Una línea de texto". */
const MAX_TITULO = 255;
const MAX_DESCRIPCION = 4000;

/** `mm/yyyy` válido. También es la defensa contra inyección en el `$filter`. */
export const esMesValido = (v: string) => MES_RE.test(v);

function esFechaValida(v: string): boolean {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  if (!m) return false;
  const [d, mm, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mm - 1, d);
  // Descarta 31/02 y similares, que `new Date` corre al mes siguiente sin avisar.
  return date.getFullYear() === y && date.getMonth() === mm - 1 && date.getDate() === d;
}

export interface EventoInput {
  titulo: string;
  descripcion: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
}

/** Normaliza y valida el body de alta/edición. Devuelve el mensaje de error para el usuario. */
export function validarEvento(body: Record<string, unknown>): { data: EventoInput } | { error: string } {
  // Sólo strings: con `String(v)` un objeto pasaba como "[object Object]".
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const data: EventoInput = {
    titulo: str(body.titulo),
    descripcion: str(body.descripcion),
    fecha: str(body.fecha),
    horaInicio: str(body.horaInicio),
    horaFin: str(body.horaFin),
  };
  if (!data.titulo) return { error: 'Falta el título' };
  if (data.titulo.length > MAX_TITULO) return { error: `El título no puede superar los ${MAX_TITULO} caracteres` };
  if (data.descripcion.length > MAX_DESCRIPCION) {
    return { error: `La descripción no puede superar los ${MAX_DESCRIPCION} caracteres` };
  }
  if (!esFechaValida(data.fecha)) return { error: 'La fecha no es válida' };
  if (data.horaInicio && !HORA_RE.test(data.horaInicio)) return { error: 'La hora de inicio no es válida' };
  if (data.horaFin && !HORA_RE.test(data.horaFin)) return { error: 'La hora de fin no es válida' };
  if (data.horaFin && !data.horaInicio) return { error: 'Para cargar la hora de fin falta la de inicio' };
  // HH:mm con cero a la izquierda compara bien como string.
  if (data.horaFin && data.horaFin <= data.horaInicio) {
    return { error: 'La hora de fin tiene que ser posterior a la de inicio' };
  }
  return { data };
}

// ── Lectura ───────────────────────────────────────────────────────────────

/** `or` sobre una sola columna: SharePoint lo acepta aunque no esté indexada. */
const filtroMeses = (columna: string, meses: string[]) =>
  meses.map((m) => `fields/${columna} eq '${m}'`).join(' or ');

/** Eventos de los meses pedidos (todos los estados; el front decide qué muestra). */
export async function listarEventos(meses: string[]): Promise<EventoRow[]> {
  const listId = await resolveListIdByName(LISTA);
  const rows = await listItems(listId, { select: SELECT, filter: filtroMeses('FechaMesAno_EC', meses), top: 999 });
  return rows.map(mapEvento);
}

/** Ventilaciones realizadas en los meses pedidos. */
export async function listarRealizadas(meses: string[]): Promise<VentilacionRow[]> {
  const rows = await listItems(LIST_IDS.ventilaciones, {
    select: ventilacionSelectFields(),
    filter: filtroMeses('FechaMesAnoFinalizacion_VE', meses),
    top: 999,
  });
  return rows.map(mapVentilacion).filter((v) => v.Estado_VE === 'Realizada');
}

/** Ventilaciones abiertas (Pendiente / Asignada / Programada), sin filtrar por fecha. */
export async function listarAbiertas(): Promise<VentilacionRow[]> {
  const rows = await listItems(LIST_IDS.ventilaciones, {
    select: ventilacionSelectFields(),
    filter: VENTILACIONES_ABIERTAS_FILTER,
    top: 999,
  });
  return rows.map(mapVentilacion);
}

export async function obtenerEvento(id: number): Promise<EventoRow | null> {
  const listId = await resolveListIdByName(LISTA);
  const item = await getItem(listId, id, SELECT);
  return item ? mapEvento(item) : null;
}

// ── Escritura ─────────────────────────────────────────────────────────────

function camposEvento(data: EventoInput) {
  const { mesAno, ano } = desglosarFechaDDMMYYYY(data.fecha);
  return {
    Titulo_EC: data.titulo,
    Descripcion_EC: data.descripcion,
    Fecha_EC: data.fecha,
    FechaMesAno_EC: mesAno,
    FechaAno_EC: ano,
    HoraInicio_EC: data.horaInicio,
    HoraFin_EC: data.horaFin,
  };
}

export async function crearEvento(data: EventoInput, usuario: string): Promise<EventoRow> {
  const listId = await resolveListIdByName(LISTA);
  const f = fechasHoy();
  const created = await createItem(listId, {
    // Title es la columna por defecto de SharePoint; como en el resto de las listas lleva un
    // valor fijo y el título real va en Titulo_EC.
    Title: '[sumar]',
    ...camposEvento(data),
    Estado_EC: 'Pendiente',
    FechaCarga_EC: f.fecha,
    Hora_EC: f.hora,
    UserCarga_EC: usuario,
    Version_EC: APP_VERSION,
  });
  return mapEvento(created);
}

function sellosModificacion(usuario: string) {
  const f = fechasHoy();
  return { UserMod_EC: usuario, FechaMod_EC: f.fecha, HoraMod_EC: f.hora };
}

export async function editarEvento(id: number, data: EventoInput, usuario: string): Promise<void> {
  const listId = await resolveListIdByName(LISTA);
  await updateItem(listId, id, { ...camposEvento(data), ...sellosModificacion(usuario) });
}

/** Realizar o anular. Nunca se borra la fila: un anulado queda como registro. */
export async function cambiarEstadoEvento(id: number, estado: EstadoEvento, usuario: string): Promise<void> {
  const listId = await resolveListIdByName(LISTA);
  await updateItem(listId, id, { Estado_EC: estado, ...sellosModificacion(usuario) });
}
