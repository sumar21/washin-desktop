import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  Download,
  MessageSquareText,
  Package,
  Scale,
  Search,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { KpiCard } from '@/components/dashboard/widgets';
import { intFmt } from '@/components/dashboard/shared';
import { getDashboardStock, type DashboardStockResponse, type SaldoRepuesto } from '@/services/api';
import { agruparMovimientos, grupoMatchea, filasExcel, type GrupoRepuesto } from '@/screens/dashboard/stockMovimientos';
import { descargarExcel } from '@/lib/excel';
import { cn } from '@/lib/utils';

/**
 * Dashboard · Stock — movimientos de repuestos en un rango de días.
 *
 * Libro mayor: una card por REPUESTO con sus totales y saldos y, debajo, sus entradas
 * (compras) y salidas (OT) en orden cronológico. Buscador y descarga a Excel arriba.
 *
 * No usa `GridPanel` (la grilla plana de los otros tabs) porque una tabla sin agrupar pierde
 * justamente lo que es el punto del reporte. El .xlsx sí sale plano — es lo que espera una
 * tabla dinámica — y comparte el helper de descarga con `GridPanel` (`@/lib/excel`).
 *
 * El rango de fechas lo provee el shell (`Dashboard.tsx`) y el backend ya acota a ese rango,
 * así que acá NO se vuelve a filtrar por fecha — sólo se agrupa, ordena y busca.
 *
 * OJO con la fecha de las entradas: `06.DetalleCompra` no guarda fecha de recepción, así que
 * la columna es la fecha en que se GENERÓ la compra (ver el comentario largo en
 * api/dashboard/stock.ts). La columna se rotula "Fecha compra" a propósito.
 */

export default function DashboardStock({ desde, hasta }: { desde: string; hasta: string }) {
  const [data, setData] = useState<DashboardStockResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [descargando, setDescargando] = useState(false);
  // Repuestos con el detalle plegado. Es sólo estado de pantalla: no filtra nada, así que el
  // Excel sigue saliendo completo aunque estén todos cerrados.
  const [colapsados, setColapsados] = useState<ReadonlySet<string>>(() => new Set());
  const toggleColapso = useCallback((clave: string) => {
    setColapsados((prev) => {
      const next = new Set(prev);
      if (!next.delete(clave)) next.add(clave);
      return next;
    });
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    return getDashboardStock(desde, hasta)
      .then(setData)
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'No se pudo cargar el reporte de stock.'))
      .finally(() => setLoading(false));
  }, [desde, hasta]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- recarga al cambiar el rango; "Reintentar" también dispara load().
    load();
  }, [load]);

  // Referencia estable: sin el memo, el `?? {}` crea un objeto nuevo en cada render.
  const saldos = useMemo(() => data?.saldos ?? {}, [data]);
  // `saldos` suma los repuestos SIN movimientos en el período como grupos vacíos.
  const grupos = useMemo(() => agruparMovimientos(data?.movimientos ?? [], saldos), [data, saldos]);

  // Busca por nombre de repuesto y también por referencia/detalle del movimiento, así se
  // puede rastrear "¿dónde fue a parar lo de la compra X?" o los repuestos de una OT.
  const visibles = useMemo(() => grupos.filter((g) => grupoMatchea(g, q)), [grupos, q]);

  const totales = useMemo(
    () =>
      visibles.reduce(
        (acc, g) => {
          acc.entradas += g.entradas;
          acc.salidas += g.salidas;
          if (g.movimientos.length > 0) acc.conMovimiento += 1;
          return acc;
        },
        { entradas: 0, salidas: 0, conMovimiento: 0 }
      ),
    [visibles]
  );

  // El Excel exporta lo que se ve: respeta el buscador, igual que el de `GridPanel` en los
  // otros tabs. Descargar "todo" cuando la pantalla muestra un subconjunto sorprende.
  const descargar = useCallback(async () => {
    if (descargando) return;
    setDescargando(true);
    try {
      await descargarExcel(filasExcel(visibles, saldos), `stock_movimientos_${tagArchivo(desde, hasta)}`);
    } finally {
      setDescargando(false);
    }
  }, [descargando, visibles, saldos, desde, hasta]);

  return (
    <div className="relative min-h-0 flex-1">
      <LoadingOverlay visible={loading} label="Cargando movimientos…" />

      {loadError ? (
        <div className="h-full overflow-y-auto">
          <ErrorState message={loadError} onRetry={load} />
        </div>
      ) : (
        /* Mismo contenedor de scroll y mismos paddings que los otros tabs del dashboard
           (ver DashboardGeneral): sin esto las cards chocan contra el sidebar. */
        <div className="h-full space-y-4 overflow-y-auto p-4 pb-8 md:p-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              icon={Package}
              label="Repuestos"
              value={intFmt(visibles.length)}
              accent
              sub={<span>{intFmt(totales.conMovimiento)} con movimiento en el período</span>}
            />
            <KpiCard icon={ArrowDownLeft} label="Entradas (compras)" value={intFmt(totales.entradas)} />
            <KpiCard icon={ArrowUpRight} label="Salidas (OT)" value={intFmt(totales.salidas)} />
            <KpiCard
              icon={Scale}
              label="Neto del período"
              value={`${totales.entradas - totales.salidas > 0 ? '+' : ''}${intFmt(totales.entradas - totales.salidas)}`}
            />
          </div>

          {/* Buscador + Excel, con el mismo look que la barra de `GridPanel` en los otros
              tabs para que el módulo se sienta uno solo. */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 basis-full sm:basis-auto sm:flex-1">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-wash-text-faint"
              />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar repuesto, compra u orden de trabajo…"
                className="h-9 w-full rounded-lg border border-wash-border bg-wash-surface pl-9 pr-3 text-sm text-wash-text-strong outline-none placeholder:text-wash-text-faint focus:border-wash-brand focus:ring-2 focus:ring-wash-brand/15"
              />
            </div>
            <span className="shrink-0 text-xs tabular-nums text-wash-text-muted">
              {visibles.length}
              {visibles.length !== grupos.length ? ` / ${grupos.length}` : ''} repuesto
              {visibles.length === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              onClick={descargar}
              disabled={descargando || visibles.length === 0}
              title="Descargar Excel"
              aria-label="Descargar Excel"
              className="ml-auto inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-wash-action px-2.5 text-sm font-medium text-white transition-colors hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50 sm:ml-0 sm:px-3.5"
            >
              <Download size={15} className={cn('shrink-0', descargando && 'animate-pulse')} />
              <span className="hidden sm:inline">{descargando ? 'Generando…' : 'Excel'}</span>
            </button>
          </div>

          {visibles.length === 0 ? (
            <EmptyState
              icon={Package}
              title={q.trim() ? 'Sin resultados para la búsqueda' : 'Sin repuestos para mostrar'}
              description={
                q.trim()
                  ? 'Probá con otro repuesto, número de compra o de orden de trabajo.'
                  : 'No hay repuestos activos en el inventario (04.Stock).'
              }
              tone="neutral"
            />
          ) : (
            <div className="space-y-3">
              {visibles.map((g) => (
                <GrupoCard
                  key={g.clave}
                  grupo={g}
                  saldo={saldos[g.clave]}
                  hasta={hasta}
                  plegado={colapsados.has(g.clave)}
                  onToggle={() => toggleColapso(g.clave)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Detalle en dos líneas: arriba lo que se escanea recorriendo la lista (para una salida,
 * edificio y técnico) y abajo, en chico y con ícono, la anotación de QUÉ se hizo.
 *
 * NO trunca: el texto envuelve y la fila crece. Cortar con "…" obligaba a pasar el mouse por
 * cada fila para leer un dato que es el motivo del movimiento — justo lo que se viene a ver.
 * Por eso tampoco lleva `title`: si se ve entero, el tooltip sólo estorba.
 *
 * `break-words` porque un código de máquina largo sin espacios desbordaría la celda, y el
 * ícono va `items-start` + `mt-0.5` para quedar alineado con la PRIMERA línea de la nota.
 */
function DetalleCelda({ principal, nota, atenuado }: { principal: string; nota: string; atenuado?: boolean }) {
  if (!principal && !nota) return <span className={cn('block', CELDA)}>—</span>;
  return (
    <div className={cn('min-w-0', CELDA)}>
      {principal && (
        <span
          className={cn('block break-words', atenuado ? 'text-wash-text-muted' : 'text-wash-text-strong')}
        >
          {principal}
        </span>
      )}
      {nota && (
        <span className="mt-0.5 flex items-start gap-1 text-[11px] leading-snug text-wash-text-muted">
          <MessageSquareText size={11} className="mt-0.5 shrink-0" />
          <span className="break-words">{nota}</span>
        </span>
      )}
    </div>
  );
}

/** 'dd/mm/yyyy' → 'yyyy-mm-dd' para el nombre del archivo (así ordena solo). */
const tagArchivo = (desde: string, hasta: string) => {
  const iso = (d: string) => d.split('/').reverse().join('-');
  return `${iso(desde)}_${iso(hasta)}`;
};

const CELDA = 'pr-4';

/**
 * Un repuesto: encabezado con sus totales y saldos y, debajo, el detalle cronológico.
 *
 * El encabezado ENTERO es el botón de plegado — es el blanco más grande y obvio, y como
 * `<button>` real entra por teclado y `aria-expanded` le dice a un lector de pantalla si el
 * detalle está abierto. Los chips que viven adentro son `<span>`, así que no hay botones
 * anidados. Plegar es sólo pantalla: no filtra nada y el Excel sigue completo.
 */
function GrupoCard({
  grupo,
  saldo,
  hasta,
  plegado,
  onToggle,
}: {
  grupo: GrupoRepuesto;
  /** Undefined = el repuesto no tiene ficha activa en 04.Stock. */
  saldo?: SaldoRepuesto;
  hasta: string;
  plegado: boolean;
  onToggle: () => void;
}) {
  // Un repuesto sin movimientos en el período no tiene nada que plegar: el encabezado deja de
  // ser botón (no ofrecemos un control que no hace nada) y la card se queda en UNA sola fila.
  const plegable = grupo.movimientos.length > 0;
  const abierto = plegable && !plegado;
  return (
    // `py-0`: el `Card` de shadcn trae `py-4`, y esa franja de padding queda ARRIBA del
    // encabezado — el hover del botón no llegaba al borde redondeado y parecía otro
    // componente. Sin padding vertical el botón llena hasta el borde, y el `overflow-hidden`
    // que el Card ya tiene lo recorta con el radio.
    <Card className={cn('ring-wash-border py-0', !plegable && 'bg-wash-canvas')}>
      <CardContent className="p-0">
        <button
          type="button"
          onClick={onToggle}
          disabled={!plegable}
          aria-expanded={plegable ? abierto : undefined}
          title={plegable ? (plegado ? 'Mostrar movimientos' : 'Ocultar movimientos') : undefined}
          className={cn(
            'flex w-full flex-wrap items-center gap-x-3 gap-y-2 px-4 text-left transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-wash-brand/40',
            // Los quietos son una fila más baja: son contexto, no tienen que pesar lo mismo.
            plegable ? 'py-3 hover:bg-wash-surface-2' : 'cursor-default py-2.5',
            abierto && 'border-b border-wash-divider'
          )}
        >
          <ChevronRight
            size={16}
            className={cn(
              'shrink-0 transition-transform',
              plegable ? 'text-wash-brand' : 'text-transparent',
              abierto && 'rotate-90'
            )}
          />
          <Package className={cn('h-4 w-4 shrink-0', plegable ? 'text-wash-brand' : 'text-wash-text-faint')} />
          <h3
            className={cn(
              'min-w-0 truncate font-display text-sm font-bold',
              plegable ? 'flex-1 text-wash-text-strong' : 'text-wash-text-muted'
            )}
          >
            {grupo.repuesto}
          </h3>

          {/* Sin movimientos: los chips ↙0 ↗0 y "Neto 0" son tres ceros que no dicen nada.
              Va una leyenda en su lugar y queda sólo el saldo, que es el único dato real. */}
          {!plegable && (
            <span className="flex-1 truncate text-xs text-wash-text-faint">Sin movimientos en el período</span>
          )}

          {plegable && (
            <>
              <TotalChip tono="entrada" valor={grupo.entradas} titulo="Entradas en el período" />
              <TotalChip tono="salida" valor={grupo.salidas} titulo="Salidas en el período" />
              <span
                title="Neto del período (entradas − salidas). No es el stock almacenado."
                className={cn(
                  'shrink-0 rounded-md px-2 py-0.5 text-xs font-bold tabular-nums ring-1',
                  grupo.neto < 0
                    ? 'bg-rose-50 text-rose-600 ring-rose-200'
                    : 'bg-wash-surface-2 text-wash-text-strong ring-wash-border'
                )}
              >
                Neto {grupo.neto > 0 ? '+' : ''}
                {intFmt(grupo.neto)}
              </span>
            </>
          )}

          {/* Saldo almacenado. Si el período cierra hoy, "al cierre" y "hoy" son el mismo
              número y mostrar los dos sería ruido: va uno solo. */}
          {saldo ? (
            <>
              {saldo.estimado && (
                <SaldoChip
                  label={`Al ${hasta}`}
                  valor={saldo.cierre}
                  aproximado
                  titulo={
                    `Stock estimado al cierre del período. Se reconstruye desde el saldo de hoy ` +
                    `restando los movimientos posteriores de compras y OT. No contempla entregas ` +
                    `a técnicos ni ajustes manuales, porque esas listas no guardan fecha.`
                  }
                />
              )}
              <SaldoChip
                label="Stock hoy"
                valor={saldo.hoy}
                titulo="Cantidad almacenada hoy según 04.Stock."
              />
            </>
          ) : (
            <span
              title="El repuesto tuvo movimientos pero no tiene una ficha activa en 04.Stock."
              className="shrink-0 rounded-md bg-wash-surface-2 px-2 py-0.5 text-xs font-semibold text-wash-text-muted ring-1 ring-wash-border"
            >
              Sin ficha en stock
            </span>
          )}
        </button>

        {/* Tabla propia (no `DataTable`): son sub-tablas chicas anidadas en cada grupo.
            Scroll horizontal en mobile para no aplastar las columnas. */}
        <div className={cn('overflow-x-auto', !abierto && 'hidden')}>
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">
                <th className="px-4 py-2 text-left font-semibold">Movimiento</th>
                {/* "Fecha compra" y no "Fecha": en las entradas es cuándo se generó la compra,
                    no cuándo ingresó al depósito (06.DetalleCompra no guarda esa fecha). */}
                <th className="px-3 py-2 text-left font-semibold">Fecha compra / asignación</th>
                <th className="px-3 py-2 text-right font-semibold">Cantidad</th>
                <th className="px-3 py-2 text-left font-semibold">Referencia</th>
                <th className="px-4 py-2 text-left font-semibold">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {/* `align-top` en cada fila: el detalle ahora envuelve en varias líneas, y con
                  las demás celdas centradas la fila quedaba desalineada. */}
              {grupo.movimientos.map((m) => (
                <tr
                  key={`${m.tipo}-${m.referencia}-${m.orden}-${m.cantidad}`}
                  className="border-t border-wash-divider align-top"
                >
                  <td className="px-4 py-2">
                    <TipoBadge tipo={m.tipo} />
                  </td>
                  <td className="px-3 py-2 tabular-nums text-wash-text-muted">{m.fecha}</td>
                  <td
                    className={cn(
                      'px-3 py-2 text-right font-semibold tabular-nums',
                      m.tipo === 'entrada' ? 'text-emerald-700' : 'text-rose-600'
                    )}
                  >
                    {m.tipo === 'entrada' ? '+' : '−'}
                    {intFmt(m.cantidad)}
                  </td>
                  <td className="px-3 py-2 text-wash-text-strong">{m.referencia || '—'}</td>
                  <td className="px-4 py-2 align-top">
                    <DetalleCelda principal={m.principal} nota={m.nota} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Chip de saldo almacenado. Va en tono de marca (no verde/rojo): no es un movimiento ni un
 * resultado bueno/malo, es el stock que hay. `aproximado` le antepone "~" al número.
 */
function SaldoChip({
  label,
  valor,
  titulo,
  aproximado,
}: {
  label: string;
  valor: number;
  titulo: string;
  aproximado?: boolean;
}) {
  return (
    <span
      title={titulo}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ring-1',
        aproximado
          ? 'bg-wash-surface-2 text-wash-text-muted ring-wash-border'
          : 'bg-wash-brand/10 text-wash-brand-dark ring-wash-brand/25'
      )}
    >
      <span className="font-normal">{label}</span>
      <span className="font-bold">
        {aproximado ? '~' : ''}
        {intFmt(valor)}
      </span>
    </span>
  );
}

function TotalChip({ tono, valor, titulo }: { tono: 'entrada' | 'salida'; valor: number; titulo: string }) {
  const esEntrada = tono === 'entrada';
  return (
    <span
      title={titulo}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ring-1',
        esEntrada ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-rose-50 text-rose-600 ring-rose-200'
      )}
    >
      {esEntrada ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
      {intFmt(valor)}
    </span>
  );
}

// Sólo los movimientos llevan badge. El resumen NO tiene el suyo a propósito: el color de la
// fila, el chevron y la negrita ya dicen qué es, y una pill "Resumen" sólo repetía eso.
const TIPO_BADGE = {
  entrada: { label: 'Compra', icon: ArrowDownLeft, cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  salida: { label: 'Orden de trabajo', icon: ArrowUpRight, cls: 'bg-rose-50 text-rose-600 ring-rose-200' },
} as const;

function TipoBadge({ tipo }: { tipo: 'entrada' | 'salida' }) {
  const { label, icon: Icon, cls } = TIPO_BADGE[tipo];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1', cls)}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
