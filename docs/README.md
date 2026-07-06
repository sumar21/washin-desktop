# Washin Desktop — Documentación

App de escritorio (web) para la gestión operativa de **Wash Inn**: mantenimiento de
máquinas de lavandería (lavadoras, secadoras, cargadoras, expendedoras) instaladas en
edificios, con rutas de técnicos, control de stock, compras con aprobaciones, incidentes
y ventilaciones.

Es una **réplica en React** de una app PowerApps existente (`Washinn Desktop.msapp`, en la
raíz del repo). La base de datos son **listas de SharePoint**; el backend futuro las
consultará vía **Microsoft Graph** desde **funciones serverless en Vercel**.

## Índice

- [data-model.md](./data-model.md) — modelo de datos: listas de SharePoint, entidades, convención de campos.
- [modules.md](./modules.md) — módulos/pantallas, qué hace cada uno y los flujos de negocio clave.
- [backend.md](./backend.md) — plan del backend: Microsoft Graph + SharePoint, auth, endpoints serverless, deploy en Vercel.

## Estado actual

- **Backend real** (`api/`, ver [backend.md](./backend.md)): **Login, Home y Stock** ya hablan
  con Microsoft Graph / SharePoint reales (no mock). El resto de los módulos (Compras,
  Aprobaciones, Incidentes, Stock Técnico, Planificaciones, Ventilaciones, Configuración) sigue
  en el store mock — se van migrando de a uno con el mismo patrón.
- **Frontend**: `src/store/useAppStore.ts` combina ambas fuentes: `login`/`restoreSession`/
  `fetchHome`/`fetchStock`/`addStock`/`patchStock` llaman a `src/services/api.ts` (real); el
  resto de las `Collect*`/acciones siguen leyendo `src/mock/`.

## Stack

- Vite 8 + React 19 + TypeScript, SPA (`react-router-dom` v7).
- Tailwind v4 (CSS-first, `@theme` en `src/index.css`) + primitivos shadcn en `src/components/ui/`.
- Zustand (estado), Recharts (charts), date-fns, lucide-react (íconos).
- Diseño: ver [../CLAUDE.md](../CLAUDE.md) y [../DESIGN.md](../DESIGN.md) (Sumar UI Kit, marca cian).

## Cómo correr

```bash
npm install
npm run dev        # solo frontend — /api no responde, login real fallará
npm run dev:full    # frontend + api/ real contra Graph/SharePoint (requiere .env, ver .env.example)
```

Con `npm run dev` el login **no funciona** (llama a `/api/auth/login`, que no está montado en
ese modo) — usalo solo para tocar UI que no dependa de auth/Home/Stock. Con `npm run dev:full`
el login es **real**: usuario/contraseña de la lista `Usuarios` de SharePoint (no hay usuarios
mock ya). La sesión vive en una cookie httpOnly firmada — sobrevive a un refresh de página.

Otros scripts: `npm run build` (`tsc -b && vite build`), `npm run lint`, `npm run preview`.
