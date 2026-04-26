'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SyncButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  async function handleClick() {
    setLoading(true);
    setMessage(null);
    try {
      const resp = await fetch('/api/sync', { method: 'POST' });
      const data = await resp.json();
      if (resp.ok) {
        setMessage(
          `✓ ${data.fichasProcesadas ?? 0} procesadas · ${data.fichasNuevas ?? 0} nuevas · ${data.alertasActivas ?? 0} alertas`,
        );
        router.refresh();
      } else {
        setMessage(`✗ ${data.error ?? `HTTP ${resp.status}`}`);
      }
    } catch (e) {
      setMessage(`✗ ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="px-4 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Sincronizando…' : 'Sincronizar ahora'}
      </button>
      {message && <span className="text-sm text-slate-600">{message}</span>}
    </div>
  );
}
