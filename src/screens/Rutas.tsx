import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Eye,
  Pencil,
  Trash2,
  CalendarDays,
  MapPin,
  Users,
  Plus,
  ClipboardEdit,
  X,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { Modal, ModalActions } from '@/components/Modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import type { MesPlanificacion } from '@/types/domain';

export function Rutas() {
  const navigate = useNavigate();
  const meses = useAppStore((s) => s.CollectMesesPlanificados);
  const resumen = useAppStore((s) => s.CollectResumenPlanificaciones);
  const usuarios = useAppStore((s) => s.CollectUser);
  const rutasCatalog = useAppStore((s) => s.CollectRutasDisponibles);
  const setMesPlanif = useAppStore((s) => s.setMesPlanificacionDetail);

  const [query, setQuery] = useState('');
  const [deleting, setDeleting] = useState<MesPlanificacion | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<MesPlanificacion | null>(null);

  const filteredMeses = useMemo(() => {
    const q = query.toLowerCase();
    const monthOrder = (mesAno: string) => {
      const [mm, yyyy] = mesAno.split('/').map(Number);
      return yyyy * 100 + mm;
    };
    return [...meses]
      .filter((m) => m.Status_MP === 'Activo')
      .sort((a, b) => monthOrder(b.MesAnoPlanificado_MP) - monthOrder(a.MesAnoPlanificado_MP))
      .filter(
        (m) =>
          m.MesAnoPlanificado_MP.toLowerCase().includes(q) ||
          m.MesPlanificado_MP.toLowerCase().includes(q)
      );
  }, [meses, query]);

  const rutasDelMes = (mesAno: string) =>
    resumen.filter((r) => r.MesAnoPlanificado_RP === mesAno);

  const goDetail = (m: MesPlanificacion) => {
    setMesPlanif(m.MesAnoPlanificado_MP, m.MesPlanificado_MP);
    navigate('/planificacion/detalle');
  };

  const tecnicos = useMemo(
    () =>
      usuarios.filter(
        (u) => u.Status === 'ALTA' && (u.Rol === 'Tecnico' || u.Rol === 'Jefe Taller')
      ),
    [usuarios]
  );

  const rutasOptions = useMemo(
    () => rutasCatalog.filter((r) => r.Status_RT === 'Activo'),
    [rutasCatalog]
  );

  const mesesOptions = useMemo(() => generateMonthOptions(), []);

  const columns: Column<MesPlanificacion>[] = [
    {
      key: 'mes',
      header: 'Mes',
      width: 'minmax(280px, 1fr)',
      render: (m) => {
        const [, year] = m.MesAnoPlanificado_MP.split('/');
        return (
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-wash-brand/10 text-wash-brand ring-1 ring-wash-brand/20">
              <CalendarDays size={15} />
            </span>
            <div>
              <p className="font-display text-[14px] font-black capitalize text-wash-accent">
                {m.MesPlanificado_MP} {year}
              </p>
              <p className="mt-0.5 text-[11px] text-wash-text-muted">
                Planificación mensual
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'rutas',
      header: 'Rutas totales',
      width: '170px',
      align: 'center',
      truncate: false,
      render: (m) => (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-wash-surface-2 px-2.5 py-1 text-[12.5px] font-bold text-wash-text-strong tabular-nums">
          <MapPin size={11} className="text-wash-brand" />
          {m.RutasTotales_MP}
        </span>
      ),
    },
    {
      key: 'tecnicos',
      header: 'Técnicos totales',
      width: '180px',
      align: 'center',
      truncate: false,
      render: (m) => (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-wash-surface-2 px-2.5 py-1 text-[12.5px] font-bold text-wash-text-strong tabular-nums">
          <Users size={11} className="text-wash-brand" />
          {m.TecnicosTotales_MP}
        </span>
      ),
    },
    {
      key: 'progreso',
      header: 'Progreso',
      width: '180px',
      truncate: false,
      render: (m) => {
        const rutas = rutasDelMes(m.MesAnoPlanificado_MP);
        const cerradas = rutas.filter((r) => r.Status_RP === 'Cerrada').length;
        const total = rutas.length;
        const pct = total === 0 ? 0 : Math.round((cerradas / total) * 100);
        return (
          <div className="flex w-full items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-wash-surface-2">
              <div
                className="h-full rounded-full bg-gradient-to-r from-wash-brand-light to-wash-brand transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[11.5px] font-semibold text-wash-text-muted tabular-nums">
              {pct}%
            </span>
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'Acciones',
      width: '140px',
      align: 'right',
      truncate: false,
      render: (m) => (
        <div className="flex items-center justify-end gap-1.5">
          <ActionBtn
            icon={Eye}
            tone="brand"
            title="Ver planificación"
            onClick={(e) => {
              e.stopPropagation();
              goDetail(m);
            }}
          />
          <ActionBtn
            icon={Pencil}
            tone="neutral"
            title="Editar"
            onClick={(e) => {
              e.stopPropagation();
              setEditing(m);
            }}
          />
          <ActionBtn
            icon={Trash2}
            tone="danger"
            title="Eliminar"
            onClick={(e) => {
              e.stopPropagation();
              setDeleting(m);
            }}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="flex h-full w-full flex-col">
      <PageHeader
        title="Planificación de rutas"
        subtitle="Cronograma mensual de visitas"
        search={{ value: query, onChange: setQuery, placeholder: 'Buscar mes…' }}
        onAdd={() => setCreateOpen(true)}
        addLabel="Crear planificación"
      />

      <div className="flex-1 overflow-hidden p-6">
        <DataTable
          rows={filteredMeses}
          rowKey={(r) => r.ID}
          columns={columns}
          empty="Sin planificaciones registradas."
          onRowClick={(m) => goDetail(m)}
        />
      </div>

      {/* Nueva planificación */}
      <PlanificacionFormModal
        open={createOpen}
        mode="create"
        tecnicos={tecnicos.map((t) => t.Concat_Nombre_Apellido)}
        rutas={rutasOptions.map((r) => r.NroRuta_RT)}
        meses={mesesOptions}
        onClose={() => setCreateOpen(false)}
        onSave={() => setCreateOpen(false)}
      />

      {/* Editar planificación */}
      <PlanificacionFormModal
        open={!!editing}
        mode="edit"
        defaultMes={editing?.MesAnoPlanificado_MP}
        tecnicos={tecnicos.map((t) => t.Concat_Nombre_Apellido)}
        rutas={rutasOptions.map((r) => r.NroRuta_RT)}
        meses={mesesOptions}
        onClose={() => setEditing(null)}
        onSave={() => setEditing(null)}
      />

      {/* Delete confirm (icon-hero layout) */}
      <DeletePlanificacionModal
        planif={deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => setDeleting(null)}
      />
    </div>
  );
}

// ----- Helpers -----

function generateMonthOptions(): string[] {
  const out: string[] = [];
  const now = new Date();
  // Last 6 months + current + next 6 months
  for (let offset = -6; offset <= 6; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    out.push(`${mm}/${d.getFullYear()}`);
  }
  return out;
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

// ----- Delete modal -----

function DeletePlanificacionModal({
  planif,
  onClose,
  onConfirm,
}: {
  planif: MesPlanificacion | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal open={!!planif} onClose={onClose} title="" width={520}>
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-200">
          <Trash2 size={20} />
        </span>
        <div className="flex-1">
          <h2 className="font-display text-lg font-black text-wash-text-strong">
            Eliminar Planificación
          </h2>
          <p className="mt-1 text-sm text-wash-text-muted">
            ¿Está seguro de que desea eliminar esta Planificación? No podrás
            recuperarla.
          </p>
        </div>
      </div>
      <ModalActions>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-wash-border px-5 py-2.5 font-medium text-wash-text-muted hover:bg-wash-surface-2"
        >
          Cerrar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-lg bg-wash-action px-5 py-2.5 font-semibold text-white hover:bg-wash-action-dark"
        >
          Aceptar
        </button>
      </ModalActions>
    </Modal>
  );
}

// ----- Form modal (create / edit) -----

interface FormLine {
  tecnico: string;
  ruta: string;
  mes: string;
}

function PlanificacionFormModal({
  open,
  mode,
  defaultMes,
  tecnicos,
  rutas,
  meses,
  onClose,
  onSave,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  defaultMes?: string;
  tecnicos: string[];
  rutas: string[];
  meses: string[];
  onClose: () => void;
  onSave: (lines: FormLine[]) => void;
}) {
  const [tecnico, setTecnico] = useState('');
  const [ruta, setRuta] = useState('');
  const [mes, setMes] = useState(defaultMes ?? '');
  const [lines, setLines] = useState<FormLine[]>([]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setTecnico('');
      setRuta('');
      setMes(defaultMes ?? '');
      setLines([]);
    }
  }, [open, defaultMes]);

  const canAddLine = !!tecnico && !!ruta && !!mes;

  const addLine = () => {
    if (!canAddLine) return;
    setLines((arr) => [...arr, { tecnico, ruta, mes }]);
    setTecnico('');
    setRuta('');
    // Keep mes selected for convenience
  };

  const removeLine = (idx: number) => {
    setLines((arr) => arr.filter((_, i) => i !== idx));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'Nueva planificación' : 'Editar planificación'}
      width={720}
    >
      <p className="text-sm text-wash-text-muted">
        Asigná técnicos a rutas mensuales. Podés sumar varias líneas antes de guardar.
      </p>

      {/* Form section */}
      <div className="mt-5 rounded-xl border border-wash-border bg-wash-surface-2/40 p-4">
        <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-3">
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
              <Select value={mes || undefined} onValueChange={setMes}>
                <SelectTrigger className="h-10 w-full bg-wash-surface">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {meses.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <button
            type="button"
            onClick={addLine}
            disabled={!canAddLine}
            title="Agregar a la planificación"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-wash-action text-white shadow-sm shadow-wash-action/30 transition hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:bg-wash-surface-2 disabled:text-wash-text-faint disabled:shadow-none"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {/* Items list */}
      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">
            Planificación agregada
          </p>
          {lines.length > 0 && (
            <span className="rounded-full bg-wash-brand/10 px-2 py-0.5 text-[10.5px] font-bold text-wash-brand">
              {lines.length} ruta{lines.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <div
          className={cn(
            'min-h-[240px] rounded-xl border transition-colors',
            lines.length === 0
              ? 'border-dashed border-wash-border bg-wash-surface-2/30'
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
                  className="group flex items-center gap-3 px-4 py-2.5"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wash-brand/10 text-wash-brand ring-1 ring-wash-brand/20">
                    <MapPin size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-[13px] font-bold text-wash-accent">
                      Ruta {l.ruta}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-wash-text-muted">
                      <span className="font-semibold text-wash-text">{l.tecnico}</span>
                      <span className="mx-1.5 text-wash-text-faint">·</span>
                      <span className="font-mono">{l.mes}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-rose-600 ring-1 ring-rose-500/30 transition hover:bg-rose-500/10 hover:ring-rose-500"
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
        Aún no agregaste rutas
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
