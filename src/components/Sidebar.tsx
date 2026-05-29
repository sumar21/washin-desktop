import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home,
  Package,
  ShoppingCart,
  CheckCircle2,
  Wrench,
  AlertOctagon,
  HardHat,
  Map,
  Wind,
  Settings,
  LogOut,
  RotateCw,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ModuloNombre } from '@/types/domain';

const moduleMeta: Record<ModuloNombre, { icon: typeof Home; path: string }> = {
  Home: { icon: Home, path: '/home' },
  Stock: { icon: Package, path: '/stock' },
  Compras: { icon: ShoppingCart, path: '/compras' },
  'Mis Aprobaciones': { icon: CheckCircle2, path: '/aprobaciones' },
  'Detalle Maquinas': { icon: Wrench, path: '/detalle-maquina' },
  Incidentes: { icon: AlertOctagon, path: '/incidentes' },
  'Stock Tecnico': { icon: HardHat, path: '/stock-tecnicos' },
  Planificaciones: { icon: Map, path: '/rutas' },
  Ventilacion: { icon: Wind, path: '/ventilaciones' },
  Configuracion: { icon: Settings, path: '/configuracion' },
};

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const Collect_LPP = useAppStore((s) => s.Collect_LPP);
  const setCerrarSesion = useAppStore((s) => s.setCerrarSesion);
  const VarUsuario = useAppStore((s) => s.VarUsuario);
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);

  const ordered = [...Collect_LPP].sort((a, b) => a.Orden_LPP - b.Orden_LPP);

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={cn(
          'relative z-30 flex h-full flex-col border-r border-white/15 bg-black/[0.06] transition-[width] duration-300 ease-out',
          collapsed ? 'w-[72px]' : 'w-[200px]'
        )}
      >

        {/* Logo */}
        <div
          className={cn(
            'flex h-[88px] items-center border-b border-white/15',
            collapsed ? 'justify-center' : 'justify-start px-4'
          )}
        >
          {collapsed ? (
            <img
              src="/Logoapp.png"
              alt="Washinn"
              className="h-10 w-10 rounded-xl shadow-md ring-1 ring-white/25"
            />
          ) : (
            <div className="flex items-center gap-2.5">
              <img
                src="/Logoapp.png"
                alt="Washinn"
                className="h-10 w-10 rounded-xl shadow-md ring-1 ring-white/25"
              />
              <div className="flex flex-col leading-none">
                <span className="font-display text-[17px] font-black tracking-tight text-white">
                  Wash Inn
                </span>
                <span className="mt-1 inline-flex w-fit items-center rounded-md bg-white/20 px-1.5 py-[2px] text-[8.5px] font-bold uppercase tracking-[0.2em] text-white">
                  Desktop
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Collapse handle — subtle bar under the logo */}
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          className={cn(
            'group flex items-center border-b border-white/10 text-[10px] font-semibold uppercase tracking-widest text-white/30 transition-colors hover:bg-white/5 hover:text-white/70',
            collapsed ? 'justify-center py-2' : 'justify-end gap-1.5 px-4 py-1.5'
          )}
        >
          {collapsed ? (
            <ChevronsRight size={14} />
          ) : (
            <>
              <span>Contraer</span>
              <ChevronsLeft size={14} />
            </>
          )}
        </button>

        {/* Modules */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3">
          {ordered.map((perm) => {
            const meta = moduleMeta[perm.Modulo_LPP];
            if (!meta) return null;
            const Icon = meta.icon;
            const active = location.pathname.startsWith(meta.path);
            const buttonEl = (
              <button
                key={perm.ID}
                type="button"
                onClick={() => navigate(meta.path)}
                className={cn(
                  'group flex w-full items-center gap-3 text-left text-[13px] font-medium transition-colors',
                  collapsed ? 'justify-center px-0 py-2.5' : 'px-4 py-2.5',
                  active
                    ? 'border-l-[3px] border-white bg-white/20 font-semibold text-white'
                    : 'border-l-[3px] border-transparent text-white/75 hover:bg-white/10 hover:text-white'
                )}
              >
                <Icon
                  size={18}
                  strokeWidth={active ? 2.2 : 1.6}
                  className="shrink-0"
                />
                {!collapsed && <span className="truncate">{perm.Modulo_LPP}</span>}
              </button>
            );

            if (!collapsed) return buttonEl;

            return (
              <Tooltip key={perm.ID}>
                <TooltipTrigger asChild>{buttonEl}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={12}>
                  {perm.Modulo_LPP}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* Footer: user, refresh, logout */}
        <div className={cn('space-y-2 border-t border-white/10 p-3', collapsed && 'p-2')}>
          {!collapsed && (
            <div className="px-1 text-[11px] uppercase tracking-wider text-white/40">
              {VarUsuario ?? '—'}
            </div>
          )}

          <SidebarAction
            icon={RotateCw}
            label="Refrescar"
            collapsed={collapsed}
            onClick={() => window.location.reload()}
          />

          <SidebarAction
            icon={LogOut}
            label="Cerrar sesión"
            collapsed={collapsed}
            onClick={() => setCerrarSesion(true)}
            danger
          />
        </div>
      </aside>
    </TooltipProvider>
  );
}

interface SidebarActionProps {
  icon: typeof RotateCw;
  label: string;
  collapsed: boolean;
  onClick: () => void;
  danger?: boolean;
}

function SidebarAction({ icon: Icon, label, collapsed, onClick, danger }: SidebarActionProps) {
  const btn = (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
        collapsed && 'justify-center px-0',
        danger
          ? 'text-white/70 hover:bg-rose-500/15 hover:text-rose-300'
          : 'text-white/70 hover:bg-white/10 hover:text-white'
      )}
    >
      <Icon size={16} className="shrink-0" />
      {!collapsed && <span>{label}</span>}
    </button>
  );

  if (!collapsed) return btn;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{btn}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={12}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
