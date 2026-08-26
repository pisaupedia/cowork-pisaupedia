'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Kotak upload file bergaya dropzone (kotak putus-putus + "+ Upload" dengan
 * preview thumbnail begitu file dipilih) — dipakai untuk mengganti
 * `<input type="file">` polos bawaan browser ("Choose File / No file
 * chosen") di form upload foto bukti tahap & tambah foto desain susulan,
 * supaya gaya & kemudahan pakainya konsisten dengan form foto desain saat
 * membuat pesanan baru (lihat DesignPhotoInput, pola yang sama dipakai di
 * sini). Input file aslinya tetap ada di DOM (cuma disembunyikan via
 * `sr-only`, dibungkus di dalam `<label>` yang sama supaya tetap bisa
 * diklik) — nama field, atribut `required`/`accept`/`multiple`, dan Server
 * Action yang menerimanya di belakang layar semua tidak berubah sama
 * sekali.
 */
export function FileDropzoneInput({
  name,
  accept,
  required,
  multiple,
  boxClassName = 'h-24 w-24',
}: {
  name: string;
  accept?: string;
  required?: boolean;
  multiple?: boolean;
  /** Ukuran kotak dropzone-nya, default persegi 96x96px (kelas Tailwind). */
  boxClassName?: string;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.currentTarget.files ?? []);
    setFiles(list);

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    const first = list[0];
    if (first && first.type.startsWith('image/')) {
      const url = URL.createObjectURL(first);
      objectUrlRef.current = url;
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  }

  const first = files[0];
  const extraCount = files.length - 1;

  return (
    <label className="flex w-fit cursor-pointer flex-col items-center gap-1">
      <span
        className={
          'relative flex items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-black/20 bg-black/[0.02] text-center text-xs font-medium text-black/55 transition hover:border-[var(--brand-blue)] hover:text-[var(--brand-blue)] ' +
          boxClassName
        }
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- preview lokal via object URL, bukan aset statis/server
          <img src={previewUrl} alt={first?.name ?? ''} className="h-full w-full object-cover" />
        ) : first ? (
          <span className="flex flex-col items-center gap-0.5 px-1.5">
            <span className="text-lg leading-none">📄</span>
            <span className="line-clamp-2 break-all text-[10px] leading-tight">{first.name}</span>
          </span>
        ) : (
          <span className="flex flex-col items-center gap-0.5">
            <span className="text-base leading-none">+</span>
            <span>Upload</span>
          </span>
        )}
        {extraCount > 0 ? (
          <span className="absolute bottom-1 right-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            +{extraCount}
          </span>
        ) : null}
      </span>
      <input type="file" name={name} accept={accept} required={required} multiple={multiple} className="sr-only" onChange={handleChange} />
    </label>
  );
}
