'use client';

import { useEffect, useState } from 'react';

/**
 * Notifikasi singkat di pojok bawah setelah sebuah aksi berhasil/gagal —
 * dipasok dari cookie "flash" yang diset Server Action (lihat
 * src/lib/flash.ts) dan dibaca sekali di (app)/layout.tsx. Sengaja
 * component state di memori (bukan localStorage) karena hanya perlu hidup
 * selama satu render halaman ini.
 */
export function Toast({ flash }: { flash: { kind: 'success' | 'error'; message: string } | null }) {
  const [visible, setVisible] = useState(!!flash);

  useEffect(() => {
    setVisible(!!flash);
    if (!flash) return;
    const t = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sengaja re-trigger tiap kali `flash` (nilai baru dari server) berubah
  }, [flash?.message, flash?.kind]);

  if (!flash || !visible) return null;

  const isError = flash.kind === 'error';

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div
        role="status"
        className={
          'pointer-events-auto flex max-w-md items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ' +
          (isError
            ? 'border-red-200 bg-red-50 text-red-700'
            : 'border-[oklch(0.8_0.08_142)] bg-[oklch(0.94_0.045_142)] text-[oklch(0.32_0.09_142)]')
        }
      >
        <span className="mt-0.5 flex-shrink-0">{isError ? '⚠️' : '✅'}</span>
        <span className="flex-grow">{flash.message}</span>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="flex-shrink-0 text-black/40 hover:text-black/70"
          aria-label="Tutup notifikasi"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
