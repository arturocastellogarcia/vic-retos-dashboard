// Siembra de Supabase a partir de los .txt en .seed-data/ que se obtuvieron
// vía las MCP tools de SharePoint (read_resource). Este flujo bypasses la
// auth Microsoft device code flow (bloqueada por consent admin del tenant).
//
// Uso: npx tsx scripts/seed-from-mcp.ts
//
// Equivalente funcional a syncSharepoint() pero leyendo de disco en lugar
// de descargar de SharePoint. Sigue calculando alertas y actualizando el
// resumen de retos.

import { config } from 'dotenv';
config({ path: '.env.local' });
config();

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { FichaMensualInsert } from '../src/db/schema';

// Imports dinámicos: necesitamos que dotenv haya configurado DATABASE_URL
// ANTES de que src/db/index.ts evalúe `postgres(...)` a nivel de módulo.
// Los `import type` son erasable en runtime, no disparan el bug.

interface ManifestEntry {
  idx: number;
  retoId: string | null;
  mes: string;
  name: string;
  webUrl: string;
  modifiedAt: string;
  uri: string;
  folder: string;
}

async function main() {
  const { db, schema } = await import('../src/db');
  const { RETOS_REGISTRY } = await import('../src/lib/retos-registry');
  const { parseFichaText } = await import('../src/lib/parser');
  const { recomputeAlerts } = await import('../src/lib/alerts');
  const { eq, and, desc } = await import('drizzle-orm');

  const trigger = 'manual' as const;

  const [syncRun] = await db.insert(schema.syncRuns)
    .values({ status: 'running', trigger })
    .returning();
  console.log(`▶ Sync run #${syncRun.id} iniciado`);

  // 1) Upsert los 16 retos del registry
  console.log('▶ Upsert de retos del registry...');
  for (const r of RETOS_REGISTRY) {
    const baseSet = {
      codigo: r.codigo, nombre: r.nombre, area: r.area,
      ownerMunicipal: r.ownerMunicipal, presupuesto: r.presupuesto,
      fechaInicio: r.fechaInicio, fechaFin: r.fechaFin,
      empresaAdjudicataria: r.empresaAdjudicataria, solucion: r.solucion,
      estadoGlobal: r.estadoGlobal,
    };
    await db.insert(schema.retos)
      .values({ id: r.id, ...baseSet })
      .onConflictDoUpdate({
        target: schema.retos.id,
        set: { ...baseSet, updatedAt: new Date() },
      });
  }
  console.log(`  ${RETOS_REGISTRY.length} retos upserteados`);

  // 2) Leer manifest
  const manifest: ManifestEntry[] = JSON.parse(
    await readFile(join('.seed-data', 'manifest.json'), 'utf8'),
  );
  console.log(`▶ Procesando ${manifest.length} fichas...`);

  let nuevas = 0;
  let actualizadas = 0;
  const errores: Array<{ ficha: string; error: string }> = [];

  for (const entry of manifest) {
    if (!entry.retoId) continue;
    try {
      const rawText = await readFile(join('.seed-data', `${entry.idx}.txt`), 'utf8');
      const parsed = parseFichaText(rawText);

      const existing = await db.select()
        .from(schema.fichasMensuales)
        .where(and(
          eq(schema.fichasMensuales.retoId, entry.retoId),
          eq(schema.fichasMensuales.mes, entry.mes),
        ))
        .limit(1);

      const values: FichaMensualInsert = {
        retoId: entry.retoId,
        mes: entry.mes,
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
        sharepointPath: `${entry.folder}/${entry.name}`,
        sharepointWebUrl: entry.webUrl,
        sharepointDriveItemId: null,
        sharepointModifiedAt: new Date(entry.modifiedAt),
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

      if (existing[0]) actualizadas++; else nuevas++;
      const symbol = parsed.parserStatus === 'ok' ? '✓' : parsed.parserStatus === 'partial' ? '◐' : '✗';
      console.log(`  ${symbol} [${String(entry.idx).padStart(2)}] ${entry.retoId}/${entry.mes}  ${parsed.parserStatus} (${parsed.parserWarnings.length} avisos)`);
    } catch (e) {
      errores.push({ ficha: `${entry.retoId}/${entry.mes}`, error: (e as Error).message });
      console.error(`  ✗ [${entry.idx}] FALLO: ${(e as Error).message}`);
    }
  }

  // 3) Actualizar resumen de retos
  console.log('▶ Actualizando resumen de retos...');
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

  // 4) Recalcular alertas
  console.log('▶ Recalculando alertas...');
  const { activeCount } = await recomputeAlerts();

  // 5) Cerrar sync_run
  await db.update(schema.syncRuns)
    .set({
      finishedAt: new Date(),
      status: 'success',
      fichasProcesadas: nuevas + actualizadas,
      fichasNuevas: nuevas,
      fichasActualizadas: actualizadas,
      errores: errores.length > 0 ? errores : null,
    })
    .where(eq(schema.syncRuns.id, syncRun.id));

  console.log('\n────────────────────────────');
  console.log(`Procesadas: ${nuevas + actualizadas} (${nuevas} nuevas, ${actualizadas} actualizadas)`);
  console.log(`Alertas activas: ${activeCount}`);
  console.log(`Errores: ${errores.length}`);

  process.exit(errores.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Error fatal:', err);
  process.exit(1);
});
