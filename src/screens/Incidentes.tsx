import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Eye,
  UserCog,
  Plus,
  ExternalLink,
  AlertTriangle,
  Building2,
  Wrench,
  Calendar,
  UserCircle2,
  ShoppingCart,
  ArrowLeftRight,
  Check,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Modal, ModalActions } from '@/components/Modal';
import { StatusBadge } from '@/components/StatusBadge';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { ErrorState } from '@/components/ErrorState';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PopoverClose } from '@/components/ui/popover';
import { useAppStore } from '@/store/useAppStore';
import { cn, proper } from '@/lib/utils';
import type { Incidente } from '@/types/domain';

const requiereRepuesto = (i: Incidente) => /repuesto/i.test(i.NoResuelto_IN);
const esCambioMaquina = (i: Incidente) => /cambio/i.test(i.NoResuelto_IN);
const segmentoDe = (concat?: string) => (concat ? concat.split(' - ')[0].trim() : '');

const tipoTone: Record<string, string> = {
  'Requiere Repuesto': 'bg-amber-50 text-amber-800 ring-amber-300/70',
  'Cambio de Maquina': 'bg-violet-50 text-violet-800 ring-violet-300/70',
  'Atencion al Cliente': 'bg-sky-50 text-sky-800 ring-sky-300/70',
  'Reportado Por Tecnico': 'bg-sky-50 text-sky-800 ring-sky-300/70',
};
const toneFor = (t: string) =>
  tipoTone[t] ??
  (/repuesto/i.test(t)
    ? tipoTone['Requiere Repuesto']
    : /cambio/i.test(t)
      ? tipoTone['Cambio de Maquina']
      : 'bg-slate-50 text-slate-700 ring-slate-300/70');

const GRID = '130px 100px 150px minmax(220px,1.6fr) minmax(150px,1fr) 140px 132px';

export function Incidentes() {
  const incidentes = useAppStore((s) => s.CollectIncidentes);
  const repuestos = useAppStore((s) => s.CollectRepuestosIncidente);
  const stock = useAppStore((s) => s.CollectStock);
  const maquinas = useAppStore((s) => s.CollectMaquinas);
  const edificios = useAppStore((s) => s.CollectEdificiosMaquina);
  const tecnicos = useAppStore((s) => s.CollectTecnicosDisponibles);
  const fetchIncidentes = useAppStore((s) => s.fetchIncidentes);
  const fetchStock = useAppStore((s) => s.fetchStock);
  const fetchMaquinas = useAppStore((s) => s.fetchMaquinas);
  const fetchTecnicos = useAppStore((s) => s.fetchTecnicos);
  const createIncidente = useAppStore((s) => s.createIncidente);
  const assignIncidente = useAppStore((s) => s.assignIncidente);
  const cambiarTecnicoIncidente = useAppStore((s) => s.cambiarTecnicoIncidente);
  const cambioMaquinaIncidente = useAppStore((s) => s.cambioMaquinaIncidente);
  const generarCompraIncidente = useAppStore((s) => s.generarCompraIncidente);

  const [query, setQuery] = useState('');
  const [filterTipo, setFilterTipo] = useState('Todos');
  const [filterEstado, setFilterEstado] = useState('Todos');

  const [detail, setDetail] = useState<Incidente | null>(null);
  const [assigning, setAssigning] = useState<Incidente | null>(null);
  const [reassign, setReassign] = useState(false); // true = cambiar técnico (sin descuento)
  const [verRepuestos, setVerRepuestos] = useState<Incidente | null>(null);
  const [comprar, setComprar] = useState<Incidente | null>(null);
  const [cambioMaq, setCambioMaq] = useState<Incidente | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    return Promise.all([fetchIncidentes(), fetchStock(), fetchMaquinas(), fetchTecnicos()])
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'No se pudieron cargar los incidentes.'))
      .finally(() => setLoading(false));
  }, [fetchIncidentes, fetchStock, fetchMaquinas, fetchTecnicos]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial; "Reintentar" también dispara load().
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar.
  }, []);

  const repuestosDe = useCallback(
    (id: number) => repuestos.filter((r) => r.IDIncidente_RI === String(id)),
    [repuestos]
  );

  const hasStock = useCallback(
    (i: Incidente): boolean => {
      const reps = repuestosDe(i.ID);
      if (reps.length === 0) return true;
      return reps.every((r) => {
        const s = stock.find((st) => st.Status_ST === 'Activo' && st.Item_ST.trim().toLowerCase() === r.Repuesto_RI.trim().toLowerCase());
        return !!s && s.Cantidad_ST >= r.Cantidad_RI;
      });
    },
    [repuestosDe, stock]
  );

  const tipos = useMemo(() => ['Todos', ...new Set(incidentes.map((i) => i.NoResuelto_IN).filter(Boolean))], [incidentes]);
  const estados = useMemo(() => ['Todos', ...new Set(incidentes.map((i) => i.Status_IN).filter(Boolean))], [incidentes]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return incidentes
      .filter((i) => (filterTipo === 'Todos' ? true : i.NoResuelto_IN === filterTipo))
      .filter((i) => (filterEstado === 'Todos' ? true : i.Status_IN === filterEstado))
      .filter(
        (i) =>
          i.NombreEdificio_IN.toLowerCase().includes(q) ||
          (i.ConcatMaquina_IN ?? '').toLowerCase().includes(q) ||
          i.NoResuelto_IN.toLowerCase().includes(q) ||
          (i.TecnicoAsignado_IN ?? '').toLowerCase().includes(q) ||
          String(i.ID).includes(q)
      );
  }, [incidentes, query, filterTipo, filterEstado]);

  const abrirAsignar = (i: Incidente, esReasignar: boolean) => {
    setReassign(esReasignar);
    setAssigning(i);
  };

  return (
    <div className="relative flex h-full w-full flex-col">
      <PageHeader
        title="Incidentes"
        subtitle="Reportes sin resolver — repuestos y cambios de máquina"
        search={{ value: query, onChange: setQuery, placeholder: 'Edificio, máquina, tipo, técnico…' }}
        filterPopover={
          <FilterContent
            tipo={filterTipo}
            estado={filterEstado}
            tipos={tipos}
            estados={estados}
            onApply={(t, e) => {
              setFilterTipo(t);
              setFilterEstado(e);
            }}
          />
        }
        onAdd={() => setNewOpen(true)}
        addLabel="Nuevo incidente"
      />
      <LoadingOverlay visible={loading} label="Cargando incidentes…" />

      {loadError ? (
        <ErrorState message={loadError} onRetry={load} />
      ) : (
        <>
          {(filterTipo !== 'Todos' || filterEstado !== 'Todos') && (
            <div className="flex items-center gap-2 border-b border-wash-border bg-wash-surface-2/40 px-6 py-2 text-xs text-wash-text-muted">
              <span className="font-semibold uppercase tracking-wider">Filtros:</span>
              {filterTipo !== 'Todos' && <Chip>{filterTipo}</Chip>}
              {filterEstado !== 'Todos' && <Chip>{filterEstado}</Chip>}
              <button
                type="button"
                onClick={() => {
                  setFilterTipo('Todos');
                  setFilterEstado('Todos');
                }}
                className="ml-auto hover:text-wash-text-strong"
              >
                Limpiar
              </button>
            </div>
          )}

          <div className="flex-1 overflow-hidden p-6">
            <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-wash-surface shadow-sm ring-1 ring-wash-border">
              <div
                className="grid shrink-0 border-b border-wash-border bg-wash-canvas px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-wash-text-muted"
                style={{ gridTemplateColumns: GRID }}
              >
                <div>Estado</div>
                <div>Fecha</div>
                <div>Tipo</div>
                <div>Máquina / Edificio</div>
                <div>Técnico</div>
                <div>Repuestos</div>
                <div className="text-right">Acciones</div>
              </div>

              <div className="flex-1 overflow-auto">
                {filtered.length === 0 ? (
                  <div className="flex h-[280px] items-center justify-center text-sm text-wash-text-muted">
                    No hay incidentes pendientes.
                  </div>
                ) : (
                  filtered.map((i) => {
                    const reps = repuestosDe(i.ID);
                    const sinStock = requiereRepuesto(i) && reps.length > 0 && !hasStock(i);
                    const asignado = !!i.TecnicoAsignado_IN && i.Status_IN === 'Asignado';
                    const enAprobacion = i.Status_IN === 'En Aprobacion';
                    return (
                      <div
                        key={i.ID}
                        className="grid items-center border-b border-wash-divider/60 px-5 py-3 text-sm hover:bg-wash-canvas"
                        style={{ gridTemplateColumns: GRID }}
                      >
                        <div>
                          <StatusBadge status={i.Status_IN} />
                        </div>
                        <div className="inline-flex items-center gap-1.5 pr-2 text-[12.5px] text-wash-text">
                          <Calendar size={11} className="shrink-0 text-wash-text-faint" />
                          {i.Fecha_IN}
                        </div>
                        <div className="pr-2">
                          <span className={cn('inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1', toneFor(i.NoResuelto_IN))}>
                            <Wrench size={9} />
                            <span className="truncate">{i.NoResuelto_IN || '—'}</span>
                          </span>
                        </div>
                        <div className="min-w-0 pr-2">
                          <p className="truncate text-[13px] font-semibold text-wash-text-strong" title={i.ConcatMaquina_IN ? proper(i.ConcatMaquina_IN) : ''}>
                            {i.ConcatMaquina_IN ? proper(i.ConcatMaquina_IN) : <span className="italic text-wash-text-muted">Sin máquina</span>}
                          </p>
                          <p className="flex items-center gap-1 truncate text-[11px] text-wash-text-muted">
                            <Building2 size={10} className="shrink-0" />
                            {i.NombreEdificio_IN}
                            {i.IDMaquina_IN && <span className="ml-1 rounded bg-wash-surface-2 px-1 font-mono text-[9.5px]">#{i.IDMaquina_IN}</span>}
                          </p>
                        </div>
                        <div className="min-w-0 pr-2">
                          {i.TecnicoAsignado_IN ? (
                            <span className="truncate text-[12.5px] text-wash-text-strong">{i.TecnicoAsignado_IN}</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-amber-700">
                              <UserCircle2 size={12} /> Sin asignar
                            </span>
                          )}
                        </div>
                        <div className="pr-2">
                          {i.CantidadRepuestos_IN > 0 || reps.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => setVerRepuestos(i)}
                              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-wash-brand hover:text-wash-brand-dark"
                            >
                              <span className="underline-offset-2 hover:underline">Ver ({reps.length || i.CantidadRepuestos_IN})</span>
                              <ExternalLink size={10} className="opacity-70" />
                            </button>
                          ) : (
                            <span className="text-[12px] text-wash-text-muted">—</span>
                          )}
                        </div>
                        <div className="flex items-center justify-end gap-1.5">
                          <IconBtn icon={Eye} tone="neutral" title="Ver detalle" onClick={() => setDetail(i)} />
                          {enAprobacion ? (
                            <IconBtn icon={AlertCircle} tone="violet" title="En aprobación de cambio de máquina" onClick={() => setDetail(i)} />
                          ) : sinStock ? (
                            <IconBtn icon={ShoppingCart} tone="warning" title="Sin stock — Generar compra" onClick={() => setComprar(i)} />
                          ) : esCambioMaquina(i) ? (
                            <IconBtn icon={ArrowLeftRight} tone="violet" title="Gestionar cambio de máquina" onClick={() => setCambioMaq(i)} />
                          ) : asignado ? (
                            <IconBtn icon={RefreshCw} tone="brand" title="Cambiar técnico" onClick={() => abrirAsignar(i, true)} />
                          ) : (
                            <IconBtn icon={UserCog} tone="brand" title="Asignar técnico" onClick={() => abrirAsignar(i, false)} />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Detalle */}
      <DetailModal incidente={detail} onClose={() => setDetail(null)} />

      {/* Asignar / cambiar técnico */}
      <AsignarModal
        incidente={assigning}
        reassign={reassign}
        tecnicos={tecnicos}
        tieneRepuestos={assigning ? repuestosDe(assigning.ID).length > 0 : false}
        onClose={() => setAssigning(null)}
        onConfirm={async (tecnico) => {
          if (!assigning) return;
          if (reassign) await cambiarTecnicoIncidente(assigning.ID, tecnico);
          else await assignIncidente(assigning.ID, tecnico);
          setAssigning(null);
        }}
      />

      {/* Ver repuestos */}
      <VerRepuestosModal
        incidente={verRepuestos}
        repuestos={verRepuestos ? repuestosDe(verRepuestos.ID) : []}
        stock={stock}
        onClose={() => setVerRepuestos(null)}
      />

      {/* Generar compra (repuesto) */}
      <ComprarRepuestoModal
        incidente={comprar}
        faltantes={comprar ? repuestosDe(comprar.ID).filter((r) => {
          const s = stock.find((st) => st.Status_ST === 'Activo' && st.Item_ST.trim().toLowerCase() === r.Repuesto_RI.trim().toLowerCase());
          return !s || s.Cantidad_ST < r.Cantidad_RI;
        }) : []}
        onClose={() => setComprar(null)}
        onConfirm={async (items) => {
          if (!comprar) return;
          for (const it of items) await generarCompraIncidente(comprar.ID, { tipoCompra: 'repuesto', item: it, segmento: 'Repuesto' });
          setComprar(null);
        }}
      />

      {/* Cambio de máquina */}
      <CambioMaquinaModal
        incidente={cambioMaq}
        maquinas={maquinas}
        onClose={() => setCambioMaq(null)}
        onAprobacion={async (m) => {
          if (!cambioMaq) return;
          await cambioMaquinaIncidente(cambioMaq.ID, m.concat, m.id);
          setCambioMaq(null);
        }}
        onComprar={async (segmento) => {
          if (!cambioMaq) return;
          const item = cambioMaq.ConcatMaquina_IN || segmento;
          await generarCompraIncidente(cambioMaq.ID, { tipoCompra: 'maquina', item, segmento });
          setCambioMaq(null);
        }}
      />

      {/* Nuevo incidente */}
      <NuevoIncidenteModal
        open={newOpen}
        edificios={edificios}
        maquinas={maquinas}
        tecnicos={tecnicos}
        onClose={() => setNewOpen(false)}
        onCreate={createIncidente}
      />
    </div>
  );
}

// ===== Modals =====

function AsignarModal({
  incidente,
  reassign,
  tecnicos,
  tieneRepuestos,
  onClose,
  onConfirm,
}: {
  incidente: Incidente | null;
  reassign: boolean;
  tecnicos: { ID: number; Nombre_Tecnico: string }[];
  tieneRepuestos: boolean;
  onClose: () => void;
  onConfirm: (tecnico: string) => Promise<void>;
}) {
  const [tecnico, setTecnico] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!incidente) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicia al abrir.
    setTecnico(reassign ? incidente.TecnicoAsignado_IN ?? '' : '');
    setError(null);
  }, [incidente, reassign]);

  if (!incidente) return null;
  return (
    <Modal open={!!incidente} onClose={onClose} title={reassign ? 'Cambiar técnico' : 'Asignar técnico'} width={520}>
      {error && (
        <div role="alert" className="mb-3 flex items-center gap-2 rounded-r-md border-l-4 border-red-500 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700">
          <AlertCircle size={14} className="shrink-0" /> {error}
        </div>
      )}
      <MaquinaHeader incidente={incidente} icon={UserCog} />
      <div className="mt-5">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">Técnico</label>
        <div className="mt-2">
          <Select value={tecnico || undefined} onValueChange={setTecnico}>
            <SelectTrigger className="h-10 w-full">
              <SelectValue placeholder="Elegir técnico…" />
            </SelectTrigger>
            <SelectContent>
              {tecnicos.map((t) => (
                <SelectItem key={t.ID} value={t.Nombre_Tecnico}>
                  {t.Nombre_Tecnico}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {!reassign && tieneRepuestos && (
          <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-[11.5px] text-amber-800 ring-1 ring-amber-200">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            Al asignar se descuentan del stock los repuestos solicitados.
          </p>
        )}
      </div>
      <ModalActions>
        <button type="button" onClick={onClose} className="rounded-lg border border-wash-border px-5 py-2.5 font-medium text-wash-text-strong hover:bg-wash-surface-2">
          Cancelar
        </button>
        <button
          type="button"
          disabled={!tecnico || saving}
          onClick={async () => {
            setSaving(true);
            setError(null);
            try {
              await onConfirm(tecnico);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'No se pudo asignar.');
            } finally {
              setSaving(false);
            }
          }}
          className="flex items-center gap-2 rounded-lg bg-wash-action px-5 py-2.5 font-semibold text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          <UserCog size={15} /> {saving ? 'Guardando…' : reassign ? 'Cambiar' : 'Asignar'}
        </button>
      </ModalActions>
    </Modal>
  );
}

function CambioMaquinaModal({
  incidente,
  maquinas,
  onClose,
  onAprobacion,
  onComprar,
}: {
  incidente: Incidente | null;
  maquinas: { ID: number; Segmento_DM: string; Status_DM: string; ConcatMaquina_DM: string; ConcatMaquinaIncidente_DM: string; Edificio_DM: string; IDMaquina_DM: string }[];
  onClose: () => void;
  onAprobacion: (m: { concat: string; id: string }) => Promise<void>;
  onComprar: (segmento: string) => Promise<void>;
}) {
  const [sel, setSel] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const segmento = segmentoDe(incidente?.ConcatMaquina_IN);
  const disponibles = useMemo(
    () =>
      incidente
        ? maquinas.filter((m) => m.Status_DM === 'DEPOSITO' && m.Segmento_DM.trim().toLowerCase() === segmento.trim().toLowerCase())
        : [],
    [incidente, maquinas, segmento]
  );

  useEffect(() => {
    if (!incidente) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicia al abrir.
    setSel('');
    setError(null);
  }, [incidente]);

  if (!incidente) return null;
  const selMaq = disponibles.find((m) => String(m.ID) === sel);

  return (
    <Modal open={!!incidente} onClose={onClose} title="Cambio de máquina" width={560}>
      {error && (
        <div role="alert" className="mb-3 flex items-center gap-2 rounded-r-md border-l-4 border-red-500 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700">
          <AlertCircle size={14} className="shrink-0" /> {error}
        </div>
      )}
      <MaquinaHeader incidente={incidente} icon={ArrowLeftRight} />

      {disponibles.length > 0 ? (
        <div className="mt-5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">
            Máquina de reemplazo en depósito ({segmento})
          </label>
          <div className="mt-2">
            <Select value={sel || undefined} onValueChange={setSel}>
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder="Elegir máquina disponible…" />
              </SelectTrigger>
              <SelectContent>
                {disponibles.map((m) => (
                  <SelectItem key={m.ID} value={String(m.ID)}>
                    {m.IDMaquina_DM} — {proper(m.ConcatMaquina_DM)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-violet-50 px-3 py-2 text-[11.5px] text-violet-900 ring-1 ring-violet-200">
            <AlertCircle size={13} className="mt-0.5 shrink-0" />
            Se genera una aprobación de cambio de máquina. Una vez aprobada, el incidente queda listo para asignar.
          </p>
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-wash-border bg-amber-50/40 px-4 py-5 text-center">
          <AlertTriangle size={24} className="mx-auto mb-2 text-amber-500" />
          <p className="text-sm font-semibold text-wash-text-strong">Sin máquinas disponibles en depósito</p>
          <p className="mt-1 text-xs text-wash-text-muted">
            No hay {segmento || 'máquinas'} en depósito. Podés generar una compra.
          </p>
        </div>
      )}

      <ModalActions>
        <button type="button" onClick={onClose} className="rounded-lg border border-wash-border px-5 py-2.5 font-medium text-wash-text-strong hover:bg-wash-surface-2">
          Cancelar
        </button>
        {disponibles.length > 0 ? (
          <button
            type="button"
            disabled={!selMaq || saving}
            onClick={async () => {
              if (!selMaq) return;
              setSaving(true);
              setError(null);
              try {
                await onAprobacion({ concat: selMaq.ConcatMaquinaIncidente_DM, id: selMaq.IDMaquina_DM });
              } catch (err) {
                setError(err instanceof Error ? err.message : 'No se pudo generar la aprobación.');
              } finally {
                setSaving(false);
              }
            }}
            className="rounded-lg bg-wash-action px-5 py-2.5 font-semibold text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Generando…' : 'Generar aprobación'}
          </button>
        ) : (
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              setError(null);
              try {
                await onComprar(segmento || 'Repuesto');
              } catch (err) {
                setError(err instanceof Error ? err.message : 'No se pudo generar la compra.');
              } finally {
                setSaving(false);
              }
            }}
            className="flex items-center gap-2 rounded-lg bg-wash-action px-5 py-2.5 font-semibold text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ShoppingCart size={15} /> {saving ? 'Generando…' : 'Generar compra'}
          </button>
        )}
      </ModalActions>
    </Modal>
  );
}

function ComprarRepuestoModal({
  incidente,
  faltantes,
  onClose,
  onConfirm,
}: {
  incidente: Incidente | null;
  faltantes: { ID: number; Repuesto_RI: string; Cantidad_RI: number }[];
  onClose: () => void;
  onConfirm: (items: string[]) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!incidente) return null;
  return (
    <Modal open={!!incidente} onClose={onClose} title="Generar compra de repuestos" width={480}>
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100">
          <AlertTriangle size={24} className="text-amber-600" />
        </span>
        <div className="flex-1">
          <h3 className="font-display text-lg font-black text-wash-text-strong">Sin stock suficiente</h3>
          <p className="mt-1 text-sm text-wash-text-muted">Se generará una compra (ya aprobada) por cada repuesto faltante.</p>
        </div>
      </div>
      {error && (
        <div role="alert" className="mt-3 flex items-center gap-2 rounded-r-md border-l-4 border-red-500 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700">
          <AlertCircle size={14} className="shrink-0" /> {error}
        </div>
      )}
      <div className="mt-3 rounded-lg bg-wash-surface-2/60 p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-wash-text-muted">Repuestos faltantes</p>
        <ul className="mt-1 space-y-1 text-sm">
          {faltantes.map((r) => (
            <li key={r.ID} className="flex items-center justify-between rounded-md bg-wash-surface px-3 py-1.5">
              <span className="min-w-0 truncate text-wash-text-strong">{r.Repuesto_RI}</span>
              <span className="ml-2 shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-700">{r.Cantidad_RI} ud</span>
            </li>
          ))}
        </ul>
      </div>
      <ModalActions>
        <button type="button" onClick={onClose} className="rounded-lg border border-wash-border px-5 py-2 font-medium text-wash-text-strong hover:bg-wash-surface-2">
          Cancelar
        </button>
        <button
          type="button"
          disabled={saving || faltantes.length === 0}
          onClick={async () => {
            setSaving(true);
            setError(null);
            try {
              await onConfirm(faltantes.map((r) => r.Repuesto_RI));
            } catch (err) {
              setError(err instanceof Error ? err.message : 'No se pudo generar la compra.');
            } finally {
              setSaving(false);
            }
          }}
          className="flex items-center gap-2 rounded-lg bg-wash-action px-5 py-2 font-medium text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ShoppingCart size={15} /> {saving ? 'Generando…' : 'Generar compra'}
        </button>
      </ModalActions>
    </Modal>
  );
}

function VerRepuestosModal({
  incidente,
  repuestos,
  stock,
  onClose,
}: {
  incidente: Incidente | null;
  repuestos: { ID: number; Repuesto_RI: string; Cantidad_RI: number }[];
  stock: { Item_ST: string; Cantidad_ST: number; Status_ST: string }[];
  onClose: () => void;
}) {
  if (!incidente) return null;
  return (
    <Modal open={!!incidente} onClose={onClose} title="Repuestos del incidente" width={560}>
      <MaquinaHeader incidente={incidente} icon={Wrench} />
      <div className="mt-5">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">Repuestos solicitados</p>
        {repuestos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-wash-border py-8 text-center">
            <Wrench size={26} className="mx-auto mb-2 text-wash-text-faint" strokeWidth={1.5} />
            <p className="text-sm font-semibold text-wash-text-strong">Sin repuestos cargados</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {repuestos.map((r) => {
              const s = stock.find((st) => st.Status_ST === 'Activo' && st.Item_ST.trim().toLowerCase() === r.Repuesto_RI.trim().toLowerCase());
              const ok = !!s && s.Cantidad_ST >= r.Cantidad_RI;
              return (
                <li key={r.ID} className="flex items-center gap-3 rounded-xl bg-wash-surface px-4 py-3 ring-1 ring-wash-border">
                  <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', ok ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600')}>
                    {ok ? <Check size={15} /> : <AlertTriangle size={14} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-wash-text-strong">{r.Repuesto_RI}</p>
                    <p className="text-[11px] text-wash-text-muted">
                      Stock: {s?.Cantidad_ST ?? 0} · {ok ? 'suficiente' : 'insuficiente'}
                    </p>
                  </div>
                  <span className="flex h-7 min-w-[36px] items-center justify-center rounded-md bg-wash-action/10 px-2 text-sm font-bold text-wash-action ring-1 ring-wash-action/20">
                    {r.Cantidad_RI}
                  </span>
                </li>
              );
            })}
          </ul>
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

function DetailModal({ incidente, onClose }: { incidente: Incidente | null; onClose: () => void }) {
  if (!incidente) return null;
  return (
    <Modal open={!!incidente} onClose={onClose} title="Detalle del incidente" width={580}>
      <MaquinaHeader incidente={incidente} icon={Wrench} showStatus />
      <div className="mt-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">Observación</p>
        <div className="relative overflow-hidden rounded-xl border border-wash-border bg-wash-surface px-5 py-4">
          <span className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-wash-brand-light to-wash-brand-dark" />
          <p className="text-sm leading-relaxed text-wash-text-strong">
            {incidente.DescripcionIncidente_IN || incidente.DescripcionCarga_IN || (
              <span className="italic text-wash-text-muted">Sin observación registrada.</span>
            )}
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Meta label="Fecha" value={incidente.Fecha_IN} />
        <Meta label="Tipo" value={incidente.NoResuelto_IN} />
        <Meta label="Técnico" value={incidente.TecnicoAsignado_IN || <span className="text-amber-700">Sin asignar</span>} />
        {incidente.MaquinaAsignada_IN && <Meta label="Máquina asignada" value={proper(incidente.MaquinaAsignada_IN)} />}
        {incidente.FechaAsignada_IN && <Meta label="Asignada" value={incidente.FechaAsignada_IN} />}
        <Meta label="Repuestos" value={String(incidente.CantidadRepuestos_IN)} />
      </div>
      <ModalActions>
        <button type="button" onClick={onClose} className="rounded-lg bg-wash-action px-5 py-2.5 font-medium text-white hover:bg-wash-action-dark">
          Cerrar
        </button>
      </ModalActions>
    </Modal>
  );
}

function NuevoIncidenteModal({
  open,
  edificios,
  maquinas,
  tecnicos,
  onClose,
  onCreate,
}: {
  open: boolean;
  edificios: { edificio: string; codigo: string }[];
  maquinas: { ID: number; ConcatMaquinaIncidente_DM: string; IDMaquina_DM: string; Edificio_DM: string; Status_DM: string }[];
  tecnicos: { ID: number; Nombre_Tecnico: string; Telefono?: string }[];
  onClose: () => void;
  onCreate: (payload: {
    edificio: string;
    codigoEdificio?: string;
    maquinaConcat?: string;
    idMaquina?: string;
    descripcion: string;
    tecnico?: string;
  }) => Promise<Incidente>;
}) {
  const [edificio, setEdificio] = useState('');
  const [maqId, setMaqId] = useState('');
  const [desc, setDesc] = useState('');
  const [tecnico, setTecnico] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicia al abrir.
    setEdificio('');
    setMaqId('');
    setDesc('');
    setTecnico('');
    setError(null);
  }, [open]);

  const maqsDelEdificio = useMemo(
    () => maquinas.filter((m) => m.Status_DM !== 'ELIMINADA' && (!edificio || m.Edificio_DM === edificio)),
    [maquinas, edificio]
  );
  const codigo = edificios.find((e) => e.edificio === edificio)?.codigo;

  return (
    <Modal open={open} onClose={onClose} title="Nuevo incidente" width={600}>
      <p className="text-sm text-wash-text-muted">Cargá el reporte. Al crear, se abre WhatsApp para avisar al técnico (si elegiste uno).</p>
      {error && (
        <div role="alert" className="mt-3 flex items-center gap-2 rounded-r-md border-l-4 border-red-500 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700">
          <AlertCircle size={14} className="shrink-0" /> {error}
        </div>
      )}
      <div className="mt-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Lbl req>Edificio</Lbl>
            <div className="mt-1.5">
              <Select value={edificio || undefined} onValueChange={(v) => { setEdificio(v); setMaqId(''); }}>
                <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Elegir edificio…" /></SelectTrigger>
                <SelectContent>
                  {edificios.map((e) => (
                    <SelectItem key={e.edificio} value={e.edificio}>{e.edificio}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Lbl>Máquina</Lbl>
            <div className="mt-1.5">
              <Select value={maqId || undefined} onValueChange={setMaqId} disabled={!edificio}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder={edificio ? 'Sin asignar' : 'Elegí edificio primero'} />
                </SelectTrigger>
                <SelectContent>
                  {maqsDelEdificio.map((m) => (
                    <SelectItem key={m.ID} value={String(m.ID)}>{m.IDMaquina_DM} — {proper(m.ConcatMaquinaIncidente_DM)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div>
          <Lbl>Asignar a técnico</Lbl>
          <div className="mt-1.5">
            <Select value={tecnico || undefined} onValueChange={setTecnico}>
              <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Dejar sin asignar" /></SelectTrigger>
              <SelectContent>
                {tecnicos.map((t) => (
                  <SelectItem key={t.ID} value={t.Nombre_Tecnico}>{t.Nombre_Tecnico}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Lbl req>¿Qué pasó?</Lbl>
          <textarea
            rows={4}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Detallá el problema…"
            className="mt-1.5 w-full rounded-lg border border-wash-border bg-wash-surface px-3 py-2 text-sm outline-none focus:border-wash-action focus:ring-2 focus:ring-wash-action/15"
          />
        </div>
      </div>
      <ModalActions>
        <button type="button" onClick={onClose} className="rounded-lg border border-wash-border px-5 py-2.5 font-medium text-wash-text-strong hover:bg-wash-surface-2">
          Cancelar
        </button>
        <button
          type="button"
          disabled={!edificio || !desc.trim() || saving}
          onClick={async () => {
            setSaving(true);
            setError(null);
            try {
              const maq = maqsDelEdificio.find((m) => String(m.ID) === maqId);
              const created = await onCreate({
                edificio,
                codigoEdificio: codigo,
                maquinaConcat: maq?.ConcatMaquinaIncidente_DM,
                idMaquina: maq?.IDMaquina_DM,
                descripcion: desc.trim(),
                tecnico: tecnico || undefined,
              });
              // WhatsApp deep-link al técnico (si hay).
              const tel = tecnicos.find((t) => t.Nombre_Tecnico === tecnico)?.Telefono;
              if (tecnico) {
                const msg = `INCIDENTE N: ${created.ID}\nEDIFICIO: ${edificio}${maq ? `\nMAQUINA: ${maq.ConcatMaquinaIncidente_DM}` : ''}\nOBSERVACIONES: ${desc.trim()}`;
                const url = `https://wa.me/${tel ? '54' + tel.replace(/\D/g, '') : ''}?text=${encodeURIComponent(msg)}`;
                window.open(url, '_blank');
              }
              onClose();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'No se pudo crear el incidente.');
            } finally {
              setSaving(false);
            }
          }}
          className="flex items-center gap-2 rounded-lg bg-wash-action px-5 py-2.5 font-semibold text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={15} /> {saving ? 'Creando…' : 'Crear incidente'}
        </button>
      </ModalActions>
    </Modal>
  );
}

// ===== small bits =====

function MaquinaHeader({ incidente, icon: Icon, showStatus }: { incidente: Incidente; icon: typeof Wrench; showStatus?: boolean }) {
  return (
    <div className="rounded-xl bg-wash-surface-2/50 p-4 ring-1 ring-wash-border">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-wash-brand/10 text-wash-brand ring-1 ring-wash-brand/20">
          <Icon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          {incidente.ConcatMaquina_IN ? (
            <p className="truncate font-display text-[15px] font-black text-wash-accent">{proper(incidente.ConcatMaquina_IN)}</p>
          ) : (
            <p className="font-display text-[15px] italic text-wash-text-muted">Máquina no asignada</p>
          )}
          <div className="mt-1 flex items-center gap-2 text-xs text-wash-text-muted">
            <Building2 size={11} />
            <span className="truncate">{incidente.NombreEdificio_IN}</span>
            {incidente.IDMaquina_IN && <span className="rounded-md bg-wash-surface px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-wash-text">#{incidente.IDMaquina_IN}</span>}
          </div>
        </div>
        {showStatus && <StatusBadge status={incidente.Status_IN} />}
      </div>
    </div>
  );
}

function IconBtn({ icon: Icon, tone, title, onClick }: { icon: typeof Eye; tone: 'neutral' | 'brand' | 'warning' | 'violet'; title: string; onClick: () => void }) {
  const cls = {
    neutral: 'text-wash-text-muted ring-wash-border hover:bg-wash-surface-2 hover:text-wash-text-strong hover:ring-wash-text-muted/40',
    brand: 'text-wash-brand ring-wash-brand/30 hover:bg-wash-brand/10 hover:ring-wash-brand',
    warning: 'text-amber-600 ring-amber-400/40 hover:bg-amber-50 hover:ring-amber-500',
    violet: 'text-violet-600 ring-violet-500/30 hover:bg-violet-500/10 hover:ring-violet-500',
  }[tone];
  return (
    <button type="button" onClick={onClick} title={title} aria-label={title} className={cn('flex h-8 w-8 items-center justify-center rounded-lg ring-1 transition', cls)}>
      <Icon size={15} />
    </button>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-wash-brand/10 px-2.5 py-0.5 font-semibold text-wash-brand">{children}</span>;
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-wash-surface-2/40 px-3 py-2 ring-1 ring-wash-border">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-wash-text-muted">{label}</div>
      <div className="mt-1 truncate text-[12.5px] font-semibold text-wash-text-strong">{value}</div>
    </div>
  );
}

function Lbl({ children, req }: { children: React.ReactNode; req?: boolean }) {
  return (
    <label className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">
      {children}
      {req && <span className="text-rose-500">*</span>}
    </label>
  );
}

function FilterContent({
  tipo,
  estado,
  tipos,
  estados,
  onApply,
}: {
  tipo: string;
  estado: string;
  tipos: string[];
  estados: string[];
  onApply: (tipo: string, estado: string) => void;
}) {
  const [pt, setPt] = useState(tipo);
  const [pe, setPe] = useState(estado);
  const dirty = pt !== tipo || pe !== estado;
  return (
    <div>
      <div className="mb-3 flex items-center justify-between border-b border-wash-border pb-2.5">
        <h3 className="text-sm font-bold text-wash-text-strong">Filtrar</h3>
        {(pt !== 'Todos' || pe !== 'Todos') && (
          <button type="button" onClick={() => { setPt('Todos'); setPe('Todos'); }} className="text-[11px] font-semibold text-wash-text-muted hover:text-wash-text-strong">
            Limpiar
          </button>
        )}
      </div>
      <div className="space-y-3">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">Tipo</label>
          <div className="mt-1.5">
            <Select value={pt} onValueChange={setPt}>
              <SelectTrigger className="h-9 w-full text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {tipos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">Estado</label>
          <div className="mt-1.5">
            <Select value={pe} onValueChange={setPe}>
              <SelectTrigger className="h-9 w-full text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {estados.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2 border-t border-wash-border pt-3">
        <PopoverClose asChild>
          <button type="button" className="rounded-lg border border-wash-border px-4 py-2 text-[12.5px] font-medium text-wash-text-strong hover:bg-wash-surface-2">Cancelar</button>
        </PopoverClose>
        <PopoverClose asChild>
          <button type="button" disabled={!dirty} onClick={() => onApply(pt, pe)} className="rounded-lg bg-wash-action px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50">
            Aplicar
          </button>
        </PopoverClose>
      </div>
    </div>
  );
}
