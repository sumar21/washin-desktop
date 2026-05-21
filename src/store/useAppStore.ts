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
  mockPedidos,
  mockDetalleCompras,
  mockAprobaciones,
  mockMaquinas,
  mockIncidentes,
  mockRepuestosIncidentes,
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
  mockStockCatalog,
  appVersion,
} from '@/mock/data';

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
  CollectStockCatalog: StockCatalogItem[];

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
  login: (usuario: string, password: string) => { ok: true } | { ok: false; reason: 'empty' | 'invalid' };
  logout: () => void;
  setCerrarSesion: (v: boolean) => void;
  setNroCircuitoDetail: (v: string | null) => void;
  setMesPlanificacionDetail: (mesAno: string | null, mes: string | null) => void;
  setLoading: (v: boolean) => void;

  // Patch (mock)
  patchStock: (id: number, changes: Partial<StockItem>) => void;
  patchCompra: (id: number, changes: Partial<PedidoCompra>) => void;
  patchDetalleCompra: (id: number, changes: Partial<DetalleCompra>) => void;
  patchAprobacion: (id: number, changes: Partial<Aprobacion>) => void;
  patchIncidente: (id: number, changes: Partial<Incidente>) => void;
  patchMaquina: (id: number, changes: Partial<DetalleMaquina>) => void;
  patchVentilacion: (id: number, changes: Partial<Ventilacion>) => void;

  addCompra: (pedido: Omit<PedidoCompra, 'ID'>, detalles: Omit<DetalleCompra, 'ID'>[]) => void;
  addIncidente: (incidente: Omit<Incidente, 'ID'>) => void;
  addStock: (
    catalogItem: StockCatalogItem,
    cantidad: number,
    extras?: { NroSerie?: string; IDMaquina?: string }
  ) => void;
  removeRegistro: (id: number) => void;
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
  | 'logout'
  | 'setCerrarSesion'
  | 'setNroCircuitoDetail'
  | 'setMesPlanificacionDetail'
  | 'setLoading'
  | 'patchStock'
  | 'patchCompra'
  | 'patchDetalleCompra'
  | 'patchAprobacion'
  | 'patchIncidente'
  | 'patchMaquina'
  | 'patchVentilacion'
  | 'addCompra'
  | 'addIncidente'
  | 'addStock'
  | 'removeRegistro'
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
  CollectCompras: mockPedidos,
  CollectDetalleCompras: mockDetalleCompras,
  CollectAprobaciones: mockAprobaciones,
  CollectDetalleMaquina: mockMaquinas,
  CollectIncidentes: mockIncidentes,
  CollectRepuestosIncidente: mockRepuestosIncidentes,
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
  CollectStockCatalog: mockStockCatalog,
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

  login: (usuario, password) => {
    if (!usuario.trim() || !password.trim()) return { ok: false, reason: 'empty' };
    const user = get().CollectUser.find(
      (u) => u.Usuario.toLowerCase() === usuario.toLowerCase() && u.Contrasena === password && u.Status === 'ALTA'
    );
    if (!user) return { ok: false, reason: 'invalid' };
    set({
      VarUsuario: user.Usuario,
      VarTipoUser: user.Rol,
      loggedUser: user,
    });
    return { ok: true };
  },

  logout: () => {
    set({
      VarUsuario: null,
      VarTipoUser: null,
      loggedUser: null,
      cerrarSesion: false,
    });
  },

  setCerrarSesion: (v) => set({ cerrarSesion: v }),

  setNroCircuitoDetail: (v) => set({ NroCircuitoDetail: v }),

  setMesPlanificacionDetail: (mesAno, mes) =>
    set({ MesAnoPlanificacionDetail: mesAno, MesDetail: mes }),

  setLoading: (v) => set({ loading: v }),

  patchStock: (id, changes) =>
    set((s) => ({
      CollectStock: s.CollectStock.map((it) => (it.ID === id ? { ...it, ...changes } : it)),
    })),

  patchCompra: (id, changes) =>
    set((s) => ({
      CollectCompras: s.CollectCompras.map((it) => (it.ID === id ? { ...it, ...changes } : it)),
    })),

  patchDetalleCompra: (id, changes) =>
    set((s) => ({
      CollectDetalleCompras: s.CollectDetalleCompras.map((it) =>
        it.ID === id ? { ...it, ...changes } : it
      ),
    })),

  patchAprobacion: (id, changes) =>
    set((s) => ({
      CollectAprobaciones: s.CollectAprobaciones.map((it) =>
        it.ID === id ? { ...it, ...changes } : it
      ),
    })),

  patchIncidente: (id, changes) =>
    set((s) => ({
      CollectIncidentes: s.CollectIncidentes.map((it) => (it.ID === id ? { ...it, ...changes } : it)),
    })),

  patchMaquina: (id, changes) =>
    set((s) => ({
      CollectDetalleMaquina: s.CollectDetalleMaquina.map((it) =>
        it.ID === id ? { ...it, ...changes } : it
      ),
    })),

  patchVentilacion: (id, changes) =>
    set((s) => ({
      CollectVentilaciones: s.CollectVentilaciones.map((it) =>
        it.ID === id ? { ...it, ...changes } : it
      ),
    })),

  addCompra: (pedido, detalles) =>
    set((s) => {
      const pedidoId = nextId(s.CollectCompras);
      const newPedido = { ...pedido, ID: pedidoId };
      const baseDetailId = nextId(s.CollectDetalleCompras);
      const newDetalles = detalles.map((d, i) => ({ ...d, ID: baseDetailId + i }));
      return {
        CollectCompras: [...s.CollectCompras, newPedido],
        CollectDetalleCompras: [...s.CollectDetalleCompras, ...newDetalles],
      };
    }),

  addIncidente: (incidente) =>
    set((s) => {
      const id = nextId(s.CollectIncidentes);
      return {
        CollectIncidentes: [...s.CollectIncidentes, { ...incidente, ID: id }],
      };
    }),

  removeRegistro: (id) =>
    set((s) => ({
      CollectResumen: s.CollectResumen.filter((r) => r.ID !== id),
    })),

  addStock: (catalogItem, cantidad, extras) =>
    set((s) => {
      // Si ya existe el item (y NO trae IDMaquina/Serie únicos), sumá la cantidad
      const isUniqueMachine = !!extras?.IDMaquina || !!extras?.NroSerie;
      if (!isUniqueMachine) {
        const existing = s.CollectStock.find(
          (it) =>
            it.Status_ST === 'Activo' &&
            it.Item_ST.toLowerCase() === catalogItem.Item.toLowerCase() &&
            it.Tipo_ST === catalogItem.Tipo
        );
        if (existing) {
          return {
            CollectStock: s.CollectStock.map((it) =>
              it.ID === existing.ID
                ? { ...it, Cantidad_ST: it.Cantidad_ST + cantidad }
                : it
            ),
          };
        }
      }
      const id = nextId(s.CollectStock);
      return {
        CollectStock: [
          ...s.CollectStock,
          {
            ID: id,
            Item_ST: catalogItem.Item,
            Tipo_ST: catalogItem.Tipo,
            Marca_ST: catalogItem.Marca,
            Nro_ST: catalogItem.Codigo,
            Cantidad_ST: cantidad,
            Status_ST: 'Activo',
            NroSerie_ST: extras?.NroSerie,
            IDMaquina_ST: extras?.IDMaquina,
          },
        ],
      };
    }),
}));
