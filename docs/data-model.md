# Modelo de datos

La base de datos son **listas de SharePoint** en el sitio:

```
https://sumardigital.sharepoint.com/sites/Nueva
```

En el frontend, cada lista está tipada en [`src/types/domain.ts`](../src/types/domain.ts),
**preservando textualmente** los nombres de campo de la PowerApp para que la UI matchee 1:1
con las fórmulas originales.

## Convención de nombres de campo

Cada campo lleva un **sufijo** que identifica la lista de origen (herencia de PowerApps):

| Sufijo | Lista | Ej. |
|---|---|---|
| `_R`  | 01.Registros | `NroRuta_R` |
| `_ST` | 04.Stock | `Cantidad_ST` |
| `_PC` | 05.PedidoCompras | `Status_PC` |
| `_DC` | 06.DetalleCompra | `Item_DC` |
| `_AP` | 07.Aprobaciones | `TipoAprobacion_AP` |
| `_DM` | 08.DetalleMaquina | `IDMaquina_DM` |
| `_HM` | 09.HistorialMaquina | `Detalle_HM` |
| `_IN` | 10.Incidentes | `Status_IN` |
| `_RP` | 11.Repuestos | `Codigo_RP` |
| `_VE` | 19.Ventilaciones | `Estado_VE` |
| `_RT`, `_RC`, `_DP`, `_EV`, `_MP`, … | listas ABM / planificación | — |

Campos comunes a todas: `ID` (número, la key de SharePoint). Muchos estados usan strings
canónicos en español (`'Pendiente'`, `'Aprobada'`, `'Realizada'`, `'ALTA'`/`'BAJA'`,
`'Activo'`/`'Inactivo'`, `'SI'`/`'NO'`).

## Listas de SharePoint (data sources)

GUIDs tomados de `References/DataSources.json` del `.msapp` — son los **list IDs** que se
usan en las rutas de Graph (`/sites/{siteId}/lists/{listId}/items`). No son secretos.

### Núcleo operativo

| Lista | List ID (GUID) | Interface (`domain.ts`) | Rol |
|---|---|---|---|
| `01.Registros` | `4c7393bb-dc2f-47af-a5ea-bb3860628f29` | `Registro` | Bitácora de visitas de técnicos (ruta/circuito, progreso). |
| `02.Detalles` | `259530ec-a7e0-4cdd-a2fd-310b80ddc6aa` | — | Detalle de cada registro/visita. |
| `04.Stock` | `37f239e9-4076-4f5c-a8aa-c052447bfc1a` | `StockItem` | Inventario general (máquinas + repuestos). |
| `05.PedidoCompras` | `76288cb9-70e7-4839-b427-9c5148773f75` | `PedidoCompra` | Cabecera de una orden de compra. |
| `06.DetalleCompra` | `51fb2d13-d77c-4823-af16-f08e4ad41d9f` | `DetalleCompra` | Ítems de una orden de compra. |
| `07.Aprobaciones` | `08ff6d69-082a-46fa-9eb2-108be44dade1` | `Aprobacion` | Cola de aprobación (compras, cambios/transferencias de máquina). |
| `08.DetalleMaquina` | `53e0e6a3-a3a5-498c-87b6-1f12b578ba8d` | `DetalleMaquina` | Máquinas individuales (serie, modelo, estado, edificio). |
| `09.HistorialMaquina` | `57ea24ad-6930-4b1e-b2ce-ec9185687a4b` | `HistorialMaquina` | Historial de eventos por máquina. |
| `10.Incidentes` | `ad39289f-3acf-4028-826a-a2c5458cb79f` | `Incidente` | Incidentes/reclamos sobre máquinas. |
| `11.Respuestos` *(sic — así está escrito el nombre de la lista en SharePoint)* | `92db215b-1301-4a64-8ecc-01338a66567f` | `Repuesto` | Catálogo maestro de repuestos. |
| `12.FotoIncidentes` | `29ed0c92-4cee-4a7a-a510-763d098bb482` | `FotoIncidente` | Fotos adjuntas a incidentes. Solo lectura desde el Desktop (las escribe la app móvil de técnicos). |
| `13.RepuestosIncidentes` | `e0259639-9678-454e-b3cf-5f9b5fc9c17c` | `RepuestoIncidente` | Repuestos requeridos por incidente. Solo lectura, pero **se consume** para descontar `04.Stock` al asignar técnico. |
| `19.Ventilaciones` | `a4e28738-1007-4218-aec0-9f8cda7e10ee` | `Ventilacion` | Limpiezas de ventilación por edificio/grupo/frecuencia. |
| `Documentos` (biblioteca, no lista) | `9686dcc9-cf94-4fb5-ab21-e04a22c4954b` | — | Fotos de ventilación realizada, en `Documentos compartidos/Ventilaciones/{ID}/`. |

> **No usadas por el Desktop** (las escribe/lee la app móvil de técnicos o son legado):
> `02.Detalles`, `09.HistorialMaquina` (declarada dos veces en el `.msapp` — `09.HistorialMaquina` y
> `09.HistorialMaquina_1` — mismo GUID), `99.ABM_Encendedores`, `ABM.Checklist`, `01.Registros`
> (el Desktop solo la lee + permite anular una visita). El "historial de máquina" que se ve en
> pantalla se arma en runtime filtrando `10.Incidentes`, no leyendo `09.HistorialMaquina`.

### Planificación de rutas

| Lista | List ID (GUID) | Interface | Rol |
|---|---|---|---|
| `15.ResumenPlanificaciones` | `1a5986e8-9367-4350-ae2a-5b3755a7098e` | `ResumenPlanificacion` | Plan mensual por técnico/ruta. |
| `16.DetallePlanificaciones` | `bf4452b0-50b8-406c-8988-3c57b393a195` | `DetallePlanificacion` | Circuitos dentro de una planificación. |
| `17.MesesPlanificacion` | `e3e8a011-90dd-43e1-adf4-d9d9ac2d261e` | `MesPlanificacion` | Meses habilitados para planificar. |
| `18.EdificiosVisitar` | `717028c9-9949-494b-9ee8-a1a7089f6f5b` | `EdificioVisitar` | Edificios a visitar por circuito/mes. |

### Usuarios / permisos

| Lista | List ID (GUID) | Interface | Rol |
|---|---|---|---|
| `Usuarios` | `abe151cc-f0cc-4ff2-a79e-fc0121c3dd41` | `Usuario` | Cuentas + rol + credenciales. |
| `ABM.Roles` | `748fd460-68dc-4194-8ad9-67499f5db42f` | (`UserRole`) | Catálogo de roles. |
| `99.ListaPermisosDesktop` | `60ed777c-2330-4c47-83ca-2a1f8a031143` | `PermisoModulo` | Qué módulos ve cada rol en el sidebar. |
| `ABM.Edificios` | `d57217b1-54a0-40eb-8193-60915d9e66a7` | `Edificio` | Catálogo de edificios. |
| `ABM.Checklist` | `8250ebf2-26e3-4880-a0ae-aa69b09ca831` | — | Checklist de tareas. |

### Catálogos ABM (Alta/Baja/Modificación)

Alimentan combos/selects: `99.ABM_ItemCompras` (`ItemCompra`), `99.ABM_MaquinasCompra`
(`MaquinaCompra`), `99.ABM_Rutas` (`RutaCatalogo`), `99.ABM_ResumenCircuito`
(`ResumenCircuito`), `99.ABM_DetalleCircuito` (`DetalleCircuito`), `99.ABM_Frecuencias`
(`Frecuencia`), `99.ABM_GruposVent` (`GrupoVentilacion`), `99.ABM_Encendedores`
(`Encendedor`), `99.ABM_Emails` (`EmailContacto`), `99.ABM_TipoABM`. Documento `Documentos`
(biblioteca de SharePoint) guarda archivos.

**`99.ABMRepuestos_Tecnico`** (`ccede13f-55cc-453f-b1bf-fac99d13b68a`, interface
`RepuestoTecnico`) — stock de repuestos en poder de cada técnico. **Implementada y real**
(no un catálogo mock): `POST /api/stock/assign` la escribe. Columnas confirmadas contra el
tenant en vivo, sin sorpresas de nombre (coinciden 1:1 con el sufijo `_RT`): `Tecnico_RT`,
`Concat_RT`, `Codigo_RT`, `Repuesto_RT`, `Cantidad_RT`, `Status_RT`. Ojo: en datos reales
`Concat_RT` viene de un catálogo/código viejo que **no** corresponde al `Nro_ST` actual de
`04.Stock` (ej. `"L57 - AGITADOR"` vs `"MT-220"`) — por eso el backend arma
`Concat_RT`/`Codigo_RT`/`Repuesto_RT` desde los campos limpios de `StockRow` en vez de
parsear un string concatenado (la fórmula original de la PowerApp hace eso y rompe si el
nombre no tiene `" - "`).

## Relaciones (claves foráneas)

SharePoint no tiene FKs reales: se relacionan por **campos string** (IDs unívocos), no por lookup nativo.

- `PedidoCompra.IDUnivoco_PC` ←→ `DetalleCompra.IDCompra_DC` (cabecera → ítems).
- `Aprobacion.IDCompra_AP` → `PedidoCompra.IDUnivoco_PC` (aprobación de una compra).
- `Aprobacion.IDRegistroDM_AP` → `DetalleMaquina` (aprobación de cambio/transferencia de máquina).
- `StockItem.IDMaquina_ST` / `NroSerie_ST` ←→ `DetalleMaquina.IDMaquina_DM` / `NroSerie_DM`.
- `Incidente.IDMaquina_IN` → `DetalleMaquina.IDMaquina_DM`; `Incidente.IDIncidente` ←→ `FotoIncidente.IDIncidente_FI`, `RepuestoIncidente.IDIncidente_RI`.
- `Registro.NroRuta_R` / `NroCircuito_R` → catálogos de rutas/circuitos; `DetallePlanificacion.IDUnivocoCircuito_DP` → `EdificioVisitar.IDUnivocoCircuito_EV`.
- `Ventilacion.Grupo_VE` / `Frecuencia_VE` → `99.ABM_GruposVent` / `99.ABM_Frecuencias`.

> Los estados canónicos y enums exactos de cada entidad **tal como los usa el frontend actual**
> están en [`src/types/domain.ts`](../src/types/domain.ts). `Status_PC`/`Status_DC` ya incluyen
> `'Anulado'` (presente en datos reales). Faltan aún de reflejar algunos estados de otras
> entidades (p. ej. `'Eliminada'` en máquinas/ventilaciones) — evaluar al migrar esos módulos.
> Ver flujos completos en [modules.md](./modules.md).

## Columnas de escritura de Compras/Aprobaciones (confirmadas en vivo)

Al implementar el flujo de compras se verificó `GET /lists/{id}/columns` de `05.PedidoCompras`,
`06.DetalleCompra`, `07.Aprobaciones`, `08.DetalleMaquina`, `04.Stock`, `11.Respuestos`,
`99.ABM_ItemCompras`, `99.ABM_MaquinasCompra`. Hallazgos clave (detalle y racional en
[backend.md](./backend.md)):

- **Todas las columnas son de tipo texto** — los writes mandan strings (`Cantidad_PC: "3"`).
- `Título → Title` (interno) en todas las listas.
- **`08.DetalleMaquina.Segmento_DM` es internamente `Segmentp_DM`** (typo con "p" en SharePoint).
- **`06.DetalleCompra` no tiene columna `Codigo_DC`** — el código es solo de UI.
- Segmentos: catálogo/compras en Title Case (`99.ABM_ItemCompras.Item_IC`), `04.Stock.Tipo_ST`
  en MAYÚSCULAS — se normaliza al ingresar a stock.
- El combo de segmento sale de `99.ABM_ItemCompras.Item_IC`; los items de `11.Respuestos`
  (`ConcatRepuesto_RP`, repuestos) o `99.ABM_MaquinasCompra` (`Concat_MC`, filtrado por
  `Segmento_MC`, máquinas). `IDCompra_AP` guarda el **ID numérico** del pedido, no `IDUnivoco_PC`.

## Nombres de columna internos vs. display name (gotcha de Graph)

Graph devuelve `item.fields` con el **nombre interno** de la columna de SharePoint, que puede
diferir del nombre visible en la PowerApp. Confirmado en `ABM.Edificios`: la columna mostrada
como `Codigo` es internamente `C_x00f3_digo` (encoding del "ó"), y `Edificio` es internamente
`Micasa`. En `Usuarios`, `Usuario`/`Contrasena` son internamente `field_1`/`field_4`. **Antes
de mapear cualquier lista nueva**, correr `GET /sites/{siteId}/lists/{listId}/columns` y
armar la tabla real de `displayName` → `name` (interno) — no asumir que coinciden.
