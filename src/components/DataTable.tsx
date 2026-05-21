import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  align?: 'left' | 'right' | 'center';
  /** Apply text-truncate to the cell. Defaults to true. */
  truncate?: boolean;
  render: (row: T, index: number) => ReactNode;
}

interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string | number;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  dense?: boolean;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  empty,
  onRowClick,
  dense,
}: DataTableProps<T>) {
  const alignClass = (a?: 'left' | 'right' | 'center') =>
    a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left';

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-wash-surface shadow-sm ring-1 ring-wash-border">
      <div
        className="grid border-b border-wash-border bg-wash-canvas px-4 text-[11px] font-bold uppercase tracking-wider text-wash-text-muted"
        style={{ gridTemplateColumns: columns.map((c) => c.width ?? 'minmax(0,1fr)').join(' ') }}
      >
        {columns.map((c) => (
          <div key={c.key} className={cn('py-2.5', alignClass(c.align))}>
            {c.header}
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {rows.length === 0 && (
          <div className="flex h-full items-center justify-center text-sm text-wash-text-muted">
            {empty ?? 'Sin resultados'}
          </div>
        )}
        {rows.map((row, idx) => (
          <div
            key={rowKey(row)}
            onClick={() => onRowClick?.(row)}
            className={cn(
              'grid items-center border-b border-wash-divider/60 px-4 text-sm text-wash-text-strong transition-colors',
              dense ? 'py-2' : 'py-3',
              onRowClick && 'cursor-pointer hover:bg-wash-canvas'
            )}
            style={{ gridTemplateColumns: columns.map((c) => c.width ?? 'minmax(0,1fr)').join(' ') }}
          >
            {columns.map((c) => (
              <div
                key={c.key}
                className={cn(c.truncate !== false && 'truncate', alignClass(c.align))}
              >
                {c.render(row, idx)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
