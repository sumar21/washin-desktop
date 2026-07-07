import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface ComboboxOption {
  value: string;
  label: string;
  sublabel?: string;
}

/**
 * Single-select buscable (Popover + input + lista virtual-lite). Bindea por
 * `value` único (nunca por label) → seguro ante labels repetidos. Pensado para
 * catálogos grandes (edificios, técnicos): solo renderiza `maxRender` a la vez.
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Seleccionar…',
  searchPlaceholder = 'Buscar…',
  emptyText = 'Sin resultados',
  disabled,
  className,
  maxRender = 60,
}: {
  options: ComboboxOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  maxRender?: number;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle
      ? options.filter(
          (o) => o.label.toLowerCase().includes(needle) || (o.sublabel ?? '').toLowerCase().includes(needle)
        )
      : options;
    return list.slice(0, maxRender);
  }, [options, q, maxRender]);

  return (
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
          disabled={disabled}
          className={cn(
            'flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-wash-border bg-wash-surface px-3 text-sm text-wash-text-strong transition-colors hover:border-wash-brand/40 focus-visible:border-wash-brand focus-visible:ring-2 focus-visible:ring-wash-brand/15 disabled:cursor-not-allowed disabled:bg-wash-surface-2 disabled:opacity-60',
            !selected && 'text-wash-text-muted',
            className
          )}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown size={15} className="shrink-0 text-wash-text-muted" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="z-[70] w-[var(--radix-popover-trigger-width)] min-w-[240px] overflow-hidden rounded-xl border border-wash-border bg-wash-surface p-0 shadow-lg ring-1 ring-black/[0.03]"
      >
        <div className="flex items-center gap-2 border-b border-wash-border px-3">
          <Search size={14} className="shrink-0 text-wash-text-muted" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-wash-text-muted"
          />
        </div>
        <div className="max-h-[280px] overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-wash-text-muted">{emptyText}</div>
          ) : (
            filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                  setQ('');
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-wash-surface-2',
                  o.value === value && 'bg-wash-brand/5'
                )}
              >
                <Check
                  size={15}
                  className={cn('shrink-0 text-wash-brand', o.value === value ? 'opacity-100' : 'opacity-0')}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-wash-text-strong">{o.label}</span>
                  {o.sublabel && <span className="block truncate text-[11.5px] text-wash-text-muted">{o.sublabel}</span>}
                </span>
              </button>
            ))
          )}
          {q.trim() === '' && options.length > maxRender && (
            <div className="px-3 py-2 text-center text-[11px] text-wash-text-muted">
              Mostrando {maxRender} de {options.length}. Escribí para filtrar.
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
