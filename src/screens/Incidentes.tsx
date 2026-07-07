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
import { MultiSelect, type MultiOption } from '@/components/ui/multi-select';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PopoverClose } from '@/components/ui/popover';
import { useAppStore } from '@/store/useAppStore';
import { last12MesesOptions, estadoOptions } from '@/lib/filters';
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

// Estados de un incidente SIN resolver (esta pantalla filtra Resuelto_IN='NO'). Se muestran
// SIEMPRE como opciones de filtro aunque los datos cargados solo tengan algunos.
// ('Resuelto'/'Aprobada' son estados ya resueltos → no aparecen en esta vista.)
const ESTADOS_IN = ['A Revisar', 'Pendiente', 'Asignado', 'En Aprobacion'];
// Estados de un incidente YA resuelto (vista "Resueltos · mes").
const ESTADOS_IN_RESUELTOS = ['Resuelto', 'Aprobada', 'Rechazada'];

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
  // Scope de la vista: 'abiertos' (sin resolver) o 'MM/YYYY' (resueltos de ese mes). Vive en el header.
  const [scope, setScope] = useState<string>('abiertos');
  const scopeResueltos = scope !== 'abiertos';
  const [filterMesAno, setFilterMesAno] = useState<string[]>([]);
  const [filterEstado, setFilterEstado] = useState<string[]>([]);
  const [filterEdificio, setFilterEdificio] = useState<string[]>([]);
  const [filterTipo, setFilterTipo] = useState<string[]>([]);

  const [detail, setDetail] = useState<Incidente | null>(null);
  const [assigning, setAssigning] = useState<Incidente | null>(null);
  const [reassign, setReassign] = useState(false); // true = cambiar técnico (sin descuento)
  const [verRepuestos, setVerRepuestos] = useState<Incidente | null>(null);
  const [comprar, setComprar] = useState<Incidente | null>(null);
  const [cambioMaq, setCambioMaq] = useState<Incidente | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback((sc?: string) => {
    setLoading(true);
    setLoadError(null);
    const resueltosMes = sc && sc !== 'abiertos' ? sc : undefined;
    return Promise.all([fetchIncidentes(resueltosMes), fetchStock(), fetchMaquinas(), fetchTecnicos()])
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'No se pudieron cargar los incidentes.'))
      .finally(() => setLoading(false));
  }, [fetchIncidentes, fetchStock, fetchMaquinas, fetchTecnicos]);

  // Cambio de scope (sin resolver ↔ resueltos de un mes): recarga y limpia el filtro de estado
  // (las opciones de estado cambian según el scope).
  const onScopeChange = (v: string) => {
    setScope(v);
    setFilterEstado([]);
    load(v);
  };

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

  const mesAnoOpts = useMemo(() => last12MesesOptions(), []);
  const estadoOpts = useMemo(
    () => {
      const canon = scopeResueltos ? ESTADOS_IN_RESUELTOS : ESTADOS_IN;
      return estadoOptions([...canon, ...incidentes.map((i) => i.Status_IN)], canon);
    },
    [incidentes, scopeResueltos]
  );
  const edificioOpts = useMemo<MultiOption[]>(
    () =>
      [...new Set(incidentes.map((i) => i.NombreEdificio_IN).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'es'))
        .map((e) => ({ value: e, label: e })),
    [incidentes]
  );
  const tipoOpts = useMemo<MultiOption[]>(
    () =>
      [...new Set(incidentes.map((i) => i.NoResuelto_IN).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'es'))
        .map((t) => ({ value: t, label: t })),
    [incidentes]
  );
  const mesAnoLabel = useMemo(() => new Map(mesAnoOpts.map((o) => [o.value, o.label])), [mesAnoOpts]);

  const activeChips = useMemo<{ cat: string; label: string }[]>(() => {
    const chips: { cat: string; label: string }[] = [];
    filterMesAno.forEach((v) => chips.push({ cat: 'Mes', label: mesAnoLabel.get(v) ?? v }));
    filterEstado.forEach((v) => chips.push({ cat: 'Estado', label: v }));
    filterEdificio.forEach((v) => chips.push({ cat: 'Edificio', label: v }));
    filterTipo.forEach((v) => chips.push({ cat: 'Tipo', label: v }));
    return chips;
  }, [filterMesAno, filterEstado, filterEdificio, filterTipo, mesAnoLabel]);

  const hasFilters = activeChips.length > 0;
  const clearFilters = () => {
    setFilterMesAno([]);
    setFilterEstado([]);
    setFilterEdificio([]);
    setFilterTipo([]);
  };

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    const pass = (arr: string[], v: string) => arr.length === 0 || arr.includes(v);
    return incidentes
      .filter((i) => pass(filterMesAno, i.FechaMesAno_IN))
      .filter((i) => pass(filterEstado, i.Status_IN))
      .filter((i) => pass(filterEdificio, i.NombreEdificio_IN))
      .filter((i) => pass(filterTipo, i.NoResuelto_IN))
      .filter(
        (i) =>
          i.NombreEdificio_IN.toLowerCase().includes(q) ||
          (i.ConcatMaquina_IN ?? '').toLowerCase().includes(q) ||
          i.NoResuelto_IN.toLowerCase().includes(q) ||
          (i.TecnicoAsignado_IN ?? '').toLowerCase().includes(q) ||
          String(i.ID).includes(q)
      );
  }, [incidentes, query, filterMesAno, filterEstado, filterEdificio, filterTipo]);

  const abrirAsignar = (i: Incidente, esReasignar: boolean) => {
    setReassign(esReasignar);
    setAssigning(i);
  };

  // Acción contextual de una fila/card según tipo + estado + stock (reusada en tabla y cards).
  const primaryAction = (i: Incidente) => {
    // En la vista de resueltos no hay acciones de mutación (son incidentes cerrados): solo ver detalle.
    if (scopeResueltos) return null;
    const reps = repuestosDe(i.ID);
    const sinStock = requiereRepuesto(i) && reps.length > 0 && !hasStock(i);
    const asignado = !!i.TecnicoAsignado_IN && i.Status_IN === 'Asignado';
    if (i.Status_IN === 'En Aprobacion')
      return <IconBtn icon={AlertCircle} tone="violet" title="En aprobación de cambio de máquina" onClick={() => setDetail(i)} />;
    if (sinStock) return <IconBtn icon={ShoppingCart} tone="warning" title="Sin stock — Generar compra" onClick={() => setComprar(i)} />;
    if (esCambioMaquina(i)) return <IconBtn icon={ArrowLeftRight} tone="violet" title="Gestionar cambio de máquina" onClick={() => setCambioMaq(i)} />;
    if (asignado) return <IconBtn icon={RefreshCw} tone="brand" title="Cambiar técnico" onClick={() => abrirAsignar(i, true)} />;
    return <IconBtn icon={UserCog} tone="brand" title="Asignar técnico" onClick={() => abrirAsignar(i, false)} />;
  };

  return (
    <div className="relative flex h-full w-full flex-col">
      <PageHeader
        title="Incidentes"
        subtitle={scopeResueltos ? `Incidentes resueltos · ${scope}` : 'Reportes sin resolver — repuestos y cambios de máquina'}
        search={{ value: query, onChange: setQuery, placeholder: 'Edificio, máquina, tipo, técnico…' }}
        toolbarExtra={
          <Select value={scope} onValueChange={onScopeChange} disabled={loading}>
            <SelectTrigger className="h-9 w-[150px] shrink-0 bg-wash-canvas text-[13px] ring-wash-border sm:w-[180px]">
              <Calendar size={13} className="shrink-0 text-wash-text-muted" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[320px]">
              <SelectItem value="abiertos">Sin resolver</SelectItem>
              {mesAnoOpts.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  Resueltos · {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        filterPopover={
          <FilterContent
            mesAno={filterMesAno}
            estado={filterEstado}
            edificio={filterEdificio}
            tipo={filterTipo}
            mesAnoOpts={mesAnoOpts}
            estadoOpts={estadoOpts}
            edificioOpts={edificioOpts}
            tipoOpts={tipoOpts}
            onApply={(f) => {
              setFilterMesAno(f.mesAno);
              setFilterEstado(f.estado);
              setFilterEdificio(f.edificio);
              setFilterTipo(f.tipo);
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
          {hasFilters && (
            <div className="flex flex-wrap items-center gap-2 border-b border-wash-border bg-wash-surface-2/40 px-4 py-2 text-xs text-wash-text-muted md:px-6">
              <span className="font-semibold uppercase tracking-wider">Filtros:</span>
              {activeChips.map((c, idx) => (
                <Chip key={`${c.cat}-${c.label}-${idx}`}>
                  <span className="text-wash-brand/70">{c.cat}:</span> {c.label}
                </Chip>
              ))}
              <button type="button" onClick={clearFilters} className="ml-auto hover:text-wash-text-strong">
                Limpiar
              </button>
            </div>
          )}

          <div className="flex-1 overflow-hidden p-3 md:p-6">
            {/* MOBILE (<lg): una card por incidente (DESIGN.md §5.4) */}
            <div className="flex h-full flex-col gap-2 overflow-y-auto lg:hidden">
              {filtered.length === 0 ? (
                <div className="flex h-[200px] items-center justify-center text-sm text-wash-text-muted">
                  No hay incidentes pendientes.
                </div>
              ) : (
                filtered.map((i) => {
                  const reps = repuestosDe(i.ID);
                  return (
                    <div key={i.ID} className="rounded-xl border border-wash-border bg-wash-surface p-3 shadow-sm transition active:scale-[0.99]">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <StatusBadge status={i.Status_IN} />
                          <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-semibold ring-1', toneFor(i.NoResuelto_IN))}>
                            <Wrench size={8} />
                            <span className="truncate">{i.NoResuelto_IN || '—'}</span>
                          </span>
                        </div>
                        <div className="flex shrink-0 gap-1.5">
                          <IconBtn icon={Eye} tone="neutral" title="Ver detalle" onClick={() => setDetail(i)} />
                          {primaryAction(i)}
                        </div>
                      </div>
                      <div className="mt-2 min-w-0">
                        <p className="truncate text-[13.5px] font-semibold text-wash-text-strong">
                          {i.ConcatMaquina_IN ? proper(i.ConcatMaquina_IN) : <span className="italic text-wash-text-muted">Sin máquina</span>}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1 truncate text-[11.5px] text-wash-text-muted">
                          <Building2 size={11} className="shrink-0" />
                          <span className="truncate">{i.NombreEdificio_IN}</span>
                          {i.IDMaquina_IN && <span className="ml-0.5 shrink-0 rounded bg-wash-surface-2 px-1 font-mono text-[9.5px]">#{i.IDMaquina_IN}</span>}
                        </p>
                      </div>
                      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-wash-divider/60 pt-2 text-[11.5px]">
                        <span className="inline-flex shrink-0 items-center gap-1 text-wash-text-muted">
                          <Calendar size={11} />
                          {i.Fecha_IN}
                        </span>
                        {i.TecnicoAsignado_IN ? (
                          <span className="min-w-0 flex-1 truncate text-center font-medium text-wash-text-strong">{i.TecnicoAsignado_IN}</span>
                        ) : (
                          <span className="inline-flex flex-1 items-center justify-center gap-1 font-medium text-amber-700">
                            <UserCircle2 size={12} /> Sin asignar
                          </span>
                        )}
                        {i.CantidadRepuestos_IN > 0 || reps.length > 0 ? (
                          <button type="button" onClick={() => setVerRepuestos(i)} className="inline-flex shrink-0 items-center gap-1 font-semibold text-wash-brand">
                            Rep. ({reps.length || i.CantidadRepuestos_IN})
                            <ExternalLink size={9} />
                          </button>
                        ) : (
                          <span className="shrink-0 text-wash-text-faint">—</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* DESKTOP (≥lg): tabla */}
            <div className="hidden h-full flex-col overflow-hidden rounded-2xl bg-wash-surface shadow-sm ring-1 ring-wash-border lg:flex">
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
                          {primaryAction(i)}
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
  const [tecId, setTecId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tecnicoOpts = useMemo<MultiOption[]>(
    () => tecnicos.map((t) => ({ value: String(t.ID), label: t.Nombre_Tecnico })),
    [tecnicos]
  );

  useEffect(() => {
    if (!incidente) return;
    const actual = reassign
      ? tecnicos.find((t) => t.Nombre_Tecnico === incidente.TecnicoAsignado_IN)
      : undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicia al abrir.
    setTecId(actual ? String(actual.ID) : '');
    setError(null);
  }, [incidente, reassign, tecnicos]);

  if (!incidente) return null;
  const tecnico = tecnicos.find((t) => String(t.ID) === tecId)?.Nombre_Tecnico ?? '';
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
          <Combobox
            options={tecnicoOpts}
            value={tecId || null}
            onChange={setTecId}
            placeholder="Elegir técnico…"
            searchPlaceholder="Buscar técnico…"
            emptyText="Sin técnicos"
          />
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
            <Combobox
              options={disponibles.map((m) => ({
                value: String(m.ID),
                label: `${m.IDMaquina_DM} — ${proper(m.ConcatMaquina_DM)}`,
              }))}
              value={sel || null}
              onChange={setSel}
              placeholder="Elegir máquina disponible…"
              searchPlaceholder="Buscar máquina…"
              emptyText="Sin máquinas"
            />
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
  const [tecId, setTecId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicia al abrir.
    setEdificio('');
    setMaqId('');
    setDesc('');
    setTecId('');
    setError(null);
  }, [open]);

  const edificioOpts = useMemo<ComboboxOption[]>(
    () => edificios.map((e) => ({ value: e.edificio, label: e.edificio, sublabel: e.codigo })),
    [edificios]
  );
  const maqsDelEdificio = useMemo(
    () => maquinas.filter((m) => m.Status_DM !== 'ELIMINADA' && (!edificio || m.Edificio_DM === edificio)),
    [maquinas, edificio]
  );
  const maquinaOpts = useMemo<ComboboxOption[]>(
    () => maqsDelEdificio.map((m) => ({ value: String(m.ID), label: `${m.IDMaquina_DM} — ${proper(m.ConcatMaquinaIncidente_DM)}` })),
    [maqsDelEdificio]
  );
  const tecnicoOpts = useMemo<ComboboxOption[]>(
    () => tecnicos.map((t) => ({ value: String(t.ID), label: t.Nombre_Tecnico })),
    [tecnicos]
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
              <Combobox
                options={edificioOpts}
                value={edificio || null}
                onChange={(v) => { setEdificio(v); setMaqId(''); }}
                placeholder="Elegir edificio…"
                searchPlaceholder="Buscar edificio o código…"
                emptyText="Sin edificios"
              />
            </div>
          </div>
          <div>
            <Lbl>Máquina</Lbl>
            <div className="mt-1.5">
              <Combobox
                options={maquinaOpts}
                value={maqId || null}
                onChange={setMaqId}
                disabled={!edificio}
                placeholder={edificio ? 'Sin asignar' : 'Elegí edificio primero'}
                searchPlaceholder="Buscar máquina…"
                emptyText="Sin máquinas"
              />
            </div>
          </div>
        </div>
        <div>
          <Lbl>Asignar a técnico</Lbl>
          <div className="mt-1.5">
            <Combobox
              options={tecnicoOpts}
              value={tecId || null}
              onChange={setTecId}
              placeholder="Dejar sin asignar"
              searchPlaceholder="Buscar técnico…"
              emptyText="Sin técnicos"
            />
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
              const tec = tecnicos.find((t) => String(t.ID) === tecId);
              const tecnico = tec?.Nombre_Tecnico;
              const created = await onCreate({
                edificio,
                codigoEdificio: codigo,
                maquinaConcat: maq?.ConcatMaquinaIncidente_DM,
                idMaquina: maq?.IDMaquina_DM,
                descripcion: desc.trim(),
                tecnico: tecnico || undefined,
              });
              // WhatsApp deep-link al técnico (si hay).
              const tel = tec?.Telefono;
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

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((v) => b.includes(v));

function FilterContent({
  mesAno,
  estado,
  edificio,
  tipo,
  mesAnoOpts,
  estadoOpts,
  edificioOpts,
  tipoOpts,
  onApply,
}: {
  mesAno: string[];
  estado: string[];
  edificio: string[];
  tipo: string[];
  mesAnoOpts: MultiOption[];
  estadoOpts: MultiOption[];
  edificioOpts: MultiOption[];
  tipoOpts: MultiOption[];
  onApply: (f: { mesAno: string[]; estado: string[]; edificio: string[]; tipo: string[] }) => void;
}) {
  const [pMesAno, setPMesAno] = useState<string[]>(mesAno);
  const [pEstado, setPEstado] = useState<string[]>(estado);
  const [pEdificio, setPEdificio] = useState<string[]>(edificio);
  const [pTipo, setPTipo] = useState<string[]>(tipo);

  const toggle = (set: React.Dispatch<React.SetStateAction<string[]>>) => (v: string) =>
    set((arr) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]));

  const total = pMesAno.length + pEstado.length + pEdificio.length + pTipo.length;
  const dirty =
    !sameSet(pMesAno, mesAno) ||
    !sameSet(pEstado, estado) ||
    !sameSet(pEdificio, edificio) ||
    !sameSet(pTipo, tipo);

  const limpiar = () => {
    setPMesAno([]);
    setPEstado([]);
    setPEdificio([]);
    setPTipo([]);
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between border-b border-wash-border pb-2.5">
        <h3 className="text-sm font-bold text-wash-text-strong">Filtrar</h3>
        {total > 0 && (
          <button type="button" onClick={limpiar} className="text-[11px] font-semibold text-wash-text-muted hover:text-wash-text-strong">
            Limpiar todo
          </button>
        )}
      </div>
      <div className="space-y-3">
        <MultiSelect label="Mes / Año" options={mesAnoOpts} selected={pMesAno} onToggle={toggle(setPMesAno)} onClear={() => setPMesAno([])} />
        <MultiSelect label="Estado" options={estadoOpts} selected={pEstado} onToggle={toggle(setPEstado)} onClear={() => setPEstado([])} />
        <MultiSelect label="Edificio" options={edificioOpts} selected={pEdificio} onToggle={toggle(setPEdificio)} onClear={() => setPEdificio([])} searchable />
        <MultiSelect label="Tipo" options={tipoOpts} selected={pTipo} onToggle={toggle(setPTipo)} onClear={() => setPTipo([])} />
      </div>
      <div className="mt-4 flex justify-end gap-2 border-t border-wash-border pt-3">
        <PopoverClose asChild>
          <button type="button" className="rounded-lg border border-wash-border px-4 py-2 text-[12.5px] font-medium text-wash-text-strong hover:bg-wash-surface-2">Cancelar</button>
        </PopoverClose>
        <PopoverClose asChild>
          <button
            type="button"
            disabled={!dirty}
            onClick={() => onApply({ mesAno: pMesAno, estado: pEstado, edificio: pEdificio, tipo: pTipo })}
            className="rounded-lg bg-wash-action px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            Aplicar
          </button>
        </PopoverClose>
      </div>
    </div>
  );
}
