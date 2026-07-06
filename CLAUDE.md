# CLAUDE.md

Guía para agentes trabajando en **washin-desktop** (app de escritorio Wash Inn).

## Stack

- **Vite 8 + React 19 + TypeScript**, SPA.
- **Tailwind v4** (CSS-first: `@import "tailwindcss"` + bloque `@theme` en [src/index.css](src/index.css)). **No hay `tailwind.config.js`** ni PostCSS config — el theme vive en el CSS.
- **shadcn/ui** estilo `radix-nova` (ver [components.json](components.json)), primitivos en [src/components/ui/](src/components/ui/) sobre `radix-ui` + `class-variance-authority`.
- **Zustand** para estado ([src/store/useAppStore.ts](src/store/useAppStore.ts)).
- **react-router-dom v7** ([src/router.tsx](src/router.tsx)), **date-fns**, **recharts**, **lucide-react**.
- Alias `@/` → `src/` (ver [vite.config.ts](vite.config.ts)). Usar imports `@/...`.

## Comandos

- `npm run dev` — servidor de desarrollo (Vite).
- `npm run build` — `tsc -b && vite build`.
- `npm run lint` — ESLint.
- `npm run preview` — sirve el build.

## Estructura

```
src/
├─ main.tsx · router.tsx        # entry + rutas
├─ layouts/AppShell.tsx         # shell con sidebar
├─ screens/                     # vistas (Home, Compras, Stock, Rutas, Incidentes, ...)
│  └─ config/                   # subpantallas de Configuración (+ _helpers.ts)
├─ components/                  # DataTable, Modal, PageHeader, Sidebar, StatusBadge, Logo...
│  └─ ui/                       # primitivos shadcn (button, card, select, popover, ...)
├─ store/useAppStore.ts         # estado global (zustand)
├─ lib/utils.ts                 # cn(), proper(), formatToday(), tipoLabel(), ...
├─ types/ · mock/               # tipos + datos mock
└─ index.css                    # Tailwind v4 @theme (tokens de color de marca)
```

## Diseño / UI — leer [DESIGN.md](DESIGN.md)

[DESIGN.md](DESIGN.md) es el **Sumar UI Kit**, la referencia canónica de UI del estudio. **Antes de crear o modificar cualquier UI** (componentes, modales, vistas, tablas, dashboards, emails), leelo y seguí sus **recetas de composición** (sección 4: modal de formulario, modal de confirmación, drawer lateral, página estándar, sidebar, dashboard), sus **reglas de oro** (sección 7) y su intención de **tokens** (radios, sombras, spacing, tipografía Inter, escala de z-index, roles de color, control de acceso por rol de la sección 6).

**Cómo aplica a ESTE repo** (importante — el kit está escrito para otra baseline; acá se adapta así):

- **Reutilizá los primitivos existentes de [src/components/ui/](src/components/ui/)** (shadcn/radix). No inventes variantes nuevas de Button/Card/Modal/Select ni reimplementes dropdowns; si falta algo, componelo con los primitivos que ya hay respetando los tokens. Usá siempre `cn()` de [src/lib/utils.ts](src/lib/utils.ts).
- **NO copies el setup Tailwind v3 del kit.** Las secciones 0.2, 1.1, 1.2 y 1.3 del DESIGN.md (`postcss.config.js`, `tailwind.config.js`, `tailwindcss-animate`, `index.css` con `:root`) asumen **Tailwind v3**. Este repo usa **Tailwind v4** con `@theme` en [src/index.css](src/index.css) — no agregues esos archivos.
- **Color de marca:** el kit usa `--brand` (bordó). Acá la marca es **cian** y vive en el bloque `@theme` de [src/index.css](src/index.css) como `--color-wash-brand` (+ tokens `--color-wash-*` y los semánticos shadcn `--color-primary`, etc.). No hardcodees colores de marca fuera de esos tokens ni introduzcas el bordó del kit.
- Tomá del DESIGN.md los **principios y recetas** (estructura de modal/página/sidebar/dashboard, jerarquía tipográfica, uso de estados/badges, z-index, reglas de oro), no el stack literal.

En resumen: **DESIGN.md manda en el "cómo se ve y se compone"; los tokens y primitivos concretos son los de este repo (Tailwind v4 + shadcn + marca cian).**
