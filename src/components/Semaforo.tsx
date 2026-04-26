import type { SemaforoColor } from '@/lib/ui-helpers';

const COLOR_BG: Record<SemaforoColor, string> = {
  gris: 'bg-slate-300',
  verde: 'bg-emerald-500',
  ambar: 'bg-amber-500',
  rojo: 'bg-rose-500',
};
const COLOR_TITLE: Record<SemaforoColor, string> = {
  gris: 'Sin datos / fuera de seguimiento',
  verde: 'Ficha del mes actual y sin alertas',
  ambar: 'Con avisos',
  rojo: 'Crítico',
};

export default function Semaforo({ color }: { color: SemaforoColor }) {
  return (
    <span
      className={`inline-block size-2.5 rounded-full ${COLOR_BG[color]}`}
      title={COLOR_TITLE[color]}
      aria-label={COLOR_TITLE[color]}
    />
  );
}
