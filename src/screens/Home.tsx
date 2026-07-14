import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  CalendarCheck,
  Gauge,
  AlertOctagon,
  Wind,
  Users,
  Activity,
  AlertTriangle,
  Building2,
  Clock,
  User,
  MapPin,
  Inbox,
  Trash2,
  CheckCircle2,
  Coffee,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts';
import { useAppStore } from '@/store/useAppStore';
import { proper, currentMonthName, formatToday, cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/StatusBadge';
import { PageHeader } from '@/components/PageHeader';
import { parseDateString } from '@/components/ui/date-picker';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Modal, ModalActions, ConfirmDialog } from '@/components/Modal';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { ErrorState } from '@/components/ErrorState';
import { KpiCard } from '@/components/dashboard/widgets';
import { CHART_GRID, X_TICK, AXIS, intFmt } from '@/components/dashboard/shared';
import type { Registro, Descanso } from '@/types/domain';

// Una visita cuenta como finalizada si arrancó (Progreso > 0). Fiel a la lógica
// de la VisitaCard y de la PowerApp: <100 es parcial pero ya "trabajada".
const visitaFinalizada = (r: Registro) =>
  (r.Progreso ?? (r.Estado === 'Finalizado' ? 100 : 0)) > 0;

/** Días desde hoy hasta una fecha dd/mm/yyyy (negativo = vencida). null si no parsea. */
function diasHasta(ddmmyyyy: string): number | null {
  const d = parseDateString(ddmmyyyy);
  if (!d) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - hoy.getTime()) / 86_400_000);
}

function saludo(): string {
  const h = new Date().getHours();
  if (h < 13) return 'Buenos días';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

interface AttentionItem {
  id: string;
  kind: 'incidente' | 'ventilacion';
  title: string;
  edificio: string;
  tag: string;
  urgent: boolean;
  sort: number;
}

export function Home() {
  const CollectResumen = useAppStore((s) => s.CollectResumen);
  const CollectIncidentes = useAppStore((s) => s.CollectIncidentes);
  const CollectVentilaciones = useAppStore((s) => s.CollectVentilaciones);
  const descansosHoy = useAppStore((s) => s.CollectDescansosHoy);
  const loggedUser = useAppStore((s) => s.loggedUser);
  const VarUsuario = useAppStore((s) => s.VarUsuario);
  const removeRegistro = useAppStore((s) => s.removeRegistro);
  const fetchHome = useAppStore((s) => s.fetchHome);
  const fetchStock = useAppStore((s) => s.fetchStock);
  const fetchCompras = useAppStore((s) => s.fetchCompras);
  const fetchIncidentes = useAppStore((s) => s.fetchIncidentes);
  const fetchVentilaciones = useAppStore((s) => s.fetchVentilaciones);

  const [deletingRegistro, setDeletingRegistro] = useState<Registro | null>(null);
  const [descansosOpen, setDescansosOpen] = useState(false);
  const [homeLoading, setHomeLoading] = useState(true);
  const [homeError, setHomeError] = useState<string | null>(null);

  const loadHome = useCallback(() => {
    setHomeLoading(true);
    setHomeError(null);
    // fetchStock/Compras/Incidentes/Ventilaciones también: los KPIs dependen de esas
    // colecciones y esta pantalla puede ser la primera en cargar.
    return Promise.all([fetchHome(), fetchStock(), fetchCompras(), fetchIncidentes(), fetchVentilaciones()])
      .catch((err) => {
        setHomeError(err instanceof Error ? err.message : 'No se pudo cargar el resumen.');
      })
      .finally(() => {
        setHomeLoading(false);
      });
  }, [fetchHome, fetchStock, fetchCompras, fetchIncidentes, fetchVentilaciones]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial; `loadHome` también la dispara el botón "Reintentar".
    loadHome();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar; `loadHome` ya setea su propio loading.
  }, []);

  // ── Métricas de visitas del mes (el corazón operativo para el gerente) ──
  const visitas = useMemo(() => {
    const total = CollectResumen.length;
    const finalizadas = CollectResumen.filter(visitaFinalizada).length;
    const pendientes = total - finalizadas;
    const tasa = total ? Math.round((finalizadas / total) * 100) : 0;
    const edificios = new Set(CollectResumen.map((r) => r.Edificio).filter(Boolean)).size;

    const tecMap = new Map<string, { total: number; finalizadas: number }>();
    for (const r of CollectResumen) {
      const t = r.Usuario || '—';
      const cur = tecMap.get(t) ?? { total: 0, finalizadas: 0 };
      cur.total += 1;
      if (visitaFinalizada(r)) cur.finalizadas += 1;
      tecMap.set(t, cur);
    }
    const porTecnico = [...tecMap.entries()]
      .map(([tecnico, s]) => ({ tecnico: proper(tecnico), total: s.total, finalizadas: s.finalizadas }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 7);

    return {
      total,
      finalizadas,
      pendientes,
      tasa,
      edificios,
      tecnicos: tecMap.size,
      porTecnico,
      porEstado: [
        // Paleta fría de marca (igual que el donut de Visitas del Dashboard):
        // cian = finalizadas, slate = pendientes. Nada de verde/ámbar off-brand.
        { key: 'Finalizadas', value: finalizadas, color: 'var(--color-wash-brand)' },
        { key: 'Pendientes', value: pendientes, color: 'rgb(148 163 184)' },
      ],
    };
  }, [CollectResumen]);

  // ── Incidentes / Ventilaciones que requieren acción ──
  const incidentesAbiertos = useMemo(
    () => CollectIncidentes.filter((i) => i.Resuelto_IN === 'NO'),
    [CollectIncidentes]
  );
  const incidentesSinAsignar = useMemo(
    () => incidentesAbiertos.filter((i) => !i.TecnicoAsignado_IN).length,
    [incidentesAbiertos]
  );
  const ventPendientes = useMemo(
    () => CollectVentilaciones.filter((v) => v.Estado_VE !== 'Realizada' && v.Estado_VE !== 'Eliminada'),
    [CollectVentilaciones]
  );
  const ventVencidas = useMemo(
    () =>
      ventPendientes.filter((v) => {
        const d = diasHasta(v.ProximaLimpieza_VE);
        return d != null && d < 0;
      }),
    [ventPendientes]
  );

  const atencion = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];
    for (const i of incidentesAbiertos) {
      const asignado = !!i.TecnicoAsignado_IN;
      items.push({
        id: `inc-${i.ID}`,
        kind: 'incidente',
        title: proper(i.NoResuelto_IN || i.Titulo_IN || 'Incidente'),
        edificio: i.NombreEdificio_IN,
        tag: asignado ? proper(i.TecnicoAsignado_IN!) : 'Sin asignar',
        urgent: !asignado,
        sort: asignado ? 40 : 10, // sin asignar pesa más
      });
    }
    for (const v of ventVencidas) {
      const d = Math.abs(diasHasta(v.ProximaLimpieza_VE) ?? 0);
      items.push({
        id: `ven-${v.ID}`,
        kind: 'ventilacion',
        title: 'Ventilación vencida',
        edificio: v.Edificio_VE,
        tag: `${d} d`,
        urgent: true,
        sort: -d, // cuanto más vencida, más arriba
      });
    }
    return items.sort((a, b) => a.sort - b.sort).slice(0, 12);
  }, [incidentesAbiertos, ventVencidas]);

  // Descansos de hoy: en curso (Activo) primero, luego finalizados.
  const descansos = useMemo(() => {
    const activos = descansosHoy.filter((d) => d.Estado === 'Activo');
    const finalizados = descansosHoy.filter((d) => d.Estado !== 'Activo');
    return { activos, finalizados, ordenados: [...activos, ...finalizados] };
  }, [descansosHoy]);

  const nombre = loggedUser?.Nombre?.trim() || (VarUsuario ? proper(VarUsuario) : '');

  const tecnicoConfig: ChartConfig = {
    total: { label: 'Visitas', color: 'var(--color-wash-brand)' },
  };
  const estadoConfig: ChartConfig = {
    Finalizadas: { label: 'Finalizadas', color: 'var(--color-wash-brand)' },
    Pendientes: { label: 'Pendientes', color: 'rgb(148 163 184)' },
  };

  return (
    <div className="relative flex h-full w-full flex-col">
      <PageHeader
        title="Inicio"
        subtitle={`Resumen operativo · ${proper(currentMonthName())}`}
        toolbarExtra={
          <button
            type="button"
            onClick={() => setDescansosOpen(true)}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-wash-canvas px-3 text-sm font-medium text-wash-text-strong ring-1 ring-wash-border transition-colors hover:bg-wash-border/40"
          >
            <Coffee size={15} className="shrink-0 text-wash-brand" />
            <span>Descansos</span>
            {descansosHoy.length > 0 && (
              <span
                className={cn(
                  'ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                  descansos.activos.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-wash-surface-2 text-wash-text-muted'
                )}
              >
                {descansosHoy.length}
              </span>
            )}
          </button>
        }
      />
      <LoadingOverlay visible={homeLoading} label="Cargando resumen…" />

      {homeError ? (
        <ErrorState message={homeError} onRetry={loadHome} />
      ) : (
        <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-5">
          {/* Hero band ejecutivo — gradiente de marca cian + chips de resumen */}
          <div className="relative mb-5 overflow-hidden rounded-2xl bg-gradient-to-br from-wash-brand via-wash-brand-dark to-wash-accent p-5 shadow-sm ring-1 ring-wash-brand-dark/20 sm:p-6">
            {/* Halo decorativo sutil */}
            <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="font-display text-xl font-bold text-white sm:text-2xl">
                  {saludo()}
                  {nombre ? `, ${nombre}` : ''}
                </h2>
                <p className="mt-1 text-sm text-white/80">
                  Resumen operativo de{' '}
                  <span className="font-semibold capitalize text-white">{currentMonthName()}</span>
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <HeroStat value={intFmt(visitas.total)} label="visitas" />
                <HeroStat value={intFmt(visitas.edificios)} label="edificios" />
                <HeroStat value={intFmt(visitas.tecnicos)} label="técnicos" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-4">
            {/* KPIs hero */}
            <div className="col-span-6 lg:col-span-3">
              <KpiCard
                icon={CalendarCheck}
                label="Visitas del mes"
                value={intFmt(visitas.total)}
                accent
                sub={
                  <span>
                    {intFmt(visitas.finalizadas)} finalizadas · {intFmt(visitas.pendientes)} pendientes
                  </span>
                }
              />
            </div>
            <div className="col-span-6 lg:col-span-3">
              <KpiCard
                icon={Gauge}
                label="Tasa de finalización"
                value={`${visitas.tasa}%`}
                sub={
                  <div className="flex w-full items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-wash-border/60">
                      <div
                        className="h-full rounded-full bg-wash-brand transition-all"
                        style={{ width: `${visitas.tasa}%` }}
                      />
                    </div>
                    <span className="shrink-0 tabular-nums">
                      {intFmt(visitas.finalizadas)}/{intFmt(visitas.total)}
                    </span>
                  </div>
                }
              />
            </div>
            <div className="col-span-6 lg:col-span-3">
              <KpiCard
                icon={AlertOctagon}
                label="Incidentes abiertos"
                value={intFmt(incidentesAbiertos.length)}
                sub={
                  <span className={cn(incidentesSinAsignar > 0 && 'font-semibold text-rose-600')}>
                    {incidentesSinAsignar > 0 ? `${incidentesSinAsignar} sin asignar` : 'todos asignados'}
                  </span>
                }
              />
            </div>
            <div className="col-span-6 lg:col-span-3">
              <KpiCard
                icon={Wind}
                label="Ventilaciones pend."
                value={intFmt(ventPendientes.length)}
                sub={
                  <span className={cn(ventVencidas.length > 0 && 'font-semibold text-rose-600')}>
                    {ventVencidas.length > 0 ? `${ventVencidas.length} vencidas` : 'ninguna vencida'}
                  </span>
                }
              />
            </div>

            {/* Actividad por técnico — ranking */}
            <Card className="col-span-12 ring-wash-border lg:col-span-8">
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users size={16} className="text-wash-brand" />
                    Actividad por técnico
                  </CardTitle>
                  <p className="text-xs text-wash-text-muted">Visitas registradas este mes</p>
                </div>
                <Badge variant="outline" className="text-wash-text-muted">
                  {visitas.tecnicos} técnicos
                </Badge>
              </CardHeader>
              <CardContent>
                {visitas.porTecnico.length ? (
                  <ChartContainer config={tecnicoConfig} className="h-[240px] w-full">
                    <BarChart
                      data={visitas.porTecnico}
                      layout="vertical"
                      margin={{ top: 0, right: 32, left: 8, bottom: 0 }}
                    >
                      <CartesianGrid horizontal={false} {...CHART_GRID} />
                      <XAxis type="number" {...AXIS} tick={X_TICK} allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="tecnico"
                        {...AXIS}
                        width={116}
                        tick={X_TICK}
                      />
                      <ChartTooltip
                        content={<ChartTooltipContent />}
                        cursor={{ fill: 'var(--color-wash-brand)', fillOpacity: 0.06 }}
                      />
                      <Bar dataKey="total" fill="var(--color-wash-brand)" radius={[0, 4, 4, 0]} barSize={18}>
                        <LabelList
                          dataKey="total"
                          position="right"
                          fill="var(--color-wash-text-muted)"
                          fontSize={11}
                        />
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <p className="py-16 text-center text-sm text-wash-text-muted">Sin visitas este mes</p>
                )}
              </CardContent>
            </Card>

            {/* Estado de visitas — donut con total central */}
            <Card className="col-span-12 ring-wash-border lg:col-span-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity size={16} className="text-wash-brand" />
                  Estado de visitas
                </CardTitle>
                <p className="text-xs text-wash-text-muted">Finalizadas vs. pendientes</p>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                <div className="relative">
                  <ChartContainer config={estadoConfig} className="aspect-square h-[168px]">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent nameKey="key" />} />
                      <Pie
                        data={visitas.porEstado}
                        dataKey="value"
                        nameKey="key"
                        innerRadius={54}
                        outerRadius={80}
                        paddingAngle={2}
                        stroke="var(--color-wash-surface)"
                        strokeWidth={2}
                      >
                        {visitas.porEstado.map((s) => (
                          <Cell key={s.key} fill={s.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-display text-3xl font-bold tabular-nums text-wash-text-strong">
                      {intFmt(visitas.total)}
                    </span>
                    <span className="text-[11px] font-medium uppercase tracking-wider text-wash-text-muted">
                      visitas
                    </span>
                  </div>
                </div>
                <div className="grid w-full grid-cols-2 gap-2">
                  {visitas.porEstado.map((s) => (
                    <div
                      key={s.key}
                      className="flex items-center gap-2 rounded-lg bg-wash-surface-2/60 px-3 py-2"
                    >
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                      <div className="min-w-0">
                        <div className="text-sm font-bold tabular-nums text-wash-text-strong">{s.value}</div>
                        <div className="truncate text-[11px] text-wash-text-muted">{s.key}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Requiere atención — reemplaza "compras recibidas" */}
            <Card className="col-span-12 flex flex-col ring-wash-border lg:col-span-5">
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                    <AlertTriangle size={16} />
                  </span>
                  <div>
                    <CardTitle>Requiere atención</CardTitle>
                    <p className="text-xs text-wash-text-muted">Incidentes y ventilaciones vencidas</p>
                  </div>
                </div>
                {atencion.length > 0 && (
                  <span className="shrink-0 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold tabular-nums text-rose-600 ring-1 ring-rose-200">
                    {atencion.length}
                  </span>
                )}
              </CardHeader>
              <CardContent className="flex-1">
                {atencion.length === 0 ? (
                  <EmptyState icon={CheckCircle2} title="Todo al día" />
                ) : (
                  <div className="flex max-h-[380px] flex-col gap-1.5 overflow-y-auto pr-0.5">
                    {atencion.map((a) => (
                      <AttentionRow key={a.id} item={a} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actividad reciente — últimas visitas */}
            <Card className="col-span-12 flex flex-col ring-wash-border lg:col-span-7">
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-wash-brand/10 text-wash-brand">
                    <Activity size={16} />
                  </span>
                  <div>
                    <CardTitle>Actividad reciente</CardTitle>
                    <p className="text-xs text-wash-text-muted">Últimas visitas registradas</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-wash-text-muted">
                  {intFmt(visitas.total)} este mes
                </Badge>
              </CardHeader>
              <CardContent className="flex-1">
                {CollectResumen.length === 0 ? (
                  <EmptyState icon={Inbox} title="Sin visitas este mes" />
                ) : (
                  <div className="grid max-h-[440px] grid-cols-1 gap-2 overflow-y-auto pr-0.5 md:grid-cols-2">
                    {CollectResumen.slice(0, 12).map((r) => (
                      <VisitaCard key={r.ID} registro={r} onDelete={() => setDeletingRegistro(r)} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deletingRegistro}
        tone="danger"
        title="Eliminar visita"
        message={
          deletingRegistro
            ? `¿Deseás eliminar la visita a ${deletingRegistro.Edificio}? Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onCancel={() => setDeletingRegistro(null)}
        onConfirm={() => {
          if (deletingRegistro) removeRegistro(deletingRegistro.ID);
          setDeletingRegistro(null);
        }}
      />

      {/* Descansos de hoy — modal (activos y finalizados) */}
      <Modal open={descansosOpen} onClose={() => setDescansosOpen(false)} title="Descansos de hoy" width={520}>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700 ring-1 ring-amber-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            {descansos.activos.length} en curso
          </span>
          <span className="rounded-full bg-wash-surface-2 px-2.5 py-1 font-semibold tabular-nums text-wash-text-muted">
            {descansos.finalizados.length} finalizados
          </span>
          <span className="ml-auto tabular-nums text-wash-text-muted">{formatToday()}</span>
        </div>
        {descansosHoy.length === 0 ? (
          <EmptyState icon={Coffee} title="Sin descansos hoy" />
        ) : (
          <div className="flex max-h-[58vh] flex-col gap-1.5 overflow-y-auto pr-0.5">
            {descansos.ordenados.map((d) => (
              <DescansoRow key={d.ID} descanso={d} />
            ))}
          </div>
        )}
        <ModalActions>
          <button
            type="button"
            onClick={() => setDescansosOpen(false)}
            className="rounded-lg border border-wash-border px-5 py-2 font-medium text-wash-text-strong hover:bg-wash-surface-2"
          >
            Cerrar
          </button>
        </ModalActions>
      </Modal>
    </div>
  );
}

// ---- Hero stat chip ----

function HeroStat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="rounded-xl bg-white/15 px-4 py-2.5 text-center ring-1 ring-inset ring-white/25 backdrop-blur-sm">
      <div className="font-display text-xl font-bold tabular-nums text-white">{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-white/75">{label}</div>
    </div>
  );
}

// ---- Attention row ----

function AttentionRow({ item }: { item: AttentionItem }) {
  const Icon = item.kind === 'incidente' ? AlertOctagon : Wind;
  return (
    <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 ring-1 ring-transparent transition-colors hover:bg-wash-surface-2/60 hover:ring-wash-border">
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          item.urgent ? 'bg-rose-100 text-rose-600' : 'bg-sky-100 text-sky-700'
        )}
      >
        <Icon size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-wash-text-strong">{item.title}</div>
        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-wash-text-muted">
          <Building2 size={11} className="shrink-0" />
          <span className="truncate">{item.edificio || '—'}</span>
        </div>
      </div>
      <span
        className={cn(
          'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums',
          item.urgent
            ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-200'
            : 'bg-wash-surface-2 text-wash-text-muted'
        )}
      >
        {item.tag}
      </span>
    </div>
  );
}

// ---- Descanso row ----

const initials = (name: string) =>
  (name || '')
    .trim()
    .slice(0, 2)
    .toUpperCase() || '—';

/** 'HH:MM' → minutos del día, o null. */
function parseHM(s: string): number | null {
  const m = (s ?? '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Duración legible del descanso (fin - inicio). '' si cruza medianoche o es inválido. */
function descansoDur(d: Descanso): string {
  const a = parseHM(d.HoraInicio);
  const b = parseHM(d.HoraFin);
  if (a == null || b == null) return '';
  const mins = b - a;
  if (mins < 0 || mins > 12 * 60) return ''; // dato dudoso (cruza medianoche)
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
}

function DescansoRow({ descanso }: { descanso: Descanso }) {
  const activo = descanso.Estado === 'Activo';
  const dur = descansoDur(descanso);
  return (
    <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 ring-1 ring-transparent transition-colors hover:bg-wash-surface-2/60 hover:ring-wash-border">
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-semibold',
          activo ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
        )}
      >
        {initials(descanso.Usuario)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-wash-text-strong">{proper(descanso.Usuario) || '—'}</div>
        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-wash-text-muted">
          <Clock size={11} className="shrink-0" />
          <span className="tabular-nums">
            {descanso.HoraInicio || '—'} – {descanso.HoraFin || '—'}
          </span>
          {dur && <span className="text-wash-text-faint">· {dur}</span>}
        </div>
      </div>
      <span
        className={cn(
          'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1',
          activo ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-emerald-50 text-emerald-700 ring-emerald-200'
        )}
      >
        {activo ? 'En curso' : 'Finalizado'}
      </span>
    </div>
  );
}

// ---- Visita card ----

function VisitaCard({ registro, onDelete }: { registro: Registro; onDelete: () => void }) {
  // Clamp a [0,100]: la data real trae Progreso sucio (p. ej. 700) que rompía la barra.
  const progreso = Math.max(0, Math.min(100, registro.Progreso ?? (registro.Estado === 'Finalizado' ? 100 : 0)));
  // Pendiente sólo si no empezó. Con progreso > 0 ya cuenta como Finalizado.
  const status = progreso === 0 ? 'Pendiente' : 'Finalizado';

  return (
    <div className="rounded-lg bg-wash-surface p-3 ring-1 ring-wash-border transition-colors hover:ring-wash-brand/30">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Building2 size={14} className="shrink-0 text-wash-brand" />
          <span className="truncate text-sm font-semibold text-wash-text-strong">
            {registro.Edificio}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <StatusBadge status={status} />
          <button
            type="button"
            onClick={onDelete}
            className="flex h-6 w-6 items-center justify-center rounded-md text-wash-text-faint transition-colors hover:bg-rose-50 hover:text-rose-600"
            title="Eliminar visita"
            aria-label="Eliminar visita"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Meta */}
      <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        <KV icon={MapPin} label="Ruta" value={registro.NroRuta_R} />
        <KV icon={MapPin} label="Circuito" value={registro.NroCircuito_R} />
        <KV icon={User} label="Técnico" value={registro.Usuario} />
        <KV icon={Clock} label="Horario" value={`${registro.HoraInicio ?? '—'} – ${registro.HoraFinal ?? '—'}`} />
      </dl>

      {/* Progreso */}
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[11px]">
          <span className="font-medium uppercase tracking-wider text-wash-text-muted">Progreso</span>
          <span className="font-semibold tabular-nums text-wash-text-strong">{progreso}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-wash-border/60">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              progreso === 100 ? 'bg-wash-brand' : 'bg-wash-brand/55'
            )}
            style={{ width: `${progreso}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function KV({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Icon size={12} className="shrink-0 text-wash-text-faint" />
      <dt className="sr-only">{label}</dt>
      <dd className="truncate font-medium text-wash-text-strong">{value}</dd>
    </div>
  );
}

// ---- Empty state ----

function EmptyState({
  icon: Icon,
  title,
}: {
  icon: typeof Inbox;
  title: string;
}) {
  return (
    <div className="flex min-h-[180px] flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-wash-border py-10 text-center text-wash-text-muted">
      <Icon size={28} strokeWidth={1.6} className="opacity-30" />
      <p className="mt-2 text-xs font-medium">{title}</p>
    </div>
  );
}
