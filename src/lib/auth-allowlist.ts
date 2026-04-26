// Allowlist hardcoded de emails autorizados para acceder al dashboard.
// Cualquier otro email recibe redirect a /no-autorizado.
// Para añadir/quitar usuarios, edita este array y haz redeploy.

export const ALLOWED_EMAILS: readonly string[] = [
  'arturo.castello@lasnaves.com',
  'jose.almenar@lasnaves.com',
  // 'concejala@valencia.es',  // TODO: confirmar email
].map((e) => e.toLowerCase());

export function isEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  return ALLOWED_EMAILS.includes(email.toLowerCase());
}
