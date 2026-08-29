'use server';

import { promises as fs } from 'fs';
import path from 'path';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/session';
import { DELETE_CONFIRM_CODE } from '@/lib/constants';
import { uploadsDir } from '@/lib/db';
import { getOrderById, deleteOrder } from '@/lib/repo/orders';
import { listStagesForOrder } from '@/lib/repo/stages';
import { setFlash } from '@/lib/flash';

/**
 * Admin/owner menghapus satu pesanan secara permanen dari daftar "Perlu
 * Perhatian" di Dashboard — beserta seluruh tahap, catatan, lampiran, dan
 * foto desainnya (baris database maupun file fisiknya di folder
 * uploads/). Ini penghapusan permanen (bukan arsip), jadi memakai popup
 * kode konfirmasi yang sama seperti penghapusan lain di aplikasi ini
 * (lihat ConfirmDeleteButton) — kode divalidasi ulang di sini supaya
 * tidak bisa dilewati hanya dengan menonaktifkan JavaScript.
 */
export async function deleteOrderAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const confirmCode = String(formData.get('confirmCode') ?? '');
  if (confirmCode !== DELETE_CONFIRM_CODE) {
    await setFlash('error', 'Kode konfirmasi hapus salah.');
    return;
  }

  const orderId = String(formData.get('orderId') ?? '');
  const order = getOrderById(orderId);
  if (!order) {
    await setFlash('error', 'Pesanan tidak ditemukan.');
    return;
  }

  // Ambil dulu daftar stage ID-nya sebelum baris-baris di database dihapus,
  // supaya folder upload per tahap (uploads/<stageId>/) masih bisa ditemukan.
  const stageIds = listStagesForOrder(orderId).map((s) => s.id);

  deleteOrder(orderId);

  // Bersihkan folder fisiknya juga (lampiran per tahap & foto desain
  // pesanan ini). Kegagalan menghapus file (misalnya folder memang sudah
  // tidak ada) tidak boleh menggagalkan penghapusan data yang sudah
  // ter-commit di atas, jadi dibungkus catch masing-masing.
  await Promise.all([
    ...stageIds.map((stageId) =>
      fs.rm(path.join(uploadsDir(), stageId), { recursive: true, force: true }).catch(() => {})
    ),
    fs.rm(path.join(uploadsDir(), 'design', orderId), { recursive: true, force: true }).catch(() => {}),
  ]);

  revalidatePath('/dashboard');
  revalidatePath('/kanban');
  revalidatePath('/kalender');
  revalidatePath('/arsip');
}
