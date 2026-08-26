import { cookies } from 'next/headers';

// Notifikasi singkat ("toast") setelah sebuah aksi berhasil/gagal — dulu
// tidak ada sama sekali, jadi pengguna hanya melihat halaman reload tanpa
// konfirmasi jelas bahwa aksinya benar-benar tersimpan. Disimpan lewat
// cookie berumur pendek (bukan session/localStorage) supaya bisa diset dari
// Server Action lalu langsung terbaca di render berikutnya tanpa state
// tambahan di client — cookie ini otomatis "hilang sendiri" setelah
// beberapa detik (lihat maxAge), jadi tidak perlu logika hapus manual.
const FLASH_COOKIE = 'pisau_flash';

export type FlashKind = 'success' | 'error';

export async function setFlash(kind: FlashKind, message: string): Promise<void> {
  const store = await cookies();
  store.set(FLASH_COOKIE, JSON.stringify({ kind, message }), {
    path: '/',
    maxAge: 8,
    httpOnly: false,
    sameSite: 'lax',
  });
}

export async function readFlash(): Promise<{ kind: FlashKind; message: string } | null> {
  const store = await cookies();
  const raw = store.get(FLASH_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { kind: FlashKind; message: string };
    if (parsed.kind !== 'success' && parsed.kind !== 'error') return null;
    return parsed;
  } catch {
    return null;
  }
}
