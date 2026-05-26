import { useEffect, useMemo, useState } from 'react';
import {
  Eye,
  Pencil,
  Trash2,
  Map,
  Building2,
  MapPin,
  Plus,
  X,
  ClipboardEdit,
  CheckCircle2,
  Hash,
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
import type { RutaCatalogo } from '@/types/domain';

export function ConfigRutas() {
  const rutas = useAppStore((s) => s.CollectRutasDisponibles);
  const circuitos = useAppStore((s) => s.CollectResumenCircuito);
  const detalles = useAppStore((s) => s.CollectDetalleCircuito);
  const edificios = useAppStore((s) => s.CollectEdificios);

  const [query, setQuery] = useState('');
  const [viewing, setViewing] = useState<RutaCatalogo | null>(null);
  const [editing, setEditing] = useState<RutaCatalogo | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<RutaCatalogo | null>(null);

  const rows = useMemo(() => {
    const q = query.toLowerCase();
    return rutas
      .filter((r) => r.Status_RT === 'Activo')
      .filter((r) => r.NroRuta_RT.toLowerCase().includes(q))
      .sort((a, b) => Number(a.NroRuta_RT) - Number(b.NroRuta_RT));
  }, [rutas, query]);

  const countsFor = (r: RutaCatalogo) => {
    const circs = circuitos.filter((c) => c.NroRuta_RC === r.NroRuta_RT);
    const edifs = circs.flatMap((c) =>
      detalles.filter((d) => d.NroCircuito_DC === c.NroCircuito_RC)
    );
    return { circuitos: circs.length, edificios: edifs.length };
  };

  const codeFor = (name: string) =>
    edificios.find((e) => e.Edificio === name)?.Codigo;

  const columns: Column<RutaCatalogo>[] = [
    {
      key: 'ruta',
      header: 'Ruta',
      width: 'minmax(220px, 1fr)',
      truncate: false,
      render: (r) => (
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-wash-brand/10 text-wash-brand ring-1 ring-wash-brand/20">
            <Map size={15} />
          </span>
          <div className="min-w-0">
            <p className="font-display text-[14px] font-black text-wash-accent">
              Ruta {r.NroRuta_RT}
            </p>
            <p className="text-[11px] text-wash-text-muted">Catálogo de rutas</p>
          </div>
        </div>
      ),
    },
    {
      key: 'circuitos',
      header: 'Cantidad de circuitos',
      width: '220px',
      align: 'center',
      truncate: false,
      render: (r) => {
        const { circuitos: c } = countsFor(r);
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-wash-surface-2 px-2.5 py-1 text-[12.5px] font-bold text-wash-text-strong tabular-nums">
            <Map size={11} className="text-wash-brand" />
            {c}
          </span>
        );
      },
    },
    {
      key: 'edificios',
      header: 'Edificios totales',
      width: '200px',
      align: 'center',
      truncate: false,
      render: (r) => {
        const { edificios: e } = countsFor(r);
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-wash-surface-2 px-2.5 py-1 text-[12.5px] font-bold text-wash-text-strong tabular-nums">
            <Building2 size={11} className="text-wash-brand" />
            {e}
          </span>
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
            icon={Eye}
            tone="brand"
            title="Ver detalle"
            onClick={(e) => {
              e.stopPropagation();
              setViewing(r);
            }}
          />
          <ActionBtn
            icon={Pencil}
            tone="neutral"
            title="Editar"
            onClick={(e) => {
              e.stopPropagation();
              setEditing(r);
            }}
          />
          <ActionBtn
            icon={Trash2}
            tone="danger"
            title="Eliminar"
            onClick={(e) => {
              e.stopPropagation();
              setDeleting(r);
            }}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="flex h-full w-full flex-col">
      <PageHeader
        title="Rutas"
        subtitle={`${rows.length} rutas registradas`}
        search={{ value: query, onChange: setQuery, placeholder: 'Buscar ruta…' }}
        onRefresh={() => {}}
        onAdd={() => setAdding(true)}
        addLabel="Agregar Ruta"
      />
      <div className="flex-1 overflow-hidden p-6">
        <DataTable
          rows={rows}
          rowKey={(r) => r.ID}
          columns={columns}
          empty="Sin rutas registradas."
          onRowClick={(r) => setViewing(r)}
        />
      </div>

      {/* Detalle */}
      <DetalleRutaModal
        ruta={viewing}
        circuitos={circuitos}
        detalles={detalles}
        codeFor={codeFor}
        onClose={() => setViewing(null)}
      />

      {/* Agregar */}
      <RutaFormModal
        open={adding}
        mode="create"
        circuitos={circuitos}
        detalles={detalles}
        onClose={() => setAdding(false)}
        onSave={() => setAdding(false)}
      />

      {/* Editar */}
      <RutaFormModal
        open={!!editing}
        mode="edit"
        defaultNroRuta={editing?.NroRuta_RT}
        circuitos={circuitos}
        detalles={detalles}
        onClose={() => setEditing(null)}
        onSave={() => setEditing(null)}
      />

      {/* Eliminar */}
      <EliminarRutaModal
        ruta={deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => setDeleting(null)}
      />
    </div>
  );
}

// ----- Detalle de Ruta modal -----

function DetalleRutaModal({
  ruta,
  circuitos,
  detalles,
  codeFor,
  onClose,
}: {
  ruta: RutaCatalogo | null;
  circuitos: ReturnType<typeof useAppStore.getState>['CollectResumenCircuito'];
  detalles: ReturnType<typeof useAppStore.getState>['CollectDetalleCircuito'];
  codeFor: (name: string) => string | undefined;
  onClose: () => void;
}) {
  if (!ruta) return null;

  const circuitosRuta = circuitos.filter((c) => c.NroRuta_RC === ruta.NroRuta_RT);
  const totalEdificios = circuitosRuta.reduce(
    (acc, c) => acc + detalles.filter((d) => d.NroCircuito_DC === c.NroCircuito_RC).length,
    0
  );

  return (
    <Modal
      open={!!ruta}
      onClose={onClose}
      title={`Detalle de Ruta ${ruta.NroRuta_RT}`}
      width={1180}
    >
      {/* Header card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-wash-brand/[0.08] via-wash-surface to-wash-surface-2/30 p-5 ring-1 ring-wash-border">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-wash-brand/10 blur-3xl"
        />

        <div className="relative flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-wash-brand to-wash-brand-dark text-white shadow-md shadow-wash-brand/25 ring-2 ring-wash-surface">
            <Map size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1 rounded-md bg-wash-brand/10 px-2 py-0.5 text-[11.5px] font-bold text-wash-brand tabular-nums ring-1 ring-wash-brand/20">
              <Hash size={10} />
              Ruta {ruta.NroRuta_RT}
            </span>
            <h3 className="mt-1.5 font-display text-[17px] font-black leading-tight text-wash-accent">
              Catálogo de circuitos y edificios
            </h3>
            <p className="mt-1 text-[11.5px] text-wash-text-muted">
              Asignaciones permanentes que componen esta ruta.
            </p>
          </div>
        </div>

        <div className="relative mt-4 grid grid-cols-2 divide-x divide-wash-border rounded-xl bg-wash-surface/80 ring-1 ring-wash-border">
          <StatStrip
            icon={Map}
            label="Circuitos"
            value={String(circuitosRuta.length)}
            tone="brand"
          />
          <StatStrip
            icon={Building2}
            label="Edificios"
            value={String(totalEdificios)}
            tone="brand"
          />
        </div>
      </div>

      {/* Circuitos section header */}
      <div className="mt-5 flex items-end justify-between">
        <div>
          <p className="font-display text-[13px] font-black uppercase tracking-wider text-wash-text-strong">
            Circuitos asignados
          </p>
          <p className="mt-0.5 text-[11px] text-wash-text-muted">
            Edificios por circuito
          </p>
        </div>
      </div>

      {/* Circuitos grid */}
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {circuitosRuta.length === 0 ? (
          <div className="col-span-full rounded-xl border border-dashed border-wash-border bg-wash-surface-2/30 p-8 text-center text-sm text-wash-text-muted">
            Esta ruta no tiene circuitos asignados.
          </div>
        ) : (
          circuitosRuta.map((c) => {
            const edifs = detalles.filter(
              (d) => d.NroCircuito_DC === c.NroCircuito_RC
            );
            return (
              <div
                key={c.ID}
                className="overflow-hidden rounded-xl bg-wash-surface ring-1 ring-wash-border transition hover:shadow-sm hover:ring-wash-brand/40"
              >
                <div className="border-b border-wash-border bg-wash-surface-2/40 px-3.5 py-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-wash-brand/10 text-wash-brand ring-1 ring-wash-brand/20">
                        <MapPin size={12} />
                      </span>
                      <p className="font-display text-[13px] font-black leading-none text-wash-accent">
                        Circuito {c.NroCircuito_RC}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-md bg-wash-surface px-1.5 py-1 text-[10.5px] font-bold text-wash-text-strong tabular-nums ring-1 ring-wash-border">
                      <Building2 size={10} />
                      {edifs.length}
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
                      const code = codeFor(e.NombreEdificio_DC);
                      return (
                        <li
                          key={e.ID}
                          className="group flex items-center gap-2 border-l-2 border-transparent px-3 py-1.5 text-[12px] transition hover:border-wash-brand/40 hover:bg-wash-surface-2/40"
                        >
                          {code && (
                            <span className="shrink-0 rounded bg-wash-surface-2 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-wash-text-muted tabular-nums">
                              {code}
                            </span>
                          )}
                          <span className="truncate font-medium text-wash-text-strong">
                            {e.NombreEdificio_DC}
                          </span>
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            );
          })
        )}
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

// ----- Agregar / Editar Ruta modal -----

interface FormCircuito {
  nroCircuito: string;
  edificios: number;
}

function RutaFormModal({
  open,
  mode,
  defaultNroRuta,
  circuitos,
  detalles,
  onClose,
  onSave,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  defaultNroRuta?: string;
  circuitos: ReturnType<typeof useAppStore.getState>['CollectResumenCircuito'];
  detalles: ReturnType<typeof useAppStore.getState>['CollectDetalleCircuito'];
  onClose: () => void;
  onSave: () => void;
}) {
  const [nroRuta, setNroRuta] = useState(defaultNroRuta ?? '');
  const [pickedCircuito, setPickedCircuito] = useState('');
  const [items, setItems] = useState<FormCircuito[]>([]);

  useEffect(() => {
    if (!open) return;
    setNroRuta(defaultNroRuta ?? '');
    setPickedCircuito('');
    if (mode === 'edit' && defaultNroRuta) {
      const existing = circuitos
        .filter((c) => c.NroRuta_RC === defaultNroRuta)
        .map((c) => ({
          nroCircuito: c.NroCircuito_RC,
          edificios: detalles.filter((d) => d.NroCircuito_DC === c.NroCircuito_RC).length,
        }));
      setItems(existing);
    } else {
      setItems([]);
    }
  }, [open, defaultNroRuta, mode, circuitos, detalles]);

  const availableCircuitos = useMemo(() => {
    const used = new Set(items.map((i) => i.nroCircuito));
    return Array.from(new Set(circuitos.map((c) => c.NroCircuito_RC))).filter(
      (c) => !used.has(c)
    );
  }, [circuitos, items]);

  const canAdd = !!nroRuta && !!pickedCircuito;

  const addItem = () => {
    if (!canAdd) return;
    const edif = detalles.filter((d) => d.NroCircuito_DC === pickedCircuito).length;
    setItems((arr) => [...arr, { nroCircuito: pickedCircuito, edificios: edif }]);
    setPickedCircuito('');
  };

  const removeItem = (idx: number) => {
    setItems((arr) => arr.filter((_, i) => i !== idx));
  };

  const totalCircuitos = items.length;
  const totalEdificios = items.reduce((acc, i) => acc + i.edificios, 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'Agregar Ruta' : `Editar Ruta ${defaultNroRuta ?? ''}`}
      width={760}
    >
      {/* Intro */}
      <div className="flex items-start gap-3 rounded-xl bg-wash-brand/[0.06] p-3.5 ring-1 ring-wash-brand/15">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wash-brand/15 text-wash-brand ring-1 ring-wash-brand/25">
          <Map size={14} />
        </span>
        <div>
          <p className="font-display text-[13px] font-bold text-wash-accent">
            {mode === 'create' ? 'Nueva ruta' : 'Editar ruta'}
          </p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-wash-text-muted">
            Definí el número de ruta y los circuitos que la componen.
          </p>
        </div>
      </div>

      {/* Form section */}
      <div className="mt-4 rounded-xl border border-wash-border bg-wash-surface-2/40 p-4">
        <div className="grid grid-cols-[180px_1fr_auto] items-end gap-3">
          <div>
            <Label>Nro de Ruta</Label>
            <div className="mt-1.5">
              <input
                type="number"
                min="1"
                value={nroRuta}
                onChange={(e) => setNroRuta(e.target.value)}
                disabled={mode === 'edit'}
                placeholder="1"
                className="h-10 w-full rounded-md border border-wash-border bg-wash-surface px-3 text-[13px] font-semibold text-wash-text-strong outline-none ring-0 focus:border-wash-brand disabled:cursor-not-allowed disabled:bg-wash-surface-2/60 disabled:text-wash-text-muted"
              />
            </div>
          </div>
          <div>
            <Label>Circuito</Label>
            <div className="mt-1.5">
              <Select
                value={pickedCircuito || undefined}
                onValueChange={setPickedCircuito}
              >
                <SelectTrigger className="h-10 w-full bg-wash-surface">
                  <SelectValue placeholder="Buscar elementos" />
                </SelectTrigger>
                <SelectContent>
                  {availableCircuitos.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs italic text-wash-text-muted">
                      Sin circuitos disponibles
                    </div>
                  ) : (
                    availableCircuitos.map((c) => (
                      <SelectItem key={c} value={c}>
                        Circuito {c}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <button
            type="button"
            onClick={addItem}
            disabled={!canAdd}
            title="Agregar circuito"
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
            Circuitos agregados
          </p>
          {items.length > 0 && (
            <span className="rounded-full bg-wash-brand/10 px-2 py-0.5 text-[10.5px] font-bold text-wash-brand">
              {items.length} circuito{items.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <div
          className={cn(
            'rounded-xl border transition-colors',
            items.length === 0
              ? 'min-h-[200px] border-dashed border-wash-border bg-wash-surface-2/30'
              : 'border-wash-border bg-wash-surface'
          )}
        >
          {items.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="divide-y divide-wash-divider/60">
              {items.map((it, i) => (
                <li
                  key={i}
                  className="group flex items-center gap-3 px-3.5 py-2.5 transition hover:bg-wash-surface-2/40"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-wash-surface-2 text-[10.5px] font-bold text-wash-text-muted tabular-nums ring-1 ring-wash-border">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-wash-brand/10 px-2 py-1 font-display text-[12px] font-black uppercase text-wash-brand tabular-nums ring-1 ring-wash-brand/20">
                    <MapPin size={11} />
                    Circuito {it.nroCircuito}
                  </span>
                  <div className="flex-1" />
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-wash-surface-2 px-2 py-1 text-[11.5px] font-bold text-wash-text-strong tabular-nums ring-1 ring-wash-border">
                    <Building2 size={11} className="text-wash-text-muted" />
                    {it.edificios}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
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

      {/* Totals */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <TotalCard
          icon={Map}
          label="Circuitos totales"
          value={totalCircuitos}
        />
        <TotalCard
          icon={Building2}
          label="Edificios totales"
          value={totalEdificios}
        />
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
          disabled={!nroRuta || items.length === 0}
          onClick={onSave}
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
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center px-6 text-center">
      <div className="relative mb-3">
        <span className="absolute inset-0 animate-ping rounded-2xl bg-wash-brand/15" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-wash-brand/10 text-wash-brand ring-1 ring-wash-brand/25">
          <ClipboardEdit size={24} strokeWidth={1.6} />
        </div>
      </div>
      <p className="font-display text-[14px] font-bold text-wash-text-strong">
        Sin circuitos agregados
      </p>
      <p className="mt-1 max-w-[280px] text-[11.5px] leading-relaxed text-wash-text-muted">
        Elegí un circuito del catálogo y tocá <strong>+ Agregar</strong> para
        sumarlo a la ruta.
      </p>
    </div>
  );
}

function TotalCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Map;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-wash-surface-2/60 px-3.5 py-2.5 ring-1 ring-wash-border">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-wash-brand/10 text-wash-brand ring-1 ring-wash-brand/20">
        <Icon size={14} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-wash-text-muted">
          {label}
        </p>
        <p className="font-display text-[18px] font-black leading-none text-wash-text-strong tabular-nums">
          {value}
        </p>
      </div>
    </div>
  );
}

// ----- Eliminar -----

function EliminarRutaModal({
  ruta,
  onClose,
  onConfirm,
}: {
  ruta: RutaCatalogo | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal open={!!ruta} onClose={onClose} width={520}>
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-200">
          <Trash2 size={20} />
        </span>
        <div className="flex-1">
          <h2 className="font-display text-lg font-black text-wash-text-strong">
            Eliminar ruta
          </h2>
          <p className="mt-1 text-sm text-wash-text-muted">
            ¿Eliminar la <span className="font-semibold">Ruta {ruta?.NroRuta_RT}</span>{' '}
            del catálogo? Esta acción no se puede deshacer.
          </p>
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
          onClick={onConfirm}
          className="flex items-center gap-2 rounded-lg bg-rose-600 px-5 py-2.5 font-semibold text-white hover:bg-rose-700"
        >
          <CheckCircle2 size={15} />
          Eliminar
        </button>
      </ModalActions>
    </Modal>
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

function StatStrip({
  icon: Icon,
  label,
  value,
  tone = 'brand',
}: {
  icon: typeof Map;
  label: string;
  value: string;
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
        </p>
      </div>
    </div>
  );
}
