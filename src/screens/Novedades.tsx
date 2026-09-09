// Novedades (20.Novedades) — bandeja del back-office.
//
// Las carga el técnico desde la mobile: algo del edificio que hay que resolver o comprar (tacho
// roto, sticker despegado, cartelería). Reemplaza el grupo de WhatsApp donde esto se informaba
// suelto. Acá se revisa, se ve la evidencia y se da el OK cuando el recurso está listo.
//
// NO hay gestión de compras: "Resuelto" es un cambio de estado, no genera pedido ni aprobación.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Megaphone, Paperclip, Check, Ban, Eye, Building2 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { Modal, ModalActions } from '@/components/Modal';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { cn } from '@/lib/utils';
import * as api from '@/services/api';
import type { Novedad, ArchivoEvidencia } from '@/types/domain';

const ESTADOS = ['Pendiente', 'Resuelto', 'Anulado'];

export function Novedades() {
  const [novedades, setNovedades] = useState<Novedad[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  // La bandeja abre en PENDIENTES, que es para lo que se usa. Las resueltas se llegan sacando
  // el filtro: el endpoint las trae todas, así el filtro por estado siempre encuentra algo.
  const [estado, setEstado] = useState<string>('Pendiente');
  const [viendo, setViendo] = useState<Novedad | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    return api
      .getNovedades()
      .then(setNovedades)
      .catch((err) =>
        setLoadError(err instanceof Error ? err.message : 'No se pudieron cargar las novedades.')
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial; "Reintentar" también dispara load().
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar.
  }, []);

  const filtradas = useMemo(() => {
    const q = query.trim().toLowerCase();
    return novedades
      .filter((n) => !estado || n.Estado === estado)
      .filter(
        (n) =>
          !q ||
          n.Edificio.toLowerCase().includes(q) ||
          n.CodigoEdificio.toLowerCase().includes(q) ||
          n.Descripcion.toLowerCase().includes(q) ||
          n.Usuario.toLowerCase().includes(q)
      );
  }, [novedades, query, estado]);

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
      width: 'minmax(0,0.55fr)',
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
        onRefresh={load}
        toolbarExtra={
          <div className="flex shrink-0 items-center gap-1">
            {ESTADOS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEstado(estado === e ? '' : e)}
                className={cn(
                  'rounded-lg px-2.5 py-2 text-sm font-medium ring-1 transition',
                  estado === e
                    ? 'bg-wash-brand/10 text-wash-brand ring-wash-brand/30'
                    : 'bg-wash-canvas text-wash-text ring-wash-border hover:bg-wash-border/40'
                )}
              >
                {e}
              </button>
            ))}
          </div>
        }
      />
      <LoadingOverlay visible={loading} label="Cargando novedades…" />

      {loadError ? (
        <ErrorState message={loadError} onRetry={load} />
      ) : (
        <div className="flex-1 overflow-hidden p-3 md:p-6">
          <DataTable
            rows={filtradas}
            columns={columns}
            rowKey={(n) => n.ID}
            onRowClick={(n) => setViendo(n)}
            empty={
              <EmptyState
                icon={Megaphone}
                title={estado ? `Sin novedades ${estado.toLowerCase()}s` : 'Sin novedades'}
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
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {evidencia.map((a) => (
                <VistaArchivo key={a.id} a={a} />
              ))}
            </div>
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

/** Miniatura de un archivo de evidencia: imagen y video se ven en línea; el resto, link. */
function VistaArchivo({ a }: { a: ArchivoEvidencia }) {
  const esImagen = a.mime.startsWith('image/');
  const esVideo = a.mime.startsWith('video/');
  return (
    <div className="overflow-hidden rounded-lg ring-1 ring-wash-border">
      {esImagen && a.url ? (
        <a href={a.url} target="_blank" rel="noreferrer">
          <img src={a.url} alt={a.nombre} className="h-40 w-full bg-wash-canvas object-cover" />
        </a>
      ) : esVideo && a.url ? (
        // El video se sirve desde SharePoint con una URL firmada; `preload="metadata"` evita
        // bajar el archivo entero sólo por abrir el detalle.
        <video src={a.url} controls preload="metadata" className="h-40 w-full bg-black object-contain" />
      ) : (
        <div className="flex h-40 items-center justify-center bg-wash-canvas">
          <Paperclip size={20} className="text-wash-text-faint" />
        </div>
      )}
      <div className="flex items-center justify-between gap-2 px-2 py-1.5">
        <span className="min-w-0 truncate text-[11.5px] text-wash-text" title={a.nombre}>
          {a.nombre}
        </span>
        {a.url && (
          <a
            href={a.url}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-[11.5px] font-semibold text-wash-brand hover:underline"
          >
            Abrir
          </a>
        )}
      </div>
    </div>
  );
}
