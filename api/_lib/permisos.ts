import { listItems, type SharePointItem } from './graph.js';
import { LIST_IDS, modulosPermitidos, permisosSelectFields } from './lists.js';

/**
 * Gate server-side de escritura reutilizando 99.ListaPermisosDesktop (LPP), el
 * MISMO mecanismo que arma el sidebar. Un rol puede escribir en un módulo solo si
 * lo tiene habilitado en LPP → consistente-por-construcción con lo que ve el front
 * (si ve el módulo, puede escribir; si no, se bloquea). Configurable desde SharePoint
 * como apagar botones en la PowerApp, sin listas de roles hardcodeadas.
 */

const TTL_MS = 5 * 60 * 1000; // 5 min

// Cache por instancia (las serverless functions reutilizan la instancia "caliente").
// La lista es chica (~10 filas) y cambia rara vez: un TTL corto evita pegarle a Graph
// en cada write sin arriesgar quedar desincronizado por mucho tiempo.
let cache: { rows: SharePointItem[]; at: number } | null = null;

async function getPermisoRows(): Promise<SharePointItem[]> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.rows;
  const rows = await listItems(LIST_IDS.permisosDesktop, { select: permisosSelectFields() });
  cache = { rows, at: now };
  return rows;
}

/**
 * ¿El rol tiene habilitado el módulo `modulo` en LPP? Usa exactamente la misma
 * lógica (`modulosPermitidos`) que la visibilidad del sidebar, así el gate no puede
 * divergir de lo que el usuario ve. Admin pasa siempre que su columna Admin_LPP esté
 * en 'SI' (igual que en el sidebar).
 */
export async function puedeAccederModulo(rol: string, modulo: string): Promise<boolean> {
  const rows = await getPermisoRows();
  return modulosPermitidos(rows, rol).some((m) => m.Modulo_LPP === modulo);
}
