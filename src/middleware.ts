// Middleware de auth: verifica sesión Supabase y email en allowlist.
// Reglas (CONTEXTO §9):
//   1. /api/sync → permitido (auth por CRON_SECRET en el handler)
//   2. /login, /no-autorizado, /auth/callback → permitidos
//   3. Sin sesión → redirect a /login
//   4. Email no en allowlist → redirect a /no-autorizado

import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { isEmailAllowed } from '@/lib/auth-allowlist';

const PUBLIC_PATHS = [
  '/api/sync',
  '/login',
  '/no-autorizado',
  '/auth/callback',
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (!isEmailAllowed(user.email)) {
    return NextResponse.redirect(new URL('/no-autorizado', request.url));
  }

  return response;
}

export const config = {
  // Ejecutar en todas las rutas excepto assets estáticos de Next.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
