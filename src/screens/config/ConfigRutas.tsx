import { useMemo, useState } from 'react';
import {
  Eye,
  Trash2,
  Map as MapIcon,
  Building2,
  MapPin,
  Hash,
  GitBranch,
  Loader2,
} from 'lucide-react';
import { DataTable, type Column } from '@/components/DataTable';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Modal, ModalActions, ConfirmDialog } from '@/components/Modal';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import type { RutaAbm, CircuitoAbm, DetalleCircuitoAbm } from '@/types/domain';

interface ConfigRutasProps {
  query: string;
  addOpen: boolean;
  setAddOpen: (v: boolean) => void;
  canEdit?: boolean;
}

export function ConfigRutas({ query, addOpen, setAddOpen, canEdit = false }: ConfigRutasProps) {
  const rutas = useAppStore((s) => s.CollectAbmRutas);
  const circuitos = useAppStore((s) => s.CollectAbmCircuitos);
  const detalles = useAppStore((s) => s.CollectAbmDetalles);
  const createRuta = useAppStore((s) => s.createRuta);
  const deleteRuta = useAppStore((s) => s.deleteRuta);

  const [viewing, setViewing] = useState<RutaAbm | null>(null);
  const [deleting, setDeleting] = useState<RutaAbm | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = query.toLowerCase();
    return rutas
      .filter((r) => String(r.NroRuta).includes(q))
      .sort((a, b) => a.NroRuta - b.NroRuta);
  }, [rutas, query]);

  // Circuitos reales por ruta (para chips + conteos, autoritativo sobre el contador denormalizado).
  const circuitsByRuta = useMemo(() => {
    const map = new Map<number, CircuitoAbm[]>();
    for (const c of circuitos) {
      if (!map.has(c.NroRuta)) map.set(c.NroRuta, []);
      map.get(c.NroRuta)!.push(c);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.NroCircuito - b.NroCircuito);
    return map;
  }, [circuitos]);

  const edificiosByCircuito = useMemo(() => {
    const map = new Map<number, number>();
    for (const d of detalles) map.set(d.NroCircuito, (map.get(d.NroCircuito) ?? 0) + 1);
    return map;
  }, [detalles]);

  const totalCircuitos = useMemo(() => rows.reduce((acc, r) => acc + (circuitsByRuta.get(r.NroRuta)?.length ?? 0), 0), [rows, circuitsByRuta]);
  const totalEdificios = useMemo(
    () => rows.reduce((acc, r) => acc + (circuitsByRuta.get(r.NroRuta) ?? []).reduce((s, c) => s + (edificiosByCircuito.get(c.NroCircuito) ?? 0), 0), 0),
    [rows, circuitsByRuta, edificiosByCircuito]
  );

  const handleDelete = async () => {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteRuta(deleting.NroRuta);
      setDeleting(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'No se pudo eliminar la ruta.');
    } finally {
      setDeleteBusy(false);
    }
  };

  const columns: Column<RutaAbm>[] = [
    {
      key: 'ruta',
      header: 'Ruta',
      width: 'minmax(180px, 1fr)',
      truncate: false,
      render: (r) => (
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-wash-brand to-wash-brand-dark text-[12px] font-black text-white tabular-nums shadow-sm shadow-wash-brand/30">
            {String(r.NroRuta).padStart(2, '0')}
          </span>
          <div className="min-w-0">
            <p className="font-display text-[13.5px] font-black text-wash-accent">Ruta {r.NroRuta}</p>
            <p className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Activa
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'circuitos',
      header: 'Circuitos',
      width: '120px',
      align: 'center',
      truncate: false,
      render: (r) => (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-wash-surface-2 px-2.5 py-1 text-[12.5px] font-bold text-wash-text-strong tabular-nums">
          <GitBranch size={11} className="text-wash-brand" />
          {circuitsByRuta.get(r.NroRuta)?.length ?? 0}
        </span>
      ),
    },
    {
      key: 'edificios',
      header: 'Edificios',
      width: '120px',
      align: 'center',
      truncate: false,
      render: (r) => {
        const n = (circuitsByRuta.get(r.NroRuta) ?? []).reduce((s, c) => s + (edificiosByCircuito.get(c.NroCircuito) ?? 0), 0);
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-wash-surface-2 px-2.5 py-1 text-[12.5px] font-bold text-wash-text-strong tabular-nums">
            <Building2 size={11} className="text-emerald-600" />
            {n}
          </span>
        );
      },
    },
    {
      key: 'asignados',
      header: 'Circuitos asignados',
      width: 'minmax(0, 1.6fr)',
      truncate: false,
      render: (r) => {
        const cs = circuitsByRuta.get(r.NroRuta) ?? [];
        if (cs.length === 0) return <span className="text-[11.5px] italic text-wash-text-muted">Sin circuitos</span>;
        const visible = cs.slice(0, 8);
        const extra = cs.length - visible.length;
        return (
          <div className="flex flex-wrap items-center gap-1">
            {visible.map((c) => (
              <span key={c.ID} className="inline-flex items-center gap-0.5 rounded bg-wash-brand/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-wash-brand ring-1 ring-wash-brand/20">
                <MapPin size={8} />
                {c.NroCircuito}
              </span>
            ))}
            {extra > 0 && <span className="inline-flex items-center rounded bg-wash-brand/15 px-1.5 py-0.5 text-[10px] font-bold text-wash-brand">+{extra}</span>}
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'Acciones',
      width: '110px',
      align: 'right',
      truncate: false,
      render: (r) => (
        <div className="flex items-center justify-end gap-1.5">
          <ActionBtn icon={Eye} tone="brand" title="Ver detalle" onClick={(e) => { e.stopPropagation(); setViewing(r); }} />
          {canEdit && (
            <ActionBtn icon={Trash2} tone="danger" title="Eliminar" onClick={(e) => { e.stopPropagation(); setDeleting(r); setDeleteError(null); }} />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.04)_1px,transparent_0)] bg-[size:22px_22px]">
      <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-6">
        <div className="grid shrink-0 grid-cols-3 gap-2 sm:gap-3">
          <KpiCard icon={MapIcon} tone="brand" label="Rutas activas" value={rows.length} />
          <KpiCard icon={GitBranch} tone="emerald" label="Circuitos totales" value={totalCircuitos} />
          <KpiCard icon={Building2} tone="violet" label="Edificios totales" value={totalEdificios} />
        </div>

        <div className="mt-5 flex shrink-0 items-end justify-between">
          <div>
            <p className="font-display text-[13px] font-black uppercase tracking-wider text-wash-text-strong">Catálogo de rutas</p>
            <p className="mt-0.5 text-[11.5px] text-wash-text-muted">
              {rows.length === 0 ? 'Sin rutas registradas todavía' : `${rows.length} ruta${rows.length === 1 ? '' : 's'} configurada${rows.length === 1 ? '' : 's'}`}
            </p>
          </div>
        </div>

        <div className="mt-3 min-h-0 flex-1">
          <DataTable
            rows={rows}
            rowKey={(r) => r.ID}
            columns={columns}
            empty={
              <EmptyState
                icon={MapIcon}
                title="Sin rutas"
                description="Creá tu primera ruta para empezar a armar circuitos."
                action={canEdit && <Button onClick={() => setAddOpen(true)}>Agregar ruta</Button>}
              />
            }
            onRowClick={(r) => setViewing(r)}
            mobileCard={(r) => {
              const cs = circuitsByRuta.get(r.NroRuta) ?? [];
              const nEdif = cs.reduce((s, c) => s + (edificiosByCircuito.get(c.NroCircuito) ?? 0), 0);
              const visible = cs.slice(0, 10);
              const extra = cs.length - visible.length;
              return (
                <div
                  onClick={() => setViewing(r)}
                  className="rounded-xl bg-wash-surface p-3 shadow-sm ring-1 ring-wash-border transition active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-wash-brand to-wash-brand-dark text-[12px] font-black text-white tabular-nums shadow-sm shadow-wash-brand/30">
                        {String(r.NroRuta).padStart(2, '0')}
                      </span>
                      <div className="min-w-0">
                        <p className="font-display text-[14px] font-black text-wash-accent">Ruta {r.NroRuta}</p>
                        <p className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Activa
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <ActionBtn icon={Eye} tone="brand" title="Ver detalle" onClick={(e) => { e.stopPropagation(); setViewing(r); }} />
                      {canEdit && (
                        <ActionBtn icon={Trash2} tone="danger" title="Eliminar" onClick={(e) => { e.stopPropagation(); setDeleting(r); setDeleteError(null); }} />
                      )}
                    </div>
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-wash-surface-2 px-2 py-1 text-[11.5px] font-bold text-wash-text-strong tabular-nums">
                      <GitBranch size={11} className="text-wash-brand" />
                      {cs.length} circuito{cs.length === 1 ? '' : 's'}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-wash-surface-2 px-2 py-1 text-[11.5px] font-bold text-wash-text-strong tabular-nums">
                      <Building2 size={11} className="text-emerald-600" />
                      {nEdif} edificio{nEdif === 1 ? '' : 's'}
                    </span>
                  </div>
                  {cs.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      {visible.map((c) => (
                        <span key={c.ID} className="inline-flex items-center gap-0.5 rounded bg-wash-brand/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-wash-brand ring-1 ring-wash-brand/20">
                          <MapPin size={8} />
                          {c.NroCircuito}
                        </span>
                      ))}
                      {extra > 0 && <span className="inline-flex items-center rounded bg-wash-brand/15 px-1.5 py-0.5 text-[10px] font-bold text-wash-brand">+{extra}</span>}
                    </div>
                  )}
                </div>
              );
            }}
          />
        </div>
      </div>

      <DetalleRutaModal ruta={viewing} circuitos={circuitos} detalles={detalles} onClose={() => setViewing(null)} />

      <AddRutaModal
        open={addOpen}
        rutas={rutas}
        onClose={() => setAddOpen(false)}
        onCreate={async (nroRuta) => {
          await createRuta(nroRuta);
          setAddOpen(false);
        }}
      />

      <ConfirmDialog
        open={!!deleting}
        tone="danger"
        title="Eliminar ruta"
        message={
          deleting
            ? `¿Eliminar la Ruta ${deleting.NroRuta}? Se eliminan también sus ${circuitsByRuta.get(deleting.NroRuta)?.length ?? 0} circuito(s) y se liberan sus edificios. Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel={deleteBusy ? 'Eliminando…' : 'Eliminar'}
        busy={deleteBusy}
        error={deleteError}
        onCancel={() => { setDeleting(null); setDeleteError(null); }}
        onConfirm={handleDelete}
      />
    </div>
  );
}

// ----- Detalle de Ruta modal -----

function DetalleRutaModal({
  ruta,
  circuitos,
  detalles,
  onClose,
}: {
  ruta: RutaAbm | null;
  circuitos: CircuitoAbm[];
  detalles: DetalleCircuitoAbm[];
  onClose: () => void;
}) {
  if (!ruta) return null;
  const circuitosRuta = circuitos.filter((c) => c.NroRuta === ruta.NroRuta).sort((a, b) => a.NroCircuito - b.NroCircuito);
  const totalEdificios = circuitosRuta.reduce((acc, c) => acc + detalles.filter((d) => d.NroCircuito === c.NroCircuito).length, 0);

  return (
    <Modal open={!!ruta} onClose={onClose} title={`Detalle de Ruta ${ruta.NroRuta}`} width={1180}>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-wash-brand/[0.08] via-wash-surface to-wash-surface-2/30 p-5 ring-1 ring-wash-border">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-wash-brand/10 blur-3xl" />
        <div className="relative flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-wash-brand to-wash-brand-dark text-white shadow-md shadow-wash-brand/25 ring-2 ring-wash-surface">
            <MapIcon size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1 rounded-md bg-wash-brand/10 px-2 py-0.5 text-[11.5px] font-bold text-wash-brand tabular-nums ring-1 ring-wash-brand/20">
              <Hash size={10} />
              Ruta {ruta.NroRuta}
            </span>
            <h3 className="mt-1.5 font-display text-[17px] font-black leading-tight text-wash-accent">Catálogo de circuitos y edificios</h3>
            <p className="mt-1 text-[11.5px] text-wash-text-muted">Asignaciones permanentes que componen esta ruta.</p>
          </div>
        </div>
        <div className="relative mt-4 grid grid-cols-2 divide-x divide-wash-border rounded-xl bg-wash-surface/80 ring-1 ring-wash-border">
          <StatStrip icon={MapIcon} label="Circuitos" value={String(circuitosRuta.length)} />
          <StatStrip icon={Building2} label="Edificios" value={String(totalEdificios)} />
        </div>
      </div>

      <div className="mt-5 flex items-end justify-between">
        <div>
          <p className="font-display text-[13px] font-black uppercase tracking-wider text-wash-text-strong">Circuitos asignados</p>
          <p className="mt-0.5 text-[11px] text-wash-text-muted">Edificios por circuito</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {circuitosRuta.length === 0 ? (
          <div className="col-span-full">
            <EmptyState
              compact
              icon={GitBranch}
              title="Ruta sin circuitos"
              description="Asigná circuitos a esta ruta desde la pestaña Circuitos."
            />
          </div>
        ) : (
          circuitosRuta.map((c) => {
            const edifs = detalles.filter((d) => d.NroCircuito === c.NroCircuito);
            return (
              <div key={c.ID} className="overflow-hidden rounded-xl bg-wash-surface ring-1 ring-wash-border transition hover:shadow-sm hover:ring-wash-brand/40">
                <div className="border-b border-wash-border bg-wash-surface-2/40 px-3.5 py-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-wash-brand/10 text-wash-brand ring-1 ring-wash-brand/20">
                        <MapPin size={12} />
                      </span>
                      <p className="font-display text-[13px] font-black leading-none text-wash-accent">Circuito {c.NroCircuito}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-md bg-wash-surface px-1.5 py-1 text-[10.5px] font-bold text-wash-text-strong tabular-nums ring-1 ring-wash-border">
                      <Building2 size={10} />
                      {edifs.length}
                    </span>
                  </div>
                </div>
                <ul>
                  {edifs.length === 0 ? (
                    <li className="px-3 py-3 text-xs italic text-wash-text-muted">Sin edificios cargados.</li>
                  ) : (
                    edifs.map((e) => (
                      <li key={e.ID} className="group flex items-center gap-2 border-l-2 border-transparent px-3 py-1.5 text-[12px] transition hover:border-wash-brand/40 hover:bg-wash-surface-2/40">
                        {e.CodigoEdificio && (
                          <span className="shrink-0 rounded bg-wash-surface-2 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-wash-text-muted tabular-nums">{e.CodigoEdificio}</span>
                        )}
                        <span className="truncate font-medium text-wash-text-strong">{e.Edificio}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            );
          })
        )}
      </div>

      <ModalActions>
        <button type="button" onClick={onClose} className="rounded-lg bg-wash-action px-5 py-2.5 font-medium text-white hover:bg-wash-action-dark">
          Cerrar
        </button>
      </ModalActions>
    </Modal>
  );
}

// ----- Agregar Ruta modal (solo número; los circuitos se crean en la pestaña Circuitos) -----

function AddRutaModal({
  open,
  rutas,
  onClose,
  onCreate,
}: {
  open: boolean;
  rutas: RutaAbm[];
  onClose: () => void;
  onCreate: (nroRuta: number) => Promise<void>;
}) {
  const [nroRuta, setNroRuta] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nro = Number(nroRuta);
  const duplicada = !!nroRuta && rutas.some((r) => r.NroRuta === nro);
  const invalida = !!nroRuta && (!Number.isInteger(nro) || nro <= 0);
  const ready = !!nroRuta && !duplicada && !invalida;

  const reset = () => { setNroRuta(''); setError(null); };

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Agregar Ruta" width={480}>
      <div className="flex items-start gap-3 rounded-xl bg-wash-brand/[0.06] p-3.5 ring-1 ring-wash-brand/15">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wash-brand/15 text-wash-brand ring-1 ring-wash-brand/25">
          <MapIcon size={14} />
        </span>
        <div>
          <p className="font-display text-[13px] font-bold text-wash-accent">Nueva ruta</p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-wash-text-muted">
            Creá el número de ruta. Después, en la pestaña <strong>Circuitos</strong>, agregás circuitos a esta ruta.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <Label>Nro de Ruta</Label>
        <input
          type="number"
          min="1"
          value={nroRuta}
          onChange={(e) => setNroRuta(e.target.value)}
          placeholder="Ej. 9"
          className="mt-1.5 h-10 w-full rounded-md border border-wash-border bg-wash-surface px-3 text-[13px] font-semibold text-wash-text-strong outline-none focus:border-wash-brand focus:ring-2 focus:ring-wash-brand/15"
        />
        {duplicada && <p className="mt-1.5 text-[11px] font-medium text-rose-600">Ya existe la ruta {nro}.</p>}
        {invalida && <p className="mt-1.5 text-[11px] font-medium text-rose-600">Tiene que ser un entero positivo.</p>}
      </div>

      {error && <p className="mt-3 rounded-r-md border-l-4 border-red-500 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700">{error}</p>}

      <ModalActions>
        <button type="button" onClick={() => { reset(); onClose(); }} disabled={saving} className="rounded-lg border border-wash-border px-5 py-2.5 font-medium text-wash-text-strong hover:bg-wash-surface-2 disabled:cursor-not-allowed disabled:opacity-50">
          Cancelar
        </button>
        <button
          type="button"
          disabled={!ready || saving}
          onClick={async () => {
            setSaving(true);
            setError(null);
            try {
              await onCreate(nro);
              reset();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'No se pudo crear la ruta.');
            } finally {
              setSaving(false);
            }
          }}
          className="inline-flex items-center rounded-lg bg-wash-action px-5 py-2.5 font-semibold text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          {saving ? 'Creando…' : 'Crear ruta'}
        </button>
      </ModalActions>
    </Modal>
  );
}

// ----- Shared bits -----

function ActionBtn({ icon: Icon, tone, title, onClick }: { icon: typeof Eye; tone: 'neutral' | 'brand' | 'danger'; title: string; onClick: (e: React.MouseEvent) => void }) {
  const cls = {
    neutral: 'text-wash-text-muted ring-wash-border hover:bg-wash-surface-2 hover:text-wash-text-strong hover:ring-wash-text-muted/40',
    brand: 'text-wash-brand ring-wash-brand/30 hover:bg-wash-brand/10 hover:ring-wash-brand',
    danger: 'text-rose-600 ring-rose-500/30 hover:bg-rose-500/10 hover:ring-rose-500',
  }[tone];
  return (
    <button type="button" onClick={onClick} title={title} className={cn('flex h-8 w-8 items-center justify-center rounded-lg ring-1 transition', cls)}>
      <Icon size={15} />
    </button>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">{children}</label>;
}

function StatStrip({ icon: Icon, label, value }: { icon: typeof MapIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-wash-brand/10 text-wash-brand ring-1 ring-wash-brand/20">
        <Icon size={14} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-wash-text-muted">{label}</p>
        <p className="font-display text-[19px] font-black leading-none text-wash-text-strong tabular-nums">{value}</p>
      </div>
    </div>
  );
}

type KpiTone = 'brand' | 'emerald' | 'violet';

function KpiCard({ icon: Icon, label, value, tone }: { icon: typeof MapIcon; label: string; value: number; tone: KpiTone }) {
  const bgGradient: Record<KpiTone, string> = { brand: 'from-wash-brand/[0.07]', emerald: 'from-emerald-500/[0.07]', violet: 'from-violet-500/[0.07]' };
  const iconCls: Record<KpiTone, string> = {
    brand: 'bg-wash-brand/10 text-wash-brand ring-wash-brand/25',
    emerald: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/25',
    violet: 'bg-violet-500/10 text-violet-600 ring-violet-500/25',
  };
  const blobCls: Record<KpiTone, string> = { brand: 'bg-wash-brand/15', emerald: 'bg-emerald-500/15', violet: 'bg-violet-500/15' };
  return (
    <div className={cn('relative overflow-hidden rounded-xl bg-gradient-to-br to-wash-surface p-2.5 ring-1 ring-wash-border sm:rounded-2xl sm:p-4', bgGradient[tone])}>
      <div aria-hidden className={cn('pointer-events-none absolute -right-8 -top-8 hidden h-28 w-28 rounded-full blur-3xl sm:block', blobCls[tone])} />
      <div className="relative flex items-center gap-2 sm:gap-3">
        <span className={cn('hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 sm:flex', iconCls[tone])}>
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase leading-tight tracking-wider text-wash-text-muted sm:text-[10.5px]">{label}</p>
          <p className="mt-0.5 font-display text-[19px] font-black leading-none text-wash-text-strong tabular-nums sm:mt-0 sm:text-[22px]">{value}</p>
        </div>
      </div>
    </div>
  );
}
