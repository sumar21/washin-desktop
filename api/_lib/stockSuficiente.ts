// ¿Alcanza el depósito para asignar un incidente? Puro y SIN imports: lo usan el assign
// (api/incidentes/[id].ts) y su check (scripts/asignar-stock.check.ts, corre con `node` a secas).
//
// Decisión de gerencia (15/10/2026): NO se asigna un incidente si 04.Stock no cubre sus repuestos.
// Antes el assign descontaba con Math.max(0, …) —igual que la PowerApp— y lo que faltaba se perdía
// sin aviso: el 07/10/2026 se asignaron 4 incidentes de 1 correa verde con 2 en depósito, las 2
// últimas quedaron 0 → 0 y, al recibir la compra de 8, el depósito marcó 2 de más.

export interface LineaRepuesto {
  Repuesto_RI: string;
  Cantidad_RI: number;
}

export interface FilaStock {
  Item_ST: string;
  Cantidad_ST: number;
}

export interface Faltante {
  repuesto: string;
  hay: number;
  necesita: number;
}

/** Misma clave con la que descontarRepuestos y el hasStock del front matchean Repuesto_RI ↔ Item_ST. */
const clave = (s: string) => String(s ?? '').trim().toLowerCase();

/**
 * Repuestos del incidente que el depósito no cubre. Las líneas del mismo repuesto se SUMAN (dos
 * líneas de 1 piden 2). Un repuesto sin fila en el stock cuenta como 0, y un saldo negativo
 * heredado también. `stock` son las filas activas de 04.Stock; se toma la primera que matchee,
 * igual que el descuento.
 */
export function faltantesDeStock(lineas: LineaRepuesto[], stock: FilaStock[]): Faltante[] {
  const pedido = new Map<string, { repuesto: string; cantidad: number }>();
  for (const l of lineas) {
    if (!(l.Cantidad_RI > 0)) continue;
    const k = clave(l.Repuesto_RI);
    const prev = pedido.get(k);
    pedido.set(k, { repuesto: prev?.repuesto ?? l.Repuesto_RI.trim(), cantidad: (prev?.cantidad ?? 0) + l.Cantidad_RI });
  }
  const faltan: Faltante[] = [];
  for (const [k, p] of pedido) {
    const fila = stock.find((s) => clave(s.Item_ST) === k);
    const hay = Math.max(0, fila?.Cantidad_ST ?? 0);
    if (hay < p.cantidad) faltan.push({ repuesto: p.repuesto, hay, necesita: p.cantidad });
  }
  return faltan;
}

/** Mensaje para el usuario (lo muestra el modal de asignar). */
export function mensajeFaltantes(faltan: Faltante[]): string {
  const detalle = faltan
    .map((f) => `${f.repuesto} (hay ${f.hay}, se necesita${f.necesita === 1 ? '' : 'n'} ${f.necesita})`)
    .join('; ');
  return `No hay stock suficiente en el depósito para asignar: ${detalle}. Generá la compra o asigná cuando ingrese.`;
}
