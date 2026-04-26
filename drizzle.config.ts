// Configuración drizzle-kit para generar migraciones (db:generate) y aplicarlas
// directamente en Supabase (db:push). Las migraciones se versionan en ./drizzle.

import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

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
