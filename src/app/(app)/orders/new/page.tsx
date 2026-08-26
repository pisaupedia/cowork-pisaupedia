import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { listVendors } from '@/lib/repo/vendors';
import { DIVISIONS } from '@/lib/constants';
import { DesignPhotoInput } from '@/components/design-photo-input';
import { SubmitButton } from '@/components/submit-button';
import { createOrderAction } from './actions';

export default async function NewOrderPage() {
  const user = await requireUser();
  if (user.role !== 'ADMIN') redirect('/dashboard');

  const vendors = listVendors();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="font-heading text-xl font-semibold">Pesanan Baru</h1>

      <form action={createOrderAction} className="flex flex-col gap-5 rounded-xl border border-black/10 bg-white p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field name="jenis" label="Jenis Pisau" placeholder="Golok, Parang, Pisau Dapur…" required />
          <Field name="pelanggan" label="Nama Pelanggan" required />
          <Field name="kontak" label="Kontak Pelanggan" />
          <Field name="jumlah" label="Jumlah Unit" type="number" required />
          <Field name="harga" label="Harga Jual (Rp)" type="number" required />
          <Field name="tanggalMasuk" label="Tanggal Masuk" type="date" defaultValue={today} required />
          <Field name="deadline" label="Deadline" type="date" required />
        </div>

        <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
          Catatan / Rincian Pekerjaan
          <textarea
            name="catatan"
            placeholder="Rincian tambahan mengenai pesanan ini, misalnya ukuran, jenis bahan yang diminta, atau detail lain di luar kolom di atas…"
            className="min-h-20 rounded-lg border border-black/15 px-3 py-2 text-sm font-normal text-black outline-none focus:border-[var(--brand-blue)]"
          />
        </label>

        <div className="flex flex-col gap-3">
          <div>
            <h2 className="font-heading text-sm font-semibold">Penugasan Vendor, Honor & Harga Modal per Divisi</h2>
            <p className="text-xs text-black/55">
              Satu vendor bisa dipilih untuk lebih dari satu divisi pada pesanan yang sama. Honor & komponen
              harga modal diisi manual — kosongkan/isi 0 jika tidak relevan.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {DIVISIONS.map((div) => (
              <div key={div} className="flex flex-col gap-2 rounded-lg border border-black/10 p-3">
                <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
                  {div}
                  <select
                    name={`vendor_${div}`}
                    required
                    className="rounded-lg border border-black/15 px-3 py-2 text-sm font-normal text-black outline-none focus:border-[var(--brand-blue)]"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Pilih vendor…
                    </option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.nama}
                        {v.is_internal ? ' (internal)' : ''}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
                  Honor Vendor (Rp)
                  <input
                    name={`honor_${div}`}
                    type="number"
                    min={0}
                    step={1000}
                    placeholder="0"
                    className="rounded-lg border border-black/15 px-3 py-2 text-sm font-normal text-black outline-none focus:border-[var(--brand-blue)]"
                  />
                </label>

                {div === 'Cutting & Blacksmith' ? (
                  <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
                    Harga Modal Material Baja (Rp)
                    <input
                      name="materialCostBaja"
                      type="number"
                      min={0}
                      step={1000}
                      placeholder="0"
                      className="rounded-lg border border-black/15 px-3 py-2 text-sm font-normal text-black outline-none focus:border-[var(--brand-blue)]"
                    />
                  </label>
                ) : null}

                {div === 'Handle & Cover' ? (
                  <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
                    Harga Modal Bahan Kayu (Rp)
                    <input
                      name="materialCostKayu"
                      type="number"
                      min={0}
                      step={1000}
                      placeholder="0"
                      className="rounded-lg border border-black/15 px-3 py-2 text-sm font-normal text-black outline-none focus:border-[var(--brand-blue)]"
                    />
                  </label>
                ) : null}

                {div === 'Selesai Produksi' ? (
                  <>
                    <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
                      Harga Shipping (Rp)
                      <input
                        name="shippingCost"
                        type="number"
                        min={0}
                        step={1000}
                        placeholder="0"
                        className="rounded-lg border border-black/15 px-3 py-2 text-sm font-normal text-black outline-none focus:border-[var(--brand-blue)]"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
                      Extra Cost (Rp)
                      <input
                        name="extraCost"
                        type="number"
                        min={0}
                        step={1000}
                        placeholder="0"
                        className="rounded-lg border border-black/15 px-3 py-2 text-sm font-normal text-black outline-none focus:border-[var(--brand-blue)]"
                      />
                    </label>
                  </>
                ) : null}
              </div>
            ))}
          </div>
          <p className="text-xs text-black/50">
            Semua honor & komponen harga modal di atas bisa diubah lagi nanti dari halaman detail pesanan (tab
            &quot;Riwayat Tahap &amp; Catatan&quot;).
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-xl border border-black/10 p-3.5">
          <div>
            <h2 className="font-heading text-sm font-semibold">Foto Desain Pisau (wajib, minimal 1 foto)</h2>
            <p className="text-xs text-black/55">
              Foto ini akan terlihat langsung oleh SEMUA divisi/vendor yang mengerjakan pesanan ini (tidak dibatasi
              per tahap seperti lampiran biasa) — tujuannya menyamakan pemahaman semua tim mengenai desain pisau
              yang dimaksud sebelum mulai bekerja.
            </p>
          </div>
          <DesignPhotoInput min={1} />
        </div>

        <div className="flex flex-col gap-2 rounded-lg bg-black/[0.03] p-3.5">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isCustom" className="h-4 w-4" />
            Pesanan custom (perlu approval admin/sales sebelum masuk produksi)
          </label>
          <textarea
            name="approvalNote"
            placeholder="Catatan alasan custom, misalnya desain ukiran non-standar…"
            className="min-h-20 rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-[var(--brand-blue)]"
          />
        </div>

        <SubmitButton
          pendingText="Menyimpan Pesanan…"
          className="w-fit rounded-lg bg-[var(--brand-blue)] px-5 py-2.5 text-sm font-semibold text-white"
        >
          Buat Pesanan
        </SubmitButton>
      </form>
    </div>
  );
}

function Field({
  name,
  label,
  type = 'text',
  required = false,
  placeholder,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="rounded-lg border border-black/15 px-3 py-2 text-sm font-normal text-black outline-none focus:border-[var(--brand-blue)]"
      />
    </label>
  );
}
