import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface MultiOption {
  value: string;
  label: string;
}

/**
 * Filtro multi-select tipo COMBOBOX BUSCABLE: un trigger (como un select) que abre un
 * dropdown flotante con input de búsqueda + lista de checkboxes. No es un acordeón que
 * empuja el contenido — es un popover que flota (igual que `Combobox`, pero multi-select),
 * así el popover de filtros queda compacto. Si `options` está vacío no renderiza nada.
 * Mantiene la misma API que antes (label/options/selected/onToggle/onClear) para no tocar
 * las pantallas.
 */
export function MultiSelect({
  label,
  options,
  selected,
  onToggle,
  onClear,
  searchable = true,
  maxHeight = 240,
  emptyText = 'Sin resultados',
  placeholder = 'Todos',
  maxRender = 60,
}: {
  label: string;
  options: MultiOption[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear?: () => void;
  searchable?: boolean;
  maxHeight?: number;
  emptyText?: string;
  placeholder?: string;
  maxRender?: number;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options;
    return list.slice(0, maxRender);
  }, [options, q, maxRender]);

  // Sin opciones (dataset vacío) → no renderizar el bloque.
  if (options.length === 0) return null;

  const summary =
    selected.length === 0
      ? placeholder
      : selected.length <= 2
        ? selected.map((v) => options.find((o) => o.value === v)?.label ?? v).join(', ')
        : `${selected.length} seleccionados`;

  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">{label}</label>
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setQ('');
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-wash-border bg-wash-surface px-3 text-sm text-wash-text-strong transition-colors hover:border-wash-brand/40 focus-visible:border-wash-brand focus-visible:ring-2 focus-visible:ring-wash-brand/15"
          >
            <span className="flex min-w-0 flex-1 items-center gap-2">
              {selected.length > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-wash-brand px-1 text-[10px] font-bold text-white tabular-nums">
                  {selected.length}
                </span>
              )}
              <span className={cn('truncate', selected.length === 0 && 'text-wash-text-muted')}>{summary}</span>
            </span>
            <ChevronsUpDown size={15} className="shrink-0 text-wash-text-muted" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          className="z-[80] w-[var(--radix-popover-trigger-width)] min-w-[220px] overflow-hidden rounded-xl border border-wash-border bg-wash-surface p-0 shadow-lg ring-1 ring-black/[0.03]"
        >
          {searchable && (
            <div className="flex items-center gap-2 border-b border-wash-border px-3">
              <Search size={14} className="shrink-0 text-wash-text-muted" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar…"
                className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-wash-text-muted"
              />
            </div>
          )}
          <div className="overflow-y-auto p-1" style={{ maxHeight }}>
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-wash-text-muted">{emptyText}</div>
            ) : (
              filtered.map((o) => {
                const on = selected.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => onToggle(o.value)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-wash-surface-2',
                      on && 'bg-wash-brand/[0.06]'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                        on ? 'border-wash-brand bg-wash-brand text-white' : 'border-wash-border bg-wash-surface'
                      )}
                    >
                      {on && <Check size={11} strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-wash-text-strong">{o.label}</span>
                  </button>
                );
              })
            )}
            {q.trim() === '' && options.length > maxRender && (
              <div className="px-3 py-2 text-center text-[11px] text-wash-text-muted">
                Mostrando {maxRender} de {options.length}. Escribí para filtrar.
              </div>
            )}
          </div>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => (onClear ? onClear() : selected.forEach(onToggle))}
              className="w-full border-t border-wash-border px-3 py-1.5 text-left text-[11px] font-semibold text-wash-text-muted hover:bg-wash-surface-2 hover:text-wash-text-strong"
            >
              Limpiar {label.toLowerCase()}
            </button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
