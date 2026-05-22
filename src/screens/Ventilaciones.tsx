import { useMemo, useState } from 'react';
import {
  UserCog,
  Trash2,
  AlertTriangle,
  Building2,
  Calendar,
  Eye,
  Plus,
  CheckCircle2,
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
import { PopoverClose } from '@/components/ui/popover';
import {
  DatePicker,
  formatDateDDMMYYYY,
} from '@/components/ui/date-picker';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import type { Ventilacion } from '@/types/domain';

const ESTADOS: Ventilacion['Estado_VE'][] = [
  'Pendiente',
  'Asignada',
  'Programada',
  'Realizada',
];

export function Ventilaciones() {
  const ventilaciones = useAppStore((s) => s.CollectVentilaciones);
  const usuarios = useAppStore((s) => s.CollectUser);
  const edificios = useAppStore((s) => s.CollectEdificios);
  const frecuencias = useAppStore((s) => s.CollectFrecuencias);
  const patchVentilacion = useAppStore((s) => s.patchVentilacion);
  const removeVentilacion = useAppStore((s) => s.removeVentilacion);
  const addVentilacion = useAppStore((s) => s.addVentilacion);
  const VarTipoUser = useAppStore((s) => s.VarTipoUser);

  const [query, setQuery] = useState('');
  const [filterEstado, setFilterEstado] = useState<string>('Todos');
  const [filterEdif, setFilterEdif] = useState<string>('Todos');

  // Modals
  const [assigning, setAssigning] = useState<Ventilacion | null>(null);
  const [newTec, setNewTec] = useState('');
  const [deleting, setDeleting] = useState<Ventilacion | null>(null);
  const [viewing, setViewing] = useState<Ventilacion | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const canManage = VarTipoUser === 'Admin' || VarTipoUser === 'Jefe Taller';

  const tecnicos = useMemo(
    () =>
      usuarios.filter(
        (u) => u.Status === 'ALTA' && (u.Rol === 'Tecnico' || u.Rol === 'Jefe Taller')
      ),
    [usuarios]
  );

  // Counters
  const counters = useMemo(() => {
    const pending = ventilaciones.filter((v) => v.Estado_VE === 'Pendiente').length;
    const incidentes = ventilaciones.filter((v) => v.EsIncidente_VE === 'SI').length;
    const programadas = ventilaciones.filter((v) => v.Estado_VE === 'Programada').length;
    const realizadas = ventilaciones.filter((v) => v.Estado_VE === 'Realizada').length;
    return { pending, incidentes, programadas, realizadas };
  }, [ventilaciones]);

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

  const initials = (name: string) =>
    name
      .split(/[\s,]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();

  const columns: Column<Ventilacion>[] = [
    {
      key: 'estado',
      header: 'Estado',
      width: '180px',
      truncate: false,
      render: (v) => (
        <div className="flex items-center gap-2">
          <StatusBadge status={v.Estado_VE} />
          {v.EsIncidente_VE === 'SI' && (
            <span
              title="Atrasada o con incidente"
              className="flex h-5 w-5 items-center justify-center rounded-md bg-rose-50 text-rose-600 ring-1 ring-rose-200"
            >
              <AlertTriangle size={11} />
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'edificio',
      header: 'Edificio / Hotel',
      width: 'minmax(260px, 1fr)',
      render: (v) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wash-brand/10 text-wash-brand ring-1 ring-wash-brand/20">
            <Building2 size={14} />
          </span>
          <span className="truncate text-[13px] font-semibold text-wash-text-strong">
            {v.Edificio_VE}
          </span>
        </div>
      ),
    },
    {
      key: 'grupo',
      header: 'Grupo',
      width: '110px',
      align: 'center',
      truncate: false,
      render: (v) => (
        <span className="inline-flex min-w-[40px] items-center justify-center rounded-md bg-wash-surface-2 px-2 py-0.5 text-[12.5px] font-semibold text-wash-text-strong tabular-nums">
          {v.Grupo_VE}
        </span>
      ),
    },
    {
      key: 'asignado',
      header: 'Asignado',
      width: '190px',
      truncate: false,
      render: (v) => {
        if (!v.Asignado_VE) {
          return <span className="text-wash-text-faint">—</span>;
        }
        return (
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[9.5px] font-semibold text-slate-600">
              {initials(v.Asignado_VE)}
            </span>
            <span className="truncate text-[12.5px] text-wash-text-strong">
              {v.Asignado_VE}
            </span>
          </div>
        );
      },
    },
    {
      key: 'ultima',
      header: 'Última limpieza',
      width: '150px',
      render: (v) =>
        v.FechaUltima_VE ? (
          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-wash-text">
            <Calendar size={11} className="text-wash-text-faint" />
            {v.FechaUltima_VE}
          </span>
        ) : (
          <span className="text-[12px] italic text-wash-text-faint">Primera vez</span>
        ),
    },
    {
      key: 'proxima',
      header: 'Próxima limpieza',
      width: '150px',
      render: (v) => (
        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-wash-text-strong">
          <Calendar size={11} className="text-wash-brand" />
          {v.FechaProgramada_VE ?? v.ProximaLimpieza_VE}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      width: '140px',
      align: 'right',
      truncate: false,
      render: (v) => (
        <div className="flex items-center justify-end gap-1.5">
          {v.Estado_VE === 'Realizada' ? (
            <ActionButton
              icon={Eye}
              tone="neutral"
              title="Ver observaciones"
              onClick={(e) => {
                e.stopPropagation();
                setViewing(v);
              }}
            />
          ) : (
            <ActionButton
              icon={UserCog}
              tone="brand"
              title="Asignar técnico"
              onClick={(e) => {
                e.stopPropagation();
                setAssigning(v);
                setNewTec(v.Asignado_VE ?? '');
              }}
            />
          )}
          {canManage && (
            <ActionButton
              icon={Trash2}
              tone="danger"
              title="Eliminar"
              onClick={(e) => {
                e.stopPropagation();
                setDeleting(v);
              }}
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex h-full w-full flex-col">
      <PageHeader
        title="Ventilaciones"
        subtitle="Mantenimiento preventivo de conductos"
        search={{
          value: query,
          onChange: setQuery,
          placeholder: 'Buscar edificio, grupo, estado…',
        }}
        filterPopover={
          <FilterContent
            estado={filterEstado}
            edificio={filterEdif}
            edificios={edificios.map((e) => e.Edificio)}
            onApply={(e, ed) => {
              setFilterEstado(e);
              setFilterEdif(ed);
            }}
          />
        }
        onAdd={canManage ? () => setAddOpen(true) : undefined}
        addLabel="Agregar edificio"
      />

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3 border-b border-wash-border bg-wash-surface px-6 py-4">
        <CounterCard
          icon={AlertTriangle}
          label="Pendientes"
          value={counters.pending}
          tone="bg-amber-500/10 text-amber-700 ring-amber-500/20"
        />
        <CounterCard
          icon={AlertTriangle}
          label="Con incidente"
          value={counters.incidentes}
          tone="bg-rose-500/10 text-rose-600 ring-rose-500/20"
        />
        <CounterCard
          icon={Calendar}
          label="Programadas"
          value={counters.programadas}
          tone="bg-indigo-500/10 text-indigo-700 ring-indigo-500/20"
        />
        <CounterCard
          icon={CheckCircle2}
          label="Realizadas"
          value={counters.realizadas}
          tone="bg-emerald-500/10 text-emerald-700 ring-emerald-500/20"
        />
      </div>

      {/* Active filter chips */}
      {(filterEstado !== 'Todos' || filterEdif !== 'Todos') && (
        <div className="flex items-center gap-2 border-b border-wash-border bg-wash-surface-2/40 px-6 py-2 text-xs text-wash-text-muted">
          <span className="font-semibold uppercase tracking-wider">Filtros:</span>
          {filterEstado !== 'Todos' && (
            <span className="rounded-full bg-wash-brand/10 px-2.5 py-0.5 font-semibold text-wash-brand">
              {filterEstado}
            </span>
          )}
          {filterEdif !== 'Todos' && (
            <span className="rounded-full bg-wash-brand/10 px-2.5 py-0.5 font-semibold text-wash-brand">
              {filterEdif}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setFilterEstado('Todos');
              setFilterEdif('Todos');
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
          empty="Sin ventilaciones para los filtros aplicados."
        />
      </div>

      {/* Asignar técnico */}
      <Modal
        open={!!assigning}
        onClose={() => setAssigning(null)}
        title="Asignar técnico"
        width={560}
      >
        {assigning && (
          <>
            <div className="rounded-xl bg-wash-surface-2/50 p-4 ring-1 ring-wash-border">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-wash-brand/10 text-wash-brand ring-1 ring-wash-brand/20">
                  <Building2 size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[15px] font-black text-wash-accent">
                    {assigning.Edificio_VE}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-wash-text-muted">
                    <span>Grupo</span>
                    <span className="rounded-md bg-wash-surface px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-wash-text">
                      {assigning.Grupo_VE}
                    </span>
                    <span className="text-wash-text-faint">·</span>
                    <span>{assigning.Frecuencia_VE}</span>
                  </div>
                </div>
                <StatusBadge status={assigning.Estado_VE} />
              </div>
            </div>

            <div className="mt-5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">
                Técnico
              </label>
              <div className="mt-1.5">
                <Select value={newTec || undefined} onValueChange={setNewTec}>
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue placeholder="Elegir técnico…" />
                  </SelectTrigger>
                  <SelectContent>
                    {tecnicos.map((t) => (
                      <SelectItem key={t.ID} value={t.Concat_Nombre_Apellido}>
                        {t.Concat_Nombre_Apellido}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="mt-1.5 text-[11px] text-wash-text-muted">
                Al asignar, la ventilación pasa a estado <strong>Asignada</strong>.
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
                disabled={!newTec}
                onClick={() => {
                  patchVentilacion(assigning.ID, {
                    Asignado_VE: newTec || undefined,
                    Estado_VE: newTec ? 'Asignada' : 'Pendiente',
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

      {/* Ver observaciones (Realizada) */}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title="Ventilación realizada"
        width={560}
      >
        {viewing && (
          <>
            <div className="rounded-xl bg-wash-surface-2/50 p-4 ring-1 ring-wash-border">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20">
                  <CheckCircle2 size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[15px] font-black text-wash-accent">
                    {viewing.Edificio_VE}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-wash-text-muted">
                    <span>Grupo</span>
                    <span className="rounded-md bg-wash-surface px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-wash-text">
                      {viewing.Grupo_VE}
                    </span>
                    <span className="text-wash-text-faint">·</span>
                    <span>{viewing.Asignado_VE}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field
                icon={Calendar}
                label="Última limpieza"
                value={viewing.FechaUltima_VE ?? '—'}
              />
              <Field
                icon={Calendar}
                label="Próxima limpieza"
                value={viewing.ProximaLimpieza_VE}
              />
            </div>

            <div className="mt-4">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">
                Observación
              </label>
              <div className="mt-1.5 relative overflow-hidden rounded-xl border border-wash-border bg-wash-surface px-5 py-4">
                <span className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-emerald-400 to-emerald-600" />
                <p className="text-sm leading-relaxed text-wash-text-strong">
                  {viewing.ObservacionResuelto_VE ?? (
                    <span className="italic text-wash-text-muted">
                      Sin observación registrada.
                    </span>
                  )}
                </p>
              </div>
            </div>

            <ModalActions>
              <button
                type="button"
                onClick={() => setViewing(null)}
                className="rounded-lg bg-wash-action px-5 py-2.5 font-medium text-white hover:bg-wash-action-dark"
              >
                Cerrar
              </button>
            </ModalActions>
          </>
        )}
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleting}
        tone="danger"
        title="Eliminar ventilación"
        message={
          deleting
            ? `¿Eliminar la ventilación de ${deleting.Edificio_VE} (Grupo ${deleting.Grupo_VE})? Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Eliminar"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) removeVentilacion(deleting.ID);
          setDeleting(null);
        }}
      />

      {/* Add edificio */}
      <AddEdificioModal
        open={addOpen}
        edificios={edificios.map((e) => e.Edificio)}
        frecuencias={frecuencias.map((f) => f.Frecuencia_FE)}
        onClose={() => setAddOpen(false)}
        onAdd={(payload) => {
          addVentilacion({
            ...payload,
            Estado_VE: 'Pendiente',
            EsIncidente_VE: 'NO',
            FechaMesAnoProxima_VE: payload.ProximaLimpieza_VE.split('/').slice(1).join('/'),
          });
          setAddOpen(false);
        }}
      />
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

function CounterCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Eye;
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
    <div className="rounded-lg bg-wash-surface-2/40 px-3 py-2 ring-1 ring-wash-border">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-wash-text-muted">
        {Icon && <Icon size={11} className="opacity-70" />}
        {label}
      </div>
      <div className="mt-1 text-[12.5px] font-semibold text-wash-text-strong">
        {value}
      </div>
    </div>
  );
}

// ----- Filter popover -----

function FilterContent({
  estado,
  edificio,
  edificios,
  onApply,
}: {
  estado: string;
  edificio: string;
  edificios: string[];
  onApply: (estado: string, edificio: string) => void;
}) {
  const [pendingEstado, setPendingEstado] = useState(estado);
  const [pendingEdif, setPendingEdif] = useState(edificio);

  const dirty = pendingEstado !== estado || pendingEdif !== edificio;
  const hasFilters = pendingEstado !== 'Todos' || pendingEdif !== 'Todos';

  return (
    <div>
      <div className="mb-3 flex items-center justify-between border-b border-wash-border pb-2.5">
        <h3 className="text-sm font-bold text-wash-text-strong">Filtrar</h3>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setPendingEstado('Todos');
              setPendingEdif('Todos');
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
            Estado
          </label>
          <div className="mt-1.5">
            <Select value={pendingEstado} onValueChange={setPendingEstado}>
              <SelectTrigger className="h-9 w-full text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos</SelectItem>
                {ESTADOS.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">
            Edificio
          </label>
          <div className="mt-1.5">
            <Select value={pendingEdif} onValueChange={setPendingEdif}>
              <SelectTrigger className="h-9 w-full text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos</SelectItem>
                {edificios.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
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
            onClick={() => onApply(pendingEstado, pendingEdif)}
            className="rounded-lg bg-wash-action px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            Aplicar
          </button>
        </PopoverClose>
      </div>
    </div>
  );
}

// ----- Add Edificio modal -----

function AddEdificioModal({
  open,
  edificios,
  frecuencias,
  onClose,
  onAdd,
}: {
  open: boolean;
  edificios: string[];
  frecuencias: string[];
  onClose: () => void;
  onAdd: (payload: {
    Edificio_VE: string;
    Grupo_VE: string;
    Frecuencia_VE: string;
    ProximaLimpieza_VE: string;
  }) => void;
}) {
  const [edif, setEdif] = useState('');
  const [grupo, setGrupo] = useState('');
  const [frec, setFrec] = useState('');
  const [proxima, setProxima] = useState<Date | undefined>(undefined);

  const reset = () => {
    setEdif('');
    setGrupo('');
    setFrec('');
    setProxima(undefined);
  };
  const ready = !!edif && !!grupo && !!frec && !!proxima;

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Agregar ventilación"
      width={580}
    >
      <p className="text-sm text-wash-text-muted">
        Cargá un nuevo edificio o hotel para programar su mantenimiento de ventilación.
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <LabelReq required>Edificio / Hotel</LabelReq>
          <div className="mt-1.5">
            <Select value={edif || undefined} onValueChange={setEdif}>
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder="Elegir edificio…" />
              </SelectTrigger>
              <SelectContent>
                {edificios.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <LabelReq required>Grupo</LabelReq>
            <input
              type="text"
              value={grupo}
              onChange={(e) => setGrupo(e.target.value)}
              placeholder="Ej. 12"
              className="mt-1.5 h-10 w-full rounded-lg border border-wash-border bg-wash-surface px-3 text-sm outline-none focus:border-wash-action focus:ring-2 focus:ring-wash-action/15"
            />
          </div>
          <div>
            <LabelReq required>Frecuencia (días)</LabelReq>
            <div className="mt-1.5">
              <Select value={frec || undefined} onValueChange={setFrec}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder="Elegir…" />
                </SelectTrigger>
                <SelectContent>
                  {frecuencias.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f} días
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div>
          <LabelReq required>Próxima limpieza</LabelReq>
          <div className="mt-1.5">
            <DatePicker
              value={proxima}
              onChange={setProxima}
              placeholder="Seleccionar fecha…"
            />
          </div>
        </div>
      </div>

      <ModalActions>
        <button
          type="button"
          onClick={() => {
            reset();
            onClose();
          }}
          className="rounded-lg border border-wash-border px-5 py-2.5 font-medium text-wash-text-strong hover:bg-wash-surface-2"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!ready}
          onClick={() => {
            if (!proxima) return;
            onAdd({
              Edificio_VE: edif,
              Grupo_VE: grupo,
              Frecuencia_VE: frec,
              ProximaLimpieza_VE: formatDateDDMMYYYY(proxima),
            });
            reset();
          }}
          className="flex items-center gap-2 rounded-lg bg-wash-action px-5 py-2.5 font-semibold text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={15} />
          Agregar
        </button>
      </ModalActions>
    </Modal>
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
