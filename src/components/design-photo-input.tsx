'use client';

import { useState } from 'react';

/**
 * Input file untuk foto desain pisau di form "Pesanan Baru". Hitungan foto
 * terpilih hanya bantuan tampilan di sisi klien (supaya admin langsung tahu
 * kalau belum cukup 3) — validasi yang SEBENARNYA tetap ditegakkan di server
 * (lihat createOrderAction di ../app/(app)/orders/new/actions.ts), jadi form
 * ini tidak bisa dipakai untuk melewati aturan minimal foto.
 */
export function DesignPhotoInput({ min = 3 }: { min?: number }) {
  const [count, setCount] = useState(0);

  return (
    <div className="flex flex-col gap-1.5">
      <input
        type="file"
        name="desainFoto"
        accept="image/jpeg,image/png,image/webp"
        multiple
        required
        onChange={(e) => setCount(e.currentTarget.files?.length ?? 0)}
        className="rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-[var(--brand-blue)]"
      />
      <p className={'text-xs ' + (count > 0 && count < min ? 'font-medium text-[var(--brand-red)]' : 'text-black/50')}>
        {count} foto terpilih{count > 0 && count < min ? ` — minimal ${min} foto` : ''}
      </p>
    </div>
  );
}
