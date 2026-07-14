import { useEffect, useState } from 'react';
import { Outlet, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Loader2, Menu, X } from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';
import { ConfirmDialog } from '@/components/Modal';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import { moduleNameForPath } from '@/lib/nav';

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const VarUsuario = useAppStore((s) => s.VarUsuario);
  const cerrarSesion = useAppStore((s) => s.cerrarSesion);
  const setCerrarSesion = useAppStore((s) => s.setCerrarSesion);
  const logout = useAppStore((s) => s.logout);
  const restoreSession = useAppStore((s) => s.restoreSession);

  // Único estado JS "mobile": el drawer de navegación (DESIGN.md §5.10).
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Si se entra directo a una ruta interna (F5 en /home, /stock, etc.) el store
  // arranca en blanco — hay que intentar restaurar la sesión desde la cookie
  // antes de decidir si mandar a /login (si no, un refresh siempre te patea afuera).
  const [checking, setChecking] = useState(() => !useAppStore.getState().VarUsuario);

  useEffect(() => {
    if (useAppStore.getState().VarUsuario) return;
    let cancelled = false;
    restoreSession().finally(() => {
      if (!cancelled) setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, [restoreSession]);

  if (checking) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-wash-canvas">
        <Loader2 className="animate-spin text-wash-primary" size={28} />
      </div>
    );
  }

  if (!VarUsuario) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="relative flex h-full w-full bg-gradient-to-b from-wash-navy to-wash-navy-deep">
      {/* Sidebar desktop (≥md) */}
      <div className="hidden lg:flex">
        <Sidebar />
      </div>

      {/* Columna de contenido: header mobile + main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header mobile (<md) — hamburguesa + módulo. `pt` = safe-area del notch:
            con viewport-fit=cover el gradiente de marca llena la barra de estado. */}
        <header className="shrink-0 pt-[env(safe-area-inset-top)] text-white lg:hidden">
          <div className="flex h-14 items-center justify-between border-b border-white/15 px-4">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                aria-label="Abrir menú"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/90 hover:bg-white/10"
              >
                <Menu size={22} />
              </button>
              <span className="truncate font-display text-lg font-black tracking-tight">
                {moduleNameForPath(location.pathname)}
              </span>
            </div>
            {/* Slot para acciones de la pantalla (ej. botón Descansos del Home) — las
                pantallas lo llenan por portal para no ocupar espacio en el contenido. */}
            <div id="app-header-actions" className="flex shrink-0 items-center gap-1.5" />
          </div>
        </header>

        {/* `pb` = safe-area del home-indicator: el canvas gris llena la franja de abajo. */}
        <main className="relative flex-1 overflow-hidden bg-wash-canvas pb-[env(safe-area-inset-bottom)]">
          <Outlet />
        </main>
      </div>

      {/* Drawer mobile (<md) */}
      {/* Backdrop */}
      <div
        onClick={() => setDrawerOpen(false)}
        className={cn(
          'fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 lg:hidden',
          drawerOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        aria-hidden
      />
      {/* Panel */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] bg-gradient-to-b from-wash-navy to-wash-navy-deep shadow-2xl transition-transform duration-300 ease-out lg:hidden',
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        aria-hidden={!drawerOpen}
      >
        <button
          type="button"
          onClick={() => setDrawerOpen(false)}
          aria-label="Cerrar menú"
          className="absolute right-2 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
        >
          <X size={18} />
        </button>
        <Sidebar drawer onNavigate={() => setDrawerOpen(false)} />
      </aside>

      <ConfirmDialog
        open={cerrarSesion}
        title="Cerrar sesión"
        message="¿Estás seguro que querés cerrar la sesión?"
        confirmLabel="Cerrar sesión"
        cancelLabel="Cancelar"
        onCancel={() => setCerrarSesion(false)}
        onConfirm={() => {
          logout();
          navigate('/login', { replace: true });
        }}
      />
    </div>
  );
}
