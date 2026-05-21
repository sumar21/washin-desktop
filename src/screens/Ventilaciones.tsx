import { useMemo, useState } from 'react';
import { Wind, UserCog, Eye } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { Modal, ModalActions } from '@/components/Modal';
import { StatusBadge } from '@/components/StatusBadge';
import { useAppStore } from '@/store/useAppStore';
import type { Ventilacion } from '@/types/domain';

export function Ventilaciones() {
  const ventilaciones = useAppStore((s) => s.CollectVentilaciones);
  const usuarios = useAppStore((s) => s.CollectUser);
  const edificios = useAppStore((s) => s.CollectEdificios);
  const patchVentilacion = useAppStore((s) => s.patchVentilacion);

  const [query, setQuery] = useState('');
  const [filterEstado, setFilterEstado] = useState<Ventilacion['Estado_VE'] | 'Todos'>('Todos');
  const [filterEdif, setFilterEdif] = useState<string>('Todos');
  const [filterOpen, setFilterOpen] = useState(false);
  const [assigning, setAssigning] = useState<Ventilacion | null>(null);
  const [newTec, setNewTec] = useState('');
  const [viewing, setViewing] = useState<Ventilacion | null>(null);

  const tecnicos = usuarios.filter((u) => u.Rol === 'Tecnico' && u.Status === 'ALTA');

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return ventilaciones
      .filter((v) => (filterEstado === 'Todos' ? true : v.Estado_VE === filterEstado))
      .filter((v) => (filterEdif === 'Todos' ? true : v.Edificio_VE === filterEdif))
      .filter(
        (v) =>
          v.Edificio_VE.toLowerCase().includes(q) ||
          v.Grupo_VE.toLowerCase().includes(q) ||
          v.Estado_VE.toLowerCase().includes(q)
      )
      .sort((a, b) => (a.Orden_VE ?? 99) - (b.Orden_VE ?? 99));
  }, [ventilaciones, query, filterEstado, filterEdif]);

  const columns: Column<Ventilacion>[] = [
    {
      key: 'edif',
      header: 'Edificio',
      width: '240px',
      render: (v) => (
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-wash-primary/10 p-1.5 text-wash-primary">
            <Wind size={14} />
          </div>
          <span className="font-display font-bold text-wash-accent">{v.Edificio_VE}</span>
        </div>
      ),
    },
    { key: 'grupo', header: 'Grupo', render: (v) => v.Grupo_VE },
    { key: 'frec', header: 'Frecuencia', width: '120px', render: (v) => v.Frecuencia_VE },
    {
      key: 'ult',
      header: 'Última',
      width: '120px',
      render: (v) => v.FechaUltima_VE ?? 'Primera vez',
    },
    {
      key: 'prox',
      header: 'Próxima',
      width: '120px',
      render: (v) => (
        <span className="font-semibold text-wash-text-strong">
          {v.FechaProgramada_VE ?? v.ProximaLimpieza_VE}
        </span>
      ),
    },
    { key: 'tec', header: 'Asignado', width: '160px', render: (v) => v.Asignado_VE ?? '—' },
    {
      key: 'status',
      header: 'Estado',
      width: '120px',
      render: (v) => <StatusBadge status={v.Estado_VE} />,
    },
    {
      key: 'actions',
      header: '',
      width: '120px',
      align: 'right',
      truncate: false,
      render: (v) => (
        <div className="flex items-center justify-end gap-1">
          {v.Estado_VE === 'Realizada' ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setViewing(v);
              }}
              className="rounded-md p-1.5 text-wash-text-muted hover:bg-wash-canvas hover:text-wash-primary"
              title="Ver observaciones"
            >
              <Eye size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setAssigning(v);
                setNewTec(v.Asignado_VE ?? '');
              }}
              className="rounded-md p-1.5 text-wash-text-muted hover:bg-wash-canvas hover:text-wash-primary"
              title="Asignar técnico"
            >
              <UserCog size={14} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex h-full w-full flex-col">
      <PageHeader
        title="Ventilaciones"
        subtitle="Mantenimiento preventivo"
        search={{ value: query, onChange: setQuery, placeholder: 'Edificio, grupo, estado…' }}
        onFilter={() => setFilterOpen(true)}
      />
      <div className="flex-1 overflow-hidden p-6">
        <DataTable
          rows={filtered}
          rowKey={(r) => r.ID}
          columns={columns}
          empty="Sin ventilaciones para los filtros aplicados."
        />
      </div>

      {/* Asignar */}
      <Modal open={!!assigning} onClose={() => setAssigning(null)} title="Asignar técnico">
        {assigning && (
          <>
            <p className="text-sm text-wash-text">
              {assigning.Edificio_VE} — {assigning.Grupo_VE}
            </p>
            <div className="mt-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-wash-text-muted">
                Técnico
              </label>
              <select
                value={newTec}
                onChange={(e) => setNewTec(e.target.value)}
                className="mt-1 w-full rounded-lg border border-wash-border bg-wash-canvas px-3 py-2"
              >
                <option value="">— Sin asignar —</option>
                {tecnicos.map((t) => (
                  <option key={t.ID} value={t.Concat_Nombre_Apellido}>
                    {t.Concat_Nombre_Apellido}
                  </option>
                ))}
              </select>
            </div>
            <ModalActions>
              <button
                type="button"
                onClick={() => setAssigning(null)}
                className="rounded-lg border border-wash-border px-4 py-2 font-medium text-wash-text-strong hover:bg-wash-canvas"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  patchVentilacion(assigning.ID, {
                    Asignado_VE: newTec || undefined,
                    Estado_VE: newTec ? 'Asignada' : 'Pendiente',
                  });
                  setAssigning(null);
                }}
                className="rounded-lg bg-wash-primary px-4 py-2 font-medium text-white hover:brightness-110"
              >
                Guardar
              </button>
            </ModalActions>
          </>
        )}
      </Modal>

      {/* Filtro */}
      <Modal open={filterOpen} onClose={() => setFilterOpen(false)} title="Filtrar ventilaciones">
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-wash-text-muted">
              Estado
            </label>
            <select
              value={filterEstado}
              onChange={(e) =>
                setFilterEstado(e.target.value as Ventilacion['Estado_VE'] | 'Todos')
              }
              className="mt-1 w-full rounded-lg border border-wash-border bg-wash-canvas px-3 py-2"
            >
              <option value="Todos">Todos</option>
              <option value="Pendiente">Pendiente</option>
              <option value="Asignada">Asignada</option>
              <option value="Programada">Programada</option>
              <option value="Realizada">Realizada</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-wash-text-muted">
              Edificio
            </label>
            <select
              value={filterEdif}
              onChange={(e) => setFilterEdif(e.target.value)}
              className="mt-1 w-full rounded-lg border border-wash-border bg-wash-canvas px-3 py-2"
            >
              <option value="Todos">Todos</option>
              {edificios.map((e) => (
                <option key={e.ID} value={e.Edificio}>
                  {e.Edificio}
                </option>
              ))}
            </select>
          </div>
        </div>
        <ModalActions>
          <button
            type="button"
            onClick={() => {
              setFilterEstado('Todos');
              setFilterEdif('Todos');
              setFilterOpen(false);
            }}
            className="rounded-lg border border-wash-border px-4 py-2 font-medium text-wash-text-strong hover:bg-wash-canvas"
          >
            Limpiar
          </button>
          <button
            type="button"
            onClick={() => setFilterOpen(false)}
            className="rounded-lg bg-wash-primary px-4 py-2 font-medium text-white hover:brightness-110"
          >
            Aplicar
          </button>
        </ModalActions>
      </Modal>

      {/* Observaciones */}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing ? `${viewing.Edificio_VE} — ${viewing.Grupo_VE}` : ''}
      >
        {viewing && (
          <>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Asignado" value={viewing.Asignado_VE ?? '—'} />
              <Field label="Última limpieza" value={viewing.FechaUltima_VE ?? '—'} />
            </div>
            {viewing.ObservacionResuelto_VE && (
              <div className="mt-4 rounded-lg bg-wash-canvas p-3 text-sm">
                {viewing.ObservacionResuelto_VE}
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
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
