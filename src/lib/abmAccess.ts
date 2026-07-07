import type { UserRole } from '@/types/domain';

/**
 * Control de acceso a los ABMs de Configuración, fiel a PowerApps
 * (`cmbox_tipo_CR.Items` + `DisplayMode`):
 *  - Admin / Supervisor Mantenimiento / Supervisor Líder → ven y editan Rutas, Circuitos y Edificios.
 *  - Supervisor Ventilaciones / Atención al Cliente → ven Edificios en SOLO LECTURA.
 *  - Resto → sin acceso a Configuración.
 * El backend replica esta matriz para gatear los writes (ver `abmAccess`/`canEditAbm` en api/_lib/lists.ts).
 */
export type AbmTab = 'Rutas' | 'Circuitos' | 'Edificios';

const ABM_EDIT_ROLES: UserRole[] = ['Admin', 'Supervisor Mantenimiento', 'Supervisor Lider'];
const ABM_READONLY_EDIFICIOS_ROLES: UserRole[] = ['Supervisor Ventilaciones', 'Atencion Al Cliente'];

export interface AbmAccess {
  /** Pestañas visibles, en orden. */
  tabs: AbmTab[];
  /** ¿Puede editar (crear/modificar/eliminar)? Si es false, es solo-lectura. */
  canEdit: boolean;
}

export function abmAccess(rol: UserRole | null | undefined): AbmAccess {
  if (rol && ABM_EDIT_ROLES.includes(rol)) return { tabs: ['Rutas', 'Circuitos', 'Edificios'], canEdit: true };
  if (rol && ABM_READONLY_EDIFICIOS_ROLES.includes(rol)) return { tabs: ['Edificios'], canEdit: false };
  return { tabs: [], canEdit: false };
}

export function canAccessAbm(rol: UserRole | null | undefined, tab: AbmTab): boolean {
  return abmAccess(rol).tabs.includes(tab);
}

export function canEditAbm(rol: UserRole | null | undefined, tab: AbmTab): boolean {
  const a = abmAccess(rol);
  return a.canEdit && a.tabs.includes(tab);
}
