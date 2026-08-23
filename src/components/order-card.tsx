import Link from 'next/link';
import type { OrderCardView } from '@/lib/view';

export function OrderCard({
  card,
  showProgress = false,
  archiveAction,
}: {
  card: OrderCardView;
  showProgress?: boolean;
  /** Server Action untuk tombol "Arsipkan" — hanya diteruskan dari halaman
   * Kanban, untuk kartu admin-only di kolom "Selesai Produksi" yang sudah
   * selesai penuh. Ditaruh sebagai sibling dari <Link>, bukan di dalamnya,
   * supaya tidak ada <button> bersarang di dalam <a> (invalid & klik tombol
   * akan ikut memicu navigasi kalau digabung). */
  archiveAction?: (formData: FormData) => Promise<void>;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-black/10 bg-white p-3 transition hover:border-[var(--brand-blue)] hover:shadow-sm">
      <Link href={`/orders/${card.id}`} className="flex gap-3">
        {card.thumbUrl ? (
          <div className="relative flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- gambar disajikan dari endpoint lokal ber-RLS, bukan aset statis/eksternal */}
            <img
              src={card.thumbUrl}
              alt={`Foto desain ${card.kode}`}
              className="h-14 w-14 rounded-lg border border-black/10 object-cover"
            />
            {card.designPhotoCount > 1 ? (
              <span className="absolute -bottom-1 -right-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                +{card.designPhotoCount - 1}
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-heading text-sm font-semibold">{card.kode}</span>
            <span
              className="flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{ background: card.badgeBg, color: card.badgeFg }}
            >
              {card.badgeLabel}
            </span>
          </div>
          <div className="text-xs text-black/55">{card.subtitle}</div>
          {showProgress ? (
            <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
              <div className="h-full rounded-full bg-[var(--brand-blue)]" style={{ width: `${card.progress}%` }} />
            </div>
          ) : null}
          <div className="text-[11px] text-black/45">{card.vendorTag}</div>
        </div>
      </Link>
      {archiveAction ? (
        <form action={archiveAction}>
          <input type="hidden" name="orderId" value={card.id} />
          <button
            type="submit"
            className="w-full rounded-md border border-black/15 py-1 text-[11px] font-semibold text-black/60 hover:border-[var(--brand-blue)] hover:text-[var(--brand-blue)]"
          >
            🗄 Arsipkan
          </button>
        </form>
      ) : null}
    </div>
  );
}
