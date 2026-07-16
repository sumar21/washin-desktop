// ── Matriz de acceso ABM: ÚNICO origen de verdad (compartido front + back) ──
// Fiel a PowerApps (`cmbox_tipo_CR.Items` + `DisplayMode`). Importado por el
// front (src/lib/abmAccess.ts, tipado con UserRole) y por el back
// (api/_lib/lists.ts, gate server-side de los writes). Mantener acá para evitar
// drift entre los dos gates. Módulo puro (solo strings) — sin deps de dominio,
// node ni DOM — para que compile en ambos tsconfig (app + api).

export type AbmTab = 'Rutas' | 'Circuitos' | 'Edificios' | 'Repuestos';

const ABM_EDIT_ROLES = new Set(['Admin', 'Supervisor Mantenimiento', 'Supervisor Lider']);
const ABM_READONLY_EDIFICIOS_ROLES = new Set(['Supervisor Ventilaciones', 'Atencion Al Cliente']);
// El catálogo de repuestos lo maneja el taller: Jefe Taller ve SOLO esa pestaña.
const REPUESTOS_ONLY_ROLES = new Set(['Jefe Taller']);

/** Pestañas ABM visibles + si el rol puede editar (o es solo-lectura). */
export function abmAccessMatrix(rol: string | null | undefined): { tabs: AbmTab[]; canEdit: boolean } {
  if (rol && ABM_EDIT_ROLES.has(rol)) return { tabs: ['Rutas', 'Circuitos', 'Edificios', 'Repuestos'], canEdit: true };
  if (rol && REPUESTOS_ONLY_ROLES.has(rol)) return { tabs: ['Repuestos'], canEdit: true };
  if (rol && ABM_READONLY_EDIFICIOS_ROLES.has(rol)) return { tabs: ['Edificios'], canEdit: false };
  return { tabs: [], canEdit: false };
}
