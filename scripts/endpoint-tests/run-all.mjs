import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Corre todas las suites de endpoints en secuencia y resume PASS/FAIL.
// Requiere `npm run dev:full` corriendo en localhost:5173 y las credenciales en .env.
const here = dirname(fileURLToPath(import.meta.url));
const suites = ['reads', 'mut_incidentes', 'mut_compras', 'mut_stock', 'mut_vent_abm', 'mut_planif_maq'];

let totalPass = 0, totalAll = 0, warnings = 0;
for (const s of suites) {
  console.log(`\n########## ${s} ##########`);
  const r = spawnSync('node', [join(here, `${s}.mjs`)], { encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  process.stdout.write(out);
  const m = out.match(/==+ (\d+)\/(\d+) PASS ==+/);
  if (m) { totalPass += Number(m[1]); totalAll += Number(m[2]); }
  warnings += (out.match(/⚠️/g) || []).length;
}
console.log(`\n================ TOTAL: ${totalPass}/${totalAll} PASS · ${warnings} warning(s) de limpieza ================`);
process.exit(totalPass === totalAll && warnings === 0 ? 0 : 1);
