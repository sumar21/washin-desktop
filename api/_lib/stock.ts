import { createItem, updateItem } from './graph.js';
import { LIST_IDS } from './lists.js';

/**
 * Modelo de la máquina a partir del nombre del ítem: le saca el prefijo "{Segmento} - " y,
 * si viene, "{Marca} - ".
 *   "Lavadora - S.Queen - SWT111WN3028" (seg=Lavadora, marca=S.Queen) → "SWT111WN3028"
 *   "Lavadora - FWNE52SP303BW01"        (seg=Lavadora, marca=Huebsch) → "FWNE52SP303BW01"
 */
export function modeloDesdeItem(item: string, segmento: string, marca: string): string {
  let s = String(item ?? '').trim();
  for (const p of [segmento, marca]) {
    const pre = `${String(p ?? '').trim()} - `;
    if (pre.trim() !== '-' && s.toLowerCase().startsWith(pre.toLowerCase())) s = s.slice(pre.length).trim();
  }
  return s;
}

/**
 * Crea UNA fila en 08.DetalleMaquina (DEPOSITO) para una unidad de máquina seriada
 * (lavadora/secadora). Es un create + update en dos pasos: el update necesita el RowID como
 * fallback de serie/ID.
 *
 * FUENTE ÚNICA usada por la recepción de compra (api/compras/[id].ts) y el alta manual de stock
 * (api/stock/index.ts) — así ambos flujos escriben la máquina idéntico y no divergen (era el
 * riesgo #3/#9 del CLAUDE.md general). El depósito es el "edificio" Wash Inn / C-9999 (flujo D).
 */
export async function crearUnidadMaquinaDeposito(u: {
  segmento: string;
  item: string;
  marca: string;
  nroSerie: string;
  idMaquina: string;
  fecha: string; // dd/mm/yyyy
  mesAno: string; // mm/yyyy
}): Promise<void> {
  const marca = (u.marca ?? '').trim();
  const created = await createItem(LIST_IDS.detalleMaquina, {
    Title: 'Sumar',
    FechaIngreso_DM: u.fecha,
    FechaMesAnoIngreso_DM: u.mesAno,
    Status_DM: 'DEPOSITO',
    Segmentp_DM: u.segmento, // OJO: nombre interno real (typo en SharePoint) de Segmento_DM
    CodigoEdificio_DM: 'C-9999',
    Edificio_DM: 'Wash Inn',
    ConcatMaquina_DM: u.item,
    Marca_DM: marca,
    Modelo_DM: modeloDesdeItem(u.item, u.segmento, marca),
  });
  const rowId = Number(created.id);
  // Serie/ID propios de ESTA unidad; fallback al RowID (paridad con el receive y el msapp).
  const nroSerie = u.nroSerie.trim() || String(rowId);
  const idMaquina = u.idMaquina.trim() || String(rowId);
  await updateItem(LIST_IDS.detalleMaquina, rowId, {
    IDMaquina_DM: idMaquina,
    NroSerie_DM: nroSerie,
    // ConcatMaquina_DM NO se toca: quedó = item en el create, y ESA es la clave con la que 04.Stock
    // identifica el ítem (el match de stock es por Item_ST). ConcatMaquinaIncidente_DM identifica
    // la UNIDAD: "Segmento - Marca - Serie - ID".
    ConcatMaquinaIncidente_DM: [u.segmento, marca, nroSerie, idMaquina]
      .filter((p) => String(p).trim() !== '')
      .join(' - '),
  });
}
