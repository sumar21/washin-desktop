import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UserCog } from 'lucide-react';
import { Modal, ModalActions } from '@/components/Modal';
import { StatusBadge } from '@/components/StatusBadge';
import { useAppStore } from '@/store/useAppStore';
import type { ResumenPlanificacion } from '@/types/domain';

export function DetallePlanificacion() {
  const navigate = useNavigate();
  const MesAno = useAppStore((s) => s.MesAnoPlanificacionDetail);
  const MesDetail = useAppStore((s) => s.MesDetail);
  const setMesPlanif = useAppStore((s) => s.setMesPlanificacionDetail);
  const resumen = useAppStore((s) => s.CollectResumenPlanificaciones);
  const detalles = useAppStore((s) => s.CollectDetallePlanificaciones);
  const edificios = useAppStore((s) => s.CollectEdificiosVisitar);
  const usuarios = useAppStore((s) => s.CollectUser);

  const [query, setQuery] = useState('');
  const [reassign, setReassign] = useState<ResumenPlanificacion | null>(null);
  const [newTec, setNewTec] = useState('');

  const filtered = useMemo(() => {
    if (!MesAno) return [];
    const q = query.toLowerCase();
    return resumen
      .filter((r) => r.MesAnoPlanificado_RP === MesAno)
      .filter(
        (r) =>
          r.Tecnico_RP.toLowerCase().includes(q) || r.NroRuta_RP.toLowerCase().includes(q)
      )
      .sort((a, b) => a.Tecnico_RP.localeCompare(b.Tecnico_RP));
  }, [resumen, MesAno, query]);

  const tecnicos = usuarios.filter((u) => u.Rol === 'Tecnico' && u.Status === 'ALTA');

  if (!MesAno) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-wash-text-muted">No hay mes seleccionado.</p>
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
              setMesPlanif(null, null);
              navigate('/rutas');
            }}
            className="rounded-lg bg-wash-canvas p-2 text-wash-primary hover:bg-wash-border/50"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <p className="text-xs uppercase tracking-widest text-wash-text-muted">
              Planificación
            </p>
            <h1 className="font-display text-2xl font-black text-wash-primary-soft">
              {MesDetail} — {MesAno}
            </h1>
          </div>
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar técnico o ruta…"
          className="w-[260px] rounded-full bg-wash-canvas px-4 py-2 text-sm outline-none ring-1 ring-wash-border focus:ring-wash-primary"
        />
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-3 gap-4">
          {filtered.map((r) => {
            const circuitos = detalles.filter((d) => d.IDUnivoco_DP === r.IDUnivocoRuta_RP);
            return (
              <article
                key={r.ID}
                className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-wash-border"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-wash-text-muted">
                      Ruta {r.NroRuta_RP}
                    </p>
                    <h3 className="mt-1 font-display text-lg font-black text-wash-accent">
                      {r.Tecnico_RP}
                    </h3>
                  </div>
                  <StatusBadge status={r.Status_RP} />
                </div>

                <div className="mt-3 space-y-2 text-sm">
                  {circuitos.map((c) => {
                    const visitas = edificios.filter(
                      (e) => e.IDUnivocoCircuito_EV === c.IDUnivocoCircuito_DP
                    );
                    return (
                      <div
                        key={c.ID}
                        className="rounded-lg bg-wash-canvas px-3 py-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-wash-text-strong">
                            Circuito {c.NroCircuito_DP}
                          </span>
                          <StatusBadge status={c.Status_DP} />
                        </div>
                        <ul className="mt-1 space-y-0.5 text-xs text-wash-text-muted">
                          {visitas.map((v) => (
                            <li key={v.ID} className="flex items-center justify-between">
                              <span>• {v.NombreEdificio_EV}</span>
                              <StatusBadge status={v.Status_EV} />
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setReassign(r);
                    setNewTec(r.Tecnico_RP);
                  }}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-wash-primary/10 px-3 py-2 text-sm font-semibold text-wash-primary hover:bg-wash-primary/20"
                >
                  <UserCog size={14} />
                  Cambiar técnico
                </button>
              </article>
            );
          })}
        </div>
      </div>

      <Modal
        open={!!reassign}
        onClose={() => setReassign(null)}
        title="Reasignar técnico"
      >
        {reassign && (
          <>
            <p className="text-sm text-wash-text">
              Ruta {reassign.NroRuta_RP} · actual: {reassign.Tecnico_RP}
            </p>
            <div className="mt-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-wash-text-muted">
                Nuevo técnico
              </label>
              <select
                value={newTec}
                onChange={(e) => setNewTec(e.target.value)}
                className="mt-1 w-full rounded-lg border border-wash-border bg-wash-canvas px-3 py-2"
              >
                {tecnicos.map((t) => (
                  <option key={t.ID} value={t.Concat_Nombre_Apellido}>
                    {t.Concat_Nombre_Apellido}
                  </option>
                ))}
              </select>
            </div>
            <ModalActions>
              <button
                type="button"
                onClick={() => setReassign(null)}
                className="rounded-lg border border-wash-border px-4 py-2 font-medium text-wash-text-strong hover:bg-wash-canvas"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setReassign(null);
                }}
                className="rounded-lg bg-wash-primary px-4 py-2 font-medium text-white hover:brightness-110"
              >
                Confirmar
              </button>
            </ModalActions>
          </>
        )}
      </Modal>
    </div>
  );
}
