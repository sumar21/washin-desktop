// ── Matriz de acceso ABM: ÚNICO origen de verdad (compartido front + back) ──
// Fiel a PowerApps (`cmbox_tipo_CR.Items` + `DisplayMode`). Importado por el
// front (src/lib/abmAccess.ts, tipado con UserRole) y por el back
// (api/_lib/lists.ts, gate server-side de los writes). Mantener acá para evitar
// drift entre los dos gates. Módulo puro (solo strings) — sin deps de dominio,
// node ni DOM — para que compile en ambos tsconfig (app + api).

export type AbmTab = 'Rutas' | 'Circuitos' | 'Edificios' | 'Repuestos' | 'Usuarios';

export interface AbmMatrix {
  /** Pestañas ABM visibles, en orden. */
  tabs: AbmTab[];
  /** ¿Puede crear/editar los ABM visibles? Si es false, es solo-lectura. */
  canEdit: boolean;
  /**
   * Pestañas donde el rol PUEDE editar (canEdit=true) pero NO puede borrar (baja).
   * Ej.: Supervisor Líder edita Edificios pero no los da de baja. Vacío/ausente ⇒
   * borrar sigue a canEdit.
   */
  noDeleteTabs?: AbmTab[];
}

// Sup. Mantenimiento edita Rutas/Circuitos/Edificios/Repuestos (full). Admin y
// Supervisor Líder se resuelven en ramas propias (ver abajo).
const ABM_EDIT_ROLES = new Set(['Supervisor Mantenimiento']);
// Roles que ven SOLO Edificios en modo lectura (sin crear/editar/borrar).
const ABM_READONLY_EDIFICIOS_ROLES = new Set(['Supervisor Ventilaciones', 'Atencion Al Cliente', 'Supervisor']);
// El catálogo de repuestos lo maneja el taller: Jefe Taller ve SOLO esa pestaña.
const REPUESTOS_ONLY_ROLES = new Set(['Jefe Taller']);

/** Pestañas ABM visibles + si el rol puede editar (o es solo-lectura). */
export function abmAccessMatrix(rol: string | null | undefined): AbmMatrix {
  // El ABM de Usuarios administra credenciales/roles → SOLO Admin.
  if (rol === 'Admin') return { tabs: ['Rutas', 'Circuitos', 'Edificios', 'Repuestos', 'Usuarios'], canEdit: true };
  // Supervisor Líder: ve Rutas/Circuitos/Edificios (NO Repuestos), edita todo pero
  // NO puede dar de baja Edificios (Rutas/Circuitos siguen full).
  if (rol === 'Supervisor Lider') return { tabs: ['Rutas', 'Circuitos', 'Edificios'], canEdit: true, noDeleteTabs: ['Edificios'] };
  if (rol && ABM_EDIT_ROLES.has(rol)) return { tabs: ['Rutas', 'Circuitos', 'Edificios', 'Repuestos'], canEdit: true };
  if (rol && REPUESTOS_ONLY_ROLES.has(rol)) return { tabs: ['Repuestos'], canEdit: true };
  if (rol && ABM_READONLY_EDIFICIOS_ROLES.has(rol)) return { tabs: ['Edificios'], canEdit: false };
  return { tabs: [], canEdit: false };
}

/** ¿El rol puede EDITAR (crear/modificar) el ABM `tab`? */
export function canEditAbmTab(rol: string | null | undefined, tab: AbmTab): boolean {
  const a = abmAccessMatrix(rol);
  return a.canEdit && a.tabs.includes(tab);
}

/** ¿El rol puede BORRAR (baja) en el ABM `tab`? Requiere edición y que el tab no sea no-borrable. */
export function canDeleteAbmTab(rol: string | null | undefined, tab: AbmTab): boolean {
  const a = abmAccessMatrix(rol);
  if (!a.canEdit || !a.tabs.includes(tab)) return false;
  return !a.noDeleteTabs?.includes(tab);
}
