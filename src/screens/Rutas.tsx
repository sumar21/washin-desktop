import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Users, MapPin, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { useAppStore } from '@/store/useAppStore';

export function Rutas() {
  const navigate = useNavigate();
  const meses = useAppStore((s) => s.CollectMesesPlanificados);
  const resumen = useAppStore((s) => s.CollectResumenPlanificaciones);
  const setMesPlanif = useAppStore((s) => s.setMesPlanificacionDetail);

  const [query, setQuery] = useState('');

  const filteredMeses = useMemo(() => {
    const q = query.toLowerCase();
    return [...meses]
      .filter((m) => m.Status_MP === 'Activo')
      .sort((a, b) => b.MesAnoPlanificado_MP.localeCompare(a.MesAnoPlanificado_MP))
      .filter((m) => m.MesAnoPlanificado_MP.toLowerCase().includes(q));
  }, [meses, query]);

  const rutasDelMes = (mesAno: string) =>
    resumen.filter((r) => r.MesAnoPlanificado_RP === mesAno);

  return (
    <div className="flex h-full w-full flex-col">
      <PageHeader
        title="Planificaciones"
        subtitle="Rutas mensuales de mantenimiento"
        search={{ value: query, onChange: setQuery, placeholder: 'Buscar mes…' }}
        onAdd={() => {}}
        addLabel="Nueva planificación"
      />
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-3 gap-4">
          {filteredMeses.length === 0 && (
            <div className="col-span-3 rounded-2xl border border-dashed border-wash-border p-12 text-center text-wash-text-muted">
              Sin meses planificados.
            </div>
          )}
          {filteredMeses.map((m) => {
            const rutas = rutasDelMes(m.MesAnoPlanificado_MP);
            return (
              <article
                key={m.ID}
                className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-wash-border"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-wash-text-muted">
                      Mes
                    </p>
                    <h3 className="mt-1 font-display text-2xl font-black text-wash-accent">
                      {m.MesPlanificado_MP} {m.MesAnoPlanificado_MP.split('/')[1]}
                    </h3>
                  </div>
                  <CalendarDays className="text-wash-primary" size={20} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-wash-canvas px-3 py-2">
                    <div className="flex items-center gap-1.5 text-xs text-wash-text-muted">
                      <MapPin size={12} /> Rutas
                    </div>
                    <div className="mt-1 font-bold text-wash-text-strong">
                      {m.RutasTotales_MP}
                    </div>
                  </div>
                  <div className="rounded-lg bg-wash-canvas px-3 py-2">
                    <div className="flex items-center gap-1.5 text-xs text-wash-text-muted">
                      <Users size={12} /> Técnicos
                    </div>
                    <div className="mt-1 font-bold text-wash-text-strong">
                      {m.TecnicosTotales_MP}
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-1.5">
                  {rutas.slice(0, 3).map((r) => (
                    <div
                      key={r.ID}
                      className="flex items-center justify-between rounded-md bg-wash-canvas/70 px-3 py-1.5 text-xs"
                    >
                      <span className="font-semibold text-wash-text-strong">
                        Ruta {r.NroRuta_RP}
                      </span>
                      <span className="text-wash-text-muted">{r.Tecnico_RP}</span>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setMesPlanif(m.MesAnoPlanificado_MP, m.MesPlanificado_MP);
                    navigate('/planificacion/detalle');
                  }}
                  className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-wash-primary px-3 py-2 text-sm font-semibold text-white hover:brightness-110"
                >
                  Ver detalle
                  <ChevronRight size={14} />
                </button>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
