'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setError(null);

    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (err) {
        setStatus('error');
        setError(err.message);
      } else {
        setStatus('sent');
      }
    } catch (e) {
      setStatus('error');
      setError((e as Error).message);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm bg-white rounded-xl border border-slate-200 p-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">VIC · Retos</h1>
          <p className="mt-1 text-sm text-slate-600">
            Accede con tu email autorizado. Te enviaremos un enlace de un solo uso.
          </p>
        </div>

        {status === 'sent' ? (
          <div className="px-4 py-3 rounded-md bg-emerald-50 border border-emerald-200 text-sm text-emerald-900">
            Enlace enviado. Revisa tu email y haz clic en él para entrar.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu.email@lasnaves.com"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
              disabled={status === 'sending'}
            />
            <button
              type="submit"
              disabled={status === 'sending' || !email}
              className="w-full px-4 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {status === 'sending' ? 'Enviando…' : 'Enviar enlace'}
            </button>
            {error && <p className="text-sm text-rose-700">{error}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
