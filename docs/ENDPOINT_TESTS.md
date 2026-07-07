# Resultados de tests de endpoints

Ejecución e2e contra SharePoint real (Graph) el **2026-07-07**, sesión Admin.
Todas las mutaciones se revirtieron/borraron (cleanup 100%, 0 leftovers verificado).

Harness y modo de correr: [`scripts/endpoint-tests/`](../scripts/endpoint-tests/README.md).

**Total: 51/51 checks PASS · 1 bug encontrado.**

## Lecturas (GET) + auth + guards — 22/22 ✅

| Endpoint | Check |
|---|---|
| `GET /api/health` | 200 `{ok}` |
| `GET /api/auth/me` | 200 con sesión / 401 sin cookie |
| `GET /api/home` | 200 (visitas, comprasDelMes, …) |
| `GET /api/catalog` | 200 (7 segmentos) |
| `GET /api/users/tecnicos` | 200 (21 técnicos) |
| `GET /api/maquinas` | 200 (1777 máquinas, 410 edificios) |
| `GET /api/maquinas/historial?concat=` | 200 / sin concat → 400 |
| `GET /api/incidentes` | 200 (52 incidentes) |
| `GET /api/compras` | 200 (pedidos + detalles) |
| `GET /api/aprobaciones` | 200 (array) |
| `GET /api/ventilaciones` (bundle y `?mes=`) | 200 (321 vents) |
| `GET /api/stock` | 200 (479 items) |
| `GET /api/stock-tecnicos` | 200 (476 repuestos) |
| `GET /api/planificaciones` | 200 (meses, resumen, técnicos, rutas) |
| `GET /api/abm` | 200 (rutas, circuitos, edificios, …) |
| `POST /api/auth/login` | vacío → 400 / inválido → 401 |
| `POST /api/auth/logout` | 200 `{ok}` |
| `GET /api/incidentes/[id]` (POST-only) | 405 |

## Mutaciones (con creación→borrado / cambio→reversión)

### Incidentes — 5/5 ✅
| Acción | Resultado | Reversión |
|---|---|---|
| `POST /api/incidentes` create | 201, Status `A Revisar` | borrar incidente |
| `POST /api/incidentes/[id]` assign | 200 `Asignado` | (borra el incidente) |
| `POST /api/incidentes/[id]` cambiar-tecnico | 200 | (idem) |
| `POST /api/incidentes/[id]` cambio-maquina | 200 `En Aprobacion`, crea 07.Aprobaciones | borrar aprobación + incidente |
| `POST /api/incidentes/[id]` generar-compra | 201, crea pedido + detalle | borrar pedido + detalle |

### Compras + Aprobaciones — 7/7 ✅
| Acción | Resultado | Reversión |
|---|---|---|
| `POST /api/compras` create | 201, `Pendiente` | borrar pedido + detalle |
| `PATCH /api/compras/[id]` edit | 200, cantidad→3 | (borra el pedido) |
| `POST /api/compras/[id]` approve-request | 200 `En Aprobacion`, crea aprobación | borrar aprobación |
| `POST /api/aprobaciones/[id]` approve | 200, pedido→`Aprobada` | (borra el pedido) |
| `POST /api/compras/[id]` receive | 200 `Recibida`, ingresa a 04.Stock | **borrar fila de stock creada** |
| `POST /api/compras/[id]` anular | 200 `Anulado` | borrar pedido |
| `POST /api/aprobaciones/[id]` reject | 200, pedido→`Rechazada` | borrar pedido |

### Stock + Stock técnicos — 7/7 ✅ (1 bug)
| Acción | Resultado | Reversión |
|---|---|---|
| `POST /api/stock` add | ⚠️ **502 — BUG (ver abajo)** | — |
| `PATCH /api/stock/[id]` | 200, setea cantidad | restaurar cantidad |
| `POST /api/stock/assign` | 200, −stock + crea repuesto técnico | borrar repuesto técnico + restaurar stock |
| `POST /api/stock-tecnicos` edit | 200 | (borra la fila) |
| `POST /api/stock-tecnicos` transfer | 200, crea fila en técnico destino | borrar fila destino |
| `POST /api/stock-tecnicos` reingreso | 200, +04.Stock | restaurar cantidad de stock |

### Ventilaciones + ABM — 6/6 ✅
| Acción | Resultado | Reversión |
|---|---|---|
| `POST /api/ventilaciones/[id]` assign | 200 `Asignada` | restaurar campos originales |
| `POST /api/ventilaciones/[id]` delete | 200 `Eliminada` | restaurar `Estado_VE` |
| `POST /api/ventilaciones` add-edificio | 201, crea ventilación + actualiza edificio | borrar ventilación + restaurar edificio |
| `POST /api/abm/rutas` create + delete | 201 + soft-delete | hard-delete ruta |
| `POST /api/abm/edificios` create + update + baja | 201 / 200 / 200 `BAJA` | hard-delete edificio |
| `POST /api/abm/circuitos` create + delete | 201 + soft-delete | hard-delete resumen + detalles (+ ruta + edificio propios) |

### Planificaciones + Máquinas — 4/4 ✅
| Acción | Resultado | Reversión |
|---|---|---|
| `POST /api/planificaciones` create + delete | 201 (1 resumen + 5 detalles + 47 edificios) + soft-delete | hard-delete todo lo generado + fila de mes |
| `POST /api/maquinas/[id]` transfer | 200 `DEPOSITO`, crea bitácora | restaurar máquina + stock + borrar bitácora |
| `POST /api/maquinas/[id]` baja | 200 `ELIMINADA`, −stock + bitácora | restaurar máquina + stock + borrar bitácora |
| `POST /api/maquinas/[id]` transfer sin destino | 400 (guard) | — |

## 🐞 Bug encontrado

**`POST /api/stock` (Agregar stock) → 502 consistente (3/3 intentos).**

Causa: [`api/stock/index.ts`](../api/stock/index.ts) filtra `04.Stock` con
`fields/Status_ST eq 'Activo' and fields/Tipo_ST eq '<TIPO>'`. La columna **`Tipo_ST`
no es consultable** por Graph `$filter` (falla 6/6, aun con el header
`HonorNonIndexedQueriesWarningMayFailRandomly`), así que el `listItems` previo tira
`GraphError` → el endpoint responde 502. El `createItem` en sí funciona (probado): el
problema es solo el `$filter` por `Tipo_ST`.

**Efecto:** "Agregar stock" está roto para agregar/incrementar ítems.

**Fix sugerido:** filtrar solo por `Status_ST eq 'Activo'` (que sí es consultable) y
matchear `Tipo_ST` + nombre **en memoria** (como ya hace `recibir` en
`api/compras/[id].ts`, que filtra solo por `Status_ST` y matchea el item en JS).

> Nota general: en estas listas `$filter` es fiable sobre `Status_*`, `IDUnivoco_*`,
> `IDCompra_*`, `IDMaquina_IN`, `Tecnico_RT`, `NroRuta_RT`, `NroCircuito_*`,
> `IDEdificio_VE`, `Micasa`, `Lodge_ST`. **NO** es fiable sobre `Tipo_ST`,
> `Categoria_IN`, `MotivoTransferencia_IN` (devuelven 400/vacío).
