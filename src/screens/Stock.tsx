import { useMemo, useState } from 'react';
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
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Modal, ModalActions } from '@/components/Modal';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

export function Stock() {
  const stock = useAppStore((s) => s.CollectStock);
  const catalog = useAppStore((s) => s.CollectStockCatalog);
  const patchStock = useAppStore((s) => s.patchStock);
  const addStock = useAppStore((s) => s.addStock);
  const VarTipoUser = useAppStore((s) => s.VarTipoUser);

  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<StockItem | null>(null);
  const [editQty, setEditQty] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterTipo, setFilterTipo] = useState<TipoStock | 'Todos'>('Todos');
  const [addOpen, setAddOpen] = useState(false);

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
      .filter((i) => (filterTipo === 'Todos' ? true : i.Tipo_ST === filterTipo))
      .filter(
        (i) =>
          i.Item_ST.toLowerCase().includes(q) ||
          (i.Marca_ST ?? '').toLowerCase().includes(q) ||
          (i.Nro_ST ?? '').toLowerCase().includes(q) ||
          i.Tipo_ST.toLowerCase().includes(q)
      )
      .sort((a, b) => a.Tipo_ST.localeCompare(b.Tipo_ST));
  }, [stock, query, filterTipo]);

  return (
    <div className="flex h-full w-full flex-col">
      <PageHeader
        title="Stock"
        subtitle="Inventario general"
        search={{ value: query, onChange: setQuery, placeholder: 'Buscar item, marca, código…' }}
        onFilter={() => setFilterOpen(true)}
        onAdd={canEdit ? () => setAddOpen(true) : undefined}
        addLabel="Agregar"
      />

      {/* Counters */}
      <div className="grid grid-cols-7 gap-2.5 border-b border-wash-border bg-wash-surface px-6 py-4">
        {TIPOS.map((t) => {
          const meta = tipoMeta[t];
          const Icon = meta.icon;
          const isActive = filterTipo === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setFilterTipo(isActive ? 'Todos' : t)}
              className={cn(
                'group flex items-center gap-2.5 rounded-xl border bg-wash-surface px-3 py-2 text-left transition-all',
                isActive
                  ? 'border-wash-brand ring-2 ring-wash-brand/20'
                  : 'border-wash-border hover:border-wash-brand/40 hover:shadow-sm'
              )}
            >
              <span
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1',
                  meta.tone
                )}
              >
                <Icon size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[10px] font-semibold uppercase tracking-wider text-wash-text-muted">
                  {t}
                </div>
                <div className="font-display text-lg font-black leading-tight text-wash-text-strong tabular-nums">
                  {totales[t] ?? 0}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-hidden px-6 pb-6 pt-4">
        <Card className="h-full overflow-hidden ring-wash-border">
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
                const meta = tipoMeta[row.Tipo_ST];
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
                          'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider ring-1',
                          meta.tone
                        )}
                      >
                        <Icon size={11} />
                        {row.Tipo_ST}
                      </span>
                    </div>
                    <div className="min-w-0 truncate font-display font-bold text-wash-accent">
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
                    <div className="flex items-center justify-end gap-1">
                      {showEdit && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(row);
                            setEditQty(String(row.Cantidad_ST));
                          }}
                          className="rounded-md p-1.5 text-wash-text-muted ring-1 ring-wash-border transition hover:bg-wash-brand/10 hover:text-wash-brand hover:ring-wash-brand/30"
                          title="Editar cantidad"
                        >
                          <Pencil size={13} />
                        </button>
                      )}
                      {showEdit && (
                        <button
                          type="button"
                          className="rounded-md p-1.5 text-wash-text-muted ring-1 ring-wash-border transition hover:bg-wash-brand/10 hover:text-wash-brand hover:ring-wash-brand/30"
                          title="Asignar a técnico"
                        >
                          <ArrowLeftRight size={13} />
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

      {/* --- Edit modal --- */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Editar cantidad — ${proper(editing.Item_ST)}` : ''}
        width={420}
      >
        <Label>Cantidad</Label>
        <div className="mt-1 flex items-stretch overflow-hidden rounded-lg border border-wash-border focus-within:border-wash-brand focus-within:ring-2 focus-within:ring-wash-brand/15">
          <button
            type="button"
            onClick={() =>
              setEditQty((q) => String(Math.max(0, (Number(q) || 0) - 1)))
            }
            className="flex w-10 shrink-0 items-center justify-center text-wash-text-muted hover:bg-wash-surface-2 hover:text-wash-brand"
          >
            <Minus size={14} />
          </button>
          <input
            value={editQty}
            onChange={(e) => setEditQty(e.target.value)}
            type="number"
            min={0}
            className="w-full min-w-0 flex-1 bg-wash-surface px-1 py-2 text-center text-base font-bold tabular-nums outline-none"
          />
          <button
            type="button"
            onClick={() => setEditQty((q) => String((Number(q) || 0) + 1))}
            className="flex w-10 shrink-0 items-center justify-center text-wash-text-muted hover:bg-wash-surface-2 hover:text-wash-brand"
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
            onClick={() => {
              if (editing) patchStock(editing.ID, { Cantidad_ST: Number(editQty) || 0 });
              setEditing(null);
            }}
            className="rounded-lg bg-wash-action px-4 py-2 font-medium text-white hover:bg-wash-action-dark"
          >
            Guardar
          </button>
        </ModalActions>
      </Modal>

      {/* --- Filter modal --- */}
      <Modal
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Filtrar stock"
        width={460}
      >
        <Label>Tipo</Label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <FilterChip
            label="Todos"
            active={filterTipo === 'Todos'}
            onClick={() => setFilterTipo('Todos')}
          />
          {TIPOS.map((t) => (
            <FilterChip
              key={t}
              label={t}
              icon={tipoMeta[t].icon}
              tone={tipoMeta[t].tone}
              active={filterTipo === t}
              onClick={() => setFilterTipo(t)}
            />
          ))}
        </div>
        <ModalActions>
          <button
            type="button"
            onClick={() => {
              setFilterTipo('Todos');
              setFilterOpen(false);
            }}
            className="rounded-lg border border-wash-border px-4 py-2 font-medium text-wash-text-strong hover:bg-wash-surface-2"
          >
            Limpiar
          </button>
          <button
            type="button"
            onClick={() => setFilterOpen(false)}
            className="rounded-lg bg-wash-action px-4 py-2 font-medium text-white hover:bg-wash-action-dark"
          >
            Aplicar
          </button>
        </ModalActions>
      </Modal>

      {/* --- Add modal --- */}
      <AddStockModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        catalog={catalog}
        onAdd={(item, qty, extras) => {
          addStock(item, qty, extras);
          setAddOpen(false);
        }}
      />
    </div>
  );
}

// Segmentos que son máquinas individuales (con Nro Serie + ID Maquina)
const MACHINE_SEGMENTS: TipoStock[] = ['LAVADORA', 'SECADORA SIMPLE', 'SECADORA DOBLE'];

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
        'flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition',
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
      <span className="truncate">{label}</span>
    </button>
  );
}

interface AddStockModalProps {
  open: boolean;
  onClose: () => void;
  catalog: StockCatalogItem[];
  onAdd: (
    item: StockCatalogItem,
    qty: number,
    extras?: { NroSerie?: string; IDMaquina?: string }
  ) => void;
}

function AddStockModal({ open, onClose, catalog, onAdd }: AddStockModalProps) {
  const [segmento, setSegmento] = useState<TipoStock | ''>('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [itemSearch, setItemSearch] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [nroSerie, setNroSerie] = useState('');
  const [idMaquina, setIdMaquina] = useState('');

  const isMachine = segmento ? MACHINE_SEGMENTS.includes(segmento) : false;

  const itemsOfSegment = useMemo(
    () =>
      catalog
        .filter((c) => segmento && c.Tipo === segmento)
        .filter(
          (c) =>
            !itemSearch ||
            c.Item.toLowerCase().includes(itemSearch.toLowerCase()) ||
            (c.Codigo ?? '').toLowerCase().includes(itemSearch.toLowerCase())
        ),
    [catalog, segmento, itemSearch]
  );

  const selected = catalog.find((c) => c.ID === selectedId) ?? null;
  const ready = selected && Number(cantidad) > 0;

  const reset = () => {
    setSegmento('');
    setSelectedId(null);
    setItemSearch('');
    setCantidad('1');
    setNroSerie('');
    setIdMaquina('');
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Agregar stock"
      width={620}
    >
      <div className="space-y-4">
        <div>
          <Label>Segmento</Label>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {TIPOS.map((t) => {
              const Icon = tipoMeta[t].icon;
              const active = segmento === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setSegmento(t);
                    setSelectedId(null);
                    setItemSearch('');
                  }}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider transition',
                    active
                      ? 'border-wash-brand bg-wash-brand/5 text-wash-brand'
                      : 'border-wash-border text-wash-text-strong hover:border-wash-brand/40 hover:bg-wash-surface-2'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-md ring-1',
                      tipoMeta[t].tone
                    )}
                  >
                    <Icon size={14} />
                  </span>
                  <span className="text-center leading-tight">{t}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <Label>Item</Label>
          {!segmento ? (
            <div className="mt-2 rounded-lg border border-dashed border-wash-border px-3 py-4 text-center text-xs text-wash-text-muted">
              Primero seleccioná un segmento.
            </div>
          ) : (
            <>
              <div className="relative mt-2">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-wash-text-muted"
                />
                <input
                  type="text"
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  placeholder="Buscar item o código…"
                  className="w-full rounded-lg border border-wash-border bg-wash-surface px-9 py-2 text-sm outline-none focus:border-wash-brand focus:ring-2 focus:ring-wash-brand/15"
                />
              </div>
              <div className="mt-2 max-h-[220px] overflow-y-auto rounded-lg border border-wash-border">
                {itemsOfSegment.length === 0 ? (
                  <p className="px-3 py-4 text-center text-xs text-wash-text-muted">
                    Sin coincidencias.
                  </p>
                ) : (
                  <ul className="divide-y divide-wash-divider">
                    {itemsOfSegment.map((c) => {
                      const active = selectedId === c.ID;
                      return (
                        <li key={c.ID}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(c.ID)}
                            className={cn(
                              'flex w-full items-center gap-3 px-3 py-2 text-left text-[13px] transition',
                              active ? 'bg-wash-brand/5' : 'hover:bg-wash-surface-2'
                            )}
                          >
                            {c.Codigo && (
                              <span className="shrink-0 rounded-md bg-wash-surface-2 px-2 py-0.5 text-[13px] font-semibold text-wash-text">
                                {c.Codigo}
                              </span>
                            )}
                            <span className="min-w-0 flex-1 truncate font-semibold text-wash-text-strong">
                              {c.Item}
                            </span>
                            {c.Marca && (
                              <span className="shrink-0 text-wash-text-muted">
                                {c.Marca}
                              </span>
                            )}
                            {active && (
                              <span className="h-2 w-2 shrink-0 rounded-full bg-wash-brand" />
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>

        <div
          className={cn(
            'grid gap-3',
            isMachine ? 'grid-cols-3' : 'grid-cols-1'
          )}
        >
          <div>
            <Label>Cantidad</Label>
            <div className="mt-2 flex h-10 items-stretch overflow-hidden rounded-lg border border-wash-border focus-within:border-wash-brand focus-within:ring-2 focus-within:ring-wash-brand/15">
              <button
                type="button"
                onClick={() =>
                  setCantidad((q) => String(Math.max(1, (Number(q) || 1) - 1)))
                }
                className="flex w-9 shrink-0 items-center justify-center text-wash-text-muted hover:bg-wash-surface-2 hover:text-wash-brand"
              >
                <Minus size={14} />
              </button>
              <input
                type="number"
                min={1}
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                className="w-full min-w-0 flex-1 bg-wash-surface px-1 text-center text-sm font-bold tabular-nums outline-none"
              />
              <button
                type="button"
                onClick={() => setCantidad((q) => String((Number(q) || 0) + 1))}
                className="flex w-9 shrink-0 items-center justify-center text-wash-text-muted hover:bg-wash-surface-2 hover:text-wash-brand"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {isMachine && (
            <>
              <div>
                <Label>Nro serie</Label>
                <input
                  type="text"
                  value={nroSerie}
                  onChange={(e) => setNroSerie(e.target.value)}
                  placeholder="Ej. LG2024-001"
                  className="mt-2 h-10 w-full rounded-lg border border-wash-border bg-wash-surface px-3 text-sm outline-none focus:border-wash-brand focus:ring-2 focus:ring-wash-brand/15"
                />
              </div>
              <div>
                <Label>ID Máquina</Label>
                <input
                  type="text"
                  value={idMaquina}
                  onChange={(e) => setIdMaquina(e.target.value)}
                  placeholder="Ej. TM1-LAV-01"
                  className="mt-2 h-10 w-full rounded-lg border border-wash-border bg-wash-surface px-3 text-sm outline-none focus:border-wash-brand focus:ring-2 focus:ring-wash-brand/15"
                />
              </div>
            </>
          )}
        </div>

        {selected && (
          <div className="rounded-lg bg-wash-surface-2 p-3 text-xs">
            <p className="font-semibold text-wash-text-strong">
              Vas a agregar <span className="text-wash-brand">{cantidad || 0}</span> uds de:
            </p>
            <p className="mt-0.5 text-wash-text-muted">
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
          disabled={!ready}
          onClick={() => {
            if (ready && selected) {
              const extras = isMachine
                ? {
                    NroSerie: nroSerie.trim() || undefined,
                    IDMaquina: idMaquina.trim() || undefined,
                  }
                : undefined;
              onAdd(selected, Number(cantidad), extras);
              reset();
            }
          }}
          className="rounded-lg bg-wash-action px-4 py-2 font-medium text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          Agregar
        </button>
      </ModalActions>
    </Modal>
  );
}
