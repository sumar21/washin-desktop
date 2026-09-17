import assert from 'node:assert/strict';
import { agruparMovimientos, grupoMatchea, filasExcel } from '../src/screens/dashboard/stockMovimientos.ts';
import type { MovimientoStock } from '../src/services/api.ts';

/**
 * Check del agrupado/orden del tab Stock del Dashboard.
 *
 *   node scripts/stock-movimientos.check.ts
 *
 * Node ≥22.6 borra los tipos solo (el repo ya compila con `erasableSyntaxOnly`), así que
 * corre sin transpilar ni instalar nada. Sin framework a propósito: es `node:assert`.
 */

const mov = (p: Partial<MovimientoStock> & Pick<MovimientoStock, 'tipo' | 'repuesto' | 'cantidad' | 'orden'>): MovimientoStock => ({
  fecha: `${String(p.orden % 100).padStart(2, '0')}/${String(Math.floor(p.orden / 100) % 100).padStart(2, '0')}/${Math.floor(p.orden / 10000)}`,
  clave: p.repuesto.trim().toLowerCase(),
  referencia: '',
  principal: '',
  nota: '',
  ...p,
});

// ── 1. Agrupa por `clave`, no por el texto crudo: el mismo repuesto escrito distinto
//       (espacios / mayúsculas) es UNA sola fila de 04.Stock, así que va a un solo grupo.
{
  const grupos = agruparMovimientos([
    mov({ tipo: 'salida', repuesto: '  MT-220 - AGITADOR ', cantidad: 2, orden: 20260210 }),
    mov({ tipo: 'entrada', repuesto: 'MT-220 - Agitador', cantidad: 5, orden: 20260205 }),
  ]);
  assert.equal(grupos.length, 1, 'mismo repuesto con distinto casing/espacios debe caer en un grupo');
  assert.equal(grupos[0].entradas, 5);
  assert.equal(grupos[0].salidas, 2);
  assert.equal(grupos[0].neto, 3);
}

// ── 2. Orden: repuestos alfabéticamente; adentro, por fecha ascendente.
{
  const grupos = agruparMovimientos([
    mov({ tipo: 'entrada', repuesto: 'Zapata', cantidad: 1, orden: 20260101 }),
    mov({ tipo: 'salida', repuesto: 'Correa', cantidad: 3, orden: 20260315 }),
    mov({ tipo: 'entrada', repuesto: 'Correa', cantidad: 4, orden: 20260102 }),
    mov({ tipo: 'salida', repuesto: 'Correa', cantidad: 1, orden: 20260228 }),
  ]);
  assert.deepEqual(
    grupos.map((g) => g.repuesto),
    ['Correa', 'Zapata'],
    'los grupos van alfabéticos'
  );
  assert.deepEqual(
    grupos[0].movimientos.map((m) => m.orden),
    [20260102, 20260228, 20260315],
    'dentro del grupo, cronológico ascendente'
  );
}

// ── 3. Empate de fecha: primero la entrada (entra la pieza, después se usa).
{
  const [g] = agruparMovimientos([
    mov({ tipo: 'salida', repuesto: 'Perilla', cantidad: 1, orden: 20260301, referencia: '#77' }),
    mov({ tipo: 'entrada', repuesto: 'Perilla', cantidad: 9, orden: 20260301, referencia: 'PC-1' }),
  ]);
  assert.deepEqual(g.movimientos.map((m) => m.tipo), ['entrada', 'salida']);
}

// ── 4. Neto negativo: se consumió más de lo que entró en el período (stock viejo).
{
  const [g] = agruparMovimientos([
    mov({ tipo: 'salida', repuesto: 'Resistencia', cantidad: 7, orden: 20260310 }),
    mov({ tipo: 'entrada', repuesto: 'Resistencia', cantidad: 2, orden: 20260305 }),
  ]);
  assert.equal(g.neto, -5, 'el neto del período puede ser negativo y NO es el stock actual');
}

// ── 5. Sin movimientos → sin grupos (el front muestra el EmptyState).
assert.deepEqual(agruparMovimientos([]), []);

// ── 6. Búsqueda: por repuesto y también por referencia/detalle del movimiento.
{
  const [g] = agruparMovimientos([
    mov({
      tipo: 'salida',
      repuesto: 'Bomba de desagote',
      cantidad: 1,
      orden: 20260320,
      referencia: '#1042',
      principal: 'Torre Belgrano · J. Pérez',
      nota: 'Mecánico · No desagota',
    }),
  ]);
  assert.equal(grupoMatchea(g, ''), true, 'sin término, pasa todo');
  assert.equal(grupoMatchea(g, 'BOMBA'), true, 'busca por repuesto, sin importar el casing');
  assert.equal(grupoMatchea(g, '1042'), true, 'busca por número de orden de trabajo');
  assert.equal(grupoMatchea(g, 'belgrano'), true, 'busca por edificio/técnico (línea principal)');
  assert.equal(grupoMatchea(g, 'desagota'), true, 'busca también dentro de la nota de qué se hizo');
  assert.equal(grupoMatchea(g, 'lavadora'), false);
}

// ── 7. Filas del Excel: mismo orden que la pantalla, cantidad con signo y SIN subtotales.
{
  const grupos = agruparMovimientos([
    mov({ tipo: 'salida', repuesto: 'Zapata', cantidad: 1, orden: 20260305 }),
    mov({ tipo: 'entrada', repuesto: 'Correa', cantidad: 4, orden: 20260210 }),
    mov({ tipo: 'salida', repuesto: 'Correa', cantidad: 2, orden: 20260301 }),
  ]);
  const filas = filasExcel(grupos, { correa: { hoy: 17 } });

  assert.deepEqual(
    filas.map((f) => [f.Repuesto, f.Fecha]),
    [
      ['Correa', '10/02/2026'],
      ['Correa', '01/03/2026'],
      ['Zapata', '05/03/2026'],
    ],
    'el archivo sale en el mismo orden que la pantalla'
  );
  assert.equal(filas.length, 3, 'una fila por movimiento: NINGÚN subtotal (duplicaría las sumas)');
  assert.deepEqual(
    filas.map((f) => f.Cantidad),
    [4, -2, -1],
    'la cantidad va con signo: entradas +, salidas −'
  );
  assert.equal(
    filas.reduce((a, f) => a + (f.Cantidad as number), 0),
    1,
    'sumar la columna da el neto real (4 − 2 − 1) — es el punto de exportar con signo'
  );
  assert.equal(filas[0]['Stock hoy'], 17, 'pega el saldo actual del repuesto');
  assert.equal(filas[2]['Stock hoy'], '', 'sin ficha en 04.Stock la celda va vacía, no en 0');
}

// ── 8. Repuestos SIN movimientos en el período: se listan igual, con el grupo vacío.
{
  const grupos = agruparMovimientos([mov({ tipo: 'salida', repuesto: 'Correa', cantidad: 2, orden: 20260301 })], {
    correa: { repuesto: 'Correa', hoy: 5 },
    zapata: { repuesto: 'Zapata', hoy: 0 },
  });
  assert.deepEqual(
    grupos.map((g) => [g.repuesto, g.movimientos.length]),
    [
      ['Correa', 1],
      ['Zapata', 0],
    ],
    'el repuesto quieto entra al listado'
  );

  // Y los quietos van DESPUÉS de los que se movieron, aunque alfabéticamente irían antes.
  const orden = agruparMovimientos([mov({ tipo: 'salida', repuesto: 'Zapata', cantidad: 1, orden: 20260301 })], {
    zapata: { repuesto: 'Zapata', hoy: 3 },
    correa: { repuesto: 'Correa', hoy: 9 },
  });
  assert.deepEqual(
    orden.map((g) => g.repuesto),
    ['Zapata', 'Correa'],
    'primero los que tuvieron movimientos; el quieto queda al final pese a ir antes alfabéticamente'
  );
  const zapata = grupos[1];
  assert.deepEqual([zapata.entradas, zapata.salidas, zapata.neto], [0, 0, 0], 'sin movimientos, todo en cero');

  // Y también sale en el Excel, con una fila en 0: pantalla y archivo listan lo mismo.
  const filas = filasExcel(grupos, { correa: { hoy: 5 }, zapata: { hoy: 0 } });
  assert.deepEqual(
    filas.map((f) => [f.Repuesto, f.Movimiento, f.Cantidad]),
    [
      ['Correa', 'Orden de trabajo', -2],
      ['Zapata', 'Sin movimientos', 0],
    ]
  );
  assert.equal(
    filas.reduce((a, f) => a + (f.Cantidad as number), 0),
    -2,
    'la fila en 0 no altera el neto'
  );
}

console.log('✓ stock-movimientos: 8 checks OK');
