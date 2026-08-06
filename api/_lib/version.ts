// FUENTE ÚNICA de la versión de la app de escritorio. Antes había DOS constantes sueltas con el
// mismo valor copiado a mano —`APP_VERSION` en api/_lib/lists.ts y `appVersion` en src/mock/data.ts,
// que además es un archivo de datos MOCK— y nada garantizaba que no se separaran.
// Ahora la importan las dos capas:
//   • backend → api/_lib/lists.ts la reexporta como APP_VERSION (se escribe en SharePoint).
//   • front   → src/lib/version.ts la reexporta; el store la expone como VarVersion y el Login la
//               muestra. Vite la inlinea en el bundle.
//
// ⚠️ Este archivo NO puede importar NADA ni tener side effects: lo bundlean el front y el backend
//    por igual. Una constante y nada más. Vive bajo `api/_lib/` (el prefijo `_` hace que Vercel no
//    lo publique como endpoint) para que el backend la resuelva con un import relativo común.
//
// ─────────────────────────────────────────────────────────────────────────────
// Formato: v<YYYYMMDD>_<major>.<minor>.<patch>        ejemplo: v20260806_1.0.2
//   YYYYMMDD → fecha de la release (año, mes, día)
//   major    → cambio grande
//   minor    → funcionalidad nueva
//   patch    → +1 en CADA actualización que sale a producción
//
// Es el MISMO formato que usa washin-mobile (ver washin-mobile/api/_lib/version.ts). Importa que
// coincida: las dos apps escriben en las mismas columnas Version_* de SharePoint, así que un
// reporte que agrupe por versión vería dos universos si los formatos difirieran. El NÚMERO sí es
// independiente — cada app tiene su propio ciclo de releases.
// Antes acá el formato usaba puntos ("v20260520.1.0.0") en vez del guión bajo acordado.
//
// CÓMO SE BUMPEA: se toca ESTA línea y nada más. Poné la fecha de hoy y subí el número que
// corresponda (lo normal es +1 al patch).
// ─────────────────────────────────────────────────────────────────────────────
export const APP_VERSION = 'v20260806_1.0.2';
