# Tests de endpoints (e2e contra SharePoint real)

Suite de integración que ejercita **todos** los endpoints de `api/` contra el
backend real (Microsoft Graph / SharePoint), incluidas las **mutaciones**.

> ⚠️ **Toca datos productivos.** Cada mutación se **revierte**: lo que se crea se
> borra (hard-delete vía Graph) y los cambios de estado/stock se restauran a su
> valor original capturado antes del test. Aun así, corré con criterio.

## Requisitos

1. `npm run dev:full` corriendo en `http://localhost:5173` (simula el routing de Vercel).
2. `.env` en la raíz con `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`
   (para que el harness pueda capturar/revertir/borrar vía Graph) y `SESSION_SECRET`
   (para firmar una cookie de sesión Admin de prueba).

## Correr

```bash
node scripts/endpoint-tests/run-all.mjs      # todas las suites + resumen
node scripts/endpoint-tests/reads.mjs        # solo lecturas + auth
node scripts/endpoint-tests/mut_stock.mjs    # una suite puntual
```

## Cómo funciona (`lib.mjs`)

- `api(method, path, body)` → llama al endpoint local con cookie Admin.
- `graph.{list,get,create,patch,del}` → Graph directo para **capturar** el estado
  previo, **verificar** el efecto y **revertir/borrar** al final.
- `makeRunner()` → registra cada test y una **pila de cleanups LIFO** que se ejecuta
  siempre en el `finally` (incluso si un test falla), y reporta si algún cleanup falló.

## Patrón de mutación + reversión

- **Crear** (incidente, compra, ruta, edificio, circuito, planificación) → se borra
  el/los item(s) creado(s) con `graph.del`.
- **Cambio de estado** (assign, anular, aprobar, baja de ventilación) → se captura el
  item original y se restaura con `graph.patch` (ojo: columnas NUMBER como
  `IDAsignado_VE`/`Frecuencia_ED` se revierten con `null`, no con `''`).
- **Cambio de stock** (receive, assign, transfer, reingreso, transfer/baja de máquina)
  → se captura la cantidad previa y se restaura; las filas creadas se borran.
- **Máquinas**: `transfer`/`baja` crean una bitácora en `10.Incidentes`. Se encuentra
  filtrando por `IDMaquina_IN` (columna consultable) y se borra. Nota: `Categoria_IN`,
  `Tipo_ST` y `MotivoTransferencia_IN` **no** son consultables en Graph ($filter falla).

Ver resultados y hallazgos en [`docs/ENDPOINT_TESTS.md`](../../docs/ENDPOINT_TESTS.md).
