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
}

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
}: DatePickerProps) {
  const [open, setOpen] = useState(false);

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
        />
      </PopoverContent>
    </Popover>
  );
}

/** Parse a DD/MM/YYYY string into a Date, or return undefined if invalid. */
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

export { formatDate as formatDateDDMMYYYY };
