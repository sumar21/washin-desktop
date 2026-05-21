import { Outlet, Navigate, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';
import { ConfirmDialog } from '@/components/Modal';
import { useAppStore } from '@/store/useAppStore';

export function AppShell() {
  const navigate = useNavigate();
  const VarUsuario = useAppStore((s) => s.VarUsuario);
  const cerrarSesion = useAppStore((s) => s.cerrarSesion);
  const setCerrarSesion = useAppStore((s) => s.setCerrarSesion);
  const logout = useAppStore((s) => s.logout);
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);

  if (!VarUsuario) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="relative flex h-full w-full bg-gradient-to-br from-[#0a0f1c] via-[#0f1a2e] to-[#0a0f1c]">
      <Sidebar />

      <main className="relative flex-1 overflow-hidden">
        <div className="relative h-full w-full overflow-hidden rounded-tl-3xl bg-wash-canvas ring-1 ring-white/5">
          <Outlet />
        </div>
      </main>

      {/* Collapse handle (rendered outside Sidebar so it stays above modals) */}
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        className="absolute top-[78px] z-[60] flex h-7 w-7 items-center justify-center rounded-full bg-wash-brand text-white shadow-lg ring-[3px] ring-[#0a0f1c] transition-all duration-300 ease-out hover:bg-wash-brand-dark"
        style={{ left: (collapsed ? 72 : 200) - 14 }}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

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
