import { useCallback, useEffect, useMemo, useState } from 'react';
import { UserCog, User, Pencil, Trash2, Phone, Mail, KeyRound, Shield, AlertCircle, Loader2 } from 'lucide-react';
import { DataTable, type Column } from '@/components/DataTable';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Modal, ModalActions, ConfirmDialog } from '@/components/Modal';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { ErrorState } from '@/components/ErrorState';
import { useAppStore } from '@/store/useAppStore';
import { cn, proper } from '@/lib/utils';
import { USER_ROLES, type Usuario } from '@/types/domain';
import type { UsuarioAbmInput } from '@/services/api';

interface ConfigUsuariosProps {
  query: string;
  addOpen: boolean;
  setAddOpen: (v: boolean) => void;
  canEdit?: boolean;
}

const nombreCompleto = (u: Usuario) => u.Concat_Nombre_Apellido || `${u.Nombre} ${u.Apellido}`.trim() || u.Usuario;

export function ConfigUsuarios({ query, addOpen, setAddOpen, canEdit = false }: ConfigUsuariosProps) {
  const usuarios = useAppStore((s) => s.CollectUsuarios);
  const fetchUsuarios = useAppStore((s) => s.fetchUsuarios);
  const createUsuario = useAppStore((s) => s.createUsuario);
  const updateUsuario = useAppStore((s) => s.updateUsuario);
  const bajaUsuario = useAppStore((s) => s.bajaUsuario);

  const [editing, setEditing] = useState<Usuario | null>(null);
  const [deleting, setDeleting] = useState<Usuario | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return fetchUsuarios()
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo cargar los usuarios.'))
      .finally(() => setLoading(false));
  }, [fetchUsuarios]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial; "Reintentar" también dispara load().
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar.
  }, []);

  const rows = useMemo(() => {
    const q = query.toLowerCase().trim();
    const list = q
      ? usuarios.filter(
          (u) =>
            u.Usuario.toLowerCase().includes(q) ||
            nombreCompleto(u).toLowerCase().includes(q) ||
            u.Rol.toLowerCase().includes(q) ||
            (u.Email ?? '').toLowerCase().includes(q) ||
            (u.Telefono ?? '').toLowerCase().includes(q)
        )
      : usuarios;
    return [...list].sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b), 'es'));
  }, [usuarios, query]);

  const columns: Column<Usuario>[] = [
    {
      key: 'nombre',
      header: 'Usuario',
      width: 'minmax(240px, 1.8fr)',
      render: (u) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wash-surface-2 text-wash-text-muted ring-1 ring-wash-border">
            <User size={14} />
          </span>
          <div className="min-w-0">
            <div className="truncate font-display text-[13px] font-bold text-wash-accent">{proper(nombreCompleto(u))}</div>
            <div className="truncate font-mono text-[11px] text-wash-text-muted">{u.Usuario}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'rol',
      header: 'Rol',
      width: '200px',
      truncate: false,
      render: (u) => (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-wash-brand/10 px-2 py-0.5 text-[11px] font-semibold text-wash-brand ring-1 ring-wash-brand/20">
          <Shield size={11} /> {u.Rol}
        </span>
      ),
    },
    {
      key: 'telefono',
      header: 'Teléfono',
      width: '150px',
      truncate: false,
      render: (u) =>
        u.Telefono ? (
          <span className="font-mono text-[12px] text-wash-text-strong tabular-nums">{u.Telefono}</span>
        ) : (
          <span className="text-wash-text-faint">—</span>
        ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      width: '110px',
      align: 'right',
      truncate: false,
      render: (u) =>
        canEdit ? (
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={(ev) => {
                ev.stopPropagation();
                setEditing(u);
              }}
              title="Editar usuario"
              aria-label={`Editar ${nombreCompleto(u)}`}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-wash-text-muted ring-1 ring-wash-border transition hover:bg-wash-brand/10 hover:text-wash-brand hover:ring-wash-brand/40"
            >
              <Pencil size={15} />
            </button>
            <button
              type="button"
              onClick={(ev) => {
                ev.stopPropagation();
                setDeleting(u);
              }}
              title="Dar de baja"
              aria-label={`Dar de baja ${nombreCompleto(u)}`}
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
      <LoadingOverlay visible={loading} label="Cargando usuarios…" />

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <div className="h-full p-4 sm:p-6">
          <DataTable
            rows={rows}
            rowKey={(u) => u.ID}
            columns={columns}
            empty={
              <EmptyState
                icon={UserCog}
                title="Sin usuarios"
                description="No encontramos usuarios que coincidan."
                action={canEdit && <Button onClick={() => setAddOpen(true)}>Agregar usuario</Button>}
              />
            }
            onRowClick={canEdit ? (u) => setEditing(u) : undefined}
            mobileCard={(u) => (
              <div
                onClick={canEdit ? () => setEditing(u) : undefined}
                className={cn('rounded-xl bg-wash-surface p-3 shadow-sm ring-1 ring-wash-border transition', canEdit && 'active:scale-[0.99]')}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-wash-surface-2 text-wash-text-muted ring-1 ring-wash-border">
                      <User size={15} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-display text-[14px] font-bold text-wash-accent">{proper(nombreCompleto(u))}</p>
                      <p className="truncate font-mono text-[11px] text-wash-text-muted">{u.Usuario}</p>
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setEditing(u);
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
                          setDeleting(u);
                        }}
                        aria-label="Dar de baja"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-rose-600 ring-1 ring-rose-500/30 transition hover:bg-rose-500/10 hover:ring-rose-500"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-wash-divider/60 pt-2.5">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-wash-brand/10 px-2 py-0.5 text-[11px] font-semibold text-wash-brand ring-1 ring-wash-brand/20">
                    <Shield size={11} /> {u.Rol}
                  </span>
                  {u.Telefono && <span className="font-mono text-[11px] text-wash-text-muted tabular-nums">{u.Telefono}</span>}
                </div>
              </div>
            )}
          />
        </div>
      )}

      {/* Alta */}
      <UsuarioFormModal
        open={addOpen}
        usuario={null}
        onClose={() => setAddOpen(false)}
        onSave={async (payload) => {
          await createUsuario(payload);
          setAddOpen(false);
        }}
      />

      {/* Modificación */}
      <UsuarioFormModal
        open={!!editing}
        usuario={editing}
        onClose={() => setEditing(null)}
        onSave={async (payload) => {
          if (!editing) return;
          await updateUsuario(editing.ID, payload);
          setEditing(null);
        }}
      />

      {/* Baja */}
      <ConfirmDialog
        open={!!deleting}
        tone="danger"
        title="Dar de baja usuario"
        message={
          deleting
            ? `¿Dar de baja a "${proper(nombreCompleto(deleting))}"? No podrá iniciar sesión (no se borra el historial).`
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
            await bajaUsuario(deleting.ID);
            setDeleting(null);
          } catch (err) {
            setDeleteError(err instanceof Error ? err.message : 'No se pudo dar de baja el usuario.');
          } finally {
            setDeleteBusy(false);
          }
        }}
      />
    </div>
  );
}

// ----- Alta / edición -----

function UsuarioFormModal({
  open,
  usuario,
  onClose,
  onSave,
}: {
  open: boolean;
  usuario: Usuario | null;
  onClose: () => void;
  onSave: (payload: UsuarioAbmInput) => Promise<void>;
}) {
  const [user, setUser] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [rol, setRol] = useState<string>(USER_ROLES[0]);
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetea el form al abrir.
    setUser(usuario?.Usuario ?? '');
    setContrasena('');
    setNombre(usuario?.Nombre ?? '');
    setApellido(usuario?.Apellido ?? '');
    setRol(usuario?.Rol ?? USER_ROLES[0]);
    setTelefono(usuario?.Telefono ?? '');
    setEmail(usuario?.Email ?? '');
    setError(null);
    setSaving(false);
  }, [open, usuario]);

  const esNuevo = !usuario;
  const valido = user.trim() !== '' && nombre.trim() !== '' && rol !== '' && (!esNuevo || contrasena.trim() !== '');

  const handleSave = async () => {
    if (!valido || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({
        usuario: user.trim(),
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        rol,
        telefono: telefono.trim(),
        email: email.trim(),
        // La contraseña sólo viaja si se completó (en edición, vacío = se mantiene).
        ...(contrasena.trim() !== '' ? { contrasena } : {}),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el usuario.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={usuario ? `Editar — ${proper(nombreCompleto(usuario))}` : 'Agregar usuario'} width={520}>
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nombre" icon={User}>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoFocus
              placeholder="Juan"
              className="w-full min-w-0 flex-1 bg-wash-surface px-3 py-2 text-sm outline-none"
            />
          </Field>
          <Field label="Apellido" icon={User}>
            <input
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
              placeholder="Pérez"
              className="w-full min-w-0 flex-1 bg-wash-surface px-3 py-2 text-sm outline-none"
            />
          </Field>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-wash-text-muted">Rol</label>
          <div className="mt-1.5 flex items-stretch overflow-hidden rounded-lg border border-wash-border focus-within:border-wash-brand focus-within:ring-2 focus-within:ring-wash-brand/15">
            <span className="flex w-10 shrink-0 items-center justify-center bg-wash-surface-2 text-wash-text-muted">
              <Shield size={15} />
            </span>
            <select
              value={rol}
              onChange={(e) => setRol(e.target.value)}
              className="w-full min-w-0 flex-1 bg-wash-surface px-3 py-2 text-sm outline-none"
            >
              {USER_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Usuario (login)" icon={User}>
            <input
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder="jperez"
              autoComplete="off"
              className="w-full min-w-0 flex-1 bg-wash-surface px-3 py-2 text-sm outline-none"
            />
          </Field>
          <Field label={esNuevo ? 'Contraseña' : 'Nueva contraseña'} icon={KeyRound}>
            <input
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              type="password"
              autoComplete="new-password"
              placeholder={esNuevo ? '••••••' : 'Dejar vacío para mantener'}
              className="w-full min-w-0 flex-1 bg-wash-surface px-3 py-2 text-sm outline-none"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Teléfono" icon={Phone}>
            <input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="Opcional"
              inputMode="tel"
              className="w-full min-w-0 flex-1 bg-wash-surface px-3 py-2 text-sm outline-none"
            />
          </Field>
          <Field label="Email" icon={Mail}>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
              }}
              type="email"
              placeholder="Opcional"
              className="w-full min-w-0 flex-1 bg-wash-surface px-3 py-2 text-sm outline-none"
            />
          </Field>
        </div>

        <p className="text-[11px] text-wash-text-muted">
          El acceso a cada módulo se controla por rol en la lista de permisos (99.ListaPermisosDesktop).
        </p>
      </div>

      <ModalActions>
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="rounded-lg border border-wash-border px-4 py-2 font-medium text-wash-text-strong hover:bg-wash-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!valido || saving}
          onClick={handleSave}
          className="inline-flex items-center rounded-lg bg-wash-action px-4 py-2 font-medium text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          {saving ? 'Guardando…' : usuario ? 'Guardar cambios' : 'Crear usuario'}
        </button>
      </ModalActions>
    </Modal>
  );
}

function Field({ label, icon: Icon, children }: { label: string; icon: typeof User; children: React.ReactNode }) {
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
