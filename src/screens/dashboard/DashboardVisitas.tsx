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
  User,
  Clock,
  CalendarDays,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
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
import { StatusBadge } from '@/components/StatusBadge';
import { type Column } from '@/components/DataTable';
import { GridPanel, type GridView } from '@/components/dashboard/GridPanel';
import { KpiCard } from '@/components/dashboard/widgets';
import { EmptyState } from '@/components/EmptyState';
import { CHART_GRID, X_TICK, AXIS, intFmt, pct } from '@/components/dashboard/shared';
import { useAppStore } from '@/store/useAppStore';
import { proper } from '@/lib/utils';
import type { Registro } from '@/types/domain';

// ── Colores del tab (paleta fría de marca: cian / slate — sin verde ni ámbar) ──
const C_BRAND = 'var(--color-wash-brand)';
const C_OK = 'rgb(0 180 229)'; // cian de marca (visitas OK)
const C_REVISAR = 'rgb(148 163 184)'; // slate neutro (a revisar)
const C_LINE = 'rgb(58 138 255)'; // azul de la rampa fría (línea de % control del combo)

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
  controlPct: number | null; // % ítems OK sobre total (nivel ÍTEM)
  okItems: number; // Σ ítems OK
  revisarItems: number; // Σ ítems a revisar
  controladas: number; // visitas con control (Ok+Check > 0)
}

function metricsFor(rows: Registro[]): MonthMetrics {
  const edificios = new Set(rows.map((r) => r.Edificio.trim()).filter(Boolean)).size;

  let durSum = 0;
  let durN = 0;
  let okItems = 0;
  let revisarItems = 0;
  let controladas = 0;

  for (const r of rows) {
    const a = parseHMS(r.HoraVisita);
    const b = parseHMS(r.HoraSalida);
    if (a != null && b != null && b >= a) {
      durSum += b - a;
      durN += 1;
    }
    // Cada visita controlada tiene 8 ítems: `Ok` = ítems OK, `Check` = ítems A REVISAR
    // (Ok + Check = 8). El "resultado de control" es a NIVEL ÍTEM (ΣOk / Σítems),
    // igual que Power BI (~85%). NO a nivel visita-perfecta (daba ~50%: castigaba
    // toda la visita por 1 ítem entre 8). Validado sobre 28 meses.
    const ok = r.Ok ?? 0;
    const chk = r.Check ?? 0;
    if (ok + chk > 0) {
      controladas += 1;
      okItems += ok;
      revisarItems += chk;
    }
  }

  const totItems = okItems + revisarItems;
  return {
    visitas: rows.length,
    edificios,
    avgDur: durN ? durSum / durN : null,
    controlPct: totItems ? (okItems / totItems) * 100 : null,
    okItems,
    revisarItems,
    controladas,
  };
}

// ── Configs de charts ─────────────────────────────────────────────────────────
const lineConfig: ChartConfig = { control: { label: 'Resultado control' } };
const donutConfig: ChartConfig = { value: { label: 'Visitas' } };
const barConfig: ChartConfig = { value: { label: 'Visitas' } };
// Combo de eficiencia por técnico: barras = tiempo prom. de visita (min), línea = % de control OK.
const comboConfig: ChartConfig = {
  minutos: { label: 'Tiempo prom. (min)', color: C_BRAND },
  control: { label: '% Control OK', color: C_LINE },
};

// ── Grilla de Visitas (01.Registros) ──────────────────────────────────────────
// Columnas UNIFICADAS/curadas para pantalla (los datos que importan). El export
// a Excel usa `visitaFlat` (todas las columnas separadas, sin unificar).
// Ítems OK sobre el total controlado (Ok + Check, normalmente 8). Ej. "8/8", "6/8".
const controlTxt = (r: Registro) => {
  const ok = r.Ok ?? 0;
  const tot = ok + (r.Check ?? 0);
  return tot > 0 ? `${ok}/${tot}` : '—';
};

const VISITAS_COLUMNS: Column<Registro>[] = [
  {
    key: 'estado',
    header: 'Estado',
    width: '128px',
    truncate: false,
    render: (r) => <StatusBadge status={r.Estado} />,
  },
  {
    key: 'edificio',
    header: 'Edificio',
    width: 'minmax(180px,1.5fr)',
    render: (r) => (
      <div className="min-w-0">
        <div className="truncate font-medium text-wash-text-strong" title={r.Edificio}>
          {r.Edificio || '—'}
        </div>
        {r.Codigo && <div className="truncate text-[11px] text-wash-text-muted">{r.Codigo}</div>}
      </div>
    ),
  },
  {
    key: 'tecnico',
    header: 'Técnico',
    width: 'minmax(130px,1fr)',
    render: (r) => <span className="truncate text-wash-text">{proper(r.Usuario) || '—'}</span>,
  },
  {
    key: 'periodo',
    header: 'Período',
    width: '96px',
    align: 'center',
    truncate: false,
    render: (r) => <span className="tabular-nums text-wash-text-muted">{r.MesAño || '—'}</span>,
  },
  {
    key: 'horario',
    header: 'Horario',
    width: '150px',
    truncate: false,
    render: (r) => (
      <span className="tabular-nums text-[12.5px] text-wash-text">
        {(r.HoraVisita || '—') + ' – ' + (r.HoraSalida || '—')}
      </span>
    ),
  },
  {
    key: 'control',
    header: 'Control',
    width: '100px',
    align: 'center',
    truncate: false,
    render: (r) => <span className="tabular-nums font-semibold text-wash-text-strong">{controlTxt(r)}</span>,
  },
];

const visitaSearch = (r: Registro) =>
  `${r.Edificio} ${r.Codigo ?? ''} ${r.Usuario} ${r.MesAño} ${r.Estado} ${r.NroRuta_R} ${r.NroCircuito_R} ${r.Direccion ?? ''}`;

/** Card mobile de una visita (DESIGN.md §5.4: la tabla se vuelve cards en <lg). */
function visitaCard(r: Registro) {
  return (
    <div className="rounded-xl bg-wash-surface p-3 shadow-sm ring-1 ring-wash-border">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {r.Codigo && (
            <span className="inline-flex rounded bg-wash-brand/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-wash-brand ring-1 ring-wash-brand/20">
              {r.Codigo}
            </span>
          )}
          <p className="mt-0.5 truncate text-[14px] font-semibold text-wash-text-strong">{r.Edificio || '—'}</p>
        </div>
        <StatusBadge status={r.Estado} />
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-wash-divider/60 pt-2.5 text-[12px] text-wash-text-muted">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <User size={12} className="shrink-0" />
          <span className="truncate">{proper(r.Usuario) || '—'}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          <CalendarDays size={12} className="shrink-0" />
          {r.MesAño || '—'}
        </span>
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          <Clock size={12} className="shrink-0" />
          {(r.HoraVisita || '—') + ' – ' + (r.HoraSalida || '—')}
        </span>
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          <ShieldCheck size={12} className="shrink-0" />
          {controlTxt(r)}
        </span>
      </div>
    </div>
  );
}

const visitaFlat = (r: Registro): Record<string, string | number> => ({
  ID: r.ID,
  Estado: r.Estado,
  Edificio: r.Edificio,
  Código: r.Codigo ?? '',
  Dirección: r.Direccion ?? '',
  Técnico: r.Usuario,
  Ruta: r.NroRuta_R,
  Circuito: r.NroCircuito_R,
  Período: r.MesAño,
  'Hora inicio': r.HoraInicio ?? '',
  'Hora final': r.HoraFinal ?? '',
  'Hora visita': r.HoraVisita ?? '',
  'Hora salida': r.HoraSalida ?? '',
  'Fecha terminada': r.FechaTerminada_R ?? '',
  'Ítems OK': r.Ok ?? 0,
  'Ítems a revisar': r.Check ?? 0,
  'Total control': (r.Ok ?? 0) + (r.Check ?? 0),
  'Progreso %': r.Progreso ?? 0,
});

const fileTag = (desde: string, hasta: string) =>
  desde === hasta ? desde.replace('/', '-') : `${desde.replace('/', '-')}_a_${hasta.replace('/', '-')}`;

export default function DashboardVisitas({ desde, hasta, view }: { desde: string; hasta: string; view: GridView }) {
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

  // ── Donut de ítems de control: Ok vs A revisar (nivel ítem, todo el rango) ──
  const donut = useMemo(
    () => [
      { name: 'Ok', value: cur.okItems, color: C_OK },
      { name: 'Revisar', value: cur.revisarItems, color: C_REVISAR },
    ],
    [cur]
  );
  const donutTotal = cur.okItems + cur.revisarItems;

  // ── Eficiencia por técnico (todo el rango): TIEMPO PROMEDIO de visita + % de control OK ──
  // Combo estilo BI — la barra dice CUÁNTO TARDA en promedio y la línea CÓN QUÉ CALIDAD (% control).
  const porTecnico = useMemo(() => {
    const map = new Map<string, Registro[]>();
    for (const r of registros) {
      const k = proper(r.Usuario || '—') || '—';
      const arr = map.get(k);
      if (arr) arr.push(r);
      else map.set(k, [r]);
    }
    return [...map.entries()]
      .map(([name, rows]) => {
        const m = metricsFor(rows);
        return {
          name,
          minutos: m.avgDur != null ? Math.round(m.avgDur / 60) : 0, // tiempo prom. en minutos
          control: m.controlPct != null ? Math.round(m.controlPct) : null,
        };
      })
      .sort((a, b) => b.minutos - a.minutos)
      .slice(0, 8);
  }, [registros]);

  // ── Ranking: edificios por debajo del 100% de resultado de control (todo el rango) ──
  const edificiosBajo = useMemo(() => {
    // Resultado de control promedio por edificio (items Ok / chequeados), clampeado a ≤100
    // (los datos traen algunos edificios con Ok>Check que darían >100% — se acotan).
    // Resultado por edificio = ítems OK / total controlado (Ok + Check). <100% = tuvo
    // ítems a revisar en el período.
    const agg = new Map<string, { ok: number; tot: number }>();
    for (const r of registros) {
      const ok = r.Ok ?? 0;
      const tot = ok + (r.Check ?? 0);
      if (tot <= 0) continue;
      const k = proper(r.Edificio || '—') || '—';
      const a = agg.get(k) ?? { ok: 0, tot: 0 };
      a.ok += ok;
      a.tot += tot;
      agg.set(k, a);
    }
    return [...agg.entries()]
      .map(([name, a]) => ({ name, value: Math.min(100, Math.round((a.ok / a.tot) * 100)) }))
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
      ) : view === 'grilla' ? (
        <div className="h-full p-3 pb-4 md:p-6">
          <GridPanel<Registro>
            rows={registros}
            columns={VISITAS_COLUMNS}
            rowKey={(r) => r.ID}
            search={visitaSearch}
            toFlat={visitaFlat}
            exportName={`visitas_${fileTag(desde, hasta)}`}
            placeholder="Buscar edificio, técnico, código, ruta…"
            mobileCard={visitaCard}
          />
        </div>
      ) : (
        <div className="h-full space-y-4 overflow-y-auto p-3 pb-8 md:p-6">
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
              sub={<span>ítems de control OK sobre el total</span>}
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
            >
              {months.length <= 1 ? (
                <SingleMonthNote text="Ampliá el período a varios meses en Filtrar para ver la evolución mes a mes." />
              ) : evolucionVacia ? (
                <EmptyState compact icon={TrendingUp} title="Sin resultados de control" />
              ) : (
                <ChartContainer config={lineConfig} className="h-[220px] w-full">
                  <LineChart data={evolucion} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                    <CartesianGrid vertical={false} {...CHART_GRID} />
                    <XAxis dataKey="label" {...AXIS} tick={X_TICK} interval="preserveStartEnd" minTickGap={16} />
                    <YAxis {...AXIS} tick={X_TICK} width={44} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <ChartTooltip content={<ChartTooltipContent labelKey="label" formatter={(v) => `${v}%`} />} />
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
              )}
            </ChartCard>

            <ChartCard
              icon={Activity}
              title="Estado del control"
              subtitle={`Ítems de control OK vs a revisar — ${periodo}`}
              empty={donutTotal === 0 && <EmptyState compact icon={ShieldCheck} title="Sin ítems de control" />}
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
                      {cur.controlPct != null ? `${Math.round(cur.controlPct)}%` : '—'}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-wash-text-muted">
                      ítems OK
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

          {/* ── Eficiencia por técnico: combo cantidad de visitas (barra) + % control OK (línea) ── */}
          <ChartCard
            icon={Users}
            title="Eficiencia por técnico"
            subtitle={`Tiempo promedio de visita y % de control OK — ${periodo}`}
            empty={porTecnico.length === 0 && <EmptyState compact icon={Users} title="Sin datos por técnico" />}
          >
            <TecnicoCombo data={porTecnico} />
          </ChartCard>

          {/* ── Edificios por debajo del 100% ── */}
          <ChartCard
            icon={AlertTriangle}
            title="Edificios por debajo del 100%"
            subtitle="Resultado de control incompleto"
            empty={edificiosBajo.length === 0 && <EmptyState compact icon={AlertTriangle} title="Sin edificios por debajo" />}
          >
            <HBar data={edificiosBajo} color={C_BRAND} suffix="%" domainMax={100} />
          </ChartCard>

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

/** Aviso para gráficos de evolución cuando el período es un solo mes (no hay serie temporal). */
function SingleMonthNote({ text }: { text: string }) {
  return (
    <div className="flex h-[220px] w-full flex-col items-center justify-center gap-1.5 text-center">
      <CalendarDays size={26} strokeWidth={1.6} className="text-wash-text-faint" />
      <p className="text-sm font-medium text-wash-text-strong">Un solo mes seleccionado</p>
      <p className="max-w-[300px] text-xs text-wash-text-muted">{text}</p>
    </div>
  );
}

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
  empty?: ReactNode;
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
      <CardContent>{empty ? empty : children}</CardContent>
    </Card>
  );
}

/**
 * Combo de eficiencia por técnico (estilo BI): barras = cantidad de visitas (eje izq),
 * línea = % de control OK (eje der, 0–100). Dos ejes a propósito: una es un CONTEO y la
 * otra una TASA — se leen juntas para ver volumen + calidad de cada técnico.
 */
function TecnicoCombo({ data }: { data: { name: string; minutos: number; control: number | null }[] }) {
  return (
    <div>
      {/* Leyenda del combo (aclara qué eje es cada serie) */}
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-wash-text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: C_BRAND }} />
          Tiempo prom. de visita
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: C_LINE }} />
          % Control OK
        </span>
      </div>
      <ChartContainer config={comboConfig} className="h-[248px] w-full">
        <ComposedChart data={data} margin={{ top: 14, right: 6, left: -4, bottom: 4 }}>
          <CartesianGrid vertical={false} {...CHART_GRID} />
          <XAxis
            dataKey="name"
            {...AXIS}
            tick={{ fontSize: 11, fill: 'var(--color-wash-text-muted)' }}
            interval={0}
            angle={-20}
            textAnchor="end"
            height={54}
          />
          <YAxis yAxisId="left" {...AXIS} tick={X_TICK} allowDecimals={false} width={40} tickFormatter={(v) => `${v}m`} />
          <YAxis
            yAxisId="right"
            orientation="right"
            {...AXIS}
            tick={X_TICK}
            width={40}
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar yAxisId="left" dataKey="minutos" fill={C_BRAND} radius={[4, 4, 0, 0]} barSize={26} />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="control"
            stroke={C_LINE}
            strokeWidth={2.5}
            dot={{ r: 3, strokeWidth: 0, fill: C_LINE }}
            activeDot={{ r: 5, strokeWidth: 0 }}
            connectNulls
          >
            <LabelList
              dataKey="control"
              position="top"
              formatter={(v) => (v == null ? '' : `${v}%`)}
              style={{ fontSize: 10, fontWeight: 600, fill: C_LINE }}
            />
          </Line>
        </ComposedChart>
      </ChartContainer>
    </div>
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
