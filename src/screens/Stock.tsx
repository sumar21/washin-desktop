import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pencil,
  ArrowLeftRight,
  WashingMachine,
  Wind,
  Cog,
  Boxes,
  Search,
  Plus,
  Minus,
  Check,
  X,
  AlertCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Modal, ModalActions } from '@/components/Modal';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { ErrorState } from '@/components/ErrorState';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PopoverClose } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppStore } from '@/store/useAppStore';
import { cn, proper } from '@/lib/utils';
import type { StockItem, TipoStock, StockCatalogItem } from '@/types/domain';

const TIPOS: TipoStock[] = [
  'LAVADORA',
  'SECADORA SIMPLE',
  'SECADORA DOBLE',
  'CARGADORA',
  'EXPENDEDORA',
  'ENCENDEDORA',
  'REPUESTO',
];

const tipoMeta: Record<TipoStock, { icon: typeof WashingMachine; tone: string }> = {
  LAVADORA: { icon: WashingMachine, tone: 'bg-sky-500/10 text-sky-600 ring-sky-500/20' },
  'SECADORA SIMPLE': { icon: Wind, tone: 'bg-violet-500/10 text-violet-600 ring-violet-500/20' },
  'SECADORA DOBLE': {
    icon: Wind,
    tone: 'bg-fuchsia-500/10 text-fuchsia-600 ring-fuchsia-500/20',
  },
  CARGADORA: { icon: Cog, tone: 'bg-amber-500/10 text-amber-600 ring-amber-500/20' },
  EXPENDEDORA: { icon: Cog, tone: 'bg-orange-500/10 text-orange-600 ring-orange-500/20' },
  ENCENDEDORA: { icon: Cog, tone: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20' },
  REPUESTO: { icon: Boxes, tone: 'bg-wash-brand/10 text-wash-brand ring-wash-brand/20' },
};

// Meta neutral para filas con Tipo_ST desconocido/vacío (datos sucios de 04.Stock).
const TIPO_FALLBACK = { icon: Boxes, tone: 'bg-slate-100 text-slate-600 ring-slate-300/70' };

export function Stock() {
  const stock = useAppStore((s) => s.CollectStock);
  const catalog = useAppStore((s) => s.CollectStockCatalog);
  const segmentos = useAppStore((s) => s.CollectSegmentos);
  const patchStock = useAppStore((s) => s.patchStock);
  const addStock = useAppStore((s) => s.addStock);
  const fetchStock = useAppStore((s) => s.fetchStock);
  const fetchCatalog = useAppStore((s) => s.fetchCatalog);
  const assignStockToTecnico = useAppStore((s) => s.assignStockToTecnico);
  const VarTipoUser = useAppStore((s) => s.VarTipoUser);

  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<StockItem | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<StockItem | null>(null);
  // Multi-select: empty array means "all types".
  const [filterTipos, setFilterTipos] = useState<TipoStock[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [stockLoading, setStockLoading] = useState(true);
  const [stockError, setStockError] = useState<string | null>(null);

  const loadStock = useCallback(() => {
    setStockLoading(true);
    setStockError(null);
    // El catálogo alimenta el modal "Agregar stock" (segmentos + items reales).
    return Promise.all([fetchStock(), fetchCatalog()])
      .catch((err) => {
        setStockError(err instanceof Error ? err.message : 'No se pudo cargar el stock.');
      })
      .finally(() => {
        setStockLoading(false);
      });
  }, [fetchStock, fetchCatalog]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial; `loadStock` también la dispara el botón "Reintentar".
    loadStock();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar; `loadStock` ya setea su propio loading.
  }, []);

  const toggleTipo = (t: TipoStock) =>
    setFilterTipos((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );

  const canEdit = VarTipoUser === 'Admin' || VarTipoUser === 'Jefe Taller';

  // Derived
  const totales = useMemo(() => {
    const map: Record<string, number> = {};
    TIPOS.forEach((t) => {
      map[t] = stock
        .filter((s) => s.Tipo_ST === t && s.Status_ST === 'Activo')
        .reduce((sum, s) => sum + s.Cantidad_ST, 0);
    });
    return map;
  }, [stock]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return stock
      .filter((i) => i.Status_ST === 'Activo')
      .filter((i) =>
        filterTipos.length === 0 ? true : filterTipos.includes(i.Tipo_ST)
      )
      .filter(
        (i) =>
          i.Item_ST.toLowerCase().includes(q) ||
          (i.Marca_ST ?? '').toLowerCase().includes(q) ||
          (i.Nro_ST ?? '').toLowerCase().includes(q) ||
          i.Tipo_ST.toLowerCase().includes(q)
      )
      .sort((a, b) => a.Tipo_ST.localeCompare(b.Tipo_ST));
  }, [stock, query, filterTipos]);

  return (
    <div className="relative flex h-full w-full flex-col">
      <PageHeader
        title="Stock"
        subtitle="Inventario general"
        search={{ value: query, onChange: setQuery, placeholder: 'Buscar item, marca, código…' }}
        filterPopover={<FilterContent tipos={filterTipos} onApply={setFilterTipos} />}
        onAdd={canEdit ? () => setAddOpen(true) : undefined}
        addLabel="Agregar"
      />
      <LoadingOverlay visible={stockLoading} label="Cargando stock…" />

      {stockError ? (
        <ErrorState message={stockError} onRetry={loadStock} />
      ) : (
      <>
      {/* Counters */}
      <div className="grid grid-cols-7 gap-2.5 border-b border-wash-border bg-wash-surface px-6 py-4">
        {TIPOS.map((t) => {
          const meta = tipoMeta[t];
          const Icon = meta.icon;
          const isActive = filterTipos.includes(t);
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggleTipo(t)}
              className={cn(
                'flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors',
                isActive
                  ? 'border-wash-brand bg-wash-brand/[0.06]'
                  : 'border-wash-border bg-wash-surface hover:border-wash-brand/40'
              )}
            >
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
                  meta.tone
                )}
              >
                <Icon size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[10px] font-semibold uppercase tracking-wider text-wash-text-muted">
                  {t}
                </div>
                <div className="font-display text-lg font-bold leading-tight text-wash-text-strong tabular-nums">
                  {totales[t] ?? 0}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active filter chips */}
      {filterTipos.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-wash-border bg-wash-surface-2/40 px-6 py-2 text-xs text-wash-text-muted">
          <span className="font-semibold uppercase tracking-wider">
            Filtro{filterTipos.length === 1 ? '' : 's'} activo
            {filterTipos.length === 1 ? '' : 's'}:
          </span>
          {filterTipos.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-full bg-wash-brand/10 px-2.5 py-0.5 font-semibold text-wash-brand"
            >
              {t}
              <button
                type="button"
                onClick={() => toggleTipo(t)}
                className="-mr-1 flex h-4 w-4 items-center justify-center rounded-full hover:bg-wash-brand/20"
                title={`Quitar ${t}`}
                aria-label={`Quitar filtro ${t}`}
              >
                <X size={10} strokeWidth={2.5} />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => setFilterTipos([])}
            className="ml-auto text-wash-text-muted hover:text-wash-text-strong"
          >
            Limpiar todo
          </button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-hidden px-6 pb-6 pt-4">
        <Card className="h-full gap-0 overflow-hidden py-0 ring-wash-border">
          <div
            className="grid border-b border-wash-border bg-wash-surface-2/60 px-5 text-[11px] font-bold uppercase tracking-wider text-wash-text-muted"
            style={{
              gridTemplateColumns: '180px minmax(0,1fr) 160px 120px 100px 120px',
            }}
          >
            <div className="py-3">Tipo</div>
            <div className="py-3">Item</div>
            <div className="py-3">Marca</div>
            <div className="py-3">Código</div>
            <div className="py-3 text-center">Cantidad</div>
            <div className="py-3 text-right">Acciones</div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex h-[280px] flex-col items-center justify-center text-center">
                <div className="mb-3 rounded-2xl bg-wash-surface-2 p-3 text-wash-text-muted">
                  <Search size={28} strokeWidth={1.6} />
                </div>
                <p className="text-sm font-semibold text-wash-text-strong">
                  No se encontraron items
                </p>
                <p className="mt-1 text-xs text-wash-text-muted">
                  Probá con otros filtros o ajustá la búsqueda.
                </p>
              </div>
            ) : (
              filtered.map((row) => {
                // Fallback defensivo: 04.Stock tiene datos sucios (p. ej. filas con Tipo_ST
                // vacío o un valor fuera de los 7 conocidos) — no debe crashear la tabla.
                const meta = tipoMeta[row.Tipo_ST] ?? TIPO_FALLBACK;
                const Icon = meta.icon;
                const showEdit = canEdit && row.Tipo_ST === 'REPUESTO';
                return (
                  <div
                    key={row.ID}
                    className="grid items-center border-b border-wash-divider/60 px-5 py-3 text-sm text-wash-text-strong transition-colors hover:bg-wash-surface-2/40"
                    style={{
                      gridTemplateColumns: '180px minmax(0,1fr) 160px 120px 100px 120px',
                    }}
                  >
                    <div>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider',
                          meta.tone
                        )}
                      >
                        <Icon size={11} />
                        {row.Tipo_ST || 'SIN TIPO'}
                      </span>
                    </div>
                    <div className="min-w-0 truncate font-medium text-wash-text-strong">
                      {proper(row.Item_ST)}
                    </div>
                    <div className="truncate text-wash-text">{row.Marca_ST ?? '—'}</div>
                    <div>
                      {row.Nro_ST ? (
                        <span className="rounded-md bg-wash-surface-2 px-2 py-0.5 text-[12px] font-semibold text-wash-text">
                          {row.Nro_ST}
                        </span>
                      ) : (
                        <span className="text-wash-text-faint">—</span>
                      )}
                    </div>
                    <div className="text-center">
                      <Badge
                        variant="secondary"
                        className="bg-wash-brand/10 text-wash-brand text-[12px] font-bold tabular-nums"
                      >
                        {row.Cantidad_ST}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-end gap-1.5">
                      {showEdit && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(row);
                            setEditQty(String(row.Cantidad_ST));
                            setEditError(null);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-wash-text-muted ring-1 ring-wash-border transition hover:bg-wash-brand/10 hover:text-wash-brand hover:ring-wash-brand/40"
                          title="Editar cantidad"
                          aria-label={`Editar cantidad de ${proper(row.Item_ST)}`}
                        >
                          <Pencil size={15} />
                        </button>
                      )}
                      {showEdit && (
                        <button
                          type="button"
                          onClick={() => setAssigning(row)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-wash-text-muted ring-1 ring-wash-border transition hover:bg-wash-brand/10 hover:text-wash-brand hover:ring-wash-brand/40"
                          title="Asignar a técnico"
                          aria-label={`Asignar ${proper(row.Item_ST)} a técnico`}
                        >
                          <ArrowLeftRight size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>
      </>
      )}

      {/* --- Edit modal --- */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Editar cantidad — ${proper(editing.Item_ST)}` : ''}
        width={420}
      >
        {editError && (
          <div
            role="alert"
            className="mb-3 flex items-center gap-2 rounded-r-md border-l-4 border-red-500 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700"
          >
            <AlertCircle size={14} className="shrink-0" />
            {editError}
          </div>
        )}
        <Label>Cantidad</Label>
        <div className="mt-1 flex items-stretch overflow-hidden rounded-lg border border-wash-border focus-within:border-wash-brand focus-within:ring-2 focus-within:ring-wash-brand/15">
          <button
            type="button"
            onClick={() =>
              setEditQty((q) => String(Math.max(0, (Number(q) || 0) - 1)))
            }
            className="flex w-10 shrink-0 items-center justify-center text-wash-text-muted hover:bg-wash-surface-2 hover:text-wash-brand"
            aria-label="Restar uno a la cantidad"
          >
            <Minus size={14} />
          </button>
          <input
            value={editQty}
            onChange={(e) => setEditQty(e.target.value)}
            type="number"
            min={0}
            aria-label="Cantidad"
            className="w-full min-w-0 flex-1 bg-wash-surface px-1 py-2 text-center text-base font-bold tabular-nums outline-none"
          />
          <button
            type="button"
            onClick={() => setEditQty((q) => String((Number(q) || 0) + 1))}
            className="flex w-10 shrink-0 items-center justify-center text-wash-text-muted hover:bg-wash-surface-2 hover:text-wash-brand"
            aria-label="Sumar uno a la cantidad"
          >
            <Plus size={14} />
          </button>
        </div>
        <ModalActions>
          <button
            type="button"
            onClick={() => setEditing(null)}
            className="rounded-lg border border-wash-border px-4 py-2 font-medium text-wash-text-strong hover:bg-wash-surface-2"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!editing) return;
              setEditError(null);
              try {
                await patchStock(editing.ID, { Cantidad_ST: Number(editQty) || 0 });
                setEditing(null);
              } catch (err) {
                setEditError(err instanceof Error ? err.message : 'No se pudo guardar la cantidad.');
              }
            }}
            className="rounded-lg bg-wash-action px-4 py-2 font-medium text-white hover:bg-wash-action-dark"
          >
            Guardar
          </button>
        </ModalActions>
      </Modal>

      {/* --- Add modal --- */}
      <AddStockModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        catalog={catalog}
        segmentos={segmentos}
        onAdd={async (item, qty, extras) => {
          await addStock(item, qty, extras);
          setAddOpen(false);
        }}
      />

      {/* --- Assign to técnico modal --- */}
      <AssignModal
        item={assigning}
        onClose={() => setAssigning(null)}
        onAssign={async (tecnico, cantidad) => {
          if (!assigning) return;
          await assignStockToTecnico(assigning.ID, tecnico, cantidad);
          setAssigning(null);
        }}
      />
    </div>
  );
}

// Segmentos que NO son máquinas individuales (misma regla que el backend `isMachineSegment`).
const SIMPLE_SEGMENTS = new Set(['repuesto', 'cargadora', 'expendedora', 'encendedor', 'encendedora']);
const isMachineSegment = (s: string) => !SIMPLE_SEGMENTS.has(s.trim().toLowerCase());

// ----- subcomponents -----

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-semibold uppercase tracking-wider text-wash-text-muted">
      {children}
    </label>
  );
}

function FilterChip({
  label,
  icon: Icon,
  tone,
  active,
  onClick,
}: {
  label: string;
  icon?: typeof WashingMachine;
  tone?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition',
        active
          ? 'border-wash-brand bg-wash-brand/5 text-wash-brand ring-2 ring-wash-brand/20'
          : 'border-wash-border text-wash-text-strong hover:border-wash-brand/40 hover:bg-wash-surface-2'
      )}
    >
      {Icon && (
        <span
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-md ring-1',
            tone
          )}
        >
          <Icon size={13} />
        </span>
      )}
      <span className="flex-1 truncate">{label}</span>
      <span
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded transition',
          active
            ? 'bg-wash-brand text-white ring-1 ring-wash-brand'
            : 'bg-wash-surface text-transparent ring-1 ring-wash-border group-hover:ring-wash-brand/40'
        )}
      >
        <Check size={10} strokeWidth={3} />
      </span>
    </button>
  );
}

function FilterContent({
  tipos,
  onApply,
}: {
  tipos: TipoStock[];
  onApply: (tipos: TipoStock[]) => void;
}) {
  const [pending, setPending] = useState<TipoStock[]>(tipos);
  const dirty =
    pending.length !== tipos.length || pending.some((t) => !tipos.includes(t));

  const toggle = (t: TipoStock) =>
    setPending((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between border-b border-wash-border pb-2.5">
        <h3 className="text-sm font-bold text-wash-text-strong">Filtrar por tipo</h3>
        {pending.length > 0 && (
          <button
            type="button"
            onClick={() => setPending([])}
            className="text-[11px] font-semibold text-wash-text-muted hover:text-wash-text-strong"
          >
            Limpiar
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        {TIPOS.map((t) => (
          <FilterChip
            key={t}
            label={t}
            icon={tipoMeta[t].icon}
            tone={tipoMeta[t].tone}
            active={pending.includes(t)}
            onClick={() => toggle(t)}
          />
        ))}
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
            onClick={() => onApply(pending)}
            className="rounded-lg bg-wash-action px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            Aplicar
          </button>
        </PopoverClose>
      </div>
    </div>
  );
}

interface AddStockModalProps {
  open: boolean;
  onClose: () => void;
  catalog: StockCatalogItem[];
  segmentos: string[];
  onAdd: (
    item: StockCatalogItem,
    qty: number,
    extras?: { NroSerie?: string; IDMaquina?: string }
  ) => Promise<void>;
}

function AddStockModal({ open, onClose, catalog, segmentos, onAdd }: AddStockModalProps) {
  const [segmento, setSegmento] = useState<string>('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [cantidad, setCantidad] = useState('1');
  const [nroSerie, setNroSerie] = useState('');
  const [idMaquina, setIdMaquina] = useState('');
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const isMachine = segmento ? isMachineSegment(segmento) : false;
  const itemsOfSegment = useMemo(
    () => catalog.filter((c) => segmento && c.Tipo === segmento),
    [catalog, segmento]
  );

  const selected = catalog.find((c) => c.ID === selectedId) ?? null;
  const ready = selected && Number(cantidad) > 0;

  const reset = () => {
    setSegmento('');
    setSelectedId(null);
    setCantidad('1');
    setNroSerie('');
    setIdMaquina('');
    setAddError(null);
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Agregar stock"
      width={520}
    >
      <div className="space-y-4">
        {addError && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-r-md border-l-4 border-red-500 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700"
          >
            <AlertCircle size={14} className="shrink-0" />
            {addError}
          </div>
        )}
        <div className="grid grid-cols-[1fr_140px] gap-3">
          <div>
            <Label>Segmento</Label>
            <Select
              value={segmento || undefined}
              onValueChange={(value) => {
                setSegmento(value);
                setSelectedId(null);
              }}
            >
              <SelectTrigger className="mt-1.5 h-10 w-full">
                <SelectValue placeholder="Seleccionar…" />
              </SelectTrigger>
              <SelectContent>
                {segmentos.map((t) => (
                  <SelectItem key={t} value={t}>
                    {proper(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Cantidad</Label>
            <div className="mt-1.5 flex h-10 items-stretch overflow-hidden rounded-lg border border-wash-border focus-within:border-wash-brand focus-within:ring-2 focus-within:ring-wash-brand/15">
              <button
                type="button"
                onClick={() =>
                  setCantidad((q) => String(Math.max(1, (Number(q) || 1) - 1)))
                }
                className="flex w-8 shrink-0 items-center justify-center text-wash-text-muted hover:bg-wash-surface-2 hover:text-wash-brand"
                aria-label="Restar uno a la cantidad"
              >
                <Minus size={14} />
              </button>
              <input
                type="number"
                min={1}
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                aria-label="Cantidad"
                className="w-full min-w-0 flex-1 bg-wash-surface px-1 text-center text-sm font-bold tabular-nums outline-none"
              />
              <button
                type="button"
                onClick={() => setCantidad((q) => String((Number(q) || 0) + 1))}
                className="flex w-8 shrink-0 items-center justify-center text-wash-text-muted hover:bg-wash-surface-2 hover:text-wash-brand"
                aria-label="Sumar uno a la cantidad"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>

        <div>
          <Label>Item</Label>
          <Select
            value={selectedId ? String(selectedId) : undefined}
            onValueChange={(value) => setSelectedId(Number(value))}
            disabled={!segmento}
          >
            <SelectTrigger className="mt-1.5 h-10 w-full">
              <SelectValue
                placeholder={segmento ? 'Seleccionar item…' : 'Elegí un segmento primero'}
              />
            </SelectTrigger>
            <SelectContent>
              {itemsOfSegment.map((c) => (
                <SelectItem key={c.ID} value={String(c.ID)}>
                  <span className="flex w-full items-center gap-2">
                    {c.Codigo && (
                      <span className="shrink-0 rounded bg-wash-surface-2 px-1.5 py-0.5 text-[10.5px] font-semibold text-wash-text">
                        {c.Codigo}
                      </span>
                    )}
                    <span className="font-medium text-wash-text-strong">{c.Item}</span>
                    {c.Marca && (
                      <span className="ml-auto text-xs text-wash-text-muted">{c.Marca}</span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isMachine && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nro serie</Label>
              <input
                type="text"
                value={nroSerie}
                onChange={(e) => setNroSerie(e.target.value)}
                placeholder="Ej. LG2024-001"
                className="mt-1.5 h-10 w-full rounded-lg border border-wash-border bg-wash-surface px-3 text-sm outline-none focus:border-wash-brand focus:ring-2 focus:ring-wash-brand/15"
              />
            </div>
            <div>
              <Label>ID Máquina</Label>
              <input
                type="text"
                value={idMaquina}
                onChange={(e) => setIdMaquina(e.target.value)}
                placeholder="Ej. TM1-LAV-01"
                className="mt-1.5 h-10 w-full rounded-lg border border-wash-border bg-wash-surface px-3 text-sm outline-none focus:border-wash-brand focus:ring-2 focus:ring-wash-brand/15"
              />
            </div>
          </div>
        )}

        {selected && (
          <div className="rounded-lg bg-wash-surface-2 p-3 text-xs">
            <p className="font-semibold text-wash-text-strong">
              Vas a agregar <span className="text-wash-brand">{cantidad || 0}</span> uds de{' '}
              {selected.Codigo ? `${selected.Codigo} · ` : ''}
              {selected.Item}
              {selected.Marca ? ` (${selected.Marca})` : ''}
            </p>
            {isMachine && (nroSerie || idMaquina) && (
              <p className="mt-1 text-wash-text-muted">
                {nroSerie && (
                  <>
                    Serie: <span className="font-semibold text-wash-text-strong">{nroSerie}</span>
                  </>
                )}
                {nroSerie && idMaquina && ' · '}
                {idMaquina && (
                  <>
                    ID: <span className="font-semibold text-wash-text-strong">{idMaquina}</span>
                  </>
                )}
              </p>
            )}
          </div>
        )}
      </div>

      <ModalActions>
        <button
          type="button"
          onClick={() => {
            reset();
            onClose();
          }}
          className="rounded-lg border border-wash-border px-4 py-2 font-medium text-wash-text-strong hover:bg-wash-surface-2"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!ready || saving}
          onClick={async () => {
            if (!ready || !selected) return;
            const extras = isMachine
              ? {
                  NroSerie: nroSerie.trim() || undefined,
                  IDMaquina: idMaquina.trim() || undefined,
                }
              : undefined;
            setSaving(true);
            setAddError(null);
            try {
              await onAdd(selected, Number(cantidad), extras);
              reset();
            } catch (err) {
              setAddError(err instanceof Error ? err.message : 'No se pudo agregar el item.');
            } finally {
              setSaving(false);
            }
          }}
          className="rounded-lg bg-wash-action px-4 py-2 font-medium text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Agregando…' : 'Agregar'}
        </button>
      </ModalActions>
    </Modal>
  );
}

// ----- Assign to técnico modal -----

interface AssignModalProps {
  item: StockItem | null;
  onClose: () => void;
  onAssign: (tecnico: string, cantidad: number) => Promise<void>;
}

function AssignModal({ item, onClose, onAssign }: AssignModalProps) {
  const tecnicos = useAppStore((s) => s.CollectTecnicosDisponibles);
  const fetchTecnicos = useAppStore((s) => s.fetchTecnicos);

  const [tecnico, setTecnico] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [tecnicosLoading, setTecnicosLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!item) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetea el form al abrir el modal para un item nuevo.
    setCantidad(String(item.Cantidad_ST || 1));
    setTecnico('');
    setError(null);
    setTecnicosLoading(true);
    fetchTecnicos()
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'No se pudieron cargar los técnicos.');
      })
      .finally(() => {
        setTecnicosLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recargar solo cuando se abre para un item nuevo.
  }, [item]);

  const disponible = item?.Cantidad_ST ?? 0;
  const cantidadNum = Number(cantidad) || 0;
  const ready = !!item && !!tecnico && cantidadNum > 0 && cantidadNum <= disponible;

  return (
    <Modal
      open={!!item}
      onClose={onClose}
      title={item ? `Asignar a técnico — ${proper(item.Item_ST)}` : ''}
      width={440}
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

      <Label>Técnico</Label>
      <Select value={tecnico || undefined} onValueChange={setTecnico} disabled={tecnicosLoading}>
        <SelectTrigger className="mt-1.5 h-10 w-full">
          <SelectValue placeholder={tecnicosLoading ? 'Cargando técnicos…' : 'Seleccionar técnico…'} />
        </SelectTrigger>
        <SelectContent>
          {tecnicos.map((t) => (
            <SelectItem key={t.ID} value={t.Nombre_Tecnico}>
              {t.Nombre_Tecnico}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="mt-4 flex items-center justify-between">
        <Label>Cantidad</Label>
        <span className="text-[11px] text-wash-text-muted">Disponible: {disponible}</span>
      </div>
      <div className="mt-1.5 flex items-stretch overflow-hidden rounded-lg border border-wash-border focus-within:border-wash-brand focus-within:ring-2 focus-within:ring-wash-brand/15">
        <button
          type="button"
          onClick={() => setCantidad((q) => String(Math.max(1, (Number(q) || 1) - 1)))}
          className="flex w-10 shrink-0 items-center justify-center text-wash-text-muted hover:bg-wash-surface-2 hover:text-wash-brand"
          aria-label="Restar uno a la cantidad"
        >
          <Minus size={14} />
        </button>
        <input
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          type="number"
          min={1}
          max={disponible}
          aria-label="Cantidad a asignar"
          className="w-full min-w-0 flex-1 bg-wash-surface px-1 py-2 text-center text-base font-bold tabular-nums outline-none"
        />
        <button
          type="button"
          onClick={() => setCantidad((q) => String(Math.min(disponible, (Number(q) || 0) + 1)))}
          className="flex w-10 shrink-0 items-center justify-center text-wash-text-muted hover:bg-wash-surface-2 hover:text-wash-brand"
          aria-label="Sumar uno a la cantidad"
        >
          <Plus size={14} />
        </button>
      </div>
      {cantidadNum > disponible && (
        <p className="mt-1.5 text-[11px] font-medium text-red-600">No hay suficiente stock disponible.</p>
      )}

      <ModalActions>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-wash-border px-4 py-2 font-medium text-wash-text-strong hover:bg-wash-surface-2"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!ready || saving}
          onClick={async () => {
            setSaving(true);
            setError(null);
            try {
              await onAssign(tecnico, cantidadNum);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'No se pudo asignar el stock.');
            } finally {
              setSaving(false);
            }
          }}
          className="rounded-lg bg-wash-action px-4 py-2 font-medium text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Asignando…' : 'Asignar'}
        </button>
      </ModalActions>
    </Modal>
  );
}
