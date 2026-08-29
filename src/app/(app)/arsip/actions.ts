'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/session';
import { getOrderById, archiveOrder, unarchiveOrder } from '@/lib/repo/orders';
import { listStagesForOrder } from '@/lib/repo/stages';
import { setFlash } from '@/lib/flash';

function revalidateAfterArchiveChange(orderId: string) {
  revalidatePath('/dashboard');
  revalidatePath('/kanban');
  revalidatePath('/kalender');
  revalidatePath('/arsip');
  revalidatePath(`/orders/${orderId}`);
}

/** Admin-only: memindahkan pesanan yang SUDAH SELESAI PENUH (semua tahap
 * berstatus SELESAI, termasuk tahap Selesai Produksi) ke Arsip. Dipanggil
 * dari tombol "Arsipkan" di papan Kanban, kolom "Selesai Produksi". Tidak
 * menghapus data apa pun — hanya menyembunyikan pesanan dari
 * dashboard/kanban/kalender (lihat listVisibleOrders di src/lib/view.ts). */
export async function archiveOrderAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const orderId = String(formData.get('orderId') ?? '');

  const order = getOrderById(orderId);
  if (!order) {
    await setFlash('error', 'Pesanan tidak ditemukan.');
    return;
  }

  const stages = listStagesForOrder(orderId);
  const isFullyComplete = stages.length > 0 && stages.every((s) => s.status === 'SELESAI');
  if (!isFullyComplete) {
    await setFlash('error', 'Hanya pesanan yang seluruh tahapnya sudah selesai yang bisa diarsipkan.');
    return;
  }

  archiveOrder(orderId);
  revalidateAfterArchiveChange(orderId);
}

/** Admin-only: mengembalikan pesanan dari Arsip ke tampilan aktif (dashboard/
 * kanban/kalender) — misalnya kalau ada yang salah klik "Arsipkan". */
export async function unarchiveOrderAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const orderId = String(formData.get('orderId') ?? '');

  const order = getOrderById(orderId);
  if (!order) {
    await setFlash('error', 'Pesanan tidak ditemukan.');
    return;
  }

  unarchiveOrder(orderId);
  revalidateAfterArchiveChange(orderId);
}
