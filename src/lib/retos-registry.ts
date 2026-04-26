// Registry hardcoded de los 16 retos GovTech del programa VIC.
// Lista canónica consolidada por Jose Vicente Almenar (2026-04-26).
// Esta tabla es la fuente de verdad para la identidad estable de cada reto;
// los datos se sincronizan a la BD (tabla `retos`) en cada sync.

export type EstadoGlobal = 'inicio' | 'ejecucion' | 'evaluacion' | 'fin' | 'sin_iniciar';
export type AreaCanonica = 'GovTech' | 'UrbanTech' | 'AgroTech' | 'ESD' | 'VR-Videojuegos';

export interface RetoRegistry {
  id: string;                  // slug estable
  codigo: number;              // 1..16
  nombre: string;
  area: AreaCanonica;
  ownerMunicipal: string | null;
  presupuesto: number | null;  // €
  fechaInicio: string | null;  // ISO
  fechaFin: string | null;     // ISO
  empresaAdjudicataria: string | null;
  solucion: string | null;
  estadoGlobal: EstadoGlobal;
  filePatterns: RegExp[];      // case-insensitive, para identificar el .docx en SharePoint
}

export const RETOS_REGISTRY: RetoRegistry[] = [
  {
    id: 'sirval', codigo: 1,
    nombre: 'SIRVAL · Sistema de Indicadores de Innovación',
    area: 'GovTech',
    ownerMunicipal: 'Empar Soriano',
    presupuesto: 50000,
    fechaInicio: '2024-12-01', fechaFin: '2026-05-31',
    empresaAdjudicataria: 'TapIntoIt (AIDIMME)', solucion: null,
    estadoGlobal: 'ejecucion',
    filePatterns: [/indicadores[-_ ]?de[-_ ]?innovaci[oó]n/i, /sirval/i],
  },
  {
    id: 'metaverso-vic', codigo: 2,
    nombre: 'Metaverso · Entorno Virtual Inmersivo VIC',
    area: 'VR-Videojuegos',
    ownerMunicipal: 'Miguel Ángel Mas',
    presupuesto: 34920,
    fechaInicio: '2025-05-01', fechaFin: '2026-04-30',
    empresaAdjudicataria: 'r3s3t', solucion: 'Metaverso VIC',
    estadoGlobal: 'ejecucion',
    filePatterns: [/metaverso/i],
  },
  {
    id: 'showroom-vr', codigo: 3,
    nombre: 'Showroom VR VIC',
    area: 'VR-Videojuegos',
    ownerMunicipal: 'Miguel Ángel Mas',
    presupuesto: 26000,
    fechaInicio: '2025-05-01', fechaFin: '2026-04-30',
    empresaAdjudicataria: null, solucion: null,
    estadoGlobal: 'ejecucion',
    filePatterns: [/showroom/i],
  },
  {
    id: 'alertesiv', codigo: 4,
    nombre: 'ALERTESIV · Incendios 10x100',
    area: 'ESD',
    ownerMunicipal: 'Jose Almenar',
    presupuesto: 50000,
    fechaInicio: '2025-08-01', fechaFin: '2026-07-31',
    empresaAdjudicataria: 'Armoniats', solucion: 'ALERTESIV',
    estadoGlobal: 'ejecucion',
    filePatterns: [/incendios/i, /alertesiv/i],
  },
  {
    id: 'censo-federado', codigo: 5,
    nombre: 'Censo Único Federado',
    area: 'GovTech',
    ownerMunicipal: 'Laura López',
    presupuesto: 50941,
    fechaInicio: '2025-09-01', fechaFin: '2026-09-30',
    empresaAdjudicataria: 'DEEPSENSE', solucion: null,
    estadoGlobal: 'ejecucion',
    filePatterns: [/censo[-_ ]?[uú]nico[-_ ]?federado/i, /censo/i],
  },
  {
    id: 'sigma-it', codigo: 6,
    nombre: 'SIGMA-IT · SERTIC averías',
    area: 'GovTech',
    ownerMunicipal: 'Jose Almenar',
    presupuesto: 50000,
    fechaInicio: '2025-09-01', fechaFin: '2026-02-28',
    empresaAdjudicataria: 'Foqum Analytics', solucion: 'SIGMA-IT',
    estadoGlobal: 'fin',
    filePatterns: [/sertic[-_ ]?incidencias/i, /sigma[-_ ]?it/i],
  },
  {
    id: 'comunicacion-ia', codigo: 7,
    nombre: 'Comunicación automatizada · Etiqmedia',
    area: 'GovTech',
    ownerMunicipal: 'Yolanda Puchades',
    presupuesto: 50000,
    fechaInicio: '2025-09-01', fechaFin: '2026-02-28',
    empresaAdjudicataria: 'Etiqmedia', solucion: null,
    estadoGlobal: 'evaluacion',
    filePatterns: [/(vic[-_ ])?comunicaci[oó]n/i],
  },
  {
    id: 'placenet', codigo: 8,
    nombre: 'PLACENET · Parques del Futuro',
    area: 'UrbanTech',
    ownerMunicipal: 'Miguel Marés',
    presupuesto: 50000,
    fechaInicio: '2025-10-01', fechaFin: '2026-02-28',
    empresaAdjudicataria: 'Placenet', solucion: 'PLACENET',
    estadoGlobal: 'ejecucion',
    filePatterns: [/parques[-_ ]?del[-_ ]?futuro/i, /placenet/i],
  },
  {
    id: 'spot4dis', codigo: 9,
    nombre: 'Spot4Dis · SCIGD Plazas PMR',
    area: 'GovTech',
    ownerMunicipal: 'Jose Almenar',
    presupuesto: 50000,
    fechaInicio: '2025-10-01', fechaFin: '2026-03-31',
    empresaAdjudicataria: 'Solmes', solucion: 'Spot4Dis',
    estadoGlobal: 'evaluacion',
    filePatterns: [/scigd[-_ ]?pmr/i, /spot4dis/i, /\bpmr\b/i],
  },
  {
    id: 'grantia', codigo: 10,
    nombre: 'GrantIA · Servicio de Innovación SPI',
    area: 'GovTech',
    ownerMunicipal: 'Francisca Hipólito',
    presupuesto: 50000,
    fechaInicio: '2025-10-01', fechaFin: '2026-03-31',
    empresaAdjudicataria: '4i', solucion: 'GrantIA',
    estadoGlobal: 'evaluacion',
    filePatterns: [/si[-_ ]?evaluaci[oó]n[-_ ]?spi/i, /grantia/i],
  },
  {
    id: 'smarttourflow', codigo: 11,
    nombre: 'SmartTourFlow',
    area: 'UrbanTech',
    ownerMunicipal: 'Juan Manuel Rodilla',
    presupuesto: 50000,
    fechaInicio: '2025-11-01', fechaFin: '2026-11-30',
    empresaAdjudicataria: 'PurpleBlob', solucion: 'SmartTourFlow',
    estadoGlobal: 'inicio',
    filePatterns: [/smarttourflow/i],
  },
  {
    id: 'voto-telematico', codigo: 12,
    nombre: 'App Voto Telemático',
    area: 'GovTech',
    ownerMunicipal: 'Laura López',
    presupuesto: 36300,
    fechaInicio: '2026-01-01', fechaFin: '2026-04-30',
    empresaAdjudicataria: 'ARES S. COOP MAD', solucion: null,
    estadoGlobal: 'ejecucion',
    filePatterns: [/voto[-_ ]?(telem[áa]tico|electr[óo]nico)/i],
  },
  {
    id: 'foodforward', codigo: 13,
    nombre: 'FoodForward Valencia',
    area: 'AgroTech',
    ownerMunicipal: 'Lidia García',
    presupuesto: 30000,
    fechaInicio: '2026-02-01', fechaFin: '2027-01-31',
    empresaAdjudicataria: 'EatCloud', solucion: null,
    estadoGlobal: 'inicio',
    filePatterns: [/ffw|foodforward|food[-_ ]?forward/i],
  },
  {
    id: 'albufera', codigo: 14,
    nombre: 'Albufera · Aportaciones de agua',
    area: 'UrbanTech',
    ownerMunicipal: 'Francisca Hipólito',
    presupuesto: 50000,
    fechaInicio: '2026-03-01', fechaFin: null,
    empresaAdjudicataria: null, solucion: null,
    estadoGlobal: 'inicio',
    filePatterns: [/albufera/i],
  },
  {
    id: 'torres', codigo: 15,
    nombre: 'Més que unes Torres',
    area: 'VR-Videojuegos',
    ownerMunicipal: 'Miguel Ángel Mas',
    presupuesto: 50000,
    // Nota: la fuente original tiene typo en fecha fin ("2026-02-28" anterior a inicio
    // 2026-03-01). Se preserva tal cual y la regla `plazo_vencido` lo detectará.
    fechaInicio: '2026-03-01', fechaFin: '2026-02-28',
    empresaAdjudicataria: null, solucion: null,
    estadoGlobal: 'inicio',
    filePatterns: [/torres/i],
  },
  {
    id: 'ia-violencia-deporte', codigo: 16,
    nombre: 'IA y Violencia en el Deporte',
    area: 'GovTech',
    ownerMunicipal: 'Laura López',
    presupuesto: null,
    fechaInicio: '2026-04-01', fechaFin: null,
    empresaAdjudicataria: null, solucion: null,
    estadoGlobal: 'sin_iniciar',
    filePatterns: [/ia[-_ ]?(y[-_ ])?violencia|violencia[-_ ]?deporte/i],
  },
];

export function matchRetoByFilename(filename: string): RetoRegistry | null {
  for (const reto of RETOS_REGISTRY) {
    for (const pat of reto.filePatterns) {
      if (pat.test(filename)) return reto;
    }
  }
  return null;
}

export function getRetoById(id: string): RetoRegistry | null {
  return RETOS_REGISTRY.find(r => r.id === id) ?? null;
}
