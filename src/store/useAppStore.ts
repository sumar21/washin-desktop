import { create } from 'zustand';
import type {
  Usuario,
  PermisoModulo,
  Edificio,
  Registro,
  Descanso,
  StockItem,
  StockCatalogItem,
  RepuestoTecnico,
  Repuesto,
  PedidoCompra,
  DetalleCompra,
  Aprobacion,
  DetalleMaquina,
  Incidente,
  RepuestoIncidente,
  ResumenPlanificacion,
  DetallePlanificacion,
  MesPlanificacion,
  EdificioVisitar,
  Ventilacion,
  EdificioVent,
  RutaAbm,
  CircuitoAbm,
  DetalleCircuitoAbm,
  EdificioAbm,
  PlanifMes,
  PlanifRuta,
  PlanifCircuito,
  PlanifEdificio,
  ItemCompra,
  RutaCatalogo,
  ResumenCircuito,
  DetalleCircuito,
  Frecuencia,
  GrupoVentilacion,
  Encendedor,
  MaquinaCompra,
} from '@/types/domain';
import {
  mockUsuarios,
  mockPermisos,
  mockEdificios,
  mockRegistros,
  mockStock,
  mockMaquinas,
  mockMesesPlanificacion,
  mockResumenPlanif,
  mockDetallePlanif,
  mockEdificiosVisitar,
  mockItemsCompra,
  mockRutas,
  mockResumenCircuitos,
  mockDetalleCircuitos,
  mockFrecuencias,
  mockGruposVent,
  mockEncendedores,
  mockMaquinasCompra,
  appVersion,
} from '@/mock/data';
import * as api from '@/services/api';

interface AppState {
  // UI
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;

  // Auth (PowerApp: VarUsuario, VarTipoUser, VarVersion)
  VarUsuario: string | null;
  VarTipoUser: Usuario['Rol'] | null;
  VarVersion: string;
  loggedUser: Usuario | null;

  // Collections (PowerApp Collect_*)
  CollectUser: Usuario[];
  Collect_LPP: PermisoModulo[];
  CollectEdificios: Edificio[];
  CollectResumen: Registro[];
  /** Descansos (14.HorasDescanso) de HOY — para el Home. */
  CollectDescansosHoy: Descanso[];
  /** Registros del rango de meses elegido para el Dashboard de Visitas. */
  CollectDashboardVisitas: Registro[];
  CollectStock: StockItem[];
  CollectStockTecnicos: RepuestoTecnico[];
  /** Catálogo de repuestos con precio (11.Respuestos). */
  CollectRepuestos: Repuesto[];
  CollectCompras: PedidoCompra[];
  CollectDetalleCompras: DetalleCompra[];
  CollectAprobaciones: Aprobacion[];
  CollectDetalleMaquina: DetalleMaquina[];
  /** Parque de máquinas real (08.DetalleMaquina) — módulo Detalle de Máquinas. */
  CollectMaquinas: DetalleMaquina[];
  /** Edificios (con código) para el selector de transferencia de máquina. */
  CollectEdificiosMaquina: api.EdificioOption[];
  CollectIncidentes: Incidente[];
  CollectRepuestosIncidente: RepuestoIncidente[];
  CollectMesesPlanificados: MesPlanificacion[];
  CollectResumenPlanificaciones: ResumenPlanificacion[];
  CollectDetallePlanificaciones: DetallePlanificacion[];
  CollectEdificiosVisitar: EdificioVisitar[];
  CollectVentilaciones: Ventilacion[];
  /** ABM.Edificios ALTA (real) para el alta de ventilaciones + filtro de edificio. */
  CollectEdificiosVent: EdificioVent[];
  /** Frecuencias activas reales (días) para asignar/agregar ventilación. */
  CollectFrecuenciasVent: string[];
  /** Grupos de ventilación activos reales. */
  CollectGruposVent: string[];
  // ── ABMs reales de Configuración (Rutas / Circuitos / Edificios) ──
  CollectAbmRutas: RutaAbm[];
  CollectAbmCircuitos: CircuitoAbm[];
  CollectAbmDetalles: DetalleCircuitoAbm[];
  CollectAbmEdificios: EdificioAbm[];
  AbmFrecuencias: string[];
  AbmGrupos: string[];
  AbmRoles: string[];
  /** Pestañas visibles + si el rol puede editar (fuente: backend, gate real de writes). */
  AbmAccess: api.AbmBundle['access'];
  // ── Planificaciones (real: 17/15/16/18) ──
  CollectPlanifMeses: PlanifMes[];
  CollectPlanifResumen: PlanifRuta[]; // todas (para progreso de la lista)
  CollectPlanifResumenMes: PlanifRuta[]; // rutas del mes en detalle
  CollectPlanifDetalle: PlanifCircuito[]; // circuitos del mes en detalle
  CollectPlanifEdificios: PlanifEdificio[]; // edificios a visitar del mes en detalle
  CollectItemsCompra: ItemCompra[];
  CollectRutasDisponibles: RutaCatalogo[];
  CollectResumenCircuito: ResumenCircuito[];
  CollectDetalleCircuito: DetalleCircuito[];
  CollectFrecuencias: Frecuencia[];
  CollectGruposVentilacion: GrupoVentilacion[];
  CollectEncendedores: Encendedor[];
  CollectMaquinasCompra: MaquinaCompra[];
  /** Catálogo real (11.Respuestos + 99.ABM_MaquinasCompra) para compras y alta de stock. */
  CollectStockCatalog: StockCatalogItem[];
  /** Segmentos reales del combo de compras (99.ABM_ItemCompras.Item_IC, Title Case). */
  CollectSegmentos: string[];
  /** Técnicos reales (Usuarios rol Tecnico/Jefe Taller) para el picker de "asignar a técnico". */
  CollectTecnicosDisponibles: api.TecnicoOption[];

  // Global UI flags / nav context
  cerrarSesion: boolean;
  ElegirEdificioMaquina: boolean;
  PopUpTransferirMaquina: boolean;
  NroCircuitoDetail: string | null;
  MesAnoPlanificacionDetail: string | null;
  MesDetail: string | null;

  // Loading
  loading: boolean;

  // Actions
  login: (usuario: string, password: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  /** Rehidrata la sesión desde la cookie (llamar una vez al arrancar la app). */
  restoreSession: () => Promise<boolean>;
  logout: () => void;
  setCerrarSesion: (v: boolean) => void;
  setNroCircuitoDetail: (v: string | null) => void;
  setMesPlanificacionDetail: (mesAno: string | null, mes: string | null) => void;
  setLoading: (v: boolean) => void;

  // Home / Stock / Compras / Aprobaciones — datos reales (API real, ver src/services/api.ts)
  fetchHome: () => Promise<void>;
  /** Real: GET /api/dashboard/visitas — registros del rango [desde..hasta] (mm/yyyy). */
  fetchDashboardVisitas: (desde?: string, hasta?: string) => Promise<void>;
  fetchStock: () => Promise<void>;
  fetchTecnicos: () => Promise<void>;
  /** Real: GET /api/repuestos — catálogo de repuestos (11.Respuestos). */
  fetchRepuestos: () => Promise<void>;
  /** Real: POST /api/repuestos — ABM de repuestos (gate canEditAbm 'Repuestos'). */
  createRepuesto: (payload: api.RepuestoAbmInput) => Promise<void>;
  updateRepuesto: (id: number, payload: api.RepuestoAbmInput) => Promise<void>;
  bajaRepuesto: (id: number) => Promise<void>;
  /** Real: GET /api/catalog — segmentos + items (11.Respuestos + 99.ABM_MaquinasCompra). */
  fetchCatalog: () => Promise<void>;
  /** Real: GET /api/compras — cabeceras + sus líneas. `meses` (varios mm/yyyy) mergea; `mes` un mes puntual. */
  fetchCompras: (mes?: string, meses?: string[]) => Promise<void>;
  /** Real: GET /api/aprobaciones — pendientes del mes. */
  fetchAprobaciones: () => Promise<void>;
  /** Real: POST /api/stock/assign — mueve cantidad de 04.Stock a 99.ABMRepuestos_Tecnico. */
  assignStockToTecnico: (id: number, tecnico: string, cantidad: number) => Promise<void>;

  // ── Compras (05 + 06) — API real ──────────────────────────────────────
  createCompra: (payload: api.NewCompraPayload) => Promise<void>;
  editCompra: (id: number, payload: api.EditCompraPayload) => Promise<void>;
  mandarAAprobarCompra: (id: number) => Promise<void>;
  recibirCompra: (id: number, payload: { observacion?: string; lines: api.ReceiveLine[] }) => Promise<void>;
  anularCompra: (id: number) => Promise<void>;

  // ── Aprobaciones (07) — API real ──────────────────────────────────────
  approveAprobacion: (id: number) => Promise<void>;
  rejectAprobacion: (id: number, reason: string) => Promise<void>;

  // ── Incidentes (10 + 13) — API real ───────────────────────────────────
  fetchIncidentes: (resueltosMes?: string) => Promise<void>;
  createIncidente: (payload: api.NewIncidentePayload) => Promise<Incidente>;
  assignIncidente: (id: number, tecnico: string, fechaAsignada?: string) => Promise<void>;
  cambiarTecnicoIncidente: (id: number, tecnico: string) => Promise<void>;
  cambioMaquinaIncidente: (id: number, maquinaConcat: string, idMaquinaReemplazo?: string) => Promise<void>;
  generarCompraIncidente: (
    id: number,
    payload: { tipoCompra: 'repuesto' | 'maquina'; item: string; segmento: string }
  ) => Promise<void>;

  // ── Detalle de Máquinas (08) — API real ───────────────────────────────
  /** Real: GET /api/maquinas — todas las máquinas activas, ordenadas edificio→segmento→alfabético. */
  fetchMaquinas: () => Promise<void>;
  /** Devuelve pendingApproval=true si el rol (Jefe Taller) generó una aprobación en vez de aplicar directo. */
  transferMaquina: (id: number, payload: api.TransferMaquinaPayload) => Promise<{ pendingApproval: boolean }>;
  bajaMaquina: (id: number, motivo: string) => Promise<void>;

  // Patch (mock, salvo donde se indica)
  /** Stock: real (PATCH /api/stock/:id) — solo usa Cantidad_ST. */
  patchStock: (id: number, changes: Partial<StockItem>) => Promise<void>;
  /** Real: POST /api/stock (repuestos). Máquinas con serie/ID todavía no soportado — ver docs/backend.md. */
  addStock: (
    catalogItem: StockCatalogItem,
    cantidad: number,
    extras?: { NroSerie?: string; IDMaquina?: string }
  ) => Promise<void>;
  removeRegistro: (id: number) => Promise<void>;

  // Stock técnicos (real: 99.ABMRepuestos_Tecnico)
  fetchStockTecnicos: () => Promise<void>;
  patchStockTecnico: (id: number, changes: Partial<RepuestoTecnico>) => Promise<void>;
  /** Devuelve cantidad del técnico al depósito principal (04.Stock). */
  reingressStockTecnico: (id: number, qty: number) => Promise<void>;
  /** Transfiere un repuesto de un técnico a otro (suma o crea la fila destino). */
  assignStockTecnico: (fromId: number, toTecnico: string, qty: number) => Promise<void>;

  // Ventilaciones (real: 19.Ventilaciones + ABM.Edificios)
  /** Sin `mes`: abiertas + catálogos. Con `mes` (mm/yyyy): reemplaza solo CollectVentilaciones. */
  fetchVentilaciones: (mes?: string) => Promise<void>;
  asignarVentilacion: (id: number, payload: api.AsignarVentilacionPayload) => Promise<void>;
  addVentilacionEdificio: (payload: api.AddVentilacionEdificioPayload) => Promise<void>;
  deleteVentilacion: (id: number) => Promise<void>;

  // ── Planificaciones (real) ──
  fetchPlanificaciones: () => Promise<void>;
  fetchPlanificacionMes: (mes: string) => Promise<void>;
  createPlanificacion: (payload: { mes: string; mesNombre: string; lines: { tecnico: string; nroRuta: string }[] }) => Promise<void>;
  deletePlanificacion: (payload: { mesAno?: string; idUnivocoRuta?: string }) => Promise<void>;

  // ── ABMs de Configuración (real). Cada acción refetchea el bundle (contadores
  //    y relaciones cambian entre entidades → resync total es lo más seguro). ──
  fetchAbm: () => Promise<void>;
  createCircuito: (payload: { nroRuta: number; nroCircuito: number; observaciones?: string; edificioIds: number[] }) => Promise<void>;
  deleteCircuito: (nroCircuito: number) => Promise<void>;
  addEdificioCircuito: (nroCircuito: number, edificioId: number) => Promise<void>;
  removeEdificioCircuito: (detalleId: number) => Promise<void>;
  updateCircuitoObs: (nroCircuito: number, observaciones: string) => Promise<void>;
  createRuta: (nroRuta: number) => Promise<void>;
  deleteRuta: (nroRuta: number) => Promise<void>;
  createEdificio: (payload: api.EdificioAbmInput) => Promise<void>;
  updateEdificio: (id: number, payload: api.EdificioAbmInput) => Promise<void>;
  bajaEdificio: (id: number) => Promise<void>;
}

const SIDEBAR_STORAGE_KEY = 'washin-sidebar-collapsed';

function readStoredCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1';
}

const initialState: Omit<
  AppState,
  | 'toggleSidebar'
  | 'setSidebarCollapsed'
  | 'login'
  | 'restoreSession'
  | 'logout'
  | 'setCerrarSesion'
  | 'setNroCircuitoDetail'
  | 'setMesPlanificacionDetail'
  | 'setLoading'
  | 'fetchHome'
  | 'fetchDashboardVisitas'
  | 'fetchStock'
  | 'fetchTecnicos'
  | 'fetchRepuestos'
  | 'createRepuesto'
  | 'updateRepuesto'
  | 'bajaRepuesto'
  | 'fetchCatalog'
  | 'fetchCompras'
  | 'fetchAprobaciones'
  | 'assignStockToTecnico'
  | 'createCompra'
  | 'editCompra'
  | 'mandarAAprobarCompra'
  | 'recibirCompra'
  | 'anularCompra'
  | 'approveAprobacion'
  | 'rejectAprobacion'
  | 'fetchIncidentes'
  | 'createIncidente'
  | 'assignIncidente'
  | 'cambiarTecnicoIncidente'
  | 'cambioMaquinaIncidente'
  | 'generarCompraIncidente'
  | 'fetchMaquinas'
  | 'transferMaquina'
  | 'bajaMaquina'
  | 'patchStock'
  | 'addStock'
  | 'removeRegistro'
  | 'fetchStockTecnicos'
  | 'patchStockTecnico'
  | 'reingressStockTecnico'
  | 'assignStockTecnico'
  | 'fetchVentilaciones'
  | 'asignarVentilacion'
  | 'addVentilacionEdificio'
  | 'deleteVentilacion'
  | 'fetchPlanificaciones'
  | 'fetchPlanificacionMes'
  | 'createPlanificacion'
  | 'deletePlanificacion'
  | 'fetchAbm'
  | 'createCircuito'
  | 'deleteCircuito'
  | 'addEdificioCircuito'
  | 'removeEdificioCircuito'
  | 'updateCircuitoObs'
  | 'createRuta'
  | 'deleteRuta'
  | 'createEdificio'
  | 'updateEdificio'
  | 'bajaEdificio'
> = {
  sidebarCollapsed: readStoredCollapsed(),
  VarUsuario: null,
  VarTipoUser: null,
  VarVersion: appVersion,
  loggedUser: null,
  CollectUser: mockUsuarios,
  Collect_LPP: mockPermisos,
  CollectEdificios: mockEdificios,
  CollectResumen: mockRegistros,
  CollectDescansosHoy: [],
  CollectDashboardVisitas: [],
  CollectStock: mockStock,
  CollectStockTecnicos: [],
  CollectRepuestos: [],
  CollectCompras: [],
  CollectDetalleCompras: [],
  CollectAprobaciones: [],
  CollectDetalleMaquina: mockMaquinas,
  CollectMaquinas: [],
  CollectEdificiosMaquina: [],
  CollectIncidentes: [],
  CollectRepuestosIncidente: [],
  CollectMesesPlanificados: mockMesesPlanificacion,
  CollectResumenPlanificaciones: mockResumenPlanif,
  CollectDetallePlanificaciones: mockDetallePlanif,
  CollectEdificiosVisitar: mockEdificiosVisitar,
  CollectVentilaciones: [],
  CollectEdificiosVent: [],
  CollectFrecuenciasVent: [],
  CollectGruposVent: [],
  CollectAbmRutas: [],
  CollectAbmCircuitos: [],
  CollectAbmDetalles: [],
  CollectAbmEdificios: [],
  AbmFrecuencias: [],
  AbmGrupos: [],
  AbmRoles: [],
  AbmAccess: { tabs: [], canEdit: false },
  CollectPlanifMeses: [],
  CollectPlanifResumen: [],
  CollectPlanifResumenMes: [],
  CollectPlanifDetalle: [],
  CollectPlanifEdificios: [],
  CollectItemsCompra: mockItemsCompra,
  CollectRutasDisponibles: mockRutas,
  CollectResumenCircuito: mockResumenCircuitos,
  CollectDetalleCircuito: mockDetalleCircuitos,
  CollectFrecuencias: mockFrecuencias,
  CollectGruposVentilacion: mockGruposVent,
  CollectEncendedores: mockEncendedores,
  CollectMaquinasCompra: mockMaquinasCompra,
  CollectStockCatalog: [],
  CollectSegmentos: [],
  CollectTecnicosDisponibles: [],
  cerrarSesion: false,
  ElegirEdificioMaquina: false,
  PopUpTransferirMaquina: false,
  NroCircuitoDetail: null,
  MesAnoPlanificacionDetail: null,
  MesDetail: null,
  loading: false,
};

/**
 * 401 en cualquier llamada autenticada = sesión inválida/vencida (o la cookie
 * nunca se guardó). Desloguea localmente para que AppShell redirija a /login
 * en vez de dejar la pantalla reintentando algo que nunca va a andar.
 */
function handleAuthError(err: unknown, set: (partial: Partial<AppState>) => void): void {
  if (err instanceof api.ApiError && err.status === 401) {
    set({ VarUsuario: null, VarTipoUser: null, loggedUser: null, Collect_LPP: [] });
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  ...initialState,

  toggleSidebar: () => {
    const next = !get().sidebarCollapsed;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? '1' : '0');
    }
    set({ sidebarCollapsed: next });
  },

  setSidebarCollapsed: (v) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, v ? '1' : '0');
    }
    set({ sidebarCollapsed: v });
  },

  login: async (usuario, password) => {
    if (!usuario.trim() || !password.trim()) {
      return { ok: false, message: 'Completá usuario y contraseña.' };
    }
    try {
      const session = await api.login(usuario, password);
      set({
        VarUsuario: session.usuario,
        VarTipoUser: session.rol,
        Collect_LPP: api.modulosToPermisos(session.modulos, session.rol),
      });
      return { ok: true };
    } catch (err) {
      const message = err instanceof api.ApiError ? err.message : 'No se pudo conectar con el servidor.';
      return { ok: false, message };
    }
  },

  restoreSession: async () => {
    try {
      const session = await api.me();
      set({
        VarUsuario: session.usuario,
        VarTipoUser: session.rol,
        Collect_LPP: api.modulosToPermisos(session.modulos, session.rol),
      });
      return true;
    } catch {
      return false;
    }
  },

  logout: () => {
    api.logout().catch(() => {});
    set({
      VarUsuario: null,
      VarTipoUser: null,
      loggedUser: null,
      cerrarSesion: false,
      Collect_LPP: [],
    });
  },

  setCerrarSesion: (v) => set({ cerrarSesion: v }),

  setNroCircuitoDetail: (v) => set({ NroCircuitoDetail: v }),

  setMesPlanificacionDetail: (mesAno, mes) =>
    set({ MesAnoPlanificacionDetail: mesAno, MesDetail: mes }),

  setLoading: (v) => set({ loading: v }),

  fetchHome: async () => {
    try {
      const { visitas, comprasDelMes, descansosHoy } = await api.getHome();
      set({ CollectResumen: visitas, CollectDetalleCompras: comprasDelMes, CollectDescansosHoy: descansosHoy ?? [] });
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  fetchDashboardVisitas: async (desde, hasta) => {
    try {
      const { visitas } = await api.getDashboardVisitas(desde, hasta);
      set({ CollectDashboardVisitas: visitas });
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  fetchStock: async () => {
    try {
      const stock = await api.getStock();
      set({ CollectStock: stock });
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  fetchTecnicos: async () => {
    try {
      const tecnicos = await api.getTecnicos();
      set({ CollectTecnicosDisponibles: tecnicos });
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  fetchRepuestos: async () => {
    try {
      const repuestos = await api.getRepuestos();
      set({ CollectRepuestos: repuestos });
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  createRepuesto: async (payload) => {
    try {
      await api.createRepuesto(payload);
      await get().fetchRepuestos();
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  updateRepuesto: async (id, payload) => {
    try {
      await api.updateRepuesto(id, payload);
      await get().fetchRepuestos();
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  bajaRepuesto: async (id) => {
    try {
      await api.bajaRepuesto(id);
      await get().fetchRepuestos();
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  assignStockToTecnico: async (id, tecnico, cantidad) => {
    try {
      const result = await api.assignStockToTecnico(id, tecnico, cantidad);
      set((s) => ({
        CollectStock: s.CollectStock.map((it) =>
          it.ID === id ? { ...it, Cantidad_ST: result.Cantidad_ST } : it
        ),
      }));
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  fetchCatalog: async () => {
    try {
      const { segmentos, items } = await api.getCatalog();
      // El catálogo real no tiene ID por item; sintetizamos uno estable por índice
      // para las UIs que keyean por ID (Compras / alta de stock).
      const catalog: StockCatalogItem[] = items.map((it, i) => ({
        ID: i + 1,
        Tipo: it.tipo,
        Item: it.item,
        Marca: it.marca,
        Codigo: it.codigo,
        Modelo: it.modelo,
      }));
      set({ CollectStockCatalog: catalog, CollectSegmentos: segmentos });
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  fetchCompras: async (mes, meses) => {
    try {
      const { pedidos, detalles } = await api.getCompras(mes, meses);
      set({ CollectCompras: pedidos, CollectDetalleCompras: detalles });
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  fetchAprobaciones: async () => {
    try {
      const aprobaciones = await api.getAprobaciones();
      set({ CollectAprobaciones: aprobaciones });
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  createCompra: async (payload) => {
    try {
      const { pedido, detalles } = await api.createCompra(payload);
      set((s) => ({
        CollectCompras: [pedido, ...s.CollectCompras],
        CollectDetalleCompras: [...s.CollectDetalleCompras, ...detalles],
      }));
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  editCompra: async (id, payload) => {
    try {
      await api.editCompra(id, payload);
      // El estado quedó tocado en varias listas; re-sincronizamos desde la fuente.
      await get().fetchCompras();
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  mandarAAprobarCompra: async (id) => {
    try {
      await api.mandarAAprobarCompra(id);
      set((s) => ({
        CollectCompras: s.CollectCompras.map((p) =>
          p.ID === id ? { ...p, Status_PC: 'En Aprobacion' } : p
        ),
      }));
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  recibirCompra: async (id, payload) => {
    try {
      await api.recibirCompra(id, payload);
      // Recibir saca la compra del listado (Filtrar_PC="SI") y toca stock.
      set((s) => ({ CollectCompras: s.CollectCompras.filter((p) => p.ID !== id) }));
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  anularCompra: async (id) => {
    try {
      await api.anularCompra(id);
      set((s) => ({ CollectCompras: s.CollectCompras.filter((p) => p.ID !== id) }));
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  approveAprobacion: async (id) => {
    try {
      await api.approveAprobacion(id);
      // Sale de la bandeja de pendientes; el pedido pasa a Aprobada (visible en Compras).
      set((s) => ({ CollectAprobaciones: s.CollectAprobaciones.filter((a) => a.ID !== id) }));
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  rejectAprobacion: async (id, reason) => {
    try {
      await api.rejectAprobacion(id, reason);
      set((s) => ({ CollectAprobaciones: s.CollectAprobaciones.filter((a) => a.ID !== id) }));
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  patchStock: async (id, changes) => {
    if (changes.Cantidad_ST == null) return;
    try {
      const result = await api.patchStockCantidad(id, changes.Cantidad_ST);
      set((s) => ({
        CollectStock: s.CollectStock.map((it) =>
          it.ID === id ? { ...it, Cantidad_ST: result.Cantidad_ST } : it
        ),
      }));
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  fetchMaquinas: async () => {
    try {
      const { maquinas, edificios } = await api.getMaquinas();
      set({ CollectMaquinas: maquinas, CollectEdificiosMaquina: edificios });
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  transferMaquina: async (id, payload) => {
    let result: Awaited<ReturnType<typeof api.transferMaquina>>;
    try {
      result = await api.transferMaquina(id, payload);
    } catch (err) {
      handleAuthError(err, set);
      throw err; // solo el error de la mutación real debe llegar a la UI
    }
    // Re-sincronización best-effort: si el re-fetch falla, la transferencia ya
    // persistió — no debe presentarse como si la transferencia hubiese fallado.
    await get().fetchMaquinas().catch(() => {});
    return { pendingApproval: result.pendingApproval === true };
  },

  bajaMaquina: async (id, motivo) => {
    try {
      await api.bajaMaquina(id, motivo);
      // Baja = ELIMINADA → sale del listado.
      set((s) => ({ CollectMaquinas: s.CollectMaquinas.filter((m) => m.ID !== id) }));
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  fetchIncidentes: async (resueltosMes) => {
    try {
      const { incidentes, repuestos } = await api.getIncidentes(resueltosMes);
      set({ CollectIncidentes: incidentes, CollectRepuestosIncidente: repuestos });
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  createIncidente: async (payload) => {
    try {
      const created = await api.createIncidente(payload);
      set((s) => ({ CollectIncidentes: [created, ...s.CollectIncidentes] }));
      return created;
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  assignIncidente: async (id, tecnico, fechaAsignada) => {
    try {
      await api.assignIncidente(id, tecnico, fechaAsignada);
      await get().fetchIncidentes(); // el descuento de stock + estado se resincroniza
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  cambiarTecnicoIncidente: async (id, tecnico) => {
    try {
      await api.cambiarTecnicoIncidente(id, tecnico);
      set((s) => ({
        CollectIncidentes: s.CollectIncidentes.map((it) =>
          it.ID === id ? { ...it, TecnicoAsignado_IN: tecnico, Status_IN: 'Asignado' } : it
        ),
      }));
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  cambioMaquinaIncidente: async (id, maquinaConcat, idMaquinaReemplazo) => {
    try {
      await api.cambioMaquinaIncidente(id, maquinaConcat, idMaquinaReemplazo);
      set((s) => ({
        CollectIncidentes: s.CollectIncidentes.map((it) =>
          it.ID === id ? { ...it, Status_IN: 'En Aprobacion', MaquinaAsignada_IN: maquinaConcat } : it
        ),
      }));
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  generarCompraIncidente: async (id, payload) => {
    try {
      await api.generarCompraIncidente(id, payload);
      // Refresca las compras del mes para que el guard anti-duplicado del front
      // vea la compra recién generada y no permita generar otra para el mismo
      // incidente (msapp Screen_Incidentes.pa.yaml:192, CollectAUX).
      await get().fetchCompras();
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  fetchVentilaciones: async (mes) => {
    try {
      const data = await api.getVentilaciones(mes);
      if (mes) {
        // Vista por mes: reemplaza solo la lista (los catálogos ya están cargados).
        set({ CollectVentilaciones: data.ventilaciones });
      } else {
        const full = data as api.VentilacionesResponse;
        set({
          CollectVentilaciones: full.ventilaciones,
          CollectEdificiosVent: full.edificios,
          CollectFrecuenciasVent: full.frecuencias,
          CollectGruposVent: full.grupos,
        });
      }
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  asignarVentilacion: async (id, payload) => {
    try {
      await api.asignarVentilacion(id, payload);
      // Update optimista: no refetch para no resetear el filtro por mes activo.
      // No tocamos Frecuencia_VE: el backend (como la PowerApp) solo ajusta la
      // frecuencia del EDIFICIO cuando fue adelantada, nunca la de la ventilación.
      set((s) => ({
        CollectVentilaciones: s.CollectVentilaciones.map((v) =>
          v.ID === id
            ? {
                ...v,
                Estado_VE: 'Asignada' as const,
                Asignado_VE: payload.tecnico,
                IDAsignado_VE: payload.idTecnico,
                ProximaLimpieza_VE: payload.proximaLimpieza,
                FechaProgramada_VE: '', // obsoleta al re-asignar (ver backend)
                Orden_VE: 3,
              }
            : v
        ),
      }));
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  addVentilacionEdificio: async (payload) => {
    try {
      const created = await api.addVentilacionEdificio(payload);
      set((s) => ({
        CollectVentilaciones: [created, ...s.CollectVentilaciones],
        CollectEdificiosVent: s.CollectEdificiosVent.map((e) =>
          e.ID === payload.idEdificio
            ? { ...e, EnCircuito: true, Grupo: payload.grupo, Frecuencia: payload.frecuencia }
            : e
        ),
      }));
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  deleteVentilacion: async (id) => {
    try {
      await api.deleteVentilacion(id);
      set((s) => ({ CollectVentilaciones: s.CollectVentilaciones.filter((v) => v.ID !== id) }));
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  // ── Planificaciones ─────────────────────────────────────────────────────
  fetchPlanificaciones: async () => {
    try {
      const b = await api.getPlanificaciones();
      set({
        CollectPlanifMeses: b.meses,
        CollectPlanifResumen: b.resumen,
        CollectTecnicosDisponibles: b.tecnicos,
        CollectAbmRutas: b.rutas,
      });
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  fetchPlanificacionMes: async (mes) => {
    try {
      const b = await api.getPlanificacionMes(mes);
      set({ CollectPlanifResumenMes: b.resumen, CollectPlanifDetalle: b.detalle, CollectPlanifEdificios: b.edificios });
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  createPlanificacion: async (payload) => {
    try {
      await api.createPlanificacion(payload);
      await get().fetchPlanificaciones();
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  deletePlanificacion: async (payload) => {
    try {
      await api.deletePlanificacion(payload);
      await get().fetchPlanificaciones();
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  // ── ABMs de Configuración ──────────────────────────────────────────────
  fetchAbm: async () => {
    try {
      const b = await api.getAbm();
      set({
        CollectAbmRutas: b.rutas,
        CollectAbmCircuitos: b.circuitos,
        CollectAbmDetalles: b.detalles,
        CollectAbmEdificios: b.edificios,
        AbmFrecuencias: b.frecuencias,
        AbmGrupos: b.grupos,
        AbmRoles: b.roles,
        AbmAccess: b.access,
      });
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  createCircuito: async (payload) => {
    try {
      await api.createCircuito(payload);
      await get().fetchAbm();
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  deleteCircuito: async (nroCircuito) => {
    try {
      await api.deleteCircuito(nroCircuito);
      await get().fetchAbm();
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  addEdificioCircuito: async (nroCircuito, edificioId) => {
    try {
      await api.addEdificioCircuito(nroCircuito, edificioId);
      await get().fetchAbm();
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  removeEdificioCircuito: async (detalleId) => {
    try {
      await api.removeEdificioCircuito(detalleId);
      await get().fetchAbm();
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  updateCircuitoObs: async (nroCircuito, observaciones) => {
    try {
      await api.updateCircuitoObs(nroCircuito, observaciones);
      await get().fetchAbm();
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  createRuta: async (nroRuta) => {
    try {
      await api.createRuta(nroRuta);
      await get().fetchAbm();
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  deleteRuta: async (nroRuta) => {
    try {
      await api.deleteRuta(nroRuta);
      await get().fetchAbm();
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  createEdificio: async (payload) => {
    try {
      await api.createEdificio(payload);
      await get().fetchAbm();
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  updateEdificio: async (id, payload) => {
    try {
      await api.updateEdificio(id, payload);
      await get().fetchAbm();
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  bajaEdificio: async (id) => {
    try {
      await api.bajaEdificio(id);
      await get().fetchAbm();
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  removeRegistro: async (id) => {
    try {
      // Baja lógica en 01.Registros (Estado -> "Anulado"). El backend valida rol
      // Admin y estado Pendiente (PowerApp: bt_cerrarPopUpFCE_5).
      await api.anularRegistro(id);
      set((s) => ({
        CollectResumen: s.CollectResumen.filter((r) => r.ID !== id),
      }));
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  fetchStockTecnicos: async () => {
    try {
      const { stockTecnicos, tecnicos } = await api.getStockTecnicos();
      set({ CollectStockTecnicos: stockTecnicos, CollectTecnicosDisponibles: tecnicos });
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  patchStockTecnico: async (id, changes) => {
    try {
      const cantidad = Number(changes.Cantidad_RT ?? 0);
      await api.editStockTecnico(id, cantidad);
      set((s) => ({
        CollectStockTecnicos: s.CollectStockTecnicos.map((it) => (it.ID === id ? { ...it, Cantidad_RT: cantidad } : it)),
      }));
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  reingressStockTecnico: async (id, qty) => {
    try {
      const { restante } = await api.reingresoStockTecnico(id, qty);
      set((s) => ({
        CollectStockTecnicos: s.CollectStockTecnicos.map((it) => (it.ID === id ? { ...it, Cantidad_RT: restante } : it)),
      }));
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  assignStockTecnico: async (fromId, toTecnico, qty) => {
    try {
      await api.transferStockTecnico(fromId, toTecnico, qty);
      // La transferencia toca 2 filas (origen + destino, que puede ser nueva) → refetch.
      await get().fetchStockTecnicos();
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  addStock: async (catalogItem, cantidad, extras) => {
    try {
      const created = await api.addStock({
        tipo: catalogItem.Tipo,
        item: catalogItem.Item,
        marca: catalogItem.Marca,
        codigo: catalogItem.Codigo,
        cantidad,
        nroSerie: extras?.NroSerie,
        idMaquina: extras?.IDMaquina,
      });
      set((s) => {
        const existingIdx = s.CollectStock.findIndex((it) => it.ID === created.ID);
        if (existingIdx !== -1) {
          const next = [...s.CollectStock];
          next[existingIdx] = created;
          return { CollectStock: next };
        }
        return { CollectStock: [...s.CollectStock, created] };
      });
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },
}));
