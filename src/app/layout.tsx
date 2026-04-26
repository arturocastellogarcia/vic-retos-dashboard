// Root layout: solo html/body. Las páginas autenticadas viven dentro del
// route group (app) que añade el Header. /login y /no-autorizado usan este
// layout directamente, sin nav.

import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'VIC · Retos GovTech',
  description:
    'Dashboard de seguimiento de los 16 retos GovTech del programa València Innovation Capital',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
