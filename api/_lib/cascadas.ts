import { listItems, updateItem } from './graph.js';
import {
  LIST_IDS,
  ventanaMesActualYSiguiente,
  mapResumenPlanif,
  resumenPlanifSelectFields,
  mapDetallePlanif,
  detallePlanifSelectFields,
  mapEdificioVisitar,
  edificioVisitarSelectFields,
  mapDetalleCircuito,
  detalleCircuitoSelectFields,
  mapResumenCircuito,
  resumenCircuitoSelectFields,
  mapRuta,
  rutaSelectFields,
  mapVentilacion,
  ventilacionSelectFields,
  type EdificioAbmRow,
} from './lists.js';

/**
 * Cascadas ABM → planificaciones. Re-propagan a las listas 15/16/18/19 los
 * cambios de ABM (eliminar circuito, baja edificio, editar edificio) que el
 * PowerApp original hace en línea (Screen_Configuracion.pa.yaml:1279-1298 /
 * 2716-2741 / 2319). Sin borrado físico: todo Status→Anulado/Inactivo +
 * decrementos. Cada updateItem corre en serie (await) para no ráfagar Graph.
 */

const odataEscape = (v: string) => v.replace(/'/g, "''");

/** Decremento con clamp ≥0 (deviación segura vs msapp, que no clampa). */
const dec = (n: number) => Math.max(0, n - 1);

/** Suma `days` a una fecha 'dd/mm/yyyy'. Devuelve null si no parsea (FechaUltima vacía). */
export function addDaysDDMMYYYY(
  ddmmyyyy: string,
  days: number
): { fecha: string; ano: string; mesAno: string } | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(ddmmyyyy.trim());
  if (!m || !Number.isFinite(days)) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(Date.UTC(+yyyy, +mm - 1, +dd)); // UTC → sin drift de zona
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + days);
  const D = String(d.getUTCDate()).padStart(2, '0');
  const M = String(d.getUTCMonth() + 1).padStart(2, '0');
  const Y = String(d.getUTCFullYear());
  return { fecha: `${D}/${M}/${Y}`, ano: Y, mesAno: `${M}/${Y}` };
}

// ── Cascada 1 — Eliminar circuito (Screen_Configuracion.pa.yaml:1279-1298) ──
export async function cascadeEliminarCircuito(
  nroCircuito: number,
  nroRuta: number,
  now?: Date
): Promise<{ resumenTocados: number; detalleAnulados: number; edificiosAnulados: number }> {
  const [m0, m1] = ventanaMesActualYSiguiente(now);
  const W = [m0, m1];

  // 15.ResumenPlanificaciones: Circuitos_RP - 1 en la ventana de meses.
  const resumenRows = (
    await listItems(LIST_IDS.resumenPlanif, {
      select: resumenPlanifSelectFields(),
      filter: `fields/NroRuta_RP eq '${nroRuta}'`,
      top: 999,
    })
  )
    .map(mapResumenPlanif)
    .filter((r) => W.includes(r.MesAno));
  for (const r of resumenRows) {
    await updateItem(LIST_IDS.resumenPlanif, r.ID, { Circuitos_RP: dec(r.Circuitos) });
  }

  // 16.DetallePlanificaciones: Status_DP → Anulado.
  const detalleRows = (
    await listItems(LIST_IDS.detallePlanif, {
      select: detallePlanifSelectFields(),
      filter: `fields/NroCircuito_DP eq ${nroCircuito}`,
      top: 2000,
    })
  )
    .map(mapDetallePlanif)
    .filter((d) => W.includes(d.MesAno) && (d.Status === 'Pendiente' || d.Status === 'En Proceso'));
  for (const d of detalleRows) {
    await updateItem(LIST_IDS.detallePlanif, d.ID, { Status_DP: 'Anulado' });
  }

  // 18.EdificiosVisitar: Estado_EV → Anulado.
  const edificioRows = (
    await listItems(LIST_IDS.edificiosVisitar, {
      select: edificioVisitarSelectFields(),
      filter: `fields/NroCircuito_EV eq '${nroCircuito}'`,
      top: 4000,
    })
  )
    .map(mapEdificioVisitar)
    .filter((e) => W.includes(e.MesAno) && e.Estado === 'Pendiente');
  for (const e of edificioRows) {
    await updateItem(LIST_IDS.edificiosVisitar, e.ID, { Estado_EV: 'Anulado' });
  }

  return {
    resumenTocados: resumenRows.length,
    detalleAnulados: detalleRows.length,
    edificiosAnulados: edificioRows.length,
  };
}

// ── Cascada 2 — Baja edificio (Screen_Configuracion.pa.yaml:2716-2741) ──
export async function cascadeBajaEdificio(codigoEdificio: string): Promise<{
  detalleInactivados: number;
  resumenDecrementados: number;
  rutasDecrementadas: number;
  detallePlanifDecrementados: number;
  edificiosVisitarAnulados: number;
}> {
  const codigo = codigoEdificio.trim();
  if (!codigo) {
    return {
      detalleInactivados: 0,
      resumenDecrementados: 0,
      rutasDecrementadas: 0,
      detallePlanifDecrementados: 0,
      edificiosVisitarAnulados: 0,
    };
  }

  // 1) 99.ABM_DetalleCircuito activo del edificio → Inactivo. Set de circuitos afectados.
  const detalleRows = (
    await listItems(LIST_IDS.detalleCircuito, {
      select: detalleCircuitoSelectFields(),
      filter: `fields/CodigoEdificio_DC eq '${odataEscape(codigo)}' and fields/Status_DC eq 'Activo'`,
      top: 2000,
    })
  ).map(mapDetalleCircuito);
  for (const d of detalleRows) {
    await updateItem(LIST_IDS.detalleCircuito, d.ID, { Status_DC: 'Inactivo' });
  }
  const C = new Set(detalleRows.map((d) => d.NroCircuito));

  // 2) 99.ABM_ResumenCircuito de esos circuitos → CantidadEdificio_RC - 1. Set de rutas.
  const resumenRows = (
    await listItems(LIST_IDS.resumenCircuito, {
      select: resumenCircuitoSelectFields(),
      filter: `fields/Status_RC eq 'Activo'`,
      top: 999,
    })
  )
    .map(mapResumenCircuito)
    .filter((r) => C.has(r.NroCircuito));
  for (const r of resumenRows) {
    await updateItem(LIST_IDS.resumenCircuito, r.ID, { CantidadEdificio_RC: dec(r.CantidadEdificios) });
  }
  const R = new Set(resumenRows.map((r) => r.NroRuta));
  const C2 = new Set(resumenRows.map((r) => r.NroCircuito));

  // 3) 99.ABM_Rutas de esas rutas → CantEdificios_RT - 1.
  const rutaRows = (
    await listItems(LIST_IDS.rutas, {
      select: rutaSelectFields(),
      filter: `fields/Status_RT eq 'Activo'`,
      top: 999,
    })
  )
    .map(mapRuta)
    .filter((rt) => R.has(rt.NroRuta));
  for (const rt of rutaRows) {
    await updateItem(LIST_IDS.rutas, rt.ID, { CantEdificios_RT: dec(rt.CantidadEdificios) });
  }

  // 4) 16.DetallePlanificaciones pendientes/en proceso de esos circuitos → CantidadEdificios_DP - 1.
  const detallePlanifRows = (
    await listItems(LIST_IDS.detallePlanif, {
      select: detallePlanifSelectFields(),
      filter: `fields/Status_DP eq 'Pendiente' or fields/Status_DP eq 'En Proceso'`,
      top: 2000,
    })
  )
    .map(mapDetallePlanif)
    .filter((d) => C2.has(d.NroCircuito));
  for (const d of detallePlanifRows) {
    await updateItem(LIST_IDS.detallePlanif, d.ID, { CantidadEdificios_DP: dec(d.CantidadEdificios) });
  }

  // 5) 18.EdificiosVisitar pendientes del edificio → Estado_EV Anulado.
  const edificioVisitarRows = (
    await listItems(LIST_IDS.edificiosVisitar, {
      select: edificioVisitarSelectFields(),
      filter: `fields/CodigoEdificio_EV eq '${odataEscape(codigo)}' and fields/Estado_EV eq 'Pendiente'`,
      top: 4000,
    })
  ).map(mapEdificioVisitar);
  for (const e of edificioVisitarRows) {
    await updateItem(LIST_IDS.edificiosVisitar, e.ID, { Estado_EV: 'Anulado' });
  }

  return {
    detalleInactivados: detalleRows.length,
    resumenDecrementados: resumenRows.length,
    rutasDecrementadas: rutaRows.length,
    detallePlanifDecrementados: detallePlanifRows.length,
    edificiosVisitarAnulados: edificioVisitarRows.length,
  };
}

// ── Cascada 3 — Editar edificio (Screen_Configuracion.pa.yaml:2319) ──
export async function cascadeUpdateEdificio(
  prev: EdificioAbmRow,
  updated: EdificioAbmRow
): Promise<{ detalleActualizados: number; edificiosVisitarActualizados: number; ventilacionesActualizadas: number }> {
  const codigo = prev.Codigo.trim();
  const contacto = `${updated.Encargado} - ${updated.Celular || updated.Correo}`;
  const dir = updated.Direccion.toUpperCase();

  let detalleActualizados = 0;
  let edificiosVisitarActualizados = 0;

  if (codigo) {
    // 1) 99.ABM_DetalleCircuito activos del edificio → re-patch de datos.
    const detalleRows = (
      await listItems(LIST_IDS.detalleCircuito, {
        select: detalleCircuitoSelectFields(),
        filter: `fields/CodigoEdificio_DC eq '${odataEscape(codigo)}' and fields/Status_DC eq 'Activo'`,
        top: 2000,
      })
    ).map(mapDetalleCircuito);
    for (const d of detalleRows) {
      await updateItem(LIST_IDS.detalleCircuito, d.ID, {
        Edificio_DC: updated.Edificio,
        Direccion_DC: dir,
        CodigoEdificio_DC: updated.Codigo,
        Latitud_DC: updated.Latitud,
        Longitud_DC: updated.Longitud,
        Latitud2_DC: updated.Latitud,
        Longitud2_DC: updated.Longitud,
        MailEdificio_DC: updated.Correo,
        Encargado_DC: updated.Encargado,
        NroCelular_DC: updated.Celular,
        ConcatContacto_DC: contacto,
        Horario_DC: updated.Horario,
      });
    }
    detalleActualizados = detalleRows.length;

    // 2) 18.EdificiosVisitar pendientes del edificio → re-patch de datos.
    const edificioVisitarRows = (
      await listItems(LIST_IDS.edificiosVisitar, {
        select: edificioVisitarSelectFields(),
        filter: `fields/CodigoEdificio_EV eq '${odataEscape(codigo)}' and fields/Estado_EV eq 'Pendiente'`,
        top: 4000,
      })
    ).map(mapEdificioVisitar);
    for (const e of edificioVisitarRows) {
      await updateItem(LIST_IDS.edificiosVisitar, e.ID, {
        Edificio_EV: updated.Edificio,
        Direccion_EV: dir,
        CodigoEdificio_EV: updated.Codigo,
        Latitud_EV: updated.Latitud,
        Longitud_EV: updated.Longitud,
        Latitud2_EV: updated.Latitud,
        Longitud2_EV: updated.Longitud,
        Mail_EV: updated.Correo,
        Encargado_EV: updated.Encargado,
        Celular_EV: updated.Celular,
        HoraSugerida_EV: updated.Horario,
      });
    }
    edificiosVisitarActualizados = edificioVisitarRows.length;
  }

  // 3) 19.Ventilaciones pendientes del edificio → sólo si cambió Frecuencia o Grupo.
  let ventilacionesActualizadas = 0;
  if (updated.Frecuencia !== prev.Frecuencia || updated.Grupo !== prev.Grupo) {
    const ventilacionRows = (
      await listItems(LIST_IDS.ventilaciones, {
        select: ventilacionSelectFields(),
        filter: `fields/IDEdificio_VE eq ${prev.ID} and fields/Estado_VE eq 'Pendiente'`,
        top: 999,
      })
    ).map(mapVentilacion);
    for (const v of ventilacionRows) {
      const fields: Record<string, unknown> = {
        Frecuencia_VE: Number(updated.Frecuencia) || 0,
        Grupo_VE: updated.Grupo,
      };
      const nx = addDaysDDMMYYYY(v.FechaUltima_VE, Number(updated.Frecuencia));
      if (nx) {
        fields.ProximaLimpieza_VE = nx.fecha;
        fields.FechaAnoProxima_VE = nx.ano;
        fields.FechaMesAnoProxima_VE = nx.mesAno;
      }
      await updateItem(LIST_IDS.ventilaciones, v.ID, fields);
    }
    ventilacionesActualizadas = ventilacionRows.length;
  }

  return { detalleActualizados, edificiosVisitarActualizados, ventilacionesActualizadas };
}
