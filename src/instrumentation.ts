// Hook bawaan Next.js — `register()` di sini dipanggil TEPAT SEKALI saat
// proses server pertama kali start (di runtime Node.js; App Router juga bisa
// jalan di runtime Edge yang tidak relevan untuk backup file lokal, jadi
// sengaja dilewati). Dipakai untuk menyalakan scheduler backup otomatis
// database — lihat src/lib/scheduler.ts & src/lib/backup.ts.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startBackupScheduler } = await import('@/lib/scheduler');
    startBackupScheduler();
  }
}
