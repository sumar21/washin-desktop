// Widget "Próximos 7 días" del Home: eventos del calendario + ventilaciones abiertas que caen
// entre hoy y dentro de 6 días. Las vencidas no van acá: ya las cuenta el KPI de ventilaciones.
//
// Las ventilaciones llegan por props (el Home ya las carga con fetchVentilaciones) y sólo se piden
// los eventos: el mes de hoy y, si la semana cruza de mes, también el siguiente.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDays } from 'date-fns';
import { CalendarDays } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/EmptyState';
import { ItemPill } from '@/components/CalendarioItem';
import {
  claveDia,
  claveDeDate,
  mesAnoDe,
  fechaLarga,
  fechaDeClave,
  fechaVentilacion,
  ordenDe,
  useHoy,
  type Item,
} from '@/lib/calendario';
import { cn } from '@/lib/utils';
import * as api from '@/services/api';
import type { EventoCalendario, Ventilacion } from '@/types/domain';

const ABIERTAS = ['Pendiente', 'Asignada', 'Programada'];

function etiquetaDia(d: Date, i: number): string {
  if (i === 0) return 'Hoy';
  if (i === 1) return 'Mañana';
  return fechaLarga(d);
}

export function AgendaProximosDias({ ventilaciones, className }: { ventilaciones: Ventilacion[]; className?: string }) {
  const navigate = useNavigate();
  // Hoy + los 6 días siguientes. Sigue a `useHoy`: el Home queda abierto días enteros, y al pasar
  // la medianoche el rango se corre y los eventos se vuelven a pedir.
  const hoy = useHoy();
  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(fechaDeClave(hoy), i)), [hoy]);
  const [eventos, setEventos] = useState<EventoCalendario[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let vivo = true;
    // Sin realizadas: el widget no las usa, y si esa consulta fallaba se perdían los eventos.
    api
      .getCalendario([...new Set(dias.map(mesAnoDe))], { realizadas: false })
      .then((r) => {
        if (!vivo) return;
        setEventos(r.eventos);
        setError(false);
      })
      .catch(() => vivo && setError(true));
    return () => {
      vivo = false;
    };
  }, [dias]);

  const porDia = useMemo(() => {
    const claves = new Set(dias.map(claveDeDate));
    const map = new Map<string, Item[]>();
    const push = (it: Item) => {
      if (!claves.has(it.dia)) return;
      const l = map.get(it.dia);
      if (l) l.push(it);
      else map.set(it.dia, [it]);
    };
    // El store puede tener otra vista de Ventilaciones (un mes puntual, con realizadas): sólo abiertas.
    for (const v of ventilaciones) {
      if (!ABIERTAS.includes(v.Estado_VE)) continue;
      push({ tipo: 'ventilacion', key: `v-${v.ID}`, dia: claveDia(fechaVentilacion(v)), ventilacion: v, vencida: false });
    }
    for (const e of eventos ?? []) {
      if (e.Estado !== 'Anulado') push({ tipo: 'evento', key: `e-${e.ID}`, dia: claveDia(e.Fecha), evento: e });
    }
    for (const l of map.values()) l.sort((a, b) => ordenDe(a).localeCompare(ordenDe(b), 'es'));
    return map;
  }, [dias, ventilaciones, eventos]);

  const total = [...porDia.values()].reduce((n, l) => n + l.length, 0);
  const cargando = eventos === null && !error;
  // Abre el calendario en el mes del ítem: a fin de mes, la semana puede caer en el siguiente.
  const abrir = (dia: string) => navigate('/calendario', { state: { fecha: dia } });

  return (
    <Card className={cn('flex flex-col ring-wash-border', className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-wash-brand/10 text-wash-brand">
            <CalendarDays size={16} />
          </span>
          <div>
            <CardTitle>Próximos 7 días</CardTitle>
            <p className="text-xs text-wash-text-muted">Eventos y ventilaciones</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/calendario')}
          className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-wash-brand hover:bg-wash-brand/10"
        >
          Ver calendario
        </button>
      </CardHeader>
      <CardContent className="flex-1">
        {cargando ? (
          <p className="py-6 text-center text-[13px] text-wash-text-faint">Cargando…</p>
        ) : total === 0 ? (
          <EmptyState
            compact
            icon={CalendarDays}
            title="Nada en los próximos 7 días"
            description="Ni eventos ni ventilaciones agendadas."
          />
        ) : (
          <div className="flex max-h-[280px] flex-col gap-3 overflow-y-auto pr-0.5">
            {dias.map((d, i) => {
              const clave = claveDeDate(d);
              const items = porDia.get(clave);
              if (!items) return null;
              return (
                <div key={clave}>
                  <p
                    className={cn(
                      'mb-1.5 text-[11px] font-bold uppercase tracking-wide',
                      i === 0 ? 'text-wash-brand' : 'text-wash-text-faint'
                    )}
                  >
                    {etiquetaDia(d, i)}
                  </p>
                  <div className="space-y-1.5">
                    {items.map((it) => (
                      <ItemPill key={it.key} item={it} grande onClick={() => abrir(it.dia)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {error && (
          <p className="mt-2 text-[12px] text-wash-text-faint">
            No se pudieron cargar los eventos: se muestran sólo las ventilaciones.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
