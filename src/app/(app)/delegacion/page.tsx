import { eq, asc } from 'drizzle-orm';
import { db, schema } from '@/db';
import PrintButton from '@/components/PrintButton';
import { formatEuros, currentYM, ymToLabel, relativeTime } from '@/lib/ui-helpers';

export const dynamic = 'force-dynamic';

const AREAS_ORDER = ['GovTech', 'UrbanTech', 'AgroTech', 'ESD', 'VR-Videojuegos'] as const;

export default async function DelegacionPage() {
  let retos: schema.Reto[] = [];
  let alertas: schema.Alerta[] = [];
  let dbError: string | null = null;

  try {
    retos = await db.select().from(schema.retos).orderBy(asc(schema.retos.codigo));
    alertas = await db.select().from(schema.alertas).where(eq(schema.alertas.activa, true));
  } catch (e) {
    dbError = (e as Error).message;
  }

  const enEjecucion = retos.filter((r) => r.estadoGlobal === 'ejecucion').length;
  const finalizados = retos.filter((r) => r.estadoGlobal === 'fin').length;
  const enInicio = retos.filter((r) => r.estadoGlobal === 'inicio').length;
  const eurosComprometidos = retos.reduce((s, r) => s + (r.presupuesto ?? 0), 0);
  const criticas = alertas.filter((a) => a.severidad === 'critical').length;

  const ahora = ymToLabel(currentYM());

  const porArea = new Map<string, schema.Reto[]>();
  for (const r of retos) {
    const area = r.area ?? 'Otros';
    const arr = porArea.get(area) ?? [];
    arr.push(r);
    porArea.set(area, arr);
  }

  return (
    <div className="max-w-5xl mx-auto px-6 sm:px-8 py-8 space-y-8 print:py-4 print:max-w-none">
      <div className="flex items-center justify-between flex-wrap gap-4 print:block">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Vista delegación</h1>
          <p className="text-sm text-slate-600">Programa GovTech · València Innovation Capital · {ahora}</p>
        </div>
        <PrintButton />
      </div>

      {dbError && (
        <div className="px-4 py-3 rounded-xl border border-rose-200 bg-rose-50 text-sm text-rose-900 print:hidden">
          Error: {dbError}
        </div>
      )}

      <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 print:grid-cols-6">
        <Stat label="Total" value={retos.length} />
        <Stat label="En ejecución" value={enEjecucion} />
        <Stat label="Finalizados" value={finalizados} />
        <Stat label="En inicio" value={enInicio} />
        <Stat label="€ comprometido" value={formatEuros(eurosComprometidos)} />
        <Stat label="Alertas críticas" value={criticas} />
      </section>

      {AREAS_ORDER.map((area) => {
        const retosArea = porArea.get(area) ?? [];
        if (retosArea.length === 0) return null;
        return (
          <section key={area} className="break-inside-avoid">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">{area}</h2>
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {retosArea.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-2 font-medium text-slate-900">{r.nombre}</td>
                      <td className="px-4 py-2 text-slate-600">{r.empresaAdjudicataria ?? '—'}</td>
                      <td className="px-4 py-2 text-slate-600 capitalize">{r.estadoGlobal}</td>
                      <td className="px-4 py-2 text-slate-600 text-right">{relativeTime(r.ultimaActualizacion)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="text-xs text-slate-500 uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}
