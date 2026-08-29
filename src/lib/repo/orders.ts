import { db } from '@/lib/db';
import { newId } from '@/lib/id';
import { DIVISIONS, type Divisi } from '@/lib/constants';
import type { ApprovalStatus, OrderRow } from '@/lib/types';

export function listOrders(): OrderRow[] {
  return db.prepare('SELECT * FROM orders ORDER BY nomor_urut ASC').all() as unknown as OrderRow[];
}

export function getOrderById(id: string): OrderRow | undefined {
  return db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as OrderRow | undefined;
}

export function getOrderByKode(kode: string): OrderRow | undefined {
  return db.prepare('SELECT * FROM orders WHERE kode = ?').get(kode) as OrderRow | undefined;
}

export function nextNomorUrut(): number {
  const row = db.prepare('SELECT MAX(nomor_urut) AS m FROM orders').get() as { m: number | null };
  return (row.m ?? 0) + 1;
}

export interface CreateOrderInput {
  jenis: string;
  pelanggan: string;
  kontak: string | null;
  jumlah: number;
  harga: number;
  tanggalMasuk: string; // ISO date
  deadline: string; // ISO date
  isCustom: boolean;
  approvalNote: string | null;
  /** Catatan/rincian pekerjaan umum (opsional) — beda dari approvalNote. */
  catatan?: string | null;
  /** vendorId per divisi; a divisi with no vendor assigned yet is allowed (null) */
  vendorPerDivisi: Partial<Record<Divisi, string | null>>;
  /** Honor vendor per divisi — TOTAL yang sudah diresolusi (untuk Borongan:
   * diketik langsung; untuk Per Unit: sudah dikalikan honorRatePerDivisi ×
   * jumlah oleh pemanggil, lihat createOrderAction). Default 0. */
  honorPerDivisi?: Partial<Record<Divisi, number>>;
  /** Mode honor per divisi — 'BORONGAN' (default) atau 'PER_UNIT'. */
  honorModePerDivisi?: Partial<Record<Divisi, 'BORONGAN' | 'PER_UNIT'>>;
  /** Tarif per pcs per divisi — hanya berarti untuk divisi bermode 'PER_UNIT',
   * disimpan supaya bisa dihitung ulang otomatis kalau jumlah pesanan diedit
   * belakangan (lihat recalcPerUnitHonorForOrder). */
  honorRatePerDivisi?: Partial<Record<Divisi, number>>;
  /** Komponen harga modal, diinput manual oleh admin — lihat catatan di schema.sql. Default 0. */
  materialCostBaja?: number; // Cutting & Blacksmith
  materialCostKayu?: number; // Handle & Cover
  shippingCost?: number; // Selesai Produksi
  extraCost?: number; // Selesai Produksi
}

/**
 * Membuat pesanan baru beserta 4 baris tahap (satu per divisi).
 * Pesanan custom otomatis berstatus MENUNGGU approval; selainnya DISETUJUI
 * dan tahap pertama langsung dibuka (BERJALAN).
 */
/**
 * Membuat pesanan baru beserta 4 baris tahap sekaligus di dalam SATU
 * transaksi database (BEGIN/COMMIT, ROLLBACK kalau gagal di tengah jalan) —
 * supaya kalau terjadi error di antara insert pesanan dan insert
 * tahap-tahapnya (misalnya proses terhenti/disk penuh), tidak tersisa
 * pesanan "yatim" tanpa tahap di database.
 */
export function createOrder(input: CreateOrderInput): OrderRow {
  const id = newId();
  const nomorUrut = nextNomorUrut();
  const kode = `${input.jenis}-${String(nomorUrut).padStart(3, '0')}`;
  const approvalStatus: ApprovalStatus = input.isCustom ? 'MENUNGGU' : 'DISETUJUI';

  db.exec('BEGIN');
  try {
    db.prepare(
      `INSERT INTO orders (id, kode, nomor_urut, jenis, pelanggan, kontak, jumlah, harga, tanggal_masuk, deadline, is_custom, approval_status, approval_note, catatan)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      kode,
      nomorUrut,
      input.jenis,
      input.pelanggan,
      input.kontak,
      input.jumlah,
      input.harga,
      input.tanggalMasuk,
      input.deadline,
      input.isCustom ? 1 : 0,
      approvalStatus,
      input.approvalNote,
      input.catatan ?? null
    );

    DIVISIONS.forEach((divisi, urutan) => {
      const vendorId = input.vendorPerDivisi[divisi] ?? null;
      const honorJumlah = Math.max(0, Math.round(input.honorPerDivisi?.[divisi] ?? 0));
      const honorMode = input.honorModePerDivisi?.[divisi] ?? 'BORONGAN';
      const honorRate = Math.max(0, Math.round(input.honorRatePerDivisi?.[divisi] ?? 0));
      const materialCost =
        divisi === 'Cutting & Blacksmith'
          ? Math.max(0, Math.round(input.materialCostBaja ?? 0))
          : divisi === 'Handle & Cover'
            ? Math.max(0, Math.round(input.materialCostKayu ?? 0))
            : 0;
      const shippingCost = divisi === 'Selesai Produksi' ? Math.max(0, Math.round(input.shippingCost ?? 0)) : 0;
      const extraCost = divisi === 'Selesai Produksi' ? Math.max(0, Math.round(input.extraCost ?? 0)) : 0;
      const status = urutan === 0 && approvalStatus === 'DISETUJUI' ? 'BERJALAN' : 'MENUNGGU';
      const stageId = newId();
      db.prepare(
        `INSERT INTO order_stages (id, order_id, divisi, urutan, vendor_id, status, honor_jumlah, honor_mode, honor_rate, material_cost, shipping_cost, extra_cost)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        stageId,
        id,
        divisi,
        urutan,
        vendorId,
        status,
        honorJumlah,
        honorMode,
        honorRate,
        materialCost,
        shippingCost,
        extraCost
      );
    });
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return getOrderById(id) as OrderRow;
}

/** Pesanan yang sudah diarsipkan admin dari papan Kanban — lihat catatan di
 * schema.sql tabel `orders`. Diurutkan dari yang paling baru diarsipkan. */
export function listArchivedOrders(): OrderRow[] {
  return db.prepare("SELECT * FROM orders WHERE archived = 1 ORDER BY archived_at DESC").all() as unknown as OrderRow[];
}

export function archiveOrder(orderId: string): void {
  db.prepare("UPDATE orders SET archived = 1, archived_at = datetime('now') WHERE id = ?").run(orderId);
}

export function unarchiveOrder(orderId: string): void {
  db.prepare('UPDATE orders SET archived = 0, archived_at = NULL WHERE id = ?').run(orderId);
}

/** Hapus satu pesanan secara permanen, beserta seluruh baris anaknya di
 * database (tahap, catatan, lampiran, riwayat pembayaran honor, foto
 * desain) — urutan hapus mengikuti arah foreign key (anak dulu, baru
 * induk) supaya tidak ditolak SQLite.
 * File fisik di folder uploads/ (foto lampiran & foto desain) TIDAK
 * dihapus di sini — itu tanggung jawab pemanggil (lihat deleteOrderAction
 * di src/app/(app)/dashboard/actions.ts) karena butuh akses filesystem
 * (async), sedangkan modul repo ini murni sinkron. */
export function deleteOrder(orderId: string): void {
  const stageIds = (db.prepare('SELECT id FROM order_stages WHERE order_id = ?').all(orderId) as { id: string }[]).map(
    (r) => r.id
  );
  db.exec('BEGIN');
  try {
    for (const stageId of stageIds) {
      db.prepare('DELETE FROM attachments WHERE stage_id = ?').run(stageId);
      db.prepare('DELETE FROM notes WHERE stage_id = ?').run(stageId);
      db.prepare('DELETE FROM honor_payments WHERE stage_id = ?').run(stageId);
      db.prepare("DELETE FROM audit_log WHERE entity_type = 'stage' AND entity_id = ?").run(stageId);
    }
    db.prepare("DELETE FROM audit_log WHERE entity_type = 'order' AND entity_id = ?").run(orderId);
    db.prepare('DELETE FROM design_photos WHERE order_id = ?').run(orderId);
    db.prepare('DELETE FROM order_stages WHERE order_id = ?').run(orderId);
    db.prepare('DELETE FROM orders WHERE id = ?').run(orderId);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/** `rejectReason` hanya relevan saat status = 'DITOLAK' — diisi ke kolom
 * reject_reason supaya pengajunya tahu apa yang perlu diperbaiki (lihat
 * catatan di schema.sql). Saat disetujui, reject_reason lama (kalau ada,
 * misalnya dari pengajuan ulang yang sebelumnya pernah ditolak) dibersihkan. */
export function setApprovalStatus(
  orderId: string,
  status: 'DISETUJUI' | 'DITOLAK',
  rejectReason?: string | null
): void {
  if (status === 'DITOLAK') {
    db.prepare('UPDATE orders SET approval_status = ?, reject_reason = ? WHERE id = ?').run(
      status,
      rejectReason ?? null,
      orderId
    );
    return;
  }

  db.prepare("UPDATE orders SET approval_status = ?, reject_reason = NULL WHERE id = ?").run(status, orderId);
  // buka tahap pertama begitu pesanan disetujui
  db.prepare(
    "UPDATE order_stages SET status = 'BERJALAN', updated_at = datetime('now') WHERE order_id = ? AND urutan = 0 AND status = 'MENUNGGU'"
  ).run(orderId);
}

/** Mengajukan ulang pesanan yang sebelumnya DITOLAK — dipakai setelah admin
 * merevisi data pesanan (lihat updateOrder di bawah) supaya pesanan yang
 * ditolak tidak jadi jalan buntu. Hanya berlaku dari status DITOLAK; status
 * lain diabaikan (dicek juga di action layer). approval_note BOLEH diisi
 * ulang untuk menjelaskan apa yang sudah direvisi. */
export function resubmitOrder(orderId: string, approvalNote: string | null): void {
  db.prepare(
    "UPDATE orders SET approval_status = 'MENUNGGU', reject_reason = NULL, approval_note = ? WHERE id = ? AND approval_status = 'DITOLAK'"
  ).run(approvalNote, orderId);
}

export interface UpdateOrderInput {
  jenis: string;
  pelanggan: string;
  kontak: string | null;
  jumlah: number;
  harga: number;
  tanggalMasuk: string;
  deadline: string;
  catatan: string | null;
}

/** Admin mengubah data dasar pesanan yang sudah dibuat (jenis, pelanggan,
 * kontak, jumlah, harga, tanggal masuk, deadline, catatan) — sebelumnya
 * tidak ada jalan untuk memperbaiki salah input tanpa menghapus & membuat
 * ulang seluruh pesanan (kehilangan riwayat tahap/pembayaran). Sengaja TIDAK
 * mengubah kode/nomor urut, status approval, vendor per divisi, maupun
 * honor/harga modal — itu masing-masing punya jalur editnya sendiri
 * (updateStageCosts, reassignStageVendor, dst.) supaya setiap perubahan
 * tetap tercatat rapi per bidangnya di audit_log (lihat actions.ts pemanggil
 * fungsi ini untuk pencatatan audit-nya). */
export function updateOrder(orderId: string, input: UpdateOrderInput): void {
  db.prepare(
    `UPDATE orders SET jenis = ?, pelanggan = ?, kontak = ?, jumlah = ?, harga = ?, tanggal_masuk = ?, deadline = ?, catatan = ?
     WHERE id = ?`
  ).run(
    input.jenis,
    input.pelanggan,
    input.kontak,
    input.jumlah,
    input.harga,
    input.tanggalMasuk,
    input.deadline,
    input.catatan,
    orderId
  );
}
