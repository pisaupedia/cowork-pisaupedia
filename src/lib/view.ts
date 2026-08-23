import { DIVISIONS } from '@/lib/constants';
import { formatRupiah, formatTanggal, statusForDeadline, STATUS_COLORS, type StatusKey } from '@/lib/derive';
import { listOrders, getOrderById, listArchivedOrders } from '@/lib/repo/orders';
import { listStagesForOrder, computeHargaModal } from '@/lib/repo/stages';
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
  attention: OrderCardView[];
  divisiCounts: { name: string; count: number; barWidth: number }[];
}

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
      .filter((c) => c.statusKey !== 'aman')
      .sort((a, b) => (a.statusKey === b.statusKey ? 0 : a.statusKey === 'terlambat' ? -1 : 1)),
    divisiCounts: divisiCounts.map((d) => ({ ...d, barWidth: Math.round((d.count / maxDiv) * 100) })),
  };
}

export interface KanbanColumnView {
  name: string;
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
  honorJumlahLabel: string;
  honorJumlahRaw: number;
  honorStatusLabel: string;
  honorBadgeBg: string;
  honorBadgeFg: string;
  canMarkPaid: boolean;
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
    const honorColors = s.honor_status === 'SUDAH' ? STATUS_COLORS.aman : STATUS_COLORS.mendekati;
    const canAct = own && s.status === 'BERJALAN';
    const isAdmin = !isVendorUser(user);
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
      honorStatusLabel: s.honor_status === 'SUDAH' ? 'Sudah Dibayar' : 'Belum Dibayar',
      honorBadgeBg: honorColors.bg,
      honorBadgeFg: honorColors.fg,
      canMarkPaid: isAdmin && isExternal && s.honor_status === 'BELUM',
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
        if (s.honor_status === 'SUDAH') totalSudahDibayar += s.honor_jumlah;
        else totalBelumDibayar += s.honor_jumlah;
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
}

export function buildArchivedOrdersList(): ArchivedOrderView[] {
  return listArchivedOrders().map((o) => ({
    id: o.id,
    kode: o.kode,
    jenis: o.jenis,
    pelanggan: o.pelanggan,
    jumlah: o.jumlah,
    archivedAtLabel: o.archived_at ? formatTanggal(o.archived_at) : '—',
  }));
}

export { formatTanggal, formatRupiah };
