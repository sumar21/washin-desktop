import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ElementType, ReactNode } from 'react';
import {
  AlertOctagon,
  UserX,
  ClipboardCheck,
  Wind,
  Building2,
  Layers,
  Activity,
  TrendingUp,
  Users,
  CheckCircle2,
  Clock,
  CircleSlash,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { ErrorState } from '@/components/ErrorState';
import { KpiCard } from '@/components/dashboard/widgets';
import { chartColor, CHART_GRID, X_TICK, AXIS, intFmt, pct } from '@/components/dashboard/shared';
import { useAppStore } from '@/store/useAppStore';
import { proper } from '@/lib/utils';

// ── Helpers de datos ─────────────────────────────────────────────────────────

/** Agrupa una lista por una clave string → [{ name, cantidad }] ordenado desc. */
function groupCount<T>(rows: T[], key: (r: T) => string): { name: string; cantidad: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = (key(r) || '—').trim() || '—';
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([name, cantidad]) => ({ name, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad);
}

/** Parsea 'DD/MM/YYYY' → ms de la medianoche local, o null. */
function parseDMY(s?: string): number | null {
  if (!s) return null;
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

const dayKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

// ── Configs de charts ────────────────────────────────────────────────────────
const donutConfig: ChartConfig = { cantidad: { label: 'Incidentes' } };
const rankConfig: ChartConfig = { cantidad: { label: 'Incidentes' } };
const trendConfig: ChartConfig = { cantidad: { label: 'Incidentes' } };

export default function DashboardGeneral() {
  const incidentes = useAppStore((s) => s.CollectIncidentes);
  const registros = useAppStore((s) => s.CollectResumen);
  const ventilaciones = useAppStore((s) => s.CollectVentilaciones);
  const fetchHome = useAppStore((s) => s.fetchHome);
  const fetchIncidentes = useAppStore((s) => s.fetchIncidentes);
  const fetchVentilaciones = useAppStore((s) => s.fetchVentilaciones);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    return Promise.all([fetchHome(), fetchIncidentes(), fetchVentilaciones()])
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'No se pudieron cargar las métricas.'))
      .finally(() => setLoading(false));
  }, [fetchHome, fetchIncidentes, fetchVentilaciones]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial; "Reintentar" también dispara load().
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar.
  }, []);

  // ── KPIs ──
  // El endpoint de incidentes trae solo los ABIERTOS (Resuelto_IN='NO') → las
  // métricas se enmarcan sobre incidentes abiertos, no sobre resolución histórica.
  const incTotal = incidentes.length;
  const incSinAsignar = useMemo(
    () => incidentes.filter((i) => !(i.TecnicoAsignado_IN ?? '').trim()).length,
    [incidentes]
  );
  const edificiosAfectados = useMemo(
    () => new Set(incidentes.map((i) => i.NombreEdificio_IN.trim()).filter(Boolean)).size,
    [incidentes]
  );

  const regTotal = registros.length;
  const regFinalizados = useMemo(() => registros.filter((r) => r.Estado === 'Finalizado').length, [registros]);
  const regPendientes = useMemo(() => registros.filter((r) => r.Estado === 'Pendiente').length, [registros]);
  const regOtros = regTotal - regFinalizados - regPendientes; // Anulados u otros estados
  const tasaCompletado = regTotal ? (regFinalizados / regTotal) * 100 : 0;

  const ventActivas = useMemo(() => ventilaciones.filter((v) => v.Estado_VE !== 'Eliminada').length, [ventilaciones]);
  const ventPendientes = useMemo(
    () => ventilaciones.filter((v) => v.Estado_VE === 'Pendiente').length,
    [ventilaciones]
  );

  // ── Tendencia diaria de ingreso de incidentes (últimos 14 días con Fecha_IN) ──
  const trend = useMemo(() => {
    const times = incidentes
      .map((i) => parseDMY(i.Fecha_IN))
      .filter((n): n is number => n != null);
    if (!times.length) return [] as { label: string; cantidad: number }[];

    const counts = new Map<string, number>();
    for (const t of times) counts.set(dayKey(t), (counts.get(dayKey(t)) ?? 0) + 1);

    const ref = new Date(Math.max(...times));
    ref.setHours(0, 0, 0, 0);
    const out: { label: string; cantidad: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(ref);
      d.setDate(ref.getDate() - i);
      out.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, cantidad: counts.get(dayKey(d.getTime())) ?? 0 });
    }
    return out;
  }, [incidentes]);

  // Delta honesto: ingreso últimos 7 días vs. 7 días previos (subir es MALO).
  const inflowDelta = useMemo(() => {
    if (trend.length < 14) return null;
    const prev7 = trend.slice(0, 7).reduce((s, d) => s + d.cantidad, 0);
    const last7 = trend.slice(7).reduce((s, d) => s + d.cantidad, 0);
    if (prev7 === 0) return null;
    return ((last7 - prev7) / prev7) * 100;
  }, [trend]);

  // ── Distribuciones / rankings ──
  const porEstado = useMemo(() => groupCount(incidentes, (i) => i.Status_IN), [incidentes]);
  const porTipo = useMemo(() => groupCount(incidentes, (i) => i.NoResuelto_IN).slice(0, 6), [incidentes]);
  const porEdificio = useMemo(
    () => groupCount(incidentes, (i) => proper(i.NombreEdificio_IN)).slice(0, 7),
    [incidentes]
  );
  const porTecnico = useMemo(
    () =>
      groupCount(
        incidentes.filter((i) => (i.TecnicoAsignado_IN ?? '').trim()),
        (i) => proper(i.TecnicoAsignado_IN ?? '')
      ).slice(0, 6),
    [incidentes]
  );

  const gaugeData = useMemo(() => [{ name: 'Finalizadas', value: tasaCompletado }], [tasaCompletado]);

  return (
    <div className="relative min-h-0 flex-1">
      <LoadingOverlay visible={loading} label="Cargando métricas…" />

      {loadError ? (
        <div className="h-full overflow-y-auto">
          <ErrorState message={loadError} onRetry={load} />
        </div>
      ) : (
        <div className="h-full space-y-4 overflow-y-auto p-4 pb-8 md:p-6">
          {/* ── Fila de KPIs "hero" ── */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              icon={AlertOctagon}
              label="Incidentes abiertos"
              value={intFmt(incTotal)}
              accent
              {...(inflowDelta != null
                ? { delta: inflowDelta, deltaLabel: 'ingreso 7d', invertDelta: true }
                : {
                    sub: (
                      <span>
                        {intFmt(edificiosAfectados)} edificio{edificiosAfectados === 1 ? '' : 's'} afectado
                        {edificiosAfectados === 1 ? '' : 's'}
                      </span>
                    ),
                  })}
            />
            <KpiCard
              icon={UserX}
              label="Sin asignar"
              value={intFmt(incSinAsignar)}
              sub={<span>{pct(incTotal ? (incSinAsignar / incTotal) * 100 : 0)} sin técnico</span>}
            />
            <KpiCard
              icon={ClipboardCheck}
              label="Tasa de resolución"
              value={pct(tasaCompletado)}
              sub={
                <span>
                  {intFmt(regFinalizados)} de {intFmt(regTotal)} visitas
                </span>
              }
            />
            <KpiCard
              icon={Wind}
              label="Ventilaciones pendientes"
              value={intFmt(ventPendientes)}
              sub={<span>de {intFmt(ventActivas)} activas</span>}
            />
          </div>

          {/* ── Tendencia (ancho) + Donut por estado ── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <ChartCard
              className="lg:col-span-2"
              icon={TrendingUp}
              title="Ingreso de incidentes"
              subtitle="Nuevos incidentes por día — últimos 14 días"
              empty={trend.every((d) => d.cantidad === 0)}
            >
              <ChartContainer config={trendConfig} className="h-[220px] w-full">
                <AreaChart data={trend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="metTrendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-wash-brand)" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="var(--color-wash-brand)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} {...CHART_GRID} />
                  <XAxis dataKey="label" {...AXIS} tick={X_TICK} interval="preserveStartEnd" minTickGap={16} />
                  <YAxis {...AXIS} tick={X_TICK} width={34} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent labelKey="label" />} />
                  <Area
                    type="monotone"
                    dataKey="cantidad"
                    stroke="var(--color-wash-brand)"
                    strokeWidth={2.5}
                    fill="url(#metTrendFill)"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ChartContainer>
            </ChartCard>

            <ChartCard
              icon={Activity}
              title="Por estado"
              subtitle="Mix de incidentes abiertos"
              empty={porEstado.length === 0}
            >
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <ChartContainer config={donutConfig} className="aspect-square h-[172px]">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                      <Pie
                        data={porEstado}
                        dataKey="cantidad"
                        nameKey="name"
                        innerRadius={52}
                        outerRadius={80}
                        paddingAngle={2}
                        stroke="var(--color-wash-surface)"
                        strokeWidth={2}
                      >
                        {porEstado.map((_, i) => (
                          <Cell key={i} fill={chartColor(i)} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-display text-2xl font-bold tabular-nums text-wash-text-strong">
                      {intFmt(incTotal)}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-wash-text-muted">
                      abiertos
                    </span>
                  </div>
                </div>
                <ul className="flex min-w-0 flex-1 flex-col gap-1.5 text-[13px]">
                  {porEstado.map((s, i) => (
                    <li key={s.name} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: chartColor(i) }} />
                      <span className="truncate text-wash-text-muted">{s.name}</span>
                      <span className="ml-auto shrink-0 font-semibold tabular-nums text-wash-text-strong">
                        {s.cantidad}
                      </span>
                      <span className="w-10 shrink-0 text-right text-xs tabular-nums text-wash-text-faint">
                        {incTotal ? Math.round((s.cantidad / incTotal) * 100) : 0}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </ChartCard>
          </div>

          {/* ── Ranking edificios (ancho) + Gauge de visitas ── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <ChartCard
              className="lg:col-span-2"
              icon={Building2}
              title="Edificios más afectados"
              subtitle="Top 7 por incidentes abiertos"
              empty={porEdificio.length === 0}
            >
              <RankBars data={porEdificio} />
            </ChartCard>

            <ChartCard
              icon={ClipboardCheck}
              title="Cumplimiento de visitas"
              subtitle="Finalizadas sobre el total del mes"
              empty={regTotal === 0}
            >
              <div className="flex flex-col items-center">
                <div className="relative">
                  <ChartContainer config={{ value: { label: 'Finalizadas' } }} className="aspect-square h-[168px]">
                    <RadialBarChart
                      data={gaugeData}
                      startAngle={90}
                      endAngle={-270}
                      innerRadius="72%"
                      outerRadius="100%"
                    >
                      <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
                      <RadialBar
                        dataKey="value"
                        cornerRadius={8}
                        fill="var(--color-wash-brand)"
                        background={{ fill: 'var(--color-wash-surface-2)' }}
                      />
                    </RadialBarChart>
                  </ChartContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-display text-3xl font-bold tabular-nums text-wash-text-strong">
                      {Math.round(tasaCompletado)}%
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-wash-text-muted">
                      finalizadas
                    </span>
                  </div>
                </div>
                <div className="mt-3 grid w-full grid-cols-3 gap-2 border-t border-wash-divider pt-3">
                  <GaugeStat icon={CheckCircle2} label="Finalizadas" value={regFinalizados} tone="text-wash-brand" />
                  <GaugeStat icon={Clock} label="Pendientes" value={regPendientes} tone="text-wash-text-muted" />
                  <GaugeStat icon={CircleSlash} label="Otros" value={regOtros} tone="text-wash-text-faint" />
                </div>
              </div>
            </ChartCard>
          </div>

          {/* ── Ranking por tipo + carga por técnico ── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard
              icon={Layers}
              title="Incidentes por tipo"
              subtitle="Origen del incidente"
              empty={porTipo.length === 0}
            >
              <RankBars data={porTipo} height={200} />
            </ChartCard>

            <ChartCard
              icon={Users}
              title="Carga por técnico"
              subtitle="Incidentes asignados — top 6"
              empty={porTecnico.length === 0}
            >
              <RankBars data={porTecnico} height={200} />
            </ChartCard>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Subcomponentes ───────────────────────────────────────────────────────────

/** Card estándar de chart: header con ícono de marca + título/subtítulo y estado vacío. */
function ChartCard({
  icon: Icon,
  title,
  subtitle,
  className,
  empty,
  children,
}: {
  icon: ElementType;
  title: string;
  subtitle: string;
  className?: string;
  empty?: boolean;
  children: ReactNode;
}) {
  return (
    <Card className={`ring-wash-border ${className ?? ''}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          <p className="truncate text-xs text-wash-text-muted">{subtitle}</p>
        </div>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-wash-brand/[0.08] text-wash-brand">
          <Icon size={16} />
        </span>
      </CardHeader>
      <CardContent>
        {empty ? (
          <div className="flex h-[172px] w-full items-center justify-center text-sm text-wash-text-muted">
            Sin datos para mostrar.
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

/** Ranking de barras horizontales, un solo hue de marca, con label de valor directo. */
function RankBars({ data, height = 220 }: { data: { name: string; cantidad: number }[]; height?: number }) {
  return (
    <ChartContainer config={rankConfig} className="w-full" style={{ height }}>
      <BarChart data={data} layout="vertical" margin={{ top: 2, left: 0, right: 28, bottom: 2 }}>
        <CartesianGrid horizontal={false} {...CHART_GRID} />
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="name"
          {...AXIS}
          tick={{ fontSize: 12, fill: 'var(--color-wash-text-muted)' }}
          width={128}
        />
        <ChartTooltip
          content={<ChartTooltipContent hideLabel />}
          cursor={{ fill: 'var(--color-wash-brand)', fillOpacity: 0.06 }}
        />
        <Bar dataKey="cantidad" fill="var(--color-wash-brand)" radius={[4, 4, 4, 4]} barSize={16}>
          <LabelList
            dataKey="cantidad"
            position="right"
            className="fill-wash-text-strong"
            style={{ fontSize: 12, fontWeight: 600 }}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

/** Métrica compacta bajo el gauge de visitas (ícono + valor + label). */
function GaugeStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: ElementType;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 text-center">
      <Icon size={15} className={tone} />
      <span className="font-semibold tabular-nums text-wash-text-strong">{intFmt(value)}</span>
      <span className="text-[10px] uppercase tracking-wide text-wash-text-muted">{label}</span>
    </div>
  );
}
