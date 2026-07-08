/**
 * Capa reutilizable del dashboard (constantes + formatters) — adaptación del
 * recipe 4.6 del DESIGN.md (Sumar UI Kit) a este repo: Tailwind v4 y la marca
 * cian (`wash-*` / `--color-chart-*`) en vez del bordó del kit.
 *
 * Los componentes (KpiCard, SectionTitle, …) viven en `widgets.tsx`.
 */

// ── Formatters ──────────────────────────────────────────────────────────────
const nf0 = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
export const intFmt = (n: number) => nf0.format(Math.round(n || 0));
export const money = (n: number) => `$${nf0.format(Math.round(n || 0))}`;
export const pct = (n: number) => `${(n || 0).toFixed(1)}%`;

// ── Paleta de charts (Recharts es la única librería) ─────────────────────────
// Rampa FRÍA de marca (cian → azul → violeta → slate). A propósito NO usa verde/ámbar/rojo:
// la marca es cian y esos colores se veían fuera de gama. Los estados (good/warning) usan
// tokens de status dedicados, no esta rampa categórica.
export const CHART_COLORS = [
  'var(--color-chart-1)', // cian (marca)
  'var(--color-chart-2)', // azul
  'rgb(124 111 240)', // violeta
  'var(--color-wash-brand-dark)', // cian oscuro
  'rgb(94 200 235)', // cian claro
  'rgb(120 160 200)', // slate
  'rgb(42 111 176)', // azul profundo
];
export const chartColor = (i: number) => CHART_COLORS[i % CHART_COLORS.length];

// Estilo de ejes/grid: spread en <CartesianGrid>/<XAxis>/<YAxis>.
export const CHART_GRID = { strokeDasharray: '3 3', stroke: 'var(--color-wash-border)' } as const;
export const X_TICK = { fontSize: 11, fill: 'var(--color-wash-text-muted)' } as const;
export const Y_TICK = { fontSize: 10, fill: 'var(--color-wash-text-faint)' } as const;
export const AXIS = { axisLine: false as const, tickLine: false as const };
