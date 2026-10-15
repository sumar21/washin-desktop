import assert from 'node:assert/strict';
import { faltantesDeStock, mensajeFaltantes } from '../api/_lib/stockSuficiente.ts';

/**
 * Check de "no se asigna sin stock" (api/_lib/stockSuficiente.ts).
 *
 *   node scripts/asignar-stock.check.ts
 *
 * Mismo esquema que stock-movimientos.check.ts: Node borra los tipos solo, `node:assert` a secas.
 */

const correa = 'L82 - Correa Verde Speed Queen';
const linea = (Repuesto_RI: string, Cantidad_RI: number) => ({ Repuesto_RI, Cantidad_RI });
const fila = (Item_ST: string, Cantidad_ST: number) => ({ Item_ST, Cantidad_ST });

// 1. Alcanza → sin faltantes.
assert.deepEqual(faltantesDeStock([linea(correa, 1)], [fila(correa, 2)]), []);
// 2. El caso del 07/10/2026: depósito en 0, se pide 1 → falta.
assert.deepEqual(faltantesDeStock([linea(correa, 1)], [fila(correa, 0)]), [{ repuesto: correa, hay: 0, necesita: 1 }]);
// 3. Dos líneas del mismo repuesto se suman (1 + 1 = 2) contra 1 en depósito.
assert.deepEqual(faltantesDeStock([linea(correa, 1), linea(correa, 1)], [fila(correa, 1)]), [{ repuesto: correa, hay: 1, necesita: 2 }]);
// 4. Mismo match que el descuento: ignora mayúsculas y espacios de más.
assert.deepEqual(faltantesDeStock([linea('  l82 - correa verde SPEED QUEEN ', 1)], [fila(correa, 3)]), []);
// 5. Repuesto sin fila en el stock → cuenta como 0.
assert.deepEqual(faltantesDeStock([linea('Bomba X', 2)], [fila(correa, 5)]), [{ repuesto: 'Bomba X', hay: 0, necesita: 2 }]);
// 6. Líneas en 0 (anuladas al resolver) no piden nada.
assert.deepEqual(faltantesDeStock([linea(correa, 0)], [fila(correa, 0)]), []);
// 7. Saldo negativo heredado cuenta como 0, no como "debe".
assert.deepEqual(faltantesDeStock([linea(correa, 1)], [fila(correa, -3)]), [{ repuesto: correa, hay: 0, necesita: 1 }]);
// 8. Varios repuestos: sólo se informan los que no alcanzan.
assert.deepEqual(
  faltantesDeStock([linea(correa, 1), linea('Bomba X', 1)], [fila(correa, 4), fila('Bomba X', 0)]),
  [{ repuesto: 'Bomba X', hay: 0, necesita: 1 }]
);
// 9. Incidente sin repuestos (p. ej. cambio de máquina aprobado) → nunca bloquea.
assert.deepEqual(faltantesDeStock([], []), []);
// 10. Mensaje legible, con singular/plural.
assert.equal(
  mensajeFaltantes([{ repuesto: correa, hay: 0, necesita: 1 }, { repuesto: 'Bomba X', hay: 1, necesita: 3 }]),
  `No hay stock suficiente en el depósito para asignar: ${correa} (hay 0, se necesita 1); Bomba X (hay 1, se necesitan 3). Generá la compra o asigná cuando ingrese.`
);

console.log('asignar-stock: 10 checks OK');
