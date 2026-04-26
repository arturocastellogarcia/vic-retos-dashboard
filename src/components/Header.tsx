import Link from 'next/link';

export default function Header() {
  return (
    <header className="border-b border-slate-200 bg-white print:hidden">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 py-4 flex items-center justify-between">
        <Link href="/" className="font-semibold tracking-tight text-slate-900">
          VIC · Retos
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/" className="text-slate-600 hover:text-slate-900 transition-colors">Cuadro</Link>
          <Link href="/alertas" className="text-slate-600 hover:text-slate-900 transition-colors">Alertas</Link>
          <Link href="/delegacion" className="text-slate-600 hover:text-slate-900 transition-colors">Delegación</Link>
        </nav>
      </div>
    </header>
  );
}
