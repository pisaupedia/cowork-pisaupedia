'use server';

import path from 'node:path';
import fs from 'node:fs/promises';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/session';
import { getStageById, setStageStatus, countAttachmentsForStage } from '@/lib/repo/stages';
import { addAttachment } from '@/lib/repo/attachments';
import { addNote } from '@/lib/repo/notes';
import { setStageHonorPaid, updateStageCosts } from '@/lib/repo/stages';
import { addDesignPhoto } from '@/lib/repo/designPhotos';
import { getOrderById } from '@/lib/repo/orders';
import { isStageOwn } from '@/lib/view';
import { uploadsDir } from '@/lib/db';
import { db } from '@/lib/db';

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.txt', '.doc', '.docx']);
const ALLOWED_PHOTO_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function orderIdOfStage(stageId: string): string | null {
  const row = db.prepare('SELECT order_id FROM order_stages WHERE id = ?').get(stageId) as
    | { order_id: string }
    | undefined;
  return row?.order_id ?? null;
}

function revalidateOrder(stageId: string) {
  const orderId = orderIdOfStage(stageId);
  if (orderId) revalidatePath(`/orders/${orderId}`);
  revalidatePath('/dashboard');
  revalidatePath('/kanban');
}

export async function uploadAttachmentAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const stageId = String(formData.get('stageId') ?? '');
  const file = formData.get('file');

  const stage = getStageById(stageId);
  if (!stage) throw new Error('Tahap tidak ditemukan.');
  if (!isStageOwn(stage, user)) throw new Error('Forbidden: bukan tahap Anda.');
  if (stage.status !== 'BERJALAN') throw new Error('Tahap ini tidak sedang berjalan.');
  if (!(file instanceof File) || file.size === 0) throw new Error('File belum dipilih.');
  if (file.size > MAX_FILE_BYTES) throw new Error('Ukuran file maksimal 8MB.');

  const ext = path.extname(file.name).toLowerCase() || '.bin';
  if (!ALLOWED_EXT.has(ext)) throw new Error('Format file tidak didukung.');

  const tipe: 'foto' | 'dokumen' = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? 'foto' : 'dokumen';
  const stageDir = path.join(uploadsDir(), stageId);
  await fs.mkdir(stageDir, { recursive: true });
  const storedName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(stageDir, storedName), buffer);

  addAttachment({
    stageId,
    nama: file.name || storedName,
    tipe,
    filePath: path.join(stageId, storedName),
    oleh: user.name,
  });

  revalidateOrder(stageId);
}

export async function markCompleteAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const stageId = String(formData.get('stageId') ?? '');

  const stage = getStageById(stageId);
  if (!stage) throw new Error('Tahap tidak ditemukan.');
  if (!isStageOwn(stage, user)) throw new Error('Forbidden: bukan tahap Anda.');
  if (stage.status !== 'BERJALAN') throw new Error('Tahap ini tidak sedang berjalan.');

  const fotoCount = countAttachmentsForStage(stageId, 'foto');
  if (fotoCount < 1) throw new Error('Wajib unggah minimal satu foto bukti sebelum menandai tahap selesai.');

  setStageStatus(stageId, 'SELESAI');

  // buka tahap berikutnya di pesanan yang sama
  const next = db
    .prepare(
      "SELECT id FROM order_stages WHERE order_id = ? AND urutan = ? AND status = 'MENUNGGU'"
    )
    .get(stage.order_id, stage.urutan + 1) as { id: string } | undefined;
  if (next) setStageStatus(next.id, 'BERJALAN');

  revalidateOrder(stageId);
}

export async function markPaidAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (user.role !== 'ADMIN') throw new Error('Forbidden: khusus admin.');
  const stageId = String(formData.get('stageId') ?? '');

  const stage = getStageById(stageId);
  if (!stage) throw new Error('Tahap tidak ditemukan.');
  if (!stage.vendor_id || stage.vendor_is_internal === 1) throw new Error('Tahap ini tidak memiliki honor vendor eksternal.');
  if (stage.honor_status === 'SUDAH') return;

  setStageHonorPaid(stageId);
  revalidateOrder(stageId);
}

export async function updateStageCostAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (user.role !== 'ADMIN') throw new Error('Forbidden: khusus admin.');
  const stageId = String(formData.get('stageId') ?? '');

  const stage = getStageById(stageId);
  if (!stage) throw new Error('Tahap tidak ditemukan.');

  const honorRaw = formData.get('honorJumlah');
  const materialRaw = formData.get('materialCost');
  const shippingRaw = formData.get('shippingCost');
  const extraRaw = formData.get('extraCost');

  updateStageCosts(stageId, {
    honorJumlah: honorRaw !== null ? Number(honorRaw) || 0 : undefined,
    materialCost: materialRaw !== null ? Number(materialRaw) || 0 : undefined,
    shippingCost: shippingRaw !== null ? Number(shippingRaw) || 0 : undefined,
    extraCost: extraRaw !== null ? Number(extraRaw) || 0 : undefined,
  });

  revalidateOrder(stageId);
}

/** Admin-only: menambah foto desain pisau tambahan kapan saja setelah pesanan
 * dibuat (tidak ada minimal, berbeda dari saat pembuatan pesanan baru). Foto
 * ini langsung terlihat oleh semua divisi/vendor yang terlibat di pesanan
 * ini — lihat catatan di src/lib/schema.sql tabel `design_photos`. */
export async function addDesignPhotosAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (user.role !== 'ADMIN') throw new Error('Forbidden: khusus admin.');

  const orderId = String(formData.get('orderId') ?? '');
  const order = getOrderById(orderId);
  if (!order) throw new Error('Pesanan tidak ditemukan.');

  const files = formData.getAll('desainFoto').filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) throw new Error('Belum ada foto yang dipilih.');
  for (const file of files) {
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_PHOTO_EXT.has(ext)) throw new Error(`Format foto "${file.name}" tidak didukung — hanya jpg/jpeg/png/webp.`);
    if (file.size > MAX_FILE_BYTES) throw new Error(`Foto "${file.name}" lebih dari 8MB — kompres dulu sebelum diunggah.`);
  }

  const designDir = path.join(uploadsDir(), 'design', orderId);
  await fs.mkdir(designDir, { recursive: true });
  for (const file of files) {
    const ext = path.extname(file.name).toLowerCase();
    const storedName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(path.join(designDir, storedName), buffer);
    addDesignPhoto({
      orderId,
      nama: file.name || storedName,
      filePath: path.join('design', orderId, storedName),
      oleh: user.name,
    });
  }

  revalidatePath(`/orders/${orderId}`);
}

export async function addNoteAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const stageId = String(formData.get('stageId') ?? '');
  const teks = String(formData.get('teks') ?? '').trim();
  if (!teks) return;

  const stage = getStageById(stageId);
  if (!stage) throw new Error('Tahap tidak ditemukan.');
  if (!isStageOwn(stage, user)) throw new Error('Forbidden: bukan tahap Anda.');

  addNote(stageId, user.name, teks);
  revalidateOrder(stageId);
}
