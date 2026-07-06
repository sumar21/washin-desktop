import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Endpoint TEMPORAL de diagnóstico (GET, sin login). Reporta si las env vars están
 * presentes (sin filtrar sus valores) y si el token de Graph se obtiene bien. Sirve para
 * depurar el deploy en Vercel. **Borrar cuando el login ande.**
 *
 * Es self-contained a propósito (no importa nada de ./_lib) para aislar problemas de
 * resolución de módulos: si este endpoint responde JSON pero /api/auth/login tira 500,
 * el problema NO es el runtime/imports sino la data (env vars o credenciales).
 */
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const keys = ['AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET', 'SESSION_SECRET'];
  const env = Object.fromEntries(
    keys.map((k) => {
      const v = process.env[k] ?? '';
      return [
        k,
        {
          present: v.length > 0,
          length: v.length, // solo el largo, nunca el valor
          hasQuotes: /^["']|["']$/.test(v), // detecta comillas pegadas por error
          hasSpaces: v !== v.trim(), // detecta espacios/saltos de línea sobrantes
        },
      ];
    })
  );

  let token: Record<string, unknown> = { tried: false };
  try {
    const tenant = (process.env.AZURE_TENANT_ID ?? '').trim();
    const body = new URLSearchParams({
      client_id: (process.env.AZURE_CLIENT_ID ?? '').trim(),
      client_secret: (process.env.AZURE_CLIENT_SECRET ?? '').trim(),
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    });
    const r = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const text = await r.text();
    // En caso de error, el cuerpo de Microsoft trae el código AADSTS (útil), sin el secret.
    token = { tried: true, ok: r.ok, status: r.status, detail: r.ok ? 'token OK' : text.slice(0, 400) };
  } catch (e) {
    token = { tried: true, ok: false, error: String(e).slice(0, 400) };
  }

  return res.status(200).json({ ok: true, node: process.version, vercel: !!process.env.VERCEL, env, token });
}
