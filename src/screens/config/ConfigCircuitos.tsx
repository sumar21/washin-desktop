import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Eye,
  Trash2,
  GitBranch,
  Building2,
  MapPin,
  MessageSquare,
  Plus,
  X,
  ClipboardEdit,
  Hash,
  Phone,
  Mail,
  Clock,
  User2,
  Compass,
  StickyNote,
  CheckCircle2,
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
import type { ResumenCircuito, DetalleCircuito, Edificio } from '@/types/domain';
import { buildingExtras } from './_helpers';

interface ConfigCircuitosProps {
  query: string;
  addOpen: boolean;
  setAddOpen: (v: boolean) => void;
  onFullscreenChange: (v: boolean) => void;
}

export function ConfigCircuitos({
  query,
  addOpen,
  setAddOpen,
  onFullscreenChange,
}: ConfigCircuitosProps) {
  const circuitos = useAppStore((s) => s.CollectResumenCircuito);
  const detalles = useAppStore((s) => s.CollectDetalleCircuito);
  const edificios = useAppStore((s) => s.CollectEdificios);

  const [viewing, setViewing] = useState<ResumenCircuito | null>(null);
  const [observing, setObserving] = useState<ResumenCircuito | null>(null);
  const [deleting, setDeleting] = useState<ResumenCircuito | null>(null);

  // Notify shell when entering / leaving the drill-down detail view.
  useEffect(() => {
    onFullscreenChange(!!viewing);
    return () => onFullscreenChange(false);
  }, [viewing, onFullscreenChange]);

  const codeFor = (name: string) =>
    edificios.find((e) => e.Edificio === name)?.Codigo;

  // Filter active circuits, deduplicate by NroCircuito (catalog may repeat)
  const allCircuits = useMemo(() => {
    const seen = new Set<string>();
    const out: ResumenCircuito[] = [];
    for (const c of circuitos) {
      if (c.Status_RC !== 'Activo') continue;
      if (seen.has(c.NroCircuito_RC)) continue;
      seen.add(c.NroCircuito_RC);
      out.push(c);
    }
    return out;
  }, [circuitos]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return allCircuits
      .filter((c) => {
        if (!q) return true;
        const edifs = detalles.filter((d) => d.NroCircuito_DC === c.NroCircuito_RC);
        return (
          c.NroCircuito_RC.toLowerCase().includes(q) ||
          edifs.some((e) => e.NombreEdificio_DC.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => a.NroCircuito_RC.localeCompare(b.NroCircuito_RC, 'es', { numeric: true }));
  }, [allCircuits, detalles, query]);

  // ----- Pre-compute building lists per circuit (for cards) -----
  // (Hooks MUST run on every render, before any conditional early return.)
  const edifsByCircuito = useMemo(() => {
    const map = new Map<string, DetalleCircuito[]>();
    for (const d of detalles) {
      if (d.Status_DC !== 'Activo') continue;
      if (!map.has(d.NroCircuito_DC)) map.set(d.NroCircuito_DC, []);
      map.get(d.NroCircuito_DC)!.push(d);
    }
    return map;
  }, [detalles]);

  const totalEdificios = useMemo(
    () =>
      filtered.reduce(
        (acc, c) => acc + (edifsByCircuito.get(c.NroCircuito_RC)?.length ?? 0),
        0
      ),
    [filtered, edifsByCircuito]
  );

  // ----- DETAIL VIEW -----
  if (viewing) {
    return (
      <CircuitoDetailView
        circuito={viewing}
        detalles={detalles}
        edificios={edificios}
        onBack={() => setViewing(null)}
      />
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.04)_1px,transparent_0)] bg-[size:22px_22px]">
      <div className="flex-1 overflow-y-auto p-6">
        {/* Section header with summary */}
        <div className="flex items-end justify-between">
          <div>
            <p className="font-display text-[13px] font-black uppercase tracking-wider text-wash-text-strong">
              Catálogo de circuitos
            </p>
            <p className="mt-0.5 text-[11.5px] text-wash-text-muted">
              {filtered.length === 0
                ? 'Sin circuitos registrados'
                : `${filtered.length} circuito${filtered.length === 1 ? '' : 's'} · ${totalEdificios} edificios`}
            </p>
          </div>
        </div>

        {/* Card grid */}
        {filtered.length === 0 ? (
          <EmptyCircuitos />
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {filtered.map((c) => {
              const edifs = edifsByCircuito.get(c.NroCircuito_RC) ?? [];
              return (
                <CircuitoCard
                  key={c.ID}
                  nroCircuito={c.NroCircuito_RC}
                  nroRuta={c.NroRuta_RC}
                  edificios={edifs}
                  codeFor={codeFor}
                  onView={() => setViewing(c)}
                  onObserve={() => setObserving(c)}
                  onDelete={() => setDeleting(c)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Crear circuito */}
      <CrearCircuitoModal
        open={addOpen}
        edificios={edificios}
        onClose={() => setAddOpen(false)}
        onSave={() => setAddOpen(false)}
      />

      {/* Observación */}
      <ObservacionModal
        circuito={observing}
        onClose={() => setObserving(null)}
        onSave={() => setObserving(null)}
      />

      {/* Eliminar */}
      <EliminarCircuitoModal
        circuito={deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => setDeleting(null)}
      />
    </div>
  );
}

// ----- DETAIL VIEW (sub-screen replaces list when a circuit is open) -----

function CircuitoDetailView({
  circuito,
  detalles,
  edificios,
  onBack,
}: {
  circuito: ResumenCircuito;
  detalles: DetalleCircuito[];
  edificios: Edificio[];
  onBack: () => void;
}) {
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [viewingEdif, setViewingEdif] = useState<DetalleCircuito | null>(null);
  const [deletingEdif, setDeletingEdif] = useState<DetalleCircuito | null>(null);

  const codeFor = (name: string) =>
    edificios.find((e) => e.Edificio === name)?.Codigo;

  const edifsCircuito = useMemo(
    () => detalles.filter((d) => d.NroCircuito_DC === circuito.NroCircuito_RC),
    [detalles, circuito.NroCircuito_RC]
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return edifsCircuito.filter((e) => {
      if (!q) return true;
      const code = codeFor(e.NombreEdificio_DC) ?? '';
      return (
        e.NombreEdificio_DC.toLowerCase().includes(q) ||
        (e.Direccion_DC ?? '').toLowerCase().includes(q) ||
        code.toLowerCase().includes(q)
      );
    });
  }, [edifsCircuito, query]);

  const columns: Column<DetalleCircuito>[] = [
    {
      key: 'codigo',
      header: 'Código',
      width: '110px',
      truncate: false,
      render: (e) => {
        const code = codeFor(e.NombreEdificio_DC);
        return code ? (
          <span className="inline-flex rounded-md bg-wash-brand/10 px-2 py-0.5 font-mono text-[11px] font-bold text-wash-brand ring-1 ring-wash-brand/20">
            {code}
          </span>
        ) : (
          <span className="text-wash-text-faint">—</span>
        );
      },
    },
    {
      key: 'edificio',
      header: 'Edificio',
      width: 'minmax(180px, 1fr)',
      truncate: false,
      render: (e) => (
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-wash-surface-2 text-wash-text-muted ring-1 ring-wash-border">
            <Building2 size={12} />
          </span>
          <span className="truncate font-display text-[13px] font-bold text-wash-accent">
            {e.NombreEdificio_DC}
          </span>
        </div>
      ),
    },
    {
      key: 'direccion',
      header: 'Dirección',
      width: 'minmax(160px, 1fr)',
      truncate: false,
      render: (e) => (
        <span className="flex items-center gap-1.5 truncate text-[12.5px] text-wash-text">
          <MapPin size={11} className="shrink-0 text-wash-text-muted" />
          <span className="truncate">{e.Direccion_DC ?? '—'}</span>
        </span>
      ),
    },
    {
      key: 'horario',
      header: 'Horario',
      width: '180px',
      truncate: false,
      render: (e) => {
        const x = buildingExtras(e.NombreEdificio_DC);
        return x.horario ? (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-wash-text">
            <Clock size={11} className="text-wash-text-muted" />
            {x.horario}
          </span>
        ) : (
          <span className="text-[12px] text-wash-text-faint">—</span>
        );
      },
    },
    {
      key: 'contacto',
      header: 'Contacto',
      width: '220px',
      truncate: false,
      render: (e) => {
        const x = buildingExtras(e.NombreEdificio_DC);
        return (
          <span className="flex items-center gap-1.5 truncate text-[12px] text-wash-text">
            <User2 size={11} className="shrink-0 text-wash-text-muted" />
            <span className="truncate font-semibold text-wash-text-strong">
              {x.encargado}
            </span>
            <span className="text-wash-text-muted">·</span>
            <span className="font-mono tabular-nums text-wash-text-muted">
              {x.telefono}
            </span>
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Acciones',
      width: '110px',
      align: 'right',
      truncate: false,
      render: (e) => (
        <div className="flex items-center justify-end gap-1.5">
          <ActionBtn
            icon={Eye}
            tone="brand"
            title="Ver detalle"
            onClick={(ev) => {
              ev.stopPropagation();
              setViewingEdif(e);
            }}
          />
          <ActionBtn
            icon={Trash2}
            tone="danger"
            title="Quitar"
            onClick={(ev) => {
              ev.stopPropagation();
              setDeletingEdif(e);
            }}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="flex h-full w-full flex-col">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-wash-surface-2 text-wash-text-strong hover:bg-wash-border/60"
              title="Volver"
            >
              <ArrowLeft size={16} />
            </button>
            <span>Detalle del circuito {circuito.NroCircuito_RC}</span>
          </span>
        }
        subtitle={`${edifsCircuito.length} edificios · Ruta ${circuito.NroRuta_RC}`}
        search={{
          value: query,
          onChange: setQuery,
          placeholder: 'Buscar edificio, código o dirección…',
        }}
        onAdd={() => setAdding(true)}
        addLabel="Agregar Edificio"
      />

      <div className="flex-1 overflow-hidden p-6">
        <DataTable
          rows={filtered}
          rowKey={(e) => e.ID}
          columns={columns}
          empty="Sin edificios en este circuito."
          onRowClick={(e) => setViewingEdif(e)}
        />
      </div>

      <AgregarEdificioModal
        open={adding}
        circuito={circuito}
        edificios={edificios}
        onClose={() => setAdding(false)}
        onSave={() => setAdding(false)}
      />

      <EdificioDetailModal
        edificio={viewingEdif}
        codeFor={codeFor}
        onClose={() => setViewingEdif(null)}
      />

      <EliminarEdificioModal
        edificio={deletingEdif}
        onClose={() => setDeletingEdif(null)}
        onConfirm={() => setDeletingEdif(null)}
      />
    </div>
  );
}

// ----- Crear Circuito modal -----

interface PickedEdif {
  nombre: string;
  codigo?: string;
  direccion?: string;
}

function CrearCircuitoModal({
  open,
  edificios,
  onClose,
  onSave,
}: {
  open: boolean;
  edificios: Edificio[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [nroCircuito, setNroCircuito] = useState('');
  const [picked, setPicked] = useState('');
  const [items, setItems] = useState<PickedEdif[]>([]);

  useEffect(() => {
    if (!open) return;
    setNroCircuito('');
    setPicked('');
    setItems([]);
  }, [open]);

  const available = useMemo(() => {
    const used = new Set(items.map((i) => i.nombre));
    return edificios
      .filter((e) => e.Status === 'ALTA')
      .filter((e) => !used.has(e.Edificio))
      .sort((a, b) => a.Edificio.localeCompare(b.Edificio));
  }, [edificios, items]);

  const canAdd = !!nroCircuito && !!picked;

  const addItem = () => {
    if (!canAdd) return;
    const ed = edificios.find((e) => e.Edificio === picked);
    if (!ed) return;
    setItems((arr) => [
      ...arr,
      { nombre: ed.Edificio, codigo: ed.Codigo, direccion: ed.Direccion },
    ]);
    setPicked('');
  };

  const removeItem = (idx: number) =>
    setItems((arr) => arr.filter((_, i) => i !== idx));

  return (
    <Modal open={open} onClose={onClose} title="Crear Circuito" width={760}>
      {/* Intro */}
      <div className="flex items-start gap-3 rounded-xl bg-wash-brand/[0.06] p-3.5 ring-1 ring-wash-brand/15">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wash-brand/15 text-wash-brand ring-1 ring-wash-brand/25">
          <GitBranch size={14} />
        </span>
        <div>
          <p className="font-display text-[13px] font-bold text-wash-accent">
            Nuevo circuito
          </p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-wash-text-muted">
            Definí el número del circuito y los edificios que lo componen.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="mt-4 rounded-xl border border-wash-border bg-wash-surface-2/40 p-4">
        <div className="grid grid-cols-[180px_1fr_auto] items-end gap-3">
          <div>
            <Label>Nro del Circuito</Label>
            <input
              value={nroCircuito}
              onChange={(e) => setNroCircuito(e.target.value)}
              placeholder="Ej: 14"
              className="mt-1.5 h-10 w-full rounded-md border border-wash-border bg-wash-surface px-3 text-[13px] font-semibold text-wash-text-strong outline-none focus:border-wash-brand"
            />
          </div>
          <div>
            <Label>Edificio</Label>
            <div className="mt-1.5">
              <Select value={picked || undefined} onValueChange={setPicked}>
                <SelectTrigger className="h-10 w-full bg-wash-surface">
                  <SelectValue placeholder="Buscar elementos" />
                </SelectTrigger>
                <SelectContent>
                  {available.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs italic text-wash-text-muted">
                      Sin edificios disponibles
                    </div>
                  ) : (
                    available.map((e) => (
                      <SelectItem key={e.ID} value={e.Edificio}>
                        {e.Codigo ? `${e.Codigo} · ` : ''}
                        {e.Edificio}
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
            className="flex h-10 items-center gap-1.5 rounded-lg bg-wash-action px-3.5 text-[12.5px] font-semibold text-white shadow-sm shadow-wash-action/30 transition hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:bg-wash-surface-2 disabled:text-wash-text-faint disabled:shadow-none"
            title="Agregar edificio"
          >
            <Plus size={15} />
            Agregar
          </button>
        </div>
      </div>

      {/* List */}
      <PickedEdificiosList items={items} onRemove={removeItem} />

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
          disabled={!nroCircuito || items.length === 0}
          onClick={onSave}
          className="rounded-lg bg-wash-action px-5 py-2.5 font-semibold text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          Guardar
        </button>
      </ModalActions>
    </Modal>
  );
}

// ----- Agregar Edificio al circuito modal -----

function AgregarEdificioModal({
  open,
  circuito,
  edificios,
  onClose,
  onSave,
}: {
  open: boolean;
  circuito: ResumenCircuito;
  edificios: Edificio[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [picked, setPicked] = useState('');
  const [items, setItems] = useState<PickedEdif[]>([]);
  const [obs, setObs] = useState('');

  useEffect(() => {
    if (!open) return;
    setPicked('');
    setItems([]);
    setObs('');
  }, [open]);

  const available = useMemo(() => {
    const used = new Set(items.map((i) => i.nombre));
    return edificios
      .filter((e) => e.Status === 'ALTA')
      .filter((e) => !used.has(e.Edificio))
      .sort((a, b) => a.Edificio.localeCompare(b.Edificio));
  }, [edificios, items]);

  const canAdd = !!picked;

  const addItem = () => {
    if (!canAdd) return;
    const ed = edificios.find((e) => e.Edificio === picked);
    if (!ed) return;
    setItems((arr) => [
      ...arr,
      { nombre: ed.Edificio, codigo: ed.Codigo, direccion: ed.Direccion },
    ]);
    setPicked('');
  };

  const removeItem = (idx: number) =>
    setItems((arr) => arr.filter((_, i) => i !== idx));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Agregar edificio al circuito"
      width={760}
    >
      {/* Intro */}
      <div className="flex items-start gap-3 rounded-xl bg-wash-brand/[0.06] p-3.5 ring-1 ring-wash-brand/15">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wash-brand/15 text-wash-brand ring-1 ring-wash-brand/25">
          <Building2 size={14} />
        </span>
        <div>
          <p className="font-display text-[13px] font-bold text-wash-accent">
            Circuito {circuito.NroCircuito_RC}
          </p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-wash-text-muted">
            Elegí los edificios y sumá una observación si hace falta.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="mt-4 rounded-xl border border-wash-border bg-wash-surface-2/40 p-4">
        <div className="grid grid-cols-[180px_1fr_auto] items-end gap-3">
          <div>
            <Label>Nro del Circuito</Label>
            <div className="mt-1.5 flex h-10 items-center gap-1.5 rounded-md border border-wash-border bg-wash-surface-2/80 px-3 font-mono text-[13px] font-semibold text-wash-text-strong tabular-nums">
              <Hash size={12} className="text-wash-text-muted" />
              {circuito.NroCircuito_RC}
            </div>
          </div>
          <div>
            <Label>Edificio</Label>
            <div className="mt-1.5">
              <Select value={picked || undefined} onValueChange={setPicked}>
                <SelectTrigger className="h-10 w-full bg-wash-surface">
                  <SelectValue placeholder="Buscar elementos" />
                </SelectTrigger>
                <SelectContent>
                  {available.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs italic text-wash-text-muted">
                      Sin edificios disponibles
                    </div>
                  ) : (
                    available.map((e) => (
                      <SelectItem key={e.ID} value={e.Edificio}>
                        {e.Codigo ? `${e.Codigo} · ` : ''}
                        {e.Edificio}
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
            className="flex h-10 items-center gap-1.5 rounded-lg bg-wash-action px-3.5 text-[12.5px] font-semibold text-white shadow-sm shadow-wash-action/30 transition hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:bg-wash-surface-2 disabled:text-wash-text-faint disabled:shadow-none"
            title="Agregar edificio"
          >
            <Plus size={15} />
            Agregar
          </button>
        </div>
      </div>

      {/* List */}
      <PickedEdificiosList items={items} onRemove={removeItem} />

      {/* Observaciones */}
      <div className="mt-5">
        <Label>
          <span className="inline-flex items-center gap-1.5">
            <StickyNote size={11} />
            Observaciones
          </span>
        </Label>
        <textarea
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          placeholder="Aclaraciones para esta carga (opcional)…"
          rows={3}
          className="mt-1.5 w-full resize-none rounded-md border border-wash-border bg-wash-surface-2/40 px-3 py-2.5 text-[13px] text-wash-text-strong placeholder:text-wash-text-faint outline-none focus:border-wash-brand focus:bg-wash-surface"
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
          disabled={items.length === 0}
          onClick={onSave}
          className="rounded-lg bg-wash-action px-5 py-2.5 font-semibold text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          Guardar
        </button>
      </ModalActions>
    </Modal>
  );
}

// ----- Observación del circuito modal -----

function ObservacionModal({
  circuito,
  onClose,
  onSave,
}: {
  circuito: ResumenCircuito | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [text, setText] = useState('');
  useEffect(() => {
    if (circuito) setText('');
  }, [circuito]);

  return (
    <Modal
      open={!!circuito}
      onClose={onClose}
      title="Observación del circuito"
      width={560}
    >
      {circuito && (
        <>
          <div className="flex items-start gap-3 rounded-xl bg-wash-brand/[0.06] p-3.5 ring-1 ring-wash-brand/15">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wash-brand/15 text-wash-brand ring-1 ring-wash-brand/25">
              <MessageSquare size={14} />
            </span>
            <div>
              <p className="font-display text-[13px] font-bold text-wash-accent">
                Circuito {circuito.NroCircuito_RC}
              </p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-wash-text-muted">
                Anotá aclaraciones generales para este circuito.
              </p>
            </div>
          </div>

          <div className="mt-4">
            <Label>Observaciones</Label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Escribí una observación…"
              rows={5}
              className="mt-1.5 w-full resize-none rounded-md border border-wash-border bg-wash-surface-2/40 px-3 py-2.5 text-[13px] text-wash-text-strong placeholder:text-wash-text-faint outline-none focus:border-wash-brand focus:bg-wash-surface"
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
              onClick={onSave}
              className="rounded-lg bg-wash-action px-5 py-2.5 font-semibold text-white hover:bg-wash-action-dark"
            >
              Guardar
            </button>
          </ModalActions>
        </>
      )}
    </Modal>
  );
}

// ----- Detalle del Edificio modal -----

function EdificioDetailModal({
  edificio,
  codeFor,
  onClose,
}: {
  edificio: DetalleCircuito | null;
  codeFor: (name: string) => string | undefined;
  onClose: () => void;
}) {
  if (!edificio) return null;
  const extras = buildingExtras(edificio.NombreEdificio_DC);
  const code = codeFor(edificio.NombreEdificio_DC);

  return (
    <Modal
      open={!!edificio}
      onClose={onClose}
      title="Detalles del edificio"
      width={820}
    >
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-wash-brand/[0.08] via-wash-surface to-wash-surface-2/30 p-5 ring-1 ring-wash-border">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-wash-brand/10 blur-3xl"
        />
        <div className="relative flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-wash-brand to-wash-brand-dark text-white shadow-md shadow-wash-brand/25 ring-2 ring-wash-surface">
            <Building2 size={20} />
          </span>
          <div className="min-w-0 flex-1">
            {code && (
              <span className="inline-flex items-center gap-1 rounded-md bg-wash-brand/10 px-2 py-0.5 font-mono text-[11px] font-bold text-wash-brand tabular-nums ring-1 ring-wash-brand/20">
                <Hash size={10} />
                {code}
              </span>
            )}
            <h3 className="mt-1.5 font-display text-[18px] font-black leading-tight text-wash-accent">
              {edificio.NombreEdificio_DC}
            </h3>
            {edificio.Direccion_DC && (
              <p className="mt-1 flex items-center gap-1.5 text-[12px] text-wash-text-muted">
                <MapPin size={12} />
                {edificio.Direccion_DC}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Info grid */}
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
        <InfoField
          icon={Compass}
          label="Latitud"
          value={extras.lat}
          mono
        />
        <InfoField
          icon={Compass}
          label="Longitud"
          value={extras.lng}
          mono
        />
        <InfoField
          icon={Clock}
          label="Horario"
          value={extras.horario ?? '—'}
        />
        <InfoField
          icon={User2}
          label="Encargado"
          value={extras.encargado}
        />
        <InfoField
          icon={Mail}
          label="Mail"
          value={extras.mail ?? '—'}
        />
        <InfoField
          icon={Phone}
          label="Teléfono"
          value={extras.telefono}
          mono
        />
      </div>

      {/* Observaciones */}
      <div className="mt-3 rounded-xl bg-wash-surface-2/40 p-4 ring-1 ring-wash-border">
        <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-wash-text-muted">
          <StickyNote size={11} />
          Observaciones
        </p>
        <p className="mt-1.5 text-[13px] text-wash-text-strong">
          {extras.observaciones ?? 'Sin observaciones cargadas.'}
        </p>
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

// ----- Eliminar circuito modal -----

function EliminarCircuitoModal({
  circuito,
  onClose,
  onConfirm,
}: {
  circuito: ResumenCircuito | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal open={!!circuito} onClose={onClose} width={520}>
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-200">
          <Trash2 size={20} />
        </span>
        <div className="flex-1">
          <h2 className="font-display text-lg font-black text-wash-text-strong">
            Eliminar circuito
          </h2>
          <p className="mt-1 text-sm text-wash-text-muted">
            ¿Eliminar el{' '}
            <span className="font-semibold">
              Circuito {circuito?.NroCircuito_RC}
            </span>{' '}
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

function EliminarEdificioModal({
  edificio,
  onClose,
  onConfirm,
}: {
  edificio: DetalleCircuito | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal open={!!edificio} onClose={onClose} width={520}>
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-200">
          <Trash2 size={20} />
        </span>
        <div className="flex-1">
          <h2 className="font-display text-lg font-black text-wash-text-strong">
            Quitar edificio
          </h2>
          <p className="mt-1 text-sm text-wash-text-muted">
            ¿Quitar{' '}
            <span className="font-semibold">
              {edificio?.NombreEdificio_DC}
            </span>{' '}
            de este circuito?
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
          Quitar
        </button>
      </ModalActions>
    </Modal>
  );
}

// ----- Shared bits -----

function PickedEdificiosList({
  items,
  onRemove,
}: {
  items: PickedEdif[];
  onRemove: (idx: number) => void;
}) {
  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">
          Edificios del circuito
        </p>
        {items.length > 0 && (
          <span className="rounded-full bg-wash-brand/10 px-2 py-0.5 text-[10.5px] font-bold text-wash-brand">
            {items.length} edificio{items.length === 1 ? '' : 's'}
          </span>
        )}
      </div>
      <div
        className={cn(
          'rounded-xl border transition-colors',
          items.length === 0
            ? 'min-h-[220px] border-dashed border-wash-border bg-wash-surface-2/30'
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
                {it.codigo && (
                  <span className="shrink-0 rounded bg-wash-brand/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-wash-brand ring-1 ring-wash-brand/20">
                    {it.codigo}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-[13px] font-bold text-wash-accent">
                    {it.nombre}
                  </p>
                  {it.direccion && (
                    <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-wash-text-muted">
                      <MapPin size={10} className="shrink-0" />
                      {it.direccion}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(i)}
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
  );
}

function EmptyState() {
  return (
    <div className="flex h-full min-h-[220px] flex-col items-center justify-center px-6 text-center">
      <div className="relative mb-3">
        <span className="absolute inset-0 animate-ping rounded-2xl bg-wash-brand/15" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-wash-brand/10 text-wash-brand ring-1 ring-wash-brand/25">
          <ClipboardEdit size={24} strokeWidth={1.6} />
        </div>
      </div>
      <p className="font-display text-[14px] font-bold text-wash-text-strong">
        Todavía no agregaste un edificio
      </p>
      <p className="mt-1 max-w-[280px] text-[11.5px] leading-relaxed text-wash-text-muted">
        Elegí un edificio del catálogo y tocá <strong>+ Agregar</strong> para
        sumarlo al circuito.
      </p>
    </div>
  );
}

function InfoField({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: typeof Hash;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl bg-wash-surface-2/40 p-3 ring-1 ring-wash-border">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-wash-text-muted">
        <Icon size={11} />
        {label}
      </p>
      <p
        className={cn(
          'mt-1 truncate text-[13px] font-semibold text-wash-text-strong',
          mono && 'font-mono tabular-nums'
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

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">
      {children}
    </label>
  );
}

// ----- Circuit card (main list) -----

function CircuitoCard({
  nroCircuito,
  nroRuta,
  edificios,
  codeFor,
  onView,
  onObserve,
  onDelete,
}: {
  nroCircuito: string;
  nroRuta: string;
  edificios: DetalleCircuito[];
  codeFor: (name: string) => string | undefined;
  onView: () => void;
  onObserve: () => void;
  onDelete: () => void;
}) {
  const visible = edificios.slice(0, 3);
  const extra = edificios.length - visible.length;

  return (
    <div
      onClick={onView}
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl bg-wash-surface shadow-sm shadow-slate-900/[0.04] ring-1 ring-wash-border transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-wash-brand/15 hover:ring-wash-brand/50"
    >
      {/* Top accent gradient bar */}
      <div className="h-1 w-full bg-gradient-to-r from-wash-brand-light via-wash-brand to-wash-brand-dark" />

      {/* Background glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-wash-brand/[0.06] blur-3xl transition duration-300 group-hover:bg-wash-brand/20"
      />

      {/* Header */}
      <div className="relative p-4">
        <div className="flex items-center gap-3">
          <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-wash-brand to-wash-brand-dark text-white shadow-md shadow-wash-brand/30 ring-2 ring-wash-surface transition group-hover:shadow-lg group-hover:shadow-wash-brand/40">
            <GitBranch size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1.5">
              <h3 className="truncate font-display text-[15px] font-black leading-tight text-wash-accent">
                Circuito {nroCircuito}
              </h3>
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-wash-surface-2 px-1.5 py-0.5 text-[10px] font-bold text-wash-text-strong tabular-nums ring-1 ring-wash-border">
                <Building2 size={9} className="text-wash-brand" />
                {edificios.length}
              </span>
            </div>
            <p className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-wash-brand/10 px-1.5 py-0 text-[9.5px] font-bold uppercase tracking-wider text-wash-brand ring-1 ring-wash-brand/20">
              <MapPin size={9} />
              Ruta {nroRuta}
            </p>
          </div>
        </div>
      </div>

      {/* Edificios list */}
      <div className="relative flex-1 px-4 pb-3">
        <p className="text-[9px] font-bold uppercase tracking-wider text-wash-text-muted">
          Edificios asignados
        </p>
        {edificios.length === 0 ? (
          <p className="mt-1.5 rounded-md bg-wash-surface-2/40 px-2.5 py-1.5 text-[11px] italic text-wash-text-muted ring-1 ring-wash-border">
            Sin edificios asignados.
          </p>
        ) : (
          <ul className="mt-1.5 space-y-0.5">
            {visible.map((e) => {
              const code = codeFor(e.NombreEdificio_DC);
              return (
                <li
                  key={e.ID}
                  className="flex items-center gap-1.5 rounded px-1 py-0.5 text-[11.5px] transition hover:bg-wash-surface-2/50"
                >
                  {code ? (
                    <span className="shrink-0 rounded bg-wash-brand/10 px-1 py-0 font-mono text-[9.5px] font-bold text-wash-brand tabular-nums">
                      {code}
                    </span>
                  ) : (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-wash-text-faint" />
                  )}
                  <span className="truncate font-medium text-wash-text-strong">
                    {e.NombreEdificio_DC}
                  </span>
                </li>
              );
            })}
            {extra > 0 && (
              <li className="px-1 pt-0.5 text-[10.5px] font-semibold text-wash-brand">
                + {extra} más
              </li>
            )}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-1.5 border-t border-wash-border bg-wash-surface-2/40 px-3 py-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onView();
          }}
          className="inline-flex items-center gap-1 rounded-md bg-wash-brand/10 px-2.5 py-1 text-[11.5px] font-semibold text-wash-brand ring-1 ring-wash-brand/20 transition hover:bg-wash-brand/15"
        >
          <Eye size={12} />
          Ver
        </button>
        <div className="flex items-center gap-1">
          <ActionBtn
            icon={MessageSquare}
            tone="neutral"
            title="Observaciones"
            onClick={(e) => {
              e.stopPropagation();
              onObserve();
            }}
          />
          <ActionBtn
            icon={Trash2}
            tone="danger"
            title="Eliminar"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          />
        </div>
      </div>
    </div>
  );
}

function EmptyCircuitos() {
  return (
    <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-wash-border bg-wash-surface-2/30 p-12 text-center">
      <div className="relative mb-3">
        <span className="absolute inset-0 animate-ping rounded-2xl bg-wash-brand/15" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-wash-brand/10 text-wash-brand ring-1 ring-wash-brand/25">
          <GitBranch size={28} strokeWidth={1.6} />
        </div>
      </div>
      <p className="font-display text-[15px] font-bold text-wash-text-strong">
        Sin circuitos registrados
      </p>
      <p className="mt-1 max-w-[320px] text-[12px] leading-relaxed text-wash-text-muted">
        Creá el primer circuito tocando <strong>Agregar Circuito</strong> en la
        barra superior.
      </p>
    </div>
  );
}
