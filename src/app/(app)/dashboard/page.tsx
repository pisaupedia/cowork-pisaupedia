import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { buildDashboard, buildVendorHonorSummary, listPendingApprovalOrders } from '@/lib/view';
import { OrderCard } from '@/components/order-card';
import { DIVISION_COLORS } from '@/lib/constants';
import { deleteOrderAction } from './actions';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  const dash = buildDashboard(user);
  const pendingCount = user.role === 'ADMIN' ? listPendingApprovalOrders().length : 0;
  const { q } = await searchParams;
  const query = q?.trim().toLowerCase();
  const attention = query
    ? dash.attention.filter((c) => c.kode.toLowerCase().includes(query) || c.subtitle.toLowerCase().includes(query))
    : dash.attention;

  // Panel "Distribusi per Divisi" kurang berguna untuk vendor yang cuma
  // bekerja di satu divisi — hampir semua baris akan tampil 0, jadi panel
  // itu diganti ringkasan honor vendor tersebut untuk mereka. Admin/owner
  // (yang butuh melihat semua divisi) selalu melihat panel distribusi
  // seperti biasa.
  const nonZeroDivisions = dash.divisiCounts.filter((d) => d.count > 0).length;
  const showDivisiPanel = user.role !== 'VENDOR' || nonZeroDivisions > 1;
  const vendorHonor = !showDivisiPanel && user.vendorId ? buildVendorHonorSummary(user.vendorId) : null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-xl font-semibold">Dashboard</h1>

      {pendingCount > 0 ? (
        <Link
          href="/approval"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[oklch(0.85_0.05_65)] bg-[oklch(0.96_0.03_65)] px-4 py-3 text-sm text-[oklch(0.4_0.09_65)]"
        >
          <span>
            <strong>{pendingCount} pesanan</strong> menunggu approval sebelum resmi masuk produksi.
          </span>
          <span className="font-semibold">Tinjau &rarr;</span>
        </Link>
      ) : null}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Pesanan Aktif" value={dash.statTotal} />
        <StatCard label="Mendekati Deadline" value={dash.statMendekati} color="oklch(0.55 0.14 65)" />
        <StatCard label="Terlambat" value={dash.statTerlambat} color="oklch(0.5 0.17 25)" />
        <StatCard label="Selesai Produksi" value={dash.statSelesaiProduksi} color="oklch(0.5 0.12 142)" />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-3 rounded-xl border border-black/10 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-heading text-[15px] font-semibold">Perlu Perhatian</h2>
            <form method="get" className="flex items-center gap-2">
              <input
                type="search"
                name="q"
                defaultValue={q ?? ''}
                placeholder="Cari kode / nama…"
                className="w-40 rounded-md border border-black/15 px-2.5 py-1.5 text-xs outline-none focus:border-[var(--brand-blue)] sm:w-56"
              />
              <button type="submit" className="rounded-md border border-black/15 px-2.5 py-1.5 text-xs font-semibold text-black/60">
                Cari
              </button>
            </form>
          </div>
          {dash.attention.length === 0 ? (
            <p className="text-sm text-black/55">Belum ada pesanan aktif.</p>
          ) : attention.length === 0 ? (
            <p className="text-sm text-black/55">Tidak ada pesanan yang cocok dengan pencarian &quot;{q}&quot;.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {attention.map((c) => (
                <OrderCard
                  key={c.id}
                  card={c}
                  from="dashboard"
                  deleteAction={user.role === 'ADMIN' ? deleteOrderAction : undefined}
                />
              ))}
            </div>
          )}
        </div>

        {showDivisiPanel ? (
          <div className="flex flex-col gap-4 rounded-xl border border-black/10 bg-white p-5">
            <h2 className="font-heading text-[15px] font-semibold">Distribusi per Divisi</h2>
            {dash.divisiCounts.map((d) => (
              <div key={d.name} className="flex flex-col gap-1">
                <div className="flex justify-between text-xs" style={{ color: DIVISION_COLORS[d.name] }}>
                  <span className="font-semibold">{d.name}</span>
                  <span className="font-semibold">{d.count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${d.barWidth}%`, background: DIVISION_COLORS[d.name] }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : vendorHonor ? (
          <div className="flex flex-col gap-3 rounded-xl border border-black/10 bg-white p-5">
            <h2 className="font-heading text-[15px] font-semibold">Ringkasan Honor Anda</h2>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-black/55">Sudah Dibayarkan (semua tahap)</span>
              <span className="text-lg font-semibold">{vendorHonor.totalDibayarLabel}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-black/55">Belum Dibayarkan</span>
              <span className="text-lg font-semibold" style={{ color: 'var(--status-terlambat-fg)' }}>
                {vendorHonor.totalSisaLabel}
              </span>
            </div>
            <p className="text-xs text-black/55">{vendorHonor.jumlahTahapAktif} tahap sedang berjalan/menunggu.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-black/10 bg-white p-4">
      <span className="text-xs text-black/55">{label}</span>
      <span className="font-heading text-2xl font-semibold" style={color ? { color } : undefined}>
        {value}
      </span>
    </div>
  );
}
