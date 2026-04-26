// Endpoint de sincronización SharePoint.
// Acepta GET (cron Vercel) y POST (botón manual desde la UI).
// Auth dual:
//   - Cron:   Authorization: Bearer ${CRON_SECRET}
//   - Manual: sesión Supabase válida + email en allowlist
// Ambos terminan llamando a syncSharepoint().

import { NextResponse } from 'next/server';
import { syncSharepoint } from '@/lib/sync';
import { createClient } from '@/lib/supabase/server';
import { isEmailAllowed } from '@/lib/auth-allowlist';

// Permite hasta 5 minutos de ejecución (Vercel Pro). En Hobby, ajustar a 60.
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

type AuthResult =
  | { ok: true; trigger: 'cron' | 'manual' }
  | { ok: false; reason: string; status: number };

async function authorize(request: Request): Promise<AuthResult> {
  // 1) Trigger cron: Bearer CRON_SECRET (Vercel inyecta el header automáticamente)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return { ok: true, trigger: 'cron' };
  }

  // 2) Trigger manual: usuario autenticado en allowlist
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user && isEmailAllowed(user.email)) {
      return { ok: true, trigger: 'manual' };
    }
  } catch {
    // Si el cliente Supabase falla por env vars ausentes, caemos a 401.
  }

  return { ok: false, reason: 'unauthorized', status: 401 };
}

async function handle(request: Request) {
  const auth = await authorize(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  // Si no hay refresh token de SharePoint, devuelve 200 con un mensaje claro
  // (el cron es no-op hasta que se configure el token vía `npm run sync` local).
  if (!process.env.SHAREPOINT_REFRESH_TOKEN && !process.env.SHAREPOINT_ACCESS_TOKEN) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'SHAREPOINT_REFRESH_TOKEN no configurado. Ejecuta `npm run sync` localmente para obtenerlo.',
      trigger: auth.trigger,
    }, { status: 200 });
  }

  try {
    const result = await syncSharepoint(auth.trigger);
    const httpStatus = result.status === 'success' ? 200 : 500;
    return NextResponse.json(result, { status: httpStatus });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}
