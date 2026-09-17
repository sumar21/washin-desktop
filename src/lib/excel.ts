/**
 * Descarga de un .xlsx a partir de filas planas.
 *
 * Vive acá y no dentro de `GridPanel` porque no todas las pantallas que exportan son una
 * grilla: el tab Stock del dashboard muestra cards agrupadas y también descarga Excel.
 *
 * SheetJS se importa bajo demanda — son ~425 KB y no tienen por qué estar en el bundle
 * principal de una app que casi siempre se usa sin descargar nada.
 */
export async function descargarExcel(
  filas: Record<string, string | number>[],
  nombreArchivo: string,
  hoja = 'Datos'
): Promise<void> {
  if (filas.length === 0) return;
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.json_to_sheet(filas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, hoja);
  XLSX.writeFile(wb, `${nombreArchivo}.xlsx`);
}
