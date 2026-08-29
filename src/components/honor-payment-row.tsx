'use client';

import { useState } from 'react';
import { SubmitButton } from '@/components/submit-button';
import { ConfirmDeleteButton } from '@/components/confirm-delete-button';

/**
 * Satu baris di daftar "Riwayat Pembayaran" honor vendor — beda dari form
 * "Catat Pembayaran" (yang MENAMBAH baris baru), komponen ini untuk
 * mengoreksi/menghapus baris yang SUDAH tercatat (misalnya salah ketik
 * nominal, atau tercatat dua kali). Diklik pensil → baris berubah jadi form
 * isian di tempat (nominal + catatan) dengan tombol Simpan/Batal eksplisit,
 * bukan auto-save — konsisten dengan panel "Honor & Harga Modal" di atasnya.
 * Tombol hapus memakai ConfirmDeleteButton yang sama dengan tombol hapus
 * lain di aplikasi ini (kode konfirmasi), supaya baris riwayat uang tidak
 * kehapus karena salah pencet.
 */
export function HonorPaymentRow({
  stageId,
  paymentId,
  jumlahRaw,
  jumlahLabel,
  catatan,
  oleh,
  tanggalLabel,
  editAction,
  deleteAction,
  editable = true,
}: {
  stageId: string;
  paymentId: string;
  jumlahRaw: number;
  jumlahLabel: string;
  catatan: string | null;
  oleh: string;
  tanggalLabel: string;
  editAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
  /** Admin-only: tampilkan ikon edit/hapus. Vendor tetap lihat baris riwayat
   * ini (haknya sama seperti sebelumnya) tapi tanpa kontrol koreksi. */
  editable?: boolean;
}) {
  const [editing, setEditing] = useState(false);

  if (editing && editable) {
    return (
      <form
        action={editAction}
        className="flex flex-wrap items-end gap-2 rounded-md border border-[var(--brand-blue)] bg-[oklch(0.97_0.02_255)] px-2.5 py-2"
      >
        <input type="hidden" name="stageId" value={stageId} />
        <input type="hidden" name="paymentId" value={paymentId} />
        <label className="flex flex-col gap-0.5 text-[10px] font-medium text-black/60">
          Nominal (Rp)
          <input
            name="jumlah"
            type="number"
            min={0}
            step={1000}
            defaultValue={jumlahRaw}
            required
            className="w-28 rounded-md border border-black/15 bg-white px-2 py-1 text-xs font-normal text-black outline-none focus:border-[var(--brand-blue)]"
          />
        </label>
        <label className="flex flex-col gap-0.5 text-[10px] font-medium text-black/60">
          Catatan
          <input
            name="catatan"
            type="text"
            defaultValue={catatan ?? ''}
            placeholder="opsional"
            className="w-28 rounded-md border border-black/15 bg-white px-2 py-1 text-xs font-normal text-black outline-none focus:border-[var(--brand-blue)]"
          />
        </label>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-md px-2 py-1.5 text-[11px] font-semibold text-black/50 hover:bg-black/5"
          >
            Batal
          </button>
          <SubmitButton
            pendingText="Menyimpan…"
            className="rounded-md bg-[var(--brand-blue)] px-2.5 py-1.5 text-[11px] font-semibold text-white"
          >
            Simpan
          </SubmitButton>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white px-2.5 py-1.5">
      <span>
        <strong>{jumlahLabel}</strong>
        {catatan ? <span className="text-black/55"> — {catatan}</span> : null}
      </span>
      <div className="flex items-center gap-1.5">
        <span className="text-black/55">
          {tanggalLabel} · {oleh}
        </span>
        {editable ? (
          <>
            <button
              type="button"
              onClick={() => setEditing(true)}
              title="Edit riwayat pembayaran ini"
              className="rounded-md px-1.5 py-1 text-[13px] leading-none text-black/40 hover:bg-[oklch(0.95_0.03_255)] hover:text-[var(--brand-blue)]"
            >
              ✎
            </button>
            <form action={deleteAction}>
              <input type="hidden" name="stageId" value={stageId} />
              <input type="hidden" name="paymentId" value={paymentId} />
              <ConfirmDeleteButton
                label="🗑"
                triggerClassName="rounded-md px-1.5 py-1 text-[13px] leading-none text-black/40 hover:bg-red-50 hover:text-red-600"
                title="Hapus Riwayat Pembayaran"
                description={`Hapus baris pembayaran ${jumlahLabel}${catatan ? ` (${catatan})` : ''}? Total "Sudah Dibayarkan" tahap ini akan ikut berkurang.`}
                confirmLabel="Hapus"
                cancelLabel="Batal"
                errorText="Kode salah. Coba lagi."
                placeholder="Kode konfirmasi"
              />
            </form>
          </>
        ) : null}
      </div>
    </div>
  );
}
