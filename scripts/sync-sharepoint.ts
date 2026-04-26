// CLI wrapper sobre syncSharepoint(). Se ejecuta con `npm run sync`.
// La primera vez (sin SHAREPOINT_REFRESH_TOKEN) dispara device code flow:
// abre https://microsoft.com/devicelogin, mete el código que se imprime,
// te autenticas, y al terminar imprime el refresh token para guardarlo.

import 'dotenv/config';
import { syncSharepoint } from '../src/lib/sync';

async function main() {
  console.log('Iniciando sincronización SharePoint…\n');
  const result = await syncSharepoint('manual');

  console.log('\n────────────────────────────────────────');
  console.log(`Sync run #${result.syncRunId}: ${result.status.toUpperCase()}`);
  console.log('────────────────────────────────────────');
  console.log(`Fichas procesadas:    ${result.fichasProcesadas}`);
  console.log(`Fichas nuevas:        ${result.fichasNuevas}`);
  console.log(`Fichas actualizadas:  ${result.fichasActualizadas}`);
  console.log(`Alertas activas:      ${result.alertasActivas}`);

  if (result.huerfanas.length > 0) {
    console.log(`\nFichas huérfanas (no matchearon ningún reto del registry):`);
    for (const h of result.huerfanas) console.log(`  - ${h}`);
    console.log('\n→ Refina los regex en src/lib/retos-registry.ts y vuelve a sincronizar.');
  }

  if (result.errores.length > 0) {
    console.log(`\nErrores:`);
    for (const e of result.errores) console.log(`  - ${e.ficha}: ${e.error}`);
  }

  process.exit(result.status === 'success' && result.errores.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Error fatal:', err);
  process.exit(1);
});
