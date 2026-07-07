import { api, assert, makeRunner } from './lib.mjs';

const R = makeRunner();
const isArr = (x) => Array.isArray(x);

await R.test('GET /api/health → 200 ok', async () => {
  const r = await api('GET', '/api/health'); assert(r.status === 200 && r.json?.ok, JSON.stringify(r.json)); return `token=${r.json.token}`;
});
await R.test('GET /api/auth/me → 200 sesión', async () => {
  const r = await api('GET', '/api/auth/me'); assert(r.status === 200 && r.json?.usuario, JSON.stringify(r.json)); return r.json.rol;
});
await R.test('GET /api/auth/me sin cookie → 401', async () => {
  const r = await api('GET', '/api/auth/me', null, { cookie: '' }); assert(r.status === 401, `status ${r.status}`);
});
await R.test('GET /api/home → 200', async () => {
  const r = await api('GET', '/api/home'); assert(r.status === 200 && r.json, JSON.stringify(r.json).slice(0, 120)); return Object.keys(r.json).join(',');
});
await R.test('GET /api/catalog → 200', async () => {
  const r = await api('GET', '/api/catalog'); assert(r.status === 200 && r.json, 'no json'); return `${(r.json.segmentos?.length ?? r.json.catalog?.length ?? '?')} segs`;
});
await R.test('GET /api/users/tecnicos → 200 array', async () => {
  const r = await api('GET', '/api/users/tecnicos'); assert(r.status === 200 && isArr(r.json), 'no array'); return `${r.json.length} técnicos`;
});
let maquinaConcat = null;
await R.test('GET /api/maquinas → 200', async () => {
  const r = await api('GET', '/api/maquinas'); assert(r.status === 200 && isArr(r.json.maquinas), 'no maquinas'); maquinaConcat = r.json.maquinas[0]?.Concat_DM || r.json.maquinas[0]?.ConcatMaquina_DM; return `${r.json.maquinas.length} máquinas, ${r.json.edificios.length} edificios`;
});
await R.test('GET /api/maquinas/historial → 200', async () => {
  const c = maquinaConcat || 'x'; const r = await api('GET', `/api/maquinas/historial?concat=${encodeURIComponent(c)}`); assert(r.status === 200, `status ${r.status}`); return `concat="${c}" → ${isArr(r.json) ? r.json.length + ' movs' : 'ok'}`;
});
await R.test('GET /api/maquinas/historial sin concat → 400', async () => {
  const r = await api('GET', '/api/maquinas/historial'); assert(r.status === 400, `status ${r.status}`);
});
await R.test('GET /api/incidentes → 200', async () => {
  const r = await api('GET', '/api/incidentes'); assert(r.status === 200 && isArr(r.json.incidentes), 'no incidentes'); return `${r.json.incidentes.length} incidentes`;
});
await R.test('GET /api/compras → 200', async () => {
  const r = await api('GET', '/api/compras'); assert(r.status === 200 && isArr(r.json.pedidos), 'no pedidos'); return `${r.json.pedidos.length} pedidos, ${r.json.detalles.length} detalles`;
});
await R.test('GET /api/aprobaciones → 200 array', async () => {
  const r = await api('GET', '/api/aprobaciones'); assert(r.status === 200 && isArr(r.json), 'no array'); return `${r.json.length} aprobaciones`;
});
await R.test('GET /api/ventilaciones (bundle) → 200', async () => {
  const r = await api('GET', '/api/ventilaciones'); assert(r.status === 200 && isArr(r.json.ventilaciones), 'no ventilaciones'); return `${r.json.ventilaciones.length} vents, ${r.json.edificios?.length ?? 0} edif`;
});
await R.test('GET /api/ventilaciones?mes=MM/YYYY → 200', async () => {
  const r = await api('GET', '/api/ventilaciones?mes=07/2026'); assert(r.status === 200 && isArr(r.json.ventilaciones), 'no ventilaciones'); return `${r.json.ventilaciones.length} vents`;
});
await R.test('GET /api/stock → 200 array', async () => {
  const r = await api('GET', '/api/stock'); assert(r.status === 200 && isArr(r.json), 'no array'); return `${r.json.length} items`;
});
await R.test('GET /api/stock-tecnicos → 200', async () => {
  const r = await api('GET', '/api/stock-tecnicos'); assert(r.status === 200 && isArr(r.json.stockTecnicos), 'no stockTecnicos'); return `${r.json.stockTecnicos.length} repuestos`;
});
await R.test('GET /api/planificaciones → 200', async () => {
  const r = await api('GET', '/api/planificaciones'); assert(r.status === 200 && r.json, 'no json'); return Object.keys(r.json).join(',');
});
await R.test('GET /api/abm → 200', async () => {
  const r = await api('GET', '/api/abm'); assert(r.status === 200 && r.json, 'no json'); return Object.keys(r.json).join(',');
});
// ── auth (sin escritura) ──
await R.test('POST /api/auth/login vacío → 400', async () => {
  const r = await api('POST', '/api/auth/login', {}); assert(r.status === 400, `status ${r.status}`);
});
await R.test('POST /api/auth/login inválido → 401', async () => {
  const r = await api('POST', '/api/auth/login', { usuario: 'noexiste@x.com', password: 'malaclave123' }); assert(r.status === 401, `status ${r.status}`);
});
await R.test('POST /api/auth/logout → 200', async () => {
  const r = await api('POST', '/api/auth/logout'); assert(r.status === 200 && r.json?.ok, JSON.stringify(r.json));
});
// ── method guards (405) ──
await R.test('GET /api/incidentes/[id] (POST-only) → 405', async () => {
  const r = await api('GET', '/api/incidentes/1'); assert(r.status === 405, `status ${r.status}`);
});

R.report();
