import type { MovimientoStock } from '@/services/api';

/**
 * Lógica pura del tab Stock del Dashboard: agrupar los movimientos por repuesto y ordenarlos.
 *
 * Vive fuera de `DashboardStock.tsx` a propósito — así se puede ejercitar sin React ni
 * bundler (`node scripts/stock-movimientos.check.ts`) y el .tsx queda sólo con componentes
 * (regla `react-refresh/only-export-components`).
 */

export interface GrupoRepuesto {
  clave: string;
  repuesto: string;
  entradas: number;
  salidas: number;
  /** entradas − salidas dentro del rango. No es el stock actual, es el neto del período. */
  neto: number;
  movimientos: MovimientoStock[];
}

/**
 * Agrupa por repuesto y ordena: repuestos alfabéticamente (es-AR), y dentro de cada uno los
 * movimientos por fecha ascendente. Si dos caen el mismo día va primero la entrada, que es
 * el orden en que pasan las cosas: primero entra la pieza, después se usa.
 *
 * Agrupa por `clave` (el nombre normalizado que arma el backend) y NO por `repuesto`: es la
 * misma clave con la que la recepción de compra y el descuento por incidente matchean la
 * fila de `04.Stock`, así que dos ítems que caen en el mismo grupo comparten stock de verdad.
 *
 * `saldos` suma los repuestos que NO tuvieron movimientos en el período, como grupos vacíos.
 * No es relleno: un repuesto quieto con stock en cero es exactamente lo que hay que ver en un
 * reporte de stock, y si sólo se listara lo que se movió, desaparecería de la pantalla.
 */
export function agruparMovimientos(
  movimientos: MovimientoStock[],
  saldos: Record<string, { repuesto: string }> = {}
): GrupoRepuesto[] {
  const grupos = new Map<string, GrupoRepuesto>();
  const nuevo = (clave: string, repuesto: string): GrupoRepuesto => ({
    clave,
    repuesto,
    entradas: 0,
    salidas: 0,
    neto: 0,
    movimientos: [],
  });
  for (const m of movimientos) {
    let g = grupos.get(m.clave);
    if (!g) {
      g = nuevo(m.clave, m.repuesto);
      grupos.set(m.clave, g);
    }
    if (m.tipo === 'entrada') g.entradas += m.cantidad;
    else g.salidas += m.cantidad;
    g.movimientos.push(m);
  }
  for (const [clave, s] of Object.entries(saldos)) {
    if (!grupos.has(clave)) grupos.set(clave, nuevo(clave, s.repuesto));
  }
  const out = [...grupos.values()];
  for (const g of out) {
    g.neto = g.entradas - g.salidas;
    g.movimientos.sort(
      (a, b) =>
        a.orden - b.orden ||
        (a.tipo === b.tipo ? 0 : a.tipo === 'entrada' ? -1 : 1) ||
        a.referencia.localeCompare(b.referencia, 'es')
    );
  }
  // Primero los que SÍ se movieron y después los quietos; alfabético dentro de cada bloque.
  // Los quietos son contexto ("esto no se tocó"), no la noticia: si se mezclaran alfabéticamente
  // habría que ir cazando entre ellos los repuestos que efectivamente tuvieron actividad.
  return out.sort(
    (a, b) =>
      Number(b.movimientos.length > 0) - Number(a.movimientos.length > 0) ||
      a.repuesto.localeCompare(b.repuesto, 'es')
  );
}

/**
 * Aplana los grupos a filas planas para el .xlsx, en el mismo orden que se ven en pantalla
 * (repuesto alfabético → fecha ascendente), así el archivo cuenta la misma historia.
 *
 * DOS decisiones que hacen que el Excel sea usable:
 *  · La cantidad va CON SIGNO (entradas +, salidas −): una tabla dinámica suma la columna y
 *    da el neto directo, sin fórmulas a mano.
 *  · NO se exportan filas de subtotal por repuesto. Si existieran, cualquier suma contaría
 *    cada movimiento dos veces —una en su fila y otra dentro del subtotal— y el total daría
 *    un número creíble y equivocado. El subtotal se recalcula solo en la dinámica.
 */
export function filasExcel(
  grupos: GrupoRepuesto[],
  saldos: Record<string, { hoy: number }> = {}
): Record<string, string | number>[] {
  return grupos.flatMap((g) => {
    const stockHoy = saldos[g.clave]?.hoy ?? '';
    // Un repuesto sin movimientos igual sale, con una fila en 0: si no, la pantalla y el
    // archivo mostrarían listas distintas.
    if (g.movimientos.length === 0) {
      return [
        {
          Repuesto: g.repuesto,
          Movimiento: 'Sin movimientos',
          Fecha: '',
          Cantidad: 0,
          Referencia: '',
          Detalle: '',
          'Qué se hizo': '',
          'Stock hoy': stockHoy,
        },
      ];
    }
    return g.movimientos.map((m) => ({
      Repuesto: g.repuesto,
      Movimiento: m.tipo === 'entrada' ? 'Compra' : 'Orden de trabajo',
      Fecha: m.fecha,
      Cantidad: m.tipo === 'entrada' ? m.cantidad : -m.cantidad,
      Referencia: m.referencia,
      Detalle: m.principal,
      'Qué se hizo': m.nota,
      'Stock hoy': stockHoy,
    }));
  });
}

/** Texto buscable de un movimiento: junta las dos líneas del detalle. */
const textoDetalle = (m: { principal: string; nota: string }) =>
  [m.principal, m.nota].filter((p) => p.trim()).join(' · ');

/** ¿El grupo matchea el texto buscado? Busca por repuesto y por referencia/detalle. */
export function grupoMatchea(g: GrupoRepuesto, termino: string): boolean {
  const t = termino.trim().toLowerCase();
  if (!t) return true;
  return (
    g.clave.includes(t) ||
    g.movimientos.some((m) => `${m.referencia} ${textoDetalle(m)}`.toLowerCase().includes(t))
  );
}
