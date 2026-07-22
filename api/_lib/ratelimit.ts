// Rate limiting del login (anti fuerza bruta) vía la REST API de Upstash Redis.
// SIN dependencias npm: usa el `fetch` global (el mismo que el cliente Graph).
//
// Ventana FIJA con INCR + EXPIRE NX (INCR es atómico en Redis, alcanza de sobra para frenar
// fuerza bruta / credential stuffing). Se limita por IP + usuario, así un ataque a una cuenta
// puntual no bloquea a toda una oficina que comparte IP.
//
// FAIL-OPEN: si faltan las env vars (todavía no conectaste la base) o Upstash no responde, NO
// bloquea el login. Se puede deployar YA; se "activa" solo cuando la integración de Vercel inyecta
// UPSTASH_REDIS_REST_URL/TOKEN (o KV_REST_API_URL/TOKEN) en el proyecto.
import type { VercelRequest } from '@vercel/node';

const PREFIX = 'washin:desktop:login';
const LIMIT = 5; // intentos permitidos por ventana (el 6º se bloquea)
const WINDOW_SECONDS = 15 * 60; // ventana de 15 min

function pickEnv(...names: string[]): string | undefined {
  for (const n of names) {
    const v = process.env[n];
    if (v) return v;
  }
  return undefined;
}
// Fallback: escanea process.env por sufijo, para tolerar cualquier prefijo que Vercel anteponga
// (ej. el prefijo custom "UPSTASH_REDIS" da UPSTASH_REDIS_KV_REST_API_URL / _TOKEN).
function scanEnv(match: (key: string) => boolean): string | undefined {
  for (const [k, v] of Object.entries(process.env)) {
    if (v && match(k)) return v;
  }
  return undefined;
}

function upstashConfig(): { url: string; token: string } | null {
  const url =
    pickEnv('UPSTASH_REDIS_REST_URL', 'KV_REST_API_URL', 'UPSTASH_REDIS_KV_REST_API_URL') ??
    scanEnv((k) => k.endsWith('REST_API_URL') || k.endsWith('REDIS_REST_URL'));
  const token =
    pickEnv('UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_KV_REST_API_TOKEN') ??
    scanEnv((k) => (k.endsWith('REST_API_TOKEN') || k.endsWith('REDIS_REST_TOKEN')) && !k.includes('READ_ONLY'));
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

/** IP del cliente. `x-real-ip` lo fija Vercel (no lo puede falsear el cliente); XFF como fallback. */
export function clientIp(req: VercelRequest): string {
  const real = req.headers['x-real-ip'];
  if (real) return (Array.isArray(real) ? real[0] : real).trim() || 'unknown';
  const xff = req.headers['x-forwarded-for'];
  const first = Array.isArray(xff) ? xff[0] : (xff ?? '').split(',')[0];
  return (first || '').trim() || 'unknown';
}

export interface RateResult {
  ok: boolean;
  /** Segundos hasta poder reintentar (0 si ok). */
  retryAfter: number;
}

/**
 * Consume un intento de login para (ip, usuario). Devuelve ok=false si superó el límite.
 * Fail-open ante cualquier problema (sin Upstash configurado, timeout, error) → ok=true.
 */
export async function checkLoginRateLimit(ip: string, usuario: string): Promise<RateResult> {
  const cfg = upstashConfig();
  if (!cfg) return { ok: true, retryAfter: 0 }; // sin Upstash → inerte

  const key = `${PREFIX}:${ip}:${usuario.toLowerCase()}`;
  try {
    // Pipeline: INCR (contador) + EXPIRE NX (TTL una sola vez, arranca en el 1er intento) + TTL.
    const res = await fetch(`${cfg.url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, String(WINDOW_SECONDS), 'NX'],
        ['TTL', key],
      ]),
      signal: AbortSignal.timeout(2000), // no colgar el login si Upstash tarda
    });
    if (!res.ok) throw new Error(`upstash ${res.status}`);
    const data = (await res.json()) as { result?: unknown }[];
    const count = Number(data?.[0]?.result ?? 0);
    if (count > LIMIT) {
      const ttl = Number(data?.[2]?.result ?? WINDOW_SECONDS);
      return { ok: false, retryAfter: ttl > 0 ? ttl : WINDOW_SECONDS };
    }
    return { ok: true, retryAfter: 0 };
  } catch (err) {
    console.error('[ratelimit] fail-open:', err instanceof Error ? err.message : err);
    return { ok: true, retryAfter: 0 };
  }
}
