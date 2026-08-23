import { CURRENCY_FORMAT } from '@/lib/constants';

const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export function formatTanggal(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS_ID[m - 1]} ${y}`;
}

export function formatRupiah(n: number): string {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

export function formatCurrency(n: number, code: import('@/lib/types').CurrencyCode): string {
  const fmt = CURRENCY_FORMAT[code] ?? CURRENCY_FORMAT.IDR;
  const num = Number.isFinite(n) ? n : 0;
  const formatted = num.toLocaleString(fmt.locale, {
    minimumFractionDigits: fmt.decimals,
    maximumFractionDigits: fmt.decimals,
  });
  return `${fmt.symbol} ${formatted}`;
}

function toSerial(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}

export type StatusKey = 'aman' | 'mendekati' | 'terlambat';

export function statusForDeadline(deadlineIso: string, terkirim: boolean, todayIso?: string): { key: StatusKey; label: string } {
  if (terkirim) return { key: 'aman', label: 'Terkirim' };
  const today = todayIso ?? new Date().toISOString().slice(0, 10);
  const diff = toSerial(deadlineIso) - toSerial(today);
  if (diff < 0) return { key: 'terlambat', label: `Terlambat ${Math.abs(diff)} hari` };
  if (diff === 0) return { key: 'mendekati', label: 'Jatuh tempo hari ini' };
  if (diff <= 5) return { key: 'mendekati', label: `Jatuh tempo ${diff} hari` };
  return { key: 'aman', label: `Aman (${diff} hari)` };
}

export const STATUS_COLORS: Record<StatusKey, { bg: string; fg: string; dot: string }> = {
  aman: { bg: 'oklch(0.94 0.045 142)', fg: 'oklch(0.36 0.09 142)', dot: 'oklch(0.6 0.13 142)' },
  mendekati: { bg: 'oklch(0.94 0.06 80)', fg: 'oklch(0.42 0.1 65)', dot: 'oklch(0.72 0.15 65)' },
  terlambat: { bg: 'oklch(0.94 0.06 25)', fg: 'oklch(0.42 0.14 25)', dot: 'oklch(0.58 0.19 25)' },
};
