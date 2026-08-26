import { DIVISIONS, type Divisi } from '@/lib/constants';
import { formatRupiah, formatTanggal, statusForDeadline, STATUS_COLORS, type StatusKey } from '@/lib/derive';
import { listOrders, getOrderById, listArchivedOrders } from '@/lib/repo/orders';
import { listStagesForOrder, computeHargaModal, listHonorPaymentsForStage, listStagesForVendor } from '@/lib/repo/stages';
import { listNotesForStage } from '@/lib/repo/notes';
import { listAttachmentsForStage } from '@/lib/repo/attachments';
import { listDesignPhotosForOrder } from '@/lib/repo/designPhotos';
import { listExternalVendors } from '@/lib/repo/vendors';
import type { OrderRow, SessionUser, StageRow } from '@/lib/types';

// ---------------------------------------------------------------------------
// Semua fungsi di file ini adalah SATU-SATUNYA jalur "siapa boleh lihat apa".
// Halaman (server component) dan Server Action WAJIB lewat sini, bukan
// query tabel langsung + filter di UI — supaya aturan akses (row-level
// security per vendor/tahap) benar-benar ditegakkan di server, bukan cuma
// disembunyikan di tampilan.
// ---------------------------------------------------------------------------

export function isVendorUser(user: SessionUser): boolean {
  return user.role === 'VENDOR';
}

/** Tahap yang sedang berjalan/berikutnya untuk sebuah pesanan (untuk kanban/dashboard). */
export function currentStage(stages: StageRow[]): StageRow {
  const next = stages.find((s) => s.status !== 'SELESAI');
  return next ?? stages[stages.length - 1];
}

export function isStageOwn(stage: StageRow, user: SessionUser): boolean {
  if (!isVendorUser(user)) return true;
  return stage.vendor_id === user.vendorId;
}

function isStageExternalVendor(stage: StageRow): boolean {
  return !!stage.vendor_id && stage.vendor_is_internal === 0;
}

/**
 * Pesanan yang boleh dilihat user ini di alur produksi normal (dashboard,
 * kanban, kalender). Pesanan yang masih MENUNGGU/DITOLAK approval TIDAK
 * pernah masuk daftar ini untuk siapapun kecuali lewat panel Persetujuan.
 */
export function listVisibleOrders(user: SessionUser): OrderRow[] {
  // Pesanan yang sudah diarsipkan admin (lihat "Arsip") disembunyikan dari
  // dashboard/kanban/kalender untuk semua orang — datanya tidak dihapus,
  // masih bisa dibuka langsung lewat /orders/[id] atau lewat panel Arsip.
  const approved = listOrders().filter((o) => o.approval_status === 'DISETUJUI' && o.archived !== 1);
  if (!isVendorUser(user)) return approved;

  return approved.filter((o) => {
    const stages = listStagesForOrder(o.id);
    return stages.some((s) => s.vendor_id === user.vendorId);
  });
}

export function listPendingApprovalOrders(): OrderRow[] {
  return listOrders().filter((o) => o.approval_status === 'MENUNGGU');
}

export function listApprovalHistory(): OrderRow[] {
  return listOrders().filter((o) => o.is_custom === 1 && o.approval_status !== 'MENUNGGU');
}

export interface OrderCardView {
  id: string;
  kode: string;
  subtitle: string;
  progress: number;
  statusKey: StatusKey;
  badgeBg: string;
  badgeFg: string;
  badgeLabel: string;
  vendorTag: string;
  currentDivisi: string;
  /** Semua tahap (termasuk Selesai Produksi) sudah SELESAI — dipakai untuk
   * menampilkan tombol "Arsipkan" di kolom Kanban "Selesai Produksi". */
  isFullyComplete: boolean;
  /** URL foto desain pertama pesanan ini (kalau ada), untuk ditampilkan
   * sebagai thumbnail kecil di kartu dashboard/kanban — supaya vendor
   * maupun owner langsung melihat desain pisaunya tanpa perlu membuka
   * detail pesanan. Sama seperti galeri di halaman detail, endpoint
   * `/api/design-photos/[id]` yang menyajikannya tetap mengecek ulang
   * akses lewat buildOrderDetail(), jadi tidak ada foto yang "kebobolan"
   * ke pengguna yang seharusnya tidak boleh melihat pesanan itu. */
  thumbUrl: string | null;
  /** Jumlah total foto desain pesanan ini — dipakai untuk badge "+N" di
   * thumbnail kalau ada lebih dari satu foto. */
  designPhotoCount: number;
}

export function toOrderCard(order: OrderRow, user: SessionUser): OrderCardView {
  const stages = listStagesForOrder(order.id);
  const cur = currentStage(stages);
  const terkirim = cur.divisi === 'Selesai Produksi' && cur.status === 'SELESAI';
  const status = statusForDeadline(order.deadline, terkirim);
  const colors = STATUS_COLORS[status.key];
  const doneCount = stages.filter((s) => s.status === 'SELESAI').length;
  const vendor = isVendorUser(user)
    ? 'Ditugaskan ke Anda'
    : cur.vendor_nama ?? '—';
  const designPhotos = listDesignPhotosForOrder(order.id);

  return {
    id: order.id,
    kode: order.kode,
    subtitle: isVendorUser(user) ? `${order.jenis} · ${order.jumlah} unit` : `${order.jenis} · ${order.pelanggan}`,
    progress: Math.round((doneCount / stages.length) * 100),
    statusKey: status.key,
    badgeBg: colors.bg,
    badgeFg: colors.fg,
    badgeLabel: status.label,
    vendorTag: vendor,
    currentDivisi: cur.divisi,
    isFullyComplete: doneCount === stages.length,
    thumbUrl: designPhotos.length > 0 ? `/api/design-photos/${designPhotos[0].id}` : null,
    designPhotoCount: designPhotos.length,
  };
}

export interface DashboardView {
  statTotal: number;
  statMendekati: number;
  statTerlambat: number;
  statSelesaiProduksi: number;
  /** SEMUA pesanan yang terlihat user ini KECUALI yang sudah di divisi
   * "Selesai Produksi" (pesanan di divisi itu sudah di ujung alur produksi,
   * jadi tidak perlu ikut nongkrong di daftar "Perlu Perhatian" — lihat
   * `statSelesaiProduksi` untuk hitungannya). Diurutkan terlambat →
   * mendekati → aman, supaya yang paling butuh perhatian tetap tampil di
   * atas walau daftarnya sekarang lengkap. */
  attention: OrderCardView[];
  divisiCounts: { name: Divisi; count: number; barWidth: number }[];
}

const ATTENTION_RANK: Record<StatusKey, number> = { terlambat: 0, mendekati: 1, aman: 2 };

export function buildDashboard(user: SessionUser): DashboardView {
  const visible = listVisibleOrders(user);
  const cards = visible.map((o) => toOrderCard(o, user));

  const divisiCounts = DIVISIONS.map((div) => ({
    name: div,
    count: cards.filter((c) => c.currentDivisi === div).length,
  }));
  const maxDiv = Math.max(1, ...divisiCounts.map((d) => d.count));

  return {
    statTotal: cards.length,
    statMendekati: cards.filter((c) => c.statusKey === 'mendekati').length,
    statTerlambat: cards.filter((c) => c.statusKey === 'terlambat').length,
    statSelesaiProduksi: cards.filter((c) => c.currentDivisi === 'Selesai Produksi').length,
    attention: cards
      .filter((c) => c.currentDivisi !== 'Selesai Produksi')
      .sort((a, b) => ATTENTION_RANK[a.statusKey] - ATTENTION_RANK[b.statusKey]),
    divisiCounts: divisiCounts.map((d) => ({ ...d, barWidth: Math.round((d.count / maxDiv) * 100) })),
  };
}

export interface VendorHonorSummary {
  totalSisa: number;
  totalSisaLabel: string;
  totalDibayar: number;
  totalDibayarLabel: string;
  jumlahTahapAktif: number;
}

/** Ringkasan honor untuk SATU akun vendor (dipakai sebagai pengganti panel
 * "Distribusi per Divisi" di Dashboard untuk vendor yang hanya bekerja di
 * satu divisi — panel distribusi divisi jadi kurang relevan untuk mereka
 * karena hampir selalu kosong di divisi lain, lihat buildDashboard di bawah).
 * Mencakup SEMUA tahap yang pernah ditugaskan ke vendor ini, bukan hanya
 * yang sedang terlihat di dashboard — supaya ringkasan honornya lengkap. */
export function buildVendorHonorSummary(vendorId: string): VendorHonorSummary {
  const stages = listStagesForVendor(vendorId).filter((s) => s.vendor_is_internal === 0);
  let totalSisa = 0;
  let totalDibayar = 0;
  stages.forEach((s) => {
    totalSisa += Math.max(0, s.honor_jumlah - s.honor_dibayar);
    totalDibayar += s.honor_dibayar;
  });
  return {
    totalSisa,
    totalSisaLabel: formatRupiah(totalSisa),
    totalDibayar,
    totalDibayarLabel: formatRupiah(totalDibayar),
    jumlahTahapAktif: stages.filter((s) => s.status !== 'SELESAI').length,
  };
}

export interface KanbanColumnView {
  name: Divisi;
  orders: OrderCardView[];
}

export function buildKanban(user: SessionUser): KanbanColumnView[] {
  const visible = listVisibleOrders(user);
  const cards = visible.map((o) => toOrderCard(o, user));
  return DIVISIONS.map((div) => ({
    name: div,
    orders: cards.filter((c) => c.currentDivisi === div),
  }));
}

export interface StageView {
  id: string;
  nama: string;
  urutan: number;
  status: 'MENUNGGU' | 'BERJALAN' | 'SELESAI';
  statusLabel: string;
  statusDotStyle: string;
  vendorDisplay: string;
  restricted: boolean;
  isOwn: boolean;
  canUpload: boolean;
  canComplete: boolean;
  fotoCount: number;
  notes: { id: string; penulis: string; teks: string; createdAt: string }[];
  attachments: { id: string; nama: string; tipe: string; oleh: string; createdAt: string; pendingSync: boolean }[];
  showHonor: boolean;
  /** Total Pembayaran — total honor yang disepakati untuk tahap ini. */
  honorJumlahLabel: string;
  honorJumlahRaw: number;
  /** Sudah Dibayarkan — akumulasi nominal yang sudah dibayar (bisa DP/dicicil). */
  honorDibayarLabel: string;
  honorDibayarRaw: number;
  /** Sisa yang belum dibayarkan (Total Pembayaran - Sudah Dibayarkan). */
  honorSisaLabel: string;
  honorSisaRaw: number;
  honorStatusLabel: string;
  honorBadgeBg: string;
  honorBadgeFg: string;
  /** Admin bisa mencatat pembayaran (boleh sebagian/DP) selama belum lunas. */
  canRecordPayment: boolean;
  /** Riwayat tiap pembayaran honor yang sudah dicatat untuk tahap ini,
   * terlama ke terbaru — bisa lebih dari satu (misalnya DP lalu pelunasan). */
  honorPayments: { id: string; jumlahLabel: string; catatan: string | null; oleh: string; tanggalLabel: string }[];
  /** Admin-only: bisa mengedit honor & komponen harga modal tahap ini. */
  canEditCosts: boolean;
  /** Label input harga modal material yang relevan untuk divisi ini (null jika tidak ada). */
  materialCostLabel: string | null;
  materialCostRaw: number;
  materialCostDisplay: string;
  /** Hanya relevan untuk tahap Selesai Produksi. */
  showShippingExtra: boolean;
  shippingCostRaw: number;
  shippingCostDisplay: string;
  extraCostRaw: number;
  extraCostDisplay: string;
}

export interface DesignPhotoView {
  id: string;
  nama: string;
  oleh: string;
  createdAt: string;
}

export interface OrderDetailView {
  order: OrderRow;
  statusKey: StatusKey;
  badgeBg: string;
  badgeFg: string;
  badgeLabel: string;
  progress: number;
  pelangganDisplay: string;
  kontakDisplay: string;
  hargaDisplay: string;
  /** Total harga modal (honor semua tahap + material + shipping + extra cost). Admin-only, null untuk vendor. */
  hargaModalDisplay: string | null;
  currentDivisi: string;
  stages: StageView[];
  isFullyComplete: boolean;
  showReport: boolean;
  report: {
    fotoCount: number;
    dokumenCount: number;
    catatanCount: number;
    honorTotalLabel: string;
    hargaModalTotalLabel: string;
  } | null;
  /** Foto referensi desain pisau — terlihat oleh SEMUA divisi/vendor yang
   * terlibat di pesanan ini (tidak dibatasi per tahap seperti lampiran). */
  designPhotos: DesignPhotoView[];
  /** Admin-only: bisa menambah foto desain lagi dari halaman ini. */
  canManageDesignPhotos: boolean;
}

/**
 * Merangkai tampilan detail pesanan untuk `user`. Mengembalikan `null` jika
 * pesanan tidak ada ATAU user ini tidak berhak melihatnya sama sekali —
 * inilah pengecekan RLS yang sesungguhnya (bukan cuma menyembunyikan tombol).
 */
export function buildOrderDetail(orderId: string, user: SessionUser): OrderDetailView | null {
  const order = getOrderById(orderId);
  if (!order) return null;
  if (order.approval_status !== 'DISETUJUI') {
    // pesanan yang belum/tidak disetujui hanya boleh dilihat lewat panel Persetujuan (admin)
    if (isVendorUser(user)) return null;
    if (order.approval_status !== 'MENUNGGU' && order.approval_status !== 'DITOLAK') return null;
  }

  const rawStages = listStagesForOrder(orderId);

  if (isVendorUser(user) && !rawStages.some((s) => s.vendor_id === user.vendorId)) {
    return null; // vendor ini tidak terlibat di pesanan ini sama sekali
  }

  const cur = currentStage(rawStages);
  const terkirim = cur.divisi === 'Selesai Produksi' && cur.status === 'SELESAI';
  const status = statusForDeadline(order.deadline, terkirim);
  const colors = STATUS_COLORS[status.key];
  const doneCount = rawStages.filter((s) => s.status === 'SELESAI').length;

  const stages: StageView[] = rawStages.map((s) => {
    const own = isStageOwn(s, user);
    const notes = own
      ? listNotesForStage(s.id).map((n) => ({ id: n.id, penulis: n.penulis, teks: n.teks, createdAt: n.created_at }))
      : [];
    const attachmentsRaw = own ? listAttachmentsForStage(s.id) : [];
    const fotoCount = attachmentsRaw.filter((a) => a.tipe === 'foto').length;
    const isExternal = isStageExternalVendor(s);
    const showHonor = own && isExternal;
    const honorSisa = Math.max(0, s.honor_jumlah - s.honor_dibayar);
    const honorLunas = s.honor_jumlah > 0 && s.honor_dibayar >= s.honor_jumlah;
    const honorBelumSamaSekali = s.honor_dibayar <= 0;
    const honorStatusLabel = honorLunas ? 'Lunas' : honorBelumSamaSekali ? 'Belum Dibayar' : 'DP Terbayar';
    const honorColors = honorLunas ? STATUS_COLORS.aman : honorBelumSamaSekali ? STATUS_COLORS.terlambat : STATUS_COLORS.mendekati;
    const canAct = own && s.status === 'BERJALAN';
    const isAdmin = !isVendorUser(user);
    const honorPayments = showHonor
      ? listHonorPaymentsForStage(s.id).map((p) => ({
          id: p.id,
          jumlahLabel: formatRupiah(p.jumlah),
          catatan: p.catatan,
          oleh: p.oleh,
          tanggalLabel: formatTanggal(p.created_at),
        }))
      : [];
    const materialCostLabel =
      s.divisi === 'Cutting & Blacksmith'
        ? 'Harga Modal Material Baja'
        : s.divisi === 'Handle & Cover'
          ? 'Harga Modal Bahan Kayu'
          : null;

    return {
      id: s.id,
      nama: s.divisi,
      urutan: s.urutan,
      status: s.status,
      statusLabel: s.status === 'SELESAI' ? 'Selesai' : s.status === 'BERJALAN' ? 'Sedang Dikerjakan' : 'Menunggu',
      statusDotStyle:
        s.status === 'SELESAI'
          ? 'background:oklch(0.6 0.13 142);'
          : s.status === 'BERJALAN'
            ? 'background:oklch(0.72 0.15 65);'
            : 'background:oklch(0.8 0.01 255);',
      vendorDisplay: own ? s.vendor_nama ?? '—' : 'Vendor lain (tidak ditampilkan)',
      restricted: !own,
      isOwn: own,
      canUpload: canAct,
      canComplete: canAct && fotoCount >= 1,
      fotoCount,
      notes,
      attachments: attachmentsRaw.map((a) => ({
        id: a.id,
        nama: a.nama,
        tipe: a.tipe,
        oleh: a.oleh,
        createdAt: a.created_at,
        pendingSync: a.pending_sync === 1,
      })),
      showHonor,
      honorJumlahLabel: formatRupiah(s.honor_jumlah),
      honorJumlahRaw: s.honor_jumlah,
      honorDibayarLabel: formatRupiah(s.honor_dibayar),
      honorDibayarRaw: s.honor_dibayar,
      honorSisaLabel: formatRupiah(honorSisa),
      honorSisaRaw: honorSisa,
      honorStatusLabel,
      honorBadgeBg: honorColors.bg,
      honorBadgeFg: honorColors.fg,
      canRecordPayment: isAdmin && isExternal && honorSisa > 0,
      honorPayments,
      canEditCosts: isAdmin,
      materialCostLabel,
      materialCostRaw: s.material_cost,
      materialCostDisplay: formatRupiah(s.material_cost),
      showShippingExtra: s.divisi === 'Selesai Produksi',
      shippingCostRaw: s.shipping_cost,
      shippingCostDisplay: formatRupiah(s.shipping_cost),
      extraCostRaw: s.extra_cost,
      extraCostDisplay: formatRupiah(s.extra_cost),
    };
  });

  const isFullyComplete = rawStages.every((s) => s.status === 'SELESAI');
  const showReport = isFullyComplete && !isVendorUser(user);

  let report: OrderDetailView['report'] = null;
  if (showReport) {
    let fotoCount = 0;
    let dokumenCount = 0;
    let catatanCount = 0;
    let honorTotal = 0;
    rawStages.forEach((s) => {
      const atts = listAttachmentsForStage(s.id);
      fotoCount += atts.filter((a) => a.tipe === 'foto').length;
      dokumenCount += atts.filter((a) => a.tipe === 'dokumen').length;
      catatanCount += listNotesForStage(s.id).length;
      if (isStageExternalVendor(s)) honorTotal += s.honor_jumlah;
    });
    report = {
      fotoCount,
      dokumenCount,
      catatanCount,
      honorTotalLabel: formatRupiah(honorTotal),
      hargaModalTotalLabel: formatRupiah(computeHargaModal(orderId)),
    };
  }

  const designPhotos: DesignPhotoView[] = listDesignPhotosForOrder(orderId).map((p) => ({
    id: p.id,
    nama: p.nama,
    oleh: p.oleh,
    createdAt: p.created_at,
  }));

  return {
    order,
    statusKey: status.key,
    badgeBg: colors.bg,
    badgeFg: colors.fg,
    badgeLabel: status.label,
    progress: Math.round((doneCount / rawStages.length) * 100),
    pelangganDisplay: isVendorUser(user) ? 'Disembunyikan (khusus internal)' : order.pelanggan,
    kontakDisplay: isVendorUser(user) ? '—' : order.kontak ?? '—',
    hargaDisplay: isVendorUser(user) ? 'Disembunyikan (khusus internal)' : formatRupiah(order.harga),
    hargaModalDisplay: isVendorUser(user) ? null : formatRupiah(computeHargaModal(orderId)),
    currentDivisi: cur.divisi,
    stages,
    isFullyComplete,
    showReport,
    report,
    designPhotos,
    canManageDesignPhotos: !isVendorUser(user),
  };
}

// ---------------------------------------------------------------------------
// Arsip — lihat src/app/(app)/arsip/*. Halaman ini admin-only, jadi
// fungsi-fungsi di bawah TIDAK menerapkan penyamaran data khusus vendor
// seperti buildOrderDetail (pelanggan, harga, dst.) — hanya dipanggil dari
// halaman yang sudah digerbangi requireAdmin/redirect di page.tsx-nya.
// ---------------------------------------------------------------------------

export interface VendorArchiveStat {
  vendorId: string;
  vendorNama: string;
  /** Jumlah pesanan (yang sudah diarsipkan) yang melibatkan vendor ini di
   * minimal satu tahap — bukan jumlah tahap, supaya vendor yang mengerjakan
   * lebih dari satu tahap pada pesanan yang sama tetap terhitung satu kali. */
  jumlahPesanan: number;
  totalSudahDibayar: number;
  totalSudahDibayarLabel: string;
  totalBelumDibayar: number;
  totalBelumDibayarLabel: string;
}

/** Statistik honor per vendor eksternal, dihitung HANYA dari pesanan yang
 * sudah diarsipkan (lihat listArchivedOrders) — bukan seluruh pesanan aktif. */
export function buildVendorArchiveStats(): VendorArchiveStat[] {
  const vendors = listExternalVendors();
  const archivedOrders = listArchivedOrders();

  const stats = vendors.map((v) => {
    let jumlahPesanan = 0;
    let totalSudahDibayar = 0;
    let totalBelumDibayar = 0;

    for (const order of archivedOrders) {
      const vendorStages = listStagesForOrder(order.id).filter((s) => s.vendor_id === v.id);
      if (vendorStages.length === 0) continue;
      jumlahPesanan += 1;
      for (const s of vendorStages) {
        totalSudahDibayar += s.honor_dibayar;
        totalBelumDibayar += Math.max(0, s.honor_jumlah - s.honor_dibayar);
      }
    }

    return {
      vendorId: v.id,
      vendorNama: v.nama,
      jumlahPesanan,
      totalSudahDibayar,
      totalSudahDibayarLabel: formatRupiah(totalSudahDibayar),
      totalBelumDibayar,
      totalBelumDibayarLabel: formatRupiah(totalBelumDibayar),
    };
  });

  return stats.sort((a, b) => b.jumlahPesanan - a.jumlahPesanan);
}

export interface ArchivedOrderView {
  id: string;
  kode: string;
  jenis: string;
  pelanggan: string;
  jumlah: number;
  archivedAtLabel: string;
  /** ISO mentah (untuk filter rentang tanggal & export CSV) — archivedAtLabel di atas sudah diformat untuk tampilan. */
  archivedAtRaw: string | null;
}

export interface ArchivedOrdersFilter {
  /** Cocok di kode pesanan ATAU nama pelanggan (case-insensitive, substring). */
  q?: string;
  /** Rentang tanggal diarsipkan, format ISO 'YYYY-MM-DD', inklusif di kedua ujung. */
  dateFrom?: string;
  dateTo?: string;
}

/** Daftar pesanan yang sudah diarsipkan, dengan filter pencarian teks
 * (kode/pelanggan) dan/atau rentang tanggal diarsipkan opsional — dipakai
 * bersama oleh halaman Arsip (src/app/(app)/arsip/page.tsx) dan endpoint
 * export CSV-nya supaya logika filternya tidak dobel/berisiko tidak sinkron. */
export function buildArchivedOrdersList(filter?: ArchivedOrdersFilter): ArchivedOrderView[] {
  const q = filter?.q?.trim().toLowerCase();
  return listArchivedOrders()
    .filter((o) => {
      if (q && !(o.kode.toLowerCase().includes(q) || o.pelanggan.toLowerCase().includes(q))) return false;
      const archivedDate = o.archived_at?.slice(0, 10);
      if (filter?.dateFrom && (!archivedDate || archivedDate < filter.dateFrom)) return false;
      if (filter?.dateTo && (!archivedDate || archivedDate > filter.dateTo)) return false;
      return true;
    })
    .map((o) => ({
      id: o.id,
      kode: o.kode,
      jenis: o.jenis,
      pelanggan: o.pelanggan,
      jumlah: o.jumlah,
      archivedAtLabel: o.archived_at ? formatTanggal(o.archived_at) : '—',
      archivedAtRaw: o.archived_at,
    }));
}

export { formatTanggal, formatRupiah };
