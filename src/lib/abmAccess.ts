import type { UserRole } from '@/types/domain';
import { abmAccessMatrix, canEditAbmTab, canDeleteAbmTab, type AbmTab } from '@/lib/abmAccessMatrix';

/**
 * Control de acceso a los ABMs de Configuración, fiel a PowerApps
 * (`cmbox_tipo_CR.Items` + `DisplayMode`):
 *  - Admin / Supervisor Mantenimiento / Supervisor Líder → ven y editan Rutas, Circuitos y Edificios.
 *  - Supervisor Ventilaciones / Atención al Cliente → ven Edificios en SOLO LECTURA.
 *  - Resto → sin acceso a Configuración.
 * La matriz vive en `@/lib/abmAccessMatrix` (único origen de verdad); el backend
 * la importa igual para gatear los writes (ver `abmAccess`/`canEditAbm` en api/_lib/lists.ts).
 */
export type { AbmTab };

export interface AbmAccess {
  /** Pestañas visibles, en orden. */
  tabs: AbmTab[];
  /** ¿Puede crear/editar? Si es false, es solo-lectura. */
  canEdit: boolean;
  /** Pestañas donde edita pero NO puede borrar (baja). */
  noDeleteTabs?: AbmTab[];
}

export function abmAccess(rol: UserRole | null | undefined): AbmAccess {
  return abmAccessMatrix(rol);
}

export function canAccessAbm(rol: UserRole | null | undefined, tab: AbmTab): boolean {
  return abmAccess(rol).tabs.includes(tab);
}

export function canEditAbm(rol: UserRole | null | undefined, tab: AbmTab): boolean {
  return canEditAbmTab(rol, tab);
}

/** ¿El rol puede dar de baja en el ABM `tab`? (Ej.: Supervisor Líder NO en Edificios). */
export function canDeleteAbm(rol: UserRole | null | undefined, tab: AbmTab): boolean {
  return canDeleteAbmTab(rol, tab);
}
