// Solo hace el device code flow contra Microsoft, imprime URL + código y, al
// terminar, imprime el refresh token. NO toca la BD. Útil para inicializar
// SHAREPOINT_REFRESH_TOKEN sin depender de Supabase.
//
// Uso: npm run sp:auth

// Bypass del guard isTTY (este script SIEMPRE es interactivo).
process.env.SHAREPOINT_INTERACTIVE = '1';

import 'dotenv/config';
import { getAccessToken } from '../src/lib/sharepoint';

async function main() {
  console.log('Solicitando access token (esto disparará device code flow si no hay refresh token)…\n');
  const token = await getAccessToken();
  console.log('\n✓ Access token obtenido (primeros 20 chars):', token.slice(0, 20) + '…');
  console.log('\nAhora pega el refresh token de arriba en .env.local y en Vercel.');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
