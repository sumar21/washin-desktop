import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listItems, createItem, updateItem, GraphError } from '../_lib/graph.js';
import {
  LIST_IDS,
  mapResumenCircuito,
  resumenCircuitoSelectFields,
  mapDetalleCircuito,
  detalleCircuitoSelectFields,
  mapEdificioAbm,
  edificioAbmSelectFields,
  mapRuta,
  rutaSelectFields,
  canEditAbm,
  type EdificioAbmRow,
} from '../_lib/lists.js';
import { readSession } from '../_lib/session.js';
import { cascadeEliminarCircuito } from '../_lib/cascadas.js';

interface Body {
  action?: 'create' | 'delete' | 'add-edificio' | 'remove-edificio' | 'update-obs';
  nroRuta?: number | string;
  nroCircuito?: number | string;
  observaciones?: string;
  edificioIds?: (number | string)[]; // IDs de ABM.Edificios
  edificioId?: number | string;
  detalleId?: number | string; // ID de la fila 99.ABM_DetalleCircuito a quitar
}

const contacto = (e: EdificioAbmRow) => `${e.Encargado} - ${e.Celular || e.Correo}`.trim();

/** Construye los `fields` de una fila DetalleCircuito a partir de un edificio (copia contacto/geo). */
function detalleFields(nroCircuito: number, e: EdificioAbmRow) {
  return {
    Title: 'sumar',
    NroCircuito_DC: nroCircuito,
    CodigoEdificio_DC: e.Codigo,
    Edificio_DC: e.Edificio,
    Direccion_DC: e.Direccion,
    Horario_DC: e.Horario,
    Encargado_DC: e.Encargado,
    ConcatContacto_DC: contacto(e),
    NroCelular_DC: e.Celular,
    MailEdificio_DC: e.Correo,
    Latitud_DC: e.Latitud,
    Longitud_DC: e.Longitud,
    Observaciones_DC: e.Observaciones,
    Status_DC: 'Activo',
  };
}

/** Recalcula y persiste los contadores denormalizados de una ruta y de sus circuitos activos. */
async function recomputarContadores(nroRuta: number): Promise<void> {
  const [circRows, detRows, rutaRows] = await Promise.all([
    listItems(LIST_IDS.resumenCircuito, { select: resumenCircuitoSelectFields(), filter: `fields/Status_RC eq 'Activo'`, top: 999 }),
    listItems(LIST_IDS.detalleCircuito, { select: detalleCircuitoSelectFields(), filter: `fields/Status_DC eq 'Activo'`, top: 2000 }),
    listItems(LIST_IDS.rutas, { select: rutaSelectFields(), filter: `fields/Status_RT eq 'Activo'`, top: 999 }),
  ]);
  const circuitos = circRows.map(mapResumenCircuito);
  const detalles = detRows.map(mapDetalleCircuito);
  const circuitosDeRuta = circuitos.filter((c) => c.NroRuta === nroRuta);
  const edificiosDeRuta = detalles.filter((d) => circuitosDeRuta.some((c) => c.NroCircuito === d.NroCircuito)).length;

  const ruta = rutaRows.map(mapRuta).find((r) => r.NroRuta === nroRuta);
  if (ruta) {
    await updateItem(LIST_IDS.rutas, ruta.ID, {
      CantidadCircuitos_RT: circuitosDeRuta.length,
      CantEdificios_RT: edificiosDeRuta,
    });
  }
}

async function loadEdificiosById(ids: number[]): Promise<Map<number, EdificioAbmRow>> {
  const rows = (await listItems(LIST_IDS.edificios, { select: edificioAbmSelectFields(), filter: `fields/Status eq 'ALTA'`, top: 999 })).map(mapEdificioAbm);
  const wanted = new Set(ids);
  return new Map(rows.filter((e) => wanted.has(e.ID)).map((e) => [e.ID, e]));
}

/** Edificios (por código) que ya están en un circuito activo distinto de `exceptCircuito`. */
async function edificiosOcupados(exceptCircuito?: number): Promise<Set<string>> {
  const det = (await listItems(LIST_IDS.detalleCircuito, { select: detalleCircuitoSelectFields(), filter: `fields/Status_DC eq 'Activo'`, top: 2000 })).map(mapDetalleCircuito);
  const set = new Set<string>();
  for (const d of det) {
    if (exceptCircuito != null && d.NroCircuito === exceptCircuito) continue;
    if (d.CodigoEdificio) set.add(d.CodigoEdificio);
  }
  return set;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = readSession(req.headers.cookie);
  if (!session) return res.status(401).json({ error: 'no_session' });
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!canEditAbm(session.rol, 'Circuitos')) {
    return res.status(403).json({ error: 'forbidden', message: 'Tu rol no puede editar circuitos.' });
  }

  const body = (req.body ?? {}) as Body;
  try {
    if (body.action === 'create') return await create(body, res);
    if (body.action === 'delete') return await remove(body, res);
    if (body.action === 'add-edificio') return await addEdificio(body, res);
    if (body.action === 'remove-edificio') return await removeEdificio(body, res);
    if (body.action === 'update-obs') return await updateObs(body, res);
    return res.status(400).json({ error: 'invalid', message: 'Acción de circuito desconocida' });
  } catch (err) {
    console.error('abm/circuitos error', err);
    const status = err instanceof GraphError ? 502 : 500;
    return res.status(status).json({ error: 'server_error' });
  }
}

// ── Crear circuito (con sus edificios) ────────────────────────────────────
async function create(body: Body, res: VercelResponse) {
  const nroRuta = Number(body.nroRuta);
  const nroCircuito = Number(body.nroCircuito);
  const edificioIds = (body.edificioIds ?? []).map(Number).filter(Boolean);

  if (!nroRuta) return res.status(400).json({ error: 'invalid', message: 'Falta la ruta' });
  if (!body.nroCircuito || !Number.isInteger(nroCircuito) || nroCircuito <= 0) {
    return res.status(400).json({ error: 'invalid', message: 'El número de circuito tiene que ser un entero positivo' });
  }
  if (edificioIds.length === 0) {
    return res.status(400).json({ error: 'invalid', message: 'Agregá al menos un edificio al circuito' });
  }

  // Validación: número de circuito único (entre activos).
  const activos = (await listItems(LIST_IDS.resumenCircuito, { select: resumenCircuitoSelectFields(), filter: `fields/Status_RC eq 'Activo'`, top: 999 })).map(mapResumenCircuito);
  if (activos.some((c) => c.NroCircuito === nroCircuito)) {
    return res.status(409).json({ error: 'invalid', message: `Ya existe el circuito ${nroCircuito}` });
  }

  const edificios = await loadEdificiosById(edificioIds);
  const faltantes = edificioIds.filter((id) => !edificios.has(id));
  if (faltantes.length) return res.status(400).json({ error: 'invalid', message: 'Algún edificio no existe o está de baja' });

  // Validación: ningún edificio ya en otro circuito activo.
  const ocupados = await edificiosOcupados();
  const conflictos = [...edificios.values()].filter((e) => ocupados.has(e.Codigo));
  if (conflictos.length) {
    return res.status(409).json({
      error: 'invalid',
      message: `Estos edificios ya pertenecen a otro circuito: ${conflictos.map((e) => e.Edificio).join(', ')}`,
    });
  }

  // Crear resumen + detalle.
  await createItem(LIST_IDS.resumenCircuito, {
    Title: 'sumar',
    Status_RC: 'Activo',
    NroRuta_RC: nroRuta,
    NroCircuito_RC: nroCircuito,
    CantidadEdificio_RC: edificios.size,
    DetalleCircuito_RC: body.observaciones?.trim() ?? '',
  });
  for (const e of edificios.values()) {
    await createItem(LIST_IDS.detalleCircuito, detalleFields(nroCircuito, e));
  }
  await recomputarContadores(nroRuta);
  return res.status(201).json({ nroCircuito, edificios: edificios.size });
}

// ── Eliminar circuito (baja lógica de resumen + sus detalles) ─────────────
async function remove(body: Body, res: VercelResponse) {
  const nroCircuito = Number(body.nroCircuito);
  if (!nroCircuito) return res.status(400).json({ error: 'invalid', message: 'Falta el circuito' });

  const resumen = (await listItems(LIST_IDS.resumenCircuito, { select: resumenCircuitoSelectFields(), filter: `fields/Status_RC eq 'Activo'`, top: 999 })).map(mapResumenCircuito);
  const circuito = resumen.find((c) => c.NroCircuito === nroCircuito);
  if (!circuito) return res.status(404).json({ error: 'not_found', message: 'El circuito no existe o ya fue eliminado' });

  const detalles = (await listItems(LIST_IDS.detalleCircuito, { select: detalleCircuitoSelectFields(), filter: `fields/Status_DC eq 'Activo'`, top: 2000 })).map(mapDetalleCircuito);
  await updateItem(LIST_IDS.resumenCircuito, circuito.ID, { Status_RC: 'Eliminado' });
  for (const d of detalles.filter((x) => x.NroCircuito === nroCircuito)) {
    await updateItem(LIST_IDS.detalleCircuito, d.ID, { Status_DC: 'Eliminado' });
  }
  await recomputarContadores(circuito.NroRuta);
  await cascadeEliminarCircuito(nroCircuito, circuito.NroRuta);
  return res.status(200).json({ nroCircuito, deleted: true });
}

// ── Agregar un edificio a un circuito existente ───────────────────────────
async function addEdificio(body: Body, res: VercelResponse) {
  const nroCircuito = Number(body.nroCircuito);
  const edificioId = Number(body.edificioId);
  if (!nroCircuito || !edificioId) return res.status(400).json({ error: 'invalid', message: 'Faltan datos' });

  const resumen = (await listItems(LIST_IDS.resumenCircuito, { select: resumenCircuitoSelectFields(), filter: `fields/Status_RC eq 'Activo'`, top: 999 })).map(mapResumenCircuito);
  const circuito = resumen.find((c) => c.NroCircuito === nroCircuito);
  if (!circuito) return res.status(404).json({ error: 'not_found', message: 'El circuito no existe' });

  const edificios = await loadEdificiosById([edificioId]);
  const e = edificios.get(edificioId);
  if (!e) return res.status(400).json({ error: 'invalid', message: 'El edificio no existe o está de baja' });

  const ocupados = await edificiosOcupados(nroCircuito); // permite que ya esté en ESTE circuito (no debería)
  if (ocupados.has(e.Codigo)) {
    return res.status(409).json({ error: 'invalid', message: `${e.Edificio} ya pertenece a otro circuito` });
  }

  await createItem(LIST_IDS.detalleCircuito, detalleFields(nroCircuito, e));
  const nuevaCant = circuito.CantidadEdificios + 1;
  await updateItem(LIST_IDS.resumenCircuito, circuito.ID, { CantidadEdificio_RC: nuevaCant });
  await recomputarContadores(circuito.NroRuta);
  return res.status(201).json({ nroCircuito, edificio: e.Edificio });
}

// ── Quitar un edificio de un circuito (baja lógica del detalle) ───────────
async function removeEdificio(body: Body, res: VercelResponse) {
  const detalleId = Number(body.detalleId);
  if (!detalleId) return res.status(400).json({ error: 'invalid', message: 'Falta el detalle' });

  const detalles = (await listItems(LIST_IDS.detalleCircuito, { select: detalleCircuitoSelectFields(), filter: `fields/Status_DC eq 'Activo'`, top: 2000 })).map(mapDetalleCircuito);
  const det = detalles.find((d) => d.ID === detalleId);
  if (!det) return res.status(404).json({ error: 'not_found', message: 'El edificio no está en el circuito' });

  await updateItem(LIST_IDS.detalleCircuito, detalleId, { Status_DC: 'Eliminado' });

  const resumen = (await listItems(LIST_IDS.resumenCircuito, { select: resumenCircuitoSelectFields(), filter: `fields/Status_RC eq 'Activo'`, top: 999 })).map(mapResumenCircuito);
  const circuito = resumen.find((c) => c.NroCircuito === det.NroCircuito);
  if (circuito) {
    await updateItem(LIST_IDS.resumenCircuito, circuito.ID, { CantidadEdificio_RC: Math.max(0, circuito.CantidadEdificios - 1) });
    await recomputarContadores(circuito.NroRuta);
  }
  return res.status(200).json({ detalleId, removed: true });
}

// ── Editar observaciones del circuito ─────────────────────────────────────
async function updateObs(body: Body, res: VercelResponse) {
  const nroCircuito = Number(body.nroCircuito);
  if (!nroCircuito) return res.status(400).json({ error: 'invalid', message: 'Falta el circuito' });
  const resumen = (await listItems(LIST_IDS.resumenCircuito, { select: resumenCircuitoSelectFields(), filter: `fields/Status_RC eq 'Activo'`, top: 999 })).map(mapResumenCircuito);
  const circuito = resumen.find((c) => c.NroCircuito === nroCircuito);
  if (!circuito) return res.status(404).json({ error: 'not_found', message: 'El circuito no existe' });
  await updateItem(LIST_IDS.resumenCircuito, circuito.ID, { DetalleCircuito_RC: body.observaciones?.trim() ?? '' });
  return res.status(200).json({ nroCircuito, updated: true });
}
