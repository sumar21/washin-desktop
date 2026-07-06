# Módulos y flujos de negocio

Cada módulo corresponde a una pantalla de la PowerApp original (`Src/Screen_*.pa.yaml` en
`Washinn Desktop.msapp`) y a una screen/ruta del repo React. El acceso a cada módulo está
gateado por rol vía la lista `99.ListaPermisosDesktop` (ver [Roles y permisos](#roles-y-permisos)).

| Módulo (`Modulo_LPP`) | Screen PowerApps | Ruta / componente en el repo |
|---|---|---|
| — (splash) | `Screen_Start` | [`Start.tsx`](../src/screens/Start.tsx) (`/`) |
| — (login) | `Screen_Login` | [`Login.tsx`](../src/screens/Login.tsx) (`/login`) |
| Home | `Screen_Home` | [`Home.tsx`](../src/screens/Home.tsx) (`/home`) |
| Stock | `Screen_Stock` | [`Stock.tsx`](../src/screens/Stock.tsx) (`/stock`) |
| Stock Tecnico | `Screen_StockTecnicos` | [`StockTecnicos.tsx`](../src/screens/StockTecnicos.tsx) (`/stock-tecnicos`) |
| Compras | `Screen_Compras` | [`Compras.tsx`](../src/screens/Compras.tsx) (`/compras`) |
| Mis Aprobaciones | `Screen_Aprobaciones` | [`Aprobaciones.tsx`](../src/screens/Aprobaciones.tsx) (`/aprobaciones`) |
| Detalle Maquinas | `Screen_DetalleMaquina` | [`DetalleMaquina.tsx`](../src/screens/DetalleMaquina.tsx) (`/detalle-maquina`) |
| Incidentes | `Screen_Incidentes` | [`Incidentes.tsx`](../src/screens/Incidentes.tsx) (`/incidentes`) |
| Planificaciones | `Screen_Rutas` | [`Rutas.tsx`](../src/screens/Rutas.tsx) (`/rutas`) |
| Planificaciones (detalle) | `Screen_DetallePlanificacion` | [`DetallePlanificacion.tsx`](../src/screens/DetallePlanificacion.tsx) (`/planificacion/detalle`) |
| Ventilacion | `Screen_Ventilaciones` | [`Ventilaciones.tsx`](../src/screens/Ventilaciones.tsx) (`/ventilaciones`) |
| Configuracion | `Screen_Configuracion` | [`Configuracion.tsx`](../src/screens/Configuracion.tsx) (`/configuracion`) + subpantallas en [`screens/config/`](../src/screens/config) |
| Configuracion (circuito) | `Screen_DetalleCircuito` | [`DetalleCircuito.tsx`](../src/screens/DetalleCircuito.tsx) (`/configuracion/circuito`) |

> Fuente: análisis de las fórmulas Power Fx reales de cada `Screen_*.pa.yaml`. Donde el mock
> actual (`src/mock/`, `src/store/useAppStore.ts`) todavía no implementa un comportamiento
> descripto acá, está marcado explícitamente.

## Roles y permisos

Login propio (no Azure AD) contra la lista `Usuarios`: compara usuario/contraseña **en texto
plano** (columna interna `field_4`) — al migrar el backend, reemplazar por hash + verificación
en servidor, nunca en el cliente.

Roles (`VarTipoUser` / `Usuario.Rol`): **Admin**, **Supervisor Lider**, **Supervisor**,
**Atencion Al Cliente**, **Jefe Taller**, **Supervisor Mantenimiento**, **Supervisor
Ventilaciones**, y **Tecnico** (este último no entra al Desktop; solo aparece como destinatario
en combos y en las notificaciones de WhatsApp).

El **menú lateral se arma por dato**, no por lógica hardcodeada: al loguear se filtra
`99.ListaPermisosDesktop` por `Status_LPP="Activo"` y la columna SI/NO del rol
(`Admin_LPP`, `JefeTaller_LPP`, `SuperVisor_LPP`, etc.), ordenado por `Orden_LPP`. Agregar o
quitar un módulo a un rol es un cambio de dato en SharePoint, no de código.

**Excepción hardcodeada importante** (Admin vs. Jefe Taller) en `Detalle Maquinas`: transferir/
dar de baja una máquina se aplica **directo** si el rol es Admin; si es Jefe Taller, en cambio,
genera una fila en `07.Aprobaciones` (tipo *Transferencia de Maquina*) que otro usuario debe
confirmar en *Mis Aprobaciones*.

## Detalle por módulo

### Home
Dashboard de arranque + lanzador de módulos.
- Tarjetas de visitas del mes (`01.Registros`, filtradas por mes actual) — permite **anular**
  una visita (`Estado → "Anulado"`); es la única escritura del Desktop sobre esta lista.
- Resumen de líneas de compra del mes (`06.DetalleCompra`) agrupadas en 3 columnas por estado:
  Aprobadas / Pendientes / Recibidas.

### Stock
Inventario general (`04.Stock`, filtrado `Status_ST="Activo"`).
- **Alta de artículo**: crea/incrementa la fila de stock. Si el tipo no es "Repuesto" (es una
  máquina — lavadora/secadora/cargadora/expendedora/encendedora), **también** crea un registro
  en `08.DetalleMaquina` con `Status_DM="DEPOSITO"`.
- **Editar cantidad** (solo repuestos) — real, `PATCH /api/stock/:id`.
- **Asignar a técnico** (solo repuestos) — real, `POST /api/stock/assign`: valida cantidad
  disponible, crea/incrementa fila en `99.ABMRepuestos_Tecnico` (matcheando por
  `Tecnico_RT` + `Concat_RT`, reconstruido desde `Nro_ST`/`Item_ST` de 04.Stock — no parseado
  de un string concatenado como hacía la fórmula original, que rompe si el nombre no tiene
  " - ") y descuenta de `04.Stock` (flujo E). Técnicos = `Usuarios` con `Rol` Tecnico/Jefe
  Taller y `Status=ALTA` (`GET /api/users/tecnicos`).

### Stock Tecnico
Stock en poder de cada técnico (`99.ABMRepuestos_Tecnico`).
- **Transferir entre técnicos**: descuenta de origen, crea/incrementa destino.
- **Reingreso a depósito**: descuenta del técnico y **suma a `04.Stock`**.

### Compras — **API real** (`api/compras/*`, ver [flujo A](#a-ciclo-de-compra))
Ciclo completo de compra (`05.PedidoCompras` + `06.DetalleCompra`). Verificado end-to-end
contra el tenant en vivo.
- **Crear** (`POST /api/compras`): cabecera + líneas, ambas en `Pendiente`. Escribe `Title`,
  las columnas de fecha redundantes (`FechaMes_PC`/`FechaAno_PC`/`Hora_PC`) y `IDUnivoco_PC`
  como la PowerApp original. Segmentos e items salen del catálogo real (`GET /api/catalog`).
- **Editar** (`PATCH /api/compras/:id`): actualiza cantidades, agrega/quita líneas
  (quitar = soft-delete `Status_DC=Anulado` + `Rechazada_DC=SI`), recalcula `Cantidad_PC`.
- **Anular** (`POST … {action:'anular'}`): líneas → `Anulado`, cabecera → `Anulado` +
  `Filtrar_PC=SI` (sale del listado).
- **Mandar a aprobar** (`POST … {action:'approve-request'}`): crea `07.Aprobaciones`
  (tipo *Compra*, `IDCompra_AP` = ID numérico del pedido) y pasa la cabecera a `En Aprobacion`.
- **Recibir** (`POST … {action:'receive'}`): captura cantidad real por línea
  (`CantidadIngresada_DC`) y, para máquinas, serie/ID opcionales; pasa a `Recibida` +
  `Filtrar_PC=SI`, **ingresa a `04.Stock`** (suma si existe por nombre, crea si no, `Tipo_ST`
  en MAYÚSCULAS) y, si el segmento es máquina, crea una fila por unidad en `08.DetalleMaquina`
  (`Status_DM=DEPOSITO`, escribiendo el nombre interno real `Segmentp_DM`).

### Mis Aprobaciones — **API real** (`api/aprobaciones/*`)
Bandeja de aprobación (`07.Aprobaciones`, mes actual, `Aprobada_AP=NO` y `Rechazada_AP=NO`).
- **Compra** (`POST /api/aprobaciones/:id {action:'approve'|'reject'}`): aprobar pasa cabecera
  y líneas a `Aprobada`; rechazar cascadea `Rechazada` (+ `Filtrar_PC=SI`, `Rechazada_DC=SI`) y
  guarda el motivo en `InfoRechazo_AP`. **Implementado y verificado.**
- **Transferencia de Máquina**: **implementado**. La genera Jefe Taller desde Detalle Máquinas;
  **aprobar** aplica el movimiento completo (mismo `applyMaquinaTransfer`: `08.DetalleMaquina` +
  encendido herencia/propagación + `04.Stock ±1` + bitácora `10.Incidentes`) leyendo los campos
  `*_AP` de la solicitud (`IDRegistroDM_AP`, `EdificioDestino_AP`, `TipoEncendido_AP`, …).
- **Cambio de Máquina**: **implementado**. Se genera desde Incidentes (cambio de máquina);
  **aprobar** descuenta la máquina de reemplazo de `04.Stock` (match 08.DetalleMaquina por
  `ConcatMaquinaIncidente_DM` → `ConcatMaquina_DM`) y marca el incidente (`IDMaquina_AP`) como
  `Aprobada`. **Rechazar** funciona para cualquier tipo (solo marca la fila).
- La edición de una compra desde la bandeja de aprobación (que tenía la PowerApp original) **no
  se replicó**: el aprobador aprueba o rechaza; los cambios se hacen en Compras antes de enviar.

### Detalle Maquinas — **API real** (`api/maquinas/*`, ver [flujo D](#d-altabajatraslado-de-máquina))
Parque de máquinas (`08.DetalleMaquina`, excluye `ELIMINADA`). Verificado end-to-end contra el
tenant en vivo.
- **Carga completa sin tope** (`GET /api/maquinas`): trae **todas** las ~1775 máquinas activas
  (la PowerApp original topeaba las Collect a 2000 filas y forzaba filtrar por edificio; acá el
  backend pagina con `@odata.nextLink`, así que no hay tope). Se devuelven **ordenadas por
  Edificio → Segmento (orden lógico) → alfabético**. El front usa una **lista virtualizada** para
  renderizar miles de filas sin lag. Los filtros (edificio/segmento/marca/encendido + búsqueda)
  son **opcionales** — no hay gate obligatorio de entrada. `mapMaquina` normaliza (`.trim()`) los
  espacios sobrantes de `Edificio/Marca/Modelo/Segmento` de los datos reales para que el
  agrupado/orden/filtros sean limpios (`Segmento_DM` se lee de la columna interna `Segmentp_DM`).
- Ver **historial** de una máquina (`GET /api/maquinas/historial?concat=…`): se arma filtrando
  `10.Incidentes` por `ConcatMaquina_IN`/`MaquinaAsignada_IN` (no hay lectura directa de
  `09.HistorialMaquina`).
- **Transferir** (`POST /api/maquinas/:id {action:'transfer'}`): lógica de encendido fiel al
  original (ver [`api/_lib/maquinaMoves.ts`](../api/_lib/maquinaMoves.ts)):
  - **Herencia**: una máquina normal que entra a un edificio **con** encendedora **hereda** el
    `Encendido_DM` de esa encendedora; si el edificio **no** tiene encendedora, se usa el elegido.
  - **Propagación**: mover una **encendedora** a un edificio **reescribe** el encendido de
    **todas** las máquinas de ese edificio con el tipo elegido.
  - **A depósito** (`Wash Inn`) → `DEPOSITO`, sin encendido, `+1` stock.
  - Ajusta `04.Stock` `±1` en los cruces de depósito (enc/carg/exp matchean por segmento, el
    resto por `ConcatMaquina`; best-effort con `Math.max(0,…)` ante stock negativo heredado) y
    genera un `10.Incidentes` resuelto como bitácora.
  - **Roles**: **Admin** aplica directo; **Jefe Taller** genera `07.Aprobaciones` (tipo
    *Transferencia de Maquina*, `202 pendingApproval`) que se confirma en Mis Aprobaciones.
- **Dar de baja** (`{action:'baja'}`): **solo Admin** — `Status_DM=ELIMINADA`, `−1` stock,
  bitácora *Baja de Maquina*. Precondición: una máquina ya `ELIMINADA` devuelve `409` (baja
  idempotente, sin doble descuento).

### Incidentes — **API real** (`api/incidentes/*`, ver [flujo C](#c-ciclo-de-un-incidente))
Módulo núcleo. Gestión de incidentes/OT (`10.Incidentes`, `Resuelto_IN="NO"` + `13.RepuestosIncidentes`).
Verificado end-to-end contra el tenant en vivo. **Gotchas de columna** confirmados: la lista NO
tiene `Titulo_IN` (se deriva de `Categoria_IN`/`NoResuelto_IN`) ni `IDIncidente` propia (la clave
es el ID numérico); `Descripcion_IN` (no `DescripcionIncidente_IN`); y en `13`, display
`IDIncidente_RI` → interno **`IDIncidente_IN`**, que guarda el ID numérico del incidente.
- **Nuevo incidente** (`POST /api/incidentes`): crea la fila (`Status_IN="A Revisar"`,
  `NoResuelto_IN="Atencion al Cliente"`) y el front dispara un link de **WhatsApp** (`wa.me`) al
  técnico elegido.
- **Asignar técnico** (`POST …/:id {action:'assign'}`): pasa a `Asignado` + `FechaAsignada_IN` y
  **descuenta de `04.Stock`** los repuestos del incidente (match `Item_ST = Repuesto_RI`, clamp ≥0).
- **Cambiar técnico** (`{action:'cambiar-tecnico'}`): reasigna sin tocar stock.
- **Cambio de máquina** (`{action:'cambio-maquina'}`): si hay máquina libre del mismo segmento en
  depósito, se elige y **genera `07.Aprobaciones` (tipo *Cambio de Maquina*)** + incidente →
  `En Aprobacion`. Al **aprobar** (Mis Aprobaciones), se descuenta la máquina de `04.Stock` y el
  incidente pasa a `Aprobada`, listo para asignar. Si no hay máquina en depósito, deriva a generar
  compra.
- **Generar compra desde incidente** (`{action:'generar-compra'}`): crea `05`+`06` ya `Aprobada`
  enlazadas por `IDIncidenteCompra_PC` (repuesto faltante o máquina).
- La resolución final (`Resuelto_IN="SI"`) la hace la app móvil de técnicos, no el Desktop.

### Planificaciones (Rutas / DetallePlanificacion)
Planificación mensual de visitas — ver [flujo F](#f-planificación-de-rutas). Cascada de 4
listas: `17.MesesPlanificacion` (cabecera del mes) → `15.ResumenPlanificaciones` (una fila por
ruta+técnico) → `16.DetallePlanificaciones` (una fila por circuito) →
`18.EdificiosVisitar` (una fila por edificio a visitar — lo que consume la app móvil).
- **Crear planificación**: genera la cascada completa a partir de los maestros de rutas/
  circuitos.
- **Reasignar técnico** de una ruta ya planificada, **anular una ruta** (cascada de estado
  a las 3 listas hijas), **agregar rutas** a una planificación existente.

### Ventilacion
Limpieza de ductos de ventilación por edificio (`19.Ventilaciones`) — ver [flujo G](#g-ciclo-de-ventilaciones).
- **Alta**: marca el edificio como `Ventilaciones_ED="SI"` (con frecuencia y grupo) y crea la
  fila `Pendiente`.
- **Asignar técnico** + próxima fecha de limpieza → `Asignada`.
- La app móvil marca `Realizada` y sube fotos (biblioteca `Documentos/Ventilaciones/{ID}/`).
- **Eliminar**.

### Configuracion
ABM de los 3 maestros que alimentan Planificaciones: **Edificios** (`ABM.Edificios`), **Rutas**
(`99.ABM_Rutas`) y **Circuitos** (`99.ABM_ResumenCircuito` + `99.ABM_DetalleCircuito`, con
detalle en la screen `DetalleCircuito`). Cualquier alta/baja/edición acá **se propaga en
cascada** a las planificaciones pendientes del mes actual/siguiente (ver nota de flujos abajo)
y recalcula próximas limpiezas de ventilación si cambia la frecuencia del edificio.

## Flujos de negocio end-to-end

### A. Ciclo de compra
`Compras` crea cabecera (`05`, *Pendiente*) + líneas (`06`, *Pendiente*) → **Mandar a
aprobar** crea `07.Aprobaciones` (*Compra*), cabecera → *En Aprobacion* → en
`Mis Aprobaciones`: **Aprobar** (cabecera y líneas → *Aprobada*) o **Rechazar** (cascada a
*Rechazada*) → de vuelta en `Compras`, **Recibir** captura cantidad/serie reales: cabecera →
*Recibida*, líneas → *Recibida* con `CantidadIngresada_DC`, se da de alta/incrementa
`04.Stock` y, si son máquinas, se crean en `08.DetalleMaquina` con `Status_DM="DEPOSITO"`.

### B. Compra originada por un incidente
En `Incidentes`, si falta un repuesto o una máquina de reemplazo, se genera `05`+`06` con
`IDIncidenteCompra_PC` apuntando al incidente (a veces ya en *Aprobada*). Continúa con el
flujo de recepción de A.

### C. Ciclo de un incidente
Alta (*A Revisar* + WhatsApp al técnico) → asignar técnico (*Asignado*, descuenta repuestos de
`04.Stock`) → eventual cambio de máquina (búsqueda en depósito o compra nueva; puede requerir
aprobación) → resolución (la marca la app móvil: `Resuelto_IN="SI"`). Las bajas/transferencias
de máquina también generan un incidente ya resuelto, que funciona como bitácora/historial.

### D. Alta/baja/traslado de máquina
Compra recibida o alta manual de stock → máquina en `08.DetalleMaquina` con `Status_DM="DEPOSITO"`
(+1 en stock) → **transferir** a un edificio: `INSTALADA` (−1 stock; directo si Admin, vía
aprobación si Jefe Taller) → **dar de baja**: `ELIMINADA` (−1 stock). Cada movimiento crea un
`10.Incidentes` resuelto que documenta el evento.

### E. Traspaso de stock
Depósito (`04.Stock`) → técnico (`99.ABMRepuestos_Tecnico`) en *Stock*; técnico → técnico en
*Stock Tecnico*; técnico → depósito (reingreso). Cada movimiento valida cantidad disponible y
ajusta ambas listas.

### F. Planificación de rutas
`Configuracion` define los maestros (Edificios → Circuitos → Rutas) → `Rutas` crea la
planificación mensual en cascada: `17` (mes) → `15` (ruta+técnico) → `16` (circuitos) → `18`
(edificios a visitar, consumido por la app móvil). Un técnico visita un edificio de `18` → la
app móvil crea `01.Registros`/`02.Detalles`. `DetallePlanificacion` permite reasignar técnico o
anular una ruta (cascada de estado). Editar un maestro (agregar/quitar edificio de un circuito,
editar un edificio) **se propaga** a las planificaciones pendientes del mes actual y el
siguiente — replicar esta propagación es de los puntos más delicados al migrar el backend.

### G. Ciclo de ventilaciones
Alta por edificio (frecuencia + grupo) → *Pendiente* → asignar técnico + próxima limpieza →
*Asignada* → la app móvil la marca *Realizada* (con fotos). Editar la frecuencia/grupo del
edificio recalcula la próxima limpieza de las ventilaciones pendientes de ese edificio.

## Notas para el backend (gotchas del negocio, no solo de la API)

Estas son propias de **cómo funciona el negocio**, no de Graph — replicarlas correctamente
importa tanto como el acceso a los datos (complementa [backend.md](./backend.md)):

1. **Claves de negocio concatenadas en vez de FKs numéricas.** `IDUnivoco_PC` ↔ `IDCompra_DC`,
   `IDUnivocoRuta_RP` ↔ `IDUnivoco_DP` ↔ `IDUnivocoRuta_EV`, `IDUnivocoCircuito_DP` ↔
   `IDUnivocoCircuito_EV`, `ConcatMaquinaIncidente_DM` ↔ `ConcatMaquina_IN`. Muchos lookups
   son "por nombre de edificio", no por ID numérico.
2. **Sin transaccionalidad.** Los flujos originales son varios `Patch`/creaciones en cascada
   sin rollback; un fallo a mitad de camino puede dejar listas inconsistentes (ej. stock
   descontado pero incidente no actualizado). El backend nuevo debería envolver cada flujo
   multi-lista en una operación idempotente/reintentable, o usar `$batch` con manejo de error
   explícito.
3. **Contraseñas en texto plano** en `Usuarios` (columna interna `field_4`). Migrar a hash
   (bcrypt/argon2) y mover la validación al backend — nunca exponer la lista `Usuarios`
   completa al cliente.
4. **Integración con WhatsApp** al crear/derivar incidentes (`whatsapp://send?phone=...`),
   hoy un simple deep-link — decidir si se mantiene client-side o se mueve a una API de
   WhatsApp Business del lado servidor.
5. **Fechas y cantidades como texto**, con columnas auxiliares redundantes para filtrar
   (`FechaMesAno_*`, `FechaAno_*`). Al migrar, usar tipos reales (`number`, `Date`/ISO) y
   derivar esas columnas de agrupación en el backend en vez de guardarlas.
