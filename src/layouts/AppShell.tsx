import { Outlet, Navigate, useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { ConfirmDialog } from '@/components/Modal';
import { useAppStore } from '@/store/useAppStore';

export function AppShell() {
  const navigate = useNavigate();
  const VarUsuario = useAppStore((s) => s.VarUsuario);
  const cerrarSesion = useAppStore((s) => s.cerrarSesion);
  const setCerrarSesion = useAppStore((s) => s.setCerrarSesion);
  const logout = useAppStore((s) => s.logout);

  if (!VarUsuario) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="relative flex h-full w-full bg-gradient-to-b from-wash-navy to-wash-navy-deep">
      <Sidebar />

      <main className="relative flex-1 overflow-hidden">
        <div className="relative h-full w-full overflow-hidden rounded-tl-3xl bg-wash-canvas ring-1 ring-black/5">
          <Outlet />
        </div>
      </main>

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
