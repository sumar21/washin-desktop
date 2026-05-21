import { useMemo, useState } from 'react';
import { Eye, UserCog, Wrench, Plus } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { Modal, ModalActions } from '@/components/Modal';
import { StatusBadge } from '@/components/StatusBadge';
import { useAppStore } from '@/store/useAppStore';
import { proper, formatToday, currentMonthYear, currentMonthName } from '@/lib/utils';
import type { Incidente } from '@/types/domain';

export function Incidentes() {
  const incidentes = useAppStore((s) => s.CollectIncidentes);
  const repuestos = useAppStore((s) => s.CollectRepuestosIncidente);
  const usuarios = useAppStore((s) => s.CollectUser);
  const edificios = useAppStore((s) => s.CollectEdificios);
  const maquinas = useAppStore((s) => s.CollectDetalleMaquina);
  const patchIncidente = useAppStore((s) => s.patchIncidente);
  const addIncidente = useAppStore((s) => s.addIncidente);
  const VarUsuario = useAppStore((s) => s.VarUsuario) ?? '';

  const [query, setQuery] = useState('');
  const [viewing, setViewing] = useState<Incidente | null>(null);
  const [assigning, setAssigning] = useState<Incidente | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newTecnico, setNewTecnico] = useState('');

  const [newEdificio, setNewEdificio] = useState('');
  const [newMaquina, setNewMaquina] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newAssign, setNewAssign] = useState('');

  const tecnicos = useMemo(
    () =>
      usuarios.filter(
        (u) =>
          u.Status === 'ALTA' &&
          (u.Rol === 'Tecnico' || u.Rol === 'Admin' || u.Rol === 'Jefe Taller')
      ),
    [usuarios]
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return [...incidentes]
      .filter((i) => i.Resuelto_IN === 'NO')
      .sort((a, b) => b.ID - a.ID)
      .filter(
        (i) =>
          i.NombreEdificio_IN.toLowerCase().includes(q) ||
          (i.ConcatMaquina_IN ?? '').toLowerCase().includes(q) ||
          i.NoResuelto_IN.toLowerCase().includes(q) ||
          (i.IDMaquina_IN ?? '').toLowerCase().includes(q)
      );
  }, [incidentes, query]);

  const repuestosDe = (idIn: string) => repuestos.filter((r) => r.IDIncidente_RI === idIn);

  const columns: Column<Incidente>[] = [
    {
      key: 'fecha',
      header: 'Fecha',
      width: '120px',
      render: (i) => i.Fecha_IN,
    },
    {
      key: 'estado',
      header: 'Estado',
      width: '160px',
      render: (i) => <StatusBadge status={i.Status_IN} />,
    },
    {
      key: 'edificio',
      header: 'Edificio',
      width: '220px',
      render: (i) => (
        <span className="font-display font-bold text-wash-accent">{i.NombreEdificio_IN}</span>
      ),
    },
    {
      key: 'maquina',
      header: 'Máquina',
      render: (i) => (i.ConcatMaquina_IN ? proper(i.ConcatMaquina_IN) : 'Sin asignar'),
    },
    {
      key: 'razon',
      header: 'Razón',
      width: '180px',
      render: (i) => (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
          {i.NoResuelto_IN}
        </span>
      ),
    },
    {
      key: 'tecnico',
      header: 'Técnico',
      width: '160px',
      render: (i) =>
        i.TecnicoAsignado_IN
          ? usuarios.find((u) => u.Usuario === i.TecnicoAsignado_IN)?.Concat_Nombre_Apellido ??
            i.TecnicoAsignado_IN
          : '—',
    },
    {
      key: 'reps',
      header: 'Reps',
      width: '70px',
      align: 'center',
      render: (i) => (
        <span className="inline-flex min-w-[28px] items-center justify-center rounded-full bg-wash-primary/10 px-2 py-0.5 text-xs font-bold text-wash-primary">
          {i.CantidadRepuestos_IN}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '140px',
      align: 'right',
      truncate: false,
      render: (i) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setViewing(i);
            }}
            className="rounded-md p-1.5 text-wash-text-muted hover:bg-wash-canvas hover:text-wash-primary"
            title="Ver detalle"
          >
            <Eye size={14} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setAssigning(i);
              setNewTecnico(i.TecnicoAsignado_IN ?? '');
            }}
            className="rounded-md p-1.5 text-wash-text-muted hover:bg-wash-canvas hover:text-wash-primary"
            title="Cambiar técnico"
          >
            <UserCog size={14} />
          </button>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="rounded-md p-1.5 text-wash-text-muted hover:bg-wash-canvas hover:text-wash-primary"
            title="Repuestos"
          >
            <Wrench size={14} />
          </button>
        </div>
      ),
    },
  ];

  const submitNew = () => {
    if (!newEdificio || !newDesc) return;
    const ID = Date.now();
    addIncidente({
      IDIncidente: `IN-${ID}`,
      Fecha_IN: formatToday(),
      FechaMes_IN: currentMonthName(),
      FechaMesAno_IN: currentMonthYear(),
      Titulo_IN: newDesc.slice(0, 60),
      NoResuelto_IN: 'Reportado Por Tecnico',
      Status_IN: newAssign ? 'Asignado' : 'A Revisar',
      Resuelto_IN: 'NO',
      NombreEdificio_IN: newEdificio,
      ConcatMaquina_IN: newMaquina || undefined,
      IDMaquina_IN: newMaquina || undefined,
      TecnicoAsignado_IN: newAssign || undefined,
      CantidadRepuestos_IN: 0,
      DescripcionIncidente_IN: newDesc,
      User_IN: VarUsuario,
    });
    setNewOpen(false);
    setNewEdificio('');
    setNewMaquina('');
    setNewDesc('');
    setNewAssign('');
  };

  return (
    <div className="flex h-full w-full flex-col">
      <PageHeader
        title="Incidentes"
        subtitle="Reportes sin resolver"
        search={{ value: query, onChange: setQuery, placeholder: 'Edificio, máquina, estado…' }}
        onAdd={() => setNewOpen(true)}
        addLabel="Nuevo incidente"
      />
      <div className="flex-1 overflow-hidden p-6">
        <DataTable
          rows={filtered}
          rowKey={(r) => r.ID}
          columns={columns}
          empty="No hay incidentes pendientes"
        />
      </div>

      {/* View */}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing ? viewing.Titulo_IN : ''}
        width={620}
      >
        {viewing && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <Info label="Estado" value={<StatusBadge status={viewing.Status_IN} />} />
              <Info label="Edificio" value={viewing.NombreEdificio_IN} />
              <Info label="Máquina" value={viewing.ConcatMaquina_IN ?? '—'} />
              <Info label="Razón" value={viewing.NoResuelto_IN} />
              <Info
                label="Técnico"
                value={
                  viewing.TecnicoAsignado_IN
                    ? usuarios.find((u) => u.Usuario === viewing.TecnicoAsignado_IN)
                        ?.Concat_Nombre_Apellido ?? viewing.TecnicoAsignado_IN
                    : '—'
                }
              />
              <Info label="Fecha" value={viewing.Fecha_IN} />
            </div>
            {viewing.DescripcionIncidente_IN && (
              <div className="rounded-lg bg-wash-canvas p-3 text-sm">
                {viewing.DescripcionIncidente_IN}
              </div>
            )}
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-wash-text-muted">
                Repuestos solicitados
              </div>
              {repuestosDe(viewing.IDIncidente).length === 0 ? (
                <p className="text-sm text-wash-text-muted">Sin repuestos.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {repuestosDe(viewing.IDIncidente).map((r) => (
                    <li
                      key={r.ID}
                      className="flex items-center justify-between rounded-lg bg-wash-canvas px-3 py-1.5"
                    >
                      <span>{r.Repuesto_RI}</span>
                      <span className="font-bold text-wash-primary">{r.Cantidad_RI}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Reassign tecnico */}
      <Modal
        open={!!assigning}
        onClose={() => setAssigning(null)}
        title="Cambiar técnico asignado"
      >
        {assigning && (
          <>
            <p className="text-sm text-wash-text">
              {assigning.NombreEdificio_IN} — {proper(assigning.ConcatMaquina_IN ?? 'Sin máquina')}
            </p>
            <div className="mt-3">
              <Label>Técnico</Label>
              <select
                value={newTecnico}
                onChange={(e) => setNewTecnico(e.target.value)}
                className="mt-1 w-full rounded-lg border border-wash-border bg-wash-canvas px-3 py-2"
              >
                <option value="">— Sin asignar —</option>
                {tecnicos.map((t) => (
                  <option key={t.ID} value={t.Usuario}>
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
                  patchIncidente(assigning.ID, {
                    TecnicoAsignado_IN: newTecnico || undefined,
                    Status_IN: newTecnico ? 'Asignado' : 'A Revisar',
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

      {/* New incidente */}
      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="Nuevo incidente" width={560}>
        <div className="space-y-3">
          <div>
            <Label>Edificio</Label>
            <select
              value={newEdificio}
              onChange={(e) => setNewEdificio(e.target.value)}
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
          <div>
            <Label>Máquina (opcional)</Label>
            <select
              value={newMaquina}
              onChange={(e) => setNewMaquina(e.target.value)}
              className="mt-1 w-full rounded-lg border border-wash-border bg-wash-canvas px-3 py-2"
            >
              <option value="">— Sin asignar —</option>
              {maquinas
                .filter((m) => !newEdificio || m.Edificio_DM === newEdificio)
                .map((m) => (
                  <option key={m.ID} value={m.IDMaquina_DM}>
                    {m.IDMaquina_DM} — {m.ConcatMaquina_DM}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <Label>Asignar a (opcional)</Label>
            <select
              value={newAssign}
              onChange={(e) => setNewAssign(e.target.value)}
              className="mt-1 w-full rounded-lg border border-wash-border bg-wash-canvas px-3 py-2"
            >
              <option value="">— Sin asignar —</option>
              {tecnicos.map((t) => (
                <option key={t.ID} value={t.Usuario}>
                  {t.Concat_Nombre_Apellido}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Descripción</Label>
            <textarea
              rows={3}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Qué pasó, qué reporta el cliente…"
              className="mt-1 w-full rounded-lg border border-wash-border bg-wash-canvas px-3 py-2"
            />
          </div>
        </div>
        <ModalActions>
          <button
            type="button"
            onClick={() => setNewOpen(false)}
            className="rounded-lg border border-wash-border px-4 py-2 font-medium text-wash-text-strong hover:bg-wash-canvas"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submitNew}
            className="flex items-center gap-2 rounded-lg bg-wash-primary px-4 py-2 font-medium text-white hover:brightness-110"
          >
            <Plus size={14} /> Crear
          </button>
        </ModalActions>
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
