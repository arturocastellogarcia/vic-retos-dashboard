import Link from 'next/link';
import { eq, desc, asc } from 'drizzle-orm';
import { db, schema } from '@/db';
import {
  calcSemaforo, currentYM, formatEuros, relativeTime, severityRank, SEVERIDAD_COLOR,
} from '@/lib/ui-helpers';
import Semaforo from '@/components/Semaforo';
import MetricCard from '@/components/MetricCard';
import SyncButton from '@/components/SyncButton';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let retos: schema.Reto[] = [];
  let alertas: schema.Alerta[] = [];
  let lastSync: schema.SyncRun | null = null;
  let dbError: string | null = null;

  try {
    retos = await db.select().from(schema.retos).orderBy(asc(schema.retos.codigo));
    alertas = await db.select().from(schema.alertas).where(eq(schema.alertas.activa, true));
    const syncs = await db.select().from(schema.syncRuns).orderBy(desc(schema.syncRuns.startedAt)).limit(1);
    lastSync = syncs[0] ?? null;
  } catch (e) {
    dbError = (e as Error).message;
  }

  const todayYM = currentYM();

  // Agrupar alertas activas por reto
  const alertasByReto = new Map<string, schema.Alerta[]>();
  for (const a of alertas) {
    const arr = alertasByReto.get(a.retoId) ?? [];
    arr.push(a);
    alertasByReto.set(a.retoId, arr);
  }

  const enEjecucion = retos.filter((r) => r.estadoGlobal === 'ejecucion').length;
  const finalizados = retos.filter((r) => r.estadoGlobal === 'fin').length;
  const eurosComprometidos = retos.reduce((s, r) => s + (r.presupuesto ?? 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-6 sm:px-8 py-8 space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Cuadro de programa</h1>
        <SyncButton />
      </div>

      {lastSync ? (
        <div className="text-xs text-slate-500">
          Última sync: {relativeTime(lastSync.startedAt)} · status <span className="font-medium">{lastSync.status}</span> · {lastSync.fichasProcesadas} procesadas, {lastSync.fichasNuevas} nuevas
        </div>
      ) : (
        <div className="text-xs text-slate-500 italic">
          Sin sincronizaciones todavía.
        </div>
      )}

      {dbError && (
        <div className="px-4 py-3 rounded-xl border border-rose-200 bg-rose-50 text-sm text-rose-900">
          Error de base de datos: {dbError}
        </div>
      )}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="En ejecución" value={enEjecucion} hint={retos.length ? `de ${retos.length} retos` : undefined} />
        <MetricCard label="Finalizados" value={finalizados} />
        <MetricCard label="€ comprometido" value={formatEuros(eurosComprometidos)} />
        <MetricCard label="Alertas activas" value={alertas.length} />
      </section>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead className="bg-slate-50 text-slate-600">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium w-10">#</th>
                <th className="px-4 py-3 font-medium">Reto</th>
                <th className="px-4 py-3 font-medium">Área</th>
                <th className="px-4 py-3 font-medium">Owner</th>
                <th className="px-4 py-3 font-medium text-right">Presupuesto</th>
                <th className="px-4 py-3 font-medium text-center">Sem.</th>
                <th className="px-4 py-3 font-medium">Última act.</th>
                <th className="px-4 py-3 font-medium">Alerta principal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {retos.map((reto) => {
                const retoAlertas = alertasByReto.get(reto.id) ?? [];
                const semaforo = calcSemaforo(reto, retoAlertas, todayYM);
                const principal = [...retoAlertas].sort((a, b) => severityRank(b.severidad) - severityRank(a.severidad))[0];
                return (
                  <tr key={reto.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-400">{reto.codigo}</td>
                    <td className="px-4 py-3">
                      <Link href={`/retos/${reto.id}`} className="font-medium text-slate-900 hover:text-slate-600">
                        {reto.nombre}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{reto.area ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{reto.ownerMunicipal ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-slate-600 tabular-nums">{formatEuros(reto.presupuesto)}</td>
                    <td className="px-4 py-3 text-center"><Semaforo color={semaforo} /></td>
                    <td className="px-4 py-3 text-slate-600">{relativeTime(reto.ultimaActualizacion)}</td>
                    <td className="px-4 py-3">
                      {principal ? (
                        <span className={`inline-block text-xs px-2 py-0.5 rounded border ${SEVERIDAD_COLOR[principal.severidad] ?? ''}`}>
                          {principal.tipo}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {retos.length === 0 && !dbError && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400 italic">
                    Sin retos sincronizados todavía. Pulsa &quot;Sincronizar ahora&quot; o ejecuta <code>npm run sync</code> localmente.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
