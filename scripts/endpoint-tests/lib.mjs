import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// .env en la raíz del repo (este archivo vive en scripts/endpoint-tests/).
const ENVPATH = fileURLToPath(new URL('../../.env', import.meta.url));
const env = Object.fromEntries(
  fs.readFileSync(ENVPATH, 'utf8').split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

export const BASE = 'http://localhost:5173';
export const LIST_IDS = {
  usuarios: 'abe151cc-f0cc-4ff2-a79e-fc0121c3dd41', stock: '37f239e9-4076-4f5c-a8aa-c052447bfc1a',
  pedidoCompras: '76288cb9-70e7-4839-b427-9c5148773f75', detalleCompra: '51fb2d13-d77c-4823-af16-f08e4ad41d9f',
  aprobaciones: '08ff6d69-082a-46fa-9eb2-108be44dade1', incidentes: 'ad39289f-3acf-4028-826a-a2c5458cb79f',
  detalleMaquina: '53e0e6a3-a3a5-498c-87b6-1f12b578ba8d',
  repuestosTecnico: 'ccede13f-55cc-453f-b1bf-fac99d13b68a', ventilaciones: 'a4e28738-1007-4218-aec0-9f8cda7e10ee',
  edificios: 'd57217b1-54a0-40eb-8193-60915d9e66a7', rutas: 'd16a7a8f-c21d-4c20-96a9-0a27c088f636',
  resumenCircuito: '3ed8507c-6f16-4a3a-b256-0fb20acea0f2', detalleCircuito: '13186fc6-1b8c-453e-8183-7ee760e09e6f',
  mesesPlanif: 'e3e8a011-90dd-43e1-adf4-d9d9ac2d261e', resumenPlanif: '1a5986e8-9367-4350-ae2a-5b3755a7098e',
  detallePlanif: 'bf4452b0-50b8-406c-8988-3c57b393a195', edificiosVisitar: '717028c9-9949-494b-9ee8-a1a7089f6f5b',
};

// ── sesión admin ──
function cookie(rol = 'Admin') {
  const p = Buffer.from(JSON.stringify({ usuario: 'test-e2e@sumardigital.com.ar', rol, nombre: 'Test', apellido: 'E2E', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  return `washin_session=${p}.${createHmac('sha256', env.SESSION_SECRET).update(p).digest('base64url')}`;
}
export const ADMIN_COOKIE = cookie('Admin');

export async function api(method, path, body, { cookie: ck = ADMIN_COOKIE } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(ck ? { Cookie: ck } : {}) },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}

// ── Graph directo (para capturar/revertir/borrar) ──
const GRAPH = 'https://graph.microsoft.com/v1.0';
let _tok = null, _site = null;
async function token() {
  if (_tok && _tok.exp > Date.now() + 60000) return _tok.v;
  const b = new URLSearchParams({ client_id: env.AZURE_CLIENT_ID, client_secret: env.AZURE_CLIENT_SECRET, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' });
  const r = await fetch(`https://login.microsoftonline.com/${env.AZURE_TENANT_ID}/oauth2/v2.0/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: b });
  if (!r.ok) throw new Error('graph token ' + r.status);
  const j = await r.json(); _tok = { v: j.access_token, exp: Date.now() + j.expires_in * 1000 }; return _tok.v;
}
async function siteId() {
  if (_site) return _site;
  const r = await fetch(`${GRAPH}/sites/sumardigital.sharepoint.com:/sites/Nueva`, { headers: { Authorization: `Bearer ${await token()}` } });
  if (!r.ok) throw new Error('site ' + r.status); _site = (await r.json()).id; return _site;
}
async function g(path, init) {
  const r = await fetch(path.startsWith('http') ? path : `${GRAPH}${path}`, { ...init, headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  if (!r.ok) { const t = await r.text().catch(() => ''); throw new Error(`Graph ${init?.method ?? 'GET'} ${path} -> ${r.status}: ${t.slice(0, 200)}`); }
  if (r.status === 204) return null; return r.json();
}
export const graph = {
  async list(listId, { filter, top = 50 } = {}) {
    const s = await siteId(); const p = new URLSearchParams(); p.set('$expand', 'fields'); p.set('$top', String(top));
    if (filter) p.set('$filter', filter);
    const j = await g(`/sites/${s}/lists/${listId}/items?${p}`, { headers: filter ? { Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly' } : undefined });
    return (j.value || []).map(it => ({ id: it.id, ...it.fields }));
  },
  async get(listId, id) { const s = await siteId(); try { const j = await g(`/sites/${s}/lists/${listId}/items/${id}?$expand=fields`); return { id: j.id, ...j.fields }; } catch (e) { if (String(e).includes('404')) return null; throw e; } },
  async create(listId, fields) { const s = await siteId(); const j = await g(`/sites/${s}/lists/${listId}/items`, { method: 'POST', body: JSON.stringify({ fields }) }); return { id: j.id, ...j.fields }; },
  async patch(listId, id, fields) { const s = await siteId(); await g(`/sites/${s}/lists/${listId}/items/${id}/fields`, { method: 'PATCH', body: JSON.stringify(fields) }); },
  async del(listId, id) { const s = await siteId(); await g(`/sites/${s}/lists/${listId}/items/${id}`, { method: 'DELETE' }); },
};

// ── runner ──
export function makeRunner() {
  const results = [];
  const cleanups = []; // {label, fn}
  const R = {
    async test(name, fn) {
      try { const extra = await fn(); results.push({ name, pass: true, extra: extra || '' }); console.log(`✅ ${name}${extra ? '  ' + extra : ''}`); }
      catch (e) { results.push({ name, pass: false, extra: String(e.message || e) }); console.log(`❌ ${name}  ${String(e.message || e).slice(0, 200)}`); }
    },
    cleanup(label, fn) { cleanups.push({ label, fn }); },
    async runCleanups() {
      console.log(`\n── Limpieza (${cleanups.length} acciones) ──`);
      for (const c of cleanups.reverse()) {
        try { await c.fn(); console.log(`  🧹 ${c.label}`); }
        catch (e) { console.log(`  ⚠️  FALLÓ limpiar: ${c.label} → ${String(e.message || e).slice(0, 160)}`); }
      }
    },
    report() {
      const p = results.filter(r => r.pass).length;
      console.log(`\n========== ${p}/${results.length} PASS ==========`);
      const fails = results.filter(r => !r.pass);
      if (fails.length) { console.log('FALLIDOS:'); fails.forEach(f => console.log(`  ❌ ${f.name}: ${f.extra}`)); }
      return { pass: p, total: results.length, results };
    },
    results,
  };
  return R;
}

export function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
