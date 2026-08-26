'use client';

import Link from 'next/link';

/**
 * Error boundary untuk seluruh halaman di dalam shell aplikasi (sidebar
 * tetap tampil, karena error.tsx hanya menggantikan konten di bawah layout
 * terdekat) — sebelumnya Server Action yang `throw new Error(...)` (validasi
 * gagal, dll.) langsung menampilkan halaman error teknis bawaan Next.js.
 * Pesan error di aplikasi ini sudah ditulis dalam Bahasa Indonesia yang
 * mudah dipahami (lihat berbagai `throw new Error(...)` di actions.ts),
 * jadi cukup ditampilkan langsung — bukan pesan generik.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex max-w-lg flex-col gap-4 rounded-2xl border border-[var(--brand-red)]/25 bg-white p-6">
      <div className="flex items-center gap-2">
        <span className="text-2xl">⚠️</span>
        <h1 className="font-heading text-lg font-semibold">Terjadi Kesalahan</h1>
      </div>
      <p className="text-sm text-black/70">{error.message || 'Terjadi kesalahan yang tidak terduga.'}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-[var(--brand-blue)] px-4 py-2 text-sm font-semibold text-white"
        >
          Coba Lagi
        </button>
        <Link
          href="/dashboard"
          className="rounded-lg border border-black/15 px-4 py-2 text-sm font-semibold text-black/70 hover:border-[var(--brand-blue)]"
        >
          Kembali ke Dashboard
        </Link>
      </div>
    </div>
  );
}
