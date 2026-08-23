import { db } from '@/lib/db';
import type { StageRow } from '@/lib/types';

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

export function setStageHonorPaid(stageId: string): void {
  db.prepare(
    "UPDATE order_stages SET honor_status = 'SUDAH', honor_tanggal_bayar = datetime('now'), updated_at = datetime('now') WHERE id = ?"
  ).run(stageId);
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
    sets.push('honor_jumlah = ?');
    params.push(Math.max(0, Math.round(input.honorJumlah)));
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

export function countAttachmentsForStage(stageId: string, tipe?: 'foto' | 'dokumen'): number {
  const row = tipe
    ? (db.prepare('SELECT COUNT(*) AS n FROM attachments WHERE stage_id = ? AND tipe = ?').get(stageId, tipe) as {
        n: number;
      })
    : (db.prepare('SELECT COUNT(*) AS n FROM attachments WHERE stage_id = ?').get(stageId) as { n: number });
  return row.n;
}
