import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listItems, listItemsPorValores, createItem, GraphError } from '../_lib/graph.js';
import {
  LIST_IDS,
  mapIncidente,
  incidenteSelectFields,
  mapRepuestoIncidente,
  repuestoIncidenteSelectFields,
  fechasHoy,
  APP_VERSION,
} from '../_lib/lists.js';
import { readSession } from '../_lib/session.js';
import { puedeAccederModulo } from '../_lib/permisos.js';

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
    // Por defecto: incidentes SIN resolver (Resuelto_IN='NO'). Con `?resueltos=MM/YYYY`:
    // los RESUELTOS de ese mes (acotado por mes para no traer miles). Antes no había forma
    // de ver los resueltos desde el desktop.
    const resParam = typeof req.query.resueltos === 'string' ? req.query.resueltos : undefined;
    const resueltosMes = resParam && /^\d{2}\/\d{4}$/.test(resParam) ? resParam : null;
    const incFilter = resueltosMes ? `fields/FechaMesAno_IN eq '${resueltosMes}'` : `fields/Resuelto_IN eq 'NO'`;
    // Repuestos (13.RepuestosIncidentes): SÓLO los de los incidentes abiertos no anulados, por el
    // join real (IDIncidente, indexada). La grilla los necesita por fila para elegir entre
    // "Asignar técnico" y "Sin stock → Generar compra". Antes se bajaba la lista ENTERA
    // (3.598 filas, ~4 s, medido 10/2026) en cada request para usar ~17.
    // Los de un RESUELTO o anulado no van acá: el detalle los pide al abrirse
    // (GET /api/incidentes/:id?repuestos=1), igual que las fotos.
    // `?repuestos=0`: el Home y el Dashboard General no los usan.
    const conRepuestos = !resueltosMes && req.query.repuestos !== '0';
    try {
      const incRows = await listItems(LIST_IDS.incidentes, { select: incidenteSelectFields(), filter: incFilter, top: 999 });
      let incidentes = incRows.map(mapIncidente);
      // Filtro compuesto (mes + resuelto) en memoria: SharePoint rechaza `and` sobre columnas no indexadas.
      if (resueltosMes) incidentes = incidentes.filter((i) => i.Resuelto_IN === 'SI');
      incidentes.sort((a, b) => b.ID - a.ID);
      const repuestos = conRepuestos
        ? (
            await listItemsPorValores(LIST_IDS.repuestosIncidentes, {
              select: repuestoIncidenteSelectFields(),
              // display IDIncidente_RI → interno IDIncidente_IN.
              campo: 'IDIncidente_IN',
              valores: incidentes.filter((i) => i.Status_IN !== 'Anulado').map((i) => i.IDIncidente),
            })
          ).map(mapRepuestoIncidente)
        : [];
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
      if (!(await puedeAccederModulo(session.rol, 'Incidentes'))) {
        return res.status(403).json({ error: 'forbidden', message: 'Tu rol no tiene habilitado el módulo Incidentes.' });
      }
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
