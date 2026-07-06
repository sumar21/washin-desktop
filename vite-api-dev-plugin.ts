import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin, ViteDevServer } from 'vite';

/**
 * Simula el ruteo por sistema de archivos de Vercel Functions para `/api/*`
 * durante `vite dev` (modo `full`) — sin depender de `vercel dev` ni de estar
 * logueado/linkeado a un proyecto de Vercel. Solo para desarrollo local; en
 * build de producción este plugin no se activa y Vercel sirve `api/` como
 * siempre lo hace.
 *
 * Convención soportada (igual a Vercel): `api/foo.ts` -> `/api/foo`,
 * `api/foo/index.ts` -> `/api/foo`, `api/foo/[id].ts` -> `/api/foo/:id`.
 */

interface ResolvedRoute {
  file: string;
  params: Record<string, string>;
}

function findDynamicFile(dir: string): { file: string; paramName: string } | null {
  if (!fs.existsSync(dir)) return null;
  const match = fs.readdirSync(dir).find((f) => /^\[.+\]\.ts$/.test(f));
  if (!match) return null;
  return { file: path.join(dir, match), paramName: match.slice(1, match.indexOf(']')) };
}

function resolveApiFile(apiDir: string, urlPath: string): ResolvedRoute | null {
  const segments = urlPath.split('/').filter(Boolean);
  if (segments.length === 0) return null;

  let dir = apiDir;
  const params: Record<string, string> = {};

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const isLast = i === segments.length - 1;

    if (!isLast) {
      const nextDir = path.join(dir, seg);
      if (fs.existsSync(nextDir) && fs.statSync(nextDir).isDirectory()) {
        dir = nextDir;
        continue;
      }
      return null; // segmentos de directorio dinámico no soportados (no se usan hoy)
    }

    const exactFile = path.join(dir, `${seg}.ts`);
    if (fs.existsSync(exactFile)) return { file: exactFile, params };

    const dirIndex = path.join(dir, seg, 'index.ts');
    if (fs.existsSync(dirIndex)) return { file: dirIndex, params };

    const dynamic = findDynamicFile(dir);
    if (dynamic) return { file: dynamic.file, params: { ...params, [dynamic.paramName]: seg } };

    return null;
  }
  return null;
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      if (!data) return resolve(undefined);
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve(undefined);
      }
    });
    req.on('error', reject);
  });
}

type MinimalVercelResponse = ServerResponse & {
  status(code: number): MinimalVercelResponse;
  json(payload: unknown): MinimalVercelResponse;
};

function adaptResponse(res: ServerResponse): MinimalVercelResponse {
  const adapted = res as MinimalVercelResponse;
  adapted.status = (code: number) => {
    res.statusCode = code;
    return adapted;
  };
  adapted.json = (payload: unknown) => {
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(payload));
    return adapted;
  };
  return adapted;
}

export function apiDevPlugin(): Plugin {
  const apiDir = path.resolve(__dirname, 'api');

  return {
    name: 'api-dev-plugin',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();

        const urlPath = req.url.slice('/api'.length).split('?')[0];
        const route = resolveApiFile(apiDir, urlPath);
        if (!route) return next();

        try {
          const mod = await server.ssrLoadModule(route.file);
          const handler = mod.default as (req: unknown, res: unknown) => unknown;

          const search = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
          const query = { ...Object.fromEntries(new URLSearchParams(search)), ...route.params };
          const body = req.method && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)
            ? await readJsonBody(req)
            : undefined;

          const vercelReq = Object.assign(req, { body, query });
          const vercelRes = adaptResponse(res);
          await handler(vercelReq, vercelRes);
        } catch (err) {
          console.error(`[api-dev-plugin] ${urlPath} ->`, err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
          }
          res.end(JSON.stringify({ error: 'dev_server_error', message: String(err) }));
        }
      });
    },
  };
}
