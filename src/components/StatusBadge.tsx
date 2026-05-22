import { cn } from '@/lib/utils';

type Tone = {
  bg: string;
  text: string;
  dot: string;
  ring: string;
};

const palette: Record<string, Tone> = {
  Pendiente: {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    dot: 'bg-amber-500',
    ring: 'ring-amber-300/70',
  },
  'En Aprobacion': {
    bg: 'bg-violet-50',
    text: 'text-violet-800',
    dot: 'bg-violet-500',
    ring: 'ring-violet-300/70',
  },
  'En Proceso': {
    bg: 'bg-sky-50',
    text: 'text-sky-800',
    dot: 'bg-sky-500',
    ring: 'ring-sky-300/70',
  },
  Aprobada: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-300/70',
  },
  Recibida: {
    bg: 'bg-sky-50',
    text: 'text-sky-800',
    dot: 'bg-sky-500',
    ring: 'ring-sky-300/70',
  },
  Rechazada: {
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    dot: 'bg-rose-500',
    ring: 'ring-rose-300/70',
  },
  Finalizado: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-300/70',
  },
  Cerrada: {
    bg: 'bg-slate-50',
    text: 'text-slate-800',
    dot: 'bg-slate-500',
    ring: 'ring-slate-300/70',
  },
  Anulado: {
    bg: 'bg-slate-50',
    text: 'text-slate-600',
    dot: 'bg-slate-400',
    ring: 'ring-slate-300/70',
  },
  Asignado: {
    bg: 'bg-sky-50',
    text: 'text-sky-800',
    dot: 'bg-sky-500',
    ring: 'ring-sky-300/70',
  },
  Asignada: {
    bg: 'bg-sky-50',
    text: 'text-sky-800',
    dot: 'bg-sky-500',
    ring: 'ring-sky-300/70',
  },
  Realizada: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-300/70',
  },
  Programada: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-800',
    dot: 'bg-indigo-500',
    ring: 'ring-indigo-300/70',
  },
  'A Revisar': {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    dot: 'bg-amber-500',
    ring: 'ring-amber-300/70',
  },
  Resuelto: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-300/70',
  },
  INSTALADA: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-300/70',
  },
  DEPOSITO: {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    dot: 'bg-amber-500',
    ring: 'ring-amber-300/70',
  },
  ELIMINADA: {
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    dot: 'bg-rose-500',
    ring: 'ring-rose-300/70',
  },
  ALTA: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-300/70',
  },
  BAJA: {
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    dot: 'bg-rose-500',
    ring: 'ring-rose-300/70',
  },
  Visitado: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-300/70',
  },
  Activo: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-300/70',
  },
  Inactivo: {
    bg: 'bg-slate-50',
    text: 'text-slate-600',
    dot: 'bg-slate-400',
    ring: 'ring-slate-300/70',
  },
};

const fallback: Tone = {
  bg: 'bg-slate-50',
  text: 'text-slate-700',
  dot: 'bg-slate-500',
  ring: 'ring-slate-300/70',
};

export function StatusBadge({ status }: { status: string }) {
  const t = palette[status] ?? fallback;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide ring-1',
        t.bg,
        t.text,
        t.ring
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', t.dot)} aria-hidden />
      {status}
    </span>
  );
}
