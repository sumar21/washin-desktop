import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { es } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

interface DatePickerProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Primer mes elegible. Default: 10 años atrás. */
  startMonth?: Date;
  /** Último mes elegible. Default: 10 años adelante. Ver la nota de RANGO abajo. */
  endMonth?: Date;
}

// RANGO DE AÑOS — no borrar sin leer.
// react-day-picker v10 con `captionLayout="dropdown"` y SIN `endMonth` explícito lo fija solo en
// `endOfYear(today)` (`getNavMonths`, dist/cjs/helpers/getNavMonth.js). O sea: el desplegable de
// año no dejaba pasar del año en curso, y cualquier fecha futura era inelegible — se reportó
// desde producción al cargar la "Próxima limpieza" de una ventilación en 2027.
// El default de `startMonth` de la librería (−100 años) tampoco sirve: llena el desplegable de
// años inútiles. Acá se acota a una ventana simétrica, que cubre tanto las fechas futuras
// (próxima limpieza, planificación) como las pasadas (fecha de ingreso de una máquina).
const ANIOS_RANGO = 10;

function formatDate(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'DD/MM/AAAA',
  className,
  disabled,
  startMonth,
  endMonth,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  // Se calcula al abrir, no al montar: el escritorio queda abierto días entre recargas.
  const hoy = new Date();
  const desde = startMonth ?? new Date(hoy.getFullYear() - ANIOS_RANGO, 0, 1);
  const hasta = endMonth ?? new Date(hoy.getFullYear() + ANIOS_RANGO, 11, 31);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-wash-border bg-wash-surface px-3 text-sm text-wash-text-strong transition-colors hover:border-wash-brand/40 focus-visible:border-wash-brand focus-visible:ring-2 focus-visible:ring-wash-brand/15 disabled:cursor-not-allowed disabled:bg-wash-surface-2 disabled:opacity-60',
            !value && 'text-wash-text-muted',
            className
          )}
        >
          <span className="truncate">{value ? formatDate(value) : placeholder}</span>
          <CalendarDays size={16} className="shrink-0 text-wash-text-muted" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="z-[70] w-auto rounded-xl border border-wash-border bg-wash-surface p-2 shadow-lg ring-1 ring-black/[0.03]"
      >
        <Calendar
          mode="single"
          selected={value}
          onSelect={(d) => {
            onChange(d);
            if (d) setOpen(false);
          }}
          locale={es}
          captionLayout="dropdown"
          startMonth={desde}
          endMonth={hasta}
          defaultMonth={value}
        />
      </PopoverContent>
    </Popover>
  );
}

/** Parse a DD/MM/YYYY string into a Date, or return undefined if invalid. */
// eslint-disable-next-line react-refresh/only-export-components -- date helpers are co-located with the DatePicker primitive and imported by consumers.
export function parseDateString(value: string): Date | undefined {
  if (!value) return undefined;
  const parts = value.split('/');
  if (parts.length !== 3) return undefined;
  const [d, m, y] = parts.map(Number);
  if (!d || !m || !y) return undefined;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

// eslint-disable-next-line react-refresh/only-export-components -- date helpers are co-located with the DatePicker primitive and imported by consumers.
export { formatDate as formatDateDDMMYYYY };
