import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Eye,
  Pencil,
  UserCog,
  UserMinus,
  Plus,
  AlertTriangle,
  Building2,
  Wrench,
  Calendar,
  UserCircle2,
  ShoppingCart,
  ArrowLeftRight,
  WashingMachine,
  Check,
  AlertCircle,
  ClipboardCheck,
  Loader2,
  Trash2,
  ChevronDown,
  StickyNote,
  CheckCircle2,
  Ban,
  Camera,
  X,
  Download,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Modal, ModalActions, ConfirmDialog } from '@/components/Modal';
import { StatusBadge } from '@/components/StatusBadge';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { ErrorState } from '@/components/ErrorState';
import { MultiSelect, type MultiOption } from '@/components/ui/multi-select';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { PopoverClose } from '@/components/ui/popover';
import { useAppStore } from '@/store/useAppStore';
import { getIncidentes, getFotosIncidente } from '@/services/api';
import { last12MesesOptions, estadoOptions, edificioOptions } from '@/lib/filters';
import { cn, proper } from '@/lib/utils';
import type { Incidente, RepuestoIncidente, FotoIncidente } from '@/types/domain';

/**
 * Quién anuló el reclamo. Dato duro sólo desde que existe la columna `UsuarioAnulado_IN` en
 * SharePoint (la escribe el desktop al anular); para el histórico se INFIERE y se marca como tal.
 *
 * La inferencia usa `Resuelto_IN` como discriminador de origen, que es exacto y no heurístico:
 * la mobile anula con `Resuelto_IN='SI'` y el desktop lo deja en `'NO'` (las dos formas de anular
 * documentadas en el CLAUDE.md raíz). En la mobile sólo puede anular el técnico asignado —su gate
 * es `Status_IN='A Revisar' And TecnicoAsignado_IN = NombreUser`— y el anulado no toca esa columna,
 * así que `TecnicoAsignado_IN` ES quien anuló. Verificado contra producción: 398 de los 399
 * anulados por la mobile tienen técnico cargado.
 *
 * Para los anulados viejos del desktop NO se infiere: el técnico que figura (3 de 14) es a quien
 * se le había avisado, no quien anuló, y atribuírselo sería falso.
 */
function anuladoPor(i: Incidente): React.ReactNode {
  if (i.UsuarioAnulado_IN) return i.UsuarioAnulado_IN;
  if (i.Resuelto_IN === 'SI' && i.TecnicoAsignado_IN) {
    return (
      <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
        {i.TecnicoAsignado_IN}
        <span className="text-[10px] font-normal italic text-wash-text-muted">estimado</span>
      </span>
    );
  }
  return <span className="text-wash-text-muted">Sin registro</span>;
}

const requiereRepuesto = (i: Incidente) => /repuesto/i.test(i.NoResuelto_IN);
const esCambioMaquina = (i: Incidente) => /cambio/i.test(i.NoResuelto_IN);
const segmentoDe = (concat?: string) => (concat ? concat.split(' - ')[0].trim() : '');

// Bitácoras de movimiento de máquina: cada transferencia/baja crea un 10.Incidentes YA resuelto
// como historial (api/_lib/maquinaMoves.ts, NoResuelto_IN 'Transferencia' / 'Baja de Maquina').
// No son OTs — se ven en el historial de la máquina (DetalleMaquina), NO en la grilla de incidentes;
// si no, ensucian el filtro "Resuelto". Ningún reclamo real usa esos NoResuelto_IN, así que excluir
// por ese valor es seguro.
const TIPOS_BITACORA_MAQUINA = new Set(['transferencia', 'baja de maquina']);
const esBitacoraMaquina = (i: Incidente) =>
  TIPOS_BITACORA_MAQUINA.has(i.NoResuelto_IN.trim().toLowerCase());

const tipoTone: Record<string, string> = {
  'Requiere Repuesto': 'bg-amber-50 text-amber-800 ring-amber-300/70',
  'Cambio de Maquina': 'bg-violet-50 text-violet-800 ring-violet-300/70',
  'Atencion al Cliente': 'bg-sky-50 text-sky-800 ring-sky-300/70',
  'Reportado Por Tecnico': 'bg-sky-50 text-sky-800 ring-sky-300/70',
};
const toneFor = (t: string) =>
  tipoTone[t] ??
  (/repuesto/i.test(t)
    ? tipoTone['Requiere Repuesto']
    : /cambio/i.test(t)
      ? tipoTone['Cambio de Maquina']
      : 'bg-slate-50 text-slate-700 ring-slate-300/70');

// Última columna = botonera de acciones. Ancho pensado para el peor caso REAL de una fila:
// ver + editar + acción contextual + desasignar + anular = 5 × 32px + 4 gaps × 6px = 184px.
// Con 120px los IconBtn (que son flex sin shrink-0) se comprimían hasta quedar irreconocibles y
// la acción nueva parecía no existir. El msapp no tenía este problema porque mostraba UN ícono
// contextual por fila posicionado por X, no una botonera acumulativa.
const GRID = '120px 96px 150px minmax(190px,1.5fr) minmax(150px,1fr) minmax(120px,0.9fr) 190px';

// Estados de un incidente SIN resolver (por defecto se muestran estos, Resuelto_IN='NO').
const ESTADOS_IN = ['A Revisar', 'Pendiente', 'Asignado', 'En Aprobacion'];

// Un Admin puede anular (baja lógica) un reclamo abierto. Los resueltos/cerrados
// (Resuelto_IN='SI') y los ya anulados no. Coincide con el gate server-side.
// Anulable = reclamo abierto y NO en aprobación (uno que ya avanzó a aprobación no se anula).
const ESTADOS_ANULABLES = ['A Revisar', 'Pendiente', 'Asignado'];
const esAnulable = (i: Incidente) => i.Resuelto_IN !== 'SI' && ESTADOS_ANULABLES.includes(i.Status_IN);
// Estados de un incidente YA resuelto. Tildar alguno en el filtro de Estado dispara el fetch
// de resueltos (por mes) que se mergean con los abiertos.
const ESTADOS_IN_RESUELTOS = ['Resuelto', 'Aprobada', 'Rechazada'];

// Una compra "abierta" para un incidente bloquea generar otra (guard anti-duplicado del
// msapp: Screen_Incidentes.pa.yaml:192, CollectAUX filtra 05.PedidoCompras por
// IDIncidenteCompra_PC con Status Pendiente/En Aprobacion/Aprobada).
const ESTADOS_COMPRA_ABIERTA = ['Pendiente', 'En Aprobacion', 'Aprobada'];

// Filtro de asignación: un incidente está "asignado" si tiene técnico (TecnicoAsignado_IN).
const ASIGNACION_OPTS: MultiOption[] = [
  { value: 'asignado', label: 'Asignado' },
  { value: 'sin_asignar', label: 'Sin asignar' },
];
const asignacionDe = (i: Incidente) => (i.TecnicoAsignado_IN ? 'asignado' : 'sin_asignar');

// Dedupe por identidad de item de lista (ID), NO agrupar y sumar por nombre de repuesto:
// la duplicación es de IDENTIDAD (la misma fila de 13.RepuestosIncidentes repetida M+1 veces,
// una por mes tildado + la del store), no de granularidad. Sumar Cantidad_RI falsearía el dato
// (12×1 unidad de un repuesto del que se usó 1) y el modal de compra pediría 12 unidades.
const dedupeById = <T extends { ID: number }>(arr: T[]): T[] => {
  const seen = new Set<number>();
  return arr.filter((i) => (seen.has(i.ID) ? false : (seen.add(i.ID), true)));
};

// Descarga de la foto de resolución. No hay request: el backend ya devuelve Foto_FI como data URI
// (api/_lib/lists.ts, base64ToDataUri), así que el href del <a download> es el dato mismo.
const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

// La extensión sale del mime del propio data URI; el mime lo infiere el backend por magic bytes
// porque 12.FotoIncidentes no guarda content-type en ninguna columna.
const extDeDataUri = (dataUri: string) => {
  const mime = /^data:image\/([a-z0-9.+-]+);/i.exec(dataUri)?.[1]?.toLowerCase();
  return mime === 'jpeg' || !mime ? 'jpg' : mime;
};

function descargarFoto(dataUri: string, incidente: Incidente, n: number, total: number) {
  const partes = ['incidente', incidente.IDIncidente || String(incidente.ID)];
  if (incidente.NombreEdificio_IN) partes.push(slug(incidente.NombreEdificio_IN));
  if (total > 1) partes.push(String(n));
  const a = document.createElement('a');
  a.href = dataUri;
  a.download = `${partes.join('-')}.${extDeDataUri(dataUri)}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function Incidentes() {
  const incidentes = useAppStore((s) => s.CollectIncidentes);
  const repuestos = useAppStore((s) => s.CollectRepuestosIncidente);
  const stock = useAppStore((s) => s.CollectStock);
  const maquinas = useAppStore((s) => s.CollectMaquinas);
  const edificiosMaquina = useAppStore((s) => s.CollectEdificiosMaquina);
  const edificiosAbm = useAppStore((s) => s.CollectAbmEdificios);
  const tecnicos = useAppStore((s) => s.CollectTecnicosDisponibles);
  const compras = useAppStore((s) => s.CollectCompras);
  const fetchIncidentes = useAppStore((s) => s.fetchIncidentes);
  const fetchStock = useAppStore((s) => s.fetchStock);
  const fetchMaquinas = useAppStore((s) => s.fetchMaquinas);
  const fetchTecnicos = useAppStore((s) => s.fetchTecnicos);
  const fetchCompras = useAppStore((s) => s.fetchCompras);
  const fetchAbm = useAppStore((s) => s.fetchAbm);

  // Universo de edificios del combo "Nuevo incidente" = UNIÓN de dos fuentes:
  //  1) los derivados del parque de máquinas (08.DetalleMaquina, con el nombre EXACTO Edificio_DM,
  //     que es contra el que el sub-selector de máquina matchea), y
  //  2) el catálogo ABM.Edificios (Status='ALTA').
  // El reclamo es a nivel EDIFICIO (la máquina es opcional), así que un edificio recién dado de alta
  // —que todavía no tiene ninguna máquina— también tiene que poder elegirse. Antes el combo salía
  // SOLO de (1), por eso un edificio nuevo sin máquinas no aparecía (reporte de Paul). La unión es
  // aditiva: no le saca opciones a ningún edificio existente, solo suma los que faltaban.
  const edificios = useMemo(() => {
    const seen = new Set<string>();
    const out: { edificio: string; codigo: string }[] = [];
    // Dedup por CÓDIGO (identidad estable) cuando existe; por nombre solo si no hay código.
    // Se recorre ABM PRIMERO para que gane su nombre (el actual): al renombrar un edificio en ABM,
    // las máquinas conservan el nombre viejo en Edificio_DM (no se cascadea), así que el derivado
    // del parque trae el nombre viejo. Sin dedupe por código, el edificio salía DUPLICADO en el
    // combo (uno con el nombre viejo de las máquinas, otro con el nuevo de ABM). Reporte C-219/C-1373.
    const key = (codigo: string, nombre: string) =>
      codigo.trim() ? `c:${codigo.trim().toLowerCase()}` : `n:${nombre.trim().toLowerCase()}`;
    const add = (nombre: string, codigo: string) => {
      const n = nombre.trim();
      if (!n) return;
      const k = key(codigo, n);
      if (seen.has(k)) return;
      seen.add(k);
      out.push({ edificio: n, codigo: codigo.trim() });
    };
    for (const e of edificiosAbm) add(e.Edificio, e.Codigo); // ABM primero: nombre canónico
    for (const e of edificiosMaquina) add(e.edificio, e.codigo);
    return out.sort((a, b) => a.edificio.localeCompare(b.edificio, 'es'));
  }, [edificiosMaquina, edificiosAbm]);
  const createIncidente = useAppStore((s) => s.createIncidente);
  const editIncidente = useAppStore((s) => s.editIncidente);
  const assignIncidente = useAppStore((s) => s.assignIncidente);
  const cambiarTecnicoIncidente = useAppStore((s) => s.cambiarTecnicoIncidente);
  const desasignarIncidente = useAppStore((s) => s.desasignarIncidente);
  const cambioMaquinaIncidente = useAppStore((s) => s.cambioMaquinaIncidente);
  const generarCompraIncidente = useAppStore((s) => s.generarCompraIncidente);
  const anularIncidente = useAppStore((s) => s.anularIncidente);
  const VarTipoUser = useAppStore((s) => s.VarTipoUser);
  const isAdmin = VarTipoUser === 'Admin';

  const [query, setQuery] = useState('');
  const [filterMesAno, setFilterMesAno] = useState<string[]>([]);
  const [filterEstado, setFilterEstado] = useState<string[]>([]);
  const [filterEdificio, setFilterEdificio] = useState<string[]>([]);
  const [filterTipo, setFilterTipo] = useState<string[]>([]);
  const [filterAsignacion, setFilterAsignacion] = useState<string[]>([]);

  // Resueltos traídos on-demand (por mes) cuando se tildan estados resueltos en el filtro.
  // NO van al store (otras pantallas usan CollectIncidentes como "abiertos"): viven acá.
  const [resueltosExtra, setResueltosExtra] = useState<Incidente[]>([]);
  const [repuestosExtra, setRepuestosExtra] = useState<RepuestoIncidente[]>([]);

  const [detail, setDetail] = useState<Incidente | null>(null);
  const [assigning, setAssigning] = useState<Incidente | null>(null);
  const [reassign, setReassign] = useState(false); // true = cambiar técnico (sin descuento)
  const [comprar, setComprar] = useState<Incidente | null>(null);
  const [cambioMaq, setCambioMaq] = useState<Incidente | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [editing, setEditing] = useState<Incidente | null>(null); // editar un "A Revisar"
  const [anulando, setAnulando] = useState<Incidente | null>(null);
  const [anularBusy, setAnularBusy] = useState(false);
  const [anularError, setAnularError] = useState<string | null>(null);
  const [anularMotivo, setAnularMotivo] = useState(''); // obligatorio → DescripcionAnulado_IN
  const [desasignando, setDesasignando] = useState<Incidente | null>(null);
  const [desasignarBusy, setDesasignarBusy] = useState(false);
  const [desasignarError, setDesasignarError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    // Estado derivado del filtro: una recarga completa (montaje o "Reintentar") lo invalida.
    setResueltosExtra([]);
    setRepuestosExtra([]);
    // fetchAbm alimenta el catálogo de edificios (ABM.Edificios) del combo "Nuevo incidente".
    // Best-effort: si el bundle de ABM falla, el combo cae a los edificios con máquina (comportamiento
    // previo) en vez de tumbar toda la pantalla de incidentes.
    return Promise.all([fetchIncidentes(), fetchStock(), fetchMaquinas(), fetchTecnicos(), fetchCompras(), fetchAbm().catch(() => {})])
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'No se pudieron cargar los incidentes.'))
      .finally(() => setLoading(false));
  }, [fetchIncidentes, fetchStock, fetchMaquinas, fetchTecnicos, fetchCompras, fetchAbm]);

  // Trae los resueltos de los meses dados (GET /incidentes?resueltos=MM/YYYY) y los guarda en
  // el estado local (mergea incidentes + repuestos de todos los meses, dedupe por ID).
  const loadResueltos = useCallback(async (meses: string[]) => {
    setLoading(true);
    setLoadError(null);
    try {
      const results = await Promise.all(meses.map((m) => getIncidentes(m)));
      const inc: Incidente[] = [];
      const reps: RepuestoIncidente[] = [];
      for (const r of results) {
        inc.push(...r.incidentes);
        reps.push(...r.repuestos);
      }
      setResueltosExtra(dedupeById(inc));
      setRepuestosExtra(dedupeById(reps));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'No se pudieron cargar los incidentes resueltos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial; "Reintentar" también dispara load().
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar.
  }, []);

  // Defensa en profundidad: `repuestos` (store) y `repuestosExtra` (on-demand) SIEMPRE se solapan,
  // porque cada GET de resueltos devuelve 13.RepuestosIncidentes entera.
  const repuestosDe = useCallback(
    (id: number) =>
      dedupeById([...repuestos, ...repuestosExtra]).filter((r) => r.IDIncidente_RI === String(id)),
    [repuestos, repuestosExtra]
  );

  // Abiertos = store (fuente de verdad de otras pantallas). Si el usuario tildó algún estado
  // resuelto, mergeamos los resueltos traídos on-demand. displayList alimenta filtro + render.
  const abiertos = incidentes;
  const wantResueltos = useMemo(
    () => filterEstado.some((e) => ESTADOS_IN_RESUELTOS.includes(e)),
    [filterEstado]
  );
  const displayList = useMemo(() => {
    const base = wantResueltos ? dedupeById([...abiertos, ...resueltosExtra]) : abiertos;
    // Fuera las bitácoras de transfer/baja de máquina (no son OTs; ver esBitacoraMaquina).
    return base.filter((i) => !esBitacoraMaquina(i));
  }, [wantResueltos, abiertos, resueltosExtra]);

  const hasStock = useCallback(
    (i: Incidente): boolean => {
      const reps = repuestosDe(i.ID);
      if (reps.length === 0) return true;
      return reps.every((r) => {
        const s = stock.find((st) => st.Status_ST === 'Activo' && st.Item_ST.trim().toLowerCase() === r.Repuesto_RI.trim().toLowerCase());
        return !!s && s.Cantidad_ST >= r.Cantidad_RI;
      });
    },
    [repuestosDe, stock]
  );

  // Guard anti-duplicado: ¿ya hay una compra abierta generada desde este incidente?
  const yaHayCompra = useCallback(
    (id: number): boolean =>
      compras.some(
        (c) => c.IDIncidenteCompra_PC === String(id) && ESTADOS_COMPRA_ABIERTA.includes(c.Status_PC)
      ),
    [compras]
  );

  const mesAnoOpts = useMemo(() => last12MesesOptions(), []);
  // Opciones de Estado = canónicos abiertos + resueltos ∪ los presentes en la lista mostrada.
  const estadoOpts = useMemo(
    () => {
      const canon = [...ESTADOS_IN, ...ESTADOS_IN_RESUELTOS];
      return estadoOptions([...canon, ...displayList.map((i) => i.Status_IN)], canon);
    },
    [displayList]
  );
  // Edificio: del CATÁLOGO (ABM.Edificios ALTA), no de los incidentes cargados — ver edificioOptions.
  const edificioOpts = useMemo<MultiOption[]>(() => edificioOptions(edificiosAbm), [edificiosAbm]);
  const tipoOpts = useMemo<MultiOption[]>(
    () =>
      [...new Set(displayList.map((i) => i.NoResuelto_IN).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'es'))
        .map((t) => ({ value: t, label: t })),
    [displayList]
  );
  const mesAnoLabel = useMemo(() => new Map(mesAnoOpts.map((o) => [o.value, o.label])), [mesAnoOpts]);

  const activeChips = useMemo<{ cat: string; label: string }[]>(() => {
    const chips: { cat: string; label: string }[] = [];
    filterMesAno.forEach((v) => chips.push({ cat: 'Mes', label: mesAnoLabel.get(v) ?? v }));
    filterEstado.forEach((v) => chips.push({ cat: 'Estado', label: v }));
    filterEdificio.forEach((v) => chips.push({ cat: 'Edificio', label: v }));
    filterTipo.forEach((v) => chips.push({ cat: 'Tipo', label: v }));
    filterAsignacion.forEach((v) =>
      chips.push({ cat: 'Asignación', label: v === 'asignado' ? 'Asignado' : 'Sin asignar' })
    );
    return chips;
  }, [filterMesAno, filterEstado, filterEdificio, filterTipo, filterAsignacion, mesAnoLabel]);

  const hasFilters = activeChips.length > 0;
  const clearFilters = () => {
    setFilterMesAno([]);
    setFilterEstado([]);
    setFilterEdificio([]);
    setFilterTipo([]);
    setFilterAsignacion([]);
    // Los resueltos/repuestos on-demand son estado derivado del filtro: si el filtro se limpia,
    // se limpian. Si no, repuestosExtra queda stale y contamina el detalle de los ABIERTOS
    // (repuestosDe no está gateado por wantResueltos, a diferencia de displayList).
    setResueltosExtra([]);
    setRepuestosExtra([]);
  };

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    const pass = (arr: string[], v: string) => arr.length === 0 || arr.includes(v);
    return displayList
      .filter((i) => pass(filterMesAno, i.FechaMesAno_IN))
      // Los anulados no ensucian la grilla por defecto: solo se ven si se piden
      // explícitamente desde el filtro de estado (que sigue ofreciendo 'Anulado').
      .filter((i) => filterEstado.length > 0 || i.Status_IN !== 'Anulado')
      .filter((i) => pass(filterEstado, i.Status_IN))
      .filter((i) => pass(filterEdificio, i.NombreEdificio_IN))
      .filter((i) => pass(filterTipo, i.NoResuelto_IN))
      .filter((i) => pass(filterAsignacion, asignacionDe(i)))
      .filter(
        (i) =>
          i.NombreEdificio_IN.toLowerCase().includes(q) ||
          (i.ConcatMaquina_IN ?? '').toLowerCase().includes(q) ||
          i.NoResuelto_IN.toLowerCase().includes(q) ||
          (i.TecnicoAsignado_IN ?? '').toLowerCase().includes(q) ||
          String(i.ID).includes(q)
      );
  }, [displayList, query, filterMesAno, filterEstado, filterEdificio, filterTipo, filterAsignacion]);

  const abrirAsignar = (i: Incidente, esReasignar: boolean) => {
    setReassign(esReasignar);
    setAssigning(i);
  };

  const handleAnular = async () => {
    if (!anulando) return;
    const motivo = anularMotivo.trim();
    if (!motivo) {
      setAnularError('Indicá el motivo de la anulación.');
      return;
    }
    setAnularBusy(true);
    setAnularError(null);
    try {
      await anularIncidente(anulando.ID, motivo);
      setAnulando(null);
      setAnularMotivo('');
    } catch (err) {
      setAnularError(err instanceof Error ? err.message : 'No se pudo anular el reclamo.');
    } finally {
      setAnularBusy(false);
    }
  };

  const handleDesasignar = async () => {
    if (!desasignando) return;
    setDesasignarBusy(true);
    setDesasignarError(null);
    try {
      await desasignarIncidente(desasignando.ID);
      setDesasignando(null);
    } catch (err) {
      setDesasignarError(err instanceof Error ? err.message : 'No se pudo desasignar el reclamo.');
    } finally {
      setDesasignarBusy(false);
    }
  };

  // Desasignar: solo sobre "A Revisar" con técnico avisado (paridad con el PowerApps de la
  // mobile, que blanqueaba TecnicoAsignado_IN al "No Resuelto"). Sobre un "Asignado" NO se
  // ofrece: ese ya comprometió stock y el camino es "Cambiar técnico" (gate también server-side).
  const desasignarAction = (i: Incidente) =>
    i.Status_IN === 'A Revisar' && !!i.TecnicoAsignado_IN ? (
      <IconBtn icon={UserMinus} tone="warning" title="Desasignar técnico" onClick={() => setDesasignando(i)} />
    ) : null;

  // Acción SOLO Admin: anular (baja lógica) un reclamo abierto.
  const adminAction = (i: Incidente) =>
    isAdmin && esAnulable(i) ? (
      <IconBtn icon={Trash2} tone="danger" title="Anular reclamo" onClick={() => setAnulando(i)} />
    ) : null;

  // Acción contextual de una fila/card según tipo + estado + stock (reusada en tabla y cards).
  const primaryAction = (i: Incidente) => {
    // Los incidentes resueltos son cerrados: sin acciones de mutación (solo ver detalle).
    if (i.Resuelto_IN === 'SI') return null;
    const reps = repuestosDe(i.ID);
    const sinStock = requiereRepuesto(i) && reps.length > 0 && !hasStock(i);
    const asignado = !!i.TecnicoAsignado_IN && i.Status_IN === 'Asignado';
    // 'En Aprobacion' → esperando resolución en Aprobaciones (read-only). Solo ocurre en cambio de máquina.
    if (i.Status_IN === 'En Aprobacion')
      return <IconBtn icon={AlertCircle} tone="violet" title="En aprobación de cambio de máquina" onClick={() => setDetail(i)} />;
    // 'A Revisar' → el triaje real lo hace la MOBILE (Requiere Repuesto / Cambio de Maquina /
    // Resuelto). El desktop NO presume repuesto ni fuerza el tipo: sólo transfiere/asigna el
    // técnico sin tocar stock (msapp IMG_TransferirTecnico → PopUpCambiarTecnico). Usa el flujo
    // "cambiar técnico" (reassign=true = sin descuento), nunca assign() (que descontaría stock).
    if (i.Status_IN === 'A Revisar')
      return <IconBtn icon={UserCog} tone="brand" title='Asignar técnico para revisión (queda "A Revisar")' onClick={() => abrirAsignar(i, true)} />;
    if (sinStock) {
      // Guard: si ya hay una compra abierta para este incidente, no se genera otra.
      if (yaHayCompra(i.ID))
        return <IconBtn icon={Check} tone="neutral" title="Compra ya generada — pendiente de reposición" onClick={() => setDetail(i)} />;
      return <IconBtn icon={ShoppingCart} tone="warning" title="Sin stock — Generar compra" onClick={() => setComprar(i)} />;
    }
    if (esCambioMaquina(i)) {
      // Pre-aprobación: generar la solicitud de cambio (elegir máquina de reemplazo en depósito).
      if (i.Status_IN === 'Pendiente')
        return <IconBtn icon={WashingMachine} tone="violet" title="Gestionar cambio de máquina" onClick={() => setCambioMaq(i)} />;
      // Aprobada: finalizar = asignar técnico (msapp Screen_Incidentes línea 501/2640).
      if (i.Status_IN === 'Aprobada')
        return <IconBtn icon={UserCog} tone="brand" title="Asignar técnico (finalizar cambio)" onClick={() => abrirAsignar(i, false)} />;
      // Ya asignado: permitir cambiar técnico (igual que cualquier incidente).
      if (asignado)
        return <IconBtn icon={UserCog} tone="brand" title="Cambiar técnico" onClick={() => abrirAsignar(i, true)} />;
      return null; // otros estados de cambio: sin acción de mutación ('A Revisar' se maneja arriba).
    }
    if (asignado) return <IconBtn icon={UserCog} tone="brand" title="Cambiar técnico" onClick={() => abrirAsignar(i, true)} />;
    return <IconBtn icon={UserCog} tone="brand" title="Asignar técnico" onClick={() => abrirAsignar(i, false)} />;
  };

  const emptyInc = (
    <EmptyState
      icon={ClipboardCheck}
      title="Sin incidentes pendientes"
      description={
        hasFilters
          ? 'Ningún incidente coincide con los filtros aplicados.'
          : 'No hay reportes abiertos por el momento.'
      }
      action={hasFilters && <Button variant="outline" onClick={clearFilters}>Limpiar filtros</Button>}
    />
  );

  return (
    <div className="relative flex h-full w-full flex-col">
      <PageHeader
        title="Incidentes"
        subtitle="Reportes — repuestos, cambios de máquina y resueltos"
        search={{ value: query, onChange: setQuery, placeholder: 'Edificio, máquina, tipo, técnico…' }}
        filterPopover={
          <FilterContent
            mesAno={filterMesAno}
            estado={filterEstado}
            edificio={filterEdificio}
            tipo={filterTipo}
            asignacion={filterAsignacion}
            mesAnoOpts={mesAnoOpts}
            estadoOpts={estadoOpts}
            edificioOpts={edificioOpts}
            tipoOpts={tipoOpts}
            onApply={(f) => {
              setFilterMesAno(f.mesAno);
              setFilterEstado(f.estado);
              setFilterEdificio(f.edificio);
              setFilterTipo(f.tipo);
              setFilterAsignacion(f.asignacion);
              // Si tildó estados resueltos → fetch de los meses elegidos (o el mes actual).
              // Si no, limpiamos los resueltos locales y mostramos solo abiertos.
              if (f.estado.some((e) => ESTADOS_IN_RESUELTOS.includes(e))) {
                const meses = f.mesAno.length > 0 ? f.mesAno : [mesAnoOpts[0].value];
                void loadResueltos(meses);
              } else {
                setResueltosExtra([]);
                setRepuestosExtra([]);
              }
            }}
          />
        }
        onAdd={() => setNewOpen(true)}
        addLabel="Nuevo incidente"
      />
      <LoadingOverlay visible={loading} label="Cargando incidentes…" />

      {loadError ? (
        <ErrorState message={loadError} onRetry={load} />
      ) : (
        <>
          {hasFilters && (
            <div className="flex flex-wrap items-center gap-2 border-b border-wash-border bg-wash-surface-2/40 px-4 py-2 text-xs text-wash-text-muted md:px-6">
              <span className="font-semibold uppercase tracking-wider">Filtros:</span>
              {activeChips.map((c, idx) => (
                <Chip key={`${c.cat}-${c.label}-${idx}`}>
                  <span className="text-wash-brand/70">{c.cat}:</span> {c.label}
                </Chip>
              ))}
              <button type="button" onClick={clearFilters} className="ml-auto hover:text-wash-text-strong">
                Limpiar
              </button>
            </div>
          )}

          <div className="flex-1 overflow-hidden p-3 md:p-6">
            {/* MOBILE (<lg): una card por incidente (DESIGN.md §5.4) */}
            <div className="flex h-full flex-col gap-2 overflow-y-auto lg:hidden">
              {filtered.length === 0 ? (
                <div className="flex h-full items-center justify-center">{emptyInc}</div>
              ) : (
                filtered.map((i) => {
                  return (
                    <div key={i.ID} className="rounded-xl border border-wash-border bg-wash-surface p-3 shadow-sm transition active:scale-[0.99]">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <StatusBadge status={i.Status_IN} />
                          <span className={cn('inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-semibold ring-1', toneFor(i.NoResuelto_IN))}>
                            <Wrench size={8} className="shrink-0" />
                            <span className="min-w-0 truncate">{i.NoResuelto_IN || '—'}</span>
                          </span>
                        </div>
                        <div className="flex shrink-0 gap-1.5">
                          <IconBtn icon={Eye} tone="neutral" title="Ver detalle" onClick={() => setDetail(i)} />
                          {i.Status_IN === 'A Revisar' && (
                            <IconBtn icon={Pencil} tone="brand" title="Editar reclamo" onClick={() => setEditing(i)} />
                          )}
                          {primaryAction(i)}
                          {desasignarAction(i)}
                          {adminAction(i)}
                        </div>
                      </div>
                      <div className="mt-2 min-w-0">
                        <p className="flex min-w-0 items-center gap-1.5 truncate text-[13.5px] font-semibold text-wash-text-strong">
                          <Building2 size={12} className="shrink-0 text-wash-text-muted" />
                          <span className="truncate">{i.NombreEdificio_IN}</span>
                        </p>
                        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 pl-[18px]">
                          <p className="truncate text-[11.5px] text-wash-text-muted">
                            {i.ConcatMaquina_IN ? proper(i.ConcatMaquina_IN) : <span className="italic">Sin máquina</span>}
                          </p>
                          {i.IDMaquina_IN && (
                            <span className="shrink-0 rounded bg-wash-brand/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-wash-brand">
                              #{i.IDMaquina_IN}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-2.5 space-y-1.5 border-t border-wash-divider/60 pt-2 text-[11.5px]">
                        <div className="flex items-center gap-1.5 text-wash-text-muted">
                          <Calendar size={11} className="shrink-0" />
                          {i.Fecha_IN}
                        </div>
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-wash-text-muted">Técnico</span>
                          {i.TecnicoAsignado_IN ? (
                            <span className="min-w-0 truncate font-medium text-wash-text-strong">{i.TecnicoAsignado_IN}</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                              <UserCircle2 size={12} /> Sin asignar
                            </span>
                          )}
                        </div>
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-wash-text-muted">Asignador</span>
                          <span className="min-w-0 truncate font-medium text-wash-text-strong">{i.User_IN || '—'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* DESKTOP (≥lg): tabla */}
            <div className="hidden h-full flex-col overflow-hidden rounded-2xl bg-wash-surface shadow-sm ring-1 ring-wash-border lg:flex">
              <div
                className="grid shrink-0 border-b border-wash-border bg-wash-canvas px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-wash-text-muted"
                style={{ gridTemplateColumns: GRID }}
              >
                <div>Estado</div>
                <div>Fecha</div>
                <div>Tipo</div>
                <div>Edificio / Máquina</div>
                <div>Técnico</div>
                <div>Asignador</div>
                <div className="text-right">Acciones</div>
              </div>

              <div className="flex-1 overflow-auto">
                {filtered.length === 0 ? (
                  <div className="flex h-full items-center justify-center">{emptyInc}</div>
                ) : (
                  filtered.map((i) => {
                    return (
                      <div
                        key={i.ID}
                        className="grid items-center border-b border-wash-divider/60 px-5 py-3 text-sm hover:bg-wash-canvas"
                        style={{ gridTemplateColumns: GRID }}
                      >
                        <div>
                          <StatusBadge status={i.Status_IN} />
                        </div>
                        <div className="inline-flex items-center gap-1.5 pr-2 text-[12.5px] text-wash-text">
                          <Calendar size={11} className="shrink-0 text-wash-text-faint" />
                          {i.Fecha_IN}
                        </div>
                        <div className="min-w-0 pr-3">
                          <span
                            title={i.NoResuelto_IN}
                            className={cn('inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1', toneFor(i.NoResuelto_IN))}
                          >
                            <Wrench size={9} className="shrink-0" />
                            <span className="min-w-0 truncate">{i.NoResuelto_IN || '—'}</span>
                          </span>
                        </div>
                        <div className="min-w-0 pr-2">
                          <p className="flex min-w-0 items-center gap-1.5 truncate text-[13px] font-semibold text-wash-text-strong" title={i.NombreEdificio_IN}>
                            <Building2 size={11} className="shrink-0 text-wash-text-muted" />
                            <span className="truncate">{i.NombreEdificio_IN}</span>
                          </p>
                          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 pl-[17px]">
                            <p className="truncate text-[11px] text-wash-text-muted" title={i.ConcatMaquina_IN ? proper(i.ConcatMaquina_IN) : ''}>
                              {i.ConcatMaquina_IN ? proper(i.ConcatMaquina_IN) : <span className="italic">Sin máquina</span>}
                            </p>
                            {i.IDMaquina_IN && (
                              <span className="shrink-0 rounded bg-wash-brand/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-wash-brand">
                                #{i.IDMaquina_IN}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="min-w-0 pr-2">
                          {i.TecnicoAsignado_IN ? (
                            <span className="truncate text-[12.5px] text-wash-text-strong">{i.TecnicoAsignado_IN}</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-amber-700">
                              <UserCircle2 size={12} /> Sin asignar
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 truncate pr-2 text-[12.5px] text-wash-text" title={i.User_IN || ''}>
                          {i.User_IN || '—'}
                        </div>
                        <div className="flex items-center justify-end gap-1.5">
                          <IconBtn icon={Eye} tone="neutral" title="Ver detalle" onClick={() => setDetail(i)} />
                          {i.Status_IN === 'A Revisar' && (
                            <IconBtn icon={Pencil} tone="brand" title="Editar reclamo" onClick={() => setEditing(i)} />
                          )}
                          {primaryAction(i)}
                          {desasignarAction(i)}
                          {adminAction(i)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Detalle */}
      <DetailModal
        incidente={detail}
        repuestos={detail ? repuestosDe(detail.ID) : []}
        stock={stock}
        onClose={() => setDetail(null)}
      />

      {/* Asignar / cambiar técnico */}
      <AsignarModal
        incidente={assigning}
        reassign={reassign}
        tecnicos={tecnicos}
        tieneRepuestos={assigning ? repuestosDe(assigning.ID).length > 0 : false}
        onClose={() => setAssigning(null)}
        onConfirm={async (tecnico) => {
          if (!assigning) return;
          if (reassign) await cambiarTecnicoIncidente(assigning.ID, tecnico);
          else await assignIncidente(assigning.ID, tecnico);
          setAssigning(null);
        }}
      />

      {/* Generar compra (repuesto) */}
      <ComprarRepuestoModal
        incidente={comprar}
        faltantes={comprar ? repuestosDe(comprar.ID).filter((r) => {
          const s = stock.find((st) => st.Status_ST === 'Activo' && st.Item_ST.trim().toLowerCase() === r.Repuesto_RI.trim().toLowerCase());
          return !s || s.Cantidad_ST < r.Cantidad_RI;
        }) : []}
        onClose={() => setComprar(null)}
        onConfirm={async (items) => {
          if (!comprar) return;
          for (const it of items) await generarCompraIncidente(comprar.ID, { tipoCompra: 'repuesto', item: it, segmento: 'Repuesto' });
          setComprar(null);
        }}
      />

      {/* Cambio de máquina */}
      <CambioMaquinaModal
        incidente={cambioMaq}
        maquinas={maquinas}
        yaHayCompra={cambioMaq ? yaHayCompra(cambioMaq.ID) : false}
        onClose={() => setCambioMaq(null)}
        onAprobacion={async (m) => {
          if (!cambioMaq) return;
          await cambioMaquinaIncidente(cambioMaq.ID, m.concat, m.id);
          setCambioMaq(null);
        }}
        onComprar={async (segmento) => {
          if (!cambioMaq) return;
          const item = cambioMaq.ConcatMaquina_IN || segmento;
          await generarCompraIncidente(cambioMaq.ID, { tipoCompra: 'maquina', item, segmento });
          setCambioMaq(null);
        }}
      />

      {/* Nuevo incidente / Editar "A Revisar" (mismo modal) */}
      <NuevoIncidenteModal
        open={newOpen}
        editing={editing}
        edificios={edificios}
        maquinas={maquinas}
        tecnicos={tecnicos}
        onClose={() => {
          setNewOpen(false);
          setEditing(null);
        }}
        onCreate={createIncidente}
        onSave={editIncidente}
      />

      {/* Desasignar técnico de un "A Revisar" */}
      <ConfirmDialog
        open={!!desasignando}
        title="Desasignar técnico"
        message={
          desasignando
            ? `¿Sacás a ${desasignando.TecnicoAsignado_IN} del reclamo #${desasignando.ID} de ${desasignando.NombreEdificio_IN}? El reclamo sigue "A Revisar" pero queda sin técnico avisado. No se toca el stock.`
            : ''
        }
        confirmLabel={desasignarBusy ? 'Desasignando…' : 'Desasignar'}
        cancelLabel="Volver"
        busy={desasignarBusy}
        error={desasignarError}
        onCancel={() => {
          setDesasignando(null);
          setDesasignarError(null);
        }}
        onConfirm={handleDesasignar}
      />

      {/* Anular reclamo (baja lógica) — solo Admin. El motivo es obligatorio: va a
          DescripcionAnulado_IN, la misma columna que escribe la mobile, y es lo que después se
          lee en "Motivo de anulación" del detalle. */}
      <Modal
        open={!!anulando}
        onClose={() => {
          if (anularBusy) return;
          setAnulando(null);
          setAnularError(null);
          setAnularMotivo('');
        }}
        title="Anular reclamo"
        width={480}
      >
        {anularError && (
          <div
            role="alert"
            className="mb-3 flex items-center gap-2 rounded-r-md border-l-4 border-red-500 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700"
          >
            <AlertCircle size={14} className="shrink-0" />
            {anularError}
          </div>
        )}
        <p className="text-wash-text-strong">
          {anulando
            ? `¿Anulás el reclamo #${anulando.ID} de ${anulando.NombreEdificio_IN}? Queda anulado (baja lógica) y deja de aparecer entre los abiertos.`
            : ''}
        </p>
        <label className="mt-4 block">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">
            Motivo de la anulación <span className="text-red-600">*</span>
          </span>
          <textarea
            value={anularMotivo}
            onChange={(e) => setAnularMotivo(e.target.value)}
            disabled={anularBusy}
            rows={3}
            autoFocus
            placeholder="Por qué se anula este reclamo…"
            className="mt-1.5 w-full resize-none rounded-lg border border-wash-border bg-wash-surface px-3 py-2 text-sm text-wash-text-strong outline-none transition placeholder:text-wash-text-faint focus:border-wash-brand focus:ring-2 focus:ring-wash-brand/20 disabled:opacity-50"
          />
          {/* Por qué el botón está apagado. Sin esto el usuario ve un botón gris y no sabe qué le falta. */}
          {anularMotivo.trim() === '' && (
            <span className="mt-1.5 block text-[11.5px] text-wash-text-muted">
              Escribí el motivo para poder anular el reclamo.
            </span>
          )}
        </label>
        <ModalActions>
          <button
            type="button"
            onClick={() => {
              setAnulando(null);
              setAnularError(null);
              setAnularMotivo('');
            }}
            disabled={anularBusy}
            className="rounded-lg border border-wash-border bg-wash-surface px-5 py-2 font-medium text-wash-text-strong hover:bg-wash-canvas disabled:cursor-not-allowed disabled:opacity-50"
          >
            Volver
          </button>
          <button
            type="button"
            onClick={handleAnular}
            disabled={anularBusy || anularMotivo.trim() === ''}
            className="rounded-lg bg-wash-status-rejected px-5 py-2 font-medium text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {anularBusy ? 'Anulando…' : 'Anular reclamo'}
          </button>
        </ModalActions>
      </Modal>
    </div>
  );
}

// ===== Modals =====

function AsignarModal({
  incidente,
  reassign,
  tecnicos,
  tieneRepuestos,
  onClose,
  onConfirm,
}: {
  incidente: Incidente | null;
  reassign: boolean;
  tecnicos: { ID: number; Nombre_Tecnico: string }[];
  tieneRepuestos: boolean;
  onClose: () => void;
  onConfirm: (tecnico: string) => Promise<void>;
}) {
  const [tecId, setTecId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tecnicoOpts = useMemo<MultiOption[]>(
    () => tecnicos.map((t) => ({ value: String(t.ID), label: t.Nombre_Tecnico })),
    [tecnicos]
  );

  useEffect(() => {
    if (!incidente) return;
    const actual = reassign
      ? tecnicos.find((t) => t.Nombre_Tecnico === incidente.TecnicoAsignado_IN)
      : undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicia al abrir.
    setTecId(actual ? String(actual.ID) : '');
    setError(null);
  }, [incidente, reassign, tecnicos]);

  if (!incidente) return null;
  const tecnico = tecnicos.find((t) => String(t.ID) === tecId)?.Nombre_Tecnico ?? '';
  return (
    <Modal open={!!incidente} onClose={onClose} title={reassign ? 'Cambiar técnico' : 'Asignar técnico'} width={520}>
      {error && (
        <div role="alert" className="mb-3 flex items-center gap-2 rounded-r-md border-l-4 border-red-500 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700">
          <AlertCircle size={14} className="shrink-0" /> {error}
        </div>
      )}
      <MaquinaHeader incidente={incidente} icon={UserCog} />
      <div className="mt-5">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">Técnico</label>
        <div className="mt-2">
          <Combobox
            options={tecnicoOpts}
            value={tecId || null}
            onChange={setTecId}
            placeholder="Elegir técnico…"
            searchPlaceholder="Buscar técnico…"
            emptyText="Sin técnicos"
          />
        </div>
        {!reassign && tieneRepuestos && (
          <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-[11.5px] text-amber-800 ring-1 ring-amber-200">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            Al asignar se descuentan del stock los repuestos solicitados.
          </p>
        )}
      </div>
      <ModalActions>
        <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-wash-border px-5 py-2.5 font-medium text-wash-text-strong hover:bg-wash-surface-2 disabled:cursor-not-allowed disabled:opacity-50">
          Cancelar
        </button>
        <button
          type="button"
          disabled={!tecnico || saving}
          onClick={async () => {
            setSaving(true);
            setError(null);
            try {
              await onConfirm(tecnico);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'No se pudo asignar.');
            } finally {
              setSaving(false);
            }
          }}
          className="flex items-center gap-2 rounded-lg bg-wash-action px-5 py-2.5 font-semibold text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <UserCog size={15} />} {saving ? 'Guardando…' : reassign ? 'Cambiar' : 'Asignar'}
        </button>
      </ModalActions>
    </Modal>
  );
}

function CambioMaquinaModal({
  incidente,
  maquinas,
  yaHayCompra,
  onClose,
  onAprobacion,
  onComprar,
}: {
  incidente: Incidente | null;
  maquinas: { ID: number; Segmento_DM: string; Status_DM: string; ConcatMaquina_DM: string; ConcatMaquinaIncidente_DM: string; Edificio_DM: string; IDMaquina_DM: string }[];
  yaHayCompra: boolean;
  onClose: () => void;
  onAprobacion: (m: { concat: string; id: string }) => Promise<void>;
  onComprar: (segmento: string) => Promise<void>;
}) {
  const [sel, setSel] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const segmento = segmentoDe(incidente?.ConcatMaquina_IN);
  const disponibles = useMemo(
    () =>
      incidente
        ? maquinas.filter((m) => m.Status_DM === 'DEPOSITO' && m.Segmento_DM.trim().toLowerCase() === segmento.trim().toLowerCase())
        : [],
    [incidente, maquinas, segmento]
  );

  useEffect(() => {
    if (!incidente) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicia al abrir.
    setSel('');
    setError(null);
  }, [incidente]);

  if (!incidente) return null;
  const selMaq = disponibles.find((m) => String(m.ID) === sel);

  return (
    <Modal open={!!incidente} onClose={onClose} title="Cambio de máquina" width={560}>
      {error && (
        <div role="alert" className="mb-3 flex items-center gap-2 rounded-r-md border-l-4 border-red-500 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700">
          <AlertCircle size={14} className="shrink-0" /> {error}
        </div>
      )}
      <MaquinaHeader incidente={incidente} icon={ArrowLeftRight} />

      {disponibles.length > 0 ? (
        <div className="mt-5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">
            Máquina de reemplazo en depósito ({segmento})
          </label>
          <div className="mt-2">
            <Combobox
              options={disponibles.map((m) => ({
                value: String(m.ID),
                label: `${m.IDMaquina_DM} — ${proper(m.ConcatMaquina_DM)}`,
              }))}
              value={sel || null}
              onChange={setSel}
              placeholder="Elegir máquina disponible…"
              searchPlaceholder="Buscar máquina…"
              emptyText="Sin máquinas"
            />
          </div>
          <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-violet-50 px-3 py-2 text-[11.5px] text-violet-900 ring-1 ring-violet-200">
            <AlertCircle size={13} className="mt-0.5 shrink-0" />
            Se genera una aprobación de cambio de máquina. Una vez aprobada, el incidente queda listo para asignar.
          </p>
        </div>
      ) : (
        <div className="mt-5">
          <EmptyState
            compact
            tone="amber"
            icon={AlertTriangle}
            title="Sin máquinas en depósito"
            description={
              yaHayCompra
                ? `No hay ${segmento || 'máquinas'} disponibles. Ya existe una compra abierta para este incidente.`
                : `No hay ${segmento || 'máquinas'} disponibles. Podés generar una compra abajo.`
            }
          />
        </div>
      )}

      <ModalActions>
        <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-wash-border px-5 py-2.5 font-medium text-wash-text-strong hover:bg-wash-surface-2 disabled:cursor-not-allowed disabled:opacity-50">
          Cancelar
        </button>
        {disponibles.length > 0 ? (
          <button
            type="button"
            disabled={!selMaq || saving}
            onClick={async () => {
              if (!selMaq) return;
              setSaving(true);
              setError(null);
              try {
                await onAprobacion({ concat: selMaq.ConcatMaquinaIncidente_DM, id: selMaq.IDMaquina_DM });
              } catch (err) {
                setError(err instanceof Error ? err.message : 'No se pudo generar la aprobación.');
              } finally {
                setSaving(false);
              }
            }}
            className="flex items-center gap-2 rounded-lg bg-wash-action px-5 py-2.5 font-semibold text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving && <Loader2 size={15} className="animate-spin" />} {saving ? 'Generando…' : 'Generar aprobación'}
          </button>
        ) : (
          <button
            type="button"
            disabled={saving || yaHayCompra}
            title={yaHayCompra ? 'Ya existe una compra abierta para este incidente' : undefined}
            onClick={async () => {
              setSaving(true);
              setError(null);
              try {
                await onComprar(segmento || 'Repuesto');
              } catch (err) {
                setError(err instanceof Error ? err.message : 'No se pudo generar la compra.');
              } finally {
                setSaving(false);
              }
            }}
            className="flex items-center gap-2 rounded-lg bg-wash-action px-5 py-2.5 font-semibold text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <ShoppingCart size={15} />} {saving ? 'Generando…' : yaHayCompra ? 'Compra ya generada' : 'Generar compra'}
          </button>
        )}
      </ModalActions>
    </Modal>
  );
}

function ComprarRepuestoModal({
  incidente,
  faltantes,
  onClose,
  onConfirm,
}: {
  incidente: Incidente | null;
  faltantes: { ID: number; Repuesto_RI: string; Cantidad_RI: number }[];
  onClose: () => void;
  onConfirm: (items: string[]) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!incidente) return null;
  return (
    <Modal open={!!incidente} onClose={onClose} title="Generar compra de repuestos" width={480}>
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100">
          <AlertTriangle size={24} className="text-amber-600" />
        </span>
        <div className="flex-1">
          <h3 className="font-display text-lg font-black text-wash-text-strong">Sin stock suficiente</h3>
          <p className="mt-1 text-sm text-wash-text-muted">Se generará una compra (ya aprobada) por cada repuesto faltante.</p>
        </div>
      </div>
      {error && (
        <div role="alert" className="mt-3 flex items-center gap-2 rounded-r-md border-l-4 border-red-500 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700">
          <AlertCircle size={14} className="shrink-0" /> {error}
        </div>
      )}
      <div className="mt-3 rounded-lg bg-wash-surface-2/60 p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-wash-text-muted">Repuestos faltantes</p>
        <ul className="mt-1 space-y-1 text-sm">
          {faltantes.map((r) => (
            <li key={r.ID} className="flex items-center justify-between rounded-md bg-wash-surface px-3 py-1.5">
              <span className="min-w-0 truncate text-wash-text-strong">{r.Repuesto_RI}</span>
              <span className="ml-2 shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-700">{r.Cantidad_RI} ud</span>
            </li>
          ))}
        </ul>
      </div>
      <ModalActions>
        <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-wash-border px-5 py-2 font-medium text-wash-text-strong hover:bg-wash-surface-2 disabled:cursor-not-allowed disabled:opacity-50">
          Cancelar
        </button>
        <button
          type="button"
          disabled={saving || faltantes.length === 0}
          onClick={async () => {
            setSaving(true);
            setError(null);
            try {
              await onConfirm(faltantes.map((r) => r.Repuesto_RI));
            } catch (err) {
              setError(err instanceof Error ? err.message : 'No se pudo generar la compra.');
            } finally {
              setSaving(false);
            }
          }}
          className="flex items-center gap-2 rounded-lg bg-wash-action px-5 py-2 font-medium text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <ShoppingCart size={15} />} {saving ? 'Generando…' : 'Generar compra'}
        </button>
      </ModalActions>
    </Modal>
  );
}

function DetailModal({
  incidente,
  repuestos,
  stock,
  onClose,
}: {
  incidente: Incidente | null;
  repuestos: { ID: number; Repuesto_RI: string; Cantidad_RI: number }[];
  stock: { Item_ST: string; Cantidad_ST: number; Status_ST: string }[];
  onClose: () => void;
}) {
  if (!incidente) return null;
  return (
    <Modal open={!!incidente} onClose={onClose} title="Detalle del incidente" width={640}>
      {/* El body va en un componente aparte porque necesita hooks (fotos lazy + secciones
          colapsables) y acá arriba hay un early-return. <ModalActions> DEBE quedar como child
          DIRECTO de <Modal>: Modal.tsx particiona children por tipo para dejar el footer fijo. */}
      <DetailBody key={incidente.ID} incidente={incidente} repuestos={repuestos} stock={stock} />
      <ModalActions>
        <button type="button" onClick={onClose} className="rounded-lg bg-wash-action px-5 py-2.5 font-medium text-white hover:bg-wash-action-dark">
          Cerrar
        </button>
      </ModalActions>
    </Modal>
  );
}

// Observaciones del incidente: 4 columnas distintas de 10.Incidentes, cada una escrita en un
// momento del ciclo de vida. Antes el modal mostraba UNA sola caja con el derivado
// DescripcionIncidente_IN (= Descripcion_IN || DescripcionCarga_IN), así que la resolución y el
// motivo de anulación no se veían nunca.
const OBSERVACIONES = [
  { key: 'carga', label: 'Observación del problema', icon: StickyNote, field: 'DescripcionCarga_IN', tone: 'neutral' },
  { key: 'tecnico', label: 'Observación del técnico', icon: UserCog, field: 'Descripcion_IN', tone: 'neutral' },
  { key: 'resuelto', label: 'Observación de la resolución', icon: CheckCircle2, field: 'DescripcionResuelto_IN', tone: 'success' },
  { key: 'anulado', label: 'Motivo de anulación', icon: Ban, field: 'DescripcionAnulado_IN', tone: 'danger' },
] as const satisfies readonly {
  key: string;
  label: string;
  icon: typeof StickyNote;
  field: keyof Incidente;
  tone: 'neutral' | 'success' | 'danger';
}[];

function DetailBody({
  incidente,
  repuestos,
  stock,
}: {
  incidente: Incidente;
  repuestos: { ID: number; Repuesto_RI: string; Cantidad_RI: number }[];
  stock: { Item_ST: string; Cantidad_ST: number; Status_ST: string }[];
}) {
  const observaciones = useMemo(
    () =>
      OBSERVACIONES.map((o) => ({ ...o, value: String(incidente[o.field] ?? '') })).filter((o) =>
        o.value.trim()
      ),
    [incidente]
  );

  // Apertura por defecto — paridad con el msapp (Screen_Incidentes.pa.yaml:149):
  //   'A Revisar' → carga; 'Resuelto' → resolución + problema (el PA mostraba las DOS cajas);
  //   'Anulado' → motivo; resto (Pendiente/Asignado/Aprobada/En Aprobacion) → técnico, con
  //   fallback a carga si el técnico todavía no escribió nada.
  const defaultOpen = useMemo(() => {
    const have = new Set<string>(observaciones.map((o) => o.key));
    const pick = (...keys: string[]) => keys.find((k) => have.has(k));
    const s = incidente.Status_IN;
    const keys =
      s === 'A Revisar'
        ? [pick('carga')]
        : s === 'Resuelto'
          ? [pick('resuelto'), pick('carga')]
          : s === 'Anulado'
            ? [pick('anulado')]
            : [pick('tecnico', 'carga')];
    return new Set(keys.filter(Boolean) as string[]);
  }, [observaciones, incidente.Status_IN]);

  // Multi-abierto (Set), no accordion exclusivo: en 'Resuelto' hay que ver problema + resolución
  // a la vez. DetailBody se remonta por incidente (key={incidente.ID}) → el default se recalcula.
  const [abiertas, setAbiertas] = useState<Set<string>>(defaultOpen);

  const [fotos, setFotos] = useState<FotoIncidente[]>([]);
  // Arranca en true (no seteado dentro del efecto): DetailBody se remonta por incidente, así que
  // el fetch SIEMPRE corre en el montaje y el spinner ya es el estado inicial correcto.
  const [cargandoFotos, setCargandoFotos] = useState(true);
  // Índice, no el data URI: el botón de descarga del lightbox necesita saber QUÉ foto es para
  // numerar el archivo. `null` = cerrado (0 es un índice válido, no usar falsy).
  const [lightbox, setLightbox] = useState<number | null>(null);
  const fotoAmpliada = lightbox === null ? null : fotos[lightbox];

  // Fetch LAZY de fotos: Foto_FI es base64 de cientos de KB por fila, nunca va en el listado.
  useEffect(() => {
    let vivo = true;
    getFotosIncidente(incidente.ID)
      .then((r) => { if (vivo) setFotos(r.fotos); })
      .catch(() => { if (vivo) setFotos([]); }) // best-effort: nunca romper el detalle
      .finally(() => { if (vivo) setCargandoFotos(false); });
    return () => { vivo = false; };
  }, [incidente.ID]);

  // Escape cierra SOLO el lightbox: se escucha en capture y se corta la propagación antes de que
  // llegue el listener de Modal.tsx (window, bubble), que si no cerraría el detalle entero.
  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setLightbox(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [lightbox]);

  return (
    <>
      <MaquinaHeader incidente={incidente} icon={Wrench} showStatus />

      {observaciones.length === 0 ? (
        <div className="mt-4 rounded-xl border border-wash-border bg-wash-surface px-5 py-4">
          <p className="text-sm italic text-wash-text-muted">Sin observación registrada.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {observaciones.map(({ key, label, icon: Icon, value, tone }) => {
            const open = abiertas.has(key);
            return (
              <div
                key={key}
                className={cn(
                  'overflow-hidden rounded-xl ring-1',
                  tone === 'success' && 'bg-emerald-500/[0.06] ring-emerald-500/20',
                  tone === 'danger' && 'bg-red-500/[0.06] ring-red-500/20',
                  tone === 'neutral' && 'bg-wash-surface-2/40 ring-wash-border'
                )}
              >
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() =>
                    setAbiertas((prev) => {
                      const next = new Set(prev);
                      if (next.has(key)) next.delete(key);
                      else next.add(key);
                      return next;
                    })
                  }
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-wash-surface-2/60"
                >
                  <Icon
                    size={14}
                    className={cn(
                      tone === 'success'
                        ? 'text-emerald-700'
                        : tone === 'danger'
                          ? 'text-red-700'
                          : 'text-wash-text-muted'
                    )}
                  />
                  <span className="flex-1 text-[10.5px] font-bold uppercase tracking-wider text-wash-text-muted">
                    {label}
                  </span>
                  <ChevronDown size={14} className={cn('text-wash-text-muted transition-transform', open && 'rotate-180')} />
                </button>
                {open && (
                  <p className="whitespace-pre-line px-4 pb-3.5 text-sm leading-relaxed text-wash-text-strong">{value}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Datos del incidente — lista plana (sin una caja por campo) para no anidar cajas dentro de
          cajas. Los valores se parten en vez de cortarse: la máquina asignada de un cambio ocupa
          todo el ancho y hace wrap, no queda truncada. Se separa del bloque de arriba con una
          línea fina, no con otra caja. */}
      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-wash-border/70 pt-4 sm:grid-cols-3">
        <MetaItem label="Fecha" value={incidente.Fecha_IN} />
        <MetaItem label="Tipo" value={incidente.NoResuelto_IN} />
        <MetaItem
          label="Técnico"
          value={incidente.TecnicoAsignado_IN || <span className="font-semibold text-amber-700">Sin asignar</span>}
        />
        <MetaItem label="Asignador" value={incidente.User_IN || '—'} />
        {incidente.Status_IN === 'Anulado' && <MetaItem label="Anulado por" value={anuladoPor(incidente)} />}
        {incidente.FechaAsignada_IN && <MetaItem label="Asignada" value={incidente.FechaAsignada_IN} />}
        {incidente.FechaResuelto_IN && <MetaItem label="Resuelto" value={incidente.FechaResuelto_IN} />}
        {incidente.MaquinaAsignada_IN && (
          <MetaItem label="Máquina asignada" value={proper(incidente.MaquinaAsignada_IN)} full />
        )}
      </dl>
      <div className="mt-5 border-t border-wash-border/70 pt-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">
          Repuestos ({repuestos.length})
        </p>
        {repuestos.length === 0 ? (
          <EmptyState
            compact
            icon={Wrench}
            title="Sin repuestos cargados"
            description="Este incidente no requiere repuestos."
          />
        ) : (
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {repuestos.map((r) => {
              const s = stock.find((st) => st.Status_ST === 'Activo' && st.Item_ST.trim().toLowerCase() === r.Repuesto_RI.trim().toLowerCase());
              const ok = !!s && s.Cantidad_ST >= r.Cantidad_RI;
              return (
                <li key={r.ID} className="flex items-center gap-2.5 rounded-lg bg-wash-surface-2/40 px-3 py-2 ring-1 ring-wash-border">
                  <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md', ok ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600')}>
                    {ok ? <Check size={13} /> : <AlertTriangle size={12} />}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-wash-text-strong" title={r.Repuesto_RI}>
                    {r.Repuesto_RI}
                  </span>
                  <span className="flex h-6 min-w-[30px] items-center justify-center rounded-md bg-wash-action/10 px-1.5 text-[12px] font-bold text-wash-action ring-1 ring-wash-action/20">
                    {r.Cantidad_RI}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Fotos (12.FotoIncidentes) — las escribe SOLO la mobile al resolver, así que la vista por
          defecto (abiertos, Resuelto_IN='NO') por construcción nunca tiene ninguna. Si no hay y no
          está cargando, la sección no se renderiza en vez de mostrar un vacío permanente. */}
      {(cargandoFotos || fotos.length > 0) && (
        <div className="mt-5 border-t border-wash-border/70 pt-4">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">
            <Camera size={12} />
            {/* El conteo recién cuando terminó de cargar: "Fotos (0)" con spinner leería como un
                cero real que después cambia. */}
            Fotos{!cargandoFotos && ` (${fotos.length})`}
            {cargandoFotos && <Loader2 size={12} className="animate-spin" />}
          </p>
          {fotos.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {fotos.map((f, idx) => (
                <div
                  key={f.ID}
                  className="group relative overflow-hidden rounded-lg ring-1 ring-wash-border transition hover:ring-wash-action"
                >
                  <button
                    type="button"
                    aria-label="Ver foto ampliada"
                    onClick={() => setLightbox(idx)}
                    className="block w-full"
                  >
                    <img
                      src={f.Foto_FI}
                      alt=""
                      loading="lazy"
                      className="h-24 w-full object-cover transition group-hover:scale-105"
                    />
                  </button>
                  {/* Descarga directa sin abrir el lightbox. Visible siempre en touch (donde no hay
                      hover) y al pasar el mouse en desktop. */}
                  <button
                    type="button"
                    aria-label="Descargar foto"
                    title="Descargar"
                    onClick={() => descargarFoto(f.Foto_FI, incidente, idx + 1, fotos.length)}
                    className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-md bg-black/55 text-white opacity-0 transition hover:bg-black/75 focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Download size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* z-[70] para quedar por encima del overlay del Modal (z-[60], Modal.tsx:41). */}
      {fotoAmpliada && (
        <div
          role="presentation"
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-6"
        >
          {/* stopPropagation: el click en la barra no debe cerrar el lightbox (el overlay cierra). */}
          <div
            role="presentation"
            onClick={(e) => e.stopPropagation()}
            className="absolute right-4 top-4 flex items-center gap-2"
          >
            <button
              type="button"
              aria-label="Descargar foto"
              title="Descargar"
              onClick={() =>
                descargarFoto(fotoAmpliada.Foto_FI, incidente, (lightbox ?? 0) + 1, fotos.length)
              }
              className="flex h-9 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-sm font-medium text-white transition hover:bg-white/20"
            >
              <Download size={16} />
              Descargar
            </button>
            <button
              type="button"
              aria-label="Cerrar foto"
              onClick={() => setLightbox(null)}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white transition hover:bg-white/20"
            >
              <X size={18} />
            </button>
          </div>
          <img
            src={fotoAmpliada.Foto_FI}
            alt=""
            className="max-h-[90dvh] max-w-[90vw] object-contain"
          />
        </div>
      )}
    </>
  );
}

interface IncidentePayload {
  edificio: string;
  codigoEdificio?: string;
  maquinaConcat?: string;
  idMaquina?: string;
  descripcion: string;
  tecnico?: string;
}
function NuevoIncidenteModal({
  open,
  editing,
  edificios,
  maquinas,
  tecnicos,
  onClose,
  onCreate,
  onSave,
}: {
  open: boolean;
  /** Si viene un incidente, el modal está en modo EDICIÓN (solo "A Revisar"). */
  editing?: Incidente | null;
  edificios: { edificio: string; codigo: string }[];
  maquinas: { ID: number; ConcatMaquinaIncidente_DM: string; IDMaquina_DM: string; Edificio_DM: string; CodigoEdificio_DM?: string; Status_DM: string }[];
  tecnicos: { ID: number; Nombre_Tecnico: string; Telefono?: string }[];
  onClose: () => void;
  onCreate: (payload: IncidentePayload) => Promise<Incidente>;
  onSave: (id: number, payload: IncidentePayload) => Promise<Incidente>;
}) {
  const isEdit = !!editing;
  const isOpen = open || isEdit;
  const [edificio, setEdificio] = useState('');
  const [maqId, setMaqId] = useState('');
  const [desc, setDesc] = useState('');
  const [tecId, setTecId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicia/precarga al abrir.
    setError(null);
    if (editing) {
      // Precarga desde el incidente. Máquina: match por IDMaquina_DM + edificio (identidad compuesta),
      // fallback por concat. Técnico: por nombre.
      setEdificio(editing.NombreEdificio_IN ?? '');
      setDesc(editing.DescripcionCarga_IN ?? '');
      const maq = maquinas.find(
        (m) =>
          (editing.IDMaquina_IN && m.IDMaquina_DM === editing.IDMaquina_IN && m.Edificio_DM === editing.NombreEdificio_IN) ||
          (!!editing.ConcatMaquina_IN && m.ConcatMaquinaIncidente_DM === editing.ConcatMaquina_IN)
      );
      setMaqId(maq ? String(maq.ID) : '');
      const tec = tecnicos.find((t) => t.Nombre_Tecnico === editing.TecnicoAsignado_IN);
      setTecId(tec ? String(tec.ID) : '');
    } else {
      setEdificio('');
      setMaqId('');
      setDesc('');
      setTecId('');
    }
  }, [open, editing, isOpen, maquinas, tecnicos]);

  const edificioOpts = useMemo<ComboboxOption[]>(
    () => edificios.map((e) => ({ value: e.edificio, label: e.edificio, sublabel: e.codigo })),
    [edificios]
  );
  const codigo = edificios.find((e) => e.edificio === edificio)?.codigo;
  // Máquinas del edificio: match por CÓDIGO (estable ante renombres del ABM); fallback a nombre
  // solo si el edificio no tiene código. Antes matcheaba por Edificio_DM (nombre), que para un
  // edificio renombrado no coincide con el nombre actual de ABM → no mostraba sus máquinas.
  const maqsDelEdificio = useMemo(
    () =>
      maquinas.filter(
        (m) =>
          m.Status_DM !== 'ELIMINADA' &&
          (!edificio || (codigo ? m.CodigoEdificio_DM === codigo : m.Edificio_DM === edificio))
      ),
    [maquinas, edificio, codigo]
  );
  const maquinaOpts = useMemo<ComboboxOption[]>(
    () => maqsDelEdificio.map((m) => ({ value: String(m.ID), label: `${m.IDMaquina_DM} — ${proper(m.ConcatMaquinaIncidente_DM)}` })),
    [maqsDelEdificio]
  );
  const tecnicoOpts = useMemo<ComboboxOption[]>(
    () => tecnicos.map((t) => ({ value: String(t.ID), label: t.Nombre_Tecnico })),
    [tecnicos]
  );

  return (
    <Modal open={isOpen} onClose={onClose} title={isEdit ? `Editar incidente #${editing.ID}` : 'Nuevo incidente'} width={600}>
      <p className="text-sm text-wash-text-muted">
        {isEdit
          ? 'Editá el reclamo mientras siga "A Revisar" (todavía sin asignar/triar).'
          : 'Cargá el reporte. Al crear, se abre WhatsApp para avisar al técnico (si elegiste uno).'}
      </p>
      {error && (
        <div role="alert" className="mt-3 flex items-center gap-2 rounded-r-md border-l-4 border-red-500 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700">
          <AlertCircle size={14} className="shrink-0" /> {error}
        </div>
      )}
      <div className="mt-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Lbl req>Edificio</Lbl>
            <div className="mt-1.5">
              <Combobox
                options={edificioOpts}
                value={edificio || null}
                onChange={(v) => { setEdificio(v); setMaqId(''); }}
                placeholder="Elegir edificio…"
                searchPlaceholder="Buscar edificio o código…"
                emptyText="Sin edificios"
              />
            </div>
          </div>
          <div>
            <Lbl>Máquina</Lbl>
            <div className="mt-1.5">
              <Combobox
                options={maquinaOpts}
                value={maqId || null}
                onChange={setMaqId}
                disabled={!edificio}
                placeholder={edificio ? 'Sin asignar' : 'Elegí edificio primero'}
                searchPlaceholder="Buscar máquina…"
                emptyText="Sin máquinas"
              />
            </div>
          </div>
        </div>
        <div>
          <Lbl>Técnico a avisar (queda "A Revisar")</Lbl>
          <div className="mt-1.5">
            <Combobox
              options={tecnicoOpts}
              value={tecId || null}
              onChange={setTecId}
              placeholder="Dejar sin asignar"
              searchPlaceholder="Buscar técnico…"
              emptyText="Sin técnicos"
            />
          </div>
        </div>
        <div>
          <Lbl req>¿Qué pasó?</Lbl>
          <textarea
            rows={4}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Detallá el problema…"
            className="mt-1.5 w-full rounded-lg border border-wash-border bg-wash-surface px-3 py-2 text-sm outline-none focus:border-wash-action focus:ring-2 focus:ring-wash-action/15"
          />
        </div>
      </div>
      <ModalActions>
        <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-wash-border px-5 py-2.5 font-medium text-wash-text-strong hover:bg-wash-surface-2 disabled:cursor-not-allowed disabled:opacity-50">
          Cancelar
        </button>
        <button
          type="button"
          disabled={!edificio || !desc.trim() || saving}
          onClick={async () => {
            setSaving(true);
            setError(null);
            try {
              const maq = maqsDelEdificio.find((m) => String(m.ID) === maqId);
              const tec = tecnicos.find((t) => String(t.ID) === tecId);
              const tecnico = tec?.Nombre_Tecnico;
              const payload: IncidentePayload = {
                edificio,
                codigoEdificio: codigo,
                maquinaConcat: maq?.ConcatMaquinaIncidente_DM,
                idMaquina: maq?.IDMaquina_DM,
                descripcion: desc.trim(),
                tecnico: tecnico || undefined,
              };
              if (isEdit) {
                await onSave(editing.ID, payload); // edición: sin WhatsApp
              } else {
                const created = await onCreate(payload);
                // WhatsApp deep-link al técnico (si hay) — solo en el alta.
                const tel = tec?.Telefono;
                if (tecnico) {
                  const msg = `INCIDENTE N: ${created.ID}\nEDIFICIO: ${edificio}${maq ? `\nMAQUINA: ${maq.ConcatMaquinaIncidente_DM}` : ''}\nOBSERVACIONES: ${desc.trim()}`;
                  const url = `https://wa.me/${tel ? '54' + tel.replace(/\D/g, '') : ''}?text=${encodeURIComponent(msg)}`;
                  window.open(url, '_blank');
                }
              }
              onClose();
            } catch (err) {
              setError(err instanceof Error ? err.message : `No se pudo ${isEdit ? 'guardar' : 'crear'} el incidente.`);
            } finally {
              setSaving(false);
            }
          }}
          className="flex items-center gap-2 rounded-lg bg-wash-action px-5 py-2.5 font-semibold text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : isEdit ? <Pencil size={15} /> : <Plus size={15} />}{' '}
          {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear incidente'}
        </button>
      </ModalActions>
    </Modal>
  );
}

// ===== small bits =====

function MaquinaHeader({ incidente, icon: Icon, showStatus }: { incidente: Incidente; icon: typeof Wrench; showStatus?: boolean }) {
  return (
    <div className="rounded-xl bg-wash-surface-2/50 p-4 ring-1 ring-wash-border">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-wash-brand/10 text-wash-brand ring-1 ring-wash-brand/20">
          <Icon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          {incidente.ConcatMaquina_IN ? (
            <p className="truncate font-display text-[15px] font-black text-wash-accent">{proper(incidente.ConcatMaquina_IN)}</p>
          ) : (
            <p className="font-display text-[15px] italic text-wash-text-muted">Máquina no asignada</p>
          )}
          <div className="mt-1 flex items-center gap-2 text-xs text-wash-text-muted">
            <Building2 size={11} />
            <span className="truncate">{incidente.NombreEdificio_IN}</span>
            {incidente.IDMaquina_IN && <span className="rounded-md bg-wash-surface px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-wash-text">#{incidente.IDMaquina_IN}</span>}
          </div>
        </div>
        {showStatus && <StatusBadge status={incidente.Status_IN} />}
      </div>
    </div>
  );
}

function IconBtn({ icon: Icon, tone, title, onClick }: { icon: typeof Eye; tone: 'neutral' | 'brand' | 'warning' | 'violet' | 'danger'; title: string; onClick: () => void }) {
  const cls = {
    neutral: 'text-wash-text-muted ring-wash-border hover:bg-wash-surface-2 hover:text-wash-text-strong hover:ring-wash-text-muted/40',
    brand: 'text-wash-brand ring-wash-brand/30 hover:bg-wash-brand/10 hover:ring-wash-brand',
    warning: 'text-amber-600 ring-amber-400/40 hover:bg-amber-50 hover:ring-amber-500',
    violet: 'text-violet-600 ring-violet-500/30 hover:bg-violet-500/10 hover:ring-violet-500',
    danger: 'text-red-600 ring-red-400/40 hover:bg-red-50 hover:ring-red-500',
  }[tone];
  return (
    <button type="button" onClick={onClick} title={title} aria-label={title} className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 transition', cls)}>
      <Icon size={15} />
    </button>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-wash-brand/10 px-2.5 py-0.5 font-semibold text-wash-brand">{children}</span>;
}

/** Campo plano label/valor del detalle de incidente. `full` = ocupa toda la fila (valores largos
 *  como la máquina asignada). El valor SIEMPRE hace wrap (break-words), nunca se trunca. */
function MetaItem({ label, value, full }: { label: string; value: React.ReactNode; full?: boolean }) {
  return (
    <div className={cn('min-w-0', full && 'col-span-2 sm:col-span-3')}>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-wash-text-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-[13px] font-semibold text-wash-text-strong">{value}</dd>
    </div>
  );
}

function Lbl({ children, req }: { children: React.ReactNode; req?: boolean }) {
  return (
    <label className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-wash-text-muted">
      {children}
      {req && <span className="text-rose-500">*</span>}
    </label>
  );
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((v) => b.includes(v));

function FilterContent({
  mesAno,
  estado,
  edificio,
  tipo,
  asignacion,
  mesAnoOpts,
  estadoOpts,
  edificioOpts,
  tipoOpts,
  onApply,
}: {
  mesAno: string[];
  estado: string[];
  edificio: string[];
  tipo: string[];
  asignacion: string[];
  mesAnoOpts: MultiOption[];
  estadoOpts: MultiOption[];
  edificioOpts: MultiOption[];
  tipoOpts: MultiOption[];
  onApply: (f: { mesAno: string[]; estado: string[]; edificio: string[]; tipo: string[]; asignacion: string[] }) => void;
}) {
  const [pMesAno, setPMesAno] = useState<string[]>(mesAno);
  const [pEstado, setPEstado] = useState<string[]>(estado);
  const [pEdificio, setPEdificio] = useState<string[]>(edificio);
  const [pTipo, setPTipo] = useState<string[]>(tipo);
  const [pAsignacion, setPAsignacion] = useState<string[]>(asignacion);

  const toggle = (set: React.Dispatch<React.SetStateAction<string[]>>) => (v: string) =>
    set((arr) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]));

  const total = pMesAno.length + pEstado.length + pEdificio.length + pTipo.length + pAsignacion.length;
  const dirty =
    !sameSet(pMesAno, mesAno) ||
    !sameSet(pEstado, estado) ||
    !sameSet(pEdificio, edificio) ||
    !sameSet(pTipo, tipo) ||
    !sameSet(pAsignacion, asignacion);

  const limpiar = () => {
    setPMesAno([]);
    setPEstado([]);
    setPEdificio([]);
    setPTipo([]);
    setPAsignacion([]);
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between border-b border-wash-border pb-2.5">
        <h3 className="text-sm font-bold text-wash-text-strong">Filtrar</h3>
        {total > 0 && (
          <button type="button" onClick={limpiar} className="text-[11px] font-semibold text-wash-text-muted hover:text-wash-text-strong">
            Limpiar todo
          </button>
        )}
      </div>
      <div className="space-y-3">
        <MultiSelect label="Mes / Año" options={mesAnoOpts} selected={pMesAno} onToggle={toggle(setPMesAno)} onClear={() => setPMesAno([])} />
        <MultiSelect label="Estado" options={estadoOpts} selected={pEstado} onToggle={toggle(setPEstado)} onClear={() => setPEstado([])} />
        <MultiSelect label="Edificio" options={edificioOpts} selected={pEdificio} onToggle={toggle(setPEdificio)} onClear={() => setPEdificio([])} searchable />
        <MultiSelect label="Tipo" options={tipoOpts} selected={pTipo} onToggle={toggle(setPTipo)} onClear={() => setPTipo([])} />
        <MultiSelect label="Asignación" options={ASIGNACION_OPTS} selected={pAsignacion} onToggle={toggle(setPAsignacion)} onClear={() => setPAsignacion([])} />
      </div>
      <div className="mt-4 flex justify-end gap-2 border-t border-wash-border pt-3">
        <PopoverClose asChild>
          <button type="button" className="rounded-lg border border-wash-border px-4 py-2 text-[12.5px] font-medium text-wash-text-strong hover:bg-wash-surface-2">Cancelar</button>
        </PopoverClose>
        <PopoverClose asChild>
          <button
            type="button"
            disabled={!dirty}
            onClick={() => onApply({ mesAno: pMesAno, estado: pEstado, edificio: pEdificio, tipo: pTipo, asignacion: pAsignacion })}
            className="rounded-lg bg-wash-action px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-wash-action-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            Aplicar
          </button>
        </PopoverClose>
      </div>
    </div>
  );
}
