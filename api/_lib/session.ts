import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Sesión mínima: cookie httpOnly con un payload JSON + firma HMAC-SHA256
 * (formato `base64url(payload).base64url(firma)`, sin dependencias externas).
 * No es una tabla de sesiones — el estado vive enteramente en la cookie.
 */

export const SESSION_COOKIE_NAME = 'washin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12h

export interface SessionPayload {
  usuario: string;
  rol: string;
  nombre: string;
  apellido: string;
  exp: number;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('Falta la variable de entorno SESSION_SECRET');
  return secret;
}

function sign(data: string): string {
  return createHmac('sha256', getSecret()).update(data).digest('base64url');
}

// `Secure` exige HTTPS real — en local (`vite --mode full`) corremos sobre http://
// plano y algunos navegadores descartan la cookie en silencio si la mandamos igual.
// Vercel define `VERCEL` en todo deploy (prod y preview, siempre HTTPS); localmente
// no está seteada.
function cookieAttrs(maxAgeSeconds: number): string {
  const parts = ['HttpOnly', 'SameSite=Lax', 'Path=/', `Max-Age=${maxAgeSeconds}`];
  if (process.env.VERCEL) parts.push('Secure');
  return parts.join('; ');
}

export function createSessionCookie(user: Omit<SessionPayload, 'exp'>): string {
  const payload: SessionPayload = { ...user, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS };
  const encoded = base64url(JSON.stringify(payload));
  const signature = sign(encoded);
  const value = `${encoded}.${signature}`;
  return `${SESSION_COOKIE_NAME}=${value}; ${cookieAttrs(SESSION_TTL_SECONDS)}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; ${cookieAttrs(0)}`;
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

/** Verifica la cookie de sesión del request. Devuelve `null` si falta, es inválida, o expiró. */
export function readSession(cookieHeader: string | undefined): SessionPayload | null {
  const raw = parseCookies(cookieHeader)[SESSION_COOKIE_NAME];
  if (!raw) return null;

  const dot = raw.lastIndexOf('.');
  if (dot === -1) return null;
  const encoded = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);

  const expected = sign(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
