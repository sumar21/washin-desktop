import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listItems, createItem, updateItem, GraphError } from '../_lib/graph.js';
import {
  LIST_IDS,
  mapStock,
  stockSelectFields,
  STOCK_EDIT_ROLES,
  isMachineSegment,
  fechasHoy,
  APP_VERSION,
} from '../_lib/lists.js';
import { crearUnidadMaquinaDeposito } from '../_lib/stock.js';
import { readSession } from '../_lib/session.js';

interface AddStockUnidad {
  nroSerie?: string;
  idMaquina?: string;
}
interface AddStockBody {
  tipo?: string;
  item?: string;
  marca?: string;
  codigo?: string;
  cantidad?: number;
  // Máquinas seriadas (lavadora/secadora): una serie + ID por CADA unidad.
  unidades?: AddStockUnidad[];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = readSession(req.headers.cookie);
  if (!session) return res.status(401).json({ error: 'no_session' });

  if (req.method === 'GET') {
    try {
      const rows = await listItems(LIST_IDS.stock, {
        select: stockSelectFields(),
        filter: `fields/Status_ST eq 'Activo'`,
      });
      return res.status(200).json(rows.map(mapStock));
    } catch (err) {
      console.error('stock GET error', err);
      const status = err instanceof GraphError ? 502 : 500;
      return res.status(status).json({ error: 'server_error' });
    }
  }

  if (req.method === 'POST') {
    if (!STOCK_EDIT_ROLES.has(session.rol)) {
      return res.status(403).json({ error: 'forbidden', message: 'No tenés permiso para agregar stock' });
    }

    const body = (req.body ?? {}) as AddStockBody;
    const tipo = body.tipo?.trim();
    const item = body.item?.trim();
    const cantidad = body.cantidad;
    if (!tipo || !item || !cantidad || cantidad <= 0) {
      return res.status(400).json({ error: 'invalid', message: 'Faltan datos del item o la cantidad' });
    }

    // Máquinas SERIADAS (lavadora/secadora): serie + ID por CADA unidad, y una fila por unidad en
    // 08.DetalleMaquina. Cargadora/expendedora/encendedora NO son seriadas (isMachineSegment=false):
    // van como cantidad simple en 04.Stock con item = nombre del segmento (paridad con el msapp).
    const esMaquina = isMachineSegment(tipo);
    const unidades = body.unidades ?? [];
    if (esMaquina) {
      if (
        unidades.length !== cantidad ||
        unidades.some((u) => !u?.nroSerie?.trim() || !u?.idMaquina?.trim())
      ) {
        return res.status(400).json({
          error: 'invalid',
          message: `Cargá Nº de serie e ID de máquina para cada una de las ${cantidad} unidades.`,
        });
      }
    }

    // 04.Stock guarda Tipo_ST en MAYÚSCULAS (LAVADORA/REPUESTO), pero el catálogo real
    // trae segmentos en Title Case (Lavadora/Repuesto) — normalizamos al escribir/matchear.
    const tipoUpper = tipo.toUpperCase();
    const f = fechasHoy();
    try {
      // Ingreso a 04.Stock (igual para repuesto, segmentos simples y máquinas seriadas):
      // OJO: `Tipo_ST` NO está indexada en SharePoint → un $filter con `and Tipo_ST eq …`
      // hace que Graph devuelva 400 (rompía el alta con 502). Filtramos SOLO por
      // `Status_ST eq 'Activo'` (indexada) y matcheamos el tipo + item en memoria.
      const existingRows = await listItems(LIST_IDS.stock, {
        select: stockSelectFields(),
        filter: `fields/Status_ST eq 'Activo'`,
      });
      const existing = existingRows
        .map(mapStock)
        .find(
          (r) => r.Tipo_ST === tipoUpper && r.Item_ST.trim().toLowerCase() === item.toLowerCase()
        );

      let stockResult: ReturnType<typeof mapStock>;
      if (existing) {
        const nuevaCantidad = existing.Cantidad_ST + cantidad;
        await updateItem(LIST_IDS.stock, existing.ID, { Cantidad_ST: String(nuevaCantidad) });
        stockResult = { ...existing, Cantidad_ST: nuevaCantidad };
      } else {
        const created = mapStock(
          await createItem(LIST_IDS.stock, {
            Title: 'Washinn',
            Status_ST: 'Activo',
            Tipo_ST: tipoUpper,
            Cantidad_ST: String(cantidad),
            Lodge_ST: item,
            Marca_ST: body.marca ?? '',
            Nro_ST: body.codigo ?? '',
            FechaUltMod_ST: f.fecha,
            FechaMesUltMod_ST: f.mesAno,
            UserMod_ST: session.usuario,
            VersionMod_ST: APP_VERSION,
            ModuloAgregado_ST: 'Stock',
            ConcatStock_ST: `${tipo} - ${item}`,
          })
        );
        stockResult = created;
      }

      // Máquinas seriadas: una fila por unidad en 08.DetalleMaquina (mismo helper que el receive).
      if (esMaquina) {
        for (const u of unidades) {
          await crearUnidadMaquinaDeposito({
            segmento: tipo,
            item,
            marca: body.marca ?? '',
            nroSerie: u.nroSerie ?? '',
            idMaquina: u.idMaquina ?? '',
            fecha: f.fecha,
            mesAno: f.mesAno,
          });
        }
      }

      return res.status(existing ? 200 : 201).json(stockResult);
    } catch (err) {
      console.error('stock POST error', err);
      const status = err instanceof GraphError ? 502 : 500;
      return res.status(status).json({ error: 'server_error' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method_not_allowed' });
}
