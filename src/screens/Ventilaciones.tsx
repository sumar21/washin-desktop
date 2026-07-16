import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  UserCog,
  Trash2,
  AlertTriangle,
  Building2,
  Calendar,
  Eye,
  Plus,
  CheckCircle2,
  Zap,
  Wind,
  Loader2,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/DataTable';
import { Modal, ModalActions, ConfirmDialog } from '@/components/Modal';
import { StatusBadge } from '@/components/StatusBadge';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { ErrorState } from '@/components/ErrorState';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PopoverClose } from '@/components/ui/popover';
import { Combobox } from '@/components/ui/combobox';
import { MultiSelect, type MultiOption } from '@/components/ui/multi-select';
import { last12MesesOptions, estadoOptions } from '@/lib/filters';
import { DatePicker, formatDateDDMMYYYY, parseDateString } from '@/components/ui/date-picker';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import type { Ventilacion, EdificioVent } from '@/types/domain';

const ESTADOS: Ventilacion['Estado_VE'][] = ['Pendiente', 'Asignada', 'Programada', 'Realizada'];
const PROXIMAS = 'PROXIMAS';
const DIAS_VENTANA = 90; // fiel a PowerApp: DateDiff(Today, ProximaLimpieza) <= 90

/** Días desde hoy hasta la próxima limpieza (negativo = vencida). Sin fecha → 0 (se muestra). */
function diasHastaProxima(ddmmyyyy: string): number {
  const d = parseDateString(ddmmyyyy);
  if (!d) return 0;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - hoy.getTime()) / 86_400_000);
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Ventana de meses de la PowerApp: desde hoy+3 meses hacia atrás, 15 meses. */
function buildPeriodos(): { value: string; label: string }[] {
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth() + 3, 1);
  const out: { value: string; label: string }[] = [];
  for (let i = 0; i < 15; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    out.push({ value: `${mm}/${d.getFullYear()}`, label: `${MESES_CORTOS[d.getMonth()]} ${d.getFullYear()}` });
  }
  return out;
}

/** Chip de urgencia según días a la próxima. */
function urgencia(dias: number): { label: string; tone: string } | null {
  if (dias < 0) return { label: `Vencida hace ${Math.abs(dias)}d`, tone: 'bg-rose-500/10 text-rose-600 ring-rose-500/20' };
  if (dias === 0) return { label: 'Hoy', tone: 'bg-rose-500/10 text-rose-600 ring-rose-500/20' };
  if (dias <= 7) return { label: `En ${dias}d`, tone: 'bg-amber-500/10 text-amber-700 ring-amber-500/20' };
  if (dias <= 30) return { label: `En ${dias}d`, tone: 'bg-indigo-500/10 text-indigo-700 ring-indigo-500/20' };
  return null;
}

const initials = (name: string) =>
  name
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

export function Ventilaciones() {
  const ventilaciones = useAppStore((s) => s.CollectVentilaciones);
  const edificios = useAppStore((s) => s.CollectEdificiosVent);
  const frecuencias = useAppStore((s) => s.CollectFrecuenciasVent);
  const grupos = useAppStore((s) => s.CollectGruposVent);
  const tecnicos = useAppStore((s) => s.CollectTecnicosDisponibles);
  const fetchVentilaciones = useAppStore((s) => s.fetchVentilaciones);
  const fetchTecnicos = useAppStore((s) => s.fetchTecnicos);
  const asignarVentilacion = useAppStore((s) => s.asignarVentilacion);
  const addVentilacionEdificio = useAppStore((s) => s.addVentilacionEdificio);
  const deleteVentilacion = useAppStore((s) => s.deleteVentilacion);
  const VarTipoUser = useAppStore((s) => s.VarTipoUser);

  // PowerApp: editar/asignar visible para Admin o Supervisor Ventilaciones.
  const canManage = VarTipoUser === 'Admin' || VarTipoUser === 'Supervisor Ventilaciones';

  const [query, setQuery] = useState('');
  const [filterMesAno, setFilterMesAno] = useState<string[]>([]);
  const [filterEstado, setFilterEstado] = useState<string[]>([]);
  const [filterEdif, setFilterEdif] = useState<string[]>([]);
  const [periodo, setPeriodo] = useState<string>(PROXIMAS);

  // Modals
  const [assigning, setAssigning] = useState<Ventilacion | null>(null);
  const [deleting, setDeleting] = useState<Ventilacion | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Ventilacion | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const periodos = useMemo(() => buildPeriodos(), []);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    return Promise.all([fetchVentilaciones(), fetchTecnicos()])
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'No se pudieron cargar las ventilaciones.'))
      .finally(() => setLoading(false));
  }, [fetchVentilaciones, fetchTecnicos]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial; "Reintentar" también dispara load().
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar.
  }, []);

  // Cambio de período (Próximas 90d ↔ un mes puntual): recarga desde SharePoint.
  const onPeriodoChange = (value: string) => {
    setPeriodo(value);
    setLoading(true);
    setLoadError(null);
    (value === PROXIMAS ? fetchVentilaciones() : fetchVentilaciones(value))
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'No se pudieron cargar las ventilaciones.'))
      .finally(() => setLoading(false));
  };

  const isProximas = periodo === PROXIMAS;

  // Base según modo: en "Próximas" aplica la ventana de 90 días (como la galería PowerApp).
  const base = useMemo(() => {
    const list = isProximas
      ? ventilaciones.filter((v) => diasHastaProxima(v.ProximaLimpieza_VE) <= DIAS_VENTANA)
      : ventilaciones;
    return list;
  }, [ventilaciones, isProximas]);

  const counters = useMemo(() => {
    const pendientes = base.filter((v) => v.Estado_VE === 'Pendiente').length;
    const vencidas = base.filter((v) => diasHastaProxima(v.ProximaLimpieza_VE) < 0).length;
    const adelantadas = base.filter((v) => v.EsIncidente_VE === 'SI').length;
    const asignadas = base.filter((v) => v.Estado_VE === 'Asignada' || v.Estado_VE === 'Programada').length;
    return { pendientes, vencidas, adelantadas, asignadas };
  }, [base]);

  const mesAnoOpts = useMemo(() => last12MesesOptions(), []);
  // Estado canónico siempre presente + valores extra de los datos (nunca "Sin opciones").
  const estadoOpts = useMemo(() => estadoOptions([...ESTADOS, ...base.map((v) => v.Estado_VE)], ESTADOS), [base]);
  const edificioOpts = useMemo<MultiOption[]>(
    () =>
      [...new Set(base.map((v) => v.Edificio_VE).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'es'))
        .map((e) => ({ value: e, label: e })),
    [base]
  );
  const mesAnoLabel = useMemo(() => new Map(mesAnoOpts.map((o) => [o.value, o.label])), [mesAnoOpts]);

  const activeChips = useMemo<{ cat: string; label: string }[]>(() => {
    const chips: { cat: string; label: string }[] = [];
    filterMesAno.forEach((v) => chips.push({ cat: 'Mes', label: mesAnoLabel.get(v) ?? v }));
    filterEstado.forEach((v) => chips.push({ cat: 'Estado', label: v }));
    filterEdif.forEach((v) => chips.push({ cat: 'Edificio', label: v }));
    return chips;
  }, [filterMesAno, filterEstado, filterEdif, mesAnoLabel]);

  const hasFilters = activeChips.length > 0;
  const clearFilters = () => {
    setFilterMesAno([]);
    setFilterEstado([]);
    setFilterEdif([]);
  };

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    const pass = (arr: string[], v: string) => arr.length === 0 || arr.includes(v);
    return base
      .filter((v) => pass(filterMesAno, v.FechaMesAnoProxima_VE))
      .filter((v) => pass(filterEstado, v.Estado_VE))
      .filter((v) => pass(filterEdif, v.Edificio_VE))
      .filter(
        (v) =>
          v.Edificio_VE.toLowerCase().includes(q) ||
          v.Grupo_VE.toLowerCase().includes(q) ||
          v.Estado_VE.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        // EsIncidente (SI primero) → Orden → días a la próxima ascendente.
        const inc = (b.EsIncidente_VE === 'SI' ? 1 : 0) - (a.EsIncidente_VE === 'SI' ? 1 : 0);
        if (inc) return inc;
        const orden = (a.Orden_VE ?? 99) - (b.Orden_VE ?? 99);
        if (orden) return orden;
        return diasHastaProxima(a.ProximaLimpieza_VE) - diasHastaProxima(b.ProximaLimpieza_VE);
      });
  }, [base, query, filterMesAno, filterEstado, filterEdif]);

  const handleDelete = async () => {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteVentilacion(deleting.ID);
      setDeleting(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'No se pudo eliminar la ventilación.');
    } finally {
      setDeleteBusy(false);
    }
  };

  const columns: Column<Ventilacion>[] = [
    {
      key: 'estado',
      header: 'Estado',
      width: '170px',
      truncate: false,
      render: (v) => (
        <div className="flex items-center gap-2">
          <StatusBadge status={v.Estado_VE} />
          {v.EsIncidente_VE === 'SI' && (
            <span
              title="La fecha fue adelantada por un técnico"
              className="flex h-5 w-5 items-center justify-center rounded-md bg-rose-50 text-rose-600 ring-1 ring-rose-200"
            >
              <AlertTriangle size={11} />
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'edificio',
      header: 'Edificio / Hotel',
      width: 'minmax(240px, 1fr)',
      render: (v) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wash-brand/10 text-wash-brand ring-1 ring-wash-brand/20">
            <Building2 size={14} />
          </span>
          <span className="truncate text-[13px] font-semibold text-wash-text-strong">{v.Edificio_VE}</span>
        </div>
      ),
    },
    {
      key: 'grupo',
      header: 'Grupo',
      width: '90px',
      align: 'center',
      truncate: false,
      render: (v) => (
        <span className="inline-flex min-w-[36px] items-center justify-center rounded-md bg-wash-surface-2 px-2 py-0.5 text-[12.5px] font-semibold text-wash-text-strong tabular-nums">
          {v.Grupo_VE}
        </span>
      ),
    },
    {
      key: 'frecuencia',
      header: 'Frec.',
      width: '90px',
      align: 'center',
      truncate: false,
      render: (v) =>
        v.Frecuencia_VE ? (
          <span className="text-[12px] text-wash-text-muted tabular-nums">{v.Frecuencia_VE}d</span>
        ) : (
          <span className="text-wash-text-faint">—</span>
        ),
    },
    {
      key: 'asignado',
      header: 'Asignado',
      width: '180px',
      truncate: false,
      render: (v) =>
        v.Asignado_VE ? (
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[9.5px] font-semibold text-slate-600">
              {initials(v.Asignado_VE)}
            </span>
            <span className="truncate text-[12.5px] text-wash-text-strong">{v.Asignado_VE}</span>
          </div>
        ) : (
          <span className="text-wash-text-faint">—</span>
        ),
    },
    {
      key: 'proxima',
      header: 'Próxima limpieza',
      width: '190px',
      truncate: false,
      render: (v) => {
        const shown = v.FechaProgramada_VE || v.ProximaLimpieza_VE;
        const u = urgencia(diasHastaProxima(shown));
        return (
          <div className="flex min-w-0 items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-wash-text-strong">
              <Calendar size={11} className="text-wash-brand" />
              {shown}
            </span>
            {u && (
              <span className={cn('shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ring-1', u.tone)}>
                {u.label}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'Acciones',
      width: '120px',
      align: 'right',
      truncate: false,
      render: (v) => (
        <div className="flex items-center justify-end gap-1.5">
          {v.Estado_VE === 'Realizada' ? (
            <ActionButton icon={Eye} tone="neutral" title="Ver observación" onClick={(e) => { e.stopPropagation(); setViewing(v); }} />
          ) : (
            canManage && (
              <ActionButton icon={UserCog} tone="brand" title="Asignar técnico" onClick={(e) => { e.stopPropagation(); setAssigning(v); }} />
            )
          )}
          {canManage && v.Estado_VE !== 'Realizada' && (
            <ActionButton icon={Trash2} tone="danger" title="Eliminar" onClick={(e) => { e.stopPropagation(); setDeleting(v); setDeleteError(null); }} />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="relative flex h-full w-full flex-col">
      <PageHeader
        title="Ventilaciones"
        subtitle="Mantenimiento preventivo de conductos"
        search={{ value: query, onChange: setQuery, placeholder: 'Buscar edificio, grupo, estado…' }}
        filterPopover={
          <FilterContent
            mesAno={filterMesAno}
            estado={filterEstado}
            edificio={filterEdif}
            mesAnoOpts={mesAnoOpts}
            estadoOpts={estadoOpts}
            edificioOpts={edificioOpts}
            onApply={(f) => {
              setFilterMesAno(f.mesAno);
              setFilterEstado(f.estado);
              setFilterEdif(f.edificio);
            }}
          />
        }
        onAdd={canManage ? () => setAddOpen(true) : undefined}
        addLabel="Agregar edificio"
        toolbarExtra={
          <Select value={periodo} onValueChange={onPeriodoChange} disabled={loading}>
            <SelectTrigger className="h-9 w-[150px] shrink-0 bg-wash-canvas text-[13px] ring-wash-border sm:w-[184px]">
              <Calendar size={13} className="shrink-0 text-wash-text-muted" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[320px]">
              <SelectItem value={PROXIMAS}>Próximas (90 días)</SelectItem>
              {periodos.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <LoadingOverlay visible={loading} label="Cargando ventilaciones…" />

      {loadError ? (
        <ErrorState message={loadError} onRetry={load} />
      ) : (
        <>
          {/* KPIs — mini-stats compactos en 1 fila (el selector de Período vive en el header) */}
          <div className="border-b border-wash-border bg-wash-surface px-4 py-2.5 md:px-6 md:py-3">
            <div className="grid grid-cols-4 gap-2 md:gap-3">
              <CounterCard icon={AlertTriangle} label="Pendientes" value={counters.pendientes} tone="bg-amber-500/10 text-amber-700 ring-amber-500/20" />
              <CounterCard icon={Calendar} label="Vencidas" value={counters.vencidas} tone="bg-rose-500/10 text-rose-600 ring-rose-500/20" />
              <CounterCard icon={Zap} label="Adelantadas" value={counters.adelantadas} tone="bg-fuchsia-500/10 text-fuchsia-600 ring-fuchsia-500/20" />
              <CounterCard icon={CheckCircle2} label="Asignadas" value={counters.asignadas} tone="bg-emerald-500/10 text-emerald-700 ring-emerald-500/20" />
            </div>
          </div>

          {/* Active filter chips */}
          {hasFilters && (
            <div className="flex flex-wrap items-center gap-2 border-b border-wash-border bg-wash-surface-2/40 px-4 py-2 text-xs text-wash-text-muted md:px-6">
              <span className="font-semibold uppercase tracking-wider">Filtros:</span>
              {activeChips.map((c, idx) => (
                <span
                  key={`${c.cat}-${c.label}-${idx}`}
                  className="rounded-full bg-wash-brand/10 px-2.5 py-0.5 font-semibold text-wash-brand"
                >
                  <span className="text-wash-brand/70">{c.cat}:</span> {c.label}
                </span>
              ))}
              <button
                type="button"
                onClick={clearFilters}
                className="ml-auto text-wash-text-muted hover:text-wash-text-strong"
              >
                Limpiar
              </button>
            </div>
          )}

          <div className="flex-1 overflow-hidden p-3 md:p-6">
            <DataTable
              rows={filtered}
              rowKey={(r) => r.ID}
              columns={columns}
              empty={
                <EmptyState
                  icon={Wind}
                  title={isProximas ? 'Sin ventilaciones próximas' : 'Sin ventilaciones este mes'}
                  description={
                    hasFilters
                      ? 'Probá quitar algunos filtros.'
                      : isProximas
                        ? 'No hay ventilaciones dentro de la ventana de 90 días.'
                        : 'No hay ventilaciones programadas para el período elegido.'
                  }
                  action={hasFilters ? <Button variant="outline" onClick={clearFilters}>Limpiar filtros</Button> : undefined}
                />
              }
              mobileCard={(v) => {
                const shown = v.FechaProgramada_VE || v.ProximaLimpieza_VE;
                const u = urgencia(diasHastaProxima(shown));
                return (
                  <div className="rounded-xl border border-wash-border bg-wash-surface p-3 shadow-sm transition active:scale-[0.99]">
                    {/* Fila 1: estado (+ adelantada) + grupo · acciones */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <StatusBadge status={v.Estado_VE} />
                        {v.EsIncidente_VE === 'SI' && (
                          <span
                            title="La fecha fue adelantada por un técnico"
                            className="flex h-5 w-5 items-center justify-center rounded-md bg-rose-50 text-rose-600 ring-1 ring-rose-200"
                          >
                            <AlertTriangle size={11} />
                          </span>
                        )}
                        <span className="inline-flex items-center rounded-md bg-wash-surface-2 px-1.5 py-0.5 text-[10.5px] font-semibold text-wash-text-strong tabular-nums">
                          Grupo {v.Grupo_VE}
                        </span>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        {v.Estado_VE === 'Realizada' ? (
                          <ActionButton icon={Eye} tone="neutral" title="Ver observación" onClick={(e) => { e.stopPropagation(); setViewing(v); }} />
                        ) : (
                          canManage && (
                            <ActionButton icon={UserCog} tone="brand" title="Asignar técnico" onClick={(e) => { e.stopPropagation(); setAssigning(v); }} />
                          )
                        )}
                        {canManage && v.Estado_VE !== 'Realizada' && (
                          <ActionButton icon={Trash2} tone="danger" title="Eliminar" onClick={(e) => { e.stopPropagation(); setDeleting(v); setDeleteError(null); }} />
                        )}
                      </div>
                    </div>
                    {/* Fila 2: edificio + técnico */}
                    <div className="mt-2 min-w-0">
                      <p className="flex items-center gap-1.5 text-[13.5px] font-semibold text-wash-text-strong">
                        <Building2 size={13} className="shrink-0 text-wash-brand" />
                        <span className="truncate">{v.Edificio_VE}</span>
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11.5px] text-wash-text-muted">
                        {v.Asignado_VE ? (
                          <>
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[8px] font-semibold text-slate-600">
                              {initials(v.Asignado_VE)}
                            </span>
                            <span className="truncate">{v.Asignado_VE}</span>
                          </>
                        ) : (
                          <span className="italic text-wash-text-faint">Sin asignar</span>
                        )}
                      </p>
                    </div>
                    {/* Fila 3: última / próxima + urgencia */}
                    <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-wash-divider/60 pt-2 text-[11.5px] text-wash-text-muted">
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <Calendar size={11} className="shrink-0 text-wash-text-faint" />
                        <span className="truncate">{v.FechaUltima_VE ? `Últ: ${v.FechaUltima_VE}` : 'Primera vez'}</span>
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 font-semibold text-wash-text-strong">
                          <Calendar size={11} className="text-wash-brand" />
                          {shown}
                        </span>
                        {u && <span className={cn('rounded px-1.5 py-0.5 text-[9.5px] font-bold ring-1', u.tone)}>{u.label}</span>}
                      </span>
                    </div>
                  </div>
                );
              }}
            />
          </div>
        </>
      )}

      {/* Asignar técnico */}
      <AssignModal
        ventilacion={assigning}
        tecnicos={tecnicos}
        frecuencias={frecuencias}
        onClose={() => setAssigning(null)}
        onAssign={async (payload) => {
          if (!assigning) return;
          await asignarVentilacion(assigning.ID, payload);
          setAssigning(null);
        }}
      />

      {/* Ver observación (Realizada) */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Ventilación realizada" width={560}>
        {viewing && (
          <>
            <div className="rounded-xl bg-wash-surface-2/50 p-4 ring-1 ring-wash-border">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20">
                  <CheckCircle2 size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[15px] font-black text-wash-accent">{viewing.Edificio_VE}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-wash-text-muted">
                    <span>Grupo</span>
                    <span className="rounded-md bg-wash-surface px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-wash-text">{viewing.Grupo_VE}</span>
                    {viewing.Asignado_VE && (
                      <>
                        <span className="text-wash-text-faint">·</span>
                        <span>{viewing.Asignado_VE}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field icon={Calendar} label="Última limpieza" value={viewing.FechaFinalizacion_VE || viewing.FechaUltima_VE || '—'} />
              <Field icon={Calendar} label="Próxima limpieza" value={viewing.ProximaLimpieza_VE || '—'} />
            </div>

            <div className="mt-4">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">Observación</label>
              <div className="relative mt-1.5 overflow-hidden rounded-xl border border-wash-border bg-wash-surface px-5 py-4">
                <span className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-emerald-400 to-emerald-600" />
                <p className="text-sm leading-relaxed text-wash-text-strong">
                  {viewing.ObservacionResuelto_VE || (
                    <span className="italic text-wash-text-muted">Sin observación registrada.</span>
                  )}
                </p>
              </div>
            </div>

            <ModalActions>
              <button
                type="button"
                onClick={() => setViewing(null)}
                className="rounded-lg bg-wash-action px-5 py-2.5 font-medium text-white hover:bg-wash-action-dark"
              >
                Cerrar
              </button>
            </ModalActions>
          </>
        )}
      </Modal>

      {/* Eliminar */}
      <ConfirmDialog
        open={!!deleting}
        tone="danger"
        title="Eliminar ventilación"
        message={
          deleting
            ? `¿Eliminar la ventilación de ${deleting.Edificio_VE} (Grupo ${deleting.Grupo_VE})? Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel={deleteBusy ? 'Eliminando…' : 'Eliminar'}
        busy={deleteBusy}
        error={deleteError}
        onCancel={() => {
          setDeleting(null);
          setDeleteError(null);
        }}
        onConfirm={handleDelete}
      />

      {/* Agregar edificio al circuito */}
      <AddEdificioModal
        open={addOpen}
        edificios={edificios}
        frecuencias={frecuencias}
        grupos={grupos}
        onClose={() => setAddOpen(false)}
        onAdd={async (payload) => {
          await addVentilacionEdificio(payload);
          setAddOpen(false);
        }}
      />
    </div>
  );
}

// ───────────────────────── subcomponents ─────────────────────────

function ActionButton({
  icon: Icon,
  tone,
  title,
  onClick,
}: {
  icon: typeof Eye;
  tone: 'neutral' | 'brand' | 'danger';
  title: string;
  onClick: (e: React.MouseEvent) => void;
}) {
  const cls = {
    neutral: 'text-wash-text-muted ring-wash-border hover:bg-wash-surface-2 hover:text-wash-text-strong hover:ring-wash-text-muted/40',
    brand: 'text-wash-brand ring-wash-brand/30 hover:bg-wash-brand/10 hover:ring-wash-brand',
    danger: 'text-rose-600 ring-rose-500/30 hover:bg-rose-500/10 hover:ring-rose-500',
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn('flex h-8 w-8 items-center justify-center rounded-lg ring-1 transition', cls)}
    >
      <Icon size={15} />
    </button>
  );
}

function CounterCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Eye;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="rounded-lg border border-wash-border bg-wash-surface px-2 py-1.5 md:px-3 md:py-2">
      <div className="flex items-center gap-1.5">
        <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-md ring-1 md:h-7 md:w-7', tone)}>
          <Icon size={13} />
        </span>
        <span className="font-display text-lg font-black leading-none text-wash-text-strong tabular-nums md:text-xl">{value}</span>
      </div>
      <div className="mt-1 truncate text-[9px] font-semibold uppercase tracking-wide text-wash-text-muted md:text-[10px] md:tracking-wider">{label}</div>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  value,
}: {
  icon?: typeof Eye;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-wash-surface-2/40 px-3 py-2 ring-1 ring-wash-border">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-wash-text-muted">
        {Icon && <Icon size={11} className="opacity-70" />}
        {label}
      </div>
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

// ───────────────────────── Assign modal ─────────────────────────

interface AsignarPayload {
  tecnico: string;
  idTecnico: number;
  proximaLimpieza: string;
  frecuencia: string;
  idEdificio: number;
  esIncidente: 'SI' | 'NO';
  frecuenciaChanged: boolean;
}

function AssignModal({
  ventilacion,
  tecnicos,
  frecuencias,
  onClose,
  onAssign,
}: {
  ventilacion: Ventilacion | null;
  tecnicos: { ID: number; Nombre_Tecnico: string }[];
  frecuencias: string[];
  onClose: () => void;
  onAssign: (payload: AsignarPayload) => Promise<void>;
}) {
  // Se bindea por ID de técnico (no por nombre): dos técnicos homónimos tienen IDs
  // distintos → se evita escribir un IDAsignado_VE ambiguo.
  const [tecnicoId, setTecnicoId] = useState('');
  const [fecha, setFecha] = useState<Date | undefined>(undefined);
  const [frecuencia, setFrecuencia] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ventilacion) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicia el form al abrir para una ventilación.
    setTecnicoId(ventilacion.IDAsignado_VE ? String(ventilacion.IDAsignado_VE) : '');
    setFecha(parseDateString(ventilacion.ProximaLimpieza_VE));
    setFrecuencia(ventilacion.Frecuencia_VE ?? '');
    setError(null);
  }, [ventilacion]);

  if (!ventilacion) return null;
  const esIncidente = ventilacion.EsIncidente_VE === 'SI';
  // Asegura que la frecuencia actual esté siempre disponible en el combo.
  const frecOpts = frecuencias.includes(frecuencia) || !frecuencia ? frecuencias : [frecuencia, ...frecuencias];
  const ready = !!tecnicoId && !!fecha && !!frecuencia;

  return (
    <Modal open={!!ventilacion} onClose={onClose} title="Asignar ventilación" width={560}>
      <div className="rounded-xl bg-wash-surface-2/50 p-4 ring-1 ring-wash-border">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-wash-brand/10 text-wash-brand ring-1 ring-wash-brand/20">
            <Building2 size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[15px] font-black text-wash-accent">{ventilacion.Edificio_VE}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-wash-text-muted">
              <span>Grupo</span>
              <span className="rounded-md bg-wash-surface px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-wash-text">{ventilacion.Grupo_VE}</span>
              {ventilacion.FechaUltima_VE && (
                <>
                  <span className="text-wash-text-faint">·</span>
                  <span>Últ: {ventilacion.FechaUltima_VE}</span>
                </>
              )}
            </div>
          </div>
          <StatusBadge status={ventilacion.Estado_VE} />
        </div>
      </div>

      {esIncidente && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800 ring-1 ring-rose-200">
          <AlertTriangle size={13} className="mt-0.5 shrink-0 text-rose-500" />
          <span>
            La fecha fue <strong>adelantada por un técnico</strong>. Revisá la frecuencia: si la corregís acá, se actualiza también en el edificio.
          </span>
        </div>
      )}

      {error && (
        <div role="alert" className="mt-3 flex items-center gap-2 rounded-r-md border-l-4 border-red-500 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700">
          <AlertTriangle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      <div className="mt-4 space-y-4">
        <div>
          <LabelReq required>Técnico</LabelReq>
          <div className="mt-1.5">
            <Combobox
              options={tecnicos.map((t) => ({ value: String(t.ID), label: t.Nombre_Tecnico }))}
              value={tecnicoId || null}
              onChange={setTecnicoId}
              placeholder="Elegir técnico…"
              searchPlaceholder="Buscar técnico…"
              emptyText="Sin técnicos"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <LabelReq required>Próxima limpieza</LabelReq>
            <div className="mt-1.5">
              <DatePicker value={fecha} onChange={setFecha} placeholder="Seleccionar fecha…" />
            </div>
          </div>
          <div>
            <LabelReq required>Frecuencia (días)</LabelReq>
            <div className="mt-1.5">
              <Select value={frecuencia || undefined} onValueChange={setFrecuencia}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder="Elegir…" />
                </SelectTrigger>
                <SelectContent>
                  {frecOpts.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f} días
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-wash-text-muted">
        Al asignar, la ventilación pasa a estado <strong>Asignada</strong>.
      </p>

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
          onClick={async () => {
            if (!fecha) return;
            const t = tecnicos.find((x) => String(x.ID) === tecnicoId);
            if (!t) {
              setError('Elegí un técnico válido.');
              return;
            }
            setSaving(true);
            setError(null);
            try {
              await onAssign({
                tecnico: t.Nombre_Tecnico,
                idTecnico: t.ID,
                proximaLimpieza: formatDateDDMMYYYY(fecha),
                frecuencia,
                idEdificio: ventilacion.IDEdificio_VE,
                esIncidente: esIncidente ? 'SI' : 'NO',
                frecuenciaChanged: frecuencia !== (ventilacion.Frecuencia_VE ?? ''),
              });
            } catch (err) {
              setError(err instanceof Error ? err.message : 'No se pudo asignar la ventilación.');
            } finally {
              setSaving(false);
            }
          }}
          className="flex items-center gap-2 rounded-lg bg-wash-action px-5 py-2.5 font-semibold text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <UserCog size={15} />}
          {saving ? 'Asignando…' : 'Asignar'}
        </button>
      </ModalActions>
    </Modal>
  );
}

// ───────────────────────── Add edificio modal ─────────────────────────

interface AddPayload {
  idEdificio: number;
  edificio: string;
  direccion: string;
  grupo: string;
  frecuencia: string;
  proximaLimpieza: string;
}

function AddEdificioModal({
  open,
  edificios,
  frecuencias,
  grupos,
  onClose,
  onAdd,
}: {
  open: boolean;
  edificios: EdificioVent[];
  frecuencias: string[];
  grupos: string[];
  onClose: () => void;
  onAdd: (payload: AddPayload) => Promise<void>;
}) {
  // Se bindea por ID (no por nombre `Micasa`): dos edificios homónimos con IDs
  // distintos no colisionan → nunca se actualiza/crea contra el edificio equivocado.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [grupo, setGrupo] = useState('');
  const [frecuencia, setFrecuencia] = useState('');
  const [proxima, setProxima] = useState<Date | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = edificios.find((e) => String(e.ID) === selectedId) ?? null;
  const edificioOptions = useMemo(
    () =>
      edificios.map((e) => ({
        value: String(e.ID),
        label: e.Edificio,
        sublabel: e.Codigo ? `${e.Codigo} · ${e.Direccion}` : e.Direccion,
      })),
    [edificios]
  );

  const reset = () => {
    setSelectedId(null);
    setGrupo('');
    setFrecuencia('');
    setProxima(undefined);
    setError(null);
  };

  const pickEdificio = (id: string) => {
    setSelectedId(id);
    const found = edificios.find((e) => String(e.ID) === id);
    if (found) {
      setGrupo(found.Grupo || '');
      if (found.Frecuencia) setFrecuencia(found.Frecuencia);
    }
  };

  const frecOpts = frecuencias.includes(frecuencia) || !frecuencia ? frecuencias : [frecuencia, ...frecuencias];
  const ready = !!selected && !!grupo.trim() && !!frecuencia && !!proxima;

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Agregar edificio al circuito"
      width={580}
    >
      <p className="text-sm text-wash-text-muted">
        Sumá un edificio al circuito de ventilaciones: define su grupo, frecuencia y la primera fecha de limpieza.
      </p>

      {error && (
        <div role="alert" className="mt-3 flex items-center gap-2 rounded-r-md border-l-4 border-red-500 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700">
          <AlertTriangle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      <div className="mt-4 space-y-4">
        <div>
          <LabelReq required>Edificio / Hotel</LabelReq>
          <div className="mt-1.5">
            <Combobox
              options={edificioOptions}
              value={selectedId}
              onChange={pickEdificio}
              placeholder="Elegir edificio…"
              searchPlaceholder="Buscar por nombre, código o dirección…"
              emptyText="Sin edificios"
            />
          </div>
          {selected && (
            <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-wash-text-muted">
              <span className="rounded bg-wash-surface-2 px-1.5 py-0.5 font-mono font-semibold text-wash-text">{selected.Codigo || 's/código'}</span>
              <span className="truncate">{selected.Direccion}</span>
              {selected.EnCircuito && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700">Ya está en el circuito</span>
              )}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <LabelReq required>Grupo</LabelReq>
            <input
              type="text"
              list="grupos-vent-list"
              value={grupo}
              onChange={(e) => setGrupo(e.target.value)}
              placeholder="Ej. 94"
              className="mt-1.5 h-10 w-full rounded-lg border border-wash-border bg-wash-surface px-3 text-sm outline-none focus:border-wash-action focus:ring-2 focus:ring-wash-action/15"
            />
            <datalist id="grupos-vent-list">
              {grupos.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </div>
          <div>
            <LabelReq required>Frecuencia (días)</LabelReq>
            <div className="mt-1.5">
              <Select value={frecuencia || undefined} onValueChange={setFrecuencia}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder="Elegir…" />
                </SelectTrigger>
                <SelectContent>
                  {frecOpts.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f} días
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div>
          <LabelReq required>Próxima limpieza</LabelReq>
          <div className="mt-1.5">
            <DatePicker value={proxima} onChange={setProxima} placeholder="Seleccionar fecha…" />
          </div>
        </div>
      </div>

      <ModalActions>
        <button
          type="button"
          onClick={() => {
            reset();
            onClose();
          }}
          disabled={saving}
          className="rounded-lg border border-wash-border px-5 py-2.5 font-medium text-wash-text-strong hover:bg-wash-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!ready || saving}
          onClick={async () => {
            if (!selected || !proxima) return;
            setSaving(true);
            setError(null);
            try {
              await onAdd({
                idEdificio: selected.ID,
                edificio: selected.Edificio,
                direccion: selected.Direccion,
                grupo: grupo.trim(),
                frecuencia,
                proximaLimpieza: formatDateDDMMYYYY(proxima),
              });
              reset();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'No se pudo agregar el edificio.');
            } finally {
              setSaving(false);
            }
          }}
          className="flex items-center gap-2 rounded-lg bg-wash-action px-5 py-2.5 font-semibold text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          {saving ? 'Agregando…' : 'Agregar'}
        </button>
      </ModalActions>
    </Modal>
  );
}

// ───────────────────────── Filter popover ─────────────────────────

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((v) => b.includes(v));

function FilterContent({
  mesAno,
  estado,
  edificio,
  mesAnoOpts,
  estadoOpts,
  edificioOpts,
  onApply,
}: {
  mesAno: string[];
  estado: string[];
  edificio: string[];
  mesAnoOpts: MultiOption[];
  estadoOpts: MultiOption[];
  edificioOpts: MultiOption[];
  onApply: (f: { mesAno: string[]; estado: string[]; edificio: string[] }) => void;
}) {
  const [pMesAno, setPMesAno] = useState<string[]>(mesAno);
  const [pEstado, setPEstado] = useState<string[]>(estado);
  const [pEdif, setPEdif] = useState<string[]>(edificio);

  const toggle = (set: React.Dispatch<React.SetStateAction<string[]>>) => (v: string) =>
    set((arr) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]));

  const total = pMesAno.length + pEstado.length + pEdif.length;
  const dirty = !sameSet(pMesAno, mesAno) || !sameSet(pEstado, estado) || !sameSet(pEdif, edificio);

  const limpiar = () => {
    setPMesAno([]);
    setPEstado([]);
    setPEdif([]);
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between border-b border-wash-border pb-2.5">
        <h3 className="text-sm font-bold text-wash-text-strong">Filtrar</h3>
        {total > 0 && (
          <button type="button" onClick={limpiar} className="text-[11px] font-semibold text-wash-text-muted hover:text-wash-text-strong">
            Limpiar todo
          </button>
        )}
      </div>

      <div className="space-y-3">
        <MultiSelect label="Mes / Año" options={mesAnoOpts} selected={pMesAno} onToggle={toggle(setPMesAno)} onClear={() => setPMesAno([])} />
        <MultiSelect label="Estado" options={estadoOpts} selected={pEstado} onToggle={toggle(setPEstado)} onClear={() => setPEstado([])} />
        <MultiSelect label="Edificio" options={edificioOpts} selected={pEdif} onToggle={toggle(setPEdif)} onClear={() => setPEdif([])} searchable />
      </div>

      <div className="mt-4 flex justify-end gap-2 border-t border-wash-border pt-3">
        <PopoverClose asChild>
          <button
            type="button"
            className="rounded-lg border border-wash-border px-4 py-2 text-[12.5px] font-medium text-wash-text-strong hover:bg-wash-surface-2"
          >
            Cancelar
          </button>
        </PopoverClose>
        <PopoverClose asChild>
          <button
            type="button"
            disabled={!dirty}
            onClick={() => onApply({ mesAno: pMesAno, estado: pEstado, edificio: pEdif })}
            className="rounded-lg bg-wash-action px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            Aplicar
          </button>
        </PopoverClose>
      </div>
    </div>
  );
}
