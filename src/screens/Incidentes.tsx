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
import { PopoverClose } from '@/components/ui/popover';
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
  // Applied filters (used to filter the table)
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
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[9.5px] font-semibold text-slate-600">
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
      width: 'minmax(340px, 1.6fr)',
      render: (i) =>
        i.ConcatMaquina_IN ? (
          <span
            title={proper(i.ConcatMaquina_IN)}
            className="truncate text-[13px] font-semibold text-wash-text-strong"
          >
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
      width: '180px',
      truncate: false,
      render: (i) => <PersonCell user={i.User_IN} />,
    },
    {
      key: 'tecnico',
      header: 'Técnico',
      width: '180px',
      truncate: false,
      render: (i) => {
        if (!i.TecnicoAsignado_IN)
          return (
            <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-amber-700">
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
        filterPopover={
          <FilterContent
            tipo={filterTipo}
            estado={filterEstado}
            onApply={(t, e) => {
              setFilterTipo(t);
              setFilterEstado(e);
            }}
          />
        }
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
        title="Observación del incidente"
        width={580}
      >
        {observingDetail && (
          <>
            {/* Header card with machine info */}
            <div className="rounded-xl bg-wash-surface-2/50 p-4 ring-1 ring-wash-border">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-wash-brand/10 text-wash-brand ring-1 ring-wash-brand/20">
                  <Wrench size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  {observingDetail.ConcatMaquina_IN ? (
                    <p className="font-display text-[15px] font-black text-wash-accent">
                      {proper(observingDetail.ConcatMaquina_IN)}
                    </p>
                  ) : (
                    <p className="font-display text-[15px] italic text-wash-text-muted">
                      Máquina no asignada
                    </p>
                  )}
                  <div className="mt-1 flex items-center gap-2 text-xs text-wash-text-muted">
                    <Building2 size={11} />
                    <span>{observingDetail.NombreEdificio_IN}</span>
                    {observingDetail.IDMaquina_IN && (
                      <>
                        <span className="text-wash-text-faint">·</span>
                        <span className="rounded-md bg-wash-surface px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-wash-text">
                          #{observingDetail.IDMaquina_IN}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <StatusBadge status={observingDetail.Status_IN} />
              </div>
            </div>

            {/* Observation as styled quote */}
            <div className="mt-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">
                Observación
              </p>
              <div className="relative overflow-hidden rounded-xl border border-wash-border bg-wash-surface px-5 py-4">
                <span className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-wash-brand-light to-wash-brand-dark" />
                <p className="text-sm leading-relaxed text-wash-text-strong">
                  {observingDetail.DescripcionIncidente_IN ??
                    observingDetail.DescripcionCarga_IN ?? (
                      <span className="italic text-wash-text-muted">
                        Sin observación registrada.
                      </span>
                    )}
                </p>
              </div>
            </div>

            {/* Metadata grid */}
            <div className="mt-4 grid grid-cols-3 gap-3">
              <MetaItem
                icon={Calendar}
                label="Fecha"
                value={observingDetail.Fecha_IN}
              />
              <MetaItem
                icon={Calendar}
                label="Resuelto"
                value={
                  observingDetail.FechaResuelto_IN ?? (
                    <span className="text-wash-text-faint">—</span>
                  )
                }
              />
              <MetaItem
                icon={Wrench}
                label="Tipo"
                value={observingDetail.NoResuelto_IN}
              />
              <MetaItem
                icon={UserCircle2}
                label="Asignador"
                value={
                  <PersonChip
                    name={userName(observingDetail.User_IN)}
                    tone="slate"
                  />
                }
              />
              <MetaItem
                icon={UserCog}
                label="Técnico"
                value={
                  observingDetail.TecnicoAsignado_IN ? (
                    <PersonChip
                      name={userName(observingDetail.TecnicoAsignado_IN)}
                      tone="brand"
                    />
                  ) : (
                    <span className="text-[12px] font-semibold text-amber-700">
                      Sin asignar
                    </span>
                  )
                }
              />
              {observingDetail.CantidadRepuestos_IN > 0 && (
                <MetaItem
                  icon={ExternalLink}
                  label="Repuestos"
                  value={
                    <span className="text-[12.5px] font-semibold text-wash-text-strong">
                      {observingDetail.CantidadRepuestos_IN} solicitado
                      {observingDetail.CantidadRepuestos_IN === 1 ? '' : 's'}
                    </span>
                  }
                />
              )}
            </div>

            <ModalActions>
              <button
                type="button"
                onClick={() => setObservingDetail(null)}
                className="rounded-lg border border-wash-border px-5 py-2.5 font-medium text-wash-text-strong hover:bg-wash-surface-2"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => setObservingDetail(null)}
                className="rounded-lg bg-wash-action px-5 py-2.5 font-medium text-white hover:bg-wash-action-dark"
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
        title="Asignar técnico"
        width={520}
      >
        {assigning && (
          <>
            {/* Header card */}
            <div className="rounded-xl bg-wash-surface-2/50 p-4 ring-1 ring-wash-border">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-wash-brand/10 text-wash-brand ring-1 ring-wash-brand/20">
                  <UserCog size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  {assigning.ConcatMaquina_IN ? (
                    <p className="font-display text-[15px] font-black text-wash-accent">
                      {proper(assigning.ConcatMaquina_IN)}
                    </p>
                  ) : (
                    <p className="font-display text-[15px] italic text-wash-text-muted">
                      Máquina no asignada
                    </p>
                  )}
                  <div className="mt-1 flex items-center gap-2 text-xs text-wash-text-muted">
                    <Building2 size={11} />
                    <span>{assigning.NombreEdificio_IN}</span>
                    {assigning.IDMaquina_IN && (
                      <>
                        <span className="text-wash-text-faint">·</span>
                        <span className="rounded-md bg-wash-surface px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-wash-text">
                          #{assigning.IDMaquina_IN}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Select técnico */}
            <div className="mt-5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">
                Técnico
              </label>
              <div className="mt-2">
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
              <p className="mt-1.5 text-[11px] text-wash-text-muted">
                Al asignar, el incidente pasa a estado <strong>Asignado</strong>.
              </p>
            </div>

            <ModalActions>
              <button
                type="button"
                onClick={() => setAssigning(null)}
                className="rounded-lg border border-wash-border px-5 py-2.5 font-medium text-wash-text-strong hover:bg-wash-surface-2"
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
                className="flex items-center gap-2 rounded-lg bg-wash-action px-5 py-2.5 font-semibold text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                <UserCog size={15} />
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
                className="rounded-lg bg-wash-action px-5 py-2 font-medium text-white hover:bg-wash-action-dark"
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
        width={560}
      >
        {verRepuestos && (
          <>
            {/* Header card */}
            <div className="rounded-xl bg-wash-surface-2/50 p-4 ring-1 ring-wash-border">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-wash-brand/10 text-wash-brand ring-1 ring-wash-brand/20">
                  <Wrench size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  {verRepuestos.ConcatMaquina_IN ? (
                    <p className="font-display text-[15px] font-black text-wash-accent">
                      {proper(verRepuestos.ConcatMaquina_IN)}
                    </p>
                  ) : (
                    <p className="font-display text-[15px] italic text-wash-text-muted">
                      Máquina no asignada
                    </p>
                  )}
                  <div className="mt-1 flex items-center gap-2 text-xs text-wash-text-muted">
                    <Building2 size={11} />
                    <span>{verRepuestos.NombreEdificio_IN}</span>
                    {verRepuestos.IDMaquina_IN && (
                      <>
                        <span className="text-wash-text-faint">·</span>
                        <span className="rounded-md bg-wash-surface px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-wash-text">
                          #{verRepuestos.IDMaquina_IN}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-wash-brand/10 px-2.5 py-1 text-[11px] font-bold text-wash-brand">
                  {verRepuestos.CantidadRepuestos_IN}{' '}
                  {verRepuestos.CantidadRepuestos_IN === 1 ? 'item' : 'items'}
                </span>
              </div>
            </div>

            {/* Repuestos list */}
            <div className="mt-5">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">
                Repuestos solicitados
              </p>
              {repuestosDe(verRepuestos.IDIncidente).length === 0 ? (
                <div className="rounded-xl border border-dashed border-wash-border py-8 text-center">
                  <Wrench
                    size={28}
                    className="mx-auto mb-2 text-wash-text-faint"
                    strokeWidth={1.5}
                  />
                  <p className="text-sm font-semibold text-wash-text-strong">
                    Sin repuestos cargados
                  </p>
                  <p className="mt-1 text-xs text-wash-text-muted">
                    Este incidente no tiene repuestos solicitados.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {repuestosDe(verRepuestos.IDIncidente).map((r) => (
                    <li
                      key={r.ID}
                      className="flex items-center gap-3 rounded-xl bg-wash-surface px-4 py-3 ring-1 ring-wash-border"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-wash-brand/10 text-wash-brand">
                        <Wrench size={14} />
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium text-wash-text-strong">
                        {r.Repuesto_RI}
                      </span>
                      <span className="flex h-7 min-w-[36px] items-center justify-center rounded-md bg-wash-action/10 px-2 text-sm font-bold text-wash-action ring-1 ring-wash-action/20">
                        {r.Cantidad_RI}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <ModalActions>
              <button
                type="button"
                onClick={() => setVerRepuestos(null)}
                className="rounded-lg bg-wash-action px-5 py-2.5 font-medium text-white hover:bg-wash-action-dark"
              >
                Cerrar
              </button>
            </ModalActions>
          </>
        )}
      </Modal>


      {/* New incidente */}
      <Modal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title="Nuevo incidente"
        width={600}
      >
        <p className="text-sm text-wash-text-muted">
          Cargá los datos del reporte. Completá al menos edificio y descripción.
        </p>

        <div className="mt-5 space-y-4">
          {/* Sección Ubicación */}
          <Section icon={Building2} title="Ubicación">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <LabelReq required>Edificio</LabelReq>
                <div className="mt-1.5">
                  <Select
                    value={newEdificio || undefined}
                    onValueChange={(v) => {
                      setNewEdificio(v);
                      setNewMaquina('');
                    }}
                  >
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue placeholder="Elegir edificio…" />
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
                <LabelReq>Máquina</LabelReq>
                <div className="mt-1.5">
                  <Select
                    value={newMaquina || undefined}
                    onValueChange={setNewMaquina}
                    disabled={!newEdificio}
                  >
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue
                        placeholder={newEdificio ? 'Sin asignar' : 'Elegí edificio primero'}
                      />
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
            </div>
          </Section>

          {/* Sección Asignación */}
          <Section icon={UserCog} title="Asignación">
            <LabelReq>Asignar a técnico</LabelReq>
            <div className="mt-1.5">
              <Select value={newAssign || undefined} onValueChange={setNewAssign}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder="Dejar sin asignar" />
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
          </Section>

          {/* Sección Descripción */}
          <Section icon={Wrench} title="Descripción">
            <LabelReq required>¿Qué pasó?</LabelReq>
            <textarea
              rows={4}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Detallá el problema: qué reporta el cliente, qué falla, contexto adicional…"
              className="mt-1.5 w-full rounded-lg border border-wash-border bg-wash-surface px-3 py-2 text-sm outline-none focus:border-wash-action focus:ring-2 focus:ring-wash-action/15"
            />
          </Section>
        </div>

        <ModalActions>
          <button
            type="button"
            onClick={() => setNewOpen(false)}
            className="rounded-lg border border-wash-border px-5 py-2.5 font-medium text-wash-text-strong hover:bg-wash-surface-2"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submitNew}
            disabled={!newEdificio || !newDesc.trim()}
            className="flex items-center gap-2 rounded-lg bg-wash-action px-5 py-2.5 font-semibold text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={15} /> Crear incidente
          </button>
        </ModalActions>
      </Modal>
    </div>
  );
}

// ----- filter popover -----

function FilterContent({
  tipo,
  estado,
  onApply,
}: {
  tipo: string;
  estado: string;
  onApply: (tipo: string, estado: string) => void;
}) {
  // Initialize with current applied values — this component remounts each time
  // the popover opens (Radix Portal), so state resets to applied values automatically.
  const [pendingTipo, setPendingTipo] = useState(tipo);
  const [pendingEstado, setPendingEstado] = useState(estado);

  const dirty = pendingTipo !== tipo || pendingEstado !== estado;
  const hasFilters = pendingTipo !== 'Todos' || pendingEstado !== 'Todos';

  return (
    <div>
      <div className="mb-3 flex items-center justify-between border-b border-wash-border pb-2.5">
        <h3 className="text-sm font-bold text-wash-text-strong">Filtrar</h3>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setPendingTipo('Todos');
              setPendingEstado('Todos');
            }}
            className="text-[11px] font-semibold text-wash-text-muted hover:text-wash-text-strong"
          >
            Limpiar
          </button>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">
            Tipo
          </label>
          <div className="mt-1.5">
            <Select value={pendingTipo} onValueChange={setPendingTipo}>
              <SelectTrigger className="h-9 w-full text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos</SelectItem>
                <SelectItem value="Requiere Repuesto">Requiere Repuesto</SelectItem>
                <SelectItem value="Cambio Maquina">Cambio Maquina</SelectItem>
                <SelectItem value="Reportado Por Tecnico">
                  Reportado Por Tecnico
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">
            Estado
          </label>
          <div className="mt-1.5">
            <Select value={pendingEstado} onValueChange={setPendingEstado}>
              <SelectTrigger className="h-9 w-full text-sm">
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
            onClick={() => onApply(pendingTipo, pendingEstado)}
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

function LabelReq({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">
      {children}
      {required && <span className="text-rose-500">*</span>}
    </label>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Eye;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-wash-border bg-wash-surface-2/30 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-wash-brand/10 text-wash-brand ring-1 ring-wash-brand/20">
          <Icon size={13} />
        </span>
        <h3 className="text-[12px] font-bold uppercase tracking-wider text-wash-text-strong">
          {title}
        </h3>
      </div>
      <div>{children}</div>
    </div>
  );
}

function MetaItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Eye;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-wash-surface-2/40 px-3 py-2 ring-1 ring-wash-border">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-wash-text-muted">
        <Icon size={11} className="opacity-70" />
        {label}
      </div>
      <div className="mt-1 text-[12.5px] font-semibold text-wash-text-strong">
        {value}
      </div>
    </div>
  );
}

function PersonChip({
  name,
  tone: _tone,
}: {
  name: string;
  tone?: 'slate' | 'brand';
}) {
  const initials = name
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[9px] font-semibold text-slate-600">
        {initials || '?'}
      </span>
      <span className="truncate text-[12.5px] font-semibold text-wash-text-strong">
        {name}
      </span>
    </span>
  );
}
