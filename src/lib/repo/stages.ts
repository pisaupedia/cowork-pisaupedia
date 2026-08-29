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

/** Admin mengoreksi nominal/catatan SATU baris riwayat pembayaran yang
 * sudah tercatat (misalnya salah ketik) — bukan menambah baris baru.
 * Validasi (nominal > 0, tidak melebihi honor_jumlah tahap) dilakukan di
 * action layer (src/app/(app)/orders/[id]/actions.ts) sebelum memanggil
 * ini, supaya pesan errornya bisa diformat dengan formatRupiah di sana.
 * order_stages.honor_dibayar & honor_status disinkronkan ulang dari SUM
 * seluruh baris honor_payments milik tahap ini setelahnya, supaya invarian
 * SUM(honor_payments.jumlah) === honor_dibayar (lihat schema.sql) tetap
 * terjaga. */
export function updateHonorPayment(paymentId: string, jumlahBaru: number, catatan: string | null): void {
  const payment = db.prepare('SELECT * FROM honor_payments WHERE id = ?').get(paymentId) as
    | HonorPaymentRow
    | undefined;
  if (!payment) return;
  const stage = getStageById(payment.stage_id);
  if (!stage) return;

  db.prepare('UPDATE honor_payments SET jumlah = ?, catatan = ? WHERE id = ?').run(jumlahBaru, catatan, paymentId);

  const total = db
    .prepare('SELECT COALESCE(SUM(jumlah), 0) AS total FROM honor_payments WHERE stage_id = ?')
    .get(payment.stage_id) as { total: number };
  const status = stage.honor_jumlah > 0 && total.total >= stage.honor_jumlah ? 'SUDAH' : 'BELUM';
  db.prepare(
    "UPDATE order_stages SET honor_dibayar = ?, honor_status = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(total.total, status, payment.stage_id);
}

/** Admin menghapus SATU baris riwayat pembayaran yang salah/tidak jadi
 * (misalnya tercatat dua kali). order_stages.honor_dibayar & honor_status
 * disinkronkan ulang dari SUM baris yang tersisa setelahnya. */
export function deleteHonorPayment(paymentId: string): void {
  const payment = db.prepare('SELECT * FROM honor_payments WHERE id = ?').get(paymentId) as
    | HonorPaymentRow
    | undefined;
  if (!payment) return;
  const stage = getStageById(payment.stage_id);

  db.prepare('DELETE FROM honor_payments WHERE id = ?').run(paymentId);

  const total = db
    .prepare('SELECT COALESCE(SUM(jumlah), 0) AS total FROM honor_payments WHERE stage_id = ?')
    .get(payment.stage_id) as { total: number };
  const status = stage && stage.honor_jumlah > 0 && total.total >= stage.honor_jumlah ? 'SUDAH' : 'BELUM';
  db.prepare(
    "UPDATE order_stages SET honor_dibayar = ?, honor_status = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(total.total, status, payment.stage_id);
}

export interface StageCostInput {
  honorJumlah?: number;
  /** 'BORONGAN' atau 'PER_UNIT' — kalau diisi, disimpan bersamaan dengan
   * honorJumlah (yang sudah dihitung/divalidasi di action layer sebelum
   * sampai di sini — lihat updateStageCostAction). */
  honorMode?: 'BORONGAN' | 'PER_UNIT';
  /** Tarif per pcs — hanya berarti kalau honorMode = 'PER_UNIT', tapi tetap
   * disimpan apa adanya (0 untuk Borongan) supaya nilainya tidak hilang
   * kalau admin bolak-balik ganti mode. */
  honorRate?: number;
  materialCost?: number;
  shippingCost?: number;
  extraCost?: number;
}

/** Admin mengubah manual honor vendor & komponen harga modal untuk satu tahap. */
export function updateStageCosts(stageId: string, input: StageCostInput): void {
  const sets: string[] = [];
  const params: (number | string)[] = [];
  if (input.honorMode !== undefined) {
    sets.push('honor_mode = ?');
    params.push(input.honorMode);
  }
  if (input.honorRate !== undefined) {
    sets.push('honor_rate = ?');
    params.push(Math.max(0, Math.round(input.honorRate)));
  }
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

/** Dipanggil setiap kali jumlah unit pesanan berubah (lihat updateOrderAction
 * di src/app/(app)/orders/[id]/actions.ts) — semua tahap yang honornya
 * bermode 'PER_UNIT' dihitung ulang totalnya (honor_rate tetap, honor_jumlah
 * = honor_rate * jumlah baru) supaya honor per-pcs selalu konsisten dengan
 * jumlah pesanan terkini (Opsi 1 dari rancangan: hitung ulang otomatis, bukan
 * dibekukan). Tahap Borongan tidak tersentuh sama sekali karena totalnya
 * memang tidak bergantung jumlah. Sama seperti updateStageCosts: kalau total
 * baru lebih kecil dari honor_dibayar yang sudah tercatat, honor_dibayar ikut
 * diturunkan supaya tidak pernah melebihi total (honor_status disinkronkan).
 * Mengembalikan daftar tahap yang totalnya benar-benar berubah, supaya
 * pemanggil bisa memberi tahu admin & mencatatnya ke audit_log. */
export function recalcPerUnitHonorForOrder(
  orderId: string,
  newJumlah: number
): { stageId: string; divisi: string; before: number; after: number }[] {
  const stages = listStagesForOrder(orderId).filter((s) => s.honor_mode === 'PER_UNIT');
  const changed: { stageId: string; divisi: string; before: number; after: number }[] = [];
  for (const s of stages) {
    const newTotal = Math.max(0, Math.round(s.honor_rate * newJumlah));
    if (newTotal === s.honor_jumlah) continue;
    const dibayarBaru = Math.min(s.honor_dibayar, newTotal);
    const status = newTotal > 0 && dibayarBaru >= newTotal ? 'SUDAH' : 'BELUM';
    db.prepare(
      "UPDATE order_stages SET honor_jumlah = ?, honor_dibayar = ?, honor_status = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(newTotal, dibayarBaru, status, s.id);
    changed.push({ stageId: s.id, divisi: s.divisi, before: s.honor_jumlah, after: newTotal });
  }
  return changed;
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
