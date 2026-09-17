import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listItems, GraphError, type SharePointItem } from '../_lib/graph.js';
import {
  LIST_IDS,
  mapDetalleCompra,
  detalleCompraSelectFields,
  mapIncidente,
  incidenteSelectFields,
  mapRepuestoIncidente,
  repuestoIncidenteSelectFields,
  mapStock,
  stockSelectFields,
  mapPedidoCompra,
  pedidoCompraSelectFields,
  fechasHoy,
} from '../_lib/lists.js';
import { readSession } from '../_lib/session.js';

/**
 * Dashboard de Stock (GET, read-only) — movimientos de REPUESTOS en un rango de DÍAS.
 *
 * Query: `?desde=dd/mm/yyyy&hasta=dd/mm/yyyy`. Sin params → últimos 30 días.
 *
 * Devuelve una lista PLANA de movimientos; el front agrupa por repuesto y ordena por fecha.
 *
 *  · entrada → línea de `06.DetalleCompra` en `Recibida` con segmento "Repuesto".
 *    Cantidad = `CantidadIngresada_DC` (la real, no la pedida).
 *  · salida  → fila de `13.RepuestosIncidentes` cuyo incidente tiene `FechaAsignada_IN`.
 *    Ese es exactamente el momento en que `assign` descuenta de `04.Stock`
 *    (ver `descontarRepuestos` en api/incidentes/[id].ts); al desasignar el campo se
 *    limpia, así que un incidente desasignado deja de contar como salida. Es el único
 *    criterio que matchea 1:1 el movimiento real de stock.
 *
 * LIMITACIÓN CONOCIDA — fecha de la entrada. `06.DetalleCompra` NO tiene columna de fecha
 * de recepción: `recibir()` sólo escribe `Status_DC` + `CantidadIngresada_DC`. La única
 * fecha de la línea es `Fecha_DC`, que es cuándo se GENERÓ la compra. Una compra pedida el
 * 05/01 y recibida el 20/02 aparece como movimiento del 05/01. Para tener la fecha real de
 * ingreso hay que crear una columna `FechaRecibida_DC` en SharePoint y escribirla en
 * `recibir()`; el front ya rotula la columna como "Fecha compra" para no mentir.
 *
 * SALDO AL CIERRE — por qué es una estimación y no un dato. `04.Stock` guarda SALDOS, no
 * historial: `Cantidad_ST` se pisa en cada movimiento y no existe ninguna lista con el saldo
 * de una fecha pasada. Así que el saldo al cierre de un período pasado se RECONSTRUYE hacia
 * atrás: saldo de hoy − (entradas − salidas posteriores al fin del período).
 *
 * Esa reconstrucción sólo conoce los dos flujos que este endpoint sigue (compras y OT), y a
 * `04.Stock` lo tocan además:
 *   · `POST /api/stock/assign`  — entrega de repuestos a un técnico (descuenta),
 *   · reingreso desde Stock Técnico (suma),
 *   · `PATCH /api/stock/:id`    — corrección manual de cantidad (Admin).
 * Ninguno de los tres deja fecha: `99.ABMRepuestos_Tecnico` no tiene columna de fecha y
 * `04.Stock` sólo guarda `FechaUltMod_ST` (la ÚLTIMA). Por eso no se pueden rebobinar, y el
 * saldo al cierre puede diferir del real si hubo movimientos de esos después del período.
 * Se devuelve marcado con `estimado: true` y el front lo muestra con "~".
 *
 * Cuando el período termina HOY no hay nada que rebobinar: `cierre === hoy`, exacto,
 * `estimado: false`. Ése es el caso por defecto (últimos 30 días).
 *
 * CLAVE DE UNIÓN entre entradas y salidas: el nombre del ítem normalizado
 * (`trim().toLowerCase()`). No es arbitrario — es la MISMA clave con la que los dos flujos
 * tocan `04.Stock`: la recepción matchea `Item_DC` contra `Item_ST` y el descuento matchea
 * `Repuesto_RI` contra `Item_ST`. Si dos ítems caen en el mismo grupo acá, es porque también
 * comparten fila de stock.
 *
 * Estrategia de fetch: SharePoint sólo indexa columnas de MES (`FechaMesAno_DC`,
 * `FechaMesAno_IN`, `FechaMes_RI`), no de día. Se filtra server-side con un OR por los meses
 * que toca el rango y después se recorta al día exacto en memoria — mismo patrón (y mismos
 * fallbacks) que `api/dashboard/incidentes.ts`.
 */

const DEFAULT_DIAS = 30;
/** Tope de meses del OR server-side: filtros más largos los rechaza Graph. */
const MAX_MESES = 24;

export interface MovimientoStock {
  tipo: 'entrada' | 'salida';
  /** dd/mm/yyyy — para entradas es la fecha de COMPRA (ver limitación arriba). */
  fecha: string;
  /** yyyymmdd: ordena sin re-parsear en el front. */
  orden: number;
  /** Nombre del repuesto tal cual figura en el origen. */
  repuesto: string;
  /** Nombre normalizado — clave de agrupación entre entradas y salidas. */
  clave: string;
  cantidad: number;
  /** Compra (IDUnivoco_PC) u orden de trabajo (#ID de incidente). */
  referencia: string;
  /**
   * Línea principal del detalle — lo que se escanea de un vistazo.
   * Salida: edificio · técnico. Entrada: marca.
   */
  principal: string;
  /**
   * Anotación secundaria, en chico y debajo de `principal`.
   * Salida: QUÉ se hizo (categoría + descripción). Entrada: origen (compra por OT).
   * Va aparte y no pegada con ' · ' para que el front pueda jerarquizar las dos líneas.
   */
  nota: string;
}

/**
 * Saldo de un repuesto. `hoy` sale derecho de `04.Stock.Cantidad_ST`; `cierre` es ese saldo
 * "rebobinado" restándole los movimientos posteriores al fin del período (ver `estimado`).
 */
export interface SaldoRepuesto {
  /** Nombre del repuesto según 04.Stock — permite listarlo aunque no haya tenido movimientos. */
  repuesto: string;
  hoy: number;
  cierre: number;
  /**
   * `true` cuando `cierre` es una RECONSTRUCCIÓN, no un dato guardado. Ver la nota de
   * SALDO AL CIERRE arriba: sólo es exacto cuando el período termina hoy.
   */
  estimado: boolean;
}

// ── Helpers de fecha ────────────────────────────────────────────────────────

/** 'dd/mm/yyyy' → yyyymmdd, o null si no parsea. */
function dmyKey(s?: string): number | null {
  const m = s?.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  if (d < 1 || d > 31 || mo < 1 || mo > 12) return null;
  return y * 10000 + mo * 100 + d;
}

/** yyyymmdd → 'dd/mm/yyyy' (inversa de `dmyKey`). */
function fmtKey(k: number): string {
  const d = k % 100;
  const m = Math.floor(k / 100) % 100;
  const y = Math.floor(k / 10000);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

/** 'dd/mm/yyyy' de hace `diasAtras` días, en hora de Argentina. */
function fechaAr(diasAtras = 0): string {
  return fechasHoy(new Date(Date.now() - diasAtras * 86_400_000)).fecha;
}

/**
 * Meses 'mm/yyyy' que toca el rango [desdeKey..hastaKey], más `atras` meses extra
 * hacia el pasado. El extra existe porque una salida se fecha con `FechaAsignada_IN`,
 * que puede caer meses después del alta del incidente: filtrar `10.Incidentes` sólo por
 * los meses del rango perdería los incidentes viejos asignados dentro del rango.
 */
function mesesDelRango(desdeKey: number, hastaKey: number, atras = 0): string[] {
  const idx = (k: number) => Math.floor(k / 10000) * 12 + (Math.floor(k / 100) % 100) - 1;
  const lo = idx(desdeKey) - atras;
  const hi = idx(hastaKey);
  const out: string[] = [];
  for (let i = hi; i >= lo && out.length < MAX_MESES; i--) {
    const y = Math.floor(i / 12);
    const m = (i % 12) + 1;
    out.push(`${String(m).padStart(2, '0')}/${y}`);
  }
  return out;
}

/** Trae una lista filtrando por un OR de meses; si Graph rechaza el filtro, cae a traer todo. */
async function listWithMonthFilter(
  listId: string,
  select: string[],
  campo: string,
  meses: string[]
): Promise<SharePointItem[]> {
  const filter = meses.map((m) => `fields/${campo} eq '${m}'`).join(' or ');
  try {
    return await listItems(listId, { select, filter, top: 999 });
  } catch (err) {
    if (!(err instanceof GraphError)) throw err;
    return await listItems(listId, { select, top: 999 });
  }
}

const norm = (s: string) => s.trim().toLowerCase();
const esRepuesto = (segmento: string) => norm(segmento) === 'repuesto';

/**
 * Tope de la descripción libre del incidente. El front la muestra ENTERA (envuelve, no
 * trunca), así que esto ya no es un recorte de diseño sino una red contra un caso patológico:
 * `Descripcion_IN` es texto libre sin límite en SharePoint y un pegote de 5.000 caracteres
 * inflaría el payload y haría una fila de media pantalla. 300 cubre cualquier descripción real.
 */
const DESC_MAX = 300;

const juntar = (partes: (string | undefined)[]) => partes.filter((p) => p && p.trim()).join(' · ');

/**
 * Detalle de una salida, en dos niveles:
 *  · principal → DÓNDE y QUIÉN (edificio · técnico): lo que se escanea recorriendo la lista.
 *  · nota      → QUÉ se hizo. `Titulo_IN` (= `Categoria_IN`, y si no `NoResuelto_IN`) es el
 *    dato estructurado —Mecánico, Agua, Placa, Cambio de Maquina— y la descripción libre
 *    agrega el detalle concreto cuando existe.
 *
 * La descripción va recortada: son campos de texto sin tope en SharePoint y una fila de
 * grilla no es lugar para un párrafo. El front muestra el texto completo en el tooltip.
 */
function detalleSalida(inc: ReturnType<typeof mapIncidente>): { principal: string; nota: string } {
  const desc = (inc.DescripcionIncidente_IN ?? '').trim().replace(/\s+/g, ' ');
  return {
    principal: juntar([inc.NombreEdificio_IN, inc.TecnicoAsignado_IN]),
    nota: juntar([inc.Titulo_IN, desc.length > DESC_MAX ? `${desc.slice(0, DESC_MAX).trimEnd()}…` : desc]),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!readSession(req.headers.cookie)) return res.status(401).json({ error: 'no_session' });

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  // Rango en días. Un extremo inválido o ausente cae al default de 30 días; invertido se da
  // vuelta (el front ya arrastra el otro extremo, esto es el cinturón del lado servidor).
  const qDesde = typeof req.query.desde === 'string' ? req.query.desde : '';
  const qHasta = typeof req.query.hasta === 'string' ? req.query.hasta : '';
  const hoyKey = dmyKey(fechaAr(0))!;
  // ponytail: DEFAULT_DIAS - 1 para que el default sean 30 días CONTANDO hoy, no 31.
  let desdeKey = dmyKey(qDesde) ?? dmyKey(fechaAr(DEFAULT_DIAS - 1))!;
  let hastaKey = dmyKey(qHasta) ?? hoyKey;
  if (desdeKey > hastaKey) [desdeKey, hastaKey] = [hastaKey, desdeKey];
  // No hay movimientos en el futuro: un rango que se pasa de hoy se recorta. El date picker
  // ya no deja elegirlas, pero la query string es un borde de confianza — se valida igual.
  if (hastaKey > hoyKey) hastaKey = hoyKey;
  if (desdeKey > hastaKey) desdeKey = hastaKey;

  // Se trae la VENTANA COMPLETA hasta hoy, no sólo el rango pedido: los movimientos
  // posteriores al cierre son los que permiten rebobinar el saldo (ver SALDO AL CIERRE).
  const enVentana = (k: number | null) => k != null && k >= desdeKey && k <= hoyKey;
  const cierreEsHoy = hastaKey === hoyKey;

  try {
    const mesesCompra = mesesDelRango(desdeKey, hoyKey);
    // 12 meses de margen: cubre incidentes viejos asignados dentro de la ventana sin traer
    // la lista entera.
    const mesesIncidente = mesesDelRango(desdeKey, hoyKey, 12);

    const [compraRows, pedidoRows, incRows, stockRows] = await Promise.all([
      listWithMonthFilter(LIST_IDS.detalleCompra, detalleCompraSelectFields(), 'FechaMesAno_DC', mesesCompra),
      listWithMonthFilter(LIST_IDS.pedidoCompras, pedidoCompraSelectFields(), 'FechaMesAno_PC', mesesCompra),
      listWithMonthFilter(LIST_IDS.incidentes, incidenteSelectFields(), 'FechaMesAno_IN', mesesIncidente),
      listItems(LIST_IDS.stock, { select: stockSelectFields(), filter: `fields/Status_ST eq 'Activo'` }),
    ]);

    // Cabecera de cada compra, indexada por su clave de join. `06.DetalleCompra` sólo guarda
    // `IDCompra_DC` (= `IDUnivoco_PC`), que es una clave INTERNA: la app identifica un pedido
    // por su ID numérico de SharePoint ("Pedido #123" en Compras y en el modal de recepción).
    // Sin este join la referencia de la entrada mostraría el ID unívoco crudo.
    const pedidoPorUnivoco = new Map(pedidoRows.map(mapPedidoCompra).map((p) => [p.IDUnivoco_PC, p]));

    // Todos los movimientos de la ventana [desde..hoy]; después se parten en los del rango
    // pedido (los que se muestran) y los posteriores (sólo para el saldo al cierre).
    const ventana: MovimientoStock[] = [];

    // ── Entradas: líneas de compra RECIBIDAS de segmento "Repuesto" ──
    for (const d of compraRows.map(mapDetalleCompra)) {
      if (d.Status_DC !== 'Recibida' || !esRepuesto(d.Segmento_DC)) continue;
      const orden = dmyKey(d.Fecha_DC);
      if (!enVentana(orden)) continue;
      // Si la recepción no guardó cantidad real, la pedida es la mejor aproximación.
      const cantidad = d.CantidadIngresada_DC ?? d.Cantidad_DC;
      if (cantidad <= 0) continue;
      const pedido = pedidoPorUnivoco.get(d.IDCompra_DC);
      ventana.push({
        tipo: 'entrada',
        fecha: d.Fecha_DC,
        orden: orden!,
        repuesto: d.Item_DC,
        clave: norm(d.Item_DC),
        cantidad,
        // '#123' igual que la OT y que el resto de la app. Si la cabecera no aparece (línea
        // huérfana, o pedido fuera de la ventana de meses) se cae al ID unívoco: feo, pero
        // rastreable — peor sería dejar la celda vacía.
        referencia: pedido ? `#${pedido.ID}` : d.IDCompra_DC,
        // NO va quién cargó la compra: es auditoría del módulo Compras, no dice nada sobre el
        // movimiento de stock.
        principal: (d.Marca_DC ?? '').trim(),
        // `IDIncidenteCompra_PC` marca las compras generadas DESDE un incidente (flujo B): la
        // pieza que se compró para una OT puntual en vez de para reponer depósito.
        nota: pedido?.IDIncidenteCompra_PC ? `Compra por OT #${pedido.IDIncidenteCompra_PC}` : '',
      });
    }

    // ── Salidas: repuestos de incidentes ya asignados (el assign descontó stock) ──
    // Sólo interesan los incidentes con FechaAsignada_IN DENTRO de la ventana: ese es el día
    // del movimiento. El resto se descarta antes de pedir 13.RepuestosIncidentes.
    const incAsignados = new Map<string, { inc: ReturnType<typeof mapIncidente>; orden: number }>();
    for (const i of incRows.map(mapIncidente)) {
      const orden = dmyKey(i.FechaAsignada_IN);
      if (!enVentana(orden)) continue;
      incAsignados.set(i.IDIncidente, { inc: i, orden: orden! });
    }

    if (incAsignados.size > 0) {
      let repRows = await listWithMonthFilter(
        LIST_IDS.repuestosIncidentes,
        repuestoIncidenteSelectFields(),
        'FechaMes_RI',
        mesesIncidente
      );
      let repuestos = repRows.map(mapRepuestoIncidente).filter((r) => incAsignados.has(r.IDIncidente_RI));

      // Misma red de seguridad que api/dashboard/incidentes.ts: si el filtro por FechaMes_RI
      // no matcheó nada (formato de fecha distinto en la columna) recargamos sin filtro y
      // acotamos por IDIncidente_RI, que es el join de verdad.
      if (repuestos.length === 0) {
        repRows = await listItems(LIST_IDS.repuestosIncidentes, {
          select: repuestoIncidenteSelectFields(),
          top: 999,
        });
        repuestos = repRows.map(mapRepuestoIncidente).filter((r) => incAsignados.has(r.IDIncidente_RI));
      }

      for (const r of repuestos) {
        if (r.Cantidad_RI <= 0) continue;
        const { inc, orden } = incAsignados.get(r.IDIncidente_RI)!;
        ventana.push({
          tipo: 'salida',
          fecha: inc.FechaAsignada_IN!,
          orden,
          repuesto: r.Repuesto_RI,
          clave: norm(r.Repuesto_RI),
          cantidad: r.Cantidad_RI,
          referencia: `#${inc.IDIncidente}`,
          ...detalleSalida(inc),
        });
      }
    }

    const movimientos = ventana.filter((m) => m.orden <= hastaKey);

    // ── Saldos por repuesto ──
    // `hoy` = lo que dice 04.Stock ahora mismo (dato, no cálculo).
    const stockPorClave = new Map<string, { repuesto: string; cantidad: number; esRepuesto: boolean }>();
    for (const s of stockRows.map(mapStock)) {
      stockPorClave.set(norm(s.Item_ST), {
        repuesto: s.Item_ST,
        cantidad: s.Cantidad_ST,
        // `Tipo_ST` viene en MAYÚSCULAS en 04.Stock (ver docs/data-model.md).
        esRepuesto: esRepuesto(s.Tipo_ST),
      });
    }

    // `cierre` = ese saldo rebobinado: se le descuentan las entradas posteriores al cierre y
    // se le devuelven las salidas posteriores. Con el período terminando hoy no hay nada
    // posterior y el neto da 0, así que cierre === hoy (exacto).
    const netoPosterior = new Map<string, number>();
    for (const m of ventana) {
      if (m.orden <= hastaKey) continue;
      const delta = m.tipo === 'entrada' ? m.cantidad : -m.cantidad;
      netoPosterior.set(m.clave, (netoPosterior.get(m.clave) ?? 0) + delta);
    }

    // Se devuelve el saldo de TODO repuesto activo de 04.Stock, haya tenido movimientos o no:
    // el front lista también los que no se movieron en el período (con "sin movimientos"), que
    // es información —un repuesto quieto con stock 0 es justamente lo que hay que mirar—.
    // Los ítems que se movieron se incluyen igual aunque no sean de tipo REPUESTO, para no
    // perder su saldo por una diferencia de tipeo en `Tipo_ST`.
    const conMovimiento = new Set(movimientos.map((m) => m.clave));
    const saldos: Record<string, SaldoRepuesto> = {};
    for (const [clave, row] of stockPorClave) {
      if (!row.esRepuesto && !conMovimiento.has(clave)) continue;
      saldos[clave] = {
        repuesto: row.repuesto,
        hoy: row.cantidad,
        // Clamp a 0: 04.Stock tiene negativos heredados y un saldo reconstruido negativo es
        // ruido, no información (mismo criterio que los Math.max(0,…) de maquinaMoves).
        cierre: Math.max(0, row.cantidad - (netoPosterior.get(clave) ?? 0)),
        estimado: !cierreEsHoy,
      };
    }

    return res.status(200).json({
      desde: fmtKey(desdeKey),
      hasta: fmtKey(hastaKey),
      cierreEsHoy,
      movimientos,
      saldos,
    });
  } catch (err) {
    console.error('dashboard/stock GET error', err);
    const status = err instanceof GraphError ? 502 : 500;
    return res.status(status).json({ error: 'server_error' });
  }
}
