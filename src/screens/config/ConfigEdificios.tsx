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
  CheckCircle2,
  Wind,
  CalendarClock,
} from 'lucide-react';
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
import type { Edificio } from '@/types/domain';
import { buildingExtras } from './_helpers';

// --- Derived building row (merges catalog + circuit + visit sources) ---
interface EdificioRow {
  id: string;
  edificio: Edificio | null; // if from the canonical catalog
  nombre: string;
  codigo?: string;
  direccion?: string;
  circuitos: string[];
  frecuencia?: string;
  grupo?: string;
}

interface ConfigEdificiosProps {
  query: string;
  addOpen: boolean;
  setAddOpen: (v: boolean) => void;
}

export function ConfigEdificios({
  query,
  addOpen,
  setAddOpen,
}: ConfigEdificiosProps) {
  const edificios = useAppStore((s) => s.CollectEdificios);
  const detalleCircuitos = useAppStore((s) => s.CollectDetalleCircuito);
  const edificiosVisitar = useAppStore((s) => s.CollectEdificiosVisitar);
  const frecuencias = useAppStore((s) => s.CollectFrecuencias);
  const grupos = useAppStore((s) => s.CollectGruposVentilacion);

  const [viewing, setViewing] = useState<EdificioRow | null>(null);
  const [editing, setEditing] = useState<EdificioRow | null>(null);
  const [deleting, setDeleting] = useState<EdificioRow | null>(null);

  // Merge all unique buildings from catalog + circuit details + visit catalog
  const allRows = useMemo<EdificioRow[]>(() => {
    const byName = new Map<string, EdificioRow>();

    // Visit catalog (richest source — has C-XXXX codes + addresses)
    for (const ev of edificiosVisitar) {
      const key = ev.NombreEdificio_EV;
      if (!byName.has(key)) {
        byName.set(key, {
          id: `ev-${ev.ID}`,
          edificio: null,
          nombre: key,
          codigo: ev.Codigo_EV,
          direccion: ev.Direccion_EV,
          circuitos: [],
        });
      }
    }

    // Circuit-detail catalog
    for (const dc of detalleCircuitos) {
      const key = dc.NombreEdificio_DC;
      if (!byName.has(key)) {
        byName.set(key, {
          id: `dc-${dc.ID}`,
          edificio: null,
          nombre: key,
          direccion: dc.Direccion_DC,
          circuitos: [],
        });
      }
      const row = byName.get(key)!;
      if (dc.Status_DC === 'Activo' && !row.circuitos.includes(dc.NroCircuito_DC)) {
        row.circuitos.push(dc.NroCircuito_DC);
      }
      if (!row.direccion && dc.Direccion_DC) row.direccion = dc.Direccion_DC;
    }

    // Canonical edificios catalog overrides metadata
    for (const e of edificios) {
      const key = e.Edificio;
      if (!byName.has(key)) {
        byName.set(key, {
          id: `e-${e.ID}`,
          edificio: e,
          nombre: key,
          codigo: e.Codigo,
          direccion: e.Direccion,
          circuitos: [],
          frecuencia: e.FrecuenciaVent_ED,
          grupo: e.GrupoVentilacion_ED,
        });
      } else {
        const row = byName.get(key)!;
        row.edificio = e;
        row.codigo = e.Codigo ?? row.codigo;
        row.direccion = e.Direccion ?? row.direccion;
        row.frecuencia = e.FrecuenciaVent_ED ?? row.frecuencia;
        row.grupo = e.GrupoVentilacion_ED ?? row.grupo;
      }
    }

    return Array.from(byName.values()).sort((a, b) =>
      a.nombre.localeCompare(b.nombre, 'es')
    );
  }, [edificios, detalleCircuitos, edificiosVisitar]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return allRows;
    return allRows.filter((r) => {
      return (
        r.nombre.toLowerCase().includes(q) ||
        (r.codigo ?? '').toLowerCase().includes(q) ||
        (r.direccion ?? '').toLowerCase().includes(q) ||
        r.circuitos.some((c) => c.toLowerCase().includes(q))
      );
    });
  }, [allRows, query]);

  const columns: Column<EdificioRow>[] = [
    {
      key: 'codigo',
      header: 'Código',
      width: '110px',
      truncate: false,
      render: (r) =>
        r.codigo ? (
          <span className="inline-flex rounded-md bg-wash-brand/10 px-2 py-0.5 font-mono text-[11px] font-bold text-wash-brand ring-1 ring-wash-brand/20">
            {r.codigo}
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
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wash-surface-2 text-wash-text-muted ring-1 ring-wash-border">
            <Building2 size={13} />
          </span>
          <span className="truncate font-display text-[13px] font-bold text-wash-accent">
            {r.nombre}
          </span>
        </div>
      ),
    },
    {
      key: 'circuito',
      header: 'Circuito',
      width: '130px',
      align: 'center',
      truncate: false,
      render: (r) => {
        if (r.circuitos.length === 0) {
          return <span className="text-[12px] text-wash-text-faint">—</span>;
        }
        const first = r.circuitos[0];
        const extra = r.circuitos.length - 1;
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
      key: 'direccion',
      header: 'Dirección',
      width: 'minmax(180px, 1fr)',
      truncate: false,
      render: (r) =>
        r.direccion ? (
          <span className="flex items-center gap-1.5 truncate text-[12.5px] text-wash-text">
            <MapPin size={11} className="shrink-0 text-wash-text-muted" />
            <span className="truncate uppercase tracking-wide">{r.direccion}</span>
          </span>
        ) : (
          <span className="text-[12px] text-wash-text-faint">—</span>
        ),
    },
    {
      key: 'horario',
      header: 'Horario',
      width: '190px',
      truncate: false,
      render: (r) => {
        const x = buildingExtras(r.nombre);
        return x.horario ? (
          <span className="inline-flex items-center gap-1.5 truncate text-[12px] text-wash-text">
            <Clock size={11} className="shrink-0 text-wash-text-muted" />
            <span className="truncate">{x.horario}</span>
          </span>
        ) : (
          <span className="text-[12px] text-wash-text-faint">—</span>
        );
      },
    },
    {
      key: 'encargado',
      header: 'Encargado',
      width: '200px',
      truncate: false,
      render: (r) => {
        const x = buildingExtras(r.nombre);
        return (
          <span className="flex items-center gap-1.5 truncate text-[12px]">
            <User2 size={11} className="shrink-0 text-wash-text-muted" />
            <span className="truncate font-semibold text-wash-text-strong">
              {x.encargado}
            </span>
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
      render: (r) => (
        <div className="flex items-center justify-end gap-1.5">
          <ActionBtn
            icon={Eye}
            tone="brand"
            title="Ver detalle"
            onClick={(e) => {
              e.stopPropagation();
              setViewing(r);
            }}
          />
          <ActionBtn
            icon={Pencil}
            tone="neutral"
            title="Editar"
            onClick={(e) => {
              e.stopPropagation();
              setEditing(r);
            }}
          />
          <ActionBtn
            icon={Trash2}
            tone="danger"
            title="Eliminar"
            onClick={(e) => {
              e.stopPropagation();
              setDeleting(r);
            }}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex-1 overflow-hidden p-6">
        <DataTable
          rows={filtered}
          rowKey={(r) => r.id}
          columns={columns}
          empty="Sin edificios registrados."
          onRowClick={(r) => setViewing(r)}
        />
      </div>

      {/* Detalle */}
      <EdificioDetailModal
        row={viewing}
        onClose={() => setViewing(null)}
      />

      {/* Crear */}
      <EdificioFormModal
        open={addOpen}
        mode="create"
        frecuencias={frecuencias.map((f) => f.Frecuencia_FE)}
        grupos={grupos.map((g) => g.Grupo_GV)}
        onClose={() => setAddOpen(false)}
        onSave={() => setAddOpen(false)}
      />

      {/* Editar */}
      <EdificioFormModal
        open={!!editing}
        mode="edit"
        row={editing}
        frecuencias={frecuencias.map((f) => f.Frecuencia_FE)}
        grupos={grupos.map((g) => g.Grupo_GV)}
        onClose={() => setEditing(null)}
        onSave={() => setEditing(null)}
      />

      {/* Eliminar */}
      <EliminarEdificioModal
        row={deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => setDeleting(null)}
      />
    </div>
  );
}

// ----- Detalle del edificio modal -----

function EdificioDetailModal({
  row,
  onClose,
}: {
  row: EdificioRow | null;
  onClose: () => void;
}) {
  if (!row) return null;
  const x = buildingExtras(row.nombre);

  return (
    <Modal
      open={!!row}
      onClose={onClose}
      title="Detalles del edificio"
      width={860}
    >
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
              {row.codigo && (
                <span className="inline-flex items-center gap-1 rounded-md bg-wash-brand/10 px-2 py-0.5 font-mono text-[11.5px] font-bold text-wash-brand tabular-nums ring-1 ring-wash-brand/20">
                  <Hash size={10} />
                  {row.codigo}
                </span>
              )}
              {row.circuitos.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md bg-wash-surface-2 px-2 py-0.5 text-[11.5px] font-semibold text-wash-text-strong ring-1 ring-wash-border">
                  <GitBranch size={10} className="text-wash-brand" />
                  Circuito{row.circuitos.length === 1 ? '' : 's'}{' '}
                  {row.circuitos.join(', ')}
                </span>
              )}
            </div>
            <h3 className="mt-1.5 font-display text-[18px] font-black leading-tight text-wash-accent">
              {row.nombre}
            </h3>
            {row.direccion && (
              <p className="mt-1 flex items-center gap-1.5 text-[12px] text-wash-text-muted">
                <MapPin size={12} />
                <span className="uppercase tracking-wide">{row.direccion}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Location + Time */}
      <SectionLabel>Ubicación y horario</SectionLabel>
      <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-3">
        <InfoField icon={Compass} label="Latitud" value={x.lat} mono />
        <InfoField icon={Compass} label="Longitud" value={x.lng} mono />
        <InfoField
          icon={Clock}
          label="Horario"
          value={x.horario ?? '—'}
          muted={!x.horario}
        />
      </div>

      {/* Contact */}
      <SectionLabel>Contacto</SectionLabel>
      <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-3">
        <InfoField icon={User2} label="Encargado" value={x.encargado} />
        <InfoField icon={Mail} label="Mail" value={x.mail ?? '—'} muted={!x.mail} />
        <InfoField icon={Phone} label="Teléfono" value={x.telefono} mono />
      </div>

      {/* Maintenance */}
      <SectionLabel>Mantenimiento</SectionLabel>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <InfoField
          icon={CalendarClock}
          label="Frecuencia"
          value={row.frecuencia ?? '—'}
          muted={!row.frecuencia}
        />
        <InfoField
          icon={Wind}
          label="Grupo ventilación"
          value={row.grupo ?? '—'}
          muted={!row.grupo}
        />
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
            x.observaciones
              ? 'text-wash-text-strong'
              : 'italic text-wash-text-muted'
          )}
        >
          {x.observaciones ?? 'Sin observaciones cargadas.'}
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
  row,
  frecuencias,
  grupos,
  onClose,
  onSave,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  row?: EdificioRow | null;
  frecuencias: string[];
  grupos: string[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [encargado, setEncargado] = useState('');
  const [telefono, setTelefono] = useState('');
  const [mail, setMail] = useState('');
  const [horario, setHorario] = useState('');
  const [frecuencia, setFrecuencia] = useState('');
  const [grupo, setGrupo] = useState('');
  const [obs, setObs] = useState('');

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && row) {
      const x = buildingExtras(row.nombre);
      setCodigo(row.codigo ?? '');
      setNombre(row.nombre);
      setDireccion(row.direccion ?? '');
      setLat(x.lat);
      setLng(x.lng);
      setEncargado(x.encargado);
      setTelefono(x.telefono);
      setMail(x.mail ?? '');
      setHorario(x.horario ?? '');
      setFrecuencia(row.frecuencia ?? '');
      setGrupo(row.grupo ?? '');
      setObs(x.observaciones ?? '');
    } else {
      setCodigo('');
      setNombre('');
      setDireccion('');
      setLat('');
      setLng('');
      setEncargado('');
      setTelefono('');
      setMail('');
      setHorario('');
      setFrecuencia('');
      setGrupo('');
      setObs('');
    }
  }, [open, mode, row]);

  const canSave = !!codigo && !!nombre;

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
            {mode === 'create' ? 'Nuevo edificio' : `Editar ${row?.nombre ?? ''}`}
          </p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-wash-text-muted">
            Completá los datos del edificio, su ubicación y los datos de contacto.
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
      <div className="mt-2 space-y-3">
        <Field label="Dirección">
          <input
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            placeholder="Calle y altura"
            className={inputCls}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Latitud">
            <input
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="-34,600826"
              className={cn(inputCls, 'font-mono tabular-nums')}
            />
          </Field>
          <Field label="Longitud">
            <input
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="-58,419467"
              className={cn(inputCls, 'font-mono tabular-nums')}
            />
          </Field>
        </div>
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
        <Field label="Teléfono">
          <input
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="11XXXXXXXX"
            className={cn(inputCls, 'font-mono tabular-nums')}
          />
        </Field>
        <Field label="Mail">
          <input
            value={mail}
            onChange={(e) => setMail(e.target.value)}
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
              {frecuencias.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Grupo ventilación">
          <Select value={grupo || undefined} onValueChange={setGrupo}>
            <SelectTrigger className="h-10 w-full bg-wash-surface">
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              {grupos.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          disabled={!canSave}
          onClick={onSave}
          className="rounded-lg bg-wash-action px-5 py-2.5 font-semibold text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mode === 'create' ? 'Guardar' : 'Guardar cambios'}
        </button>
      </ModalActions>
    </Modal>
  );
}

// ----- Eliminar modal -----

function EliminarEdificioModal({
  row,
  onClose,
  onConfirm,
}: {
  row: EdificioRow | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal open={!!row} onClose={onClose} width={520}>
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-200">
          <Trash2 size={20} />
        </span>
        <div className="flex-1">
          <h2 className="font-display text-lg font-black text-wash-text-strong">
            Eliminar edificio
          </h2>
          <p className="mt-1 text-sm text-wash-text-muted">
            ¿Eliminar{' '}
            <span className="font-semibold">
              {row?.codigo ? `${row.codigo} · ` : ''}
              {row?.nombre}
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

// ----- Shared bits -----

const inputCls =
  'h-10 w-full rounded-md border border-wash-border bg-wash-surface px-3 text-[13px] font-medium text-wash-text-strong outline-none placeholder:text-wash-text-faint focus:border-wash-brand';

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
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
