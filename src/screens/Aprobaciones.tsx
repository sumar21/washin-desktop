import { useMemo, useState } from 'react';
import {
  Check,
  X,
  Eye,
  ShoppingCart,
  Wrench,
  ArrowLeftRight,
  ClipboardList,
  Clock,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { Modal, ModalActions } from '@/components/Modal';
import { StatusBadge } from '@/components/StatusBadge';
import { useAppStore } from '@/store/useAppStore';
import { cn, formatToday, currentTime } from '@/lib/utils';
import type { Aprobacion } from '@/types/domain';

type TipoAprobacion = Aprobacion['TipoAprobacion_AP'];

const tipoMeta: Record<
  TipoAprobacion,
  { icon: typeof ShoppingCart; tone: string }
> = {
  Compra: {
    icon: ShoppingCart,
    tone: 'bg-sky-100 text-sky-800 ring-sky-300/70',
  },
  'Cambio de Maquina': {
    icon: Wrench,
    tone: 'bg-amber-100 text-amber-800 ring-amber-300/70',
  },
  'Transferencia de Maquina': {
    icon: ArrowLeftRight,
    tone: 'bg-violet-100 text-violet-800 ring-violet-300/70',
  },
};

const TIPOS: TipoAprobacion[] = [
  'Compra',
  'Cambio de Maquina',
  'Transferencia de Maquina',
];

export function Aprobaciones() {
  const aprobaciones = useAppStore((s) => s.CollectAprobaciones);
  const patchAprobacion = useAppStore((s) => s.patchAprobacion);
  const patchCompra = useAppStore((s) => s.patchCompra);
  const pedidos = useAppStore((s) => s.CollectCompras);
  const VarUsuario = useAppStore((s) => s.VarUsuario);

  const [query, setQuery] = useState('');
  const [filterTipo, setFilterTipo] = useState<TipoAprobacion | 'Todos'>('Todos');
  const [filterOpen, setFilterOpen] = useState(false);
  const [viewing, setViewing] = useState<Aprobacion | null>(null);
  const [approving, setApproving] = useState<Aprobacion | null>(null);
  const [rejecting, setRejecting] = useState<Aprobacion | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const pending = useMemo(
    () => aprobaciones.filter((a) => a.Aprobada_AP === 'NO' && a.Rechazada_AP === 'NO'),
    [aprobaciones]
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return pending
      .filter((a) => (filterTipo === 'Todos' ? true : a.TipoAprobacion_AP === filterTipo))
      .filter(
        (a) =>
          a.TipoAprobacion_AP.toLowerCase().includes(q) ||
          a.ConcatAprobacion_AP.toLowerCase().includes(q) ||
          a.Status_AP.toLowerCase().includes(q)
      );
  }, [pending, query, filterTipo]);

  const countByTipo = useMemo(() => {
    const map: Record<string, number> = {};
    TIPOS.forEach((t) => {
      map[t] = pending.filter((p) => p.TipoAprobacion_AP === t).length;
    });
    return map;
  }, [pending]);

  const approve = (a: Aprobacion) => {
    patchAprobacion(a.ID, {
      Aprobada_AP: 'SI',
      Status_AP: 'Aprobada',
      Fecha_AP: formatToday(),
      Hora_AP: currentTime(),
      User_AP: VarUsuario ?? '',
    });
    if (a.TipoAprobacion_AP === 'Compra' && a.IDCompra_AP) {
      const pedido = pedidos.find((p) => String(p.ID) === a.IDCompra_AP);
      if (pedido) patchCompra(pedido.ID, { Status_PC: 'Aprobada' });
    }
  };

  const reject = (a: Aprobacion, reason: string) => {
    patchAprobacion(a.ID, {
      Rechazada_AP: 'SI',
      Status_AP: 'Rechazada',
      InfoRechazo_AP: reason,
      Fecha_AP: formatToday(),
      Hora_AP: currentTime(),
      User_AP: VarUsuario ?? '',
    });
    if (a.TipoAprobacion_AP === 'Compra' && a.IDCompra_AP) {
      const pedido = pedidos.find((p) => String(p.ID) === a.IDCompra_AP);
      if (pedido) patchCompra(pedido.ID, { Status_PC: 'Rechazada', Filtrar_PC: 'SI' });
    }
  };

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
      render: (a) => (
        <div className="font-display font-bold text-wash-accent">
          {a.ConcatAprobacion_AP}
        </div>
      ),
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
      width: '150px',
      align: 'right',
      truncate: false,
      render: (a) => (
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
            title="Aprobar"
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
              setRejectReason('');
            }}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="flex h-full w-full flex-col">
      <PageHeader
        title="Aprobaciones"
        subtitle="Solicitudes pendientes de revisión"
        search={{
          value: query,
          onChange: setQuery,
          placeholder: 'Buscar tipo o descripción…',
        }}
        onFilter={() => setFilterOpen(true)}
      />

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3 border-b border-wash-border bg-wash-surface px-6 py-4">
        <CounterCard
          icon={ClipboardList}
          label="Pendientes totales"
          value={pending.length}
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

      {/* Active filter chip */}
      {filterTipo !== 'Todos' && (
        <div className="flex items-center gap-2 border-b border-wash-border bg-wash-surface-2/40 px-6 py-2 text-xs text-wash-text-muted">
          <span className="font-semibold uppercase tracking-wider">Filtro activo:</span>
          <span className="rounded-full bg-wash-brand/10 px-2.5 py-0.5 font-semibold text-wash-brand">
            {filterTipo}
          </span>
          <button
            type="button"
            onClick={() => setFilterTipo('Todos')}
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
          empty={
            <div className="flex flex-col items-center justify-center text-center">
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20">
                <Check size={22} />
              </div>
              <p className="text-sm font-semibold text-wash-text-strong">
                Sin aprobaciones pendientes
              </p>
              <p className="mt-1 text-xs text-wash-text-muted">
                {filterTipo === 'Todos'
                  ? 'Todas las solicitudes fueron resueltas.'
                  : `No hay solicitudes de tipo "${filterTipo}".`}
              </p>
            </div>
          }
        />
      </div>

      {/* Filter modal */}
      <Modal
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Filtrar aprobaciones"
        width={460}
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-wash-text-muted">
              Tipo de aprobación
            </label>
            <div className="mt-2 grid grid-cols-1 gap-2">
              <FilterChip
                label="Todos"
                icon={ClipboardList}
                active={filterTipo === 'Todos'}
                onClick={() => setFilterTipo('Todos')}
                tone="bg-wash-brand/10 text-wash-brand ring-wash-brand/20"
              />
              {TIPOS.map((t) => {
                const meta = tipoMeta[t];
                return (
                  <FilterChip
                    key={t}
                    label={t}
                    icon={meta.icon}
                    active={filterTipo === t}
                    onClick={() => setFilterTipo(t)}
                    tone={meta.tone}
                  />
                );
              })}
            </div>
          </div>
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

      {/* View detail */}
      <ViewDetailModal viewing={viewing} onClose={() => setViewing(null)} />


      {/* Approve confirmation */}
      <ApproveConfirmModal
        approving={approving}
        onCancel={() => setApproving(null)}
        onConfirm={() => {
          if (approving) approve(approving);
          setApproving(null);
        }}
      />

      {/* Reject confirmation */}
      <RejectConfirmModal
        rejecting={rejecting}
        reason={rejectReason}
        onReasonChange={setRejectReason}
        onCancel={() => {
          setRejecting(null);
          setRejectReason('');
        }}
        onConfirm={() => {
          if (rejecting) reject(rejecting, rejectReason);
          setRejecting(null);
          setRejectReason('');
        }}
      />
    </div>
  );
}

// ----- reject confirmation modal -----

function RejectConfirmModal({
  rejecting,
  reason,
  onReasonChange,
  onCancel,
  onConfirm,
}: {
  rejecting: Aprobacion | null;
  reason: string;
  onReasonChange: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!rejecting) return null;
  const meta = tipoMeta[rejecting.TipoAprobacion_AP];
  const Icon = meta.icon;

  const consequence: Record<TipoAprobacion, string> = {
    Compra: 'El pedido pasará a estado Rechazada y los items asociados quedarán anulados.',
    'Cambio de Maquina': 'Se rechazará la solicitud de cambio. El técnico recibirá la notificación con el motivo.',
    'Transferencia de Maquina': 'Se cancelará la transferencia. La máquina permanecerá en su edificio actual.',
  };

  return (
    <Modal open={!!rejecting} onClose={onCancel} title="" width={480}>
      <div className="-mt-2 flex flex-col items-center text-center">
        {/* Big X icon */}
        <div className="relative mb-4">
          <span className="absolute inset-0 animate-ping rounded-full bg-rose-400/30" />
          <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-rose-600 shadow-lg shadow-rose-500/40">
            <X size={32} strokeWidth={3} className="text-white" />
          </span>
        </div>

        <h2 className="font-display text-xl font-black text-wash-text-strong">
          Rechazar solicitud
        </h2>
        <p className="mt-1 max-w-[340px] text-sm text-wash-text-muted">
          Esta acción no se puede deshacer.
        </p>

        {/* Solicitud card */}
        <div className="mt-5 w-full rounded-xl bg-wash-surface-2/50 p-4 text-left">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1',
                meta.tone
              )}
            >
              <Icon size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-black text-wash-accent">
                {rejecting.ConcatAprobacion_AP}
              </p>
              <p className="mt-0.5 text-[11px] text-wash-text-muted">
                {rejecting.TipoAprobacion_AP} · #{rejecting.ID}
              </p>
            </div>
          </div>
        </div>

        {/* Motivo */}
        <div className="mt-4 w-full text-left">
          <label className="text-xs font-semibold uppercase tracking-wider text-wash-text-muted">
            Motivo del rechazo
          </label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="Detallá el motivo por el cual se rechaza esta solicitud…"
            className="mt-1.5 w-full rounded-lg border border-wash-border bg-wash-surface px-3 py-2 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15"
          />
        </div>

        {/* Consequence */}
        <div className="mt-3 w-full rounded-lg bg-rose-50 px-3 py-2.5 text-left text-xs text-rose-900 ring-1 ring-rose-200">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
            <span>
              <span className="font-semibold">Al confirmar: </span>
              {consequence[rejecting.TipoAprobacion_AP]}
            </span>
          </div>
        </div>
      </div>

      <ModalActions>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-wash-border px-5 py-2.5 font-medium text-wash-text-strong hover:bg-wash-surface-2"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!reason.trim()}
          onClick={onConfirm}
          className="flex items-center gap-2 rounded-lg bg-rose-600 px-5 py-2.5 font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X size={16} strokeWidth={2.5} />
          Rechazar
        </button>
      </ModalActions>
    </Modal>
  );
}

// ----- approve confirmation modal -----

function ApproveConfirmModal({
  approving,
  onCancel,
  onConfirm,
}: {
  approving: Aprobacion | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!approving) return null;
  const meta = tipoMeta[approving.TipoAprobacion_AP];
  const Icon = meta.icon;

  const consequence: Record<TipoAprobacion, string> = {
    Compra: 'El pedido pasará a estado Aprobada y sus items quedarán habilitados para recibirse.',
    'Cambio de Maquina': 'Se autoriza el reemplazo de la máquina por la nueva. El técnico recibirá la notificación.',
    'Transferencia de Maquina': 'La máquina será movida al edificio destino y se actualizará su estado.',
  };

  return (
    <Modal open={!!approving} onClose={onCancel} title="" width={480}>
      <div className="-mt-2 flex flex-col items-center text-center">
        {/* Big check icon */}
        <div className="relative mb-4">
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/30" />
          <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/40">
            <Check size={32} strokeWidth={3} className="text-white" />
          </span>
        </div>

        <h2 className="font-display text-xl font-black text-wash-text-strong">
          Confirmar aprobación
        </h2>
        <p className="mt-1 max-w-[340px] text-sm text-wash-text-muted">
          Esta acción no se puede deshacer.
        </p>

        {/* Solicitud card */}
        <div className="mt-5 w-full rounded-xl bg-wash-surface-2/50 p-4 text-left">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1',
                meta.tone
              )}
            >
              <Icon size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-black text-wash-accent">
                {approving.ConcatAprobacion_AP}
              </p>
              <p className="mt-0.5 text-[11px] text-wash-text-muted">
                {approving.TipoAprobacion_AP} · #{approving.ID}
              </p>
            </div>
          </div>
        </div>

        {/* Consequence */}
        <div className="mt-3 w-full rounded-lg bg-emerald-50 px-3 py-2.5 text-left text-xs text-emerald-900 ring-1 ring-emerald-200">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
            <span>
              <span className="font-semibold">Al confirmar: </span>
              {consequence[approving.TipoAprobacion_AP]}
            </span>
          </div>
        </div>
      </div>

      <ModalActions>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-wash-border px-5 py-2.5 font-medium text-wash-text-strong hover:bg-wash-surface-2"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white transition hover:bg-emerald-700"
        >
          <Check size={16} strokeWidth={2.5} />
          Aprobar
        </button>
      </ModalActions>
    </Modal>
  );
}

// ----- detail modal -----

function ViewDetailModal({
  viewing,
  onClose,
}: {
  viewing: Aprobacion | null;
  onClose: () => void;
}) {
  const pedidos = useAppStore((s) => s.CollectCompras);
  const detalles = useAppStore((s) => s.CollectDetalleCompras);
  const maquinas = useAppStore((s) => s.CollectDetalleMaquina);

  if (!viewing) return null;

  const meta = tipoMeta[viewing.TipoAprobacion_AP];
  const Icon = meta.icon;

  // Lookup related data
  const pedido =
    viewing.TipoAprobacion_AP === 'Compra' && viewing.IDCompra_AP
      ? pedidos.find((p) => String(p.ID) === viewing.IDCompra_AP)
      : null;
  const pedidoDetalles = pedido
    ? detalles.filter((d) => d.IDCompra_DC === pedido.IDUnivoco_PC)
    : [];

  const maquina =
    (viewing.TipoAprobacion_AP === 'Cambio de Maquina' ||
      viewing.TipoAprobacion_AP === 'Transferencia de Maquina') &&
    viewing.IDRegistroDM_AP
      ? maquinas.find((m) => String(m.ID) === viewing.IDRegistroDM_AP)
      : null;

  return (
    <Modal
      open={!!viewing}
      onClose={onClose}
      title={viewing.TipoAprobacion_AP}
      width={600}
    >
      <div className="space-y-5">
        {/* Header card */}
        <div className="rounded-xl bg-wash-surface-2/50 p-4">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ring-1',
                meta.tone
              )}
            >
              <Icon size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-base font-black text-wash-accent">
                {viewing.ConcatAprobacion_AP}
              </p>
              <p className="mt-0.5 text-xs text-wash-text-muted">
                Solicitud #{viewing.ID}
              </p>
            </div>
            <StatusBadge status={viewing.Status_AP} />
          </div>
        </div>

        {/* Metadata grid */}
        <div className="grid grid-cols-3 gap-3">
          <Field icon={Clock} label="Generada" value={viewing.FechaGen_AP} />
          <Field label="Mes/Año" value={viewing.FechaMesAnoGen_AP} />
          <Field label="ID Solicitud" value={`#${viewing.ID}`} />
        </div>

        {/* Type-specific detail */}
        {viewing.TipoAprobacion_AP === 'Compra' && (
          <CompraDetail pedido={pedido} detalles={pedidoDetalles} />
        )}

        {viewing.TipoAprobacion_AP === 'Cambio de Maquina' && (
          <MaquinaDetail
            maquina={maquina}
            heading="Detalle del cambio"
            description="Cambio de máquina solicitado por el técnico. La nueva máquina reemplazará a la existente en el edificio indicado."
          />
        )}

        {viewing.TipoAprobacion_AP === 'Transferencia de Maquina' && (
          <MaquinaDetail
            maquina={maquina}
            heading="Detalle de la transferencia"
            description="Solicitud de mover la máquina entre edificios (o al depósito Wash Inn)."
          />
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
  pedido: ReturnType<
    typeof useAppStore.getState
  >['CollectCompras'][number] | null | undefined;
  detalles: ReturnType<
    typeof useAppStore.getState
  >['CollectDetalleCompras'];
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
        <p className="text-xs font-bold uppercase tracking-wider text-wash-text-muted">
          Items del pedido #{pedido.ID}
        </p>
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
            <div className="min-w-0 truncate">
              {d.Codigo_DC && (
                <span className="mr-2 rounded-md bg-wash-surface-2 px-1.5 py-0.5 text-[11px] font-semibold text-wash-text">
                  {d.Codigo_DC}
                </span>
              )}
              <span className="font-semibold text-wash-text-strong">{d.Item_DC}</span>
            </div>
            <span className="text-center font-bold text-wash-text-strong tabular-nums">
              {d.Cantidad_DC}
            </span>
            <span className="text-right">
              <StatusBadge status={d.Status_DC} />
            </span>
          </div>
        ))}
      </div>

      {pedido.Observaciones_PC && (
        <div className="mt-3 rounded-lg bg-wash-surface-2/40 p-3 text-xs text-wash-text">
          <p className="mb-1 font-semibold text-wash-text-muted uppercase tracking-wider">
            Observaciones del solicitante
          </p>
          {pedido.Observaciones_PC}
        </div>
      )}
    </div>
  );
}

function MaquinaDetail({
  maquina,
  heading,
  description,
}: {
  maquina: ReturnType<
    typeof useAppStore.getState
  >['CollectDetalleMaquina'][number] | null | undefined;
  heading: string;
  description: string;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-wash-text-muted">
        {heading}
      </p>
      <p className="mb-3 text-xs text-wash-text-muted">{description}</p>

      {!maquina ? (
        <div className="rounded-lg border border-dashed border-wash-border px-3 py-4 text-center text-xs text-wash-text-muted">
          No se encontraron los datos de la máquina asociada.
        </div>
      ) : (
        <div className="rounded-xl border border-wash-border bg-wash-surface-2/30 p-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="ID Máquina" value={maquina.IDMaquina_DM} />
            <Field label="N° Serie" value={maquina.NroSerie_DM} />
            <Field label="Marca" value={maquina.Marca_DM} />
            <Field label="Modelo" value={maquina.Modelo_DM} />
            <Field label="Segmento" value={maquina.Segmento_DM} />
            <Field label="Edificio actual" value={maquina.Edificio_DM} />
          </div>
        </div>
      )}
    </div>
  );
}

// ----- subcomponents -----

function ActionButton({
  icon: Icon,
  tone,
  title,
  onClick,
}: {
  icon: typeof Eye;
  tone: 'neutral' | 'approve' | 'reject';
  title: string;
  onClick: (e: React.MouseEvent) => void;
}) {
  const cls = {
    neutral:
      'text-wash-text-muted ring-wash-border hover:bg-wash-surface-2 hover:text-wash-text-strong hover:ring-wash-text-muted/40',
    approve:
      'text-emerald-700 ring-emerald-500/30 hover:bg-emerald-500/10 hover:ring-emerald-500',
    reject:
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
        <div className="truncate text-[10px] font-semibold uppercase tracking-wider text-wash-text-muted">
          {label}
        </div>
        <div className="font-display text-xl font-black leading-tight text-wash-text-strong tabular-nums">
          {value}
        </div>
      </div>
    </div>
  );
}

function FilterChip({
  label,
  icon: Icon,
  active,
  onClick,
  tone,
}: {
  label: string;
  icon: typeof Eye;
  active: boolean;
  onClick: () => void;
  tone: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition',
        active
          ? 'border-wash-brand bg-wash-brand/5 text-wash-brand ring-2 ring-wash-brand/20'
          : 'border-wash-border text-wash-text-strong hover:border-wash-brand/40 hover:bg-wash-surface-2'
      )}
    >
      <span
        className={cn('flex h-8 w-8 items-center justify-center rounded-md ring-1', tone)}
      >
        <Icon size={14} />
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function Field({
  icon: Icon,
  label,
  value,
}: {
  icon?: typeof Eye;
  label: string;
  value: React.ReactNode;
}) {
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
