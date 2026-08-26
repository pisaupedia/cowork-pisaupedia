import { db } from '@/lib/db';
import { newId } from '@/lib/id';
import type { AuditLogRow } from '@/lib/types';

/**
 * Mencatat satu baris jejak audit — dipanggil dari Server Action setelah
 * perubahan yang sudah berhasil disimpan (bukan sebelum), supaya tidak ada
 * baris log untuk perubahan yang sebenarnya gagal. `detail` sebaiknya
 * ringkasan yang mudah dibaca manusia, misalnya:
 * "Deadline: 20 Agustus 2026 -> 25 Agustus 2026".
 */
export function logAudit(entry: {
  entityType: 'order' | 'stage' | 'approval' | 'vendor';
  entityId: string;
  action: string;
  detail?: string | null;
  oleh: string;
}): void {
  db.prepare(
    'INSERT INTO audit_log (id, entity_type, entity_id, action, detail, oleh) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(newId(), entry.entityType, entry.entityId, entry.action, entry.detail ?? null, entry.oleh);
}

/** Riwayat audit untuk satu pesanan — mencakup entri yang entity_id-nya
 * order itu sendiri MAUPUN salah satu tahapnya (karena tahap tidak berdiri
 * sendiri tanpa pesanan induknya secara tampilan). Terbaru di paling atas. */
export function listAuditLogForOrder(orderId: string, stageIds: string[]): AuditLogRow[] {
  if (stageIds.length === 0) {
    return db
      .prepare("SELECT * FROM audit_log WHERE entity_type = 'order' AND entity_id = ? ORDER BY created_at DESC")
      .all(orderId) as unknown as AuditLogRow[];
  }
  const placeholders = stageIds.map(() => '?').join(', ');
  return db
    .prepare(
      `SELECT * FROM audit_log
       WHERE (entity_type = 'order' AND entity_id = ?)
          OR (entity_type = 'stage' AND entity_id IN (${placeholders}))
          OR (entity_type = 'approval' AND entity_id = ?)
       ORDER BY created_at DESC`
    )
    .all(orderId, ...stageIds, orderId) as unknown as AuditLogRow[];
}
