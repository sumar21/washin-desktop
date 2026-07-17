import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listItems, getItem, updateItem, GraphError } from './_lib/graph.js';
import {
  LIST_IDS,
  mapRegistro,
  registrosSelectFields,
  mapDetalleCompra,
  detalleCompraSelectFields,
  mapDescanso,
  descansoSelectFields,
  fechasHoy,
} from './_lib/lists.js';
import { readSession } from './_lib/session.js';

function currentMesAno(): string {
  return fechasHoy().mesAno; // mm/yyyy en hora de Argentina (ver fechasHoy)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = readSession(req.headers.cookie);
  if (!session) {
    return res.status(401).json({ error: 'no_session' });
  }

  // Baja lógica de una visita: Estado -> "Anulado" (PowerApp: bt_cerrarPopUpFCE_5).
  if (req.method === 'POST') {
    return anularRegistro(req, res, session.rol);
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const mesAno = currentMesAno();
  const hoy = fechasHoy().fecha; // dd/mm/yyyy en hora de Argentina

  try {
    const [registrosRows, comprasRows, descansosRows] = await Promise.all([
      // PowerApp (Screen_Home, CollectResumen): el resumen del mes excluye los
      // registros "Anulado" — Filter('01.Registros', MesAño = ... And (Estado =
      // "Pendiente" Or Estado = "Finalizado")).
      listItems(LIST_IDS.registros, {
        select: registrosSelectFields(),
        filter: `fields/MesA_x00f1_o eq '${mesAno}' and (fields/Estado eq 'Pendiente' or fields/Estado eq 'Finalizado')`,
      }),
      listItems(LIST_IDS.detalleCompra, {
        select: detalleCompraSelectFields(),
        filter: `fields/FechaMesAno_DC eq '${mesAno}'`,
      }),
      // Descansos de HOY (Fecha_HD no está indexada → listItems agrega el header Prefer).
      listItems(LIST_IDS.horasDescanso, {
        select: descansoSelectFields(),
        filter: `fields/Fecha_HD eq '${hoy}'`,
      }),
    ]);

    return res.status(200).json({
      visitas: registrosRows.map(mapRegistro),
      comprasDelMes: comprasRows.map(mapDetalleCompra),
      descansosHoy: descansosRows.map(mapDescanso),
    });
  } catch (err) {
    console.error('home error', err);
    const status = err instanceof GraphError ? 502 : 500;
    return res.status(status).json({ error: 'server_error' });
  }
}

// PowerApp (Screen_Home): la baja sólo es visible/ejecutable para Admin y sobre
// visitas en estado "Pendiente" (Visible: VarTipoUser = "Admin" And Estado = "Pendiente").
async function anularRegistro(req: VercelRequest, res: VercelResponse, rol: string | undefined) {
  if (rol !== 'Admin') {
    return res.status(403).json({ error: 'forbidden', message: 'Sólo un Admin puede anular visitas.' });
  }

  const id = Number((req.body as { id?: number | string } | undefined)?.id);
  if (!id) return res.status(400).json({ error: 'invalid_id' });

  try {
    const current = await getItem(LIST_IDS.registros, id, registrosSelectFields());
    if (!current) return res.status(404).json({ error: 'not_found', message: 'La visita no existe.' });
    const reg = mapRegistro(current);
    if (reg.Estado !== 'Pendiente') {
      return res.status(409).json({ error: 'invalid_state', message: 'Sólo se pueden anular visitas pendientes.' });
    }
    // "No en proceso": una visita pendiente ya iniciada (Progreso > 0, con control cargado) no se anula.
    if ((reg.Progreso ?? 0) > 0) {
      return res.status(409).json({ error: 'invalid_state', message: 'No se puede anular una visita ya iniciada (en proceso).' });
    }
    await updateItem(LIST_IDS.registros, id, { Estado: 'Anulado' });
    return res.status(200).json({ ID: id, Estado: 'Anulado' });
  } catch (err) {
    console.error('home anular error', err);
    const status = err instanceof GraphError ? 502 : 500;
    return res.status(status).json({ error: 'server_error' });
  }
}
