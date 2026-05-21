import { cn } from '@/lib/utils';

const palette: Record<string, string> = {
  Pendiente: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-500/30',
  'En Aprobacion': 'bg-violet-500/15 text-violet-700 dark:text-violet-300 ring-violet-500/30',
  'En Proceso': 'bg-sky-500/15 text-sky-700 dark:text-sky-300 ring-sky-500/30',
  Aprobada: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-500/30',
  Recibida: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 ring-sky-500/30',
  Rechazada: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 ring-rose-500/30',
  Finalizado: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-500/30',
  Cerrada: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 ring-slate-500/30',
  Anulado: 'bg-slate-500/15 text-slate-500 dark:text-slate-400 ring-slate-500/30',
  Asignado: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 ring-sky-500/30',
  Asignada: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 ring-sky-500/30',
  Realizada: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-500/30',
  Programada: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 ring-indigo-500/30',
  'A Revisar': 'bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-500/30',
  Resuelto: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-500/30',
  INSTALADA: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-500/30',
  DEPOSITO: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-500/30',
  ELIMINADA: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 ring-rose-500/30',
  ALTA: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-500/30',
  BAJA: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 ring-rose-500/30',
  Visitado: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-500/30',
  Activo: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-500/30',
  Inactivo: 'bg-slate-500/15 text-slate-500 dark:text-slate-400 ring-slate-500/30',
};

export function StatusBadge({ status }: { status: string }) {
  const cls =
    palette[status] ??
    'bg-slate-500/15 text-slate-700 dark:text-slate-300 ring-slate-500/30';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1',
        cls
      )}
    >
      {status}
    </span>
  );
}
