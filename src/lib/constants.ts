export const DIVISIONS = [
  'Cutting & Blacksmith',
  'Shaping & Heat Threatment',
  'Handle & Cover',
  'Selesai Produksi',
] as const;

export type Divisi = (typeof DIVISIONS)[number];

/** Warna identitas per divisi (permintaan pengguna) — dipakai untuk label
 * teks & bar di "Distribusi per Divisi" (Dashboard) dan judul kolom di
 * Papan Kanban, supaya keempat divisi konsisten dikenali dari warnanya di
 * seluruh aplikasi.
 *
 * Catatan: "Cutting & Blacksmith" sebelumnya memakai hue 25 (merah) — sama
 * persis dengan warna status "Terlambat" di src/lib/derive.ts
 * (STATUS_COLORS.terlambat, juga hue 25). Karena kartu pesanan menampilkan
 * badge status DAN warna divisi berdampingan, kartu divisi ini yang
 * sebetulnya masih aman/tepat waktu bisa terlihat seperti sedang terlambat
 * sekilas pandang. Diganti ke rose/magenta (hue 340) — tetap terkesan
 * "api tempa" yang hangat, tapi tidak lagi bentrok dengan warna alert. */
export const DIVISION_COLORS: Record<Divisi, string> = {
  'Cutting & Blacksmith': 'oklch(0.5 0.17 340)', // Rose/magenta (dulu merah — bentrok dengan status "Terlambat")
  'Shaping & Heat Threatment': 'oklch(0.7 0.15 90)', // Kuning
  'Handle & Cover': 'oklch(0.48 0.09 60)', // Coklat
  'Selesai Produksi': 'oklch(0.5 0.12 142)', // Hijau
};

export const COMPANY_NAME = 'Pisaupedia Co';

/** Kode konfirmasi yang harus diketik ulang sebelum operasi hapus data
 * (dokumen invoice/quotation/delivery note, dst.) benar-benar dijalankan.
 * Ini murni pengaman dari salah klik/salah hapus, BUKAN password akun atau
 * lapisan keamanan sungguhan — sengaja dibuat sederhana (angka 4 digit)
 * sesuai permintaan pengguna. */
export const DELETE_CONFIRM_CODE = '1234';

// ---------------------------------------------------------------------------
// Modul Invoice / Surat Jalan / Quotation
// ---------------------------------------------------------------------------

import type { CurrencyCode, DocType } from '@/lib/types';

/** Letterhead perusahaan untuk dokumen niaga — statis (bukan per-dokumen),
 * sesuai data asli dari aplikasi invoice sebelumnya. Logo: public/pisaupedia-logo.jpg */
export const COMPANY_PROFILE = {
  name: 'Pisaupedia Knives & Cutlery',
  addressLine1: 'Jl.Hankam Jatimurni RT06/RW06 No.84',
  addressLine2: 'Bekasi, Jawa Barat, Indonesia',
  website: 'www.pisaupedia.com',
  phone: 'Phone: 0851-1733-1290',
  logo: '/pisaupedia-logo.jpg',
  socialTiktok: '@pisaupedia',
  socialInstagram: '@pisaupedia',
};

export const DEFAULT_BANK_INFO =
  'Rekening Mandiri:\n1170011490331\nA.n: Rahmawati Nur Aida\nor\nWise: indra.nurmawoko@gmail.com\nPaypal: indra.nurmawoko@gmail.com';

export const DEFAULT_INVOICE_NOTES = 'Thank you for trusting us with your business.';

export const DEFAULT_QUOTATION_NOTES =
  'This quotation is valid for 30 days from the release date above. Prices are subject to change after the validity period.';

export const DEFAULT_QUOTATION_TERMS =
  '1. Lead Time: .....\n2. Garansi 6 bulan\n3. Production starts after receipt of the down payment and specification approval.\n4. Changes after approval may affect the price and production timeline.\n5. Handmade materials may have natural variations.\n6. Product photo/video may be provided before shipment.';

export const DEFAULT_SURATJALAN_NOTES = 'Goods have been inspected and are in good condition upon delivery.';

export const DOC_TYPES: DocType[] = ['invoice', 'quotation', 'suratjalan'];

export const DOC_TYPE_LABEL: Record<DocType, string> = {
  invoice: 'Invoice',
  quotation: 'Quotation',
  suratjalan: 'Delivery Note',
};

export const DOC_TYPE_PREFIX: Record<DocType, string> = {
  invoice: 'INV-',
  quotation: 'PQ-',
  suratjalan: 'DN-',
};

export const CURRENCIES: { code: CurrencyCode; label: string }[] = [
  { code: 'IDR', label: 'IDR - Indonesian Rupiah (Rp)' },
  { code: 'USD', label: 'USD - US Dollar ($)' },
  { code: 'EUR', label: 'EUR - Euro (€)' },
  { code: 'SGD', label: 'SGD - Singapore Dollar (S$)' },
  { code: 'MYR', label: 'MYR - Malaysian Ringgit (RM)' },
];

export const CURRENCY_FORMAT: Record<CurrencyCode, { symbol: string; locale: string; decimals: number }> = {
  IDR: { symbol: 'Rp', locale: 'id-ID', decimals: 0 },
  USD: { symbol: '$', locale: 'en-US', decimals: 2 },
  EUR: { symbol: '€', locale: 'de-DE', decimals: 2 },
  SGD: { symbol: 'S$', locale: 'en-SG', decimals: 2 },
  MYR: { symbol: 'RM', locale: 'ms-MY', decimals: 2 },
};
