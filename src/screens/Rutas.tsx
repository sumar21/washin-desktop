import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Eye,
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
import { Modal, ModalActions, ConfirmDialog } from '@/components/Modal';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppStore } from '@/store/useAppStore';
import { canEditPlanif } from '@/lib/nav';
import { cn } from '@/lib/utils';
import type { PlanifMes } from '@/types/domain';

const MONTHS_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

interface MesOption {
  value: string; // 'mm/yyyy'
  nombre: string; // 'Julio'
  label: string; // 'Julio 2026'
}

function generateMonthOptions(): MesOption[] {
  const out: MesOption[] = [];
  const now = new Date();
  for (let offset = -6; offset <= 6; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const nombre = MONTHS_ES[d.getMonth()];
    out.push({
      value: `${mm}/${d.getFullYear()}`,
      nombre,
      label: `${nombre} ${d.getFullYear()}`,
    });
  }
  return out;
}

export function Rutas() {
  const navigate = useNavigate();
  const VarTipoUser = useAppStore((s) => s.VarTipoUser);
  // Supervisor + Jefe Taller: planificación en solo-lectura (ven meses/rutas, no crean/borran).
  const canEdit = canEditPlanif(VarTipoUser);
  const meses = useAppStore((s) => s.CollectPlanifMeses);
  const tecnicos = useAppStore((s) => s.CollectTecnicosDisponibles);
  const rutasCatalog = useAppStore((s) => s.CollectAbmRutas);
  const fetchPlanificaciones = useAppStore((s) => s.fetchPlanificaciones);
  const createPlanificacion = useAppStore((s) => s.createPlanificacion);
  const deletePlanificacion = useAppStore((s) => s.deletePlanificacion);
  const setMesPlanif = useAppStore((s) => s.setMesPlanificacionDetail);

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState<PlanifMes | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);
    return fetchPlanificaciones()
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : 'No se pudieron cargar las planificaciones.'
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [fetchPlanificaciones]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial; `loadData` también la dispara el botón "Reintentar".
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar; `loadData` ya setea su propio loading.
  }, []);

  const monthOrder = (mesAno: string) => {
    const [mm, yyyy] = mesAno.split('/').map(Number);
    return yyyy * 100 + mm;
  };

  const filteredMeses = useMemo(() => {
    const q = query.toLowerCase();
    return [...meses]
      .sort((a, b) => monthOrder(b.MesAno) - monthOrder(a.MesAno))
      .filter(
        (m) =>
          m.MesAno.toLowerCase().includes(q) || m.Mes.toLowerCase().includes(q)
      );
  }, [meses, query]);

  const mesesOptions = useMemo(() => generateMonthOptions(), []);

  const goDetail = (m: PlanifMes) => {
    setMesPlanif(m.MesAno, m.Mes);
    navigate('/planificacion/detalle');
  };

  const handleDelete = async () => {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deletePlanificacion({ mesAno: deleting.MesAno });
      setDeleting(null);
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : 'No se pudo eliminar la planificación.'
      );
    } finally {
      setDeleteBusy(false);
    }
  };

  const yearOf = (mesAno: string) => mesAno.split('/')[1] ?? '';

  const columns: Column<PlanifMes>[] = [
    {
      key: 'mes',
      header: 'Mes',
      width: 'minmax(280px, 1fr)',
      render: (m) => (
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-wash-brand/10 text-wash-brand ring-1 ring-wash-brand/20">
            <CalendarDays size={15} />
          </span>
          <div>
            <p className="font-display text-[14px] font-black capitalize text-wash-accent">
              {m.Mes} {yearOf(m.MesAno)}
            </p>
            <p className="mt-0.5 text-[11px] text-wash-text-muted">Planificación mensual</p>
          </div>
        </div>
      ),
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
          {m.RutasTotales}
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
          {m.TecnicosTotales}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      width: '110px',
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
          {canEdit && (
            <ActionBtn
              icon={Trash2}
              tone="danger"
              title="Eliminar"
              onClick={(e) => {
                e.stopPropagation();
                setDeleting(m);
                setDeleteError(null);
              }}
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="relative flex h-full w-full flex-col">
      <PageHeader
        title="Planificación de rutas"
        subtitle="Cronograma mensual de visitas"
        search={{ value: query, onChange: setQuery, placeholder: 'Buscar mes…' }}
        onAdd={canEdit ? () => setCreateOpen(true) : undefined}
        addLabel="Crear planificación"
      />
      <LoadingOverlay visible={loading} label="Cargando planificaciones…" />

      {error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : (
        <div className="flex-1 overflow-hidden p-6">
          <DataTable
            rows={filteredMeses}
            rowKey={(r) => r.ID}
            columns={columns}
            empty={
              <EmptyState
                icon={CalendarDays}
                title="Sin planificaciones"
                description="Todavía no creaste ninguna planificación mensual."
                action={canEdit ? <Button onClick={() => setCreateOpen(true)}>Crear planificación</Button> : undefined}
              />
            }
            onRowClick={(m) => goDetail(m)}
            mobileCard={(m) => {
              return (
                <div className="rounded-xl border border-wash-border bg-wash-surface p-3 shadow-sm transition active:scale-[0.99]">
                  {/* Fila 1: mes + acciones */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-wash-brand/10 text-wash-brand ring-1 ring-wash-brand/20">
                        <CalendarDays size={15} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-display text-[14px] font-black capitalize text-wash-accent">
                          {m.Mes} {yearOf(m.MesAno)}
                        </p>
                        <p className="text-[11px] text-wash-text-muted">Planificación mensual</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <ActionBtn
                        icon={Eye}
                        tone="brand"
                        title="Ver planificación"
                        onClick={(e) => {
                          e.stopPropagation();
                          goDetail(m);
                        }}
                      />
                      {canEdit && (
                        <ActionBtn
                          icon={Trash2}
                          tone="danger"
                          title="Eliminar"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleting(m);
                            setDeleteError(null);
                          }}
                        />
                      )}
                    </div>
                  </div>
                  {/* Fila 2: rutas / técnicos */}
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-wash-surface-2 px-2.5 py-1 text-[12px] font-bold text-wash-text-strong tabular-nums">
                      <MapPin size={11} className="text-wash-brand" />
                      {m.RutasTotales} rutas
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-wash-surface-2 px-2.5 py-1 text-[12px] font-bold text-wash-text-strong tabular-nums">
                      <Users size={11} className="text-wash-brand" />
                      {m.TecnicosTotales} técnicos
                    </span>
                  </div>
                </div>
              );
            }}
          />
        </div>
      )}

      {/* Nueva planificación */}
      <CreatePlanificacionModal
        open={createOpen}
        tecnicos={tecnicos.map((t) => t.Nombre_Tecnico)}
        rutas={rutasCatalog.map((r) => String(r.NroRuta))}
        meses={mesesOptions}
        onClose={() => setCreateOpen(false)}
        onCreate={async (mes, mesNombre, lines) => {
          await createPlanificacion({ mes, mesNombre, lines });
          setCreateOpen(false);
        }}
      />

      {/* Eliminar planificación */}
      <ConfirmDialog
        open={!!deleting}
        tone="danger"
        title="Eliminar planificación"
        message={
          deleting
            ? `¿Eliminar la planificación de ${deleting.Mes} ${yearOf(deleting.MesAno)}? Se eliminan sus ${deleting.RutasTotales} ruta(s) asignada(s). Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel={deleteBusy ? 'Eliminando…' : 'Eliminar'}
        busy={deleteBusy}
        error={deleteError}
        onCancel={() => {
          setDeleting(null);
          setDeleteError(null);
        }}
        onConfirm={handleDelete}
      />
    </div>
  );
}

// ----- Shared bits -----

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

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">
      {children}
    </label>
  );
}

// ----- Crear planificación modal -----

interface FormLine {
  tecnico: string;
  nroRuta: string;
}

function CreatePlanificacionModal({
  open,
  tecnicos,
  rutas,
  meses,
  onClose,
  onCreate,
}: {
  open: boolean;
  tecnicos: string[];
  rutas: string[];
  meses: MesOption[];
  onClose: () => void;
  onCreate: (mes: string, mesNombre: string, lines: FormLine[]) => Promise<void>;
}) {
  const [mes, setMes] = useState('');
  const [tecnico, setTecnico] = useState('');
  const [ruta, setRuta] = useState('');
  const [lines, setLines] = useState<FormLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset del formulario al abrir el modal.
      setMes('');
      setTecnico('');
      setRuta('');
      setLines([]);
      setSaving(false);
      setError(null);
    }
  }, [open]);

  const canAddLine = !!tecnico && !!ruta;
  const canCreate = !!mes && lines.length > 0;

  const addLine = () => {
    if (!canAddLine) return;
    setLines((arr) => [...arr, { tecnico, nroRuta: ruta }]);
    setTecnico('');
    setRuta('');
  };

  const removeLine = (idx: number) => {
    setLines((arr) => arr.filter((_, i) => i !== idx));
  };

  const handleCreate = async () => {
    if (!canCreate || saving) return;
    const opt = meses.find((m) => m.value === mes);
    setSaving(true);
    setError(null);
    try {
      await onCreate(mes, opt?.nombre ?? '', lines);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo crear la planificación.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nueva planificación" width={720}>
      <p className="text-sm text-wash-text-muted">
        Elegí el mes y asigná técnicos a rutas. Podés sumar varias líneas antes de crear.
      </p>

      {/* Mes de la planificación */}
      <div className="mt-5">
        <Label>Mes de la planificación</Label>
        <div className="mt-1.5 max-w-[280px]">
          <Select value={mes || undefined} onValueChange={setMes}>
            <SelectTrigger className="h-10 w-full bg-wash-surface">
              <SelectValue placeholder="Seleccionar mes" />
            </SelectTrigger>
            <SelectContent>
              {meses.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Alta de líneas técnico + ruta */}
      <div className="mt-5 rounded-xl border border-wash-border bg-wash-surface-2/40 p-4">
        <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
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

      {/* Lista de líneas */}
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
            <EmptyState
              pulse
              icon={ClipboardEdit}
              title="Aún no agregaste rutas"
              description={
                <>
                  Completá los campos de arriba y tocá el botón <strong>+</strong> para sumar una
                  ruta a la planificación.
                </>
              }
            />
          ) : (
            <ul className="divide-y divide-wash-divider/60">
              {lines.map((l, i) => (
                <li key={i} className="group flex items-center gap-3 px-4 py-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wash-brand/10 text-wash-brand ring-1 ring-wash-brand/20">
                    <MapPin size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-[13px] font-bold text-wash-accent">
                      Ruta {l.nroRuta}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-wash-text-muted">
                      <span className="font-semibold text-wash-text">{l.tecnico}</span>
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

      {error && (
        <p className="mt-3 rounded-r-md border-l-4 border-red-500 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700">
          {error}
        </p>
      )}

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
          disabled={!canCreate || saving}
          onClick={handleCreate}
          className="rounded-lg bg-wash-action px-5 py-2.5 font-semibold text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Creando…' : 'Crear planificación'}
        </button>
      </ModalActions>
    </Modal>
  );
}
