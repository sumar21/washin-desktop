import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listItems, createItem, updateItem, GraphError } from '../_lib/graph.js';
import {
  LIST_IDS,
  mapVentilacion,
  ventilacionSelectFields,
  mapEdificioVent,
  edificioVentSelectFields,
  mapFrecuencias,
  mapGruposVent,
  desglosarFechaDDMMYYYY,
} from '../_lib/lists.js';
import { readSession } from '../_lib/session.js';
import { puedeAccederModulo } from '../_lib/permisos.js';

const ESTADOS_ABIERTOS_FILTER =
  `fields/Estado_VE eq 'Pendiente' or fields/Estado_VE eq 'Asignada' or fields/Estado_VE eq 'Programada'`;

interface AddEdificioBody {
  action?: 'add-edificio';
  idEdificio?: number | string;
  edificio?: string;
  direccion?: string;
  grupo?: string;
  frecuencia?: number | string; // días
  proximaLimpieza?: string; // dd/mm/yyyy
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = readSession(req.headers.cookie);
  if (!session) return res.status(401).json({ error: 'no_session' });

  // ── GET: bundle de ventilaciones (abiertas o de un mes) + catálogos ──────
  if (req.method === 'GET') {
    try {
      const mesRaw = req.query.mes;
      const mes = (Array.isArray(mesRaw) ? mesRaw[0] : mesRaw)?.trim();

      if (mes) {
        // Vista por mes: trae ese mes (todos los estados salvo Eliminada). Sin catálogos.
        const rows = await listItems(LIST_IDS.ventilaciones, {
          select: ventilacionSelectFields(),
          filter: `fields/FechaMesAnoProxima_VE eq '${mes.replace(/'/g, "''")}'`,
          top: 999,
        });
        const ventilaciones = rows.map(mapVentilacion).filter((v) => v.Estado_VE !== 'Eliminada');
        return res.status(200).json({ ventilaciones });
      }

      // Vista default: abiertas (Pendiente/Asignada/Programada) + catálogos para modales/filtros.
      const [ventRows, edifRows, frecRows, grupoRows] = await Promise.all([
        listItems(LIST_IDS.ventilaciones, { select: ventilacionSelectFields(), filter: ESTADOS_ABIERTOS_FILTER, top: 999 }),
        listItems(LIST_IDS.edificios, { select: edificioVentSelectFields(), filter: `fields/Status eq 'ALTA'`, top: 999 }),
        listItems(LIST_IDS.frecuencias, { top: 999 }),
        listItems(LIST_IDS.gruposVent, { top: 999 }),
      ]);

      const ventilaciones = ventRows.map(mapVentilacion);
      const edificios = edifRows
        .map(mapEdificioVent)
        .filter((e) => e.Edificio !== '')
        .sort((a, b) => a.Edificio.localeCompare(b.Edificio, 'es'));
      const frecuencias = mapFrecuencias(frecRows);
      const grupos = mapGruposVent(grupoRows);

      return res.status(200).json({ ventilaciones, edificios, frecuencias, grupos });
    } catch (err) {
      console.error('ventilaciones GET error', err);
      const status = err instanceof GraphError ? 502 : 500;
      return res.status(status).json({ error: 'server_error' });
    }
  }

  // ── POST: agregar edificio al circuito de ventilaciones ──────────────────
  if (req.method === 'POST') {
    const body = (req.body ?? {}) as AddEdificioBody;
    if (body.action !== 'add-edificio') {
      return res.status(400).json({ error: 'invalid', message: 'Acción de ventilación desconocida' });
    }
    const idEdificio = Number(body.idEdificio);
    const edificio = body.edificio?.trim();
    const grupo = body.grupo?.trim();
    const frecuencia = Number(body.frecuencia);
    const proxima = body.proximaLimpieza?.trim();
    if (!idEdificio || !edificio || !grupo || !frecuencia || !proxima) {
      return res.status(400).json({ error: 'invalid', message: 'Faltan datos del edificio, grupo, frecuencia o fecha' });
    }
    const { mesAno, ano } = desglosarFechaDDMMYYYY(proxima);

    try {
      if (!(await puedeAccederModulo(session.rol, 'Ventilacion'))) {
        return res.status(403).json({ error: 'forbidden', message: 'Tu rol no tiene habilitado el módulo Ventilacion.' });
      }
      // 1) Marca el edificio como parte del circuito (frecuencia + grupo + flag).
      await updateItem(LIST_IDS.edificios, idEdificio, {
        Frecuencia_ED: frecuencia,
        GrupoVentilacion_ED: grupo,
        Ventilaciones_ED: 'SI',
      });

      // 2) Crea la primera ventilación pendiente. IDEdificio_VE/Frecuencia_VE son NUMBER.
      const created = mapVentilacion(
        await createItem(LIST_IDS.ventilaciones, {
          Title: 'sumar',
          Estado_VE: 'Pendiente',
          Edificio_VE: edificio,
          DireccionEdificio_VE: body.direccion?.trim() ?? '',
          Frecuencia_VE: frecuencia,
          IDEdificio_VE: idEdificio,
          Grupo_VE: grupo,
          ProximaLimpieza_VE: proxima,
          FechaMesAnoProxima_VE: mesAno,
          FechaAnoProxima_VE: ano,
          EsIncidente_VE: 'NO',
          Orden_VE: '4',
        })
      );
      return res.status(201).json(created);
    } catch (err) {
      console.error('ventilaciones add-edificio error', err);
      const status = err instanceof GraphError ? 502 : 500;
      return res.status(status).json({ error: 'server_error' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method_not_allowed' });
}
