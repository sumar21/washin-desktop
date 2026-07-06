import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listItems, getItem, createItem, updateItem, GraphError } from '../_lib/graph.js';
import {
  LIST_IDS,
  mapStock,
  stockSelectFields,
  STOCK_EDIT_ROLES,
  mapRepuestoTecnico,
  repuestoTecnicoSelectFields,
  buildConcatRT,
} from '../_lib/lists.js';
import { readSession } from '../_lib/session.js';

interface AssignBody {
  id?: number;
  tecnico?: string;
  cantidad?: number;
}

/** OData: escapar comillas simples en valores de string dentro de un $filter. */
function odataEscape(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Mueve cantidad de un repuesto del depósito (04.Stock) al stock personal de
 * un técnico (99.ABMRepuestos_Tecnico) — replica "Asignar a técnico" de la
 * PowerApp original (Screen_Stock, bt_guardarST), salvo que Concat_RT/Codigo_RT
 * se arman con los campos limpios de 04.Stock en vez de parsear un string
 * concatenado (esa fórmula rompe cuando el nombre no tiene " - ").
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const session = readSession(req.headers.cookie);
  if (!session) return res.status(401).json({ error: 'no_session' });
  if (!STOCK_EDIT_ROLES.has(session.rol)) {
    return res.status(403).json({ error: 'forbidden', message: 'No tenés permiso para asignar stock' });
  }

  const { id, tecnico, cantidad } = (req.body ?? {}) as AssignBody;
  if (!id || !tecnico?.trim() || !cantidad || cantidad <= 0) {
    return res.status(400).json({ error: 'invalid', message: 'Faltan datos: item, técnico o cantidad' });
  }

  try {
    const stockItem = await getItem(LIST_IDS.stock, id, stockSelectFields());
    if (!stockItem) return res.status(404).json({ error: 'not_found', message: 'El item de stock no existe' });

    const stockRow = mapStock(stockItem);
    if (stockRow.Tipo_ST !== 'REPUESTO') {
      return res.status(400).json({ error: 'invalid', message: 'Solo se pueden asignar repuestos a técnicos' });
    }
    if (cantidad > stockRow.Cantidad_ST) {
      return res.status(400).json({
        error: 'invalid',
        message: `No hay suficiente stock (disponible: ${stockRow.Cantidad_ST})`,
      });
    }

    const concatRT = buildConcatRT(stockRow);
    const tecnicoTrim = tecnico.trim();

    const existingRows = await listItems(LIST_IDS.repuestosTecnico, {
      select: repuestoTecnicoSelectFields(),
      filter: `fields/Tecnico_RT eq '${odataEscape(tecnicoTrim)}'`,
    });
    const existing = existingRows
      .map(mapRepuestoTecnico)
      .find((r) => r.Concat_RT.toLowerCase() === concatRT.toLowerCase());

    // Orden: primero se suma al técnico, después se descuenta del depósito —
    // si el segundo paso falla, el stock queda duplicado (recuperable a mano)
    // en vez de desaparecer. No hay transacciones entre listas de SharePoint.
    if (existing) {
      await updateItem(LIST_IDS.repuestosTecnico, existing.ID, {
        Cantidad_RT: String(existing.Cantidad_RT + cantidad),
      });
    } else {
      await createItem(LIST_IDS.repuestosTecnico, {
        Tecnico_RT: tecnicoTrim,
        Concat_RT: concatRT,
        Codigo_RT: stockRow.Nro_ST ?? '',
        Repuesto_RT: stockRow.Item_ST,
        Cantidad_RT: String(cantidad),
        Status_RT: 'Activo',
      });
    }

    const nuevaCantidad = stockRow.Cantidad_ST - cantidad;
    await updateItem(LIST_IDS.stock, id, { Cantidad_ST: String(nuevaCantidad) });

    return res.status(200).json({ ID: id, Cantidad_ST: nuevaCantidad });
  } catch (err) {
    console.error('stock assign error', err);
    const status = err instanceof GraphError ? 502 : 500;
    return res.status(status).json({ error: 'server_error' });
  }
}
