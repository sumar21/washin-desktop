import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Building, Wind } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

export function DetalleCircuito() {
  const navigate = useNavigate();
  const NroCircuitoDetail = useAppStore((s) => s.NroCircuitoDetail);
  const setNroCircuito = useAppStore((s) => s.setNroCircuitoDetail);
  const detalles = useAppStore((s) => s.CollectDetalleCircuito);
  const planificacion = useAppStore((s) => s.CollectDetallePlanificaciones);
  const maquinas = useAppStore((s) => s.CollectDetalleMaquina);
  const ventilaciones = useAppStore((s) => s.CollectVentilaciones);

  const edificiosEnCircuito = useMemo(
    () => detalles.filter((d) => d.NroCircuito_DC === NroCircuitoDetail && d.Status_DC === 'Activo'),
    [detalles, NroCircuitoDetail]
  );
  const planifs = useMemo(
    () => planificacion.filter((d) => d.NroCircuito_DP === NroCircuitoDetail),
    [planificacion, NroCircuitoDetail]
  );

  if (!NroCircuitoDetail) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-wash-text-muted">No hay circuito seleccionado.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex h-[88px] items-center justify-between border-b border-wash-border bg-white px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setNroCircuito(null);
              navigate('/configuracion');
            }}
            className="rounded-lg bg-wash-canvas p-2 text-wash-primary hover:bg-wash-border/50"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <p className="text-xs uppercase tracking-widest text-wash-text-muted">Circuito</p>
            <h1 className="font-display text-2xl font-black text-wash-primary-soft">
              {NroCircuitoDetail}
            </h1>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-3 gap-4">
          <Stat icon={Building} label="Edificios" value={edificiosEnCircuito.length} />
          <Stat icon={MapPin} label="Planificaciones" value={planifs.length} />
          <Stat
            icon={Wind}
            label="Ventilaciones pendientes"
            value={
              ventilaciones.filter(
                (v) =>
                  edificiosEnCircuito.some((e) => e.NombreEdificio_DC === v.Edificio_VE) &&
                  v.Estado_VE !== 'Realizada'
              ).length
            }
          />
        </div>

        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-wash-text-muted">
            Edificios del circuito
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {edificiosEnCircuito.map((e) => {
              const maqs = maquinas.filter(
                (m) => m.Edificio_DM === e.NombreEdificio_DC && m.Status_DM !== 'ELIMINADA'
              );
              const vents = ventilaciones.filter((v) => v.Edificio_VE === e.NombreEdificio_DC);
              return (
                <article
                  key={e.ID}
                  className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-wash-border"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-wash-primary/10 p-2 text-wash-primary">
                      <Building size={18} />
                    </div>
                    <div>
                      <h3 className="font-display text-base font-black text-wash-accent">
                        {e.NombreEdificio_DC}
                      </h3>
                      <p className="text-xs text-wash-text-muted">{e.Direccion_DC ?? '—'}</p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-wash-canvas px-3 py-2">
                      <div className="text-xs text-wash-text-muted">Máquinas</div>
                      <div className="mt-0.5 font-bold text-wash-text-strong">{maqs.length}</div>
                    </div>
                    <div className="rounded-lg bg-wash-canvas px-3 py-2">
                      <div className="text-xs text-wash-text-muted">Ventilaciones</div>
                      <div className="mt-0.5 font-bold text-wash-text-strong">{vents.length}</div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-wash-border">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-wash-text-muted">
          {label}
        </span>
        <Icon size={16} className="text-wash-primary" />
      </div>
      <div className="mt-2 font-display text-3xl font-black text-wash-accent">{value}</div>
    </div>
  );
}
