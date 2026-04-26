// Motor de alertas. 5 reglas definidas en docs/CONTEXTO.md §6.
// Se recalcula al final de cada sync: marca todas las alertas activas como
// resueltas y reinserta las que sigan aplicando.

import { eq, desc } from 'drizzle-orm';
import { db, schema } from '../db';

export type TipoAlerta =
  | 'sin_actualizacion'
  | 'campos_vacios'
  | 'plazo_vencido'
  | 'ficha_mal_formada'
  | 'sin_ficha';
export type Severidad = 'info' | 'warn' | 'critical';

interface AlertaCandidata {
  retoId: string;
  tipo: TipoAlerta;
  severidad: Severidad;
  mensaje: string;
  contexto?: Record<string, unknown> | null;
}

function currentYM(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export async function recomputeAlerts(): Promise<{ activeCount: number }> {
  // 1) Marcar todas las activas como resueltas (no se borran, queda historial)
  const now = new Date();
  await db.update(schema.alertas)
    .set({ activa: false, resueltaAt: now })
    .where(eq(schema.alertas.activa, true));

  // 2) Calcular candidatos
  const candidates = await computeAlertCandidates();

  // 3) Insertar nuevas alertas activas
  for (const c of candidates) {
    await db.insert(schema.alertas).values({
      retoId: c.retoId,
      tipo: c.tipo,
      severidad: c.severidad,
      mensaje: c.mensaje,
      contexto: c.contexto ?? null,
      activa: true,
    });
  }

  return { activeCount: candidates.length };
}

async function computeAlertCandidates(): Promise<AlertaCandidata[]> {
  const candidates: AlertaCandidata[] = [];
  const today = new Date();
  const todayYM = currentYM(today);
  const todayDay = today.getDate();
  const todayISO = today.toISOString().slice(0, 10);

  const retos = await db.select().from(schema.retos);

  for (const reto of retos) {
    // Obtener todas las fichas del reto, más recientes primero
    const fichas = await db.select()
      .from(schema.fichasMensuales)
      .where(eq(schema.fichasMensuales.retoId, reto.id))
      .orderBy(desc(schema.fichasMensuales.mes));

    const latest = fichas[0];

    // Regla: sin_ficha
    // (sin ninguna ficha y el reto no está en sin_iniciar / fin)
    if (!latest && reto.estadoGlobal !== 'sin_iniciar' && reto.estadoGlobal !== 'fin') {
      candidates.push({
        retoId: reto.id,
        tipo: 'sin_ficha',
        severidad: 'warn',
        mensaje: 'No hay ficha mensual en SharePoint para este reto',
      });
    }

    if (latest && reto.estadoGlobal !== 'fin') {
      // Regla: sin_actualizacion
      // (la última ficha es de un mes anterior al actual, y estamos pasados del día 20)
      if (latest.mes < todayYM && todayDay >= 20) {
        candidates.push({
          retoId: reto.id,
          tipo: 'sin_actualizacion',
          severidad: 'critical',
          mensaje: `Última ficha es de ${latest.mes}, pendiente actualización de ${todayYM}`,
          contexto: { ultimaFichaMes: latest.mes, mesEsperado: todayYM, hoy: todayISO },
        });
      }

      // Regla: campos_vacios
      // (ficha del mes actual con 2+ campos vacíos entre {Hitos, Riesgos, Issues, Próximos})
      if (latest.mes === todayYM) {
        const camposClaves = ['hitosAlcanzados', 'riesgosPrincipales', 'issuesAbiertos', 'proximosPasos'] as const;
        const vacios: string[] = [];
        for (const k of camposClaves) {
          const v = latest[k];
          if (v == null || v.trim() === '') vacios.push(k);
        }
        if (vacios.length >= 2) {
          candidates.push({
            retoId: reto.id,
            tipo: 'campos_vacios',
            severidad: 'warn',
            mensaje: `Campos vacíos en ficha de ${latest.mes}: ${vacios.join(', ')}`,
            contexto: { mes: latest.mes, camposVacios: vacios },
          });
        }
      }

      // Regla: ficha_mal_formada
      if (latest.parserStatus === 'error') {
        candidates.push({
          retoId: reto.id,
          tipo: 'ficha_mal_formada',
          severidad: 'warn',
          mensaje: `Parser no pudo extraer estructura de la ficha de ${latest.mes}`,
          contexto: { mes: latest.mes, warnings: latest.parserWarnings },
        });
      }
    }

    // Regla: plazo_vencido (independiente de ficha)
    if (reto.fechaFin && reto.estadoGlobal !== 'fin') {
      // Drizzle date() devuelve string ISO 'YYYY-MM-DD'; comparación lexicográfica == cronológica.
      const fechaFinISO = String(reto.fechaFin);
      if (fechaFinISO < todayISO) {
        candidates.push({
          retoId: reto.id,
          tipo: 'plazo_vencido',
          severidad: 'warn',
          mensaje: `Fecha fin (${fechaFinISO}) ya pasada y estado del reto no es 'fin'`,
          contexto: { fechaFin: fechaFinISO, estadoGlobal: reto.estadoGlobal },
        });
      }
    }
  }

  return candidates;
}
