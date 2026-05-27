import { useState } from 'react';
import { Map, GitBranch, Building2, BarChart3, Search, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfigRutas } from './config/ConfigRutas';
import { ConfigCircuitos } from './config/ConfigCircuitos';
import { ConfigEdificios } from './config/ConfigEdificios';
import { ConfigReportes } from './config/ConfigReportes';

type ConfigTab = 'rutas' | 'circuitos' | 'edificios' | 'reportes';

interface TabDef {
  key: ConfigTab;
  label: string;
  icon: typeof Map;
  addLabel: string | null;
  placeholder: string;
}

const TABS: TabDef[] = [
  { key: 'rutas', label: 'Rutas', icon: Map, addLabel: 'Agregar Ruta', placeholder: 'Buscar ruta…' },
  { key: 'circuitos', label: 'Circuitos', icon: GitBranch, addLabel: 'Agregar Circuito', placeholder: 'Buscar circuito o edificio…' },
  { key: 'edificios', label: 'Edificios', icon: Building2, addLabel: 'Agregar Edificio', placeholder: 'Buscar edificio…' },
  { key: 'reportes', label: 'Reportes', icon: BarChart3, addLabel: null, placeholder: 'Buscar…' },
];

export function Configuracion() {
  const [tab, setTab] = useState<ConfigTab>('rutas');
  const [queries, setQueries] = useState<Record<ConfigTab, string>>({
    rutas: '',
    circuitos: '',
    edificios: '',
    reportes: '',
  });
  const [addOpen, setAddOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const active = TABS.find((t) => t.key === tab)!;
  const query = queries[tab];
  const setQuery = (v: string) => setQueries((prev) => ({ ...prev, [tab]: v }));

  return (
    <div className="flex h-full w-full flex-col">
      {!fullscreen && (
        <div className="flex h-[72px] shrink-0 items-center justify-between gap-4 border-b border-wash-border bg-wash-surface px-6">
          {/* Tabs */}
          <div className="flex items-center gap-1">
            {TABS.map((t) => {
              const Icon = t.icon;
              const isActive = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={cn(
                    'group relative flex items-center gap-2 px-4 py-5 text-sm font-semibold transition',
                    isActive
                      ? 'text-wash-brand'
                      : 'text-wash-text-muted hover:text-wash-text-strong'
                  )}
                >
                  <Icon
                    size={15}
                    className={cn(
                      isActive
                        ? 'text-wash-brand'
                        : 'text-wash-text-muted group-hover:text-wash-text-strong'
                    )}
                  />
                  {t.label}
                  {isActive && (
                    <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-wash-brand" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Per-tab search + add */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-wash-text-muted"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={active.placeholder}
                className="w-[280px] rounded-full bg-wash-canvas px-9 py-2 text-sm text-wash-text-strong outline-none ring-1 ring-wash-border focus:ring-wash-primary"
              />
            </div>
            {active.addLabel && (
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="flex items-center gap-1.5 rounded-full bg-wash-primary px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-110"
              >
                <Plus size={14} />
                {active.addLabel}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'rutas' && (
          <ConfigRutas query={query} addOpen={addOpen} setAddOpen={setAddOpen} />
        )}
        {tab === 'circuitos' && (
          <ConfigCircuitos
            query={query}
            addOpen={addOpen}
            setAddOpen={setAddOpen}
            onFullscreenChange={setFullscreen}
          />
        )}
        {tab === 'edificios' && (
          <ConfigEdificios
            query={query}
            addOpen={addOpen}
            setAddOpen={setAddOpen}
          />
        )}
        {tab === 'reportes' && <ConfigReportes query={query} />}
      </div>
    </div>
  );
}

