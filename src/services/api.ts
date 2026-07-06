import type {
  Aprobacion,
  DetalleCompra,
  DetalleMaquina,
  Incidente,
  PedidoCompra,
  PermisoModulo,
  Registro,
  RepuestoIncidente,
  StockItem,
  UserRole,
} from '@/types/domain';

/** Cliente del backend real (`/api/*`, ver ../../api). Login/Home/Stock por ahora. */

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Mensajes amigables para los códigos internos de la API — nunca mostrarle al
// usuario un `error` crudo tipo "no_session" (ver api/*.ts para el listado).
const ERROR_MESSAGES: Record<string, string> = {
  no_session: 'Tu sesión expiró. Iniciá sesión de nuevo.',
  invalid: 'Usuario o contraseña incorrectos.',
  empty: 'Completá usuario y contraseña.',
  forbidden: 'No tenés permiso para esta acción.',
  not_implemented: 'Esta función todavía no está disponible.',
  invalid_id: 'Identificador inválido.',
  method_not_allowed: 'Acción no permitida.',
  server_error: 'No se pudo conectar con el servidor. Probá de nuevo en unos segundos.',
};

function friendlyMessage(json: Record<string, unknown> | null, status: number): string {
  if (typeof json?.message === 'string') return json.message;
  const code = typeof json?.error === 'string' ? json.error : undefined;
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  return `No se pudo completar la operación (error ${status}).`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, friendlyMessage(json, res.status));
  }
  return json as T;
}

interface ModuloApi {
  ID: number;
  Modulo_LPP: string;
  Orden_LPP: number;
}

export interface SessionResponse {
  usuario: string;
  nombre: string;
  apellido: string;
  rol: UserRole;
  modulos: ModuloApi[];
}

/** El backend no manda ImgON/OFF/Rol por módulo (ya viene filtrado por rol) — se completan acá. */
export function modulosToPermisos(modulos: ModuloApi[], rol: UserRole): PermisoModulo[] {
  return modulos.map((m) => ({
    ID: m.ID,
    Modulo_LPP: m.Modulo_LPP as PermisoModulo['Modulo_LPP'],
    Orden_LPP: m.Orden_LPP,
    ImgON_LPP: '',
    ImgOFF_LPP: '',
    Rol_LPP: rol,
  }));
}

export function login(usuario: string, password: string): Promise<SessionResponse> {
  return request('/auth/login', { method: 'POST', body: JSON.stringify({ usuario, password }) });
}

export function logout(): Promise<{ ok: true }> {
  return request('/auth/logout', { method: 'POST' });
}

export function me(): Promise<SessionResponse> {
  return request('/auth/me');
}

export interface HomeResponse {
  visitas: Registro[];
  comprasDelMes: DetalleCompra[];
}

export function getHome(): Promise<HomeResponse> {
  return request('/home');
}

export function getStock(): Promise<StockItem[]> {
  return request('/stock');
}

export interface AddStockPayload {
  tipo: string;
  item: string;
  marca?: string;
  codigo?: string;
  cantidad: number;
  nroSerie?: string;
  idMaquina?: string;
}

export function addStock(payload: AddStockPayload): Promise<StockItem> {
  return request('/stock', { method: 'POST', body: JSON.stringify(payload) });
}

export function patchStockCantidad(id: number, cantidad: number): Promise<{ ID: number; Cantidad_ST: number }> {
  return request(`/stock/${id}`, { method: 'PATCH', body: JSON.stringify({ cantidad }) });
}

export interface TecnicoOption {
  ID: number;
  Nombre_Tecnico: string;
  Telefono?: string;
}

export function getTecnicos(): Promise<TecnicoOption[]> {
  return request('/users/tecnicos');
}

export function assignStockToTecnico(
  id: number,
  tecnico: string,
  cantidad: number
): Promise<{ ID: number; Cantidad_ST: number }> {
  return request('/stock/assign', { method: 'POST', body: JSON.stringify({ id, tecnico, cantidad }) });
}

// ── Catálogo (segmentos + items para compras / alta de stock) ────────────
export interface CatalogItem {
  tipo: string;
  item: string;
  marca?: string;
  codigo?: string;
  modelo?: string;
}
export interface CatalogResponse {
  segmentos: string[];
  items: CatalogItem[];
}

export function getCatalog(): Promise<CatalogResponse> {
  return request('/catalog');
}

// ── Compras (05.PedidoCompras + 06.DetalleCompra) ────────────────────────
export interface ComprasResponse {
  pedidos: PedidoCompra[];
  detalles: DetalleCompra[];
}

export function getCompras(): Promise<ComprasResponse> {
  return request('/compras');
}

export interface NewCompraPayload {
  segmento: string;
  observaciones?: string;
  lines: { item: string; marca?: string; cantidad: number }[];
}

export function createCompra(payload: NewCompraPayload): Promise<{ pedido: PedidoCompra; detalles: DetalleCompra[] }> {
  return request('/compras', { method: 'POST', body: JSON.stringify(payload) });
}

export interface EditCompraPayload {
  observaciones?: string;
  updates?: { detalleId: number; cantidad: number }[];
  adds?: { item: string; marca?: string; cantidad: number }[];
  removes?: number[];
}

export function editCompra(id: number, payload: EditCompraPayload): Promise<{ ID: number; Cantidad_PC: number }> {
  return request(`/compras/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export function mandarAAprobarCompra(id: number): Promise<{ ID: number; Status_PC: string }> {
  return request(`/compras/${id}`, { method: 'POST', body: JSON.stringify({ action: 'approve-request' }) });
}

export function anularCompra(id: number): Promise<{ ID: number; Status_PC: string }> {
  return request(`/compras/${id}`, { method: 'POST', body: JSON.stringify({ action: 'anular' }) });
}

export interface ReceiveLine {
  detalleId: number;
  cantidadReal: number;
  nroSerie?: string;
  idMaquina?: string;
}

export function recibirCompra(
  id: number,
  payload: { observacion?: string; lines: ReceiveLine[] }
): Promise<{ ID: number; Status_PC: string }> {
  return request(`/compras/${id}`, {
    method: 'POST',
    body: JSON.stringify({ action: 'receive', ...payload }),
  });
}

// ── Aprobaciones (07.Aprobaciones) ───────────────────────────────────────
export function getAprobaciones(): Promise<Aprobacion[]> {
  return request('/aprobaciones');
}

export function approveAprobacion(id: number): Promise<{ ID: number; Status_AP: string }> {
  return request(`/aprobaciones/${id}`, { method: 'POST', body: JSON.stringify({ action: 'approve' }) });
}

export function rejectAprobacion(id: number, reason: string): Promise<{ ID: number; Status_AP: string }> {
  return request(`/aprobaciones/${id}`, { method: 'POST', body: JSON.stringify({ action: 'reject', reason }) });
}

// ── Detalle de Máquinas (08.DetalleMaquina) ──────────────────────────────
export interface EdificioOption {
  edificio: string;
  codigo: string;
}
export interface MaquinasResponse {
  maquinas: DetalleMaquina[];
  edificios: EdificioOption[];
}

/** Trae TODAS las máquinas activas (sin tope de 2000), ordenadas edificio→segmento→alfabético. */
export function getMaquinas(): Promise<MaquinasResponse> {
  return request('/maquinas');
}

export interface HistorialItem {
  ID: number;
  Fecha_IN: string;
  Titulo: string;
  Descripcion?: string;
  Status_IN: string;
  Resuelto_IN: string;
}

export function getMaquinaHistorial(concat: string): Promise<HistorialItem[]> {
  return request(`/maquinas/historial?concat=${encodeURIComponent(concat)}`);
}

export interface TransferMaquinaPayload {
  edificioDestino: string;
  codigoDestino?: string;
  motivo: string;
  encendido?: string;
}

export interface TransferMaquinaResult {
  ID: number;
  Status_DM?: string;
  Edificio_DM?: string;
  /** true si el rol (Jefe Taller) generó una aprobación en vez de aplicar directo. */
  pendingApproval?: boolean;
}

export function transferMaquina(id: number, payload: TransferMaquinaPayload): Promise<TransferMaquinaResult> {
  return request(`/maquinas/${id}`, { method: 'POST', body: JSON.stringify({ action: 'transfer', ...payload }) });
}

export function bajaMaquina(id: number, motivo: string): Promise<{ ID: number; Status_DM: string }> {
  return request(`/maquinas/${id}`, { method: 'POST', body: JSON.stringify({ action: 'baja', motivo }) });
}

// ── Incidentes (10.Incidentes + 13.RepuestosIncidentes) ──────────────────
export interface IncidentesResponse {
  incidentes: Incidente[];
  repuestos: RepuestoIncidente[];
}

export function getIncidentes(): Promise<IncidentesResponse> {
  return request('/incidentes');
}

export interface NewIncidentePayload {
  edificio: string;
  codigoEdificio?: string;
  maquinaConcat?: string;
  idMaquina?: string;
  descripcion: string;
  tecnico?: string;
}

export function createIncidente(payload: NewIncidentePayload): Promise<Incidente> {
  return request('/incidentes', { method: 'POST', body: JSON.stringify(payload) });
}

export function assignIncidente(id: number, tecnico: string, fechaAsignada?: string): Promise<{ ID: number; Status_IN: string; TecnicoAsignado_IN: string }> {
  return request(`/incidentes/${id}`, { method: 'POST', body: JSON.stringify({ action: 'assign', tecnico, fechaAsignada }) });
}

export function cambiarTecnicoIncidente(id: number, tecnico: string): Promise<{ ID: number; TecnicoAsignado_IN: string }> {
  return request(`/incidentes/${id}`, { method: 'POST', body: JSON.stringify({ action: 'cambiar-tecnico', tecnico }) });
}

export function cambioMaquinaIncidente(id: number, maquinaConcat: string, idMaquinaReemplazo?: string): Promise<{ ID: number; Status_IN: string }> {
  return request(`/incidentes/${id}`, {
    method: 'POST',
    body: JSON.stringify({ action: 'cambio-maquina', maquinaConcat, idMaquinaReemplazo }),
  });
}

export function generarCompraIncidente(
  id: number,
  payload: { tipoCompra: 'repuesto' | 'maquina'; item: string; segmento: string }
): Promise<{ ID: number; compra: string }> {
  return request(`/incidentes/${id}`, { method: 'POST', body: JSON.stringify({ action: 'generar-compra', ...payload }) });
}
