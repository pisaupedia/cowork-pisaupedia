import { isSeeded, runSeed } from '@/lib/seed';

let seeded = false;

/** Dipanggil dari root layout supaya database berisi data contoh saat pertama kali dijalankan. */
export function ensureSeeded(): void {
  if (seeded) return;
  if (!isSeeded()) runSeed();
  seeded = true;
}
