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
export interface PedidoCompra {
  ID: number;
  IDUnivoco_PC: string;
  Fecha_PC: string;
  FechaMesAno_PC: string;
  Segmento_PC: TipoStock;
  Cantidad_PC: number;
  Status_PC: 'Pendiente' | 'En Aprobacion' | 'Aprobada' | 'Recibida' | 'Rechazada';
  Filtrar_PC: 'SI' | 'NO';
  Observaciones_PC?: string;
  Rechazada_PC?: 'SI' | 'NO';
  User_PC: string;
  IDIncidenteCompra_PC?: string;
}

// 06.DetalleCompra
export interface DetalleCompra {
  ID: number;
  IDCompra_DC: string;
  Item_DC: string;
  Cantidad_DC: number;
  CantidadIngresada_DC?: number;
  FechaMesAno_DC: string;
  Fecha_DC: string;
  Segmento_DC: TipoStock;
  Status_DC: 'Pendiente' | 'Aprobada' | 'Rechazada' | 'Recibida';
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
export interface DetalleMaquina {
  ID: number;
  IDMaquina_DM: string;
  Marca_DM: string;
  Modelo_DM: string;
  NroSerie_DM: string;
  ConcatMaquina_DM: string;
  ConcatMaquinaIncidente_DM: string;
  Segmento_DM: TipoStock;
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
export interface Incidente {
  ID: number;
  IDIncidente: string;
  Fecha_IN: string;
  FechaMes_IN: string;
  FechaMesAno_IN: string;
  Titulo_IN: string;
  NoResuelto_IN:
    | 'Requiere Repuesto'
    | 'Cambio Maquina'
    | 'Reportado Por Tecnico'
    | 'Baja de Maquina'
    | 'Transferencia';
  Status_IN: 'A Revisar' | 'Asignado' | 'En Aprobacion' | 'Resuelto' | 'Anulado';
  Resuelto_IN: 'SI' | 'NO';
  NombreEdificio_IN: string;
  IDMaquina_IN?: string;
  ConcatMaquina_IN?: string;
  TecnicoAsignado_IN?: string;
  CantidadRepuestos_IN: number;
  DescripcionCarga_IN?: string;
  DescripcionIncidente_IN?: string;
  DescripcionResuelto_IN?: string;
  DescripcionAnulado_IN?: string;
  FechaResuelto_IN?: string;
  User_IN: string;
}

// 11.Repuestos
export interface Repuesto {
  ID: number;
  Nombre_RP: string;
  Codigo_RP: string;
  Marca_RP?: string;
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
}

// 19.Ventilaciones
export interface Ventilacion {
  ID: number;
  Edificio_VE: string;
  Grupo_VE: string;
  Frecuencia_VE: string;
  Asignado_VE?: string;
  Estado_VE: 'Pendiente' | 'Asignada' | 'Programada' | 'Realizada';
  EsIncidente_VE?: 'SI' | 'NO';
  Orden_VE?: number;
  FechaUltima_VE?: string;
  ProximaLimpieza_VE: string;
  FechaProgramada_VE?: string;
  FechaMesAnoProxima_VE: string;
  FechaMesAnoFinalizacion_VE?: string;
  ObservacionResuelto_VE?: string;
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

// Catálogo de items que se pueden agregar al stock
export interface StockCatalogItem {
  ID: number;
  Tipo: TipoStock;
  Item: string;
  Marca?: string;
  Codigo?: string;
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
