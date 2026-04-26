// Cliente Drizzle conectado a Supabase Postgres vía postgres-js.
// `prepare: false` es OBLIGATORIO cuando se usa el connection pooler de Supabase
// en modo Transaction (pgbouncer no soporta prepared statements en ese modo).

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

// Placeholder permite que `next build` no peté en módulos que importan db sin
// haber configurado DATABASE_URL. La conexión real es lazy (postgres-js no
// abre el socket hasta la primera consulta).
const connectionString =
  process.env.DATABASE_URL ?? 'postgres://placeholder@localhost:5432/placeholder';

const queryClient = postgres(connectionString, { prepare: false });

export const db = drizzle(queryClient, { schema });
export { schema };
