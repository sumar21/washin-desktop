import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building, Users, Map, Wind, Hash, Package, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';

type ConfigTab =
  | 'edificios'
  | 'usuarios'
  | 'rutas'
  | 'circuitos'
  | 'frecuencias'
  | 'grupos'
  | 'items'
  | 'encendedores';

const TABS: { key: ConfigTab; label: string; icon: typeof Building }[] = [
  { key: 'edificios', label: 'Edificios', icon: Building },
  { key: 'usuarios', label: 'Usuarios', icon: Users },
  { key: 'rutas', label: 'Rutas', icon: Map },
  { key: 'circuitos', label: 'Circuitos', icon: Map },
  { key: 'frecuencias', label: 'Frecuencias', icon: Hash },
  { key: 'grupos', label: 'Grupos Ventilación', icon: Wind },
  { key: 'items', label: 'Items Compra', icon: Package },
  { key: 'encendedores', label: 'Encendedores', icon: Hash },
];

export function Configuracion() {
  const navigate = useNavigate();
  const setNroCircuito = useAppStore((s) => s.setNroCircuitoDetail);

  const [tab, setTab] = useState<ConfigTab>('edificios');
  const [query, setQuery] = useState('');

  const edificios = useAppStore((s) => s.CollectEdificios);
  const usuarios = useAppStore((s) => s.CollectUser);
  const rutas = useAppStore((s) => s.CollectRutasDisponibles);
  const circuitos = useAppStore((s) => s.CollectResumenCircuito);
  const frecuencias = useAppStore((s) => s.CollectFrecuencias);
  const grupos = useAppStore((s) => s.CollectGruposVentilacion);
  const items = useAppStore((s) => s.CollectItemsCompra);
  const encendedores = useAppStore((s) => s.CollectEncendedores);

  const renderTable = () => {
    const q = query.toLowerCase();
    switch (tab) {
      case 'edificios':
        return (
          <SimpleTable
            cols={['Código', 'Edificio', 'Dirección', 'Grupo Vent.', 'Frecuencia', 'Status']}
            widths={['100px', '1fr', '1fr', '160px', '140px', '120px']}
            rows={edificios
              .filter((e) =>
                [e.Edificio, e.Codigo, e.Direccion ?? ''].some((v) => v.toLowerCase().includes(q))
              )
              .map((e) => [
                <span key="c" className="font-mono text-xs">
                  {e.Codigo}
                </span>,
                <span key="e" className="font-semibold">
                  {e.Edificio}
                </span>,
                e.Direccion ?? '—',
                e.GrupoVentilacion_ED ?? '—',
                e.FrecuenciaVent_ED ?? '—',
                <StatusBadge key="s" status={e.Status} />,
              ])}
          />
        );
      case 'usuarios':
        return (
          <SimpleTable
            cols={['Usuario', 'Nombre', 'Rol', 'Teléfono', 'Status']}
            widths={['160px', '1fr', '180px', '160px', '120px']}
            rows={usuarios
              .filter((u) =>
                [u.Usuario, u.Concat_Nombre_Apellido, u.Rol].some((v) =>
                  v.toLowerCase().includes(q)
                )
              )
              .map((u) => [
                <span key="u" className="font-mono text-xs">
                  {u.Usuario}
                </span>,
                <span key="n" className="font-semibold">
                  {u.Concat_Nombre_Apellido}
                </span>,
                <span
                  key="r"
                  className="rounded-full bg-wash-primary/10 px-2 py-0.5 text-xs font-semibold text-wash-primary"
                >
                  {u.Rol}
                </span>,
                u.Telefono ?? '—',
                <StatusBadge key="s" status={u.Status} />,
              ])}
          />
        );
      case 'rutas':
        return (
          <SimpleTable
            cols={['N° Ruta', 'Status']}
            widths={['200px', '160px']}
            rows={rutas.map((r) => [
              <span key="n" className="font-bold text-wash-accent">
                Ruta {r.NroRuta_RT}
              </span>,
              <StatusBadge key="s" status={r.Status_RT} />,
            ])}
          />
        );
      case 'circuitos':
        return (
          <SimpleTable
            cols={['N° Circuito', 'Ruta', 'Status', '']}
            widths={['200px', '160px', '140px', '120px']}
            rows={circuitos.map((c) => [
              <span key="n" className="font-bold text-wash-accent">
                {c.NroCircuito_RC}
              </span>,
              `Ruta ${c.NroRuta_RC}`,
              <StatusBadge key="s" status={c.Status_RC} />,
              <button
                key="b"
                type="button"
                onClick={() => {
                  setNroCircuito(c.NroCircuito_RC);
                  navigate('/configuracion/circuito');
                }}
                className="ml-auto flex items-center gap-1 rounded-lg bg-wash-primary/10 px-3 py-1.5 text-xs font-semibold text-wash-primary hover:bg-wash-primary/20"
              >
                Detalle <ChevronRight size={12} />
              </button>,
            ])}
          />
        );
      case 'frecuencias':
        return (
          <SimpleTable
            cols={['Frecuencia', 'Status']}
            widths={['1fr', '160px']}
            rows={frecuencias.map((f) => [
              <span key="n" className="font-semibold">
                {f.Frecuencia_FE}
              </span>,
              <StatusBadge key="s" status={f.Status_FE} />,
            ])}
          />
        );
      case 'grupos':
        return (
          <SimpleTable
            cols={['Grupo', 'Status']}
            widths={['1fr', '160px']}
            rows={grupos.map((g) => [
              <span key="n" className="font-semibold">
                {g.Grupo_GV}
              </span>,
              <StatusBadge key="s" status={g.Status_VE} />,
            ])}
          />
        );
      case 'items':
        return (
          <SimpleTable
            cols={['Item', 'Tipo', 'Status']}
            widths={['1fr', '180px', '160px']}
            rows={items.map((i) => [
              <span key="n" className="font-semibold">
                {i.Item_IC}
              </span>,
              <span
                key="t"
                className="rounded-full bg-wash-primary/10 px-2 py-0.5 text-xs font-semibold text-wash-primary"
              >
                {i.Tipo_IC}
              </span>,
              <StatusBadge key="s" status={i.Status_IC} />,
            ])}
          />
        );
      case 'encendedores':
        return (
          <SimpleTable
            cols={['Tipo', 'Status']}
            widths={['1fr', '160px']}
            rows={encendedores.map((e) => [
              <span key="n" className="font-semibold">
                {e.Tipo_EN}
              </span>,
              <StatusBadge key="s" status={e.Status_EN} />,
            ])}
          />
        );
    }
  };

  return (
    <div className="flex h-full w-full flex-col">
      <PageHeader
        title="Configuración"
        subtitle="Administración de catálogos y datos maestros"
        search={{ value: query, onChange: setQuery, placeholder: 'Buscar…' }}
        onAdd={() => {}}
        addLabel="Nuevo"
      />
      <div className="flex border-b border-wash-border bg-white">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setTab(t.key);
                setQuery('');
              }}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
                active
                  ? 'border-b-2 border-wash-primary text-wash-primary'
                  : 'border-b-2 border-transparent text-wash-text-muted hover:text-wash-text-strong'
              )}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-hidden p-6">{renderTable()}</div>
    </div>
  );
}

function SimpleTable({
  cols,
  widths,
  rows,
}: {
  cols: string[];
  widths: string[];
  rows: React.ReactNode[][];
}) {
  const grid = widths.join(' ');
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-wash-border">
      <div
        className="grid border-b border-wash-border bg-wash-canvas px-4 text-[11px] font-bold uppercase tracking-wider text-wash-text-muted"
        style={{ gridTemplateColumns: grid }}
      >
        {cols.map((c) => (
          <div key={c} className="py-2.5">
            {c}
          </div>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-wash-text-muted">
            Sin registros
          </div>
        ) : (
          rows.map((cells, i) => (
            <div
              key={i}
              className="grid items-center border-b border-wash-divider/60 px-4 py-3 text-sm text-wash-text-strong"
              style={{ gridTemplateColumns: grid }}
            >
              {cells.map((c, j) => (
                <div key={j} className="truncate">
                  {c}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
