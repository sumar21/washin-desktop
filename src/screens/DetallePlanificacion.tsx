import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Eye,
  Trash2,
  MapPin,
  Building2,
  UserCog,
  ArrowRight,
  UserCircle2,
  CheckCircle2,
  Circle,
  CalendarDays,
  Plus,
  ClipboardEdit,
  X,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { Modal, ModalActions, ConfirmDialog } from '@/components/Modal';
import { StatusBadge } from '@/components/StatusBadge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import type { ResumenPlanificacion } from '@/types/domain';

export function DetallePlanificacion() {
  const navigate = useNavigate();
  const MesAno = useAppStore((s) => s.MesAnoPlanificacionDetail);
  const MesDetail = useAppStore((s) => s.MesDetail);
  const setMesPlanif = useAppStore((s) => s.setMesPlanificacionDetail);
  const resumen = useAppStore((s) => s.CollectResumenPlanificaciones);
  const detalles = useAppStore((s) => s.CollectDetallePlanificaciones);
  const edificios = useAppStore((s) => s.CollectEdificiosVisitar);
  const usuarios = useAppStore((s) => s.CollectUser);
  const rutasCatalog = useAppStore((s) => s.CollectRutasDisponibles);

  const [query, setQuery] = useState('');
  const [viewing, setViewing] = useState<ResumenPlanificacion | null>(null);
  const [reassign, setReassign] = useState<ResumenPlanificacion | null>(null);
  const [newTec, setNewTec] = useState('');
  const [deleting, setDeleting] = useState<ResumenPlanificacion | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const tecnicos = useMemo(
    () => usuarios.filter((u) => u.Rol === 'Tecnico' && u.Status === 'ALTA'),
    [usuarios]
  );

  const rutasOptions = useMemo(
    () => rutasCatalog.filter((r) => r.Status_RT === 'Activo'),
    [rutasCatalog]
  );

  const rutasDelMes = useMemo(() => {
    if (!MesAno) return [];
    return resumen.filter((r) => r.MesAnoPlanificado_RP === MesAno);
  }, [resumen, MesAno]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return rutasDelMes
      .filter(
        (r) =>
          r.Tecnico_RP.toLowerCase().includes(q) ||
          r.NroRuta_RP.toLowerCase().includes(q) ||
          r.Status_RP.toLowerCase().includes(q)
      )
      .sort((a, b) => Number(a.NroRuta_RP) - Number(b.NroRuta_RP));
  }, [rutasDelMes, query]);

  // For each ruta, count circuitos & edificios
  const countsFor = (r: ResumenPlanificacion) => {
    const circs = detalles.filter((d) => d.IDUnivoco_DP === r.IDUnivocoRuta_RP);
    const edifs = edificios.filter((e) =>
      circs.some((c) => c.IDUnivocoCircuito_DP === e.IDUnivocoCircuito_EV)
    );
    return { circuitos: circs.length, edificios: edifs.length };
  };

  const initials = (name: string) =>
    name
      .split(/[\s,]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();

  if (!MesAno) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-wash-text-muted">No hay mes seleccionado.</p>
      </div>
    );
  }

  const columns: Column<ResumenPlanificacion>[] = [
    {
      key: 'estado',
      header: 'Estado',
      width: '150px',
      truncate: false,
      render: (r) => <StatusBadge status={r.Status_RP} />,
    },
    {
      key: 'ruta',
      header: 'Ruta',
      width: '90px',
      align: 'center',
      truncate: false,
      render: (r) => (
        <span className="inline-flex min-w-[36px] items-center justify-center rounded-md bg-wash-brand/10 px-2 py-0.5 text-[12.5px] font-bold text-wash-brand tabular-nums">
          {r.NroRuta_RP}
        </span>
      ),
    },
    {
      key: 'tecnico',
      header: 'Técnico',
      width: 'minmax(220px, 1fr)',
      truncate: false,
      render: (r) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[9.5px] font-semibold text-slate-600">
            {initials(r.Tecnico_RP)}
          </span>
          <span className="truncate text-[13px] font-semibold text-wash-text-strong">
            {r.Tecnico_RP}
          </span>
        </div>
      ),
    },
    {
      key: 'circuitos',
      header: 'Circuitos',
      width: '110px',
      align: 'center',
      truncate: false,
      render: (r) => {
        const { circuitos } = countsFor(r);
        return (
          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-wash-text-strong tabular-nums">
            <MapPin size={11} className="text-wash-text-muted" />
            {circuitos}
          </span>
        );
      },
    },
    {
      key: 'edificios',
      header: 'Edificios',
      width: '110px',
      align: 'center',
      truncate: false,
      render: (r) => {
        const { edificios: ed } = countsFor(r);
        return (
          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-wash-text-strong tabular-nums">
            <Building2 size={11} className="text-wash-text-muted" />
            {ed}
          </span>
        );
      },
    },
    {
      key: 'mes',
      header: 'Mes',
      width: '110px',
      render: (r) => (
        <span className="font-mono text-[12px] text-wash-text-muted tabular-nums">
          {r.MesAnoPlanificado_RP}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      width: '140px',
      align: 'right',
      truncate: false,
      render: (r) => (
        <div className="flex items-center justify-end gap-1.5">
          <ActionBtn
            icon={Eye}
            tone="brand"
            title="Ver detalle"
            onClick={(e) => {
              e.stopPropagation();
              setViewing(r);
            }}
          />
          <ActionBtn
            icon={UserCog}
            tone="neutral"
            title="Cambiar técnico"
            onClick={(e) => {
              e.stopPropagation();
              setReassign(r);
              setNewTec(r.Tecnico_RP);
            }}
          />
          <ActionBtn
            icon={Trash2}
            tone="danger"
            title="Eliminar ruta"
            onClick={(e) => {
              e.stopPropagation();
              setDeleting(r);
            }}
          />
        </div>
      ),
    },
  ];

  const monthYear = `${MesDetail ?? ''} ${MesAno?.split('/')[1] ?? ''}`;

  return (
    <div className="flex h-full w-full flex-col">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setMesPlanif(null, null);
                navigate('/rutas');
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-wash-surface-2 text-wash-text-strong hover:bg-wash-border/60"
              title="Volver"
            >
              <ArrowLeft size={16} />
            </button>
            <span className="capitalize">Planificación {MesDetail}</span>
          </span>
        }
        subtitle={`${rutasDelMes.length} rutas · ${monthYear}`}
        search={{
          value: query,
          onChange: setQuery,
          placeholder: 'Buscar técnico, ruta…',
        }}
        onAdd={() => setAddOpen(true)}
        addLabel="Agregar ruta"
      />

      <div className="flex-1 overflow-hidden p-6">
        <DataTable
          rows={filtered}
          rowKey={(r) => r.ID}
          columns={columns}
          empty="Sin rutas en este mes."
          onRowClick={(r) => setViewing(r)}
        />
      </div>

      {/* Detalle de Ruta modal */}
      <RutaDetailModal
        ruta={viewing}
        detalles={detalles}
        edificios={edificios}
        onClose={() => setViewing(null)}
      />

      {/* Agregar Ruta */}
      <AgregarRutaModal
        open={addOpen}
        mes={MesAno}
        tecnicos={tecnicos.map((t) => t.Concat_Nombre_Apellido)}
        rutas={rutasOptions.map((r) => r.NroRuta_RT)}
        onClose={() => setAddOpen(false)}
        onSave={() => setAddOpen(false)}
      />

      {/* Cambiar técnico */}
      <Modal
        open={!!reassign}
        onClose={() => setReassign(null)}
        title="Cambiar técnico"
        width={560}
      >
        {reassign && (
          <>
            <p className="text-sm text-wash-text-muted">
              Reasigná esta ruta a otro técnico del equipo de campo.
            </p>

            {/* Ruta card */}
            <div className="mt-5 rounded-xl bg-wash-surface-2/50 p-4 ring-1 ring-wash-border">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-wash-brand/10 text-wash-brand ring-1 ring-wash-brand/20">
                  <MapPin size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[15px] font-black text-wash-accent">
                    Ruta {reassign.NroRuta_RP}
                  </p>
                  <p className="mt-0.5 text-xs text-wash-text-muted">
                    Planificación de {reassign.MesAnoPlanificado_RP}
                  </p>
                </div>
                <StatusBadge status={reassign.Status_RP} />
              </div>
            </div>

            {/* From → To */}
            <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div className="rounded-xl bg-wash-surface-2/60 p-3 ring-1 ring-wash-border">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-wash-text-muted">
                  Actual
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[9px] font-semibold text-slate-600">
                    {initials(reassign.Tecnico_RP)}
                  </span>
                  <span className="truncate text-[12.5px] font-semibold text-wash-text-strong">
                    {reassign.Tecnico_RP}
                  </span>
                </div>
              </div>

              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-wash-action/15 text-wash-action">
                <ArrowRight size={14} />
              </span>

              <div
                className={cn(
                  'rounded-xl p-3 ring-1 transition',
                  newTec && newTec !== reassign.Tecnico_RP
                    ? 'bg-wash-action/5 ring-wash-action/40'
                    : 'bg-wash-surface-2/60 ring-wash-border'
                )}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-wash-text-muted">
                  Nuevo
                </p>
                <div className="mt-1 flex items-center gap-2">
                  {newTec ? (
                    <>
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-wash-action/15 text-[9px] font-semibold text-wash-action">
                        {initials(newTec)}
                      </span>
                      <span className="truncate text-[12.5px] font-semibold text-wash-action-dark">
                        {newTec}
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

            <div className="mt-5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">
                Elegir nuevo técnico
              </label>
              <div className="mt-1.5">
                <Select value={newTec || undefined} onValueChange={setNewTec}>
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue placeholder="Seleccionar técnico…" />
                  </SelectTrigger>
                  <SelectContent>
                    {tecnicos
                      .filter((t) => t.Concat_Nombre_Apellido !== reassign.Tecnico_RP)
                      .map((t) => (
                        <SelectItem key={t.ID} value={t.Concat_Nombre_Apellido}>
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
                onClick={() => setReassign(null)}
                className="rounded-lg border border-wash-border px-5 py-2.5 font-medium text-wash-text-strong hover:bg-wash-surface-2"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!newTec || newTec === reassign.Tecnico_RP}
                onClick={() => setReassign(null)}
                className="flex items-center gap-2 rounded-lg bg-wash-action px-5 py-2.5 font-semibold text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                <UserCog size={15} />
                Confirmar
              </button>
            </ModalActions>
          </>
        )}
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleting}
        tone="danger"
        title="Eliminar ruta"
        message={
          deleting
            ? `¿Eliminar la ruta ${deleting.NroRuta_RP} de ${deleting.Tecnico_RP}? Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Eliminar"
        onCancel={() => setDeleting(null)}
        onConfirm={() => setDeleting(null)}
      />
    </div>
  );
}

// ----- Detalle de Ruta modal -----

function RutaDetailModal({
  ruta,
  detalles,
  edificios,
  onClose,
}: {
  ruta: ResumenPlanificacion | null;
  detalles: ReturnType<typeof useAppStore.getState>['CollectDetallePlanificaciones'];
  edificios: ReturnType<typeof useAppStore.getState>['CollectEdificiosVisitar'];
  onClose: () => void;
}) {
  if (!ruta) return null;

  const circuitos = detalles.filter((d) => d.IDUnivoco_DP === ruta.IDUnivocoRuta_RP);
  const edificiosRuta = edificios.filter((e) =>
    circuitos.some((c) => c.IDUnivocoCircuito_DP === e.IDUnivocoCircuito_EV)
  );
  const totalEdificios = edificiosRuta.length;
  const visitados = edificiosRuta.filter((e) => e.Status_EV === 'Visitado').length;
  const progreso = totalEdificios > 0 ? Math.round((visitados / totalEdificios) * 100) : 0;

  const initials2 = (name: string) =>
    name
      .split(/[\s,]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();

  return (
    <Modal
      open={!!ruta}
      onClose={onClose}
      title={`Detalle de ruta ${ruta.NroRuta_RP}`}
      width={1180}
    >
      {/* Header card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-wash-brand/[0.08] via-wash-surface to-wash-surface-2/30 p-5 ring-1 ring-wash-border">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-wash-brand/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-emerald-500/5 blur-3xl"
        />

        {/* Top row: avatar + title block + status */}
        <div className="relative flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-wash-brand to-wash-brand-dark text-[14px] font-black text-white shadow-md shadow-wash-brand/25 ring-2 ring-wash-surface">
            {initials2(ruta.Tecnico_RP)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-wash-brand/10 px-2 py-0.5 text-[11.5px] font-bold text-wash-brand tabular-nums ring-1 ring-wash-brand/20">
                <MapPin size={10} />
                Ruta {ruta.NroRuta_RP}
              </span>
              <StatusBadge status={ruta.Status_RP} />
            </div>
            <h3 className="mt-1.5 truncate font-display text-[17px] font-black leading-tight text-wash-accent">
              {ruta.Tecnico_RP}
            </h3>
            <p className="mt-1 flex items-center gap-1.5 text-[11.5px] text-wash-text-muted">
              <CalendarDays size={12} />
              Planificación de{' '}
              <span className="font-mono font-semibold text-wash-text-strong">
                {ruta.MesAnoPlanificado_RP}
              </span>
            </p>
          </div>
        </div>

        {/* Stats strip */}
        <div className="relative mt-4 grid grid-cols-4 divide-x divide-wash-border rounded-xl bg-wash-surface/80 backdrop-blur ring-1 ring-wash-border">
          <StatStrip
            icon={MapPin}
            label="Circuitos"
            value={String(circuitos.length)}
            tone="brand"
          />
          <StatStrip
            icon={Building2}
            label="Edificios"
            value={String(totalEdificios)}
            tone="brand"
          />
          <StatStrip
            icon={CheckCircle2}
            label="Visitados"
            value={String(visitados)}
            suffix={totalEdificios > 0 ? ` / ${totalEdificios}` : undefined}
            tone="emerald"
          />
          <div className="flex flex-col justify-center px-4 py-3">
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-wash-text-muted">
              <span>Progreso</span>
              <span className="font-display text-[14px] font-black text-wash-text-strong tabular-nums">
                {progreso}%
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-wash-border/60">
              <div
                className="h-full rounded-full bg-gradient-to-r from-wash-brand to-emerald-500 transition-all"
                style={{ width: `${progreso}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Circuitos section header */}
      <div className="mt-5 flex items-end justify-between">
        <div>
          <p className="font-display text-[13px] font-black uppercase tracking-wider text-wash-text-strong">
            Circuitos asignados
          </p>
          <p className="mt-0.5 text-[11px] text-wash-text-muted">
            Detalle por circuito y edificios a visitar
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10.5px] font-semibold text-wash-text-muted">
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 size={12} className="text-emerald-500" />
            Visitado
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Circle size={12} className="text-wash-text-faint" />
            Pendiente
          </span>
        </div>
      </div>

      {/* Circuitos grid */}
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {circuitos.map((c) => {
          const edifs = edificios.filter(
            (e) => e.IDUnivocoCircuito_EV === c.IDUnivocoCircuito_DP
          );
          const visit = edifs.filter((e) => e.Status_EV === 'Visitado').length;
          const pct = edifs.length > 0 ? Math.round((visit / edifs.length) * 100) : 0;
          const complete = edifs.length > 0 && visit === edifs.length;

          return (
            <div
              key={c.ID}
              className={cn(
                'overflow-hidden rounded-xl bg-wash-surface ring-1 transition hover:shadow-sm',
                complete
                  ? 'ring-emerald-500/30 hover:ring-emerald-500/50'
                  : 'ring-wash-border hover:ring-wash-brand/40'
              )}
            >
              <div
                className={cn(
                  'border-b px-3.5 py-2.5',
                  complete
                    ? 'border-emerald-500/20 bg-emerald-500/5'
                    : 'border-wash-border bg-wash-surface-2/40'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-lg ring-1',
                        complete
                          ? 'bg-emerald-500/15 text-emerald-600 ring-emerald-500/25'
                          : 'bg-wash-brand/10 text-wash-brand ring-wash-brand/20'
                      )}
                    >
                      <MapPin size={12} />
                    </span>
                    <div>
                      <p className="font-display text-[13px] font-black leading-none text-wash-accent">
                        Circuito {c.NroCircuito_DP}
                      </p>
                      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-wash-text-muted">
                        {edifs.length} {edifs.length === 1 ? 'edificio' : 'edificios'}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10.5px] font-bold tabular-nums',
                      complete
                        ? 'bg-emerald-500 text-white'
                        : 'bg-wash-surface text-wash-text-strong ring-1 ring-wash-border'
                    )}
                  >
                    {visit}/{edifs.length}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-wash-border/60">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        complete
                          ? 'bg-emerald-500'
                          : 'bg-gradient-to-r from-wash-brand to-wash-brand-light'
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold tabular-nums text-wash-text-muted">
                    {pct}%
                  </span>
                </div>
              </div>
              <ul>
                {edifs.length === 0 ? (
                  <li className="px-3 py-3 text-xs italic text-wash-text-muted">
                    Sin edificios cargados.
                  </li>
                ) : (
                  edifs.map((e) => {
                    const isVisited = e.Status_EV === 'Visitado';
                    return (
                      <li
                        key={e.ID}
                        className={cn(
                          'group flex items-center gap-2 border-l-2 px-3 py-1.5 text-[12px] transition',
                          isVisited
                            ? 'border-emerald-500/50 hover:bg-emerald-500/[0.04]'
                            : 'border-transparent hover:border-wash-brand/40 hover:bg-wash-surface-2/40'
                        )}
                      >
                        {isVisited ? (
                          <CheckCircle2
                            size={13}
                            className="shrink-0 text-emerald-500"
                          />
                        ) : (
                          <Circle
                            size={13}
                            className="shrink-0 text-wash-text-faint"
                          />
                        )}
                        {e.Codigo_EV && (
                          <span
                            className={cn(
                              'shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums',
                              isVisited
                                ? 'bg-emerald-500/10 text-emerald-700'
                                : 'bg-wash-surface-2 text-wash-text-muted'
                            )}
                          >
                            {e.Codigo_EV}
                          </span>
                        )}
                        <span
                          className={cn(
                            'truncate font-medium',
                            isVisited
                              ? 'text-wash-text-strong'
                              : 'text-wash-text'
                          )}
                        >
                          {e.NombreEdificio_EV}
                        </span>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          );
        })}
      </div>

      <ModalActions>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-wash-action px-5 py-2.5 font-medium text-white hover:bg-wash-action-dark"
        >
          Cerrar
        </button>
      </ModalActions>
    </Modal>
  );
}

function StatStrip({
  icon: Icon,
  label,
  value,
  suffix,
  tone = 'brand',
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
  suffix?: string;
  tone?: 'brand' | 'emerald';
}) {
  const toneCls =
    tone === 'emerald'
      ? 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20'
      : 'bg-wash-brand/10 text-wash-brand ring-wash-brand/20';
  return (
    <div className="flex items-center gap-2.5 px-4 py-3">
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1',
          toneCls
        )}
      >
        <Icon size={14} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-wash-text-muted">
          {label}
        </p>
        <p className="font-display text-[19px] font-black leading-none text-wash-text-strong tabular-nums">
          {value}
          {suffix && (
            <span className="ml-0.5 text-[12px] font-bold text-wash-text-muted">
              {suffix}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

// ----- Agregar Ruta modal -----

interface FormLine {
  tecnico: string;
  ruta: string;
}

function AgregarRutaModal({
  open,
  mes,
  tecnicos,
  rutas,
  onClose,
  onSave,
}: {
  open: boolean;
  mes: string | null;
  tecnicos: string[];
  rutas: string[];
  onClose: () => void;
  onSave: (lines: FormLine[]) => void;
}) {
  const [tecnico, setTecnico] = useState('');
  const [ruta, setRuta] = useState('');
  const [lines, setLines] = useState<FormLine[]>([]);

  useEffect(() => {
    if (open) {
      setTecnico('');
      setRuta('');
      setLines([]);
    }
  }, [open]);

  const canAddLine = !!tecnico && !!ruta && !!mes;

  const addLine = () => {
    if (!canAddLine) return;
    setLines((arr) => [...arr, { tecnico, ruta }]);
    setTecnico('');
    setRuta('');
  };

  const removeLine = (idx: number) => {
    setLines((arr) => arr.filter((_, i) => i !== idx));
  };

  return (
    <Modal open={open} onClose={onClose} title="Agregar Ruta" width={760}>
      {/* Intro card */}
      <div className="flex items-start gap-3 rounded-xl bg-wash-brand/[0.06] p-3.5 ring-1 ring-wash-brand/15">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wash-brand/15 text-wash-brand ring-1 ring-wash-brand/25">
          <MapPin size={14} />
        </span>
        <div className="min-w-0">
          <p className="font-display text-[13px] font-bold text-wash-accent">
            Nuevas rutas para {mes ?? '—'}
          </p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-wash-text-muted">
            Seleccioná el técnico y la ruta. Podés sumar varias antes de guardar.
          </p>
        </div>
      </div>

      {/* Form section */}
      <div className="mt-4 rounded-xl border border-wash-border bg-wash-surface-2/40 p-4">
        <div className="grid grid-cols-[1.3fr_1fr_auto_auto] items-end gap-3">
          <div>
            <Label>Técnico</Label>
            <div className="mt-1.5">
              <Select value={tecnico || undefined} onValueChange={setTecnico}>
                <SelectTrigger className="h-10 w-full bg-wash-surface">
                  <SelectValue placeholder="Seleccionar técnico" />
                </SelectTrigger>
                <SelectContent>
                  {tecnicos.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Ruta</Label>
            <div className="mt-1.5">
              <Select value={ruta || undefined} onValueChange={setRuta}>
                <SelectTrigger className="h-10 w-full bg-wash-surface">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {rutas.map((r) => (
                    <SelectItem key={r} value={r}>
                      Ruta {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Mes</Label>
            <div className="mt-1.5">
              <div className="flex h-10 items-center gap-1.5 rounded-md border border-wash-border bg-wash-surface-2/80 px-3 font-mono text-[13px] font-semibold text-wash-text-strong tabular-nums">
                <CalendarDays
                  size={13}
                  className="text-wash-text-muted"
                />
                {mes ?? '—'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={addLine}
            disabled={!canAddLine}
            title="Agregar a la planificación"
            className="flex h-10 items-center gap-1.5 rounded-lg bg-wash-action px-3.5 text-[12.5px] font-semibold text-white shadow-sm shadow-wash-action/30 transition hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:bg-wash-surface-2 disabled:text-wash-text-faint disabled:shadow-none"
          >
            <Plus size={15} />
            Agregar
          </button>
        </div>
      </div>

      {/* Items list */}
      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">
            Rutas agregadas
          </p>
          {lines.length > 0 && (
            <span className="rounded-full bg-wash-brand/10 px-2 py-0.5 text-[10.5px] font-bold text-wash-brand">
              {lines.length} ruta{lines.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <div
          className={cn(
            'rounded-xl border transition-colors',
            lines.length === 0
              ? 'min-h-[240px] border-dashed border-wash-border bg-wash-surface-2/30'
              : 'border-wash-border bg-wash-surface'
          )}
        >
          {lines.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="divide-y divide-wash-divider/60">
              {lines.map((l, i) => (
                <li
                  key={i}
                  className="group flex items-center gap-3 px-3.5 py-2.5 transition hover:bg-wash-surface-2/40"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-wash-surface-2 text-[10.5px] font-bold text-wash-text-muted tabular-nums ring-1 ring-wash-border">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-wash-brand/10 px-2 py-1 font-display text-[12px] font-black text-wash-brand tabular-nums ring-1 ring-wash-brand/20">
                    <MapPin size={11} />
                    Ruta {l.ruta}
                  </span>
                  <div className="flex min-w-0 flex-1 items-center">
                    <span className="truncate text-[12.5px] font-semibold text-wash-text-strong">
                      {l.tecnico}
                    </span>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-wash-surface-2 px-2 py-1 font-mono text-[11px] font-semibold text-wash-text-muted tabular-nums">
                    <CalendarDays size={11} />
                    {mes}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-rose-600 ring-1 ring-rose-500/30 transition hover:bg-rose-500/10 hover:ring-rose-500"
                    title="Quitar"
                  >
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
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
          disabled={lines.length === 0}
          onClick={() => onSave(lines)}
          className="rounded-lg bg-wash-action px-5 py-2.5 font-semibold text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          Guardar
        </button>
      </ModalActions>
    </Modal>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full min-h-[240px] flex-col items-center justify-center px-6 text-center">
      <div className="relative mb-4">
        <span className="absolute inset-0 animate-ping rounded-2xl bg-wash-brand/15" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-wash-brand/10 text-wash-brand ring-1 ring-wash-brand/25">
          <ClipboardEdit size={28} strokeWidth={1.6} />
        </div>
      </div>
      <p className="font-display text-[15px] font-bold text-wash-text-strong">
        Todavía no agregaste rutas
      </p>
      <p className="mt-1 max-w-[280px] text-[12px] leading-relaxed text-wash-text-muted">
        Completá los campos de arriba y tocá el botón <strong>+</strong> para sumar una
        ruta a la planificación.
      </p>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">
      {children}
    </label>
  );
}

function ActionBtn({
  icon: Icon,
  tone,
  title,
  onClick,
}: {
  icon: typeof Eye;
  tone: 'neutral' | 'brand' | 'danger';
  title: string;
  onClick: (e: React.MouseEvent) => void;
}) {
  const cls = {
    neutral:
      'text-wash-text-muted ring-wash-border hover:bg-wash-surface-2 hover:text-wash-text-strong hover:ring-wash-text-muted/40',
    brand:
      'text-wash-brand ring-wash-brand/30 hover:bg-wash-brand/10 hover:ring-wash-brand',
    danger:
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
