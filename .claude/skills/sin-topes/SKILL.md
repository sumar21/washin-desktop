---
name: sin-topes
description: Audita y elimina topes arbitrarios de filas/opciones en la UI — listas que muestran "las primeras N" y esconden el resto. Usar cuando el usuario dice "no muestra todos los registros", "por qué corta en N", "mostrando las primeras N", "saquemos el límite", "sin topes", o al agregar una grilla/lista/dropdown nueva.
---

# Sin topes

En esta app **ninguna vista esconde datos en silencio**. Si el usuario filtró un
período y pidió una lista, la lista muestra todo lo que ese período trae.

El patrón prohibido es el tope arbitrario: `rows.slice(0, N)` con un `N` elegido
a ojo, para evitar un problema de performance que nadie midió. El costo real es
peor que el problema — una tabla que muestra 500 de 7.823 filas hace que se
tomen decisiones sobre datos incompletos, y el aviso al pie no alcanza porque
nadie lo lee.

## Qué NO es un tope prohibido

Antes de borrar un `slice`, clasificalo. Estos son legítimos y se dejan:

| Patrón | Ejemplo en el repo | Por qué está bien |
|---|---|---|
| Ranking top-N de un chart | `.slice(0, 8)` en los rankings de [DashboardVisitas](../../../src/screens/dashboard/DashboardVisitas.tsx) | El chart ES un top-N; mostrar 400 barras no informa |
| Chips con badge `+N` | `es.slice(0, 4)` + `+{extra}` en [ConfigCircuitos](../../../src/screens/config/ConfigCircuitos.tsx) | Dice cuántos faltan y la lista completa está a un click |
| Truncado de texto | `.slice(0, 2)` para iniciales, `wrapTextLines(...).slice(0, 2)` | No son registros |
| Resize de arrays de form | `resizeUnidades` en [Stock](../../../src/screens/Stock.tsx) | Ajusta a la cantidad pedida, no recorta datos |
| Page size de Graph | `top: 5000` en `listItems` | Es tamaño de página; `listItems` sigue `@odata.nextLink` y trae todo |

El tope prohibido tiene estas tres marcas juntas: **corta registros**, **el `N`
no sale de ninguna medición**, y **el usuario no puede llegar a lo que falta**.

## Procedimiento

1. **Buscar candidatos.**
   ```bash
   rg -n '\.slice\(0,|DISPLAY_CAP|maxRender|_CAP\b|MAX_|Mostrando' src/
   ```

2. **Clasificar cada hit** con la tabla de arriba. Los legítimos se dejan y no se
   tocan. Si dudás, mirá si hay un `+N`, un contador, o un camino para ver el resto.

3. **Para cada tope prohibido:**
   - Borrar el `slice` y pasar la lista completa.
   - Borrar también el cartel de "Mostrando las primeras N…" y la constante, si
     queda sin uso. Un tope a medio sacar es peor que uno entero.
   - Dejar un comentario con el volumen REAL que va a renderizar (medido, no
     estimado) y por qué se sacó. Sin eso, el próximo que vea una lista de 7.000
     filas lo vuelve a topear.

4. **Medir el volumen real** antes de dar el cambio por bueno. No estimar:
   ```bash
   npm run dev:full   # el plugin de /api sólo corre en modo full
   # y pegarle al endpoint que alimenta la vista, contando filas
   ```
   Referencias medidas (07/2026): Resumen de visitas ~1.020 filas/mes, Detalle
   por ítem ~7.800 filas/mes (≈8 ítems por visita), Home con filtro "todas"
   ~1.000 visitas/mes, catálogo de edificios ~500 opciones.

5. **Verificar** con `npx tsc -b` y `npx eslint src api`, y abrir la vista en el
   navegador con el período más grande que el usuario vaya a usar.

## Si el scroll se pone pesado

La salida **no** es volver a topear ni paginar: es **virtualizar**
[DataTable](../../../src/components/DataTable.tsx) para que renderice sólo las
filas visibles. Es el único componente de tabla de la app, así que se arregla una
vez y sirve para todas las grillas. Ojo al hacerlo: tiene columnas `sticky` y
cards mobile (`mobileCard`) que hay que no romper.

Orden de preferencia ante volumen alto:

1. Reducir el volumen en origen si el dato lo permite (agrupar, filtrar en el backend).
2. Virtualizar `DataTable`.
3. Recién entonces discutir un tope — con un número medido y visible para el usuario.

## Anti-patrón: el número inventado

Si estás por escribir un `N`, decí en voz alta de dónde sale. Si la respuesta es
"me pareció suficiente", no lo escribas. Los tres topes que tuvo esta app
(`DISPLAY_CAP = 500`, después `2000`, y `slice(0, 50)` en el Home) fueron todos
números inventados, y los tres cortaban datos que el usuario necesitaba.
