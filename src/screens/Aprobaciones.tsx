import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  X,
  Eye,
  ShoppingCart,
  Wrench,
  ArrowLeftRight,
  ClipboardList,
  Clock,
  AlertCircle,
  Info as InfoIcon,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { Modal, ModalActions } from '@/components/Modal';
import { StatusBadge } from '@/components/StatusBadge';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { ErrorState } from '@/components/ErrorState';
import { PopoverClose } from '@/components/ui/popover';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import type { Aprobacion } from '@/types/domain';

type TipoAprobacion = Aprobacion['TipoAprobacion_AP'];

const tipoMeta: Record<TipoAprobacion, { icon: typeof ShoppingCart; tone: string }> = {
  Compra: { icon: ShoppingCart, tone: 'bg-sky-100 text-sky-800 ring-sky-300/70' },
  'Cambio de Maquina': { icon: Wrench, tone: 'bg-amber-100 text-amber-800 ring-amber-300/70' },
  'Transferencia de Maquina': { icon: ArrowLeftRight, tone: 'bg-violet-100 text-violet-800 ring-violet-300/70' },
};

const TIPOS: TipoAprobacion[] = ['Compra', 'Cambio de Maquina', 'Transferencia de Maquina'];

export function Aprobaciones() {
  const aprobaciones = useAppStore((s) => s.CollectAprobaciones);
  const fetchAprobaciones = useAppStore((s) => s.fetchAprobaciones);
  const fetchCompras = useAppStore((s) => s.fetchCompras);
  const approveAprobacion = useAppStore((s) => s.approveAprobacion);
  const rejectAprobacion = useAppStore((s) => s.rejectAprobacion);

  const [query, setQuery] = useState('');
  const [filterTipos, setFilterTipos] = useState<TipoAprobacion[]>([]);
  const [viewing, setViewing] = useState<Aprobacion | null>(null);
  const [approving, setApproving] = useState<Aprobacion | null>(null);
  const [rejecting, setRejecting] = useState<Aprobacion | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    return Promise.all([fetchAprobaciones(), fetchCompras()])
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'No se pudieron cargar las aprobaciones.'))
      .finally(() => setLoading(false));
  }, [fetchAprobaciones, fetchCompras]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial; "Reintentar" también dispara load().
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar.
  }, []);

  const toggleTipo = (t: TipoAprobacion) =>
    setFilterTipos((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return aprobaciones
      .filter((a) => (filterTipos.length === 0 ? true : filterTipos.includes(a.TipoAprobacion_AP)))
      .filter(
        (a) =>
          a.TipoAprobacion_AP.toLowerCase().includes(q) ||
          a.ConcatAprobacion_AP.toLowerCase().includes(q) ||
          a.Status_AP.toLowerCase().includes(q)
      );
  }, [aprobaciones, query, filterTipos]);

  const countByTipo = useMemo(() => {
    const map: Record<string, number> = {};
    TIPOS.forEach((t) => {
      map[t] = aprobaciones.filter((p) => p.TipoAprobacion_AP === t).length;
    });
    return map;
  }, [aprobaciones]);

  const columns: Column<Aprobacion>[] = [
    {
      key: 'tipo',
      header: 'Tipo',
      width: '220px',
      truncate: false,
      render: (a) => {
        const meta = tipoMeta[a.TipoAprobacion_AP];
        const Icon = meta.icon;
        return (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide ring-1',
              meta.tone
            )}
          >
            <Icon size={11} />
            {a.TipoAprobacion_AP}
          </span>
        );
      },
    },
    {
      key: 'concat',
      header: 'Descripción',
      width: 'minmax(280px, 1fr)',
      render: (a) => <div className="font-display font-bold text-wash-accent">{a.ConcatAprobacion_AP}</div>,
    },
    {
      key: 'fecha',
      header: 'Fecha gen.',
      width: '130px',
      render: (a) => <span className="text-wash-text">{a.FechaGen_AP}</span>,
    },
    {
      key: 'status',
      header: 'Estado',
      width: '160px',
      truncate: false,
      render: (a) => <StatusBadge status={a.Status_AP} />,
    },
    {
      key: 'actions',
      header: 'Acciones',
      width: '160px',
      align: 'right',
      truncate: false,
      render: (a) => {
        // Aprobar implementado para Compra y Transferencia de Maquina; Cambio de Maquina
        // (originado en Incidentes) todavía no.
        const canApprove =
          a.TipoAprobacion_AP === 'Compra' || a.TipoAprobacion_AP === 'Transferencia de Maquina';
        return (
          <div className="flex items-center justify-end gap-1.5">
            <ActionButton
              icon={Eye}
              tone="neutral"
              title="Ver detalle"
              onClick={(e) => {
                e.stopPropagation();
                setViewing(a);
              }}
            />
            <ActionButton
              icon={Check}
              tone="approve"
              title={canApprove ? 'Aprobar' : 'Se gestiona desde el módulo de Incidentes'}
              disabled={!canApprove}
              onClick={(e) => {
                e.stopPropagation();
                setApproving(a);
              }}
            />
            <ActionButton
              icon={X}
              tone="reject"
              title="Rechazar"
              onClick={(e) => {
                e.stopPropagation();
                setRejecting(a);
              }}
            />
          </div>
        );
      },
    },
  ];

  return (
    <div className="relative flex h-full w-full flex-col">
      <PageHeader
        title="Aprobaciones"
        subtitle="Solicitudes pendientes de revisión"
        search={{ value: query, onChange: setQuery, placeholder: 'Buscar tipo o descripción…' }}
        filterPopover={<FilterContent tipos={filterTipos} onApply={setFilterTipos} />}
      />
      <LoadingOverlay visible={loading} label="Cargando aprobaciones…" />

      {loadError ? (
        <ErrorState message={loadError} onRetry={load} />
      ) : (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-4 gap-3 border-b border-wash-border bg-wash-surface px-6 py-4">
            <CounterCard
              icon={ClipboardList}
              label="Pendientes totales"
              value={aprobaciones.length}
              tone="bg-wash-brand/10 text-wash-brand ring-wash-brand/20"
            />
            <CounterCard
              icon={ShoppingCart}
              label="Compras"
              value={countByTipo['Compra'] ?? 0}
              tone="bg-sky-500/10 text-sky-700 ring-sky-500/20"
            />
            <CounterCard
              icon={Wrench}
              label="Cambios de máquina"
              value={countByTipo['Cambio de Maquina'] ?? 0}
              tone="bg-amber-500/10 text-amber-700 ring-amber-500/20"
            />
            <CounterCard
              icon={ArrowLeftRight}
              label="Transferencias"
              value={countByTipo['Transferencia de Maquina'] ?? 0}
              tone="bg-violet-500/10 text-violet-700 ring-violet-500/20"
            />
          </div>

          {/* Active filter chips */}
          {filterTipos.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-wash-border bg-wash-surface-2/40 px-6 py-2 text-xs text-wash-text-muted">
              <span className="font-semibold uppercase tracking-wider">
                Filtro{filterTipos.length === 1 ? '' : 's'} activo{filterTipos.length === 1 ? '' : 's'}:
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

          <div className="flex-1 overflow-hidden p-6">
            <DataTable
              rows={filtered}
              rowKey={(r) => r.ID}
              columns={columns}
              empty={
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20">
                    <Check size={22} />
                  </div>
                  <p className="text-sm font-semibold text-wash-text-strong">Sin aprobaciones pendientes</p>
                  <p className="mt-1 text-xs text-wash-text-muted">
                    {filterTipos.length === 0
                      ? 'Todas las solicitudes fueron resueltas.'
                      : 'No hay solicitudes de los tipos seleccionados.'}
                  </p>
                </div>
              }
            />
          </div>
        </>
      )}

      {/* View detail */}
      <ViewDetailModal viewing={viewing} onClose={() => setViewing(null)} />

      {/* Approve */}
      <DecisionModal
        aprobacion={approving}
        tone="approve"
        onClose={() => setApproving(null)}
        onConfirm={async () => {
          if (approving) await approveAprobacion(approving.ID);
          setApproving(null);
        }}
      />

      {/* Reject */}
      <DecisionModal
        aprobacion={rejecting}
        tone="reject"
        requireReason
        onClose={() => setRejecting(null)}
        onConfirm={async (reason) => {
          if (rejecting) await rejectAprobacion(rejecting.ID, reason ?? '');
          setRejecting(null);
        }}
      />
    </div>
  );
}

// ----- Decision (approve / reject) modal — sobrio -----

function DecisionModal({
  aprobacion,
  tone,
  requireReason = false,
  onClose,
  onConfirm,
}: {
  aprobacion: Aprobacion | null;
  tone: 'approve' | 'reject';
  requireReason?: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!aprobacion) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- limpia el form al abrir para una solicitud nueva.
    setReason('');
    setError(null);
  }, [aprobacion]);

  if (!aprobacion) return null;
  const meta = tipoMeta[aprobacion.TipoAprobacion_AP];
  const Icon = meta.icon;
  const approve = tone === 'approve';

  const consequence: Record<TipoAprobacion, string> = approve
    ? {
        Compra: 'El pedido pasará a Aprobada y sus items quedarán habilitados para recibirse.',
        'Cambio de Maquina': 'Se autoriza el reemplazo de la máquina.',
        'Transferencia de Maquina': 'La máquina será movida al edificio destino.',
      }
    : {
        Compra: 'El pedido pasará a Rechazada y sus items quedarán anulados.',
        'Cambio de Maquina': 'Se rechazará la solicitud de cambio.',
        'Transferencia de Maquina': 'Se cancelará la transferencia.',
      };

  const canConfirm = !requireReason || reason.trim().length > 0;

  return (
    <Modal open={!!aprobacion} onClose={onClose} title={approve ? 'Confirmar aprobación' : 'Rechazar solicitud'} width={480}>
      {error && (
        <div
          role="alert"
          className="mb-3 flex items-center gap-2 rounded-r-md border-l-4 border-red-500 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700"
        >
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 rounded-xl bg-wash-surface-2/50 p-4">
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1', meta.tone)}>
          <Icon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-black text-wash-accent">{aprobacion.ConcatAprobacion_AP}</p>
          <p className="mt-0.5 text-[11px] text-wash-text-muted">
            {aprobacion.TipoAprobacion_AP} · #{aprobacion.ID}
          </p>
        </div>
      </div>

      {requireReason && (
        <div className="mt-4">
          <label className="text-xs font-semibold uppercase tracking-wider text-wash-text-muted">Motivo del rechazo</label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Detallá el motivo del rechazo…"
            className="mt-1.5 w-full resize-none rounded-lg border border-wash-border bg-wash-surface px-3 py-2 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15"
          />
        </div>
      )}

      <div
        className={cn(
          'mt-3 rounded-lg px-3 py-2.5 text-left text-xs ring-1',
          approve ? 'bg-emerald-50 text-emerald-900 ring-emerald-200' : 'bg-rose-50 text-rose-900 ring-rose-200'
        )}
      >
        <span className="font-semibold">Al confirmar: </span>
        {consequence[aprobacion.TipoAprobacion_AP]}
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
          disabled={!canConfirm || saving}
          onClick={async () => {
            setSaving(true);
            setError(null);
            try {
              await onConfirm(reason);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'No se pudo completar la acción.');
            } finally {
              setSaving(false);
            }
          }}
          className={cn(
            'flex items-center gap-2 rounded-lg px-5 py-2.5 font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50',
            approve ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
          )}
        >
          {approve ? <Check size={16} strokeWidth={2.5} /> : <X size={16} strokeWidth={2.5} />}
          {saving ? 'Procesando…' : approve ? 'Aprobar' : 'Rechazar'}
        </button>
      </ModalActions>
    </Modal>
  );
}

// ----- detail modal -----

function ViewDetailModal({ viewing, onClose }: { viewing: Aprobacion | null; onClose: () => void }) {
  const pedidos = useAppStore((s) => s.CollectCompras);
  const detalles = useAppStore((s) => s.CollectDetalleCompras);

  if (!viewing) return null;

  const meta = tipoMeta[viewing.TipoAprobacion_AP];
  const Icon = meta.icon;

  const pedido =
    viewing.TipoAprobacion_AP === 'Compra' && viewing.IDCompra_AP
      ? pedidos.find((p) => String(p.ID) === viewing.IDCompra_AP)
      : null;
  const pedidoDetalles = pedido ? detalles.filter((d) => d.IDCompra_DC === pedido.IDUnivoco_PC) : [];

  return (
    <Modal open={!!viewing} onClose={onClose} title={viewing.TipoAprobacion_AP} width={600}>
      <div className="space-y-5">
        <div className="rounded-xl bg-wash-surface-2/50 p-4">
          <div className="flex items-start gap-3">
            <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ring-1', meta.tone)}>
              <Icon size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-base font-black text-wash-accent">{viewing.ConcatAprobacion_AP}</p>
              <p className="mt-0.5 text-xs text-wash-text-muted">Solicitud #{viewing.ID}</p>
            </div>
            <StatusBadge status={viewing.Status_AP} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field icon={Clock} label="Generada" value={viewing.FechaGen_AP} />
          <Field label="Mes/Año" value={viewing.FechaMesAnoGen_AP} />
          <Field label="ID Solicitud" value={`#${viewing.ID}`} />
        </div>

        {viewing.TipoAprobacion_AP === 'Compra' ? (
          <CompraDetail pedido={pedido} detalles={pedidoDetalles} />
        ) : (
          <div className="flex items-start gap-2 rounded-lg bg-sky-50 px-3 py-2.5 text-xs text-sky-900 ring-1 ring-sky-200">
            <InfoIcon size={14} className="mt-0.5 shrink-0" />
            <span>
              Las aprobaciones de máquina (cambio/transferencia) se generan y resuelven desde el módulo de
              Máquinas/Incidentes. Desde acá podés rechazarla si corresponde.
            </span>
          </div>
        )}
      </div>

      <ModalActions>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-wash-border px-5 py-2 font-medium text-wash-text-strong hover:bg-wash-surface-2"
        >
          Cerrar
        </button>
      </ModalActions>
    </Modal>
  );
}

function CompraDetail({
  pedido,
  detalles,
}: {
  pedido: ReturnType<typeof useAppStore.getState>['CollectCompras'][number] | null | undefined;
  detalles: ReturnType<typeof useAppStore.getState>['CollectDetalleCompras'];
}) {
  if (!pedido) {
    return (
      <div className="rounded-lg border border-dashed border-wash-border px-3 py-4 text-center text-xs text-wash-text-muted">
        No se encontró el pedido asociado.
      </div>
    );
  }
  const total = detalles.reduce((acc, d) => acc + d.Cantidad_DC, 0);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-wash-text-muted">Items del pedido #{pedido.ID}</p>
        <span className="rounded-full bg-wash-brand/10 px-2.5 py-0.5 text-[11px] font-bold text-wash-brand">
          {detalles.length} item{detalles.length === 1 ? '' : 's'} · {total} uds
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-wash-border">
        <div className="grid grid-cols-[1fr_80px_120px] bg-wash-surface-2/60 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-wash-text-muted">
          <span>Item</span>
          <span className="text-center">Cant.</span>
          <span className="text-right">Estado</span>
        </div>
        {detalles.map((d) => (
          <div
            key={d.ID}
            className="grid grid-cols-[1fr_80px_120px] items-center border-t border-wash-divider/60 px-3 py-2 text-sm"
          >
            <div className="min-w-0 truncate font-semibold text-wash-text-strong">{d.Item_DC}</div>
            <span className="text-center font-bold text-wash-text-strong tabular-nums">{d.Cantidad_DC}</span>
            <span className="text-right">
              <StatusBadge status={d.Status_DC} />
            </span>
          </div>
        ))}
      </div>

      {pedido.Observaciones_PC && (
        <div className="mt-3 rounded-lg bg-wash-surface-2/40 p-3 text-xs text-wash-text">
          <p className="mb-1 font-semibold uppercase tracking-wider text-wash-text-muted">Observaciones del solicitante</p>
          {pedido.Observaciones_PC}
        </div>
      )}
    </div>
  );
}

// ----- filter popover -----

function FilterContent({
  tipos,
  onApply,
}: {
  tipos: TipoAprobacion[];
  onApply: (tipos: TipoAprobacion[]) => void;
}) {
  const [pending, setPending] = useState<TipoAprobacion[]>(tipos);
  const dirty = pending.length !== tipos.length || pending.some((t) => !tipos.includes(t));
  const toggle = (t: TipoAprobacion) =>
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
        {TIPOS.map((t) => {
          const meta = tipoMeta[t];
          const Icon = meta.icon;
          const active = pending.includes(t);
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggle(t)}
              className={cn(
                'group flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition',
                active
                  ? 'border-wash-brand bg-wash-brand/5 text-wash-brand ring-2 ring-wash-brand/20'
                  : 'border-wash-border text-wash-text-strong hover:border-wash-brand/40 hover:bg-wash-surface-2'
              )}
            >
              <span className={cn('flex h-7 w-7 items-center justify-center rounded-md ring-1', meta.tone)}>
                <Icon size={13} />
              </span>
              <span className="flex-1 truncate">{t}</span>
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
        })}
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

// ----- subcomponents -----

function ActionButton({
  icon: Icon,
  tone,
  title,
  onClick,
  disabled = false,
}: {
  icon: typeof Eye;
  tone: 'neutral' | 'approve' | 'reject';
  title: string;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
}) {
  const cls = {
    neutral:
      'text-wash-text-muted ring-wash-border hover:bg-wash-surface-2 hover:text-wash-text-strong hover:ring-wash-text-muted/40',
    approve: 'text-emerald-700 ring-emerald-500/30 hover:bg-emerald-500/10 hover:ring-emerald-500',
    reject: 'text-rose-600 ring-rose-500/30 hover:bg-rose-500/10 hover:ring-rose-500',
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-lg ring-1 transition',
        cls,
        disabled && 'cursor-not-allowed opacity-40 hover:bg-transparent'
      )}
    >
      <Icon size={15} />
    </button>
  );
}

function CounterCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof ClipboardList;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-wash-border bg-wash-surface px-4 py-2.5">
      <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg ring-1', tone)}>
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[10px] font-semibold uppercase tracking-wider text-wash-text-muted">{label}</div>
        <div className="font-display text-xl font-black leading-tight text-wash-text-strong tabular-nums">{value}</div>
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, value }: { icon?: typeof Eye; label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-wash-text-muted">
        {Icon && <Icon size={11} />}
        {label}
      </div>
      <div className="mt-0.5 text-sm font-medium text-wash-text-strong">{value}</div>
    </div>
  );
}
