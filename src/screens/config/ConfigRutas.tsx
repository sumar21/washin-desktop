import { useMemo, useState } from 'react';
import {
  Eye,
  Pencil,
  Trash2,
  Map as MapIcon,
  Building2,
  MapPin,
  Hash,
  GitBranch,
  Plus,
  X,
  AlertTriangle,
  Info,
  Loader2,
} from 'lucide-react';
import { DataTable, type Column } from '@/components/DataTable';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
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
  const setCircuitosRuta = useAppStore((s) => s.setCircuitosRuta);

  const [viewing, setViewing] = useState<RutaAbm | null>(null);
  const [editing, setEditing] = useState<RutaAbm | null>(null);
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
      width: '150px',
      align: 'right',
      truncate: false,
      render: (r) => (
        <div className="flex items-center justify-end gap-1.5">
          <ActionBtn icon={Eye} tone="brand" title="Ver detalle" onClick={(e) => { e.stopPropagation(); setViewing(r); }} />
          {canEdit && (
            <ActionBtn icon={Pencil} tone="neutral" title="Agregar / quitar circuitos" onClick={(e) => { e.stopPropagation(); setEditing(r); }} />
          )}
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
                        <ActionBtn icon={Pencil} tone="neutral" title="Agregar / quitar circuitos" onClick={(e) => { e.stopPropagation(); setEditing(r); }} />
                      )}
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

      {/* Agregar / quitar circuitos de una ruta viva. `key` por ruta: reinicia la selección al abrir otra. */}
      {editing && (
        <EditarCircuitosRutaModal
          key={editing.ID}
          ruta={editing}
          circuitos={circuitos}
          edificiosByCircuito={edificiosByCircuito}
          onClose={() => setEditing(null)}
          onSave={async (nroCircuitos) => {
            await setCircuitosRuta(editing.NroRuta, nroCircuitos);
            setEditing(null);
          }}
        />
      )}

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
            ? `¿Eliminar la Ruta ${deleting.NroRuta}? Sus ${circuitsByRuta.get(deleting.NroRuta)?.length ?? 0} circuito(s) NO se eliminan: quedan libres, con sus edificios, y los podés asignar a otra ruta. Esta acción no se puede deshacer.`
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
              description="Asignale circuitos con el botón de editar (lápiz) de la fila de la ruta."
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

// ----- Agregar / quitar circuitos de una ruta existente -----
//
// Port de Group_EditarRutas del msapp (Screen_Configuracion.pa.yaml): combo de circuitos
// `bt_circuito_ER` (:1895-1903), botón agregar `bt_addCircuito_ER` (:1908-1941), tacho por
// fila que marca el circuito como sacado (:2039) y guardado `bt_aceptar_ER` (:1711-1853).
//
// REGLA DEL MSAPP — el combo SOLO ofrece circuitos LIBRES (`NroRuta_RC = Blank()`, :1903;
// idéntico en el alta de ruta, :1462): un circuito pertenece a lo sumo a UNA ruta y
// moverlo es un ciclo de dos pasos (liberarlo desde su ruta actual, después adoptarlo).
// La restricción es deliberada, así que se mantiene — pero acá se EXPLICA, en vez de
// dejar el combo vacío sin decir por qué.

function EditarCircuitosRutaModal({
  ruta,
  circuitos,
  edificiosByCircuito,
  onClose,
  onSave,
}: {
  ruta: RutaAbm;
  circuitos: CircuitoAbm[];
  edificiosByCircuito: Map<number, number>;
  onClose: () => void;
  onSave: (nroCircuitos: number[]) => Promise<void>;
}) {
  const originales = useMemo(
    () => circuitos.filter((c) => c.NroRuta === ruta.NroRuta).map((c) => c.NroCircuito).sort((a, b) => a - b),
    [circuitos, ruta.NroRuta]
  );

  const [seleccion, setSeleccion] = useState<number[]>(originales);
  const [pickVal, setPickVal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const porNro = useMemo(() => new Map(circuitos.map((c) => [c.NroCircuito, c])), [circuitos]);
  // Pool de libres: circuitos activos sin ruta (NroRuta llega en 0 cuando NroRuta_RC está vacío).
  const libres = useMemo(
    () => circuitos.filter((c) => !c.NroRuta && !seleccion.includes(c.NroCircuito)).sort((a, b) => a.NroCircuito - b.NroCircuito),
    [circuitos, seleccion]
  );
  const enOtraRuta = useMemo(() => circuitos.filter((c) => c.NroRuta && c.NroRuta !== ruta.NroRuta), [circuitos, ruta.NroRuta]);

  const options = libres.map((c) => {
    const n = edificiosByCircuito.get(c.NroCircuito) ?? 0;
    return { value: String(c.NroCircuito), label: `Circuito ${c.NroCircuito}`, sublabel: `${n} edificio${n === 1 ? '' : 's'} · sin ruta` };
  });

  const agregados = seleccion.filter((n) => !originales.includes(n));
  const quitados = originales.filter((n) => !seleccion.includes(n));
  const totalEdificios = seleccion.reduce((acc, n) => acc + (edificiosByCircuito.get(n) ?? 0), 0);
  // Igual que el DisplayMode de bt_aceptar_ER (:1721-1722): sin circuitos activos no se guarda.
  const ready = seleccion.length > 0 && (agregados.length > 0 || quitados.length > 0);

  const add = () => {
    const n = Number(pickVal);
    if (!n || seleccion.includes(n)) return;
    setSeleccion((arr) => [...arr, n].sort((a, b) => a - b));
    setPickVal(null);
  };

  return (
    <Modal open onClose={() => { if (!saving) onClose(); }} title={`Circuitos de la Ruta ${ruta.NroRuta}`} width={720}>
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-wash-surface-2/50 p-4 ring-1 ring-wash-border">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-wash-brand/10 text-wash-brand ring-1 ring-wash-brand/20">
          <MapIcon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[15px] font-black text-wash-accent">Ruta {ruta.NroRuta}</p>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-wash-text-muted">
            <span className="inline-flex items-center gap-1"><GitBranch size={11} /> {seleccion.length} circuito{seleccion.length === 1 ? '' : 's'}</span>
            <span className="text-wash-text-faint">·</span>
            <span className="inline-flex items-center gap-1"><Building2 size={11} /> {totalEdificios} edificio{totalEdificios === 1 ? '' : 's'}</span>
          </p>
        </div>
      </div>

      {error && (
        <div role="alert" className="mt-3 flex items-start gap-2 rounded-r-md border-l-4 border-red-500 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Agregar circuito libre */}
      <div className="mt-4 rounded-xl border border-wash-border bg-wash-surface-2/40 p-3.5">
        <Label>Agregar circuito a la ruta</Label>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <Combobox
              options={options}
              value={pickVal}
              onChange={setPickVal}
              placeholder="Elegir circuito libre…"
              searchPlaceholder="Buscar por número de circuito…"
              emptyText="No hay circuitos libres"
            />
          </div>
          <button
            type="button"
            disabled={!pickVal || saving}
            onClick={add}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-wash-action px-3.5 text-[12.5px] font-semibold text-white transition hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={15} />
            Agregar
          </button>
        </div>

        {/* La explicación que faltaba: por qué un circuito de otra ruta no aparece en el combo. */}
        <div className="mt-2.5 flex items-start gap-2 rounded-lg bg-wash-surface px-2.5 py-2 ring-1 ring-wash-border">
          <Info size={13} className="mt-0.5 shrink-0 text-wash-brand" />
          <p className="text-[10.5px] leading-relaxed text-wash-text-muted">
            Un circuito pertenece a <strong>una sola ruta</strong>, así que solo se ofrecen los que están libres
            {libres.length > 0 ? ` (${libres.length} disponible${libres.length === 1 ? '' : 's'})` : ''}.
            {enOtraRuta.length > 0 && (
              <>
                {' '}Hay <strong>{enOtraRuta.length}</strong> circuito{enOtraRuta.length === 1 ? '' : 's'} asignado{enOtraRuta.length === 1 ? '' : 's'} a otras rutas: para traer uno acá,
                abrí su ruta actual, quitalo de ahí (queda libre) y volvé a esta pantalla.
              </>
            )}
          </p>
        </div>
      </div>

      {/* Circuitos que va a tener la ruta */}
      <div className="mt-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">Circuitos de la ruta ({seleccion.length})</p>
        {seleccion.length === 0 ? (
          <EmptyState
            compact
            icon={GitBranch}
            title="La ruta quedaría vacía"
            description="Una ruta necesita al menos un circuito. Agregá uno libre o cancelá."
          />
        ) : (
          <ul className="space-y-2">
            {seleccion.map((n) => {
              const c = porNro.get(n);
              const nEdif = edificiosByCircuito.get(n) ?? 0;
              const esNuevo = agregados.includes(n);
              return (
                <li key={n} className="flex items-center gap-3 rounded-xl bg-wash-surface px-3.5 py-2.5 ring-1 ring-wash-border">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wash-brand/10 text-wash-brand ring-1 ring-wash-brand/20">
                    <MapPin size={13} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-display text-[13px] font-bold text-wash-accent">Circuito {n}</p>
                      {esNuevo && (
                        <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-500/25">
                          Nuevo
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-wash-text-muted">
                      <Building2 size={10} />
                      {nEdif} edificio{nEdif === 1 ? '' : 's'}
                      {c?.Observaciones ? ` · ${c.Observaciones}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setSeleccion((arr) => arr.filter((x) => x !== n))}
                    title="Quitar de la ruta (queda libre)"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-rose-600 ring-1 ring-rose-500/30 transition hover:bg-rose-500/10 hover:ring-rose-500 disabled:opacity-50"
                  >
                    <X size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Qué pasa al guardar: la cascada a las visitas del mes no es obvia. */}
      {(agregados.length > 0 || quitados.length > 0) && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-300/70 bg-amber-50 px-3 py-2.5">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-500" />
          <div className="text-[11.5px] leading-relaxed text-amber-900">
            <p className="font-semibold">Al guardar se actualizan las planificaciones vivas (mes actual y siguiente):</p>
            <ul className="mt-1 space-y-0.5">
              {agregados.length > 0 && (
                <li>
                  Se agregan las visitas del/los circuito(s) <strong>{agregados.join(', ')}</strong> al técnico que ya tiene la ruta.
                </li>
              )}
              {quitados.length > 0 && (
                <li>
                  Se anulan las visitas pendientes del/los circuito(s) <strong>{quitados.join(', ')}</strong>, que quedan libres (no se eliminan).
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      <ModalActions>
        <button
          type="button"
          disabled={saving}
          onClick={onClose}
          className="rounded-lg border border-wash-border px-5 py-2.5 font-medium text-wash-text-strong hover:bg-wash-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!ready || saving}
          onClick={async () => {
            setSaving(true);
            setError(null);
            try {
              await onSave(seleccion);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'No se pudieron guardar los circuitos de la ruta.');
            } finally {
              setSaving(false);
            }
          }}
          className="inline-flex items-center rounded-lg bg-wash-action px-5 py-2.5 font-semibold text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          {saving ? 'Guardando…' : 'Guardar cambios'}
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
            Creá el número de ruta. Después le sumás circuitos: con el <strong>lápiz</strong> de la fila si ya existen y están
            libres, o creando circuitos nuevos desde la pestaña <strong>Circuitos</strong>.
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
