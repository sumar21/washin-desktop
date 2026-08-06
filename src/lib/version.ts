// Versión de la app para el FRONT. Es solo un reexport: la fuente única es api/_lib/version.ts
// (ahí está el formato y cómo se bumpea en cada release).
//
// Antes vivía en src/mock/data.ts, que es el archivo de datos MOCK — un lugar equivocado para una
// constante que va a producción y que además se escribe en SharePoint.
export { APP_VERSION } from '../../api/_lib/version';
