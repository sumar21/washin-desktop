import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Eye,
  Pencil,
  Trash2,
  PackageCheck,
  PackageX,
  PackagePlus,
  SendHorizonal,
  Plus,
  AlertCircle,
  X,
  Check,
  Loader2,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { Modal, ModalActions, ConfirmDialog } from '@/components/Modal';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/StatusBadge';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { ErrorState } from '@/components/ErrorState';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { MultiSelect, type MultiOption } from '@/components/ui/multi-select';
import { PopoverClose } from '@/components/ui/popover';
import { useAppStore } from '@/store/useAppStore';
import { EditCompraForm } from '@/components/EditCompraForm';
import { estadoOptions, last12MesesOptions } from '@/lib/filters';
import { cn, tipoLabel } from '@/lib/utils';
import type { DetalleCompra, PedidoCompra, StockCatalogItem } from '@/types/domain';
import type { ReceiveLine } from '@/services/api';

/** Orden canónico de los estados de un pedido de compra (para el filtro). */
const ESTADO_ORDEN_PC = ['Pendiente', 'En Aprobacion', 'Aprobada', 'Recibida', 'Rechazada', 'Anulado'];

/** Estados "archivados": se ocultan por defecto (cuando el filtro de Estado está vacío). */
const ESTADOS_ARCHIVADOS = ['Recibida', 'Anulado', 'Rechazada'];

interface ComposeLine {
  catalogId: number;
  item: string;
  marca?: string;
  codigo?: string;
  qty: number;
}

/** Segmentos que se reciben como "repuesto simple" (no crean máquina; misma regla que el backend). */
const SIMPLE_RECEIVE = new Set(['repuesto', 'cargadora', 'expendedora', 'encendedor', 'encendedora']);
const isMachineSeg = (s: string) => !SIMPLE_RECEIVE.has(s.trim().toLowerCase());

export function Compras() {
  const pedidos = useAppStore((s) => s.CollectCompras);
  const detalles = useAppStore((s) => s.CollectDetalleCompras);
  const catalog = useAppStore((s) => s.CollectStockCatalog);
  const segmentos = useAppStore((s) => s.CollectSegmentos);
  const fetchCompras = useAppStore((s) => s.fetchCompras);
  const fetchCatalog = useAppStore((s) => s.fetchCatalog);
  const createCompra = useAppStore((s) => s.createCompra);
  const editCompra = useAppStore((s) => s.editCompra);
  const mandarAAprobarCompra = useAppStore((s) => s.mandarAAprobarCompra);
  const recibirCompra = useAppStore((s) => s.recibirCompra);
  const anularCompra = useAppStore((s) => s.anularCompra);

  const [query, setQuery] = useState('');
  // Mes/Año: opciones fijas (últimos 12 meses). Viven DENTRO del popover de filtros y
  // disparan el fetch al aplicar. Default: solo el mes actual.
  const mesOpts = useMemo(() => last12MesesOptions(), []);
  // Filtros multi-select: estado/segmento vacío = "todos"; meses default = mes actual.
  const [filterMeses, setFilterMeses] = useState<string[]>(() => [mesOpts[0].value]);
  const [filterEstados, setFilterEstados] = useState<string[]>([]);
  const [filterSegmentos, setFilterSegmentos] = useState<string[]>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [viewing, setViewing] = useState<PedidoCompra | null>(null);
  const [editing, setEditing] = useState<PedidoCompra | null>(null);
  const [anulando, setAnulando] = useState<PedidoCompra | null>(null);
  const [enviando, setEnviando] = useState<PedidoCompra | null>(null);
  const [recibiendo, setRecibiendo] = useState<PedidoCompra | null>(null);
  const [busy, setBusy] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback((meses: string[]) => {
    setLoading(true);
    setLoadError(null);
    return Promise.all([fetchCompras(undefined, meses), fetchCatalog()])
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'No se pudieron cargar las compras.'))
      .finally(() => setLoading(false));
  }, [fetchCompras, fetchCatalog]);

  // Aplica una selección de meses: si viene vacía cae al mes actual. Guarda + refetchea
  // (el backend trae TODOS los estados de esos meses; el filtrado de estado es en cliente).
  const applyMeses = useCallback(
    (meses: string[]) => {
      const effective = meses.length > 0 ? meses : [mesOpts[0].value];
      setFilterMeses(effective);
      load(effective);
    },
    [load, mesOpts]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial; el botón "Reintentar" también dispara load().
    load([mesOpts[0].value]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar.
  }, []);

  // Estado: mostramos SIEMPRE el set canónico (aunque no haya datos cargados) + cualquier
  // valor extra presente en los datos, así el filtro nunca queda en "Sin opciones".
  const estadoOpts = useMemo(
    () => estadoOptions([...ESTADO_ORDEN_PC, ...pedidos.map((p) => p.Status_PC)], ESTADO_ORDEN_PC),
    [pedidos]
  );
  // Segmento: opciones canónicas del catálogo (siempre disponibles) etiquetadas legibles.
  const segmentoOpts = useMemo<MultiOption[]>(
    () => segmentos.map((s) => ({ value: s, label: tipoLabel(s) })),
    [segmentos]
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return [...pedidos]
      .sort((a, b) => b.ID - a.ID)
      .filter((p) => {
        // Con estados tildados: mostramos exactamente esos (incl. archivadas si se pidieron).
        if (filterEstados.length > 0) return filterEstados.includes(p.Status_PC);
        // Sin estados tildados: ocultamos las archivadas (Recibida/Anulado/Rechazada).
        return p.Filtrar_PC !== 'SI' && !ESTADOS_ARCHIVADOS.includes(p.Status_PC);
      })
      .filter((p) => filterSegmentos.length === 0 || filterSegmentos.includes(p.Segmento_PC))
      .filter(
        (p) =>
          String(p.ID).includes(q) ||
          p.Fecha_PC.toLowerCase().includes(q) ||
          p.Status_PC.toLowerCase().includes(q) ||
          p.Segmento_PC.toLowerCase().includes(q)
      );
  }, [pedidos, query, filterEstados, filterSegmentos]);

  const activeFilters = filterMeses.length + filterEstados.length + filterSegmentos.length;

  const detallesDe = (pedido: PedidoCompra): DetalleCompra[] =>
    detalles.filter((d) => d.IDCompra_DC === pedido.IDUnivoco_PC);

  const columns: Column<PedidoCompra>[] = [
    { key: 'id', header: 'ID', width: '90px', render: (r) => <span className="text-xs">#{r.ID}</span> },
    {
      key: 'seg',
      header: 'Segmento',
      width: '170px',
      render: (r) => (
        <span className="rounded-full bg-wash-brand/10 px-2.5 py-0.5 text-xs font-semibold text-wash-brand">
          {tipoLabel(r.Segmento_PC)}
        </span>
      ),
    },
    { key: 'fecha', header: 'Fecha', width: '120px', render: (r) => r.Fecha_PC },
    {
      key: 'cant',
      header: 'Cant.',
      width: '80px',
      align: 'center',
      render: (r) => <span className="font-bold">{r.Cantidad_PC}</span>,
    },
    { key: 'obs', header: 'Observaciones', render: (r) => r.Observaciones_PC ?? '—' },
    {
      key: 'status',
      header: 'Estado',
      width: '160px',
      truncate: false,
      render: (r) => <StatusBadge status={r.Status_PC} />,
    },
    {
      key: 'actions',
      header: 'Acciones',
      width: '200px',
      align: 'right',
      truncate: false,
      render: (r) => (
        <div className="flex items-center justify-end gap-1.5">
          <ActionButton
            icon={Eye}
            tone="neutral"
            title="Ver detalle"
            onClick={(e) => {
              e.stopPropagation();
              setViewing(r);
            }}
          />
          {r.Status_PC === 'Pendiente' && (
            <>
              <ActionButton
                icon={Pencil}
                tone="brand"
                title="Editar"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditing(r);
                }}
              />
              <ActionButton
                icon={SendHorizonal}
                tone="violet"
                title="Mandar a aprobar"
                onClick={(e) => {
                  e.stopPropagation();
                  setEnviando(r);
                }}
              />
              <ActionButton
                icon={Trash2}
                tone="danger"
                title="Anular"
                onClick={(e) => {
                  e.stopPropagation();
                  setAnulando(r);
                }}
              />
            </>
          )}
          {r.Status_PC === 'Aprobada' && (
            <ActionButton
              icon={PackageCheck}
              tone="emerald"
              title="Recibir mercadería"
              onClick={(e) => {
                e.stopPropagation();
                setRecibiendo(r);
              }}
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="relative flex h-full w-full flex-col">
      <PageHeader
        title="Compras"
        subtitle="Pedidos de compra"
        search={{ value: query, onChange: setQuery, placeholder: 'Buscar ID, fecha o estado' }}
        filterPopover={
          <FilterContent
            mesOpts={mesOpts}
            estadoOpts={estadoOpts}
            segmentoOpts={segmentoOpts}
            meses={filterMeses}
            estados={filterEstados}
            segmentos={filterSegmentos}
            onApply={({ meses, estados, segmentos: segs }) => {
              setFilterEstados(estados);
              setFilterSegmentos(segs);
              applyMeses(meses);
            }}
          />
        }
        onAdd={() => setNewOpen(true)}
        addLabel="Crear compra"
      />
      <LoadingOverlay visible={loading} label="Cargando compras…" />

      {loadError ? (
        <ErrorState message={loadError} onRetry={() => load(filterMeses)} />
      ) : (
        <>
        {activeFilters > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-wash-border bg-wash-surface-2/40 px-4 py-2 text-xs text-wash-text-muted md:px-6">
            <span className="font-semibold uppercase tracking-wider">
              Filtro{activeFilters === 1 ? '' : 's'} activo{activeFilters === 1 ? '' : 's'}:
            </span>
            {filterMeses.map((m) => (
              <FilterChip
                key={`m-${m}`}
                label={m}
                onRemove={() => applyMeses(filterMeses.filter((x) => x !== m))}
              />
            ))}
            {filterEstados.map((e) => (
              <FilterChip
                key={`e-${e}`}
                label={e}
                onRemove={() => setFilterEstados((prev) => prev.filter((x) => x !== e))}
              />
            ))}
            {filterSegmentos.map((s) => (
              <FilterChip
                key={`s-${s}`}
                label={tipoLabel(s)}
                onRemove={() => setFilterSegmentos((prev) => prev.filter((x) => x !== s))}
              />
            ))}
            <button
              type="button"
              onClick={() => {
                setFilterEstados([]);
                setFilterSegmentos([]);
                applyMeses([]); // vuelve al mes actual + refetch
              }}
              className="ml-auto text-wash-text-muted hover:text-wash-text-strong"
            >
              Limpiar todo
            </button>
          </div>
        )}
        <div className="flex-1 overflow-hidden p-3 md:p-6">
          <DataTable
            rows={filtered}
            rowKey={(r) => r.ID}
            columns={columns}
            empty={
              <EmptyState
                icon={PackageX}
                title="Sin compras activas"
                description="No hay pedidos para los filtros seleccionados. Probá cambiar el mes o crear una compra nueva."
                action={<Button onClick={() => setNewOpen(true)}>Crear compra</Button>}
              />
            }
            mobileCard={(r) => (
              <div className="rounded-xl border border-wash-border bg-wash-surface p-3 shadow-sm transition active:scale-[0.99]">
                {/* Fila 1: #ID + estado + acciones (mismas que la columna Acciones) */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <span className="font-mono text-[12px] font-bold text-wash-text-strong">#{r.ID}</span>
                    <StatusBadge status={r.Status_PC} />
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <ActionButton
                      icon={Eye}
                      tone="neutral"
                      title="Ver detalle"
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewing(r);
                      }}
                    />
                    {r.Status_PC === 'Pendiente' && (
                      <>
                        <ActionButton
                          icon={Pencil}
                          tone="brand"
                          title="Editar"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditing(r);
                          }}
                        />
                        <ActionButton
                          icon={SendHorizonal}
                          tone="violet"
                          title="Mandar a aprobar"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEnviando(r);
                          }}
                        />
                        <ActionButton
                          icon={Trash2}
                          tone="danger"
                          title="Anular"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAnulando(r);
                          }}
                        />
                      </>
                    )}
                    {r.Status_PC === 'Aprobada' && (
                      <ActionButton
                        icon={PackageCheck}
                        tone="emerald"
                        title="Recibir mercadería"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRecibiendo(r);
                        }}
                      />
                    )}
                  </div>
                </div>
                {/* Fila 2: segmento + fecha */}
                <div className="mt-2 min-w-0">
                  <p className="truncate text-[13.5px] font-semibold text-wash-text-strong">{tipoLabel(r.Segmento_PC)}</p>
                  <p className="mt-0.5 truncate text-[11.5px] text-wash-text-muted">{r.Fecha_PC}</p>
                </div>
                {/* Fila 3: cantidad + observaciones */}
                <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-wash-divider/60 pt-2 text-[11.5px] text-wash-text-muted">
                  <span className="shrink-0">
                    Cant. <span className="font-bold tabular-nums text-wash-text-strong">{r.Cantidad_PC}</span>
                  </span>
                  <span className="min-w-0 flex-1 truncate text-right">{r.Observaciones_PC ?? '—'}</span>
                </div>
              </div>
            )}
          />
        </div>
        </>
      )}

      {/* Nueva compra */}
      <NuevaCompraModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        catalog={catalog}
        segmentos={segmentos}
        onSubmit={async (segment, lines, obs) => {
          await createCompra({
            segmento: segment,
            observaciones: obs,
            lines: lines.map((l) => ({ item: l.item, marca: l.marca, cantidad: l.qty })),
          });
          setNewOpen(false);
        }}
      />

      {/* Ver detalle */}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing ? `Pedido #${viewing.ID} — ${tipoLabel(viewing.Segmento_PC)}` : ''}
        width={640}
      >
        {viewing && (
          <>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <Info label="Fecha" value={viewing.Fecha_PC} />
              <Info label="Estado" value={<StatusBadge status={viewing.Status_PC} />} />
              <Info label="Usuario" value={viewing.User_PC || '—'} />
            </div>
            <div className="mt-4 overflow-hidden rounded-xl border border-wash-border">
              <div className="grid grid-cols-[1fr_90px_120px] border-b border-wash-border bg-wash-canvas px-4 py-2 text-[11px] font-bold uppercase text-wash-text-muted">
                <span>Item</span>
                <span className="text-center">Cant.</span>
                <span className="text-right">Estado</span>
              </div>
              {detallesDe(viewing).map((d) => (
                <div key={d.ID} className="grid grid-cols-[1fr_90px_120px] items-center px-4 py-2 text-sm">
                  <span className="min-w-0 truncate font-medium">{d.Item_DC}</span>
                  <span className="text-center font-bold text-wash-text-strong">{d.Cantidad_DC}</span>
                  <span className="text-right">
                    <StatusBadge status={d.Status_DC} />
                  </span>
                </div>
              ))}
            </div>
            {viewing.Observaciones_PC && (
              <div className="mt-3 rounded-lg bg-wash-canvas p-3 text-sm text-wash-text">{viewing.Observaciones_PC}</div>
            )}
          </>
        )}
      </Modal>

      {/* Editar pedido */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Editar pedido #${editing.ID}` : ''}
        width={760}
      >
        {editing && (
          <EditCompraForm
            pedido={editing}
            initialDetalles={detallesDe(editing)}
            catalog={catalog}
            onCancel={() => setEditing(null)}
            onSave={async ({ obs, lines, removedIds }) => {
              const target = editing;
              await editCompra(target.ID, {
                observaciones: obs,
                updates: lines.filter((l) => l.id).map((l) => ({ detalleId: l.id!, cantidad: l.qty })),
                adds: lines
                  .filter((l) => !l.id)
                  .map((l) => ({ item: l.item, marca: l.marca, cantidad: l.qty })),
                removes: removedIds,
              });
              setEditing(null);
            }}
          />
        )}
      </Modal>

      {/* Recibir mercadería (ingreso a stock) */}
      <RecibirModal
        pedido={recibiendo}
        detalles={recibiendo ? detallesDe(recibiendo).filter((d) => d.Status_DC === 'Aprobada') : []}
        onClose={() => setRecibiendo(null)}
        onConfirm={async (payload) => {
          if (!recibiendo) return;
          await recibirCompra(recibiendo.ID, payload);
          setRecibiendo(null);
        }}
      />

      {/* Mandar a aprobar */}
      <ConfirmDialog
        open={!!enviando}
        title="Mandar a aprobar"
        message={
          enviando
            ? `Se enviará el pedido #${enviando.ID} a la bandeja de aprobaciones. ¿Confirmás?`
            : ''
        }
        confirmLabel={busy ? 'Enviando…' : 'Mandar a aprobar'}
        busy={busy}
        onCancel={() => setEnviando(null)}
        onConfirm={async () => {
          if (!enviando || busy) return;
          setBusy(true);
          try {
            await mandarAAprobarCompra(enviando.ID);
            setEnviando(null);
          } finally {
            setBusy(false);
          }
        }}
      />

      {/* Anular */}
      <ConfirmDialog
        open={!!anulando}
        tone="danger"
        title="Anular pedido"
        message={anulando ? `¿Anular el pedido #${anulando.ID}? Esta acción no se puede deshacer.` : ''}
        confirmLabel={busy ? 'Anulando…' : 'Anular'}
        busy={busy}
        onCancel={() => setAnulando(null)}
        onConfirm={async () => {
          if (!anulando || busy) return;
          setBusy(true);
          try {
            await anularCompra(anulando.ID);
            setAnulando(null);
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

// -------- Subcomponents --------

function ActionButton({
  icon: Icon,
  tone,
  title,
  onClick,
}: {
  icon: typeof Eye;
  tone: 'neutral' | 'brand' | 'violet' | 'emerald' | 'danger';
  title: string;
  onClick: (e: React.MouseEvent) => void;
}) {
  const cls = {
    neutral:
      'text-wash-text-muted ring-wash-border hover:bg-wash-surface-2 hover:text-wash-text-strong hover:ring-wash-text-muted/40',
    brand: 'text-wash-brand ring-wash-brand/30 hover:bg-wash-brand/10 hover:ring-wash-brand',
    violet: 'text-violet-600 ring-violet-500/30 hover:bg-violet-500/10 hover:ring-violet-500',
    emerald: 'text-emerald-600 ring-emerald-500/30 hover:bg-emerald-500/10 hover:ring-emerald-500',
    danger: 'text-rose-600 ring-rose-500/30 hover:bg-rose-500/10 hover:ring-rose-500',
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn('flex h-8 w-8 items-center justify-center rounded-lg ring-1 transition', cls)}
    >
      <Icon size={15} />
    </button>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-wash-text-muted">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-wash-text-strong">{value}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-medium uppercase tracking-wider text-wash-text-muted">{children}</label>
  );
}

// ----- Filtro (popover) -----

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-wash-brand/10 px-2.5 py-0.5 font-semibold text-wash-brand">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="-mr-1 flex h-4 w-4 items-center justify-center rounded-full hover:bg-wash-brand/20"
        title={`Quitar ${label}`}
        aria-label={`Quitar filtro ${label}`}
      >
        <X size={10} strokeWidth={2.5} />
      </button>
    </span>
  );
}

function FilterContent({
  mesOpts,
  estadoOpts,
  segmentoOpts,
  meses,
  estados,
  segmentos,
  onApply,
}: {
  mesOpts: MultiOption[];
  estadoOpts: MultiOption[];
  segmentoOpts: MultiOption[];
  meses: string[];
  estados: string[];
  segmentos: string[];
  onApply: (next: { meses: string[]; estados: string[]; segmentos: string[] }) => void;
}) {
  const [pendingMeses, setPendingMeses] = useState<string[]>(meses);
  const [pendingEstados, setPendingEstados] = useState<string[]>(estados);
  const [pendingSegmentos, setPendingSegmentos] = useState<string[]>(segmentos);

  const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((v) => b.includes(v));
  const dirty =
    !sameSet(pendingMeses, meses) ||
    !sameSet(pendingEstados, estados) ||
    !sameSet(pendingSegmentos, segmentos);
  const anySelected = pendingMeses.length > 0 || pendingEstados.length > 0 || pendingSegmentos.length > 0;

  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (v: string) =>
    setter((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between border-b border-wash-border pb-2.5">
        <h3 className="text-sm font-bold text-wash-text-strong">Filtrar</h3>
        {anySelected && (
          <button
            type="button"
            onClick={() => {
              setPendingMeses([]);
              setPendingEstados([]);
              setPendingSegmentos([]);
            }}
            className="text-[11px] font-semibold text-wash-text-muted hover:text-wash-text-strong"
          >
            Limpiar
          </button>
        )}
      </div>

      <div className="space-y-2">
        <MultiSelect
          label="Mes/Año"
          options={mesOpts}
          selected={pendingMeses}
          onToggle={toggle(setPendingMeses)}
          onClear={() => setPendingMeses([])}
          searchable={false}
          placeholder="Mes actual"
        />
        <MultiSelect
          label="Estado"
          options={estadoOpts}
          selected={pendingEstados}
          onToggle={toggle(setPendingEstados)}
          onClear={() => setPendingEstados([])}
        />
        <MultiSelect
          label="Segmento"
          options={segmentoOpts}
          selected={pendingSegmentos}
          onToggle={toggle(setPendingSegmentos)}
          onClear={() => setPendingSegmentos([])}
          searchable={segmentoOpts.length > 8}
        />
      </div>

      <div className="mt-4 flex justify-end gap-2 border-t border-wash-border pt-3">
        <PopoverClose asChild>
          <button
            type="button"
            className="rounded-lg border border-wash-border px-4 py-2 text-[12.5px] font-medium text-wash-text-strong hover:bg-wash-surface-2"
          >
            Cancelar
          </button>
        </PopoverClose>
        <PopoverClose asChild>
          <button
            type="button"
            disabled={!dirty}
            onClick={() => onApply({ meses: pendingMeses, estados: pendingEstados, segmentos: pendingSegmentos })}
            className="rounded-lg bg-wash-action px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            Aplicar
          </button>
        </PopoverClose>
      </div>
    </div>
  );
}

// ----- Recibir modal (captura cantidad real + serie/id para máquinas) -----

interface ReceiveUnidad {
  nroSerie: string;
  idMaquina: string;
}

interface ReceiveRow extends ReceiveLine {
  item: string;
  segmento: string;
  /** Para máquinas: una serie+ID por unidad (largo === cantidadReal). Vacío en repuestos/simples. */
  unidades: ReceiveUnidad[];
}

/** Ajusta el array de unidades al largo `n` conservando lo ya cargado. */
function resizeUnidades(current: ReceiveUnidad[], n: number): ReceiveUnidad[] {
  const next = current.slice(0, n);
  while (next.length < n) next.push({ nroSerie: '', idMaquina: '' });
  return next;
}

function RecibirModal({
  pedido,
  detalles,
  onClose,
  onConfirm,
}: {
  pedido: PedidoCompra | null;
  detalles: DetalleCompra[];
  onClose: () => void;
  onConfirm: (payload: { observacion?: string; lines: ReceiveLine[] }) => Promise<void>;
}) {
  const [rows, setRows] = useState<ReceiveRow[]>([]);
  const [obs, setObs] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pedido) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- inicializa el form al abrir para un pedido nuevo.
    setRows(
      detalles.map((d) => ({
        detalleId: d.ID,
        cantidadReal: d.Cantidad_DC,
        item: d.Item_DC,
        segmento: d.Segmento_DC,
        unidades: isMachineSeg(d.Segmento_DC) ? resizeUnidades([], d.Cantidad_DC) : [],
      }))
    );
    setObs('');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reinicia solo al abrir para un pedido distinto.
  }, [pedido]);

  // Cambia la cantidad recibida y, para máquinas, redimensiona las unidades (serie/ID por unidad).
  const setCantidad = (id: number, next: number) =>
    setRows((arr) =>
      arr.map((r) => {
        if (r.detalleId !== id) return r;
        const cantidadReal = Math.max(0, next);
        return {
          ...r,
          cantidadReal,
          unidades: isMachineSeg(r.segmento) ? resizeUnidades(r.unidades, cantidadReal) : [],
        };
      })
    );

  const setUnidad = (id: number, idx: number, patch: Partial<ReceiveUnidad>) =>
    setRows((arr) =>
      arr.map((r) =>
        r.detalleId === id
          ? { ...r, unidades: r.unidades.map((u, i) => (i === idx ? { ...u, ...patch } : u)) }
          : r
      )
    );

  // Cada línea de máquina exige serie + ID (ambos no vacíos) para TODAS sus unidades.
  const canSave =
    rows.length > 0 &&
    rows.every(
      (r) =>
        r.cantidadReal > 0 &&
        (!isMachineSeg(r.segmento) ||
          (r.unidades.length === r.cantidadReal &&
            r.unidades.every((u) => u.nroSerie.trim() && u.idMaquina.trim())))
    );

  return (
    <Modal
      open={!!pedido}
      onClose={onClose}
      title={pedido ? `Recibir mercadería — Pedido #${pedido.ID}` : ''}
      width={720}
    >
      {error && (
        <div
          role="alert"
          className="mb-3 flex items-center gap-2 rounded-r-md border-l-4 border-red-500 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700"
        >
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      <p className="mb-3 text-xs text-wash-text-muted">
        Confirmá la cantidad realmente recibida por ítem. El stock se incrementa con estos valores.
      </p>

      <div className="space-y-2">
        {rows.map((r) => {
          const machine = isMachineSeg(r.segmento);
          return (
            <div key={r.detalleId} className="rounded-xl border border-wash-border bg-wash-surface-2/30 p-3">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-wash-text-strong">{r.item}</p>
                  <p className="text-[11px] text-wash-text-muted">{tipoLabel(r.segmento)}</p>
                </div>
                <div>
                  <Label>Cant. recibida</Label>
                  <div className="mt-1 flex h-9 w-[120px] items-stretch overflow-hidden rounded-lg border border-wash-border bg-wash-surface focus-within:border-wash-brand focus-within:ring-2 focus-within:ring-wash-brand/15">
                    <button
                      type="button"
                      onClick={() => setCantidad(r.detalleId, r.cantidadReal - 1)}
                      className="flex w-8 items-center justify-center text-wash-text-muted hover:bg-wash-surface-2 hover:text-wash-brand"
                      aria-label="Restar uno"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={0}
                      value={r.cantidadReal}
                      onChange={(e) => setCantidad(r.detalleId, Number(e.target.value) || 0)}
                      className="w-full min-w-0 flex-1 bg-transparent text-center text-sm font-bold tabular-nums outline-none"
                      aria-label={`Cantidad recibida de ${r.item}`}
                    />
                    <button
                      type="button"
                      onClick={() => setCantidad(r.detalleId, r.cantidadReal + 1)}
                      className="flex w-8 items-center justify-center text-wash-text-muted hover:bg-wash-surface-2 hover:text-wash-brand"
                      aria-label="Sumar uno"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
              {machine && r.cantidadReal > 0 && (
                <div className="mt-3 space-y-2 border-t border-wash-divider/60 pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">
                    Serie e ID por unidad ({r.unidades.length}) — obligatorio
                  </p>
                  {r.unidades.map((u, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="flex h-9 w-7 shrink-0 items-center justify-center rounded-md bg-wash-action/10 text-[11px] font-bold text-wash-action tabular-nums">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        value={u.nroSerie}
                        onChange={(e) => setUnidad(r.detalleId, idx, { nroSerie: e.target.value })}
                        placeholder="Nº de serie"
                        aria-label={`Nº de serie de la unidad ${idx + 1} de ${r.item}`}
                        className="h-9 w-full flex-1 rounded-lg border border-wash-border bg-wash-surface px-3 text-sm outline-none focus:border-wash-brand focus:ring-2 focus:ring-wash-brand/15"
                      />
                      <input
                        type="text"
                        value={u.idMaquina}
                        onChange={(e) => setUnidad(r.detalleId, idx, { idMaquina: e.target.value })}
                        placeholder="ID de máquina"
                        aria-label={`ID de máquina de la unidad ${idx + 1} de ${r.item}`}
                        className="h-9 w-full flex-1 rounded-lg border border-wash-border bg-wash-surface px-3 text-sm outline-none focus:border-wash-brand focus:ring-2 focus:ring-wash-brand/15"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {rows.length === 0 && (
          <EmptyState
            compact
            icon={PackageCheck}
            title="Nada para recibir"
            description="Este pedido no tiene líneas en estado Aprobada."
          />
        )}
      </div>

      <div className="mt-4">
        <Label>Observaciones de recepción</Label>
        <textarea
          rows={2}
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          placeholder="Aclaraciones de la recepción (opcional)…"
          className="mt-1.5 w-full resize-none rounded-lg border border-wash-border bg-wash-surface px-3 py-2 text-sm outline-none focus:border-wash-brand focus:ring-2 focus:ring-wash-brand/15"
        />
      </div>

      <ModalActions>
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="rounded-lg border border-wash-border px-5 py-2.5 font-medium text-wash-text-strong hover:bg-wash-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!canSave || saving}
          onClick={async () => {
            setSaving(true);
            setError(null);
            try {
              await onConfirm({
                observacion: obs.trim() || undefined,
                lines: rows.map((r) => ({
                  detalleId: r.detalleId,
                  cantidadReal: r.cantidadReal,
                  unidades: isMachineSeg(r.segmento)
                    ? r.unidades.map((u) => ({ nroSerie: u.nroSerie.trim(), idMaquina: u.idMaquina.trim() }))
                    : undefined,
                })),
              });
            } catch (err) {
              setError(err instanceof Error ? err.message : 'No se pudo recibir la mercadería.');
            } finally {
              setSaving(false);
            }
          }}
          className="flex items-center rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Recibiendo…
            </>
          ) : (
            'Confirmar recepción'
          )}
        </button>
      </ModalActions>
    </Modal>
  );
}

// ----- Nueva compra modal -----

interface NuevaCompraModalProps {
  open: boolean;
  onClose: () => void;
  catalog: StockCatalogItem[];
  segmentos: string[];
  onSubmit: (segment: string, lines: ComposeLine[], obs: string) => Promise<void>;
}

function NuevaCompraModal({ open, onClose, catalog, segmentos, onSubmit }: NuevaCompraModalProps) {
  const [segment, setSegment] = useState<string>('');
  const [selectedCatalogId, setSelectedCatalogId] = useState<number | ''>('');
  const [qty, setQty] = useState('1');
  const [obs, setObs] = useState('');
  const [lines, setLines] = useState<ComposeLine[]>([]);
  // Edición inline sobre la fila (no en el form de arriba): índice + borradores de la fila.
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [rowItemId, setRowItemId] = useState<number | ''>('');
  const [rowQty, setRowQty] = useState('1');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const itemsForSegment = useMemo(
    () => (segment ? catalog.filter((c) => c.Tipo === segment) : []),
    [catalog, segment]
  );
  // Segmentos "simples" sin catálogo de items (Cargadora/Expendedora/Encendedora): item genérico " - ".
  const segmentHasItems = itemsForSegment.length > 0;

  // Opciones para el Combobox de item (lista grande, buscable). Bindea por ID único.
  const itemOptions = useMemo<ComboboxOption[]>(
    () =>
      itemsForSegment.map((c) => ({
        value: String(c.ID),
        label: c.Item,
        sublabel: [c.Codigo, c.Marca].filter(Boolean).join(' · ') || undefined,
      })),
    [itemsForSegment]
  );

  const reset = () => {
    setSegment('');
    setSelectedCatalogId('');
    setQty('1');
    setObs('');
    setLines([]);
    setEditingIdx(null);
    setRowItemId('');
    setRowQty('1');
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleAdd = () => {
    if (!segment || Number(qty) <= 0) return;
    let newLine: ComposeLine;
    if (segmentHasItems) {
      if (!selectedCatalogId) return;
      const cat = catalog.find((c) => c.ID === selectedCatalogId);
      if (!cat) return;
      newLine = { catalogId: cat.ID, item: cat.Item, marca: cat.Marca, codigo: cat.Codigo, qty: Number(qty) };
    } else {
      // Segmento sin items: una sola línea con item placeholder " - ".
      newLine = { catalogId: -1, item: ' - ', qty: Number(qty) };
    }
    setLines((arr) => [...arr, newLine]);
    setSelectedCatalogId('');
    setQty('1');
  };

  // --- Edición inline de una fila ya agregada ---
  const startEdit = (idx: number) => {
    const line = lines[idx];
    setRowItemId(line.catalogId > 0 ? line.catalogId : '');
    setRowQty(String(line.qty));
    setEditingIdx(idx);
  };

  const cancelEdit = () => {
    setEditingIdx(null);
    setRowItemId('');
    setRowQty('1');
  };

  const saveEdit = () => {
    if (editingIdx === null || Number(rowQty) <= 0) return;
    let updated: ComposeLine;
    if (segmentHasItems) {
      if (!rowItemId) return;
      const cat = catalog.find((c) => c.ID === rowItemId);
      if (!cat) return;
      updated = { catalogId: cat.ID, item: cat.Item, marca: cat.Marca, codigo: cat.Codigo, qty: Number(rowQty) };
    } else {
      updated = { catalogId: -1, item: ' - ', qty: Number(rowQty) };
    }
    setLines((arr) => arr.map((l, i) => (i === editingIdx ? updated : l)));
    cancelEdit();
  };

  const removeLine = (idx: number) => {
    setLines((arr) => arr.filter((_, i) => i !== idx));
    if (editingIdx === idx) cancelEdit();
  };

  const canAdd = !!segment && (!segmentHasItems || !!selectedCatalogId) && Number(qty) > 0;
  const canSaveRow = Number(rowQty) > 0 && (!segmentHasItems || !!rowItemId);
  const canSubmit = !!segment && lines.length > 0;

  return (
    <Modal open={open} onClose={close} title="Nueva compra" width={720}>
      <div className="space-y-4">
        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-r-md border-l-4 border-red-500 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700"
          >
            <AlertCircle size={14} className="shrink-0" />
            {error}
          </div>
        )}
        {/* Row: Segmento | Item | Cantidad | + */}
        <div className="grid grid-cols-[1fr_1.6fr_90px_auto] items-end gap-3">
          <div>
            <Label>Segmento</Label>
            <Select
              value={segment || undefined}
              onValueChange={(value) => {
                setSegment(value);
                setSelectedCatalogId('');
                setLines([]);
                setEditingIdx(null);
              }}
            >
              <SelectTrigger className="mt-1.5 h-10 w-full">
                <SelectValue placeholder="Seleccionar segmento…" />
              </SelectTrigger>
              <SelectContent>
                {segmentos.map((s) => (
                  <SelectItem key={s} value={s}>
                    {tipoLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Item</Label>
            <div className="mt-1.5">
              <Combobox
                options={itemOptions}
                value={selectedCatalogId ? String(selectedCatalogId) : null}
                onChange={(value) => setSelectedCatalogId(value ? Number(value) : '')}
                disabled={!segment || !segmentHasItems}
                placeholder={
                  !segment
                    ? 'Elegí un segmento primero'
                    : segmentHasItems
                      ? 'Seleccionar item…'
                      : 'Sin items (se agrega directo)'
                }
                searchPlaceholder="Buscar item o código…"
                emptyText="Sin items para este segmento"
              />
            </div>
          </div>

          <div>
            <Label>Cantidad</Label>
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-wash-border bg-wash-surface px-3 py-2 text-center text-sm font-bold tabular-nums outline-none focus:border-wash-brand focus:ring-2 focus:ring-wash-brand/15"
            />
          </div>

          <button
            type="button"
            onClick={handleAdd}
            disabled={!canAdd}
            title="Agregar línea"
            className={cn(
              'mt-[22px] flex h-[42px] w-[42px] items-center justify-center rounded-lg bg-wash-action text-white shadow-sm transition hover:bg-wash-action-dark',
              !canAdd && 'cursor-not-allowed opacity-50'
            )}
          >
            <Plus size={18} />
          </button>
        </div>

        {/* Observaciones */}
        <div>
          <Label>Observaciones</Label>
          <textarea
            rows={3}
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Detalles adicionales del pedido (opcional)…"
            className="mt-1.5 w-full rounded-lg border border-wash-border bg-wash-surface px-3 py-2 text-sm outline-none focus:border-wash-brand focus:ring-2 focus:ring-wash-brand/15"
          />
        </div>

        {/* Items agregados */}
        <div>
          <Label>Items agregados</Label>
          <div className="mt-1.5 rounded-xl border border-wash-border bg-wash-surface-2/40 p-2">
            {lines.length === 0 ? (
              <EmptyState
                compact
                pulse
                icon={PackagePlus}
                title="Sin items agregados"
                description={
                  <>
                    Agregá items con el botón <strong>+</strong>.
                  </>
                }
              />
            ) : (
              <ul className="space-y-1.5">
                {lines.map((l, idx) =>
                  editingIdx === idx ? (
                    // Editor INLINE sobre la propia fila (no en el form de arriba).
                    <li
                      key={idx}
                      className="flex flex-wrap items-end gap-2 rounded-lg bg-wash-surface px-3 py-2.5 ring-2 ring-amber-400"
                    >
                      {segmentHasItems && (
                        <div className="min-w-[200px] flex-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-wash-text-muted">Item</span>
                          <div className="mt-1">
                            <Combobox
                              options={itemOptions}
                              value={rowItemId ? String(rowItemId) : null}
                              onChange={(value) => setRowItemId(value ? Number(value) : '')}
                              placeholder="Seleccionar item…"
                              searchPlaceholder="Buscar item o código…"
                              emptyText="Sin items"
                            />
                          </div>
                        </div>
                      )}
                      <div className="w-[84px]">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-wash-text-muted">Cant.</span>
                        <input
                          type="number"
                          min={1}
                          value={rowQty}
                          onChange={(e) => setRowQty(e.target.value)}
                          className="mt-1 h-10 w-full rounded-lg border border-wash-border bg-wash-surface px-2 text-center text-sm font-bold tabular-nums outline-none focus:border-wash-brand focus:ring-2 focus:ring-wash-brand/15"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={saveEdit}
                        disabled={!canSaveRow}
                        title="Guardar cambios"
                        aria-label="Guardar cambios de la línea"
                        className="flex h-10 w-9 items-center justify-center rounded-md bg-wash-action text-white transition hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        title="Cancelar"
                        aria-label="Cancelar edición"
                        className="flex h-10 w-9 items-center justify-center rounded-md text-wash-text-muted ring-1 ring-wash-border transition hover:bg-wash-surface-2"
                      >
                        <X size={16} />
                      </button>
                    </li>
                  ) : (
                    <li
                      key={idx}
                      className="flex items-center gap-3 rounded-lg bg-wash-surface px-3 py-2 ring-1 ring-wash-border transition"
                    >
                      <span className="flex h-8 min-w-[34px] items-center justify-center rounded-md bg-wash-action px-2 text-sm font-bold text-white shadow-sm tabular-nums">
                        {l.qty}
                      </span>
                      <div className="min-w-0 flex-1 truncate text-[13px] font-semibold text-wash-text-strong">
                        {l.item}
                        {l.marca ? <span className="ml-2 text-[11px] font-normal text-wash-text-muted">{l.marca}</span> : ''}
                      </div>
                      <button
                        type="button"
                        onClick={() => startEdit(idx)}
                        title="Editar"
                        aria-label="Editar línea"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-wash-text-muted ring-1 ring-wash-border transition hover:bg-amber-500/10 hover:text-amber-600 hover:ring-amber-500"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        title="Eliminar"
                        aria-label="Eliminar línea"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-rose-600 ring-1 ring-rose-500/30 transition hover:bg-rose-500/10 hover:ring-rose-500"
                      >
                        <Trash2 size={13} />
                      </button>
                    </li>
                  )
                )}
              </ul>
            )}
          </div>
        </div>
      </div>

      <ModalActions>
        <button
          type="button"
          onClick={close}
          disabled={saving}
          className="rounded-lg border border-wash-border px-5 py-2.5 font-medium text-wash-text-strong hover:bg-wash-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!canSubmit || saving}
          onClick={async () => {
            if (!canSubmit || !segment) return;
            setSaving(true);
            setError(null);
            try {
              await onSubmit(segment, lines, obs);
              reset();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'No se pudo crear la compra.');
            } finally {
              setSaving(false);
            }
          }}
          className="flex items-center rounded-lg bg-wash-action px-5 py-2.5 font-medium text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Creando…
            </>
          ) : (
            'Guardar'
          )}
        </button>
      </ModalActions>
    </Modal>
  );
}
