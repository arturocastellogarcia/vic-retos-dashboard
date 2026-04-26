import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { SEVERIDAD_COLOR } from '@/lib/ui-helpers';

export const dynamic = 'force-dynamic';

const ACCION_POR_TIPO: Record<string, string> = {
  sin_ficha: 'Pídele al gestor que suba la ficha del mes a SharePoint.',
  sin_actualizacion: 'Recordatorio al gestor: el seguimiento del mes en curso está pendiente.',
  campos_vacios: 'Falta contenido en hitos/riesgos/issues/próximos. Pedir actualización al gestor.',
  plazo_vencido: 'El plazo del contrato ha vencido. Verificar si el reto debería estar en estado fin.',
  ficha_mal_formada: 'La ficha no respeta la estructura esperada. Revisar el .docx en SharePoint.',
};

const TITLES = { critical: 'Críticas', warn: 'Avisos', info: 'Informativas' } as const;

export default async function AlertasPage() {
  let alertas: schema.Alerta[] = [];
  let retos: schema.Reto[] = [];
  let dbError: string | null = null;

  try {
    alertas = await db.select().from(schema.alertas).where(eq(schema.alertas.activa, true));
    retos = await db.select().from(schema.retos);
  } catch (e) {
    dbError = (e as Error).message;
  }

  const retoById = new Map(retos.map((r) => [r.id, r]));
  const grupos: Record<'critical' | 'warn' | 'info', schema.Alerta[]> = { critical: [], warn: [], info: [] };
  for (const a of alertas) {
    const sev = a.severidad as 'critical' | 'warn' | 'info';
    if (grupos[sev]) grupos[sev].push(a);
  }

  return (
    <div className="max-w-5xl mx-auto px-6 sm:px-8 py-8 space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Alertas activas</h1>

      {dbError && (
        <div className="px-4 py-3 rounded-xl border border-rose-200 bg-rose-50 text-sm text-rose-900">
          Error: {dbError}
        </div>
      )}

      {(['critical', 'warn', 'info'] as const).map((sev) => {
        const items = grupos[sev];
        if (items.length === 0) return null;
        return (
          <section key={sev}>
            <h2 className="text-sm font-semibold text-slate-700 mb-3">
              {TITLES[sev]} <span className="text-slate-400 font-normal">({items.length})</span>
            </h2>
            <div className="space-y-3">
              {items.map((a) => {
                const reto = retoById.get(a.retoId);
                return (
                  <div key={a.id} className={`px-4 py-3 rounded-xl border ${SEVERIDAD_COLOR[sev]}`}>
                    <div className="flex items-baseline justify-between gap-3">
                      <Link href={`/retos/${a.retoId}`} className="font-semibold text-slate-900 hover:underline">
                        {reto?.nombre ?? a.retoId}
                      </Link>
                      <span className="text-xs text-slate-500 shrink-0">{a.tipo}</span>
                    </div>
                    <p className="mt-1 text-sm">{a.mensaje}</p>
                    {ACCION_POR_TIPO[a.tipo] && (
                      <p className="mt-2 text-xs text-slate-600">→ {ACCION_POR_TIPO[a.tipo]}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {alertas.length === 0 && !dbError && (
        <p className="text-slate-500 italic">No hay alertas activas. Todo en orden.</p>
      )}
    </div>
  );
}
