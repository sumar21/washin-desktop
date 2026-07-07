import { api, graph, assert, makeRunner, LIST_IDS } from './lib.mjs';

const R = makeRunner();
const TAG = `E2E-CMP-${Date.now()}`;

async function crearPedido(itemTag, cantidad = 1) {
  const r = await api('POST', '/api/compras', { segmento: 'Repuesto', lines: [{ item: itemTag, cantidad }], observaciones: 'e2e' });
  assert(r.status === 201, `create status ${r.status} ${JSON.stringify(r.json).slice(0,120)}`);
  const pedidoId = r.json.pedido.ID ?? r.json.pedido.id;
  const idUniv = r.json.pedido.IDUnivoco_PC;
  const detalleId = r.json.detalles[0].ID ?? r.json.detalles[0].id;
  R.cleanup(`borrar pedido ${pedidoId}`, () => graph.del(LIST_IDS.pedidoCompras, pedidoId));
  R.cleanup(`borrar detalle ${detalleId}`, () => graph.del(LIST_IDS.detalleCompra, detalleId));
  return { pedidoId, idUniv, detalleId };
}
async function findAprob(pedidoId) {
  const l = await graph.list(LIST_IDS.aprobaciones, { filter: `fields/IDCompra_AP eq '${pedidoId}'` });
  const ap = l.find(a => a.TipoAprobacion_AP === 'Compra');
  if (ap) R.cleanup(`borrar aprobación ${ap.id}`, () => graph.del(LIST_IDS.aprobaciones, ap.id));
  return ap;
}

try {
  // ===== Pedido A: create → edit → approve-request → aprobaciones approve → receive =====
  let A;
  await R.test('POST /api/compras create (A) → 201', async () => {
    A = await crearPedido(`${TAG}-A`, 2);
    const g = await graph.get(LIST_IDS.pedidoCompras, A.pedidoId);
    assert(g.Status_PC === 'Pendiente', `Status=${g.Status_PC}`);
    return `pedido=${A.pedidoId}`;
  });
  await R.test('PATCH /api/compras/[id] edit → 200 (cambia cantidad+obs)', async () => {
    const r = await api('PATCH', `/api/compras/${A.pedidoId}`, { updates: [{ detalleId: A.detalleId, cantidad: 3 }], observaciones: 'editado e2e' });
    assert(r.status === 200 && r.json.Cantidad_PC === 3, `status ${r.status} ${JSON.stringify(r.json)}`);
    const g = await graph.get(LIST_IDS.detalleCompra, A.detalleId);
    assert(String(g.Cantidad_DC) === '3', `detalle cant=${g.Cantidad_DC}`);
    return 'cant→3';
  });
  await R.test('POST /api/compras/[id] approve-request → 200 En Aprobacion', async () => {
    const r = await api('POST', `/api/compras/${A.pedidoId}`, { action: 'approve-request' });
    assert(r.status === 200 && r.json.Status_PC === 'En Aprobacion', `status ${r.status} ${JSON.stringify(r.json)}`);
    A.aprob = await findAprob(A.pedidoId);
    assert(A.aprob, 'no se creó la aprobación');
    return `aprob=${A.aprob.id}`;
  });
  await R.test('POST /api/aprobaciones/[id] approve → 200 (pedido→Aprobada)', async () => {
    const r = await api('POST', `/api/aprobaciones/${A.aprob.id}`, { action: 'approve' });
    assert(r.status === 200 && r.json.Status_AP === 'Aprobada', `status ${r.status} ${JSON.stringify(r.json)}`);
    const g = await graph.get(LIST_IDS.pedidoCompras, A.pedidoId);
    assert(g.Status_PC === 'Aprobada', `pedido Status=${g.Status_PC}`);
    return 'pedido→Aprobada';
  });
  await R.test('POST /api/compras/[id] receive → 200 (ingresa a stock)', async () => {
    const r = await api('POST', `/api/compras/${A.pedidoId}`, { action: 'receive', observacion: 'recibido e2e' });
    assert(r.status === 200 && r.json.Status_PC === 'Recibida', `status ${r.status} ${JSON.stringify(r.json)}`);
    // el item es único → recibir creó una fila nueva en 04.Stock. Buscarla y limpiarla.
    const rows = await graph.list(LIST_IDS.stock, { filter: `fields/Lodge_ST eq '${TAG}-A'` });
    assert(rows.length >= 1, `no se creó fila de stock (Lodge_ST=${TAG}-A)`);
    for (const row of rows) R.cleanup(`borrar stock ${row.id} (Lodge_ST=${TAG}-A, cant=${row.Cantidad_ST})`, () => graph.del(LIST_IDS.stock, row.id));
    assert(String(rows[0].Cantidad_ST) === '3', `stock cant=${rows[0].Cantidad_ST} (esperaba 3)`);
    return `stock creado id=${rows[0].id} cant=${rows[0].Cantidad_ST}`;
  });

  // ===== Pedido B: anular =====
  let B;
  await R.test('POST /api/compras/[id] anular → 200 Anulado', async () => {
    B = await crearPedido(`${TAG}-B`, 1);
    const r = await api('POST', `/api/compras/${B.pedidoId}`, { action: 'anular' });
    assert(r.status === 200 && r.json.Status_PC === 'Anulado', `status ${r.status} ${JSON.stringify(r.json)}`);
    const g = await graph.get(LIST_IDS.pedidoCompras, B.pedidoId);
    assert(g.Status_PC === 'Anulado', `Status=${g.Status_PC}`);
    return 'Anulado';
  });

  // ===== Pedido C: approve-request → aprobaciones reject =====
  let C;
  await R.test('POST /api/aprobaciones/[id] reject → 200 (pedido→Rechazada)', async () => {
    C = await crearPedido(`${TAG}-C`, 1);
    const rr = await api('POST', `/api/compras/${C.pedidoId}`, { action: 'approve-request' });
    assert(rr.status === 200, `approve-request status ${rr.status}`);
    C.aprob = await findAprob(C.pedidoId);
    assert(C.aprob, 'no se creó aprobación C');
    const r = await api('POST', `/api/aprobaciones/${C.aprob.id}`, { action: 'reject', reason: 'test e2e' });
    assert(r.status === 200 && r.json.Status_AP === 'Rechazada', `status ${r.status} ${JSON.stringify(r.json)}`);
    const g = await graph.get(LIST_IDS.pedidoCompras, C.pedidoId);
    assert(g.Status_PC === 'Rechazada', `pedido Status=${g.Status_PC}`);
    return 'pedido→Rechazada';
  });
} finally {
  await R.runCleanups();
  R.report();
}
