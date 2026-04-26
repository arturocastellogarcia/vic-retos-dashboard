// Parser de fichas .docx de retos VIC.
// Estrategia: dividir el texto crudo por los emojis-ancla de cada sección y
// extraer los subbloques (seguimiento mensual + metadatos) con regex tolerantes
// a las variantes documentadas en docs/CONTEXTO.md §3.

export type ParserStatus = 'ok' | 'partial' | 'error';

export interface ParsedFicha {
  // Identidad
  nombre: string | null;
  objetivo: string | null;
  fechaLanzamiento: string | null;
  areaTematica: string | null;
  tipoReto: string | null;
  entidadesImpulsoras: string | null;
  entidadesParticipantes: string | null;
  contextoUrbano: string | null;
  kpis: string[];
  documentacionAsociada: string | null;
  estadoActual: string | null;
  observaciones: string | null;

  // Bloque de seguimiento mensual
  fechaSeguimiento: string | null;       // ISO YYYY-MM-DD
  fechaSeguimientoRaw: string | null;    // texto original
  hitosAlcanzados: string | null;
  riesgosPrincipales: string | null;
  issuesAbiertos: string | null;
  proximosPasos: string | null;

  // Metadatos
  metaPrograma: string | null;
  metaOwnerTecnicoVic: string | null;
  metaSeguimientoTecnicoVic: string | null;
  metaServiciosMunicipales: string | null;
  metaCuentaAnalitica: string | null;
  metaPresupuesto: number | null;
  metaPresupuestoRaw: string | null;
  metaPlazo: string | null;

  // Diagnóstico
  parserStatus: ParserStatus;
  parserWarnings: string[];
}

// Definición de secciones por emoji + label esperado tras el emoji.
const SECTION_DEFS = [
  { codepoint: 0x1F194, key: 'nombre',                 emoji: '🆔', labelRe: /^\s*Nombre\s+del\s+Reto\s+/i },
  { codepoint: 0x1F3AF, key: 'objetivo',               emoji: '🎯', labelRe: /^\s*Objetivo\s+del\s+Reto\s+/i },
  { codepoint: 0x1F5D3, key: 'fechaLanzamiento',       emoji: '🗓', labelRe: /^\s*Fecha\s+de\s+Lanzamiento\s+/i },
  { codepoint: 0x1F9E0, key: 'areaTematica',           emoji: '🧠', labelRe: /^\s*[ÁA]rea\s+Tem[áa]tica\s+/i },
  { codepoint: 0x1F6E0, key: 'tipoReto',               emoji: '🛠', labelRe: /^\s*Tipo\s+de\s+Reto\s+/i },
  { codepoint: 0x1F465, key: 'entidadesImpulsoras',    emoji: '👥', labelRe: /^\s*Entidades\s+Impulsoras\s+/i },
  { codepoint: 0x1F91D, key: 'entidadesParticipantes', emoji: '🤝', labelRe: /^\s*Entidades\s+Participantes\s+/i },
  { codepoint: 0x1F4CD, key: 'contextoUrbano',         emoji: '📍', labelRe: /^\s*Contexto\s+Urbano\s+/i },
  { codepoint: 0x1F4CA, key: 'indicadoresExito',       emoji: '📊', labelRe: /^\s*Indicadores\s+de\s+[ÉE]xito\s+/i },
  { codepoint: 0x1F4CE, key: 'documentacionAsociada',  emoji: '📎', labelRe: /^\s*Documentaci[óo]n\s+Asociada\s+/i },
  { codepoint: 0x1F504, key: 'estadoActual',           emoji: '🔄', labelRe: /^\s*Estado\s+Actual\s+/i },
  { codepoint: 0x1F4DD, key: 'observaciones',          emoji: '📝', labelRe: /^\s*Observaciones\s+/i },
] as const;

const CODEPOINT_TO_KEY = new Map<number, string>(SECTION_DEFS.map(s => [s.codepoint, s.key]));
const LABEL_RE_BY_KEY = new Map<string, RegExp>(SECTION_DEFS.map(s => [s.key, s.labelRe]));

// Regex que captura cualquiera de los 12 emojis seguido de variation-selector U+FE0F opcional.
const EMOJI_REGEX = /([\u{1F194}\u{1F3AF}\u{1F5D3}\u{1F9E0}\u{1F6E0}\u{1F465}\u{1F91D}\u{1F4CD}\u{1F4CA}\u{1F4CE}\u{1F504}\u{1F4DD}])️?/gu;

function splitByEmojiSections(text: string) {
  const matches: Array<{ index: number; key: string; fullLen: number }> = [];
  let m: RegExpExecArray | null;
  // Reset lastIndex porque la regex es 'g'
  EMOJI_REGEX.lastIndex = 0;
  while ((m = EMOJI_REGEX.exec(text)) !== null) {
    const cp = m[1].codePointAt(0);
    if (cp == null) continue;
    const key = CODEPOINT_TO_KEY.get(cp);
    if (key) matches.push({ index: m.index, key, fullLen: m[0].length });
  }

  const sections: Record<string, string> = {};
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const next = matches[i + 1];
    const start = cur.index + cur.fullLen;
    const end = next ? next.index : text.length;
    const raw = text.slice(start, end);
    const labelRe = LABEL_RE_BY_KEY.get(cur.key);
    sections[cur.key] = labelRe ? raw.replace(labelRe, '').trim() : raw.trim();
  }

  return { sections, foundKeys: new Set(matches.map(x => x.key)) };
}

// --- Fechas de seguimiento (5 variantes documentadas) ---

const SPANISH_MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};
const MONTHS_ALT = Object.keys(SPANISH_MONTHS).join('|');

// V1: "24 de abril de 2026" (segundo "de" opcional → cubre "24 de abril 2026")
const DATE_V1_RE = new RegExp(`\\b(\\d{1,2})\\s+de\\s+(${MONTHS_ALT})(?:\\s+de)?\\s+(\\d{4})\\b`, 'i');
// V2: "24 Abril 2026" (sin "de")
const DATE_V2_RE = new RegExp(`\\b(\\d{1,2})\\s+(${MONTHS_ALT})\\s+(\\d{4})\\b`, 'i');
// V3: "24/04/2026"
const DATE_V3_RE = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/;
// V4: "(20/04)" sin año, asume actual
const DATE_V4_RE = /\((\d{1,2})\/(\d{1,2})\)/;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
function iso(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function findSeguimientoDate(text: string, warnings: string[]): { date: string | null; dateRaw: string | null } {
  let m = text.match(DATE_V1_RE);
  if (m) {
    const month = SPANISH_MONTHS[m[2].toLowerCase()];
    if (month) return { date: iso(parseInt(m[3], 10), month, parseInt(m[1], 10)), dateRaw: m[0] };
  }
  m = text.match(DATE_V2_RE);
  if (m) {
    const month = SPANISH_MONTHS[m[2].toLowerCase()];
    if (month) return { date: iso(parseInt(m[3], 10), month, parseInt(m[1], 10)), dateRaw: m[0] };
  }
  m = text.match(DATE_V3_RE);
  if (m) {
    return { date: iso(parseInt(m[3], 10), parseInt(m[2], 10), parseInt(m[1], 10)), dateRaw: m[0] };
  }
  m = text.match(DATE_V4_RE);
  if (m) {
    const year = new Date().getFullYear();
    warnings.push(`Fecha de seguimiento sin año (${m[0]}); se asume año actual ${year}`);
    return { date: iso(year, parseInt(m[2], 10), parseInt(m[1], 10)), dateRaw: m[0] };
  }
  warnings.push('No se encontró fecha de seguimiento');
  return { date: null, dateRaw: null };
}

// --- Subsecciones del bloque de seguimiento (4: hitos, riesgos, issues, próximos) ---

const SUBSECTION_PATTERNS: Array<{ key: 'hitos' | 'riesgos' | 'issues' | 'proximos'; re: RegExp }> = [
  // Tolerante a numeración "1." / "4.", a paréntesis "(Fase 2)" / "(30 días)" y a dos puntos opcionales.
  { key: 'hitos',    re: /(?:^|[\s•])(?:\d+\s*\.\s*)?hitos\s+alcanzados(?:\s*\([^)]*\))?\s*:?/i },
  { key: 'riesgos',  re: /(?:^|[\s•])(?:\d+\s*\.\s*)?riesgos\s+principales(?:\s*\([^)]*\))?\s*:?/i },
  { key: 'issues',   re: /(?:^|[\s•])(?:\d+\s*\.\s*)?issues\s+abiertos(?:\s*\([^)]*\))?\s*:?/i },
  { key: 'proximos', re: /(?:^|[\s•])(?:\d+\s*\.\s*)?pr[oó]ximos\s+pasos(?:\s*\([^)]*\))?\s*:?/i },
];

function parseSeguimiento(text: string, warnings: string[]) {
  const date = findSeguimientoDate(text, warnings);

  const found: Array<{ key: 'hitos' | 'riesgos' | 'issues' | 'proximos'; start: number; end: number }> = [];
  for (const { key, re } of SUBSECTION_PATTERNS) {
    const m = re.exec(text);
    if (m) {
      // Excluimos el carácter inicial (espacio o •) que el lookahead consumió, si existe.
      const matchStart = m.index;
      const matchEnd = m.index + m[0].length;
      found.push({ key, start: matchStart, end: matchEnd });
    }
  }
  found.sort((a, b) => a.start - b.start);

  const result: Record<'hitos' | 'riesgos' | 'issues' | 'proximos', string | null> = {
    hitos: null, riesgos: null, issues: null, proximos: null,
  };

  for (let i = 0; i < found.length; i++) {
    const cur = found[i];
    const next = found[i + 1];
    const contentStart = cur.end;
    const contentEnd = next ? next.start : text.length;
    let content = text.slice(contentStart, contentEnd).trim();
    // Si el contenido es solo bullets sueltos / espacios → vacío
    if (/^[•·▪◦\s]*$/.test(content)) {
      warnings.push(`Subsección "${cur.key}" sin contenido`);
      content = '';
    }
    result[cur.key] = content || null;
  }

  // Avisos por subsecciones no encontradas
  for (const { key } of SUBSECTION_PATTERNS) {
    if (!found.some(f => f.key === key)) {
      warnings.push(`Subsección "${key}" no encontrada`);
    }
  }

  return {
    fechaSeguimiento: date.date,
    fechaSeguimientoRaw: date.dateRaw,
    hitosAlcanzados: result.hitos,
    riesgosPrincipales: result.riesgos,
    issuesAbiertos: result.issues,
    proximosPasos: result.proximos,
  };
}

// --- KPIs (bullets dentro de "Indicadores de Éxito") ---

function parseKPIs(indicadoresText: string): string[] {
  if (!indicadoresText) return [];
  return indicadoresText
    .split(/[•·▪◦]/)
    .map(s => s.trim())
    .filter(s => /^KPI\s*\d/i.test(s));
}

// --- Metadatos (bloque al final tras la palabra "Metadatos") ---

const METADATA_LABELS: Array<{ key: string; re: RegExp }> = [
  { key: 'programa',         re: /\bPrograma\s*:?/i },
  { key: 'owner',            re: /\bOwner\s*\(\s*t[eé]c\.?\s*I\s*\+\s*D\s*\+\s*i\s*\)\s*:?/i },
  { key: 'seguimiento',      re: /\bSeguimiento\s*\(\s*t[eé]c\.?\s*I\s*\+\s*D\s*\+\s*i\s*\)\s*:?/i },
  { key: 'servicios',        re: /\bServicio\(s\)\s*municipal\(es\)\s*implicado\(s\)\s*:?/i },
  { key: 'cuentaAnalitica',  re: /\bCuenta\s*anal[íi]tica\s*:?/i },
  { key: 'presupuesto',      re: /\bPresupuesto\s*\(€\)\s*:?/i },
  { key: 'plazo',            re: /\bPlazo\s*\(\s*inicio\s*[\-–]\s*fin\s*\)\s*:?/i },
];

function parseMetadatos(text: string, warnings: string[]) {
  const out: Record<string, string | null> = {
    programa: null, owner: null, seguimiento: null,
    servicios: null, cuentaAnalitica: null,
    presupuesto: null, plazo: null,
  };

  if (!text || !text.trim()) {
    warnings.push('Bloque "Metadatos" vacío o ausente');
    return {
      metaPrograma: null,
      metaOwnerTecnicoVic: null,
      metaSeguimientoTecnicoVic: null,
      metaServiciosMunicipales: null,
      metaCuentaAnalitica: null,
      metaPresupuesto: null,
      metaPresupuestoRaw: null,
      metaPlazo: null,
    };
  }

  const positions: Array<{ key: string; start: number; end: number }> = [];
  for (const { key, re } of METADATA_LABELS) {
    const m = re.exec(text);
    if (m) positions.push({ key, start: m.index, end: m.index + m[0].length });
  }
  positions.sort((a, b) => a.start - b.start);

  for (let i = 0; i < positions.length; i++) {
    const cur = positions[i];
    const next = positions[i + 1];
    const valueStart = cur.end;
    const valueEnd = next ? next.start : text.length;
    const value = text.slice(valueStart, valueEnd).trim().replace(/[.\s]+$/, '').trim();
    out[cur.key] = value || null;
  }

  // Parse presupuesto a integer (acepta "50.000€", "34.920,00 €", "36.300 € (IVA incluido)")
  let presupuestoNumber: number | null = null;
  if (out.presupuesto) {
    const m = out.presupuesto.match(/(\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?/);
    if (m) {
      const intPart = m[1].replace(/\./g, '');
      const n = parseInt(intPart, 10);
      if (!Number.isNaN(n)) presupuestoNumber = n;
    }
  }

  return {
    metaPrograma: out.programa,
    metaOwnerTecnicoVic: out.owner,
    metaSeguimientoTecnicoVic: out.seguimiento,
    metaServiciosMunicipales: out.servicios,
    metaCuentaAnalitica: out.cuentaAnalitica,
    metaPresupuesto: presupuestoNumber,
    metaPresupuestoRaw: out.presupuesto,
    metaPlazo: out.plazo,
  };
}

// --- Helper ---

function nullOrTrim(s: string | undefined | null): string | null {
  if (s == null) return null;
  const t = s.trim();
  return t.length > 0 ? t : null;
}

// --- Entrada principal ---

export function parseFichaText(rawText: string): ParsedFicha {
  const warnings: string[] = [];

  const { sections, foundKeys } = splitByEmojiSections(rawText);

  // Avisos por secciones de cabecera ausentes
  for (const def of SECTION_DEFS) {
    if (!foundKeys.has(def.key)) {
      warnings.push(`Sección "${def.key}" no encontrada (esperado emoji ${def.emoji})`);
    }
  }

  // Separar el bloque "Metadatos" del contenido de Observaciones.
  // Por convención, "Metadatos" aparece al final, tras 📝 Observaciones.
  let observacionesText = sections.observaciones || '';
  let metadatosText = '';
  const metaMatch = observacionesText.match(/\bMetadatos\b/i);
  if (metaMatch && metaMatch.index != null) {
    metadatosText = observacionesText.slice(metaMatch.index + metaMatch[0].length);
    observacionesText = observacionesText.slice(0, metaMatch.index).trim();
  } else {
    warnings.push('No se encontró bloque "Metadatos"');
  }

  // El bloque de seguimiento puede vivir dentro de 🔄 Estado Actual o de 📝 Observaciones (o repartido).
  // Combinamos ambos textos para buscar fecha + 4 subsecciones.
  const seguimientoSource = `${sections.estadoActual || ''} ${observacionesText}`.trim();
  const seguimiento = parseSeguimiento(seguimientoSource, warnings);

  const kpis = parseKPIs(sections.indicadoresExito || '');
  const meta = parseMetadatos(metadatosText, warnings);

  // Estado: 0 → ok, 1-4 → partial, 5+ → error
  let parserStatus: ParserStatus;
  if (warnings.length === 0) parserStatus = 'ok';
  else if (warnings.length <= 4) parserStatus = 'partial';
  else parserStatus = 'error';

  return {
    nombre: nullOrTrim(sections.nombre),
    objetivo: nullOrTrim(sections.objetivo),
    fechaLanzamiento: nullOrTrim(sections.fechaLanzamiento),
    areaTematica: nullOrTrim(sections.areaTematica),
    tipoReto: nullOrTrim(sections.tipoReto),
    entidadesImpulsoras: nullOrTrim(sections.entidadesImpulsoras),
    entidadesParticipantes: nullOrTrim(sections.entidadesParticipantes),
    contextoUrbano: nullOrTrim(sections.contextoUrbano),
    kpis,
    documentacionAsociada: nullOrTrim(sections.documentacionAsociada),
    estadoActual: nullOrTrim(sections.estadoActual),
    observaciones: nullOrTrim(observacionesText),

    fechaSeguimiento: seguimiento.fechaSeguimiento,
    fechaSeguimientoRaw: seguimiento.fechaSeguimientoRaw,
    hitosAlcanzados: seguimiento.hitosAlcanzados,
    riesgosPrincipales: seguimiento.riesgosPrincipales,
    issuesAbiertos: seguimiento.issuesAbiertos,
    proximosPasos: seguimiento.proximosPasos,

    metaPrograma: meta.metaPrograma,
    metaOwnerTecnicoVic: meta.metaOwnerTecnicoVic,
    metaSeguimientoTecnicoVic: meta.metaSeguimientoTecnicoVic,
    metaServiciosMunicipales: meta.metaServiciosMunicipales,
    metaCuentaAnalitica: meta.metaCuentaAnalitica,
    metaPresupuesto: meta.metaPresupuesto,
    metaPresupuestoRaw: meta.metaPresupuestoRaw,
    metaPlazo: meta.metaPlazo,

    parserStatus,
    parserWarnings: warnings,
  };
}
