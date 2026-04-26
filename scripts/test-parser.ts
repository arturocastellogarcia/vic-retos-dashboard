// Ejecuta el parser contra los fixtures reales en test-fixtures/.
// Esperado: 3 OK + 1 Partial.
//   - alertesiv-abril.txt → partial (Issues vacío + fecha "(20/04)" sin año)
//   - censo-abril.txt     → ok
//   - metaverso-abril.txt → ok
//   - voto-abril.txt      → ok

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseFichaText } from '../src/lib/parser';

const FIXTURES_DIR = join(process.cwd(), 'test-fixtures');

const FIXTURES = [
  { file: 'alertesiv-abril.txt', expected: 'partial' as const },
  { file: 'censo-abril.txt',     expected: 'ok' as const },
  { file: 'metaverso-abril.txt', expected: 'ok' as const },
  { file: 'voto-abril.txt',      expected: 'ok' as const },
];

function snippet(s: string | null, n = 70): string {
  if (!s) return 'null';
  const flat = s.replace(/\s+/g, ' ').trim();
  return flat.length > n ? flat.slice(0, n) + '…' : flat;
}

async function main() {
  let passed = 0;
  let failed = 0;

  for (const fix of FIXTURES) {
    const path = join(FIXTURES_DIR, fix.file);
    const text = await readFile(path, 'utf8');
    const r = parseFichaText(text);
    const ok = r.parserStatus === fix.expected;
    if (ok) passed++; else failed++;

    const symbol = ok ? '✓' : '✗';
    console.log(`${symbol} ${fix.file}: status=${r.parserStatus} (esperado ${fix.expected})`);
    console.log(`    Nombre:        ${snippet(r.nombre)}`);
    console.log(`    Área temática: ${snippet(r.areaTematica)}`);
    console.log(`    Owner:         ${r.metaOwnerTecnicoVic}  | Seguim: ${r.metaSeguimientoTecnicoVic ?? '-'}`);
    console.log(`    Presupuesto:   ${r.metaPresupuesto} (raw "${r.metaPresupuestoRaw}")`);
    console.log(`    KPIs:          ${r.kpis.length}`);
    console.log(`    Fecha seg.:    ${r.fechaSeguimiento ?? 'null'}  (raw "${r.fechaSeguimientoRaw}")`);
    console.log(`    Hitos:         ${r.hitosAlcanzados ? r.hitosAlcanzados.length + ' chars' : 'null'}`);
    console.log(`    Riesgos:       ${r.riesgosPrincipales ? r.riesgosPrincipales.length + ' chars' : 'null'}`);
    console.log(`    Issues:        ${r.issuesAbiertos ? r.issuesAbiertos.length + ' chars' : 'null'}`);
    console.log(`    Próximos:      ${r.proximosPasos ? r.proximosPasos.length + ' chars' : 'null'}`);
    if (r.parserWarnings.length > 0) {
      console.log(`    Warnings (${r.parserWarnings.length}):`);
      for (const w of r.parserWarnings) console.log(`      - ${w}`);
    }
    console.log();
  }

  console.log(`────────────────────────────`);
  console.log(`${passed} pasaron · ${failed} fallaron`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
