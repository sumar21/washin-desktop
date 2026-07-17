import type { SharePointItem } from './graph.js';
import { abmAccessMatrix, type AbmTab } from '../../src/lib/abmAccessMatrix.js';

export type { AbmTab };

/**
 * GUIDs de listas y mapeo de campos reales de SharePoint -> shapes del frontend
 * (`src/types/domain.ts`). Confirmado contra el tenant real (no solo el .msapp):
 * ver docs/data-model.md para el detalle completo de columnas.
 */

export const LIST_IDS = {
  usuarios: 'abe151cc-f0cc-4ff2-a79e-fc0121c3dd41',
  stock: '37f239e9-4076-4f5c-a8aa-c052447bfc1a',
  registros: '4c7393bb-dc2f-47af-a5ea-bb3860628f29',
  pedidoCompras: '76288cb9-70e7-4839-b427-9c5148773f75',
  detalleCompra: '51fb2d13-d77c-4823-af16-f08e4ad41d9f',
  aprobaciones: '08ff6d69-082a-46fa-9eb2-108be44dade1',
  detalleMaquina: '53e0e6a3-a3a5-498c-87b6-1f12b578ba8d',
  incidentes: 'ad39289f-3acf-4028-826a-a2c5458cb79f',
  repuestosIncidentes: 'e0259639-9678-454e-b3cf-5f9b5fc9c17c',
  repuestos: '92db215b-1301-4a64-8ecc-01338a66567f',
  itemCompras: '7f2fbe91-5872-44ba-a131-d24ed9544ee8',
  maquinasCompra: '2e4dadb2-eb41-4421-a2da-9a1be9b76aa0',
  permisosDesktop: '60ed777c-2330-4c47-83ca-2a1f8a031143',
  repuestosTecnico: 'ccede13f-55cc-453f-b1bf-fac99d13b68a',
  ventilaciones: 'a4e28738-1007-4218-aec0-9f8cda7e10ee',
  edificios: 'd57217b1-54a0-40eb-8193-60915d9e66a7',
  frecuencias: '226a290e-e505-4dd8-be1f-ee2d4e75839a',
  gruposVent: '4d54b06b-59c2-4dc2-b6a9-cfa87d2bd1e7',
  rutas: 'd16a7a8f-c21d-4c20-96a9-0a27c088f636',
  resumenCircuito: '3ed8507c-6f16-4a3a-b256-0fb20acea0f2',
  detalleCircuito: '13186fc6-1b8c-453e-8183-7ee760e09e6f',
  tipoABM: '2f9975a6-b910-41f3-965d-44867e306d00',
  roles: '748fd460-68dc-4194-8ad9-67499f5db42f',
  mesesPlanif: 'e3e8a011-90dd-43e1-adf4-d9d9ac2d261e',
  resumenPlanif: '1a5986e8-9367-4350-ae2a-5b3755a7098e',
  detallePlanif: 'bf4452b0-50b8-406c-8988-3c57b393a195',
  edificiosVisitar: '717028c9-9949-494b-9ee8-a1a7089f6f5b',
  horasDescanso: 'e1361cec-5651-44bc-93b4-44e94e4caeee', // 14.HorasDescanso
} as const;

/**
 * Versión de la app que la PowerApp guarda en `Version_*` de cada lista.
 * Se replica acá para que los writes del backend queden con el mismo formato.
 */
export const APP_VERSION = 'v20260520.1.0.0';

// ── Helpers de fecha (formato exacto de la PowerApp: Text(Today(),"[$-es-ES]...")) ──
// SharePoint guarda TODO como texto (incluso Cantidad_* y las fechas), así que
// estas columnas auxiliares se escriben como string, nunca como Date/number.
const MESES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

// Zona horaria del negocio. Vercel/Lambda corre en UTC; si usáramos getHours()/getDate()
// locales, las fechas/hora quedarían ~3h adelantadas y de noche caerían en el día/mes
// equivocado (rompiendo el bucket mm/yyyy). Se computa siempre en hora de Argentina.
const BUSINESS_TZ = 'America/Argentina/Buenos_Aires';

export function fechasHoy(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});

  const dd = parts.day;
  const mm = parts.month;
  const yyyy = parts.year;
  const HH = parts.hour === '24' ? '00' : parts.hour; // algunos runtimes devuelven '24' a medianoche
  const min = parts.minute;
  const ss = parts.second;
  const ms = String(now.getMilliseconds()).padStart(3, '0'); // ms es invariante a la zona

  return {
    fecha: `${dd}/${mm}/${yyyy}`, // dd/mm/yyyy
    mesAno: `${mm}/${yyyy}`, // mm/yyyy
    mes: MESES_ES[Number(mm) - 1], // nombre de mes en español
    ano: yyyy, // yyyy
    hora: `${HH}:${min}`, // HH:mm
    // Sufijo único para IDUnivoco (equivale a HHmmmsms de la PowerApp).
    stamp: `${HH}${min}${ss}${ms}`,
  };
}

/** ['mm/yyyy' de hoy, 'mm/yyyy' de hoy+1 mes] en hora de Argentina (es-ES). */
export function ventanaMesActualYSiguiente(now = new Date()): [string, string] {
  const { mesAno } = fechasHoy(now); // mm/yyyy de hoy (ya tz-safe)
  const [mm, yyyy] = mesAno.split('/').map(Number);
  const nextMm = mm === 12 ? 1 : mm + 1;
  const nextYyyy = mm === 12 ? yyyy + 1 : yyyy;
  return [mesAno, `${String(nextMm).padStart(2, '0')}/${nextYyyy}`];
}

/** Segmentos que se reciben como "repuesto simple" (solo suman a 04.Stock, sin crear máquina en 08). */
const SIMPLE_RECEIVE_SEGMENTS = new Set(['repuesto', 'cargadora', 'expendedora', 'encendedor', 'encendedora']);

/** ¿El segmento representa una máquina con número de serie (crea fila en 08.DetalleMaquina al recibir)? */
export function isMachineSegment(segmento: string): boolean {
  return !SIMPLE_RECEIVE_SEGMENTS.has(segmento.trim().toLowerCase());
}

// ── Usuarios ──────────────────────────────────────────────────────────────
// Columnas internas reales: Usuario -> field_1, Password -> field_4.
export interface UsuarioRow {
  ID: number;
  Usuario: string;
  Contrasena: string;
  Nombre: string;
  Apellido: string;
  Concat_Nombre_Apellido: string;
  Rol: string;
  Status: 'ALTA' | 'BAJA';
  Telefono?: string;
  Email?: string;
}

export function mapUsuario(item: SharePointItem): UsuarioRow {
  return {
    ID: Number(item.id),
    Usuario: String(item.field_1 ?? ''),
    Contrasena: String(item.field_4 ?? ''),
    Nombre: String(item.Nombre ?? ''),
    Apellido: String(item.Apellido ?? ''),
    Concat_Nombre_Apellido: String(item.Concat_Nombre_Apellido ?? ''),
    Rol: String(item.Rol ?? ''),
    Status: (item.Status as 'ALTA' | 'BAJA') ?? 'BAJA',
    Telefono: item.Telefono ? String(item.Telefono) : undefined,
    Email: item.Correo ? String(item.Correo) : undefined,
  };
}

// Proyección para el ABM de Usuarios (Configuración, solo Admin).
const USUARIO_ABM_SELECT = ['field_1', 'field_4', 'Nombre', 'Apellido', 'Concat_Nombre_Apellido', 'Rol', 'Status', 'Telefono', 'Correo'];
export function usuarioAbmSelectFields(): string[] {
  return USUARIO_ABM_SELECT;
}

/** Rol (tal como se guarda en Usuarios.Rol) -> columna booleana ("SI"/"NO") de 99.ListaPermisosDesktop. */
export const ROLE_TO_LPP_COLUMN: Record<string, string | null> = {
  Admin: 'Admin_LPP',
  'Supervisor Lider': 'SupervisorLider_LPP',
  Supervisor: 'SuperVisor_LPP',
  'Atencion Al Cliente': 'ACliente_LPP',
  'Jefe Taller': 'JefeTaller_LPP',
  'Supervisor Mantenimiento': 'SupervisorMNT_LPP',
  'Supervisor Ventilaciones': 'SupervisorVTC_LPP',
  Tecnico: null, // sin acceso al Desktop
};

/** Roles que pueden editar stock (mismo gate que Stock.tsx en el frontend — replicado acá server-side). */
export const STOCK_EDIT_ROLES = new Set(['Admin', 'Jefe Taller']);

/** Roles elegibles como "técnico" para asignar stock (igual que la PowerApp original). */
export const TECNICO_ROLES = new Set(['Tecnico', 'Jefe Taller']);

// Proyección segura de Usuarios para el picker de técnicos — nunca incluye
// field_1/field_4 (usuario/contraseña) ni contacto.
export interface TecnicoOption {
  ID: number;
  Nombre_Tecnico: string;
  Telefono?: string; // para el deep-link de WhatsApp al asignar/crear incidente
}

const TECNICOS_SELECT = ['Concat_Nombre_Apellido', 'Rol', 'Status', 'Telefono'];

export function tecnicosSelectFields(): string[] {
  return TECNICOS_SELECT;
}

export function mapTecnicos(rows: SharePointItem[]): TecnicoOption[] {
  return rows
    .filter((r) => r.Status === 'ALTA' && TECNICO_ROLES.has(String(r.Rol ?? '')))
    .map((r) => ({
      ID: Number(r.id),
      Nombre_Tecnico: String(r.Concat_Nombre_Apellido ?? ''),
      Telefono: r.Telefono ? String(r.Telefono) : undefined,
    }))
    .filter((t) => t.Nombre_Tecnico)
    .sort((a, b) => a.Nombre_Tecnico.localeCompare(b.Nombre_Tecnico));
}

// ── Stock (04.Stock) ──────────────────────────────────────────────────────
// Columna interna real: Item_ST -> Lodge_ST. Cantidad_ST se guarda como texto.
export interface StockRow {
  ID: number;
  Item_ST: string;
  Tipo_ST: string;
  Marca_ST?: string;
  Nro_ST?: string;
  Cantidad_ST: number;
  Status_ST: 'Activo' | 'Inactivo';
}

const STOCK_SELECT = ['Lodge_ST', 'Tipo_ST', 'Marca_ST', 'Nro_ST', 'Cantidad_ST', 'Status_ST', 'ConcatStock_ST'];

export function mapStock(item: SharePointItem): StockRow {
  return {
    ID: Number(item.id),
    Item_ST: String(item.Lodge_ST ?? ''),
    Tipo_ST: String(item.Tipo_ST ?? ''),
    Marca_ST: item.Marca_ST ? String(item.Marca_ST) : undefined,
    Nro_ST: item.Nro_ST ? String(item.Nro_ST) : undefined,
    Cantidad_ST: Number(item.Cantidad_ST ?? 0) || 0,
    Status_ST: (item.Status_ST as 'Activo' | 'Inactivo') ?? 'Inactivo',
  };
}

export function stockSelectFields(): string[] {
  return STOCK_SELECT;
}

// ── Repuestos por técnico (99.ABMRepuestos_Tecnico) ──────────────────────
// Columnas internas reales confirmadas 1:1 con el sufijo (sin sorpresas acá).
// OJO: en datos reales `Concat_RT` viene de un catálogo/código viejo que NO
// corresponde al `Nro_ST` actual de 04.Stock (ej. "L57 - AGITADOR" vs "MT-220").
// Por eso accá construimos Concat_RT/Codigo_RT/Repuesto_RT desde los campos
// limpios de StockRow en vez de parsear un string concatenado como hacía la
// PowerApp original (esa fórmula además rompe si el nombre no tiene " - ").
export interface RepuestoTecnicoRow {
  ID: number;
  Tecnico_RT: string;
  Concat_RT: string;
  Codigo_RT?: string;
  Cantidad_RT: number;
  Status_RT: 'Activo' | 'Inactivo';
}

const REPUESTO_TECNICO_SELECT = ['Tecnico_RT', 'Concat_RT', 'Codigo_RT', 'Repuesto_RT', 'Cantidad_RT', 'Status_RT'];

export function repuestoTecnicoSelectFields(): string[] {
  return REPUESTO_TECNICO_SELECT;
}

export function mapRepuestoTecnico(item: SharePointItem): RepuestoTecnicoRow {
  return {
    ID: Number(item.id),
    Tecnico_RT: String(item.Tecnico_RT ?? ''),
    Concat_RT: String(item.Concat_RT ?? ''),
    Codigo_RT: item.Codigo_RT ? String(item.Codigo_RT) : undefined,
    Cantidad_RT: Number(item.Cantidad_RT ?? 0) || 0,
    Status_RT: (item.Status_RT as 'Activo' | 'Inactivo') ?? 'Inactivo',
  };
}

/** Clave estable para matchear "misma pieza" entre 04.Stock y 99.ABMRepuestos_Tecnico. */
export function buildConcatRT(stockRow: StockRow): string {
  return stockRow.Nro_ST ? `${stockRow.Nro_ST} - ${stockRow.Item_ST}` : stockRow.Item_ST;
}

// ── Registros (01.Registros) — visitas del Home ──────────────────────────
// OJO: excluir siempre "ImagenGral" del $select — guarda la foto en base64
// inline y puede pesar cientos de KB por fila.
export interface RegistroRow {
  ID: number;
  Edificio: string;
  NroRuta_R: string;
  NroCircuito_R: string;
  Estado: 'Pendiente' | 'Finalizado' | 'Anulado';
  Usuario: string;
  MesAño: string;
  HoraInicio?: string;
  HoraFinal?: string;
  Progreso?: number;
  /** Campos crudos para el Dashboard de visitas (tiempos + resultado de control). */
  HoraVisita?: string;
  HoraSalida?: string;
  FechaTerminada_R?: string;
  /** Ítems controlados OK y total de ítems chequeados de la visita. */
  Ok?: number;
  Check?: number;
  Codigo?: string;
  Direccion?: string;
}

const REGISTROS_SELECT = [
  'Edificio',
  'Nombre',
  'NroRuta_R',
  'NroCircuito_R',
  'Estado',
  'MesA_x00f1_o',
  'Hora',
  'Fecha',
  'Check',
  'Ok',
  'HoraVisita',
  'HoraSalida',
  'FechaTerminada_R',
  'Codigo',
  'Direccion',
];

export function mapRegistro(item: SharePointItem): RegistroRow {
  const check = Number(item.Check ?? 0) || 0;
  const ok = Number(item.Ok ?? 0) || 0;
  const estado = (item.Estado as RegistroRow['Estado']) ?? 'Pendiente';
  const progreso = check > 0 ? Math.round((ok / check) * 100) : estado === 'Finalizado' ? 100 : 0;

  return {
    ID: Number(item.id),
    Edificio: String(item.Edificio ?? ''),
    NroRuta_R: String(item.NroRuta_R ?? ''),
    NroCircuito_R: String(item.NroCircuito_R ?? ''),
    Estado: estado,
    Usuario: String(item.Nombre ?? ''),
    MesAño: String(item.MesA_x00f1_o ?? ''),
    HoraInicio: item.Hora ? String(item.Hora) : undefined,
    HoraFinal: item.Fecha ? String(item.Fecha) : undefined,
    Progreso: progreso,
    HoraVisita: item.HoraVisita ? String(item.HoraVisita) : undefined,
    HoraSalida: item.HoraSalida ? String(item.HoraSalida) : undefined,
    FechaTerminada_R: item.FechaTerminada_R ? String(item.FechaTerminada_R) : undefined,
    Ok: check > 0 || item.Ok != null ? ok : undefined,
    Check: item.Check != null ? check : undefined,
    Codigo: item.Codigo ? String(item.Codigo) : undefined,
    Direccion: item.Direccion ? String(item.Direccion) : undefined,
  };
}

export function registrosSelectFields(): string[] {
  return REGISTROS_SELECT;
}

// ── Descansos (14.HorasDescanso) — pausas de los técnicos ─────────────────
// Un descanso: técnico (User_HD), hora inicio/fin, y Status_HD (Activo = en curso,
// Finalizado = ya realizado). Fecha_HD en dd/mm/yyyy. El Home muestra los de HOY.
export interface DescansoRow {
  ID: number;
  Usuario: string;
  HoraInicio: string;
  HoraFin: string;
  Estado: string; // Activo | Finalizado
  Fecha: string; // dd/mm/yyyy
}
const DESCANSO_SELECT = ['User_HD', 'HoraInicio_HD', 'HoraFin_HD', 'Status_HD', 'Fecha_HD'];
export function descansoSelectFields(): string[] {
  return DESCANSO_SELECT;
}
export function mapDescanso(item: SharePointItem): DescansoRow {
  return {
    ID: Number(item.id),
    Usuario: String(item.User_HD ?? '').trim(),
    HoraInicio: String(item.HoraInicio_HD ?? '').trim(),
    HoraFin: String(item.HoraFin_HD ?? '').trim(),
    Estado: String(item.Status_HD ?? '').trim(),
    Fecha: String(item.Fecha_HD ?? '').trim(),
  };
}

// ── DetalleCompra (06.DetalleCompra) — líneas de una orden de compra ──────
// OJO: 06.DetalleCompra NO tiene columna Codigo_DC (confirmado contra el tenant).
// El "código" que muestra la UI se deriva del catálogo, no se persiste.
export interface DetalleCompraRow {
  ID: number;
  IDCompra_DC: string;
  Item_DC: string;
  Cantidad_DC: number;
  CantidadIngresada_DC?: number;
  FechaMesAno_DC: string;
  Fecha_DC: string;
  Segmento_DC: string;
  Marca_DC?: string;
  Rechazada_DC?: string;
  Status_DC: 'Pendiente' | 'Aprobada' | 'Rechazada' | 'Recibida' | 'Anulado';
}

const DETALLE_COMPRA_SELECT = [
  'IDCompra_DC',
  'Item_DC',
  'Cantidad_DC',
  'CantidadIngresada_DC',
  'FechaMesAno_DC',
  'Fecha_DC',
  'Segmento_DC',
  'Marca_DC',
  'Rechazada_DC',
  'Status_DC',
];

export function mapDetalleCompra(item: SharePointItem): DetalleCompraRow {
  return {
    ID: Number(item.id),
    IDCompra_DC: String(item.IDCompra_DC ?? ''),
    Item_DC: String(item.Item_DC ?? ''),
    Cantidad_DC: Number(item.Cantidad_DC ?? 0) || 0,
    CantidadIngresada_DC:
      item.CantidadIngresada_DC != null ? Number(item.CantidadIngresada_DC) || 0 : undefined,
    FechaMesAno_DC: String(item.FechaMesAno_DC ?? ''),
    Fecha_DC: String(item.Fecha_DC ?? ''),
    Segmento_DC: String(item.Segmento_DC ?? ''),
    Marca_DC: item.Marca_DC ? String(item.Marca_DC) : undefined,
    Rechazada_DC: item.Rechazada_DC ? String(item.Rechazada_DC) : undefined,
    Status_DC: (item.Status_DC as DetalleCompraRow['Status_DC']) ?? 'Pendiente',
  };
}

export function detalleCompraSelectFields(): string[] {
  return DETALLE_COMPRA_SELECT;
}

// ── PedidoCompras (05.PedidoCompras) — cabecera de una orden de compra ────
export interface PedidoCompraRow {
  ID: number;
  IDUnivoco_PC: string;
  Fecha_PC: string;
  FechaMesAno_PC: string;
  Segmento_PC: string;
  Cantidad_PC: number;
  Status_PC: 'Pendiente' | 'En Aprobacion' | 'Aprobada' | 'Recibida' | 'Rechazada' | 'Anulado';
  Filtrar_PC: 'SI' | 'NO';
  Observaciones_PC?: string;
  User_PC: string;
  IDIncidenteCompra_PC?: string;
}

const PEDIDO_COMPRA_SELECT = [
  'IDUnivoco_PC',
  'Fecha_PC',
  'FechaMesAno_PC',
  'Segmento_PC',
  'Cantidad_PC',
  'Status_PC',
  'Filtrar_PC',
  'Observaciones_PC',
  'Usuario_PC',
  'IDIncidenteCompra_PC',
];

export function mapPedidoCompra(item: SharePointItem): PedidoCompraRow {
  return {
    ID: Number(item.id),
    IDUnivoco_PC: String(item.IDUnivoco_PC ?? ''),
    Fecha_PC: String(item.Fecha_PC ?? ''),
    FechaMesAno_PC: String(item.FechaMesAno_PC ?? ''),
    Segmento_PC: String(item.Segmento_PC ?? ''),
    Cantidad_PC: Number(item.Cantidad_PC ?? 0) || 0,
    Status_PC: (item.Status_PC as PedidoCompraRow['Status_PC']) ?? 'Pendiente',
    Filtrar_PC: (item.Filtrar_PC as 'SI' | 'NO') ?? 'NO',
    Observaciones_PC: item.Observaciones_PC ? String(item.Observaciones_PC) : undefined,
    User_PC: String(item.Usuario_PC ?? ''),
    IDIncidenteCompra_PC: item.IDIncidenteCompra_PC ? String(item.IDIncidenteCompra_PC) : undefined,
  };
}

export function pedidoCompraSelectFields(): string[] {
  return PEDIDO_COMPRA_SELECT;
}

// ── Aprobaciones (07.Aprobaciones) — bandeja de aprobación ────────────────
export interface AprobacionRow {
  ID: number;
  TipoAprobacion_AP: 'Compra' | 'Cambio de Maquina' | 'Transferencia de Maquina';
  Status_AP: 'En Aprobacion' | 'Aprobada' | 'Rechazada';
  Aprobada_AP: 'SI' | 'NO';
  Rechazada_AP: 'SI' | 'NO';
  IDCompra_AP?: string;
  IDRegistroDM_AP?: string;
  ConcatAprobacion_AP: string;
  FechaMesAnoGen_AP: string;
  FechaGen_AP: string;
  Fecha_AP?: string;
  Hora_AP?: string;
  User_AP?: string;
  InfoRechazo_AP?: string;
}

const APROBACION_SELECT = [
  'TipoAprobacion_AP',
  'Status_AP',
  'Aprobada_AP',
  'Rechazada_AP',
  'IDCompra_AP',
  'IDRegistroDM_AP',
  'ConcatAprobacion_AP',
  'FechaMesAnoGen_AP',
  'FechaGen_AP',
  'Fecha_AP',
  'Hora_AP',
  'User_AP',
  'InfoRechazo_AP',
];

export function mapAprobacion(item: SharePointItem): AprobacionRow {
  return {
    ID: Number(item.id),
    TipoAprobacion_AP: (item.TipoAprobacion_AP as AprobacionRow['TipoAprobacion_AP']) ?? 'Compra',
    Status_AP: (item.Status_AP as AprobacionRow['Status_AP']) ?? 'En Aprobacion',
    Aprobada_AP: (item.Aprobada_AP as 'SI' | 'NO') ?? 'NO',
    Rechazada_AP: (item.Rechazada_AP as 'SI' | 'NO') ?? 'NO',
    IDCompra_AP: item.IDCompra_AP ? String(item.IDCompra_AP) : undefined,
    IDRegistroDM_AP: item.IDRegistroDM_AP ? String(item.IDRegistroDM_AP) : undefined,
    ConcatAprobacion_AP: String(item.ConcatAprobacion_AP ?? ''),
    FechaMesAnoGen_AP: String(item.FechaMesAnoGen_AP ?? ''),
    FechaGen_AP: String(item.FechaGen_AP ?? ''),
    Fecha_AP: item.Fecha_AP ? String(item.Fecha_AP) : undefined,
    Hora_AP: item.Hora_AP ? String(item.Hora_AP) : undefined,
    User_AP: item.User_AP ? String(item.User_AP) : undefined,
    InfoRechazo_AP: item.InfoRechazo_AP ? String(item.InfoRechazo_AP) : undefined,
  };
}

export function aprobacionSelectFields(): string[] {
  return APROBACION_SELECT;
}

// ── Catálogo de compra (segmentos + items) ───────────────────────────────
// Segmentos = 99.ABM_ItemCompras.Item_IC (los strings reales del combo, Title Case).
// Items repuesto = 11.Respuestos (ConcatRepuesto_RP/Codigo_RP/Marca_RP).
// Items máquina = 99.ABM_MaquinasCompra (Concat_MC/Marca_MC/Modelo_MC), agrupados por Segmento_MC.
export interface CatalogItem {
  tipo: string; // segmento (Title Case real, ej. "Lavadora", "Repuesto")
  item: string;
  marca?: string;
  codigo?: string;
  modelo?: string;
}
export interface CatalogResponse {
  segmentos: string[];
  items: CatalogItem[];
}

export const itemComprasSelectFields = () => ['Item_IC', 'Status_IC'];
export const repuestosSelectFields = () => ['ConcatRepuesto_RP', 'Codigo_RP', 'Marca_RP', 'Status_RP'];
export const maquinasCompraSelectFields = () => ['Concat_MC', 'Marca_MC', 'Modelo_MC', 'Segmento_MC', 'Status_MC'];

const clean = (v: unknown) => String(v ?? '').trim();

export function buildCatalog(
  segRows: SharePointItem[],
  repuestoRows: SharePointItem[],
  maquinaRows: SharePointItem[]
): CatalogResponse {
  const segmentos = [
    ...new Set(segRows.filter((r) => r.Status_IC === 'Activo').map((r) => clean(r.Item_IC)).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));

  const items: CatalogItem[] = [];
  for (const r of repuestoRows) {
    if (r.Status_RP !== 'Activo') continue;
    const item = clean(r.ConcatRepuesto_RP);
    if (!item) continue;
    items.push({ tipo: 'Repuesto', item, marca: clean(r.Marca_RP) || undefined, codigo: clean(r.Codigo_RP) || undefined });
  }
  for (const r of maquinaRows) {
    if (r.Status_MC !== 'Activo') continue;
    const item = clean(r.Concat_MC);
    const tipo = clean(r.Segmento_MC);
    if (!item || !tipo) continue;
    items.push({ tipo, item, marca: clean(r.Marca_MC) || undefined, modelo: clean(r.Modelo_MC) || undefined });
  }
  return { segmentos, items };
}

// ── 11.Respuestos (ABM de repuestos con precio) ───────────────────────────
// Catálogo de repuestos con su precio unitario. `Precio_RP` es una columna NUEVA
// (número, 2 decimales) que el usuario debe crear a mano en SharePoint. Hasta que
// exista, el GET la mapea con default 0 y el PATCH la escribe igual (ver api/repuestos).
// OJO: el GET NO restringe $select para esta lista — no se puede $select una columna
// que todavía no existe (Graph responde 400). Al expandir todos los fields, `Precio_RP`
// aparece automáticamente apenas se cree la columna, sin tocar más código.
export interface RepuestoAbmRow {
  ID: number;
  Nombre_RP: string;
  Codigo_RP: string;
  Marca_RP: string;
  Stock_RP: number;
  Status_RP: string;
  ConcatRepuesto_RP: string;
  Precio_RP: number;
}

/**
 * Proyección "objetivo" de la lista 11 (incluye Precio_RP). Documenta las columnas
 * que consume el ABM. El GET de /api/repuestos NO la usa como $select a propósito:
 * como Precio_RP puede no existir todavía, expandimos todos los fields (ver arriba).
 */
export function repuestoAbmSelectFields(): string[] {
  return ['Nombre_RP', 'Codigo_RP', 'Stock_RP', 'Status_RP', 'ConcatRepuesto_RP', 'Precio_RP'];
}

export function mapRepuestoAbm(item: SharePointItem): RepuestoAbmRow {
  return {
    ID: Number(item.id),
    Nombre_RP: String(item.Nombre_RP ?? '').trim(),
    Codigo_RP: String(item.Codigo_RP ?? '').trim(),
    Marca_RP: String(item.Marca_RP ?? '').trim(),
    Stock_RP: Number(item.Stock_RP ?? 0) || 0,
    Status_RP: String(item.Status_RP ?? '').trim(),
    ConcatRepuesto_RP: String(item.ConcatRepuesto_RP ?? '').trim(),
    // Columna nueva: default 0 mientras no exista en SharePoint.
    Precio_RP: Number(item.Precio_RP ?? 0) || 0,
  };
}

/** Roles que pueden editar el precio de un repuesto (mismo gate que Stock). */
export const REPUESTO_PRECIO_EDIT_ROLES = STOCK_EDIT_ROLES;

// ── DetalleMaquina (08.DetalleMaquina) — parque de máquinas ───────────────
// OJO: la columna Segmento_DM es internamente `Segmentp_DM` (typo real en SharePoint).
export interface MaquinaRow {
  ID: number;
  IDMaquina_DM: string;
  Marca_DM: string;
  Modelo_DM: string;
  NroSerie_DM: string;
  ConcatMaquina_DM: string;
  ConcatMaquinaIncidente_DM: string;
  Segmento_DM: string;
  Encendido_DM?: string;
  Status_DM: 'INSTALADA' | 'DEPOSITO' | 'ELIMINADA';
  Edificio_DM: string;
  CodigoEdificio_DM?: string;
  FechaIngreso_DM?: string;
  Motivo_DM?: string;
}

const MAQUINA_SELECT = [
  'IDMaquina_DM',
  'Marca_DM',
  'Modelo_DM',
  'NroSerie_DM',
  'ConcatMaquina_DM',
  'ConcatMaquinaIncidente_DM',
  'Segmentp_DM',
  'Encendido_DM',
  'Status_DM',
  'Edificio_DM',
  'CodigoEdificio_DM',
  'FechaIngreso_DM',
  'Motivo_DM',
];

export function maquinaSelectFields(): string[] {
  return MAQUINA_SELECT;
}

export function mapMaquina(item: SharePointItem): MaquinaRow {
  // Los datos reales traen espacios sobrantes en Edificio/Marca/Modelo/Segmento
  // (" Rafaela 5029", "S.Queen "), lo que rompe el agrupado/orden/filtros. Se
  // normalizan al leer. ConcatMaquina/ConcatMaquinaIncidente se dejan como están
  // (son claves de identidad que se matchean contra otras listas).
  return {
    ID: Number(item.id),
    IDMaquina_DM: String(item.IDMaquina_DM ?? '').trim(),
    Marca_DM: String(item.Marca_DM ?? '').trim(),
    Modelo_DM: String(item.Modelo_DM ?? '').trim(),
    NroSerie_DM: String(item.NroSerie_DM ?? '').trim(),
    ConcatMaquina_DM: String(item.ConcatMaquina_DM ?? ''),
    ConcatMaquinaIncidente_DM: String(item.ConcatMaquinaIncidente_DM ?? ''),
    Segmento_DM: String(item.Segmentp_DM ?? '').trim(),
    Encendido_DM: item.Encendido_DM ? String(item.Encendido_DM).trim() : undefined,
    Status_DM: (item.Status_DM as MaquinaRow['Status_DM']) ?? 'INSTALADA',
    Edificio_DM: String(item.Edificio_DM ?? '').trim(),
    CodigoEdificio_DM: item.CodigoEdificio_DM ? String(item.CodigoEdificio_DM).trim() : undefined,
    FechaIngreso_DM: item.FechaIngreso_DM ? String(item.FechaIngreso_DM) : undefined,
    Motivo_DM: item.Motivo_DM ? String(item.Motivo_DM) : undefined,
  };
}

// Orden lógico de segmento para el listado (lavado → secado → resto).
const SEGMENT_ORDER = ['lavadora', 'secadora simple', 'secadora doble', 'cargadora', 'expendedora', 'encendedora'];
function segIndex(seg: string): number {
  const i = SEGMENT_ORDER.indexOf(seg.trim().toLowerCase());
  return i === -1 ? SEGMENT_ORDER.length : i;
}

/** Ordena máquinas por Edificio → Segmento (orden lógico) → alfabético (marca+modelo+serie). */
export function sortMaquinas(rows: MaquinaRow[]): MaquinaRow[] {
  const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });
  return [...rows].sort((a, b) => {
    const e = collator.compare(a.Edificio_DM, b.Edificio_DM);
    if (e !== 0) return e;
    const s = segIndex(a.Segmento_DM) - segIndex(b.Segmento_DM);
    if (s !== 0) return s;
    const alfa = `${a.Marca_DM} ${a.Modelo_DM} ${a.NroSerie_DM}`;
    const alfb = `${b.Marca_DM} ${b.Modelo_DM} ${b.NroSerie_DM}`;
    return collator.compare(alfa, alfb);
  });
}

// ── Historial de máquina (10.Incidentes filtrado por la máquina) ──────────
// Columnas internas reales confirmadas: Descripcion_IN (no DescripcionIncidente_IN),
// Categoria_IN/NoResuelto_IN (no hay Titulo_IN — el "título" se arma del tipo).
export interface HistorialRow {
  ID: number;
  Fecha_IN: string;
  Titulo: string;
  Descripcion?: string;
  Edificio_IN: string;
  Status_IN: string;
  Resuelto_IN: string;
}

const HISTORIAL_SELECT = [
  'Fecha_IN',
  'Categoria_IN',
  'NoResuelto_IN',
  'Descripcion_IN',
  'DescripcionResuelto_IN',
  'NombreEdificio_IN',
  'Status_IN',
  'Resuelto_IN',
  'ConcatMaquina_IN',
  'MaquinaAsignada_IN',
];

export function historialSelectFields(): string[] {
  return HISTORIAL_SELECT;
}

export function mapHistorial(item: SharePointItem): HistorialRow {
  const titulo = clean(item.Categoria_IN) || clean(item.NoResuelto_IN) || 'Incidente';
  const desc = clean(item.Descripcion_IN) || clean(item.DescripcionResuelto_IN) || undefined;
  return {
    ID: Number(item.id),
    Fecha_IN: String(item.Fecha_IN ?? ''),
    Titulo: titulo,
    Descripcion: desc,
    Edificio_IN: String(item.NombreEdificio_IN ?? ''),
    Status_IN: String(item.Status_IN ?? ''),
    Resuelto_IN: String(item.Resuelto_IN ?? ''),
  };
}

// ── Incidentes (10.Incidentes) — módulo núcleo ────────────────────────────
// OJO: la lista NO tiene columna Titulo_IN ni una IDIncidente propia — la clave es
// el ID numérico de SharePoint. Descripción real: DescripcionCarga_IN (carga de A.Cliente),
// Descripcion_IN (asignado), DescripcionResuelto_IN (resuelto). `IDIncidente` que espera
// la UI se deriva como String(ID) (así se linkean 13.RepuestosIncidentes).
export interface IncidenteRow {
  ID: number;
  IDIncidente: string; // = String(ID) — clave para 13.RepuestosIncidentes
  Fecha_IN: string;
  FechaMesAno_IN: string;
  Titulo_IN: string; // derivado (Categoria_IN || NoResuelto_IN)
  NoResuelto_IN: string;
  Categoria_IN?: string;
  Status_IN: string;
  Resuelto_IN: string;
  NombreEdificio_IN: string;
  CodigoEdifcio_IN?: string;
  IDMaquina_IN?: string;
  ConcatMaquina_IN?: string;
  MaquinaAsignada_IN?: string;
  TecnicoAsignado_IN?: string;
  CantidadRepuestos_IN: number;
  DescripcionIncidente_IN?: string; // = Descripcion_IN || DescripcionCarga_IN
  DescripcionCarga_IN?: string;
  DescripcionResuelto_IN?: string;
  FechaResuelto_IN?: string;
  FechaAsignada_IN?: string;
  User_IN: string;
}

const INCIDENTE_SELECT = [
  'Fecha_IN',
  'FechaMesAno_IN',
  'Categoria_IN',
  'NoResuelto_IN',
  'Status_IN',
  'Resuelto_IN',
  'NombreEdificio_IN',
  'CodigoEdifcio_IN',
  'IDMaquina_IN',
  'ConcatMaquina_IN',
  'ConcatMaquinaIncidente_DM',
  'MaquinaAsignada_IN',
  'TecnicoAsignado_IN',
  'CantidadRepuestos_IN',
  'Descripcion_IN',
  'DescripcionCarga_IN',
  'DescripcionResuelto_IN',
  'FechaResuelto_IN',
  'FechaAsignada_IN',
  'User_IN',
];

export function incidenteSelectFields(): string[] {
  return INCIDENTE_SELECT;
}

export function mapIncidente(item: SharePointItem): IncidenteRow {
  const id = Number(item.id);
  return {
    ID: id,
    IDIncidente: String(id),
    Fecha_IN: String(item.Fecha_IN ?? ''),
    FechaMesAno_IN: String(item.FechaMesAno_IN ?? ''),
    Titulo_IN: clean(item.Categoria_IN) || clean(item.NoResuelto_IN) || 'Incidente',
    NoResuelto_IN: String(item.NoResuelto_IN ?? ''),
    Categoria_IN: item.Categoria_IN ? String(item.Categoria_IN) : undefined,
    Status_IN: String(item.Status_IN ?? 'A Revisar'),
    Resuelto_IN: String(item.Resuelto_IN ?? 'NO'),
    NombreEdificio_IN: String(item.NombreEdificio_IN ?? ''),
    CodigoEdifcio_IN: item.CodigoEdifcio_IN ? String(item.CodigoEdifcio_IN) : undefined,
    IDMaquina_IN: item.IDMaquina_IN ? String(item.IDMaquina_IN) : undefined,
    ConcatMaquina_IN: item.ConcatMaquina_IN ? String(item.ConcatMaquina_IN) : undefined,
    MaquinaAsignada_IN: item.MaquinaAsignada_IN ? String(item.MaquinaAsignada_IN) : undefined,
    TecnicoAsignado_IN: item.TecnicoAsignado_IN ? String(item.TecnicoAsignado_IN) : undefined,
    CantidadRepuestos_IN: Number(item.CantidadRepuestos_IN ?? 0) || 0,
    DescripcionIncidente_IN:
      (item.Descripcion_IN ? String(item.Descripcion_IN) : '') ||
      (item.DescripcionCarga_IN ? String(item.DescripcionCarga_IN) : '') ||
      undefined,
    DescripcionCarga_IN: item.DescripcionCarga_IN ? String(item.DescripcionCarga_IN) : undefined,
    DescripcionResuelto_IN: item.DescripcionResuelto_IN ? String(item.DescripcionResuelto_IN) : undefined,
    FechaResuelto_IN: item.FechaResuelto_IN ? String(item.FechaResuelto_IN) : undefined,
    FechaAsignada_IN: item.FechaAsignada_IN ? String(item.FechaAsignada_IN) : undefined,
    User_IN: String(item.User_IN ?? ''),
  };
}

// ── RepuestosIncidentes (13.RepuestosIncidentes) ──────────────────────────
// OJO: display IDIncidente_RI → interno IDIncidente_IN, guarda el ID numérico del incidente.
// Precio_RI es una columna NUEVA: puede no existir todavía o venir vacía → se
// normaliza a number con default 0 (acepta coma decimal del formato es-AR).
export interface RepuestoIncidenteRow {
  ID: number;
  IDIncidente_RI: string;
  Repuesto_RI: string;
  Cantidad_RI: number;
  Precio_RI: number;
  FechaMes_RI: string;
}

const REPUESTO_INCIDENTE_SELECT = [
  'IDIncidente_IN',
  'Repuesto_RI',
  'Cantidad_RI',
  'Precio_RI',
  'FechaMes_RI',
  'Status_RI',
];

export function repuestoIncidenteSelectFields(): string[] {
  return REPUESTO_INCIDENTE_SELECT;
}

/** Precio como número tolerante: undefined/'' → 0, "1.234,56" (es-AR) → 1234.56, texto raro → 0. */
function parsePrecioRI(raw: unknown): number {
  if (raw == null || raw === '') return 0;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  const cleaned = String(raw).trim().replace(/\./g, '').replace(',', '.');
  const n = Number(cleaned);
  if (Number.isFinite(n)) return n;
  const plain = Number(raw);
  return Number.isFinite(plain) ? plain : 0;
}

export function mapRepuestoIncidente(item: SharePointItem): RepuestoIncidenteRow {
  return {
    ID: Number(item.id),
    IDIncidente_RI: String(item.IDIncidente_IN ?? ''),
    Repuesto_RI: String(item.Repuesto_RI ?? ''),
    Cantidad_RI: Number(item.Cantidad_RI ?? 0) || 0,
    Precio_RI: parsePrecioRI(item.Precio_RI),
    FechaMes_RI: String(item.FechaMes_RI ?? ''),
  };
}

// ── Permisos (99.ListaPermisosDesktop) — sidebar por rol ─────────────────
// Una fila por módulo, con una columna SI/NO por rol (no un único Rol_LPP).
// Filtramos en memoria (lista chica, ~10 filas) para no depender de $filter
// sobre columnas no indexadas, que Graph/SharePoint suele rechazar.
export interface PermisoModuloRow {
  ID: number;
  Modulo_LPP: string;
  Orden_LPP: number;
}

const LPP_ROLE_COLUMNS = Object.values(ROLE_TO_LPP_COLUMN).filter((c): c is string => c != null);

export function permisosSelectFields(): string[] {
  return ['Modulo_LPP', 'Orden_LPP', 'Status_LPP', ...LPP_ROLE_COLUMNS];
}

function mapPermiso(item: SharePointItem): PermisoModuloRow {
  return {
    ID: Number(item.id),
    Modulo_LPP: String(item.Modulo_LPP ?? ''),
    Orden_LPP: Number(item.Orden_LPP ?? 0) || 0,
  };
}

/** Módulos activos que el rol dado puede ver, ordenados como en el sidebar. */
export function modulosPermitidos(rows: SharePointItem[], rol: string): PermisoModuloRow[] {
  const column = ROLE_TO_LPP_COLUMN[rol];
  if (!column) return [];
  return rows
    .filter((r) => r.Status_LPP === 'Activo' && r[column] === 'SI')
    .map(mapPermiso)
    .sort((a, b) => a.Orden_LPP - b.Orden_LPP);
}

// ── 19.Ventilaciones ──────────────────────────────────────────────────────
// Tipos SharePoint: IDEdificio_VE / Frecuencia_VE / IDAsignado_VE son NUMBER;
// el resto es text. Al escribir hay que respetar eso (Number(...) vs String(...)).
export interface VentilacionRow {
  ID: number;
  Edificio_VE: string;
  IDEdificio_VE: number;
  DireccionEdificio_VE: string;
  Grupo_VE: string;
  Frecuencia_VE: string;
  Asignado_VE: string;
  IDAsignado_VE: number | null;
  Estado_VE: string;
  EsIncidente_VE: 'SI' | 'NO';
  Orden_VE: number;
  FechaUltima_VE: string;
  ProximaLimpieza_VE: string;
  FechaProgramada_VE: string;
  FechaMesAnoProxima_VE: string;
  FechaAnoProxima_VE: string;
  FechaMesAnoFinalizacion_VE: string;
  FechaFinalizacion_VE: string;
  FechaAsignado_VE: string;
  ObservacionResuelto_VE: string;
  ObservacionAdelanto_VE: string;
}

const VENTILACION_SELECT = [
  'Estado_VE', 'Edificio_VE', 'IDEdificio_VE', 'DireccionEdificio_VE', 'Grupo_VE',
  'Frecuencia_VE', 'Asignado_VE', 'IDAsignado_VE', 'EsIncidente_VE', 'Orden_VE',
  'FechaUltima_VE', 'ProximaLimpieza_VE', 'FechaProgramada_VE', 'FechaMesAnoProxima_VE',
  'FechaAnoProxima_VE', 'FechaMesAnoFinalizacion_VE', 'FechaFinalizacion_VE',
  'FechaAsignado_VE', 'ObservacionResuelto_VE', 'ObservacionAdelanto_VE',
];

export function ventilacionSelectFields(): string[] {
  return VENTILACION_SELECT;
}

export function mapVentilacion(item: SharePointItem): VentilacionRow {
  const idAsig = item.IDAsignado_VE;
  return {
    ID: Number(item.id),
    Edificio_VE: String(item.Edificio_VE ?? '').trim(),
    IDEdificio_VE: Number(item.IDEdificio_VE ?? 0) || 0,
    DireccionEdificio_VE: String(item.DireccionEdificio_VE ?? '').trim(),
    Grupo_VE: String(item.Grupo_VE ?? '').trim(),
    Frecuencia_VE: item.Frecuencia_VE != null ? String(item.Frecuencia_VE) : '',
    Asignado_VE: String(item.Asignado_VE ?? '').trim(),
    IDAsignado_VE: idAsig != null && idAsig !== '' ? Number(idAsig) : null,
    Estado_VE: String(item.Estado_VE ?? '').trim(),
    EsIncidente_VE: item.EsIncidente_VE === 'SI' ? 'SI' : 'NO',
    Orden_VE: Number(item.Orden_VE) || 99,
    FechaUltima_VE: String(item.FechaUltima_VE ?? '').trim(),
    ProximaLimpieza_VE: String(item.ProximaLimpieza_VE ?? '').trim(),
    FechaProgramada_VE: String(item.FechaProgramada_VE ?? '').trim(),
    FechaMesAnoProxima_VE: String(item.FechaMesAnoProxima_VE ?? '').trim(),
    FechaAnoProxima_VE: String(item.FechaAnoProxima_VE ?? '').trim(),
    FechaMesAnoFinalizacion_VE: String(item.FechaMesAnoFinalizacion_VE ?? '').trim(),
    FechaFinalizacion_VE: String(item.FechaFinalizacion_VE ?? '').trim(),
    FechaAsignado_VE: String(item.FechaAsignado_VE ?? '').trim(),
    ObservacionResuelto_VE: String(item.ObservacionResuelto_VE ?? '').trim(),
    ObservacionAdelanto_VE: String(item.ObservacionAdelanto_VE ?? '').trim(),
  };
}

// ── ABM.Edificios (proyección para ventilaciones) ─────────────────────────
// Nombre del edificio = columna interna `Micasa`; código = `C_x00f3_digo`;
// Frecuencia_ED es NUMBER.
export interface EdificioVentRow {
  ID: number;
  Edificio: string;
  Direccion: string;
  Codigo: string;
  Frecuencia: string;
  Grupo: string;
  EnCircuito: boolean;
}

const EDIFICIO_VENT_SELECT = [
  'Micasa', 'Direccion', 'C_x00f3_digo', 'Frecuencia_ED', 'GrupoVentilacion_ED',
  'Ventilaciones_ED', 'Status',
];

export function edificioVentSelectFields(): string[] {
  return EDIFICIO_VENT_SELECT;
}

export function mapEdificioVent(item: SharePointItem): EdificioVentRow {
  return {
    ID: Number(item.id),
    Edificio: String(item.Micasa ?? '').trim(),
    Direccion: String(item.Direccion ?? '').trim(),
    Codigo: String(item.C_x00f3_digo ?? '').trim(),
    Frecuencia: item.Frecuencia_ED != null ? String(item.Frecuencia_ED) : '',
    Grupo: String(item.GrupoVentilacion_ED ?? '').trim(),
    EnCircuito: item.Ventilaciones_ED === 'SI',
  };
}

// ── 99.ABM_Frecuencias / 99.ABM_GruposVent (catálogos) ────────────────────
/** Frecuencias activas (días), ordenadas ascendente. Frecuencia_FE es NUMBER. */
export function mapFrecuencias(rows: SharePointItem[]): string[] {
  return rows
    .filter((r) => r.Status_FE === 'Activo' && r.Frecuencia_FE != null)
    .map((r) => String(r.Frecuencia_FE))
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort((a, b) => Number(a) - Number(b));
}

/** Grupos de ventilación activos (Grupo_GVE trae espacios → trim), ordenados. */
export function mapGruposVent(rows: SharePointItem[]): string[] {
  return rows
    .filter((r) => r.Status_VE === 'Activo')
    .map((r) => String(r.Grupo_GVE ?? '').trim())
    .filter((v) => v !== '')
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || a.localeCompare(b));
}

/** Desglosa una fecha dd/mm/yyyy en {mesAno:'mm/yyyy', ano:'yyyy'} para las columnas auxiliares. */
export function desglosarFechaDDMMYYYY(ddmmyyyy: string): { mesAno: string; ano: string } {
  const parts = ddmmyyyy.trim().split('/');
  if (parts.length !== 3) return { mesAno: '', ano: '' };
  const [, mm, yyyy] = parts;
  return { mesAno: `${mm}/${yyyy}`, ano: yyyy };
}

// ══════════════════════════════════════════════════════════════════════════
// ABMs de Configuración: Rutas ⟶ Circuitos ⟶ Edificios
// Relación: 99.ABM_Rutas (NroRuta) 1─N 99.ABM_ResumenCircuito (NroCircuito)
//           1─N 99.ABM_DetalleCircuito (una fila por edificio-en-circuito).
// La pertenencia edificio↔circuito vive SOLO en DetalleCircuito (Status_DC="Activo").
// Columnas NUMBER: NroRuta_RT, CantidadCircuitos_RT, CantEdificios_RT,
// NroRuta_RC, NroCircuito_RC, CantidadEdificio_RC, NroCircuito_DC. El resto text.
// ══════════════════════════════════════════════════════════════════════════

// ── Control de acceso por rol a los ABMs (fiel a cmbox_tipo_CR + DisplayMode) ──
// La matriz vive en src/lib/abmAccessMatrix.ts (único origen de verdad, compartido
// con el front) para evitar drift entre los gates de UI y de escritura.
export function abmAccess(rol: string | undefined): { tabs: AbmTab[]; canEdit: boolean } {
  return abmAccessMatrix(rol);
}

/** ¿El rol puede EDITAR el ABM `tab`? Gate server-side de los writes. */
export function canEditAbm(rol: string | undefined, tab: AbmTab): boolean {
  const a = abmAccess(rol);
  return a.canEdit && a.tabs.includes(tab);
}

// ── 99.ABM_Rutas ──
export interface RutaRow {
  ID: number;
  NroRuta: number;
  CantidadCircuitos: number;
  CantidadEdificios: number;
  Status: string;
}
const RUTA_SELECT = ['NroRuta_RT', 'CantidadCircuitos_RT', 'CantEdificios_RT', 'Status_RT'];
export function rutaSelectFields(): string[] {
  return RUTA_SELECT;
}
export function mapRuta(item: SharePointItem): RutaRow {
  return {
    ID: Number(item.id),
    NroRuta: Number(item.NroRuta_RT ?? 0) || 0,
    CantidadCircuitos: Number(item.CantidadCircuitos_RT ?? 0) || 0,
    CantidadEdificios: Number(item.CantEdificios_RT ?? 0) || 0,
    Status: String(item.Status_RT ?? '').trim(),
  };
}

// ── 99.ABM_ResumenCircuito (un circuito dentro de una ruta) ──
export interface ResumenCircuitoRow {
  ID: number;
  NroRuta: number;
  NroCircuito: number;
  CantidadEdificios: number;
  Observaciones: string;
  Status: string;
}
const RESUMEN_CIRCUITO_SELECT = ['NroRuta_RC', 'NroCircuito_RC', 'CantidadEdificio_RC', 'DetalleCircuito_RC', 'Status_RC'];
export function resumenCircuitoSelectFields(): string[] {
  return RESUMEN_CIRCUITO_SELECT;
}
export function mapResumenCircuito(item: SharePointItem): ResumenCircuitoRow {
  return {
    ID: Number(item.id),
    NroRuta: Number(item.NroRuta_RC ?? 0) || 0,
    NroCircuito: Number(item.NroCircuito_RC ?? 0) || 0,
    CantidadEdificios: Number(item.CantidadEdificio_RC ?? 0) || 0,
    Observaciones: String(item.DetalleCircuito_RC ?? '').trim(),
    Status: String(item.Status_RC ?? '').trim(),
  };
}

// ── 99.ABM_DetalleCircuito (una fila por edificio-en-circuito) ──
export interface DetalleCircuitoRow {
  ID: number;
  NroCircuito: number;
  CodigoEdificio: string;
  Edificio: string;
  Direccion: string;
  Horario: string;
  Encargado: string;
  ConcatContacto: string;
  NroCelular: string;
  MailEdificio: string;
  Latitud: string;
  Longitud: string;
  Observaciones: string;
  Status: string;
}
const DETALLE_CIRCUITO_SELECT = [
  'NroCircuito_DC', 'CodigoEdificio_DC', 'Edificio_DC', 'Direccion_DC', 'Horario_DC',
  'Encargado_DC', 'ConcatContacto_DC', 'NroCelular_DC', 'MailEdificio_DC',
  'Latitud_DC', 'Longitud_DC', 'Observaciones_DC', 'Status_DC',
];
export function detalleCircuitoSelectFields(): string[] {
  return DETALLE_CIRCUITO_SELECT;
}
export function mapDetalleCircuito(item: SharePointItem): DetalleCircuitoRow {
  return {
    ID: Number(item.id),
    NroCircuito: Number(item.NroCircuito_DC ?? 0) || 0,
    CodigoEdificio: String(item.CodigoEdificio_DC ?? '').trim(),
    Edificio: String(item.Edificio_DC ?? '').trim(),
    Direccion: String(item.Direccion_DC ?? '').trim(),
    Horario: String(item.Horario_DC ?? '').trim(),
    Encargado: String(item.Encargado_DC ?? '').trim(),
    ConcatContacto: String(item.ConcatContacto_DC ?? '').trim(),
    NroCelular: String(item.NroCelular_DC ?? '').trim(),
    MailEdificio: String(item.MailEdificio_DC ?? '').trim(),
    Latitud: String(item.Latitud_DC ?? '').trim(),
    Longitud: String(item.Longitud_DC ?? '').trim(),
    Observaciones: String(item.Observaciones_DC ?? '').trim(),
    Status: String(item.Status_DC ?? '').trim(),
  };
}

// ── ABM.Edificios (proyección completa para el ABM y el armado de circuitos) ──
// Al agregar un edificio a un circuito, DetalleCircuito copia estos campos.
export interface EdificioAbmRow {
  ID: number;
  Edificio: string;
  Codigo: string;
  Direccion: string;
  Horario: string;
  Encargado: string;
  Celular: string;
  Correo: string;
  Latitud: string;
  Longitud: string;
  Observaciones: string;
  Grupo: string;
  Frecuencia: string;
}
const EDIFICIO_ABM_SELECT = [
  'Micasa', 'C_x00f3_digo', 'Direccion', 'HoraVisita', 'Encargado', 'Celular', 'Correo',
  'Latitud_ED', 'Longitud_ED', 'Observaciones', 'GrupoVentilacion_ED', 'Frecuencia_ED', 'Status',
];
export function edificioAbmSelectFields(): string[] {
  return EDIFICIO_ABM_SELECT;
}
export function mapEdificioAbm(item: SharePointItem): EdificioAbmRow {
  return {
    ID: Number(item.id),
    Edificio: String(item.Micasa ?? '').trim(),
    Codigo: String(item.C_x00f3_digo ?? '').trim(),
    Direccion: String(item.Direccion ?? '').trim(),
    Horario: String(item.HoraVisita ?? '').trim(),
    Encargado: String(item.Encargado ?? '').trim(),
    Celular: item.Celular != null ? String(item.Celular).trim() : '',
    Correo: String(item.Correo ?? '').trim(),
    Latitud: String(item.Latitud_ED ?? '').trim(),
    Longitud: String(item.Longitud_ED ?? '').trim(),
    Observaciones: String(item.Observaciones ?? '').trim(),
    Grupo: String(item.GrupoVentilacion_ED ?? '').trim(),
    Frecuencia: item.Frecuencia_ED != null ? String(item.Frecuencia_ED) : '',
  };
}

// ── ABM.Roles (catálogo de roles para el ABM de Personas/Usuarios) ──
export function mapRolesActivos(rows: SharePointItem[]): string[] {
  return rows
    .filter((r) => String(r.Estado ?? '').toLowerCase() === 'alta')
    .map((r) => String(r.Rol ?? '').trim())
    .filter((v) => v !== '')
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort((a, b) => a.localeCompare(b, 'es'));
}

// ══════════════════════════════════════════════════════════════════════════
// Planificaciones: 17.MesesPlanificacion → 15.ResumenPlanificaciones (ruta×técnico)
//   → 16.DetallePlanificaciones (circuito) → 18.EdificiosVisitar (edificio a visitar).
// Se genera desde el catálogo real de circuitos (ABM.ResumenCircuito + DetalleCircuito).
// Números reales: Circuitos_RP, NroRuta_DP, CantidadEdificios_DP, NroCircuito_DP,
// Circuito_DP. El resto text. Estado_EV: Pendiente/Visitado.
// ══════════════════════════════════════════════════════════════════════════

// ── 17.MesesPlanificacion ──
export interface MesPlanifRow {
  ID: number;
  Mes: string;
  MesAno: string;
  RutasTotales: number;
  TecnicosTotales: number;
  Status: string;
}
const MES_PLANIF_SELECT = ['MesPlanificado', 'RutasTotales_MP', 'TecnicosTotales_MP', 'MesAnoPlanificado_MP', 'Status_MP'];
export function mesPlanifSelectFields() { return MES_PLANIF_SELECT; }
export function mapMesPlanif(item: SharePointItem): MesPlanifRow {
  return {
    ID: Number(item.id),
    Mes: String(item.MesPlanificado ?? '').trim(),
    MesAno: String(item.MesAnoPlanificado_MP ?? '').trim(),
    RutasTotales: Number(item.RutasTotales_MP ?? 0) || 0,
    TecnicosTotales: Number(item.TecnicosTotales_MP ?? 0) || 0,
    Status: String(item.Status_MP ?? '').trim(),
  };
}

// ── 15.ResumenPlanificaciones (una ruta asignada a un técnico en un mes) ──
export interface ResumenPlanifRow {
  ID: number;
  Mes: string;
  MesAno: string;
  NroRuta: string;
  Tecnico: string;
  Circuitos: number;
  IDUnivocoRuta: string;
  Status: string;
  Fecha: string;
  Hora: string;
}
const RESUMEN_PLANIF_SELECT = ['Mes_RP', 'MesAnoRuta_RP', 'NroRuta_RP', 'Tecnico_RP', 'Circuitos_RP', 'IDUnivocoRuta_RP', 'Status_RP', 'Fecha_RP', 'Hora_RP'];
export function resumenPlanifSelectFields() { return RESUMEN_PLANIF_SELECT; }
export function mapResumenPlanif(item: SharePointItem): ResumenPlanifRow {
  return {
    ID: Number(item.id),
    Mes: String(item.Mes_RP ?? '').trim(),
    MesAno: String(item.MesAnoRuta_RP ?? '').trim(),
    NroRuta: String(item.NroRuta_RP ?? '').trim(),
    Tecnico: String(item.Tecnico_RP ?? '').trim(),
    Circuitos: Number(item.Circuitos_RP ?? 0) || 0,
    IDUnivocoRuta: String(item.IDUnivocoRuta_RP ?? '').trim(),
    Status: String(item.Status_RP ?? '').trim(),
    Fecha: String(item.Fecha_RP ?? '').trim(),
    Hora: String(item.Hora_RP ?? '').trim(),
  };
}

// ── 16.DetallePlanificaciones (un circuito dentro de una ruta planificada) ──
export interface DetallePlanifRow {
  ID: number;
  IDUnivocoRuta: string;
  IDUnivocoCircuito: string;
  NroRuta: number;
  NroCircuito: number;
  CantidadEdificios: number;
  Tecnico: string;
  MesAno: string;
  Mes: string;
  Observaciones: string;
  Status: string;
}
const DETALLE_PLANIF_SELECT = ['IDUnivoco_DP', 'IDUnivocoCircuito_DP', 'NroRuta_DP', 'NroCircuito_DP', 'CantidadEdificios_DP', 'Tecnico_DP', 'MesAno_DP', 'Mes_DP', 'ObservacionCircuito_DP', 'Status_DP'];
export function detallePlanifSelectFields() { return DETALLE_PLANIF_SELECT; }
export function mapDetallePlanif(item: SharePointItem): DetallePlanifRow {
  return {
    ID: Number(item.id),
    IDUnivocoRuta: String(item.IDUnivoco_DP ?? '').trim(),
    IDUnivocoCircuito: String(item.IDUnivocoCircuito_DP ?? '').trim(),
    NroRuta: Number(item.NroRuta_DP ?? 0) || 0,
    NroCircuito: Number(item.NroCircuito_DP ?? 0) || 0,
    CantidadEdificios: Number(item.CantidadEdificios_DP ?? 0) || 0,
    Tecnico: String(item.Tecnico_DP ?? '').trim(),
    MesAno: String(item.MesAno_DP ?? '').trim(),
    Mes: String(item.Mes_DP ?? '').trim(),
    Observaciones: String(item.ObservacionCircuito_DP ?? '').trim(),
    Status: String(item.Status_DP ?? '').trim(),
  };
}

// ── 18.EdificiosVisitar (un edificio a visitar en un circuito planificado) ──
export interface EdificioVisitarRow {
  ID: number;
  Edificio: string;
  Codigo: string;
  Direccion: string;
  Tecnico: string;
  Estado: string;
  NroCircuito: string;
  NroRuta: string;
  MesAno: string;
  IDUnivocoCircuito: string;
  IDUnivocoRuta: string;
  Encargado: string;
  Celular: string;
  Mail: string;
  HoraSugerida: string;
  Observacion: string;
}
const EDIFICIO_VISITAR_SELECT = ['Edificio_EV', 'CodigoEdificio_EV', 'Direccion_EV', 'TecnicoAsignado_EV', 'Estado_EV', 'NroCircuito_EV', 'NroRuta_EV', 'MesAno_EV', 'IDUnivocoCircuito_EV', 'IDUnivocoRuta_EV', 'Encargado_EV', 'Celular_EV', 'Mail_EV', 'HoraSugerida_EV', 'ObservacionEdificio_EV'];
export function edificioVisitarSelectFields() { return EDIFICIO_VISITAR_SELECT; }
export function mapEdificioVisitar(item: SharePointItem): EdificioVisitarRow {
  return {
    ID: Number(item.id),
    Edificio: String(item.Edificio_EV ?? '').trim(),
    Codigo: String(item.CodigoEdificio_EV ?? '').trim(),
    Direccion: String(item.Direccion_EV ?? '').trim(),
    Tecnico: String(item.TecnicoAsignado_EV ?? '').trim(),
    Estado: String(item.Estado_EV ?? '').trim(),
    NroCircuito: String(item.NroCircuito_EV ?? '').trim(),
    NroRuta: String(item.NroRuta_EV ?? '').trim(),
    MesAno: String(item.MesAno_EV ?? '').trim(),
    IDUnivocoCircuito: String(item.IDUnivocoCircuito_EV ?? '').trim(),
    IDUnivocoRuta: String(item.IDUnivocoRuta_EV ?? '').trim(),
    Encargado: String(item.Encargado_EV ?? '').trim(),
    Celular: String(item.Celular_EV ?? '').trim(),
    Mail: String(item.Mail_EV ?? '').trim(),
    HoraSugerida: String(item.HoraSugerida_EV ?? '').trim(),
    Observacion: String(item.ObservacionEdificio_EV ?? '').trim(),
  };
}
