import { useMemo, useState } from 'react';
import { History, ArrowLeftRight, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { Modal, ModalActions, ConfirmDialog } from '@/components/Modal';
import { StatusBadge } from '@/components/StatusBadge';
import { useAppStore } from '@/store/useAppStore';
import { proper } from '@/lib/utils';
import type { DetalleMaquina as Maquina } from '@/types/domain';

export function DetalleMaquina() {
  const maquinas = useAppStore((s) => s.CollectDetalleMaquina);
  const edificios = useAppStore((s) => s.CollectEdificios);
  const incidentes = useAppStore((s) => s.CollectIncidentes);
  const patchMaquina = useAppStore((s) => s.patchMaquina);
  const VarTipoUser = useAppStore((s) => s.VarTipoUser);

  const [edificio, setEdificio] = useState<string>(edificios[0]?.Edificio ?? '');
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<Maquina | null>(null);
  const [deleting, setDeleting] = useState<Maquina | null>(null);
  const [transferring, setTransferring] = useState<Maquina | null>(null);
  const [destEdificio, setDestEdificio] = useState('');

  const canManage = VarTipoUser === 'Admin' || VarTipoUser === 'Jefe Taller';

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return maquinas
      .filter((m) => m.Status_DM !== 'ELIMINADA' && m.Edificio_DM === edificio)
      .filter(
        (m) =>
          m.Marca_DM.toLowerCase().includes(q) ||
          m.Modelo_DM.toLowerCase().includes(q) ||
          m.NroSerie_DM.toLowerCase().includes(q) ||
          m.IDMaquina_DM.toLowerCase().includes(q)
      );
  }, [maquinas, edificio, query]);

  const historialDe = (m: Maquina) =>
    incidentes.filter((i) => i.ConcatMaquina_IN === m.ConcatMaquinaIncidente_DM);

  const columns: Column<Maquina>[] = [
    {
      key: 'id',
      header: 'ID Máquina',
      width: '150px',
      render: (m) => <span className="font-mono text-xs">{m.IDMaquina_DM}</span>,
    },
    {
      key: 'marca',
      header: 'Marca',
      width: '120px',
      render: (m) => <span className="font-semibold">{m.Marca_DM}</span>,
    },
    { key: 'modelo', header: 'Modelo', width: '160px', render: (m) => m.Modelo_DM },
    { key: 'serie', header: 'N° Serie', width: '140px', render: (m) => m.NroSerie_DM },
    {
      key: 'segmento',
      header: 'Segmento',
      width: '160px',
      render: (m) => (
        <span className="rounded-full bg-wash-primary/10 px-2 py-0.5 text-xs font-semibold text-wash-primary">
          {m.Segmento_DM}
        </span>
      ),
    },
    {
      key: 'encendido',
      header: 'Encendido',
      width: '120px',
      render: (m) => m.Encendido_DM ?? '—',
    },
    {
      key: 'status',
      header: 'Status',
      width: '120px',
      render: (m) => <StatusBadge status={m.Status_DM} />,
    },
    {
      key: 'actions',
      header: '',
      width: '140px',
      align: 'right',
      truncate: false,
      render: (m) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setHistory(m);
            }}
            className="rounded-md p-1.5 text-wash-text-muted hover:bg-wash-canvas hover:text-wash-primary"
            title="Historial"
          >
            <History size={14} />
          </button>
          {canManage && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setTransferring(m);
                setDestEdificio('');
              }}
              className="rounded-md p-1.5 text-wash-text-muted hover:bg-wash-canvas hover:text-wash-primary"
              title="Transferir"
            >
              <ArrowLeftRight size={14} />
            </button>
          )}
          {canManage && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDeleting(m);
              }}
              className="rounded-md p-1.5 text-rose-600 hover:bg-rose-50"
              title="Dar de baja"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex h-full w-full flex-col">
      <PageHeader
        title="Detalle Máquinas"
        subtitle={edificio}
        search={{ value: query, onChange: setQuery, placeholder: 'Marca, modelo, serie…' }}
        rightExtra={
          <select
            value={edificio}
            onChange={(e) => setEdificio(e.target.value)}
            className="rounded-full bg-wash-canvas px-3.5 py-2 text-sm font-medium text-wash-text-strong ring-1 ring-wash-border"
          >
            {edificios.map((e) => (
              <option key={e.ID} value={e.Edificio}>
                {e.Edificio}
              </option>
            ))}
          </select>
        }
      />
      <div className="flex-1 overflow-hidden p-6">
        <DataTable
          rows={filtered}
          rowKey={(r) => r.ID}
          columns={columns}
          empty="Sin máquinas instaladas en este edificio."
        />
      </div>

      {/* Historial */}
      <Modal
        open={!!history}
        onClose={() => setHistory(null)}
        title={history ? `Historial — ${history.ConcatMaquina_DM}` : ''}
        width={620}
      >
        {history && (
          <div>
            {historialDe(history).length === 0 ? (
              <p className="text-sm text-wash-text-muted">No hay incidentes históricos.</p>
            ) : (
              <ul className="space-y-2">
                {historialDe(history).map((i) => (
                  <li
                    key={i.ID}
                    className="rounded-xl bg-wash-canvas px-4 py-3 ring-1 ring-wash-border"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-wash-text-muted">{i.Fecha_IN}</span>
                      <StatusBadge status={i.Status_IN} />
                    </div>
                    <div className="mt-1 font-display font-bold text-wash-accent">
                      {proper(i.Titulo_IN)}
                    </div>
                    {i.DescripcionIncidente_IN && (
                      <p className="mt-1 text-sm text-wash-text">{i.DescripcionIncidente_IN}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Modal>

      {/* Transferencia */}
      <Modal
        open={!!transferring}
        onClose={() => setTransferring(null)}
        title="Transferir máquina"
      >
        {transferring && (
          <>
            <p className="text-sm text-wash-text">
              {transferring.ConcatMaquina_DM} (actual: {transferring.Edificio_DM})
            </p>
            <div className="mt-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-wash-text-muted">
                Destino
              </label>
              <select
                value={destEdificio}
                onChange={(e) => setDestEdificio(e.target.value)}
                className="mt-1 w-full rounded-lg border border-wash-border bg-wash-canvas px-3 py-2"
              >
                <option value="">— Seleccionar —</option>
                {edificios.map((e) => (
                  <option key={e.ID} value={e.Edificio}>
                    {e.Edificio}
                  </option>
                ))}
              </select>
            </div>
            <ModalActions>
              <button
                type="button"
                onClick={() => setTransferring(null)}
                className="rounded-lg border border-wash-border px-4 py-2 font-medium text-wash-text-strong hover:bg-wash-canvas"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!destEdificio}
                onClick={() => {
                  if (destEdificio === 'Wash Inn (Depósito)')
                    patchMaquina(transferring.ID, {
                      Edificio_DM: destEdificio,
                      Status_DM: 'DEPOSITO',
                    });
                  else
                    patchMaquina(transferring.ID, {
                      Edificio_DM: destEdificio,
                      Status_DM: 'INSTALADA',
                    });
                  setTransferring(null);
                }}
                className="rounded-lg bg-wash-primary px-4 py-2 font-medium text-white hover:brightness-110 disabled:opacity-60"
              >
                Transferir
              </button>
            </ModalActions>
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        tone="danger"
        title="Dar de baja"
        message={
          deleting
            ? `¿Querés dar de baja la máquina ${deleting.IDMaquina_DM}? Se generará un registro "Baja de Maquina".`
            : ''
        }
        confirmLabel="Dar de baja"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) patchMaquina(deleting.ID, { Status_DM: 'ELIMINADA' });
          setDeleting(null);
        }}
      />
    </div>
  );
}
