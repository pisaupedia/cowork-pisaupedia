// Format tanggal khusus bahasa Inggris untuk panel Invoice & Dokumen —
// dipisah dari formatTanggal() di src/lib/derive.ts (yang berbahasa
// Indonesia dan dipakai di seluruh aplikasi lain) karena panel ini sengaja
// dikembalikan memakai bahasa Inggris seperti aplikasi standalone-nya dulu.
const MONTHS_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function formatDateEn(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${MONTHS_EN[m - 1]} ${d}, ${y}`;
}
