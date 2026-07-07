import { type ReactNode, useMemo } from 'react';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  align?: 'left' | 'right' | 'center';
  /** Apply text-truncate to the cell. Defaults to true. */
  truncate?: boolean;
  /** Pin this column to the left when horizontally scrolling. */
  sticky?: boolean;
  render: (row: T, index: number) => ReactNode;
}

interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string | number;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  dense?: boolean;
  /**
   * Render de una card por fila para mobile (<lg). Si se pasa, en pantallas chicas
   * se muestran cards en vez de la tabla (DESIGN.md §5.4); en ≥lg va la tabla. Si se
   * omite, la tabla se muestra siempre (scrollea horizontal en mobile).
   */
  mobileCard?: (row: T, index: number) => ReactNode;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  empty,
  onRowClick,
  dense,
  mobileCard,
}: DataTableProps<T>) {
  const alignClass = (a?: 'left' | 'right' | 'center') =>
    a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left';

  const gridTpl = useMemo(
    () => columns.map((c) => c.width ?? 'minmax(0,1fr)').join(' '),
    [columns]
  );

  // Left offsets (px) for each sticky column = sum of widths of prior sticky
  // columns. Starts at 0 because we put horizontal padding on the cells
  // (pl-4 on first, pr-4 on last) instead of on the grid container, so each
  // cell's grid track starts flush against the previous one with no parent
  // padding gap that would let scrolled content peek through.
  const stickyLefts = useMemo(() => {
    const map = new Map<string, number>();
    let acc = 0;
    for (const col of columns) {
      if (col.sticky) {
        map.set(col.key, acc);
        const px = parseInt(col.width ?? '0', 10);
        acc += Number.isFinite(px) ? px : 0;
      }
    }
    return map;
  }, [columns]);

  const lastIdx = columns.length - 1;

  return (
    <>
      {/* MOBILE (<lg): una card por fila (DESIGN.md §5.4) */}
      {mobileCard && (
        <div className="flex h-full flex-col gap-2 overflow-y-auto lg:hidden">
          {rows.length === 0 ? (
            <div className="flex h-[220px] items-center justify-center px-4 text-center text-sm text-wash-text-muted">
              {empty ?? 'Sin resultados'}
            </div>
          ) : (
            rows.map((row, idx) => <div key={rowKey(row)}>{mobileCard(row, idx)}</div>)
          )}
        </div>
      )}

      {/* DESKTOP (≥lg si hay cards; siempre si no): tabla */}
      <div
        className={cn(
          'h-full overflow-hidden rounded-2xl bg-wash-surface shadow-sm ring-1 ring-wash-border',
          mobileCard && 'hidden lg:block'
        )}
      >
        <div className="h-full overflow-auto">
        {/* Header — sticky to the top on vertical scroll */}
        <div
          className="sticky top-0 z-20 grid border-b border-wash-border bg-wash-canvas text-[11px] font-bold uppercase tracking-wider text-wash-text-muted"
          style={{ gridTemplateColumns: gridTpl }}
        >
          {columns.map((c, idx) => (
            <div
              key={c.key}
              className={cn(
                'py-2.5',
                idx === 0 && 'pl-4',
                idx === lastIdx && 'pr-4',
                alignClass(c.align),
                c.sticky && 'sticky z-30 bg-wash-canvas'
              )}
              style={c.sticky ? { left: stickyLefts.get(c.key) } : undefined}
            >
              {c.header}
            </div>
          ))}
        </div>

        {/* Body */}
        {rows.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center px-4 text-sm text-wash-text-muted">
            {empty ?? 'Sin resultados'}
          </div>
        ) : (
          rows.map((row, idx) => (
            <div
              key={rowKey(row)}
              onClick={() => onRowClick?.(row)}
              className={cn(
                'group grid items-center border-b border-wash-divider/60 bg-wash-surface text-sm text-wash-text-strong transition-colors',
                dense ? 'py-2' : 'py-4',
                onRowClick && 'cursor-pointer hover:bg-wash-canvas'
              )}
              style={{ gridTemplateColumns: gridTpl }}
            >
              {columns.map((c, cIdx) => (
                <div
                  key={c.key}
                  className={cn(
                    cIdx === 0 && 'pl-4',
                    cIdx === lastIdx && 'pr-4',
                    c.truncate !== false && 'truncate',
                    alignClass(c.align),
                    c.sticky &&
                      'sticky z-10 bg-wash-surface group-hover:bg-wash-canvas'
                  )}
                  style={c.sticky ? { left: stickyLefts.get(c.key) } : undefined}
                >
                  {c.render(row, idx)}
                </div>
              ))}
            </div>
          ))
        )}
        </div>
      </div>
    </>
  );
}
