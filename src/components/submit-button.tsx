'use client';

import { useFormStatus } from 'react-dom';

/**
 * Tombol submit yang otomatis nonaktif + berubah teks selagi Server Action
 * induknya sedang berjalan (lewat useFormStatus, bawaan React untuk form
 * yang action-nya sebuah Server Action) — mencegah klik ganda yang bisa
 * mencatat data dobel (misalnya pembayaran honor tercatat dua kali) saat
 * koneksi lambat. HARUS dirender sebagai child langsung dari elemen
 * <form>, bukan di form lain/terpisah, karena useFormStatus membaca status
 * dari <form> parent terdekat.
 */
export function SubmitButton({
  children,
  pendingText,
  className,
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={(className ?? '') + (pending ? ' cursor-not-allowed opacity-60' : '')}
    >
      {pending ? (pendingText ?? 'Menyimpan…') : children}
    </button>
  );
}
