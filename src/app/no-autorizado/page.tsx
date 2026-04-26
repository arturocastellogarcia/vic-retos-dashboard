import Link from 'next/link';

export default function NoAutorizadoPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="max-w-md text-center space-y-4 bg-white border border-slate-200 rounded-xl p-8">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Acceso no autorizado</h1>
        <p className="text-sm text-slate-600">
          Tu email no está en la lista de personas autorizadas para ver este dashboard.
          Si crees que debería estarlo, contacta con Arturo Castelló.
        </p>
        <Link
          href="/login"
          className="inline-block px-4 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-700 transition-colors"
        >
          Volver al login
        </Link>
      </div>
    </div>
  );
}
