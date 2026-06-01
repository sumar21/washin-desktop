import { useMemo, useState } from 'react';
import {
  Package,
  ShoppingCart,
  AlertOctagon,
  Wind,
  Trash2,
  HelpCircle,
  CalendarDays,
  Building2,
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
import { proper } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { ConfirmDialog } from '@/components/Modal';
import type { DetalleCompra, Registro, TipoStock } from '@/types/domain';

export function Home() {
  const CollectResumen = useAppStore((s) => s.CollectResumen);
  const CollectStock = useAppStore((s) => s.CollectStock);
  const CollectCompras = useAppStore((s) => s.CollectCompras);
  const CollectIncidentes = useAppStore((s) => s.CollectIncidentes);
  const CollectVentilaciones = useAppStore((s) => s.CollectVentilaciones);
  const CollectDetalleCompras = useAppStore((s) => s.CollectDetalleCompras);
  const removeRegistro = useAppStore((s) => s.removeRegistro);

  const [deletingRegistro, setDeletingRegistro] = useState<Registro | null>(null);

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

  const pieColors = [
    'var(--color-chart-1)',
    'var(--color-chart-2)',
    'var(--color-chart-3)',
    'var(--color-chart-4)',
    'var(--color-chart-5)',
    'rgb(168 85 247)',
    'rgb(244 114 182)',
  ];

  const comprasChartConfig: ChartConfig = {
    cantidad: { label: 'Cantidad', color: 'var(--color-wash-brand)' },
  };

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto">
      <div className="grid grid-cols-12 gap-3 px-6 pt-5 pb-6">
        {/* Compact KPIs */}
        <KpiCard icon={ShoppingCart} label="Compras del mes" value={totalCompras} tone="brand" />
        <KpiCard icon={Package} label="Stock total" value={totalStock} tone="emerald" />
        <KpiCard
          icon={AlertOctagon}
          label="Incidentes abiertos"
          value={incidentesAbiertos}
          tone="amber"
        />
        <KpiCard
          icon={Wind}
          label="Ventilaciones pend."
          value={ventilacionesPendientes}
          tone="sky"
        />

        {/* Compact charts row */}
        <Card className="col-span-12 lg:col-span-7 ring-wash-border">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-1">
            <div>
              <CardTitle className="text-sm">Compras por estado</CardTitle>
              <p className="text-[11px] text-wash-text-muted">
                Detalle de compras del mes
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] text-wash-text-muted">
              {CollectDetalleCompras.length} items
            </Badge>
          </CardHeader>
          <CardContent className="pt-1">
            <ChartContainer config={comprasChartConfig} className="h-[150px] w-full">
              <BarChart data={comprasPorEstado} margin={{ top: 4, left: 0, right: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--color-wash-border)" />
                <XAxis
                  dataKey="estado"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: 'var(--color-wash-text-muted)' }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={22}
                  tick={{ fontSize: 10, fill: 'var(--color-wash-text-muted)' }}
                />
                <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: 'rgba(0,180,229,0.06)' }} />
                <Bar dataKey="cantidad" fill="var(--color-wash-brand)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="col-span-12 lg:col-span-5 ring-wash-border">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">Stock por tipo</CardTitle>
            <p className="text-[11px] text-wash-text-muted">Distribución del depósito</p>
          </CardHeader>
          <CardContent className="flex items-center gap-3 pt-1">
            <ChartContainer
              config={{ cantidad: { label: 'Cantidad' } }}
              className="aspect-square h-[150px]"
            >
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent nameKey="tipo" />} />
                <Pie
                  data={stockPorTipo}
                  dataKey="cantidad"
                  nameKey="tipo"
                  innerRadius={40}
                  outerRadius={65}
                  paddingAngle={2}
                  stroke="var(--color-wash-surface)"
                  strokeWidth={2}
                >
                  {stockPorTipo.map((_, i) => (
                    <Cell key={i} fill={pieColors[i % pieColors.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="flex flex-1 flex-col gap-1.5 text-[12.5px]">
              {stockPorTipo.map((s, i) => (
                <div key={s.tipo} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded"
                    style={{ background: pieColors[i % pieColors.length] }}
                  />
                  <span className="truncate font-medium text-wash-text-muted">
                    {s.tipo}
                  </span>
                  <span className="ml-auto font-bold text-wash-text-strong tabular-nums">
                    {s.cantidad}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Main focus: Últimas visitas + Órdenes de compra */}
        <Card className="col-span-12 lg:col-span-4 ring-wash-border">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">Últimas visitas</CardTitle>
            <p className="text-[11px] text-wash-text-muted">Actividad reciente del equipo</p>
          </CardHeader>
          <CardContent className="max-h-[460px] space-y-2 overflow-y-auto pt-1">
            {CollectResumen.length === 0 && (
              <div className="rounded-xl border border-dashed border-wash-border py-6 text-center text-xs text-wash-text-muted">
                Sin visitas este mes
              </div>
            )}
            {CollectResumen.map((r) => (
              <VisitaCard
                key={r.ID}
                registro={r}
                onDelete={() => setDeletingRegistro(r)}
              />
            ))}
          </CardContent>
        </Card>

        <Card className="col-span-12 lg:col-span-8 ring-wash-border">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">Órdenes de compra</CardTitle>
            <p className="text-[11px] text-wash-text-muted">
              Items del mes agrupados por estado
            </p>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <OrdenesColumn
                title="Aprobadas"
                emptyText="Aún no se registran órdenes aprobadas"
                tone="emerald"
                items={CollectDetalleCompras.filter((d) => d.Status_DC === 'Aprobada')}
              />
              <OrdenesColumn
                title="Pendientes"
                emptyText="Aún no se registran órdenes pendientes"
                tone="amber"
                items={CollectDetalleCompras.filter((d) => d.Status_DC === 'Pendiente')}
              />
              <OrdenesColumn
                title="Recibidas"
                emptyText="Aún no se registran órdenes recibidas"
                tone="sky"
                items={CollectDetalleCompras.filter((d) => d.Status_DC === 'Recibida')}
              />
            </div>
          </CardContent>
        </Card>
      </div>

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

// ---- KPI ----

interface KpiCardProps {
  icon: typeof Package;
  label: string;
  value: number;
  tone: 'brand' | 'emerald' | 'amber' | 'sky';
}

function KpiCard({ icon: Icon, label, value, tone }: KpiCardProps) {
  const toneClass = {
    brand: 'bg-wash-brand/10 text-wash-brand',
    emerald: 'bg-emerald-500/10 text-emerald-600',
    amber: 'bg-amber-500/10 text-amber-600',
    sky: 'bg-sky-500/10 text-sky-600',
  }[tone];

  return (
    <Card className="col-span-6 lg:col-span-3 ring-wash-border" size="sm">
      <CardContent className="flex items-center gap-3 pt-1">
        <span className={`rounded-lg p-2 ${toneClass}`}>
          <Icon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-medium uppercase tracking-wider text-wash-text-muted">
            {label}
          </p>
          <p className="font-display text-xl font-black text-wash-text-strong tabular-nums">
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Visita card ----

function VisitaCard({
  registro,
  onDelete,
}: {
  registro: Registro;
  onDelete: () => void;
}) {
  const progreso = registro.Progreso ?? (registro.Estado === 'Finalizado' ? 100 : 0);
  const isPendiente = progreso === 0 || (registro.Estado === 'Pendiente' && progreso < 100);

  return (
    <div className="group relative overflow-hidden rounded-xl bg-wash-surface ring-1 ring-wash-border transition-all hover:-translate-y-0.5 hover:shadow-md hover:ring-wash-brand/30">
      {/* Progress accent bar */}
      <div
        className="absolute inset-x-0 top-0 h-[3px] bg-wash-brand/15"
        aria-hidden
      >
        <div
          className="h-full bg-gradient-to-r from-wash-brand-light to-wash-brand transition-all"
          style={{ width: `${progreso}%` }}
        />
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-3.5 pt-3 pb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Building2 size={13} className="shrink-0 text-wash-brand" />
            <span className="truncate font-display text-[14px] font-black text-wash-accent">
              {registro.Edificio}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {isPendiente ? (
            <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 ring-1 ring-amber-500/30">
              Pendiente
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-gradient-to-r from-wash-brand to-wash-brand-dark px-2.5 py-0.5 text-[11px] font-bold text-white shadow-sm shadow-wash-brand/30 tabular-nums">
              {progreso}%
            </span>
          )}
          <button
            type="button"
            onClick={onDelete}
            className="flex h-6 w-6 items-center justify-center rounded-md text-rose-500 ring-1 ring-rose-300/60 transition hover:bg-rose-500/10 hover:ring-rose-400"
            title="Eliminar registro"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {/* Body: stats grid like PowerApp */}
      <div className="space-y-1 px-3.5 pb-3 text-[11px]">
        <div className="grid grid-cols-2 gap-x-3">
          <KV label="Ruta" value={registro.NroRuta_R} />
          <KV label="Circuito" value={registro.NroCircuito_R} />
        </div>
        <KV label="Técnico" value={registro.Usuario} />
        <div className="grid grid-cols-2 gap-x-3">
          <KV label="Hora inicio" value={registro.HoraInicio ?? '—'} />
          <KV label="Hora fin" value={registro.HoraFinal ?? '—'} />
        </div>
      </div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5">
      <dt className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-wash-text-muted">
        {label}:
      </dt>
      <dd className="truncate font-semibold text-wash-text-strong">{value}</dd>
    </div>
  );
}

// ---- Órdenes column ----

type OrdenTone = 'emerald' | 'amber' | 'sky';

const toneStyles: Record<
  OrdenTone,
  {
    header: string;
    countBadge: string;
    stripe: string;
    iconBox: string;
    qty: string;
  }
> = {
  emerald: {
    header: 'text-emerald-700',
    countBadge: 'bg-emerald-500/10 text-emerald-700',
    stripe: 'bg-emerald-400/60',
    iconBox: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20',
    qty: 'bg-emerald-500/12 text-emerald-700 ring-emerald-500/25',
  },
  amber: {
    header: 'text-amber-700',
    countBadge: 'bg-amber-500/10 text-amber-700',
    stripe: 'bg-amber-400/60',
    iconBox: 'bg-amber-500/10 text-amber-600 ring-amber-500/20',
    qty: 'bg-amber-500/12 text-amber-700 ring-amber-500/25',
  },
  sky: {
    header: 'text-sky-700',
    countBadge: 'bg-sky-500/10 text-sky-700',
    stripe: 'bg-wash-brand/50',
    iconBox: 'bg-sky-500/10 text-sky-600 ring-sky-500/20',
    qty: 'bg-wash-brand/12 text-wash-brand-dark ring-wash-brand/25',
  },
};

function OrdenesColumn({
  title,
  emptyText,
  tone,
  items,
}: {
  title: string;
  emptyText: string;
  tone: OrdenTone;
  items: DetalleCompra[];
}) {
  const s = toneStyles[tone];
  return (
    <div className="flex min-h-[340px] flex-col rounded-xl bg-wash-surface-2/40 ring-1 ring-wash-border">
      <div className="flex items-center justify-between border-b border-wash-border px-3 py-2">
        <span className={`text-[11px] font-bold uppercase tracking-wider ${s.header}`}>
          {title}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${s.countBadge}`}>
          {items.length}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-2">
        {items.length === 0 ? (
          <EmptyOrden tone={tone} title={emptyText} />
        ) : (
          [...items]
            .sort((a, b) => b.ID - a.ID)
            .slice(0, 8)
            .map((it) => <OrdenItem key={it.ID} item={it} tone={tone} />)
        )}
      </div>
    </div>
  );
}

function OrdenItem({ item, tone }: { item: DetalleCompra; tone: OrdenTone }) {
  const s = toneStyles[tone];
  const qty = item.CantidadIngresada_DC ?? item.Cantidad_DC;

  return (
    <div className="group relative flex items-center gap-2.5 overflow-hidden rounded-xl bg-wash-surface px-2.5 py-2 ring-1 ring-wash-border transition-all hover:-translate-y-0.5 hover:shadow-md hover:ring-wash-brand/30">
      {/* Colored side stripe */}
      <span
        className={`absolute inset-y-0 left-0 w-1 ${s.stripe}`}
        aria-hidden
      />

      {/* Item icon */}
      <span
        className={`ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ${s.iconBox}`}
      >
        <Package size={15} />
      </span>

      {/* Title + date */}
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-[13px] font-bold leading-tight text-wash-accent">
          {proper(item.Item_DC)}
        </div>
        <div className="mt-0.5 flex items-center gap-1 text-[10px] text-wash-text-muted">
          <CalendarDays size={10} />
          <span className="font-mono tabular-nums">{item.Fecha_DC}</span>
        </div>
      </div>

      {/* Qty badge */}
      <span
        className={`flex h-9 min-w-[36px] shrink-0 items-center justify-center rounded-lg px-2 ring-1 ${s.qty}`}
      >
        <span className="font-display text-base font-black leading-none tabular-nums">
          {qty}
        </span>
      </span>
    </div>
  );
}

function EmptyOrden({ tone, title }: { tone: 'emerald' | 'amber' | 'sky'; title: string }) {
  const styles = {
    emerald: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-600 ring-amber-500/20',
    sky: 'bg-sky-500/10 text-sky-600 ring-sky-500/20',
  }[tone];
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-3 py-10 text-center">
      <div className={`mb-3 flex h-14 w-14 items-center justify-center rounded-2xl ring-1 ${styles}`}>
        <HelpCircle size={28} strokeWidth={1.7} />
      </div>
      <p className="text-sm font-bold text-wash-text-strong">No se registran órdenes</p>
      <p className="mt-1 max-w-[180px] text-[11px] text-wash-text-muted">
        {title}
      </p>
    </div>
  );
}
