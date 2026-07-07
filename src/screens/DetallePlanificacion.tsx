import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Eye,
  MapPin,
  Building2,
  CheckCircle2,
  Circle,
  CalendarDays,
  Phone,
  UserRound,
  Clock,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { Modal, ModalActions } from '@/components/Modal';
import { StatusBadge } from '@/components/StatusBadge';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { ErrorState } from '@/components/ErrorState';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import type { PlanifRuta, PlanifCircuito, PlanifEdificio } from '@/types/domain';

const initials = (name: string) =>
  name
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

export function DetallePlanificacion() {
  const navigate = useNavigate();
  const MesAno = useAppStore((s) => s.MesAnoPlanificacionDetail);
  const MesDetail = useAppStore((s) => s.MesDetail);
  const setMesPlanif = useAppStore((s) => s.setMesPlanificacionDetail);
  const resumen = useAppStore((s) => s.CollectPlanifResumenMes);
  const detalles = useAppStore((s) => s.CollectPlanifDetalle);
  const edificios = useAppStore((s) => s.CollectPlanifEdificios);
  const fetchPlanificacionMes = useAppStore((s) => s.fetchPlanificacionMes);

  const [query, setQuery] = useState('');
  const [viewing, setViewing] = useState<PlanifRuta | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Sin mes elegido no hay nada que mostrar → volvemos al listado de rutas.
  useEffect(() => {
    if (!MesAno) navigate('/rutas', { replace: true });
  }, [MesAno, navigate]);

  const load = useCallback(() => {
    if (!MesAno) return Promise.resolve();
    setLoading(true);
    setLoadError(null);
    return fetchPlanificacionMes(MesAno)
      .catch((err) =>
        setLoadError(
          err instanceof Error ? err.message : 'No se pudo cargar la planificación del mes.'
        )
      )
      .finally(() => setLoading(false));
  }, [MesAno, fetchPlanificacionMes]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial; "Reintentar" también dispara load().
    load();
  }, [load]);

  // Circuitos y edificios por ruta (via IDUnivocoRuta).
  const countsFor = useCallback(
    (r: PlanifRuta) => {
      const circs = detalles.filter((d) => d.IDUnivocoRuta === r.IDUnivocoRuta);
      const edifs = edificios.filter((e) => e.IDUnivocoRuta === r.IDUnivocoRuta);
      const visitados = edifs.filter((e) => e.Estado === 'Visitado').length;
      return { circuitos: circs.length, edificios: edifs.length, visitados };
    },
    [detalles, edificios]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return resumen
      .filter(
        (r) =>
          !q ||
          r.Tecnico.toLowerCase().includes(q) ||
          r.NroRuta.toLowerCase().includes(q) ||
          r.Status.toLowerCase().includes(q)
      )
      .sort((a, b) => Number(a.NroRuta) - Number(b.NroRuta));
  }, [resumen, query]);

  // Progreso global del mes (edificios visitados / total).
  const mesProgreso = useMemo(() => {
    const total = edificios.length;
    const visitados = edificios.filter((e) => e.Estado === 'Visitado').length;
    return { total, visitados, pct: total > 0 ? Math.round((visitados / total) * 100) : 0 };
  }, [edificios]);

  const columns: Column<PlanifRuta>[] = [
    {
      key: 'estado',
      header: 'Estado',
      width: '150px',
      truncate: false,
      render: (r) => <StatusBadge status={r.Status} />,
    },
    {
      key: 'ruta',
      header: 'Ruta',
      width: '90px',
      align: 'center',
      truncate: false,
      render: (r) => (
        <span className="inline-flex min-w-[36px] items-center justify-center rounded-md bg-wash-brand/10 px-2 py-0.5 text-[12.5px] font-bold text-wash-brand tabular-nums">
          {r.NroRuta}
        </span>
      ),
    },
    {
      key: 'tecnico',
      header: 'Técnico',
      width: 'minmax(220px, 1fr)',
      truncate: false,
      render: (r) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[9.5px] font-semibold text-slate-600">
            {initials(r.Tecnico)}
          </span>
          <span className="truncate text-[13px] font-semibold text-wash-text-strong">
            {r.Tecnico}
          </span>
        </div>
      ),
    },
    {
      key: 'circuitos',
      header: 'Circuitos',
      width: '110px',
      align: 'center',
      truncate: false,
      render: (r) => (
        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-wash-text-strong tabular-nums">
          <MapPin size={11} className="text-wash-text-muted" />
          {countsFor(r).circuitos}
        </span>
      ),
    },
    {
      key: 'progreso',
      header: 'Progreso',
      width: 'minmax(150px, 0.7fr)',
      truncate: false,
      render: (r) => {
        const { edificios: total, visitados } = countsFor(r);
        const pct = total > 0 ? Math.round((visitados / total) * 100) : 0;
        return (
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-wash-border/60">
              <div
                className="h-full rounded-full bg-gradient-to-r from-wash-brand to-emerald-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="shrink-0 text-[11px] font-bold text-wash-text-muted tabular-nums">
              {visitados}/{total}
            </span>
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'Ver',
      width: '80px',
      align: 'right',
      truncate: false,
      render: (r) => (
        <div className="flex items-center justify-end">
          <button
            type="button"
            title="Ver detalle"
            onClick={(e) => {
              e.stopPropagation();
              setViewing(r);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-wash-brand ring-1 ring-wash-brand/30 transition hover:bg-wash-brand/10 hover:ring-wash-brand"
          >
            <Eye size={15} />
          </button>
        </div>
      ),
    },
  ];

  const mobileCard = (r: PlanifRuta) => {
    const { circuitos, edificios: total, visitados } = countsFor(r);
    const pct = total > 0 ? Math.round((visitados / total) * 100) : 0;
    return (
      <button
        type="button"
        onClick={() => setViewing(r)}
        className="flex w-full flex-col gap-3 rounded-2xl bg-wash-surface p-4 text-left shadow-sm ring-1 ring-wash-border transition active:scale-[0.99]"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-wash-brand to-wash-brand-dark text-[12px] font-black text-white tabular-nums shadow-sm shadow-wash-brand/30">
            {r.NroRuta.padStart(2, '0')}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[14px] font-black text-wash-accent">
              Ruta {r.NroRuta}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-wash-text-muted">
              <UserRound size={11} className="shrink-0" />
              <span className="truncate">{r.Tecnico}</span>
            </p>
          </div>
          <StatusBadge status={r.Status} />
        </div>

        <div className="flex items-center gap-4 text-[12px] font-semibold text-wash-text-strong">
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <MapPin size={12} className="text-wash-text-muted" />
            {circuitos} circuito{circuitos === 1 ? '' : 's'}
          </span>
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <Building2 size={12} className="text-wash-text-muted" />
            {total} edificio{total === 1 ? '' : 's'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-wash-border/60">
            <div
              className="h-full rounded-full bg-gradient-to-r from-wash-brand to-emerald-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="shrink-0 text-[11px] font-bold text-wash-text-muted tabular-nums">
            {visitados}/{total}
          </span>
        </div>
      </button>
    );
  };

  const monthYear = `${MesDetail ?? ''} ${MesAno?.split('/')[1] ?? ''}`.trim();

  if (!MesAno) return null;

  return (
    <div className="flex h-full w-full flex-col">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setMesPlanif(null, null);
                navigate('/rutas');
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-wash-surface-2 text-wash-text-strong hover:bg-wash-border/60"
              title="Volver"
            >
              <ArrowLeft size={16} />
            </button>
            <span className="capitalize">Planificación {MesDetail}</span>
          </span>
        }
        subtitle={`${resumen.length} ruta${resumen.length === 1 ? '' : 's'} · ${monthYear}`}
        search={{
          value: query,
          onChange: setQuery,
          placeholder: 'Buscar técnico, ruta…',
        }}
      />

      <div className="relative flex min-h-0 flex-1 flex-col p-4 sm:p-6">
        <LoadingOverlay visible={loading} label="Cargando planificación…" />

        {loadError ? (
          <ErrorState message={loadError} onRetry={load} />
        ) : (
          <>
            {/* Progreso del mes */}
            {mesProgreso.total > 0 && (
              <div className="mb-4 shrink-0 rounded-2xl bg-wash-surface p-4 shadow-sm ring-1 ring-wash-border">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-wash-text-muted">
                    <CheckCircle2 size={13} className="text-emerald-500" />
                    Progreso del mes
                  </p>
                  <p className="font-display text-[14px] font-black text-wash-text-strong tabular-nums">
                    {mesProgreso.visitados}
                    <span className="text-[12px] font-bold text-wash-text-muted">
                      {' '}
                      / {mesProgreso.total} · {mesProgreso.pct}%
                    </span>
                  </p>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-wash-border/60">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-wash-brand to-emerald-500 transition-all"
                    style={{ width: `${mesProgreso.pct}%` }}
                  />
                </div>
              </div>
            )}

            <div className="min-h-0 flex-1">
              <DataTable
                rows={filtered}
                rowKey={(r) => r.ID}
                columns={columns}
                empty="Sin rutas en este mes."
                onRowClick={(r) => setViewing(r)}
                mobileCard={mobileCard}
              />
            </div>
          </>
        )}
      </div>

      <RutaDetailModal
        ruta={viewing}
        detalles={detalles}
        edificios={edificios}
        onClose={() => setViewing(null)}
      />
    </div>
  );
}

// ----- Detalle de Ruta modal (solo lectura) -----

function RutaDetailModal({
  ruta,
  detalles,
  edificios,
  onClose,
}: {
  ruta: PlanifRuta | null;
  detalles: PlanifCircuito[];
  edificios: PlanifEdificio[];
  onClose: () => void;
}) {
  if (!ruta) return null;

  const circuitos = detalles
    .filter((d) => d.IDUnivocoRuta === ruta.IDUnivocoRuta)
    .sort((a, b) => a.NroCircuito - b.NroCircuito);
  const edificiosRuta = edificios.filter((e) => e.IDUnivocoRuta === ruta.IDUnivocoRuta);
  const totalEdificios = edificiosRuta.length;
  const visitados = edificiosRuta.filter((e) => e.Estado === 'Visitado').length;
  const progreso = totalEdificios > 0 ? Math.round((visitados / totalEdificios) * 100) : 0;

  return (
    <Modal
      open={!!ruta}
      onClose={onClose}
      title={`Detalle de ruta ${ruta.NroRuta}`}
      width={1180}
    >
      {/* Header card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-wash-brand/[0.08] via-wash-surface to-wash-surface-2/30 p-4 ring-1 ring-wash-border sm:p-5">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-wash-brand/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-emerald-500/5 blur-3xl"
        />

        <div className="relative flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-wash-brand to-wash-brand-dark text-[14px] font-black text-white shadow-md shadow-wash-brand/25 ring-2 ring-wash-surface">
            {initials(ruta.Tecnico)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-wash-brand/10 px-2 py-0.5 text-[11.5px] font-bold text-wash-brand tabular-nums ring-1 ring-wash-brand/20">
                <MapPin size={10} />
                Ruta {ruta.NroRuta}
              </span>
              <StatusBadge status={ruta.Status} />
            </div>
            <h3 className="mt-1.5 truncate font-display text-[17px] font-black leading-tight text-wash-accent">
              {ruta.Tecnico}
            </h3>
            <p className="mt-1 flex items-center gap-1.5 text-[11.5px] text-wash-text-muted">
              <CalendarDays size={12} />
              Planificación de{' '}
              <span className="font-mono font-semibold text-wash-text-strong">
                {ruta.MesAno}
              </span>
            </p>
          </div>
        </div>

        {/* Stats strip */}
        <div className="relative mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-wash-border/60 ring-1 ring-wash-border sm:grid-cols-4">
          <StatStrip
            icon={MapPin}
            label="Circuitos"
            value={String(circuitos.length)}
            tone="brand"
          />
          <StatStrip
            icon={Building2}
            label="Edificios"
            value={String(totalEdificios)}
            tone="brand"
          />
          <StatStrip
            icon={CheckCircle2}
            label="Visitados"
            value={String(visitados)}
            suffix={totalEdificios > 0 ? ` / ${totalEdificios}` : undefined}
            tone="emerald"
          />
          <div className="flex flex-col justify-center bg-wash-surface/80 px-4 py-3">
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-wash-text-muted">
              <span>Progreso</span>
              <span className="font-display text-[14px] font-black text-wash-text-strong tabular-nums">
                {progreso}%
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-wash-border/60">
              <div
                className="h-full rounded-full bg-gradient-to-r from-wash-brand to-emerald-500 transition-all"
                style={{ width: `${progreso}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Circuitos section header */}
      <div className="mt-5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-display text-[13px] font-black uppercase tracking-wider text-wash-text-strong">
            Circuitos asignados
          </p>
          <p className="mt-0.5 text-[11px] text-wash-text-muted">
            Detalle por circuito y edificios a visitar
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10.5px] font-semibold text-wash-text-muted">
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 size={12} className="text-emerald-500" />
            Visitado
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Circle size={12} className="text-amber-500" />
            Pendiente
          </span>
        </div>
      </div>

      {/* Circuitos grid */}
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {circuitos.length === 0 ? (
          <div className="col-span-full rounded-xl border border-dashed border-wash-border bg-wash-surface-2/30 p-8 text-center text-sm text-wash-text-muted">
            Esta ruta no tiene circuitos planificados.
          </div>
        ) : (
          circuitos.map((c) => {
            const edifs = edificios.filter(
              (e) => e.IDUnivocoCircuito === c.IDUnivocoCircuito
            );
            const visit = edifs.filter((e) => e.Estado === 'Visitado').length;
            const pct = edifs.length > 0 ? Math.round((visit / edifs.length) * 100) : 0;
            const complete = edifs.length > 0 && visit === edifs.length;

            return (
              <div
                key={c.ID}
                className={cn(
                  'flex flex-col overflow-hidden rounded-xl bg-wash-surface ring-1 transition',
                  complete ? 'ring-emerald-500/30' : 'ring-wash-border'
                )}
              >
                <div
                  className={cn(
                    'border-b px-3.5 py-2.5',
                    complete
                      ? 'border-emerald-500/20 bg-emerald-500/5'
                      : 'border-wash-border bg-wash-surface-2/40'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'flex h-7 w-7 items-center justify-center rounded-lg ring-1',
                          complete
                            ? 'bg-emerald-500/15 text-emerald-600 ring-emerald-500/25'
                            : 'bg-wash-brand/10 text-wash-brand ring-wash-brand/20'
                        )}
                      >
                        <MapPin size={12} />
                      </span>
                      <div>
                        <p className="font-display text-[13px] font-black leading-none text-wash-accent">
                          Circuito {c.NroCircuito}
                        </p>
                        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-wash-text-muted">
                          {edifs.length} {edifs.length === 1 ? 'edificio' : 'edificios'}
                        </p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10.5px] font-bold tabular-nums',
                        complete
                          ? 'bg-emerald-500 text-white'
                          : 'bg-wash-surface text-wash-text-strong ring-1 ring-wash-border'
                      )}
                    >
                      {visit}/{edifs.length}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-wash-border/60">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          complete
                            ? 'bg-emerald-500'
                            : 'bg-gradient-to-r from-wash-brand to-wash-brand-light'
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold tabular-nums text-wash-text-muted">
                      {pct}%
                    </span>
                  </div>
                </div>

                <ul className="divide-y divide-wash-divider/60">
                  {edifs.length === 0 ? (
                    <li className="px-3 py-3 text-xs italic text-wash-text-muted">
                      Sin edificios cargados.
                    </li>
                  ) : (
                    edifs.map((e) => {
                      const isVisited = e.Estado === 'Visitado';
                      return (
                        <li
                          key={e.ID}
                          className={cn(
                            'border-l-2 px-3 py-2',
                            isVisited
                              ? 'border-emerald-500/50'
                              : 'border-amber-400/50'
                          )}
                        >
                          <div className="flex items-start gap-2">
                            {isVisited ? (
                              <CheckCircle2
                                size={13}
                                className="mt-0.5 shrink-0 text-emerald-500"
                              />
                            ) : (
                              <Circle
                                size={13}
                                className="mt-0.5 shrink-0 text-amber-500"
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                {e.Codigo && (
                                  <span
                                    className={cn(
                                      'shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums',
                                      isVisited
                                        ? 'bg-emerald-500/10 text-emerald-700'
                                        : 'bg-amber-500/10 text-amber-700'
                                    )}
                                  >
                                    {e.Codigo}
                                  </span>
                                )}
                                <span className="truncate text-[12px] font-semibold text-wash-text-strong">
                                  {e.Edificio}
                                </span>
                              </div>
                              {e.Direccion && (
                                <p className="mt-0.5 truncate text-[11px] text-wash-text-muted">
                                  {e.Direccion}
                                </p>
                              )}
                              {(e.Encargado || e.Celular || e.HoraSugerida) && (
                                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10.5px] text-wash-text-muted">
                                  {e.Encargado && (
                                    <span className="inline-flex items-center gap-1">
                                      <UserRound size={10} className="shrink-0" />
                                      <span className="truncate">{e.Encargado}</span>
                                    </span>
                                  )}
                                  {e.Celular && (
                                    <span className="inline-flex items-center gap-1">
                                      <Phone size={10} className="shrink-0" />
                                      {e.Celular}
                                    </span>
                                  )}
                                  {e.HoraSugerida && (
                                    <span className="inline-flex items-center gap-1 font-semibold text-wash-text-strong">
                                      <Clock size={10} className="shrink-0" />
                                      {e.HoraSugerida}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            );
          })
        )}
      </div>

      <ModalActions>
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

function StatStrip({
  icon: Icon,
  label,
  value,
  suffix,
  tone = 'brand',
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
  suffix?: string;
  tone?: 'brand' | 'emerald';
}) {
  const toneCls =
    tone === 'emerald'
      ? 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20'
      : 'bg-wash-brand/10 text-wash-brand ring-wash-brand/20';
  return (
    <div className="flex items-center gap-2.5 bg-wash-surface/80 px-4 py-3">
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1',
          toneCls
        )}
      >
        <Icon size={14} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-wash-text-muted">
          {label}
        </p>
        <p className="font-display text-[19px] font-black leading-none text-wash-text-strong tabular-nums">
          {value}
          {suffix && (
            <span className="ml-0.5 text-[12px] font-bold text-wash-text-muted">
              {suffix}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
