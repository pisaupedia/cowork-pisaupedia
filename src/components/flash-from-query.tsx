'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Toast } from './toast';

/**
 * Variant dari <Toast> yang isinya dipasok lewat query string `?flash=...`
 * pada URL redirect, bukan lewat cookie (lihat src/lib/flash.ts &
 * (app)/layout.tsx untuk kasus umum) — dipakai khusus untuk Server Action
 * yang redirect ke HALAMAN LAIN (misalnya edit pesanan -> detail pesanan),
 * karena cookie yang diset lalu langsung redirect ke rute lain berisiko
 * dibaca dari cache Next.js yang belum tahu soal cookie barunya (layout
 * di-cache per rute oleh router client-side, jadi tidak selalu ikut
 * render ulang hanya karena isi cookie berubah). Query string tidak
 * terpengaruh cache tersebut karena selalu dibaca langsung dari URL saat
 * ini oleh halaman tujuan.
 *
 * Pesan ditangkap sekali di `capturedRef` saat komponen ini pertama kali
 * dirender (bukan dibaca ulang dari prop `message` setiap render) — supaya
 * saat query param dibersihkan dari URL sesaat setelah muncul (lihat
 * `router.replace` di bawah), notifikasinya tidak langsung ikut hilang
 * sebelum jangka waktu tampilnya sendiri (lihat komponen Toast).
 */
export function FlashFromQuery({ message }: { message: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const capturedRef = useRef<string | null>(message);

  useEffect(() => {
    if (!message) return;
    router.replace(pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sengaja hanya sekali saat mount, bukan setiap kali `message`/`pathname` berubah
  }, []);

  if (!capturedRef.current) return null;
  return <Toast flash={{ kind: 'success', message: capturedRef.current }} />;
}
