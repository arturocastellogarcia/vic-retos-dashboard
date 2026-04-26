// Helpers de UI compartidos entre páginas.
import type { Reto, Alerta } from '@/db/schema';

export type SemaforoColor = 'gris' | 'verde' | 'ambar' | 'rojo';

/**
 * Calcula el color del semáforo según las reglas de CONTEXTO §8.
 * Gris si está fuera de seguimiento o no tiene ficha; rojo/ámbar si tiene
 * alertas; verde si tiene ficha del mes actual sin alertas.
 */
export function calcSemaforo(reto: Reto, alertasReto: Alerta[], todayYM: string): SemaforoColor {
  if (reto.estadoGlobal === 'fin' || reto.estadoGlobal === 'sin_iniciar') return 'gris';
  if (!reto.fichaMasReciente) return 'gris';
  if (alertasReto.some((a) => a.severidad === 'critical')) return 'rojo';
  if (alertasReto.some((a) => a.severidad === 'warn')) return 'ambar';
  if (reto.fichaMasReciente === todayYM) return 'verde';
  return 'ambar'; // tiene ficha pero no del mes actual: data envejeciendo, sin alerta aún
}

export function severityRank(s: string): number {
  if (s === 'critical') return 3;
  if (s === 'warn') return 2;
  if (s === 'info') return 1;
  return 0;
}

export function formatEuros(n: number | null | undefined): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);
}

export function currentYM(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function ymToLabel(ym: string | null | undefined): string {
  if (!ym) return '—';
  const [y, m] = ym.split('-').map(Number);
  if (!m || m < 1 || m > 12) return ym;
  return `${MESES_LARGOS[m - 1]} ${y}`;
}

export function relativeTime(date: Date | null | undefined): string {
  if (!date) return '—';
  const diff = Date.now() - new Date(date).getTime();
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day > 0) return `hace ${day}d`;
  if (hr > 0) return `hace ${hr}h`;
  if (min > 0) return `hace ${min}min`;
  return 'ahora';
}

export const SEVERIDAD_COLOR: Record<string, string> = {
  info: 'bg-sky-50 text-sky-900 border-sky-200',
  warn: 'bg-amber-50 text-amber-900 border-amber-200',
  critical: 'bg-rose-50 text-rose-900 border-rose-200',
};
