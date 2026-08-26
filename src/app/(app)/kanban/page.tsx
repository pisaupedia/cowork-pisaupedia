import { requireUser } from '@/lib/session';
import { buildKanban } from '@/lib/view';
import { OrderCard } from '@/components/order-card';
import { DIVISION_COLORS } from '@/lib/constants';
import { archiveOrderAction } from '@/app/(app)/arsip/actions';

export default async function KanbanPage() {
  const user = await requireUser();
  const columns = buildKanban(user);
  const canArchive = user.role === 'ADMIN';

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-xl font-semibold">Papan Kanban</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {columns.map((col) => (
          <div key={col.name} className="flex flex-col gap-2 rounded-xl bg-black/[0.04] p-3">
            <div className="flex items-center justify-between">
              <span
                className="font-heading text-[13px] font-semibold uppercase tracking-wide"
                style={{ color: DIVISION_COLORS[col.name] }}
              >
                {col.name}
              </span>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-black/55">
                {col.orders.length}
              </span>
            </div>
            {col.orders.length === 0 ? (
              <p className="p-2 text-center text-xs text-black/55">
                {user.role === 'VENDOR' ? 'Tidak ada pekerjaan Anda di divisi ini.' : 'Belum ada pesanan di divisi ini.'}
              </p>
            ) : (
              col.orders.map((c) => (
                <OrderCard
                  key={c.id}
                  card={c}
                  showProgress
                  from="kanban"
                  archiveAction={canArchive && col.name === 'Selesai Produksi' && c.isFullyComplete ? archiveOrderAction : undefined}
                />
              ))
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
