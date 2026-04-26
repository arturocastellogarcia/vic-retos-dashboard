// Cliente Supabase para Server Components, Route Handlers y Server Actions.
// La función `set` de cookies puede fallar desde un Server Component
// (las cookies son read-only en ese contexto). Se ignora el error porque
// el middleware se encarga de refrescar la sesión.

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Llamado desde Server Component (read-only). Lo gestiona el middleware.
          }
        },
      },
    },
  );
}
