'use client';

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DELETE_CONFIRM_CODE } from '@/lib/constants';

/**
 * Tombol "Hapus"/"Delete" yang, sebelum benar-benar mengirim form-nya (jadi
 * benar-benar menjalankan Server Action penghapusan), memunculkan popup
 * meminta kode konfirmasi (default: 1234 — lihat DELETE_CONFIRM_CODE di
 * src/lib/constants.ts). Ini murni pengaman dari salah klik, bukan
 * password akun — kode yang sama dipakai untuk semua operasi hapus di
 * aplikasi ini, dan divalidasi ULANG di server (lihat masing-masing Server
 * Action) supaya tidak bisa dilewati hanya dengan menonaktifkan JavaScript.
 *
 * Dipakai dengan cara: bungkus tombol trigger di dalam sebuah <form
 * action={someDeleteAction}>, ganti <button type="submit"> jadi komponen
 * ini. Begitu kode dikonfirmasi benar, komponen ini menambahkan input
 * hidden "confirmCode" ke form terdekat lalu memanggil form.requestSubmit().
 */
export function ConfirmDeleteButton({
  label,
  triggerClassName,
  title,
  description,
  confirmLabel,
  cancelLabel,
  errorText,
  placeholder,
}: {
  label: string;
  triggerClassName?: string;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  errorText?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  function openModal(e: React.MouseEvent<HTMLButtonElement>) {
    formRef.current = e.currentTarget.closest('form');
    setCode('');
    setError(false);
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
  }

  function confirmAndSubmit() {
    if (code !== DELETE_CONFIRM_CODE) {
      setError(true);
      return;
    }
    const form = formRef.current;
    if (!form) return;
    let hidden = form.querySelector<HTMLInputElement>('input[name="confirmCode"]');
    if (!hidden) {
      hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.name = 'confirmCode';
      form.appendChild(hidden);
    }
    hidden.value = code;
    setOpen(false);
    form.requestSubmit();
  }

  // Portal ke document.body: modal ini SENGAJA dirender di luar posisi DOM
  // tombol trigger-nya (walaupun secara visual sudah "fixed inset-0"),
  // supaya tidak ikut kena aturan CSS yang di-scope ke leluhur tertentu di
  // tempat tombol ini dipasang (misalnya `.iv-row-actions button { background:
  // none }` di modul Invoice & Documents) — kalau tidak, tombol konfirmasi di
  // dalam modal ini bisa ikut kena reset background/border yang sebenarnya
  // ditujukan untuk tombol aksi baris tabel, bukan untuk modal ini.
  const modal =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={closeModal}
          >
            <div
              className="flex w-full max-w-xs flex-col gap-3 rounded-xl bg-white p-4 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <div className="text-sm font-semibold text-black/80">{title ?? 'Konfirmasi Hapus'}</div>
                <p className="mt-0.5 text-xs text-black/55">
                  {description ?? 'Masukkan kode konfirmasi untuk menghapus data ini.'}
                </p>
              </div>
              <input
                type="password"
                inputMode="numeric"
                autoFocus
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setError(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    confirmAndSubmit();
                  }
                }}
                placeholder={placeholder ?? 'Kode konfirmasi'}
                className="rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-red-500"
              />
              {error ? (
                <p className="text-xs font-medium text-red-600">{errorText ?? 'Kode salah. Coba lagi.'}</p>
              ) : null}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-md px-3 py-1.5 text-xs font-semibold text-black/55 hover:bg-black/5"
                >
                  {cancelLabel ?? 'Batal'}
                </button>
                <button
                  type="button"
                  onClick={confirmAndSubmit}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                >
                  {confirmLabel ?? 'Hapus'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button type="button" onClick={openModal} className={triggerClassName}>
        {label}
      </button>
      {modal}
    </>
  );
}
