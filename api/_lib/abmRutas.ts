import { listItems, updateItem } from './graph.js';
import {
  LIST_IDS,
  mapResumenCircuito,
  resumenCircuitoSelectFields,
  mapDetalleCircuito,
  detalleCircuitoSelectFields,
  mapRuta,
  rutaSelectFields,
} from './lists.js';

/**
 * Contadores denormalizados de 99.ABM_Rutas (CantidadCircuitos_RT / CantEdificios_RT).
 *
 * Vive acá y no en cada endpoint porque lo tocan DOS ABMs: el de circuitos (alta/baja
 * de circuito y de edificios dentro de un circuito) y el de rutas (agregar/quitar
 * circuitos de una ruta existente). Equivale al `Patch('99.ABM_Rutas', …,
 * {CantEdificios_RT, CantidadCircuitos_RT})` de bt_aceptar_ER
 * (Screen_Configuracion.pa.yaml:1828-1832), que en el msapp está escrito en línea
 * en cada botón.
 *
 * Se recalcula desde las listas (no se incrementa/decrementa): re-guardar una ruta
 * ya desincronizada la repara.
 */
export async function recomputarContadoresRuta(nroRuta: number): Promise<void> {
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
