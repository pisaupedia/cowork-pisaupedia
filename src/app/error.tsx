'use client';

/** Error boundary untuk halaman di luar shell aplikasi (misalnya /login) —
 * lihat catatan lebih lengkap di src/app/(app)/error.tsx. */
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[oklch(0.97_0.005_255)] p-4">
      <div className="flex max-w-md flex-col gap-4 rounded-2xl border border-[var(--brand-red)]/25 bg-white p-6">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚠️</span>
          <h1 className="font-heading text-lg font-semibold">Terjadi Kesalahan</h1>
        </div>
        <p className="text-sm text-black/70">{error.message || 'Terjadi kesalahan yang tidak terduga.'}</p>
        <button
          type="button"
          onClick={() => reset()}
          className="w-fit rounded-lg bg-[var(--brand-blue)] px-4 py-2 text-sm font-semibold text-white"
        >
          Coba Lagi
        </button>
      </div>
    </div>
  );
}
