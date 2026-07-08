# Columnas de precio a crear en SharePoint (pendiente)

La app (registro de Azure AD, auth app-only) **no tiene permiso `Sites.Manage.All`**, así
que **no puede crear columnas** vía Microsoft Graph (devuelve `403 accessDenied`). Estas
dos columnas hay que **crearlas a mano** en SharePoint (o darle ese permiso a la app y
correr el script de creación).

El código del ABM de repuestos y del dashboard de incidentes **ya está escrito
referenciando estos nombres exactos**, con default `0` cuando la columna todavía no
existe / viene vacía. Apenas se creen las columnas, todo funciona sin tocar código.

## 1. `Precio_RP` — en la lista **11.Respuestos**

- **Lista:** `11.Respuestos` (catálogo de repuestos) — GUID `92db215b-1301-4a64-8ecc-01338a66567f`
- **Nombre interno de la columna (exacto):** `Precio_RP`
- **Tipo:** Número (Currency / Number), 2 decimales
- **Para qué:** precio de catálogo de cada repuesto. Se edita desde el **ABM de Repuestos**
  (módulo "Repuestos" en el desktop).

## 2. `Precio_RI` — en la lista **13.RepuestosIncidentes**

- **Lista:** `13.RepuestosIncidentes` (repuestos usados por incidente) — GUID `e0259639-9678-454e-b3cf-5f9b5fc9c17c`
- **Nombre interno de la columna (exacto):** `Precio_RI`
- **Tipo:** Número, 2 decimales
- **Para qué:** guarda **cuánto costaba ese repuesto en el momento de cerrar la OT**
  (lo escribe la app MOBILE — otro repo — al cerrar el incidente, copiando el `Precio_RP`
  del catálogo en ese momento). El **dashboard de Incidentes** suma
  `Cantidad_RI × Precio_RI` para el KPI "Total valor de repuestos" y sus gráficos de costos.

## Cómo crearlas
En SharePoint: abrir cada lista → **Agregar columna → Número** → nombre exacto como arriba
(sin espacios, para que el nombre interno coincida). 2 decimales. Guardar.

> Ojo: si se crea con un **título con espacios/acentos**, SharePoint genera un nombre
> interno distinto (ej. `Precio_x0020_RP`). Crear el título literalmente como `Precio_RP` /
> `Precio_RI` para que el nombre interno coincida con lo que espera el código.
