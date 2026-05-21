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

const currentMonth = () => {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

const today = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

export const mockUsuarios: Usuario[] = [
  {
    ID: 1,
    Usuario: 'admin',
    Contrasena: 'admin',
    Nombre: 'Nicolás',
    Apellido: 'Acosta',
    Concat_Nombre_Apellido: 'Nicolás Acosta',
    Rol: 'Admin',
    Status: 'ALTA',
    Telefono: '+5491166554433',
    Email: 'admin@sumardigital.com.ar',
  },
  {
    ID: 2,
    Usuario: 'jtaller',
    Contrasena: 'jtaller',
    Nombre: 'Carlos',
    Apellido: 'Pérez',
    Concat_Nombre_Apellido: 'Carlos Pérez',
    Rol: 'Jefe Taller',
    Status: 'ALTA',
    Telefono: '+5491133221122',
  },
  {
    ID: 3,
    Usuario: 'supervisor',
    Contrasena: 'super',
    Nombre: 'María',
    Apellido: 'Gómez',
    Concat_Nombre_Apellido: 'María Gómez',
    Rol: 'Supervisor',
    Status: 'ALTA',
  },
  {
    ID: 4,
    Usuario: 'mfernandez',
    Contrasena: 'tecnico',
    Nombre: 'Mauro',
    Apellido: 'Fernández',
    Concat_Nombre_Apellido: 'Mauro Fernández',
    Rol: 'Tecnico',
    Status: 'ALTA',
    Telefono: '+5491145678901',
  },
  {
    ID: 5,
    Usuario: 'jruiz',
    Contrasena: 'tecnico',
    Nombre: 'Julián',
    Apellido: 'Ruiz',
    Concat_Nombre_Apellido: 'Julián Ruiz',
    Rol: 'Tecnico',
    Status: 'ALTA',
    Telefono: '+5491198765432',
  },
  {
    ID: 6,
    Usuario: 'lleyes',
    Contrasena: 'tecnico',
    Nombre: 'Leandro',
    Apellido: 'Leyes',
    Concat_Nombre_Apellido: 'Leandro Leyes',
    Rol: 'Tecnico',
    Status: 'ALTA',
    Telefono: '+5491112345678',
  },
];

export const mockPermisos: PermisoModulo[] = (
  [
    ['Home', 1],
    ['Stock', 2],
    ['Compras', 3],
    ['Mis Aprobaciones', 4],
    ['Detalle Maquinas', 5],
    ['Incidentes', 6],
    ['Stock Tecnico', 7],
    ['Planificaciones', 8],
    ['Ventilacion', 9],
    ['Configuracion', 10],
  ] as const
).map(([modulo, orden], idx) => ({
  ID: idx + 1,
  Modulo_LPP: modulo,
  Orden_LPP: orden,
  ImgON_LPP: `/icons/${modulo.toLowerCase().replace(/\s+/g, '-')}-on.svg`,
  ImgOFF_LPP: `/icons/${modulo.toLowerCase().replace(/\s+/g, '-')}-off.svg`,
  Rol_LPP: 'Admin',
}));

export const mockEdificios: Edificio[] = [
  { ID: 1, Edificio: 'Torre Madero I', Codigo: 'TM1', Direccion: 'Av. Madero 1280', Status: 'ALTA', GrupoVentilacion_ED: 'Norte', FrecuenciaVent_ED: 'Mensual' },
  { ID: 2, Edificio: 'Torre Madero II', Codigo: 'TM2', Direccion: 'Av. Madero 1320', Status: 'ALTA', GrupoVentilacion_ED: 'Norte', FrecuenciaVent_ED: 'Mensual' },
  { ID: 3, Edificio: 'Edificio Palermo Soho', Codigo: 'PSH', Direccion: 'Honduras 4500', Status: 'ALTA', GrupoVentilacion_ED: 'Centro', FrecuenciaVent_ED: 'Bimestral' },
  { ID: 4, Edificio: 'Belgrano R', Codigo: 'BGR', Direccion: 'Av. Cabildo 2800', Status: 'ALTA', GrupoVentilacion_ED: 'Norte', FrecuenciaVent_ED: 'Trimestral' },
  { ID: 5, Edificio: 'Recoleta Premium', Codigo: 'RCP', Direccion: 'Posadas 1500', Status: 'ALTA', GrupoVentilacion_ED: 'Centro', FrecuenciaVent_ED: 'Mensual' },
  { ID: 6, Edificio: 'Wash Inn (Depósito)', Codigo: 'WI', Direccion: 'Olivos 1010', Status: 'ALTA' },
];

export const mockRegistros: Registro[] = [
  { ID: 1, Edificio: 'Torre Madero I', NroRuta_R: '1', NroCircuito_R: '1A', Estado: 'Finalizado', Usuario: 'mfernandez', MesAño: currentMonth(), HoraInicio: '09:30', HoraFinal: '11:45', Progreso: 100 },
  { ID: 2, Edificio: 'Palermo Soho', NroRuta_R: '2', NroCircuito_R: '2C', Estado: 'Pendiente', Usuario: 'jruiz', MesAño: currentMonth(), HoraInicio: '14:00', Progreso: 45 },
  { ID: 3, Edificio: 'Belgrano R', NroRuta_R: '1', NroCircuito_R: '1B', Estado: 'Finalizado', Usuario: 'lleyes', MesAño: currentMonth(), HoraInicio: '08:00', HoraFinal: '10:20', Progreso: 87 },
  { ID: 4, Edificio: 'Recoleta Premium', NroRuta_R: '3', NroCircuito_R: '3A', Estado: 'Pendiente', Usuario: 'mfernandez', MesAño: currentMonth(), Progreso: 0 },
  { ID: 5, Edificio: 'Torre Madero II', NroRuta_R: '1', NroCircuito_R: '1A', Estado: 'Finalizado', Usuario: 'jruiz', MesAño: currentMonth(), HoraInicio: '12:00', HoraFinal: '13:50', Progreso: 100 },
  { ID: 6, Edificio: 'Regatas De Olivos', NroRuta_R: '3', NroCircuito_R: '9', Estado: 'Pendiente', Usuario: 'acorimayo', MesAño: currentMonth(), HoraInicio: '11:02', Progreso: 30 },
  { ID: 7, Edificio: 'Antares', NroRuta_R: '11', NroCircuito_R: '103', Estado: 'Finalizado', Usuario: 'mburgueno', MesAño: currentMonth(), HoraInicio: '10:53', HoraFinal: '11:13', Progreso: 75 },
];

export const mockStock: StockItem[] = [
  { ID: 1, Item_ST: 'Lavadora LG 15kg', Tipo_ST: 'LAVADORA', Marca_ST: 'LG', Cantidad_ST: 4, Status_ST: 'Activo' },
  { ID: 2, Item_ST: 'Secadora Simple Whirlpool', Tipo_ST: 'SECADORA SIMPLE', Marca_ST: 'Whirlpool', Cantidad_ST: 3, Status_ST: 'Activo' },
  { ID: 3, Item_ST: 'Secadora Doble Industrial', Tipo_ST: 'SECADORA DOBLE', Marca_ST: 'Speed Queen', Cantidad_ST: 2, Status_ST: 'Activo' },
  { ID: 4, Item_ST: 'Cargadora Monedas', Tipo_ST: 'CARGADORA', Marca_ST: 'CoinMatic', Cantidad_ST: 5, Status_ST: 'Activo' },
  { ID: 5, Item_ST: 'Expendedora Token', Tipo_ST: 'EXPENDEDORA', Marca_ST: 'TokenPro', Cantidad_ST: 2, Status_ST: 'Activo' },
  { ID: 6, Item_ST: 'Encendedora Billetes', Tipo_ST: 'ENCENDEDORA', Marca_ST: 'BillStart', Cantidad_ST: 3, Status_ST: 'Activo' },
  { ID: 7, Item_ST: 'Motor Tambor 220V', Tipo_ST: 'REPUESTO', Marca_ST: 'OEM', Cantidad_ST: 12, Status_ST: 'Activo', Nro_ST: 'MT-220' },
  { ID: 8, Item_ST: 'Correa Distribución', Tipo_ST: 'REPUESTO', Marca_ST: 'Gates', Cantidad_ST: 24, Status_ST: 'Activo', Nro_ST: 'CD-001' },
  { ID: 9, Item_ST: 'Bomba de Agua', Tipo_ST: 'REPUESTO', Marca_ST: 'Bosch', Cantidad_ST: 8, Status_ST: 'Activo', Nro_ST: 'BA-110' },
  { ID: 10, Item_ST: 'Resistencia Calefactora', Tipo_ST: 'REPUESTO', Marca_ST: 'Heatx', Cantidad_ST: 6, Status_ST: 'Activo', Nro_ST: 'RC-2000' },
];

export const mockStockTecnicos: RepuestoTecnico[] = [
  { ID: 1, Tecnico_RT: 'Mauro Fernández', Concat_RT: 'Motor Tambor 220V — OEM', Codigo_RT: 'MT-220', Cantidad_RT: 2, Status_RT: 'Activo' },
  { ID: 2, Tecnico_RT: 'Mauro Fernández', Concat_RT: 'Correa Distribución — Gates', Codigo_RT: 'CD-001', Cantidad_RT: 4, Status_RT: 'Activo' },
  { ID: 3, Tecnico_RT: 'Julián Ruiz', Concat_RT: 'Bomba de Agua — Bosch', Codigo_RT: 'BA-110', Cantidad_RT: 1, Status_RT: 'Activo' },
  { ID: 4, Tecnico_RT: 'Leandro Leyes', Concat_RT: 'Resistencia Calefactora — Heatx', Codigo_RT: 'RC-2000', Cantidad_RT: 3, Status_RT: 'Activo' },
];

export const mockPedidos: PedidoCompra[] = [
  { ID: 1001, IDUnivoco_PC: 'adm - 20260520-1430', Fecha_PC: today(), FechaMesAno_PC: currentMonth(), Segmento_PC: 'REPUESTO', Cantidad_PC: 12, Status_PC: 'Pendiente', Filtrar_PC: 'NO', Observaciones_PC: 'Urgente cambio de correas en Torre Madero', User_PC: 'admin' },
  { ID: 1002, IDUnivoco_PC: 'adm - 20260518-1100', Fecha_PC: today(), FechaMesAno_PC: currentMonth(), Segmento_PC: 'LAVADORA', Cantidad_PC: 2, Status_PC: 'Aprobada', Filtrar_PC: 'NO', User_PC: 'admin' },
  { ID: 1003, IDUnivoco_PC: 'jta - 20260515-0930', Fecha_PC: today(), FechaMesAno_PC: currentMonth(), Segmento_PC: 'SECADORA SIMPLE', Cantidad_PC: 1, Status_PC: 'En Aprobacion', Filtrar_PC: 'NO', User_PC: 'jtaller' },
  { ID: 1004, IDUnivoco_PC: 'jta - 20260510-1700', Fecha_PC: today(), FechaMesAno_PC: currentMonth(), Segmento_PC: 'REPUESTO', Cantidad_PC: 6, Status_PC: 'Recibida', Filtrar_PC: 'NO', User_PC: 'jtaller' },
];

export const mockDetalleCompras: DetalleCompra[] = [
  { ID: 2001, IDCompra_DC: 'adm - 20260520-1430', Item_DC: 'Motor Tambor 220V', Cantidad_DC: 4, FechaMesAno_DC: currentMonth(), Fecha_DC: today(), Segmento_DC: 'REPUESTO', Status_DC: 'Pendiente', Codigo_DC: 'MT-220', Marca_DC: 'OEM' },
  { ID: 2002, IDCompra_DC: 'adm - 20260520-1430', Item_DC: 'Correa Distribución', Cantidad_DC: 8, FechaMesAno_DC: currentMonth(), Fecha_DC: today(), Segmento_DC: 'REPUESTO', Status_DC: 'Pendiente', Codigo_DC: 'CD-001', Marca_DC: 'Gates' },
  { ID: 2003, IDCompra_DC: 'adm - 20260518-1100', Item_DC: 'Lavadora LG 15kg', Cantidad_DC: 2, FechaMesAno_DC: currentMonth(), Fecha_DC: today(), Segmento_DC: 'LAVADORA', Status_DC: 'Aprobada', Codigo_DC: 'T9010Te', Marca_DC: 'LG' },
  { ID: 2004, IDCompra_DC: 'jta - 20260515-0930', Item_DC: 'Secadora Simple Whirlpool', Cantidad_DC: 1, FechaMesAno_DC: currentMonth(), Fecha_DC: today(), Segmento_DC: 'SECADORA SIMPLE', Status_DC: 'Pendiente', Codigo_DC: 'WED6620', Marca_DC: 'Whirlpool' },
  { ID: 2005, IDCompra_DC: 'jta - 20260510-1700', Item_DC: 'Resistencia Calefactora', Cantidad_DC: 6, FechaMesAno_DC: currentMonth(), Fecha_DC: today(), Segmento_DC: 'REPUESTO', Status_DC: 'Recibida', CantidadIngresada_DC: 6, Codigo_DC: 'RC-2000', Marca_DC: 'Heatx' },
];

export const mockAprobaciones: Aprobacion[] = [
  { ID: 3001, TipoAprobacion_AP: 'Compra', Status_AP: 'En Aprobacion', Aprobada_AP: 'NO', Rechazada_AP: 'NO', IDCompra_AP: '1003', ConcatAprobacion_AP: 'Compra Secarropa Whirlpool x1', FechaMesAnoGen_AP: currentMonth(), FechaGen_AP: today() },
  { ID: 3002, TipoAprobacion_AP: 'Cambio de Maquina', Status_AP: 'En Aprobacion', Aprobada_AP: 'NO', Rechazada_AP: 'NO', IDRegistroDM_AP: 'DM-4521', ConcatAprobacion_AP: 'Cambio Lavadora LG 15kg en Torre Madero I', FechaMesAnoGen_AP: currentMonth(), FechaGen_AP: today() },
  { ID: 3003, TipoAprobacion_AP: 'Transferencia de Maquina', Status_AP: 'En Aprobacion', Aprobada_AP: 'NO', Rechazada_AP: 'NO', IDRegistroDM_AP: 'DM-4799', ConcatAprobacion_AP: 'Transferencia Secadora Simple a Belgrano R', FechaMesAnoGen_AP: currentMonth(), FechaGen_AP: today() },
];

export const mockMaquinas: DetalleMaquina[] = [
  { ID: 4001, IDMaquina_DM: 'TM1-LAV-01', Marca_DM: 'LG', Modelo_DM: 'WD15D9', NroSerie_DM: 'LG2024-001', ConcatMaquina_DM: 'LG WD15D9 — TM1-LAV-01', ConcatMaquinaIncidente_DM: 'LG WD15D9', Segmento_DM: 'LAVADORA', Status_DM: 'INSTALADA', Edificio_DM: 'Torre Madero I', FechaIngreso_DM: '15/03/2025' },
  { ID: 4002, IDMaquina_DM: 'TM1-LAV-02', Marca_DM: 'LG', Modelo_DM: 'WD15D9', NroSerie_DM: 'LG2024-002', ConcatMaquina_DM: 'LG WD15D9 — TM1-LAV-02', ConcatMaquinaIncidente_DM: 'LG WD15D9', Segmento_DM: 'LAVADORA', Status_DM: 'INSTALADA', Edificio_DM: 'Torre Madero I', FechaIngreso_DM: '15/03/2025' },
  { ID: 4003, IDMaquina_DM: 'TM1-SEC-01', Marca_DM: 'Whirlpool', Modelo_DM: 'WED6620', NroSerie_DM: 'WP2024-001', ConcatMaquina_DM: 'Whirlpool WED6620 — TM1-SEC-01', ConcatMaquinaIncidente_DM: 'Whirlpool WED6620', Segmento_DM: 'SECADORA SIMPLE', Status_DM: 'INSTALADA', Edificio_DM: 'Torre Madero I', FechaIngreso_DM: '15/03/2025' },
  { ID: 4004, IDMaquina_DM: 'PSH-LAV-01', Marca_DM: 'LG', Modelo_DM: 'WD15D9', NroSerie_DM: 'LG2024-101', ConcatMaquina_DM: 'LG WD15D9 — PSH-LAV-01', ConcatMaquinaIncidente_DM: 'LG WD15D9', Segmento_DM: 'LAVADORA', Status_DM: 'INSTALADA', Edificio_DM: 'Edificio Palermo Soho', FechaIngreso_DM: '20/05/2025' },
  { ID: 4005, IDMaquina_DM: 'WI-DEP-01', Marca_DM: 'Speed Queen', Modelo_DM: 'SQ-DOBLE', NroSerie_DM: 'SQ2024-001', ConcatMaquina_DM: 'Speed Queen SQ-DOBLE — WI-DEP-01', ConcatMaquinaIncidente_DM: 'Speed Queen SQ-DOBLE', Segmento_DM: 'SECADORA DOBLE', Status_DM: 'DEPOSITO', Edificio_DM: 'Wash Inn (Depósito)' },
];

export const mockIncidentes: Incidente[] = [
  { ID: 5001, IDIncidente: 'IN-5001', Fecha_IN: today(), FechaMes_IN: 'mayo', FechaMesAno_IN: currentMonth(), Titulo_IN: 'Lavadora no centrifuga', NoResuelto_IN: 'Requiere Repuesto', Status_IN: 'Asignado', Resuelto_IN: 'NO', NombreEdificio_IN: 'Torre Madero I', IDMaquina_IN: 'TM1-LAV-01', ConcatMaquina_IN: 'LG WD15D9', TecnicoAsignado_IN: 'mfernandez', CantidadRepuestos_IN: 1, DescripcionIncidente_IN: 'Reporta vecino que máquina queda llena de agua.', User_IN: 'admin' },
  { ID: 5002, IDIncidente: 'IN-5002', Fecha_IN: today(), FechaMes_IN: 'mayo', FechaMesAno_IN: currentMonth(), Titulo_IN: 'Secadora con ruido extraño', NoResuelto_IN: 'Reportado Por Tecnico', Status_IN: 'A Revisar', Resuelto_IN: 'NO', NombreEdificio_IN: 'Edificio Palermo Soho', ConcatMaquina_IN: 'Whirlpool WED6620', IDMaquina_IN: 'PSH-SEC-01', TecnicoAsignado_IN: 'jruiz', CantidadRepuestos_IN: 0, DescripcionCarga_IN: 'Rodamiento posiblemente roto', User_IN: 'jruiz' },
  { ID: 5003, IDIncidente: 'IN-5003', Fecha_IN: today(), FechaMes_IN: 'mayo', FechaMesAno_IN: currentMonth(), Titulo_IN: 'Cargadora no acepta monedas', NoResuelto_IN: 'Cambio Maquina', Status_IN: 'En Aprobacion', Resuelto_IN: 'NO', NombreEdificio_IN: 'Belgrano R', ConcatMaquina_IN: 'CoinMatic', IDMaquina_IN: 'BGR-CRG-01', CantidadRepuestos_IN: 0, DescripcionIncidente_IN: 'Sensor de monedas falla.', User_IN: 'admin' },
];

export const mockRepuestosIncidentes: RepuestoIncidente[] = [
  { ID: 6001, IDIncidente_RI: 'IN-5001', Repuesto_RI: 'Bomba de Agua', Cantidad_RI: 1 },
];

export const mockMesesPlanificacion: MesPlanificacion[] = [
  { ID: 7001, MesAnoPlanificado_MP: currentMonth(), MesPlanificado_MP: 'mayo', RutasTotales_MP: 3, TecnicosTotales_MP: 3, Status_MP: 'Activo' },
  { ID: 7002, MesAnoPlanificado_MP: '06/2026', MesPlanificado_MP: 'junio', RutasTotales_MP: 4, TecnicosTotales_MP: 3, Status_MP: 'Activo' },
];

export const mockResumenPlanif: ResumenPlanificacion[] = [
  { ID: 8001, MesAnoPlanificado_RP: currentMonth(), Tecnico_RP: 'Mauro Fernández', NroRuta_RP: '1', IDUnivocoRuta_RP: 'R1-mfernandez-202605201430', Status_RP: 'En Proceso' },
  { ID: 8002, MesAnoPlanificado_RP: currentMonth(), Tecnico_RP: 'Julián Ruiz', NroRuta_RP: '2', IDUnivocoRuta_RP: 'R2-jruiz-202605201431', Status_RP: 'Pendiente' },
  { ID: 8003, MesAnoPlanificado_RP: currentMonth(), Tecnico_RP: 'Leandro Leyes', NroRuta_RP: '3', IDUnivocoRuta_RP: 'R3-lleyes-202605201432', Status_RP: 'Cerrada' },
];

export const mockDetallePlanif: DetallePlanificacion[] = [
  { ID: 9001, IDUnivoco_DP: 'R1-mfernandez-202605201430', IDUnivocoCircuito_DP: '1A', Tecnico_DP: 'Mauro Fernández', NroCircuito_DP: '1A', MesAno_DP: currentMonth(), Status_DP: 'En Proceso' },
  { ID: 9002, IDUnivoco_DP: 'R1-mfernandez-202605201430', IDUnivocoCircuito_DP: '1B', Tecnico_DP: 'Mauro Fernández', NroCircuito_DP: '1B', MesAno_DP: currentMonth(), Status_DP: 'Pendiente' },
  { ID: 9003, IDUnivoco_DP: 'R2-jruiz-202605201431', IDUnivocoCircuito_DP: '2C', Tecnico_DP: 'Julián Ruiz', NroCircuito_DP: '2C', MesAno_DP: currentMonth(), Status_DP: 'Pendiente' },
];

export const mockEdificiosVisitar: EdificioVisitar[] = [
  { ID: 10001, IDUnivocoCircuito_EV: '1A', NombreEdificio_EV: 'Torre Madero I', Direccion_EV: 'Av. Madero 1280', NroCircuito_EV: '1A', TecnicoAsignado_EV: 'Mauro Fernández', MesAno_EV: currentMonth(), Status_EV: 'Visitado' },
  { ID: 10002, IDUnivocoCircuito_EV: '1A', NombreEdificio_EV: 'Torre Madero II', Direccion_EV: 'Av. Madero 1320', NroCircuito_EV: '1A', TecnicoAsignado_EV: 'Mauro Fernández', MesAno_EV: currentMonth(), Status_EV: 'Pendiente' },
  { ID: 10003, IDUnivocoCircuito_EV: '1B', NombreEdificio_EV: 'Belgrano R', Direccion_EV: 'Av. Cabildo 2800', NroCircuito_EV: '1B', TecnicoAsignado_EV: 'Mauro Fernández', MesAno_EV: currentMonth(), Status_EV: 'Pendiente' },
  { ID: 10004, IDUnivocoCircuito_EV: '2C', NombreEdificio_EV: 'Edificio Palermo Soho', Direccion_EV: 'Honduras 4500', NroCircuito_EV: '2C', TecnicoAsignado_EV: 'Julián Ruiz', MesAno_EV: currentMonth(), Status_EV: 'Pendiente' },
];

export const mockVentilaciones: Ventilacion[] = [
  { ID: 11001, Edificio_VE: 'Torre Madero I', Grupo_VE: 'Conducto principal', Frecuencia_VE: 'Mensual', Estado_VE: 'Asignada', Asignado_VE: 'Mauro Fernández', FechaUltima_VE: '15/04/2026', ProximaLimpieza_VE: '15/05/2026', FechaMesAnoProxima_VE: currentMonth(), EsIncidente_VE: 'NO', Orden_VE: 1 },
  { ID: 11002, Edificio_VE: 'Edificio Palermo Soho', Grupo_VE: 'Sector A', Frecuencia_VE: 'Bimestral', Estado_VE: 'Pendiente', ProximaLimpieza_VE: '20/05/2026', FechaMesAnoProxima_VE: currentMonth(), EsIncidente_VE: 'SI', Orden_VE: 2 },
  { ID: 11003, Edificio_VE: 'Belgrano R', Grupo_VE: 'Conducto principal', Frecuencia_VE: 'Trimestral', Estado_VE: 'Programada', Asignado_VE: 'Julián Ruiz', FechaProgramada_VE: '28/05/2026', ProximaLimpieza_VE: '28/05/2026', FechaMesAnoProxima_VE: currentMonth(), EsIncidente_VE: 'NO', Orden_VE: 3 },
  { ID: 11004, Edificio_VE: 'Recoleta Premium', Grupo_VE: 'Cocina/Sopa', Frecuencia_VE: 'Mensual', Estado_VE: 'Realizada', Asignado_VE: 'Leandro Leyes', FechaUltima_VE: '20/05/2026', ProximaLimpieza_VE: '20/06/2026', FechaMesAnoProxima_VE: '06/2026', ObservacionResuelto_VE: 'Conductos en buen estado. Filtro reemplazado.', EsIncidente_VE: 'NO', Orden_VE: 4 },
];

export const mockItemsCompra: ItemCompra[] = [
  { ID: 12001, Item_IC: 'Lavadora LG 15kg', Tipo_IC: 'LAVADORA', Status_IC: 'Activo' },
  { ID: 12002, Item_IC: 'Lavadora Samsung 12kg', Tipo_IC: 'LAVADORA', Status_IC: 'Activo' },
  { ID: 12003, Item_IC: 'Secadora Simple Whirlpool', Tipo_IC: 'SECADORA SIMPLE', Status_IC: 'Activo' },
  { ID: 12004, Item_IC: 'Secadora Doble Industrial', Tipo_IC: 'SECADORA DOBLE', Status_IC: 'Activo' },
  { ID: 12005, Item_IC: 'Motor Tambor 220V', Tipo_IC: 'REPUESTO', Status_IC: 'Activo' },
  { ID: 12006, Item_IC: 'Correa Distribución', Tipo_IC: 'REPUESTO', Status_IC: 'Activo' },
  { ID: 12007, Item_IC: 'Bomba de Agua', Tipo_IC: 'REPUESTO', Status_IC: 'Activo' },
  { ID: 12008, Item_IC: 'Resistencia Calefactora', Tipo_IC: 'REPUESTO', Status_IC: 'Activo' },
];

export const mockRutas: RutaCatalogo[] = [
  { ID: 13001, NroRuta_RT: '1', Status_RT: 'Activo' },
  { ID: 13002, NroRuta_RT: '2', Status_RT: 'Activo' },
  { ID: 13003, NroRuta_RT: '3', Status_RT: 'Activo' },
  { ID: 13004, NroRuta_RT: '4', Status_RT: 'Activo' },
];

export const mockResumenCircuitos: ResumenCircuito[] = [
  { ID: 14001, NroRuta_RC: '1', NroCircuito_RC: '1A', Status_RC: 'Activo' },
  { ID: 14002, NroRuta_RC: '1', NroCircuito_RC: '1B', Status_RC: 'Activo' },
  { ID: 14003, NroRuta_RC: '2', NroCircuito_RC: '2C', Status_RC: 'Activo' },
  { ID: 14004, NroRuta_RC: '3', NroCircuito_RC: '3A', Status_RC: 'Activo' },
];

export const mockDetalleCircuitos: DetalleCircuito[] = [
  { ID: 15001, NroCircuito_DC: '1A', NombreEdificio_DC: 'Torre Madero I', Direccion_DC: 'Av. Madero 1280', Status_DC: 'Activo' },
  { ID: 15002, NroCircuito_DC: '1A', NombreEdificio_DC: 'Torre Madero II', Direccion_DC: 'Av. Madero 1320', Status_DC: 'Activo' },
  { ID: 15003, NroCircuito_DC: '1B', NombreEdificio_DC: 'Belgrano R', Direccion_DC: 'Av. Cabildo 2800', Status_DC: 'Activo' },
  { ID: 15004, NroCircuito_DC: '2C', NombreEdificio_DC: 'Edificio Palermo Soho', Direccion_DC: 'Honduras 4500', Status_DC: 'Activo' },
  { ID: 15005, NroCircuito_DC: '3A', NombreEdificio_DC: 'Recoleta Premium', Direccion_DC: 'Posadas 1500', Status_DC: 'Activo' },
];

export const mockFrecuencias: Frecuencia[] = [
  { ID: 16001, Frecuencia_FE: 'Semanal', Status_FE: 'Activo' },
  { ID: 16002, Frecuencia_FE: 'Quincenal', Status_FE: 'Activo' },
  { ID: 16003, Frecuencia_FE: 'Mensual', Status_FE: 'Activo' },
  { ID: 16004, Frecuencia_FE: 'Bimestral', Status_FE: 'Activo' },
  { ID: 16005, Frecuencia_FE: 'Trimestral', Status_FE: 'Activo' },
];

export const mockGruposVent: GrupoVentilacion[] = [
  { ID: 17001, Grupo_GV: 'Conducto principal', Status_VE: 'Activo' },
  { ID: 17002, Grupo_GV: 'Sector A', Status_VE: 'Activo' },
  { ID: 17003, Grupo_GV: 'Sector B', Status_VE: 'Activo' },
  { ID: 17004, Grupo_GV: 'Cocina/Sopa', Status_VE: 'Activo' },
];

export const mockEncendedores: Encendedor[] = [
  { ID: 18001, Tipo_EN: 'Moneda', Status_EN: 'Activo' },
  { ID: 18002, Tipo_EN: 'Billete', Status_EN: 'Activo' },
  { ID: 18003, Tipo_EN: 'Token', Status_EN: 'Activo' },
];

export const mockMaquinasCompra: MaquinaCompra[] = [
  { ID: 19001, Maquina_MC: 'Lavadora LG 15kg', Marca_MC: 'LG', Modelo_MC: 'WD15D9', Segmento_MC: 'LAVADORA', Status_MC: 'Activo' },
  { ID: 19002, Maquina_MC: 'Secadora Simple Whirlpool', Marca_MC: 'Whirlpool', Modelo_MC: 'WED6620', Segmento_MC: 'SECADORA SIMPLE', Status_MC: 'Activo' },
  { ID: 19003, Maquina_MC: 'Secadora Doble Industrial', Marca_MC: 'Speed Queen', Modelo_MC: 'SQ-DOBLE', Segmento_MC: 'SECADORA DOBLE', Status_MC: 'Activo' },
];

// Catálogo de items disponibles para agregar al stock
// Para repuestos: con códigos tipo C01, E01, L1, etc. (como en el PowerApp original)
export const mockStockCatalog: StockCatalogItem[] = [
  // Lavadoras
  { ID: 20001, Tipo: 'LAVADORA', Item: 'Lavadora LG 15kg', Marca: 'LG', Codigo: 'T9010Te' },
  { ID: 20002, Tipo: 'LAVADORA', Item: 'Lavadora LG 20kg', Marca: 'LG', Codigo: 'T9020Te' },
  { ID: 20003, Tipo: 'LAVADORA', Item: 'Lavadora Samsung 12kg', Marca: 'Samsung', Codigo: 'WW12K' },
  { ID: 20004, Tipo: 'LAVADORA', Item: 'Lavadora Whirlpool 14kg', Marca: 'Whirlpool', Codigo: 'WLA14' },
  { ID: 20005, Tipo: 'LAVADORA', Item: 'Lavadora Speed Queen 18kg', Marca: 'Speed Queen', Codigo: 'SQ18' },
  { ID: 20006, Tipo: 'LAVADORA', Item: 'Lavadora Maytag 16kg', Marca: 'Maytag', Codigo: 'Mat12Csagw' },

  // Secadoras simple
  { ID: 20010, Tipo: 'SECADORA SIMPLE', Item: 'Secadora Simple Whirlpool', Marca: 'Whirlpool', Codigo: 'WED6620' },
  { ID: 20011, Tipo: 'SECADORA SIMPLE', Item: 'Secadora Simple LG', Marca: 'LG', Codigo: 'DLE-S' },
  { ID: 20012, Tipo: 'SECADORA SIMPLE', Item: 'Secadora Simple Maytag', Marca: 'Maytag', Codigo: 'MED-S' },

  // Secadoras doble
  { ID: 20020, Tipo: 'SECADORA DOBLE', Item: 'Secadora Doble Industrial', Marca: 'Speed Queen', Codigo: 'SQ-DOBLE' },
  { ID: 20021, Tipo: 'SECADORA DOBLE', Item: 'Secadora Doble Whirlpool', Marca: 'Whirlpool', Codigo: 'WDD' },

  // Cargadoras
  { ID: 20030, Tipo: 'CARGADORA', Item: 'Cargadora Monedas CoinMatic', Marca: 'CoinMatic', Codigo: 'CM-01' },
  { ID: 20031, Tipo: 'CARGADORA', Item: 'Cargadora Multi-coin', Marca: 'Generic', Codigo: 'MC-2' },

  // Expendedoras
  { ID: 20040, Tipo: 'EXPENDEDORA', Item: 'Expendedora Token', Marca: 'TokenPro', Codigo: 'TP-1' },
  { ID: 20041, Tipo: 'EXPENDEDORA', Item: 'Expendedora Multi-jabón', Marca: 'Generic', Codigo: 'EXP-MJ' },

  // Encendedoras
  { ID: 20050, Tipo: 'ENCENDEDORA', Item: 'Encendedora Billetes BillStart', Marca: 'BillStart', Codigo: 'BS-01' },
  { ID: 20051, Tipo: 'ENCENDEDORA', Item: 'Encendedora Monedas', Marca: 'Generic', Codigo: 'EM-01' },

  // Repuestos (con códigos típicos del PowerApp)
  { ID: 21001, Tipo: 'REPUESTO', Item: 'Gabinete Cargadora Mett CARGA', Marca: 'Mett', Codigo: 'C01' },
  { ID: 21002, Tipo: 'REPUESTO', Item: 'Placa Cargadora', Marca: 'OEM', Codigo: 'CP01' },
  { ID: 21003, Tipo: 'REPUESTO', Item: 'Placa Motor Econo', Marca: 'OEM', Codigo: 'D513797' },
  { ID: 21004, Tipo: 'REPUESTO', Item: 'Fuentes 12V 5A ENCENDE', Marca: 'OEM', Codigo: 'E01' },
  { ID: 21005, Tipo: 'REPUESTO', Item: 'Coindrop', Marca: 'CoinMatic', Codigo: 'E02' },
  { ID: 21006, Tipo: 'REPUESTO', Item: 'Sensor De Fichas ENCENDE', Marca: 'OEM', Codigo: 'E03' },
  { ID: 21007, Tipo: 'REPUESTO', Item: 'Acrílico Grande', Marca: 'OEM', Codigo: 'E04' },
  { ID: 21008, Tipo: 'REPUESTO', Item: 'Acrílico Chico', Marca: 'OEM', Codigo: 'E05' },
  { ID: 21009, Tipo: 'REPUESTO', Item: 'Bisagras ENCENDE', Marca: 'OEM', Codigo: 'E07' },
  { ID: 21010, Tipo: 'REPUESTO', Item: 'Gabinetes Encendedora W ENCENDE', Marca: 'Mett', Codigo: 'E08' },
  { ID: 21011, Tipo: 'REPUESTO', Item: 'Placa Encendedora', Marca: 'OEM', Codigo: 'E10' },
  { ID: 21012, Tipo: 'REPUESTO', Item: 'Placa Encendedora Tag', Marca: 'OEM', Codigo: 'E11' },
  { ID: 21013, Tipo: 'REPUESTO', Item: 'Canilla Doble Esférica', Marca: 'Bronce', Codigo: 'I01' },
  { ID: 21014, Tipo: 'REPUESTO', Item: 'Canilla Simple Esférica', Marca: 'Bronce', Codigo: 'I02' },
  { ID: 21015, Tipo: 'REPUESTO', Item: 'Actuador LG', Marca: 'LG', Codigo: 'L1' },
  { ID: 21016, Tipo: 'REPUESTO', Item: 'Placa LG', Marca: 'LG', Codigo: 'L10' },
  { ID: 21017, Tipo: 'REPUESTO', Item: 'Placa Lavadora Swt Speed Queen', Marca: 'Speed Queen', Codigo: 'L100' },
  { ID: 21018, Tipo: 'REPUESTO', Item: 'Polea De Motor Chica Bomba Speed Queen', Marca: 'Speed Queen', Codigo: 'L101' },
  { ID: 21019, Tipo: 'REPUESTO', Item: 'Polea De Transmisión Speed Queen', Marca: 'Speed Queen', Codigo: 'L102' },
  { ID: 21020, Tipo: 'REPUESTO', Item: 'Polea Motor Speed Queen Lava', Marca: 'Speed Queen', Codigo: 'L104' },
  { ID: 21021, Tipo: 'REPUESTO', Item: 'Polea Tensora Lavadora Speed Queen', Marca: 'Speed Queen', Codigo: 'L105' },
  { ID: 21022, Tipo: 'REPUESTO', Item: 'Motor Tambor 220V', Marca: 'OEM', Codigo: 'MT-220' },
  { ID: 21023, Tipo: 'REPUESTO', Item: 'Correa Distribución', Marca: 'Gates', Codigo: 'CD-001' },
  { ID: 21024, Tipo: 'REPUESTO', Item: 'Bomba De Agua', Marca: 'Bosch', Codigo: 'BA-110' },
  { ID: 21025, Tipo: 'REPUESTO', Item: 'Resistencia Calefactora', Marca: 'Heatx', Codigo: 'RC-2000' },
  { ID: 21026, Tipo: 'REPUESTO', Item: 'Sello Buje Caja Speed Queen', Marca: 'Speed Queen', Codigo: 'L112' },
  { ID: 21027, Tipo: 'REPUESTO', Item: 'Correa Verde Speed Queen', Marca: 'Speed Queen', Codigo: 'L82' },
  { ID: 21028, Tipo: 'REPUESTO', Item: 'Eje Polea Tensora Speed Queen', Marca: 'Speed Queen', Codigo: 'Ls2' },
  { ID: 21029, Tipo: 'REPUESTO', Item: 'Rueda Guía Tambor Maytag Electronica Y Mecanica', Marca: 'Maytag', Codigo: 'S28' },
  { ID: 21030, Tipo: 'REPUESTO', Item: 'Eje Rueda May Maytag Electronica Y Mecanica', Marca: 'Maytag', Codigo: 'S24' },
  { ID: 21031, Tipo: 'REPUESTO', Item: 'Turbina Speed Queen', Marca: 'Speed Queen', Codigo: 'S82' },
];

export const appVersion = 'v20260520.1.0.0';
