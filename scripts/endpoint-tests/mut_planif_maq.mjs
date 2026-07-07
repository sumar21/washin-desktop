import { api, graph, assert, makeRunner, LIST_IDS } from './lib.mjs';

const R = makeRunner();
const TAG = `E2E-${Date.now()}`;

async function listRetry(listId, filter, tries = 4) {
  let last; for (let i = 0; i < tries; i++) { try { return await graph.list(listId, { filter, top: 50 }); } catch (e) { last = e; } }
  throw last;
}

try {
  // ===================== PLANIFICACIONES =====================
  const abm = (await api('GET', '/api/abm')).json;
  const circuitos = abm.circuitos || [];
  const rutaConCirc = circuitos[0]?.NroRuta ?? circuitos[0]?.NroRuta_RC;
  const mesFut = '12/2027';

  await R.test('POST /api/planificaciones create → 201 (genera; luego delete + hard-delete)', async () => {
    assert(rutaConCirc != null, 'no hay circuitos en ABM para armar planificación');
    const mesesBefore = new Set((await graph.list(LIST_IDS.mesesPlanif, { top: 200 })).map(m => m.id));
    const r = await api('POST', '/api/planificaciones', { action: 'create', mes: mesFut, mesNombre: 'diciembre', lines: [{ nroRuta: String(rutaConCirc), tecnico: TAG }] });
    assert(r.status === 201, `status ${r.status} ${JSON.stringify(r.json).slice(0,140)}`);
    // registrar limpieza de TODO lo creado (tag = técnico TAG)
    const resumen = await listRetry(LIST_IDS.resumenPlanif, `fields/Tecnico_RP eq '${TAG}'`);
    assert(resumen.length >= 1, 'no se creó resumenPlanif');
    for (const x of resumen) R.cleanup(`hard-delete resumenPlanif ${x.id}`, () => graph.del(LIST_IDS.resumenPlanif, x.id));
    const det = await listRetry(LIST_IDS.detallePlanif, `fields/Tecnico_DP eq '${TAG}'`);
    for (const x of det) R.cleanup(`hard-delete detallePlanif ${x.id}`, () => graph.del(LIST_IDS.detallePlanif, x.id));
    const edv = await listRetry(LIST_IDS.edificiosVisitar, `fields/TecnicoAsignado_EV eq '${TAG}'`);
    for (const x of edv) R.cleanup(`hard-delete edificioVisitar ${x.id}`, () => graph.del(LIST_IDS.edificiosVisitar, x.id));
    // meses row nuevo (si se creó para 12/2027)
    const mesesAfter = await graph.list(LIST_IDS.mesesPlanif, { top: 200 });
    for (const m of mesesAfter) if (!mesesBefore.has(m.id)) R.cleanup(`hard-delete mesesPlanif ${m.id}`, () => graph.del(LIST_IDS.mesesPlanif, m.id));
    // probar la acción delete (soft-anula) por idUnivocoRuta
    const idUniv = resumen[0].IDUnivocoRuta_RP;
    const rd = await api('POST', '/api/planificaciones', { action: 'delete', idUnivocoRuta: idUniv });
    assert(rd.status === 200, `delete status ${rd.status} ${JSON.stringify(rd.json)}`);
    return `ruta=${rutaConCirc} resumen=${resumen.length} det=${det.length} edif=${edv.length}, +soft-delete`;
  });

  // ===================== MAQUINAS (transfer + baja, revert por Graph) =====================
  const maqs = (await api('GET', '/api/maquinas')).json.maquinas;
  const M = maqs.find(m => m.Status_DM === 'INSTALADA' && (m.Edificio_DM || '').trim() !== 'Wash Inn' && !/encended/i.test(m.Segmento_DM || ''));
  const stockSnap = new Map((await graph.list(LIST_IDS.stock, { filter: `fields/Status_ST eq 'Activo'`, top: 999 })).map(s => [s.id, s.Cantidad_ST]));
  // revert de stock al final (por si algún ajustarStock tocó una fila)
  R.cleanup('revertir stock cambiado por maquinas (si hubo)', async () => {
    const now = await graph.list(LIST_IDS.stock, { filter: `fields/Status_ST eq 'Activo'`, top: 999 });
    for (const s of now) if (stockSnap.has(s.id) && String(stockSnap.get(s.id)) !== String(s.Cantidad_ST)) await graph.patch(LIST_IDS.stock, s.id, { Cantidad_ST: String(stockSnap.get(s.id)) });
  });

  // El filtro por MotivoTransferencia_IN/Categoria_IN NO es consultable en Graph; IDMaquina_IN SÍ.
  async function borrarBitacora(idMaqIN) {
    const found = await listRetry(LIST_IDS.incidentes, `fields/IDMaquina_IN eq '${idMaqIN}'`).catch(() => []);
    const mine = found.filter(i => String(i.MotivoTransferencia_IN || '').startsWith('E2E-') && String(i.MotivoTransferencia_IN) === TAG);
    for (const b of mine) R.cleanup(`borrar bitácora incidente ${b.id}`, () => graph.del(LIST_IDS.incidentes, b.id));
    return mine.length;
  }

  await R.test('POST /api/maquinas/[id] transfer → 200 DEPOSITO (revert)', async () => {
    assert(M, 'no hay máquina INSTALADA no-encendedora'); const id = M.ID;
    const orig = await graph.get(LIST_IDS.detalleMaquina, id);
    R.cleanup(`revertir máquina ${id} (transfer)`, () => graph.patch(LIST_IDS.detalleMaquina, id, {
      Status_DM: orig.Status_DM, Edificio_DM: orig.Edificio_DM ?? '', Encendido_DM: orig.Encendido_DM ?? '', Motivo_DM: orig.Motivo_DM ?? '', CodigoEdificio_DM: orig.CodigoEdificio_DM ?? '',
    }));
    const r = await api('POST', `/api/maquinas/${id}`, { action: 'transfer', edificioDestino: 'Wash Inn', codigoDestino: 'C-9999', motivo: TAG });
    assert(r.status === 200 && r.json.Status_DM === 'DEPOSITO', `status ${r.status} ${JSON.stringify(r.json)}`);
    const g = await graph.get(LIST_IDS.detalleMaquina, id);
    assert(g.Status_DM === 'DEPOSITO', `graph Status=${g.Status_DM}`);
    const n = await borrarBitacora(orig.IDMaquina_DM);
    return `id=${id} → DEPOSITO, bitácora=${n}`;
  });

  await R.test('POST /api/maquinas/[id] baja → 200 ELIMINADA (revert)', async () => {
    // usar OTRA máquina INSTALADA para no depender del orden de revert
    const M2 = maqs.find(m => m.ID !== M?.ID && m.Status_DM === 'INSTALADA' && !/encended/i.test(m.Segmento_DM || ''));
    assert(M2, 'no hay 2da máquina INSTALADA'); const id = M2.ID;
    const orig = await graph.get(LIST_IDS.detalleMaquina, id);
    R.cleanup(`revertir máquina ${id} (baja)`, () => graph.patch(LIST_IDS.detalleMaquina, id, { Status_DM: orig.Status_DM, Motivo_DM: orig.Motivo_DM ?? '' }));
    const r = await api('POST', `/api/maquinas/${id}`, { action: 'baja', motivo: TAG });
    assert(r.status === 200 && r.json.Status_DM === 'ELIMINADA', `status ${r.status} ${JSON.stringify(r.json)}`);
    const g = await graph.get(LIST_IDS.detalleMaquina, id);
    assert(g.Status_DM === 'ELIMINADA', `graph Status=${g.Status_DM}`);
    // la baja crea una bitácora (Baja de Maquina) con MotivoTransferencia_IN=TAG.
    const found = await listRetry(LIST_IDS.incidentes, `fields/IDMaquina_IN eq '${orig.IDMaquina_DM}'`).catch(() => []);
    const nuevas = found.filter(i => String(i.MotivoTransferencia_IN) === TAG && i.NoResuelto_IN === 'Baja de Maquina');
    for (const b of nuevas) R.cleanup(`borrar bitácora baja incidente ${b.id}`, () => graph.del(LIST_IDS.incidentes, b.id));
    return `id=${id} → ELIMINADA, bitácora baja=${nuevas.length}`;
  });

  // guard: transfer sin destino → 400
  await R.test('POST /api/maquinas/[id] transfer sin destino → 400', async () => {
    const r = await api('POST', `/api/maquinas/${M?.ID || 1}`, { action: 'transfer' });
    assert(r.status === 400, `status ${r.status}`);
  });
} finally {
  await R.runCleanups();
  R.report();
}
