import { useMemo, useState } from 'react';
import {
  Eye,
  UserCog,
  HelpCircle,
  Plus,
  ExternalLink,
  AlertTriangle,
  Building2,
  Wrench,
  Calendar,
  UserCircle2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { Modal, ModalActions } from '@/components/Modal';
import { StatusBadge } from '@/components/StatusBadge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppStore } from '@/store/useAppStore';
import { cn, proper, formatToday, currentMonthYear, currentMonthName } from '@/lib/utils';
import type { Incidente } from '@/types/domain';

export function Incidentes() {
  const navigate = useNavigate();
  const incidentes = useAppStore((s) => s.CollectIncidentes);
  const repuestos = useAppStore((s) => s.CollectRepuestosIncidente);
  const usuarios = useAppStore((s) => s.CollectUser);
  const edificios = useAppStore((s) => s.CollectEdificios);
  const maquinas = useAppStore((s) => s.CollectDetalleMaquina);
  const stock = useAppStore((s) => s.CollectStock);
  const patchIncidente = useAppStore((s) => s.patchIncidente);
  const addIncidente = useAppStore((s) => s.addIncidente);
  const VarUsuario = useAppStore((s) => s.VarUsuario) ?? '';

  const [query, setQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterTipo, setFilterTipo] = useState<string>('Todos');
  const [filterEstado, setFilterEstado] = useState<string>('Todos');

  // Modals
  const [observingDetail, setObservingDetail] = useState<Incidente | null>(null);
  const [assigning, setAssigning] = useState<Incidente | null>(null);
  const [newTecnico, setNewTecnico] = useState('');
  const [outOfStock, setOutOfStock] = useState<Incidente | null>(null);
  const [verRepuestos, setVerRepuestos] = useState<Incidente | null>(null);

  // New incidente
  const [newOpen, setNewOpen] = useState(false);
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
      .filter((i) => (filterTipo === 'Todos' ? true : i.NoResuelto_IN === filterTipo))
      .filter((i) => (filterEstado === 'Todos' ? true : i.Status_IN === filterEstado))
      .sort((a, b) => b.ID - a.ID)
      .filter(
        (i) =>
          i.NombreEdificio_IN.toLowerCase().includes(q) ||
          (i.ConcatMaquina_IN ?? '').toLowerCase().includes(q) ||
          i.NoResuelto_IN.toLowerCase().includes(q) ||
          (i.IDMaquina_IN ?? '').toLowerCase().includes(q) ||
          (i.TecnicoAsignado_IN ?? '').toLowerCase().includes(q) ||
          String(i.ID).includes(q)
      );
  }, [incidentes, query, filterTipo, filterEstado]);

  const repuestosDe = (idIn: string) => repuestos.filter((r) => r.IDIncidente_RI === idIn);

  // Heuristic: does the requested repuesto have available stock?
  const hasStockForIncident = (i: Incidente): boolean => {
    if (i.NoResuelto_IN !== 'Requiere Repuesto') return true;
    const reps = repuestosDe(i.IDIncidente);
    if (reps.length === 0) return true;
    return reps.every((r) => {
      const s = stock.find(
        (st) =>
          st.Status_ST === 'Activo' &&
          st.Item_ST.toLowerCase() === r.Repuesto_RI.toLowerCase()
      );
      return !!s && s.Cantidad_ST >= r.Cantidad_RI;
    });
  };

  const userName = (u?: string) =>
    u ? usuarios.find((x) => x.Usuario === u)?.Concat_Nombre_Apellido ?? u : '—';

  // Type → color tone for the small chip
  const tipoTone: Record<string, string> = {
    'Requiere Repuesto': 'bg-amber-50 text-amber-800 ring-amber-300/70',
    'Cambio Maquina': 'bg-violet-50 text-violet-800 ring-violet-300/70',
    'Reportado Por Tecnico': 'bg-sky-50 text-sky-800 ring-sky-300/70',
    'Baja de Maquina': 'bg-slate-50 text-slate-700 ring-slate-300/70',
    Transferencia: 'bg-emerald-50 text-emerald-800 ring-emerald-300/70',
  };

  const initials = (full: string) =>
    full
      .split(/[\s,]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();

  function PersonCell({ user }: { user?: string }) {
    if (!user) return <span className="text-wash-text-faint">—</span>;
    const name = userName(user);
    return (
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-wash-brand/10 text-[9px] font-bold text-wash-brand ring-1 ring-wash-brand/25">
          {initials(name) || '?'}
        </span>
        <span className="truncate text-[12.5px] text-wash-text-strong">{name}</span>
      </div>
    );
  }

  const columns: Column<Incidente>[] = [
    {
      key: 'estado',
      header: 'Estado',
      width: '120px',
      truncate: false,
      render: (i) => <StatusBadge status={i.Status_IN} />,
    },
    {
      key: 'fecha',
      header: 'Fecha',
      width: '110px',
      render: (i) => (
        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-wash-text">
          <Calendar size={11} className="text-wash-text-faint" />
          {i.Fecha_IN}
        </span>
      ),
    },
    {
      key: 'fechaR',
      header: 'F. Resuelto',
      width: '110px',
      render: (i) =>
        i.FechaResuelto_IN ? (
          <span className="text-[12.5px] text-wash-text">{i.FechaResuelto_IN}</span>
        ) : (
          <span className="text-wash-text-faint">—</span>
        ),
    },
    {
      key: 'id',
      header: 'ID',
      width: '80px',
      render: (i) =>
        i.IDMaquina_IN ? (
          <span className="rounded-md bg-wash-surface-2 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-wash-text">
            {i.IDMaquina_IN}
          </span>
        ) : (
          <span className="text-wash-text-faint">—</span>
        ),
    },
    {
      key: 'maquina',
      header: 'Máquina',
      width: 'minmax(220px, 1fr)',
      render: (i) =>
        i.ConcatMaquina_IN ? (
          <span className="truncate text-[13px] font-semibold text-wash-text-strong">
            {proper(i.ConcatMaquina_IN)}
          </span>
        ) : (
          <span className="truncate text-[12.5px] italic text-wash-text-muted">
            Máquina no asignada
          </span>
        ),
    },
    {
      key: 'tipo',
      header: 'Tipo',
      width: '160px',
      truncate: false,
      render: (i) => (
        <span
          className={cn(
            'inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold ring-1',
            tipoTone[i.NoResuelto_IN] ?? 'bg-slate-50 text-slate-700 ring-slate-300/70'
          )}
        >
          <Wrench size={10} />
          {i.NoResuelto_IN}
        </span>
      ),
    },
    {
      key: 'asignador',
      header: 'Asignador',
      width: '170px',
      render: (i) => <PersonCell user={i.User_IN} />,
    },
    {
      key: 'tecnico',
      header: 'Técnico',
      width: '170px',
      truncate: false,
      render: (i) => {
        if (!i.TecnicoAsignado_IN)
          return (
            <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-amber-700">
              <UserCircle2 size={13} className="opacity-80" />
              Sin asignar
            </span>
          );
        return <PersonCell user={i.TecnicoAsignado_IN} />;
      },
    },
    {
      key: 'repuesto',
      header: 'Repuesto',
      width: '170px',
      render: (i) =>
        i.CantidadRepuestos_IN > 0 ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setVerRepuestos(i);
            }}
            className="group inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-wash-brand hover:text-wash-brand-dark"
          >
            <span className="underline-offset-2 group-hover:underline">
              Ver repuestos
            </span>
            <ExternalLink size={11} className="opacity-70" />
          </button>
        ) : (
          <span className="text-[12.5px] text-wash-text-muted">
            Pendiente de Revisión
          </span>
        ),
    },
    {
      key: 'qrep',
      header: 'Q Rep.',
      width: '80px',
      align: 'center',
      truncate: false,
      render: (i) =>
        i.CantidadRepuestos_IN > 0 ? (
          <span className="inline-flex min-w-[28px] items-center justify-center rounded-full bg-wash-brand/10 px-2 py-0.5 text-xs font-bold text-wash-brand">
            {i.CantidadRepuestos_IN}
          </span>
        ) : (
          <span className="text-wash-text-faint">—</span>
        ),
    },
    {
      key: 'edificio',
      header: 'Edificio',
      width: '180px',
      render: (i) => (
        <div className="flex min-w-0 items-center gap-2">
          <Building2 size={13} className="shrink-0 text-wash-brand/70" />
          <span className="truncate text-[12.5px] font-semibold text-wash-text-strong">
            {i.NombreEdificio_IN}
          </span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      width: '110px',
      align: 'right',
      truncate: false,
      render: (i) => {
        const needsStock =
          i.NoResuelto_IN === 'Requiere Repuesto' && !hasStockForIncident(i);
        return (
          <div className="flex items-center justify-end gap-1.5">
            {needsStock ? (
              <ActionButton
                icon={HelpCircle}
                tone="warning"
                title="Sin stock — Solicitar pedido"
                onClick={(e) => {
                  e.stopPropagation();
                  setOutOfStock(i);
                }}
              />
            ) : (
              <ActionButton
                icon={UserCog}
                tone="brand"
                title="Asignar técnico"
                onClick={(e) => {
                  e.stopPropagation();
                  setAssigning(i);
                  setNewTecnico(i.TecnicoAsignado_IN ?? '');
                }}
              />
            )}
            <ActionButton
              icon={Eye}
              tone="neutral"
              title="Ver observación"
              onClick={(e) => {
                e.stopPropagation();
                setObservingDetail(i);
              }}
            />
          </div>
        );
      },
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
        search={{
          value: query,
          onChange: setQuery,
          placeholder: 'Edificio, máquina, estado…',
        }}
        onFilter={() => setFilterOpen(true)}
        onAdd={() => setNewOpen(true)}
        addLabel="Nuevo incidente"
      />

      {/* Active filter chips */}
      {(filterTipo !== 'Todos' || filterEstado !== 'Todos') && (
        <div className="flex items-center gap-2 border-b border-wash-border bg-wash-surface-2/40 px-6 py-2 text-xs text-wash-text-muted">
          <span className="font-semibold uppercase tracking-wider">Filtros:</span>
          {filterTipo !== 'Todos' && (
            <span className="rounded-full bg-wash-brand/10 px-2.5 py-0.5 font-semibold text-wash-brand">
              {filterTipo}
            </span>
          )}
          {filterEstado !== 'Todos' && (
            <span className="rounded-full bg-wash-brand/10 px-2.5 py-0.5 font-semibold text-wash-brand">
              {filterEstado}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setFilterTipo('Todos');
              setFilterEstado('Todos');
            }}
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
          empty="No hay incidentes pendientes"
        />
      </div>

      {/* Observación Incidente */}
      <Modal
        open={!!observingDetail}
        onClose={() => setObservingDetail(null)}
        title="Observación Incidente"
        width={560}
      >
        {observingDetail && (
          <>
            <label className="text-sm font-medium text-wash-text-strong">
              Observación
            </label>
            <div className="mt-1.5 min-h-[160px] rounded-lg border border-wash-border bg-wash-surface-2/50 px-3 py-2.5 text-sm text-wash-text-strong">
              {observingDetail.DescripcionIncidente_IN ??
                observingDetail.DescripcionCarga_IN ??
                'Sin observación registrada.'}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <Field label="Edificio" value={observingDetail.NombreEdificio_IN} />
              <Field label="Estado" value={<StatusBadge status={observingDetail.Status_IN} />} />
              <Field
                label="Máquina"
                value={
                  observingDetail.ConcatMaquina_IN
                    ? proper(observingDetail.ConcatMaquina_IN)
                    : 'No asignada'
                }
              />
              <Field
                label="Técnico"
                value={userName(observingDetail.TecnicoAsignado_IN)}
              />
            </div>

            <ModalActions>
              <button
                type="button"
                onClick={() => setObservingDetail(null)}
                className="rounded-lg border border-wash-border px-5 py-2 font-medium text-wash-text-strong hover:bg-wash-surface-2"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => setObservingDetail(null)}
                className="rounded-lg bg-wash-brand px-5 py-2 font-medium text-white hover:bg-wash-brand-dark"
              >
                Aceptar
              </button>
            </ModalActions>
          </>
        )}
      </Modal>

      {/* Asignar técnico */}
      <Modal
        open={!!assigning}
        onClose={() => setAssigning(null)}
        title="Asignar a técnico"
        width={480}
      >
        {assigning && (
          <>
            <div className="rounded-lg bg-wash-surface-2/50 px-3 py-2 text-xs">
              <span className="font-semibold text-wash-text-strong">
                {assigning.NombreEdificio_IN}
              </span>
              <span className="text-wash-text-muted">
                {' '}
                · {assigning.ConcatMaquina_IN ?? 'Maquina No Asignada'}
              </span>
            </div>
            <div className="mt-4">
              <label className="text-xs font-semibold uppercase tracking-wider text-wash-text-muted">
                Técnico
              </label>
              <div className="mt-1.5">
                <Select value={newTecnico || undefined} onValueChange={setNewTecnico}>
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue placeholder="Elegir técnico…" />
                  </SelectTrigger>
                  <SelectContent>
                    {tecnicos.map((t) => (
                      <SelectItem key={t.ID} value={t.Usuario}>
                        {t.Concat_Nombre_Apellido}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <ModalActions>
              <button
                type="button"
                onClick={() => setAssigning(null)}
                className="rounded-lg border border-wash-border px-5 py-2 font-medium text-wash-text-strong hover:bg-wash-surface-2"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!newTecnico}
                onClick={() => {
                  patchIncidente(assigning.ID, {
                    TecnicoAsignado_IN: newTecnico || undefined,
                    Status_IN: newTecnico ? 'Asignado' : 'A Revisar',
                  });
                  setAssigning(null);
                }}
                className="rounded-lg bg-wash-brand px-5 py-2 font-medium text-white hover:bg-wash-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                Asignar
              </button>
            </ModalActions>
          </>
        )}
      </Modal>

      {/* Sin stock */}
      <Modal
        open={!!outOfStock}
        onClose={() => setOutOfStock(null)}
        title=""
        width={460}
      >
        {outOfStock && (
          <>
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100">
                <AlertTriangle size={24} className="text-amber-600" />
              </span>
              <div className="flex-1">
                <h3 className="font-display text-lg font-black text-wash-text-strong">
                  Sin stock
                </h3>
                <p className="mt-1 text-sm text-wash-text-muted">
                  Parece que no hay stock de este item, ¿Te gustaría realizar un pedido
                  de compra?
                </p>
              </div>
            </div>
            <div className="mt-3 rounded-lg bg-wash-surface-2/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-wash-text-muted">
                Repuestos faltantes
              </p>
              <ul className="mt-1 space-y-1 text-sm">
                {repuestosDe(outOfStock.IDIncidente).map((r) => (
                  <li
                    key={r.ID}
                    className="flex items-center justify-between rounded-md bg-wash-surface px-3 py-1.5"
                  >
                    <span className="text-wash-text-strong">{r.Repuesto_RI}</span>
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                      {r.Cantidad_RI} ud{r.Cantidad_RI === 1 ? '' : 's'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <ModalActions>
              <button
                type="button"
                onClick={() => setOutOfStock(null)}
                className="rounded-lg border border-wash-border px-5 py-2 font-medium text-wash-text-strong hover:bg-wash-surface-2"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setOutOfStock(null);
                  navigate('/compras');
                }}
                className="rounded-lg bg-wash-brand px-5 py-2 font-medium text-white hover:bg-wash-brand-dark"
              >
                Realizar pedido
              </button>
            </ModalActions>
          </>
        )}
      </Modal>

      {/* Ver repuestos */}
      <Modal
        open={!!verRepuestos}
        onClose={() => setVerRepuestos(null)}
        title="Repuestos del incidente"
        width={520}
      >
        {verRepuestos && (
          <>
            <div className="rounded-lg bg-wash-surface-2/50 p-3 text-xs">
              <span className="font-semibold text-wash-text-strong">
                {verRepuestos.NombreEdificio_IN}
              </span>
              <span className="text-wash-text-muted">
                {' '}
                ·{' '}
                {verRepuestos.ConcatMaquina_IN
                  ? proper(verRepuestos.ConcatMaquina_IN)
                  : 'Maquina No Asignada'}
              </span>
            </div>
            <div className="mt-3 overflow-hidden rounded-xl border border-wash-border">
              <div className="grid grid-cols-[1fr_80px] bg-wash-surface-2/60 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-wash-text-muted">
                <span>Repuesto</span>
                <span className="text-center">Cant.</span>
              </div>
              {repuestosDe(verRepuestos.IDIncidente).length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-wash-text-muted">
                  Sin repuestos cargados.
                </p>
              ) : (
                repuestosDe(verRepuestos.IDIncidente).map((r) => (
                  <div
                    key={r.ID}
                    className="grid grid-cols-[1fr_80px] items-center border-t border-wash-divider/60 px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-wash-text-strong">
                      {r.Repuesto_RI}
                    </span>
                    <span className="text-center font-bold text-wash-text-strong">
                      {r.Cantidad_RI}
                    </span>
                  </div>
                ))
              )}
            </div>
            <ModalActions>
              <button
                type="button"
                onClick={() => setVerRepuestos(null)}
                className="rounded-lg bg-wash-brand px-5 py-2 font-medium text-white hover:bg-wash-brand-dark"
              >
                Cerrar
              </button>
            </ModalActions>
          </>
        )}
      </Modal>

      {/* Filter modal */}
      <Modal
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Filtrar incidentes"
        width={460}
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-wash-text-muted">
              Tipo
            </label>
            <div className="mt-1.5">
              <Select value={filterTipo} onValueChange={setFilterTipo}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todos">Todos</SelectItem>
                  <SelectItem value="Requiere Repuesto">Requiere Repuesto</SelectItem>
                  <SelectItem value="Cambio Maquina">Cambio Maquina</SelectItem>
                  <SelectItem value="Reportado Por Tecnico">Reportado Por Tecnico</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-wash-text-muted">
              Estado
            </label>
            <div className="mt-1.5">
              <Select value={filterEstado} onValueChange={setFilterEstado}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todos">Todos</SelectItem>
                  <SelectItem value="A Revisar">A Revisar</SelectItem>
                  <SelectItem value="Asignado">Asignado</SelectItem>
                  <SelectItem value="En Aprobacion">En Aprobacion</SelectItem>
                  <SelectItem value="Pendiente">Pendiente</SelectItem>
                  <SelectItem value="Resuelto">Resuelto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <ModalActions>
          <button
            type="button"
            onClick={() => {
              setFilterTipo('Todos');
              setFilterEstado('Todos');
              setFilterOpen(false);
            }}
            className="rounded-lg border border-wash-border px-4 py-2 font-medium text-wash-text-strong hover:bg-wash-surface-2"
          >
            Limpiar
          </button>
          <button
            type="button"
            onClick={() => setFilterOpen(false)}
            className="rounded-lg bg-wash-brand px-4 py-2 font-medium text-white hover:bg-wash-brand-dark"
          >
            Aplicar
          </button>
        </ModalActions>
      </Modal>

      {/* New incidente */}
      <Modal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title="Nuevo incidente"
        width={560}
      >
        <div className="space-y-3">
          <div>
            <Label>Edificio</Label>
            <div className="mt-1.5">
              <Select value={newEdificio || undefined} onValueChange={setNewEdificio}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder="Seleccionar edificio…" />
                </SelectTrigger>
                <SelectContent>
                  {edificios.map((e) => (
                    <SelectItem key={e.ID} value={e.Edificio}>
                      {e.Edificio}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Máquina (opcional)</Label>
            <div className="mt-1.5">
              <Select value={newMaquina || undefined} onValueChange={setNewMaquina}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  {maquinas
                    .filter((m) => !newEdificio || m.Edificio_DM === newEdificio)
                    .map((m) => (
                      <SelectItem key={m.ID} value={m.IDMaquina_DM}>
                        {m.IDMaquina_DM} — {m.ConcatMaquina_DM}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Asignar a (opcional)</Label>
            <div className="mt-1.5">
              <Select value={newAssign || undefined} onValueChange={setNewAssign}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  {tecnicos.map((t) => (
                    <SelectItem key={t.ID} value={t.Usuario}>
                      {t.Concat_Nombre_Apellido}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Descripción</Label>
            <textarea
              rows={3}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Qué pasó, qué reporta el cliente…"
              className="mt-1.5 w-full rounded-lg border border-wash-border bg-wash-surface px-3 py-2 outline-none focus:border-wash-brand focus:ring-2 focus:ring-wash-brand/15"
            />
          </div>
        </div>
        <ModalActions>
          <button
            type="button"
            onClick={() => setNewOpen(false)}
            className="rounded-lg border border-wash-border px-4 py-2 font-medium text-wash-text-strong hover:bg-wash-surface-2"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submitNew}
            className="flex items-center gap-2 rounded-lg bg-wash-brand px-4 py-2 font-medium text-white hover:bg-wash-brand-dark"
          >
            <Plus size={14} /> Crear
          </button>
        </ModalActions>
      </Modal>
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
  tone: 'neutral' | 'brand' | 'warning';
  title: string;
  onClick: (e: React.MouseEvent) => void;
}) {
  const cls = {
    neutral:
      'text-wash-text-muted ring-wash-border hover:bg-wash-surface-2 hover:text-wash-text-strong hover:ring-wash-text-muted/40',
    brand:
      'text-wash-brand ring-wash-brand/30 hover:bg-wash-brand/10 hover:ring-wash-brand',
    warning:
      'text-amber-600 ring-amber-400/40 hover:bg-amber-50 hover:ring-amber-500',
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
