// Comparación tolerante del NOMBRE del técnico (Usuarios.Concat_Nombre_Apellido).
//
// Por qué existe: el Concat es la clave de scoping de `Tecnico_RT` (99.ABMRepuestos_Tecnico),
// `Tecnico_DP` (16), `TecnicoAsignado_EV` (18), `TecnicoAsignado_IN` (10)… y lo escriben LAS DOS
// apps con fórmulas distintas — la mobile "Apellido, Nombre" (api/_lib/abm.ts) y la escritorio
// "Nombre Apellido" (washin-desktop/api/abm/usuarios.ts:71), que además lo REESCRIBE en cada
// update de usuario. Es el riesgo n°1 del CLAUDE.md raíz. Cuando un usuario se edita desde la
// escritorio, su Concat cambia de forma pero las filas ya guardadas conservan la vieja: un `eq`
// exacto de OData deja de matchear NUNCA y el técnico se queda sin stock / sin circuito.
//
// PowerApps NO tenía esto: comparaba con `=` plano (`Tecnico_RT = NombreUser`,
// Screen_Incidentes.pa.yaml:271) porque en PA el Concat lo escribía UNA sola app con UNA sola
// fórmula (`Proper(apellido) & ", " & Proper(nombre)`, Screen_ABM.pa.yaml:966). Con dos
// escritores esa premisa dejó de valer, así que esto es una defensa NUEVA del port —
// declarada como tal, no paridad. Es SOLO de lectura: no cambia ningún dato ni el formato
// con el que se escribe (el canónico sigue siendo el que ya está en las filas).
//
// El refinado del match final va SIEMPRE en memoria: sacar el nombre del `$filter` y meterlo como
// un `and` extra contra otra columna no indexada es lo que SharePoint responde con 400. Lo que SÍ
// se puede dejar en el `$filter` es un `or` sobre UNA SOLA columna (`variantesODataNombre`): no
// suma un segundo predicado no indexado y conserva la selectividad —imprescindible en
// `18.EdificiosVisitar`, que ya pasó el umbral de 5.000 (docs/sharepoint-indexing.md)—. Ese `or`
// cubre los dos FORMATOS conocidos; el refinado en memoria cubre además tildes, espacios raros y
// mayúsculas, que un `eq` de OData no puede.

// ─────────────────────────────────────────────────────────────────────────────
// FORMA CANÓNICA del Concat_Nombre_Apellido. Es la de PowerApps, textual:
//   Concat_Nombre_Apellido: Proper(txt_apellido_1.Text) & ", " & Proper(txt_NombrePersona_1.Text)
//   (docs/powerapps/Src/Screen_ABM.pa.yaml)
// O sea: "Apellido, Nombre", cada palabra con inicial mayúscula.
//
// Las dos apps la tienen que escribir IGUAL. Antes la mobile hacía "Apellido, Nombre" sin Proper y
// la escritorio "Nombre Apellido" —invertido—, y encima la reescribía en CADA update de usuario:
// editar un teléfono le cambiaba la identidad al técnico y lo dejaba sin stock, sin circuito y sin
// incidentes, porque esa columna es la clave de scoping de media app.
// Copia gemela en washin-mobile/api/_lib/tecnico.ts — si tocás una, tocá la otra.
// ─────────────────────────────────────────────────────────────────────────────

// Inicial mayúscula por palabra, respetando guiones y apóstrofes (De Luca, O'Brien, Sáenz-Peña).
function proper(valor: string): string {
  return (valor ?? "")
    .trim()
    .toLowerCase()
    .replace(/(^|[\s\-'])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

export function concatNombreApellido(nombre: string, apellido: string): string {
  const ape = proper(apellido).replace(/\s+/g, " ").trim();
  const nom = proper(nombre).replace(/\s+/g, " ").trim();
  if (!ape && !nom) return "";
  if (!ape) return nom;
  if (!nom) return ape;
  return `${ape}, ${nom}`;
}

// Sin tildes, sin espacios dobles, minúsculas.
function normalizar(valor: string): string {
  return (valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// Formas aceptadas de un mismo nombre: la directa (sin la coma) y, si hay UNA coma, el giro
// alrededor de ella. Así "Henriquez, Emiliano" y "Emiliano Henriquez" caen en la misma forma.
// No se ordenan los tokens a propósito: eso haría matchear a dos personas distintas cuyos
// nombres son permutación uno del otro.
export function variantesNombreTecnico(valor: string): string[] {
  const n = normalizar(valor);
  if (!n) return [];
  const directa = n.replace(/,/g, " ").replace(/\s+/g, " ").trim();
  const vars = new Set<string>();
  if (directa) vars.add(directa);
  const partes = n.split(",");
  if (partes.length === 2) {
    const flip = `${partes[1].trim()} ${partes[0].trim()}`.replace(/\s+/g, " ").trim();
    if (flip) vars.add(flip);
  }
  return [...vars];
}

// Tope de tokens al que se le arman los giros para el `$filter`. Con N tokens sin coma hay N-1
// puntos de corte posibles (no se sabe dónde termina el apellido), o sea N-1 `or`. 5 tokens = 4
// giros + el valor crudo = 5 términos: de ahí para arriba el filtro se hace enorme para un caso
// que no existe en el padrón, así que se manda solo el valor crudo y el resto lo rescata el
// refinado en memoria (que igual devuelve las filas que el `or` sí trajo).
const MAX_TOKENS_GIRO = 5;

// Formas del nombre para preguntar en un `$filter` de OData, con el texto TAL CUAL (sin
// normalizar): el `eq` compara contra el string guardado en SharePoint, así que mandarle la
// versión sin tildes y en minúsculas no matchearía nada.
//
// Se usa donde la columna TIENE que quedar en el `$filter` por selectividad (18.EdificiosVisitar
// pasó las 7.800 filas; 10.Incidentes es la de mayor crecimiento). Nunca reemplaza al refinado en
// memoria: es solo para acotar el set que baja de Graph. Un `or` de más es inofensivo —trae filas
// candidatas que `filtrarPorTecnico` descarta después—, uno de menos deja al técnico sin datos.
export function variantesODataNombre(valor: string): string[] {
  const v = (valor ?? "").replace(/\s+/g, " ").trim();
  if (!v) return [];
  const out = new Set<string>([v]);
  const partes = v.split(",");
  if (partes.length === 2) {
    // "Apellido, Nombre" (fórmula de la mobile) → "Nombre Apellido" (la de la escritorio).
    const ape = partes[0].trim();
    const nom = partes[1].trim();
    if (ape && nom) out.add(`${nom} ${ape}`);
  } else if (partes.length === 1) {
    // "Nombre Apellido" → "Apellido, Nombre". Sin coma no se sabe dónde parte el apellido, así
    // que se emiten todos los cortes posibles (con 2 tokens, que es el caso normal, es uno solo).
    const tokens = v.split(" ").filter(Boolean);
    if (tokens.length >= 2 && tokens.length <= MAX_TOKENS_GIRO) {
      for (let i = 1; i < tokens.length; i++) {
        out.add(`${tokens.slice(i).join(" ")}, ${tokens.slice(0, i).join(" ")}`);
      }
    }
  }
  return [...out];
}

// El `(col eq 'a' or col eq 'b' …)` listo para concatenar a un `$filter`. Devuelve "" si el
// nombre viene vacío (sesión sin Concat): el llamador decide qué hacer, pero nunca se emite un
// `eq ''` que matchearía las filas sin técnico.
export function odataOrNombre(
  columna: string,
  valor: string,
  escape: (s: string) => string,
): string {
  const vars = variantesODataNombre(valor);
  if (!vars.length) return "";
  return `(${vars.map((v) => `fields/${columna} eq '${escape(v)}'`).join(" or ")})`;
}

// Forma directa nada más (la coma se aplana, sin giro). Es la comparación estricta.
function formaDirecta(valor: string): string {
  return normalizar(valor).replace(/,/g, " ").replace(/\s+/g, " ").trim();
}

// PURA: ¿los dos strings apuntan al mismo técnico? Tolera orden (con coma), espacios, tildes y
// mayúsculas. Un valor vacío NUNCA matchea (si no, una fila sin técnico sería de todos).
//
// ⚠️ EL GIRO SOLO SE APLICA SI UNO DE LOS DOS NO TIENE COMA. Es la parte delicada de este archivo:
// el giro existe para puentear las DOS convenciones ("Apellido, Nombre" de la mobile contra
// "Nombre Apellido" de la escritorio). Si los dos valores traen coma ya están en la MISMA
// convención, y girarlos igual hacía colapsar a dos personas distintas cuyos nombres son
// permutación uno del otro: `mismoTecnico("Perez, Martin", "Martin, Perez")` daba true.
// Con apellidos que también son nombres (Martin, Perez, Simon, Gabriel) eso no es hipotético, y el
// daño —stock y circuitos cruzados entre dos técnicos— es PEOR que el bug que este archivo arregla,
// porque el stock vacío se ve y el cruzado no.
export function mismoTecnico(a: string, b: string): boolean {
  const da = formaDirecta(a);
  const db = formaDirecta(b);
  if (!da || !db) return false;
  if (da === db) return true;
  // Distintos en forma directa: solo se acepta el giro cuando hay una convención de cada lado.
  const comaA = a.includes(",");
  const comaB = b.includes(",");
  if (comaA === comaB) return false;
  const va = variantesNombreTecnico(a);
  const vb = variantesNombreTecnico(b);
  return va.some((v) => vb.includes(v));
}

// Refina en memoria una tanda de filas por el nombre del técnico. Loguea cuando el `eq` exacto
// (lo que hacía el $filter) habría devuelto 0 y el match tolerante rescata filas: esa es la
// señal de que el Concat del usuario se reescribió, y es justo la que hoy no existe en los logs
// (el técnico solo veía "no tenés repuestos en tu stock", sin traza).
//
// `tecnico` acepta una lista de identidades porque en `10.Incidentes` el mismo scoping vale para
// el Concat Y para el login: `TecnicoAsignado_IN` guarda normalmente el Concat, pero hay altas
// viejas con el login adentro (paridad PA, galerías de Screen_Incidentes). Un login es un token
// suelto, así que `mismoTecnico` no lo confunde con un nombre completo.
export function filtrarPorTecnico<T>(
  filas: T[],
  tecnico: string | string[],
  columna: (fila: T) => string,
  ctx: string,
): T[] {
  const nombres = (Array.isArray(tecnico) ? tecnico : [tecnico]).filter(
    (n) => (n ?? "").trim() !== "",
  );
  if (!nombres.length) return [];
  const match = filas.filter((f) => nombres.some((n) => mismoTecnico(columna(f), n)));
  if (match.length) {
    const exactas = filas.filter((f) => nombres.includes(columna(f) ?? "")).length;
    if (!exactas) {
      console.warn(
        `[${ctx}] el nombre del técnico no coincide exacto con lo guardado ` +
          `(Concat_Nombre_Apellido reescrito, riesgo n°1); se matcheó tolerante`,
        { tecnico, guardado: columna(match[0]), filas: match.length },
      );
    }
  }
  return match;
}
