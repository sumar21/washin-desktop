import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listItems, createItem, updateItem, GraphError } from '../_lib/graph.js';
import {
  LIST_IDS,
  mapRuta,
  rutaSelectFields,
  mapResumenCircuito,
  resumenCircuitoSelectFields,
  canEditAbm,
} from '../_lib/lists.js';
import { readSession } from '../_lib/session.js';
import { cascadeCircuitosDeRuta, cascadeEliminarCircuito } from '../_lib/cascadas.js';
import { recomputarContadoresRuta } from '../_lib/abmRutas.js';

interface Body {
  action?: 'create' | 'delete' | 'set-circuitos';
  nroRuta?: number | string;
  nroCircuitos?: (number | string)[]; // set FINAL de circuitos de la ruta (set-circuitos)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = readSession(req.headers.cookie);
  if (!session) return res.status(401).json({ error: 'no_session' });
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!canEditAbm(session.rol, 'Rutas')) {
    return res.status(403).json({ error: 'forbidden', message: 'Tu rol no puede editar rutas.' });
  }

  const body = (req.body ?? {}) as Body;
  try {
    if (body.action === 'create') return await create(body, res);
    if (body.action === 'delete') return await remove(body, res);
    if (body.action === 'set-circuitos') return await setCircuitos(body, res);
    return res.status(400).json({ error: 'invalid', message: 'Acción de ruta desconocida' });
  } catch (err) {
    console.error('abm/rutas error', err);
    const status = err instanceof GraphError ? 502 : 500;
    return res.status(status).json({ error: 'server_error' });
  }
}

// ── Crear ruta ────────────────────────────────────────────────────────────
async function create(body: Body, res: VercelResponse) {
  const nroRuta = Number(body.nroRuta);
  if (!body.nroRuta || !Number.isInteger(nroRuta) || nroRuta <= 0) {
    return res.status(400).json({ error: 'invalid', message: 'El número de ruta tiene que ser un entero positivo' });
  }
  const activas = (await listItems(LIST_IDS.rutas, { select: rutaSelectFields(), filter: `fields/Status_RT eq 'Activo'`, top: 999 })).map(mapRuta);
  if (activas.some((r) => r.NroRuta === nroRuta)) {
    return res.status(409).json({ error: 'invalid', message: `Ya existe la ruta ${nroRuta}` });
  }
  await createItem(LIST_IDS.rutas, {
    Title: 'sumar',
    Status_RT: 'Activo',
    NroRuta_RT: nroRuta,
    CantidadCircuitos_RT: 0,
    CantEdificios_RT: 0,
  });
  return res.status(201).json({ nroRuta });
}

// ── Agregar / quitar circuitos de una ruta existente ──────────────────────
/**
 * Port de bt_aceptar_ER (Screen_Configuracion.pa.yaml:1729-1832). Recibe el set FINAL
 * de circuitos de la ruta y hace el diff contra los que tiene hoy.
 *
 * REGLA DE PARIDAD — "un circuito pertenece a lo sumo a UNA ruta": los dos combos del
 * msapp que ofrecen circuitos para asignar filtran `NroRuta_RC = Blank()` (alta de ruta
 * :1462, edición de ruta :1903), o sea SOLO circuitos libres. Mover un circuito de una
 * ruta a otra es un ciclo de dos pasos —liberarlo desde su ruta actual (:1824 le escribe
 * Blank()) y adoptarlo desde la otra (:1936)—, nunca un robo en un paso. Acá se respeta:
 * pedir un circuito que pertenece a otra ruta devuelve 409 explicando cómo liberarlo.
 *
 * Quitar un circuito NO lo elimina: le pone `NroRuta_RC` en null y lo devuelve al pool
 * de libres con su `Status_RC` y sus `99.ABM_DetalleCircuito` intactos (:1824).
 * `NroRuta_RC` es columna NUMBER (api/_lib/lists.ts:1243-1244) → null, no ''.
 */
async function setCircuitos(body: Body, res: VercelResponse) {
  const nroRuta = Number(body.nroRuta);
  if (!nroRuta) return res.status(400).json({ error: 'invalid', message: 'Falta la ruta' });
  if (!Array.isArray(body.nroCircuitos)) {
    return res.status(400).json({ error: 'invalid', message: 'Falta la lista de circuitos' });
  }
  const pedidos = [...new Set(body.nroCircuitos.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  // Paridad con el DisplayMode de bt_aceptar_ER (:1721-1722): una ruta sin circuitos activos
  // no se puede guardar. Para vaciar una ruta se la elimina (y sus circuitos quedan libres).
  if (pedidos.length === 0) {
    return res.status(400).json({ error: 'invalid', message: 'La ruta tiene que quedar con al menos un circuito' });
  }

  const [rutaRows, circRows] = await Promise.all([
    listItems(LIST_IDS.rutas, { select: rutaSelectFields(), filter: `fields/Status_RT eq 'Activo'`, top: 999 }),
    listItems(LIST_IDS.resumenCircuito, { select: resumenCircuitoSelectFields(), filter: `fields/Status_RC eq 'Activo'`, top: 999 }),
  ]);
  const ruta = rutaRows.map(mapRuta).find((r) => r.NroRuta === nroRuta);
  if (!ruta) return res.status(404).json({ error: 'not_found', message: 'La ruta no existe o ya fue eliminada' });

  const circuitos = circRows.map(mapResumenCircuito);
  const porNro = new Map(circuitos.map((c) => [c.NroCircuito, c]));

  const inexistentes = pedidos.filter((n) => !porNro.has(n));
  if (inexistentes.length) {
    return res.status(400).json({ error: 'invalid', message: `No existe(n) el/los circuito(s) ${inexistentes.join(', ')}` });
  }

  // Guarda de paridad: no se puede robar un circuito que ya pertenece a otra ruta.
  const ajeno = pedidos.map((n) => porNro.get(n)!).find((c) => c.NroRuta && c.NroRuta !== nroRuta);
  if (ajeno) {
    return res.status(409).json({
      error: 'invalid',
      message: `El circuito ${ajeno.NroCircuito} ya pertenece a la Ruta ${ajeno.NroRuta}. Quitalo de esa ruta primero para dejarlo libre y después agregalo acá.`,
    });
  }

  const actuales = circuitos.filter((c) => c.NroRuta === nroRuta).map((c) => c.NroCircuito);
  const agregados = pedidos.filter((n) => !actuales.includes(n));
  const quitados = actuales.filter((n) => !pedidos.includes(n));
  if (agregados.length === 0 && quitados.length === 0) {
    return res.status(200).json({ nroRuta, agregados, quitados, sinCambios: true });
  }

  // Enganchar / liberar. Status_RC nunca se toca: liberar NO es eliminar.
  for (const n of agregados) await updateItem(LIST_IDS.resumenCircuito, porNro.get(n)!.ID, { NroRuta_RC: nroRuta });
  for (const n of quitados) await updateItem(LIST_IDS.resumenCircuito, porNro.get(n)!.ID, { NroRuta_RC: null });

  // Propagación a las planificaciones vivas (16/18/15) + contadores de la ruta.
  const cascada = await cascadeCircuitosDeRuta(nroRuta, quitados, agregados, pedidos.length);
  await recomputarContadoresRuta(nroRuta);

  return res.status(200).json({ nroRuta, agregados, quitados, ...cascada });
}

// ── Eliminar ruta (sus circuitos quedan LIBRES, no se eliminan) ───────────
/**
 * Fiel al msapp (Screen_Configuracion.pa.yaml:2907-2912): la ruta pasa a 'Eliminada' y
 * sus circuitos activos vuelven al pool de libres con `NroRuta_RC: Blank()`. NO se
 * escribe nada sobre `99.ABM_ResumenCircuito.Status_RC` ni sobre
 * `99.ABM_DetalleCircuito`: el port anterior los daba de baja en cascada, lo que
 * destruía circuitos y sus edificios (trabajo irrecuperable desde la app, porque todas
 * las queries filtran Status Activo) sin equivalente en el msapp.
 *
 * ANTES de soltar cada circuito se anula su planificación VIVA (15/16/18 del mes actual
 * y el siguiente) con la misma `cascadeEliminarCircuito` que usa la baja de UN circuito
 * (api/abm/circuitos.ts:158). Es obligatorio desde que liberar reemplazó a dar de baja:
 *   · mientras los circuitos quedaban `Status_RC='Eliminado'` desaparecían para siempre
 *     del pool (todas las queries filtran Activo), así que su 16/18 huérfano era
 *     inalcanzable;
 *   · ahora vuelven al pool, `set-circuitos` los adopta en otra ruta y
 *     `cascadeCircuitosDeRuta` les crea un 16 + N filas de 18 NUEVOS encima de los
 *     viejos, que siguen 'Pendiente' a nombre del técnico de la ruta borrada (el guard
 *     `yaEnPlan` es por `IDUnivoco_DP` de la planificación destino, no ve los de la
 *     ruta vieja). La mobile lee 16/18 sin chequear que la ruta exista → el técnico ve
 *     el circuito duplicado y cada edificio dos veces en sus visitas del mes.
 * De paso cierra el agujero previo al lápiz: borrar una ruta dejaba su plan vivo en la
 * mobile aunque la ruta ya no existiera.
 *
 * No es verificable contra el msapp (binario, ver CLAUDE.md raíz): es un desvío
 * declarado, del mismo tipo que el resto de las cascadas de este archivo, y deja la baja
 * de ruta consistente con la baja de circuito en vez de dejar planificación colgada.
 */
async function remove(body: Body, res: VercelResponse) {
  const nroRuta = Number(body.nroRuta);
  if (!nroRuta) return res.status(400).json({ error: 'invalid', message: 'Falta la ruta' });

  const [rutaRows, circRows] = await Promise.all([
    listItems(LIST_IDS.rutas, { select: rutaSelectFields(), filter: `fields/Status_RT eq 'Activo'`, top: 999 }),
    listItems(LIST_IDS.resumenCircuito, { select: resumenCircuitoSelectFields(), filter: `fields/Status_RC eq 'Activo'`, top: 999 }),
  ]);
  const ruta = rutaRows.map(mapRuta).find((r) => r.NroRuta === nroRuta);
  if (!ruta) return res.status(404).json({ error: 'not_found', message: 'La ruta no existe o ya fue eliminada' });

  const circuitos = circRows.map(mapResumenCircuito).filter((c) => c.NroRuta === nroRuta);
  let detalleAnulados = 0;
  let edificiosAnulados = 0;
  for (const c of circuitos) {
    // Cascada PRIMERO y liberación después: si Graph falla a mitad, el circuito sigue
    // colgado de la ruta y el reintento lo vuelve a barrer (nunca queda libre con plan vivo).
    const r = await cascadeEliminarCircuito(c.NroCircuito, nroRuta);
    detalleAnulados += r.detalleAnulados;
    edificiosAnulados += r.edificiosAnulados;
    await updateItem(LIST_IDS.resumenCircuito, c.ID, { NroRuta_RC: null });
  }
  await updateItem(LIST_IDS.rutas, ruta.ID, { Status_RT: 'Eliminada' });

  return res.status(200).json({
    nroRuta,
    circuitosLiberados: circuitos.length,
    detalleAnulados,
    edificiosAnulados,
  });
}
