import { useMemo, useState, useTransition } from 'react';
import type { ElementType } from 'react';
import { LayoutDashboard, MapPin, AlertOctagon, Package, CalendarDays, Filter, Lock } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { useAppStore } from '@/store/useAppStore';
import { dashboardTabsForRole } from '@/lib/nav';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DatePicker, formatDateDDMMYYYY } from '@/components/ui/date-picker';
import { ViewToggle, type GridView } from '@/components/dashboard/GridPanel';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { cn } from '@/lib/utils';
import DashboardGeneral from '@/screens/dashboard/DashboardGeneral';
import DashboardVisitas from '@/screens/dashboard/DashboardVisitas';
import DashboardIncidentes from '@/screens/dashboard/DashboardIncidentes';
import DashboardStock from '@/screens/dashboard/DashboardStock';

type TabId = 'general' | 'visitas' | 'incidentes' | 'stock';

const TABS: { id: TabId; label: string; icon: ElementType; subtitle: string }[] = [
  { id: 'general', label: 'General', icon: LayoutDashboard, subtitle: 'Panel ejecutivo · incidentes, visitas y ventilaciones' },
  { id: 'visitas', label: 'Visitas', icon: MapPin, subtitle: 'Control de edificios · tiempos y resultado de control' },
  { id: 'incidentes', label: 'Incidentes', icon: AlertOctagon, subtitle: 'Analítica de incidentes' },
  { id: 'stock', label: 'Stock', icon: Package, subtitle: 'Entradas y salidas de repuestos por movimiento' },
];

/** Días del rango por defecto del tab Stock (contando hoy). */
const STOCK_DIAS_DEFAULT = 30;
/** Hoy menos `n` días, a medianoche local. */
function hoyMenos(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** Últimos `n` meses en `mm/yyyy`, del más nuevo al más viejo, con label 'mmm yyyy'. */
function monthOptions(n: number): { value: string; label: string }[] {
  const now = new Date();
  const out: { value: string; label: string }[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    out.push({ value: `${mm}/${d.getFullYear()}`, label: `${MESES[d.getMonth()]} ${d.getFullYear()}` });
  }
  return out;
}
/** Orden numérico de un 'mm/yyyy' (yyyy*12+mm). */
const ord = (mmYyyy: string) => {
  const [m, y] = mmYyyy.split('/').map(Number);
  return y * 12 + m;
};

/**
 * Dashboard con 4 tabs (General · Visitas · Incidentes · Stock). Cada tab es autónomo y sólo
 * renderiza contenido; el título/subtítulo y los filtros los provee este shell (no hay doble
 * header). El backend trae SOLO el rango pedido (rápido, no 12 meses siempre).
 *
 * Hay DOS filtros de período porque son dos unidades de tiempo distintas:
 *  · Visitas/Incidentes → MES/AÑO. Son métricas que se comparan mes contra mes.
 *  · Stock              → DÍA. Un movimiento de stock pasa un día concreto; el bucket
 *                         mensual perdería justamente el dato que se quiere ver.
 */
export function Dashboard() {
  const VarTipoUser = useAppStore((s) => s.VarTipoUser);
  // Tabs visibles según el rol (Sup. Líder → solo Visitas; roles sin acceso → ninguno).
  const allowedTabs = useMemo(() => dashboardTabsForRole(VarTipoUser), [VarTipoUser]);
  const visibleTabs = useMemo(() => TABS.filter((t) => allowedTabs.includes(t.id)), [allowedTabs]);

  const [tab, setTab] = useState<TabId>(() => allowedTabs[0] ?? 'general');
  const [view, setView] = useState<GridView>('graficos');

  /**
   * Cambiar de tab (o de gráficos↔grilla) monta un árbol CARO: los memos sobre ~1000 filas
   * del período más los charts de recharts, todo en un render sincrónico. En un celular eso
   * bloquea el hilo cientos de ms y el browser no puede pintar NADA mientras dura — ni el
   * LoadingOverlay del tab nuevo. Efecto: tocás el botón, no pasa nada, y de golpe aparece
   * el otro reporte.
   *
   * `useTransition` marca ese render como no urgente: `swapping` se commitea en el tick del
   * tap (paint inmediato del spinner) y React arma el árbol nuevo después, cediendo el hilo.
   */
  const [swapping, startSwap] = useTransition();
  const cambiarTab = (t: TabId) => {
    if (t === tab) return;
    startSwap(() => setTab(t));
  };
  const cambiarView = (v: GridView) => {
    if (v === view) return;
    startSwap(() => setView(v));
  };
  const meses = useMemo(() => monthOptions(24), []);
  // Período por defecto: el mes anterior (el mes en curso suele estar incompleto y da
  // números parciales). meses[1] = mes pasado; fallback a meses[0] si sólo hay uno.
  const mesDefault = (meses[1] ?? meses[0]).value;
  const [desde, setDesde] = useState<string>(mesDefault);
  const [hasta, setHasta] = useState<string>(mesDefault);

  // Stock razona por DÍA, no por mes: un movimiento de stock es de un día concreto y el
  // bucket mensual lo perdería. Por eso lleva su propio rango en vez de reusar `desde`/`hasta`.
  const [fDesde, setFDesde] = useState<Date>(() => hoyMenos(STOCK_DIAS_DEFAULT - 1));
  const [fHasta, setFHasta] = useState<Date>(() => hoyMenos(0));

  // El tab activo siempre debe ser uno permitido (defensivo si el rol cambia).
  const activeId = allowedTabs.includes(tab) ? tab : (allowedTabs[0] ?? 'general');
  const active = TABS.find((t) => t.id === activeId) ?? TABS[0];
  const esStock = activeId === 'stock';
  // Filtro MENSUAL (+ toggle gráficos/grilla) para Visitas e Incidentes; Stock usa el de días.
  const rangeVisible = activeId !== 'general' && !esStock;
  const desdeLabel = meses.find((m) => m.value === desde)?.label ?? desde;
  const hastaLabel = meses.find((m) => m.value === hasta)?.label ?? hasta;
  const subtitle = rangeVisible
    ? `${active.subtitle} · ${desdeLabel} → ${hastaLabel}`
    : esStock
      ? `${active.subtitle} · ${formatDateDDMMYYYY(fDesde)} → ${formatDateDDMMYYYY(fHasta)}`
      : active.subtitle;

  // Igual que el filtro mensual: elegir un extremo cruzado arrastra al otro.
  const onFDesde = (d: Date | undefined) => {
    if (!d) return;
    setFDesde(d);
    if (d > fHasta) setFHasta(d);
  };
  const onFHasta = (d: Date | undefined) => {
    if (!d) return;
    setFHasta(d);
    if (d < fDesde) setFDesde(d);
  };

  // Al elegir "desde" mayor que "hasta" (o viceversa), arrastramos el otro extremo.
  const onDesde = (v: string) => {
    setDesde(v);
    if (ord(v) > ord(hasta)) setHasta(v);
  };
  const onHasta = (v: string) => {
    setHasta(v);
    if (ord(v) < ord(desde)) setDesde(v);
  };

  if (visibleTabs.length === 0) {
    // Rol sin acceso al Dashboard (defensivo; el sidebar ya lo oculta).
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-wash-surface-2 text-wash-text-muted">
          <Lock size={24} />
        </span>
        <p className="text-sm font-semibold text-wash-text-strong">Sin acceso al Dashboard</p>
        <p className="text-xs text-wash-text-muted">Tu rol no tiene permisos sobre este módulo.</p>
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full flex-col">
      <PageHeader
        title="Dashboard"
        subtitle={subtitle}
        toolbarExtra={
          <div className="flex w-full min-w-0 items-center gap-2 md:w-auto md:flex-wrap md:justify-end">
            {rangeVisible && (
              <PeriodoFiltro
                desde={desde}
                hasta={hasta}
                onDesde={onDesde}
                onHasta={onHasta}
                options={meses}
                desdeLabel={desdeLabel}
                hastaLabel={hastaLabel}
              />
            )}
            {esStock && <RangoDiasFiltro desde={fDesde} hasta={fHasta} onDesde={onFDesde} onHasta={onFHasta} />}
            {rangeVisible && <ViewToggle value={view} onChange={cambiarView} />}
            {/* Un solo tab visible ⇒ no tiene sentido el segmented control. */}
            {visibleTabs.length > 1 && <TabControl tabs={visibleTabs} tab={activeId} onTab={cambiarTab} />}
          </div>
        }
      />

      {/* Wrapper `relative` propio: el overlay del swap tapa SOLO el contenido, no el header,
          así los botones siguen respondiendo mientras se arma el reporte nuevo. */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <LoadingOverlay visible={swapping} label="Cargando reporte…" />
        {activeId === 'general' && <DashboardGeneral />}
        {activeId === 'visitas' && <DashboardVisitas desde={desde} hasta={hasta} view={view} />}
        {activeId === 'incidentes' && <DashboardIncidentes desde={desde} hasta={hasta} view={view} />}
        {esStock && <DashboardStock desde={formatDateDDMMYYYY(fDesde)} hasta={formatDateDDMMYYYY(fHasta)} />}
      </div>
    </div>
  );
}

/**
 * Gemelo del `PeriodoFiltro` mensual, pero por DÍA — lo usa el tab Stock, donde un
 * movimiento pertenece a una fecha concreta. Mismo botón "Filtrar" y mismo popover;
 * lo único que cambia son los dos `DatePicker` en vez de los selects de mes.
 */
function RangoDiasFiltro({
  desde,
  hasta,
  onDesde,
  onHasta,
}: {
  desde: Date;
  hasta: Date;
  onDesde: (d: Date | undefined) => void;
  onHasta: (d: Date | undefined) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Filtrar fechas"
          aria-label="Filtrar fechas"
          className="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-wash-canvas px-3 text-sm font-medium text-wash-text-strong ring-1 ring-wash-border transition-colors hover:bg-wash-border/40"
        >
          <Filter size={14} className="shrink-0" />
          <span className="hidden md:inline">Filtrar</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[260px]">
        <div className="flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">
          <CalendarDays size={12} />
          Período · {formatDateDDMMYYYY(desde)} → {formatDateDDMMYYYY(hasta)}
        </div>
        <div>
          <label className="mb-1 block px-1 text-xs text-wash-text-muted">Desde</label>
          {/* No hay movimientos de stock en el futuro: `endMonth` acota el desplegable de
              mes/año y `maxDate` deshabilita los días futuros del mes en curso. Hacen falta
              LOS DOS — sin `maxDate` el calendario deja clickear un día que todavía no pasó. */}
          <DatePicker value={desde} onChange={onDesde} endMonth={hoyMenos(0)} maxDate={hoyMenos(0)} className="h-9" />
        </div>
        <div>
          <label className="mb-1 block px-1 text-xs text-wash-text-muted">Hasta</label>
          <DatePicker value={hasta} onChange={onHasta} endMonth={hoyMenos(0)} maxDate={hoyMenos(0)} className="h-9" />
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Botón "Filtros" que despliega el período (desde/hasta) en un popover. Reemplaza a
 * los 2 datepickers inline para ganar espacio en el header — el rango elegido se
 * muestra en el propio botón.
 */
function PeriodoFiltro({
  desde,
  hasta,
  onDesde,
  onHasta,
  options,
  desdeLabel,
  hastaLabel,
}: {
  desde: string;
  hasta: string;
  onDesde: (v: string) => void;
  onHasta: (v: string) => void;
  options: { value: string; label: string }[];
  desdeLabel: string;
  hastaLabel: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        {/* Botón "Filtrar" consistente con los demás módulos (ver PageHeader). */}
        <button
          type="button"
          title="Filtrar período"
          aria-label="Filtrar período"
          className="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-wash-canvas px-3 text-sm font-medium text-wash-text-strong ring-1 ring-wash-border transition-colors hover:bg-wash-border/40"
        >
          <Filter size={14} className="shrink-0" />
          <span className="hidden md:inline">Filtrar</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[240px]">
        <div className="flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">
          <CalendarDays size={12} />
          Período · {desdeLabel} → {hastaLabel}
        </div>
        <div>
          <label className="mb-1 block px-1 text-xs text-wash-text-muted">Desde</label>
          <MesSelect value={desde} onChange={onDesde} options={options} />
        </div>
        <div>
          <label className="mb-1 block px-1 text-xs text-wash-text-muted">Hasta</label>
          <MesSelect value={hasta} onChange={onHasta} options={options} />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function MesSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-full bg-wash-canvas text-[13px] ring-wash-border">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-[320px]">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Segmented control de marca para alternar entre los tabs del dashboard. */
function TabControl({ tabs, tab, onTab }: { tabs: typeof TABS; tab: TabId; onTab: (t: TabId) => void }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1 rounded-xl bg-wash-surface-2 p-1 ring-1 ring-wash-border md:w-auto md:flex-none">
      {tabs.map((t) => {
        const Icon = t.icon;
        const activo = t.id === tab;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onTab(t.id)}
            aria-pressed={activo}
            title={t.label}
            aria-label={t.label}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors md:flex-none',
              activo
                ? 'bg-wash-surface text-wash-brand-dark shadow-sm ring-1 ring-wash-border'
                : 'text-wash-text-muted hover:text-wash-text-strong'
            )}
          >
            <Icon size={15} className="shrink-0" />
            <span className="hidden md:inline">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
