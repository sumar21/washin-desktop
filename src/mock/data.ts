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
  // Additional users used in incidentes mock
  { ID: 7, Usuario: 'mdueck', Contrasena: 'tecnico', Nombre: 'Mariela', Apellido: 'Duek', Concat_Nombre_Apellido: 'Duek, Mariela', Rol: 'Atencion Al Cliente', Status: 'ALTA' },
  { ID: 8, Usuario: 'mzervino', Contrasena: 'tecnico', Nombre: 'Martin', Apellido: 'Zervino', Concat_Nombre_Apellido: 'Zervino, Martin', Rol: 'Tecnico', Status: 'ALTA' },
  { ID: 9, Usuario: 'bnazer', Contrasena: 'tecnico', Nombre: 'Braian', Apellido: 'Nazer', Concat_Nombre_Apellido: 'Nazer, Braian', Rol: 'Tecnico', Status: 'ALTA' },
  { ID: 10, Usuario: 'msosa', Contrasena: 'tecnico', Nombre: 'Misael', Apellido: 'Sosa', Concat_Nombre_Apellido: 'Sosa, Misael', Rol: 'Tecnico', Status: 'ALTA' },
  { ID: 11, Usuario: 'prisau', Contrasena: 'tecnico', Nombre: 'Paul', Apellido: 'Risau', Concat_Nombre_Apellido: 'Risau, Paul', Rol: 'Atencion Al Cliente', Status: 'ALTA' },
  { ID: 12, Usuario: 'egerace', Contrasena: 'tecnico', Nombre: 'Esteban', Apellido: 'Gerace', Concat_Nombre_Apellido: 'Gerace, Esteban', Rol: 'Tecnico', Status: 'ALTA' },
  { ID: 13, Usuario: 'ehenriquez', Contrasena: 'tecnico', Nombre: 'Emiliano', Apellido: 'Henriquez', Concat_Nombre_Apellido: 'Henriquez, Emiliano', Rol: 'Tecnico', Status: 'ALTA' },
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

// Legacy hand-picked edificios (kept for back-compat with seed records that
// reference them by name in registros / incidentes / planificación detail).
const _legacyEdificios: Edificio[] = [
  { ID: 1, Edificio: 'Torre Madero I', Codigo: 'TM1', Direccion: 'Av. Madero 1280', Status: 'ALTA', GrupoVentilacion_ED: 'Norte', FrecuenciaVent_ED: 'Mensual' },
  { ID: 2, Edificio: 'Torre Madero II', Codigo: 'TM2', Direccion: 'Av. Madero 1320', Status: 'ALTA', GrupoVentilacion_ED: 'Norte', FrecuenciaVent_ED: 'Mensual' },
  { ID: 3, Edificio: 'Edificio Palermo Soho', Codigo: 'PSH', Direccion: 'Honduras 4500', Status: 'ALTA', GrupoVentilacion_ED: 'Centro', FrecuenciaVent_ED: 'Bimestral' },
  { ID: 4, Edificio: 'Belgrano R', Codigo: 'BGR', Direccion: 'Av. Cabildo 2800', Status: 'ALTA', GrupoVentilacion_ED: 'Norte', FrecuenciaVent_ED: 'Trimestral' },
  { ID: 5, Edificio: 'Recoleta Premium', Codigo: 'RCP', Direccion: 'Posadas 1500', Status: 'ALTA', GrupoVentilacion_ED: 'Centro', FrecuenciaVent_ED: 'Mensual' },
  { ID: 6, Edificio: 'Wash Inn (Depósito)', Codigo: 'WI', Direccion: 'Olivos 1010', Status: 'ALTA' },
];

// Final canonical edificios = legacy seeds + generator catalog (see below).
// `mockEdificiosCatalogo` is assigned later in this file; we merge via getter
// at module load time, after the generator runs.
export let mockEdificios: Edificio[] = _legacyEdificios;

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
  { ID: 5001, IDIncidente: 'IN-5001', Fecha_IN: '22/05/2026', FechaMes_IN: 'mayo', FechaMesAno_IN: currentMonth(), Titulo_IN: 'Atención al cliente', NoResuelto_IN: 'Reportado Por Tecnico', Status_IN: 'A Revisar', Resuelto_IN: 'NO', NombreEdificio_IN: 'Mirabilia 1', ConcatMaquina_IN: undefined, IDMaquina_IN: undefined, TecnicoAsignado_IN: 'jruiz', CantidadRepuestos_IN: 0, DescripcionIncidente_IN: 'Cliente reporta problema en lavadora.', User_IN: 'mdueck' },
  { ID: 5002, IDIncidente: 'IN-5002', Fecha_IN: '22/05/2026', FechaMes_IN: 'mayo', FechaMesAno_IN: currentMonth(), Titulo_IN: 'Expendedora 1551', NoResuelto_IN: 'Reportado Por Tecnico', Status_IN: 'A Revisar', Resuelto_IN: 'NO', NombreEdificio_IN: 'Renoir 1', IDMaquina_IN: '1551', ConcatMaquina_IN: 'Expendedora - 1551', TecnicoAsignado_IN: 'jruiz', CantidadRepuestos_IN: 0, DescripcionIncidente_IN: 'Expendedora no entrega producto.', User_IN: 'mdueck' },
  { ID: 5003, IDIncidente: 'IN-5003', Fecha_IN: '22/05/2026', FechaMes_IN: 'mayo', FechaMesAno_IN: currentMonth(), Titulo_IN: 'Atención al cliente', NoResuelto_IN: 'Reportado Por Tecnico', Status_IN: 'A Revisar', Resuelto_IN: 'NO', NombreEdificio_IN: 'Humboldt 2457', ConcatMaquina_IN: undefined, IDMaquina_IN: undefined, TecnicoAsignado_IN: 'bnazer', CantidadRepuestos_IN: 0, DescripcionIncidente_IN: 'Consulta general del residente.', User_IN: 'mdueck' },
  { ID: 5004, IDIncidente: 'IN-5004', Fecha_IN: '22/05/2026', FechaMes_IN: 'mayo', FechaMesAno_IN: currentMonth(), Titulo_IN: 'Cargadora 1522', NoResuelto_IN: 'Reportado Por Tecnico', Status_IN: 'A Revisar', Resuelto_IN: 'NO', NombreEdificio_IN: 'Palermo View', IDMaquina_IN: '1522', ConcatMaquina_IN: 'Cargadora - 1522', TecnicoAsignado_IN: 'jruiz', CantidadRepuestos_IN: 0, DescripcionIncidente_IN: 'Cargadora con falla intermitente.', User_IN: 'mdueck' },
  { ID: 5005, IDIncidente: 'IN-5005', Fecha_IN: '22/05/2026', FechaMes_IN: 'mayo', FechaMesAno_IN: currentMonth(), Titulo_IN: 'Atención al cliente', NoResuelto_IN: 'Reportado Por Tecnico', Status_IN: 'A Revisar', Resuelto_IN: 'NO', NombreEdificio_IN: 'Club Bamboo', ConcatMaquina_IN: undefined, IDMaquina_IN: undefined, TecnicoAsignado_IN: 'msosa', CantidadRepuestos_IN: 0, DescripcionIncidente_IN: 'ir a verificar que funcione todo.', User_IN: 'mdueck' },
  { ID: 5006, IDIncidente: 'IN-5006', Fecha_IN: '21/05/2026', FechaMes_IN: 'mayo', FechaMesAno_IN: currentMonth(), Titulo_IN: 'Atención al cliente', NoResuelto_IN: 'Reportado Por Tecnico', Status_IN: 'A Revisar', Resuelto_IN: 'NO', NombreEdificio_IN: 'Torre Huergo', ConcatMaquina_IN: undefined, IDMaquina_IN: undefined, TecnicoAsignado_IN: 'egerace', CantidadRepuestos_IN: 0, DescripcionIncidente_IN: 'Revisar central.', User_IN: 'prisau' },
  { ID: 5007, IDIncidente: 'IN-5007', Fecha_IN: '21/05/2026', FechaMes_IN: 'mayo', FechaMesAno_IN: currentMonth(), Titulo_IN: 'Encendedora 1996', NoResuelto_IN: 'Requiere Repuesto', Status_IN: 'Asignado', Resuelto_IN: 'NO', NombreEdificio_IN: 'Marquis', IDMaquina_IN: '1996', ConcatMaquina_IN: 'Encendedora - 1996', TecnicoAsignado_IN: 'ehenriquez', CantidadRepuestos_IN: 1, DescripcionIncidente_IN: 'Falla placa encendedora.', User_IN: 'ehenriquez' },
  { ID: 5008, IDIncidente: 'IN-5008', Fecha_IN: '19/05/2026', FechaMes_IN: 'mayo', FechaMesAno_IN: currentMonth(), Titulo_IN: 'Lavadora S.Queen 1057', NoResuelto_IN: 'Requiere Repuesto', Status_IN: 'A Revisar', Resuelto_IN: 'NO', NombreEdificio_IN: 'Cabello 3373', IDMaquina_IN: '1057', ConcatMaquina_IN: 'Lavadora - S.Queen - 1710057070 - 1057', TecnicoAsignado_IN: undefined, CantidadRepuestos_IN: 2, DescripcionIncidente_IN: 'Polea tensora rota.', User_IN: 'ehenriquez' },
  { ID: 5009, IDIncidente: 'IN-5009', Fecha_IN: '18/05/2026', FechaMes_IN: 'mayo', FechaMesAno_IN: currentMonth(), Titulo_IN: 'Atención al cliente', NoResuelto_IN: 'Reportado Por Tecnico', Status_IN: 'A Revisar', Resuelto_IN: 'NO', NombreEdificio_IN: 'Corrientes 3841', ConcatMaquina_IN: undefined, IDMaquina_IN: undefined, TecnicoAsignado_IN: 'ehenriquez', CantidadRepuestos_IN: 0, DescripcionIncidente_IN: 'Reportado por administración.', User_IN: 'mdueck' },
  { ID: 5010, IDIncidente: 'IN-5010', Fecha_IN: '18/05/2026', FechaMes_IN: 'mayo', FechaMesAno_IN: currentMonth(), Titulo_IN: 'Atención al cliente', NoResuelto_IN: 'Reportado Por Tecnico', Status_IN: 'A Revisar', Resuelto_IN: 'NO', NombreEdificio_IN: 'Baez 644', ConcatMaquina_IN: undefined, IDMaquina_IN: undefined, TecnicoAsignado_IN: 'ehenriquez', CantidadRepuestos_IN: 0, DescripcionIncidente_IN: 'Consulta del encargado.', User_IN: 'mdueck' },
  { ID: 5011, IDIncidente: 'IN-5011', Fecha_IN: '15/05/2026', FechaMes_IN: 'mayo', FechaMesAno_IN: currentMonth(), Titulo_IN: 'Encendedora 1990', NoResuelto_IN: 'Reportado Por Tecnico', Status_IN: 'A Revisar', Resuelto_IN: 'NO', NombreEdificio_IN: 'Cabello 3181', IDMaquina_IN: '1990', ConcatMaquina_IN: 'Encendedora - 1990', TecnicoAsignado_IN: 'ehenriquez', CantidadRepuestos_IN: 0, DescripcionIncidente_IN: 'Encendedora rechaza monedas.', User_IN: 'ehenriquez' },
  { ID: 5012, IDIncidente: 'IN-5012', Fecha_IN: '14/05/2026', FechaMes_IN: 'mayo', FechaMesAno_IN: currentMonth(), Titulo_IN: 'Secadora Doble Maytag 162', NoResuelto_IN: 'Requiere Repuesto', Status_IN: 'Pendiente', Resuelto_IN: 'NO', NombreEdificio_IN: 'Baez 644', IDMaquina_IN: '162', ConcatMaquina_IN: 'Secadora Doble - Maytag - 360671577m - 162', TecnicoAsignado_IN: undefined, CantidadRepuestos_IN: 1, DescripcionIncidente_IN: 'Resistencia rota.', User_IN: 'mdueck' },
];

export const mockRepuestosIncidentes: RepuestoIncidente[] = [
  { ID: 6001, IDIncidente_RI: 'IN-5007', Repuesto_RI: 'Placa Encendedora', Cantidad_RI: 1 },
  { ID: 6002, IDIncidente_RI: 'IN-5008', Repuesto_RI: 'Polea Tensora Lavadora Speed Queen', Cantidad_RI: 1 },
  { ID: 6003, IDIncidente_RI: 'IN-5008', Repuesto_RI: 'Correa Verde Speed Queen', Cantidad_RI: 1 },
  { ID: 6004, IDIncidente_RI: 'IN-5012', Repuesto_RI: 'Resistencia Calefactora', Cantidad_RI: 1 },
];

// --- Planificación: generated to cover several months with realistic data ---

const TECNICOS_PLANIF: string[] = [
  'Burgueño, Mauro',
  'Corimayo, Axel',
  'Limongi, Gabriel',
  'Llanos, Gonzalo',
  'Martinez, Luis',
  'Rojas, Jose',
  'Romer, Jorman',
  'Sosa, Misael',
];

// Pool of buildings with codes (sample of the PowerApp catalog)
const EDIFICIOS_PLANIF: Array<{ codigo: string; nombre: string; direccion: string }> = [
  { codigo: 'C-2263', nombre: 'Residencias Pilar Golf', direccion: 'Pilar 1200' },
  { codigo: 'C-0006', nombre: 'Las Mercedes', direccion: 'Av. Las Heras 2400' },
  { codigo: 'C-2308', nombre: 'Denver Farma', direccion: 'Acassuso 350' },
  { codigo: 'C-2285', nombre: 'Palmas De Buenavista', direccion: 'Pilar 1450' },
  { codigo: 'C-2190', nombre: 'Quartier Lomas La Horqueta', direccion: 'Pilar 2100' },
  { codigo: 'C-2477', nombre: 'Berrazo Beach', direccion: 'San Isidro 100' },
  { codigo: 'C-2222', nombre: 'Las Liebres 1', direccion: 'Pilar 3300' },
  { codigo: 'C-2294', nombre: 'Las Liebres 3', direccion: 'Pilar 3320' },
  { codigo: 'C-2277', nombre: 'Las Liebres 4', direccion: 'Pilar 3340' },
  { codigo: 'C-1934', nombre: 'Civis Tortugas', direccion: 'Tortugas 100' },
  { codigo: 'C-1546', nombre: 'Tortugas Garden', direccion: 'Tortugas 200' },
  { codigo: 'C-2305', nombre: 'Club Bamboo', direccion: 'Tigre 1500' },
  { codigo: 'C-1392', nombre: 'Alto Del Molino', direccion: 'Pilar 5500' },
  { codigo: 'C-1884', nombre: 'Bosque Alto', direccion: 'Nordelta 200' },
  { codigo: 'C-1423', nombre: 'Las Tinajas', direccion: 'Pilar 6700' },
  { codigo: 'C-2447', nombre: 'Jardines de Savari', direccion: 'Tigre 2100' },
  { codigo: 'C-1537', nombre: 'Los Naranjos', direccion: 'Tigre 3300' },
  { codigo: 'C-1920', nombre: 'Palmas De La Bahia', direccion: 'Tigre 4400' },
  { codigo: 'C-0290', nombre: 'Torres De Tigre', direccion: 'Tigre 5500' },
  { codigo: 'C-2283', nombre: 'Venice Balandras', direccion: 'Tigre 6600' },
  { codigo: 'C-2282', nombre: 'Venice Balandras 2', direccion: 'Tigre 6620' },
  { codigo: 'C-2286', nombre: 'Venice Crucero', direccion: 'Tigre 6700' },
  { codigo: 'C-0512', nombre: 'Solares De Belgrano', direccion: 'Belgrano 900' },
  { codigo: 'C-1101', nombre: 'Plaza Houssay', direccion: 'Recoleta 110' },
  { codigo: 'C-1212', nombre: 'Le Parc Figueroa Alcorta', direccion: 'Palermo 1500' },
  { codigo: 'C-1313', nombre: 'Madero Plaza', direccion: 'Madero 1200' },
  { codigo: 'C-1414', nombre: 'Torre Catalinas', direccion: 'Retiro 500' },
  { codigo: 'C-1515', nombre: 'Mirabilia 1', direccion: 'Palermo 2100' },
  { codigo: 'C-1616', nombre: 'Renoir 1', direccion: 'Belgrano 1200' },
  { codigo: 'C-1717', nombre: 'Humboldt 2457', direccion: 'Palermo 2457' },
  { codigo: 'C-1818', nombre: 'Palermo View', direccion: 'Palermo 3000' },
  { codigo: 'C-1919', nombre: 'Torre Huergo', direccion: 'Madero 800' },
  { codigo: 'C-2020', nombre: 'Marquis', direccion: 'Recoleta 200' },
  { codigo: 'C-2121', nombre: 'Cabello 3373', direccion: 'Palermo 3373' },
  { codigo: 'C-2222b', nombre: 'Corrientes 3841', direccion: 'Almagro 3841' },
  { codigo: 'C-2323', nombre: 'Baez 644', direccion: 'Las Cañitas 644' },
  { codigo: 'C-2424', nombre: 'Cabello 3181', direccion: 'Palermo 3181' },
  { codigo: 'C-2525', nombre: 'Quartier Dorrego', direccion: 'Palermo 1200' },
  { codigo: 'C-2626', nombre: 'Quartier San Telmo', direccion: 'San Telmo 100' },
  { codigo: 'C-2727', nombre: 'Vista Belgrano', direccion: 'Belgrano R 500' },
  { codigo: 'C-2828', nombre: 'Ayacucho 1435', direccion: 'Recoleta 1435' },
  { codigo: 'C-2929', nombre: 'Torre Deco Godoy Cruz', direccion: 'Palermo 2300' },
  { codigo: 'C-3030', nombre: 'Prima Caballito 2', direccion: 'Caballito 1500' },
  { codigo: 'C-3131', nombre: 'Ciudad De La Paz 1972', direccion: 'Belgrano 1972' },
  { codigo: 'C-3232', nombre: 'Puerto Pampa', direccion: 'Madero 2400' },
  { codigo: 'C-3333', nombre: 'Olazabal 4774', direccion: 'Belgrano 4774' },
  { codigo: 'C-3434', nombre: 'Blanco Encalada 1715', direccion: 'Belgrano 1715' },
  { codigo: 'C-3535', nombre: 'Libertador 5740', direccion: 'Belgrano 5740' },
  { codigo: 'C-3636', nombre: 'Regatas De Olivos', direccion: 'Olivos 100' },
];

const MES_NOMBRES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

// Generate planning data for last 12 months ending in current month
function generatePlanif(): {
  meses: MesPlanificacion[];
  resumen: ResumenPlanificacion[];
  detalles: DetallePlanificacion[];
  edificios: EdificioVisitar[];
} {
  const meses: MesPlanificacion[] = [];
  const resumen: ResumenPlanificacion[] = [];
  const detalles: DetallePlanificacion[] = [];
  const edificios: EdificioVisitar[] = [];

  let mesId = 7000;
  let resId = 8000;
  let detId = 9000;
  let edifId = 10000;

  const now = new Date();
  // 12 months including current, oldest first
  for (let offset = 11; offset >= 0; offset--) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    const mesAno = `${mm}/${yyyy}`;
    const mesNombre = MES_NOMBRES[date.getMonth()];

    // Number of rutas this month (4–8)
    const rutaCount = 4 + ((offset + date.getMonth()) % 5); // 4–8
    const tecnicosUsed = new Set<string>();

    for (let r = 0; r < rutaCount; r++) {
      const nroRuta = String(r + 1 + ((offset % 3) * 10) + (r < 3 ? 0 : 0));
      const tec = TECNICOS_PLANIF[(r + offset) % TECNICOS_PLANIF.length];
      tecnicosUsed.add(tec);
      const idUniv = `R${nroRuta}-${tec.replace(/[\s,]+/g, '').toLowerCase()}-${yyyy}${mm}`;

      // Status logic
      let status: ResumenPlanificacion['Status_RP'] = 'En Proceso';
      if (offset > 2) status = 'Cerrada';
      else if (offset === 0 && r > rutaCount - 2) status = 'Pendiente';

      // Circuitos for this ruta (3–5)
      const circuitoCount = 3 + ((r + offset) % 3);
      let edifTotal = 0;
      for (let c = 0; c < circuitoCount; c++) {
        const nroCirc = String(100 + c * 2 + (r % 3));
        const idCircUniv = `${idUniv}-C${nroCirc}`;
        let detStatus: DetallePlanificacion['Status_DP'] = 'En Proceso';
        if (status === 'Cerrada') detStatus = 'Cerrada';
        else if (status === 'Pendiente') detStatus = 'Pendiente';
        else if (c > circuitoCount - 2) detStatus = 'Pendiente';
        detalles.push({
          ID: ++detId,
          IDUnivoco_DP: idUniv,
          IDUnivocoCircuito_DP: idCircUniv,
          Tecnico_DP: tec,
          NroCircuito_DP: nroCirc,
          MesAno_DP: mesAno,
          Status_DP: detStatus,
        });

        // Edificios for this circuito (5–8)
        const edifCount = 5 + ((c + r + offset) % 4);
        for (let e = 0; e < edifCount; e++) {
          const ed =
            EDIFICIOS_PLANIF[(e + c * 3 + r * 7 + offset * 5) % EDIFICIOS_PLANIF.length];
          edificios.push({
            ID: ++edifId,
            IDUnivocoCircuito_EV: idCircUniv,
            NombreEdificio_EV: ed.nombre,
            Direccion_EV: ed.direccion,
            NroCircuito_EV: nroCirc,
            TecnicoAsignado_EV: tec,
            MesAno_EV: mesAno,
            Status_EV: status === 'Cerrada' ? 'Visitado' : e < 2 ? 'Visitado' : 'Pendiente',
            Codigo_EV: ed.codigo,
          });
          edifTotal++;
        }
      }

      resumen.push({
        ID: ++resId,
        MesAnoPlanificado_RP: mesAno,
        Tecnico_RP: tec,
        NroRuta_RP: nroRuta,
        IDUnivocoRuta_RP: idUniv,
        Status_RP: status,
        Cantidad_RP: edifTotal,
      });
    }

    meses.push({
      ID: ++mesId,
      MesAnoPlanificado_MP: mesAno,
      MesPlanificado_MP: mesNombre,
      RutasTotales_MP: rutaCount,
      TecnicosTotales_MP: tecnicosUsed.size,
      Status_MP: 'Activo',
    });
  }

  // Reverse so newest first
  return {
    meses: meses.reverse(),
    resumen,
    detalles,
    edificios,
  };
}

const _planif = generatePlanif();

export const mockMesesPlanificacion: MesPlanificacion[] = _planif.meses;
export const mockResumenPlanif: ResumenPlanificacion[] = _planif.resumen;
export const mockDetallePlanif: DetallePlanificacion[] = _planif.detalles;
export const mockEdificiosVisitar: EdificioVisitar[] = _planif.edificios;

// mockVentilaciones eliminado — el módulo de ventilaciones usa la API real (19.Ventilaciones).

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

// ---------------------------------------------------------------------------
// Configuración: rich generator for Rutas / Circuitos / Edificios catalog.
// Produces ~9 routes, ~45 circuits, ~280 building assignments and ~110 unique
// edificios so the Configuración module looks populated for testing.
// ---------------------------------------------------------------------------

const _STREETS: string[] = [
  'Costa Rica', 'Humboldt', 'El Salvador', 'Nicaragua', 'Soler', 'Cabello',
  'Corrientes', 'Baez', 'Vista Belgrano', 'Cullen', 'Diaz Colodrero', 'Pacheco',
  'Olazabal', 'Galvan', 'Tronador', 'Ruiz Huidobro', 'Pico', 'Paroissien',
  'Machain', 'Vidal', 'Amenabar', 'Ugarte', 'Blanco Encalada', 'Juramento',
  'Cramer', 'Moldes', 'Quesada', 'Humahuaca', 'Palmera', 'Castillo',
  'Julian Alvarez', 'Niceto Vega', 'Scalabrini Ortiz', 'Jufre', 'Diaz Velez',
  'Gascon', 'Mexico', 'Independencia', 'Sanchez De Loria', 'Humberto Primo',
  'Bulnes', 'Palacio Gardel', 'Solar Del Abasto', 'Metropolitan',
  'Guardia Vieja', 'Tucuman', 'Callao', 'Salguero', 'Awwa', 'Regatas',
  'Infinity', 'Carpediem', 'Nila Tower', 'Premium Libertador', 'Al Rio',
  'Soldado', 'Teodoro Garcia', 'Arce', 'Quartier Del Polo', 'Arevalo',
  'NIC Devoto', 'Evoque', 'Mosconi', 'Mirador De Palermo', 'Palmas De La Bahia',
  'Torres De Tigre', 'Venice', 'Solares De Belgrano', 'Plaza Houssay',
  'Le Parc Figueroa Alcorta', 'Green House', 'Green Haus', 'Green Tower',
  'Dome Green Soho', 'Florean Pampa', 'My Residence', 'Wave Libertador',
  'Bahia Del Puerto', 'Vista Buenos Aires', 'Met Plaza', 'Om Botanico',
  'Domus Libertador', 'Torre Panorama', 'Plan H', 'Be Libertador',
  'Puerta Norte', '3 De Febrero', 'Two Winds', 'Baunes', 'Cabildo',
  'Concord Vte Lopez', 'Libertador 13670', 'Aguero', 'La Riviera',
  'Torre Mayor', 'Parque Olivos', 'Alto Del Molino', 'Altos De Maria',
  'Altos De Serrano', 'Mantua', 'Young Stone', 'Las Araucarias',
];

// Deterministic seeded RNG so the catalog is stable across reloads.
function _mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function _generateConfigCatalog() {
  const rng = _mulberry32(0xC0FFEE);
  const rand = (min: number, max: number) =>
    Math.floor(rng() * (max - min + 1)) + min;

  // --- Edificios canónicos ---
  const edificios: Edificio[] = [];
  const seen = new Set<string>();
  let edifId = 100;
  let codigo = 1200;

  // Helper to add a building once.
  const addBuilding = (name: string, direccion: string) => {
    if (seen.has(name)) return;
    seen.add(name);
    edificios.push({
      ID: edifId++,
      Edificio: name,
      Codigo: `C-${codigo++}`,
      Direccion: direccion,
      Status: 'ALTA',
      GrupoVentilacion_ED:
        rng() < 0.4 ? ['Norte', 'Centro', 'Sur'][rand(0, 2)] : undefined,
      FrecuenciaVent_ED:
        rng() < 0.4
          ? ['90', '120', '180', '365'][rand(0, 3)]
          : undefined,
    });
  };

  // Generate a mix of street-only and street+number building names.
  for (const street of _STREETS) {
    addBuilding(street, `${street.toUpperCase()} ${rand(800, 5800)}`);
    // Add 0–2 numbered variants per street
    const variants = rand(0, 2);
    for (let i = 0; i < variants; i++) {
      const n = rand(200, 5900);
      addBuilding(`${street} ${n}`, `${street.toUpperCase()} ${n}`);
    }
  }

  // --- Rutas ---
  const rutaNums = [1, 2, 3, 4, 5, 6, 7, 10, 11];
  const rutas: RutaCatalogo[] = rutaNums.map((n, i) => ({
    ID: 13000 + i + 1,
    NroRuta_RT: String(n),
    Status_RT: 'Activo' as const,
  }));

  // --- Circuitos + DetalleCircuito assignments ---
  const circuitos: ResumenCircuito[] = [];
  const detalles: DetalleCircuito[] = [];
  let circId = 14000;
  let detId = 15000;
  let circuitNum = 100;

  for (const ruta of rutaNums) {
    const circuitCount = rand(3, 7);
    for (let i = 0; i < circuitCount; i++) {
      circuitNum += 1;
      const nroCircuito = String(circuitNum);
      circuitos.push({
        ID: ++circId,
        NroRuta_RC: String(ruta),
        NroCircuito_RC: nroCircuito,
        Status_RC: 'Activo',
      });

      // Pick 5–11 random unique buildings for this circuit
      const count = rand(5, 11);
      const pool = [...edificios];
      const picked: Edificio[] = [];
      for (let k = 0; k < count && pool.length > 0; k++) {
        const idx = rand(0, pool.length - 1);
        picked.push(pool.splice(idx, 1)[0]);
      }
      for (const b of picked) {
        detalles.push({
          ID: ++detId,
          NroCircuito_DC: nroCircuito,
          NombreEdificio_DC: b.Edificio,
          Direccion_DC: b.Direccion,
          Status_DC: 'Activo',
        });
      }
    }
  }

  return { rutas, circuitos, detalles, edificios };
}

const _configCatalog = _generateConfigCatalog();

export const mockRutas: RutaCatalogo[] = _configCatalog.rutas;
export const mockResumenCircuitos: ResumenCircuito[] = _configCatalog.circuitos;
export const mockDetalleCircuitos: DetalleCircuito[] = _configCatalog.detalles;
export const mockEdificiosCatalogo: Edificio[] = _configCatalog.edificios;

// Merge generator output into the canonical edificios export so the Edificios
// tab (and any consumer) sees the full set.
mockEdificios = [..._legacyEdificios, ...mockEdificiosCatalogo];

export const mockFrecuencias: Frecuencia[] = [
  { ID: 16001, Frecuencia_FE: '90', Status_FE: 'Activo' },
  { ID: 16002, Frecuencia_FE: '120', Status_FE: 'Activo' },
  { ID: 16003, Frecuencia_FE: '180', Status_FE: 'Activo' },
  { ID: 16004, Frecuencia_FE: '182', Status_FE: 'Activo' },
  { ID: 16005, Frecuencia_FE: '230', Status_FE: 'Activo' },
  { ID: 16006, Frecuencia_FE: '240', Status_FE: 'Activo' },
  { ID: 16007, Frecuencia_FE: '300', Status_FE: 'Activo' },
  { ID: 16008, Frecuencia_FE: '365', Status_FE: 'Activo' },
  { ID: 16009, Frecuencia_FE: '400', Status_FE: 'Activo' },
  { ID: 16010, Frecuencia_FE: '430', Status_FE: 'Activo' },
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
