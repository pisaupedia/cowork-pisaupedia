import type { Metadata } from 'next';
import { ensureSeeded } from '@/lib/bootstrap';
import './globals.css';

// Sengaja TIDAK memakai next/font/google — supaya build & runtime tidak
// bergantung pada koneksi ke fonts.googleapis.com (bisa diblokir oleh
// firewall/jaringan perusahaan). Judul memakai stack font sistem yang
// tebal & tegas sebagai pengganti Oswald; lihat globals.css.

export const metadata: Metadata = {
  title: 'Pisaupedia Knife Manufacture',
  description: 'Workflow management produksi pisau lintas divisi & vendor.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  ensureSeeded();
  return (
    <html lang="id" className="h-full">
      <body className="min-h-full font-sans antialiased">{children}</body>
    </html>
  );
}
