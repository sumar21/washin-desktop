import { useMemo, useState } from 'react';
import {
  FileText,
  AlertOctagon,
  Download,
  Filter,
  Building2,
  Clock,
  User2,
  Calendar,
  ClipboardCheck,
  ClipboardX,
  StickyNote,
  Image as ImageIcon,
  ListChecks,
  Eye,
  CheckCircle2,
  XCircle,
  ChevronDown,
} from 'lucide-react';
import { DataTable, type Column } from '@/components/DataTable';
import { Modal, ModalActions } from '@/components/Modal';
import { StatusBadge } from '@/components/StatusBadge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import type { Registro, Incidente } from '@/types/domain';

type ReportMode = 'general' | 'incidentes';

interface ConfigReportesProps {
  query: string;
}

// Deterministic mock checklist per visit.
const CHECKLIST_LABELS = [
  'Instrucciones Lavarropas',
  'Instrucciones Secarropas',
  'Cartel De Recomendaciones',
  'Cartel De Servicio Tecnico',
  'Cartel De Precio Actualizado',
  'Mantenimiento Lavadoras',
  'Mantenimiento Secadoras',
  'Cartel Telefónos De Emergencia',
];

function checklistFor(seedKey: string) {
  let h = 0;
  for (let i = 0; i < seedKey.length; i++) h = (h * 31 + seedKey.charCodeAt(i)) >>> 0;
  return CHECKLIST_LABELS.map((label, idx) => {
    const mod = (h + idx * 17) % 5;
    return {
      label,
      ok: mod < 2, // ~40% OK
      hasObservation: mod === 0 || mod === 3,
    };
  });
}

function observationFor(seedKey: string) {
  let h = 0;
  for (let i = 0; i < seedKey.length; i++) h = (h * 31 + seedKey.charCodeAt(i)) >>> 0;
  const obs = [
    'Faltan etiquetas de precio actualizado en la lavandería del piso 3.',
    'Se requiere reemplazo de cartel de servicio técnico (deteriorado).',
    'Cliente solicita revisar funcionamiento de secadora #2.',
    null,
  ];
  return obs[h % obs.length];
}

export function ConfigReportes({ query }: ConfigReportesProps) {
  const registros = useAppStore((s) => s.CollectResumen);
  const incidentes = useAppStore((s) => s.CollectIncidentes);

  const [mode, setMode] = useState<ReportMode>('general');
  const [estadoFilter, setEstadoFilter] = useState<string>('todos');
  const [pendingEstado, setPendingEstado] = useState<string>('todos');
  const [viewingChecklist, setViewingChecklist] = useState<Registro | null>(null);
  const [viewingObs, setViewingObs] = useState<Registro | null>(null);
  const [viewingIncidente, setViewingIncidente] = useState<Incidente | null>(null);

  const initials = (name: string) =>
    name
      .split(/[\s,]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();

  // Estado se deriva del progreso: 0 = Pendiente (sin empezar),
  // cualquier valor > 0 = Finalizado (aunque tenga ítems sin check).
  const estadoFor = (r: Registro): 'Pendiente' | 'Finalizado' =>
    (r.Progreso ?? 0) > 0 ? 'Finalizado' : 'Pendiente';

  // --- General report rows ---
  const filteredRegistros = useMemo(() => {
    const q = query.toLowerCase().trim();
    return registros.filter((r) => {
      if (estadoFilter !== 'todos' && estadoFor(r) !== estadoFilter) return false;
      if (!q) return true;
      return (
        r.Edificio.toLowerCase().includes(q) ||
        r.Usuario.toLowerCase().includes(q) ||
        r.NroRuta_R.toLowerCase().includes(q) ||
        r.NroCircuito_R.toLowerCase().includes(q)
      );
    });
  }, [registros, query, estadoFilter]);

  // --- Incidents report rows ---
  const filteredIncidentes = useMemo(() => {
    const q = query.toLowerCase().trim();
    return incidentes.filter((i) => {
      if (
        estadoFilter !== 'todos' &&
        estadoFilter !== 'Finalizado' &&
        estadoFilter !== 'Pendiente' &&
        i.Status_IN !== estadoFilter
      )
        return false;
      if (!q) return true;
      return (
        i.NombreEdificio_IN.toLowerCase().includes(q) ||
        i.Titulo_IN.toLowerCase().includes(q) ||
        (i.TecnicoAsignado_IN ?? '').toLowerCase().includes(q)
      );
    });
  }, [incidentes, query, estadoFilter]);

  const handleDownload = () => {
    const which = mode === 'general' ? 'Reporte general' : 'Reporte de incidentes';
    const count =
      mode === 'general' ? filteredRegistros.length : filteredIncidentes.length;
    alert(`Descargando ${which} (${count} registros)…`);
  };

  // --- COLUMNS: General report ---
  const generalColumns: Column<Registro>[] = [
    {
      key: 'edificio',
      header: 'Edificio',
      width: 'minmax(220px, 1.4fr)',
      truncate: false,
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wash-brand/10 text-wash-brand ring-1 ring-wash-brand/20">
            <Building2 size={13} />
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-[13px] font-bold text-wash-accent">
              {r.Edificio}
            </p>
            <p className="text-[10.5px] text-wash-text-muted">
              Ruta {r.NroRuta_R} · Circuito {r.NroCircuito_R}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'tecnico',
      header: 'Técnico',
      width: '200px',
      truncate: false,
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[9.5px] font-semibold text-slate-600">
            {initials(r.Usuario)}
          </span>
          <span className="truncate text-[12.5px] font-semibold text-wash-text-strong">
            {r.Usuario}
          </span>
        </div>
      ),
    },
    {
      key: 'fecha',
      header: 'Fecha',
      width: '120px',
      truncate: false,
      render: (r) => (
        <span className="inline-flex items-center gap-1.5 font-mono text-[11.5px] text-wash-text-muted tabular-nums">
          <Calendar size={11} />
          {r.MesAño}
        </span>
      ),
    },
    {
      key: 'horario',
      header: 'Horario',
      width: '170px',
      truncate: false,
      render: (r) => (
        <span className="inline-flex items-center gap-1.5 text-[12px] text-wash-text">
          <Clock size={11} className="text-wash-text-muted" />
          <span className="font-mono tabular-nums">
            {r.HoraInicio ?? '—'}
          </span>
          <span className="text-wash-text-faint">→</span>
          <span className="font-mono tabular-nums">
            {r.HoraFinal ?? '—'}
          </span>
        </span>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      width: '130px',
      truncate: false,
      render: (r) => <StatusBadge status={estadoFor(r)} />,
    },
    {
      key: 'progreso',
      header: 'Progreso',
      width: '160px',
      truncate: false,
      render: (r) => {
        const pct = r.Progreso ?? 0;
        return (
          <div className="flex w-full items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-wash-surface-2">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  pct === 100
                    ? 'bg-emerald-500'
                    : 'bg-gradient-to-r from-wash-brand-light to-wash-brand'
                )}
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
      render: (r) => (
        <div className="flex items-center justify-end gap-1.5">
          <ActionBtn
            icon={ListChecks}
            tone="brand"
            title="Ver checklist"
            onClick={(e) => {
              e.stopPropagation();
              setViewingChecklist(r);
            }}
          />
          <ActionBtn
            icon={StickyNote}
            tone="neutral"
            title="Ver observación"
            onClick={(e) => {
              e.stopPropagation();
              setViewingObs(r);
            }}
          />
        </div>
      ),
    },
  ];

  // --- COLUMNS: Incidentes report ---
  const incidentesColumns: Column<Incidente>[] = [
    {
      key: 'edificio',
      header: 'Edificio',
      width: 'minmax(200px, 1.2fr)',
      truncate: false,
      render: (i) => (
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600 ring-1 ring-rose-200">
            <AlertOctagon size={13} />
          </span>
          <span className="truncate font-display text-[13px] font-bold text-wash-accent">
            {i.NombreEdificio_IN}
          </span>
        </div>
      ),
    },
    {
      key: 'titulo',
      header: 'Item / Título',
      width: 'minmax(220px, 1.5fr)',
      truncate: false,
      render: (i) => (
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-wash-text-strong">
            {i.Titulo_IN}
          </p>
          {i.ConcatMaquina_IN && (
            <p className="truncate text-[10.5px] text-wash-text-muted">
              {i.ConcatMaquina_IN}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'tecnico',
      header: 'Técnico',
      width: '180px',
      truncate: false,
      render: (i) => {
        const tec = i.TecnicoAsignado_IN ?? '—';
        return (
          <div className="flex items-center gap-2">
            {tec !== '—' ? (
              <>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[9.5px] font-semibold text-slate-600">
                  {initials(tec)}
                </span>
                <span className="truncate text-[12.5px] font-semibold text-wash-text-strong">
                  {tec}
                </span>
              </>
            ) : (
              <span className="text-[12px] italic text-wash-text-faint">
                Sin asignar
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'fecha',
      header: 'Fecha',
      width: '120px',
      truncate: false,
      render: (i) => (
        <span className="inline-flex items-center gap-1.5 font-mono text-[11.5px] text-wash-text-muted tabular-nums">
          <Calendar size={11} />
          {i.Fecha_IN}
        </span>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      width: '150px',
      truncate: false,
      render: (i) => <StatusBadge status={i.Status_IN} />,
    },
    {
      key: 'actions',
      header: 'Acciones',
      width: '110px',
      align: 'right',
      truncate: false,
      render: (i) => (
        <div className="flex items-center justify-end gap-1.5">
          <ActionBtn
            icon={Eye}
            tone="brand"
            title="Ver detalle"
            onClick={(e) => {
              e.stopPropagation();
              setViewingIncidente(i);
            }}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="flex h-full w-full flex-col">
      {/* Sub-toolbar */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-wash-divider/40 bg-wash-surface px-6 py-3">
        {/* Segmented control */}
        <div className="inline-flex rounded-lg bg-wash-canvas p-1 ring-1 ring-wash-border">
          <SegmentButton
            icon={FileText}
            label="Reporte general"
            active={mode === 'general'}
            onClick={() => setMode('general')}
          />
          <SegmentButton
            icon={AlertOctagon}
            label="Reporte de Incidentes"
            active={mode === 'incidentes'}
            onClick={() => setMode('incidentes')}
          />
        </div>

        {/* Right side: Filter + Download */}
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                onClick={() => setPendingEstado(estadoFilter)}
                className="flex items-center gap-1.5 rounded-lg bg-wash-canvas px-3.5 py-2 text-sm font-medium text-wash-text-strong ring-1 ring-wash-border hover:bg-wash-border/40"
              >
                <Filter size={14} />
                Filtrar
                <ChevronDown size={12} className="text-wash-text-muted" />
                {estadoFilter !== 'todos' && (
                  <span className="ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-wash-brand px-1 text-[10px] font-bold text-white">
                    1
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              sideOffset={8}
              className="w-[280px] rounded-xl border border-wash-border bg-wash-surface p-4 shadow-lg ring-1 ring-black/[0.03]"
            >
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-wash-text-muted">
                Filtrar por estado
              </p>
              <div className="mt-3 space-y-1.5">
                <FilterOption
                  active={pendingEstado === 'todos'}
                  onClick={() => setPendingEstado('todos')}
                  label="Todos los estados"
                />
                {mode === 'general' ? (
                  <>
                    <FilterOption
                      active={pendingEstado === 'Finalizado'}
                      onClick={() => setPendingEstado('Finalizado')}
                      label="Finalizado"
                    />
                    <FilterOption
                      active={pendingEstado === 'Pendiente'}
                      onClick={() => setPendingEstado('Pendiente')}
                      label="Pendiente"
                    />
                  </>
                ) : (
                  <>
                    {(['A Revisar', 'Asignado', 'Pendiente', 'En Aprobacion', 'Resuelto', 'Anulado'] as const).map(
                      (s) => (
                        <FilterOption
                          key={s}
                          active={pendingEstado === s}
                          onClick={() => setPendingEstado(s)}
                          label={s}
                        />
                      )
                    )}
                  </>
                )}
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPendingEstado('todos');
                    setEstadoFilter('todos');
                  }}
                  className="rounded-md px-3 py-1.5 text-[12px] font-medium text-wash-text-muted hover:bg-wash-surface-2"
                >
                  Limpiar
                </button>
                <button
                  type="button"
                  onClick={() => setEstadoFilter(pendingEstado)}
                  className="rounded-md bg-wash-action px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-wash-action-dark"
                >
                  Aplicar
                </button>
              </div>
            </PopoverContent>
          </Popover>

          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1.5 rounded-lg bg-wash-action px-3.5 py-2 text-sm font-semibold text-white shadow-sm shadow-wash-action/30 hover:bg-wash-action-dark"
            title={`Descargar ${mode === 'general' ? 'Reporte general' : 'Reporte de incidentes'}`}
          >
            <Download size={14} />
            Descargar
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden p-6">
        {mode === 'general' ? (
          <DataTable
            rows={filteredRegistros}
            rowKey={(r) => r.ID}
            columns={generalColumns}
            empty="Sin reportes generales registrados."
            onRowClick={(r) => setViewingChecklist(r)}
          />
        ) : (
          <DataTable
            rows={filteredIncidentes}
            rowKey={(i) => i.ID}
            columns={incidentesColumns}
            empty="Sin incidentes registrados."
            onRowClick={(i) => setViewingIncidente(i)}
          />
        )}
      </div>

      {/* Modals */}
      <ChecklistModal
        registro={viewingChecklist}
        onClose={() => setViewingChecklist(null)}
      />
      <ObservacionModal
        registro={viewingObs}
        onClose={() => setViewingObs(null)}
      />
      <IncidenteDetailModal
        incidente={viewingIncidente}
        onClose={() => setViewingIncidente(null)}
      />
    </div>
  );
}

// ----- Checklist modal -----

function ChecklistModal({
  registro,
  onClose,
}: {
  registro: Registro | null;
  onClose: () => void;
}) {
  if (!registro) return null;
  const items = checklistFor(
    `${registro.ID}-${registro.Edificio}-${registro.Usuario}`
  );
  const ok = items.filter((i) => i.ok).length;

  return (
    <Modal
      open={!!registro}
      onClose={onClose}
      title="Detalle de checklist"
      width={760}
    >
      {/* Summary header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-wash-brand/[0.08] via-wash-surface to-wash-surface-2/30 p-5 ring-1 ring-wash-border">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-wash-brand/10 blur-3xl"
        />
        <div className="relative flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-wash-brand to-wash-brand-dark text-white shadow-md shadow-wash-brand/25 ring-2 ring-wash-surface">
            <ListChecks size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[15px] font-black text-wash-accent">
              {registro.Edificio}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-wash-text-muted">
              <User2 size={11} />
              {registro.Usuario}
              <span className="text-wash-text-faint">·</span>
              <Calendar size={11} />
              {registro.MesAño}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-wash-text-muted">
              Completado
            </p>
            <p className="font-display text-[18px] font-black tabular-nums text-wash-text-strong">
              <span className="text-emerald-600">{ok}</span>
              <span className="text-wash-text-faint">/{items.length}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Items */}
      <ul className="mt-5 space-y-2">
        {items.map((it, idx) => (
          <li
            key={idx}
            className="flex items-center gap-3 rounded-xl bg-wash-surface px-4 py-3 ring-1 ring-wash-border"
          >
            {it.ok ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[10.5px] font-bold text-emerald-700 ring-1 ring-emerald-500/30">
                <CheckCircle2 size={12} />
                OK
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-1 text-[10.5px] font-bold text-rose-700 ring-1 ring-rose-500/30">
                <XCircle size={12} />
                CHECK
              </span>
            )}
            <span
              className={cn(
                'flex-1 text-[13px] font-semibold',
                it.ok ? 'text-wash-text-strong' : 'text-wash-text'
              )}
            >
              {it.label}
            </span>
            {it.hasObservation && (
              <span
                className="inline-flex items-center gap-1 rounded-md bg-wash-brand/10 px-2 py-1 text-[10.5px] font-semibold text-wash-brand ring-1 ring-wash-brand/20"
                title="Tiene observación adjunta"
              >
                <StickyNote size={11} />
                Observación
              </span>
            )}
          </li>
        ))}
      </ul>

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

// ----- Observación modal -----

function ObservacionModal({
  registro,
  onClose,
}: {
  registro: Registro | null;
  onClose: () => void;
}) {
  if (!registro) return null;
  const obs = observationFor(
    `${registro.ID}-${registro.Edificio}-${registro.Usuario}`
  );

  return (
    <Modal
      open={!!registro}
      onClose={onClose}
      title="Detalle de observación"
      width={620}
    >
      {/* Hero */}
      <div className="flex items-start gap-3 rounded-xl bg-wash-brand/[0.06] p-3.5 ring-1 ring-wash-brand/15">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wash-brand/15 text-wash-brand ring-1 ring-wash-brand/25">
          <StickyNote size={14} />
        </span>
        <div>
          <p className="font-display text-[13px] font-bold text-wash-accent">
            {registro.Edificio}
          </p>
          <p className="mt-0.5 text-[11.5px] text-wash-text-muted">
            Observación de la visita del {registro.MesAño}
          </p>
        </div>
      </div>

      {/* Text */}
      <div className="mt-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">
          Observación general
        </p>
        <div
          className={cn(
            'mt-1.5 min-h-[96px] rounded-md border bg-wash-surface-2/40 px-3 py-2.5 text-[13px] leading-relaxed',
            obs
              ? 'border-wash-border text-wash-text-strong'
              : 'border-wash-border italic text-wash-text-muted'
          )}
        >
          {obs ?? 'Sin observación cargada para esta visita.'}
        </div>
      </div>

      {/* Photo */}
      <div className="mt-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">
          Foto de la observación
        </p>
        <div className="mt-1.5 flex items-center gap-3 rounded-xl bg-wash-brand/[0.06] p-3 ring-1 ring-wash-brand/20">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-wash-brand/15 text-wash-brand ring-1 ring-wash-brand/25">
            <ImageIcon size={18} />
          </span>
          <div className="flex-1">
            <p className="text-[12.5px] font-semibold text-wash-accent">
              Foto adjunta
            </p>
            <p className="text-[11px] text-wash-text-muted">
              {obs ? 'Tap para ver en tamaño completo' : 'Sin foto adjunta'}
            </p>
          </div>
          <button
            type="button"
            disabled={!obs}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-wash-brand text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-wash-surface-2 disabled:text-wash-text-faint disabled:shadow-none"
            title="Ver foto"
          >
            <Eye size={15} />
          </button>
        </div>
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

// ----- Incidente detail modal -----

function IncidenteDetailModal({
  incidente,
  onClose,
}: {
  incidente: Incidente | null;
  onClose: () => void;
}) {
  if (!incidente) return null;

  return (
    <Modal
      open={!!incidente}
      onClose={onClose}
      title="Detalle del incidente"
      width={760}
    >
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-500/[0.08] via-wash-surface to-wash-surface-2/30 p-5 ring-1 ring-wash-border">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-rose-500/10 blur-3xl"
        />
        <div className="relative flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-md shadow-rose-500/25 ring-2 ring-wash-surface">
            <AlertOctagon size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-rose-500/10 px-2 py-0.5 font-mono text-[11.5px] font-bold text-rose-700 tabular-nums ring-1 ring-rose-500/20">
                {incidente.IDIncidente}
              </span>
              <StatusBadge status={incidente.Status_IN} />
            </div>
            <h3 className="mt-1.5 font-display text-[16px] font-black leading-tight text-wash-accent">
              {incidente.Titulo_IN}
            </h3>
            <p className="mt-1 flex items-center gap-1.5 text-[12px] text-wash-text-muted">
              <Building2 size={12} />
              {incidente.NombreEdificio_IN}
              <span className="text-wash-text-faint">·</span>
              <Calendar size={12} />
              {incidente.Fecha_IN}
            </p>
          </div>
        </div>
      </div>

      {/* Info grid */}
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
        <DetailField
          icon={User2}
          label="Técnico"
          value={incidente.TecnicoAsignado_IN ?? 'Sin asignar'}
          muted={!incidente.TecnicoAsignado_IN}
        />
        <DetailField
          icon={ClipboardCheck}
          label="Resuelto"
          value={incidente.Resuelto_IN}
        />
        <DetailField
          icon={ClipboardX}
          label="Tipo"
          value={incidente.NoResuelto_IN}
        />
      </div>

      {incidente.ConcatMaquina_IN && (
        <div className="mt-3 rounded-xl bg-wash-surface-2/40 p-4 ring-1 ring-wash-border">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-wash-text-muted">
            Máquina
          </p>
          <p className="mt-1 font-display text-[13px] font-bold text-wash-accent">
            {incidente.ConcatMaquina_IN}
          </p>
        </div>
      )}

      {(incidente.DescripcionIncidente_IN ?? incidente.DescripcionCarga_IN) && (
        <div className="mt-3 rounded-xl bg-wash-surface-2/40 p-4 ring-1 ring-wash-border">
          <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-wash-text-muted">
            <StickyNote size={11} />
            Descripción
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-wash-text-strong">
            {incidente.DescripcionIncidente_IN ?? incidente.DescripcionCarga_IN}
          </p>
        </div>
      )}

      {incidente.DescripcionResuelto_IN && (
        <div className="mt-3 rounded-xl bg-emerald-500/[0.06] p-4 ring-1 ring-emerald-500/20">
          <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-emerald-700">
            <CheckCircle2 size={11} />
            Resolución
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-wash-text-strong">
            {incidente.DescripcionResuelto_IN}
          </p>
        </div>
      )}

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

// ----- Shared bits -----

function SegmentButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof FileText;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-[12.5px] font-semibold transition',
        active
          ? 'bg-wash-action text-white shadow-sm shadow-wash-action/30'
          : 'text-wash-text-muted hover:text-wash-text-strong'
      )}
    >
      <Icon size={13} />
      {label}
    </button>
  );
}

function FilterOption({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[12.5px] font-medium transition',
        active
          ? 'bg-wash-brand/10 text-wash-brand'
          : 'text-wash-text-strong hover:bg-wash-surface-2'
      )}
    >
      <span>{label}</span>
      {active && <CheckCircle2 size={13} className="text-wash-brand" />}
    </button>
  );
}

function DetailField({
  icon: Icon,
  label,
  value,
  muted,
}: {
  icon: typeof FileText;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="rounded-xl bg-wash-surface-2/40 p-3 ring-1 ring-wash-border">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-wash-text-muted">
        <Icon size={11} />
        {label}
      </p>
      <p
        className={cn(
          'mt-1 truncate text-[13px] font-semibold',
          muted ? 'text-wash-text-faint italic' : 'text-wash-text-strong'
        )}
        title={value}
      >
        {value}
      </p>
    </div>
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
