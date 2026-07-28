import type { MultiOption } from '@/components/ui/multi-select';

const MESES_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * Opciones fijas de mes/año: los últimos 12 meses (mes actual + 11 hacia atrás),
 * en formato `MM/YYYY` (igual que los campos FechaMesAno_* de SharePoint) → siempre
 * disponibles para filtrar aunque no haya datos de ese mes. Ordenadas de más nuevo a más viejo.
 */
export function last12MesesOptions(now: Date = new Date()): MultiOption[] {
  const out: MultiOption[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    // Etiqueta `MM/YYYY` (mismo formato que los campos FechaMesAno_* de la base).
    out.push({ value: `${mm}/${yyyy}`, label: `${mm}/${yyyy}` });
  }
  return out;
}

/** Opciones de mes/año (mm/yyyy → "mmm yyyy") presentes en los datos, ordenadas desc. */
export function mesAnoOptions(mesAnos: (string | undefined | null)[]): MultiOption[] {
  const uniq = [...new Set(mesAnos.filter((m): m is string => !!m && /^\d{2}\/\d{4}$/.test(m)))];
  return uniq
    .sort((a, b) => {
      const [ma, ya] = a.split('/').map(Number);
      const [mb, yb] = b.split('/').map(Number);
      return yb * 100 + mb - (ya * 100 + ma);
    })
    .map((m) => {
      const [mm, yyyy] = m.split('/');
      return { value: m, label: `${MESES_ES[Number(mm) - 1]} ${yyyy}` };
    });
}

/**
 * Opciones de Edificio para los filtros, desde el CATÁLOGO (`ABM.Edificios` con Status='ALTA',
 * que es lo que devuelve `GET /api/abm` → `CollectAbmEdificios`), NO desde los datos de la
 * pantalla. Es el modelo del msapp: `Items = Distinct(CollectEdificios, Edificio)` con
 * `CollectEdificios = Filter('ABM.Edificios', Status = "ALTA")` — los combos de edificio salen
 * siempre del catálogo, y sólo los atributos de máquina (marca/modelo/encendido) salen de los datos.
 *
 * Antes cada pantalla derivaba sus opciones de las filas cargadas, así que un edificio activo sin
 * movimientos abiertos no aparecía (reporte de Paul: "Green House Sucre") y la lista cambiaba según
 * los demás filtros. Ojo con la contracara, asumida a propósito para no divergir del msapp: un
 * edificio dado de BAJA, o renombrado en ABM después de que se cargó la fila, no está en esta lista
 * — sus filas viejas conservan el nombre anterior en la columna del dato y no se pueden filtrar.
 */
export function edificioOptions(edificios: { Edificio: string }[]): MultiOption[] {
  const uniq = [...new Set(edificios.map((e) => e.Edificio?.trim()).filter((e): e is string => !!e))];
  return uniq.sort((a, b) => a.localeCompare(b, 'es')).map((e) => ({ value: e, label: e }));
}

/** Opciones de estado (valores distintos presentes), en orden dado o alfabético. */
export function estadoOptions(estados: (string | undefined | null)[], orden?: string[]): MultiOption[] {
  const uniq = [...new Set(estados.filter((e): e is string => !!e && e.trim() !== ''))];
  const sorted = orden
    ? uniq.sort((a, b) => {
        const ia = orden.indexOf(a);
        const ib = orden.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b, 'es');
      })
    : uniq.sort((a, b) => a.localeCompare(b, 'es'));
  return sorted.map((e) => ({ value: e, label: e }));
}
