// Motor de sincronización SharePoint → Postgres.
// Flujo: upsert registry → listar SharePoint → identificar reto → descargar →
// parsear → upsert ficha → actualizar resumen del reto → recalcular alertas →
// log en sync_runs.

import mammoth from 'mammoth';
import { eq, and, desc } from 'drizzle-orm';
import { db, schema } from '../db';
import { RETOS_REGISTRY, matchRetoByFilename } from './retos-registry';
import { listFichas, downloadFicha, type FichaInfo } from './sharepoint';
import { parseFichaText } from './parser';
import { recomputeAlerts } from './alerts';

export interface SyncResult {
  syncRunId: number;
  status: 'success' | 'error';
  fichasProcesadas: number;
  fichasNuevas: number;
  fichasActualizadas: number;
  errores: Array<{ ficha: string; error: string }>;
  huerfanas: string[];
  alertasActivas: number;
}

export async function syncSharepoint(trigger: 'cron' | 'manual' = 'manual'): Promise<SyncResult> {
  const [syncRun] = await db.insert(schema.syncRuns)
    .values({ status: 'running', trigger })
    .returning();

  const errores: Array<{ ficha: string; error: string }> = [];
  const huerfanas: string[] = [];
  let fichasProcesadas = 0;
  let fichasNuevas = 0;
  let fichasActualizadas = 0;
  let alertasActivas = 0;

  try {
    await upsertRetosFromRegistry();

    const fichas = await listFichas();

    for (const ficha of fichas) {
      try {
        const result = await processFicha(ficha);
        if (result === 'orphan') {
          huerfanas.push(ficha.filename);
        } else if (result === 'skipped') {
          fichasProcesadas++;
        } else if (result === 'new') {
          fichasProcesadas++;
          fichasNuevas++;
        } else if (result === 'updated') {
          fichasProcesadas++;
          fichasActualizadas++;
        }
      } catch (e) {
        // Un fallo por ficha NO aborta el resto del sync.
        errores.push({ ficha: ficha.filename, error: (e as Error).message });
      }
    }

    await refreshRetosResumen();

    const { activeCount } = await recomputeAlerts();
    alertasActivas = activeCount;

    await db.update(schema.syncRuns)
      .set({
        finishedAt: new Date(),
        status: 'success',
        fichasProcesadas,
        fichasNuevas,
        fichasActualizadas,
        errores: errores.length > 0 ? errores : null,
      })
      .where(eq(schema.syncRuns.id, syncRun.id));

    return {
      syncRunId: syncRun.id,
      status: 'success',
      fichasProcesadas,
      fichasNuevas,
      fichasActualizadas,
      errores,
      huerfanas,
      alertasActivas,
    };
  } catch (e) {
    const finalErrors = [...errores, { ficha: '_global', error: (e as Error).message }];
    await db.update(schema.syncRuns)
      .set({
        finishedAt: new Date(),
        status: 'error',
        fichasProcesadas,
        fichasNuevas,
        fichasActualizadas,
        errores: finalErrors,
      })
      .where(eq(schema.syncRuns.id, syncRun.id));

    return {
      syncRunId: syncRun.id,
      status: 'error',
      fichasProcesadas,
      fichasNuevas,
      fichasActualizadas,
      errores: finalErrors,
      huerfanas,
      alertasActivas,
    };
  }
}

// --- Subrutinas ---

async function upsertRetosFromRegistry(): Promise<void> {
  for (const r of RETOS_REGISTRY) {
    const baseSet = {
      codigo: r.codigo,
      nombre: r.nombre,
      area: r.area,
      ownerMunicipal: r.ownerMunicipal,
      presupuesto: r.presupuesto,
      fechaInicio: r.fechaInicio,
      fechaFin: r.fechaFin,
      empresaAdjudicataria: r.empresaAdjudicataria,
      solucion: r.solucion,
      estadoGlobal: r.estadoGlobal,
    };
    await db.insert(schema.retos)
      .values({ id: r.id, ...baseSet })
      .onConflictDoUpdate({
        target: schema.retos.id,
        set: { ...baseSet, updatedAt: new Date() },
      });
  }
}

type ProcessResult = 'orphan' | 'skipped' | 'new' | 'updated';

async function processFicha(ficha: FichaInfo): Promise<ProcessResult> {
  const reto = matchRetoByFilename(ficha.filename);
  if (!reto) return 'orphan';

  const existing = await db.select()
    .from(schema.fichasMensuales)
    .where(and(
      eq(schema.fichasMensuales.retoId, reto.id),
      eq(schema.fichasMensuales.mes, ficha.mes),
    ))
    .limit(1);

  // Skip si timestamp no ha cambiado
  if (existing[0]?.sharepointModifiedAt) {
    const existingMs = existing[0].sharepointModifiedAt.getTime();
    if (existingMs >= ficha.modifiedAt.getTime()) {
      return 'skipped';
    }
  }

  // Descargar y parsear
  const buffer = await downloadFicha(ficha.driveItemId);
  const result = await mammoth.extractRawText({ buffer });
  const rawText = result.value;
  const parsed = parseFichaText(rawText);

  const values: schema.FichaMensualInsert = {
    retoId: reto.id,
    mes: ficha.mes,
    nombre: parsed.nombre,
    objetivo: parsed.objetivo,
    fechaLanzamiento: parsed.fechaLanzamiento,
    areaTematica: parsed.areaTematica,
    tipoReto: parsed.tipoReto,
    entidadesImpulsoras: parsed.entidadesImpulsoras,
    entidadesParticipantes: parsed.entidadesParticipantes,
    contextoUrbano: parsed.contextoUrbano,
    kpis: parsed.kpis,
    documentacionAsociada: parsed.documentacionAsociada,
    estadoActual: parsed.estadoActual,
    observaciones: parsed.observaciones,
    fechaSeguimiento: parsed.fechaSeguimiento,
    fechaSeguimientoRaw: parsed.fechaSeguimientoRaw,
    hitosAlcanzados: parsed.hitosAlcanzados,
    riesgosPrincipales: parsed.riesgosPrincipales,
    issuesAbiertos: parsed.issuesAbiertos,
    proximosPasos: parsed.proximosPasos,
    metaPrograma: parsed.metaPrograma,
    metaOwnerTecnicoVic: parsed.metaOwnerTecnicoVic,
    metaSeguimientoTecnicoVic: parsed.metaSeguimientoTecnicoVic,
    metaServiciosMunicipales: parsed.metaServiciosMunicipales,
    metaCuentaAnalitica: parsed.metaCuentaAnalitica,
    metaPresupuesto: parsed.metaPresupuesto,
    metaPresupuestoRaw: parsed.metaPresupuestoRaw,
    metaPlazo: parsed.metaPlazo,
    sharepointPath: `${ficha.carpetaMes}/${ficha.filename}`,
    sharepointWebUrl: ficha.webUrl,
    sharepointDriveItemId: ficha.driveItemId,
    sharepointModifiedAt: ficha.modifiedAt,
    parserStatus: parsed.parserStatus,
    parserWarnings: parsed.parserWarnings,
    rawText,
    syncedAt: new Date(),
  };

  await db.insert(schema.fichasMensuales)
    .values(values)
    .onConflictDoUpdate({
      target: [schema.fichasMensuales.retoId, schema.fichasMensuales.mes],
      set: { ...values, syncedAt: new Date() },
    });

  return existing[0] ? 'updated' : 'new';
}

// Tras procesar todas las fichas, actualizamos en la tabla `retos` los campos
// derivados de la ficha más reciente (owner, fecha de actualización, etc.).
async function refreshRetosResumen(): Promise<void> {
  for (const r of RETOS_REGISTRY) {
    const last = await db.select()
      .from(schema.fichasMensuales)
      .where(eq(schema.fichasMensuales.retoId, r.id))
      .orderBy(desc(schema.fichasMensuales.mes))
      .limit(1);

    if (last[0]) {
      await db.update(schema.retos)
        .set({
          ownerTecnicoVic: last[0].metaOwnerTecnicoVic,
          seguimientoTecnicoVic: last[0].metaSeguimientoTecnicoVic,
          fichaMasReciente: last[0].mes,
          ultimaActualizacion: last[0].syncedAt,
          updatedAt: new Date(),
        })
        .where(eq(schema.retos.id, r.id));
    }
  }
}
