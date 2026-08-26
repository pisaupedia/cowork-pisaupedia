'use client';

import { useEffect, useRef, useState } from 'react';

const VIEWS = [
  { key: 'depan', label: 'Tampak Depan' },
  { key: 'belakang', label: 'Tampak Belakang' },
  { key: 'samping', label: 'Tampak Samping' },
  { key: 'atas', label: 'Tampak Atas' },
] as const;

/**
 * Input file foto desain pisau di form "Pesanan Baru" — 4 slot tetap
 * (Tampak Depan/Belakang/Samping/Atas) supaya admin diarahkan mengambil
 * foto dari sudut yang lengkap, bukan sekadar "upload berapa saja file".
 * Begitu satu slot diisi, langsung muncul thumbnail preview di kotaknya
 * (menggantikan placeholder "+ Upload").
 *
 * Semua slot memakai nama field yang sama (`desainFoto`) saat dikirim ke
 * server — lihat createOrderAction di ../app/(app)/orders/new/actions.ts —
 * jadi slot mana yang diisi hanya panduan visual di sisi klien, tidak
 * disimpan sebagai metadata "tampak apa" secara terpisah. Hitungan & pesan
 * minimal foto di bawah ini juga cuma bantuan tampilan; validasi yang
 * SEBENARNYA tetap ditegakkan di server, jadi tidak bisa dilewati.
 */
export function DesignPhotoInput({ min = 3 }: { min?: number }) {
  const [previews, setPreviews] = useState<Partial<Record<string, string>>>({});
  const objectUrls = useRef<Partial<Record<string, string>>>({});

  useEffect(() => {
    return () => {
      Object.values(objectUrls.current).forEach((url) => url && URL.revokeObjectURL(url));
    };
  }, []);

  const count = Object.values(previews).filter(Boolean).length;

  function handleChange(key: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0] ?? null;

    const prevUrl = objectUrls.current[key];
    if (prevUrl) URL.revokeObjectURL(prevUrl);

    if (file) {
      const url = URL.createObjectURL(file);
      objectUrls.current[key] = url;
      setPreviews((p) => ({ ...p, [key]: url }));
    } else {
      delete objectUrls.current[key];
      setPreviews((p) => ({ ...p, [key]: undefined }));
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {VIEWS.map((v) => {
          const preview = previews[v.key];
          return (
            <label key={v.key} className="flex cursor-pointer flex-col items-center gap-1.5">
              <span className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-black/20 bg-black/[0.02] text-xs font-medium text-black/55 transition hover:border-[var(--brand-blue)] hover:text-[var(--brand-blue)]">
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element -- preview lokal via object URL, bukan aset statis/server
                  <img src={preview} alt={v.label} className="h-full w-full object-cover" />
                ) : (
                  <span className="flex flex-col items-center gap-0.5">
                    <span className="text-base leading-none">+</span>
                    <span>Upload</span>
                  </span>
                )}
              </span>
              <input
                type="file"
                name="desainFoto"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => handleChange(v.key, e)}
              />
              <span className="text-[11px] text-black/55">{v.label}</span>
            </label>
          );
        })}
      </div>
      <p className={'text-xs ' + (count > 0 && count < min ? 'font-medium text-[var(--brand-red)]' : 'text-black/50')}>
        {count} foto terpilih{count > 0 && count < min ? ` — minimal ${min} foto` : ''}
      </p>
    </div>
  );
}
