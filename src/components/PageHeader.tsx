import { type ReactNode } from 'react';
import { Search, RotateCw, Filter, Plus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  search?: { value: string; onChange: (v: string) => void; placeholder?: string };
  onRefresh?: () => void;
  /** Click callback. Use this for a simple button that opens a modal. */
  onFilter?: () => void;
  /** Popover content. When provided, the Filtrar button becomes a popover trigger. */
  filterPopover?: ReactNode;
  onAdd?: () => void;
  addLabel?: string;
  rightExtra?: ReactNode;
  /** Control extra en la toolbar, entre el search y el botón Filtrar (ej. selector de período). */
  toolbarExtra?: ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  search,
  onRefresh,
  onFilter,
  filterPopover,
  onAdd,
  addLabel = 'Nuevo',
  rightExtra,
  toolbarExtra,
}: PageHeaderProps) {
  // Botón de la toolbar: colapsa el label a solo-ícono en mobile (<sm).
  const filterButtonClass =
    'flex shrink-0 items-center gap-1.5 rounded-lg bg-wash-canvas px-3 py-2 text-sm font-medium text-wash-text-strong ring-1 ring-wash-border hover:bg-wash-border/40';

  return (
    <div className="flex flex-col gap-2.5 border-b border-wash-border bg-wash-surface px-4 py-3 md:h-[88px] md:flex-row md:items-center md:justify-between md:gap-3 md:px-6 md:py-0">
      {/* Título — oculto en mobile (el nombre del módulo vive en el header mobile del shell) */}
      <div className="hidden lg:block">
        <h1 className="font-display text-2xl font-black text-wash-primary-soft">{title}</h1>
        {subtitle && <p className="text-xs text-wash-text-muted">{subtitle}</p>}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        {search && (
          <div className="relative flex-1 md:w-[280px] md:flex-none">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-wash-text-muted" />
            <input
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              placeholder={search.placeholder ?? 'Buscar...'}
              className="w-full rounded-lg bg-wash-canvas px-9 py-2 text-sm text-wash-text-strong outline-none ring-1 ring-wash-border focus:ring-wash-primary"
            />
          </div>
        )}

        {toolbarExtra}

        {filterPopover ? (
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className={filterButtonClass}>
                <Filter size={14} />
                <span className="hidden sm:inline">Filtrar</span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              sideOffset={8}
              className="max-h-[min(80vh,640px)] w-[calc(100vw-2rem)] max-w-[360px] overflow-y-auto rounded-xl border border-wash-border bg-wash-surface p-4 shadow-lg ring-1 ring-black/[0.03]"
            >
              {filterPopover}
            </PopoverContent>
          </Popover>
        ) : (
          onFilter && (
            <button type="button" onClick={onFilter} className={filterButtonClass}>
              <Filter size={14} />
              <span className="hidden sm:inline">Filtrar</span>
            </button>
          )
        )}

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-wash-primary/10 px-3 py-2 text-sm font-medium text-wash-primary hover:bg-wash-primary/20"
          >
            <RotateCw size={14} />
            <span className="hidden sm:inline">Refrescar</span>
          </button>
        )}
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-wash-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-110"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">{addLabel}</span>
          </button>
        )}
        {rightExtra}
      </div>
    </div>
  );
}
