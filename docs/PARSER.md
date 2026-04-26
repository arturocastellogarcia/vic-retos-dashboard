# Cómo extender el parser

El parser (`src/lib/parser.ts`) está diseñado para tolerar variantes en las fichas `.docx` documentadas en [`CONTEXTO.md §3`](CONTEXTO.md). Cuando aparezca una variante nueva, sigue este flujo.

## Diagnóstico inicial

1. **Reproduce el problema con un fixture**. Copia el `.docx` que falla, extrae el texto crudo (puedes usar `mammoth` desde un script ad-hoc o copy-paste desde Word) y guárdalo como `test-fixtures/<nombre>-<mes>.txt`.
2. Añade el fixture a la lista en `scripts/test-parser.ts`:
   ```ts
   { file: '<nombre>-<mes>.txt', expected: 'ok' as const },
   ```
3. Corre `npm run test:parser`. Verás qué campos quedan vacíos o con avisos.

## Casos típicos y dónde tocar

### Variante de fecha de seguimiento nueva

Edita `findSeguimientoDate()` en `src/lib/parser.ts`. Las variantes están numeradas V1..V4 al inicio:

- V1: `24 de abril de 2026` (segundo "de" opcional → cubre `24 de abril 2026`)
- V2: `24 Abril 2026` (sin "de")
- V3: `24/04/2026`
- V4: `(20/04)` — sin año, asume el actual

Añade una V5 antes del fallback `'No se encontró fecha de seguimiento'`.

### Encabezado de subsección con formato distinto

Edita `SUBSECTION_PATTERNS` en `src/lib/parser.ts`. Cada regex permite:

- Numeración opcional (`1.`, `2.`, …)
- Paréntesis colgantes (`(Fase 2 completada)`, `(30 días)`)
- Dos puntos opcionales

Si el nuevo formato no encaja (ej. una numeración romana `I. HITOS ALCANZADOS`), edita el pattern correspondiente.

### Campo de metadatos nuevo

Edita `METADATA_LABELS` en `src/lib/parser.ts`. Cada entry mapea una regex a una clave del objeto metadatos. Añade la clave también a `parseMetadatos()` y al esquema (`src/db/schema.ts`).

### Regex de identificación de fichas (filePatterns)

Si un .docx aparece en SharePoint y no matchea ningún reto, sale como "huérfana" en el output del sync. Edita `src/lib/retos-registry.ts` y añade un patrón al `filePatterns` del reto correspondiente.

## Estado del parser

- **`ok`**: 0 avisos.
- **`partial`**: 1-4 avisos. La ficha se guarda pero parser tiene observaciones.
- **`error`**: 5+ avisos. Se guarda igualmente (con `raw_text` por si hay que reparsear) pero genera alerta `ficha_mal_formada`.

Los avisos se acumulan en `parserWarnings: string[]` y se almacenan como JSONB en `fichas_mensuales.parser_warnings`.

## Debugging interactivo

```bash
# Ejecutar el parser contra un único fixture
npx tsx -e "
  import { readFileSync } from 'fs';
  import { parseFichaText } from './src/lib/parser';
  const text = readFileSync('test-fixtures/voto-abril.txt', 'utf8');
  console.log(JSON.stringify(parseFichaText(text), null, 2));
"
```

## Checklist al añadir una variante

- [ ] Fixture añadido en `test-fixtures/`
- [ ] Fixture registrado en `scripts/test-parser.ts`
- [ ] Parser ajustado
- [ ] `npm run test:parser` pasa
- [ ] (Opcional) Documenta la variante en `docs/CONTEXTO.md §3`
