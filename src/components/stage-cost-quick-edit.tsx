'use client';

import { useState } from 'react';
import { SubmitButton } from '@/components/submit-button';
import { HonorModeField } from '@/components/honor-mode-field';

/**
 * Tombol "Edit Honor & Modal" ringkas di kartu Dashboard (panel Perlu
 * Perhatian) — diklik untuk membuka form isian di tempat, memakai ulang
 * Server Action `updateStageCostAction` yang sama persis dengan panel
 * "Honor & Harga Modal (admin)" di halaman detail pesanan (lihat
 * src/app/(app)/orders/[id]/page.tsx & actions.ts), jadi tidak ada logika
 * baru di server — cuma tempat form-nya yang baru.
 *
 * Kolapsnya default (bukan selalu terbuka seperti di halaman detail)
 * karena panel Perlu Perhatian bisa memuat banyak kartu sekaligus — kalau
 * semua kartu langsung membuka form, daftarnya jadi terlalu panjang untuk
 * dipindai sekilas.
 */
export function StageCostQuickEdit({
  stageId,
  honorJumlahRaw,
  honorMode,
  honorRateRaw,
  orderJumlah,
  materialCostLabel,
  materialCostRaw,
  action,
}: {
  stageId: string;
  honorJumlahRaw: number;
  honorMode: 'BORONGAN' | 'PER_UNIT';
  honorRateRaw: number;
  orderJumlah: number;
  materialCostLabel: string | null;
  materialCostRaw: number;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex w-fit items-center gap-1.5 rounded-md bg-[var(--brand-blue)]/10 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--brand-blue)]"
      >
        ✎ Edit Honor &amp; Modal
      </button>
    );
  }

  return (
    <form
      action={action}
      className="flex flex-col gap-2 rounded-lg border border-dashed border-black/15 bg-black/[0.02] px-3 py-2.5"
    >
      <input type="hidden" name="stageId" value={stageId} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <HonorModeField
          fieldNames={{ mode: 'honorMode', rate: 'honorRate', total: 'honorJumlah' }}
          initialMode={honorMode}
          initialRate={honorRateRaw}
          initialTotal={honorJumlahRaw}
          qty={orderJumlah}
          compact
        />
        {materialCostLabel ? (
          <label className="flex flex-col gap-1 text-[11px] font-medium text-black/60">
            {materialCostLabel} (Rp)
            <input
              name="materialCost"
              type="number"
              min={0}
              step={1000}
              defaultValue={materialCostRaw}
              className="rounded-md border border-black/15 bg-white px-2.5 py-1.5 text-xs font-normal text-black outline-none focus:border-[var(--brand-blue)]"
            />
          </label>
        ) : null}
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded-md border border-black/15 px-2.5 py-1.5 text-[11px] font-semibold text-black/60"
        >
          Batal
        </button>
        <SubmitButton
          pendingText="Menyimpan…"
          className="rounded-md bg-[var(--brand-blue)] px-3 py-1.5 text-[11px] font-semibold text-white"
        >
          Simpan
        </SubmitButton>
      </div>
    </form>
  );
}
