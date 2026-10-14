import { CalendarDays, Check, Wind } from 'lucide-react';
import { cn } from '@/lib/utils';
import { horario, tonoDe, type Item } from '@/lib/calendario';

/** Un evento o una ventilación en el calendario (grilla, agenda mobile, listas y widget del Home). */
export function ItemPill({
  item,
  grande,
  onClick,
}: {
  item: Item;
  /** Versión de la agenda mobile y de las listas: más alta y con subtítulo. */
  grande?: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  const esEvento = item.tipo === 'evento';
  const Icon = esEvento ? (item.evento.Estado === 'Realizado' ? Check : CalendarDays) : Wind;
  const titulo = esEvento ? item.evento.Titulo : item.ventilacion.Edificio_VE;
  const hora = esEvento ? item.evento.HoraInicio : '';
  const detalle = esEvento
    ? horario(item.evento)
    : `${item.ventilacion.Estado_VE}${item.vencida ? ' · vencida' : ''}${
        item.ventilacion.Asignado_VE ? ` · ${item.ventilacion.Asignado_VE}` : ''
      }`;

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${titulo} · ${detalle}`}
      className={cn(
        'flex w-full min-w-0 items-center gap-1.5 rounded-md text-left ring-1 ring-inset transition hover:brightness-[0.97]',
        grande ? 'px-3 py-2' : 'px-1.5 py-0.5',
        tonoDe(item)
      )}
    >
      <Icon size={grande ? 14 : 11} className="shrink-0" />
      {grande ? (
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold">{titulo}</span>
          <span className="block truncate text-[11.5px] opacity-80">{detalle}</span>
        </span>
      ) : (
        <>
          {hora && <span className="shrink-0 text-[11px] font-semibold tabular-nums">{hora}</span>}
          <span className="truncate text-[11.5px] font-medium">{titulo}</span>
        </>
      )}
    </button>
  );
}
