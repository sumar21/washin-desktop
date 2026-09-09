// Novedades (20.Novedades) — bandeja del back-office.
//
// Las carga el técnico desde la mobile: algo del edificio que hay que resolver o comprar (tacho
// roto, sticker despegado, cartelería). Reemplaza el grupo de WhatsApp donde esto se informaba
// suelto. Acá se revisa, se ve la evidencia y se da el OK cuando el recurso está listo.
//
// NO hay gestión de compras: "Resuelto" es un cambio de estado, no genera pedido ni aprobación.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Megaphone, Paperclip, Check, Ban, Eye, Building2, Download, Play, X } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { Modal, ModalActions } from '@/components/Modal';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { PopoverClose } from '@/components/ui/popover';
import { MultiSelect, type MultiOption } from '@/components/ui/multi-select';
import { edificioOptions, estadoOptions, mesAnoOptions } from '@/lib/filters';
import { useAppStore } from '@/store/useAppStore';
import * as api from '@/services/api';
import type { Novedad, ArchivoEvidencia } from '@/types/domain';

/** Orden canónico de los estados (para el filtro). */
const ESTADO_ORDEN_NV = ['Pendiente', 'Resuelto', 'Anulado'];

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((v) => b.includes(v));

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-wash-brand/10 px-2.5 py-0.5 font-semibold text-wash-brand">{children}</span>;
}

export function Novedades() {
  const [novedades, setNovedades] = useState<Novedad[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  // Filtros multi-select: array vacío = "todos". La bandeja abre en PENDIENTES, que es para lo
  // que se usa; el endpoint trae todos los estados para que el filtro siempre encuentre algo.
  const [filterEstado, setFilterEstado] = useState<string[]>(['Pendiente']);
  const [filterEdificio, setFilterEdificio] = useState<string[]>([]);
  const [filterMesAno, setFilterMesAno] = useState<string[]>([]);
  const [viendo, setViendo] = useState<Novedad | null>(null);

  // El catálogo de edificios sale de ABM.Edificios y NO de las novedades cargadas: así un
  // edificio activo sin novedades igual se puede elegir, y la lista no cambia según los otros
  // filtros (ver el comentario de edificioOptions en src/lib/filters.ts).
  const edificiosAbm = useAppStore((s) => s.CollectAbmEdificios);
  const fetchAbm = useAppStore((s) => s.fetchAbm);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    return Promise.all([
      api.getNovedades().then(setNovedades),
      // Alimenta el combo de Edificio del filtro. Si falla, el resto de la pantalla sirve igual.
      fetchAbm().catch(() => {}),
    ])
      .catch((err) =>
        setLoadError(err instanceof Error ? err.message : 'No se pudieron cargar las novedades.')
      )
      .finally(() => setLoading(false));
  }, [fetchAbm]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial; "Reintentar" también dispara load().
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar.
  }, []);

  // Estados canónicos siempre presentes + los que traigan los datos (nunca "Sin opciones").
  const estadoOpts = useMemo<MultiOption[]>(
    () => estadoOptions([...ESTADO_ORDEN_NV, ...novedades.map((n) => n.Estado)], ESTADO_ORDEN_NV),
    [novedades]
  );
  const edificioOpts = useMemo<MultiOption[]>(() => edificioOptions(edificiosAbm), [edificiosAbm]);
  const mesAnoOpts = useMemo<MultiOption[]>(
    () => mesAnoOptions(novedades.map((n) => n.FechaMesAno)),
    [novedades]
  );
  const mesAnoLabel = useMemo(
    () => new Map(mesAnoOpts.map((o) => [o.value, o.label])),
    [mesAnoOpts]
  );

  const filtradas = useMemo(() => {
    const q = query.trim().toLowerCase();
    return novedades
      .filter((n) => filterEstado.length === 0 || filterEstado.includes(n.Estado))
      .filter((n) => filterEdificio.length === 0 || filterEdificio.includes(n.Edificio))
      .filter((n) => filterMesAno.length === 0 || filterMesAno.includes(n.FechaMesAno))
      .filter(
        (n) =>
          !q ||
          n.Edificio.toLowerCase().includes(q) ||
          n.CodigoEdificio.toLowerCase().includes(q) ||
          n.Descripcion.toLowerCase().includes(q) ||
          n.Usuario.toLowerCase().includes(q)
      );
  }, [novedades, query, filterEstado, filterEdificio, filterMesAno]);

  const activeChips = useMemo<{ cat: string; label: string }[]>(() => {
    const chips: { cat: string; label: string }[] = [];
    filterMesAno.forEach((v) => chips.push({ cat: 'Mes', label: mesAnoLabel.get(v) ?? v }));
    filterEstado.forEach((v) => chips.push({ cat: 'Estado', label: v }));
    filterEdificio.forEach((v) => chips.push({ cat: 'Edificio', label: v }));
    return chips;
  }, [filterMesAno, filterEstado, filterEdificio, mesAnoLabel]);

  const hasFilters = activeChips.length > 0;
  const clearFilters = () => {
    setFilterMesAno([]);
    setFilterEstado([]);
    setFilterEdificio([]);
  };

  // El contador mide la COLA DE TRABAJO (lo pendiente), no lo que se está mirando.
  const pendientes = novedades.filter((n) => n.Estado === 'Pendiente').length;

  const columns: Column<Novedad>[] = [
    {
      key: 'edificio',
      header: 'Edificio',
      render: (n) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-wash-text-strong">
            {n.Edificio || n.CodigoEdificio}
          </p>
          <p className="truncate text-[12px] text-wash-text-faint">{n.CodigoEdificio}</p>
        </div>
      ),
    },
    {
      key: 'descripcion',
      header: 'Novedad',
      render: (n) => <span className="line-clamp-2 text-[13px]">{n.Descripcion}</span>,
    },
    {
      key: 'tecnico',
      header: 'Técnico',
      width: 'minmax(0,0.6fr)',
      render: (n) => <span className="text-[13px]">{n.Usuario}</span>,
    },
    {
      key: 'fecha',
      header: 'Fecha',
      width: 'minmax(0,0.5fr)',
      render: (n) => (
        <span className="whitespace-nowrap text-[13px]">
          {n.Fecha} {n.Hora}
        </span>
      ),
    },
    {
      key: 'evidencia',
      header: 'Ev.',
      width: '64px',
      align: 'center',
      render: (n) =>
        n.CantidadEvidencia > 0 ? (
          <span className="inline-flex items-center gap-1 text-[12px] text-wash-text">
            <Paperclip size={12} />
            {n.CantidadEvidencia}
          </span>
        ) : (
          <span className="text-wash-text-faint">—</span>
        ),
    },
    {
      key: 'estado',
      header: 'Estado',
      // Ancho fijo + truncate:false, igual que las columnas de estado de Ventilaciones y Compras.
      // Con el truncate por defecto la celda recorta la pill a media palabra.
      width: '160px',
      truncate: false,
      render: (n) => <StatusBadge status={n.Estado} />,
    },
    {
      key: 'acciones',
      header: '',
      width: '56px',
      align: 'right',
      render: (n) => (
        <button
          type="button"
          title="Ver detalle"
          aria-label="Ver detalle"
          onClick={(e) => {
            e.stopPropagation();
            setViendo(n);
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-wash-text ring-1 ring-wash-border hover:bg-wash-canvas"
        >
          <Eye size={15} />
        </button>
      ),
    },
  ];

  return (
    <div className="relative flex h-full w-full flex-col">
      <PageHeader
        title="Novedades"
        subtitle={`${pendientes} pendiente${pendientes === 1 ? '' : 's'} · ${novedades.length} en total`}
        search={{ value: query, onChange: setQuery, placeholder: 'Buscar edificio, novedad o técnico…' }}
        filterPopover={
          <FilterContent
            mesAno={filterMesAno}
            estado={filterEstado}
            edificio={filterEdificio}
            mesAnoOpts={mesAnoOpts}
            estadoOpts={estadoOpts}
            edificioOpts={edificioOpts}
            onApply={(f) => {
              setFilterMesAno(f.mesAno);
              setFilterEstado(f.estado);
              setFilterEdificio(f.edificio);
            }}
          />
        }
      />
      <LoadingOverlay visible={loading} label="Cargando novedades…" />

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
          <DataTable
            rows={filtradas}
            columns={columns}
            rowKey={(n) => n.ID}
            onRowClick={(n) => setViendo(n)}
            empty={
              <EmptyState
                icon={Megaphone}
                title={hasFilters ? 'Sin novedades con esos filtros' : 'Sin novedades'}
                description="Las cargan los técnicos desde la app del celular."
              />
            }
            mobileCard={(n) => (
              <button
                type="button"
                onClick={() => setViendo(n)}
                className="w-full rounded-xl border border-wash-border bg-wash-surface p-3 text-left shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <Building2 size={13} className="shrink-0 text-wash-text-faint" />
                    <span className="truncate text-[13.5px] font-semibold text-wash-text-strong">
                      {n.Edificio || n.CodigoEdificio}
                    </span>
                  </div>
                  <StatusBadge status={n.Estado} />
                </div>
                <p className="mt-1.5 line-clamp-2 text-[13px] text-wash-text">{n.Descripcion}</p>
                <div className="mt-2 flex items-center gap-2 text-[11.5px] text-wash-text-faint">
                  <span>{n.Usuario}</span>
                  <span>{n.Fecha}</span>
                  {n.CantidadEvidencia > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Paperclip size={11} />
                      {n.CantidadEvidencia}
                    </span>
                  )}
                </div>
              </button>
            )}
            />
          </div>
        </>
      )}

      <DetalleNovedad
        key={viendo?.ID ?? 'ninguna'}
        novedad={viendo}
        onClose={() => setViendo(null)}
        onHecho={() => {
          setViendo(null);
          void load();
        }}
      />
    </div>
  );
}

function DetalleNovedad({
  novedad,
  onClose,
  onHecho,
}: {
  novedad: Novedad | null;
  onClose: () => void;
  onHecho: () => void;
}) {
  // null = todavía cargando. Si la novedad no tiene adjuntos ya arranca en [] y no hay fetch:
  // el componente se remonta por novedad (key en el padre), así que esto se evalúa una vez.
  const [evidencia, setEvidencia] = useState<ArchivoEvidencia[] | null>(
    novedad && novedad.CantidadEvidencia === 0 ? [] : null,
  );
  const [comentario, setComentario] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // El componente se remonta por novedad (key en el padre), así que el estado ya nace limpio y
  // acá sólo queda el fetch. La evidencia se pide al abrir el detalle y no con el listado: las
  // URLs de descarga que devuelve Graph son de vida corta.
  useEffect(() => {
    if (!novedad || novedad.CantidadEvidencia === 0) return;
    let vivo = true;
    api
      .getEvidenciaNovedad(novedad.ID)
      .then((a) => vivo && setEvidencia(a))
      .catch(() => vivo && setEvidencia([]));
    return () => {
      vivo = false;
    };
  }, [novedad]);

  if (!novedad) return null;
  const pendiente = novedad.Estado === 'Pendiente';

  async function accion(tipo: 'resolver' | 'anular') {
    if (!novedad) return;
    setGuardando(true);
    setError(null);
    try {
      if (tipo === 'resolver') await api.resolverNovedad(novedad.ID, comentario.trim());
      else await api.anularNovedad(novedad.ID, comentario.trim());
      onHecho();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal open={!!novedad} onClose={onClose} title={novedad.Edificio || novedad.CodigoEdificio} width={620}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-wash-text-faint">
          <StatusBadge status={novedad.Estado} />
          <span>
            {novedad.Fecha} {novedad.Hora}
          </span>
          <span>· {novedad.Usuario}</span>
        </div>

        <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-wash-text-strong">
          {novedad.Descripcion}
        </p>

        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-wash-text-faint">
            Evidencia
          </p>
          {evidencia === null ? (
            <p className="text-[13px] text-wash-text-faint">Cargando…</p>
          ) : evidencia.length === 0 ? (
            <p className="text-[13px] text-wash-text-faint">Sin archivos adjuntos.</p>
          ) : (
            <GaleriaEvidencia archivos={evidencia} />
          )}
        </div>

        {/* Lo que ya se respondió, si la novedad está cerrada. */}
        {!pendiente && (
          <div className="rounded-lg bg-wash-canvas px-3 py-2 text-[13px] ring-1 ring-wash-border">
            <p className="text-[11px] font-bold uppercase tracking-wide text-wash-text-faint">
              {novedad.Estado} por {novedad.UsuarioResuelto ?? '—'} · {novedad.FechaResuelto ?? ''}
            </p>
            {novedad.DescripcionResuelto && (
              <p className="mt-1 whitespace-pre-wrap">{novedad.DescripcionResuelto}</p>
            )}
          </div>
        )}

        {pendiente && (
          <div>
            <label
              htmlFor="nv-comentario"
              className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-wash-text-faint"
            >
              Comentario (opcional)
            </label>
            <textarea
              id="nv-comentario"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={2}
              placeholder="Ej: se compró el tacho, queda para la próxima visita"
              className="w-full rounded-lg border border-wash-border bg-wash-surface px-3 py-2 text-[13.5px] outline-none focus:ring-2 focus:ring-wash-brand/30"
            />
            <p className="mt-1 text-[12px] text-wash-text-faint">
              El técnico lo ve en su app.
            </p>
          </div>
        )}

        {error && <p className="text-[13px] font-medium text-red-700">{error}</p>}
      </div>

      <ModalActions>
        {pendiente ? (
          <>
            <button
              type="button"
              disabled={guardando}
              onClick={() => accion('anular')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-wash-canvas px-3 py-2 text-sm font-medium text-wash-text ring-1 ring-wash-border hover:bg-wash-border/40 disabled:opacity-50"
            >
              <Ban size={15} />
              Anular
            </button>
            <button
              type="button"
              disabled={guardando}
              onClick={() => accion('resolver')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-wash-brand px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              <Check size={15} />
              {guardando ? 'Guardando…' : 'Dar OK'}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-wash-canvas px-3 py-2 text-sm font-medium text-wash-text ring-1 ring-wash-border hover:bg-wash-border/40"
          >
            Cerrar
          </button>
        )}
      </ModalActions>
    </Modal>
  );
}

/**
 * Galería de evidencia con visor DENTRO de la app.
 *
 * Antes cada archivo era un <a target="_blank"> a la URL de SharePoint: sacaba al usuario de la
 * app y en muchos casos disparaba la descarga en vez de mostrar la foto. Ahora se amplía en un
 * lightbox, el mismo patrón que el detalle de incidentes (z-[70] para quedar sobre el overlay
 * del Modal, que es z-[60]).
 */
function GaleriaEvidencia({ archivos }: { archivos: ArchivoEvidencia[] }) {
  const [abierto, setAbierto] = useState<number | null>(null);
  const actual = abierto === null ? null : archivos[abierto];

  // Escape cierra SOLO el visor: se escucha en capture y se corta la propagación antes de que
  // llegue el listener de Modal.tsx, que si no cerraría el detalle entero.
  useEffect(() => {
    if (abierto === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setAbierto(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [abierto]);

  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {archivos.map((a, idx) => (
          <div
            key={a.id}
            className="group relative overflow-hidden rounded-lg ring-1 ring-wash-border transition hover:ring-wash-action"
          >
            <button
              type="button"
              aria-label={`Ver ${a.nombre}`}
              onClick={() => setAbierto(idx)}
              className="block w-full"
            >
              {a.mime.startsWith('image/') && a.url ? (
                <img
                  src={a.url}
                  alt=""
                  loading="lazy"
                  className="h-24 w-full object-cover transition group-hover:scale-105"
                />
              ) : a.mime.startsWith('video/') && a.url ? (
                <span className="relative block">
                  <video src={a.url} preload="metadata" muted className="h-24 w-full bg-black object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Play size={18} className="text-white" />
                  </span>
                </span>
              ) : (
                <span className="flex h-24 w-full items-center justify-center bg-wash-canvas">
                  <Paperclip size={18} className="text-wash-text-faint" />
                </span>
              )}
            </button>
          </div>
        ))}
      </div>

      {actual && (
        <div
          role="presentation"
          onClick={() => setAbierto(null)}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-6"
        >
          {/* stopPropagation: el click en la barra no debe cerrar el visor (lo cierra el overlay). */}
          <div
            role="presentation"
            onClick={(e) => e.stopPropagation()}
            className="absolute right-4 top-4 flex items-center gap-2"
          >
            {actual.url && (
              <a
                href={actual.url}
                download={actual.nombre}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-sm font-medium text-white transition hover:bg-white/20"
              >
                <Download size={16} />
                Descargar
              </a>
            )}
            <button
              type="button"
              aria-label="Cerrar"
              onClick={() => setAbierto(null)}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white transition hover:bg-white/20"
            >
              <X size={18} />
            </button>
          </div>
          {actual.mime.startsWith('video/') ? (
            <video
              src={actual.url}
              controls
              autoPlay
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90dvh] max-w-[90vw]"
            />
          ) : (
            <img
              src={actual.url}
              alt={actual.nombre}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90dvh] max-w-[90vw] object-contain"
            />
          )}
        </div>
      )}
    </>
  );
}

/**
 * Popover de filtros. Mismo patrón que Incidentes/Aprobaciones: se edita en estado local
 * (`p*`) y recién se propaga al aplicar, así el listado no se re-filtra en cada click.
 */
function FilterContent({
  mesAno,
  estado,
  edificio,
  mesAnoOpts,
  estadoOpts,
  edificioOpts,
  onApply,
}: {
  mesAno: string[];
  estado: string[];
  edificio: string[];
  mesAnoOpts: MultiOption[];
  estadoOpts: MultiOption[];
  edificioOpts: MultiOption[];
  onApply: (f: { mesAno: string[]; estado: string[]; edificio: string[] }) => void;
}) {
  const [pMesAno, setPMesAno] = useState<string[]>(mesAno);
  const [pEstado, setPEstado] = useState<string[]>(estado);
  const [pEdificio, setPEdificio] = useState<string[]>(edificio);

  const toggle = (set: React.Dispatch<React.SetStateAction<string[]>>) => (v: string) =>
    set((arr) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]));

  const total = pMesAno.length + pEstado.length + pEdificio.length;
  const dirty =
    !sameSet(pMesAno, mesAno) || !sameSet(pEstado, estado) || !sameSet(pEdificio, edificio);

  const limpiar = () => {
    setPMesAno([]);
    setPEstado([]);
    setPEdificio([]);
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between border-b border-wash-border pb-2.5">
        <h3 className="text-sm font-bold text-wash-text-strong">Filtrar</h3>
        {total > 0 && (
          <button
            type="button"
            onClick={limpiar}
            className="text-[11px] font-semibold text-wash-text-muted hover:text-wash-text-strong"
          >
            Limpiar todo
          </button>
        )}
      </div>
      <div className="space-y-3">
        <MultiSelect
          label="Mes / Año"
          options={mesAnoOpts}
          selected={pMesAno}
          onToggle={toggle(setPMesAno)}
          onClear={() => setPMesAno([])}
        />
        <MultiSelect
          label="Estado"
          options={estadoOpts}
          selected={pEstado}
          onToggle={toggle(setPEstado)}
          onClear={() => setPEstado([])}
        />
        <MultiSelect
          label="Edificio"
          options={edificioOpts}
          selected={pEdificio}
          onToggle={toggle(setPEdificio)}
          onClear={() => setPEdificio([])}
          searchable
        />
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
            disabled={!dirty}
            onClick={() => onApply({ mesAno: pMesAno, estado: pEstado, edificio: pEdificio })}
            className="rounded-lg bg-wash-action px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            Aplicar
          </button>
        </PopoverClose>
      </div>
    </div>
  );
}
