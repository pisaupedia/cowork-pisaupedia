import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { getOrderById } from '@/lib/repo/orders';
import { SubmitButton } from '@/components/submit-button';
import { updateOrderAction } from '../actions';
import { resubmitOrderAction } from '@/app/(app)/approval/actions';

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user.role !== 'ADMIN') redirect('/dashboard');

  const { id } = await params;
  const order = getOrderById(id);
  if (!order) notFound();

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <Link href={`/orders/${id}`} className="flex w-fit items-center gap-1 text-sm font-semibold text-black/60">
        &larr; Kembali ke {order.kode}
      </Link>

      <div>
        <h1 className="font-heading text-xl font-semibold">Edit Pesanan {order.kode}</h1>
        <p className="text-sm text-black/55">
          Perbaiki data dasar pesanan ini — kode pesanan, status approval, penugasan vendor, dan honor/harga modal
          punya jalur editnya sendiri (lihat halaman detail pesanan) dan tidak diubah dari sini.
        </p>
      </div>

      {order.approval_status === 'DITOLAK' ? (
        <div className="flex flex-col gap-2 rounded-xl border border-[oklch(0.75_0.15_25)] bg-[var(--status-terlambat-bg)] p-4 text-sm text-[var(--status-terlambat-fg)]">
          <p>
            <strong>Pesanan ini ditolak</strong>
            {order.reject_reason ? <>: {order.reject_reason}</> : '.'} Perbaiki data di bawah lalu ajukan ulang untuk
            ditinjau kembali.
          </p>
          <form action={resubmitOrderAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="orderId" value={order.id} />
            <label className="flex flex-grow flex-col gap-1 text-xs font-medium">
              Catatan revisi untuk admin/sales (opsional)
              <input
                name="approvalNote"
                defaultValue={order.approval_note ?? ''}
                placeholder="Jelaskan apa yang sudah direvisi…"
                className="rounded-md border border-black/15 bg-white px-2.5 py-1.5 text-sm font-normal text-black outline-none focus:border-[var(--brand-blue)]"
              />
            </label>
            <SubmitButton
              pendingText="Mengajukan…"
              className="rounded-md bg-[var(--brand-blue)] px-3.5 py-2 text-xs font-semibold text-white"
            >
              Ajukan Ulang
            </SubmitButton>
          </form>
        </div>
      ) : null}

      <form action={updateOrderAction} className="flex flex-col gap-4 rounded-xl border border-black/10 bg-white p-5">
        <input type="hidden" name="orderId" value={order.id} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field name="jenis" label="Jenis Pisau" defaultValue={order.jenis} required />
          <Field name="pelanggan" label="Nama Pelanggan" defaultValue={order.pelanggan} required />
          <Field name="kontak" label="Kontak Pelanggan" defaultValue={order.kontak ?? ''} />
          <Field name="jumlah" label="Jumlah Unit" type="number" defaultValue={String(order.jumlah)} required />
          <Field name="harga" label="Harga Jual (Rp)" type="number" defaultValue={String(order.harga)} required />
          <Field name="tanggalMasuk" label="Tanggal Masuk" type="date" defaultValue={order.tanggal_masuk.slice(0, 10)} required />
          <Field name="deadline" label="Deadline" type="date" defaultValue={order.deadline.slice(0, 10)} required />
        </div>
        <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
          Catatan / Rincian Pekerjaan
          <textarea
            name="catatan"
            defaultValue={order.catatan ?? ''}
            className="min-h-20 rounded-lg border border-black/15 px-3 py-2 text-sm font-normal text-black outline-none focus:border-[var(--brand-blue)]"
          />
        </label>
        <SubmitButton
          pendingText="Menyimpan…"
          className="w-fit rounded-lg bg-[var(--brand-blue)] px-5 py-2.5 text-sm font-semibold text-white"
        >
          Simpan Perubahan
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
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="rounded-lg border border-black/15 px-3 py-2 text-sm font-normal text-black outline-none focus:border-[var(--brand-blue)]"
      />
    </label>
  );
}
