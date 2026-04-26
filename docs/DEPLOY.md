# Guía de despliegue

Pasos para llevar `vic-retos-dashboard` a producción desde cero.

## 1. Crear proyecto Supabase

1. Entra en https://supabase.com → **New project**.
2. Nombre: `vic-retos`. Región: `eu-west-1` (Ireland). Plan Free.
3. Espera ~2 min a que se aprovisione.

### Conexión a la base de datos

- **Settings → Database → Connection string → URI** → seleccionar modo **Transaction** (puerto 6543).
- Sustituir `[YOUR-PASSWORD]` por la password que pusiste al crear el proyecto.
- Esto va a `DATABASE_URL`.

> ¿Por qué Transaction y no Session? Transaction usa pgbouncer pooler — mejor para serverless/Vercel donde cada request abre una conexión nueva. Drizzle (postgres-js) está configurado con `prepare: false` para soportarlo.

### API keys

- **Settings → API**
  - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
  - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Auth provider

- **Authentication → Providers → Email**: enable.
- **Confirm email**: OFF (los magic links autoconfirman).

### URLs de redirect

- **Authentication → URL Configuration**:
  - Site URL: `http://localhost:3000` por ahora (la actualizaremos al desplegar en Vercel).
  - Redirect URLs: `http://localhost:3000/auth/callback`.

## 2. Crear `.env.local`

Copia `.env.example` a `.env.local` y rellena los valores que acabas de obtener:

```bash
cp .env.example .env.local
```

Genera el `CRON_SECRET`:

```bash
openssl rand -hex 32
```

Pégalo en `.env.local`. Deja `SHAREPOINT_REFRESH_TOKEN` vacío de momento.

## 3. Aplicar el schema a Supabase

```bash
npm run db:push
```

Confirma la migración (todas las tablas son nuevas, no hay riesgo). Verifica en Supabase Studio que aparecen `retos`, `fichas_mensuales`, `alertas`, `sync_runs`.

## 4. Crear repo en GitHub

```bash
gh repo create vic-retos-dashboard --public --source=. --remote=origin
git push -u origin master
```

(O créalo manualmente en https://github.com/new si no tienes `gh` configurado.)

## 5. Conectar a Vercel

1. https://vercel.com/new → importa el repo de GitHub.
2. Framework: Next.js (detectado automáticamente).
3. Antes de pulsar Deploy, configura **Environment Variables**:
   - `DATABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `CRON_SECRET`
   - (las de SharePoint las añadimos en el paso 7)
4. Deploy. Anota la URL final (ej. `vic-retos-dashboard.vercel.app`).

## 6. Actualizar Supabase con la URL de producción

- **Authentication → URL Configuration**:
  - Site URL: `https://<tu-deploy>.vercel.app`
  - Redirect URLs: añadir `https://<tu-deploy>.vercel.app/auth/callback` (manteniendo el de localhost para dev).

## 7. Primera sincronización con SharePoint (device code flow)

Localmente:

```bash
npm run sync
```

La primera vez:

1. Imprime una URL (`https://microsoft.com/devicelogin`) y un código.
2. Abre la URL en el navegador, mete el código.
3. Autentícate con `arturo.castello@lasnaves.com`.
4. Autoriza los scopes `Sites.Read.All` y `Files.Read.All`.
5. Al terminar, el script imprime el **REFRESH TOKEN**. Cópialo y pégalo:
   - En `.env.local` → `SHAREPOINT_REFRESH_TOKEN=...`
   - En Vercel → **Settings → Environment Variables** → `SHAREPOINT_REFRESH_TOKEN`
6. El sync continúa automáticamente: lista carpetas mensuales, descarga, parsea y guarda.

Vuelve a ejecutar `npm run sync` para verificar que con el refresh token ya no pide login.

## 8. Verificar en Vercel

1. **Settings → Crons** → debería aparecer el cron diario a las 06:00.
2. Visita la URL de Vercel, haz login con magic link.
3. Verifica:
   - Cuadro de programa muestra los 16 retos
   - Métricas: ~11 en ejecución, 1 finalizado, ~600.000 € comprometidos
   - Alertas activas (al menos `sin_ficha` para reto #16)
   - Detalle: `/retos/voto-telematico` funciona
   - Vista delegación es imprimible

## 9. Mantenimiento

- **Añadir / quitar usuarios**: editar `src/lib/auth-allowlist.ts`, commit, push.
- **Añadir un reto nuevo**: editar `src/lib/retos-registry.ts`.
- **Forzar un re-sync**: pulsar "Sincronizar ahora" en el dashboard.
- **Refresh token caducado**: ejecutar `npm run sync` localmente otra vez (el refresh token de Microsoft caduca a los 90 días sin uso).
