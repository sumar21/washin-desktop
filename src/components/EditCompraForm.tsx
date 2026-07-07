import { useMemo, useState } from 'react';
import { Trash2, Plus, HelpCircle } from 'lucide-react';
import { ModalActions } from '@/components/Modal';
import { Combobox } from '@/components/ui/combobox';
import { tipoLabel } from '@/lib/utils';
import type {
  DetalleCompra,
  PedidoCompra,
  StockCatalogItem,
} from '@/types/domain';

export interface EditLine {
  /** Present when this line comes from an existing detalle (patch on save). */
  id?: number;
  catalogId?: number;
  item: string;
  codigo?: string;
  marca?: string;
  qty: number;
}

export interface EditCompraChanges {
  obs: string;
  lines: EditLine[];
  removedIds: number[];
}

export function EditCompraForm({
  pedido,
  initialDetalles,
  catalog,
  onCancel,
  onSave,
}: {
  pedido: PedidoCompra;
  initialDetalles: DetalleCompra[];
  catalog: StockCatalogItem[];
  onCancel: () => void;
  onSave: (changes: EditCompraChanges) => void;
}) {
  const [lines, setLines] = useState<EditLine[]>(() =>
    initialDetalles.map((d) => ({
      id: d.ID,
      item: d.Item_DC,
      codigo: d.Codigo_DC,
      marca: d.Marca_DC,
      qty: d.Cantidad_DC,
    }))
  );
  const [removedIds, setRemovedIds] = useState<number[]>([]);
  const [obs, setObs] = useState(pedido.Observaciones_PC ?? '');

  // Composer for new lines
  const [newCatalogId, setNewCatalogId] = useState<number | ''>('');
  const [newQty, setNewQty] = useState('1');

  const itemsForSegment = useMemo(
    () => catalog.filter((c) => c.Tipo === pedido.Segmento_PC),
    [catalog, pedido.Segmento_PC]
  );

  const totalQty = lines.reduce((s, l) => s + (l.qty || 0), 0);
  const canAddNew = !!newCatalogId && Number(newQty) > 0;
  const canSave = lines.length > 0 && lines.every((l) => l.qty > 0);

  const addNewLine = () => {
    if (!canAddNew) return;
    const cat = catalog.find((c) => c.ID === newCatalogId);
    if (!cat) return;
    setLines((arr) => [
      ...arr,
      {
        catalogId: cat.ID,
        item: cat.Item,
        codigo: cat.Codigo,
        marca: cat.Marca,
        qty: Number(newQty),
      },
    ]);
    setNewCatalogId('');
    setNewQty('1');
  };

  const updateLineQty = (idx: number, qty: number) => {
    setLines((arr) =>
      arr.map((l, i) => (i === idx ? { ...l, qty: Math.max(1, qty) } : l))
    );
  };

  const removeLine = (idx: number) => {
    setLines((arr) => {
      const line = arr[idx];
      if (line?.id) {
        setRemovedIds((r) => [...r, line.id!]);
      }
      return arr.filter((_, i) => i !== idx);
    });
  };

  return (
    <div className="space-y-5">
      {/* Pedido summary header */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-wash-surface-2/40 p-3 ring-1 ring-wash-border">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-wash-brand/10 px-2 py-0.5 text-[11px] font-bold text-wash-brand">
          Pedido #{pedido.ID}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-wash-surface px-2.5 py-0.5 text-[11px] font-bold text-wash-text-strong ring-1 ring-wash-border">
          {tipoLabel(pedido.Segmento_PC)}
        </span>
        <span className="ml-auto text-[11px] text-wash-text-muted">
          {pedido.Fecha_PC}
        </span>
      </div>

      {/* Items list */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-[11px] font-bold uppercase tracking-wider text-wash-text-muted">
            Items del pedido
          </label>
          <span className="text-[11px] font-semibold text-wash-text-muted">
            {lines.length} item{lines.length === 1 ? '' : 's'} · {totalQty} uds
          </span>
        </div>
        <div className="rounded-xl border border-wash-border bg-wash-surface-2/30 p-2">
          {lines.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-3 py-6 text-center">
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-wash-brand/10 text-wash-brand ring-1 ring-wash-brand/20">
                <HelpCircle size={18} strokeWidth={1.7} />
              </div>
              <p className="text-[12.5px] font-bold text-wash-text-strong">
                Sin items
              </p>
              <p className="mt-0.5 text-[11px] text-wash-text-muted">
                Agregá al menos un ítem desde el composer de abajo.
              </p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {lines.map((l, idx) => (
                <li
                  key={l.id ?? `new-${idx}`}
                  className="flex items-center gap-2.5 rounded-lg bg-wash-surface px-3 py-2 ring-1 ring-wash-border"
                >
                  {l.codigo && (
                    <span className="shrink-0 rounded bg-wash-surface-2 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-wash-text">
                      {l.codigo}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-wash-text-strong">
                      {l.item}
                    </p>
                    {l.marca && (
                      <p className="text-[10.5px] text-wash-text-muted">
                        {l.marca}
                      </p>
                    )}
                  </div>
                  {!l.id && (
                    <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-500/20">
                      Nuevo
                    </span>
                  )}
                  {/* Inline qty editor */}
                  <div className="flex items-stretch overflow-hidden rounded-lg border border-wash-border">
                    <button
                      type="button"
                      onClick={() => updateLineQty(idx, l.qty - 1)}
                      className="flex w-7 items-center justify-center text-wash-text-muted hover:bg-wash-surface-2 hover:text-wash-brand"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={l.qty}
                      onChange={(e) =>
                        updateLineQty(idx, Number(e.target.value) || 1)
                      }
                      className="w-10 bg-wash-surface text-center text-[12.5px] font-bold tabular-nums outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => updateLineQty(idx, l.qty + 1)}
                      className="flex w-7 items-center justify-center text-wash-text-muted hover:bg-wash-surface-2 hover:text-wash-brand"
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(idx)}
                    title="Quitar"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-rose-600 ring-1 ring-rose-500/30 transition hover:bg-rose-500/10 hover:ring-rose-500"
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Add new item composer */}
      <div className="rounded-xl border border-wash-border bg-wash-surface-2/40 p-3">
        <label className="text-[11px] font-bold uppercase tracking-wider text-wash-text-muted">
          Agregar item
        </label>
        <div className="mt-1.5 grid grid-cols-[1fr_110px_auto] items-end gap-2">
          <Combobox
            options={itemsForSegment.map((c) => ({
              value: String(c.ID),
              label: c.Item,
              sublabel: [c.Codigo, c.Marca].filter(Boolean).join(' · ') || undefined,
            }))}
            value={newCatalogId ? String(newCatalogId) : null}
            onChange={(v) => setNewCatalogId(v ? Number(v) : '')}
            placeholder="Seleccionar item…"
            searchPlaceholder="Buscar item o código…"
            emptyText="Sin items para este segmento"
          />
          <div className="flex h-10 items-stretch overflow-hidden rounded-lg border border-wash-border bg-wash-surface focus-within:border-wash-brand focus-within:ring-2 focus-within:ring-wash-brand/15">
            <button
              type="button"
              onClick={() =>
                setNewQty((q) => String(Math.max(1, (Number(q) || 1) - 1)))
              }
              className="flex w-8 items-center justify-center text-wash-text-muted hover:bg-wash-surface-2 hover:text-wash-brand"
            >
              −
            </button>
            <input
              type="number"
              min={1}
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              className="w-full min-w-0 flex-1 px-1 text-center text-sm font-bold tabular-nums outline-none"
            />
            <button
              type="button"
              onClick={() => setNewQty((q) => String((Number(q) || 0) + 1))}
              className="flex w-8 items-center justify-center text-wash-text-muted hover:bg-wash-surface-2 hover:text-wash-brand"
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={addNewLine}
            disabled={!canAddNew}
            className="flex h-10 items-center gap-1.5 rounded-lg bg-wash-action px-3.5 text-[12.5px] font-semibold text-white shadow-sm shadow-wash-action/30 transition hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:bg-wash-surface-2 disabled:text-wash-text-faint disabled:shadow-none"
          >
            <Plus size={15} />
            Agregar
          </button>
        </div>
      </div>

      {/* Observaciones */}
      <div>
        <label className="text-[11px] font-bold uppercase tracking-wider text-wash-text-muted">
          Observaciones
        </label>
        <textarea
          rows={3}
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          placeholder="Aclaraciones del pedido (opcional)…"
          className="mt-1.5 w-full resize-none rounded-lg border border-wash-border bg-wash-surface px-3 py-2 text-sm outline-none focus:border-wash-brand focus:ring-2 focus:ring-wash-brand/15"
        />
      </div>

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
          disabled={!canSave}
          onClick={() => onSave({ obs, lines, removedIds })}
          className="rounded-lg bg-wash-action px-4 py-2 font-semibold text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          Guardar cambios
        </button>
      </ModalActions>
    </div>
  );
}
