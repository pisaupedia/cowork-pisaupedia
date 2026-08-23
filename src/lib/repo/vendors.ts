import { db } from '@/lib/db';
import { newId } from '@/lib/id';
import type { VendorRow } from '@/lib/types';

export function listVendors(): VendorRow[] {
  return db.prepare('SELECT * FROM vendors ORDER BY is_internal ASC, nama ASC').all() as unknown as VendorRow[];
}

export function listExternalVendors(): VendorRow[] {
  return db.prepare('SELECT * FROM vendors WHERE is_internal = 0 ORDER BY nama ASC').all() as unknown as VendorRow[];
}

export function getVendorById(id: string): VendorRow | undefined {
  return db.prepare('SELECT * FROM vendors WHERE id = ?').get(id) as VendorRow | undefined;
}

export function createVendor(nama: string, kontak: string | null, isInternal = false): VendorRow {
  const id = newId();
  db.prepare('INSERT INTO vendors (id, nama, kontak, is_internal) VALUES (?, ?, ?, ?)').run(
    id,
    nama,
    kontak,
    isInternal ? 1 : 0
  );
  return getVendorById(id) as VendorRow;
}

export function listUsernamesForVendor(vendorId: string): string[] {
  const rows = db.prepare('SELECT username FROM users WHERE vendor_id = ?').all(vendorId) as { username: string }[];
  return rows.map((r) => r.username);
}

export function updateVendor(id: string, nama: string, kontak: string | null): void {
  db.prepare('UPDATE vendors SET nama = ?, kontak = ? WHERE id = ?').run(nama, kontak, id);
}

/** Jumlah baris order_stages yang masih menugaskan vendor ini. Dipakai
 * sebagai pengaman sebelum hapus — vendor dengan tugas aktif tidak boleh
 * dihapus begitu saja (selain juga akan gagal karena foreign key). */
export function countStagesForVendor(id: string): number {
  const row = db.prepare('SELECT COUNT(*) AS n FROM order_stages WHERE vendor_id = ?').get(id) as { n: number };
  return row.n;
}

/** Hapus vendor beserta akun-akun login-nya. Hanya aman dipanggil setelah
 * memastikan countStagesForVendor(id) === 0 (dicek di action layer) —
 * kalau masih ada order_stages yang menugaskan vendor ini, hapus akan
 * gagal karena foreign key (order_stages.vendor_id REFERENCES vendors). */
export function deleteVendor(id: string): void {
  const userIds = (db.prepare('SELECT id FROM users WHERE vendor_id = ?').all(id) as { id: string }[]).map(
    (r) => r.id
  );
  for (const uid of userIds) {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(uid);
  }
  db.prepare('DELETE FROM users WHERE vendor_id = ?').run(id);
  db.prepare('DELETE FROM vendors WHERE id = ?').run(id);
}
