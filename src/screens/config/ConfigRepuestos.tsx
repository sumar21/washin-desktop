import { useCallback, useEffect, useMemo, useState } from 'react';
import { Wrench, Pencil, Trash2, Hash, Tag, DollarSign, AlertCircle } from 'lucide-react';
import { DataTable, type Column } from '@/components/DataTable';
import { Modal, ModalActions, ConfirmDialog } from '@/components/Modal';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { ErrorState } from '@/components/ErrorState';
import { useAppStore } from '@/store/useAppStore';
import { cn, proper } from '@/lib/utils';
import type { Repuesto } from '@/types/domain';
import type { RepuestoAbmInput } from '@/services/api';

interface ConfigRepuestosProps {
  query: string;
  addOpen: boolean;
  setAddOpen: (v: boolean) => void;
  canEdit?: boolean;
}

/** Formatea un precio como moneda argentina ($ 1.234,50). */
function formatPrecio(n: number): string {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ConfigRepuestos({ query, addOpen, setAddOpen, canEdit = false }: ConfigRepuestosProps) {
  const repuestos = useAppStore((s) => s.CollectRepuestos);
  const fetchRepuestos = useAppStore((s) => s.fetchRepuestos);
  const createRepuesto = useAppStore((s) => s.createRepuesto);
  const updateRepuesto = useAppStore((s) => s.updateRepuesto);
  const bajaRepuesto = useAppStore((s) => s.bajaRepuesto);

  const [editing, setEditing] = useState<Repuesto | null>(null);
  const [deleting, setDeleting] = useState<Repuesto | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // El shell de Configuración carga rutas/circuitos/edificios; repuestos se traen acá.
  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return fetchRepuestos()
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo cargar el catálogo de repuestos.'))
      .finally(() => setLoading(false));
  }, [fetchRepuestos]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial; "Reintentar" también dispara load().
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar.
  }, []);

  const rows = useMemo(() => {
    const q = query.toLowerCase().trim();
    const list = q
      ? repuestos.filter(
          (r) =>
            r.Nombre_RP.toLowerCase().includes(q) ||
            r.Codigo_RP.toLowerCase().includes(q) ||
            r.Marca_RP.toLowerCase().includes(q) ||
            r.ConcatRepuesto_RP.toLowerCase().includes(q)
        )
      : repuestos;
    return [...list].sort((a, b) => a.Nombre_RP.localeCompare(b.Nombre_RP, 'es'));
  }, [repuestos, query]);

  const columns: Column<Repuesto>[] = [
    {
      key: 'codigo',
      header: 'Código',
      width: '120px',
      truncate: false,
      render: (r) =>
        r.Codigo_RP ? (
          <span className="inline-flex rounded-md bg-wash-brand/10 px-2 py-0.5 font-mono text-[11px] font-bold text-wash-brand ring-1 ring-wash-brand/20">
            {r.Codigo_RP}
          </span>
        ) : (
          <span className="text-wash-text-faint">—</span>
        ),
    },
    {
      key: 'nombre',
      header: 'Repuesto',
      width: 'minmax(240px, 1.8fr)',
      render: (r) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wash-surface-2 text-wash-text-muted ring-1 ring-wash-border">
            <Wrench size={13} />
          </span>
          <div className="min-w-0">
            <div className="truncate font-display text-[13px] font-bold text-wash-accent">
              {proper(r.Nombre_RP) || r.ConcatRepuesto_RP || '—'}
            </div>
            {r.Marca_RP && <div className="truncate text-[11px] text-wash-text-muted">{proper(r.Marca_RP)}</div>}
          </div>
        </div>
      ),
    },
    {
      key: 'precio',
      header: 'Precio',
      width: '160px',
      align: 'right',
      truncate: false,
      render: (r) => (
        <span
          className={cn(
            'font-display text-[13.5px] font-bold tabular-nums',
            r.Precio_RP > 0 ? 'text-wash-text-strong' : 'text-wash-text-faint'
          )}
        >
          {formatPrecio(r.Precio_RP)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      width: '110px',
      align: 'right',
      truncate: false,
      render: (r) =>
        canEdit ? (
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={(ev) => {
                ev.stopPropagation();
                setEditing(r);
              }}
              title="Editar repuesto"
              aria-label={`Editar ${proper(r.Nombre_RP)}`}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-wash-text-muted ring-1 ring-wash-border transition hover:bg-wash-brand/10 hover:text-wash-brand hover:ring-wash-brand/40"
            >
              <Pencil size={15} />
            </button>
            <button
              type="button"
              onClick={(ev) => {
                ev.stopPropagation();
                setDeleting(r);
              }}
              title="Dar de baja"
              aria-label={`Dar de baja ${proper(r.Nombre_RP)}`}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-rose-600 ring-1 ring-rose-500/30 transition hover:bg-rose-500/10 hover:ring-rose-500"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ) : (
          <span className="block text-right text-wash-text-faint">—</span>
        ),
    },
  ];

  return (
    <div className="relative h-full">
      <LoadingOverlay visible={loading} label="Cargando repuestos…" />

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <div className="h-full p-4 sm:p-6">
          <DataTable
            rows={rows}
            rowKey={(r) => r.ID}
            columns={columns}
            empty="Sin repuestos en el catálogo."
            onRowClick={canEdit ? (r) => setEditing(r) : undefined}
            mobileCard={(r) => (
              <div
                onClick={canEdit ? () => setEditing(r) : undefined}
                className={cn(
                  'rounded-xl bg-wash-surface p-3 shadow-sm ring-1 ring-wash-border transition',
                  canEdit && 'active:scale-[0.99]'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-wash-surface-2 text-wash-text-muted ring-1 ring-wash-border">
                      <Wrench size={14} />
                    </span>
                    <div className="min-w-0">
                      {r.Codigo_RP && (
                        <span className="inline-flex rounded bg-wash-brand/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-wash-brand ring-1 ring-wash-brand/20">
                          {r.Codigo_RP}
                        </span>
                      )}
                      <p className="mt-0.5 truncate font-display text-[14px] font-bold text-wash-accent">
                        {proper(r.Nombre_RP) || r.ConcatRepuesto_RP || '—'}
                      </p>
                      {r.Marca_RP && <p className="truncate text-[11px] text-wash-text-muted">{proper(r.Marca_RP)}</p>}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setEditing(r);
                        }}
                        aria-label="Editar"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-wash-text-muted ring-1 ring-wash-border transition hover:bg-wash-brand/10 hover:text-wash-brand hover:ring-wash-brand/40"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setDeleting(r);
                        }}
                        aria-label="Dar de baja"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-rose-600 ring-1 ring-rose-500/30 transition hover:bg-rose-500/10 hover:ring-rose-500"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="mt-2.5 flex items-center justify-end border-t border-wash-divider/60 pt-2.5">
                  <span
                    className={cn(
                      'font-display text-[14px] font-bold tabular-nums',
                      r.Precio_RP > 0 ? 'text-wash-brand' : 'text-wash-text-faint'
                    )}
                  >
                    {formatPrecio(r.Precio_RP)}
                  </span>
                </div>
              </div>
            )}
          />
        </div>
      )}

      {/* Alta */}
      <RepuestoFormModal
        open={addOpen}
        repuesto={null}
        onClose={() => setAddOpen(false)}
        onSave={async (payload) => {
          await createRepuesto(payload);
          setAddOpen(false);
        }}
      />

      {/* Modificación */}
      <RepuestoFormModal
        open={!!editing}
        repuesto={editing}
        onClose={() => setEditing(null)}
        onSave={async (payload) => {
          if (!editing) return;
          await updateRepuesto(editing.ID, payload);
          setEditing(null);
        }}
      />

      {/* Baja */}
      <ConfirmDialog
        open={!!deleting}
        tone="danger"
        title="Dar de baja repuesto"
        message={
          deleting
            ? `¿Dar de baja "${proper(deleting.Nombre_RP)}"? Deja de estar disponible en el catálogo (no se borra el historial).`
            : ''
        }
        confirmLabel={deleteBusy ? 'Procesando…' : 'Dar de baja'}
        busy={deleteBusy}
        error={deleteError}
        onCancel={() => {
          setDeleting(null);
          setDeleteError(null);
        }}
        onConfirm={async () => {
          if (!deleting || deleteBusy) return;
          setDeleteBusy(true);
          setDeleteError(null);
          try {
            await bajaRepuesto(deleting.ID);
            setDeleting(null);
          } catch (err) {
            setDeleteError(err instanceof Error ? err.message : 'No se pudo dar de baja el repuesto.');
          } finally {
            setDeleteBusy(false);
          }
        }}
      />
    </div>
  );
}

// ----- Alta / edición -----

function RepuestoFormModal({
  open,
  repuesto,
  onClose,
  onSave,
}: {
  open: boolean;
  repuesto: Repuesto | null;
  onClose: () => void;
  onSave: (payload: RepuestoAbmInput) => Promise<void>;
}) {
  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');
  const [marca, setMarca] = useState('');
  const [precio, setPrecio] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetea el form al abrir.
    setNombre(repuesto?.Nombre_RP ?? '');
    setCodigo(repuesto?.Codigo_RP ?? '');
    setMarca(repuesto?.Marca_RP ?? '');
    setPrecio(repuesto && repuesto.Precio_RP > 0 ? String(repuesto.Precio_RP) : '');
    setError(null);
    setSaving(false);
  }, [open, repuesto]);

  const precioNum = precio.trim() === '' ? 0 : Number(precio.replace(',', '.'));
  const precioValido = precio.trim() === '' || (Number.isFinite(precioNum) && precioNum >= 0);
  const valido = nombre.trim() !== '' && precioValido;

  const handleSave = async () => {
    if (!valido || saving) return;
    setSaving(true);
    setError(null);
    try {
      // El precio solo se envía si es > 0: la columna Precio_RP puede no existir aún
      // en SharePoint (se crea a mano) y escribir 0 haría fallar el alta/edición.
      await onSave({
        nombre: nombre.trim(),
        codigo: codigo.trim(),
        marca: marca.trim(),
        ...(precioNum > 0 ? { precio: Math.round(precioNum * 100) / 100 } : {}),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el repuesto.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={repuesto ? `Editar — ${proper(repuesto.Nombre_RP)}` : 'Agregar repuesto'} width={480}>
      {error && (
        <div
          role="alert"
          className="mb-3 flex items-center gap-2 rounded-r-md border-l-4 border-red-500 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700"
        >
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-3.5">
        <Field label="Nombre del repuesto" icon={Wrench}>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            autoFocus
            placeholder="Ej. Correa de transmisión"
            className="w-full min-w-0 flex-1 bg-wash-surface px-3 py-2 text-sm outline-none"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Código" icon={Hash}>
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="C-1234"
              className="w-full min-w-0 flex-1 bg-wash-surface px-3 py-2 text-sm outline-none"
            />
          </Field>
          <Field label="Marca" icon={Tag}>
            <input
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
              placeholder="Opcional"
              className="w-full min-w-0 flex-1 bg-wash-surface px-3 py-2 text-sm outline-none"
            />
          </Field>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-wash-text-muted">Precio unitario</label>
          <div className="mt-1.5 flex items-stretch overflow-hidden rounded-lg border border-wash-border focus-within:border-wash-brand focus-within:ring-2 focus-within:ring-wash-brand/15">
            <span className="flex w-10 shrink-0 items-center justify-center bg-wash-surface-2 text-wash-text-muted">
              <DollarSign size={15} />
            </span>
            <input
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
              }}
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              aria-label="Precio unitario"
              className="w-full min-w-0 flex-1 bg-wash-surface px-3 py-2 text-right text-base font-bold tabular-nums outline-none"
            />
          </div>
          <p className="mt-1.5 text-[11px] text-wash-text-muted">El stock se administra en el módulo de Stock, no acá.</p>
        </div>
      </div>

      <ModalActions>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-wash-border px-4 py-2 font-medium text-wash-text-strong hover:bg-wash-surface-2"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!valido || saving}
          onClick={handleSave}
          className="rounded-lg bg-wash-action px-4 py-2 font-medium text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Guardando…' : repuesto ? 'Guardar cambios' : 'Crear repuesto'}
        </button>
      </ModalActions>
    </Modal>
  );
}

function Field({ label, icon: Icon, children }: { label: string; icon: typeof Wrench; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wider text-wash-text-muted">{label}</label>
      <div className="mt-1.5 flex items-stretch overflow-hidden rounded-lg border border-wash-border focus-within:border-wash-brand focus-within:ring-2 focus-within:ring-wash-brand/15">
        <span className="flex w-10 shrink-0 items-center justify-center bg-wash-surface-2 text-wash-text-muted">
          <Icon size={15} />
        </span>
        {children}
      </div>
    </div>
  );
}
