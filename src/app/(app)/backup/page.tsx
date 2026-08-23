import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { getDbStats } from '@/lib/backup';
import { restoreBackupAction } from './actions';

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

const ERROR_MESSAGES: Record<string, string> = {
  confirm: 'Kamu harus mencentang kotak konfirmasi sebelum memulihkan database.',
  nofile: 'Belum ada file yang dipilih untuk dipulihkan.',
};

export default async function BackupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; msg?: string }>;
}) {
  const user = await requireUser();
  if (user.role !== 'ADMIN') redirect('/dashboard');

  const { error, msg } = await searchParams;
  const errorText = error === 'invalid' ? (msg ?? 'File tidak valid.') : error ? ERROR_MESSAGES[error] : null;

  const stats = getDbStats();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-xl font-semibold">Backup &amp; Restore Database</h1>
        <p className="text-sm text-black/55">
          Cadangkan dan pulihkan data pesanan, vendor, pengguna, honor, dan dokumen invoice — semuanya tersimpan
          dalam satu file database SQLite.
        </p>
      </div>

      {errorText ? (
        <div className="rounded-lg bg-[var(--status-terlambat-bg)] px-3.5 py-2.5 text-sm text-[var(--status-terlambat-fg)]">
          {errorText}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-xl border border-black/10 bg-white p-5">
        <h2 className="font-heading text-sm font-semibold">Status Database Saat Ini</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Ukuran File" value={formatBytes(stats.sizeBytes)} />
          <Stat label="Pesanan" value={String(stats.counts.orders)} />
          <Stat label="Vendor" value={String(stats.counts.vendors)} />
          <Stat label="Dokumen Invoice" value={String(stats.counts.documents)} />
        </div>
        <div className="text-xs text-black/50">Terakhir diubah: {formatTimestamp(stats.modifiedAt)}</div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-black/10 bg-white p-5">
        <h2 className="font-heading text-sm font-semibold">Unduh Backup</h2>
        <p className="text-sm text-black/55">
          Mengunduh salinan lengkap database saat ini sebagai satu file <code>.db</code>. Simpan file ini di tempat
          aman (Google Drive, laptop pribadi, dll.) secara rutin.
        </p>
        <a
          href="/api/backup/download"
          className="w-fit rounded-lg bg-[var(--brand-blue)] px-4 py-2 text-sm font-semibold text-white"
        >
          ⬇ Unduh Backup Database
        </a>
        <p className="text-xs text-black/45">
          Catatan: file ini hanya berisi data (pesanan, vendor, pengguna, honor, invoice, dll.) — foto &amp; dokumen
          lampiran yang diunggah vendor tersimpan terpisah di folder <code>uploads/</code> di server dan{' '}
          <strong>tidak</strong> ikut ada di dalam file backup ini.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-[var(--brand-red)]/30 bg-white p-5">
        <h2 className="font-heading text-sm font-semibold text-[var(--brand-red)]">Pulihkan dari Backup</h2>
        <div className="rounded-lg bg-[var(--status-terlambat-bg)] px-3.5 py-2.5 text-sm text-[var(--status-terlambat-fg)]">
          <strong>Peringatan:</strong> memulihkan database akan{' '}
          <strong>mengganti SELURUH data yang ada saat ini</strong> (semua pesanan, vendor, pengguna, honor,
          dokumen invoice yang dibuat setelah file backup ini) dengan isi file yang diunggah. Tindakan ini{' '}
          <strong>tidak bisa dibatalkan dari aplikasi</strong> — server otomatis menyimpan satu salinan pengaman dari
          database saat ini sebelum ditimpa, tapi tetap disarankan mengunduh backup terbaru dulu sebelum memulihkan
          file lain. Setelah proses ini selesai, semua orang yang sedang login (termasuk kamu) akan diminta login
          ulang.
        </div>
        <form action={restoreBackupAction} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
            File Backup (.db)
            <input
              type="file"
              name="file"
              accept=".db,.sqlite,.sqlite3"
              required
              className="rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-[var(--brand-blue)]"
            />
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="confirm" required className="mt-0.5 h-4 w-4" />
            Saya paham tindakan ini akan mengganti seluruh data saat ini dan tidak bisa dibatalkan.
          </label>
          <button
            type="submit"
            className="w-fit rounded-lg bg-[var(--brand-red)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-red-dark)]"
          >
            Pulihkan Database Sekarang
          </button>
        </form>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-black/[0.03] p-3">
      <div className="text-base font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-black/50">{label}</div>
    </div>
  );
}
