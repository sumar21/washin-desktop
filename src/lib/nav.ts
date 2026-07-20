import {
  Home,
  Package,
  ShoppingCart,
  CheckCircle2,
  WashingMachine,
  AlertOctagon,
  HardHat,
  Map,
  Wind,
  BarChart3,
  Settings,
} from 'lucide-react';
import type { ModuloNombre, UserRole } from '@/types/domain';

/** Config de navegación compartida entre el Sidebar (desktop/drawer) y el header mobile. */
export const moduleMeta: Record<ModuloNombre, { icon: typeof Home; path: string }> = {
  Home: { icon: Home, path: '/home' },
  Stock: { icon: Package, path: '/stock' },
  Compras: { icon: ShoppingCart, path: '/compras' },
  'Mis Aprobaciones': { icon: CheckCircle2, path: '/aprobaciones' },
  'Detalle Maquinas': { icon: WashingMachine, path: '/detalle-maquina' },
  Incidentes: { icon: AlertOctagon, path: '/incidentes' },
  'Stock Tecnico': { icon: HardHat, path: '/stock-tecnicos' },
  Planificaciones: { icon: Map, path: '/rutas' },
  Ventilacion: { icon: Wind, path: '/ventilaciones' },
  Dashboard: { icon: BarChart3, path: '/dashboard' },
  Configuracion: { icon: Settings, path: '/configuracion' },
};

/**
 * Dashboard es un módulo transversal (no vive en 99.ListaPermisosDesktop): se
 * inyecta en el sidebar para roles de supervisión/administración.
 */
const DASHBOARD_ROLES: UserRole[] = [
  'Admin',
  'Supervisor Lider',
  'Supervisor Mantenimiento',
  'Supervisor Ventilaciones',
];
export function canSeeDashboard(rol: UserRole | null | undefined): boolean {
  return !!rol && DASHBOARD_ROLES.includes(rol);
}

/** Tabs del Dashboard (deben coincidir con los `TabId` de Dashboard.tsx). */
export type DashboardTabId = 'general' | 'visitas' | 'incidentes';
const ALL_DASHBOARD_TABS: DashboardTabId[] = ['general', 'visitas', 'incidentes'];
// Roles con acceso PARCIAL al dashboard: solo ven un subconjunto de tabs.
const DASHBOARD_TABS_BY_ROLE: Partial<Record<UserRole, DashboardTabId[]>> = {
  'Supervisor Lider': ['visitas'],
};
/** Tabs del Dashboard que el rol puede ver (vacío ⇒ sin acceso). */
export function dashboardTabsForRole(rol: UserRole | null | undefined): DashboardTabId[] {
  if (!canSeeDashboard(rol)) return [];
  return DASHBOARD_TABS_BY_ROLE[rol!] ?? ALL_DASHBOARD_TABS;
}

/** Roles que pueden crear/borrar/modificar planificaciones. Supervisor + Jefe Taller: solo-lectura. */
const PLANIF_READONLY_ROLES: UserRole[] = ['Supervisor', 'Jefe Taller'];
export function canEditPlanif(rol: UserRole | null | undefined): boolean {
  return !!rol && !PLANIF_READONLY_ROLES.includes(rol);
}

/** Nombre del módulo cuya ruta matchea el pathname actual (para el título del header mobile). */
export function moduleNameForPath(pathname: string): string {
  const entries = Object.entries(moduleMeta) as [ModuloNombre, { path: string }][];
  // El match más largo gana (ej. /configuracion/circuito → Configuracion).
  const found = entries
    .filter(([, m]) => pathname.startsWith(m.path))
    .sort((a, b) => b[1].path.length - a[1].path.length)[0];
  return found?.[0] ?? 'Wash Inn';
}
