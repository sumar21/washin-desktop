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
  Wrench,
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
  Repuestos: { icon: Wrench, path: '/repuestos' },
  Configuracion: { icon: Settings, path: '/configuracion' },
};

/**
 * Dashboard es un módulo transversal (no vive en 99.ListaPermisosDesktop): se
 * inyecta en el sidebar para roles de supervisión/administración.
 */
const DASHBOARD_ROLES: UserRole[] = [
  'Admin',
  'Supervisor Lider',
  'Supervisor',
  'Supervisor Mantenimiento',
  'Supervisor Ventilaciones',
];
export function canSeeDashboard(rol: UserRole | null | undefined): boolean {
  return !!rol && DASHBOARD_ROLES.includes(rol);
}

/**
 * Repuestos (catálogo con precio) también es transversal: se inyecta en el sidebar
 * para administración/mantenimiento. Solo Admin / Jefe Taller pueden editar el precio
 * (el resto lo ve en solo-lectura; el gate real de escritura vive en el backend).
 */
const REPUESTOS_ROLES: UserRole[] = [
  'Admin',
  'Jefe Taller',
  'Supervisor Lider',
  'Supervisor Mantenimiento',
];
export function canSeeRepuestos(rol: UserRole | null | undefined): boolean {
  return !!rol && REPUESTOS_ROLES.includes(rol);
}

/** ¿El rol puede editar el precio de un repuesto? (mismo gate que el backend). */
export function canEditRepuestoPrecio(rol: UserRole | null | undefined): boolean {
  return rol === 'Admin' || rol === 'Jefe Taller';
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
