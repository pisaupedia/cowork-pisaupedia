'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/session';
import { getOrderById, setApprovalStatus } from '@/lib/repo/orders';

export async function approveOrderAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const orderId = String(formData.get('orderId') ?? '');
  const order = getOrderById(orderId);
  if (!order || order.approval_status !== 'MENUNGGU') return;

  setApprovalStatus(orderId, 'DISETUJUI');
  revalidatePath('/approval');
  revalidatePath('/dashboard');
  revalidatePath('/kanban');
  revalidatePath('/kalender');
}

export async function rejectOrderAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const orderId = String(formData.get('orderId') ?? '');
  const order = getOrderById(orderId);
  if (!order || order.approval_status !== 'MENUNGGU') return;

  setApprovalStatus(orderId, 'DITOLAK');
  revalidatePath('/approval');
}
