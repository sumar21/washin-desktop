import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listItems, createItem, updateItem, GraphError } from '../_lib/graph.js';
import {
  LIST_IDS,
  mapMesPlanif,
  mesPlanifSelectFields,
  mapResumenPlanif,
  resumenPlanifSelectFields,
  mapDetallePlanif,
  detallePlanifSelectFields,
  type DetallePlanifRow,
  mapEdificioVisitar,
  edificioVisitarSelectFields,
  mapResumenCircuito,
  resumenCircuitoSelectFields,
  mapDetalleCircuito,
  detalleCircuitoSelectFields,
  mapTecnicos,
  tecnicosSelectFields,
  mapRuta,
  rutaSelectFields,
  fechasHoy,
  canEditPlanif,
  APP_VERSION,
} from '../_lib/lists.js';
import { readSession } from '../_lib/session.js';
import { puedeAccederModulo } from '../_lib/permisos.js';

const odataEscape = (v: string) => v.replace(/'/g, "''");
// Estados "vivos" de una planificación (se excluye Anulado).
const VIVOS = `(fields/Status_RP eq 'Pendiente' or fields/Status_RP eq 'En Proceso' or fields/Status_RP eq 'Cerrada')`;

interface CreateBody {
  action?: 'create' | 'delete';
  mes?: string; // mm/yyyy
  mesNombre?: string; // nombre del mes en español
  lines?: { tecnico: string; nroRuta: string }[];
  idUnivocoRuta?: string; // para delete de una ruta puntual
  mesAno?: string; // para delete de todo un mes
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = readSession(req.headers.cookie);
  if (!session) return res.status(401).json({ error: 'no_session' });

  // ── GET ──
  if (req.method === 'GET') {
    try {
      const mesRaw = req.query.mes;
      const mes = (Array.isArray(mesRaw) ? mesRaw[0] : mesRaw)?.trim();

      // Detalle de un mes: rutas + circuitos + edificios a visitar.
      if (mes) {
        const esc = odataEscape(mes);
        const [resRows, detRows, edifRows, regRows] = await Promise.all([
          listItems(LIST_IDS.resumenPlanif, { select: resumenPlanifSelectFields(), filter: `fields/MesAnoRuta_RP eq '${esc}' and ${VIVOS}`, top: 999 }),
          listItems(LIST_IDS.detallePlanif, { select: detallePlanifSelectFields(), filter: `fields/MesAno_DP eq '${esc}'`, top: 2000 }),
          listItems(LIST_IDS.edificiosVisitar, { select: edificioVisitarSelectFields(), filter: `fields/MesAno_EV eq '${esc}'`, top: 4000 }),
          // 01.Registros del mismo mes: la "visita real" (Estado_EV en 18 nunca se
          // actualiza — siempre queda 'Pendiente'). El estado Visitado se DERIVA
          // cruzando contra los registros Finalizados de ese mes.
          listItems(LIST_IDS.registros, { select: ['Codigo', 'Edificio', 'Estado', 'MesA_x00f1_o'], filter: `fields/MesA_x00f1_o eq '${esc}'`, top: 4000 }),
        ]);

        // Índice de "visitados" del mes: código de edificio (clave principal, ~94% de match)
        // y nombre de edificio normalizado (fallback). El técnico NO se cruza: los formatos
        // difieren entre listas ("Martinez, Luis" en 18 vs "Luimartinez" en 01).
        const visitados = new Set<string>();
        for (const r of regRows) {
          if (String(r.Estado ?? '') !== 'Finalizado') continue; // Anulado no cuenta
          const cod = String(r.Codigo ?? '').trim().toUpperCase();
          const edif = String(r.Edificio ?? '').trim().toLowerCase();
          if (cod) visitados.add('C:' + cod);
          if (edif) visitados.add('E:' + edif);
        }
        const edificios = edifRows.map(mapEdificioVisitar).map((e) => {
          const cod = e.Codigo.trim().toUpperCase();
          const edif = e.Edificio.trim().toLowerCase();
          const visito = (cod && visitados.has('C:' + cod)) || (edif && visitados.has('E:' + edif));
          return visito ? { ...e, Estado: 'Visitado' } : e;
        });

        return res.status(200).json({
          resumen: resRows.map(mapResumenPlanif),
          detalle: detRows.map(mapDetallePlanif).filter((d) => d.Status !== 'Anulado'),
          edificios,
        });
      }

      // Lista: meses planificados + resumen (para progreso) + técnicos/rutas (para crear).
      const [mesRows, resRows, tecRows, rutaRows] = await Promise.all([
        listItems(LIST_IDS.mesesPlanif, { select: mesPlanifSelectFields(), filter: `fields/Status_MP eq 'Activo'`, top: 999 }),
        listItems(LIST_IDS.resumenPlanif, { select: resumenPlanifSelectFields(), filter: VIVOS, top: 2000 }),
        listItems(LIST_IDS.usuarios, { select: tecnicosSelectFields(), top: 999 }),
        listItems(LIST_IDS.rutas, { select: rutaSelectFields(), filter: `fields/Status_RT eq 'Activo'`, top: 999 }),
      ]);
      return res.status(200).json({
        meses: mesRows.map(mapMesPlanif),
        resumen: resRows.map(mapResumenPlanif),
        tecnicos: mapTecnicos(tecRows),
        rutas: rutaRows.map(mapRuta).sort((a, b) => a.NroRuta - b.NroRuta),
      });
    } catch (err) {
      console.error('planificaciones GET error', err);
      const status = err instanceof GraphError ? 502 : 500;
      return res.status(status).json({ error: 'server_error' });
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const body = (req.body ?? {}) as CreateBody;
  try {
    if (!(await puedeAccederModulo(session.rol, 'Planificaciones'))) {
      return res.status(403).json({ error: 'forbidden', message: 'Tu rol no tiene habilitado el módulo Planificaciones.' });
    }
    // Supervisor + Jefe Taller: planificación en solo-lectura (no crean/borran/modifican).
    if (!canEditPlanif(session.rol)) {
      return res.status(403).json({ error: 'forbidden', message: 'Tu rol solo puede consultar planificaciones.' });
    }
    if (body.action === 'create') return await create(body, res, session.usuario);
    if (body.action === 'delete') return await remove(body, res);
    return res.status(400).json({ error: 'invalid', message: 'Acción de planificación desconocida' });
  } catch (err) {
    console.error('planificaciones POST error', err);
    const status = err instanceof GraphError ? 502 : 500;
    return res.status(status).json({ error: 'server_error' });
  }
}

// ── Crear planificación: genera rutas → circuitos → edificios desde el catálogo ABM ──
async function create(body: CreateBody, res: VercelResponse, usuario: string) {
  const mesAno = body.mes?.trim();
  const mesNombre = body.mesNombre?.trim().toLowerCase();
  const lines = (body.lines ?? []).filter((l) => l.tecnico?.trim() && l.nroRuta?.trim());
  if (!mesAno || !/^\d{2}\/\d{4}$/.test(mesAno)) return res.status(400).json({ error: 'invalid', message: 'Mes inválido (mm/yyyy)' });
  if (lines.length === 0) return res.status(400).json({ error: 'invalid', message: 'Agregá al menos una ruta a un técnico' });

  const escMes = odataEscape(mesAno);
  const [circAll, detAll, resExist, detExistRaw, edifExistRaw] = await Promise.all([
    listItems(LIST_IDS.resumenCircuito, { select: resumenCircuitoSelectFields(), filter: `fields/Status_RC eq 'Activo'`, top: 999 }),
    listItems(LIST_IDS.detalleCircuito, { select: detalleCircuitoSelectFields(), filter: `fields/Status_DC eq 'Activo'`, top: 2000 }),
    listItems(LIST_IDS.resumenPlanif, { select: resumenPlanifSelectFields(), filter: `fields/MesAnoRuta_RP eq '${escMes}' and ${VIVOS}`, top: 999 }),
    // 16.DetallePlanificaciones y 18.EdificiosVisitar ya existentes del mes: sirven para
    // DETECTAR un resumen (15) huérfano de un intento previo cortado a la mitad y REANUDARLO,
    // creando sólo los 16/18 que faltan en vez de saltar la línea entera (idempotencia real).
    listItems(LIST_IDS.detallePlanif, { select: detallePlanifSelectFields(), filter: `fields/MesAno_DP eq '${escMes}'`, top: 2000 }),
    listItems(LIST_IDS.edificiosVisitar, { select: edificioVisitarSelectFields(), filter: `fields/MesAno_EV eq '${escMes}'`, top: 4000 }),
  ]);
  const circuitos = circAll.map(mapResumenCircuito);
  const detalles = detAll.map(mapDetalleCircuito);

  // Resúmenes (15) ya asignados del mes → 'NroRuta|Tecnico' ⟶ { idUnivocoRuta, circuitosEsperados }.
  // El idUnivocoRuta guardado es la fuente de verdad para reanudar (NO se reconstruye el stamp time-based).
  const resumenMap = new Map<string, { idUnivocoRuta: string; circuitosEsperados: number }>();
  for (const r of resExist.map(mapResumenPlanif)) {
    resumenMap.set(`${r.NroRuta}|${r.Tecnico}`, { idUnivocoRuta: r.IDUnivocoRuta, circuitosEsperados: r.Circuitos });
  }

  // 16 vivos agrupados por IDUnivocoRuta (para contar cuántos circuitos ya se crearon y reutilizar su IDUnivocoCircuito).
  const detPorRuta = new Map<string, DetallePlanifRow[]>();
  for (const d of detExistRaw.map(mapDetallePlanif)) {
    if (d.Status === 'Anulado') continue;
    const arr = detPorRuta.get(d.IDUnivocoRuta);
    if (arr) arr.push(d);
    else detPorRuta.set(d.IDUnivocoRuta, [d]);
  }

  // 18 ya creados agrupados por IDUnivocoCircuito → set de códigos de edificio (para no duplicar al reanudar).
  const edifPorCircuito = new Map<string, Set<string>>();
  for (const e of edifExistRaw.map(mapEdificioVisitar)) {
    const s = edifPorCircuito.get(e.IDUnivocoCircuito);
    if (s) s.add(e.Codigo);
    else edifPorCircuito.set(e.IDUnivocoCircuito, new Set([e.Codigo]));
  }

  const f = fechasHoy();
  const ano = mesAno.split('/')[1];
  let rutasCreadas = 0;

  for (const line of lines) {
    const tecnico = line.tecnico.trim();
    const nroRuta = line.nroRuta.trim();
    const circuitosRuta = circuitos.filter((c) => String(c.NroRuta) === nroRuta);

    const existente = resumenMap.get(`${nroRuta}|${tecnico}`);
    if (existente) {
      // Ya hay un 15.Resumen vivo para esta ruta/técnico en el mes.
      const detActuales = detPorRuta.get(existente.idUnivocoRuta) ?? [];
      if (detActuales.length === existente.circuitosEsperados) continue; // completo → nada que hacer (idempotente, comportamiento actual)

      // ── REANUDAR: resumen huérfano de un intento previo cortado. Reutilizamos el idUnivocoRuta
      //    guardado en el 15 (NO reconstruimos el stamp) y creamos SÓLO los 16/18 faltantes; el 15 NO se recrea.
      const detPorCircuito = new Map<number, DetallePlanifRow>();
      for (const d of detActuales) detPorCircuito.set(d.NroCircuito, d);

      for (const c of circuitosRuta) {
        const edifs = detalles.filter((d) => d.NroCircuito === c.NroCircuito);
        const detExistente = detPorCircuito.get(c.NroCircuito);
        let idUnivocoCircuito: string;
        if (detExistente) {
          // El 16 de este circuito ya existe → reutilizamos su IDUnivocoCircuito para linkear los 18 que falten.
          idUnivocoCircuito = detExistente.IDUnivocoCircuito;
        } else {
          // Falta el 16 de este circuito → lo creamos (stamp nuevo) colgando del idUnivocoRuta existente.
          idUnivocoCircuito = `C${c.NroCircuito} - ${f.stamp} - ${tecnico}`;
          await createItem(LIST_IDS.detallePlanif, {
            Title: 'sumar',
            IDUnivoco_DP: existente.idUnivocoRuta,
            IDUnivocoCircuito_DP: idUnivocoCircuito,
            NroRuta_DP: Number(nroRuta) || 0,
            NroCircuito_DP: c.NroCircuito,
            Circuito_DP: c.NroCircuito,
            CantidadEdificios_DP: edifs.length,
            Status_DP: 'Pendiente',
            Tecnico_DP: tecnico,
            MesAno_DP: mesAno,
            Mes_DP: mesNombre ?? '',
            ObservacionCircuito_DP: c.Observaciones,
          });
        }

        // 18: creamos sólo los edificios que aún no existen para este IDUnivocoCircuito.
        const yaCreados = edifPorCircuito.get(idUnivocoCircuito) ?? new Set<string>();
        for (const e of edifs) {
          if (yaCreados.has(e.CodigoEdificio)) continue;
          await createItem(LIST_IDS.edificiosVisitar, {
            Title: 'sumar',
            TecnicoAsignado_EV: tecnico,
            CodigoEdificio_EV: e.CodigoEdificio,
            Edificio_EV: e.Edificio,
            Direccion_EV: e.Direccion,
            ConcatEdificio_EV: `${e.Edificio} - ${e.Direccion}`,
            Estado_EV: 'Pendiente',
            MesAno_EV: mesAno,
            NroCircuito_EV: String(c.NroCircuito),
            NroRuta_EV: nroRuta,
            HoraSugerida_EV: e.Horario,
            IDUnivocoCircuito_EV: idUnivocoCircuito,
            IDUnivocoRuta_EV: existente.idUnivocoRuta,
            Encargado_EV: e.Encargado,
            Celular_EV: e.NroCelular,
            Mail_EV: e.MailEdificio,
            Latitud_EV: e.Latitud,
            Longitud_EV: e.Longitud,
          });
        }
      }
      rutasCreadas++;
      continue;
    }

    // ── No existe resumen → crear todo fresco (flujo original completo 15 → 16 → 18) ──
    const idUnivocoRuta = `R${nroRuta} - ${tecnico} - ${f.stamp}`;

    await createItem(LIST_IDS.resumenPlanif, {
      Title: 'sumar',
      Mes_RP: mesNombre ?? '',
      Status_RP: 'Pendiente',
      Fecha_RP: f.fecha,
      FechaMesAno_RP: mesAno,
      FechaAno_RP: ano,
      MesAnoRuta_RP: mesAno,
      IDUnivocoRuta_RP: idUnivocoRuta,
      Version_RP: APP_VERSION,
      User_RP: usuario,
      Circuitos_RP: circuitosRuta.length,
      Tecnico_RP: tecnico,
      NroRuta_RP: nroRuta,
      Hora_RP: f.hora,
    });

    for (const c of circuitosRuta) {
      const edifs = detalles.filter((d) => d.NroCircuito === c.NroCircuito);
      const idUnivocoCircuito = `C${c.NroCircuito} - ${f.stamp} - ${tecnico}`;
      await createItem(LIST_IDS.detallePlanif, {
        Title: 'sumar',
        IDUnivoco_DP: idUnivocoRuta,
        IDUnivocoCircuito_DP: idUnivocoCircuito,
        NroRuta_DP: Number(nroRuta) || 0,
        NroCircuito_DP: c.NroCircuito,
        Circuito_DP: c.NroCircuito,
        CantidadEdificios_DP: edifs.length,
        Status_DP: 'Pendiente',
        Tecnico_DP: tecnico,
        MesAno_DP: mesAno,
        Mes_DP: mesNombre ?? '',
        ObservacionCircuito_DP: c.Observaciones,
      });

      for (const e of edifs) {
        await createItem(LIST_IDS.edificiosVisitar, {
          Title: 'sumar',
          TecnicoAsignado_EV: tecnico,
          CodigoEdificio_EV: e.CodigoEdificio,
          Edificio_EV: e.Edificio,
          Direccion_EV: e.Direccion,
          ConcatEdificio_EV: `${e.Edificio} - ${e.Direccion}`,
          Estado_EV: 'Pendiente',
          MesAno_EV: mesAno,
          NroCircuito_EV: String(c.NroCircuito),
          NroRuta_EV: nroRuta,
          HoraSugerida_EV: e.Horario,
          IDUnivocoCircuito_EV: idUnivocoCircuito,
          IDUnivocoRuta_EV: idUnivocoRuta,
          Encargado_EV: e.Encargado,
          Celular_EV: e.NroCelular,
          Mail_EV: e.MailEdificio,
          Latitud_EV: e.Latitud,
          Longitud_EV: e.Longitud,
        });
      }
    }
    rutasCreadas++;
  }

  // Mes: crea o actualiza los contadores (rutas + técnicos únicos vivos del mes).
  const resVivas = (
    await listItems(LIST_IDS.resumenPlanif, { select: resumenPlanifSelectFields(), filter: `fields/MesAnoRuta_RP eq '${odataEscape(mesAno)}' and ${VIVOS}`, top: 999 })
  ).map(mapResumenPlanif);
  const totalRutas = resVivas.length;
  const totalTecnicos = new Set(resVivas.map((r) => r.Tecnico)).size;
  const mesRows = (
    await listItems(LIST_IDS.mesesPlanif, { select: mesPlanifSelectFields(), filter: `fields/MesAnoPlanificado_MP eq '${odataEscape(mesAno)}' and fields/Status_MP eq 'Activo'`, top: 10 })
  ).map(mapMesPlanif);
  if (mesRows[0]) {
    await updateItem(LIST_IDS.mesesPlanif, mesRows[0].ID, { RutasTotales_MP: String(totalRutas), TecnicosTotales_MP: String(totalTecnicos) });
  } else {
    await createItem(LIST_IDS.mesesPlanif, {
      Title: 'sumar',
      MesPlanificado: mesNombre ?? '',
      RutasTotales_MP: String(totalRutas),
      TecnicosTotales_MP: String(totalTecnicos),
      MesAnoPlanificado_MP: mesAno,
      Fecha_MP: f.fecha,
      User_MP: usuario,
      VarVersion_MP: APP_VERSION,
      Hora_MP: f.hora,
      Status_MP: 'Activo',
    });
  }

  return res.status(201).json({ mesAno, rutasCreadas });
}

// ── Eliminar (anular) una ruta puntual o todo un mes ──
async function remove(body: CreateBody, res: VercelResponse) {
  const idUnivocoRuta = body.idUnivocoRuta?.trim();
  const mesAno = body.mesAno?.trim();
  if (!idUnivocoRuta && !mesAno) return res.status(400).json({ error: 'invalid', message: 'Falta la ruta o el mes a eliminar' });

  const esc = mesAno ? odataEscape(mesAno) : '';
  const [resRows, detRows, edifRows] = await Promise.all([
    listItems(LIST_IDS.resumenPlanif, { select: resumenPlanifSelectFields(), filter: mesAno ? `fields/MesAnoRuta_RP eq '${esc}'` : `fields/IDUnivocoRuta_RP eq '${odataEscape(idUnivocoRuta!)}'`, top: 999 }),
    listItems(LIST_IDS.detallePlanif, { select: detallePlanifSelectFields(), top: 2000 }),
    listItems(LIST_IDS.edificiosVisitar, { select: edificioVisitarSelectFields(), filter: `fields/Estado_EV eq 'Pendiente'`, top: 4000 }),
  ]);
  const resumen = resRows.map(mapResumenPlanif).filter((r) => r.Status !== 'Anulado');
  const idsRuta = new Set(resumen.map((r) => r.IDUnivocoRuta));
  const detalle = detRows.map(mapDetallePlanif).filter((d) => idsRuta.has(d.IDUnivocoRuta) && d.Status !== 'Anulado');
  const idsCircuito = new Set(detalle.map((d) => d.IDUnivocoCircuito));
  const edificios = edifRows.map(mapEdificioVisitar).filter((e) => idsCircuito.has(e.IDUnivocoCircuito));

  for (const e of edificios) await updateItem(LIST_IDS.edificiosVisitar, e.ID, { Estado_EV: 'Anulado' });
  for (const d of detalle) await updateItem(LIST_IDS.detallePlanif, d.ID, { Status_DP: 'Anulado' });
  for (const r of resumen) await updateItem(LIST_IDS.resumenPlanif, r.ID, { Status_RP: 'Anulado' });

  // Si se anula un mes entero, dar de baja también su fila de MesesPlanificacion.
  if (mesAno) {
    const mesRows = (await listItems(LIST_IDS.mesesPlanif, { select: mesPlanifSelectFields(), filter: `fields/MesAnoPlanificado_MP eq '${esc}'`, top: 10 })).map(mapMesPlanif);
    for (const m of mesRows.filter((x) => x.Status === 'Activo')) await updateItem(LIST_IDS.mesesPlanif, m.ID, { Status_MP: 'Inactivo' });
  }

  return res.status(200).json({ anuladas: resumen.length, circuitos: detalle.length, edificios: edificios.length });
}
