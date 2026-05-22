import { useMemo, useState } from 'react';
import {
  Eye,
  Pencil,
  Trash2,
  PackageCheck,
  Plus,
  HelpCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { Modal, ModalActions, ConfirmDialog } from '@/components/Modal';
import { StatusBadge } from '@/components/StatusBadge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppStore } from '@/store/useAppStore';
import { cn, currentMonthYear, formatToday, tipoLabel } from '@/lib/utils';
import type {
  DetalleCompra,
  PedidoCompra,
  StockCatalogItem,
  TipoStock,
} from '@/types/domain';

const SEGMENTS: TipoStock[] = [
  'LAVADORA',
  'SECADORA SIMPLE',
  'SECADORA DOBLE',
  'CARGADORA',
  'EXPENDEDORA',
  'ENCENDEDORA',
  'REPUESTO',
];

interface ComposeLine {
  catalogId: number;
  item: string;
  marca?: string;
  codigo?: string;
  qty: number;
}

export function Compras() {
  const pedidos = useAppStore((s) => s.CollectCompras);
  const detalles = useAppStore((s) => s.CollectDetalleCompras);
  const catalog = useAppStore((s) => s.CollectStockCatalog);
  const patchCompra = useAppStore((s) => s.patchCompra);
  const patchDetalleCompra = useAppStore((s) => s.patchDetalleCompra);
  const addCompra = useAppStore((s) => s.addCompra);
  const VarUsuario = useAppStore((s) => s.VarUsuario) ?? 'usr';

  const [query, setQuery] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [viewing, setViewing] = useState<PedidoCompra | null>(null);
  const [editing, setEditing] = useState<PedidoCompra | null>(null);
  const [deleting, setDeleting] = useState<PedidoCompra | null>(null);
  const [receiving, setReceiving] = useState<PedidoCompra | null>(null);

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

  const submitNew = (segment: TipoStock, lines: ComposeLine[], obs: string) => {
    if (lines.length === 0) return;
    const totalQty = lines.reduce((s, l) => s + l.qty, 0);
    const idUnivoco = `${VarUsuario.slice(0, 3)} - ${Date.now()}`;
    addCompra(
      {
        IDUnivoco_PC: idUnivoco,
        Fecha_PC: formatToday(),
        FechaMesAno_PC: currentMonthYear(),
        Segmento_PC: segment,
        Cantidad_PC: totalQty,
        Status_PC: 'Pendiente',
        Filtrar_PC: 'NO',
        Observaciones_PC: obs,
        User_PC: VarUsuario,
      },
      lines.map((l) => ({
        IDCompra_DC: idUnivoco,
        Item_DC: l.item,
        Cantidad_DC: l.qty,
        FechaMesAno_DC: currentMonthYear(),
        Fecha_DC: formatToday(),
        Segmento_DC: segment,
        Status_DC: 'Pendiente',
        Codigo_DC: l.codigo,
        Marca_DC: l.marca,
      }))
    );
    setNewOpen(false);
  };

  const columns: Column<PedidoCompra>[] = [
    {
      key: 'id',
      header: 'ID',
      width: '90px',
      render: (r) => <span className="text-xs">#{r.ID}</span>,
    },
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
      width: '170px',
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
            <ActionButton
              icon={Pencil}
              tone="brand"
              title="Editar"
              onClick={(e) => {
                e.stopPropagation();
                setEditing(r);
              }}
            />
          )}
          {r.Status_PC === 'Aprobada' && (
            <ActionButton
              icon={PackageCheck}
              tone="emerald"
              title="Recibir mercadería"
              onClick={(e) => {
                e.stopPropagation();
                setReceiving(r);
              }}
            />
          )}
          {(r.Status_PC === 'Pendiente' || r.Status_PC === 'Rechazada') && (
            <ActionButton
              icon={Trash2}
              tone="danger"
              title="Eliminar"
              onClick={(e) => {
                e.stopPropagation();
                setDeleting(r);
              }}
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex h-full w-full flex-col">
      <PageHeader
        title="Compras"
        subtitle="Pedidos de compra del mes"
        search={{ value: query, onChange: setQuery, placeholder: 'Buscar ID, fecha o estado' }}
        onAdd={() => setNewOpen(true)}
        addLabel="Crear compra"
      />

      <div className="flex-1 overflow-hidden p-6">
        <DataTable
          rows={filtered}
          rowKey={(r) => r.ID}
          columns={columns}
          empty="Sin pedidos este mes"
        />
      </div>

      {/* Nueva compra */}
      <NuevaCompraModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        catalog={catalog}
        onSubmit={submitNew}
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
              <Info label="Usuario" value={viewing.User_PC} />
            </div>
            <div className="mt-4 rounded-xl border border-wash-border">
              <div className="grid grid-cols-[1fr_90px_120px] border-b border-wash-border bg-wash-canvas px-4 py-2 text-[11px] font-bold uppercase text-wash-text-muted">
                <span>Item</span>
                <span className="text-center">Cant.</span>
                <span className="text-right">Estado</span>
              </div>
              {detallesDe(viewing).map((d) => (
                <div
                  key={d.ID}
                  className="grid grid-cols-[1fr_90px_120px] items-center px-4 py-2 text-sm"
                >
                  <span className="font-medium">
                    {d.Codigo_DC && (
                      <span className="mr-2 rounded-md bg-wash-surface-2 px-1.5 py-0.5 text-[11px] font-semibold text-wash-text">
                        {d.Codigo_DC}
                      </span>
                    )}
                    {d.Item_DC}
                  </span>
                  <span className="text-center font-bold text-wash-text-strong">{d.Cantidad_DC}</span>
                  <span className="text-right">
                    <StatusBadge status={d.Status_DC} />
                  </span>
                </div>
              ))}
            </div>
            {viewing.Observaciones_PC && (
              <div className="mt-3 rounded-lg bg-wash-canvas p-3 text-sm text-wash-text">
                {viewing.Observaciones_PC}
              </div>
            )}
          </>
        )}
      </Modal>

      {/* Editar (observaciones) */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Editar pedido #${editing.ID}` : ''}
      >
        {editing && (
          <EditCompraForm
            pedido={editing}
            onCancel={() => setEditing(null)}
            onSave={(obs) => {
              patchCompra(editing.ID, { Observaciones_PC: obs });
              setEditing(null);
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!receiving}
        title="Recibir mercadería"
        message={
          receiving ? `Vas a marcar como Recibida el pedido #${receiving.ID}. ¿Confirmás?` : ''
        }
        onCancel={() => setReceiving(null)}
        onConfirm={() => {
          if (receiving) {
            patchCompra(receiving.ID, { Status_PC: 'Recibida' });
            detallesDe(receiving).forEach((d) =>
              patchDetalleCompra(d.ID, {
                Status_DC: 'Recibida',
                CantidadIngresada_DC: d.Cantidad_DC,
              })
            );
          }
          setReceiving(null);
        }}
      />

      <ConfirmDialog
        open={!!deleting}
        tone="danger"
        title="Eliminar pedido"
        message={deleting ? `¿Eliminar el pedido #${deleting.ID}?` : ''}
        confirmLabel="Eliminar"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) patchCompra(deleting.ID, { Filtrar_PC: 'SI', Status_PC: 'Rechazada' });
          setDeleting(null);
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
  tone: 'neutral' | 'brand' | 'emerald' | 'danger';
  title: string;
  onClick: (e: React.MouseEvent) => void;
}) {
  const cls = {
    neutral:
      'text-wash-text-muted ring-wash-border hover:bg-wash-surface-2 hover:text-wash-text-strong hover:ring-wash-text-muted/40',
    brand:
      'text-wash-brand ring-wash-brand/30 hover:bg-wash-brand/10 hover:ring-wash-brand',
    emerald:
      'text-emerald-600 ring-emerald-500/30 hover:bg-emerald-500/10 hover:ring-emerald-500',
    danger:
      'text-rose-600 ring-rose-500/30 hover:bg-rose-500/10 hover:ring-rose-500',
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-lg ring-1 transition',
        cls
      )}
    >
      <Icon size={15} />
    </button>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-wash-text-muted">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-medium text-wash-text-strong">{value}</div>
    </div>
  );
}

function EditCompraForm({
  pedido,
  onCancel,
  onSave,
}: {
  pedido: PedidoCompra;
  onCancel: () => void;
  onSave: (obs: string) => void;
}) {
  const [obs, setObs] = useState(pedido.Observaciones_PC ?? '');
  return (
    <>
      <label className="text-xs font-semibold uppercase tracking-wider text-wash-text-muted">
        Observaciones
      </label>
      <textarea
        rows={3}
        value={obs}
        onChange={(e) => setObs(e.target.value)}
        className="mt-1 w-full rounded-lg border border-wash-border bg-wash-surface px-3 py-2 outline-none focus:border-wash-brand focus:ring-2 focus:ring-wash-brand/15"
      />
      <ModalActions>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-wash-border px-4 py-2 font-medium text-wash-text-strong hover:bg-wash-surface-2"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => onSave(obs)}
          className="rounded-lg bg-wash-brand px-4 py-2 font-medium text-white hover:bg-wash-brand-dark"
        >
          Guardar
        </button>
      </ModalActions>
    </>
  );
}

// ----- Nueva compra modal -----

interface NuevaCompraModalProps {
  open: boolean;
  onClose: () => void;
  catalog: StockCatalogItem[];
  onSubmit: (segment: TipoStock, lines: ComposeLine[], obs: string) => void;
}

function NuevaCompraModal({ open, onClose, catalog, onSubmit }: NuevaCompraModalProps) {
  const [segment, setSegment] = useState<TipoStock | ''>('');
  const [selectedCatalogId, setSelectedCatalogId] = useState<number | ''>('');
  const [qty, setQty] = useState('1');
  const [obs, setObs] = useState('');
  const [lines, setLines] = useState<ComposeLine[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const itemsForSegment = useMemo(
    () => (segment ? catalog.filter((c) => c.Tipo === segment) : []),
    [catalog, segment]
  );

  const reset = () => {
    setSegment('');
    setSelectedCatalogId('');
    setQty('1');
    setObs('');
    setLines([]);
    setEditingIdx(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleAddOrUpdate = () => {
    if (!selectedCatalogId || !segment || Number(qty) <= 0) return;
    const cat = catalog.find((c) => c.ID === selectedCatalogId);
    if (!cat) return;
    const newLine: ComposeLine = {
      catalogId: cat.ID,
      item: cat.Item,
      marca: cat.Marca,
      codigo: cat.Codigo,
      qty: Number(qty),
    };
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
    setSelectedCatalogId(line.catalogId);
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

  const canAdd =
    !!segment && !!selectedCatalogId && Number(qty) > 0 && lines.length >= 0;
  const canSubmit = !!segment && lines.length > 0;

  return (
    <Modal open={open} onClose={close} title="Nueva compra" width={720}>
      <div className="space-y-4">
        {/* Row: Segmento | Item | Cantidad | + */}
        <div className="grid grid-cols-[1fr_1.6fr_90px_auto] items-end gap-3">
          <div>
            <Label>Segmento</Label>
            <Select
              value={segment || undefined}
              onValueChange={(value) => {
                const s = value as TipoStock;
                setSegment(s);
                setSelectedCatalogId('');
                if (s !== segment) {
                  setLines([]);
                  setEditingIdx(null);
                }
              }}
            >
              <SelectTrigger className="mt-1.5 h-10 w-full">
                <SelectValue placeholder="Seleccionar segmento…" />
              </SelectTrigger>
              <SelectContent>
                {SEGMENTS.map((s) => (
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
              onValueChange={(value) =>
                setSelectedCatalogId(value ? Number(value) : '')
              }
              disabled={!segment}
            >
              <SelectTrigger className="mt-1.5 h-10 w-full">
                <SelectValue
                  placeholder={
                    segment ? 'Seleccionar item…' : 'Elegí un segmento primero'
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
                      <span className="font-medium text-wash-text-strong">
                        {c.Item}
                      </span>
                      {c.Marca && (
                        <span className="ml-auto text-xs text-wash-text-muted">
                          {c.Marca}
                        </span>
                      )}
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
              editingIdx !== null
                ? 'bg-amber-500 hover:bg-amber-600'
                : 'bg-wash-brand hover:bg-wash-brand-dark',
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

        {/* Item agregados */}
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
                    <span className="flex h-8 min-w-[34px] items-center justify-center rounded-md bg-wash-brand px-2 text-sm font-bold text-white shadow-sm tabular-nums">
                      {l.qty}
                    </span>
                    <div className="min-w-0 flex-1 truncate font-display text-[12.5px] font-bold uppercase tracking-wide text-wash-accent">
                      {segment ? tipoLabel(segment).toUpperCase() : ''}
                      {l.marca ? ` - ${l.marca.toUpperCase()}` : ''}
                      {l.codigo ? ` - ${l.codigo.toUpperCase()}` : ''}
                    </div>
                    <button
                      type="button"
                      onClick={() => startEdit(idx)}
                      title="Editar"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-wash-text-muted ring-1 ring-wash-border transition hover:bg-amber-500/10 hover:text-amber-600 hover:ring-amber-500"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      title="Eliminar"
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
          disabled={!canSubmit}
          onClick={() => {
            if (canSubmit && segment) {
              onSubmit(segment, lines, obs);
              reset();
            }
          }}
          className="rounded-lg bg-wash-brand px-5 py-2.5 font-medium text-white hover:bg-wash-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          Guardar
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
      <p className="text-sm font-bold text-wash-text-strong">Sin items disponibles</p>
      <p className="mt-0.5 text-[11px] text-wash-text-muted">
        Aún no se agregó ningún ítem al pedido.
      </p>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-medium uppercase tracking-wider text-wash-text-muted">
      {children}
    </label>
  );
}
