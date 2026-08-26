import { db } from '@/lib/db';
import { newId } from '@/lib/id';
import type { HonorPaymentRow, StageRow } from '@/lib/types';

const SELECT_WITH_VENDOR = `
  SELECT s.*, v.nama AS vendor_nama, v.is_internal AS vendor_is_internal
  FROM order_stages s
  LEFT JOIN vendors v ON v.id = s.vendor_id
`;

export function listStagesForOrder(orderId: string): StageRow[] {
  return db
    .prepare(`${SELECT_WITH_VENDOR} WHERE s.order_id = ? ORDER BY s.urutan ASC`)
    .all(orderId) as unknown as StageRow[];
}

export function getStageById(stageId: string): StageRow | undefined {
  return db.prepare(`${SELECT_WITH_VENDOR} WHERE s.id = ?`).get(stageId) as StageRow | undefined;
}

export function listStagesForVendor(vendorId: string): StageRow[] {
  return db
    .prepare(`${SELECT_WITH_VENDOR} WHERE s.vendor_id = ? ORDER BY s.updated_at DESC`)
    .all(vendorId) as unknown as StageRow[];
}

export function setStageStatus(stageId: string, status: 'MENUNGGU' | 'BERJALAN' | 'SELESAI'): void {
  db.prepare("UPDATE order_stages SET status = ?, updated_at = datetime('now') WHERE id = ?").run(
    status,
    stageId
  );
}

/** Riwayat tiap pembayaran honor untuk satu tahap, terbaru di paling akhir —
 * dipakai untuk menampilkan daftar pembayaran (bukan cuma total) supaya
 * kasus vendor minta DP dulu sebelum mulai kerja lalu pelunasan sisanya
 * setelah selesai punya jejak yang jelas kapan & berapa. */
export function listHonorPaymentsForStage(stageId: string): HonorPaymentRow[] {
  return db
    .prepare('SELECT * FROM honor_payments WHERE stage_id = ? ORDER BY created_at ASC, id ASC')
    .all(stageId) as unknown as HonorPaymentRow[];
}

/** Admin mencatat satu kali pembayaran honor vendor untuk tahap ini — bisa
 * dipanggil berkali-kali (misalnya DP dulu sebelum vendor mulai kerja, lalu
 * pelunasan sisanya setelah selesai). `amount` ditambahkan ke akumulasi
 * honor_dibayar (bukan menggantinya); nilai akhir tidak pernah melebihi
 * honor_jumlah (kelebihan input di-cap ke sisa yang belum dibayar), dan
 * honor_status ikut disinkronkan sebagai ringkasan turunan. Nominal yang
 * BENAR-BENAR diterapkan (setelah di-cap) juga dicatat sebagai satu baris
 * baru di honor_payments — `catatan` opsional (misalnya "DP"/"Pelunasan")
 * dan `oleh` nama admin yang mencatatnya, untuk riwayat/audit. */
export function recordHonorPayment(stageId: string, amount: number, catatan: string | null, oleh: string): void {
  const stage = getStageById(stageId);
  if (!stage) return;
  const requested = Math.max(0, Math.round(amount));
  if (requested === 0) return;
  const sisa = Math.max(0, stage.honor_jumlah - stage.honor_dibayar);
  const applied = Math.min(requested, sisa);
  if (applied === 0) return;
  const dibayarBaru = stage.honor_dibayar + applied;
  const status = stage.honor_jumlah > 0 && dibayarBaru >= stage.honor_jumlah ? 'SUDAH' : 'BELUM';
  db.prepare(
    "UPDATE order_stages SET honor_dibayar = ?, honor_status = ?, honor_tanggal_bayar = datetime('now'), updated_at = datetime('now') WHERE id = ?"
  ).run(dibayarBaru, status, stageId);
  db.prepare('INSERT INTO honor_payments (id, stage_id, jumlah, catatan, oleh) VALUES (?, ?, ?, ?, ?)').run(
    newId(),
    stageId,
    applied,
    catatan,
    oleh
  );
}

export interface StageCostInput {
  honorJumlah?: number;
  materialCost?: number;
  shippingCost?: number;
  extraCost?: number;
}

/** Admin mengubah manual honor vendor & komponen harga modal untuk satu tahap. */
export function updateStageCosts(stageId: string, input: StageCostInput): void {
  const sets: string[] = [];
  const params: (number | string)[] = [];
  if (input.honorJumlah !== undefined) {
    const jumlah = Math.max(0, Math.round(input.honorJumlah));
    sets.push('honor_jumlah = ?');
    params.push(jumlah);
    // Kalau admin menurunkan total honor sampai di bawah nominal yang sudah
    // dibayarkan, "sudah dibayarkan" ikut disesuaikan supaya tidak pernah
    // melebihi total baru — honor_status pun ikut mengikuti.
    const current = getStageById(stageId);
    const dibayarBaru = Math.min(current?.honor_dibayar ?? 0, jumlah);
    sets.push('honor_dibayar = ?');
    params.push(dibayarBaru);
    sets.push('honor_status = ?');
    params.push(jumlah > 0 && dibayarBaru >= jumlah ? 'SUDAH' : 'BELUM');
  }
  if (input.materialCost !== undefined) {
    sets.push('material_cost = ?');
    params.push(Math.max(0, Math.round(input.materialCost)));
  }
  if (input.shippingCost !== undefined) {
    sets.push('shipping_cost = ?');
    params.push(Math.max(0, Math.round(input.shippingCost)));
  }
  if (input.extraCost !== undefined) {
    sets.push('extra_cost = ?');
    params.push(Math.max(0, Math.round(input.extraCost)));
  }
  if (sets.length === 0) return;
  sets.push("updated_at = datetime('now')");
  params.push(stageId);
  db.prepare(`UPDATE order_stages SET ${sets.join(', ')} WHERE id = ?`).run(...params);
}

/** Total harga modal pesanan: honor semua tahap + material + shipping + extra cost. */
export function computeHargaModal(orderId: string): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(honor_jumlah + material_cost + shipping_cost + extra_cost), 0) AS total
       FROM order_stages WHERE order_id = ?`
    )
    .get(orderId) as { total: number };
  return row.total;
}

/** Admin memindahkan tugas satu tahap ke vendor lain (atau melepas
 * penugasan sama sekali dengan `vendorId = null`) — misalnya karena vendor
 * sebelumnya berhenti di tengah jalan. Riwayat honor (`honor_payments`) dan
 * catatan/lampiran tahap ini TIDAK berubah/hilang karena semuanya terikat
 * ke `stage_id`, bukan ke `vendor_id` — hanya kolom vendor_id pada baris
 * tahap ini yang berubah. Pencatatan ke audit_log dilakukan di action layer
 * (src/app/(app)/orders/[id]/actions.ts) supaya nama vendor lama/baru bisa
 * disertakan dalam detail log-nya. */
export function reassignStageVendor(stageId: string, vendorId: string | null): void {
  db.prepare("UPDATE order_stages SET vendor_id = ?, updated_at = datetime('now') WHERE id = ?").run(
    vendorId,
    stageId
  );
}

export function countAttachmentsForStage(stageId: string, tipe?: 'foto' | 'dokumen'): number {
  const row = tipe
    ? (db.prepare('SELECT COUNT(*) AS n FROM attachments WHERE stage_id = ? AND tipe = ?').get(stageId, tipe) as {
        n: number;
      })
    : (db.prepare('SELECT COUNT(*) AS n FROM attachments WHERE stage_id = ?').get(stageId) as { n: number });
  return row.n;
}
