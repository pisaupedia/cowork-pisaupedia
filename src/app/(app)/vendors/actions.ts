'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/session';
import { DELETE_CONFIRM_CODE } from '@/lib/constants';
import { setFlash } from '@/lib/flash';
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
  countAdmins,
} from '@/lib/repo/users';

export async function createVendorAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const nama = String(formData.get('nama') ?? '').trim();
  const kontak = String(formData.get('kontak') ?? '').trim() || null;
  const username = String(formData.get('username') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!nama || !username || password.length < 6) {
    await setFlash('error', 'Nama vendor, username, dan password (min. 6 karakter) wajib diisi.');
    return;
  }
  if (getUserByUsername(username)) {
    await setFlash('error', 'Username sudah dipakai.');
    return;
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
    await setFlash('error', 'Password baru minimal 6 karakter.');
    return;
  }

  const user = getUserById(userId);
  if (!user || user.role !== 'VENDOR') {
    await setFlash('error', 'Akun vendor tidak ditemukan.');
    return;
  }

  setPassword(userId, newPassword);
  revalidatePath('/vendors');
}

/** Admin mengubah data vendor (nama/kontak) sekaligus akun login-nya
 * (username) dalam SATU form yang sama — karena setiap vendor hanya punya
 * satu akun (dibuat sekaligus saat vendor dibuat, lihat createVendorAction),
 * tidak perlu form Edit Vendor dan Edit Akun terpisah. "Nama Vendor" dan
 * "Nama Akun" juga digabung jadi SATU field ("Nama Vendor / Akun") — dulu
 * dua field terpisah yang bisa jadi tidak sinkron kalau hanya salah satu
 * diubah, padahal secara praktik keduanya selalu sama (lihat
 * createVendorAction: account.name diisi dari nama vendor saat dibuat).
 * Field akun (`userId`/`username`) opsional: kalau vendor ini belum/tidak
 * punya akun (misalnya akunnya sudah dihapus), form hanya mengirim field
 * vendor dan bagian akun dilewati. Nama dan kontak vendor dibaca secara
 * live di seluruh aplikasi (bukan disalin/di-cache), jadi cukup update
 * di sini. */
export async function updateVendorAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get('id') ?? '');
  const nama = String(formData.get('nama') ?? '').trim();
  const kontak = String(formData.get('kontak') ?? '').trim() || null;

  if (!id || !getVendorById(id)) {
    await setFlash('error', 'Vendor tidak ditemukan.');
    return;
  }
  if (!nama) {
    await setFlash('error', 'Nama vendor / akun wajib diisi.');
    return;
  }

  updateVendor(id, nama, kontak);

  const userId = String(formData.get('userId') ?? '');
  if (userId) {
    const username = String(formData.get('username') ?? '').trim();
    const user = getUserById(userId);
    if (!user || user.role !== 'VENDOR') {
      await setFlash('error', 'Akun vendor tidak ditemukan.');
      return;
    }
    if (!username) {
      await setFlash('error', 'Username wajib diisi.');
      return;
    }
    const existing = getUserByUsername(username);
    if (existing && existing.id !== userId) {
      await setFlash('error', 'Username sudah dipakai.');
      return;
    }
    // Nama akun disamakan dengan nama vendor (satu field, lihat catatan di atas).
    updateUser(userId, { username, name: nama });
  }

  revalidatePath('/vendors');
}

/** Admin menghapus vendor beserta akun login-nya. Ditolak (dengan pesan
 * jelas) kalau vendor masih punya tugas order_stages aktif — vendor itu
 * harus dilepas dari semua tugas dulu sebelum bisa dihapus. */
export async function deleteVendorAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const confirmCode = String(formData.get('confirmCode') ?? '');
  if (confirmCode !== DELETE_CONFIRM_CODE) {
    await setFlash('error', 'Kode konfirmasi hapus salah.');
    return;
  }

  const id = String(formData.get('id') ?? '');
  const vendor = getVendorById(id);
  if (!vendor) {
    await setFlash('error', 'Vendor tidak ditemukan.');
    return;
  }

  const stageCount = countStagesForVendor(id);
  if (stageCount > 0) {
    await setFlash(
      'error',
      `Vendor "${vendor.nama}" masih ditugaskan pada ${stageCount} tahap pesanan yang belum selesai. Selesaikan atau lepaskan dulu tugasnya sebelum menghapus vendor ini.`
    );
    return;
  }

  deleteVendor(id);
  revalidatePath('/vendors');
}

// Catatan: sebelumnya ada deleteUserAction terpisah untuk menghapus HANYA
// akun login vendor (menyisakan record vendornya) — dihapus karena membuat
// vendor & akunnya terasa seperti dua hal terpisah. Sekarang hanya ada SATU
// aksi hapus per vendor: deleteVendorAction di atas, yang menghapus vendor
// beserta akun login-nya sekaligus (lihat komentar di deleteVendorAction).

/** Membuat akun ADMIN baru — sebelumnya aplikasi ini hanya bisa punya SATU
 * admin tanpa jalan untuk membuat admin kedua dari dalam aplikasi, yang
 * berarti kalau satu-satunya admin lupa password/tidak bisa akses, seluruh
 * operasional bisa terhenti. Tidak ada batas jumlah admin. */
export async function createAdminAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const name = String(formData.get('name') ?? '').trim();
  const username = String(formData.get('username') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!name || !username || password.length < 6) {
    await setFlash('error', 'Nama, username, dan password (min. 6 karakter) wajib diisi.');
    return;
  }
  if (getUserByUsername(username)) {
    await setFlash('error', 'Username sudah dipakai.');
    return;
  }

  createUser({ username, password, name, role: 'ADMIN', vendorId: null });
  revalidatePath('/vendors');
}

export async function resetAdminPasswordAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const userId = String(formData.get('userId') ?? '');
  const newPassword = String(formData.get('newPassword') ?? '');
  if (newPassword.length < 6) {
    await setFlash('error', 'Password baru minimal 6 karakter.');
    return;
  }

  const user = getUserById(userId);
  if (!user || user.role !== 'ADMIN') {
    await setFlash('error', 'Akun admin tidak ditemukan.');
    return;
  }

  setPassword(userId, newPassword);
  revalidatePath('/vendors');
}

/** Menghapus akun ADMIN — DITOLAK kalau ini admin TERAKHIR yang tersisa,
 * supaya aplikasi tidak pernah berakhir tanpa satu pun admin yang bisa
 * login (yang berarti tidak ada yang bisa membuat admin baru lagi). */
export async function deleteAdminAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const confirmCode = String(formData.get('confirmCode') ?? '');
  if (confirmCode !== DELETE_CONFIRM_CODE) {
    await setFlash('error', 'Kode konfirmasi hapus salah.');
    return;
  }

  const id = String(formData.get('id') ?? '');
  const user = getUserById(id);
  if (!user || user.role !== 'ADMIN') {
    await setFlash('error', 'Akun admin tidak ditemukan.');
    return;
  }

  if (countAdmins() <= 1) {
    await setFlash('error', 'Tidak bisa menghapus admin terakhir — aplikasi harus selalu punya minimal satu akun admin.');
    return;
  }

  deleteUser(id);
  revalidatePath('/vendors');
}
