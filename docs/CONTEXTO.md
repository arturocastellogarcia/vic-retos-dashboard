# Contexto técnico — vic-retos-dashboard

Documento de referencia que Claude Code debe leer antes de empezar a construir.
Contiene todo lo que ya está investigado y decidido sobre el dominio.

---

## 1. Qué se está construyendo y por qué

Dashboard de seguimiento de los **16 retos GovTech** del programa **València Innovation Capital (VIC)**, gestionado por la **Fundació Las Naves**.

**Fuente operativa** (single source of truth): los gestores suben fichas `.docx`
mensuales a SharePoint, en la biblioteca:

```
https://lasnavesvlc.sharepoint.com/sites/RetosInternos/
  Shared Documents/RETOS INTERNOS/<MM Mes AAAA>/
```

Ejemplos de carpetas vivas hoy:
- `04 Abril 2026/` (mes en curso, 9 fichas)
- `03 Marzo 2006/` (mes anterior — typo en el nombre, debería ser 2026; 15 fichas)

El dashboard NO modifica nada en SharePoint. Es **read-only**: lee, parsea,
guarda en BD, y muestra. Los gestores siguen haciendo lo mismo de siempre.

**Tres usuarios:**
- Arturo Castelló (admin) — `arturo.castello@lasnaves.com`
- Jose Vicente Almenar (gestor del programa) — `jose.almenar@lasnaves.com`
- Concejala de Innovación — email pendiente de confirmar

**Auth:** magic link por email (Supabase OTP). NO usar OAuth Microsoft.
Allowlist hardcoded en middleware.

**Acceso a SharePoint:** opción a decidir todavía. NO usar Azure AD App
Registration. Las opciones vivas son:
- Cuenta de servicio Microsoft con device code flow (TI tiene que crear el usuario)
- Sync manual desde el portátil de Arturo (`npm run sync` cuando quiera refrescar)

Mientras no haya decisión, dejar el conector SharePoint listo pero parametrizable,
y el cron diario en Vercel desactivado.

---

## 2. Stack tecnológico (no negociable, ya decidido por consistencia con otros proyectos del usuario)

- **Next.js 14** App Router + TypeScript
- **Tailwind CSS** + shadcn/ui-style components manuales (no instalar shadcn)
- **Supabase** — Postgres + Auth (magic link)
- **Drizzle ORM** v0.36
- **mammoth** v1.8 — para parsear `.docx` a texto plano
- **Vercel** — deploy + cron diario
- **GitHub público** — repo `vic-retos-dashboard`
- **Node 20+**

NO usar: Azure SDK, Microsoft Graph SDK con auth de aplicación, App Router con
Pages mezcladas, librerías UI pesadas (Material, Chakra, Ant), tRPC, server
actions de mutación complejas.

---

## 3. Estructura de las fichas .docx (CRÍTICO)

Cada ficha sigue una estructura de **secciones encabezadas por emojis-ancla**.
Esto es lo que hace el parsing tractable: los emojis son únicos y consistentes.

### Secciones (en orden):

| Emoji | Sección | Notas |
|-------|---------|-------|
| 🆔 | Nombre del Reto | |
| 🎯 | Objetivo del Reto | A veces incluye desglose por fases/módulos |
| 🗓️ | Fecha de Lanzamiento | Texto libre tipo "Lanzamiento en mayo de 2025" |
| 🧠 | Área Temática | GovTech, UrbanTech, AgroTech, ESD (Emergencias, Seguridad, Defensa), VR-Videojuegos |
| 🛠️ | Tipo de Reto | Casi siempre "GovTech, contrato menor por XK" |
| 👥 | Entidades Impulsoras | VIC, Servicios municipales, GVA |
| 🤝 | Entidades Participantes | Empresa adjudicataria + colaboradores |
| 📍 | Contexto Urbano | Dónde se va a desplegar |
| 📊 | Indicadores de Éxito | KPIs prefijados con "KPI N:" |
| 📎 | Documentación Asociada | URL o nombre de carpeta |
| 🔄 | Estado Actual | A veces incluye el bloque de seguimiento |
| 📝 | Observaciones | A veces incluye el bloque de seguimiento (varía por gestor) |

Tras 📝 viene un bloque libre de **Metadatos** con:
- Programa (siempre "GovTech")
- Owner (téc. I+D+i) — el técnico VIC responsable
- Seguimiento (téc. I+D+i) — campo opcional, no todas las fichas lo tienen
- Servicio(s) municipal(es) implicado(s)
- Cuenta analítica
- Presupuesto (€) — formato variable: "50.000€", "34.920,00 €", "36.300 € (IVA incluido)"
- Plazo (inicio – fin)

### Bloque de seguimiento mensual

Lo más variable. Aparece dentro de 🔄 Estado Actual o 📝 Observaciones (o ambos).
Estructura conceptual:

```
<FECHA>
Hitos alcanzados
• ...
Riesgos principales
• ...
Issues abiertos
• ...
Próximos pasos (30 días)
• ...
```

### Variantes detectadas en fichas reales (el parser DEBE manejar todas)

**Variantes de fecha:**
- `24 de abril de 2026` (Censo Único)
- `24 de abril 2026` sin segundo "de" (App Voto)
- `24 Abril 2026` (Showroom VR)
- `24/04/2026` (Metaverso)
- `(20/04)` sin año, asumir año actual (ALERTESIV)

**Variantes de encabezado de subsección:**
- `Hitos alcanzados:` — variante normal
- `Hitos alcanzados (Fase 2 completada)` — App Voto
- `1. HITOS ALCANZADOS` numerado en mayúsculas — Metaverso
- `4. PRÓXIMOS PASOS (30 DÍAS)` — Metaverso

**Comportamiento esperado del parser:**
- Si no encuentra una sección, devuelve `null` y añade aviso a `parserWarnings`.
- NO falla duro. Estado `ok` (0 avisos), `partial` (1-4 avisos), `error` (5+).
- Las fichas marcadas `error` generan automáticamente alerta `ficha_mal_formada`.
- Guarda el texto crudo en `raw_text` por si hay que reparsear sin volver a descargar.

---

## 4. Registry de los 16 retos (datos canónicos)

Esta es la lista consolidada por Jose Vicente Almenar (2026-04-26). Se hardcodea
en `src/lib/retos-registry.ts`. Cada reto tiene patrones regex que identifican
el archivo `.docx` correspondiente — los nombres de archivo varían entre meses
(`_04 ABRIL`, `-abril`, sin sufijo), por eso usamos regex permisivos.

| # | id (slug) | Nombre | Área | Owner municipal | € | Inicio | Fin | Empresa | Solución | Estado |
|---|-----------|--------|------|-----------------|---|--------|-----|---------|----------|--------|
| 1 | sirval | SIRVAL · Sistema de Indicadores de Innovación | GovTech | Empar Soriano | 50.000 | 2024-12-01 | 2026-05-31 | TapIntoIt (AIDIMME) | — | ejecucion |
| 2 | metaverso-vic | Metaverso · Entorno Virtual Inmersivo VIC | VR-Videojuegos | Miguel Ángel Mas | 34.920 | 2025-05-01 | 2026-04-30 | r3s3t | Metaverso VIC | ejecucion |
| 3 | showroom-vr | Showroom VR VIC | VR-Videojuegos | Miguel Ángel Mas | 26.000 | 2025-05-01 | 2026-04-30 | — | — | ejecucion |
| 4 | alertesiv | ALERTESIV · Incendios 10x100 | ESD | Jose Almenar | 50.000 | 2025-08-01 | 2026-07-31 | Armoniats | ALERTESIV | ejecucion |
| 5 | censo-federado | Censo Único Federado | GovTech | Laura López | 50.941 | 2025-09-01 | 2026-09-30 | DEEPSENSE | — | ejecucion |
| 6 | sigma-it | SIGMA-IT · SERTIC averías | GovTech | Jose Almenar | 50.000 | 2025-09-01 | 2026-02-28 | Foqum Analytics | SIGMA-IT | **fin** |
| 7 | comunicacion-ia | Comunicación automatizada · Etiqmedia | GovTech | Yolanda Puchades | 50.000 | 2025-09-01 | 2026-02-28 | Etiqmedia | — | evaluacion |
| 8 | placenet | PLACENET · Parques del Futuro | UrbanTech | Miguel Marés | 50.000 | 2025-10-01 | 2026-02-28 | Placenet | PLACENET | ejecucion |
| 9 | spot4dis | Spot4Dis · SCIGD Plazas PMR | GovTech | Jose Almenar | 50.000 | 2025-10-01 | 2026-03-31 | Solmes | Spot4Dis | evaluacion |
| 10 | grantia | GrantIA · Servicio de Innovación SPI | GovTech | Francisca Hipólito | 50.000 | 2025-10-01 | 2026-03-31 | 4i | GrantIA | evaluacion |
| 11 | smarttourflow | SmartTourFlow | UrbanTech | Juan Manuel Rodilla | 50.000 | 2025-11-01 | 2026-11-30 | PurpleBlob | SmartTourFlow | inicio |
| 12 | voto-telematico | App Voto Telemático | GovTech | Laura López | 36.300 | 2026-01-01 | 2026-04-30 | ARES S. COOP MAD | — | ejecucion |
| 13 | foodforward | FoodForward Valencia | AgroTech | Lidia García | 30.000 | 2026-02-01 | 2027-01-31 | EatCloud | — | inicio |
| 14 | albufera | Albufera · Aportaciones de agua | UrbanTech | Francisca Hipólito | 50.000 | 2026-03-01 | — | — | — | inicio |
| 15 | torres | Més que unes Torres | VR-Videojuegos | Miguel Ángel Mas | 50.000 | 2026-03-01 | 2026-02-28 (typo) | — | — | inicio |
| 16 | ia-violencia-deporte | IA y Violencia en el Deporte | GovTech | Laura López | — | 2026-04-01 | — | — | — | sin_iniciar |

**Patrones regex sugeridos por reto** (para `filePatterns`, todos case-insensitive):

```typescript
sirval:               [/indicadores[-_ ]?de[-_ ]?innovaci[oó]n/i, /sirval/i]
metaverso-vic:        [/metaverso/i]
showroom-vr:          [/showroom/i]
alertesiv:            [/incendios/i, /alertesiv/i]
censo-federado:       [/censo[-_ ]?[uú]nico[-_ ]?federado/i, /censo/i]
sigma-it:             [/sertic[-_ ]?incidencias/i, /sigma[-_ ]?it/i]
comunicacion-ia:      [/(vic[-_ ])?comunicaci[oó]n/i]
placenet:             [/parques[-_ ]?del[-_ ]?futuro/i, /placenet/i]
spot4dis:             [/scigd[-_ ]?pmr/i, /spot4dis/i, /\bpmr\b/i]
grantia:              [/si[-_ ]?evaluaci[oó]n[-_ ]?spi/i, /grantia/i]
smarttourflow:        [/smarttourflow/i]
voto-telematico:      [/voto[-_ ]?(telem[áa]tico|electr[óo]nico)/i]
foodforward:          [/ffw|foodforward|food[-_ ]?forward/i]
albufera:             [/albufera/i]
torres:               [/torres/i]
ia-violencia-deporte: [/ia[-_ ]?(y[-_ ])?violencia|violencia[-_ ]?deporte/i]
```

---

## 5. Esquema de base de datos

4 tablas en Supabase Postgres.

### `retos`
Identidad estable de cada reto. Una fila por reto del registry. Se sincroniza
desde el registry en cada sync (upsert).

```
id                        text PK            (slug: 'sirval', 'sigma-it'...)
codigo                    integer            (1..16)
nombre                    text NOT NULL
area                      text               (GovTech | UrbanTech | AgroTech | ESD | VR-Videojuegos)
owner_municipal           text
owner_tecnico_vic         text               (extraído de la última ficha)
seguimiento_tecnico_vic   text               (extraído de la última ficha)
presupuesto               integer            (€)
fecha_inicio              date
fecha_fin                 date
empresa_adjudicataria     text
solucion                  text
estado_global             text               (inicio|ejecucion|evaluacion|fin|sin_iniciar)
ficha_mas_reciente        text               (YYYY-MM)
ultima_actualizacion      timestamp
created_at                timestamp DEFAULT now()
updated_at                timestamp DEFAULT now()
```

### `fichas_mensuales`
Snapshot mensual completo del estado de un reto. Una fila por (reto, mes).
Permite ver evolución temporal.

```
id                            serial PK
reto_id                       text FK → retos.id ON DELETE CASCADE
mes                           text NOT NULL                   (YYYY-MM)

-- Identidad capturada en este snapshot
nombre                        text
objetivo                      text
fecha_lanzamiento             text
area_tematica                 text
tipo_reto                     text
entidades_impulsoras          text
entidades_participantes       text
contexto_urbano               text
kpis                          jsonb                            (string[])
documentacion_asociada        text
estado_actual                 text
observaciones                 text

-- Bloque de seguimiento mensual
fecha_seguimiento             date
fecha_seguimiento_raw         text
hitos_alcanzados              text
riesgos_principales           text
issues_abiertos               text
proximos_pasos                text

-- Metadatos del .docx
meta_programa                 text
meta_owner_tecnico_vic        text
meta_seguimiento_tecnico_vic  text
meta_servicios_municipales    text
meta_cuenta_analitica         text
meta_presupuesto              integer
meta_presupuesto_raw          text
meta_plazo                    text

-- Sincronización SharePoint
sharepoint_path               text
sharepoint_web_url            text
sharepoint_drive_item_id      text
sharepoint_modified_at        timestamp

-- Diagnóstico parser
parser_status                 text                             (ok|partial|error)
parser_warnings               jsonb                            (string[])
raw_text                      text                             (texto crudo, por si hay que reparsear)

synced_at                     timestamp DEFAULT now()

UNIQUE (reto_id, mes)
```

### `alertas`

```
id              serial PK
reto_id         text FK → retos.id ON DELETE CASCADE
tipo            text NOT NULL    (sin_actualizacion|campos_vacios|plazo_vencido|ficha_mal_formada|sin_ficha)
severidad       text NOT NULL    (info|warn|critical)
mensaje         text NOT NULL
contexto        jsonb            (datos extra: qué campo, qué fecha...)
generada_at     timestamp DEFAULT now()
resuelta_at     timestamp
activa          boolean DEFAULT true
```

### `sync_runs`

```
id                    serial PK
started_at            timestamp DEFAULT now()
finished_at           timestamp
status                text                   (running|success|error)
fichas_procesadas     integer DEFAULT 0
fichas_nuevas         integer DEFAULT 0
fichas_actualizadas   integer DEFAULT 0
errores               jsonb                  ({ficha:string, error:string}[])
trigger               text                   (cron|manual)
```

---

## 6. Reglas de alertas

5 tipos. Se recalculan al final de cada sync (todas se marcan `activa=false` y
las que sigan siendo válidas se reinsertan).

| Tipo | Severidad | Condición | Mensaje |
|------|-----------|-----------|---------|
| `sin_ficha` | warn | El reto no tiene ninguna fila en `fichas_mensuales` y `estado_global != 'sin_iniciar'` | "No hay ficha mensual en SharePoint para este reto" |
| `sin_actualizacion` | critical | La ficha más reciente es de un mes anterior al actual Y estamos pasados del día 20 | "Última ficha es de YYYY-MM, pendiente actualización de YYYY-MM" |
| `campos_vacios` | warn | La ficha del mes actual tiene 2+ campos vacíos entre {Hitos, Riesgos, Issues, Próximos pasos} | "Campos vacíos en ficha de YYYY-MM: ..." |
| `plazo_vencido` | warn | `fecha_fin < hoy` Y `estado_global != 'fin'` | "Fecha fin (YYYY-MM-DD) ya pasada y estado del reto no es 'fin'" |
| `ficha_mal_formada` | warn | `parser_status = 'error'` en la ficha más reciente | "Parser no pudo extraer estructura de la ficha de YYYY-MM" |

Retos con `estado_global = 'fin'` no generan alertas (excepto si está mal etiquetado).

---

## 7. Acceso a SharePoint (PENDIENTE DE DECISIÓN — dejar parametrizable)

NO usar Azure AD App Registration. Las opciones vivas son:

- **B.** Cuenta de servicio Microsoft (`vic-retos-bot@lasnaves.com` o similar)
  con device code flow + refresh token persistido. Cron automático.
- **C.** Sync manual desde portátil de Arturo. Cron Vercel desactivado;
  `npm run sync` ejecutado a mano cuando quiera refrescar.

Implementación pragmática: dejar `src/lib/sharepoint.ts` con dos modos seleccionables
por variable de entorno `SHAREPOINT_AUTH_MODE`:
- `device-code` → flujo interactivo, guarda token en BD (tabla `auth_tokens`)
- `manual-token` → lee token de `SHAREPOINT_ACCESS_TOKEN` env var

Mientras no haya decisión, dejar el código preparado pero el cron de Vercel
desactivado. El sync manual desde el portátil de Arturo (vía device code,
guardando token en `.env.local`) tiene que funcionar de todas formas para la
primera carga.

**Endpoint del site:** `https://lasnavesvlc.sharepoint.com/sites/RetosInternos`
**Ruta de la biblioteca:** `Shared Documents/RETOS INTERNOS/<MM Mes AAAA>/`

---

## 8. Páginas y rutas del dashboard

```
/                          Cuadro de programa (home, server component)
/retos/[id]                Detalle reto + timeline mensual (server component)
/alertas                   Lista alertas activas agrupadas por severidad
/delegacion                Vista imprimible para Concejala (botón Print/PDF)
/login                     Magic link
/auth/callback             Intercambio code → session
/no-autorizado             Pantalla cuando email no está en allowlist
/api/sync                  POST: sincronización (cron Vercel + manual)
```

### Cuadro de programa (`/`)

- 4 tarjetas de métrica arriba: En ejecución, Finalizados, € comprometido, Alertas activas
- Tabla con los 16 retos: #, Nombre, Área, Owner, Presupuesto, Semáforo, Última actualización, Alerta principal
- Botón "Sincronizar ahora" (manual, llama a `/api/sync`)
- Información de última sincronización

**Cálculo del semáforo** (calculado, no almacenado):
- Gris: `estado_global` ∈ {fin, sin_iniciar} O sin ficha
- Rojo: hay alerta `critical`
- Ámbar: hay alerta `warn`
- Verde: con ficha del mes actual y sin alertas

### Detalle de reto (`/retos/[id]`)

- Cabecera con nombre, código, área, owner, presupuesto, estado
- Bloque de alertas activas del reto (si hay)
- Bloque de identidad (objetivo, KPIs, entidades, documentación) tomado de la ficha más reciente
- Timeline mensual: lista de fichas en orden inverso, cada una mostrando los 4 campos del bloque de seguimiento
- Cada ficha tiene link al `.docx` original en SharePoint

### Vista Delegación (`/delegacion`)

- Cabecera con título e indicador de mes
- Resumen ejecutivo: 4 stats (total, en ejecución, finalizados, en inicio) + 2 (€ comprometido, alertas críticas)
- Sección por área, con lista de retos compacta (nombre, empresa, estado, fecha última actualización)
- Botón "Imprimir / PDF" (componente cliente, llama a `window.print()`)
- Estilos `print:` de Tailwind para que el PDF salga bien

### Diseño visual

- Estética flat, limpia, blanca. Sin gradientes ni sombras.
- Tipografía sistema (San Francisco / Segoe UI).
- Tonos slate (Tailwind) como base. Acentos azul (info), ámbar (warn), rojo (critical).
- Bordes 1px slate-200, radio `rounded-xl` (12px) para tarjetas y `rounded-md` (6px) para inputs.
- Tabla con `divide-y` slate-100, hover slate-50.
- Mobile: el cuadro de programa puede degradarse a tarjetas verticales en pantallas <640px (no es prioridad pero conviene).

---

## 9. Auth y allowlist

Magic link Supabase (`signInWithOtp`). Sin OAuth.

Middleware Next.js (`src/middleware.ts`) que:
1. Excluye `/api/sync` (auth por `CRON_SECRET` en el handler)
2. Excluye `/login`, `/no-autorizado`, `/auth/callback`
3. Verifica sesión Supabase. Si no hay → `/login`
4. Verifica email en allowlist hardcoded. Si no → `/no-autorizado`

Allowlist inicial:
```typescript
const ALLOWED_EMAILS = [
  'arturo.castello@lasnaves.com',
  'jose.almenar@lasnaves.com',
  // 'concejala@valencia.es',  // TODO: confirmar email
].map(e => e.toLowerCase());
```

---

## 10. Tests del parser

Crear `scripts/test-parser.ts` que ejercite el parser contra fixtures reales
en `test-fixtures/`. Los textos de las 4 fichas reales están al final de este
documento, en el anexo.

Resultado esperado: 3 OK, 1 Partial (ALERTESIV con Issues vacío — correcto, está
realmente vacío en la ficha original).

`package.json` script:
```json
"test:parser": "tsx scripts/test-parser.ts"
```

---

## 11. Comandos disponibles (`package.json`)

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "db:push": "drizzle-kit push",
  "db:generate": "drizzle-kit generate",
  "db:studio": "drizzle-kit studio",
  "sync": "tsx scripts/sync-sharepoint.ts",
  "test:parser": "tsx scripts/test-parser.ts"
}
```

---

## ANEXO: Fixtures de las 4 fichas reales

### `test-fixtures/alertesiv-abril.txt`

(Variante: bloque seguimiento dentro de 📝 Observaciones, fecha `(20/04)`,
Issues abiertos vacío.)

```
Ficha de Reto  🆔   Nombre del Reto  "ALERTESIV" Incendios (+10 +100), sistema de apoyo al servicio de bomberos para la evacuación y extinción de incendios en edificios y de aviso, en tiempo real y accesible a las personas que los habitan.  🎯   Objetivo del Reto  El proyecto ALERTESIV plantea el desarrollo de una plataforma tecnológica interactiva (alertesiv.com) diseñada para agilizar la evacuación y la intervención de los bomberos en edificios de más de 10 plantas o con más de 100 viviendas, con el objetivo final de salvar vidas. La solución se estructura en tres perfiles de uso: ciudadanía, servicios de emergencia y administradores técnicos. Cada uno cuenta con una interfaz adaptada, pensada para actuar en tiempo real y facilitar la toma de decisiones, con especial atención a la accesibilidad y a colectivos vulnerables como personas con autismo, sordera o dependencia.  🗓️  Fecha de Lanzamiento  Lanzamiento del reto en marzo de 2025. Piloto en mayo y junio de 2026. Finalización en julio de 2026.  🧠   Área Temática  Emergencias.  🛠️  Tipo de Reto  GovTech, concurso de proyectos con premio de contrato menor por 50K.  👥   Entidades Impulsoras  Servicio de bomberos, VIC.  🤝   Entidades Participantes  Entidad contratada: Armoniats. Solución aportada: ALERTESIV Administradores de fincas de edificios piloto.  📍   Contexto Urbano  Se demostrará en edificios, diferentes propuestas:
- Edificio viviendas públicas en Safranar (ocupado por propietarios edificio incendiado en Campanar principalmente)
- Torre de Francia
- Edificio en Cortes Valencianas (propuesto por Bomberos).
- Torre Ulyses (Perellonet)  📊   Indicadores de Éxito  •   KPI 1: Tiempo medio entre alerta y acción operativa (objetivo: reducción ≥ 30 %).  •   KPI 2: % de alertas ciudadanas procesadas automáticamente por IA.  •   KPI 3: % de viviendas o zonas notificadas con éxito.  •   KPI 4: Nivel de satisfacción de los bomberos tras el piloto.  •   KPI 5: Grado de integración técnica con fuentes oficiales (catastro, fichas, APIs externas).  📎   Documentación Asociada  https://lasnavesvlc.sharepoint.com/sites/EXTALERTESIV  🔄   Estado Actual  Ejecución. Se ha preparado un dossier para enviar a interesados (Torre Francia y Edificio Cortes Valencianas). El edificio de Safranar está pendiente de respuesta por el concejal. Torre Ulyses posible alternativa a Safranar.  📝   Observaciones  (20/04)  Hitos alcanzados:  •   Aplicación desarrollada: incluye llamada automática a viviendas en caso de emergencia y cambios propuestos por Pedro Canales (Bomberos)  •   Aplicación alojada en servidor VIC  •   Primer contacto con edificios. Contacto con Presidenta de Administradores de Fincas. Se redacta un documento (Pedro Canales) revisado por Comunicaciones (Olga Palomares) para poder dar información sobre el proyecto.  Riesgos principales  •   Edificio Cortes Valencianas lo ve como una depreciación del inmueble si hay simulacro con bomberos; torre Safranar no tenemos respuesta de momento  Issues abiertos  •  Próximos pasos (30 días)
•   Concertar reunión con Administraciones en Mayo  •   Realización de posible prueba con usuarios pero sin simulacro en edificio Cortes Valencianas en Mayo para preparar los 2 simulacros de Junio  Metadatos  Programa: GovTech  Owner (téc. I+D+i): Jose Almenar  Servicio(s) municipal(es) implicado(s): Bomberos.  Cuenta analítica: GovTech  Presupuesto (€): 50.000€.  Plazo (inicio – fin): Agosto 2025 – julio 2026.
```

### `test-fixtures/censo-abril.txt`

(Variante: fecha `24 de abril de 2026`.)

```
Ficha de Reto  🆔   Nombre del Reto  Censo Único Federado  🎯   Objetivo del Reto  Desarrollo de una solución tecnológica avanzada que permita consolidar, armonizar y explotar los datos de las 58 federaciones deportivas de la Comunitat Valenciana. Esta solución tecnológica garantizará la identificación inequívoca y trazable de las personas federadas, una gestión eficiente de recursos y mejora de los servicios públicos deportivos. El proyecto está en desarrollo e incluye los siguientes módulos de desarrollo:
•   Fase 1. Diseño técnico del sistema: Definición de la estructura del Identificador Único Federado (ID-GVA), Creación de plantillas de integración de datos (hasta 20 campos por federado) y Desarrollo del prototipo del CRM en entorno cloud.
•   Fase 2. Desarrollo del MVP funcional: Implementación del sistema con carga manual de datos (CSV validado) y, si es posible, carga automática vía API, Integración inicial de datos de las 58 federaciones deportivas y Puesta en marcha del panel de control operativo con indicadores clave (volumen de federados, evolución temporal, segmentación por edad, género, etc.).  🗓️  Fecha de Lanzamiento  Lanzamiento del reto en junio de 2025.  🧠   Área Temática  GovTech / Tecnologías aplicadas a la gestión pública y la innovación deportiva.  🛠️  Tipo de Reto  GovTech, contrato menor por 50K en calidad de agente innovador. Publicación de las bases en la Plataforma de Contratación Pública con libre concurrencia.  👥   Entidades Impulsoras  VIC y GVA (Dirección General de Deportes)  🤝   Entidades Participantes  Entidad ganadora: DEEPSENSE.  📍   Contexto Urbano  Proveerá de una solución tecnológica común para el ecosistema federativo deportivo de la Comunitat Valenciana.  📊   Indicadores de Éxito  •   KPI 1: entrega MVP funcional.  •   KPI 2: número de federaciones deportivas de la Comunitat Valenciana que se conectan a la plataforma.  •   KPI 3: número de federaciones deportivas de la Comunitat Valenciana que se integran sus bases de datos en la plataforma  •   KPI 4: satisfacción de la entidad ante la solución resultante.  📎   Documentación Asociada  Censo Único Federado  🔄   Estado Actual  Ejecución.  📝   Observaciones  Riesgos: limitaciones tecnológicas, nivel de participación de las federaciones deportivas  24 de abril de 2026  Hitos alcanzados  •   No se ha avanzado en el proyecto  Riesgos principales  •   Proyecto bloqueado sin fecha de resolución. Las federaciones deportivas no han accedido a participar por no verse 'obligadas' o 'motivadas' a participar en el proyecto utilizando los datos de las personas federadas y el proyecto no avanza.  •   Posible aplazamiento a 2027. En la reunión del 20/04/26, DGD plantea como opción aplazar la finalización del proyecto y retomarlo en 2027, sin concretar fecha. VIC debe valorar si esta solución es viable legal y operativamente.
Issues abiertos  •   Decisión sobre el aplazamiento a 2027: VIC debe valorar su viabilidad legal y operativa.  •   Ausencia de fecha concreta para la reanudación del proyecto en caso de aplazamiento.  Próximos pasos (30 días)  •   VIC debe valorar la viabilidad legal y operativa del aplazamiento sugerido por GVA.  •   El proyecto sigue bloqueado.  Metadatos  Programa: GovTech  Owner (téc. I+D+i): Laura López  Servicio(s) municipal(es) implicado(s):  Cuenta analítica: Iniciativas singulares / Centro de Excelencia en tecnologías del deporte  Presupuesto (€): 50.941,00 €  Plazo (inicio – fin): Septiembre 2025 – Septiembre 2026.
```

### `test-fixtures/metaverso-abril.txt`

(Variante: bloque numerado en MAYÚSCULAS `1. HITOS ALCANZADOS`, fecha `24/04/2026`,
incluye campo `Seguimiento (téc. I+D+i)`.)

```
Ficha de Reto  🆔   Nombre del Reto  Entorno Virtual Inmersivo de VIC.  🎯   Objetivo del Reto  Pretende el diseño y entrega de un entorno virtual inmersivo que represente La Harinera y Las Naves, sirva como hub digital de VIC, y permita el acceso remoto a eventos, contenidos interactivos y experiencias gamificadas. El proyecto está en desarrollo e incluye los siguientes módulos:
•   Módulo 1: Desarrollo del entorno virtual inmersivo: un espacio digital 3D con capacidad de personalización, que incluya integración de vídeos, avatares, presentaciones, navegación temática. Y que sea un espacio multiusuario para eventos.
•   Módulo 2: Programa formativo (mínimo 30h) sobre contenidos para el entorno virtual.
•   Módulo 3: Lanzamiento de reto al ecosistema: Diseño y ejecución de un reto de innovación abierto para startups, universidades y otros actores.
•   Módulo 4: Evento de presentación híbrido en La Harinera y en el entorno virtual.  🗓️  Fecha de Lanzamiento  Lanzamiento del reto en mayo de 2025.  🧠   Área Temática  VR, videojuegos.  🛠️  Tipo de Reto  GovTech, contrato menor por 35K, invitando a tres empresas.  👥   Entidades Impulsoras  VIC.  🤝   Entidades Participantes  Entidad ganadora: r3s3t.  📍   Contexto Urbano  Proveerá un entorno virtual que representará las salas de eventos de Las Naves y La Harinera.  📊   Indicadores de Éxito  •   KPI 1: asistentes al evento de presentación del proyecto.  •   KPI 2: número de personas interesadas en participar en el programa de formación.  •   KPI 3: propuestas presentadas al primer reto.  •   KPI 4: satisfacción de la entidad ante la solución resultante.  📎   Documentación Asociada  Metaverso VIC  🔄   Estado Actual  Ejecución. Lanzamiento del sistema en enero de 2026 con evento de presentación a stakeholders (sobre todo Valencia Game City) y comienzo del programa de formación. Lanzamiento del reto al ecosistema en abril de 2026.  24/04/2026
1. HITOS ALCANZADOS  Curso de formación → FINALIZADO EL 30 MARZO  •   La última sesión tuvo la participación de DeuSens. Tras una Master Class llevamos al alumnado a visitar la exposición en LN comisaria por María Tinoco, que combina arte y realidad aumentada.  •   Se ha pasado una encuesta de Satisfacción a los participantes. Aquí un breve resumen de los resultados obtenidos:
o   17 respuestas · Valoración media: 4,29/5 · 93% recomendaría el curso
o   Lo mejor: los docentes (mencionados por 14 de 17 participantes), seguidos de los casos reales, el networking y el espacio.
o   Lo más valorado en aspectos específicos: calidad de ponentes, instalaciones y relación con el profesor.
o   Principal área de mejora: más contenido práctico y materiales de apoyo — es la demanda unánime de quienes respondieron la pregunta abierta. También se menciona puntualmente la repetición entre ponentes y la dificultad de compatibilizar horarios con el trabajo.
2. RIESGOS PRINCIPALES  Tecnológicos
•   Problema de carga del METAVERSO VIC en el edificio de Las Naves: reportado a Civired y a Mar Ferrer (jefa de sistemas) ya que parece ser un problema de nuestro Firewall. Comentan que se solventará con el cambio de dominio previsto en breve.
•   Riesgo de sobrecarga si aumenta el número de usuarios o funcionalidades → mitigado: se espera que el entorno METAVERSO VIC pueda soportar un alto número de participantes simultáneos.
Operativos
•   El cambio de subdominio sigue pendiente y puede retrasar despliegues.
3. ISSUES ABIERTOS  •   Cambio de subdominio aún no ejecutado.
4. PRÓXIMOS PASOS (30 DÍAS)  Tecnología  •   Ejecutar el cambio de subdominio y validar servidores.  •   Confirmar funcionamiento estable de la plataforma en La Harinera.  •   Recepción de la documentación técnica para la transferencia, gestión autónoma y futuras actualizaciones del entorno por parte de la Fundación.  Reto al ecosistema: Difusión y ecosistema  •   Estamos empezando a perfilar el Reto que se lanzará. Hemos consultado al alumnado aunque las propuestas no tienen el alcance esperado y se le ha pedido a la empresa contratada que lo reoriente según el marco de actuación de la entidad.  📝   Observaciones  Riesgos: limitaciones tecnológicas (red, capacidad de equipos, etc)  Metadatos  Programa: GovTech  Owner (téc. I+D+i): Gema Roig  Seguimiento (téc. I+D+i): Miguel Angel Mas  Servicio(s) municipal(es) implicado(s):  Cuenta analítica: GovTech  Presupuesto (€): 34.920,00 €  Plazo (inicio – fin): Mayo 2025 – abril 2026.
```

### `test-fixtures/voto-abril.txt`

(Variante: fecha `24 de abril 2026` sin segundo "de", `Hitos alcanzados (Fase 2 completada)`.)

```
Ficha de Reto  🆔   Nombre del Reto  App Voto Telemático  🎯   Objetivo del Reto  Diseñar y desarrollar una aplicación digital segura, interoperable y escalable que permita la gestión integral del voto telemático anticipado en los procesos electorales de las federaciones deportivas de la Comunitat Valenciana con el fin de modernizar y estandarizar los procesos electorales federativos asegurando la seguridad, la transparencia y la accesibilidad democrática.  🗓️  Fecha de Lanzamiento  Lanzamiento del reto en noviembre de 2025.  🧠   Área Temática  GobTech / Tecnologías aplicadas a la gestión pública y la innovación deportiva.  🛠️  Tipo de Reto  GovTech, contrato menor por 30K en calidad de agente innovador. Publicación de las bases en la Plataforma de Contratación Pública con libre concurrencia.  👥   Entidades Impulsoras  VIC y GVA (Dirección General de Deportes)  🤝   Entidades Participantes  Entidad ganadora: ARES S. COOP MAD.  📍   Contexto Urbano  Proveerá de una solución tecnológica común para el ecosistema federativo deportivo de la Comunitat Valenciana.  📊   Indicadores de Éxito  •   KPI 1: Entrega MVP funcional.  •   KPI 2: Número de verificaciones de la sincronización e interoperabilidad con ELEDEP y con el futuro Censo Único Federado.  •   KPI 3: Seguridad del sistema  •   KPI 4: Accesibilidad del sistema: número de tareas completadas sin asistencia en pruebas de usuario.  •   KPI 5: Escalabilidad: número de personas que pueden votar y usar la aplicación sin incidencias remarcables  📎   Documentación Asociada  App Voto Telemático  🔄   Estado Actual  Ejecución.  📝   Observaciones  Riesgos: limitaciones tecnológicas, nivel de participación de las federaciones deportivas, cumplimiento del calendario propuesto por DGD.  24 de abril 2026  Hitos alcanzados (Fase 2 completada)  •   Se han aplicado todas las modificaciones solicitadas tras el MVP: nuevo método de autenticación por SMS/email, opción de voto en blanco, ordenación de candidatos, protección del formulario de censo e integración del sellado de tiempo con ACCV.  •   La plataforma está instalada en su ubicación definitiva en los servidores de KUMO (Valencia y Murcia). [Contratado a través de GVA]  •   Se han realizado simulaciones de votación con personal de la DGD, probando los distintos métodos de autenticación y el diseño de papeletas.  •   La Federación de Pádel será la primera en utilizar la plataforma: periodo de voto anticipado del 4 al 8 de mayo de 2026.  Riesgos principales  •   Validación técnica pendiente. Se ha solicitado a DGD en dos ocasiones (25/03 y 08/04) un informe de validación formal. A fecha 23/04/26, GVA ha confirmado que lo enviará, pero aún no se ha recibido. Sin este informe no puede autorizarse el Pago 2.  •   Inicio inminente de elecciones reales. La Federación de Pádel votará a partir del 4 de mayo. No se ha completado el ciclo de validación formal ni las pruebas piloto con federaciones reales pero GVA ha dicho que todas las pruebas previas han sido satisfactorias y quieren usar la versión definitiva presentada.  Issues abiertos  •   Informe de validación técnica de GVA: solicitado, pendiente de recibir.  •   Feedback de GVA sobre los manuales entregados, en particular sobre la Guía del Votante.  •   Alta de responsables federativos como administradores en la plataforma (pendiente de que DGD facilite los datos).  •   Verificación formal de la integración con ELEDEP.  Próximos pasos (30 días)  •   Recibir y revisar el informe de validación técnica de GVA. Si está OK procederemos al pago de la 2º Factura  •   Recopilar feedback /validación de GVA sobre los manuales entregados.  •   Primeras elecciones con Voto Telemático (FD de Pádel - 4 – 8 de mayo - se va a preparar una NdP conjunta Ayto+GVA  •   Calendarizar próximas elecciones  Metadatos  Programa: GovTech  Owner (téc. I+D+i): Laura López  Servicio(s) municipal(es) implicado(s):  Cuenta analítica: Iniciativas singulares / Centro de Excelencia en tecnologías del deporte  Presupuesto (€): 36.300 € (IVA incluido)  Plazo (inicio – fin): Enero 2026 – Abril 2026.
```
