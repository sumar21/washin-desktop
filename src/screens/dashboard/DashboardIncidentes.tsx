import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ElementType, ReactNode } from 'react';
import {
  AlertOctagon,
  Wallet,
  Timer,
  CheckCircle2,
  TrendingUp,
  PieChart as PieIcon,
  Building2,
  Wrench,
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
import { CHART_GRID, X_TICK, AXIS, intFmt, money, pct } from '@/components/dashboard/shared';
import {
  getDashboardIncidentes,
  type DashboardIncidentesResponse,
  type DashRepuestoIncidente,
} from '@/services/api';
import type { Incidente } from '@/types/domain';
import { cn, proper } from '@/lib/utils';

// ── Helpers de fecha / formato ────────────────────────────────────────────────

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** 'dd/mm/yyyy' → ms de medianoche local, o null. */
function parseDMY(s?: string): number | null {
  if (!s) return null;
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

/** {y, m} del incidente: prioriza FechaMesAno_IN ('mm/yyyy'), cae a Fecha_IN ('dd/mm/yyyy'). */
function incMonth(i: Incidente): { y: number; m: number } | null {
  const ma = i.FechaMesAno_IN?.trim().match(/^(\d{1,2})\/(\d{4})$/);
  if (ma) return { y: Number(ma[2]), m: Number(ma[1]) };
  const t = parseDMY(i.Fecha_IN);
  if (t != null) {
    const d = new Date(t);
    return { y: d.getFullYear(), m: d.getMonth() + 1 };
  }
  return null;
}

const monthKey = (y: number, m: number) => y * 100 + m;
const monthLabel = (y: number, m: number) => `${MESES_CORTOS[m - 1]} ${String(y).slice(2)}`;

/** Duración en ms → 'HH:MM:SS' (las horas pueden superar 24, estilo planilla). */
function fmtDur(ms: number): string {
  if (!ms || ms < 0) return '—';
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const mm = Math.floor((totalSec % 3600) / 60);
  const ss = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(mm)}:${pad(ss)}`;
}

const dias = (ms: number) => (ms > 0 ? (ms / 86_400_000).toFixed(1) : '0');

/** Eje monetario compacto. */
const moneyK = (v: number) => (v === 0 ? '$0' : Math.abs(v) >= 1000 ? `$${Math.round(v / 1000)}k` : `$${Math.round(v)}`);

const isResuelto = (i: Incidente) => String(i.Resuelto_IN).toUpperCase() === 'SI';

// ── Clasificación de registros ────────────────────────────────────────────────
// En Wash Inn muchos "incidentes" NO son fallas de servicio sino MOVIMIENTOS de
// máquina (instalada→depósito→Wash Inn): Transferencia / Cambio de Máquina / Baja.
// Y otra parte grande son controles que salieron OK ("Todo Funcionando"). Contar
// todo junto infla la métrica de incidentes. Separamos en 3 tipos:
//   • servicio → falla real atendida (Mecánico, Agua, Tildado, Placa, …)
//   • cambio   → movimiento logístico de máquina (0 repuestos asociados)
//   • control  → visita de control que no encontró problema
const MOV_TYPES = new Set(['transferencia', 'cambio de maquina', 'cambio de máquina', 'baja de maquina', 'baja de máquina']);
type TipoInc = 'servicio' | 'cambio' | 'control';
function tipoDe(i: Incidente): TipoInc {
  if (MOV_TYPES.has((i.NoResuelto_IN ?? '').trim().toLowerCase())) return 'cambio';
  if ((i.Categoria_IN ?? '').trim().toLowerCase() === 'todo funcionando') return 'control';
  return 'servicio';
}
const TIPO_META: Record<TipoInc, { label: string; cls: string }> = {
  servicio: { label: 'Servicio', cls: 'bg-wash-brand/10 text-wash-brand-dark ring-wash-brand/25' },
  cambio: { label: 'Cambio máq.', cls: 'bg-violet-50 text-violet-700 ring-violet-200' },
  control: { label: 'Control OK', cls: 'bg-slate-100 text-slate-600 ring-slate-300/60' },
};
function TipoBadge({ i }: { i: Incidente }) {
  const m = TIPO_META[tipoDe(i)];
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide ring-1', m.cls)}>
      {m.label}
    </span>
  );
}

// ── Grilla de Incidentes ──────────────────────────────────────────────────────
// Columnas UNIFICADAS/curadas para pantalla; el export (`incidenteFlat`) trae todas
// las columnas separadas. El estado se muestra Resuelto/Pendiente, el tipo con badge.
const INCIDENTES_COLUMNS: Column<Incidente>[] = [
  {
    key: 'estado',
    header: 'Estado',
    width: '124px',
    truncate: false,
    render: (i) => <StatusBadge status={isResuelto(i) ? 'Resuelto' : i.Status_IN || 'Pendiente'} />,
  },
  {
    key: 'tipo',
    header: 'Tipo',
    width: '120px',
    truncate: false,
    render: (i) => <TipoBadge i={i} />,
  },
  {
    key: 'fecha',
    header: 'Fecha',
    width: '100px',
    align: 'center',
    truncate: false,
    render: (i) => <span className="tabular-nums text-wash-text-muted">{i.Fecha_IN || '—'}</span>,
  },
  {
    key: 'edificio',
    header: 'Edificio',
    width: 'minmax(160px,1.3fr)',
    render: (i) => (
      <div className="min-w-0">
        <div className="truncate font-medium text-wash-text-strong" title={i.NombreEdificio_IN}>
          {i.NombreEdificio_IN || '—'}
        </div>
        {i.CodigoEdifcio_IN && <div className="truncate text-[11px] text-wash-text-muted">{i.CodigoEdifcio_IN}</div>}
      </div>
    ),
  },
  {
    key: 'maquina',
    header: 'Máquina',
    width: 'minmax(160px,1.2fr)',
    render: (i) => (
      <span className="truncate text-[12.5px] text-wash-text" title={i.ConcatMaquina_IN || ''}>
        {i.ConcatMaquina_IN || '—'}
      </span>
    ),
  },
  {
    key: 'categoria',
    header: 'Categoría',
    width: '120px',
    truncate: false,
    render: (i) => <span className="truncate text-wash-text">{proper((i.Categoria_IN ?? '').trim()) || '—'}</span>,
  },
  {
    key: 'tecnico',
    header: 'Técnico',
    width: 'minmax(120px,1fr)',
    render: (i) => (
      <span className="truncate text-wash-text">{proper(i.TecnicoAsignado_IN || i.User_IN || '') || '—'}</span>
    ),
  },
  {
    key: 'rep',
    header: 'Rep.',
    width: '72px',
    align: 'center',
    truncate: false,
    render: (i) => <span className="tabular-nums font-semibold text-wash-text-strong">{i.CantidadRepuestos_IN || 0}</span>,
  },
];

const incidenteSearch = (i: Incidente) =>
  `${i.NombreEdificio_IN} ${i.CodigoEdifcio_IN ?? ''} ${i.ConcatMaquina_IN ?? ''} ${i.Categoria_IN ?? ''} ${i.NoResuelto_IN} ${i.TecnicoAsignado_IN ?? ''} ${i.User_IN} ${i.Fecha_IN} ${i.Status_IN} ${TIPO_META[tipoDe(i)].label}`;

/** Card mobile de un incidente (DESIGN.md §5.4: la tabla se vuelve cards en <lg). */
function incidenteCard(i: Incidente) {
  return (
    <div className="rounded-xl bg-wash-surface p-3 shadow-sm ring-1 ring-wash-border">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {i.CodigoEdifcio_IN && (
            <span className="inline-flex rounded bg-wash-brand/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-wash-brand ring-1 ring-wash-brand/20">
              {i.CodigoEdifcio_IN}
            </span>
          )}
          <p className="mt-0.5 truncate text-[14px] font-semibold text-wash-text-strong">{i.NombreEdificio_IN || '—'}</p>
        </div>
        <StatusBadge status={isResuelto(i) ? 'Resuelto' : i.Status_IN || 'Pendiente'} />
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <TipoBadge i={i} />
        <span className="text-[11px] tabular-nums text-wash-text-muted">{i.Fecha_IN || '—'}</span>
      </div>
      <div className="mt-2.5 space-y-1.5 border-t border-wash-divider/60 pt-2.5 text-[12px] text-wash-text-muted">
        <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
          <Wrench size={12} className="shrink-0" />
          <span className="truncate">{i.ConcatMaquina_IN || '—'}</span>
        </span>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate">
            {proper((i.Categoria_IN ?? '').trim()) || '—'} · {proper(i.TecnicoAsignado_IN || i.User_IN || '') || '—'}
          </span>
          <span className="shrink-0 tabular-nums font-semibold text-wash-text-strong">{i.CantidadRepuestos_IN || 0} rep.</span>
        </div>
      </div>
    </div>
  );
}

const fileTag = (desde: string, hasta: string) =>
  desde === hasta ? desde.replace('/', '-') : `${desde.replace('/', '-')}_a_${hasta.replace('/', '-')}`;

// ── Agregado central ──────────────────────────────────────────────────────────

interface MonthStats {
  total: number;
  pendientes: number;
  resueltos: number;
  conRepuestos: number; // resueltos con al menos un repuesto
  sinRepuestos: number; // resueltos sin repuestos
  valor: number; // Σ Cantidad_RI × Precio_RI
  totalRepuestos: number; // Σ Cantidad_RI
  avgResolMs: number; // tiempo promedio de resolución
}

function buildAgg(repuestos: DashRepuestoIncidente[]) {
  // Join repuesto → incidente por IDIncidente. Los huérfanos (fuera de la ventana)
  // se descartan porque su incidente no está en el índice.
  const valorByInc = new Map<string, number>();
  const cantByInc = new Map<string, number>();
  const incWithRep = new Set<string>();
  for (const r of repuestos) {
    const id = r.IDIncidente_RI;
    if (!id) continue;
    const cant = r.Cantidad_RI || 0;
    const precio = r.Precio_RI || 0;
    valorByInc.set(id, (valorByInc.get(id) ?? 0) + cant * precio);
    cantByInc.set(id, (cantByInc.get(id) ?? 0) + cant);
    if (cant > 0) incWithRep.add(id);
  }

  const statsFor = (incs: Incidente[]): MonthStats => {
    const total = incs.length;
    const pendientes = incs.filter((i) => !isResuelto(i)).length;
    const resueltosArr = incs.filter(isResuelto);
    const conRepuestos = resueltosArr.filter((i) => incWithRep.has(i.IDIncidente)).length;
    const durations = resueltosArr
      .map((i) => {
        const a = parseDMY(i.Fecha_IN);
        const b = parseDMY(i.FechaResuelto_IN);
        return a != null && b != null ? b - a : null;
      })
      .filter((n): n is number => n != null && n >= 0);
    const avgResolMs = durations.length ? durations.reduce((s, n) => s + n, 0) / durations.length : 0;
    const valor = incs.reduce((s, i) => s + (valorByInc.get(i.IDIncidente) ?? 0), 0);
    const totalRepuestos = incs.reduce((s, i) => s + (cantByInc.get(i.IDIncidente) ?? 0), 0);
    return {
      total,
      pendientes,
      resueltos: resueltosArr.length,
      conRepuestos,
      sinRepuestos: resueltosArr.length - conRepuestos,
      valor,
      totalRepuestos,
      avgResolMs,
    };
  };

  return { valorByInc, cantByInc, statsFor };
}

// ── Configs de charts ──────────────────────────────────────────────────────────
const barConfig: ChartConfig = { value: { label: 'Incidentes' } };
const donutConfig: ChartConfig = { cantidad: { label: 'Incidentes' } };
const valorConfig: ChartConfig = { valor: { label: 'Valor repuestos' } };

// Rampa FRÍA de marca para el donut/pills (cian → azul → violeta → cian-oscuro →
// cian-claro → slate → azul-profundo). Sin verde/ámbar/rojo: la marca es cian.
const COOL_RAMP = [
  'rgb(0 180 229)',
  'rgb(58 138 255)',
  'rgb(124 111 240)',
  'rgb(0 145 195)',
  'rgb(94 200 235)',
  'rgb(120 160 200)',
  'rgb(42 111 176)',
];
const coolColor = (i: number) => COOL_RAMP[i % COOL_RAMP.length];

type RankMetric = 'inc' | 'valor';

// ══════════════════════════════════════════════════════════════════════════════

export default function DashboardIncidentes({ desde, hasta, view }: { desde: string; hasta: string; view: GridView }) {
  const [data, setData] = useState<DashboardIncidentesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [edifMetric, setEdifMetric] = useState<RankMetric>('inc');

  // Fetch SCOPED al rango: el backend trae SOLO los meses de [desde..hasta] (mm/yyyy).
  // Los datos cargados YA son el rango — no se filtra por rango en cliente.
  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    return getDashboardIncidentes(desde, hasta)
      .then(setData)
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'No se pudo cargar el dashboard.'))
      .finally(() => setLoading(false));
  }, [desde, hasta]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- recarga al cambiar el rango; "Reintentar" también dispara load().
    load();
  }, [load]);

  const incidentes = useMemo(() => data?.incidentes ?? [], [data]);
  const repuestos = useMemo(() => data?.repuestos ?? [], [data]);

  const { valorByInc, statsFor } = useMemo(() => buildAgg(repuestos), [repuestos]);

  // Export plano (todas las columnas separadas). Incluye Tipo y Valor derivados.
  const incidenteFlat = useCallback(
    (i: Incidente): Record<string, string | number> => ({
      ID: i.ID,
      IDIncidente: i.IDIncidente,
      Fecha: i.Fecha_IN,
      'Mes/Año': i.FechaMesAno_IN,
      Tipo: TIPO_META[tipoDe(i)].label,
      Categoría: i.Categoria_IN ?? '',
      Resolución: i.NoResuelto_IN,
      Título: i.Titulo_IN,
      Estado: i.Status_IN,
      Resuelto: i.Resuelto_IN,
      Edificio: i.NombreEdificio_IN,
      Código: i.CodigoEdifcio_IN ?? '',
      'ID máquina': i.IDMaquina_IN ?? '',
      Máquina: i.ConcatMaquina_IN ?? '',
      'Máquina asignada': i.MaquinaAsignada_IN ?? '',
      Técnico: i.TecnicoAsignado_IN ?? '',
      'Cant. repuestos': i.CantidadRepuestos_IN,
      'Valor repuestos': valorByInc.get(i.IDIncidente) ?? 0,
      'Desc. carga': i.DescripcionCarga_IN ?? '',
      'Desc. incidente': i.DescripcionIncidente_IN ?? '',
      'Desc. resuelto': i.DescripcionResuelto_IN ?? '',
      'Fecha resuelto': i.FechaResuelto_IN ?? '',
      'Fecha asignada': i.FechaAsignada_IN ?? '',
      Usuario: i.User_IN,
    }),
    [valorByInc]
  );

  // Los datos cargados YA son el rango [desde..hasta] (scoped en el backend):
  // KPIs + pills + donut + rankings usan TODO lo cargado.
  const stats = useMemo(() => statsFor(incidentes), [statsFor, incidentes]);

  // ── Evolución mensual: los meses del rango cargado (agrupa por FechaMesAno_IN
  // lo que llegó; ya NO 12 fijos), ordenados ascendente. ──
  const evolucion = useMemo(() => {
    const byKey = new Map<number, { label: string; incidentes: number; valor: number }>();
    for (const i of incidentes) {
      const mo = incMonth(i);
      if (!mo) continue;
      const k = monthKey(mo.y, mo.m);
      const cur = byKey.get(k) ?? { label: monthLabel(mo.y, mo.m), incidentes: 0, valor: 0 };
      cur.incidentes += 1;
      cur.valor += valorByInc.get(i.IDIncidente) ?? 0;
      byKey.set(k, cur);
    }
    return [...byKey.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
  }, [incidentes, valorByInc]);

  // ── Tipos de registro (servicio / cambio de máquina / control OK) ──
  const tipos = useMemo(() => {
    let servicio = 0, cambio = 0, control = 0;
    for (const i of incidentes) {
      const t = tipoDe(i);
      if (t === 'cambio') cambio += 1;
      else if (t === 'control') control += 1;
      else servicio += 1;
    }
    return { servicio, cambio, control };
  }, [incidentes]);

  // ── Donut por categoría — SOLO incidentes de servicio reales (excluye cambios de
  // máquina y controles OK, que si no dominan y ensucian la distribución) ──
  const porCategoria = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of incidentes) {
      if (tipoDe(i) !== 'servicio') continue;
      const k = proper((i.Categoria_IN ?? '').trim() || 'Sin categoría') || 'Sin categoría';
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return [...map.entries()].map(([name, cantidad]) => ({ name, cantidad })).sort((a, b) => b.cantidad - a.cantidad);
  }, [incidentes]);

  // ── Top edificios (por incidentes o por valor) ──
  const topEdificios = useMemo(() => {
    const inc = new Map<string, number>();
    const val = new Map<string, number>();
    for (const i of incidentes) {
      const k = proper(i.NombreEdificio_IN.trim() || 'Sin edificio') || 'Sin edificio';
      inc.set(k, (inc.get(k) ?? 0) + 1);
      val.set(k, (val.get(k) ?? 0) + (valorByInc.get(i.IDIncidente) ?? 0));
    }
    const rows = [...inc.keys()].map((name) => ({
      name,
      value: edifMetric === 'inc' ? (inc.get(name) ?? 0) : (val.get(name) ?? 0),
      label: edifMetric === 'inc' ? intFmt(inc.get(name) ?? 0) : moneyK(val.get(name) ?? 0),
    }));
    return rows.sort((a, b) => b.value - a.value).slice(0, 8);
  }, [incidentes, valorByInc, edifMetric]);

  // ── Top edificios por incidentes/máquina (promedio) ──
  const topMaquinas = useMemo(() => {
    const inc = new Map<string, number>();
    const maquinas = new Map<string, Set<string>>();
    for (const i of incidentes) {
      const edif = proper(i.NombreEdificio_IN.trim() || 'Sin edificio') || 'Sin edificio';
      const maq = (i.ConcatMaquina_IN ?? '').trim();
      inc.set(edif, (inc.get(edif) ?? 0) + 1);
      if (maq) {
        if (!maquinas.has(edif)) maquinas.set(edif, new Set());
        maquinas.get(edif)!.add(maq);
      }
    }
    const rows = [...inc.keys()]
      .map((name) => {
        const nMaq = maquinas.get(name)?.size ?? 0;
        const avg = nMaq > 0 ? (inc.get(name) ?? 0) / nMaq : 0;
        return { name, value: avg, label: avg > 0 ? avg.toFixed(1) : '—' };
      })
      .filter((r) => r.value > 0);
    return rows.sort((a, b) => b.value - a.value).slice(0, 8);
  }, [incidentes]);

  // Sin período anterior (los datos son solo el rango) → sin deltas.
  const pctResolCur = stats.total ? (stats.resueltos / stats.total) * 100 : 0;
  const avgRepPorInc = stats.total ? stats.totalRepuestos / stats.total : 0;

  return (
    <div className="relative min-h-0 flex-1">
      <LoadingOverlay visible={loading} label="Cargando dashboard…" />

      {loadError ? (
        <div className="h-full overflow-y-auto">
          <ErrorState message={loadError} onRetry={load} />
        </div>
      ) : (
        view === 'grilla' ? (
          <div className="h-full p-4 pb-4 md:p-6">
            <GridPanel<Incidente>
              rows={incidentes}
              columns={INCIDENTES_COLUMNS}
              rowKey={(i) => i.ID}
              search={incidenteSearch}
              toFlat={incidenteFlat}
              exportName={`incidentes_${fileTag(desde, hasta)}`}
              placeholder="Buscar edificio, máquina, categoría, técnico…"
              mobileCard={incidenteCard}
            />
          </div>
        ) : (
          <div className="h-full space-y-4 overflow-y-auto p-4 pb-8 md:p-6">
          {/* ── Fila de KPIs ── */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              icon={AlertOctagon}
              label="Total registros"
              value={intFmt(stats.total)}
              accent
              sub={
                <span className="truncate">
                  {intFmt(tipos.servicio)} de servicio · {intFmt(tipos.cambio)} cambios de máq.
                </span>
              }
            />
            <KpiCard
              icon={Wallet}
              label="Valor de repuestos"
              value={money(stats.valor)}
              sub={
                <span className="truncate">
                  {avgRepPorInc.toFixed(1)} rep./incidente · {intFmt(stats.totalRepuestos)} repuestos
                </span>
              }
            />
            <KpiCard
              icon={Timer}
              label="Tiempo prom. resolución"
              value={fmtDur(stats.avgResolMs)}
              sub={<span className="truncate">{dias(stats.avgResolMs)} días promedio</span>}
            />
            <KpiCard
              icon={CheckCircle2}
              label="Incidentes resueltos"
              value={pct(pctResolCur)}
              sub={<span className="truncate">{pct(100 - pctResolCur)} pendientes</span>}
            />
          </div>

          {/* Composición de los registros por TIPO — separa lo que NO es incidente de
              servicio (cambios de máquina + controles OK) del servicio real. */}
          {stats.total > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <BreakdownPill
                color={COOL_RAMP[0]}
                label="Incidentes de servicio"
                value={tipos.servicio}
                share={stats.total ? (tipos.servicio / stats.total) * 100 : 0}
              />
              <BreakdownPill
                color={COOL_RAMP[2]}
                label="Cambios de máquina"
                value={tipos.cambio}
                share={stats.total ? (tipos.cambio / stats.total) * 100 : 0}
              />
              <BreakdownPill
                color={COOL_RAMP[5]}
                label="Controles OK"
                value={tipos.control}
                share={stats.total ? (tipos.control / stats.total) * 100 : 0}
              />
            </div>
          )}

          {/* ── Evolución temporal (ancho) + Donut categoría ── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <ChartCard
              className="lg:col-span-2"
              icon={TrendingUp}
              title="Evolución de incidentes"
              subtitle="Incidentes y valor de repuestos por mes del período"
            >
              {evolucion.length <= 1 ? (
                <div className="flex h-[250px] w-full flex-col items-center justify-center gap-1.5 text-center">
                  <TrendingUp size={26} strokeWidth={1.6} className="text-wash-text-faint" />
                  <p className="text-sm font-medium text-wash-text-strong">
                    {evolucion.length === 0 ? 'Sin datos en el período' : 'Un solo mes seleccionado'}
                  </p>
                  <p className="max-w-[300px] text-xs text-wash-text-muted">
                    Ampliá el período a varios meses en Filtrar para ver la evolución mes a mes.
                  </p>
                </div>
              ) : (
              /* Dos ejes independientes apilados (un solo eje por chart, sin dual-axis) */
              <div className="space-y-1">
                <ChartContainer config={barConfig} className="h-[150px] w-full">
                  <BarChart data={evolucion} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid vertical={false} {...CHART_GRID} />
                    <XAxis dataKey="label" {...AXIS} tick={X_TICK} hide />
                    <YAxis {...AXIS} tick={X_TICK} width={34} allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent labelKey="label" />} />
                    <Bar dataKey="incidentes" fill="var(--color-wash-brand)" radius={[4, 4, 0, 0]} maxBarSize={30}>
                      <LabelList
                        dataKey="incidentes"
                        position="top"
                        className="fill-wash-text-muted"
                        style={{ fontSize: 10, fontWeight: 600 }}
                      />
                    </Bar>
                  </BarChart>
                </ChartContainer>
                <ChartContainer config={valorConfig} className="h-[92px] w-full">
                  <AreaChart data={evolucion} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="dashIncValorFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} {...CHART_GRID} />
                    <XAxis dataKey="label" {...AXIS} tick={X_TICK} interval="preserveStartEnd" minTickGap={8} />
                    <YAxis {...AXIS} tick={X_TICK} width={34} tickFormatter={moneyK} />
                    <ChartTooltip
                      content={<ChartTooltipContent labelKey="label" formatter={(v) => money(Number(v))} />}
                    />
                    <Area
                      type="monotone"
                      dataKey="valor"
                      stroke="var(--color-chart-2)"
                      strokeWidth={2.5}
                      fill="url(#dashIncValorFill)"
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ChartContainer>
              </div>
              )}
            </ChartCard>

            <ChartCard
              icon={PieIcon}
              title="Incidentes de servicio por categoría"
              subtitle="Solo servicio real (excluye cambios de máquina y controles OK)"
              empty={porCategoria.length === 0}
            >
              <div className="flex flex-col items-center gap-4 sm:flex-row lg:flex-col xl:flex-row">
                <div className="relative shrink-0">
                  <ChartContainer config={donutConfig} className="aspect-square h-[172px]">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                      <Pie
                        data={porCategoria}
                        dataKey="cantidad"
                        nameKey="name"
                        innerRadius={52}
                        outerRadius={80}
                        paddingAngle={2}
                        stroke="var(--color-wash-surface)"
                        strokeWidth={2}
                      >
                        {porCategoria.map((_, i) => (
                          <Cell key={i} fill={coolColor(i)} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-display text-2xl font-bold tabular-nums text-wash-text-strong">
                      {intFmt(tipos.servicio)}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-wash-text-muted">
                      servicio
                    </span>
                  </div>
                </div>
                <ul className="flex min-w-0 flex-1 flex-col gap-1.5 text-[13px]">
                  {porCategoria.slice(0, 7).map((c, i) => (
                    <li key={c.name} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: coolColor(i) }} />
                      <span className="truncate text-wash-text-muted">{c.name}</span>
                      <span className="ml-auto shrink-0 font-semibold tabular-nums text-wash-text-strong">
                        {c.cantidad}
                      </span>
                      <span className="w-10 shrink-0 text-right text-xs tabular-nums text-wash-text-faint">
                        {tipos.servicio ? Math.round((c.cantidad / tipos.servicio) * 100) : 0}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </ChartCard>
          </div>

          {/* ── Rankings de edificios ── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard
              icon={Building2}
              title="Top edificios con más incidentes"
              subtitle={edifMetric === 'inc' ? 'Ranking por cantidad — top 8' : 'Ranking por valor de repuestos — top 8'}
              empty={topEdificios.length === 0}
              right={
                <SegToggle
                  value={edifMetric}
                  onChange={setEdifMetric}
                  options={[
                    { value: 'inc', label: 'Incidentes' },
                    { value: 'valor', label: 'Valor' },
                  ]}
                />
              }
            >
              <RankBars data={topEdificios} />
            </ChartCard>

            <ChartCard
              icon={Wrench}
              title="Edificios con más incidentes por máquina"
              subtitle="Promedio de incidentes por máquina — top 8"
              empty={topMaquinas.length === 0}
            >
              <RankBars data={topMaquinas} />
            </ChartCard>
          </div>
        </div>
        )
      )}
    </div>
  );
}

// ── Subcomponentes ─────────────────────────────────────────────────────────────

function BreakdownPill({
  color,
  label,
  value,
  share,
}: {
  color: string;
  label: string;
  value: number;
  share: number;
}) {
  return (
    <Card className="ring-wash-border">
      <CardContent className="flex items-center gap-3 py-3">
        <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">{label}</p>
          <p className="flex items-baseline gap-1.5">
            <span className="font-display text-xl font-bold tabular-nums text-wash-text-strong">{intFmt(value)}</span>
            <span className="text-xs tabular-nums text-wash-text-faint">{pct(share)}</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/** Card estándar de chart: header con ícono de marca + título/subtítulo, `right` opcional y estado vacío. */
function ChartCard({
  icon: Icon,
  title,
  subtitle,
  className,
  empty,
  right,
  children,
}: {
  icon: ElementType;
  title: string;
  subtitle: string;
  className?: string;
  empty?: boolean;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className={cn('ring-wash-border', className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          <p className="truncate text-xs text-wash-text-muted">{subtitle}</p>
        </div>
        {right ?? (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-wash-brand/[0.08] text-wash-brand">
            <Icon size={16} />
          </span>
        )}
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

const rankConfig: ChartConfig = { value: { label: 'Valor' } };

/** Ranking de barras horizontales, hue de marca, con label directo (string precalculado). */
function RankBars({ data, height = 260 }: { data: { name: string; value: number; label: string }[]; height?: number }) {
  return (
    <ChartContainer config={rankConfig} className="w-full" style={{ height }}>
      <BarChart data={data} layout="vertical" margin={{ top: 2, left: 0, right: 44, bottom: 2 }}>
        <CartesianGrid horizontal={false} {...CHART_GRID} />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          {...AXIS}
          tick={{ fontSize: 12, fill: 'var(--color-wash-text-muted)' }}
          width={132}
        />
        <ChartTooltip
          content={<ChartTooltipContent hideLabel />}
          cursor={{ fill: 'var(--color-wash-brand)', fillOpacity: 0.06 }}
        />
        <Bar dataKey="value" fill="var(--color-wash-brand)" radius={[4, 4, 4, 4]} barSize={16}>
          <LabelList
            dataKey="label"
            position="right"
            className="fill-wash-text-strong"
            style={{ fontSize: 12, fontWeight: 600 }}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

/** Segmented toggle liviano (marca cian en la opción activa). */
function SegToggle<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex shrink-0 rounded-lg border border-wash-border bg-wash-surface p-0.5 text-xs">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-md px-2.5 py-1 font-medium transition-colors',
            value === o.value ? 'bg-wash-brand text-white' : 'text-wash-text-muted hover:text-wash-text-strong'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
