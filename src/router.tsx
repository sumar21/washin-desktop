import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '@/layouts/AppShell';
import { Start } from '@/screens/Start';
import { Login } from '@/screens/Login';
import { Home } from '@/screens/Home';
import { Stock } from '@/screens/Stock';
import { StockTecnicos } from '@/screens/StockTecnicos';
import { Compras } from '@/screens/Compras';
import { Aprobaciones } from '@/screens/Aprobaciones';
import { Incidentes } from '@/screens/Incidentes';
import { DetalleMaquina } from '@/screens/DetalleMaquina';
import { Rutas } from '@/screens/Rutas';
import { DetallePlanificacion } from '@/screens/DetallePlanificacion';
import { Ventilaciones } from '@/screens/Ventilaciones';
import { Dashboard } from '@/screens/Dashboard';
import { Configuracion } from '@/screens/Configuracion';
import { DetalleCircuito } from '@/screens/DetalleCircuito';

export const router = createBrowserRouter([
  { path: '/', element: <Start /> },
  { path: '/login', element: <Login /> },
  {
    element: <AppShell />,
    children: [
      { path: '/home', element: <Home /> },
      { path: '/stock', element: <Stock /> },
      { path: '/stock-tecnicos', element: <StockTecnicos /> },
      { path: '/compras', element: <Compras /> },
      { path: '/aprobaciones', element: <Aprobaciones /> },
      { path: '/incidentes', element: <Incidentes /> },
      { path: '/detalle-maquina', element: <DetalleMaquina /> },
      { path: '/rutas', element: <Rutas /> },
      { path: '/planificacion/detalle', element: <DetallePlanificacion /> },
      { path: '/ventilaciones', element: <Ventilaciones /> },
      { path: '/dashboard', element: <Dashboard /> },
      { path: '/metricas', element: <Navigate to="/dashboard" replace /> },
      { path: '/configuracion', element: <Configuracion /> },
      { path: '/configuracion/circuito', element: <DetalleCircuito /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
