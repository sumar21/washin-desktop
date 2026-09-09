/**
 * Cliente mínimo de Microsoft Graph (app-only / client credentials) contra el
 * sitio de SharePoint "Nueva". Token y site id se cachean en memoria del
 * proceso — persisten entre invocaciones mientras la lambda esté "warm".
 *
 * El site id NO se toma de SHAREPOINT_SITE_ID (esa variable puede desincronizarse
 * del tenant real); se resuelve siempre vía host:path y se cachea acá.
 */

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const SITE_HOST_PATH = 'sumardigital.sharepoint.com:/sites/Nueva';

let cachedToken: { value: string; expiresAt: number } | null = null;
let cachedSiteId: string | null = null;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) return cachedToken.value;

  const tenantId = requireEnv('AZURE_TENANT_ID');
  const clientId = requireEnv('AZURE_CLIENT_ID');
  const clientSecret = requireEnv('AZURE_CLIENT_SECRET');

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    throw new Error(`No se pudo obtener el token de Graph (status ${res.status})`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, expiresAt: now + json.expires_in * 1000 };
  return cachedToken.value;
}

async function getSiteId(): Promise<string> {
  if (cachedSiteId) return cachedSiteId;
  const token = await getAccessToken();
  const res = await fetch(`${GRAPH_BASE}/sites/${SITE_HOST_PATH}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`No se pudo resolver el sitio de SharePoint (status ${res.status})`);
  const json = (await res.json()) as { id: string };
  cachedSiteId = json.id;
  return cachedSiteId;
}

export class GraphError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** `url` puede ser un path relativo (`/sites/...`) o una URL absoluta (para seguir @odata.nextLink). */
async function graphRequest<T>(url: string, init?: RequestInit): Promise<T | null> {
  const token = await getAccessToken();
  const res = await fetch(url.startsWith('http') ? url : `${GRAPH_BASE}${url}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new GraphError(res.status, `Graph ${init?.method ?? 'GET'} ${url} -> ${res.status}: ${text.slice(0, 300)}`);
  }
  if (res.status === 204) return null;
  return (await res.json()) as T;
}

export interface SharePointItem {
  id: string;
  [field: string]: unknown;
}

interface ListItemsPage {
  value: { id: string; fields: Record<string, unknown> }[];
  '@odata.nextLink'?: string;
}

/** Trae TODOS los items de una lista (sigue @odata.nextLink), aplanando `fields` + `id` en un solo objeto. */
export async function listItems(
  listId: string,
  opts: { select?: string[]; filter?: string; top?: number } = {}
): Promise<SharePointItem[]> {
  const siteId = await getSiteId();
  const params = new URLSearchParams();
  params.set('$expand', opts.select ? `fields($select=${opts.select.join(',')})` : 'fields');
  if (opts.filter) params.set('$filter', opts.filter);
  params.set('$top', String(opts.top ?? 200));

  // Las columnas de estas listas no están indexadas — Graph exige este header
  // para permitir $filter sobre ellas (si no, responde 400).
  const filterHeaders = opts.filter ? { Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly' } : undefined;

  let url = `/sites/${siteId}/lists/${listId}/items?${params.toString()}`;
  const out: SharePointItem[] = [];
  while (url) {
    const page = await graphRequest<ListItemsPage>(url, { headers: filterHeaders });
    if (!page) break;
    for (const item of page.value) out.push({ id: item.id, ...item.fields });
    url = page['@odata.nextLink'] ?? '';
  }
  return out;
}

export async function getItem(
  listId: string,
  itemId: string | number,
  select?: string[]
): Promise<SharePointItem | null> {
  const siteId = await getSiteId();
  const expand = select ? `fields($select=${select.join(',')})` : 'fields';
  try {
    const item = await graphRequest<{ id: string; fields: Record<string, unknown> }>(
      `/sites/${siteId}/lists/${listId}/items/${itemId}?$expand=${expand}`
    );
    return item ? { id: item.id, ...item.fields } : null;
  } catch (err) {
    if (err instanceof GraphError && err.status === 404) return null;
    throw err;
  }
}

export async function createItem(listId: string, fields: Record<string, unknown>): Promise<SharePointItem> {
  const siteId = await getSiteId();
  const created = await graphRequest<{ id: string; fields: Record<string, unknown> }>(
    `/sites/${siteId}/lists/${listId}/items`,
    { method: 'POST', body: JSON.stringify({ fields }) }
  );
  return { id: created!.id, ...created!.fields };
}

export async function updateItem(
  listId: string,
  itemId: string | number,
  fields: Record<string, unknown>
): Promise<void> {
  const siteId = await getSiteId();
  await graphRequest(`/sites/${siteId}/lists/${listId}/items/${itemId}/fields`, {
    method: 'PATCH',
    body: JSON.stringify(fields),
  });
}

/**
 * Resuelve el id de una lista por su displayName, cacheado por proceso.
 *
 * El resto del repo direcciona por GUID hardcodeado en LIST_IDS, que es más rápido y explícito.
 * Esto existe para listas nuevas: el GUID recién se conoce DESPUÉS de crear la lista en
 * SharePoint, así que hardcodearlo obligaría a un paso manual entre crear la lista y que el
 * módulo ande — y si alguien se lo saltea, falla en runtime con un 404 opaco.
 */
const listIdPorNombre = new Map<string, string>();
export async function resolveListIdByName(displayName: string): Promise<string> {
  const cacheado = listIdPorNombre.get(displayName);
  if (cacheado) return cacheado;
  const siteId = await getSiteId();
  const page = await graphRequest<{ value: { id: string; displayName: string }[] }>(
    `/sites/${siteId}/lists?$select=id,displayName&$top=200`,
  );
  for (const l of page?.value ?? []) listIdPorNombre.set(l.displayName, l.id);
  const found = listIdPorNombre.get(displayName);
  if (!found) throw new GraphError(404, `Lista no encontrada: ${displayName}`);
  return found;
}

/** Lista los archivos de una carpeta de la biblioteca "Documentos" del sitio. */
export async function listarArchivosCarpeta(carpeta: string): Promise<
  { id: string; nombre: string; tamano: number; mime: string; url?: string }[]
> {
  const siteId = await getSiteId();
  const ruta = carpeta.split('/').map(encodeURIComponent).join('/');
  try {
    const r = await graphRequest<{
      value?: {
        id: string;
        name: string;
        size?: number;
        file?: { mimeType?: string };
        '@microsoft.graph.downloadUrl'?: string;
      }[];
    }>(
      `/sites/${siteId}/drive/root:/${ruta}:/children` +
        `?$select=id,name,size,file,@microsoft.graph.downloadUrl&$top=100`,
    );
    return (r?.value ?? [])
      .filter((x) => x.file)
      .map((x) => ({
        id: x.id,
        nombre: x.name,
        tamano: x.size ?? 0,
        mime: x.file?.mimeType ?? 'application/octet-stream',
        url: x['@microsoft.graph.downloadUrl'],
      }));
  } catch (err) {
    // Carpeta inexistente = novedad sin evidencia, no es un error.
    if (err instanceof GraphError && err.status === 404) return [];
    throw err;
  }
}

/**
 * Cuántos archivos tiene cada subcarpeta de `raiz`, en UNA sola llamada.
 *
 * Graph devuelve `folder.childCount` por subcarpeta, así que el contador de adjuntos de todas las
 * novedades sale de un request. Por eso la lista NO guarda una columna con el número: un contador
 * guardado hay que mantenerlo sincronizado y se desfasa si una subida falla a mitad.
 */
export async function contarPorSubcarpeta(raiz: string): Promise<Map<string, number>> {
  const siteId = await getSiteId();
  const ruta = raiz.split('/').map(encodeURIComponent).join('/');
  const out = new Map<string, number>();
  try {
    const r = await graphRequest<{ value?: { name: string; folder?: { childCount?: number } }[] }>(
      `/sites/${siteId}/drive/root:/${ruta}:/children?$select=name,folder&$top=999`,
    );
    for (const x of r?.value ?? []) {
      if (x.folder) out.set(x.name, x.folder.childCount ?? 0);
    }
  } catch (err) {
    // Todavía no se subió ninguna evidencia: la raíz no existe y no hay nada que contar.
    if (!(err instanceof GraphError && err.status === 404)) throw err;
  }
  return out;
}
