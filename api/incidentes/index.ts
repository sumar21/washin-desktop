import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listItems, createItem, GraphError } from '../_lib/graph.ts';
import {
  LIST_IDS,
  mapIncidente,
  incidenteSelectFields,
  mapRepuestoIncidente,
  repuestoIncidenteSelectFields,
  fechasHoy,
  APP_VERSION,
} from '../_lib/lists.ts';
import { readSession } from '../_lib/session.ts';

interface NewIncidentBody {
  edificio?: string;
  codigoEdificio?: string;
  maquinaConcat?: string; // ConcatMaquinaIncidente_DM
  idMaquina?: string;
  descripcion?: string;
  tecnico?: string; // Concat_Nombre_Apellido del técnico (o vacío)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = readSession(req.headers.cookie);
  if (!session) return res.status(401).json({ error: 'no_session' });

  // ── Listar incidentes sin resolver + sus repuestos ──────────────────────
  if (req.method === 'GET') {
    try {
      const [incRows, repRows] = await Promise.all([
        listItems(LIST_IDS.incidentes, { select: incidenteSelectFields(), filter: `fields/Resuelto_IN eq 'NO'`, top: 999 }),
        listItems(LIST_IDS.repuestosIncidentes, { select: repuestoIncidenteSelectFields(), top: 999 }),
      ]);
      const incidentes = incRows.map(mapIncidente).sort((a, b) => b.ID - a.ID);
      const repuestos = repRows.map(mapRepuestoIncidente);
      return res.status(200).json({ incidentes, repuestos });
    } catch (err) {
      console.error('incidentes GET error', err);
      const status = err instanceof GraphError ? 502 : 500;
      return res.status(status).json({ error: 'server_error' });
    }
  }

  // ── Nuevo incidente (Atención al Cliente → "A Revisar") ─────────────────
  if (req.method === 'POST') {
    const body = (req.body ?? {}) as NewIncidentBody;
    const edificio = body.edificio?.trim();
    const descripcion = body.descripcion?.trim();
    if (!edificio || !descripcion) {
      return res.status(400).json({ error: 'invalid', message: 'Falta el edificio o la descripción' });
    }
    const f = fechasHoy();
    const concatAux = `${session.usuario.slice(0, 3)} - ${f.stamp} - INC`;
    try {
      const created = mapIncidente(
        await createItem(LIST_IDS.incidentes, {
          Title: 'Wash Inn',
          IDMaquina_IN: body.idMaquina?.trim() ?? '',
          ConcatMaquina_IN: body.maquinaConcat?.trim() ?? '',
          Categoria_IN: 'Agua',
          NoResuelto_IN: 'Atencion al Cliente',
          DescripcionCarga_IN: descripcion,
          Status_IN: 'A Revisar',
          TecnicoAsignado_IN: body.tecnico?.trim() ?? '',
          Fecha_IN: f.fecha,
          FechaMesAno_IN: f.mesAno,
          FechaAno_IN: f.ano,
          Hora_IN: f.hora,
          Version_IN: APP_VERSION,
          User_IN: session.usuario,
          CodigoEdifcio_IN: body.codigoEdificio?.trim() ?? '',
          NombreEdificio_IN: edificio,
          Resuelto_IN: 'NO',
          ConcatAux_IN: concatAux,
        })
      );
      return res.status(201).json(created);
    } catch (err) {
      console.error('incidentes POST error', err);
      const status = err instanceof GraphError ? 502 : 500;
      return res.status(status).json({ error: 'server_error' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method_not_allowed' });
}
