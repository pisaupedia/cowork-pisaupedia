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
  /** vendorId per divisi; a divisi with no vendor assigned yet is allowed (null) */
  vendorPerDivisi: Partial<Record<Divisi, string | null>>;
  /** Honor vendor per divisi, diinput manual oleh admin (bukan dihitung otomatis). Default 0. */
  honorPerDivisi?: Partial<Record<Divisi, number>>;
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
export function createOrder(input: CreateOrderInput): OrderRow {
  const id = newId();
  const nomorUrut = nextNomorUrut();
  const kode = `${input.jenis}-${String(nomorUrut).padStart(3, '0')}`;
  const approvalStatus: ApprovalStatus = input.isCustom ? 'MENUNGGU' : 'DISETUJUI';

  db.prepare(
    `INSERT INTO orders (id, kode, nomor_urut, jenis, pelanggan, kontak, jumlah, harga, tanggal_masuk, deadline, is_custom, approval_status, approval_note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
    input.approvalNote
  );

  DIVISIONS.forEach((divisi, urutan) => {
    const vendorId = input.vendorPerDivisi[divisi] ?? null;
    const honorJumlah = Math.max(0, Math.round(input.honorPerDivisi?.[divisi] ?? 0));
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
      `INSERT INTO order_stages (id, order_id, divisi, urutan, vendor_id, status, honor_jumlah, material_cost, shipping_cost, extra_cost)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(stageId, id, divisi, urutan, vendorId, status, honorJumlah, materialCost, shippingCost, extraCost);
  });

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

export function setApprovalStatus(orderId: string, status: 'DISETUJUI' | 'DITOLAK'): void {
  db.prepare('UPDATE orders SET approval_status = ? WHERE id = ?').run(status, orderId);
  if (status === 'DISETUJUI') {
    // buka tahap pertama begitu pesanan disetujui
    db.prepare(
      "UPDATE order_stages SET status = 'BERJALAN', updated_at = datetime('now') WHERE order_id = ? AND urutan = 0 AND status = 'MENUNGGU'"
    ).run(orderId);
  }
}
