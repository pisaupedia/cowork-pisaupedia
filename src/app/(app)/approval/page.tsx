import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { listPendingApprovalOrders, listApprovalHistory } from '@/lib/view';
import { formatTanggal, formatRupiah } from '@/lib/derive';
import { SubmitButton } from '@/components/submit-button';
import { approveOrderAction, rejectOrderAction } from './actions';

export default async function ApprovalPage() {
  const user = await requireUser();
  if (user.role !== 'ADMIN') redirect('/dashboard');

  const pending = listPendingApprovalOrders();
  const history = listApprovalHistory();

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-xl font-semibold">Persetujuan Pesanan Baru</h1>
        <p className="text-sm text-black/55">
          Pesanan (terutama pesanan custom) perlu dikonfirmasi admin/sales sebelum resmi masuk ke Cutting &amp; Blacksmith.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-black/10 bg-white p-5">
        <h2 className="font-heading text-sm font-semibold">Menunggu Approval ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-[oklch(0.5_0.09_142)]">Tidak ada pesanan yang menunggu approval saat ini.</p>
        ) : (
          pending.map((o) => (
            <div key={o.id} className="flex flex-col gap-2 rounded-lg border border-[oklch(0.88_0.05_65)] bg-[oklch(0.98_0.02_65)] p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-heading text-[15px] font-semibold">{o.kode}</div>
                  <div className="text-xs text-black/55">
                    {o.jenis} · {o.pelanggan} · {o.jumlah} unit · {formatRupiah(o.harga)}
                  </div>
                </div>
                <span className="rounded-full bg-[oklch(0.93_0.05_65)] px-2.5 py-1 text-[11px] font-semibold text-[oklch(0.42_0.1_65)]">
                  Pesanan Custom
                </span>
              </div>
              {o.approval_note ? (
                <p className="rounded-lg bg-white p-2 text-xs text-[oklch(0.45_0.09_65)]">{o.approval_note}</p>
              ) : null}
              <div className="flex flex-wrap gap-4 text-xs text-black/55">
                <span>Masuk: {formatTanggal(o.tanggal_masuk)}</span>
                <span>Deadline: {formatTanggal(o.deadline)}</span>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                <form action={approveOrderAction}>
                  <input type="hidden" name="orderId" value={o.id} />
                  <SubmitButton
                    pendingText="Menyetujui…"
                    className="w-full rounded-md bg-[oklch(0.5_0.12_142)] px-3.5 py-2 text-xs font-semibold text-white sm:w-auto"
                  >
                    Setujui
                  </SubmitButton>
                </form>
                <form action={rejectOrderAction} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                  <input type="hidden" name="orderId" value={o.id} />
                  <input
                    type="text"
                    name="alasan"
                    required
                    placeholder="Alasan penolakan (wajib diisi)…"
                    className="w-full rounded-md border border-black/15 bg-white px-2.5 py-2 text-xs outline-none focus:border-[var(--brand-blue)] sm:w-56"
                  />
                  <SubmitButton
                    pendingText="Menolak…"
                    className="w-full rounded-md border border-[oklch(0.75_0.15_25)] bg-white px-3.5 py-2 text-xs font-semibold text-[oklch(0.42_0.14_25)] sm:w-auto"
                  >
                    Tolak
                  </SubmitButton>
                </form>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-black/10 bg-white p-5">
        <h2 className="font-heading text-sm font-semibold">Riwayat Keputusan</h2>
        {history.length === 0 ? (
          <p className="text-sm text-black/55">Belum ada keputusan approval.</p>
        ) : (
          history.map((o) => (
            <div
              key={o.id}
              className="flex flex-col gap-2 rounded-lg px-3 py-2 hover:bg-black/[0.02] sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="font-heading text-[13px] font-semibold">{o.kode}</div>
                <div className="text-xs text-black/55">
                  {o.jenis} · {o.pelanggan}
                </div>
                {o.approval_status === 'DITOLAK' && o.reject_reason ? (
                  <div className="mt-0.5 text-xs italic text-[oklch(0.42_0.14_25)]">Alasan: {o.reject_reason}</div>
                ) : null}
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                {o.approval_status === 'DITOLAK' ? (
                  <Link
                    href={`/orders/${o.id}/edit`}
                    className="rounded-md border border-black/15 px-2.5 py-1 text-[11px] font-semibold text-[var(--brand-blue)] hover:border-[var(--brand-blue)]"
                  >
                    Revisi &amp; Ajukan Ulang
                  </Link>
                ) : null}
                <span
                  className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                  style={
                    o.approval_status === 'DISETUJUI'
                      ? { background: 'oklch(0.94 0.045 142)', color: 'oklch(0.36 0.09 142)' }
                      : { background: 'oklch(0.94 0.06 25)', color: 'oklch(0.42 0.14 25)' }
                  }
                >
                  {o.approval_status === 'DISETUJUI' ? 'Disetujui' : 'Ditolak'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
