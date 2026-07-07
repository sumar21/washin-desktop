import { useCallback, useEffect, useState } from 'react';
import { Map, GitBranch, Building2, Search, Plus, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import { abmAccess, type AbmTab } from '@/lib/abmAccess';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { ErrorState } from '@/components/ErrorState';
import { ConfigRutas } from './config/ConfigRutas';
import { ConfigCircuitos } from './config/ConfigCircuitos';
import { ConfigEdificios } from './config/ConfigEdificios';

type ConfigTab = 'rutas' | 'circuitos' | 'edificios';

interface TabDef {
  key: ConfigTab;
  label: string;
  icon: typeof Map;
  addLabel: string | null;
  placeholder: string;
  /** Pestaña ABM correspondiente (para gate de acceso). `reportes` no es ABM. */
  abm: AbmTab | null;
}

const TABS: TabDef[] = [
  { key: 'rutas', label: 'Rutas', icon: Map, addLabel: 'Agregar Ruta', placeholder: 'Buscar ruta…', abm: 'Rutas' },
  { key: 'circuitos', label: 'Circuitos', icon: GitBranch, addLabel: 'Agregar Circuito', placeholder: 'Buscar circuito o edificio…', abm: 'Circuitos' },
  { key: 'edificios', label: 'Edificios', icon: Building2, addLabel: 'Agregar Edificio', placeholder: 'Buscar edificio…', abm: 'Edificios' },
];

export function Configuracion() {
  const VarTipoUser = useAppStore((s) => s.VarTipoUser);
  const fetchAbm = useAppStore((s) => s.fetchAbm);

  const access = abmAccess(VarTipoUser);
  // Pestañas visibles: las ABM permitidas por el rol + Reportes (no es ABM).
  const visibleTabs = TABS.filter((t) => t.abm === null || access.tabs.includes(t.abm));

  const [tab, setTab] = useState<ConfigTab | null>(null);
  const [queries, setQueries] = useState<Record<ConfigTab, string>>({ rutas: '', circuitos: '', edificios: '' });
  const [addOpen, setAddOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const active = visibleTabs.find((t) => t.key === tab) ?? visibleTabs[0];
  const query = active ? queries[active.key] : '';
  const setQuery = (v: string) => active && setQueries((prev) => ({ ...prev, [active.key]: v }));
  // Solo se puede editar los ABM (no Reportes) si el rol tiene permiso de edición.
  const canEditActive = access.canEdit && active?.abm !== null;

  const loadAbm = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    return fetchAbm()
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'No se pudo cargar la configuración.'))
      .finally(() => setLoading(false));
  }, [fetchAbm]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial; "Reintentar" también dispara loadAbm().
    loadAbm();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar.
  }, []);

  if (!active) {
    // Rol sin acceso a ningún ABM ni a Reportes (defensivo; el sidebar ya lo oculta).
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-wash-surface-2 text-wash-text-muted">
          <Lock size={24} />
        </span>
        <p className="text-sm font-semibold text-wash-text-strong">Sin acceso a Configuración</p>
        <p className="text-xs text-wash-text-muted">Tu rol no tiene permisos sobre estos ABMs.</p>
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full flex-col">
      {!fullscreen && (
        <div className="flex h-[72px] shrink-0 items-center justify-between gap-4 border-b border-wash-border bg-wash-surface px-6">
          {/* Tabs */}
          <div className="flex items-center gap-1">
            {visibleTabs.map((t) => {
              const Icon = t.icon;
              const isActive = active.key === t.key;
              const readOnly = t.abm !== null && !access.canEdit;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={cn(
                    'group relative flex items-center gap-2 px-4 py-5 text-sm font-semibold transition',
                    isActive ? 'text-wash-brand' : 'text-wash-text-muted hover:text-wash-text-strong'
                  )}
                >
                  <Icon size={15} className={cn(isActive ? 'text-wash-brand' : 'text-wash-text-muted group-hover:text-wash-text-strong')} />
                  {t.label}
                  {readOnly && <Lock size={11} className="text-wash-text-faint" />}
                  {isActive && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-wash-brand" />}
                </button>
              );
            })}
          </div>

          {/* Per-tab search + add */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-wash-text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={active.placeholder}
                className="w-[280px] rounded-lg bg-wash-canvas px-9 py-2 text-sm text-wash-text-strong outline-none ring-1 ring-wash-border focus:ring-wash-primary"
              />
            </div>
            {active.addLabel && canEditActive && (
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-wash-primary px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-110"
              >
                <Plus size={14} />
                {active.addLabel}
              </button>
            )}
          </div>
        </div>
      )}

      <LoadingOverlay visible={loading} label="Cargando configuración…" />

      {/* Content */}
      {loadError ? (
        <ErrorState message={loadError} onRetry={loadAbm} />
      ) : (
        <div className="flex-1 overflow-hidden">
          {active.key === 'rutas' && <ConfigRutas query={query} addOpen={addOpen} setAddOpen={setAddOpen} canEdit={access.canEdit} />}
          {active.key === 'circuitos' && (
            <ConfigCircuitos query={query} addOpen={addOpen} setAddOpen={setAddOpen} canEdit={access.canEdit} onFullscreenChange={setFullscreen} />
          )}
          {active.key === 'edificios' && <ConfigEdificios query={query} addOpen={addOpen} setAddOpen={setAddOpen} canEdit={access.canEdit} />}
        </div>
      )}
    </div>
  );
}
