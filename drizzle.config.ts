// Configuración drizzle-kit para generar migraciones (db:generate) y aplicarlas
// directamente en Supabase (db:push). Las migraciones se versionan en ./drizzle.

import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Carga .env.local primero (override) y luego .env como fallback,
// igual que hace Next.js. drizzle-kit no lo hace solo.
config({ path: '.env.local' });
config();

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  verbose: true,
  strict: true,
});
