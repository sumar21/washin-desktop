import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ElementType, ReactNode } from 'react';
import {
  Building2,
  Timer,
  ShieldCheck,
  MapPin,
  TrendingUp,
  Activity,
  Users,
  AlertTriangle,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { ErrorState } from '@/components/ErrorState';
import { KpiCard } from '@/components/dashboard/widgets';
import { CHART_GRID, X_TICK, AXIS, intFmt, pct } from '@/components/dashboard/shared';
import { useAppStore } from '@/store/useAppStore';
import { proper } from '@/lib/utils';
import type { Registro } from '@/types/domain';

// ── Colores del tab (paleta fría de marca: cian / slate — sin verde ni ámbar) ──
const C_BRAND = 'var(--color-wash-brand)';
const C_OK = 'rgb(0 180 229)'; // cian de marca (visitas OK)
const C_REVISAR = 'rgb(148 163 184)'; // slate neutro (a revisar)

const MESES_ABBR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// ── Helpers de tiempo / fecha ─────────────────────────────────────────────────

/** 'mm/yyyy' → orden numérico (yyyy*12+mm), o -1 si no parsea. */
function mesAnoOrd(s: string): number {
  const m = s.trim().match(/^(\d{1,2})\/(\d{4})$/);
  if (!m) return -1;
  return Number(m[2]) * 12 + Number(m[1]);
}

/** 'mm/yyyy' → 'mmm yy' (ej. '07/2026' → 'jul 26'). */
function mesAnoLabel(s: string): string {
  const m = s.trim().match(/^(\d{1,2})\/(\d{4})$/);
  if (!m) return s;
  const mi = Number(m[1]) - 1;
  return `${MESES_ABBR[mi] ?? m[1]} ${m[2].slice(2)}`;
}

/** 'HH:mm[:ss]' → segundos del día, o null. */
function parseHMS(s?: string): number | null {
  if (!s) return null;
  const m = s.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  const sec = m[3] ? Number(m[3]) : 0;
  if (h > 23 || min > 59 || sec > 59) return null;
  return h * 3600 + min * 60 + sec;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** segundos → 'HH:MM:SS'. */
function fmtHMS(total: number | null): string {
  if (total == null) return '—';
  const s = Math.round(total);
  return `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor((s % 3600) / 60))}:${pad2(s % 60)}`;
}

// ── Métricas de un conjunto de registros (un mes) ─────────────────────────────
interface MonthMetrics {
  visitas: number;
  edificios: number;
  avgDur: number | null; // segundos
  controlPct: number | null; // % ok/check agregado
  okCount: number; // visitas 100% ok
  revisarCount: number; // visitas con al menos un ítem a revisar
}

function metricsFor(rows: Registro[]): MonthMetrics {
  const edificios = new Set(rows.map((r) => r.Edificio.trim()).filter(Boolean)).size;

  let durSum = 0;
  let durN = 0;
  let okCount = 0;
  let revisarCount = 0;

  for (const r of rows) {
    const a = parseHMS(r.HoraVisita);
    const b = parseHMS(r.HoraSalida);
    if (a != null && b != null && b >= a) {
      durSum += b - a;
      durN += 1;
    }
    if (r.Check != null && r.Check > 0) {
      const ok = r.Ok ?? 0;
      if (ok >= r.Check) okCount += 1;
      else revisarCount += 1;
    }
  }

  // Resultado de control = % de visitas controladas que dieron OK (coincide con el donut).
  // Ojo: NO usar okSum/checkSum — `Ok`/`Check` no son "items ok/chequeados" y ese ratio da >100%.
  const controladas = okCount + revisarCount;
  return {
    visitas: rows.length,
    edificios,
    avgDur: durN ? durSum / durN : null,
    controlPct: controladas ? (okCount / controladas) * 100 : null,
    okCount,
    revisarCount,
  };
}

// ── Configs de charts ─────────────────────────────────────────────────────────
const lineConfig: ChartConfig = { control: { label: 'Resultado control' } };
const donutConfig: ChartConfig = { value: { label: 'Visitas' } };
const barConfig: ChartConfig = { value: { label: 'Visitas' } };

export default function DashboardVisitas({ desde, hasta }: { desde: string; hasta: string }) {
  const registros = useAppStore((s) => s.CollectDashboardVisitas);
  const fetchDashboardVisitas = useAppStore((s) => s.fetchDashboardVisitas);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Fetch SCOPED al rango elegido: el backend trae SOLO esos meses (payload chico = rápido).
  // Re-corre cuando cambia el período → los registros cargados = el rango (no se filtra en cliente).
  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    return fetchDashboardVisitas(desde, hasta)
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'No se pudieron cargar las visitas.'))
      .finally(() => setLoading(false));
  }, [fetchDashboardVisitas, desde, hasta]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga por rango; "Reintentar" también dispara load().
    load();
  }, [load]);

  // ── Meses presentes en el rango cargado (ascendente) ──
  const months = useMemo(() => {
    const set = new Set<string>();
    for (const r of registros) {
      const k = r.MesAño?.trim();
      if (k) set.add(k);
    }
    return [...set].sort((a, b) => mesAnoOrd(a) - mesAnoOrd(b));
  }, [registros]);

  const rowsByMonth = useMemo(() => {
    const map = new Map<string, Registro[]>();
    for (const r of registros) {
      const k = r.MesAño?.trim();
      if (!k) continue;
      const arr = map.get(k);
      if (arr) arr.push(r);
      else map.set(k, [r]);
    }
    return map;
  }, [registros]);

  // Métricas del rango = TODOS los registros cargados (el backend ya los acotó al período).
  const cur = useMemo(() => metricsFor(registros), [registros]);

  // ── Evolución temporal: Resultado control % por mes del rango (un solo eje) ──
  const evolucion = useMemo(
    () =>
      months.map((m) => {
        const met = metricsFor(rowsByMonth.get(m) ?? []);
        return { label: mesAnoLabel(m), control: met.controlPct != null ? Math.round(met.controlPct) : null };
      }),
    [months, rowsByMonth]
  );
  const evolucionVacia = evolucion.every((d) => d.control == null);

  // ── Donut Ok / Revisar (todo el rango) ──
  const donut = useMemo(
    () => [
      { name: 'Ok', value: cur.okCount, color: C_OK },
      { name: 'Revisar', value: cur.revisarCount, color: C_REVISAR },
    ],
    [cur]
  );
  const donutTotal = cur.okCount + cur.revisarCount;

  // ── Ranking: visitas por técnico (todo el rango) ──
  const porTecnico = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of registros) {
      const k = proper(r.Usuario || '—') || '—';
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [registros]);

  // ── Ranking: edificios por debajo del 100% de resultado de control (todo el rango) ──
  const edificiosBajo = useMemo(() => {
    // Resultado de control promedio por edificio (items Ok / chequeados), clampeado a ≤100
    // (los datos traen algunos edificios con Ok>Check que darían >100% — se acotan).
    const agg = new Map<string, { ok: number; check: number }>();
    for (const r of registros) {
      if (r.Check == null || r.Check <= 0) continue;
      const k = proper(r.Edificio || '—') || '—';
      const a = agg.get(k) ?? { ok: 0, check: 0 };
      a.ok += r.Ok ?? 0;
      a.check += r.Check;
      agg.set(k, a);
    }
    return [...agg.entries()]
      .map(([name, a]) => ({ name, value: Math.min(100, Math.round((a.ok / a.check) * 100)) }))
      .filter((d) => d.value < 100)
      .sort((a, b) => a.value - b.value)
      .slice(0, 8);
  }, [registros]);

  // Etiqueta del período elegido (mm/yyyy → 'mmm yy'); un solo mes si desde === hasta.
  const periodo = desde === hasta ? mesAnoLabel(desde) : `${mesAnoLabel(desde)} – ${mesAnoLabel(hasta)}`;

  return (
    <div className="relative min-h-0 flex-1">
      <LoadingOverlay visible={loading} label="Cargando visitas…" />

      {loadError ? (
        <div className="h-full overflow-y-auto">
          <ErrorState message={loadError} onRetry={load} />
        </div>
      ) : (
        <div className="h-full space-y-4 overflow-y-auto p-4 pb-8 md:p-6">
          {/* ── KPIs ── */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              icon={Building2}
              label="Visitas a edificios"
              value={intFmt(cur.visitas)}
              accent
              sub={<span>período {periodo}</span>}
            />
            <KpiCard
              icon={Timer}
              label="Tiempo prom. de visita"
              value={fmtHMS(cur.avgDur)}
              sub={<span>ingreso → salida</span>}
            />
            <KpiCard
              icon={ShieldCheck}
              label="Resultado control"
              value={cur.controlPct != null ? pct(cur.controlPct) : '—'}
              sub={<span>visitas OK sobre controladas</span>}
            />
            <KpiCard
              icon={MapPin}
              label="Edificios visitados"
              value={intFmt(cur.edificios)}
              sub={<span>distintos en el período</span>}
            />
          </div>

          {/* ── Evolución (ancho) + Donut de resultado ── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <ChartCard
              className="lg:col-span-2"
              icon={TrendingUp}
              title="Evolución del resultado de control"
              subtitle="Resultado de control % por mes"
              empty={evolucionVacia}
            >
              <ChartContainer config={lineConfig} className="h-[220px] w-full">
                <LineChart data={evolucion} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                  <CartesianGrid vertical={false} {...CHART_GRID} />
                  <XAxis dataKey="label" {...AXIS} tick={X_TICK} interval="preserveStartEnd" minTickGap={16} />
                  <YAxis {...AXIS} tick={X_TICK} width={44} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <ChartTooltip
                    content={<ChartTooltipContent labelKey="label" formatter={(v) => `${v}%`} />}
                  />
                  <Line
                    type="monotone"
                    dataKey="control"
                    stroke={C_BRAND}
                    strokeWidth={2.5}
                    dot={{ r: 3, strokeWidth: 0, fill: C_BRAND }}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                    connectNulls
                  />
                </LineChart>
              </ChartContainer>
            </ChartCard>

            <ChartCard
              icon={Activity}
              title="Estado del control"
              subtitle={`Resultado — ${periodo}`}
              empty={donutTotal === 0}
            >
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <div className="relative shrink-0">
                  <ChartContainer config={donutConfig} className="aspect-square h-[172px]">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                      <Pie
                        data={donut}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={52}
                        outerRadius={80}
                        paddingAngle={2}
                        stroke="var(--color-wash-surface)"
                        strokeWidth={2}
                      >
                        {donut.map((d) => (
                          <Cell key={d.name} fill={d.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-display text-2xl font-bold tabular-nums text-wash-text-strong">
                      {intFmt(donutTotal)}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-wash-text-muted">
                      controladas
                    </span>
                  </div>
                </div>
                <ul className="flex min-w-0 flex-1 flex-col gap-2 text-[13px]">
                  {donut.map((d) => (
                    <li key={d.name} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
                      <span className="truncate text-wash-text-muted">{d.name}</span>
                      <span className="ml-auto shrink-0 font-semibold tabular-nums text-wash-text-strong">
                        {d.value}
                      </span>
                      <span className="w-10 shrink-0 text-right text-xs tabular-nums text-wash-text-faint">
                        {donutTotal ? Math.round((d.value / donutTotal) * 100) : 0}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </ChartCard>
          </div>

          {/* ── Ranking técnicos + edificios por debajo del 100% ── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard
              icon={Users}
              title="Eficiencia por técnico"
              subtitle={`Visitas por técnico — ${periodo}`}
              empty={porTecnico.length === 0}
            >
              <HBar data={porTecnico} color={C_BRAND} />
            </ChartCard>

            <ChartCard
              icon={AlertTriangle}
              title="Edificios por debajo del 100%"
              subtitle="Resultado de control incompleto"
              empty={edificiosBajo.length === 0}
            >
              <HBar data={edificiosBajo} color={C_BRAND} suffix="%" domainMax={100} />
            </ChartCard>
          </div>

          <p className="text-xs text-wash-text-faint">
            Período actual: {periodo} · {intFmt(cur.visitas)} visitas · {months.length} mes
            {months.length === 1 ? '' : 'es'} con datos.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Subcomponentes ─────────────────────────────────────────────────────────────

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

/** Ranking de barras horizontales finas, color por entidad, con label de valor directo. */
function HBar({
  data,
  color,
  suffix = '',
  domainMax,
  height = 220,
}: {
  data: { name: string; value: number }[];
  color: string;
  suffix?: string;
  domainMax?: number;
  height?: number;
}) {
  return (
    <ChartContainer config={barConfig} className="w-full" style={{ height }}>
      <BarChart data={data} layout="vertical" margin={{ top: 2, left: 0, right: 36, bottom: 2 }}>
        <CartesianGrid horizontal={false} {...CHART_GRID} />
        <XAxis type="number" hide allowDecimals={false} domain={domainMax ? [0, domainMax] : undefined} />
        <YAxis
          type="category"
          dataKey="name"
          {...AXIS}
          tick={{ fontSize: 12, fill: 'var(--color-wash-text-muted)' }}
          width={132}
        />
        <ChartTooltip
          content={<ChartTooltipContent hideLabel formatter={(v) => `${v}${suffix}`} />}
          cursor={{ fill: 'var(--color-wash-brand)', fillOpacity: 0.06 }}
        />
        <Bar dataKey="value" fill={color} radius={[4, 4, 4, 4]} barSize={14}>
          <LabelList
            dataKey="value"
            position="right"
            className="fill-wash-text-strong"
            style={{ fontSize: 12, fontWeight: 600 }}
            formatter={(v) => `${v}${suffix}`}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
