'use client';

import { useEffect, useState } from 'react';

/**
 * Kolom input Honor Vendor dengan dua mode — dipakai di tiga tempat: form
 * Buat Pesanan Baru (per divisi), panel "Honor & Harga Modal (admin)" di
 * halaman detail pesanan, dan edit cepat di kartu Dashboard (lihat
 * StageCostQuickEdit). Server Action penerimanya (createOrderAction /
 * updateStageCostAction) yang menghitung ulang total secara otentik dari
 * `honorRate × jumlah` untuk mode Per Unit — nilai yang ditampilkan di sini
 * murni pratinjau, bukan sumber kebenaran, supaya tetap benar walau
 * JavaScript nonaktif atau field disunting lewat devtools.
 *
 * - Mode 'Borongan': satu input, total langsung (perilaku lama, tidak berubah).
 * - Mode 'Per Unit': input tarif per pcs + pratinjau `tarif × jumlah = total`.
 *
 * `qty` bisa berupa angka tetap (mengedit tahap pesanan yang sudah ada, di
 * mana jumlah pesanan sudah pasti) ATAU `{ watchFieldName }` untuk memantau
 * input lain di form yang sama secara live (dipakai di form Buat Pesanan
 * Baru, karena jumlah unit diisi bersamaan di form yang sama).
 */
export function HonorModeField({
  fieldNames,
  initialMode = 'BORONGAN',
  initialRate = 0,
  initialTotal = 0,
  qty,
  unitLabel = 'unit',
  compact = false,
}: {
  fieldNames: { mode: string; rate: string; total: string };
  initialMode?: 'BORONGAN' | 'PER_UNIT';
  initialRate?: number;
  initialTotal?: number;
  qty: number | { watchFieldName: string };
  unitLabel?: string;
  compact?: boolean;
}) {
  const [mode, setMode] = useState<'BORONGAN' | 'PER_UNIT'>(initialMode);
  const [rate, setRate] = useState(initialRate);
  const [total, setTotal] = useState(initialTotal);
  const [watchedQty, setWatchedQty] = useState(0);
  const liveQty = typeof qty === 'number' ? qty : watchedQty;

  useEffect(() => {
    if (typeof qty === 'number') return;
    const el = document.querySelector<HTMLInputElement>(`input[name="${qty.watchFieldName}"]`);
    if (!el) return;
    const sync = () => setWatchedQty(Number(el.value) || 0);
    sync();
    el.addEventListener('input', sync);
    return () => el.removeEventListener('input', sync);
  }, [qty]);

  const computedTotal = mode === 'PER_UNIT' ? Math.max(0, Math.round(rate * liveQty)) : total;
  const inputCls = compact
    ? 'rounded-md border border-black/15 bg-white px-2.5 py-1.5 text-xs font-normal text-black outline-none focus:border-[var(--brand-blue)]'
    : 'rounded-lg border border-black/15 px-3 py-2 text-sm font-normal text-black outline-none focus:border-[var(--brand-blue)]';
  const labelCls = compact
    ? 'flex flex-col gap-1 text-[11px] font-medium text-black/60'
    : 'flex flex-col gap-1 text-xs font-medium text-black/60';

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex w-fit gap-0.5 rounded-md bg-black/[0.05] p-0.5">
        <button
          type="button"
          onClick={() => setMode('BORONGAN')}
          className={
            'rounded px-2 py-1 text-[10.5px] font-semibold ' +
            (mode === 'BORONGAN' ? 'bg-white text-black shadow-sm' : 'text-black/50')
          }
        >
          Borongan
        </button>
        <button
          type="button"
          onClick={() => setMode('PER_UNIT')}
          className={
            'rounded px-2 py-1 text-[10.5px] font-semibold ' +
            (mode === 'PER_UNIT' ? 'bg-white text-black shadow-sm' : 'text-black/50')
          }
        >
          Per Unit
        </button>
      </div>

      <input type="hidden" name={fieldNames.mode} value={mode} />
      <input type="hidden" name={fieldNames.rate} value={rate} />
      <input type="hidden" name={fieldNames.total} value={computedTotal} />

      {mode === 'BORONGAN' ? (
        <label className={labelCls}>
          Honor Vendor (Rp)
          <input
            type="number"
            min={0}
            step={1000}
            defaultValue={total || undefined}
            placeholder="0"
            onChange={(e) => setTotal(Math.max(0, Number(e.target.value) || 0))}
            className={inputCls}
          />
        </label>
      ) : (
        <>
          <label className={labelCls}>
            Harga per Pcs (Rp)
            <input
              type="number"
              min={0}
              step={1000}
              defaultValue={rate || undefined}
              placeholder="0"
              onChange={(e) => setRate(Math.max(0, Number(e.target.value) || 0))}
              className={inputCls}
            />
          </label>
          <div className="flex flex-wrap items-center gap-1.5 rounded-md bg-[var(--brand-blue)]/10 px-2.5 py-1.5 text-[11px] text-[var(--brand-blue)]">
            <span className="tabular-nums">Rp {rate.toLocaleString('id-ID')}</span>
            <span className="opacity-50">×</span>
            <span className="tabular-nums">
              {liveQty} {unitLabel}
            </span>
            <span className="opacity-50">=</span>
            <strong className="tabular-nums">Rp {computedTotal.toLocaleString('id-ID')}</strong>
          </div>
        </>
      )}
    </div>
  );
}
