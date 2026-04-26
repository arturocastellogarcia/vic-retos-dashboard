# vic-retos-dashboard

Dashboard de seguimiento de los **16 retos GovTech** del programa **València Innovation Capital (VIC)**, gestionado por la Fundació Las Naves.

Lee fichas `.docx` mensuales de SharePoint, las parsea, las guarda en Postgres y muestra un cuadro de programa, alertas activas y vista imprimible para la Concejala. Read-only sobre SharePoint: nunca escribe en él.

**🔗 Producción:** https://vic-retos-dashboard.vercel.app

**Estado actual (2026-04-26):** 16 retos, 24 fichas (15 marzo + 9 abril 2026), 13 alertas activas, 678.161 € comprometidos. Auth con magic link para `arturo.castello@lasnaves.com` y `jose.almenar@lasnaves.com` (allowlist hardcoded en `src/lib/auth-allowlist.ts`).

**SharePoint sync automático:** pendiente de consent admin del tenant Las Naves para el client_id público de Microsoft Graph PowerShell. Mientras tanto, el cron es no-op y los syncs se hacen manualmente. Ver [`docs/DEPLOY.md`](docs/DEPLOY.md) sección 7 para activar.

## Stack

- **Next.js 14** App Router + TypeScript + Tailwind
- **Supabase** Postgres (Drizzle ORM) + Auth (magic link)
- **Microsoft Graph** + `@azure/msal-node` (device code flow, sin Azure App Registration)
- **mammoth** para extraer texto de los `.docx`
- **Vercel** deploy + cron diario

## Estructura del repo

```
src/
├── app/
│   ├── (app)/                  # Rutas autenticadas con Header
│   │   ├── page.tsx            # /  → cuadro de programa
│   │   ├── retos/[id]/page.tsx # /retos/sirval, etc.
│   │   ├── alertas/page.tsx    # /alertas
│   │   └── delegacion/page.tsx # /delegacion (vista imprimible)
│   ├── api/sync/route.ts       # /api/sync (cron + manual)
│   ├── auth/callback/route.ts  # OAuth callback
│   ├── login/page.tsx
│   ├── no-autorizado/page.tsx
│   ├── layout.tsx
│   └── globals.css
├── components/                 # Header, Semaforo, MetricCard, SyncButton, PrintButton
├── db/
│   ├── schema.ts               # Drizzle: 4 tablas (retos, fichas_mensuales, alertas, sync_runs)
│   └── index.ts                # cliente postgres-js + drizzle()
├── lib/
│   ├── parser.ts               # parseFichaText() — tolerante a 5 variantes de fecha
│   ├── parse-docx.ts           # mammoth + parser
│   ├── retos-registry.ts       # 16 retos canónicos + filePatterns regex
│   ├── sharepoint.ts           # listFichas(), downloadFicha(), getAccessToken()
│   ├── sync.ts                 # syncSharepoint(): orquesta todo el flujo
│   ├── alerts.ts               # 5 reglas de alerta
│   ├── ui-helpers.ts           # calcSemaforo, formatEuros, etc.
│   ├── auth-allowlist.ts       # ALLOWED_EMAILS hardcoded
│   └── supabase/{client,server}.ts
└── middleware.ts               # auth + allowlist
scripts/
├── sync-sharepoint.ts          # CLI para `npm run sync`
└── test-parser.ts              # CLI para `npm run test:parser`
test-fixtures/                  # 4 fichas reales como txt para tests
docs/
├── CONTEXTO.md                 # spec original (parsing, schema, reglas)
├── DEPLOY.md                   # guía de despliegue paso a paso
└── PARSER.md                   # cómo extender el parser
drizzle/                        # migraciones generadas por drizzle-kit
```

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Dev server local en :3000 |
| `npm run build` | Build de producción |
| `npm run lint` | ESLint |
| `npm run db:push` | Aplica el schema directamente a Supabase (sin migraciones intermedias) |
| `npm run db:generate` | Genera SQL de migración en `./drizzle/` |
| `npm run db:studio` | Abre Drizzle Studio (GUI de la DB) |
| `npm run sync` | Sincronización SharePoint manual (la 1ª vez dispara device code flow) |
| `npm run test:parser` | Ejercita el parser contra los 4 fixtures (esperado: 3 OK + 1 Partial) |

## Variables de entorno

Ver `.env.example`. Las críticas:

- `DATABASE_URL` — string de conexión Postgres (Supabase Pooler en Transaction mode)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — para Auth
- `CRON_SECRET` — protege `/api/sync` cuando lo dispara el cron de Vercel
- `SHAREPOINT_REFRESH_TOKEN` — obtenido vía `npm run sync` localmente; sin él, `/api/sync` es no-op

## Despliegue

Ver [`docs/DEPLOY.md`](docs/DEPLOY.md) para la guía paso a paso (Supabase → GitHub → Vercel → primera sync).

## Extender el parser

Ver [`docs/PARSER.md`](docs/PARSER.md) cuando aparezca una variante nueva en las fichas.

## Allowlist

Está hardcoded en `src/lib/auth-allowlist.ts`. Para añadir/quitar un email autorizado: editar el array, commit, redeploy.
