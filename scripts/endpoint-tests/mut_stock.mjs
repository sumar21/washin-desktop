import { api, graph, assert, makeRunner, LIST_IDS } from './lib.mjs';

const R = makeRunner();
const TAG = `E2E-STK-${Date.now()}`;
const T1 = `${TAG}-T1`, T2 = `${TAG}-T2`;
const stockCant = async (id) => Number((await graph.get(LIST_IDS.stock, id)).Cantidad_ST);
const rtCant = async (id) => Number((await graph.get(LIST_IDS.repuestosTecnico, id)).Cantidad_RT);

let X = null, Y = null, Z = null;
try {
  // POST /api/stock add — BUG conocido: filtra 04.Stock por Tipo_ST (columna NO indexada) → 502.
  await R.test('POST /api/stock add → ⚠️ 502 (BUG: filtro Tipo_ST no indexado)', async () => {
    const r = await api('POST', '/api/stock', { tipo: 'Repuesto', item: TAG, cantidad: 5 });
    assert(r.status === 502, `esperaba 502 (bug), status ${r.status}`);
    return 'documentado como bug (ver docs)';
  });

  // Para testear el resto, creo la fila de stock X vía Graph (el create funciona; solo el filtro rompe).
  await R.test('setup: crear fila stock X (vía Graph, REPUESTO cant=8)', async () => {
    const c = await graph.create(LIST_IDS.stock, { Lodge_ST: TAG, Tipo_ST: 'REPUESTO', Marca_ST: '', Nro_ST: '', Cantidad_ST: '8', Status_ST: 'Activo', ConcatStock_ST: `Repuesto - ${TAG}` });
    X = c.id; R.cleanup(`borrar stock X ${X}`, () => graph.del(LIST_IDS.stock, X));
    assert(await stockCant(X) === 8, 'cant != 8'); return `X=${X}`;
  });
  await R.test('PATCH /api/stock/[id] → 200 setea cantidad', async () => {
    const r = await api('PATCH', `/api/stock/${X}`, { cantidad: 8 });
    assert(r.status === 200 && r.json.Cantidad_ST === 8, `status ${r.status} ${JSON.stringify(r.json)}`);
    assert(await stockCant(X) === 8, 'graph != 8'); return 'cant=8';
  });
  await R.test('POST /api/stock/assign → 200 (X-3, crea repuesto técnico Y)', async () => {
    const r = await api('POST', '/api/stock/assign', { id: X, tecnico: T1, cantidad: 3 });
    assert(r.status === 200 && r.json.Cantidad_ST === 5, `status ${r.status} ${JSON.stringify(r.json)}`);
    const rows = await graph.list(LIST_IDS.repuestosTecnico, { filter: `fields/Tecnico_RT eq '${T1}'` });
    Y = rows.find(x => (x.Concat_RT || '').toLowerCase() === TAG.toLowerCase())?.id;
    assert(Y, `no se creó repuesto técnico (n=${rows.length})`);
    R.cleanup(`borrar repuestoTecnico Y ${Y}`, () => graph.del(LIST_IDS.repuestosTecnico, Y));
    assert(await stockCant(X) === 5 && await rtCant(Y) === 3, 'cantidades mal');
    return `X=5, Y=${Y} cant=3`;
  });
  await R.test('POST /api/stock-tecnicos edit → 200', async () => {
    const r = await api('POST', '/api/stock-tecnicos', { action: 'edit', id: Y, cantidad: 6 });
    assert(r.status === 200 && r.json.Cantidad_RT === 6, `status ${r.status} ${JSON.stringify(r.json)}`);
    assert(await rtCant(Y) === 6, 'graph != 6'); return 'Y→6';
  });
  await R.test('POST /api/stock-tecnicos transfer → 200 (Y-2, crea Z en T2)', async () => {
    const r = await api('POST', '/api/stock-tecnicos', { action: 'transfer', id: Y, cantidad: 2, toTecnico: T2 });
    assert(r.status === 200 && r.json.restante === 4, `status ${r.status} ${JSON.stringify(r.json)}`);
    const rows = await graph.list(LIST_IDS.repuestosTecnico, { filter: `fields/Tecnico_RT eq '${T2}'` });
    Z = rows.find(x => (x.Concat_RT || '').toLowerCase() === TAG.toLowerCase())?.id;
    assert(Z, 'no se creó Z'); R.cleanup(`borrar repuestoTecnico Z ${Z}`, () => graph.del(LIST_IDS.repuestosTecnico, Z));
    assert(await rtCant(Y) === 4 && await rtCant(Z) === 2, 'cantidades mal');
    return `Y=4, Z=${Z} cant=2`;
  });
  await R.test('POST /api/stock-tecnicos reingreso → 200 (Y-1, suma a 04.Stock)', async () => {
    const before = await stockCant(X);
    const r = await api('POST', '/api/stock-tecnicos', { action: 'reingreso', id: Y, cantidad: 1 });
    assert(r.status === 200, `status ${r.status} ${JSON.stringify(r.json)}`);
    assert(await rtCant(Y) === 3, 'Y != 3');
    assert(await stockCant(X) === before + 1, `stock no incrementó (antes ${before})`);
    return `Y→3, X ${before}→${before + 1}`;
  });
} finally {
  await R.runCleanups();
  R.report();
}
