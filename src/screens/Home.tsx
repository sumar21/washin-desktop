import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Package,
  ShoppingCart,
  AlertOctagon,
  Wind,
  Trash2,
  Building2,
  CalendarDays,
  Clock,
  User,
  MapPin,
  Inbox,
  Activity,
  ClipboardList,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts';
import { useAppStore } from '@/store/useAppStore';
import { proper, currentMonthName } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/StatusBadge';
import { PageHeader } from '@/components/PageHeader';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { ConfirmDialog } from '@/components/Modal';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { ErrorState } from '@/components/ErrorState';
import { KpiCard, SectionTitle } from '@/components/dashboard/widgets';
import { chartColor, CHART_GRID, X_TICK, Y_TICK, AXIS, intFmt } from '@/components/dashboard/shared';
import type { DetalleCompra, Registro, TipoStock } from '@/types/domain';

export function Home() {
  const CollectResumen = useAppStore((s) => s.CollectResumen);
  const CollectStock = useAppStore((s) => s.CollectStock);
  const CollectCompras = useAppStore((s) => s.CollectCompras);
  const CollectIncidentes = useAppStore((s) => s.CollectIncidentes);
  const CollectVentilaciones = useAppStore((s) => s.CollectVentilaciones);
  const CollectDetalleCompras = useAppStore((s) => s.CollectDetalleCompras);
  const removeRegistro = useAppStore((s) => s.removeRegistro);
  const fetchHome = useAppStore((s) => s.fetchHome);
  const fetchStock = useAppStore((s) => s.fetchStock);
  const fetchCompras = useAppStore((s) => s.fetchCompras);
  const fetchIncidentes = useAppStore((s) => s.fetchIncidentes);

  const [deletingRegistro, setDeletingRegistro] = useState<Registro | null>(null);
  const [homeLoading, setHomeLoading] = useState(true);
  const [homeError, setHomeError] = useState<string | null>(null);

  const loadHome = useCallback(() => {
    setHomeLoading(true);
    setHomeError(null);
    // fetchStock/Compras/Incidentes también: los KPIs dependen de esas colecciones y
    // esta pantalla puede ser la primera en cargar.
    return Promise.all([fetchHome(), fetchStock(), fetchCompras(), fetchIncidentes()])
      .catch((err) => {
        setHomeError(err instanceof Error ? err.message : 'No se pudo cargar el resumen.');
      })
      .finally(() => {
        setHomeLoading(false);
      });
  }, [fetchHome, fetchStock, fetchCompras, fetchIncidentes]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial; `loadHome` también la dispara el botón "Reintentar".
    loadHome();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar; `loadHome` ya setea su propio loading.
  }, []);

  // KPIs
  const totalCompras = CollectCompras.length;
  const totalStock = CollectStock.reduce((s, i) => s + i.Cantidad_ST, 0);
  const incidentesAbiertos = CollectIncidentes.filter((i) => i.Resuelto_IN === 'NO').length;
  const ventilacionesPendientes = CollectVentilaciones.filter(
    (v) => v.Estado_VE !== 'Realizada'
  ).length;

  // Charts data
  const comprasPorEstado = useMemo(() => {
    const estados = ['Pendiente', 'En Aprobacion', 'Aprobada', 'Recibida', 'Rechazada'] as const;
    return estados.map((e) => ({
      estado: e,
      cantidad: CollectDetalleCompras.filter((d) => d.Status_DC === e).length,
    }));
  }, [CollectDetalleCompras]);

  const stockPorTipo = useMemo(() => {
    const tipos: TipoStock[] = [
      'LAVADORA',
      'SECADORA SIMPLE',
      'SECADORA DOBLE',
      'CARGADORA',
      'EXPENDEDORA',
      'ENCENDEDORA',
      'REPUESTO',
    ];
    return tipos
      .map((t) => ({
        tipo: t,
        cantidad: CollectStock.filter((s) => s.Tipo_ST === t).reduce(
          (sum, i) => sum + i.Cantidad_ST,
          0
        ),
      }))
      .filter((x) => x.cantidad > 0);
  }, [CollectStock]);

  const comprasChartConfig: ChartConfig = {
    cantidad: { label: 'Cantidad', color: 'var(--color-wash-brand)' },
  };

  return (
    <div className="relative flex h-full w-full flex-col">
      <PageHeader title="Inicio" subtitle={`Resumen operativo · ${proper(currentMonthName())}`} />
      <LoadingOverlay visible={homeLoading} label="Cargando resumen…" />

      {homeError ? (
        <ErrorState message={homeError} onRetry={loadHome} />
      ) : (
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="grid grid-cols-12 gap-4">
          {/* KPIs */}
          <div className="col-span-6 lg:col-span-3">
            <KpiCard
              icon={ShoppingCart}
              label="Compras del mes"
              value={intFmt(totalCompras)}
              accent
              sub={<span>{CollectDetalleCompras.length} items en órdenes</span>}
            />
          </div>
          <div className="col-span-6 lg:col-span-3">
            <KpiCard
              icon={Package}
              label="Stock total"
              value={intFmt(totalStock)}
              sub={<span>unidades en depósito</span>}
            />
          </div>
          <div className="col-span-6 lg:col-span-3">
            <KpiCard
              icon={AlertOctagon}
              label="Incidentes abiertos"
              value={intFmt(incidentesAbiertos)}
              sub={<span>sin resolver</span>}
            />
          </div>
          <div className="col-span-6 lg:col-span-3">
            <KpiCard
              icon={Wind}
              label="Ventilaciones pend."
              value={intFmt(ventilacionesPendientes)}
              sub={<span>por realizar</span>}
            />
          </div>

          {/* Charts */}
          <Card className="col-span-12 ring-wash-border lg:col-span-7">
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <div>
                <CardTitle>Compras por estado</CardTitle>
                <p className="text-xs text-wash-text-muted">Detalle de compras del mes</p>
              </div>
              <Badge variant="outline" className="text-wash-text-muted">
                {CollectDetalleCompras.length} items
              </Badge>
            </CardHeader>
            <CardContent>
              <ChartContainer config={comprasChartConfig} className="h-[160px] w-full">
                <BarChart data={comprasPorEstado} margin={{ top: 4, left: 0, right: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} {...CHART_GRID} />
                  <XAxis dataKey="estado" {...AXIS} tick={X_TICK} />
                  <YAxis {...AXIS} width={22} tick={Y_TICK} allowDecimals={false} />
                  <ChartTooltip
                    content={<ChartTooltipContent />}
                    cursor={{ fill: 'var(--color-wash-brand)', fillOpacity: 0.06 }}
                  />
                  <Bar dataKey="cantidad" fill="var(--color-wash-brand)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card className="col-span-12 ring-wash-border lg:col-span-5">
            <CardHeader>
              <CardTitle>Stock por tipo</CardTitle>
              <p className="text-xs text-wash-text-muted">Distribución del depósito</p>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
              <ChartContainer
                config={{ cantidad: { label: 'Cantidad' } }}
                className="aspect-square h-[160px]"
              >
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="tipo" />} />
                  <Pie
                    data={stockPorTipo}
                    dataKey="cantidad"
                    nameKey="tipo"
                    innerRadius={42}
                    outerRadius={68}
                    paddingAngle={2}
                    stroke="var(--color-wash-surface)"
                    strokeWidth={2}
                  >
                    {stockPorTipo.map((_, i) => (
                      <Cell key={i} fill={chartColor(i)} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="flex flex-1 flex-col gap-1.5 text-[13px]">
                {stockPorTipo.map((s, i) => (
                  <div key={s.tipo} className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: chartColor(i) }}
                    />
                    <span className="truncate text-wash-text-muted">{s.tipo}</span>
                    <span className="ml-auto font-semibold tabular-nums text-wash-text-strong">
                      {s.cantidad}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Últimas visitas */}
          <div className="col-span-12 lg:col-span-4">
            <SectionTitle icon={Activity}>Últimas visitas</SectionTitle>
            <div className="flex max-h-[440px] flex-col gap-2 overflow-y-auto pr-0.5">
              {CollectResumen.length === 0 ? (
                <EmptyState icon={Inbox} title="Sin visitas este mes" />
              ) : (
                CollectResumen.map((r) => (
                  <VisitaCard key={r.ID} registro={r} onDelete={() => setDeletingRegistro(r)} />
                ))
              )}
            </div>
          </div>

          {/* Órdenes de compra */}
          <div className="col-span-12 lg:col-span-8">
            <SectionTitle icon={ClipboardList}>Órdenes de compra</SectionTitle>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <OrdenesColumn
                title="Aprobadas"
                tone="emerald"
                items={CollectDetalleCompras.filter((d) => d.Status_DC === 'Aprobada')}
              />
              <OrdenesColumn
                title="Pendientes"
                tone="amber"
                items={CollectDetalleCompras.filter((d) => d.Status_DC === 'Pendiente')}
              />
              <OrdenesColumn
                title="Recibidas"
                tone="sky"
                items={CollectDetalleCompras.filter((d) => d.Status_DC === 'Recibida')}
              />
            </div>
          </div>
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
    </div>
  );
}

// ---- Visita card ----

function VisitaCard({ registro, onDelete }: { registro: Registro; onDelete: () => void }) {
  const progreso = registro.Progreso ?? (registro.Estado === 'Finalizado' ? 100 : 0);
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
            className={
              progreso === 100
                ? 'h-full rounded-full bg-emerald-500 transition-all'
                : 'h-full rounded-full bg-wash-brand transition-all'
            }
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

// ---- Órdenes column ----

type OrdenTone = 'emerald' | 'amber' | 'sky';

const toneHeader: Record<OrdenTone, string> = {
  emerald: 'text-emerald-700',
  amber: 'text-amber-700',
  sky: 'text-sky-700',
};
const toneCount: Record<OrdenTone, string> = {
  emerald: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  sky: 'bg-sky-100 text-sky-700',
};

function OrdenesColumn({ title, tone, items }: { title: string; tone: OrdenTone; items: DetalleCompra[] }) {
  return (
    <div className="flex min-h-[320px] flex-col rounded-lg bg-wash-surface ring-1 ring-wash-border">
      <div className="flex items-center justify-between border-b border-wash-divider px-3 py-2.5">
        <span className={`text-[11px] font-bold uppercase tracking-wider ${toneHeader[tone]}`}>
          {title}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${toneCount[tone]}`}>
          {items.length}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-2">
        {items.length === 0 ? (
          <EmptyState icon={Inbox} title="Sin órdenes" compact />
        ) : (
          [...items]
            .sort((a, b) => b.ID - a.ID)
            .slice(0, 8)
            .map((it) => <OrdenItem key={it.ID} item={it} />)
        )}
      </div>
    </div>
  );
}

function OrdenItem({ item }: { item: DetalleCompra }) {
  const qty = item.CantidadIngresada_DC ?? item.Cantidad_DC;

  return (
    <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-wash-surface-2/60">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-wash-surface-2 text-wash-text-muted">
        <Package size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-wash-text-strong">
          {proper(item.Item_DC)}
        </div>
        <div className="mt-0.5 flex items-center gap-1 text-[10.5px] text-wash-text-muted">
          <CalendarDays size={10} />
          <span className="tabular-nums">{item.Fecha_DC}</span>
        </div>
      </div>
      <span className="shrink-0 rounded-md bg-wash-brand/10 px-2 py-1 text-sm font-bold tabular-nums text-wash-brand-dark">
        {qty}
      </span>
    </div>
  );
}

// ---- Empty state ----

function EmptyState({
  icon: Icon,
  title,
  compact,
}: {
  icon: typeof Inbox;
  title: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-wash-border text-center text-wash-text-muted ${
        compact ? 'py-8' : 'py-10'
      }`}
    >
      <Icon size={compact ? 24 : 28} strokeWidth={1.6} className="opacity-30" />
      <p className="mt-2 text-xs font-medium">{title}</p>
    </div>
  );
}
