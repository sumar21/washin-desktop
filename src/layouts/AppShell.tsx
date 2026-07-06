import { useEffect, useState } from 'react';
import { Outlet, Navigate, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';
import { ConfirmDialog } from '@/components/Modal';
import { useAppStore } from '@/store/useAppStore';

export function AppShell() {
  const navigate = useNavigate();
  const VarUsuario = useAppStore((s) => s.VarUsuario);
  const cerrarSesion = useAppStore((s) => s.cerrarSesion);
  const setCerrarSesion = useAppStore((s) => s.setCerrarSesion);
  const logout = useAppStore((s) => s.logout);
  const restoreSession = useAppStore((s) => s.restoreSession);

  // Si se entra directo a una ruta interna (F5 en /home, /stock, etc.) el store
  // arranca en blanco — hay que intentar restaurar la sesión desde la cookie
  // antes de decidir si mandar a /login (si no, un refresh siempre te patea afuera).
  const [checking, setChecking] = useState(() => !useAppStore.getState().VarUsuario);

  useEffect(() => {
    // Ya había sesión al montar (lazy initializer de `checking` la vio) — nada que hacer.
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
      <Sidebar />

      <main className="relative flex-1 overflow-hidden bg-wash-canvas">
        <Outlet />
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
