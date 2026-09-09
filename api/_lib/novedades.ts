// Novedades (20.Novedades) — lado escritorio.
//
// Las carga el técnico desde la mobile (tacho roto, sticker despegado, cartelería) y acá el
// back-office las ve, compra el recurso y da el OK. No hay gestión de compras: el OK es un cambio
// de estado, no genera pedido ni aprobación.
//
// La evidencia (foto o video) NO está en la lista: vive en la biblioteca "Documentos", carpeta
// `Novedades/<id>`. Un video de celular no entra en una columna base64 como 12.FotoIncidentes.
import {
  listItems,
  updateItem,
  resolveListIdByName,
  listarArchivosCarpeta,
  contarPorSubcarpeta,
} from './graph.js';

const LISTA = '20.Novedades';
// La ruta se DERIVA del id: no hay columna que la guarde, así no puede apuntar a otro lado.
export const CARPETA_RAIZ = 'Novedades';
export const carpetaDe = (id: string | number) => `${CARPETA_RAIZ}/${id}`;

export const ESTADOS_NOVEDAD = ['Pendiente', 'Resuelto', 'Anulado'] as const;
export type EstadoNovedad = (typeof ESTADOS_NOVEDAD)[number];
export function esEstadoValido(v: unknown): v is EstadoNovedad {
  return typeof v === 'string' && (ESTADOS_NOVEDAD as readonly string[]).includes(v);
}

export interface NovedadRow {
  ID: number;
  Edificio: string;
  CodigoEdificio: string;
  Descripcion: string;
  Estado: string;
  Fecha: string;
  FechaMesAno: string;
  Hora: string;
  Usuario: string;
  /** Sale del drive, no de una columna de la lista. */
  CantidadEvidencia: number;
  FechaResuelto?: string;
  HoraResuelto?: string;
  UsuarioResuelto?: string;
  DescripcionResuelto?: string;
}

// EXACTAMENTE las columnas que existen en la lista. Pedir una que no existe en $select es
// inofensivo, pero escribirla hace fallar el PATCH entero (§3 del CLAUDE.md raíz).
const SELECT = [
  'Edificio_NV', 'CodigoEdificio_NV', 'Descripcion_NV', 'Estado_NV',
  'Fecha_NV', 'FechaMesAno_NV', 'Hora_NV', 'User_NV',
  'FechaResuelto_NV', 'HoraResuelto_NV', 'UserResuelto_NV', 'DescripcionResuelto_NV',
];

const txt = (v: unknown) => String(v ?? '').trim();

function mapNovedad(item: Record<string, unknown> & { id: string }, evidencia = 0): NovedadRow {
  return {
    ID: Number(item.id),
    Edificio: txt(item.Edificio_NV),
    CodigoEdificio: txt(item.CodigoEdificio_NV),
    Descripcion: txt(item.Descripcion_NV),
    Estado: txt(item.Estado_NV) || 'Pendiente',
    Fecha: txt(item.Fecha_NV),
    FechaMesAno: txt(item.FechaMesAno_NV),
    Hora: txt(item.Hora_NV),
    Usuario: txt(item.User_NV),
    CantidadEvidencia: evidencia,
    FechaResuelto: txt(item.FechaResuelto_NV) || undefined,
    HoraResuelto: txt(item.HoraResuelto_NV) || undefined,
    UsuarioResuelto: txt(item.UserResuelto_NV) || undefined,
    DescripcionResuelto: txt(item.DescripcionResuelto_NV) || undefined,
  };
}

/**
 * Todas las novedades, la más nueva primero.
 *
 * Sin `$filter`: la lista es nueva, sus columnas no están indexadas, y combinar dos no indexadas
 * con `and` devuelve 400 (§3 del CLAUDE.md raíz). La pantalla filtra en memoria, que además es lo
 * que necesita para que el filtro por estado pueda mostrar las ya resueltas — el error que hubo
 * en Aprobaciones por filtrar de más en el backend.
 */
export async function listarNovedades(): Promise<NovedadRow[]> {
  const listId = await resolveListIdByName(LISTA);
  const [rows, conteos] = await Promise.all([
    listItems(listId, { select: SELECT, top: 2000 }),
    contarPorSubcarpeta(CARPETA_RAIZ),
  ]);
  return rows
    .map((r) => mapNovedad(r, conteos.get(String(r.id)) ?? 0))
    .sort((a, b) => b.ID - a.ID);
}

export async function evidenciaDe(id: number | string) {
  return listarArchivosCarpeta(carpetaDe(id));
}

/** Cambia el estado (el "OK" del back-office, o una anulación). */
export async function cambiarEstado(
  id: number,
  estado: EstadoNovedad,
  usuario: string,
  comentario: string,
  fecha: string,
  hora: string,
  version: string,
): Promise<void> {
  const listId = await resolveListIdByName(LISTA);
  await updateItem(listId, id, {
    Estado_NV: estado,
    UserResuelto_NV: usuario,
    FechaResuelto_NV: fecha,
    HoraResuelto_NV: hora,
    DescripcionResuelto_NV: comentario,
    VersionResuelto_NV: version,
  });
}
