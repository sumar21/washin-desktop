// Calendario — ventilaciones (19.Ventilaciones) + eventos propios del equipo (21.EventosCalendario).
//
// Vista mensual tipo Google Calendar pedida por gerencia. Las ventilaciones son de SÓLO LECTURA
// (se gestionan en su módulo); los eventos se cargan, editan, realizan y anulan acá.
//
// La fecha en la que cae cada ventilación depende de su estado (ver `fechaVentilacion`). Las
// abiertas se traen una sola vez y las realizadas y los eventos por mes visible: el detalle de
// por qué ninguna consulta crece con el historial está en api/_lib/calendario.ts.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertTriangle,
  Ban,
  Building2,
  CalendarDays,
  CalendarX2,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  Wind,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Modal, ModalActions, ConfirmDialog } from '@/components/Modal';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { DatePicker, formatDateDDMMYYYY, parseDateString } from '@/components/ui/date-picker';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import {
  claveDia,
  claveDeDate,
  mesAnoDe,
  useHoy,
  fechaDeClave,
  fechaLarga,
  fechaVentilacion,
  estaVencida,
  etiquetaFechaVentilacion,
  horario,
  tonoDe,
  ordenDe,
  type Item,
} from '@/lib/calendario';
import { ItemPill } from '@/components/CalendarioItem';
import * as api from '@/services/api';
import type { EventoCalendario, Ventilacion } from '@/types/domain';

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
/**
 * Ítems que entran en una celda de la grilla (min-h 104px: el número del día + 3 pills de ~21px).
 * No esconde nada: el resto va a "+N más", que abre la lista completa del día. Medido sobre el
 * tenant (10/2026): ~25 ventilaciones abiertas por mes, así que el "+N más" aparece pocos días.
 */
const MAX_POR_DIA = 3;

interface MesCargado {
  eventos: EventoCalendario[];
  realizadas: Ventilacion[];
}

/** Punto sólido de cada tono: el fondo de las pills es demasiado claro para una referencia. */
const LEYENDA: { label: string; dot: string }[] = [
  { label: 'Evento', dot: 'bg-wash-brand' },
  { label: 'Pendiente', dot: 'bg-amber-400' },
  { label: 'Asignada', dot: 'bg-sky-400' },
  { label: 'Programada', dot: 'bg-indigo-400' },
  { label: 'Vencida', dot: 'bg-rose-500' },
  { label: 'Realizada', dot: 'bg-slate-300' },
];

/** El backend responde 409 cuando el evento ya no está Pendiente. */
const esConflicto = (err: unknown) => err instanceof api.ApiError && err.status === 409;

export function Calendario() {
  const navigate = useNavigate();
  const location = useLocation();
  const permisos = useAppStore((s) => s.Collect_LPP);
  const puedeVerVentilaciones = permisos.some((p) => p.Modulo_LPP === 'Ventilacion');

  const hoy = useHoy();
  // El widget del Home navega con `{ fecha: 'yyyy-mm-dd' }` para abrir en el mes de ese día.
  const [mes, setMes] = useState(() => {
    const fecha = (location.state as { fecha?: string } | null)?.fecha;
    const d = fecha ? fechaDeClave(fecha) : new Date();
    return startOfMonth(Number.isNaN(d.getTime()) ? new Date() : d);
  });
  const [abiertas, setAbiertas] = useState<Ventilacion[] | null>(null);
  const [porMes, setPorMes] = useState<Record<string, MesCargado>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  // Meses con un pedido en curso: navegar rápido no dispara el mismo fetch dos veces.
  const enVuelo = useRef(new Set<string>());
  const abiertasPedidas = useRef(false);

  const [form, setForm] = useState<{ evento?: EventoCalendario; fecha?: Date } | null>(null);
  const [detalle, setDetalle] = useState<Item | null>(null);
  const [lista, setLista] = useState<{ titulo: string; items: Item[]; fecha?: Date } | null>(null);
  const [anulando, setAnulando] = useState<EventoCalendario | null>(null);
  const [anularBusy, setAnularBusy] = useState(false);
  const [anularError, setAnularError] = useState<string | null>(null);

  // La grilla arranca el lunes y muestra semanas completas, así que incluye días de los meses
  // vecinos: por eso se piden hasta 3 meses.
  const dias = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(mes, { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(mes), { weekStartsOn: 1 }),
      }),
    [mes]
  );
  const mesesVisibles = useMemo(() => [...new Set(dias.map(mesAnoDe))], [dias]);
  const faltantes = mesesVisibles.filter((m) => !porMes[m]);
  const faltantesKey = faltantes.join(',');
  const cargando = !loadError && (abiertas === null || faltantes.length > 0);

  const cargar = useCallback(async (meses: string[]) => {
    const pedir = meses.filter((m) => !enVuelo.current.has(m));
    if (pedir.length === 0) return;
    const conAbiertas = !abiertasPedidas.current;
    abiertasPedidas.current = true;
    pedir.forEach((m) => enVuelo.current.add(m));
    setLoadError(null);
    try {
      const r = await api.getCalendario(pedir, { abiertas: conAbiertas });
      setPorMes((prev) => {
        const next = { ...prev };
        for (const m of pedir) {
          next[m] = {
            eventos: r.eventos.filter((e) => e.FechaMesAno === m),
            realizadas: r.realizadas.filter((v) => v.FechaMesAnoFinalizacion_VE === m),
          };
        }
        return next;
      });
      if (r.abiertas) setAbiertas(r.abiertas);
    } catch (err) {
      if (conAbiertas) abiertasPedidas.current = false;
      setLoadError(err instanceof Error ? err.message : 'No se pudo cargar el calendario.');
    } finally {
      pedir.forEach((m) => enVuelo.current.delete(m));
    }
  }, []);

  useEffect(() => {
    if (!faltantesKey) return;
    void cargar(faltantesKey.split(','));
  }, [faltantesKey, cargar]);

  /** Vuelve a pedir los meses tocados por un alta/edición. Los que no se ven salen del cache. */
  const refrescarMeses = (meses: string[]) => {
    const visibles = meses.filter((m) => mesesVisibles.includes(m));
    setPorMes((prev) => {
      const next = { ...prev };
      for (const m of meses) if (!visibles.includes(m)) delete next[m];
      return next;
    });
    if (visibles.length > 0) void cargar(visibles);
  };

  const { porDia, vencidas, sinFecha } = useMemo(() => {
    const porDia = new Map<string, Item[]>();
    const vencidas: Item[] = [];
    const sinFecha: Item[] = [];
    const push = (it: Item) => {
      const l = porDia.get(it.dia);
      if (l) l.push(it);
      else porDia.set(it.dia, [it]);
    };

    const cargados = mesesVisibles.map((m) => porMes[m]).filter((x): x is MesCargado => !!x);
    // Las abiertas se traen una vez al entrar: si una se finalizó después y su mes se cargó más
    // tarde, aparecería dos veces (abierta vieja + realizada nueva). Gana la realizada.
    const realizadasIds = new Set(cargados.flatMap((c) => c.realizadas.map((v) => v.ID)));

    for (const v of abiertas ?? []) {
      if (realizadasIds.has(v.ID)) continue;
      const dia = claveDia(fechaVentilacion(v));
      const it: Item = { tipo: 'ventilacion', key: `v-${v.ID}`, dia, ventilacion: v, vencida: estaVencida(v, hoy) };
      if (!dia) {
        sinFecha.push(it);
        continue;
      }
      if (it.vencida) vencidas.push(it);
      push(it);
    }
    for (const c of cargados) {
      for (const v of c.realizadas) {
        const dia = claveDia(v.FechaFinalizacion_VE);
        if (dia) push({ tipo: 'ventilacion', key: `v-${v.ID}`, dia, ventilacion: v, vencida: false });
      }
      for (const e of c.eventos) {
        if (e.Estado === 'Anulado') continue;
        const dia = claveDia(e.Fecha);
        if (dia) push({ tipo: 'evento', key: `e-${e.ID}`, dia, evento: e });
      }
    }
    for (const l of porDia.values()) l.sort((a, b) => ordenDe(a).localeCompare(ordenDe(b), 'es'));
    vencidas.sort((a, b) => a.dia.localeCompare(b.dia));
    sinFecha.sort((a, b) => ordenDe(a).localeCompare(ordenDe(b), 'es'));
    return { porDia, vencidas, sinFecha };
  }, [abiertas, porMes, mesesVisibles, hoy]);

  const semanas = dias.length / 7;
  const diasDelMes = dias.filter((d) => isSameMonth(d, mes));
  const hayAlgoEnElMes = diasDelMes.some((d) => porDia.has(claveDeDate(d)));

  const nuevoEvento = (fecha?: Date) => setForm({ fecha: fecha ?? new Date() });
  const abrirDia = (d: Date) => setLista({ titulo: fechaLarga(d), items: porDia.get(claveDeDate(d)) ?? [], fecha: d });

  /**
   * 409 = otro usuario lo cerró mientras estaba abierto acá. Sin esto el error salía pero la grilla
   * y el detalle seguían mostrándolo Pendiente hasta recargar.
   */
  const refrescarSiConflicto = (err: unknown, meses: string[]) => {
    if (esConflicto(err)) refrescarMeses(meses);
  };

  async function realizar(e: EventoCalendario) {
    try {
      await api.cambiarEstadoEvento(e.ID, 'realizar');
    } catch (err) {
      refrescarSiConflicto(err, [e.FechaMesAno]);
      throw err;
    }
    setDetalle(null);
    refrescarMeses([e.FechaMesAno]);
  }

  async function confirmarAnular() {
    if (!anulando) return;
    setAnularBusy(true);
    setAnularError(null);
    try {
      await api.cambiarEstadoEvento(anulando.ID, 'anular');
      refrescarMeses([anulando.FechaMesAno]);
      setAnulando(null);
    } catch (err) {
      refrescarSiConflicto(err, [anulando.FechaMesAno]);
      setAnularError(err instanceof Error ? err.message : 'No se pudo anular el evento.');
    } finally {
      setAnularBusy(false);
    }
  }

  const navBtn =
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-wash-canvas text-wash-text-strong ring-1 ring-wash-border hover:bg-wash-border/40';

  return (
    <div className="relative flex h-full w-full flex-col">
      <PageHeader
        title="Calendario"
        subtitle="Ventilaciones y eventos del equipo"
        onAdd={() => nuevoEvento()}
        addLabel="Nuevo evento"
        toolbarExtra={
          <div className="flex flex-1 items-center gap-1.5 md:flex-none">
            <button type="button" aria-label="Mes anterior" onClick={() => setMes((m) => addMonths(m, -1))} className={navBtn}>
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-[140px] flex-1 text-center text-sm font-semibold capitalize text-wash-text-strong md:flex-none">
              {format(mes, 'MMMM yyyy', { locale: es })}
            </span>
            <button type="button" aria-label="Mes siguiente" onClick={() => setMes((m) => addMonths(m, 1))} className={navBtn}>
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              onClick={() => setMes(startOfMonth(new Date()))}
              className="flex shrink-0 items-center rounded-lg bg-wash-canvas px-3 py-2 text-sm font-medium text-wash-text-strong ring-1 ring-wash-border hover:bg-wash-border/40"
            >
              Hoy
            </button>
          </div>
        }
      />
      <LoadingOverlay visible={cargando} label="Cargando calendario…" />

      {loadError ? (
        <ErrorState message={loadError} onRetry={() => void cargar(faltantes.length ? faltantes : mesesVisibles)} />
      ) : (
        <>
          {/* Referencias + avisos de lo que no se ve en el mes. En mobile no va la leyenda: la agenda
              ya dice el estado en texto, y la barra sólo aparece si hay avisos. */}
          <div
            className={cn(
              'flex-wrap items-center gap-x-4 gap-y-2 border-b border-wash-border bg-wash-surface px-4 py-2.5 md:flex md:px-6',
              vencidas.length + sinFecha.length > 0 ? 'flex' : 'hidden'
            )}
          >
            <div className="hidden flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-wash-text-muted md:flex">
              {LEYENDA.map((l) => (
                <span key={l.label} className="inline-flex items-center gap-1.5">
                  <span className={cn('h-2 w-2 rounded-full', l.dot)} aria-hidden />
                  {l.label}
                </span>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              {vencidas.length > 0 && (
                <button
                  type="button"
                  onClick={() => setLista({ titulo: 'Ventilaciones vencidas', items: vencidas })}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-2.5 py-1 text-[12px] font-semibold text-rose-700 ring-1 ring-rose-500/20 hover:bg-rose-500/15"
                >
                  <AlertTriangle size={13} />
                  {vencidas.length} vencidas
                </button>
              )}
              {sinFecha.length > 0 && (
                <button
                  type="button"
                  onClick={() => setLista({ titulo: 'Ventilaciones sin fecha', items: sinFecha })}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1 text-[12px] font-semibold text-amber-700 ring-1 ring-amber-500/20 hover:bg-amber-500/15"
                >
                  <CalendarX2 size={13} />
                  {sinFecha.length} sin fecha
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-auto p-3 md:p-6">
            {/* Grilla mensual (md+). min-h-full y filas `1fr` (mínimo = contenido): con alto fijo y
                overflow-hidden, en pantallas de ~730px la sexta semana quedaba recortada sin aviso. */}
            <div className="hidden min-h-full flex-col overflow-hidden rounded-xl border border-wash-border bg-wash-surface shadow-sm md:flex">
              <div className="grid grid-cols-7 border-b border-wash-border bg-wash-surface-2/60">
                {DIAS_SEMANA.map((d) => (
                  <div key={d} className="px-2 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-wash-text-muted">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid flex-1 grid-cols-7" style={{ gridTemplateRows: `repeat(${semanas}, 1fr)` }}>
                {dias.map((d, idx) => {
                  const clave = claveDeDate(d);
                  const items = porDia.get(clave) ?? [];
                  const visibles = items.length > MAX_POR_DIA ? items.slice(0, MAX_POR_DIA - 1) : items;
                  const resto = items.length - visibles.length;
                  const delMes = isSameMonth(d, mes);
                  const esHoy = clave === hoy;
                  return (
                    // Sólo el "+" del día abre "Nuevo evento": con click en cualquier parte vacía de la
                    // celda se abría sin querer al navegar la grilla.
                    <div
                      key={clave}
                      className={cn(
                        'group relative flex min-h-[104px] flex-col gap-1 border-wash-border p-1.5',
                        (idx + 1) % 7 !== 0 && 'border-r',
                        idx < dias.length - 7 && 'border-b',
                        !delMes && 'bg-wash-surface-2/40'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={cn(
                            'flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[12px] font-semibold tabular-nums',
                            esHoy ? 'bg-wash-brand text-white' : delMes ? 'text-wash-text-strong' : 'text-wash-text-faint'
                          )}
                        >
                          {format(d, 'd')}
                        </span>
                        <button
                          type="button"
                          aria-label={`Nuevo evento el ${format(d, 'dd/MM/yyyy')}`}
                          title="Nuevo evento"
                          onClick={(e) => {
                            e.stopPropagation();
                            nuevoEvento(d);
                          }}
                          className="flex h-6 w-6 items-center justify-center rounded-md text-wash-text-muted opacity-0 transition hover:bg-wash-brand/10 hover:text-wash-brand focus-visible:opacity-100 group-hover:opacity-100"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      {visibles.map((it) => (
                        <ItemPill
                          key={it.key}
                          item={it}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetalle(it);
                          }}
                        />
                      ))}
                      {resto > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            abrirDia(d);
                          }}
                          className="rounded-md px-1.5 py-0.5 text-left text-[11.5px] font-semibold text-wash-text-muted hover:bg-wash-surface-2 hover:text-wash-text-strong"
                        >
                          +{resto} más
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Agenda (mobile): sólo los días del mes que tienen algo */}
            <div className="space-y-3 md:hidden">
              {!cargando && !hayAlgoEnElMes && (
                <EmptyState
                  icon={CalendarDays}
                  title="Sin ventilaciones ni eventos este mes"
                  description="Cargá un evento con el botón +."
                />
              )}
              {diasDelMes.map((d) => {
                const clave = claveDeDate(d);
                const items = porDia.get(clave);
                if (!items) return null;
                return (
                  <div key={clave}>
                    <p
                      className={cn(
                        'mb-1.5 text-[11px] font-bold uppercase tracking-wide',
                        clave === hoy ? 'text-wash-brand' : 'text-wash-text-faint'
                      )}
                    >
                      {fechaLarga(d)}
                    </p>
                    <div className="space-y-1.5">
                      {items.map((it) => (
                        <ItemPill key={it.key} item={it} grande onClick={() => setDetalle(it)} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {lista && (
        <ListaItems
          titulo={lista.titulo}
          items={lista.items}
          conFecha={!lista.fecha}
          onClose={() => setLista(null)}
          onSelect={(it) => {
            setLista(null);
            setDetalle(it);
          }}
          onNuevo={
            lista.fecha
              ? () => {
                  const f = lista.fecha;
                  setLista(null);
                  nuevoEvento(f);
                }
              : undefined
          }
        />
      )}

      {detalle?.tipo === 'evento' && (
        <DetalleEvento
          key={detalle.key}
          evento={detalle.evento}
          onClose={() => setDetalle(null)}
          onEditar={() => {
            setDetalle(null);
            setForm({ evento: detalle.evento });
          }}
          onRealizar={() => realizar(detalle.evento)}
          onAnular={() => {
            setDetalle(null);
            setAnularError(null);
            setAnulando(detalle.evento);
          }}
        />
      )}

      {detalle?.tipo === 'ventilacion' && (
        <DetalleVentilacion
          ventilacion={detalle.ventilacion}
          vencida={detalle.vencida}
          onClose={() => setDetalle(null)}
          onVerEnModulo={puedeVerVentilaciones ? () => navigate('/ventilaciones') : undefined}
        />
      )}

      {form && (
        <EventoForm
          key={form.evento ? `e-${form.evento.ID}` : 'nuevo'}
          evento={form.evento}
          fechaInicial={form.fecha}
          onClose={() => setForm(null)}
          onGuardado={(meses) => {
            setForm(null);
            refrescarMeses(meses);
          }}
          onConflicto={refrescarMeses}
        />
      )}

      <ConfirmDialog
        open={!!anulando}
        tone="danger"
        title="Anular evento"
        message={anulando ? `¿Anular "${anulando.Titulo}" del ${anulando.Fecha}? Deja de verse en el calendario.` : ''}
        confirmLabel={anularBusy ? 'Anulando…' : 'Anular'}
        busy={anularBusy}
        error={anularError}
        onCancel={() => setAnulando(null)}
        onConfirm={confirmarAnular}
      />
    </div>
  );
}

// ───────────────────────── subcomponents ─────────────────────────

function ListaItems({
  titulo,
  items,
  conFecha,
  onClose,
  onSelect,
  onNuevo,
}: {
  titulo: string;
  items: Item[];
  /** Mostrar la fecha de cada ítem (en las listas de vencidas / sin fecha, no en la de un día). */
  conFecha: boolean;
  onClose: () => void;
  onSelect: (it: Item) => void;
  onNuevo?: () => void;
}) {
  return (
    <Modal open onClose={onClose} title={titulo} width={520}>
      {items.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Sin ventilaciones ni eventos" compact />
      ) : (
        <div className="space-y-1.5">
          {items.map((it) => (
            <div key={it.key} className="flex items-center gap-2">
              {conFecha && (
                <span className="w-[76px] shrink-0 text-[12px] tabular-nums text-wash-text-muted">
                  {it.dia ? it.dia.split('-').reverse().join('/') : 'Sin fecha'}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <ItemPill item={it} grande onClick={() => onSelect(it)} />
              </div>
            </div>
          ))}
        </div>
      )}
      <ModalActions>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-wash-border px-5 py-2.5 font-medium text-wash-text-strong hover:bg-wash-surface-2"
        >
          Cerrar
        </button>
        {onNuevo && (
          <button
            type="button"
            onClick={onNuevo}
            className="flex items-center justify-center gap-2 rounded-lg bg-wash-action px-5 py-2.5 font-semibold text-white hover:bg-wash-action-dark"
          >
            <Plus size={15} />
            Nuevo evento
          </button>
        )}
      </ModalActions>
    </Modal>
  );
}

function DetalleEvento({
  evento,
  onClose,
  onEditar,
  onRealizar,
  onAnular,
}: {
  evento: EventoCalendario;
  onClose: () => void;
  onEditar: () => void;
  onRealizar: () => Promise<void>;
  onAnular: () => void;
}) {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Si otro usuario lo cerró mientras estaba abierto (409), no se ofrecen más acciones.
  const [cerradoAfuera, setCerradoAfuera] = useState(false);
  const pendiente = evento.Estado === 'Pendiente' && !cerradoAfuera;
  const fecha = parseDateString(evento.Fecha);

  async function realizar() {
    setGuardando(true);
    setError(null);
    try {
      await onRealizar();
    } catch (err) {
      if (esConflicto(err)) setCerradoAfuera(true);
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
      setGuardando(false);
    }
  }

  return (
    <Modal open onClose={() => !guardando && onClose()} title={evento.Titulo} width={560}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-wash-text-muted">
          <StatusBadge status={evento.Estado} />
          <span>{fecha ? fechaLarga(fecha) : evento.Fecha}</span>
          <span className="inline-flex items-center gap-1">
            · <Clock size={12} /> {horario(evento)}
          </span>
        </div>

        {evento.Descripcion ? (
          <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-wash-text-strong">
            {evento.Descripcion}
          </p>
        ) : (
          <p className="text-[13px] italic text-wash-text-faint">Sin descripción.</p>
        )}

        <div className="rounded-lg bg-wash-canvas px-3 py-2 text-[12px] text-wash-text-muted ring-1 ring-wash-border">
          <p>
            Cargado por {evento.Usuario || '—'} · {evento.FechaCarga} {evento.HoraCarga}
          </p>
          {evento.UsuarioMod && (
            <p className="mt-0.5">
              {evento.Estado === 'Pendiente' ? 'Editado' : evento.Estado} por {evento.UsuarioMod} · {evento.FechaMod} {evento.HoraMod}
            </p>
          )}
        </div>

        {error && <p className="text-[13px] font-medium text-red-700">{error}</p>}
      </div>

      <ModalActions>
        {pendiente ? (
          <>
            <button
              type="button"
              disabled={guardando}
              onClick={onAnular}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-wash-canvas px-3 py-2 text-sm font-medium text-wash-text ring-1 ring-wash-border hover:bg-wash-border/40 disabled:opacity-50"
            >
              <Ban size={15} />
              Anular
            </button>
            <button
              type="button"
              disabled={guardando}
              onClick={onEditar}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-wash-canvas px-3 py-2 text-sm font-medium text-wash-text ring-1 ring-wash-border hover:bg-wash-border/40 disabled:opacity-50"
            >
              <Pencil size={15} />
              Editar
            </button>
            <button
              type="button"
              disabled={guardando}
              onClick={realizar}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-wash-brand px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              <Check size={15} />
              {guardando ? 'Guardando…' : 'Marcar realizado'}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-wash-canvas px-3 py-2 text-sm font-medium text-wash-text ring-1 ring-wash-border hover:bg-wash-border/40"
          >
            Cerrar
          </button>
        )}
      </ModalActions>
    </Modal>
  );
}

function DetalleVentilacion({
  ventilacion: v,
  vencida,
  onClose,
  onVerEnModulo,
}: {
  ventilacion: Ventilacion;
  vencida: boolean;
  onClose: () => void;
  /** Sólo si el rol tiene el módulo Ventilación. */
  onVerEnModulo?: () => void;
}) {
  const realizada = v.Estado_VE === 'Realizada';
  const observacion = realizada ? v.ObservacionResuelto_VE : v.EsIncidente_VE === 'SI' ? v.ObservacionAdelanto_VE : '';

  return (
    <Modal open onClose={onClose} title="Ventilación" width={560}>
      <div className="rounded-xl bg-wash-surface-2/50 p-4 ring-1 ring-wash-border">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1',
              tonoDe({ tipo: 'ventilacion', key: '', dia: '', ventilacion: v, vencida })
            )}
          >
            <Wind size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[15px] font-black text-wash-accent">{v.Edificio_VE}</p>
            {v.DireccionEdificio_VE && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-wash-text-muted">
                <Building2 size={11} className="shrink-0" />
                <span className="truncate">{v.DireccionEdificio_VE}</span>
              </p>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-wash-text-muted">
              {v.Grupo_VE && (
                <>
                  <span>Grupo</span>
                  <span className="rounded-md bg-wash-surface px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-wash-text">
                    {v.Grupo_VE}
                  </span>
                </>
              )}
              {v.Asignado_VE && (
                <>
                  {v.Grupo_VE && <span className="text-wash-text-faint">·</span>}
                  <span>{v.Asignado_VE}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Field
          label="Estado"
          value={
            <span className="flex flex-wrap items-center gap-1.5">
              <StatusBadge status={v.Estado_VE} />
              {vencida && (
                <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10.5px] font-bold uppercase text-rose-600 ring-1 ring-rose-500/20">
                  Vencida
                </span>
              )}
            </span>
          }
        />
        <Field label={etiquetaFechaVentilacion(v)} value={fechaVentilacion(v) || 'Sin fecha'} />
        <Field label="Última limpieza" value={v.FechaUltima_VE || '—'} />
        <Field label="Frecuencia" value={v.Frecuencia_VE ? `${v.Frecuencia_VE} días` : '—'} />
      </div>

      {observacion && (
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">
            {realizada ? 'Observación' : 'Motivo del adelanto'}
          </p>
          <p className="mt-1.5 whitespace-pre-wrap rounded-xl border border-wash-border bg-wash-surface px-4 py-3 text-sm leading-relaxed text-wash-text-strong">
            {observacion}
          </p>
        </div>
      )}

      <ModalActions>
        {onVerEnModulo && (
          <button
            type="button"
            onClick={onVerEnModulo}
            className="flex items-center justify-center gap-2 rounded-lg border border-wash-border px-5 py-2.5 font-medium text-wash-text-strong hover:bg-wash-surface-2"
          >
            <ExternalLink size={15} />
            Ver en Ventilaciones
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-wash-action px-5 py-2.5 font-medium text-white hover:bg-wash-action-dark"
        >
          Cerrar
        </button>
      </ModalActions>
    </Modal>
  );
}

function EventoForm({
  evento,
  fechaInicial,
  onClose,
  onGuardado,
  onConflicto,
}: {
  /** Si viene, es edición. */
  evento?: EventoCalendario;
  fechaInicial?: Date;
  onClose: () => void;
  /** Recibe los meses (mm/yyyy) a refrescar. */
  onGuardado: (meses: string[]) => void;
  /** El evento ya estaba cerrado (409): refrescar su mes para mostrar el estado real. */
  onConflicto: (meses: string[]) => void;
}) {
  const [titulo, setTitulo] = useState(evento?.Titulo ?? '');
  const [fecha, setFecha] = useState<Date | undefined>(evento ? parseDateString(evento.Fecha) : fechaInicial);
  const [horaInicio, setHoraInicio] = useState(evento?.HoraInicio ?? '');
  const [horaFin, setHoraFin] = useState(evento?.HoraFin ?? '');
  const [descripcion, setDescripcion] = useState(evento?.Descripcion ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mismas reglas que valida el backend (api/_lib/calendario.ts → validarEvento).
  const errorHoras =
    horaFin && !horaInicio
      ? 'Para cargar la hora de fin falta la de inicio.'
      : horaFin && horaFin <= horaInicio
        ? 'La hora de fin tiene que ser posterior a la de inicio.'
        : null;
  const ready = !!titulo.trim() && !!fecha && !errorHoras;

  async function guardar() {
    if (!fecha) return;
    setSaving(true);
    setError(null);
    const payload: api.EventoPayload = {
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      fecha: formatDateDDMMYYYY(fecha),
      horaInicio,
      horaFin,
    };
    try {
      if (evento) await api.editarEvento(evento.ID, payload);
      else await api.crearEvento(payload);
      onGuardado([...new Set([mesAnoDe(fecha), ...(evento ? [evento.FechaMesAno] : [])])]);
    } catch (err) {
      if (evento && esConflicto(err)) onConflicto([evento.FechaMesAno]);
      setError(err instanceof Error ? err.message : 'No se pudo guardar el evento.');
      setSaving(false);
    }
  }

  const inputCls =
    'mt-1.5 h-10 w-full rounded-lg border border-wash-border bg-wash-surface px-3 text-sm outline-none focus:border-wash-action focus:ring-2 focus:ring-wash-action/15';

  return (
    // Mientras guarda no se cierra (Escape / fondo): si el POST fallaba, el error se perdía, y si
    // salía bien se podía reabrir y duplicar el evento.
    <Modal open onClose={() => !saving && onClose()} title={evento ? 'Editar evento' : 'Nuevo evento'} width={560}>
      {error && (
        <div
          role="alert"
          className="mb-3 flex items-center gap-2 rounded-r-md border-l-4 border-red-500 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700"
        >
          <AlertTriangle size={14} className="shrink-0" />
          {error}
        </div>
      )}
      <div className="space-y-4">
        <div>
          <LabelReq required>Título</LabelReq>
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={255}
            placeholder="Ej. Reunión con el consorcio"
            className={inputCls}
          />
        </div>
        <div>
          <LabelReq required>Fecha</LabelReq>
          <div className="mt-1.5">
            <DatePicker value={fecha} onChange={setFecha} placeholder="Seleccionar fecha…" />
          </div>
        </div>
        <div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <LabelReq>Hora inicio</LabelReq>
              <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} className={inputCls} />
            </div>
            <div>
              <LabelReq>Hora fin</LabelReq>
              <input type="time" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-2 text-[12px]">
            <span className={errorHoras ? 'font-medium text-red-700' : 'text-wash-text-faint'}>
              {errorHoras ?? 'Sin hora, el evento es de todo el día.'}
            </span>
            {(horaInicio || horaFin) && (
              <button
                type="button"
                onClick={() => {
                  setHoraInicio('');
                  setHoraFin('');
                }}
                className="shrink-0 font-semibold text-wash-text-muted hover:text-wash-text-strong"
              >
                Todo el día
              </button>
            )}
          </div>
        </div>
        <div>
          <LabelReq>Descripción</LabelReq>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={3}
            maxLength={4000}
            className="mt-1.5 w-full rounded-lg border border-wash-border bg-wash-surface px-3 py-2 text-sm outline-none focus:border-wash-action focus:ring-2 focus:ring-wash-action/15"
          />
        </div>
      </div>
      <ModalActions>
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="rounded-lg border border-wash-border px-5 py-2.5 font-medium text-wash-text-strong hover:bg-wash-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!ready || saving}
          onClick={guardar}
          className="flex items-center justify-center gap-2 rounded-lg bg-wash-action px-5 py-2.5 font-semibold text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </ModalActions>
    </Modal>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-wash-surface-2/40 px-3 py-2 ring-1 ring-wash-border">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-wash-text-muted">{label}</div>
      <div className="mt-1 text-[12.5px] font-semibold text-wash-text-strong">{value}</div>
    </div>
  );
}

function LabelReq({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">
      {children}
      {required && <span className="text-rose-500">*</span>}
    </label>
  );
}
