import { useMemo, useState } from 'react';
import { Check, X, Eye } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { Modal, ModalActions } from '@/components/Modal';
import { StatusBadge } from '@/components/StatusBadge';
import { useAppStore } from '@/store/useAppStore';
import { formatToday, currentTime } from '@/lib/utils';
import type { Aprobacion } from '@/types/domain';

export function Aprobaciones() {
  const aprobaciones = useAppStore((s) => s.CollectAprobaciones);
  const patchAprobacion = useAppStore((s) => s.patchAprobacion);
  const patchCompra = useAppStore((s) => s.patchCompra);
  const pedidos = useAppStore((s) => s.CollectCompras);
  const VarUsuario = useAppStore((s) => s.VarUsuario);

  const [query, setQuery] = useState('');
  const [viewing, setViewing] = useState<Aprobacion | null>(null);
  const [rejecting, setRejecting] = useState<Aprobacion | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return aprobaciones
      .filter((a) => a.Aprobada_AP === 'NO' && a.Rechazada_AP === 'NO')
      .filter(
        (a) =>
          a.TipoAprobacion_AP.toLowerCase().includes(q) ||
          a.ConcatAprobacion_AP.toLowerCase().includes(q) ||
          a.Status_AP.toLowerCase().includes(q)
      );
  }, [aprobaciones, query]);

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
      width: '200px',
      render: (a) => (
        <span className="rounded-full bg-wash-primary/10 px-2.5 py-0.5 text-xs font-semibold text-wash-primary">
          {a.TipoAprobacion_AP}
        </span>
      ),
    },
    {
      key: 'concat',
      header: 'Descripción',
      render: (a) => (
        <div className="font-display font-bold text-wash-accent">{a.ConcatAprobacion_AP}</div>
      ),
    },
    { key: 'fecha', header: 'Fecha gen.', width: '120px', render: (a) => a.FechaGen_AP },
    {
      key: 'status',
      header: 'Estado',
      width: '140px',
      render: (a) => <StatusBadge status={a.Status_AP} />,
    },
    {
      key: 'actions',
      header: '',
      width: '160px',
      align: 'right',
      truncate: false,
      render: (a) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setViewing(a);
            }}
            className="rounded-md p-1.5 text-wash-text-muted hover:bg-wash-canvas hover:text-wash-primary"
          >
            <Eye size={14} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              approve(a);
            }}
            className="rounded-md bg-emerald-50 p-1.5 text-emerald-700 hover:bg-emerald-100"
            title="Aprobar"
          >
            <Check size={14} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setRejecting(a);
              setRejectReason('');
            }}
            className="rounded-md bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100"
            title="Rechazar"
          >
            <X size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex h-full w-full flex-col">
      <PageHeader
        title="Aprobaciones"
        subtitle="Solicitudes pendientes de revisión"
        search={{ value: query, onChange: setQuery, placeholder: 'Buscar por tipo o descripción' }}
      />
      <div className="flex-1 overflow-hidden p-6">
        <DataTable
          rows={filtered}
          rowKey={(r) => r.ID}
          columns={columns}
          empty="No hay aprobaciones pendientes"
        />
      </div>

      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing?.TipoAprobacion_AP ?? ''}
        width={520}
      >
        {viewing && (
          <div className="space-y-3 text-sm">
            <div>
              <Label>Descripción</Label>
              <p className="mt-1 text-wash-text-strong">{viewing.ConcatAprobacion_AP}</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Generada" value={viewing.FechaGen_AP} />
              <Field label="Estado" value={<StatusBadge status={viewing.Status_AP} />} />
              <Field label="ID" value={`#${viewing.ID}`} />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title="Rechazar solicitud"
      >
        {rejecting && (
          <>
            <p className="text-sm text-wash-text">{rejecting.ConcatAprobacion_AP}</p>
            <div className="mt-4">
              <Label>Motivo</Label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="mt-1 w-full rounded-lg border border-wash-border bg-wash-canvas px-3 py-2"
              />
            </div>
            <ModalActions>
              <button
                type="button"
                onClick={() => setRejecting(null)}
                className="rounded-lg border border-wash-border px-4 py-2 font-medium text-wash-text-strong hover:bg-wash-canvas"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  reject(rejecting, rejectReason);
                  setRejecting(null);
                }}
                className="rounded-lg bg-rose-600 px-4 py-2 font-medium text-white hover:brightness-110"
              >
                Rechazar
              </button>
            </ModalActions>
          </>
        )}
      </Modal>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-semibold uppercase tracking-wider text-wash-text-muted">
      {children}
    </label>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-wash-text-muted">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-medium text-wash-text-strong">{value}</div>
    </div>
  );
}
