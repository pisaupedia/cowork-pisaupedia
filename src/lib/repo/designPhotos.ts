import { db } from '@/lib/db';
import { newId } from '@/lib/id';
import type { DesignPhotoRow } from '@/lib/types';

export function listDesignPhotosForOrder(orderId: string): DesignPhotoRow[] {
  return db
    .prepare('SELECT * FROM design_photos WHERE order_id = ? ORDER BY created_at ASC')
    .all(orderId) as unknown as DesignPhotoRow[];
}

export function countDesignPhotosForOrder(orderId: string): number {
  const row = db.prepare('SELECT COUNT(*) AS n FROM design_photos WHERE order_id = ?').get(orderId) as {
    n: number;
  };
  return row.n;
}

export function getDesignPhotoById(id: string): DesignPhotoRow | undefined {
  return db.prepare('SELECT * FROM design_photos WHERE id = ?').get(id) as DesignPhotoRow | undefined;
}

export function addDesignPhoto(opts: { orderId: string; nama: string; filePath: string; oleh: string }): DesignPhotoRow {
  const id = newId();
  db.prepare('INSERT INTO design_photos (id, order_id, nama, file_path, oleh) VALUES (?, ?, ?, ?, ?)').run(
    id,
    opts.orderId,
    opts.nama,
    opts.filePath,
    opts.oleh
  );
  return getDesignPhotoById(id) as DesignPhotoRow;
}
