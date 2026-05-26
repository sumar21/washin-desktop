import { useState } from 'react';
import { Map, GitBranch, Building2, BarChart3, Construction } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfigRutas } from './config/ConfigRutas';

type ConfigTab = 'rutas' | 'circuitos' | 'edificios' | 'reportes';

const TABS: { key: ConfigTab; label: string; icon: typeof Map; desc: string }[] = [
  { key: 'rutas', label: 'Rutas', icon: Map, desc: 'Catálogo de rutas y circuitos asignados' },
  { key: 'circuitos', label: 'Circuitos', icon: GitBranch, desc: 'Catálogo de circuitos y edificios' },
  { key: 'edificios', label: 'Edificios', icon: Building2, desc: 'Catálogo maestro de edificios' },
  { key: 'reportes', label: 'Reportes', icon: BarChart3, desc: 'Reportes y métricas' },
];

export function Configuracion() {
  const [tab, setTab] = useState<ConfigTab>('rutas');

  return (
    <div className="flex h-full w-full flex-col">
      {/* Tab strip */}
      <div className="flex shrink-0 items-center gap-1 border-b border-wash-border bg-wash-surface px-6 pt-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                'group relative flex items-center gap-2 px-4 py-3.5 text-sm font-semibold transition',
                active
                  ? 'text-wash-brand'
                  : 'text-wash-text-muted hover:text-wash-text-strong'
              )}
            >
              <Icon
                size={15}
                className={cn(active ? 'text-wash-brand' : 'text-wash-text-muted group-hover:text-wash-text-strong')}
              />
              {t.label}
              {active && (
                <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-wash-brand" />
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'rutas' && <ConfigRutas />}
        {tab === 'circuitos' && <Placeholder label="Circuitos" />}
        {tab === 'edificios' && <Placeholder label="Edificios" />}
        {tab === 'reportes' && <Placeholder label="Reportes" />}
      </div>
    </div>
  );
}

function Placeholder({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-wash-brand/10 text-wash-brand ring-1 ring-wash-brand/20">
          <Construction size={28} strokeWidth={1.6} />
        </div>
        <h3 className="mt-4 font-display text-lg font-black text-wash-accent">
          {label}
        </h3>
        <p className="mt-1 text-sm text-wash-text-muted">
          Esta sección estará disponible próximamente.
        </p>
      </div>
    </div>
  );
}
