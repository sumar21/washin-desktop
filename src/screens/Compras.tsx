import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Eye,
  Pencil,
  Trash2,
  PackageCheck,
  SendHorizonal,
  Plus,
  HelpCircle,
  AlertCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { Modal, ModalActions, ConfirmDialog } from '@/components/Modal';
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
import { useAppStore } from '@/store/useAppStore';
import { EditCompraForm } from '@/components/EditCompraForm';
import { cn, tipoLabel } from '@/lib/utils';
import type { DetalleCompra, PedidoCompra, StockCatalogItem } from '@/types/domain';
import type { ReceiveLine } from '@/services/api';

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
  const [newOpen, setNewOpen] = useState(false);
  const [viewing, setViewing] = useState<PedidoCompra | null>(null);
  const [editing, setEditing] = useState<PedidoCompra | null>(null);
  const [anulando, setAnulando] = useState<PedidoCompra | null>(null);
  const [enviando, setEnviando] = useState<PedidoCompra | null>(null);
  const [recibiendo, setRecibiendo] = useState<PedidoCompra | null>(null);
  const [busy, setBusy] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    return Promise.all([fetchCompras(), fetchCatalog()])
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'No se pudieron cargar las compras.'))
      .finally(() => setLoading(false));
  }, [fetchCompras, fetchCatalog]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial; el botón "Reintentar" también dispara load().
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar.
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return [...pedidos]
      .sort((a, b) => b.ID - a.ID)
      .filter(
        (p) =>
          String(p.ID).includes(q) ||
          p.Fecha_PC.toLowerCase().includes(q) ||
          p.Status_PC.toLowerCase().includes(q) ||
          p.Segmento_PC.toLowerCase().includes(q)
      );
  }, [pedidos, query]);

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
        subtitle="Pedidos de compra del mes"
        search={{ value: query, onChange: setQuery, placeholder: 'Buscar ID, fecha o estado' }}
        onAdd={() => setNewOpen(true)}
        addLabel="Crear compra"
      />
      <LoadingOverlay visible={loading} label="Cargando compras…" />

      {loadError ? (
        <ErrorState message={loadError} onRetry={load} />
      ) : (
        <div className="flex-1 overflow-hidden p-6">
          <DataTable rows={filtered} rowKey={(r) => r.ID} columns={columns} empty="Sin pedidos este mes" />
        </div>
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

// ----- Recibir modal (captura cantidad real + serie/id para máquinas) -----

interface ReceiveRow extends ReceiveLine {
  item: string;
  segmento: string;
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
        nroSerie: '',
        idMaquina: '',
      }))
    );
    setObs('');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reinicia solo al abrir para un pedido distinto.
  }, [pedido]);

  const setRow = (id: number, patch: Partial<ReceiveRow>) =>
    setRows((arr) => arr.map((r) => (r.detalleId === id ? { ...r, ...patch } : r)));

  const canSave = rows.length > 0 && rows.every((r) => r.cantidadReal > 0);

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
                      onClick={() => setRow(r.detalleId, { cantidadReal: Math.max(0, r.cantidadReal - 1) })}
                      className="flex w-8 items-center justify-center text-wash-text-muted hover:bg-wash-surface-2 hover:text-wash-brand"
                      aria-label="Restar uno"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={0}
                      value={r.cantidadReal}
                      onChange={(e) => setRow(r.detalleId, { cantidadReal: Math.max(0, Number(e.target.value) || 0) })}
                      className="w-full min-w-0 flex-1 bg-transparent text-center text-sm font-bold tabular-nums outline-none"
                      aria-label={`Cantidad recibida de ${r.item}`}
                    />
                    <button
                      type="button"
                      onClick={() => setRow(r.detalleId, { cantidadReal: r.cantidadReal + 1 })}
                      className="flex w-8 items-center justify-center text-wash-text-muted hover:bg-wash-surface-2 hover:text-wash-brand"
                      aria-label="Sumar uno"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
              {machine && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={r.nroSerie}
                    onChange={(e) => setRow(r.detalleId, { nroSerie: e.target.value })}
                    placeholder="Nro serie (opcional)"
                    className="h-9 w-full rounded-lg border border-wash-border bg-wash-surface px-3 text-sm outline-none focus:border-wash-brand focus:ring-2 focus:ring-wash-brand/15"
                  />
                  <input
                    type="text"
                    value={r.idMaquina}
                    onChange={(e) => setRow(r.detalleId, { idMaquina: e.target.value })}
                    placeholder="ID máquina (opcional)"
                    className="h-9 w-full rounded-lg border border-wash-border bg-wash-surface px-3 text-sm outline-none focus:border-wash-brand focus:ring-2 focus:ring-wash-brand/15"
                  />
                </div>
              )}
            </div>
          );
        })}
        {rows.length === 0 && (
          <div className="rounded-xl border border-dashed border-wash-border px-3 py-6 text-center text-sm text-wash-text-muted">
            No hay líneas aprobadas para recibir.
          </div>
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
          className="rounded-lg border border-wash-border px-5 py-2.5 font-medium text-wash-text-strong hover:bg-wash-surface-2"
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
                  nroSerie: r.nroSerie?.trim() || undefined,
                  idMaquina: r.idMaquina?.trim() || undefined,
                })),
              });
            } catch (err) {
              setError(err instanceof Error ? err.message : 'No se pudo recibir la mercadería.');
            } finally {
              setSaving(false);
            }
          }}
          className="rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Recibiendo…' : 'Confirmar recepción'}
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
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const itemsForSegment = useMemo(
    () => (segment ? catalog.filter((c) => c.Tipo === segment) : []),
    [catalog, segment]
  );
  // Segmentos "simples" sin catálogo de items (Cargadora/Expendedora/Encendedora): item genérico " - ".
  const segmentHasItems = itemsForSegment.length > 0;

  const reset = () => {
    setSegment('');
    setSelectedCatalogId('');
    setQty('1');
    setObs('');
    setLines([]);
    setEditingIdx(null);
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleAddOrUpdate = () => {
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
    if (editingIdx !== null) {
      setLines((arr) => arr.map((l, i) => (i === editingIdx ? newLine : l)));
      setEditingIdx(null);
    } else {
      setLines((arr) => [...arr, newLine]);
    }
    setSelectedCatalogId('');
    setQty('1');
  };

  const startEdit = (idx: number) => {
    const line = lines[idx];
    setSelectedCatalogId(line.catalogId > 0 ? line.catalogId : '');
    setQty(String(line.qty));
    setEditingIdx(idx);
  };

  const cancelEdit = () => {
    setSelectedCatalogId('');
    setQty('1');
    setEditingIdx(null);
  };

  const removeLine = (idx: number) => {
    setLines((arr) => arr.filter((_, i) => i !== idx));
    if (editingIdx === idx) cancelEdit();
  };

  const canAdd = !!segment && (!segmentHasItems || !!selectedCatalogId) && Number(qty) > 0;
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
            <Select
              value={selectedCatalogId ? String(selectedCatalogId) : undefined}
              onValueChange={(value) => setSelectedCatalogId(value ? Number(value) : '')}
              disabled={!segment || !segmentHasItems}
            >
              <SelectTrigger className="mt-1.5 h-10 w-full">
                <SelectValue
                  placeholder={
                    !segment
                      ? 'Elegí un segmento primero'
                      : segmentHasItems
                        ? 'Seleccionar item…'
                        : 'Sin items (se agrega directo)'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {itemsForSegment.map((c) => (
                  <SelectItem key={c.ID} value={String(c.ID)}>
                    <span className="flex w-full items-center gap-2">
                      {c.Codigo && (
                        <span className="rounded bg-wash-surface-2 px-1.5 py-0.5 text-[10.5px] font-semibold text-wash-text">
                          {c.Codigo}
                        </span>
                      )}
                      <span className="font-medium text-wash-text-strong">{c.Item}</span>
                      {c.Marca && <span className="ml-auto text-xs text-wash-text-muted">{c.Marca}</span>}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            onClick={handleAddOrUpdate}
            disabled={!canAdd}
            title={editingIdx !== null ? 'Actualizar línea' : 'Agregar línea'}
            className={cn(
              'mt-[22px] flex h-[42px] w-[42px] items-center justify-center rounded-lg text-white shadow-sm transition',
              editingIdx !== null ? 'bg-amber-500 hover:bg-amber-600' : 'bg-wash-action hover:bg-wash-action-dark',
              !canAdd && 'cursor-not-allowed opacity-50'
            )}
          >
            {editingIdx !== null ? <Pencil size={16} /> : <Plus size={18} />}
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
              <EmptyComposeList />
            ) : (
              <ul className="space-y-1.5">
                {lines.map((l, idx) => (
                  <li
                    key={idx}
                    className={cn(
                      'flex items-center gap-3 rounded-lg bg-wash-surface px-3 py-2 ring-1 ring-wash-border transition',
                      editingIdx === idx && 'ring-2 ring-amber-400'
                    )}
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
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <ModalActions>
        <button
          type="button"
          onClick={close}
          className="rounded-lg border border-wash-border px-5 py-2.5 font-medium text-wash-text-strong hover:bg-wash-surface-2"
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
          className="rounded-lg bg-wash-action px-5 py-2.5 font-medium text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </ModalActions>
    </Modal>
  );
}

function EmptyComposeList() {
  return (
    <div className="flex flex-col items-center justify-center px-3 py-8 text-center">
      <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-wash-brand/10 text-wash-brand ring-1 ring-wash-brand/20">
        <HelpCircle size={24} strokeWidth={1.7} />
      </div>
      <p className="text-sm font-bold text-wash-text-strong">Sin items agregados</p>
      <p className="mt-0.5 text-[11px] text-wash-text-muted">Aún no se agregó ningún ítem al pedido.</p>
    </div>
  );
}
