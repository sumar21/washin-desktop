import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Search, Download, BarChart3, NotebookText } from 'lucide-react';
import { DataTable, type Column } from '@/components/DataTable';
import { cn } from '@/lib/utils';

/**
 * Panel de grilla para los dashboards (Visitas / Incidentes): buscador + descarga
 * a Excel + tabla DESIGN.md (reusa `DataTable`).
 *
 * Doble criterio de columnas a propósito:
 *  - `columns`  → vista UNIFICADA/curada (pocas columnas, datos que importan).
 *  - `toFlat`   → export CRUDO (una columna por campo, sin unificar) para el .xlsx.
 *
 * El export respeta el filtro de búsqueda y trae TODO (sin el cap de display).
 */

// Cap de filas en pantalla (DataTable no virtualiza). El Excel igual exporta todo.
const DISPLAY_CAP = 500;

export type GridView = 'graficos' | 'grilla';

interface GridPanelProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (r: T) => string | number;
  /** Texto concatenado por fila sobre el que busca el input. */
  search: (r: T) => string;
  /** Fila → registro plano (todas las columnas separadas) para el Excel. */
  toFlat: (r: T) => Record<string, string | number>;
  /** Nombre base del archivo (sin extensión). */
  exportName: string;
  mobileCard?: (r: T, i: number) => ReactNode;
  placeholder?: string;
}

export function GridPanel<T>({
  rows,
  columns,
  rowKey,
  search,
  toFlat,
  exportName,
  mobileCard,
  placeholder = 'Buscar…',
}: GridPanelProps<T>) {
  const [q, setQ] = useState('');
  const [downloading, setDownloading] = useState(false);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) => search(r).toLowerCase().includes(t));
  }, [rows, q, search]);

  const capped = filtered.length > DISPLAY_CAP ? filtered.slice(0, DISPLAY_CAP) : filtered;

  const download = async () => {
    if (downloading || filtered.length === 0) return;
    setDownloading(true);
    try {
      // SheetJS cargado bajo demanda → fuera del bundle principal.
      const XLSX = await import('xlsx');
      const data = filtered.map(toFlat);
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Datos');
      XLSX.writeFile(wb, `${exportName}.xlsx`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-wash-text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            className="h-9 w-full rounded-lg border border-wash-border bg-wash-surface pl-9 pr-3 text-sm text-wash-text-strong outline-none placeholder:text-wash-text-faint focus:border-wash-brand focus:ring-2 focus:ring-wash-brand/15"
          />
        </div>
        <span className="shrink-0 text-xs tabular-nums text-wash-text-muted">
          {filtered.length}
          {filtered.length !== rows.length ? ` / ${rows.length}` : ''} fila{filtered.length === 1 ? '' : 's'}
        </span>
        <button
          type="button"
          onClick={download}
          disabled={downloading || filtered.length === 0}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-wash-action px-3.5 text-sm font-medium text-white transition-colors hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download size={15} />
          {downloading ? 'Generando…' : 'Excel'}
        </button>
      </div>

      {filtered.length > DISPLAY_CAP && (
        <p className="text-[11px] text-wash-text-faint">
          Mostrando las primeras {DISPLAY_CAP} de {filtered.length} filas. Descargá el Excel para el detalle completo.
        </p>
      )}

      <div className="min-h-0 flex-1">
        <DataTable
          rows={capped}
          columns={columns}
          rowKey={rowKey}
          mobileCard={mobileCard}
          empty="Sin resultados para la búsqueda."
          dense
        />
      </div>
    </div>
  );
}

/** Segmented control Gráficos / Grilla para el header de cada tab del dashboard. */
export function ViewToggle({ value, onChange }: { value: GridView; onChange: (v: GridView) => void }) {
  const opts: { id: GridView; label: string; icon: typeof BarChart3 }[] = [
    { id: 'graficos', label: 'Gráficos', icon: BarChart3 },
    { id: 'grilla', label: 'Grilla', icon: NotebookText },
  ];
  return (
    <div className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-wash-surface-2 p-1 ring-1 ring-wash-border">
      {opts.map((o) => {
        const Icon = o.icon;
        const activo = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={activo}
            title={o.label}
            aria-label={o.label}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              activo
                ? 'bg-wash-surface text-wash-brand-dark shadow-sm ring-1 ring-wash-border'
                : 'text-wash-text-muted hover:text-wash-text-strong'
            )}
          >
            <Icon size={15} className="shrink-0" />
            <span className="hidden md:inline">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
