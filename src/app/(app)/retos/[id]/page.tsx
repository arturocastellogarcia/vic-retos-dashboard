import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq, desc } from 'drizzle-orm';
import { db, schema } from '@/db';
import { formatEuros, ymToLabel, SEVERIDAD_COLOR } from '@/lib/ui-helpers';

export const dynamic = 'force-dynamic';

export default async function RetoDetailPage({ params }: { params: { id: string } }) {
  const retoArr = await db.select().from(schema.retos).where(eq(schema.retos.id, params.id)).limit(1);
  if (!retoArr[0]) notFound();
  const reto = retoArr[0];

  const fichas = await db.select()
    .from(schema.fichasMensuales)
    .where(eq(schema.fichasMensuales.retoId, reto.id))
    .orderBy(desc(schema.fichasMensuales.mes));

  const alertasReto = await db.select()
    .from(schema.alertas)
    .where(eq(schema.alertas.retoId, reto.id));
  const alertasActivas = alertasReto.filter((a) => a.activa);

  const latest = fichas[0];

  return (
    <div className="max-w-5xl mx-auto px-6 sm:px-8 py-8 space-y-8">
      <div>
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">← Cuadro de programa</Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          <span className="text-slate-400 mr-2">#{reto.codigo}</span>{reto.nombre}
        </h1>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
          <span>Área: <span className="font-medium text-slate-900">{reto.area ?? '—'}</span></span>
          <span>Owner municipal: <span className="font-medium text-slate-900">{reto.ownerMunicipal ?? '—'}</span></span>
          <span>Owner técnico VIC: <span className="font-medium text-slate-900">{reto.ownerTecnicoVic ?? '—'}</span></span>
          <span>Presupuesto: <span className="font-medium text-slate-900">{formatEuros(reto.presupuesto)}</span></span>
          <span>Estado: <span className="font-medium text-slate-900">{reto.estadoGlobal}</span></span>
          {reto.empresaAdjudicataria && <span>Empresa: <span className="font-medium text-slate-900">{reto.empresaAdjudicataria}</span></span>}
        </div>
      </div>

      {alertasActivas.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Alertas activas ({alertasActivas.length})</h2>
          <div className="space-y-2">
            {alertasActivas.map((a) => (
              <div key={a.id} className={`px-3 py-2 rounded-md border text-sm ${SEVERIDAD_COLOR[a.severidad] ?? ''}`}>
                <span className="font-medium">{a.tipo}</span> · {a.mensaje}
              </div>
            ))}
          </div>
        </section>
      )}

      {latest && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-700">Identidad (ficha más reciente: {ymToLabel(latest.mes)})</h2>
          {latest.objetivo && (
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wide">Objetivo</div>
              <p className="mt-1 text-slate-700 whitespace-pre-wrap">{latest.objetivo}</p>
            </div>
          )}
          {latest.kpis && latest.kpis.length > 0 && (
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wide">KPIs</div>
              <ul className="mt-1 list-disc pl-5 text-slate-700 space-y-1">
                {latest.kpis.map((k, i) => <li key={i}>{k}</li>)}
              </ul>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wide">Entidades impulsoras</div>
              <p className="mt-1 text-slate-700">{latest.entidadesImpulsoras ?? '—'}</p>
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wide">Entidades participantes</div>
              <p className="mt-1 text-slate-700">{latest.entidadesParticipantes ?? '—'}</p>
            </div>
          </div>
          {latest.documentacionAsociada && (
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wide">Documentación</div>
              <p className="mt-1 text-slate-700">{latest.documentacionAsociada}</p>
            </div>
          )}
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Timeline mensual</h2>
        <div className="space-y-4">
          {fichas.map((f) => (
            <article key={f.id} className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-900">{ymToLabel(f.mes)}</div>
                  {f.fechaSeguimientoRaw && (
                    <div className="text-xs text-slate-500">Seguimiento: {f.fechaSeguimientoRaw}</div>
                  )}
                </div>
                {f.sharepointWebUrl && (
                  <a
                    href={f.sharepointWebUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-slate-500 hover:text-slate-800 underline"
                  >
                    Abrir .docx
                  </a>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <Block label="Hitos alcanzados" content={f.hitosAlcanzados} />
                <Block label="Riesgos principales" content={f.riesgosPrincipales} />
                <Block label="Issues abiertos" content={f.issuesAbiertos} />
                <Block label="Próximos pasos (30 días)" content={f.proximosPasos} />
              </div>
              {f.parserStatus && f.parserStatus !== 'ok' && (
                <div className="text-xs text-amber-700">
                  parser: {f.parserStatus} ({(f.parserWarnings ?? []).length} avisos)
                </div>
              )}
            </article>
          ))}
          {fichas.length === 0 && (
            <p className="text-slate-400 italic">Sin fichas mensuales sincronizadas para este reto.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function Block({ label, content }: { label: string; content: string | null }) {
  return (
    <div className="bg-slate-50 rounded-md p-3">
      <div className="text-xs text-slate-500 uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-slate-700 whitespace-pre-wrap text-sm">
        {content ?? <span className="italic text-slate-400">vacío</span>}
      </div>
    </div>
  );
}
