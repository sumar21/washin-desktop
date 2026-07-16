import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Estado vacío reusable y on-brand: badge con ícono (tono semántico) + título +
 * subtítulo y acción opcionales. Reemplaza los "No hay…"/"Sin datos" planos de todo
 * el repo. `DataTable` ya acepta `empty: ReactNode`, así que se pasa directo.
 *
 *  - tone     → color del badge del ícono (brand/emerald/amber/rose/neutral).
 *  - compact  → variante para modales / celdas de tabla (menos alto).
 *  - pulse    → halo animado detrás del badge (invita a usar la acción, ej. "+").
 *  - action   → slot para un <Button> (Crear…, Limpiar filtros, etc.).
 */
type EmptyTone = 'brand' | 'emerald' | 'amber' | 'rose' | 'neutral';

const TONE: Record<EmptyTone, string> = {
  brand: 'bg-wash-brand/10 text-wash-brand ring-wash-brand/25',
  emerald: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/25',
  amber: 'bg-amber-500/10 text-amber-600 ring-amber-500/25',
  rose: 'bg-rose-500/10 text-rose-600 ring-rose-500/25',
  neutral: 'bg-wash-surface-2 text-wash-text-muted ring-wash-border',
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = 'brand',
  compact = false,
  pulse = false,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  tone?: EmptyTone;
  compact?: boolean;
  pulse?: boolean;
  className?: string;
}) {
  const badgeBg = TONE[tone].split(' ')[0];
  return (
    <div
      className={cn(
        'flex w-full flex-1 flex-col items-center justify-center px-6 text-center',
        compact ? 'min-h-[140px] py-6' : 'min-h-[220px] py-10',
        className
      )}
    >
      <div className="relative mb-3">
        {pulse && <span className={cn('absolute inset-0 animate-ping rounded-2xl opacity-60', badgeBg)} />}
        <div
          className={cn(
            'relative flex items-center justify-center rounded-2xl ring-1',
            compact ? 'h-12 w-12' : 'h-16 w-16',
            TONE[tone]
          )}
        >
          <Icon size={compact ? 22 : 28} strokeWidth={1.6} />
        </div>
      </div>
      <p className={cn('font-display font-bold text-wash-text-strong', compact ? 'text-sm' : 'text-[15px]')}>{title}</p>
      {description && (
        <p className="mt-1 max-w-[300px] text-[12px] leading-relaxed text-wash-text-muted">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
