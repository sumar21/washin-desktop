import { create } from 'zustand';
import type {
  Usuario,
  PermisoModulo,
  Edificio,
  Registro,
  StockItem,
  StockCatalogItem,
  RepuestoTecnico,
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
  mockStockTecnicos,
  mockMaquinas,
  mockMesesPlanificacion,
  mockResumenPlanif,
  mockDetallePlanif,
  mockEdificiosVisitar,
  mockVentilaciones,
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
  CollectStock: StockItem[];
  CollectStockTecnicos: RepuestoTecnico[];
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
  fetchStock: () => Promise<void>;
  fetchTecnicos: () => Promise<void>;
  /** Real: GET /api/catalog — segmentos + items (11.Respuestos + 99.ABM_MaquinasCompra). */
  fetchCatalog: () => Promise<void>;
  /** Real: GET /api/compras — cabeceras activas del mes + sus líneas. */
  fetchCompras: () => Promise<void>;
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
  fetchIncidentes: () => Promise<void>;
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
  patchVentilacion: (id: number, changes: Partial<Ventilacion>) => void;
  /** Real: POST /api/stock (repuestos). Máquinas con serie/ID todavía no soportado — ver docs/backend.md. */
  addStock: (
    catalogItem: StockCatalogItem,
    cantidad: number,
    extras?: { NroSerie?: string; IDMaquina?: string }
  ) => Promise<void>;
  removeRegistro: (id: number) => void;

  // Stock técnicos
  patchStockTecnico: (id: number, changes: Partial<RepuestoTecnico>) => void;
  /** Transfer some qty from a technician back to the main warehouse stock. */
  reingressStockTecnico: (id: number, qty: number) => void;
  /** Assign repuesto from one technician to another (creates or sums). */
  assignStockTecnico: (
    fromId: number,
    toTecnico: string,
    qty: number
  ) => void;

  // Ventilaciones
  addVentilacion: (v: Omit<Ventilacion, 'ID'>) => void;
  removeVentilacion: (id: number) => void;
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
  | 'fetchStock'
  | 'fetchTecnicos'
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
  | 'patchVentilacion'
  | 'addStock'
  | 'removeRegistro'
  | 'patchStockTecnico'
  | 'reingressStockTecnico'
  | 'assignStockTecnico'
  | 'addVentilacion'
  | 'removeVentilacion'
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
  CollectStock: mockStock,
  CollectStockTecnicos: mockStockTecnicos,
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
  CollectVentilaciones: mockVentilaciones,
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

const nextId = <T extends { ID: number }>(arr: T[]) =>
  arr.reduce((max, item) => Math.max(max, item.ID), 0) + 1;

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
      const { visitas, comprasDelMes } = await api.getHome();
      set({ CollectResumen: visitas, CollectDetalleCompras: comprasDelMes });
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

  fetchCompras: async () => {
    try {
      const { pedidos, detalles } = await api.getCompras();
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

  fetchIncidentes: async () => {
    try {
      const { incidentes, repuestos } = await api.getIncidentes();
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
    } catch (err) {
      handleAuthError(err, set);
      throw err;
    }
  },

  patchVentilacion: (id, changes) =>
    set((s) => ({
      CollectVentilaciones: s.CollectVentilaciones.map((it) =>
        it.ID === id ? { ...it, ...changes } : it
      ),
    })),

  removeRegistro: (id) =>
    set((s) => ({
      CollectResumen: s.CollectResumen.filter((r) => r.ID !== id),
    })),

  patchStockTecnico: (id, changes) =>
    set((s) => ({
      CollectStockTecnicos: s.CollectStockTecnicos.map((it) =>
        it.ID === id ? { ...it, ...changes } : it
      ),
    })),

  reingressStockTecnico: (id, qty) =>
    set((s) => {
      const source = s.CollectStockTecnicos.find((it) => it.ID === id);
      if (!source) return s;
      const taken = Math.min(qty, source.Cantidad_RT);
      // Reduce from técnico
      const newTecStock = s.CollectStockTecnicos.map((it) =>
        it.ID === id ? { ...it, Cantidad_RT: it.Cantidad_RT - taken } : it
      );
      // Add back to main warehouse stock (match by Codigo if possible, else by name)
      const existingMain = s.CollectStock.find(
        (st) =>
          st.Status_ST === 'Activo' &&
          (st.Nro_ST === source.Codigo_RT ||
            st.Item_ST.toLowerCase() === source.Concat_RT.toLowerCase())
      );
      let newMain: typeof s.CollectStock;
      if (existingMain) {
        newMain = s.CollectStock.map((st) =>
          st.ID === existingMain.ID
            ? { ...st, Cantidad_ST: st.Cantidad_ST + taken }
            : st
        );
      } else {
        const newId =
          s.CollectStock.reduce((max, it) => Math.max(max, it.ID), 0) + 1;
        newMain = [
          ...s.CollectStock,
          {
            ID: newId,
            Item_ST: source.Concat_RT,
            Tipo_ST: 'REPUESTO',
            Nro_ST: source.Codigo_RT,
            Cantidad_ST: taken,
            Status_ST: 'Activo',
          },
        ];
      }
      return { CollectStockTecnicos: newTecStock, CollectStock: newMain };
    }),

  addVentilacion: (v) =>
    set((s) => {
      const id = nextId(s.CollectVentilaciones);
      return {
        CollectVentilaciones: [...s.CollectVentilaciones, { ...v, ID: id }],
      };
    }),

  removeVentilacion: (id) =>
    set((s) => ({
      CollectVentilaciones: s.CollectVentilaciones.filter((v) => v.ID !== id),
    })),

  assignStockTecnico: (fromId, toTecnico, qty) =>
    set((s) => {
      const source = s.CollectStockTecnicos.find((it) => it.ID === fromId);
      if (!source || !toTecnico || source.Tecnico_RT === toTecnico) return s;
      const taken = Math.min(qty, source.Cantidad_RT);
      // Reduce from source técnico
      const reduced = s.CollectStockTecnicos.map((it) =>
        it.ID === fromId ? { ...it, Cantidad_RT: it.Cantidad_RT - taken } : it
      );
      // Add to destination técnico — sum if exists, otherwise new entry
      const existingDest = reduced.find(
        (it) =>
          it.Tecnico_RT === toTecnico &&
          it.Codigo_RT === source.Codigo_RT
      );
      let result: typeof s.CollectStockTecnicos;
      if (existingDest) {
        result = reduced.map((it) =>
          it.ID === existingDest.ID
            ? { ...it, Cantidad_RT: it.Cantidad_RT + taken }
            : it
        );
      } else {
        const newId =
          reduced.reduce((max, it) => Math.max(max, it.ID), 0) + 1;
        result = [
          ...reduced,
          {
            ID: newId,
            Tecnico_RT: toTecnico,
            Concat_RT: source.Concat_RT,
            Codigo_RT: source.Codigo_RT,
            Cantidad_RT: taken,
            Status_RT: 'Activo',
          },
        ];
      }
      return { CollectStockTecnicos: result };
    }),

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
