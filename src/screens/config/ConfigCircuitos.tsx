import { useMemo, useState } from 'react';
import {
  Eye,
  Trash2,
  GitBranch,
  Building2,
  MapPin,
  Plus,
  X,
  AlertTriangle,
  MessageSquare,
  Phone,
  Clock,
  User2,
  Map as MapIcon,
  Loader2,
} from 'lucide-react';
import { DataTable, type Column } from '@/components/DataTable';
import { Modal, ModalActions, ConfirmDialog } from '@/components/Modal';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import type { CircuitoAbm, DetalleCircuitoAbm, EdificioAbm, RutaAbm } from '@/types/domain';

interface ConfigCircuitosProps {
  query: string;
  addOpen: boolean;
  setAddOpen: (v: boolean) => void;
  onFullscreenChange: (v: boolean) => void;
  canEdit?: boolean;
}

/** Códigos de edificio que YA están en algún circuito activo (regla: 1 edificio = 1 circuito). */
function occupiedCodes(detalles: DetalleCircuitoAbm[], exceptCircuito?: number): Set<string> {
  const s = new Set<string>();
  for (const d of detalles) {
    if (exceptCircuito != null && d.NroCircuito === exceptCircuito) continue;
    if (d.CodigoEdificio) s.add(d.CodigoEdificio);
  }
  return s;
}

export function ConfigCircuitos({ query, addOpen, setAddOpen, canEdit = false }: ConfigCircuitosProps) {
  const circuitos = useAppStore((s) => s.CollectAbmCircuitos);
  const detalles = useAppStore((s) => s.CollectAbmDetalles);
  const edificios = useAppStore((s) => s.CollectAbmEdificios);
  const rutas = useAppStore((s) => s.CollectAbmRutas);
  const createCircuito = useAppStore((s) => s.createCircuito);
  const deleteCircuito = useAppStore((s) => s.deleteCircuito);
  const addEdificioCircuito = useAppStore((s) => s.addEdificioCircuito);
  const removeEdificioCircuito = useAppStore((s) => s.removeEdificioCircuito);
  const updateCircuitoObs = useAppStore((s) => s.updateCircuitoObs);

  const [viewing, setViewing] = useState<CircuitoAbm | null>(null);
  const [deleting, setDeleting] = useState<CircuitoAbm | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const edifsByCircuito = useMemo(() => {
    const map = new Map<number, DetalleCircuitoAbm[]>();
    for (const d of detalles) {
      if (!map.has(d.NroCircuito)) map.set(d.NroCircuito, []);
      map.get(d.NroCircuito)!.push(d);
    }
    return map;
  }, [detalles]);

  // Warning de integridad: edificios en >1 circuito activo (la data histórica los tiene).
  const duplicados = useMemo(() => {
    const byCode = new Map<string, Set<number>>();
    for (const d of detalles) {
      if (!d.CodigoEdificio) continue;
      if (!byCode.has(d.CodigoEdificio)) byCode.set(d.CodigoEdificio, new Set());
      byCode.get(d.CodigoEdificio)!.add(d.NroCircuito);
    }
    return [...byCode.entries()]
      .filter(([, set]) => set.size > 1)
      .map(([code, set]) => ({ code, circuitos: [...set].sort((a, b) => a - b) }));
  }, [detalles]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return circuitos
      .filter((c) => {
        if (!q) return true;
        if (String(c.NroCircuito).includes(q)) return true;
        return (edifsByCircuito.get(c.NroCircuito) ?? []).some((e) => e.Edificio.toLowerCase().includes(q));
      })
      .sort((a, b) => a.NroCircuito - b.NroCircuito);
  }, [circuitos, edifsByCircuito, query]);

  const totalEdificios = useMemo(() => filtered.reduce((acc, c) => acc + (edifsByCircuito.get(c.NroCircuito)?.length ?? 0), 0), [filtered, edifsByCircuito]);

  const handleDelete = async () => {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteCircuito(deleting.NroCircuito);
      setDeleting(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'No se pudo eliminar el circuito.');
    } finally {
      setDeleteBusy(false);
    }
  };

  const columns: Column<CircuitoAbm>[] = [
    {
      key: 'circuito',
      header: 'Circuito',
      width: 'minmax(160px, 1fr)',
      truncate: false,
      render: (c) => (
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-wash-brand to-wash-brand-dark text-[12px] font-black text-white tabular-nums shadow-sm shadow-wash-brand/30">
            {String(c.NroCircuito).padStart(2, '0')}
          </span>
          <div className="min-w-0">
            <p className="font-display text-[13.5px] font-black text-wash-accent">Circuito {c.NroCircuito}</p>
            <p className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-wash-text-muted">
              <MapIcon size={9} className="text-wash-brand" />
              Ruta {c.NroRuta || '—'}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'edificios',
      header: 'Edificios',
      width: '120px',
      align: 'center',
      truncate: false,
      render: (c) => (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-wash-surface-2 px-2.5 py-1 text-[12.5px] font-bold text-wash-text-strong tabular-nums">
          <Building2 size={11} className="text-emerald-600" />
          {edifsByCircuito.get(c.NroCircuito)?.length ?? 0}
        </span>
      ),
    },
    {
      key: 'edificiosList',
      header: 'Edificios del circuito',
      width: 'minmax(0, 1.8fr)',
      truncate: false,
      render: (c) => {
        const es = edifsByCircuito.get(c.NroCircuito) ?? [];
        if (es.length === 0) return <span className="text-[11.5px] italic text-wash-text-muted">Sin edificios</span>;
        const visible = es.slice(0, 4);
        const extra = es.length - visible.length;
        return (
          <div className="flex flex-wrap items-center gap-1">
            {visible.map((e) => (
              <span key={e.ID} className="inline-flex items-center gap-1 rounded bg-wash-surface-2 px-1.5 py-0.5 text-[10.5px] font-medium text-wash-text-strong ring-1 ring-wash-border">
                <MapPin size={8} className="text-wash-text-muted" />
                <span className="max-w-[120px] truncate">{e.Edificio}</span>
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
      render: (c) => (
        <div className="flex items-center justify-end gap-1.5">
          <ActionBtn icon={Eye} tone="brand" title="Ver / editar edificios" onClick={(e) => { e.stopPropagation(); setViewing(c); }} />
          {canEdit && (
            <ActionBtn icon={Trash2} tone="danger" title="Eliminar circuito" onClick={(e) => { e.stopPropagation(); setDeleting(c); setDeleteError(null); }} />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.04)_1px,transparent_0)] bg-[size:22px_22px]">
      <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-6">
        <div className="grid shrink-0 grid-cols-2 gap-2 sm:gap-3">
          <KpiCard icon={GitBranch} tone="brand" label="Circuitos activos" value={filtered.length} />
          <KpiCard icon={Building2} tone="emerald" label="Edificios asignados" value={totalEdificios} />
        </div>

        <div className="mt-5 flex shrink-0 items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-[13px] font-black uppercase tracking-wider text-wash-text-strong">Catálogo de circuitos</p>
            <p className="mt-0.5 text-[11.5px] text-wash-text-muted">
              {filtered.length === 0 ? 'Sin circuitos registrados todavía' : `${filtered.length} circuito${filtered.length === 1 ? '' : 's'} activo${filtered.length === 1 ? '' : 's'}`}
            </p>
          </div>

          {/* Warning de integridad: edificios en más de un circuito (colapsado en un ícono + popover) */}
          {duplicados.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  title="Edificios en más de un circuito"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-300/70 bg-amber-50 px-2.5 py-1.5 text-amber-900 transition hover:bg-amber-100"
                >
                  <AlertTriangle size={15} className="text-amber-500" />
                  <span className="text-[12.5px] font-bold tabular-nums">{duplicados.length}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" />
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-semibold text-wash-text-strong">
                      {duplicados.length} edificio{duplicados.length === 1 ? '' : 's'} figura{duplicados.length === 1 ? '' : 'n'} en más de un circuito
                    </p>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-wash-text-muted">
                      Un edificio debería estar en un solo circuito. Revisá y limpiá:{' '}
                      {duplicados.slice(0, 8).map((d, i) => (
                        <span key={d.code}>
                          {i > 0 && ' · '}
                          <strong className="font-mono text-wash-text-strong">{d.code}</strong> (circuitos {d.circuitos.join(', ')})
                        </span>
                      ))}
                      {duplicados.length > 8 && ` y ${duplicados.length - 8} más`}
                      .
                    </p>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>

        <div className="mt-3 min-h-0 flex-1">
          <DataTable
            rows={filtered}
            rowKey={(c) => c.ID}
            columns={columns}
            empty={
              <EmptyState
                icon={GitBranch}
                title="Sin circuitos"
                description="Todavía no hay circuitos configurados."
                action={canEdit && <Button onClick={() => setAddOpen(true)}>Agregar circuito</Button>}
              />
            }
            onRowClick={(c) => setViewing(c)}
            mobileCard={(c) => {
              const es = edifsByCircuito.get(c.NroCircuito) ?? [];
              const visible = es.slice(0, 4);
              const extra = es.length - visible.length;
              return (
                <div
                  onClick={() => setViewing(c)}
                  className="rounded-xl bg-wash-surface p-3 shadow-sm ring-1 ring-wash-border transition active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-wash-brand to-wash-brand-dark text-[12px] font-black text-white tabular-nums shadow-sm shadow-wash-brand/30">
                        {String(c.NroCircuito).padStart(2, '0')}
                      </span>
                      <div className="min-w-0">
                        <p className="font-display text-[14px] font-black text-wash-accent">Circuito {c.NroCircuito}</p>
                        <p className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-wash-text-muted">
                          <MapIcon size={9} className="text-wash-brand" />
                          Ruta {c.NroRuta || '—'}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <ActionBtn icon={Eye} tone="brand" title="Ver / editar edificios" onClick={(e) => { e.stopPropagation(); setViewing(c); }} />
                      {canEdit && (
                        <ActionBtn icon={Trash2} tone="danger" title="Eliminar circuito" onClick={(e) => { e.stopPropagation(); setDeleting(c); setDeleteError(null); }} />
                      )}
                    </div>
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-wash-surface-2 px-2 py-1 text-[11.5px] font-bold text-wash-text-strong tabular-nums">
                      <Building2 size={11} className="text-emerald-600" />
                      {es.length} edificio{es.length === 1 ? '' : 's'}
                    </span>
                    {visible.map((e) => (
                      <span key={e.ID} className="inline-flex items-center gap-1 rounded bg-wash-surface-2 px-1.5 py-0.5 text-[10.5px] font-medium text-wash-text-strong ring-1 ring-wash-border">
                        <MapPin size={8} className="text-wash-text-muted" />
                        <span className="max-w-[140px] truncate">{e.Edificio}</span>
                      </span>
                    ))}
                    {extra > 0 && <span className="inline-flex items-center rounded bg-wash-brand/15 px-1.5 py-0.5 text-[10px] font-bold text-wash-brand">+{extra}</span>}
                  </div>
                </div>
              );
            }}
          />
        </div>
      </div>

      {/* Detalle + edición de edificios del circuito */}
      <CircuitoDetailModal
        circuito={viewing}
        edificiosDelCircuito={viewing ? edifsByCircuito.get(viewing.NroCircuito) ?? [] : []}
        allEdificios={edificios}
        occupied={occupiedCodes(detalles, viewing?.NroCircuito)}
        canEdit={canEdit}
        onClose={() => setViewing(null)}
        onAddEdificio={(edificioId) => addEdificioCircuito(viewing!.NroCircuito, edificioId)}
        onRemoveEdificio={(detalleId) => removeEdificioCircuito(detalleId)}
        onUpdateObs={(obs) => updateCircuitoObs(viewing!.NroCircuito, obs)}
      />

      {/* Alta de circuito */}
      <AddCircuitoModal
        open={addOpen}
        rutas={rutas}
        circuitos={circuitos}
        edificios={edificios}
        occupied={occupiedCodes(detalles)}
        onClose={() => setAddOpen(false)}
        onCreate={async (payload) => {
          await createCircuito(payload);
          setAddOpen(false);
        }}
      />

      <ConfirmDialog
        open={!!deleting}
        tone="danger"
        title="Eliminar circuito"
        message={
          deleting
            ? `¿Eliminar el Circuito ${deleting.NroCircuito}? Se libera(n) sus ${edifsByCircuito.get(deleting.NroCircuito)?.length ?? 0} edificio(s). Esta acción no se puede deshacer.`
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

// ═══════════════ Detalle de circuito (ver + agregar/quitar edificios) ═══════════════

function CircuitoDetailModal({
  circuito,
  edificiosDelCircuito,
  allEdificios,
  occupied,
  canEdit,
  onClose,
  onAddEdificio,
  onRemoveEdificio,
  onUpdateObs,
}: {
  circuito: CircuitoAbm | null;
  edificiosDelCircuito: DetalleCircuitoAbm[];
  allEdificios: EdificioAbm[];
  occupied: Set<string>; // códigos ocupados en OTROS circuitos
  canEdit: boolean;
  onClose: () => void;
  onAddEdificio: (edificioId: number) => Promise<void>;
  onRemoveEdificio: (detalleId: number) => Promise<void>;
  onUpdateObs: (obs: string) => Promise<void>;
}) {
  const [pickId, setPickId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyKind, setBusyKind] = useState<'add' | 'obs' | 'remove' | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [obs, setObs] = useState('');
  const [obsDirty, setObsDirty] = useState(false);

  if (!circuito) return null;

  // Opciones: edificios NO ocupados en otro circuito y NO ya en este.
  const yaEnEste = new Set(edificiosDelCircuito.map((d) => d.CodigoEdificio));
  const options = allEdificios
    .filter((e) => e.Codigo && !occupied.has(e.Codigo) && !yaEnEste.has(e.Codigo))
    .map((e) => ({ value: String(e.ID), label: e.Edificio, sublabel: e.Codigo ? `${e.Codigo} · ${e.Direccion}` : e.Direccion }));

  const run = async (kind: 'add' | 'obs' | 'remove', fn: () => Promise<void>) => {
    setBusy(true);
    setBusyKind(kind);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar la operación.');
    } finally {
      setBusy(false);
      setBusyKind(null);
      setRemovingId(null);
    }
  };

  return (
    <Modal open={!!circuito} onClose={onClose} title={`Circuito ${circuito.NroCircuito}`} width={860}>
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-wash-surface-2/50 p-4 ring-1 ring-wash-border">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-wash-brand/10 text-wash-brand ring-1 ring-wash-brand/20">
          <GitBranch size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[15px] font-black text-wash-accent">Circuito {circuito.NroCircuito}</p>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-wash-text-muted">
            <span className="inline-flex items-center gap-1"><MapIcon size={11} /> Ruta {circuito.NroRuta || '—'}</span>
            <span className="text-wash-text-faint">·</span>
            <span className="inline-flex items-center gap-1"><Building2 size={11} /> {edificiosDelCircuito.length} edificio(s)</span>
          </p>
        </div>
      </div>

      {error && (
        <div role="alert" className="mt-3 flex items-center gap-2 rounded-r-md border-l-4 border-red-500 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700">
          <AlertTriangle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Agregar edificio (excluye ocupados) */}
      {canEdit && (
        <div className="mt-4 rounded-xl border border-wash-border bg-wash-surface-2/40 p-3.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">Agregar edificio al circuito</label>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <Combobox
                options={options}
                value={pickId}
                onChange={setPickId}
                placeholder="Elegir edificio libre…"
                searchPlaceholder="Buscar por nombre, código o dirección…"
                emptyText="No hay edificios libres"
              />
            </div>
            <button
              type="button"
              disabled={!pickId || busy}
              onClick={() => {
                const id = Number(pickId);
                if (!id) return;
                run('add', async () => { await onAddEdificio(id); setPickId(null); });
              }}
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-wash-action px-3.5 text-[12.5px] font-semibold text-white transition hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busyKind === 'add' ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              {busyKind === 'add' ? 'Agregando…' : 'Agregar'}
            </button>
          </div>
          <p className="mt-1.5 text-[10.5px] text-wash-text-muted">Solo aparecen edificios que no están en ningún otro circuito.</p>
        </div>
      )}

      {/* Lista de edificios del circuito */}
      <div className="mt-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">Edificios ({edificiosDelCircuito.length})</p>
        {edificiosDelCircuito.length === 0 ? (
          <EmptyState
            compact
            icon={Building2}
            title="Sin edificios en este circuito"
            description="Agregá edificios libres desde el buscador de arriba."
          />
        ) : (
          <ul className="space-y-2">
            {edificiosDelCircuito.map((e) => (
              <li key={e.ID} className="flex items-start gap-3 rounded-xl bg-wash-surface px-3.5 py-2.5 ring-1 ring-wash-border">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wash-surface-2 text-wash-text-muted ring-1 ring-wash-border">
                  <Building2 size={13} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {e.CodigoEdificio && <span className="shrink-0 rounded bg-wash-surface-2 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-wash-text-muted">{e.CodigoEdificio}</span>}
                    <p className="truncate font-display text-[13px] font-bold text-wash-accent">{e.Edificio}</p>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-wash-text-muted">
                    {e.Direccion && <span className="inline-flex items-center gap-1"><MapPin size={10} />{e.Direccion}</span>}
                    {e.Horario && <span className="inline-flex items-center gap-1"><Clock size={10} />{e.Horario}</span>}
                    {e.Encargado && <span className="inline-flex items-center gap-1"><User2 size={10} />{e.Encargado}</span>}
                    {e.NroCelular && <span className="inline-flex items-center gap-1"><Phone size={10} />{e.NroCelular}</span>}
                  </div>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => { setRemovingId(e.ID); run('remove', () => onRemoveEdificio(e.ID)); }}
                    title="Quitar del circuito"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-rose-600 ring-1 ring-rose-500/30 transition hover:bg-rose-500/10 hover:ring-rose-500 disabled:opacity-50"
                  >
                    {removingId === e.ID ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Observaciones */}
      {canEdit && (
        <div className="mt-4">
          <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">
            <MessageSquare size={11} /> Observaciones del circuito
          </label>
          <textarea
            rows={2}
            defaultValue={circuito.Observaciones}
            onChange={(e) => { setObs(e.target.value); setObsDirty(true); }}
            placeholder="Notas del circuito…"
            className="mt-1.5 w-full rounded-lg border border-wash-border bg-wash-surface px-3 py-2 text-sm outline-none focus:border-wash-brand focus:ring-2 focus:ring-wash-brand/15"
          />
          {obsDirty && (
            <button
              type="button"
              disabled={busy}
              onClick={() => run('obs', async () => { await onUpdateObs(obs); setObsDirty(false); })}
              className="mt-1.5 inline-flex items-center rounded-lg bg-wash-action px-3.5 py-1.5 text-[12px] font-semibold text-white hover:bg-wash-action-dark disabled:opacity-50"
            >
              {busyKind === 'obs' && <Loader2 size={13} className="mr-1.5 animate-spin" />}
              {busyKind === 'obs' ? 'Guardando…' : 'Guardar observaciones'}
            </button>
          )}
        </div>
      )}

      <ModalActions>
        <button type="button" onClick={onClose} className="rounded-lg bg-wash-action px-5 py-2.5 font-medium text-white hover:bg-wash-action-dark">
          Cerrar
        </button>
      </ModalActions>
    </Modal>
  );
}

// ═══════════════ Alta de circuito ═══════════════

function AddCircuitoModal({
  open,
  rutas,
  circuitos,
  edificios,
  occupied,
  onClose,
  onCreate,
}: {
  open: boolean;
  rutas: RutaAbm[];
  circuitos: CircuitoAbm[];
  edificios: EdificioAbm[];
  occupied: Set<string>;
  onClose: () => void;
  onCreate: (payload: { nroRuta: number; nroCircuito: number; observaciones?: string; edificioIds: number[] }) => Promise<void>;
}) {
  const [rutaVal, setRutaVal] = useState('');
  const [nroCircuito, setNroCircuito] = useState('');
  const [pickId, setPickId] = useState<string | null>(null);
  const [picked, setPicked] = useState<EdificioAbm[]>([]);
  const [obs, setObs] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => { setRutaVal(''); setNroCircuito(''); setPickId(null); setPicked([]); setObs(''); setError(null); };

  const nro = Number(nroCircuito);
  const dupNro = !!nroCircuito && circuitos.some((c) => c.NroCircuito === nro);
  const invalidNro = !!nroCircuito && (!Number.isInteger(nro) || nro <= 0);

  // Edificios disponibles: no ocupados en otro circuito + no ya elegidos acá.
  const pickedCodes = new Set(picked.map((e) => e.Codigo));
  const options = edificios
    .filter((e) => e.Codigo && !occupied.has(e.Codigo) && !pickedCodes.has(e.Codigo))
    .map((e) => ({ value: String(e.ID), label: e.Edificio, sublabel: e.Codigo ? `${e.Codigo} · ${e.Direccion}` : e.Direccion }));

  const addPicked = () => {
    const e = edificios.find((x) => String(x.ID) === pickId);
    if (!e) return;
    setPicked((arr) => [...arr, e]);
    setPickId(null);
  };

  const ready = !!rutaVal && !!nroCircuito && !dupNro && !invalidNro && picked.length > 0;

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Agregar circuito" width={720}>
      <div className="flex items-start gap-3 rounded-xl bg-wash-brand/[0.06] p-3.5 ring-1 ring-wash-brand/15">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wash-brand/15 text-wash-brand ring-1 ring-wash-brand/25">
          <GitBranch size={14} />
        </span>
        <div>
          <p className="font-display text-[13px] font-bold text-wash-accent">Nuevo circuito</p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-wash-text-muted">Elegí la ruta, el número de circuito y los edificios. Solo aparecen edificios que no están en otro circuito.</p>
        </div>
      </div>

      {error && (
        <div role="alert" className="mt-3 flex items-center gap-2 rounded-r-md border-l-4 border-red-500 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700">
          <AlertTriangle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      <div className="mt-4 grid grid-cols-[1fr_160px] gap-3">
        <div>
          <Label>Ruta</Label>
          <div className="mt-1.5">
            <Select value={rutaVal || undefined} onValueChange={setRutaVal}>
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder="Elegir ruta…" />
              </SelectTrigger>
              <SelectContent>
                {rutas.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs italic text-wash-text-muted">Creá una ruta primero</div>
                ) : (
                  [...rutas].sort((a, b) => a.NroRuta - b.NroRuta).map((r) => (
                    <SelectItem key={r.ID} value={String(r.NroRuta)}>Ruta {r.NroRuta}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Nro de Circuito</Label>
          <input
            type="number"
            min="1"
            value={nroCircuito}
            onChange={(e) => setNroCircuito(e.target.value)}
            placeholder="Ej. 42"
            className="mt-1.5 h-10 w-full rounded-md border border-wash-border bg-wash-surface px-3 text-[13px] font-semibold text-wash-text-strong outline-none focus:border-wash-brand focus:ring-2 focus:ring-wash-brand/15"
          />
        </div>
      </div>
      {dupNro && <p className="mt-1.5 text-[11px] font-medium text-rose-600">Ya existe el circuito {nro}.</p>}
      {invalidNro && <p className="mt-1.5 text-[11px] font-medium text-rose-600">El número tiene que ser un entero positivo.</p>}

      {/* Picker de edificios */}
      <div className="mt-4 rounded-xl border border-wash-border bg-wash-surface-2/40 p-3.5">
        <Label>Edificios del circuito</Label>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <Combobox options={options} value={pickId} onChange={setPickId} placeholder="Elegir edificio libre…" searchPlaceholder="Buscar por nombre, código o dirección…" emptyText="No hay edificios libres" />
          </div>
          <button
            type="button"
            disabled={!pickId}
            onClick={addPicked}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-wash-action px-3.5 text-[12.5px] font-semibold text-white transition hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={15} />
            Agregar
          </button>
        </div>

        <div className="mt-3">
          {picked.length === 0 ? (
            <EmptyState
              compact
              icon={Building2}
              title="Todavía no elegiste edificios"
              description="Un circuito necesita al menos un edificio."
            />
          ) : (
            <ul className="space-y-1.5">
              {picked.map((e, i) => (
                <li key={e.ID} className="flex items-center gap-2 rounded-lg bg-wash-surface px-2.5 py-1.5 text-[12px] ring-1 ring-wash-border">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-wash-surface-2 text-[10px] font-bold text-wash-text-muted tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                  {e.Codigo && <span className="shrink-0 rounded bg-wash-surface-2 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-wash-text-muted">{e.Codigo}</span>}
                  <span className="truncate font-medium text-wash-text-strong">{e.Edificio}</span>
                  <div className="flex-1" />
                  <button type="button" onClick={() => setPicked((arr) => arr.filter((x) => x.ID !== e.ID))} className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-rose-600 hover:bg-rose-500/10" title="Quitar">
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-4">
        <Label>Observaciones (opcional)</Label>
        <textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Notas del circuito…" className="mt-1.5 w-full rounded-lg border border-wash-border bg-wash-surface px-3 py-2 text-sm outline-none focus:border-wash-brand focus:ring-2 focus:ring-wash-brand/15" />
      </div>

      <ModalActions>
        <button type="button" disabled={saving} onClick={() => { reset(); onClose(); }} className="rounded-lg border border-wash-border px-5 py-2.5 font-medium text-wash-text-strong hover:bg-wash-surface-2 disabled:opacity-50">
          Cancelar
        </button>
        <button
          type="button"
          disabled={!ready || saving}
          onClick={async () => {
            setSaving(true);
            setError(null);
            try {
              await onCreate({ nroRuta: Number(rutaVal), nroCircuito: nro, observaciones: obs.trim() || undefined, edificioIds: picked.map((e) => e.ID) });
              reset();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'No se pudo crear el circuito.');
            } finally {
              setSaving(false);
            }
          }}
          className="inline-flex items-center rounded-lg bg-wash-action px-5 py-2.5 font-semibold text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          {saving ? 'Creando…' : 'Crear circuito'}
        </button>
      </ModalActions>
    </Modal>
  );
}

// ═══════════════ shared bits ═══════════════

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

type KpiTone = 'brand' | 'emerald';

function KpiCard({ icon: Icon, label, value, tone }: { icon: typeof GitBranch; label: string; value: number; tone: KpiTone }) {
  const bgGradient: Record<KpiTone, string> = { brand: 'from-wash-brand/[0.07]', emerald: 'from-emerald-500/[0.07]' };
  const iconCls: Record<KpiTone, string> = {
    brand: 'bg-wash-brand/10 text-wash-brand ring-wash-brand/25',
    emerald: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/25',
  };
  const blobCls: Record<KpiTone, string> = { brand: 'bg-wash-brand/15', emerald: 'bg-emerald-500/15' };
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
