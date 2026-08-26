'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/session';
import { getOrderById, setApprovalStatus, resubmitOrder } from '@/lib/repo/orders';
import { logAudit } from '@/lib/repo/auditLog';
import { setFlash } from '@/lib/flash';

export async function approveOrderAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const orderId = String(formData.get('orderId') ?? '');
  const order = getOrderById(orderId);
  if (!order || order.approval_status !== 'MENUNGGU') return;

  setApprovalStatus(orderId, 'DISETUJUI');
  logAudit({ entityType: 'approval', entityId: orderId, action: 'setuju', oleh: user.name });
  await setFlash('success', `Pesanan ${order.kode} disetujui dan resmi masuk produksi.`);
  revalidatePath('/approval');
  revalidatePath('/dashboard');
  revalidatePath('/kanban');
  revalidatePath('/kalender');
}

/** Menolak pesanan yang masih MENUNGGU approval — `alasan` WAJIB diisi
 * (validasi di form/HTML `required`, dicek ulang di sini) supaya pesanan
 * yang ditolak tidak jadi jalan buntu tanpa penjelasan: pengajunya bisa
 * membaca alasannya di halaman edit pesanan lalu mengajukan ulang lewat
 * resubmitOrderAction di bawah setelah merevisi. */
export async function rejectOrderAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const orderId = String(formData.get('orderId') ?? '');
  const alasan = String(formData.get('alasan') ?? '').trim();
  const order = getOrderById(orderId);
  if (!order || order.approval_status !== 'MENUNGGU') return;
  if (!alasan) throw new Error('Alasan penolakan wajib diisi.');

  setApprovalStatus(orderId, 'DITOLAK', alasan);
  logAudit({ entityType: 'approval', entityId: orderId, action: 'tolak', detail: alasan, oleh: user.name });
  await setFlash('success', `Pesanan ${order.kode} ditolak. Alasan tersimpan untuk pengajunya.`);
  revalidatePath('/approval');
}

/** Mengajukan ulang pesanan yang sebelumnya DITOLAK (dipanggil dari halaman
 * edit pesanan setelah admin merevisi datanya) — lihat resubmitOrder di
 * src/lib/repo/orders.ts. */
export async function resubmitOrderAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const orderId = String(formData.get('orderId') ?? '');
  const approvalNote = String(formData.get('approvalNote') ?? '').trim() || null;
  const order = getOrderById(orderId);
  if (!order) throw new Error('Pesanan tidak ditemukan.');
  if (order.approval_status !== 'DITOLAK') throw new Error('Hanya pesanan yang ditolak yang bisa diajukan ulang.');

  resubmitOrder(orderId, approvalNote);
  logAudit({ entityType: 'approval', entityId: orderId, action: 'ajukan_ulang', oleh: user.name });
  await setFlash('success', `Pesanan ${order.kode} diajukan ulang untuk ditinjau.`);
  revalidatePath('/approval');
  revalidatePath(`/orders/${orderId}`);
}
