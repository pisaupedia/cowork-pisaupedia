import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { buildVendorArchiveStats, buildArchivedOrdersList } from '@/lib/view';
import { ConfirmDeleteButton } from '@/components/confirm-delete-button';
import { unarchiveOrderAction } from './actions';
import { deleteOrderAction } from '../dashboard/actions';

export default async function ArsipPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; dari?: string; sampai?: string }>;
}) {
  const user = await requireUser();
  if (user.role !== 'ADMIN') redirect('/dashboard');

  const { q, dari, sampai } = await searchParams;
  const vendorStats = buildVendorArchiveStats();
  const archived = buildArchivedOrdersList({ q, dateFrom: dari, dateTo: sampai });
  const hasFilter = !!(q || dari || sampai);
  const exportQuery = new URLSearchParams();
  if (q) exportQuery.set('q', q);
  if (dari) exportQuery.set('dari', dari);
  if (sampai) exportQuery.set('sampai', sampai);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-xl font-semibold">Arsip Pekerjaan Selesai</h1>
        <p className="text-sm text-black/55">
          Pesanan yang sudah selesai penuh dan sudah diarsipkan admin dari papan Kanban (kolom &quot;Selesai
          Produksi&quot;) — datanya tidak dihapus, hanya disembunyikan dari dashboard/kanban/kalender supaya tidak
          menumpuk.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-black/10 bg-white p-5">
        <div>
          <h2 className="font-heading text-sm font-semibold">Statistik Pembayaran Vendor</h2>
          <p className="text-xs text-black/55">
            Dihitung HANYA dari pesanan yang sudah diarsipkan di bawah — bukan dari seluruh pesanan yang pernah ada.
          </p>
        </div>
        <a
          href="/api/export/vendor-stats"
          className="w-fit rounded-md border border-black/15 px-2.5 py-1 text-xs font-semibold text-black/60 hover:border-[var(--brand-blue)] hover:text-[var(--brand-blue)]"
        >
          ⬇ Export CSV
        </a>
        {vendorStats.length === 0 ? (
          <p className="text-xs italic text-black/55">Belum ada vendor eksternal.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-black/10 text-xs text-black/50">
                  <th className="py-2 pr-3 font-medium">Vendor</th>
                  <th className="py-2 pr-3 font-medium">Jumlah Pesanan</th>
                  <th className="py-2 pr-3 font-medium">Sudah Dibayar</th>
                  <th className="py-2 pr-3 font-medium">Belum Dibayar</th>
                </tr>
              </thead>
              <tbody>
                {vendorStats.map((v) => (
                  <tr key={v.vendorId} className="border-b border-black/5">
                    <td className="py-2 pr-3 font-medium">{v.vendorNama}</td>
                    <td className="py-2 pr-3 tabular-nums">{v.jumlahPesanan}</td>
                    <td className="py-2 pr-3 tabular-nums">{v.totalSudahDibayarLabel}</td>
                    <td className="py-2 pr-3 tabular-nums text-black/55">{v.totalBelumDibayarLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-black/10 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="font-heading text-sm font-semibold">Pesanan yang Diarsipkan ({archived.length})</h2>
          <a
            href={`/api/export/arsip${exportQuery.toString() ? `?${exportQuery.toString()}` : ''}`}
            className="rounded-md border border-black/15 px-2.5 py-1 text-xs font-semibold text-black/60 hover:border-[var(--brand-blue)] hover:text-[var(--brand-blue)]"
          >
            ⬇ Export CSV{hasFilter ? ' (sesuai filter)' : ''}
          </a>
        </div>

        <form
          method="get"
          className="flex flex-col gap-2 rounded-lg bg-black/[0.03] p-3 sm:flex-row sm:flex-wrap sm:items-end"
        >
          <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-black/60 sm:min-w-[160px]">
            Cari (kode / pelanggan)
            <input
              type="search"
              name="q"
              defaultValue={q ?? ''}
              placeholder="misalnya: Golok-003 atau nama pelanggan…"
              className="rounded-md border border-black/15 bg-white px-2.5 py-1.5 text-sm font-normal text-black outline-none focus:border-[var(--brand-blue)]"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
            Diarsipkan Dari
            <input
              type="date"
              name="dari"
              defaultValue={dari ?? ''}
              className="rounded-md border border-black/15 bg-white px-2.5 py-1.5 text-sm font-normal text-black outline-none focus:border-[var(--brand-blue)]"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
            Sampai
            <input
              type="date"
              name="sampai"
              defaultValue={sampai ?? ''}
              className="rounded-md border border-black/15 bg-white px-2.5 py-1.5 text-sm font-normal text-black outline-none focus:border-[var(--brand-blue)]"
            />
          </label>
          <div className="flex gap-2">
            <button type="submit" className="rounded-md bg-[var(--brand-blue)] px-3.5 py-2 text-xs font-semibold text-white">
              Filter
            </button>
            {hasFilter ? (
              <Link href="/arsip" className="rounded-md border border-black/15 px-3.5 py-2 text-xs font-semibold text-black/60">
                Reset
              </Link>
            ) : null}
          </div>
        </form>

        {archived.length === 0 ? (
          <p className="text-xs italic text-black/55">
            {hasFilter ? (
              'Tidak ada pesanan diarsipkan yang cocok dengan filter ini.'
            ) : (
              <>
                Belum ada pesanan yang diarsipkan. Arsipkan pesanan yang sudah selesai penuh lewat tombol
                &quot;🗄 Arsipkan&quot; di halaman{' '}
                <Link href="/kanban" className="font-medium text-[var(--brand-blue)]">
                  Papan Kanban
                </Link>
                , kolom &quot;Selesai Produksi&quot;.
              </>
            )}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {archived.map((o) => (
              <div
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black/10 px-3 py-2.5"
              >
                <div>
                  <div className="text-sm font-semibold">{o.kode}</div>
                  <div className="text-xs text-black/55">
                    {o.jenis} · {o.pelanggan} · {o.jumlah} unit
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-black/55">Diarsipkan: {o.archivedAtLabel}</span>
                  <Link
                    href={`/orders/${o.id}?from=arsip`}
                    className="rounded-md border border-black/15 px-2.5 py-1 text-xs font-semibold hover:border-[var(--brand-blue)]"
                  >
                    Lihat Detail
                  </Link>
                  <form action={unarchiveOrderAction}>
                    <input type="hidden" name="orderId" value={o.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-black/15 px-2.5 py-1 text-xs font-semibold text-black/60 hover:border-[var(--brand-blue)] hover:text-[var(--brand-blue)]"
                    >
                      Batalkan Arsip
                    </button>
                  </form>
                  <form action={deleteOrderAction}>
                    <input type="hidden" name="orderId" value={o.id} />
                    <ConfirmDeleteButton
                      label="Hapus Permanen"
                      triggerClassName="rounded-md border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:border-red-400"
                      title="Hapus Pesanan"
                      description={`Pesanan "${o.kode}" beserta seluruh tahap, catatan, lampiran, riwayat pembayaran honor, dan foto desainnya akan dihapus permanen — tidak bisa dikembalikan.`}
                    />
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
