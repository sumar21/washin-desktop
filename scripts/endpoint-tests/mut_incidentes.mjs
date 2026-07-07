import { api, graph, assert, makeRunner, LIST_IDS } from './lib.mjs';

const R = makeRunner();
const TAG = `E2E-INC-${Date.now()}`;

try {
  // datos válidos
  const maq = await api('GET', '/api/maquinas');
  const edificio = maq.json.edificios[0]?.Micasa || maq.json.edificios[0]?.Nombre || 'Wash Inn';
  const tecs = await api('GET', '/api/users/tecnicos');
  const tecnico = tecs.json[0]?.Nombre_Tecnico || tecs.json[0]?.Nombre || 'Tecnico Test';
  const tecnico2 = tecs.json[1]?.Nombre_Tecnico || tecnico;

  let incId = null;
  await R.test('POST /api/incidentes create → 201', async () => {
    const r = await api('POST', '/api/incidentes', { edificio, descripcion: TAG });
    assert(r.status === 201, `status ${r.status} ${JSON.stringify(r.json).slice(0,120)}`);
    incId = r.json.ID ?? r.json.id;
    if (!incId) { // fallback: buscar por descripción
      const found = await graph.list(LIST_IDS.incidentes, { filter: `fields/DescripcionCarga_IN eq '${TAG}'` });
      incId = found[0]?.id;
    }
    assert(incId, 'no se pudo obtener el ID del incidente creado');
    R.cleanup(`borrar incidente ${incId}`, () => graph.del(LIST_IDS.incidentes, incId));
    const g = await graph.get(LIST_IDS.incidentes, incId);
    assert(g && g.Status_IN === 'A Revisar' && g.DescripcionCarga_IN === TAG, `graph: ${JSON.stringify(g).slice(0,120)}`);
    return `id=${incId}`;
  });

  await R.test('POST /api/incidentes/[id] assign → 200 Asignado', async () => {
    const r = await api('POST', `/api/incidentes/${incId}`, { action: 'assign', tecnico });
    assert(r.status === 200 && r.json.Status_IN === 'Asignado', `status ${r.status} ${JSON.stringify(r.json)}`);
    const g = await graph.get(LIST_IDS.incidentes, incId);
    assert(g.Status_IN === 'Asignado' && g.TecnicoAsignado_IN === tecnico, `graph Status=${g.Status_IN} tec=${g.TecnicoAsignado_IN}`);
    return `tec=${tecnico}`;
  });

  await R.test('POST /api/incidentes/[id] cambiar-tecnico → 200', async () => {
    const r = await api('POST', `/api/incidentes/${incId}`, { action: 'cambiar-tecnico', tecnico: tecnico2 });
    assert(r.status === 200, `status ${r.status} ${JSON.stringify(r.json)}`);
    const g = await graph.get(LIST_IDS.incidentes, incId);
    assert(g.TecnicoAsignado_IN === tecnico2, `graph tec=${g.TecnicoAsignado_IN}`);
    return `tec=${tecnico2}`;
  });

  await R.test('POST /api/incidentes/[id] cambio-maquina → 200 (crea aprobación)', async () => {
    const r = await api('POST', `/api/incidentes/${incId}`, { action: 'cambio-maquina', maquinaConcat: `${TAG}-MAQ`, idMaquinaReemplazo: 'X' });
    assert(r.status === 200 && r.json.Status_IN === 'En Aprobacion', `status ${r.status} ${JSON.stringify(r.json)}`);
    // encontrar la aprobación creada para limpiarla
    const aprobs = await graph.list(LIST_IDS.aprobaciones, { filter: `fields/IDMaquina_AP eq '${incId}'` });
    const ap = aprobs.find(a => a.TipoAprobacion_AP === 'Cambio de Maquina');
    assert(ap, `no se encontró la aprobación creada (n=${aprobs.length})`);
    R.cleanup(`borrar aprobación ${ap.id} (cambio-maquina)`, () => graph.del(LIST_IDS.aprobaciones, ap.id));
    return `aprob=${ap.id}`;
  });

  await R.test('POST /api/incidentes/[id] generar-compra → 201 (crea pedido+detalle)', async () => {
    const r = await api('POST', `/api/incidentes/${incId}`, { action: 'generar-compra', item: `${TAG}-ITEM`, segmento: 'Repuesto', tipoCompra: 'repuesto' });
    assert(r.status === 201 && r.json.compra, `status ${r.status} ${JSON.stringify(r.json)}`);
    const idUniv = r.json.compra;
    const pedidos = await graph.list(LIST_IDS.pedidoCompras, { filter: `fields/IDUnivoco_PC eq '${idUniv}'` });
    assert(pedidos[0], 'no se encontró el pedido creado');
    R.cleanup(`borrar pedido ${pedidos[0].id} (generar-compra)`, () => graph.del(LIST_IDS.pedidoCompras, pedidos[0].id));
    const detalles = await graph.list(LIST_IDS.detalleCompra, { filter: `fields/IDCompra_DC eq '${idUniv}'` });
    for (const d of detalles) R.cleanup(`borrar detalle ${d.id} (generar-compra)`, () => graph.del(LIST_IDS.detalleCompra, d.id));
    return `pedido=${pedidos[0].id} detalles=${detalles.length}`;
  });
} finally {
  await R.runCleanups();
  // verificar que el incidente ya no existe tras limpieza
  R.report();
}
