import { runAutoBackup } from '@/lib/backup';

// Backup otomatis berjalan DI DALAM proses server Next.js yang sama (bukan
// cron OS terpisah) — cocok untuk aplikasi self-hosted seperti ini yang
// prosesnya memang dimaksudkan untuk terus berjalan. Konsekuensinya: backup
// hanya jalan selama proses servernya hidup — kalau server dimatikan lebih
// dari sehari, backup otomatis akan "telat" sampai server dinyalakan lagi
// (bukan masalah besar untuk aplikasi internal yang biasanya jalan terus).
const INTERVAL_MS = 24 * 60 * 60 * 1000; // sehari sekali
const FIRST_RUN_DELAY_MS = 60 * 1000; // 1 menit setelah server start — beri waktu server "settle" dulu

declare global {
  // eslint-disable-next-line no-var
  var __pisauBackupScheduler: NodeJS.Timeout | undefined;
}

function safeRunAutoBackup(): void {
  try {
    runAutoBackup();
    // eslint-disable-next-line no-console -- sengaja dicatat di log server supaya ada jejak backup otomatis berjalan
    console.log('[pisau-app] Backup otomatis berhasil dijalankan.');
  } catch (err) {
    // eslint-disable-next-line no-console -- backup gagal TIDAK boleh mematikan server, tapi harus terlihat di log
    console.error('[pisau-app] Backup otomatis GAGAL:', err);
  }
}

/** Dipanggil sekali dari src/instrumentation.ts saat proses server Next.js
 * ini pertama kali start. Di-cache lewat globalThis (pola yang sama seperti
 * src/lib/db.ts) supaya reload modul di mode dev tidak membuat banyak
 * interval berjalan bertumpuk. */
export function startBackupScheduler(): void {
  if (globalThis.__pisauBackupScheduler) return; // sudah berjalan

  const timer = setTimeout(() => {
    safeRunAutoBackup();
    globalThis.__pisauBackupScheduler = setInterval(safeRunAutoBackup, INTERVAL_MS);
  }, FIRST_RUN_DELAY_MS);

  // Supaya timer awal ini juga tercatat (dan tidak mengganjal proses exit di skrip singkat/test).
  globalThis.__pisauBackupScheduler = timer;
}
