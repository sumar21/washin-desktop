import { useEffect, useMemo, useState } from 'react';
import {
  Eye,
  Pencil,
  Trash2,
  Building2,
  MapPin,
  Hash,
  Clock,
  User2,
  Mail,
  Phone,
  Compass,
  StickyNote,
  GitBranch,
  Wind,
  CalendarClock,
  Loader2,
} from 'lucide-react';
import { DataTable, type Column } from '@/components/DataTable';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Modal, ModalActions, ConfirmDialog } from '@/components/Modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import type { EdificioAbm, DetalleCircuitoAbm } from '@/types/domain';
import type { EdificioAbmInput } from '@/services/api';

interface ConfigEdificiosProps {
  query: string;
  addOpen: boolean;
  setAddOpen: (v: boolean) => void;
  /** Solo-lectura si false. Roles como Supervisor Ventilaciones / Atención al Cliente entran acá en modo lectura. */
  canEdit?: boolean;
}

/** Mapa Codigo de edificio → circuitos (NroCircuito) en los que participa. */
function circuitsByBuildingCode(detalles: DetalleCircuitoAbm[]): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (const d of detalles) {
    const cod = d.CodigoEdificio?.trim();
    if (!cod) continue;
    const arr = map.get(cod) ?? [];
    if (!arr.includes(d.NroCircuito)) arr.push(d.NroCircuito);
    map.set(cod, arr);
  }
  for (const arr of map.values()) arr.sort((a, b) => a - b);
  return map;
}

export function ConfigEdificios({
  query,
  addOpen,
  setAddOpen,
  canEdit = false,
}: ConfigEdificiosProps) {
  const edificios = useAppStore((s) => s.CollectAbmEdificios);
  const detalles = useAppStore((s) => s.CollectAbmDetalles);
  const frecuencias = useAppStore((s) => s.AbmFrecuencias);
  const grupos = useAppStore((s) => s.AbmGrupos);
  const createEdificio = useAppStore((s) => s.createEdificio);
  const updateEdificio = useAppStore((s) => s.updateEdificio);
  const bajaEdificio = useAppStore((s) => s.bajaEdificio);

  const [viewing, setViewing] = useState<EdificioAbm | null>(null);
  const [editing, setEditing] = useState<EdificioAbm | null>(null);
  const [deleting, setDeleting] = useState<EdificioAbm | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const circuitosByCodigo = useMemo(() => circuitsByBuildingCode(detalles), [detalles]);
  const circuitosDe = (e: EdificioAbm) =>
    (e.Codigo?.trim() && circuitosByCodigo.get(e.Codigo.trim())) || [];

  const rows = useMemo(() => {
    const q = query.toLowerCase().trim();
    const list = q
      ? edificios.filter(
          (e) =>
            e.Edificio.toLowerCase().includes(q) ||
            e.Codigo.toLowerCase().includes(q) ||
            e.Direccion.toLowerCase().includes(q)
        )
      : edificios;
    return [...list].sort((a, b) => a.Edificio.localeCompare(b.Edificio, 'es'));
  }, [edificios, query]);

  const handleBaja = async () => {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await bajaEdificio(deleting.ID);
      setDeleting(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'No se pudo dar de baja el edificio.');
    } finally {
      setDeleteBusy(false);
    }
  };

  const columns: Column<EdificioAbm>[] = [
    {
      key: 'codigo',
      header: 'Código',
      width: '110px',
      truncate: false,
      render: (e) =>
        e.Codigo ? (
          <span className="inline-flex rounded-md bg-wash-brand/10 px-2 py-0.5 font-mono text-[11px] font-bold text-wash-brand ring-1 ring-wash-brand/20">
            {e.Codigo}
          </span>
        ) : (
          <span className="text-wash-text-faint">—</span>
        ),
    },
    {
      key: 'edificio',
      header: 'Edificio',
      width: 'minmax(200px, 1.4fr)',
      truncate: false,
      render: (e) => (
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wash-surface-2 text-wash-text-muted ring-1 ring-wash-border">
            <Building2 size={13} />
          </span>
          <span className="truncate font-display text-[13px] font-bold text-wash-accent">
            {e.Edificio}
          </span>
        </div>
      ),
    },
    {
      key: 'direccion',
      header: 'Dirección',
      width: 'minmax(180px, 1fr)',
      truncate: false,
      render: (e) =>
        e.Direccion ? (
          <span className="flex items-center gap-1.5 truncate text-[12.5px] text-wash-text">
            <MapPin size={11} className="shrink-0 text-wash-text-muted" />
            <span className="truncate uppercase tracking-wide">{e.Direccion}</span>
          </span>
        ) : (
          <span className="text-[12px] text-wash-text-faint">—</span>
        ),
    },
    {
      key: 'ventilacion',
      header: 'Ventilación',
      width: '200px',
      truncate: false,
      render: (e) => {
        const hasGrupo = !!e.Grupo?.trim();
        const hasFrec = !!e.Frecuencia?.trim();
        if (!hasGrupo && !hasFrec) {
          return <span className="text-[12px] text-wash-text-faint">—</span>;
        }
        return (
          <div className="flex flex-col gap-1">
            {hasGrupo && (
              <span className="inline-flex w-fit items-center gap-1 rounded-md bg-wash-surface-2 px-2 py-0.5 text-[11.5px] font-semibold text-wash-text-strong ring-1 ring-wash-border">
                <Wind size={10} className="text-wash-brand" />
                {e.Grupo}
              </span>
            )}
            {hasFrec && (
              <span className="inline-flex items-center gap-1 text-[11px] text-wash-text-muted">
                <CalendarClock size={10} />
                cada {e.Frecuencia} días
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'circuito',
      header: 'Circuito',
      width: '130px',
      align: 'center',
      truncate: false,
      render: (e) => {
        const cs = circuitosDe(e);
        if (cs.length === 0) {
          return <span className="text-[12px] text-wash-text-faint">—</span>;
        }
        const first = cs[0];
        const extra = cs.length - 1;
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-wash-surface-2 px-2 py-1 text-[11.5px] font-bold text-wash-text-strong tabular-nums ring-1 ring-wash-border">
            <GitBranch size={10} className="text-wash-brand" />
            {first}
            {extra > 0 && (
              <span className="ml-0.5 rounded bg-wash-brand/15 px-1 text-[9.5px] font-bold text-wash-brand">
                +{extra}
              </span>
            )}
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
      render: (e) => (
        <div className="flex items-center justify-end gap-1.5">
          <ActionBtn
            icon={Eye}
            tone="brand"
            title="Ver detalle"
            onClick={(ev) => {
              ev.stopPropagation();
              setViewing(e);
            }}
          />
          {canEdit && (
            <>
              <ActionBtn
                icon={Pencil}
                tone="neutral"
                title="Editar"
                onClick={(ev) => {
                  ev.stopPropagation();
                  setEditing(e);
                }}
              />
              <ActionBtn
                icon={Trash2}
                tone="danger"
                title="Dar de baja"
                onClick={(ev) => {
                  ev.stopPropagation();
                  setDeleting(e);
                  setDeleteError(null);
                }}
              />
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex-1 overflow-hidden p-4 sm:p-6">
        <DataTable
          rows={rows}
          rowKey={(r) => r.ID}
          columns={columns}
          empty={
            <EmptyState
              icon={Building2}
              title="Sin edificios"
              description="No encontramos edificios que coincidan con la búsqueda."
              action={canEdit && <Button onClick={() => setAddOpen(true)}>Agregar edificio</Button>}
            />
          }
          onRowClick={(r) => setViewing(r)}
          mobileCard={(e) => {
            const cs = circuitosDe(e);
            const hasGrupo = !!e.Grupo?.trim();
            const hasFrec = !!e.Frecuencia?.trim();
            return (
              <div
                onClick={() => setViewing(e)}
                className="rounded-xl bg-wash-surface p-3 shadow-sm ring-1 ring-wash-border transition active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-wash-surface-2 text-wash-text-muted ring-1 ring-wash-border">
                      <Building2 size={14} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {e.Codigo && (
                          <span className="shrink-0 rounded bg-wash-brand/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-wash-brand ring-1 ring-wash-brand/20">
                            {e.Codigo}
                          </span>
                        )}
                        {cs.length > 0 && (
                          <span className="inline-flex items-center gap-1 rounded bg-wash-surface-2 px-1.5 py-0.5 text-[10px] font-bold text-wash-text-strong tabular-nums ring-1 ring-wash-border">
                            <GitBranch size={9} className="text-wash-brand" />
                            {cs.join(', ')}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate font-display text-[14px] font-bold text-wash-accent">{e.Edificio}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <ActionBtn icon={Eye} tone="brand" title="Ver detalle" onClick={(ev) => { ev.stopPropagation(); setViewing(e); }} />
                    {canEdit && (
                      <>
                        <ActionBtn icon={Pencil} tone="neutral" title="Editar" onClick={(ev) => { ev.stopPropagation(); setEditing(e); }} />
                        <ActionBtn icon={Trash2} tone="danger" title="Dar de baja" onClick={(ev) => { ev.stopPropagation(); setDeleting(e); setDeleteError(null); }} />
                      </>
                    )}
                  </div>
                </div>
                {e.Direccion && (
                  <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-wash-text-muted">
                    <MapPin size={11} className="shrink-0" />
                    <span className="truncate uppercase tracking-wide">{e.Direccion}</span>
                  </p>
                )}
                {(hasGrupo || hasFrec) && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {hasGrupo && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-wash-surface-2 px-2 py-0.5 text-[11px] font-semibold text-wash-text-strong ring-1 ring-wash-border">
                        <Wind size={10} className="text-wash-brand" />
                        {e.Grupo}
                      </span>
                    )}
                    {hasFrec && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-wash-surface-2 px-2 py-0.5 text-[11px] text-wash-text-muted">
                        <CalendarClock size={10} />
                        cada {e.Frecuencia} días
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          }}
        />
      </div>

      {/* Detalle */}
      <EdificioDetailModal
        edificio={viewing}
        circuitos={viewing ? circuitosDe(viewing) : []}
        onClose={() => setViewing(null)}
      />

      {/* Crear */}
      <EdificioFormModal
        open={addOpen}
        mode="create"
        frecuencias={frecuencias}
        grupos={grupos}
        onClose={() => setAddOpen(false)}
        onSubmit={async (payload) => {
          await createEdificio(payload);
          setAddOpen(false);
        }}
      />

      {/* Editar */}
      <EdificioFormModal
        open={!!editing}
        mode="edit"
        edificio={editing}
        frecuencias={frecuencias}
        grupos={grupos}
        onClose={() => setEditing(null)}
        onSubmit={async (payload) => {
          if (!editing) return;
          await updateEdificio(editing.ID, payload);
          setEditing(null);
        }}
      />

      {/* Baja */}
      <ConfirmDialog
        open={!!deleting}
        tone="danger"
        title="Dar de baja edificio"
        message={
          deleting
            ? `¿Dar de baja ${deleting.Codigo ? `${deleting.Codigo} · ` : ''}${deleting.Edificio}? El edificio se marca como BAJA y deja de estar disponible.`
            : ''
        }
        confirmLabel={deleteBusy ? 'Dando de baja…' : 'Dar de baja'}
        busy={deleteBusy}
        error={deleteError}
        onCancel={() => {
          setDeleting(null);
          setDeleteError(null);
        }}
        onConfirm={handleBaja}
      />
    </div>
  );
}

// ----- Detalle del edificio modal -----

function EdificioDetailModal({
  edificio,
  circuitos,
  onClose,
}: {
  edificio: EdificioAbm | null;
  circuitos: number[];
  onClose: () => void;
}) {
  if (!edificio) return null;

  return (
    <Modal open={!!edificio} onClose={onClose} title="Detalles del edificio" width={860}>
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-wash-brand/[0.08] via-wash-surface to-wash-surface-2/30 p-5 ring-1 ring-wash-border">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-wash-brand/10 blur-3xl"
        />
        <div className="relative flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-wash-brand to-wash-brand-dark text-white shadow-md shadow-wash-brand/25 ring-2 ring-wash-surface">
            <Building2 size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {edificio.Codigo && (
                <span className="inline-flex items-center gap-1 rounded-md bg-wash-brand/10 px-2 py-0.5 font-mono text-[11.5px] font-bold text-wash-brand tabular-nums ring-1 ring-wash-brand/20">
                  <Hash size={10} />
                  {edificio.Codigo}
                </span>
              )}
              {circuitos.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md bg-wash-surface-2 px-2 py-0.5 text-[11.5px] font-semibold text-wash-text-strong ring-1 ring-wash-border">
                  <GitBranch size={10} className="text-wash-brand" />
                  Circuito{circuitos.length === 1 ? '' : 's'} {circuitos.join(', ')}
                </span>
              )}
            </div>
            <h3 className="mt-1.5 font-display text-[18px] font-black leading-tight text-wash-accent">
              {edificio.Edificio}
            </h3>
            {edificio.Direccion && (
              <p className="mt-1 flex items-center gap-1.5 text-[12px] text-wash-text-muted">
                <MapPin size={12} />
                <span className="uppercase tracking-wide">{edificio.Direccion}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Location + Time */}
      <SectionLabel>Ubicación y horario</SectionLabel>
      <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-3">
        <InfoField icon={Compass} label="Latitud" value={edificio.Latitud || '—'} muted={!edificio.Latitud} mono />
        <InfoField icon={Compass} label="Longitud" value={edificio.Longitud || '—'} muted={!edificio.Longitud} mono />
        <InfoField icon={Clock} label="Horario" value={edificio.Horario || '—'} muted={!edificio.Horario} />
      </div>

      {/* Contact */}
      <SectionLabel>Contacto</SectionLabel>
      <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-3">
        <InfoField icon={User2} label="Encargado" value={edificio.Encargado || '—'} muted={!edificio.Encargado} />
        <InfoField icon={Mail} label="Correo" value={edificio.Correo || '—'} muted={!edificio.Correo} />
        <InfoField icon={Phone} label="Celular" value={edificio.Celular || '—'} muted={!edificio.Celular} mono />
      </div>

      {/* Maintenance */}
      <SectionLabel>Mantenimiento</SectionLabel>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <InfoField
          icon={CalendarClock}
          label="Frecuencia"
          value={edificio.Frecuencia ? `${edificio.Frecuencia} días` : '—'}
          muted={!edificio.Frecuencia}
        />
        <InfoField icon={Wind} label="Grupo ventilación" value={edificio.Grupo || '—'} muted={!edificio.Grupo} />
      </div>

      {/* Observaciones */}
      <SectionLabel>Observaciones</SectionLabel>
      <div className="mt-2 flex items-start gap-3 rounded-xl bg-wash-surface-2/40 p-4 ring-1 ring-wash-border">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wash-surface text-wash-text-muted ring-1 ring-wash-border">
          <StickyNote size={13} />
        </span>
        <p
          className={cn(
            'flex-1 text-[13px] leading-relaxed',
            edificio.Observaciones ? 'text-wash-text-strong' : 'italic text-wash-text-muted'
          )}
        >
          {edificio.Observaciones || 'Sin observaciones cargadas.'}
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

// ----- Crear / Editar edificio modal -----

function EdificioFormModal({
  open,
  mode,
  edificio,
  frecuencias,
  grupos,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  edificio?: EdificioAbm | null;
  frecuencias: string[];
  grupos: string[];
  onClose: () => void;
  onSubmit: (payload: EdificioAbmInput) => Promise<void>;
}) {
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [encargado, setEncargado] = useState('');
  const [celular, setCelular] = useState('');
  const [correo, setCorreo] = useState('');
  const [horario, setHorario] = useState('');
  const [frecuencia, setFrecuencia] = useState('');
  const [grupo, setGrupo] = useState('');
  const [obs, setObs] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicia el form al abrir el modal.
    setError(null);
    setSaving(false);
    if (mode === 'edit' && edificio) {
      setCodigo(edificio.Codigo ?? '');
      setNombre(edificio.Edificio ?? '');
      setDireccion(edificio.Direccion ?? '');
      setEncargado(edificio.Encargado ?? '');
      setCelular(edificio.Celular ?? '');
      setCorreo(edificio.Correo ?? '');
      setHorario(edificio.Horario ?? '');
      setFrecuencia(edificio.Frecuencia ?? '');
      setGrupo(edificio.Grupo ?? '');
      setObs(edificio.Observaciones ?? '');
    } else {
      setCodigo('');
      setNombre('');
      setDireccion('');
      setEncargado('');
      setCelular('');
      setCorreo('');
      setHorario('');
      setFrecuencia('');
      setGrupo('');
      setObs('');
    }
  }, [open, mode, edificio]);

  // El select siempre debe poder mostrar el valor actual, aunque ya no esté activo.
  const frecOptions = useMemo(() => {
    const set = new Set(frecuencias.filter((f) => f.trim()));
    if (frecuencia.trim()) set.add(frecuencia.trim());
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [frecuencias, frecuencia]);

  const canSave = !!nombre.trim() && !!codigo.trim();

  const handleSubmit = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        edificio: nombre.trim(),
        codigo: codigo.trim(),
        direccion: direccion.trim(),
        horario: horario.trim(),
        encargado: encargado.trim(),
        celular: celular.trim(),
        correo: correo.trim(),
        observaciones: obs.trim(),
        grupo: grupo.trim(),
        frecuencia: frecuencia.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el edificio.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'Crear edificio' : 'Editar edificio'}
      width={820}
    >
      {/* Intro */}
      <div className="flex items-start gap-3 rounded-xl bg-wash-brand/[0.06] p-3.5 ring-1 ring-wash-brand/15">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wash-brand/15 text-wash-brand ring-1 ring-wash-brand/25">
          <Building2 size={14} />
        </span>
        <div>
          <p className="font-display text-[13px] font-bold text-wash-accent">
            {mode === 'create' ? 'Nuevo edificio' : `Editar ${edificio?.Edificio ?? ''}`}
          </p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-wash-text-muted">
            Completá los datos del edificio, su contacto y su grupo/frecuencia de ventilación.
          </p>
        </div>
      </div>

      {/* Identificación */}
      <SectionLabel>Identificación</SectionLabel>
      <div className="mt-2 grid grid-cols-[160px_1fr] gap-3">
        <Field label="Código">
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="C-XXXX"
            className={inputCls}
          />
        </Field>
        <Field label="Edificio">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre del edificio"
            className={inputCls}
          />
        </Field>
      </div>

      {/* Ubicación */}
      <SectionLabel>Ubicación</SectionLabel>
      <div className="mt-2">
        <Field label="Dirección">
          <input
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            placeholder="Calle y altura"
            className={inputCls}
          />
        </Field>
      </div>

      {/* Contacto */}
      <SectionLabel>Contacto</SectionLabel>
      <div className="mt-2 grid grid-cols-3 gap-3">
        <Field label="Encargado">
          <input
            value={encargado}
            onChange={(e) => setEncargado(e.target.value)}
            placeholder="Nombre"
            className={inputCls}
          />
        </Field>
        <Field label="Celular">
          <input
            value={celular}
            onChange={(e) => setCelular(e.target.value)}
            placeholder="11XXXXXXXX"
            className={cn(inputCls, 'font-mono tabular-nums')}
          />
        </Field>
        <Field label="Correo">
          <input
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            placeholder="mail@ejemplo.com"
            className={inputCls}
          />
        </Field>
      </div>

      {/* Mantenimiento */}
      <SectionLabel>Mantenimiento</SectionLabel>
      <div className="mt-2 grid grid-cols-3 gap-3">
        <Field label="Horario">
          <input
            value={horario}
            onChange={(e) => setHorario(e.target.value)}
            placeholder="Ej: 8 a 13 Hs"
            className={inputCls}
          />
        </Field>
        <Field label="Frecuencia">
          <Select value={frecuencia || undefined} onValueChange={setFrecuencia}>
            <SelectTrigger className="h-10 w-full bg-wash-surface">
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              {frecOptions.map((f) => (
                <SelectItem key={f} value={f}>
                  {f} días
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Grupo ventilación">
          <input
            value={grupo}
            onChange={(e) => setGrupo(e.target.value)}
            list="edificio-grupos-vent"
            placeholder="Grupo"
            className={inputCls}
          />
          <datalist id="edificio-grupos-vent">
            {grupos.filter((g) => g.trim()).map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </Field>
      </div>

      {/* Observaciones */}
      <SectionLabel>Observaciones</SectionLabel>
      <div className="mt-2">
        <textarea
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          placeholder="Aclaraciones, contactos secundarios, restricciones de acceso…"
          rows={3}
          className="w-full resize-none rounded-md border border-wash-border bg-wash-surface-2/40 px-3 py-2.5 text-[13px] text-wash-text-strong placeholder:text-wash-text-faint outline-none focus:border-wash-brand focus:bg-wash-surface"
        />
      </div>

      {error && (
        <p className="mt-3 rounded-r-md border-l-4 border-red-500 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700">
          {error}
        </p>
      )}

      <ModalActions>
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="rounded-lg border border-wash-border px-5 py-2.5 font-medium text-wash-text-strong hover:bg-wash-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!canSave || saving}
          onClick={handleSubmit}
          className="inline-flex items-center rounded-lg bg-wash-action px-5 py-2.5 font-semibold text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          {saving ? 'Guardando…' : mode === 'create' ? 'Guardar' : 'Guardar cambios'}
        </button>
      </ModalActions>
    </Modal>
  );
}

// ----- Shared bits -----

const inputCls =
  'h-10 w-full rounded-md border border-wash-border bg-wash-surface px-3 text-[13px] font-medium text-wash-text-strong outline-none placeholder:text-wash-text-faint focus:border-wash-brand';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-5 text-[10.5px] font-bold uppercase tracking-wider text-wash-text-muted">
      {children}
    </p>
  );
}

function InfoField({
  icon: Icon,
  label,
  value,
  mono,
  muted,
}: {
  icon: typeof Hash;
  label: string;
  value: string;
  mono?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="rounded-xl bg-wash-surface-2/40 p-3 ring-1 ring-wash-border">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-wash-text-muted">
        <Icon size={11} />
        {label}
      </p>
      <p
        className={cn(
          'mt-1 truncate text-[13px] font-semibold',
          muted ? 'text-wash-text-faint' : 'text-wash-text-strong',
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
    brand: 'text-wash-brand ring-wash-brand/30 hover:bg-wash-brand/10 hover:ring-wash-brand',
    danger: 'text-rose-600 ring-rose-500/30 hover:bg-rose-500/10 hover:ring-rose-500',
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn('flex h-8 w-8 items-center justify-center rounded-lg ring-1 transition', cls)}
    >
      <Icon size={15} />
    </button>
  );
}
