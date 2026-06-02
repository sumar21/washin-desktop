import { useEffect, useMemo, useState } from 'react';
import {
  Eye,
  ArrowLeftRight,
  WashingMachine,
  Wind,
  Cog,
  Building2,
  Zap,
  ArrowRight,
} from 'lucide-react';
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
import { cn, proper } from '@/lib/utils';
import type { DetalleMaquina as Maquina, TipoStock } from '@/types/domain';

const tipoMeta: Record<TipoStock, { icon: typeof WashingMachine; tone: string }> = {
  LAVADORA: { icon: WashingMachine, tone: 'bg-amber-100 text-amber-800 ring-amber-300/70' },
  'SECADORA SIMPLE': {
    icon: Wind,
    tone: 'bg-emerald-100 text-emerald-800 ring-emerald-300/70',
  },
  'SECADORA DOBLE': {
    icon: Wind,
    tone: 'bg-fuchsia-100 text-fuchsia-800 ring-fuchsia-300/70',
  },
  CARGADORA: { icon: Cog, tone: 'bg-violet-100 text-violet-800 ring-violet-300/70' },
  EXPENDEDORA: {
    icon: Cog,
    tone: 'bg-orange-100 text-orange-800 ring-orange-300/70',
  },
  ENCENDEDORA: {
    icon: Cog,
    tone: 'bg-sky-100 text-sky-800 ring-sky-300/70',
  },
  REPUESTO: {
    icon: Cog,
    tone: 'bg-wash-brand/10 text-wash-brand ring-wash-brand/25',
  },
};

// Friendlier segment labels (PowerApp-style: Lavarropas / Secarropas / Encendedoras)
const segmentoLabel: Record<TipoStock, string> = {
  LAVADORA: 'LAVARROPAS',
  'SECADORA SIMPLE': 'SECARROPAS SIMPLE',
  'SECADORA DOBLE': 'SECARROPAS DOBLE',
  CARGADORA: 'CARGADORA',
  EXPENDEDORA: 'EXPENDEDORA',
  ENCENDEDORA: 'ENCENDEDORAS',
  REPUESTO: 'REPUESTO',
};

export function DetalleMaquina() {
  const maquinas = useAppStore((s) => s.CollectDetalleMaquina);
  const edificios = useAppStore((s) => s.CollectEdificios);
  const incidentes = useAppStore((s) => s.CollectIncidentes);
  const patchMaquina = useAppStore((s) => s.patchMaquina);
  const VarTipoUser = useAppStore((s) => s.VarTipoUser);

  // Filters
  const [edificio, setEdificio] = useState<string | null>(null);
  const [modelo, setModelo] = useState<string>('');
  const [marca, setMarca] = useState<string>('');
  const [query, setQuery] = useState('');

  // UI state
  const [setupOpen, setSetupOpen] = useState(true); // mandatory on entry
  const [filterOpen, setFilterOpen] = useState(false);
  const [viewing, setViewing] = useState<Maquina | null>(null);
  const [transferring, setTransferring] = useState<Maquina | null>(null);
  const [destEdificio, setDestEdificio] = useState('');
  const [motivo, setMotivo] = useState('');
  const [motivoDetalle, setMotivoDetalle] = useState('');

  // Pending selections for the setup/filter modal (so user can cancel)
  const [pendingEdificio, setPendingEdificio] = useState<string>('');
  const [pendingMarca, setPendingMarca] = useState<string>('');
  const [pendingModelo, setPendingModelo] = useState<string>('');

  const canManage = VarTipoUser === 'Admin' || VarTipoUser === 'Jefe Taller';

  // Auto-open the selector modal if no building is set yet
  useEffect(() => {
    if (!edificio) {
      setPendingEdificio('');
      setPendingMarca('');
      setPendingModelo('');
      setSetupOpen(true);
    }
  }, [edificio]);

  const inBuilding = useMemo(
    () =>
      edificio
        ? maquinas.filter(
            (m) => m.Status_DM !== 'ELIMINADA' && m.Edificio_DM === edificio
          )
        : [],
    [maquinas, edificio]
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return inBuilding
      .filter((m) => (marca ? m.Marca_DM === marca : true))
      .filter((m) => (modelo ? m.Modelo_DM === modelo : true))
      .filter(
        (m) =>
          m.Marca_DM.toLowerCase().includes(q) ||
          m.Modelo_DM.toLowerCase().includes(q) ||
          m.NroSerie_DM.toLowerCase().includes(q) ||
          m.IDMaquina_DM.toLowerCase().includes(q)
      );
  }, [inBuilding, query, marca, modelo]);

  // Available marcas/modelos for filtering, based on currently selected building (or all if none)
  const buildingScope = useMemo(
    () =>
      pendingEdificio
        ? maquinas.filter(
            (m) => m.Status_DM !== 'ELIMINADA' && m.Edificio_DM === pendingEdificio
          )
        : maquinas.filter((m) => m.Status_DM !== 'ELIMINADA'),
    [maquinas, pendingEdificio]
  );

  const availableMarcas = useMemo(
    () => Array.from(new Set(buildingScope.map((m) => m.Marca_DM))).sort(),
    [buildingScope]
  );

  const availableModelos = useMemo(
    () =>
      Array.from(
        new Set(
          buildingScope
            .filter((m) => (pendingMarca ? m.Marca_DM === pendingMarca : true))
            .map((m) => m.Modelo_DM)
        )
      ).sort(),
    [buildingScope, pendingMarca]
  );

  const historialDe = (m: Maquina) =>
    incidentes.filter((i) => i.ConcatMaquina_IN === m.ConcatMaquinaIncidente_DM);

  const applySelection = () => {
    if (!pendingEdificio) return;
    setEdificio(pendingEdificio);
    setMarca(pendingMarca);
    setModelo(pendingModelo);
    setSetupOpen(false);
    setFilterOpen(false);
  };

  const openSelector = (mode: 'setup' | 'filter') => {
    setPendingEdificio(edificio ?? '');
    setPendingMarca(marca);
    setPendingModelo(modelo);
    if (mode === 'setup') setSetupOpen(true);
    else setFilterOpen(true);
  };

  // ---- table columns ----
  const columns: Column<Maquina>[] = [
    {
      key: 'segmento',
      header: 'Segmento',
      width: '200px',
      truncate: false,
      render: (m) => {
        const meta = tipoMeta[m.Segmento_DM];
        return (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide ring-1',
              meta.tone
            )}
          >
            <meta.icon size={11} />
            {segmentoLabel[m.Segmento_DM]}
          </span>
        );
      },
    },
    {
      key: 'fecha',
      header: 'Fecha Ingreso',
      width: '140px',
      render: (m) => (
        <span className="text-wash-text">
          {m.FechaIngreso_DM ?? <span className="text-wash-text-faint">No especificada</span>}
        </span>
      ),
    },
    {
      key: 'marca',
      header: 'Marca',
      width: '130px',
      render: (m) => (
        <span className="font-semibold text-wash-text-strong">{m.Marca_DM}</span>
      ),
    },
    {
      key: 'modelo',
      header: 'Modelo',
      width: 'minmax(170px, 1fr)',
      render: (m) => <span className="text-wash-text">{m.Modelo_DM}</span>,
    },
    {
      key: 'serie',
      header: 'N° Serie',
      width: '170px',
      render: (m) => (
        <span className="rounded-md bg-wash-surface-2 px-2 py-0.5 text-[12px] font-semibold text-wash-text">
          {m.NroSerie_DM}
        </span>
      ),
    },
    {
      key: 'id',
      header: 'ID',
      width: '120px',
      render: (m) => (
        <span className="text-[12px] font-bold text-wash-text-strong">
          {m.IDMaquina_DM}
        </span>
      ),
    },
    {
      key: 'encendido',
      header: 'Encendido',
      width: '140px',
      render: (m) =>
        m.Encendido_DM ? (
          <span className="inline-flex items-center gap-1 text-[12px] text-wash-text">
            <Zap size={11} className="text-amber-500" />
            {m.Encendido_DM}
          </span>
        ) : (
          <span className="text-wash-text-faint">—</span>
        ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      width: '120px',
      align: 'right',
      truncate: false,
      render: (m) => (
        <div className="flex items-center justify-end gap-1.5">
          <ActionButton
            icon={Eye}
            tone="neutral"
            title="Ver detalle / historial"
            onClick={(e) => {
              e.stopPropagation();
              setViewing(m);
            }}
          />
          {canManage && (
            <ActionButton
              icon={ArrowLeftRight}
              tone="brand"
              title="Transferir"
              onClick={(e) => {
                e.stopPropagation();
                setTransferring(m);
                setDestEdificio('');
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
        title={
          edificio ? `Detalle de Máquinas — ${edificio}` : 'Detalle de Máquinas'
        }
        subtitle={
          edificio
            ? `${inBuilding.length} máquinas instaladas`
            : 'Seleccioná un edificio para ver el listado'
        }
        search={{
          value: query,
          onChange: setQuery,
          placeholder: 'Marca, modelo, serie…',
        }}
        onFilter={edificio ? () => openSelector('filter') : undefined}
        rightExtra={
          <button
            type="button"
            onClick={() => openSelector('setup')}
            className="flex items-center gap-1.5 rounded-lg bg-wash-canvas px-3.5 py-2 text-sm font-medium text-wash-text-strong ring-1 ring-wash-border hover:bg-wash-border/40"
            title={edificio ? 'Cambiar edificio' : 'Seleccionar edificio'}
          >
            <Building2 size={14} />
            Edificio
          </button>
        }
      />
      <div className="flex-1 overflow-hidden p-6">
        <DataTable
          rows={filtered}
          rowKey={(r) => r.ID}
          columns={columns}
          empty={
            edificio
              ? 'Sin máquinas instaladas en este edificio.'
              : 'Seleccioná un edificio para ver las máquinas.'
          }
        />
      </div>

      {/* Setup / Filter modal (same UI) */}
      <SelectorModal
        open={setupOpen || filterOpen}
        mode={setupOpen ? 'setup' : 'filter'}
        edificios={edificios.map((e) => e.Edificio)}
        marcas={availableMarcas}
        modelos={availableModelos}
        valueEdificio={pendingEdificio}
        valueMarca={pendingMarca}
        valueModelo={pendingModelo}
        onEdificioChange={(v) => {
          setPendingEdificio(v);
          // reset dependent filters
          setPendingMarca('');
          setPendingModelo('');
        }}
        onMarcaChange={(v) => {
          setPendingMarca(v);
          setPendingModelo('');
        }}
        onModeloChange={setPendingModelo}
        onApply={applySelection}
        onClose={() => {
          setSetupOpen(false);
          setFilterOpen(false);
        }}
        onClear={() => {
          setPendingMarca('');
          setPendingModelo('');
        }}
      />

      {/* Detail / Historial */}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing ? `Detalle — ${viewing.ConcatMaquina_DM}` : ''}
        width={640}
      >
        {viewing && (
          <>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <Info label="Estado" value={<StatusBadge status={viewing.Status_DM} />} />
              <Info label="Edificio" value={viewing.Edificio_DM} />
              <Info
                label="Fecha ingreso"
                value={viewing.FechaIngreso_DM ?? 'No especificada'}
              />
            </div>

            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-wash-text-muted">
                Historial de incidentes
              </p>
              <div className="mt-2">
                {historialDe(viewing).length === 0 ? (
                  <div className="rounded-xl border border-dashed border-wash-border px-3 py-8 text-center">
                    <p className="text-sm font-semibold text-wash-text-strong">
                      Sin historial
                    </p>
                    <p className="mt-1 text-xs text-wash-text-muted">
                      No hay incidentes registrados para esta máquina.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {historialDe(viewing).map((i) => (
                      <li
                        key={i.ID}
                        className="rounded-xl bg-wash-canvas px-4 py-3 ring-1 ring-wash-border"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-wash-text-muted">
                            {i.Fecha_IN}
                          </span>
                          <StatusBadge status={i.Status_IN} />
                        </div>
                        <div className="mt-1 font-display font-bold text-wash-accent">
                          {proper(i.Titulo_IN)}
                        </div>
                        {i.DescripcionIncidente_IN && (
                          <p className="mt-1 text-sm text-wash-text">
                            {i.DescripcionIncidente_IN}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </Modal>

      {/* Transferencia */}
      <Modal
        open={!!transferring}
        onClose={() => {
          setTransferring(null);
          setDestEdificio('');
          setMotivo('');
          setMotivoDetalle('');
        }}
        title="Transferir máquina"
        width={620}
      >
        {transferring && (
          <>
            {/* Machine info card */}
            <div className="rounded-xl border border-wash-border bg-wash-surface-2/40 p-4">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ring-1',
                    tipoMeta[transferring.Segmento_DM].tone
                  )}
                >
                  {(() => {
                    const Icon = tipoMeta[transferring.Segmento_DM].icon;
                    return <Icon size={20} />;
                  })()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base font-black text-wash-accent">
                    {transferring.Marca_DM} {transferring.Modelo_DM}
                  </p>
                  <p className="mt-0.5 text-xs text-wash-text-muted">
                    ID: <span className="font-semibold text-wash-text">{transferring.IDMaquina_DM}</span>
                    {' · '}
                    Serie: <span className="font-semibold text-wash-text">{transferring.NroSerie_DM}</span>
                  </p>
                </div>
                <StatusBadge status={transferring.Status_DM} />
              </div>
            </div>

            {/* From → To visualization */}
            <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div className="rounded-xl bg-wash-surface-2/60 p-3 ring-1 ring-wash-border">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-wash-text-muted">
                  Desde
                </p>
                <div className="mt-1 flex items-center gap-1.5">
                  <Building2 size={14} className="shrink-0 text-wash-text-muted" />
                  <span className="truncate text-sm font-semibold text-wash-text-strong">
                    {transferring.Edificio_DM}
                  </span>
                </div>
              </div>

              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-wash-brand/15 text-wash-brand">
                <ArrowRight size={16} />
              </div>

              <div
                className={cn(
                  'rounded-xl p-3 ring-1 transition',
                  destEdificio
                    ? 'bg-wash-brand/5 ring-wash-brand/40'
                    : 'bg-wash-surface-2/60 ring-wash-border'
                )}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-wash-text-muted">
                  Hacia
                </p>
                <div className="mt-1 flex items-center gap-1.5">
                  <Building2
                    size={14}
                    className={cn(
                      'shrink-0',
                      destEdificio ? 'text-wash-brand' : 'text-wash-text-faint'
                    )}
                  />
                  <span
                    className={cn(
                      'truncate text-sm font-semibold',
                      destEdificio ? 'text-wash-brand-dark' : 'text-wash-text-faint'
                    )}
                  >
                    {destEdificio || 'Sin elegir'}
                  </span>
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-wash-text-muted">
                  Edificio destino
                </label>
                <div className="mt-1.5">
                  <Select value={destEdificio} onValueChange={setDestEdificio}>
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue placeholder="Seleccionar destino…" />
                    </SelectTrigger>
                    <SelectContent>
                      {edificios
                        .filter((e) => e.Edificio !== transferring.Edificio_DM)
                        .map((e) => (
                          <SelectItem key={e.ID} value={e.Edificio}>
                            {e.Edificio}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-wash-text-muted">
                  Motivo
                </label>
                <div className="mt-1.5">
                  <Select value={motivo} onValueChange={setMotivo}>
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue placeholder="Seleccionar motivo…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cambio por incidente">Cambio por incidente</SelectItem>
                      <SelectItem value="Rotación preventiva">Rotación preventiva</SelectItem>
                      <SelectItem value="Mudanza">Mudanza</SelectItem>
                      <SelectItem value="Retiro para mantenimiento">
                        Retiro para mantenimiento
                      </SelectItem>
                      <SelectItem value="Recambio de tecnología">
                        Recambio de tecnología
                      </SelectItem>
                      <SelectItem value="Otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {motivo === 'Otro' && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-wash-text-muted">
                    Detalle del motivo
                  </label>
                  <textarea
                    rows={2}
                    value={motivoDetalle}
                    onChange={(e) => setMotivoDetalle(e.target.value)}
                    placeholder="Especificá el motivo de la transferencia…"
                    className="mt-1.5 w-full rounded-lg border border-wash-border bg-wash-surface px-3 py-2 text-sm outline-none focus:border-wash-brand focus:ring-2 focus:ring-wash-brand/15"
                  />
                </div>
              )}

              {destEdificio === 'Wash Inn (Depósito)' && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
                  <span className="mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  <span>
                    Al transferir a <strong>Wash Inn (Depósito)</strong> la máquina
                    queda con estado <strong>DEPOSITO</strong>.
                  </span>
                </div>
              )}
            </div>

            <ModalActions>
              <button
                type="button"
                onClick={() => {
                  setTransferring(null);
                  setDestEdificio('');
                  setMotivo('');
                  setMotivoDetalle('');
                }}
                className="rounded-lg border border-wash-border px-4 py-2 font-medium text-wash-text-strong hover:bg-wash-surface-2"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!destEdificio || !motivo || (motivo === 'Otro' && !motivoDetalle.trim())}
                onClick={() => {
                  const motivoFinal =
                    motivo === 'Otro' ? motivoDetalle.trim() : motivo;
                  if (destEdificio === 'Wash Inn (Depósito)')
                    patchMaquina(transferring.ID, {
                      Edificio_DM: destEdificio,
                      Status_DM: 'DEPOSITO',
                      Motivo_DM: motivoFinal,
                    });
                  else
                    patchMaquina(transferring.ID, {
                      Edificio_DM: destEdificio,
                      Status_DM: 'INSTALADA',
                      Motivo_DM: motivoFinal,
                    });
                  setTransferring(null);
                  setDestEdificio('');
                  setMotivo('');
                  setMotivoDetalle('');
                }}
                className="rounded-lg bg-wash-action px-5 py-2 font-medium text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                Transferir
              </button>
            </ModalActions>
          </>
        )}
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

interface SelectorModalProps {
  open: boolean;
  mode: 'setup' | 'filter';
  edificios: string[];
  marcas: string[];
  modelos: string[];
  valueEdificio: string;
  valueMarca: string;
  valueModelo: string;
  onEdificioChange: (v: string) => void;
  onMarcaChange: (v: string) => void;
  onModeloChange: (v: string) => void;
  onApply: () => void;
  onClose: () => void;
  onClear: () => void;
}

function SelectorModal({
  open,
  mode,
  edificios,
  marcas,
  modelos,
  valueEdificio,
  valueMarca,
  valueModelo,
  onEdificioChange,
  onMarcaChange,
  onModeloChange,
  onApply,
  onClose,
  onClear,
}: SelectorModalProps) {
  const isSetup = mode === 'setup';
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isSetup ? 'Seleccionar edificio' : 'Filtrar máquinas'}
      width={560}
    >
      <p className="text-sm text-wash-text-muted">
        {isSetup
          ? 'Elegí un edificio para ver el listado de máquinas. Opcional: filtrá por marca o modelo.'
          : 'Refiná el listado de máquinas por edificio, marca o modelo.'}
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <Label>Edificio</Label>
          <div className="mt-1.5">
            <Select
              value={valueEdificio || undefined}
              onValueChange={onEdificioChange}
            >
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder="Seleccionar edificio…" />
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
            <Label>Marca</Label>
            <div className="mt-1.5">
              <Select
                value={valueMarca || undefined}
                onValueChange={onMarcaChange}
                disabled={!valueEdificio}
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue
                    placeholder={valueEdificio ? 'Todas las marcas' : 'Elegí edificio'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {marcas.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Modelo</Label>
            <div className="mt-1.5">
              <Select
                value={valueModelo || undefined}
                onValueChange={onModeloChange}
                disabled={!valueEdificio}
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue
                    placeholder={valueEdificio ? 'Todos los modelos' : 'Elegí edificio'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {modelos.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <ModalActions>
        {!isSetup && (valueMarca || valueModelo) && (
          <button
            type="button"
            onClick={onClear}
            className="mr-auto rounded-lg border border-wash-border px-4 py-2 text-sm font-medium text-wash-text-strong hover:bg-wash-surface-2"
          >
            Limpiar marca/modelo
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-wash-border px-4 py-2 font-medium text-wash-text-strong hover:bg-wash-surface-2"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!valueEdificio}
          onClick={onApply}
          className="rounded-lg bg-wash-action px-5 py-2 font-medium text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          Aplicar
        </button>
      </ModalActions>
    </Modal>
  );
}

function Label({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-wash-text-muted">
      {children}
      {required && <span className="text-rose-500">*</span>}
    </label>
  );
}
