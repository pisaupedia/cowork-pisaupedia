import Link from 'next/link';
import type { OrderCardView } from '@/lib/view';
import { ConfirmDeleteButton } from '@/components/confirm-delete-button';

export function OrderCard({
  card,
  showProgress = false,
  archiveAction,
  deleteAction,
  from,
  stagePill,
  costEditor,
}: {
  card: OrderCardView;
  showProgress?: boolean;
  /** Halaman asal kartu ini (dashboard/kanban/kalender) — diteruskan lewat
   * query string `?from=` supaya tombol "Kembali" di halaman detail pesanan
   * mengarah balik ke sini, bukan selalu ke Dashboard. Lihat pemakaiannya di
   * src/app/(app)/orders/[id]/page.tsx. */
  from?: 'dashboard' | 'kanban' | 'kalender';
  /** Server Action untuk tombol "Arsipkan" — hanya diteruskan dari halaman
   * Kanban, untuk kartu admin-only di kolom "Selesai Produksi" yang sudah
   * selesai penuh. Ditaruh sebagai sibling dari <Link>, bukan di dalamnya,
   * supaya tidak ada <button> bersarang di dalam <a> (invalid & klik tombol
   * akan ikut memicu navigasi kalau digabung). */
  archiveAction?: (formData: FormData) => Promise<void>;
  /** Server Action untuk tombol "Hapus" — penghapusan permanen pesanan ini
   * beserta seluruh tahap/catatan/lampiran/foto desainnya. Hanya diteruskan
   * dari tempat yang memang boleh menghapus (saat ini: daftar "Perlu
   * Perhatian" di Dashboard, admin-only) — vendor tidak pernah melihat
   * tombol ini karena halamannya tidak meneruskan prop ini sama sekali. */
  deleteAction?: (formData: FormData) => Promise<void>;
  /** Pill kecil di sebelah kiri badge deadline, menandai status tahap yang
   * sedang berjalan/berikutnya ("Berjalan"/"Menunggu") — dipakai di panel
   * Perlu Perhatian Dashboard supaya bisa dibedakan sekilas dari kartu yang
   * masih menunggu tahap sebelumnya. Opsional; kartu di kanban/kalender
   * tidak memakainya karena kolomnya sendiri sudah menunjukkan divisi. */
  stagePill?: { label: string; tone: 'berjalan' | 'menunggu' };
  /** Konten tambahan (form edit honor & harga modal langsung di kartu, lihat
   * StageCostQuickEdit) yang dirender di bawah info utama, sebelum baris
   * tombol arsipkan/hapus. Opsional — hanya dipakai dari Dashboard admin. */
  costEditor?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-black/10 bg-white p-3 transition hover:border-[var(--brand-blue)] hover:shadow-sm">
      <Link href={from ? `/orders/${card.id}?from=${from}` : `/orders/${card.id}`} className="flex gap-3">
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
            <span className="flex flex-shrink-0 items-center gap-1.5">
              {stagePill ? (
                <span
                  className={
                    'rounded-full px-2 py-0.5 text-[10.5px] font-semibold ' +
                    (stagePill.tone === 'berjalan'
                      ? 'bg-[var(--brand-blue)]/10 text-[var(--brand-blue)]'
                      : 'bg-black/[0.06] text-black/45')
                  }
                >
                  {stagePill.label}
                </span>
              ) : null}
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{ background: card.badgeBg, color: card.badgeFg }}
              >
                {card.badgeLabel}
              </span>
            </span>
          </div>
          <div className="text-xs text-black/55">{card.subtitle}</div>
          {showProgress ? (
            <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
              <div className="h-full rounded-full bg-[var(--brand-blue)]" style={{ width: `${card.progress}%` }} />
            </div>
          ) : null}
          <div className="text-[11px] text-black/55">{card.vendorTag}</div>
        </div>
      </Link>
      {costEditor}
      {archiveAction || deleteAction ? (
        <div className="flex items-center justify-end gap-2">
          {archiveAction ? (
            <form action={archiveAction} className="flex-1">
              <input type="hidden" name="orderId" value={card.id} />
              <button
                type="submit"
                className="w-full rounded-md border border-black/15 py-1 text-[11px] font-semibold text-black/60 hover:border-[var(--brand-blue)] hover:text-[var(--brand-blue)]"
              >
                🗄 Arsipkan
              </button>
            </form>
          ) : null}
          {deleteAction ? (
            // Sengaja dibuat kecil & rata kanan-bawah (bukan selebar kartu seperti
            // tombol Arsipkan) — ini tombol destruktif yang cukup sering dipakai
            // tapi tidak perlu menonjol di setiap kartu daftar "Perlu Perhatian".
            <form action={deleteAction}>
              <input type="hidden" name="orderId" value={card.id} />
              <ConfirmDeleteButton
                label="🗑 Hapus"
                triggerClassName="rounded-md border border-red-200 px-2.5 py-1 text-[10px] font-semibold text-red-600 hover:border-red-400"
                title="Hapus Pesanan"
                description={`Pesanan "${card.kode}" beserta seluruh tahap, catatan, lampiran, dan foto desainnya akan dihapus permanen.`}
              />
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
