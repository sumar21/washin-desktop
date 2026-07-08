import { useMemo, useState } from 'react';
import type { ElementType } from 'react';
import { LayoutDashboard, MapPin, AlertOctagon, CalendarDays } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import DashboardGeneral from '@/screens/dashboard/DashboardGeneral';
import DashboardVisitas from '@/screens/dashboard/DashboardVisitas';
import DashboardIncidentes from '@/screens/dashboard/DashboardIncidentes';

type TabId = 'general' | 'visitas' | 'incidentes';

const TABS: { id: TabId; label: string; icon: ElementType; subtitle: string }[] = [
  { id: 'general', label: 'General', icon: LayoutDashboard, subtitle: 'Panel ejecutivo · incidentes, visitas y ventilaciones' },
  { id: 'visitas', label: 'Visitas', icon: MapPin, subtitle: 'Control de edificios · tiempos y resultado de control' },
  { id: 'incidentes', label: 'Incidentes', icon: AlertOctagon, subtitle: 'Analítica de incidentes' },
];

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** Últimos `n` meses en `mm/yyyy`, del más nuevo al más viejo, con label 'mmm yyyy'. */
function monthOptions(n: number): { value: string; label: string }[] {
  const now = new Date();
  const out: { value: string; label: string }[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    out.push({ value: `${mm}/${d.getFullYear()}`, label: `${MESES[d.getMonth()]} ${d.getFullYear()}` });
  }
  return out;
}
/** Orden numérico de un 'mm/yyyy' (yyyy*12+mm). */
const ord = (mmYyyy: string) => {
  const [m, y] = mmYyyy.split('/').map(Number);
  return y * 12 + m;
};

/**
 * Dashboard con 3 tabs (General · Visitas · Incidentes). En Visitas/Incidentes hay un
 * selector de período MES/AÑO (desde/hasta) — el backend trae SOLO esos meses (rápido, no
 * 12 siempre). Cada tab es autónomo y sólo renderiza contenido; el título/subtítulo lo
 * provee este shell (no hay doble header).
 */
export function Dashboard() {
  const [tab, setTab] = useState<TabId>('general');
  const meses = useMemo(() => monthOptions(24), []);
  // Período por defecto: mes actual (1 mes → fetch chico y rápido). El usuario lo ensancha.
  const [desde, setDesde] = useState<string>(meses[0].value);
  const [hasta, setHasta] = useState<string>(meses[0].value);

  const active = TABS.find((t) => t.id === tab) ?? TABS[0];
  const rangeVisible = tab !== 'general';
  const desdeLabel = meses.find((m) => m.value === desde)?.label ?? desde;
  const hastaLabel = meses.find((m) => m.value === hasta)?.label ?? hasta;
  const subtitle = rangeVisible ? `${active.subtitle} · ${desdeLabel} → ${hastaLabel}` : active.subtitle;

  // Al elegir "desde" mayor que "hasta" (o viceversa), arrastramos el otro extremo.
  const onDesde = (v: string) => {
    setDesde(v);
    if (ord(v) > ord(hasta)) setHasta(v);
  };
  const onHasta = (v: string) => {
    setHasta(v);
    if (ord(v) < ord(desde)) setDesde(v);
  };

  return (
    <div className="relative flex h-full w-full flex-col">
      <PageHeader
        title="Dashboard"
        subtitle={subtitle}
        toolbarExtra={
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            {rangeVisible && (
              <div className="flex items-center gap-1.5">
                <CalendarDays size={14} className="shrink-0 text-wash-text-muted" />
                <MesSelect value={desde} onChange={onDesde} options={meses} />
                <span className="text-xs text-wash-text-muted">→</span>
                <MesSelect value={hasta} onChange={onHasta} options={meses} />
              </div>
            )}
            <TabControl tab={tab} onTab={setTab} />
          </div>
        }
      />

      {tab === 'general' && <DashboardGeneral />}
      {tab === 'visitas' && <DashboardVisitas desde={desde} hasta={hasta} />}
      {tab === 'incidentes' && <DashboardIncidentes desde={desde} hasta={hasta} />}
    </div>
  );
}

function MesSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-[126px] bg-wash-canvas text-[13px] ring-wash-border">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-[320px]">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Segmented control de marca para alternar entre los tabs del dashboard. */
function TabControl({ tab, onTab }: { tab: TabId; onTab: (t: TabId) => void }) {
  return (
    <div className="flex min-w-0 items-center gap-1 overflow-x-auto rounded-xl bg-wash-surface-2 p-1 ring-1 ring-wash-border">
      {TABS.map((t) => {
        const Icon = t.icon;
        const activo = t.id === tab;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onTab(t.id)}
            aria-pressed={activo}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              activo
                ? 'bg-wash-surface text-wash-brand-dark shadow-sm ring-1 ring-wash-border'
                : 'text-wash-text-muted hover:text-wash-text-strong'
            )}
          >
            <Icon size={15} className="shrink-0" />
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
