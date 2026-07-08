/**
 * Types reflecting the SharePoint lists that back the original PowerApp.
 * All field names preserved verbatim (with PowerApp suffix conventions like _PC, _DM)
 * so the React UI matches the YAML formulas one-to-one.
 */

export type UserRole =
  | 'Admin'
  | 'Supervisor Lider'
  | 'Supervisor'
  | 'Atencion Al Cliente'
  | 'Jefe Taller'
  | 'Supervisor Mantenimiento'
  | 'Supervisor Ventilaciones'
  | 'Tecnico';

// Usuarios
export interface Usuario {
  ID: number;
  Usuario: string;
  Contrasena: string;
  Nombre: string;
  Apellido: string;
  Concat_Nombre_Apellido: string;
  Rol: UserRole;
  Status: 'ALTA' | 'BAJA';
  Telefono?: string;
  Email?: string;
}

// 99.ListaPermisosDesktop — drives sidebar
export interface PermisoModulo {
  ID: number;
  Modulo_LPP: ModuloNombre;
  Orden_LPP: number;
  ImgON_LPP: string;
  ImgOFF_LPP: string;
  Rol_LPP: UserRole;
}

export type ModuloNombre =
  | 'Home'
  | 'Stock'
  | 'Compras'
  | 'Mis Aprobaciones'
  | 'Detalle Maquinas'
  | 'Incidentes'
  | 'Stock Tecnico'
  | 'Planificaciones'
  | 'Ventilacion'
  | 'Dashboard'
  | 'Repuestos'
  | 'Configuracion';

// ABM.Edificios
export interface Edificio {
  ID: number;
  Edificio: string;
  Codigo: string;
  Direccion?: string;
  Status: 'ALTA' | 'BAJA';
  GrupoVentilacion_ED?: string;
  FrecuenciaVent_ED?: string;
}

// 01.Registros — daily activity log shown in Home cards
export interface Registro {
  ID: number;
  Edificio: string;
  NroRuta_R: string;
  NroCircuito_R: string;
  Estado: 'Pendiente' | 'Finalizado';
  Usuario: string;
  MesAño: string;
  HoraInicio?: string;
  HoraFinal?: string;
  /** Progreso de la visita 0–100. 100 = completa, <100 = parcial. */
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

// 04.Stock
export interface StockItem {
  ID: number;
  Item_ST: string;
  Tipo_ST: TipoStock;
  Marca_ST?: string;
  Nro_ST?: string;
  Cantidad_ST: number;
  Status_ST: 'Activo' | 'Inactivo';
  IDMaquina_ST?: string;
  NroSerie_ST?: string;
}

export type TipoStock =
  | 'LAVADORA'
  | 'SECADORA SIMPLE'
  | 'SECADORA DOBLE'
  | 'CARGADORA'
  | 'EXPENDEDORA'
  | 'ENCENDEDORA'
  | 'REPUESTO';

// 99.ABMRepuestos_Tecnico
export interface RepuestoTecnico {
  ID: number;
  Tecnico_RT: string;
  Concat_RT: string;
  Codigo_RT: string;
  Cantidad_RT: number;
  Status_RT: 'Activo' | 'Inactivo';
}

// 05.PedidoCompras
// Segmento_PC es un string real del catálogo (Title Case, ej. "Lavadora", "Repuesto"),
// no el enum TipoStock uppercase — los valores vienen de 99.ABM_ItemCompras.
export interface PedidoCompra {
  ID: number;
  IDUnivoco_PC: string;
  Fecha_PC: string;
  FechaMesAno_PC: string;
  Segmento_PC: string;
  Cantidad_PC: number;
  Status_PC: 'Pendiente' | 'En Aprobacion' | 'Aprobada' | 'Recibida' | 'Rechazada' | 'Anulado';
  Filtrar_PC: 'SI' | 'NO';
  Observaciones_PC?: string;
  Rechazada_PC?: 'SI' | 'NO';
  User_PC: string;
  IDIncidenteCompra_PC?: string;
}

// 06.DetalleCompra
// OJO: 06.DetalleCompra NO tiene columna Codigo_DC en SharePoint — `Codigo_DC` es
// solo de UI (se deriva del catálogo), no se persiste.
export interface DetalleCompra {
  ID: number;
  IDCompra_DC: string;
  Item_DC: string;
  Cantidad_DC: number;
  CantidadIngresada_DC?: number;
  FechaMesAno_DC: string;
  Fecha_DC: string;
  Segmento_DC: string;
  Status_DC: 'Pendiente' | 'Aprobada' | 'Rechazada' | 'Recibida' | 'Anulado';
  Rechazada_DC?: 'SI' | 'NO';
  Codigo_DC?: string;
  Marca_DC?: string;
}

// 07.Aprobaciones
export interface Aprobacion {
  ID: number;
  TipoAprobacion_AP:
    | 'Compra'
    | 'Cambio de Maquina'
    | 'Transferencia de Maquina';
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

// 08.DetalleMaquina
// Segmento_DM es un string real (Title Case: "Lavadora", "Secadora Simple"…),
// columna interna `Segmentp_DM` (typo en SharePoint) — no el enum TipoStock.
export interface DetalleMaquina {
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

// 09.HistorialMaquina (legacy lookup; matches DetalleMaquina filter on 10.Incidentes)
export interface HistorialMaquina {
  ID: number;
  IDMaquina_HM: string;
  Fecha_HM: string;
  Detalle_HM: string;
}

// 10.Incidentes
// OJO: la lista real NO tiene Titulo_IN (se deriva de Categoria_IN/NoResuelto_IN) ni una
// columna IDIncidente propia (la clave es el ID numérico; `IDIncidente` = String(ID)).
// NoResuelto_IN/Status_IN son strings reales amplios (incluyen 'Atencion al Cliente',
// 'Cambio de Maquina', 'Aprobada', …).
export interface Incidente {
  ID: number;
  IDIncidente: string;
  Fecha_IN: string;
  FechaMes_IN?: string;
  FechaMesAno_IN: string;
  Titulo_IN: string;
  NoResuelto_IN: string;
  Categoria_IN?: string;
  Status_IN: string;
  Resuelto_IN: 'SI' | 'NO';
  NombreEdificio_IN: string;
  CodigoEdifcio_IN?: string;
  IDMaquina_IN?: string;
  ConcatMaquina_IN?: string;
  MaquinaAsignada_IN?: string;
  TecnicoAsignado_IN?: string;
  CantidadRepuestos_IN: number;
  DescripcionCarga_IN?: string;
  DescripcionIncidente_IN?: string;
  DescripcionResuelto_IN?: string;
  DescripcionAnulado_IN?: string;
  FechaResuelto_IN?: string;
  FechaAsignada_IN?: string;
  User_IN: string;
}

// 11.Repuestos — catálogo de repuestos con precio (ABM).
// `Precio_RP` es una columna NUEVA (número, 2 decimales) que el usuario debe crear
// a mano en SharePoint; hasta que exista, el backend la devuelve como 0.
export interface Repuesto {
  ID: number;
  Nombre_RP: string;
  Codigo_RP: string;
  Stock_RP: number;
  Status_RP: string;
  ConcatRepuesto_RP: string;
  Precio_RP: number;
}

// 12.FotoIncidentes
export interface FotoIncidente {
  ID: number;
  IDIncidente_FI: string;
  Foto_FI: string;
}

// 13.RepuestosIncidentes
export interface RepuestoIncidente {
  ID: number;
  IDIncidente_RI: string;
  Repuesto_RI: string;
  Cantidad_RI: number;
}

// 15.ResumenPlanificaciones
export interface ResumenPlanificacion {
  ID: number;
  MesAnoPlanificado_RP: string;
  Tecnico_RP: string;
  NroRuta_RP: string;
  IDUnivocoRuta_RP: string;
  Status_RP: 'Pendiente' | 'En Proceso' | 'Cerrada' | 'Anulado';
  Cantidad_RP?: number;
}

// 16.DetallePlanificaciones
export interface DetallePlanificacion {
  ID: number;
  IDUnivoco_DP: string;
  IDUnivocoCircuito_DP: string;
  Tecnico_DP: string;
  NroCircuito_DP: string;
  MesAno_DP: string;
  Status_DP: 'Pendiente' | 'En Proceso' | 'Cerrada';
}

// 17.MesesPlanificacion
export interface MesPlanificacion {
  ID: number;
  MesAnoPlanificado_MP: string;
  MesPlanificado_MP: string;
  RutasTotales_MP: number;
  TecnicosTotales_MP: number;
  Status_MP: 'Activo' | 'Inactivo';
}

// 18.EdificiosVisitar
export interface EdificioVisitar {
  ID: number;
  IDUnivocoCircuito_EV: string;
  NombreEdificio_EV: string;
  Direccion_EV: string;
  NroCircuito_EV: string;
  TecnicoAsignado_EV: string;
  MesAno_EV: string;
  Status_EV: 'Pendiente' | 'Visitado';
  /** Building code like "C-2263". */
  Codigo_EV?: string;
}

// 19.Ventilaciones
// OJO tipos SharePoint: IDEdificio_VE, Frecuencia_VE e IDAsignado_VE son columnas
// NUMBER (no text). El resto es text. Frecuencia_VE se expone como string para la UI.
export interface Ventilacion {
  ID: number;
  Edificio_VE: string;
  IDEdificio_VE: number;
  DireccionEdificio_VE?: string;
  Grupo_VE: string;
  Frecuencia_VE: string; // días (columna NUMBER; string para la UI)
  Asignado_VE?: string;
  IDAsignado_VE?: number;
  Estado_VE: 'Pendiente' | 'Asignada' | 'Programada' | 'Realizada' | 'Eliminada';
  /** "SI" ⇒ la fecha fue adelantada por un técnico (warning en la galería). */
  EsIncidente_VE?: 'SI' | 'NO';
  Orden_VE?: number;
  FechaUltima_VE?: string;
  ProximaLimpieza_VE: string;
  FechaProgramada_VE?: string;
  FechaMesAnoProxima_VE: string;
  FechaAnoProxima_VE?: string;
  FechaMesAnoFinalizacion_VE?: string;
  FechaFinalizacion_VE?: string;
  FechaAsignado_VE?: string;
  ObservacionResuelto_VE?: string;
  ObservacionAdelanto_VE?: string;
}

/** Proyección de ABM.Edificios para el módulo de ventilaciones (alta + circuito). */
export interface EdificioVent {
  ID: number;
  Edificio: string;
  Direccion: string;
  Codigo: string;
  Frecuencia: string; // Frecuencia_ED (NUMBER en SharePoint)
  Grupo: string; // GrupoVentilacion_ED
  EnCircuito: boolean; // Ventilaciones_ED === "SI"
}

// 99.ABM_ItemCompras
export interface ItemCompra {
  ID: number;
  Item_IC: string;
  Tipo_IC: TipoStock;
  Status_IC: 'Activo' | 'Inactivo';
}

// 99.ABM_Rutas
export interface RutaCatalogo {
  ID: number;
  NroRuta_RT: string;
  Status_RT: 'Activo' | 'Inactivo';
}

// 99.ABM_ResumenCircuito
export interface ResumenCircuito {
  ID: number;
  NroRuta_RC: string;
  NroCircuito_RC: string;
  Status_RC: 'Activo' | 'Inactivo';
}

// 99.ABM_DetalleCircuito
export interface DetalleCircuito {
  ID: number;
  NroCircuito_DC: string;
  NombreEdificio_DC: string;
  Direccion_DC?: string;
  Status_DC: 'Activo' | 'Inactivo';
}

// ── ABMs reales (Configuración): forma que devuelve /api/abm ──────────────
// NroRuta/NroCircuito/contadores/Frecuencia son numéricos en SharePoint.
export interface RutaAbm {
  ID: number;
  NroRuta: number;
  CantidadCircuitos: number;
  CantidadEdificios: number;
  Status: string;
}

export interface CircuitoAbm {
  ID: number;
  NroRuta: number;
  NroCircuito: number;
  CantidadEdificios: number;
  Observaciones: string;
  Status: string;
}

/** Una fila de DetalleCircuito = un edificio dentro de un circuito. */
export interface DetalleCircuitoAbm {
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

// ── Planificaciones (17.Meses → 15.Resumen → 16.Detalle → 18.EdificiosVisitar) ──
export interface PlanifMes {
  ID: number;
  Mes: string;
  MesAno: string;
  RutasTotales: number;
  TecnicosTotales: number;
  Status: string;
}
/** Una ruta asignada a un técnico en un mes. */
export interface PlanifRuta {
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
/** Un circuito dentro de una ruta planificada. */
export interface PlanifCircuito {
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
/** Un edificio a visitar en un circuito planificado (18.EdificiosVisitar). */
export interface PlanifEdificio {
  ID: number;
  Edificio: string;
  Codigo: string;
  Direccion: string;
  Tecnico: string;
  Estado: string; // Pendiente | Visitado
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

/** Edificio del master (ABM.Edificios) con contacto/geo + grupo/frecuencia de ventilación. */
export interface EdificioAbm {
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

// 99.ABM_Frecuencias
export interface Frecuencia {
  ID: number;
  Frecuencia_FE: string;
  Status_FE: 'Activo' | 'Inactivo';
}

// 99.ABM_GruposVent
export interface GrupoVentilacion {
  ID: number;
  Grupo_GV: string;
  Status_VE: 'Activo' | 'Inactivo';
}

// 99.ABM_Encendedores
export interface Encendedor {
  ID: number;
  Tipo_EN: string;
  Status_EN: 'Activo' | 'Inactivo';
}

// Catálogo de items que se pueden agregar al stock / a una compra.
// Tipo = segmento real del catálogo (string Title Case), no el enum uppercase.
export interface StockCatalogItem {
  ID: number;
  Tipo: string;
  Item: string;
  Marca?: string;
  Codigo?: string;
  Modelo?: string;
}

// 99.ABM_MaquinasCompra
export interface MaquinaCompra {
  ID: number;
  Maquina_MC: string;
  Marca_MC: string;
  Modelo_MC: string;
  Segmento_MC: TipoStock;
  Status_MC: 'Activo' | 'Inactivo';
}

// 99.ABM_Emails
export interface EmailContacto {
  ID: number;
  Email_AE: string;
  Rol_AE: string;
  Status_AE: 'Activo' | 'Inactivo';
}
