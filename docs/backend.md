# Backend — Microsoft Graph + SharePoint + Vercel

> Estado: **en construcción**. `api/` habla Graph/SharePoint reales (no mock) para
> **login, home, stock, compras, aprobaciones y catálogo**. El flujo completo
> **Compras → Aprobaciones → Ingreso a stock** está implementado y **verificado end-to-end
> contra el tenant en vivo** (crear → editar → mandar a aprobar → aprobar/rechazar → recibir,
> incluyendo la recepción de máquinas que crea filas en `08.DetalleMaquina`; cada corrida
> siembra filas de prueba y las revierte). Sigue en el store mock: Incidentes, Detalle
> Máquinas, Planificaciones, Ventilaciones, Stock Técnico — este documento sirve de referencia
> para extenderlos con el mismo patrón.
>
> **Traslado de máquinas — completo**: transferir/dar de baja (`api/maquinas/[id].ts` +
> `api/_lib/maquinaMoves.ts`) con lógica de **encendido** fiel (herencia + propagación),
> **Admin directo** o **Jefe Taller → aprobación** (`Transferencia de Maquina`), y el lado de
> **aprobar** esa solicitud aplica el movimiento. Verificado e2e contra Graph (herencia,
> propagación, JT create + approve; todo revertido).
>
> **Incidentes — completo** (módulo núcleo): `api/incidentes/*` con listado + repuestos,
> nuevo incidente, asignar técnico (+ descuento de stock), cambiar técnico, cambio de máquina
> (genera aprobación *Cambio de Maquina*, cuyo **approve** descuenta la máquina de stock y marca
> el incidente `Aprobada`) y generar compra desde incidente (`05`+`06` `Aprobada`). Verificado
> e2e contra Graph (todo revertido). Los **tres tipos de aprobación** (Compra, Transferencia,
> Cambio de Maquina) están implementados; rechazar funciona para cualquiera.

## Hallazgos verificados contra el tenant real (no solo inferidos del `.msapp`)

- **`SHAREPOINT_SITE_ID` en `.env` estaba desincronizado** del ID real del sitio "Nueva" — por
  eso `api/_lib/graph.ts` **no** depende de esa variable: resuelve el site id en runtime vía
  `GET /sites/sumardigital.sharepoint.com:/sites/Nueva` y lo cachea en memoria del proceso.
- Los 35 GUIDs de lista documentados en [data-model.md](./data-model.md) coinciden exactamente
  con lo que devuelve Graph en vivo.
- Nombres de columna internos confirmados (display name → interno) para las listas ya
  implementadas: `Usuario→field_1`, `Password→field_4` (Usuarios); `Item_ST→Lodge_ST` (Stock);
  en Registros, `HoraInicio→Hora`, `HoraFinal→Fecha`, `Fecha→Fecha0`, `MesAño→MesA_x00f1_o`,
  `ObservacionGeneral→ObservacionFinal`. El resto de las columnas `_XX` usadas coincide 1:1 con
  el sufijo (sin sorpresas) — ver `api/_lib/lists.ts` para el mapeo completo y autoritativo.
- **`04.Stock` no tiene columnas para serie/ID de máquina** (`NroSerie_ST`/`IDMaquina_ST` del
  mock no existen en la lista real) — esos datos viven en `08.DetalleMaquina`. Agregar una
  máquina al stock requiere escribir **dos listas**; el endpoint actual (`POST /api/stock`)
  soporta solo repuestos y devuelve `501` si se pasa `nroSerie`/`idMaquina`, hasta que se
  implemente el flujo de `08.DetalleMaquina`.
- **`01.Registros.ImagenGral`** guarda la foto de cada visita como **base64 inline** (una fila
  de prueba pesaba ~380KB en ese solo campo) — `api/_lib/lists.ts` lo excluye siempre del
  `$select` al listar. Solo se debería pedir en una vista de detalle puntual.
- **TODAS las columnas son de tipo texto** en estas listas (confirmado con
  `GET /lists/{listId}/columns`): no solo `Cantidad_*` sino también fechas, flags SI/NO, etc.
  **Toda escritura manda strings** (`Cantidad_PC: "3"`, nunca `3`); el mapeo de lectura
  convierte con `Number(...)` donde corresponde. Mandar un número crudo a una columna de texto
  puede fallar o guardarse raro.
- **Gotchas de nombre interno en las listas de compras** (display → interno), confirmados en
  vivo y ya resueltos en `api/_lib/lists.ts` / los handlers:
  - `Título → Title` (la columna default; en **todas** las listas). Al escribir usar `Title`.
  - `04.Stock`: `Item_ST → Lodge_ST`.
  - **`08.DetalleMaquina`: `Segmento_DM → Segmentp_DM`** (typo real en SharePoint, con "p").
    La recepción de máquinas escribe `Segmentp_DM`, no `Segmento_DM` (la fórmula PowerApps usa
    el display name y PowerApps lo resuelve; Graph exige el interno).
  - **`06.DetalleCompra` NO tiene columna `Codigo_DC`** — el "código" es solo de UI (se deriva
    del catálogo), no se persiste.
- **Segmentos: dos convenciones.** El catálogo/compras usa Title Case real
  (`99.ABM_ItemCompras.Item_IC`: `Lavadora`, `Repuesto`, `Secadora Simple`…), pero `04.Stock`
  guarda `Tipo_ST` en **MAYÚSCULAS** (`LAVADORA`, `REPUESTO`). Al ingresar a stock se
  normaliza con `.toUpperCase()` para no duplicar filas.
- **`$filter` sobre columnas no indexadas** (todas las de negocio lo son) requiere el header
  `Prefer: HonorNonIndexedQueriesWarningMayFailRandomly`, si no Graph responde 400. Para listas
  chicas (ej. `99.ListaPermisosDesktop`, ~10 filas) es más simple traer todo y filtrar en
  memoria — así lo hace `modulosPermitidos()` en `api/_lib/lists.ts`.

## Arquitectura

```
Browser (React SPA)
   │  fetch('/api/...')            ← nunca habla con Graph directo
   ▼
Vercel Serverless Functions (/api/*)   ← acá viven los secretos
   │  Bearer token (client credentials)
   ▼
Microsoft Graph  →  SharePoint site "Nueva"  (listas = tablas)
```

**Regla de oro de seguridad**: el `AZURE_CLIENT_SECRET` y el token **nunca** tocan el
cliente. Todo pasa por `/api/*` en Vercel. No usar prefijo `VITE_` en estas variables (eso
las expondría en el bundle del browser).

## Autenticación (app-only / client credentials)

App registrada en Entra ID (Azure AD) con **permisos de aplicación** (admin-consent):
`Sites.ReadWrite.All` (SharePoint) y `Mail.Send` (emails). Variables en `.env`
(ver [`.env.example`](../.env.example)):

- `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`
- `SHAREPOINT_SITE_ID` — id del sitio `sumardigital.sharepoint.com/sites/Nueva`
- `EMAIL_ADDRESS` — buzón remitente de los correos

Obtener el token (grant `client_credentials`, scope `https://graph.microsoft.com/.default`):

```ts
async function getToken(): Promise<string> {
  const body = new URLSearchParams({
    client_id: process.env.AZURE_CLIENT_ID!,
    client_secret: process.env.AZURE_CLIENT_SECRET!,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });
  const res = await fetch(
    `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`,
    { method: 'POST', body }
  );
  const json = await res.json();
  return json.access_token; // dura ~1h → cachear en memoria del lambda
}
```

Resolver el `SHAREPOINT_SITE_ID` una vez (si no lo tenés a mano):
`GET /sites/sumardigital.sharepoint.com:/sites/Nueva` → propiedad `id`.

## Acceso a listas (CRUD)

Las listas se leen/escriben con Graph. Los IDs de lista (GUIDs) están en
[data-model.md](./data-model.md).

```
GET    /sites/{siteId}/lists/{listId}/items?expand=fields&$top=999   # leer (paginar con @odata.nextLink)
POST   /sites/{siteId}/lists/{listId}/items                          # crear  { fields: { ... } }
PATCH  /sites/{siteId}/lists/{listId}/items/{itemId}/fields          # actualizar
DELETE /sites/{siteId}/lists/{listId}/items/{itemId}                 # borrar
```

Los datos del negocio viven bajo `item.fields` con los **nombres de columna internos** de
SharePoint (ojo: pueden diferir del display name; verificar con
`GET /lists/{listId}/columns`). El mapeo a las interfaces de `domain.ts` (sufijos `_ST`,
`_PC`, …) se hace en una capa de adaptadores.

Consideraciones de SharePoint:
- **Paginación**: `$top` máx 999-5000; seguir `@odata.nextLink`.
- **`$filter`** sobre columnas no indexadas puede fallar en listas grandes → filtrar en
  el servidor sólo por columnas indexadas, o traer y filtrar en memoria.
- **Escrituras en lote**: usar `POST /$batch` (hasta 20 requests) para operaciones como
  recibir una compra (varios ítems → varios PATCH + alta de stock).
- **Concurrencia/consistencia**: no hay transacciones; los flujos multi-lista (ver
  [modules.md](./modules.md)) deben tolerar fallos parciales / reintentos idempotentes.

## Emails (Graph sendMail)

```
POST /users/{EMAIL_ADDRESS}/sendMail
{ "message": { "subject": "...", "body": { "contentType": "HTML", "content": "..." },
               "toRecipients": [{ "emailAddress": { "address": "..." }}] } }
```

Destinatarios desde la lista `99.ABM_Emails` (por rol). Para templates de email seguir la
sección 5 del [DESIGN.md](../DESIGN.md) (HTML inline, logo como CID). Casos: notificación de
compra a aprobar, aprobación/rechazo, etc.

## Endpoints implementados (`api/`)

Filesystem routing de Vercel. El plugin `vite-api-dev-plugin.ts` lo simula en `dev:full`
(soporta `foo.ts`, `foo/index.ts`, `foo/[id].ts`; **no** directorios dinámicos anidados como
`foo/[id]/bar.ts` — por eso las transiciones de una compra van por `POST` con `{ action }`).

```
/api
├─ _lib/graph.ts       # token+siteId cacheados, listItems/getItem/createItem/updateItem
├─ _lib/lists.ts       # GUIDs + mappers (display→interno) + helpers de fecha/segmento
├─ _lib/session.ts     # cookie httpOnly firmada (HMAC-SHA256)
├─ auth/{login,logout,me}.ts
├─ home.ts             # GET  → visitas + compras del mes
├─ catalog.ts          # GET  → { segmentos, items } (11.Respuestos + 99.ABM_MaquinasCompra)
├─ stock/index.ts      # GET (listar) / POST (agregar repuesto)   → 04.Stock
├─ stock/[id].ts       # PATCH (cantidad)
├─ stock/assign.ts     # POST → 04.Stock ↘ 99.ABMRepuestos_Tecnico
├─ users/tecnicos.ts   # GET  → técnicos activos (proyección segura)
├─ compras/index.ts    # GET (cabeceras+líneas del mes, Filtrar_PC=NO) / POST (crear 05+06)
├─ compras/[id].ts     # PATCH (editar) · POST { action }:
│                      #   approve-request → crea 07.Aprobaciones + 05→En Aprobacion
│                      #   receive         → 05→Recibida, 06→Recibida+CantIngresada,
│                      #                     ingresa a 04.Stock (+08.DetalleMaquina si es máquina)
│                      #   anular          → 06→Anulado, 05→Anulado+Filtrar SI
├─ aprobaciones/index.ts # GET → pendientes del mes (Aprobada=NO y Rechazada=NO)
├─ aprobaciones/[id].ts  # POST { action: approve|reject } (approve solo tipo Compra; ver arriba)
├─ maquinas/index.ts     # GET → TODAS las máquinas activas (pagina, sin tope de 2000),
│                        #        ordenadas Edificio→Segmento→alfabético + lista de edificios
├─ incidentes/index.ts   # GET (10.Incidentes Resuelto=NO + 13.RepuestosIncidentes) / POST (nuevo)
├─ incidentes/[id].ts    # POST { action: assign | cambiar-tecnico | cambio-maquina | generar-compra }
│                        #   assign → Asignado + descuenta 04.Stock los repuestos del incidente
│                        #   cambio-maquina → crea 07.Aprobaciones (Cambio de Maquina) + incidente En Aprobacion
├─ maquinas/historial.ts # GET ?concat=… → incidentes (10.Incidentes) de esa máquina
└─ maquinas/[id].ts      # POST { action: transfer|baja }. transfer: Admin directo /
                         #        Jefe Taller → crea 07.Aprobaciones (202). baja: Admin.
                         #        Lógica compartida en _lib/maquinaMoves.ts (encendido + stock + bitácora)
```

**Máquinas — sin el tope de 2000 de PowerApps.** `08.DetalleMaquina` tiene ~1775 filas activas.
La PowerApp original limitaba las Collect a 2000 y forzaba filtrar por edificio; el backend acá
las trae todas paginando `@odata.nextLink` (`GET /api/maquinas`, `top:999`) y el front las rinde
con una lista virtualizada. `mapMaquina` normaliza (`.trim()`) los espacios sobrantes de
`Edificio/Marca/Modelo/Segmento` (dato sucio real) y lee `Segmento_DM` de la columna interna
`Segmentp_DM`.

Cada handler valida la sesión con `readSession(req.headers.cookie)`, hace las escrituras con
`createItem/updateItem` de `_lib/graph.ts`, y devuelve al cliente ya mapeado a `domain.ts`.
Filtros: por seguridad ante columnas no indexadas, se filtra por **una** columna con el header
`Prefer` y se refina en memoria (SharePoint 400ea un `and` sobre dos columnas no indexadas).

**Config Vercel**: cargar `AZURE_*`, `SHAREPOINT_SITE_ID`, `EMAIL_ADDRESS` como *Environment
Variables* (no en el repo). `.env` local está gitignoreado.

## Auth de la app (usuarios)

Hoy el login valida contra la lista `Usuarios` (`Usuario`/`Contrasena`/`Status`/`Rol`) en el
mock. En producción, esa validación debe correr en `/api` (nunca mandar la lista de usuarios
ni contraseñas al cliente) y emitir una sesión (cookie httpOnly / JWT firmado). El gateo de
módulos por rol usa `99.ListaPermisosDesktop` + `Rol` (ver [modules.md](./modules.md)).

## Migración del mock → Graph

El frontend está desacoplado vía el store Zustand (`src/store/useAppStore.ts`): las pantallas
llaman `Collect*` (lectura) y acciones (`patchStock`, `addStock`, `removeRegistro`, …). Para
migrar, reemplazar el cuerpo de esas acciones/selectores por `fetch('/api/...')` — sin tocar
las pantallas — respetando los nombres de campo del dominio.

## Antes de implementar: leer los flujos de negocio

[modules.md](./modules.md) documenta, pantalla por pantalla, qué listas toca cada acción y los
flujos end-to-end (ciclo de compra, ciclo de incidente, alta/baja de máquina, planificación de
rutas, etc.) extraídos de las fórmulas reales de la PowerApp. Varios de esos flujos escriben en
**3 o 4 listas encadenadas** (ej. aprobar una compra, o crear una planificación mensual) — el
diseño de cada endpoint debería mapear 1:1 a uno de esos flujos, no a una lista individual.
También lista los "gotchas" del negocio (claves concatenadas en vez de FKs, ausencia de
transaccionalidad en el original, contraseñas en texto plano a migrar, WhatsApp) que conviene
resolver mejor en el backend nuevo en vez de replicarlos tal cual.
