import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { newId } from '@/lib/id';
import type { Role, UserRow } from '@/lib/types';

export function getUserByUsername(username: string): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined;
}

export function getUserById(id: string): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
}

export function listUsers(): UserRow[] {
  return db.prepare('SELECT * FROM users ORDER BY role ASC, name ASC').all() as unknown as UserRow[];
}

export function listUsersForVendor(vendorId: string): UserRow[] {
  return db.prepare('SELECT * FROM users WHERE vendor_id = ? ORDER BY username ASC').all(vendorId) as unknown as UserRow[];
}

export function createUser(opts: {
  username: string;
  password: string;
  name: string;
  role: Role;
  vendorId?: string | null;
}): UserRow {
  const id = newId();
  const passwordHash = bcrypt.hashSync(opts.password, 10);
  db.prepare(
    'INSERT INTO users (id, username, password_hash, name, role, vendor_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, opts.username, passwordHash, opts.name, opts.role, opts.vendorId ?? null);
  return getUserById(id) as UserRow;
}

export function verifyPassword(user: UserRow, password: string): boolean {
  return bcrypt.compareSync(password, user.password_hash);
}

/** Admin mengganti password akun (vendor lupa password, dll). Password baru
 * di-hash ulang di sini — tidak pernah disimpan dalam bentuk teks biasa. */
export function setPassword(userId: string, newPassword: string): void {
  const passwordHash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, userId);
}

/** Admin mengubah username dan/atau nama tampilan sebuah akun. */
export function updateUser(id: string, opts: { username: string; name: string }): void {
  db.prepare('UPDATE users SET username = ?, name = ? WHERE id = ?').run(opts.username, opts.name, id);
}

/** Hapus akun login. Sessions akun ini dihapus dulu (foreign key ke users),
 * tapi catatan lama (notes.penulis, attachments.oleh, design_photos.oleh)
 * hanya menyimpan nama sebagai teks biasa — bukan foreign key ke users —
 * jadi riwayat lama tetap tersimpan walau akunnya sudah dihapus. */
export function deleteUser(id: string): void {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}
