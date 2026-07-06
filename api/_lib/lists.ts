import type { SharePointItem } from './graph';

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
  };
}

export function registrosSelectFields(): string[] {
  return REGISTROS_SELECT;
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
  Status_IN: string;
  Resuelto_IN: string;
}

const HISTORIAL_SELECT = [
  'Fecha_IN',
  'Categoria_IN',
  'NoResuelto_IN',
  'Descripcion_IN',
  'DescripcionResuelto_IN',
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
export interface RepuestoIncidenteRow {
  ID: number;
  IDIncidente_RI: string;
  Repuesto_RI: string;
  Cantidad_RI: number;
}

const REPUESTO_INCIDENTE_SELECT = ['IDIncidente_IN', 'Repuesto_RI', 'Cantidad_RI', 'Status_RI'];

export function repuestoIncidenteSelectFields(): string[] {
  return REPUESTO_INCIDENTE_SELECT;
}

export function mapRepuestoIncidente(item: SharePointItem): RepuestoIncidenteRow {
  return {
    ID: Number(item.id),
    IDIncidente_RI: String(item.IDIncidente_IN ?? ''),
    Repuesto_RI: String(item.Repuesto_RI ?? ''),
    Cantidad_RI: Number(item.Cantidad_RI ?? 0) || 0,
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
