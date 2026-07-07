import { api, graph, assert, makeRunner, LIST_IDS } from './lib.mjs';

const R = makeRunner();
const TAG = `E2E-${Date.now()}`;
const nroRuta = 900000 + (Date.now() % 90000);
const nroCircuito = 900000 + ((Date.now() + 7) % 90000);

try {
  const tecs = (await api('GET', '/api/users/tecnicos')).json;
  const tec = tecs[0]; const tecNombre = tec?.Nombre_Tecnico || tec?.Nombre; const tecId = Number(tec?.ID || tec?.IDUsuario || 1);

  // ===================== VENTILACIONES =====================
  const vb = (await api('GET', '/api/ventilaciones')).json;
  const pend = vb.ventilaciones.find(v => v.Estado_VE === 'Pendiente');
  const grupo = (vb.grupos?.[0]?.Grupo || vb.grupos?.[0]?.Title || vb.grupos?.[0] || 'Grupo 1');

  await R.test('POST /api/ventilaciones/[id] assign → 200 Asignada (revert)', async () => {
    assert(pend, 'no hay ventilación Pendiente'); const id = pend.ID;
    const orig = await graph.get(LIST_IDS.ventilaciones, id);
    R.cleanup(`revertir ventilación ${id} (assign)`, () => graph.patch(LIST_IDS.ventilaciones, id, {
      Estado_VE: orig.Estado_VE ?? 'Pendiente', Asignado_VE: orig.Asignado_VE ?? '', IDAsignado_VE: orig.IDAsignado_VE ?? null,
      ProximaLimpieza_VE: orig.ProximaLimpieza_VE ?? '', FechaAnoProxima_VE: orig.FechaAnoProxima_VE ?? '', FechaMesAnoProxima_VE: orig.FechaMesAnoProxima_VE ?? '',
      FechaProgramada_VE: orig.FechaProgramada_VE ?? '', FechaAsignado_VE: orig.FechaAsignado_VE ?? '', HoraAsignado_VE: orig.HoraAsignado_VE ?? '',
      VersionAsignado_VE: orig.VersionAsignado_VE ?? '', Orden_VE: orig.Orden_VE ?? '4',
    }));
    const r = await api('POST', `/api/ventilaciones/${id}`, { action: 'assign', tecnico: tecNombre, idTecnico: tecId, proximaLimpieza: '15/08/2026' });
    assert(r.status === 200 && r.json.Estado_VE === 'Asignada', `status ${r.status} ${JSON.stringify(r.json)}`);
    const g = await graph.get(LIST_IDS.ventilaciones, id);
    assert(g.Estado_VE === 'Asignada' && g.Asignado_VE === tecNombre, `graph Estado=${g.Estado_VE}`);
    return `id=${id} → Asignada`;
  });

  await R.test('POST /api/ventilaciones/[id] delete → 200 Eliminada (revert)', async () => {
    const target = vb.ventilaciones.filter(v => v.Estado_VE === 'Pendiente')[1] || pend; const id = target.ID;
    const orig = await graph.get(LIST_IDS.ventilaciones, id);
    R.cleanup(`revertir ventilación ${id} (delete→${orig.Estado_VE})`, () => graph.patch(LIST_IDS.ventilaciones, id, { Estado_VE: orig.Estado_VE ?? 'Pendiente' }));
    const r = await api('POST', `/api/ventilaciones/${id}`, { action: 'delete' });
    assert(r.status === 200 && r.json.Estado_VE === 'Eliminada', `status ${r.status} ${JSON.stringify(r.json)}`);
    return `id=${id} → Eliminada`;
  });

  await R.test('POST /api/ventilaciones add-edificio → 201 (borra vent + revert edificio)', async () => {
    const edi = vb.edificios?.[0]; assert(edi, 'no edificios en bundle');
    const idEdi = Number(edi.ID); const nombreEdi = edi.Micasa || edi.Nombre || edi.Edificio;
    const orig = await graph.get(LIST_IDS.edificios, idEdi);
    R.cleanup(`revertir edificio ${idEdi} (add-edificio)`, () => graph.patch(LIST_IDS.edificios, idEdi, {
      Frecuencia_ED: orig.Frecuencia_ED ?? null, GrupoVentilacion_ED: orig.GrupoVentilacion_ED ?? '', Ventilaciones_ED: orig.Ventilaciones_ED ?? '',
    }));
    const r = await api('POST', '/api/ventilaciones', { action: 'add-edificio', idEdificio: idEdi, edificio: nombreEdi, grupo, frecuencia: 4, proximaLimpieza: '15/08/2026', direccion: '' });
    assert(r.status === 201, `status ${r.status} ${JSON.stringify(r.json).slice(0,140)}`);
    const created = await graph.list(LIST_IDS.ventilaciones, { filter: `fields/IDEdificio_VE eq ${idEdi}` });
    const nueva = created.filter(v => v.Estado_VE === 'Pendiente' && v.FechaMesAnoProxima_VE === '08/2026').sort((a,b)=>Number(b.id)-Number(a.id))[0];
    assert(nueva, 'no se encontró la ventilación creada');
    R.cleanup(`borrar ventilación creada ${nueva.id}`, () => graph.del(LIST_IDS.ventilaciones, nueva.id));
    return `edificio=${idEdi}, vent creada=${nueva.id}`;
  });

  // ===================== ABM RUTAS =====================
  await R.test('POST /api/abm/rutas create → 201 (+delete +hard-delete)', async () => {
    const r = await api('POST', '/api/abm/rutas', { action: 'create', nroRuta });
    assert(r.status === 201, `create status ${r.status} ${JSON.stringify(r.json)}`);
    const rows = await graph.list(LIST_IDS.rutas, { filter: `fields/NroRuta_RT eq ${nroRuta}` });
    assert(rows[0], 'no se creó la ruta');
    R.cleanup(`hard-delete ruta ${rows[0].id}`, () => graph.del(LIST_IDS.rutas, rows[0].id));
    const rd = await api('POST', '/api/abm/rutas', { action: 'delete', nroRuta });
    assert(rd.status === 200, `delete status ${rd.status} ${JSON.stringify(rd.json)}`);
    return `ruta=${nroRuta} creada + soft-delete`;
  });

  // ===================== ABM EDIFICIOS =====================
  let ediId = null, ediId2 = null;
  await R.test('POST /api/abm/edificios create → 201 (+update +baja +hard-delete)', async () => {
    const r = await api('POST', '/api/abm/edificios', { action: 'create', edificio: `${TAG}-EDI`, codigo: `C-${TAG}` });
    assert(r.status === 201, `create status ${r.status} ${JSON.stringify(r.json)}`);
    const rows = await graph.list(LIST_IDS.edificios, { filter: `fields/Micasa eq '${TAG}-EDI'` });
    ediId = rows[0]?.id; assert(ediId, 'no se creó el edificio');
    R.cleanup(`hard-delete edificio ${ediId}`, () => graph.del(LIST_IDS.edificios, ediId));
    const ru = await api('POST', '/api/abm/edificios', { action: 'update', id: Number(ediId), edificio: `${TAG}-EDI-UPD` });
    assert(ru.status === 200, `update status ${ru.status}`);
    const rb = await api('POST', '/api/abm/edificios', { action: 'baja', id: Number(ediId) });
    assert(rb.status === 200 && rb.json.Status === 'BAJA', `baja status ${rb.status} ${JSON.stringify(rb.json)}`);
    return `edificio=${ediId} create+update+baja`;
  });

  // ===================== ABM CIRCUITOS (usa una ruta+edificio propios) =====================
  await R.test('POST /api/abm/circuitos create → 201 (+delete +hard-delete)', async () => {
    // ruta activa para el circuito
    const rr = await api('POST', '/api/abm/rutas', { action: 'create', nroRuta: nroRuta + 1 });
    assert(rr.status === 201, `ruta status ${rr.status}`);
    const rutaRows = await graph.list(LIST_IDS.rutas, { filter: `fields/NroRuta_RT eq ${nroRuta + 1}` });
    R.cleanup(`hard-delete ruta ${rutaRows[0].id} (circuito)`, () => graph.del(LIST_IDS.rutas, rutaRows[0].id));
    // edificio libre (ALTA) para el circuito
    const re = await api('POST', '/api/abm/edificios', { action: 'create', edificio: `${TAG}-EDIC`, codigo: `C-${TAG}-C` });
    assert(re.status === 201, `edificio status ${re.status}`);
    const eRows = await graph.list(LIST_IDS.edificios, { filter: `fields/Micasa eq '${TAG}-EDIC'` });
    ediId2 = eRows[0].id;
    R.cleanup(`hard-delete edificio ${ediId2} (circuito)`, () => graph.del(LIST_IDS.edificios, ediId2));
    // crear circuito
    const rc = await api('POST', '/api/abm/circuitos', { action: 'create', nroRuta: nroRuta + 1, nroCircuito, edificioIds: [Number(ediId2)], observaciones: 'e2e' });
    assert(rc.status === 201, `circuito status ${rc.status} ${JSON.stringify(rc.json).slice(0,160)}`);
    const resRows = await graph.list(LIST_IDS.resumenCircuito, { filter: `fields/NroCircuito_RC eq ${nroCircuito}` });
    assert(resRows[0], 'no se creó el resumen de circuito');
    R.cleanup(`hard-delete resumenCircuito ${resRows[0].id}`, () => graph.del(LIST_IDS.resumenCircuito, resRows[0].id));
    const detRows = await graph.list(LIST_IDS.detalleCircuito, { filter: `fields/NroCircuito_DC eq ${nroCircuito}` });
    for (const d of detRows) R.cleanup(`hard-delete detalleCircuito ${d.id}`, () => graph.del(LIST_IDS.detalleCircuito, d.id));
    const rcd = await api('POST', '/api/abm/circuitos', { action: 'delete', nroCircuito });
    assert(rcd.status === 200, `delete circuito status ${rcd.status}`);
    return `circuito=${nroCircuito} con 1 edificio, create+delete`;
  });
} finally {
  await R.runCleanups();
  R.report();
}
