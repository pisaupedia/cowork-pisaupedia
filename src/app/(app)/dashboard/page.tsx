import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { buildDashboard, listPendingApprovalOrders } from '@/lib/view';
import { OrderCard } from '@/components/order-card';

export default async function DashboardPage() {
  const user = await requireUser();
  const dash = buildDashboard(user);
  const pendingCount = user.role === 'ADMIN' ? listPendingApprovalOrders().length : 0;

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
          <h2 className="font-heading text-[15px] font-semibold">Perlu Perhatian</h2>
          {dash.attention.length === 0 ? (
            <p className="text-sm text-[oklch(0.5_0.09_142)]">Semua pesanan dalam kondisi aman.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {dash.attention.map((c) => (
                <OrderCard key={c.id} card={c} />
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 rounded-xl border border-black/10 bg-white p-5">
          <h2 className="font-heading text-[15px] font-semibold">Distribusi per Divisi</h2>
          {dash.divisiCounts.map((d) => (
            <div key={d.name} className="flex flex-col gap-1">
              <div className="flex justify-between text-xs text-black/60">
                <span>{d.name}</span>
                <span className="font-semibold">{d.count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]">
                <div className="h-full rounded-full bg-[var(--brand-blue)]" style={{ width: `${d.barWidth}%` }} />
              </div>
            </div>
          ))}
        </div>
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
