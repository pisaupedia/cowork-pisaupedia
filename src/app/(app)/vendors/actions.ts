'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/session';
import { DELETE_CONFIRM_CODE } from '@/lib/constants';
import {
  createVendor,
  countStagesForVendor,
  deleteVendor,
  getVendorById,
  updateVendor,
} from '@/lib/repo/vendors';
import {
  createUser,
  deleteUser,
  getUserByUsername,
  getUserById,
  setPassword,
  updateUser,
} from '@/lib/repo/users';

export async function createVendorAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const nama = String(formData.get('nama') ?? '').trim();
  const kontak = String(formData.get('kontak') ?? '').trim() || null;
  const username = String(formData.get('username') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!nama || !username || password.length < 6) {
    throw new Error('Nama vendor, username, dan password (min. 6 karakter) wajib diisi.');
  }
  if (getUserByUsername(username)) {
    throw new Error('Username sudah dipakai.');
  }

  const vendor = createVendor(nama, kontak, false);
  createUser({ username, password, name: nama, role: 'VENDOR', vendorId: vendor.id });

  revalidatePath('/vendors');
}

/** Admin mereset password akun vendor yang lupa password-nya. Username tidak
 * berubah — vendor tetap login dengan username yang sama, hanya password
 * barunya yang perlu diberitahukan admin ke vendor secara langsung (WA/telepon/dll),
 * karena aplikasi ini tidak memiliki jalur email/SMS. */
export async function resetVendorPasswordAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const userId = String(formData.get('userId') ?? '');
  const newPassword = String(formData.get('newPassword') ?? '');

  if (newPassword.length < 6) {
    throw new Error('Password baru minimal 6 karakter.');
  }

  const user = getUserById(userId);
  if (!user || user.role !== 'VENDOR') {
    throw new Error('Akun vendor tidak ditemukan.');
  }

  setPassword(userId, newPassword);
  revalidatePath('/vendors');
}

/** Admin mengubah nama/kontak vendor. Nama dan kontak dibaca secara live di
 * seluruh aplikasi (bukan disalin/di-cache), jadi cukup update di sini. */
export async function updateVendorAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get('id') ?? '');
  const nama = String(formData.get('nama') ?? '').trim();
  const kontak = String(formData.get('kontak') ?? '').trim() || null;

  if (!id || !getVendorById(id)) throw new Error('Vendor tidak ditemukan.');
  if (!nama) throw new Error('Nama vendor wajib diisi.');

  updateVendor(id, nama, kontak);
  revalidatePath('/vendors');
}

/** Admin menghapus vendor beserta akun login-nya. Ditolak (dengan pesan
 * jelas) kalau vendor masih punya tugas order_stages aktif — vendor itu
 * harus dilepas dari semua tugas dulu sebelum bisa dihapus. */
export async function deleteVendorAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const confirmCode = String(formData.get('confirmCode') ?? '');
  if (confirmCode !== DELETE_CONFIRM_CODE) throw new Error('Kode konfirmasi hapus salah.');

  const id = String(formData.get('id') ?? '');
  const vendor = getVendorById(id);
  if (!vendor) throw new Error('Vendor tidak ditemukan.');

  const stageCount = countStagesForVendor(id);
  if (stageCount > 0) {
    throw new Error(
      `Vendor "${vendor.nama}" masih ditugaskan pada ${stageCount} tahap pesanan. Lepaskan dulu semua tugasnya sebelum menghapus vendor ini.`
    );
  }

  deleteVendor(id);
  revalidatePath('/vendors');
}

/** Admin mengubah username/nama akun vendor. Username tetap harus unik. */
export async function updateUserAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get('id') ?? '');
  const username = String(formData.get('username') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();

  const user = getUserById(id);
  if (!user || user.role !== 'VENDOR') throw new Error('Akun vendor tidak ditemukan.');
  if (!username || !name) throw new Error('Username dan nama wajib diisi.');

  const existing = getUserByUsername(username);
  if (existing && existing.id !== id) throw new Error('Username sudah dipakai.');

  updateUser(id, { username, name });
  revalidatePath('/vendors');
}

/** Admin menghapus akun login vendor (bukan vendornya, hanya akunnya).
 * Riwayat lama (catatan/lampiran/foto desain) tidak terpengaruh karena
 * hanya menyimpan nama sebagai teks, bukan foreign key ke akun ini. */
export async function deleteUserAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const confirmCode = String(formData.get('confirmCode') ?? '');
  if (confirmCode !== DELETE_CONFIRM_CODE) throw new Error('Kode konfirmasi hapus salah.');

  const id = String(formData.get('id') ?? '');
  const user = getUserById(id);
  if (!user || user.role !== 'VENDOR') throw new Error('Akun vendor tidak ditemukan.');

  deleteUser(id);
  revalidatePath('/vendors');
}
