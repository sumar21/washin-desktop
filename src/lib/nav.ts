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
  Metricas: { icon: BarChart3, path: '/metricas' },
  Configuracion: { icon: Settings, path: '/configuracion' },
};

/**
 * Métricas es un módulo transversal (no vive en 99.ListaPermisosDesktop): se
 * inyecta en el sidebar para roles de supervisión/administración.
 */
const METRICAS_ROLES: UserRole[] = [
  'Admin',
  'Supervisor Lider',
  'Supervisor',
  'Supervisor Mantenimiento',
  'Supervisor Ventilaciones',
];
export function canSeeMetricas(rol: UserRole | null | undefined): boolean {
  return !!rol && METRICAS_ROLES.includes(rol);
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
