import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Pencil,
  UserCog,
  Plus,
  Minus,
  Wrench,
  UserCircle2,
  AlertCircle,
  PackageOpen,
  Loader2,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/DataTable';
import { Modal, ModalActions } from '@/components/Modal';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { ErrorState } from '@/components/ErrorState';
import { Combobox } from '@/components/ui/combobox';
import { MultiSelect } from '@/components/ui/multi-select';
import { PopoverClose } from '@/components/ui/popover';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import type { RepuestoTecnico } from '@/types/domain';

export function StockTecnicos() {
  const stockT = useAppStore((s) => s.CollectStockTecnicos);
  const tecnicosDisp = useAppStore((s) => s.CollectTecnicosDisponibles);
  const fetchStockTecnicos = useAppStore((s) => s.fetchStockTecnicos);
  const patchStockTecnico = useAppStore((s) => s.patchStockTecnico);
  const reingressStockTecnico = useAppStore((s) => s.reingressStockTecnico);
  const assignStockTecnico = useAppStore((s) => s.assignStockTecnico);
  const VarTipoUser = useAppStore((s) => s.VarTipoUser);

  const [query, setQuery] = useState('');
  const [filterTecnico, setFilterTecnico] = useState<string[]>([]);
  const [filterRepuesto, setFilterRepuesto] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modals
  const [assigning, setAssigning] = useState<RepuestoTecnico | null>(null);
  const [reingressing, setReingressing] = useState<RepuestoTecnico | null>(null);
  const [editing, setEditing] = useState<RepuestoTecnico | null>(null);

  const canEdit = VarTipoUser === 'Admin' || VarTipoUser === 'Jefe Taller';

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    return fetchStockTecnicos()
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'No se pudo cargar el stock de técnicos.'))
      .finally(() => setLoading(false));
  }, [fetchStockTecnicos]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial; "Reintentar" también dispara load().
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar.
  }, []);

  // Técnicos reales (Usuarios rol Tecnico/Jefe Taller) para el picker de asignación.
  const tecnicos = useMemo(() => tecnicosDisp.map((t) => t.Nombre_Tecnico), [tecnicosDisp]);

  // Distinct lists for filter
  const tecnicosInStock = useMemo(
    () => Array.from(new Set(stockT.map((r) => r.Tecnico_RT))).sort(),
    [stockT]
  );
  const repuestosInStock = useMemo(
    () => Array.from(new Set(stockT.map((r) => r.Concat_RT))).sort(),
    [stockT]
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return stockT
      .filter((r) => r.Cantidad_RT > 0)
      .filter((r) => filterTecnico.length === 0 || filterTecnico.includes(r.Tecnico_RT))
      .filter((r) => filterRepuesto.length === 0 || filterRepuesto.includes(r.Concat_RT))
      .filter(
        (r) =>
          r.Tecnico_RT.toLowerCase().includes(q) ||
          r.Concat_RT.toLowerCase().includes(q) ||
          r.Codigo_RT.toLowerCase().includes(q)
      )
      .sort((a, b) => a.Tecnico_RT.localeCompare(b.Tecnico_RT));
  }, [stockT, query, filterTecnico, filterRepuesto]);

  const hasFiltros = filterTecnico.length > 0 || filterRepuesto.length > 0;
  const limpiarFiltros = () => {
    setFilterTecnico([]);
    setFilterRepuesto([]);
  };

  const emptyStock = (
    <EmptyState
      icon={PackageOpen}
      title="Sin repuestos asignados"
      description={
        hasFiltros
          ? 'Ningún repuesto coincide con los filtros aplicados.'
          : 'Ningún técnico tiene repuestos en su poder.'
      }
      action={
        hasFiltros ? (
          <Button variant="outline" onClick={limpiarFiltros}>
            Limpiar filtros
          </Button>
        ) : undefined
      }
    />
  );

  const columns: Column<RepuestoTecnico>[] = [
    {
      key: 'tecnico',
      header: 'Técnico',
      width: '260px',
      render: (r) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">
            {initials(r.Tecnico_RT)}
          </span>
          <span className="truncate text-[13px] font-semibold text-wash-text-strong">
            {r.Tecnico_RT}
          </span>
        </div>
      ),
    },
    {
      key: 'repuesto',
      header: 'Repuesto',
      width: 'minmax(280px, 1fr)',
      render: (r) => (
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded-md bg-wash-surface-2 px-1.5 py-0.5 text-[11px] font-semibold text-wash-text">
            {r.Codigo_RT}
          </span>
          <span className="truncate text-[13px] font-semibold text-wash-accent">
            {r.Concat_RT}
          </span>
        </div>
      ),
    },
    {
      key: 'cantidad',
      header: 'Cantidad',
      width: '120px',
      align: 'center',
      truncate: false,
      render: (r) => (
        <span className="inline-flex min-w-[40px] items-center justify-center rounded-md bg-wash-action/10 px-2 py-0.5 text-sm font-bold text-wash-action ring-1 ring-wash-action/20">
          {r.Cantidad_RT}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      width: '140px',
      align: 'right',
      truncate: false,
      render: (r) =>
        canEdit ? (
          <div className="flex items-center justify-end gap-1.5">
            <ActionButton
              icon={UserCog}
              tone="brand"
              title="Asignar a otro técnico"
              onClick={(e) => {
                e.stopPropagation();
                setAssigning(r);
              }}
            />
            <ActionButton
              icon={ArrowLeftRight}
              tone="neutral"
              title="Reingresar a stock"
              onClick={(e) => {
                e.stopPropagation();
                setReingressing(r);
              }}
            />
            <ActionButton
              icon={Pencil}
              tone="neutral"
              title="Editar cantidad"
              onClick={(e) => {
                e.stopPropagation();
                setEditing(r);
              }}
            />
          </div>
        ) : null,
    },
  ];

  return (
    <div className="flex h-full w-full flex-col">
      <PageHeader
        title="Stock técnicos"
        subtitle="Repuestos asignados al equipo de campo"
        search={{ value: query, onChange: setQuery, placeholder: 'Buscar técnico o repuesto' }}
        filterPopover={
          <FilterContent
            tecnico={filterTecnico}
            repuesto={filterRepuesto}
            tecnicos={tecnicosInStock}
            repuestos={repuestosInStock}
            onApply={(t, r) => {
              setFilterTecnico(t);
              setFilterRepuesto(r);
            }}
          />
        }
      />
      <LoadingOverlay visible={loading} label="Cargando stock de técnicos…" />

      {loadError ? (
        <ErrorState message={loadError} onRetry={load} />
      ) : (
        <>
      {hasFiltros && (
        <div className="flex flex-wrap items-center gap-2 border-b border-wash-border bg-wash-surface-2/40 px-6 py-2 text-xs text-wash-text-muted">
          <span className="font-semibold uppercase tracking-wider">Filtros:</span>
          {[...filterTecnico, ...filterRepuesto].map((v) => (
            <span
              key={v}
              className="rounded-full bg-wash-brand/10 px-2.5 py-0.5 font-semibold text-wash-brand"
            >
              {v}
            </span>
          ))}
          <button
            type="button"
            onClick={limpiarFiltros}
            className="ml-auto text-wash-text-muted hover:text-wash-text-strong"
          >
            Limpiar
          </button>
        </div>
      )}

      <div className="flex-1 overflow-hidden p-6">
        <DataTable
          rows={filtered}
          rowKey={(r) => r.ID}
          columns={columns}
          empty={emptyStock}
          mobileCard={(r) => (
            <div className="rounded-xl border border-wash-border bg-wash-surface p-2.5 shadow-sm transition active:scale-[0.99]">
              {/* Fila 1: técnico (identificador) + acciones */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[9.5px] font-semibold text-slate-600">
                    {initials(r.Tecnico_RT)}
                  </span>
                  <span className="truncate text-[12px] font-semibold text-wash-text-strong">
                    {r.Tecnico_RT}
                  </span>
                </div>
                {canEdit && (
                  <div className="flex shrink-0 gap-1.5">
                    <ActionButton
                      icon={UserCog}
                      tone="brand"
                      title="Asignar a otro técnico"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAssigning(r);
                      }}
                    />
                    <ActionButton
                      icon={ArrowLeftRight}
                      tone="neutral"
                      title="Reingresar a stock"
                      onClick={(e) => {
                        e.stopPropagation();
                        setReingressing(r);
                      }}
                    />
                    <ActionButton
                      icon={Pencil}
                      tone="neutral"
                      title="Editar cantidad"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(r);
                      }}
                    />
                  </div>
                )}
              </div>
              {/* Fila 2: repuesto (dato principal, ya incluye el código) + cantidad alineada */}
              <div className="mt-1.5 flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-wash-accent">
                  {r.Concat_RT}
                </p>
                <span className="inline-flex min-w-[36px] shrink-0 items-center justify-center rounded-md bg-wash-action/10 px-2 py-0.5 text-sm font-bold text-wash-action ring-1 ring-wash-action/20">
                  {r.Cantidad_RT}
                </span>
              </div>
            </div>
          )}
        />
      </div>
        </>
      )}

      {/* Asignar a técnico */}
      <AssignModal
        item={assigning}
        onClose={() => setAssigning(null)}
        tecnicos={tecnicos}
        onApply={async (toTecnico, qty) => {
          if (!assigning) return;
          await assignStockTecnico(assigning.ID, toTecnico, qty);
          setAssigning(null);
        }}
      />

      {/* Reingresar Stock */}
      <ReingressModal
        item={reingressing}
        onClose={() => setReingressing(null)}
        onApply={async (qty) => {
          if (!reingressing) return;
          await reingressStockTecnico(reingressing.ID, qty);
          setReingressing(null);
        }}
      />

      {/* Editar cantidad */}
      <EditQtyModal
        item={editing}
        onClose={() => setEditing(null)}
        onApply={async (qty) => {
          if (!editing) return;
          await patchStockTecnico(editing.ID, { Cantidad_RT: qty });
          setEditing(null);
        }}
      />
    </div>
  );
}

// ----- helpers / subcomponents -----

function initials(name: string) {
  return name
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function ActionButton({
  icon: Icon,
  tone,
  title,
  onClick,
}: {
  icon: typeof Pencil;
  tone: 'neutral' | 'brand';
  title: string;
  onClick: (e: React.MouseEvent) => void;
}) {
  const cls = {
    neutral:
      'text-wash-text-muted ring-wash-border hover:bg-wash-surface-2 hover:text-wash-text-strong hover:ring-wash-text-muted/40',
    brand:
      'text-wash-brand ring-wash-brand/30 hover:bg-wash-brand/10 hover:ring-wash-brand',
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

// ----- Asignar a técnico modal -----

function AssignModal({
  item,
  onClose,
  tecnicos,
  onApply,
}: {
  item: RepuestoTecnico | null;
  onClose: () => void;
  tecnicos: string[];
  onApply: (toTecnico: string, qty: number) => Promise<void>;
}) {
  const [tecnico, setTecnico] = useState('');
  const [qty, setQty] = useState('1');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!item) return null;
  const ready = !!tecnico && Number(qty) > 0 && Number(qty) <= item.Cantidad_RT;

  return (
    <Modal
      open={!!item}
      onClose={() => {
        setTecnico('');
        setQty('1');
        onClose();
      }}
      title="Asignar stock a técnico"
      width={580}
    >
      {/* Repuesto header card */}
      <div className="rounded-xl bg-wash-surface-2/50 p-4 ring-1 ring-wash-border">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-wash-brand/10 text-wash-brand ring-1 ring-wash-brand/20">
            <Wrench size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[15px] font-black text-wash-accent">
              {item.Concat_RT}
            </p>
            <div className="mt-1 flex items-center gap-2 text-xs text-wash-text-muted">
              <span className="rounded-md bg-wash-surface px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-wash-text">
                {item.Codigo_RT}
              </span>
              <span className="text-wash-text-faint">·</span>
              <span>Disponible para mover</span>
            </div>
          </div>
          <span className="flex flex-col items-center rounded-lg bg-wash-action/10 px-3 py-1.5 text-center text-wash-action ring-1 ring-wash-action/20">
            <span className="text-lg font-black leading-none tabular-nums">
              {item.Cantidad_RT}
            </span>
            <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider">
              en stock
            </span>
          </span>
        </div>
      </div>

      {/* Origen → Destino preview */}
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="rounded-xl bg-wash-surface-2/60 p-3 ring-1 ring-wash-border">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-wash-text-muted">
            Desde
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[9px] font-semibold text-slate-600">
              {initials(item.Tecnico_RT)}
            </span>
            <span className="truncate text-[12.5px] font-semibold text-wash-text-strong">
              {item.Tecnico_RT}
            </span>
          </div>
        </div>

        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-wash-action/15 text-wash-action">
          <ArrowLeftRight size={14} />
        </span>

        <div
          className={cn(
            'rounded-xl p-3 ring-1 transition',
            tecnico
              ? 'bg-wash-action/5 ring-wash-action/40'
              : 'bg-wash-surface-2/60 ring-wash-border'
          )}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-wash-text-muted">
            Hacia
          </p>
          <div className="mt-1 flex items-center gap-2">
            {tecnico ? (
              <>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-wash-action/15 text-[9px] font-semibold text-wash-action">
                  {initials(tecnico)}
                </span>
                <span className="truncate text-[12.5px] font-semibold text-wash-action-dark">
                  {tecnico}
                </span>
              </>
            ) : (
              <>
                <UserCircle2 size={14} className="text-wash-text-faint" />
                <span className="text-[12px] italic text-wash-text-faint">
                  Sin elegir
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Inputs */}
      <div className="mt-5 grid grid-cols-[1fr_140px] gap-3">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">
            Técnico destino
          </label>
          <div className="mt-1.5">
            <Combobox
              options={tecnicos
                .filter((t) => t !== item.Tecnico_RT)
                .map((t) => ({ value: t, label: t }))}
              value={tecnico || null}
              onChange={(v) => setTecnico(v ?? '')}
              placeholder="Seleccionar técnico…"
              searchPlaceholder="Buscar técnico…"
            />
          </div>
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">
            Cantidad
          </label>
          <QtyStepper value={qty} onChange={setQty} max={item.Cantidad_RT} />
        </div>
      </div>

      {error && (
        <div role="alert" className="mt-4 flex items-center gap-2 rounded-r-md border-l-4 border-red-500 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700">
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      <ModalActions>
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            setTecnico('');
            setQty('1');
            onClose();
          }}
          className="rounded-lg border border-wash-border px-6 py-3 text-[14px] font-medium text-wash-text-strong hover:bg-wash-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
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
              await onApply(tecnico, Number(qty));
              setTecnico('');
              setQty('1');
            } catch (err) {
              setError(err instanceof Error ? err.message : 'No se pudo transferir el repuesto.');
            } finally {
              setSaving(false);
            }
          }}
          className="flex items-center gap-2 rounded-lg bg-wash-action px-6 py-3 text-[14px] font-semibold text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <UserCog size={16} />}
          {saving ? 'Transfiriendo…' : 'Asignar'}
        </button>
      </ModalActions>
    </Modal>
  );
}

// ----- Reingresar Stock modal -----

function ReingressModal({
  item,
  onClose,
  onApply,
}: {
  item: RepuestoTecnico | null;
  onClose: () => void;
  onApply: (qty: number) => Promise<void>;
}) {
  const [qty, setQty] = useState('1');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!item) return null;
  const ready = Number(qty) > 0 && Number(qty) <= item.Cantidad_RT;

  return (
    <Modal
      open={!!item}
      onClose={() => {
        setQty('1');
        setError(null);
        onClose();
      }}
      title="Reingresar stock"
      width={500}
    >
      {/* Repuesto header card */}
      <div className="rounded-xl bg-wash-surface-2/50 p-4 ring-1 ring-wash-border">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-wash-brand/10 text-wash-brand ring-1 ring-wash-brand/20">
            <Wrench size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[15px] font-black text-wash-accent">
              {item.Concat_RT}
            </p>
            <div className="mt-1 flex items-center gap-2 text-xs text-wash-text-muted">
              <span className="rounded-md bg-wash-surface px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-wash-text">
                {item.Codigo_RT}
              </span>
              <span className="text-wash-text-faint">·</span>
              <span className="flex items-center gap-1">
                <UserCircle2 size={11} />
                {item.Tecnico_RT}
              </span>
            </div>
          </div>
          <span className="flex flex-col items-center rounded-lg bg-wash-action/10 px-3 py-1.5 text-center text-wash-action ring-1 ring-wash-action/20">
            <span className="text-lg font-black leading-none tabular-nums">
              {item.Cantidad_RT}
            </span>
            <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider">
              en stock
            </span>
          </span>
        </div>
      </div>

      <div className="mt-5">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">
          Cantidad a reingresar
        </label>
        <QtyStepper value={qty} onChange={setQty} max={item.Cantidad_RT} />
        <p className="mt-1.5 text-[11px] text-wash-text-muted">
          Se devuelve esta cantidad al depósito principal.
        </p>
      </div>

      {error && (
        <div role="alert" className="mt-4 flex items-center gap-2 rounded-r-md border-l-4 border-red-500 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700">
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      <ModalActions>
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            setQty('1');
            setError(null);
            onClose();
          }}
          className="rounded-lg border border-wash-border px-6 py-3 text-[14px] font-medium text-wash-text-strong hover:bg-wash-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
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
              await onApply(Number(qty));
              setQty('1');
            } catch (err) {
              setError(err instanceof Error ? err.message : 'No se pudo reingresar el stock.');
            } finally {
              setSaving(false);
            }
          }}
          className="flex items-center gap-2 rounded-lg bg-wash-action px-6 py-3 text-[14px] font-semibold text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <ArrowLeftRight size={16} />}
          {saving ? 'Reingresando…' : 'Aceptar'}
        </button>
      </ModalActions>
    </Modal>
  );
}

// ----- Editar cantidad modal -----

function EditQtyModal({
  item,
  onClose,
  onApply,
}: {
  item: RepuestoTecnico | null;
  onClose: () => void;
  onApply: (qty: number) => Promise<void>;
}) {
  const [qty, setQty] = useState('1');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetea el form al abrir el modal para un item nuevo.
    if (item) { setQty(String(item.Cantidad_RT)); setError(null); }
  }, [item]);

  if (!item) return null;
  const ready = Number(qty) >= 0 && Number(qty) !== item.Cantidad_RT;

  return (
    <Modal
      open={!!item}
      onClose={onClose}
      title="Editar cantidad"
      width={440}
    >
      <div className="rounded-xl bg-wash-surface-2/50 p-3 ring-1 ring-wash-border">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-wash-brand/10 text-wash-brand ring-1 ring-wash-brand/20">
            <Wrench size={14} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[13px] font-bold text-wash-accent">
              {item.Concat_RT}
            </p>
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-wash-text-muted">
              <span className="rounded bg-wash-surface px-1.5 py-0.5 font-mono text-[10px] font-semibold text-wash-text">
                {item.Codigo_RT}
              </span>
              <span className="text-wash-text-faint">·</span>
              <span>{item.Tecnico_RT}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-5">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">
          Cantidad
        </label>
        <QtyStepper value={qty} onChange={setQty} size="lg" />
      </div>
      {error && (
        <div role="alert" className="mt-4 flex items-center gap-2 rounded-r-md border-l-4 border-red-500 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700">
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}
      <ModalActions>
        <button
          type="button"
          disabled={saving}
          onClick={onClose}
          className="rounded-lg border border-wash-border px-6 py-3 text-[14px] font-medium text-wash-text-strong hover:bg-wash-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
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
              await onApply(Number(qty));
            } catch (err) {
              setError(err instanceof Error ? err.message : 'No se pudo guardar la cantidad.');
            } finally {
              setSaving(false);
            }
          }}
          className="flex items-center gap-2 rounded-lg bg-wash-action px-6 py-3 text-[14px] font-semibold text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Pencil size={15} />}
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </ModalActions>
    </Modal>
  );
}

// ----- Qty stepper (reusable -/+) -----

function QtyStepper({
  value,
  onChange,
  max,
  size = 'md',
}: {
  value: string;
  onChange: (v: string) => void;
  max?: number;
  /** 'md' default (h-10) or 'lg' for primary inputs (h-12). */
  size?: 'md' | 'lg';
}) {
  const heightCls = size === 'lg' ? 'h-12' : 'h-10';
  const buttonWidthCls = size === 'lg' ? 'w-11' : 'w-9';
  const iconSize = size === 'lg' ? 16 : 14;
  const textCls = size === 'lg' ? 'text-base' : 'text-sm';

  return (
    <div
      className={cn(
        'mt-1.5 flex items-stretch overflow-hidden rounded-lg border border-wash-border focus-within:border-wash-action focus-within:ring-2 focus-within:ring-wash-action/15',
        heightCls
      )}
    >
      <button
        type="button"
        onClick={() => onChange(String(Math.max(0, (Number(value) || 0) - 1)))}
        className={cn(
          'flex shrink-0 items-center justify-center text-wash-text-muted hover:bg-wash-surface-2 hover:text-wash-action',
          buttonWidthCls
        )}
      >
        <Minus size={iconSize} />
      </button>
      <input
        type="number"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'w-full min-w-0 flex-1 bg-wash-surface px-1 text-center font-bold tabular-nums outline-none',
          textCls
        )}
      />
      <button
        type="button"
        onClick={() => {
          const next = (Number(value) || 0) + 1;
          onChange(String(max !== undefined ? Math.min(max, next) : next));
        }}
        className={cn(
          'flex shrink-0 items-center justify-center text-wash-text-muted hover:bg-wash-surface-2 hover:text-wash-action',
          buttonWidthCls
        )}
      >
        <Plus size={iconSize} />
      </button>
    </div>
  );
}

// ----- Filter popover -----

function FilterContent({
  tecnico,
  repuesto,
  tecnicos,
  repuestos,
  onApply,
}: {
  tecnico: string[];
  repuesto: string[];
  tecnicos: string[];
  repuestos: string[];
  onApply: (tecnico: string[], repuesto: string[]) => void;
}) {
  const [pendingTecnico, setPendingTecnico] = useState<string[]>(tecnico);
  const [pendingRepuesto, setPendingRepuesto] = useState<string[]>(repuesto);

  const sameSet = (a: string[], b: string[]) =>
    a.length === b.length && a.every((x) => b.includes(x));
  const dirty = !sameSet(pendingTecnico, tecnico) || !sameSet(pendingRepuesto, repuesto);
  const hasFilters = pendingTecnico.length > 0 || pendingRepuesto.length > 0;

  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (v: string) =>
    setter((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between border-b border-wash-border pb-2.5">
        <h3 className="text-sm font-bold text-wash-text-strong">Filtrar</h3>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setPendingTecnico([]);
              setPendingRepuesto([]);
            }}
            className="text-[11px] font-semibold text-wash-text-muted hover:text-wash-text-strong"
          >
            Limpiar
          </button>
        )}
      </div>

      <div className="space-y-3">
        <MultiSelect
          label="Técnico"
          searchable
          options={tecnicos.map((t) => ({ value: t, label: t }))}
          selected={pendingTecnico}
          onToggle={toggle(setPendingTecnico)}
          onClear={() => setPendingTecnico([])}
        />
        <MultiSelect
          label="Repuesto"
          searchable
          options={repuestos.map((r) => ({ value: r, label: r }))}
          selected={pendingRepuesto}
          onToggle={toggle(setPendingRepuesto)}
          onClear={() => setPendingRepuesto([])}
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
            onClick={() => onApply(pendingTecnico, pendingRepuesto)}
            className="rounded-lg bg-wash-action px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            Aplicar
          </button>
        </PopoverClose>
      </div>
    </div>
  );
}
