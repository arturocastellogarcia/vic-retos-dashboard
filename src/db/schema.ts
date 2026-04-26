// Esquema Drizzle de las 4 tablas del dashboard.
// Diseño: docs/CONTEXTO.md §5.

import { sql } from 'drizzle-orm';
import {
  pgTable, text, integer, serial, timestamp, jsonb, boolean, date,
  uniqueIndex, index,
} from 'drizzle-orm/pg-core';

// --------------------------------------------------
// retos: identidad estable de cada reto (16 filas).
// Se sincroniza desde retos-registry.ts en cada sync (upsert por id).
// --------------------------------------------------
export const retos = pgTable('retos', {
  id: text('id').primaryKey(),                                  // slug 'sirval', 'sigma-it'...
  codigo: integer('codigo').notNull(),                          // 1..16
  nombre: text('nombre').notNull(),
  area: text('area'),                                           // GovTech | UrbanTech | AgroTech | ESD | VR-Videojuegos
  ownerMunicipal: text('owner_municipal'),
  ownerTecnicoVic: text('owner_tecnico_vic'),                   // último valor extraído de la ficha
  seguimientoTecnicoVic: text('seguimiento_tecnico_vic'),
  presupuesto: integer('presupuesto'),                          // €
  fechaInicio: date('fecha_inicio'),
  fechaFin: date('fecha_fin'),
  empresaAdjudicataria: text('empresa_adjudicataria'),
  solucion: text('solucion'),
  estadoGlobal: text('estado_global'),                          // inicio|ejecucion|evaluacion|fin|sin_iniciar
  fichaMasReciente: text('ficha_mas_reciente'),                 // YYYY-MM
  ultimaActualizacion: timestamp('ultima_actualizacion'),
  createdAt: timestamp('created_at').default(sql`now()`).notNull(),
  updatedAt: timestamp('updated_at').default(sql`now()`).notNull(),
});

// --------------------------------------------------
// fichas_mensuales: snapshot mensual de un reto.
// UNIQUE(reto_id, mes) garantiza una ficha por (reto, mes).
// --------------------------------------------------
export const fichasMensuales = pgTable('fichas_mensuales', {
  id: serial('id').primaryKey(),
  retoId: text('reto_id').notNull().references(() => retos.id, { onDelete: 'cascade' }),
  mes: text('mes').notNull(),                                   // YYYY-MM

  // Identidad capturada en este snapshot
  nombre: text('nombre'),
  objetivo: text('objetivo'),
  fechaLanzamiento: text('fecha_lanzamiento'),
  areaTematica: text('area_tematica'),
  tipoReto: text('tipo_reto'),
  entidadesImpulsoras: text('entidades_impulsoras'),
  entidadesParticipantes: text('entidades_participantes'),
  contextoUrbano: text('contexto_urbano'),
  kpis: jsonb('kpis').$type<string[]>(),
  documentacionAsociada: text('documentacion_asociada'),
  estadoActual: text('estado_actual'),
  observaciones: text('observaciones'),

  // Bloque de seguimiento mensual
  fechaSeguimiento: date('fecha_seguimiento'),
  fechaSeguimientoRaw: text('fecha_seguimiento_raw'),
  hitosAlcanzados: text('hitos_alcanzados'),
  riesgosPrincipales: text('riesgos_principales'),
  issuesAbiertos: text('issues_abiertos'),
  proximosPasos: text('proximos_pasos'),

  // Metadatos del .docx
  metaPrograma: text('meta_programa'),
  metaOwnerTecnicoVic: text('meta_owner_tecnico_vic'),
  metaSeguimientoTecnicoVic: text('meta_seguimiento_tecnico_vic'),
  metaServiciosMunicipales: text('meta_servicios_municipales'),
  metaCuentaAnalitica: text('meta_cuenta_analitica'),
  metaPresupuesto: integer('meta_presupuesto'),
  metaPresupuestoRaw: text('meta_presupuesto_raw'),
  metaPlazo: text('meta_plazo'),

  // Sincronización SharePoint
  sharepointPath: text('sharepoint_path'),
  sharepointWebUrl: text('sharepoint_web_url'),
  sharepointDriveItemId: text('sharepoint_drive_item_id'),
  sharepointModifiedAt: timestamp('sharepoint_modified_at'),

  // Diagnóstico parser
  parserStatus: text('parser_status'),                          // ok|partial|error
  parserWarnings: jsonb('parser_warnings').$type<string[]>(),
  rawText: text('raw_text'),                                    // texto crudo, para reparseo offline

  syncedAt: timestamp('synced_at').default(sql`now()`).notNull(),
}, (t) => ({
  uniqRetoMes: uniqueIndex('fichas_mensuales_reto_mes_uniq').on(t.retoId, t.mes),
  idxRetoMes: index('fichas_mensuales_reto_mes_idx').on(t.retoId, t.mes),
}));

// --------------------------------------------------
// alertas: se recalculan al final de cada sync.
// activa=false marca la alerta como "ya no aplica" (sin borrarla, queda historial).
// --------------------------------------------------
export const alertas = pgTable('alertas', {
  id: serial('id').primaryKey(),
  retoId: text('reto_id').notNull().references(() => retos.id, { onDelete: 'cascade' }),
  tipo: text('tipo').notNull(),                                 // sin_actualizacion|campos_vacios|plazo_vencido|ficha_mal_formada|sin_ficha
  severidad: text('severidad').notNull(),                       // info|warn|critical
  mensaje: text('mensaje').notNull(),
  contexto: jsonb('contexto'),
  generadaAt: timestamp('generada_at').default(sql`now()`).notNull(),
  resueltaAt: timestamp('resuelta_at'),
  activa: boolean('activa').default(true).notNull(),
}, (t) => ({
  idxRetoActiva: index('alertas_reto_activa_idx').on(t.retoId, t.activa),
}));

// --------------------------------------------------
// sync_runs: log de cada ejecución de sincronización.
// --------------------------------------------------
export const syncRuns = pgTable('sync_runs', {
  id: serial('id').primaryKey(),
  startedAt: timestamp('started_at').default(sql`now()`).notNull(),
  finishedAt: timestamp('finished_at'),
  status: text('status').notNull(),                             // running|success|error
  fichasProcesadas: integer('fichas_procesadas').default(0).notNull(),
  fichasNuevas: integer('fichas_nuevas').default(0).notNull(),
  fichasActualizadas: integer('fichas_actualizadas').default(0).notNull(),
  errores: jsonb('errores').$type<Array<{ ficha: string; error: string }>>(),
  trigger: text('trigger').notNull(),                           // cron|manual
});

// Tipos inferidos para uso en el resto del código
export type Reto = typeof retos.$inferSelect;
export type RetoInsert = typeof retos.$inferInsert;
export type FichaMensual = typeof fichasMensuales.$inferSelect;
export type FichaMensualInsert = typeof fichasMensuales.$inferInsert;
export type Alerta = typeof alertas.$inferSelect;
export type AlertaInsert = typeof alertas.$inferInsert;
export type SyncRun = typeof syncRuns.$inferSelect;
export type SyncRunInsert = typeof syncRuns.$inferInsert;
