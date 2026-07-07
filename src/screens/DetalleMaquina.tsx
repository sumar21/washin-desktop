import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Eye,
  ArrowLeftRight,
  Trash2,
  WashingMachine,
  Wind,
  Cog,
  Building2,
  Zap,
  ArrowRight,
  Check,
  AlertCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Modal, ModalActions, ConfirmDialog } from '@/components/Modal';
import { StatusBadge } from '@/components/StatusBadge';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { ErrorState } from '@/components/ErrorState';
import { PopoverClose } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppStore } from '@/store/useAppStore';
import { cn, proper } from '@/lib/utils';
import { getMaquinaHistorial, type HistorialItem } from '@/services/api';
import type { DetalleMaquina as Maquina } from '@/types/domain';

const DEPOSITO = 'Wash Inn';

// Meta por segmento (case-insensitive, Title Case real).
const SEG_META: Record<string, { icon: typeof WashingMachine; tone: string }> = {
  lavadora: { icon: WashingMachine, tone: 'bg-amber-100 text-amber-800 ring-amber-300/70' },
  'secadora simple': { icon: Wind, tone: 'bg-emerald-100 text-emerald-800 ring-emerald-300/70' },
  'secadora doble': { icon: Wind, tone: 'bg-fuchsia-100 text-fuchsia-800 ring-fuchsia-300/70' },
  cargadora: { icon: Cog, tone: 'bg-violet-100 text-violet-800 ring-violet-300/70' },
  expendedora: { icon: Cog, tone: 'bg-orange-100 text-orange-800 ring-orange-300/70' },
  encendedora: { icon: Cog, tone: 'bg-sky-100 text-sky-800 ring-sky-300/70' },
};
const FALLBACK_META = { icon: Cog, tone: 'bg-slate-100 text-slate-700 ring-slate-300/70' };
const segMeta = (s: string) => SEG_META[s.trim().toLowerCase()] ?? FALLBACK_META;

const isEncendedoraSeg = (s: string) => {
  const x = s.trim().toLowerCase();
  return x === 'encendedora' || x === 'encendedor';
};

const uniqSorted = (arr: string[]) =>
  [...new Set(arr.filter(Boolean).map((s) => s.trim()))].sort((a, b) => a.localeCompare(b, 'es'));

export function DetalleMaquina() {
  const maquinas = useAppStore((s) => s.CollectMaquinas);
  const edificiosDestino = useAppStore((s) => s.CollectEdificiosMaquina);
  const fetchMaquinas = useAppStore((s) => s.fetchMaquinas);
  const transferMaquina = useAppStore((s) => s.transferMaquina);
  const bajaMaquina = useAppStore((s) => s.bajaMaquina);
  const VarTipoUser = useAppStore((s) => s.VarTipoUser);

  const canManage = VarTipoUser === 'Admin';

  const [query, setQuery] = useState('');
  const [fEdificio, setFEdificio] = useState('');
  const [fSegmento, setFSegmento] = useState('');
  const [fMarca, setFMarca] = useState('');
  const [fEncendido, setFEncendido] = useState('');

  const [viewing, setViewing] = useState<Maquina | null>(null);
  const [transferring, setTransferring] = useState<Maquina | null>(null);
  const [baja, setBaja] = useState<Maquina | null>(null);
  const [bajaBusy, setBajaBusy] = useState(false);
  const [bajaError, setBajaError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    return fetchMaquinas()
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'No se pudieron cargar las máquinas.'))
      .finally(() => setLoading(false));
  }, [fetchMaquinas]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial; "Reintentar" también dispara load().
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar.
  }, []);

  // Opciones de filtro derivadas del universo real de máquinas.
  const edificioOpts = useMemo(() => uniqSorted(maquinas.map((m) => m.Edificio_DM)), [maquinas]);
  const segmentoOpts = useMemo(() => uniqSorted(maquinas.map((m) => m.Segmento_DM)), [maquinas]);
  const marcaOpts = useMemo(() => uniqSorted(maquinas.map((m) => m.Marca_DM)), [maquinas]);
  const encendidoOpts = useMemo(
    () => uniqSorted(maquinas.map((m) => m.Encendido_DM ?? '')),
    [maquinas]
  );

  const activeFilters = [fEdificio, fSegmento, fMarca, fEncendido].filter(Boolean).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return maquinas
      .filter((m) => (fEdificio ? m.Edificio_DM === fEdificio : true))
      .filter((m) => (fSegmento ? m.Segmento_DM === fSegmento : true))
      .filter((m) => (fMarca ? m.Marca_DM === fMarca : true))
      .filter((m) => (fEncendido ? (m.Encendido_DM ?? '') === fEncendido : true))
      .filter((m) =>
        q === ''
          ? true
          : m.Edificio_DM.toLowerCase().includes(q) ||
            m.Marca_DM.toLowerCase().includes(q) ||
            m.Modelo_DM.toLowerCase().includes(q) ||
            m.NroSerie_DM.toLowerCase().includes(q) ||
            m.IDMaquina_DM.toLowerCase().includes(q) ||
            m.ConcatMaquina_DM.toLowerCase().includes(q)
      );
  }, [maquinas, query, fEdificio, fSegmento, fMarca, fEncendido]);

  const clearFilters = () => {
    setFEdificio('');
    setFSegmento('');
    setFMarca('');
    setFEncendido('');
  };

  const instaladas = useMemo(() => maquinas.filter((m) => m.Status_DM === 'INSTALADA').length, [maquinas]);
  const deposito = useMemo(() => maquinas.filter((m) => m.Status_DM === 'DEPOSITO').length, [maquinas]);

  return (
    <div className="relative flex h-full w-full flex-col">
      <PageHeader
        title="Detalle de Máquinas"
        subtitle="Parque completo — ordenado por edificio, segmento y modelo"
        search={{ value: query, onChange: setQuery, placeholder: 'Edificio, marca, modelo, serie, ID…' }}
        filterPopover={
          <FilterContent
            edificios={edificioOpts}
            segmentos={segmentoOpts}
            marcas={marcaOpts}
            encendidos={encendidoOpts}
            edificio={fEdificio}
            segmento={fSegmento}
            marca={fMarca}
            encendido={fEncendido}
            onApply={(f) => {
              setFEdificio(f.edificio);
              setFSegmento(f.segmento);
              setFMarca(f.marca);
              setFEncendido(f.encendido);
            }}
          />
        }
      />
      <LoadingOverlay visible={loading} label="Cargando máquinas…" />

      {loadError ? (
        <ErrorState message={loadError} onRetry={load} />
      ) : (
        <>
          {/* Stat strip */}
          <div className="flex flex-wrap items-center gap-2.5 border-b border-wash-border bg-wash-surface px-4 py-3 text-xs md:px-6">
            <Stat label="Total activas" value={maquinas.length} tone="bg-wash-brand/10 text-wash-brand ring-wash-brand/20" />
            <Stat label="Instaladas" value={instaladas} tone="bg-emerald-500/10 text-emerald-700 ring-emerald-500/20" />
            <Stat label="En depósito" value={deposito} tone="bg-amber-500/10 text-amber-700 ring-amber-500/20" />
            <span className="ml-auto text-wash-text-muted">
              Mostrando <strong className="text-wash-text-strong tabular-nums">{filtered.length}</strong>
              {filtered.length !== maquinas.length && ` de ${maquinas.length}`}
            </span>
          </div>

          {/* Active filter chips */}
          {(activeFilters > 0) && (
            <div className="flex flex-wrap items-center gap-2 border-b border-wash-border bg-wash-surface-2/40 px-4 py-2 text-xs text-wash-text-muted md:px-6">
              <span className="font-semibold uppercase tracking-wider">Filtros:</span>
              {([
                ['Edificio', fEdificio, () => setFEdificio('')],
                ['Segmento', fSegmento, () => setFSegmento('')],
                ['Marca', fMarca, () => setFMarca('')],
                ['Encendido', fEncendido, () => setFEncendido('')],
              ] as [string, string, () => void][])
                .filter(([, v]) => v)
                .map(([label, v, clear]) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1 rounded-full bg-wash-brand/10 px-2.5 py-0.5 font-semibold text-wash-brand"
                  >
                    {label}: {v}
                    <button
                      type="button"
                      onClick={clear}
                      className="-mr-1 flex h-4 w-4 items-center justify-center rounded-full hover:bg-wash-brand/20"
                      aria-label={`Quitar filtro ${label}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              <button type="button" onClick={clearFilters} className="ml-auto hover:text-wash-text-strong">
                Limpiar todo
              </button>
            </div>
          )}

          <div className="flex-1 overflow-hidden p-3 md:p-6">
            <VirtualMachineTable
              rows={filtered}
              resetKey={`${query}|${fEdificio}|${fSegmento}|${fMarca}|${fEncendido}`}
              canManage={canManage}
              onView={setViewing}
              onTransfer={(m) => setTransferring(m)}
              onBaja={(m) => setBaja(m)}
            />
          </div>
        </>
      )}

      {/* Detail + historial */}
      <DetailModal maquina={viewing} onClose={() => setViewing(null)} />

      {/* Transferir */}
      <TransferModal
        maquina={transferring}
        allMaquinas={maquinas}
        edificios={edificiosDestino}
        encendidoOpts={encendidoOpts}
        onClose={() => setTransferring(null)}
        onConfirm={async (payload) => {
          if (!transferring) return { pendingApproval: false };
          return await transferMaquina(transferring.ID, payload);
        }}
      />

      {/* Baja */}
      <ConfirmDialog
        open={!!baja}
        tone="danger"
        title="Dar de baja máquina"
        message={
          baja
            ? `Vas a dar de baja la máquina ${baja.ConcatMaquina_DM} (ID ${baja.IDMaquina_DM}). Se descuenta de stock y queda eliminada. ¿Confirmás?`
            : ''
        }
        confirmLabel={bajaBusy ? 'Procesando…' : 'Dar de baja'}
        busy={bajaBusy}
        error={bajaError}
        onCancel={() => {
          setBaja(null);
          setBajaError(null);
        }}
        onConfirm={async () => {
          if (!baja || bajaBusy) return;
          setBajaBusy(true);
          setBajaError(null);
          try {
            await bajaMaquina(baja.ID, '');
            setBaja(null);
          } catch (err) {
            setBajaError(err instanceof Error ? err.message : 'No se pudo dar de baja la máquina.');
          } finally {
            setBajaBusy(false);
          }
        }}
      />
    </div>
  );
}

// ===== Virtualized table (renderiza solo lo visible; soporta miles de filas) =====

const ROW_H_DESKTOP = 52;
const ROW_H_MOBILE = 112; // card por fila en <lg (más alta que la fila-grid)
const OVERSCAN = 8;
const GRID = '190px 170px 130px minmax(160px,1fr) 150px 90px 130px 110px';

// Virtualización responsiva: <lg renderiza cards (fila más alta). Lazy-init evita flash de tabla.
function useIsMobileList() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isMobile;
}

function VirtualMachineTable({
  rows,
  resetKey,
  canManage,
  onView,
  onTransfer,
  onBaja,
}: {
  rows: Maquina[];
  /** Cambia cuando cambian filtros/búsqueda → scrollea al tope (no cambia al refrescar datos). */
  resetKey: string;
  canManage: boolean;
  onView: (m: Maquina) => void;
  onTransfer: (m: Maquina) => void;
  onBaja: (m: Maquina) => void;
}) {
  // El contenedor scrollable solo existe cuando total>0, así que medimos (y observamos resize)
  // recién cuando realmente se monta — no en el primer render vacío. Se usa un ref para el
  // acceso imperativo (medir / resetear scroll) y un "tick" para re-disparar la medición al
  // montarse el nodo (un callback ref no re-corre effects por sí solo).
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [measureTick, setMeasureTick] = useState(0);
  const setScrollEl = useCallback((el: HTMLDivElement | null) => {
    scrollRef.current = el;
    if (el) setMeasureTick((t) => t + 1);
  }, []);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(600);

  const isMobile = useIsMobileList();
  const ROW_H = isMobile ? ROW_H_MOBILE : ROW_H_DESKTOP;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setViewportH(el.clientHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measureTick]);

  // Al cambiar el filtro/búsqueda, volver al tope (no al refetch de datos).
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resincroniza scroll al cambiar el filtro.
    setScrollTop(0);
  }, [resetKey]);

  const total = rows.length;
  // Clampeo del offset contra la altura real: si el set filtrado se achica por debajo del
  // scroll actual, sin esto start>end y el slice quedaría vacío (flash en blanco).
  const maxTop = Math.max(0, total * ROW_H - viewportH);
  const clampedTop = Math.min(scrollTop, maxTop);
  const start = Math.max(0, Math.floor(clampedTop / ROW_H) - OVERSCAN);
  const end = Math.min(total, Math.ceil((clampedTop + viewportH) / ROW_H) + OVERSCAN);
  const visible = rows.slice(start, end);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-wash-surface shadow-sm ring-1 ring-wash-border">
      {/* Header */}
      <div
        className="hidden shrink-0 border-b border-wash-border bg-wash-canvas px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-wash-text-muted lg:grid"
        style={{ gridTemplateColumns: GRID }}
      >
        <div>Edificio</div>
        <div>Segmento</div>
        <div>Marca</div>
        <div>Modelo</div>
        <div>N° Serie</div>
        <div>ID</div>
        <div>Encendido</div>
        <div className="text-right">Acciones</div>
      </div>

      {/* Body */}
      {total === 0 ? (
        <div className="flex flex-1 items-center justify-center px-4 text-sm text-wash-text-muted">
          No hay máquinas que coincidan con el filtro.
        </div>
      ) : (
        <div
          ref={setScrollEl}
          className="flex-1 overflow-auto"
          onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        >
          <div style={{ height: total * ROW_H, position: 'relative' }}>
            <div style={{ position: 'absolute', top: start * ROW_H, left: 0, right: 0 }}>
              {visible.map((m) => {
                const meta = segMeta(m.Segmento_DM);
                const Icon = meta.icon;
                if (isMobile) {
                  return (
                    <div key={m.ID} style={{ height: ROW_H }} className="px-3 py-1.5">
                      <div className="flex h-full flex-col justify-between rounded-xl border border-wash-border bg-wash-surface p-2.5 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide ring-1',
                                meta.tone
                              )}
                            >
                              <Icon size={9} />
                              {m.Segmento_DM}
                            </span>
                            {m.Status_DM === 'DEPOSITO' && (
                              <span className="rounded bg-amber-100 px-1 py-0.5 text-[9px] font-bold text-amber-700">
                                DEP
                              </span>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <IconBtn icon={Eye} tone="neutral" title="Ver detalle / historial" onClick={() => onView(m)} />
                            {canManage && (
                              <>
                                <IconBtn icon={ArrowLeftRight} tone="brand" title="Transferir" onClick={() => onTransfer(m)} />
                                <IconBtn icon={Trash2} tone="danger" title="Dar de baja" onClick={() => onBaja(m)} />
                              </>
                            )}
                          </div>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-wash-text-strong">
                            {m.Marca_DM || '—'} {m.Modelo_DM}
                          </p>
                          <div className="mt-0.5 flex items-center gap-2 overflow-hidden text-[11px] text-wash-text-muted">
                            <span className="inline-flex shrink-0 items-center gap-1">
                              <Building2 size={10} className="shrink-0" />
                              <span className="truncate">{m.Edificio_DM}</span>
                            </span>
                            {m.IDMaquina_DM && (
                              <span className="shrink-0 font-semibold text-wash-text">{m.IDMaquina_DM}</span>
                            )}
                            {m.Encendido_DM && (
                              <span className="inline-flex shrink-0 items-center gap-0.5">
                                <Zap size={10} className="shrink-0 text-amber-500" />
                                {m.Encendido_DM}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }
                return (
                  <div
                    key={m.ID}
                    className="grid items-center border-b border-wash-divider/60 px-4 text-sm text-wash-text-strong hover:bg-wash-canvas"
                    style={{ gridTemplateColumns: GRID, height: ROW_H }}
                  >
                    <div className="truncate pr-2 font-medium" title={m.Edificio_DM}>
                      {m.Edificio_DM}
                      {m.Status_DM === 'DEPOSITO' && (
                        <span className="ml-1.5 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-bold text-amber-700">DEP</span>
                      )}
                    </div>
                    <div className="pr-2">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1',
                          meta.tone
                        )}
                      >
                        <Icon size={10} />
                        {m.Segmento_DM}
                      </span>
                    </div>
                    <div className="truncate pr-2 font-semibold">{m.Marca_DM || '—'}</div>
                    <div className="truncate pr-2 text-wash-text">{m.Modelo_DM || '—'}</div>
                    <div className="pr-2">
                      <span className="rounded-md bg-wash-surface-2 px-2 py-0.5 text-[11.5px] font-semibold text-wash-text">
                        {m.NroSerie_DM || '—'}
                      </span>
                    </div>
                    <div className="pr-2 text-[12px] font-bold">{m.IDMaquina_DM || '—'}</div>
                    <div className="truncate pr-2">
                      {m.Encendido_DM ? (
                        <span className="inline-flex items-center gap-1 text-[12px] text-wash-text">
                          <Zap size={11} className="shrink-0 text-amber-500" />
                          {m.Encendido_DM}
                        </span>
                      ) : (
                        <span className="text-wash-text-faint">—</span>
                      )}
                    </div>
                    <div className="flex items-center justify-end gap-1.5">
                      <IconBtn icon={Eye} tone="neutral" title="Ver detalle / historial" onClick={() => onView(m)} />
                      {canManage && (
                        <>
                          <IconBtn icon={ArrowLeftRight} tone="brand" title="Transferir" onClick={() => onTransfer(m)} />
                          <IconBtn icon={Trash2} tone="danger" title="Dar de baja" onClick={() => onBaja(m)} />
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== Detail modal with real historial =====

function DetailModal({ maquina, onClose }: { maquina: Maquina | null; onClose: () => void }) {
  const [historial, setHistorial] = useState<HistorialItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!maquina) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga el historial al abrir para una máquina.
    setLoading(true);
    setError(null);
    setHistorial([]);
    getMaquinaHistorial(maquina.ConcatMaquinaIncidente_DM)
      .then((h) => {
        if (!cancelled) setHistorial(h);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudo cargar el historial.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [maquina]);

  if (!maquina) return null;
  const meta = segMeta(maquina.Segmento_DM);
  const Icon = meta.icon;

  return (
    <Modal open={!!maquina} onClose={onClose} title={`Detalle — ${maquina.ConcatMaquina_DM}`} width={640}>
      <div className="flex items-center gap-3 rounded-xl bg-wash-surface-2/50 p-4">
        <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ring-1', meta.tone)}>
          <Icon size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-black text-wash-accent">
            {maquina.Marca_DM} {maquina.Modelo_DM}
          </p>
          <p className="mt-0.5 text-xs text-wash-text-muted">
            ID <span className="font-semibold text-wash-text">{maquina.IDMaquina_DM}</span> · Serie{' '}
            <span className="font-semibold text-wash-text">{maquina.NroSerie_DM}</span>
          </p>
        </div>
        <StatusBadge status={maquina.Status_DM} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <Info label="Edificio" value={maquina.Edificio_DM} />
        <Info label="Encendido" value={maquina.Encendido_DM || '—'} />
        <Info label="Fecha ingreso" value={maquina.FechaIngreso_DM || 'No especificada'} />
      </div>

      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-wash-text-muted">Historial de incidentes</p>
        <div className="mt-2">
          {loading ? (
            <div className="rounded-xl border border-dashed border-wash-border px-3 py-6 text-center text-sm text-wash-text-muted">
              Cargando historial…
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 rounded-r-md border-l-4 border-red-500 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700">
              <AlertCircle size={14} className="shrink-0" />
              {error}
            </div>
          ) : historial.length === 0 ? (
            <div className="rounded-xl border border-dashed border-wash-border px-3 py-8 text-center">
              <p className="text-sm font-semibold text-wash-text-strong">Sin historial</p>
              <p className="mt-1 text-xs text-wash-text-muted">No hay incidentes registrados para esta máquina.</p>
            </div>
          ) : (
            <ul className="max-h-[280px] space-y-2 overflow-y-auto">
              {historial.map((i) => (
                <li key={i.ID} className="rounded-xl bg-wash-canvas px-4 py-3 ring-1 ring-wash-border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-wash-text-muted">{i.Fecha_IN || '—'}</span>
                    <StatusBadge status={i.Resuelto_IN === 'SI' ? 'Resuelto' : i.Status_IN || 'Pendiente'} />
                  </div>
                  <div className="mt-1 font-display font-bold text-wash-accent">{proper(i.Titulo)}</div>
                  {i.Descripcion && <p className="mt-1 text-sm text-wash-text">{i.Descripcion}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <ModalActions>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-wash-border px-5 py-2 font-medium text-wash-text-strong hover:bg-wash-surface-2"
        >
          Cerrar
        </button>
      </ModalActions>
    </Modal>
  );
}

// ===== Transfer modal =====

const MOTIVOS = [
  'Cambio por incidente',
  'Rotación preventiva',
  'Mudanza',
  'Retiro para mantenimiento',
  'Recambio de tecnología',
  'Otro',
];

function TransferModal({
  maquina,
  allMaquinas,
  edificios,
  encendidoOpts,
  onClose,
  onConfirm,
}: {
  maquina: Maquina | null;
  allMaquinas: Maquina[];
  edificios: { edificio: string; codigo: string }[];
  encendidoOpts: string[];
  onClose: () => void;
  onConfirm: (payload: {
    edificioDestino: string;
    codigoDestino?: string;
    motivo: string;
    encendido?: string;
  }) => Promise<{ pendingApproval: boolean }>;
}) {
  const [destino, setDestino] = useState('');
  const [motivo, setMotivo] = useState('');
  const [motivoDetalle, setMotivoDetalle] = useState('');
  const [encendido, setEncendido] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!maquina) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicia el form al abrir para una máquina.
    setDestino('');
    setMotivo('');
    setMotivoDetalle('');
    setEncendido('');
    setError(null);
    setSent(false);
  }, [maquina]);

  if (!maquina) return null;
  const meta = segMeta(maquina.Segmento_DM);
  const Icon = meta.icon;
  const esEncendedora = isEncendedoraSeg(maquina.Segmento_DM);
  const vaADeposito = destino === DEPOSITO;
  const motivoFinal = motivo === 'Otro' ? motivoDetalle.trim() : motivo;
  const codigoDestino = edificios.find((e) => e.edificio === destino)?.codigo;

  // Encendedora existente del edificio destino (para herencia/propagación).
  const destEncendedora =
    destino && !vaADeposito
      ? allMaquinas.find(
          (m) =>
            m.ID !== maquina.ID &&
            m.Status_DM !== 'ELIMINADA' &&
            m.Edificio_DM === destino &&
            isEncendedoraSeg(m.Segmento_DM)
        )
      : undefined;

  // Encendido: mover una encendedora → elegís el tipo (se propaga). Máquina normal → hereda el
  // de la encendedora del edificio si existe; si no, elegís. A depósito → sin encendido.
  const hereda = !esEncendedora && !!destEncendedora && !vaADeposito;
  const eligeEncendido = !vaADeposito && (esEncendedora || !destEncendedora);
  const ready =
    !!destino &&
    !!motivo &&
    (motivo !== 'Otro' || !!motivoDetalle.trim()) &&
    (!esEncendedora || vaADeposito || !!encendido);

  return (
    <Modal open={!!maquina} onClose={onClose} title="Transferir máquina" width={620}>
      {sent && (
        <div className="mb-3 flex items-center gap-2 rounded-r-md border-l-4 border-emerald-500 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-800">
          <Check size={14} className="shrink-0" />
          Enviado a aprobación. Un supervisor debe confirmarlo en Mis Aprobaciones.
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="mb-3 flex items-center gap-2 rounded-r-md border-l-4 border-red-500 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700"
        >
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 rounded-xl border border-wash-border bg-wash-surface-2/40 p-4">
        <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ring-1', meta.tone)}>
          <Icon size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-black text-wash-accent">
            {maquina.Marca_DM} {maquina.Modelo_DM}
          </p>
          <p className="mt-0.5 text-xs text-wash-text-muted">
            ID <span className="font-semibold text-wash-text">{maquina.IDMaquina_DM}</span> · Serie{' '}
            <span className="font-semibold text-wash-text">{maquina.NroSerie_DM}</span>
          </p>
        </div>
        <StatusBadge status={maquina.Status_DM} />
      </div>

      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="rounded-xl bg-wash-surface-2/60 p-3 ring-1 ring-wash-border">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-wash-text-muted">Desde</p>
          <div className="mt-1 flex items-center gap-1.5">
            <Building2 size={14} className="shrink-0 text-wash-text-muted" />
            <span className="truncate text-sm font-semibold text-wash-text-strong">{maquina.Edificio_DM}</span>
          </div>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-wash-brand/15 text-wash-brand">
          <ArrowRight size={16} />
        </div>
        <div
          className={cn(
            'rounded-xl p-3 ring-1 transition',
            destino ? 'bg-wash-brand/5 ring-wash-brand/40' : 'bg-wash-surface-2/60 ring-wash-border'
          )}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-wash-text-muted">Hacia</p>
          <div className="mt-1 flex items-center gap-1.5">
            <Building2 size={14} className={cn('shrink-0', destino ? 'text-wash-brand' : 'text-wash-text-faint')} />
            <span className={cn('truncate text-sm font-semibold', destino ? 'text-wash-brand-dark' : 'text-wash-text-faint')}>
              {destino || 'Sin elegir'}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <Label>Edificio destino</Label>
          <div className="mt-1.5">
            <Select value={destino || undefined} onValueChange={setDestino}>
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder="Seleccionar destino…" />
              </SelectTrigger>
              <SelectContent>
                {edificios
                  .filter((e) => e.edificio !== maquina.Edificio_DM)
                  .map((e) => (
                    <SelectItem key={e.edificio} value={e.edificio}>
                      {e.edificio}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Motivo</Label>
            <div className="mt-1.5">
              <Select value={motivo || undefined} onValueChange={setMotivo}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder="Seleccionar motivo…" />
                </SelectTrigger>
                <SelectContent>
                  {MOTIVOS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {hereda && (
            <div>
              <Label>Encendido</Label>
              <div className="mt-1.5 flex h-10 items-center gap-1.5 rounded-lg border border-dashed border-wash-border bg-wash-surface-2/40 px-3 text-sm text-wash-text">
                <Zap size={13} className="shrink-0 text-amber-500" />
                <span className="truncate">Hereda: {destEncendedora?.Encendido_DM || '—'}</span>
              </div>
            </div>
          )}
          {eligeEncendido && (
            <div>
              <Label>{esEncendedora ? 'Tipo de encendido *' : 'Encendido'}</Label>
              <div className="mt-1.5">
                <Select value={encendido || undefined} onValueChange={setEncendido}>
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue placeholder={esEncendedora ? 'Elegir tipo…' : 'Sin cambio'} />
                  </SelectTrigger>
                  <SelectContent>
                    {encendidoOpts.map((e) => (
                      <SelectItem key={e} value={e}>
                        {e}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        {esEncendedora && !vaADeposito && destino && (
          <div className="flex items-start gap-2 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-900 ring-1 ring-sky-200">
            <Zap size={13} className="mt-0.5 shrink-0 text-sky-500" />
            <span>
              Es una <strong>encendedora</strong>: el tipo de encendido elegido se aplicará a{' '}
              <strong>todas las máquinas de {destino}</strong>.
            </span>
          </div>
        )}

        {motivo === 'Otro' && (
          <div>
            <Label>Detalle del motivo</Label>
            <textarea
              rows={2}
              value={motivoDetalle}
              onChange={(e) => setMotivoDetalle(e.target.value)}
              placeholder="Especificá el motivo…"
              className="mt-1.5 w-full rounded-lg border border-wash-border bg-wash-surface px-3 py-2 text-sm outline-none focus:border-wash-brand focus:ring-2 focus:ring-wash-brand/15"
            />
          </div>
        )}

        {vaADeposito && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
            <span className="mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
            <span>
              Al transferir a <strong>{DEPOSITO}</strong> la máquina queda en <strong>DEPOSITO</strong> y suma al stock del depósito.
            </span>
          </div>
        )}
      </div>

      <ModalActions>
        {sent ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-wash-action px-5 py-2 font-medium text-white hover:bg-wash-action-dark"
          >
            Cerrar
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-wash-border px-4 py-2 font-medium text-wash-text-strong hover:bg-wash-surface-2"
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
                  const { pendingApproval } = await onConfirm({
                    edificioDestino: destino,
                    codigoDestino,
                    motivo: motivoFinal,
                    encendido: encendido || undefined,
                  });
                  if (pendingApproval) setSent(true);
                  else onClose();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'No se pudo transferir la máquina.');
                } finally {
                  setSaving(false);
                }
              }}
              className="rounded-lg bg-wash-action px-5 py-2 font-medium text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Transfiriendo…' : 'Transferir'}
            </button>
          </>
        )}
      </ModalActions>
    </Modal>
  );
}

// ===== Filter popover =====

function FilterContent({
  edificios,
  segmentos,
  marcas,
  encendidos,
  edificio,
  segmento,
  marca,
  encendido,
  onApply,
}: {
  edificios: string[];
  segmentos: string[];
  marcas: string[];
  encendidos: string[];
  edificio: string;
  segmento: string;
  marca: string;
  encendido: string;
  onApply: (f: { edificio: string; segmento: string; marca: string; encendido: string }) => void;
}) {
  const [pe, setPe] = useState(edificio);
  const [ps, setPs] = useState(segmento);
  const [pm, setPm] = useState(marca);
  const [pen, setPen] = useState(encendido);

  const ALL = '__all__';
  const field = (label: string, value: string, set: (v: string) => void, opts: string[]) => (
    <div>
      <Label>{label}</Label>
      <div className="mt-1.5">
        <Select value={value || ALL} onValueChange={(v) => set(v === ALL ? '' : v)}>
          <SelectTrigger className="h-9 w-full text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-[280px]">
            <SelectItem value={ALL}>Todos</SelectItem>
            {opts.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  return (
    <div>
      <div className="mb-3 flex items-center justify-between border-b border-wash-border pb-2.5">
        <h3 className="text-sm font-bold text-wash-text-strong">Filtrar máquinas</h3>
        <button
          type="button"
          onClick={() => {
            setPe('');
            setPs('');
            setPm('');
            setPen('');
          }}
          className="text-[11px] font-semibold text-wash-text-muted hover:text-wash-text-strong"
        >
          Limpiar
        </button>
      </div>

      <div className="space-y-3">
        {field('Edificio', pe, setPe, edificios)}
        {field('Segmento', ps, setPs, segmentos)}
        {field('Marca', pm, setPm, marcas)}
        {field('Encendido', pen, setPen, encendidos)}
      </div>

      <div className="mt-4 flex justify-end gap-2 border-t border-wash-border pt-3">
        <PopoverClose asChild>
          <button
            type="button"
            className="rounded-lg border border-wash-border px-4 py-2 text-[12.5px] font-medium text-wash-text-strong hover:bg-wash-surface-2"
          >
            Cancelar
          </button>
        </PopoverClose>
        <PopoverClose asChild>
          <button
            type="button"
            onClick={() => onApply({ edificio: pe, segmento: ps, marca: pm, encendido: pen })}
            className="rounded-lg bg-wash-action px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-wash-action-dark"
          >
            Aplicar
          </button>
        </PopoverClose>
      </div>
    </div>
  );
}

// ===== small bits =====

function IconBtn({
  icon: Icon,
  tone,
  title,
  onClick,
}: {
  icon: typeof Eye;
  tone: 'neutral' | 'brand' | 'danger';
  title: string;
  onClick: () => void;
}) {
  const cls = {
    neutral:
      'text-wash-text-muted ring-wash-border hover:bg-wash-surface-2 hover:text-wash-text-strong hover:ring-wash-text-muted/40',
    brand: 'text-wash-brand ring-wash-brand/30 hover:bg-wash-brand/10 hover:ring-wash-brand',
    danger: 'text-rose-600 ring-rose-500/30 hover:bg-rose-500/10 hover:ring-rose-500',
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn('flex h-8 w-8 items-center justify-center rounded-lg ring-1 transition', cls)}
    >
      <Icon size={15} />
    </button>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 rounded-lg px-3 py-1.5 ring-1', tone)}>
      <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{label}</span>
      <span className="font-display text-base font-black tabular-nums">{value}</span>
    </span>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-wash-text-muted">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-wash-text-strong">{value}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-semibold uppercase tracking-wider text-wash-text-muted">{children}</label>
  );
}
