import type { ElementType, ReactNode } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Widgets reutilizables del dashboard — adaptación del recipe 4.6 del DESIGN.md
 * (Sumar UI Kit) a este repo: primitivos shadcn y marca cian (`wash-*`) en vez
 * del bordó del kit. Todo dashboard nuevo debería componerse con estos widgets
 * en lugar de reinventar KPIs / encabezados / tooltips.
 *
 * Constantes y formatters: ver `shared.ts`.
 */

// ── KpiCard — tarjeta de métrica canónica ────────────────────────────────────
// Icon + label arriba, valor grande, footer opcional (delta o sub).
// `accent` pinta el wash de marca cian.
interface KpiCardProps {
  icon: ElementType;
  label: string;
  value: ReactNode;
  accent?: boolean;
  badge?: string;
  delta?: number;
  deltaLabel?: string;
  /** Invierte el color del delta: subir es "malo" (rojo). Útil para incidentes, mora, etc. */
  invertDelta?: boolean;
  sub?: ReactNode;
}

export function KpiCard({ icon: Icon, label, value, accent, badge, delta, deltaLabel, invertDelta, sub }: KpiCardProps) {
  const hasFooter = delta != null || sub != null;
  return (
    <Card className={cn('ring-wash-border', accent && 'bg-wash-brand/[0.04] ring-wash-brand/25')}>
      <CardContent>
        <div className="flex items-center gap-2 text-wash-text-muted">
          <Icon className={cn('h-4 w-4 shrink-0', accent && 'text-wash-brand')} />
          <span className="truncate text-[11px] font-semibold uppercase tracking-wider">{label}</span>
        </div>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span
            className={cn(
              'font-display text-2xl font-bold tabular-nums text-wash-text-strong',
              accent && 'text-wash-brand-dark'
            )}
          >
            {value}
          </span>
          {badge && (
            <span className="shrink-0 rounded-md bg-wash-brand px-1.5 py-0.5 text-xs font-bold text-white">
              {badge}
            </span>
          )}
        </div>
        {hasFooter && (
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-wash-divider pt-2.5 text-xs text-wash-text-muted">
            {delta != null ? <DeltaChip value={delta} label={deltaLabel ?? ''} invert={invertDelta} /> : sub}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── SectionTitle — encabezado de sección (ícono de marca + texto uppercase) ───
export function SectionTitle({
  icon: Icon,
  children,
  right,
}: {
  icon: ElementType;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-wash-brand" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-wash-text-muted">{children}</h3>
      </div>
      {right}
    </div>
  );
}

// ── DeltaChip — pill de tendencia verde/rojo ─────────────────────────────────
export function DeltaChip({ value, label, invert }: { value: number; label: string; invert?: boolean }) {
  const up = value >= 0; // dirección de la flecha (magnitud)
  const good = invert ? value <= 0 : value >= 0; // sentimiento (color)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
        good ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'
      )}
    >
      {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      {up ? '+' : ''}
      {value.toFixed(1)}%
      {label && <span className="ml-0.5 font-normal text-wash-text-muted/70">{label}</span>}
    </span>
  );
}

// ── Tooltip custom para Recharts (content={<TooltipShell>…}) ──────────────────
export function TooltipShell({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-[150px] rounded-lg border border-wash-border bg-wash-surface px-3 py-2 text-xs shadow-lg">
      {title && <p className="mb-1.5 font-semibold text-wash-text-strong">{title}</p>}
      <div className="space-y-1">{children}</div>
    </div>
  );
}

export function TipRow({ label, value, color }: { label: ReactNode; value: ReactNode; color?: string }) {
  return (
    <div className="flex items-center gap-3">
      {color && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />}
      <span className="text-wash-text-muted">{label}</span>
      <span className="ml-auto font-semibold tabular-nums text-wash-text-strong">{value}</span>
    </div>
  );
}
