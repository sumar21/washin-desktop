import { useCallback, useEffect, useMemo, useState } from 'react';
import { Wrench, Pencil, Hash, Boxes, AlertCircle, DollarSign } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { Modal, ModalActions } from '@/components/Modal';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { ErrorState } from '@/components/ErrorState';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/store/useAppStore';
import { canEditRepuestoPrecio } from '@/lib/nav';
import { cn, proper } from '@/lib/utils';
import type { Repuesto } from '@/types/domain';

/** Formatea un precio como moneda argentina ($ 1.234,50). */
function formatPrecio(n: number): string {
  return n.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function Repuestos() {
  const repuestos = useAppStore((s) => s.CollectRepuestos);
  const fetchRepuestos = useAppStore((s) => s.fetchRepuestos);
  const updateRepuestoPrecio = useAppStore((s) => s.updateRepuestoPrecio);
  const VarTipoUser = useAppStore((s) => s.VarTipoUser);

  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Repuesto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canEdit = canEditRepuestoPrecio(VarTipoUser);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return fetchRepuestos()
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'No se pudo cargar el catálogo de repuestos.');
      })
      .finally(() => setLoading(false));
  }, [fetchRepuestos]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial; `load` también la dispara el botón "Reintentar".
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar; `load` ya maneja su propio loading.
  }, []);

  const rows = useMemo(() => {
    const q = query.toLowerCase().trim();
    const list = q
      ? repuestos.filter(
          (r) =>
            r.Nombre_RP.toLowerCase().includes(q) ||
            r.Codigo_RP.toLowerCase().includes(q) ||
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
      width: 'minmax(220px, 1.6fr)',
      truncate: false,
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wash-surface-2 text-wash-text-muted ring-1 ring-wash-border">
            <Wrench size={13} />
          </span>
          <span className="truncate font-display text-[13px] font-bold text-wash-accent">
            {proper(r.Nombre_RP) || r.ConcatRepuesto_RP || '—'}
          </span>
        </div>
      ),
    },
    {
      key: 'stock',
      header: 'Stock',
      width: '110px',
      align: 'center',
      truncate: false,
      render: (r) => (
        <Badge variant="secondary" className="bg-wash-surface-2 text-[12px] font-bold tabular-nums text-wash-text-strong">
          {r.Stock_RP}
        </Badge>
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
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={(ev) => {
                ev.stopPropagation();
                setEditing(r);
              }}
              title="Editar precio"
              aria-label={`Editar precio de ${proper(r.Nombre_RP)}`}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-wash-text-muted ring-1 ring-wash-border transition hover:bg-wash-brand/10 hover:text-wash-brand hover:ring-wash-brand/40"
            >
              <Pencil size={15} />
            </button>
          </div>
        ) : (
          <span className="block text-right text-wash-text-faint">—</span>
        ),
    },
  ];

  return (
    <div className="relative flex h-full w-full flex-col">
      <PageHeader
        title="Repuestos"
        subtitle="Catálogo de repuestos con precio"
        search={{ value: query, onChange: setQuery, placeholder: 'Buscar repuesto o código…' }}
        onRefresh={() => load()}
      />
      <LoadingOverlay visible={loading} label="Cargando repuestos…" />

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <div className="flex-1 overflow-hidden p-4 sm:p-6">
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
                    </div>
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setEditing(r);
                      }}
                      title="Editar precio"
                      aria-label={`Editar precio de ${proper(r.Nombre_RP)}`}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-wash-text-muted ring-1 ring-wash-border transition hover:bg-wash-brand/10 hover:text-wash-brand hover:ring-wash-brand/40"
                    >
                      <Pencil size={15} />
                    </button>
                  )}
                </div>
                <div className="mt-2.5 flex items-center justify-between border-t border-wash-divider/60 pt-2.5">
                  <span className="inline-flex items-center gap-1 text-[11.5px] text-wash-text-muted">
                    <Boxes size={12} />
                    Stock: <span className="font-semibold text-wash-text-strong tabular-nums">{r.Stock_RP}</span>
                  </span>
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

      <EditPrecioModal
        repuesto={editing}
        onClose={() => setEditing(null)}
        onSave={async (precio) => {
          if (!editing) return;
          await updateRepuestoPrecio(editing.ID, precio);
          setEditing(null);
        }}
      />
    </div>
  );
}

// ----- Editar precio modal -----

function EditPrecioModal({
  repuesto,
  onClose,
  onSave,
}: {
  repuesto: Repuesto | null;
  onClose: () => void;
  onSave: (precio: number) => Promise<void>;
}) {
  const [precio, setPrecio] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repuesto) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetea el form al abrir el modal para un repuesto nuevo.
    setPrecio(repuesto.Precio_RP > 0 ? String(repuesto.Precio_RP) : '');
    setError(null);
    setSaving(false);
  }, [repuesto]);

  const precioNum = Number(precio.replace(',', '.'));
  const valido = precio.trim() !== '' && Number.isFinite(precioNum) && precioNum >= 0;

  const handleSave = async () => {
    if (!valido || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(Math.round(precioNum * 100) / 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el precio.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!repuesto}
      onClose={onClose}
      title={repuesto ? `Editar precio — ${proper(repuesto.Nombre_RP)}` : ''}
      width={440}
    >
      {error && (
        <div
          role="alert"
          className="mb-3 flex items-center gap-2 rounded-r-md border-l-4 border-red-500 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700"
        >
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      {repuesto?.Codigo_RP && (
        <p className="mb-3 flex items-center gap-1.5 text-[12px] text-wash-text-muted">
          <Hash size={12} />
          <span className="font-mono font-semibold text-wash-text-strong">{repuesto.Codigo_RP}</span>
        </p>
      )}

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
          autoFocus
          aria-label="Precio unitario"
          placeholder="0.00"
          className="w-full min-w-0 flex-1 bg-wash-surface px-3 py-2 text-right text-base font-bold tabular-nums outline-none"
        />
      </div>
      <p className="mt-1.5 text-[11px] text-wash-text-muted">Se guarda con 2 decimales.</p>

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
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </ModalActions>
    </Modal>
  );
}
