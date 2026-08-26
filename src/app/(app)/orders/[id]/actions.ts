'use server';

import path from 'node:path';
import fs from 'node:fs/promises';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser, requireAdmin } from '@/lib/session';
import { getStageById, setStageStatus, countAttachmentsForStage, reassignStageVendor } from '@/lib/repo/stages';
import { addAttachment } from '@/lib/repo/attachments';
import { addNote } from '@/lib/repo/notes';
import { recordHonorPayment, updateStageCosts } from '@/lib/repo/stages';
import { addDesignPhoto } from '@/lib/repo/designPhotos';
import { getOrderById, updateOrder, type UpdateOrderInput } from '@/lib/repo/orders';
import { getVendorById } from '@/lib/repo/vendors';
import { isStageOwn } from '@/lib/view';
import { uploadsDir } from '@/lib/db';
import { db } from '@/lib/db';
import { logAudit } from '@/lib/repo/auditLog';
import { formatRupiah, formatTanggal } from '@/lib/derive';
import { setFlash } from '@/lib/flash';

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

  await setFlash('success', `Tahap ${stage.divisi} ditandai selesai.`);
  revalidateOrder(stageId);
}

/** Admin mencatat pembayaran honor vendor untuk tahap ini — boleh berupa DP
 * (sebagian dari total) dan dipanggil berkali-kali sampai lunas, masing-
 * masing tercatat sebagai satu baris riwayat (dengan catatan opsional,
 * misalnya "DP"/"Pelunasan") — lihat recordHonorPayment di
 * src/lib/repo/stages.ts untuk akumulasi & pencatatan riwayatnya. */
export async function recordHonorPaymentAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (user.role !== 'ADMIN') throw new Error('Forbidden: khusus admin.');
  const stageId = String(formData.get('stageId') ?? '');
  const jumlahBayar = Number(formData.get('jumlahBayar') ?? 0);
  const catatan = String(formData.get('catatanBayar') ?? '').trim() || null;

  const stage = getStageById(stageId);
  if (!stage) throw new Error('Tahap tidak ditemukan.');
  if (!stage.vendor_id || stage.vendor_is_internal === 1) throw new Error('Tahap ini tidak memiliki honor vendor eksternal.');
  if (!Number.isFinite(jumlahBayar) || jumlahBayar <= 0) throw new Error('Jumlah pembayaran harus lebih dari 0.');
  if (stage.honor_dibayar >= stage.honor_jumlah) return;

  recordHonorPayment(stageId, jumlahBayar, catatan, user.name);
  await setFlash('success', `Pembayaran ${formatRupiah(jumlahBayar)} untuk tahap ${stage.divisi} berhasil dicatat.`);
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

  const next = {
    honorJumlah: honorRaw !== null ? Math.max(0, Number(honorRaw) || 0) : undefined,
    materialCost: materialRaw !== null ? Math.max(0, Number(materialRaw) || 0) : undefined,
    shippingCost: shippingRaw !== null ? Math.max(0, Number(shippingRaw) || 0) : undefined,
    extraCost: extraRaw !== null ? Math.max(0, Number(extraRaw) || 0) : undefined,
  };

  const changes: string[] = [];
  if (next.honorJumlah !== undefined && next.honorJumlah !== stage.honor_jumlah) {
    changes.push(`Honor Vendor: ${formatRupiah(stage.honor_jumlah)} -> ${formatRupiah(next.honorJumlah)}`);
  }
  if (next.materialCost !== undefined && next.materialCost !== stage.material_cost) {
    changes.push(`Harga Modal Material: ${formatRupiah(stage.material_cost)} -> ${formatRupiah(next.materialCost)}`);
  }
  if (next.shippingCost !== undefined && next.shippingCost !== stage.shipping_cost) {
    changes.push(`Harga Shipping: ${formatRupiah(stage.shipping_cost)} -> ${formatRupiah(next.shippingCost)}`);
  }
  if (next.extraCost !== undefined && next.extraCost !== stage.extra_cost) {
    changes.push(`Extra Cost: ${formatRupiah(stage.extra_cost)} -> ${formatRupiah(next.extraCost)}`);
  }

  updateStageCosts(stageId, next);

  if (changes.length > 0) {
    logAudit({
      entityType: 'stage',
      entityId: stageId,
      action: 'edit_biaya',
      detail: `${stage.divisi}: ${changes.join('; ')}`,
      oleh: user.name,
    });
  }

  await setFlash('success', 'Perubahan honor/harga modal berhasil disimpan.');
  revalidateOrder(stageId);
}

/** Admin memindahkan tugas satu tahap ke vendor lain (atau melepas
 * penugasan). Riwayat pembayaran & catatan tahap ini tidak berubah — lihat
 * reassignStageVendor di src/lib/repo/stages.ts. */
export async function reassignVendorAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const stageId = String(formData.get('stageId') ?? '');
  const newVendorId = String(formData.get('vendorId') ?? '').trim() || null;

  const stage = getStageById(stageId);
  if (!stage) throw new Error('Tahap tidak ditemukan.');

  const oldVendorName = stage.vendor_nama ?? '(belum ditugaskan)';
  const newVendor = newVendorId ? getVendorById(newVendorId) : null;
  if (newVendorId && !newVendor) throw new Error('Vendor tujuan tidak ditemukan.');
  const newVendorName = newVendor?.nama ?? '(dilepas, tidak ditugaskan)';

  if (stage.vendor_id === newVendorId) return;

  reassignStageVendor(stageId, newVendorId);
  logAudit({
    entityType: 'stage',
    entityId: stageId,
    action: 'ganti_vendor',
    detail: `${stage.divisi}: ${oldVendorName} -> ${newVendorName}`,
    oleh: user.name,
  });
  await setFlash('success', `Tahap ${stage.divisi} kini ditugaskan ke ${newVendorName}.`);
  revalidateOrder(stageId);
}

/** Admin mengubah data dasar pesanan (jenis, pelanggan, kontak, jumlah,
 * harga, tanggal masuk, deadline, catatan) — lihat updateOrder di
 * src/lib/repo/orders.ts. Setiap field yang benar-benar berubah dicatat ke
 * audit_log satu-satu supaya riwayatnya mudah dibaca. */
export async function updateOrderAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const orderId = String(formData.get('orderId') ?? '');
  const order = getOrderById(orderId);
  if (!order) throw new Error('Pesanan tidak ditemukan.');

  const input: UpdateOrderInput = {
    jenis: String(formData.get('jenis') ?? '').trim(),
    pelanggan: String(formData.get('pelanggan') ?? '').trim(),
    kontak: String(formData.get('kontak') ?? '').trim() || null,
    jumlah: Number(formData.get('jumlah') ?? 0),
    harga: Number(formData.get('harga') ?? 0),
    tanggalMasuk: String(formData.get('tanggalMasuk') ?? ''),
    deadline: String(formData.get('deadline') ?? ''),
    catatan: String(formData.get('catatan') ?? '').trim() || null,
  };

  if (!input.jenis || !input.pelanggan || !input.tanggalMasuk || !input.deadline) {
    throw new Error('Jenis pisau, nama pelanggan, tanggal masuk, dan deadline wajib diisi.');
  }
  if (!Number.isFinite(input.jumlah) || input.jumlah <= 0) {
    throw new Error('Jumlah unit harus lebih dari 0.');
  }
  if (!Number.isFinite(input.harga) || input.harga < 0) {
    throw new Error('Harga jual tidak boleh negatif.');
  }
  if (input.deadline < input.tanggalMasuk) {
    throw new Error('Deadline tidak boleh lebih awal dari tanggal masuk.');
  }

  const changes: string[] = [];
  if (input.jenis !== order.jenis) changes.push(`Jenis: ${order.jenis} -> ${input.jenis}`);
  if (input.pelanggan !== order.pelanggan) changes.push(`Pelanggan: ${order.pelanggan} -> ${input.pelanggan}`);
  if ((input.kontak ?? '') !== (order.kontak ?? '')) {
    changes.push(`Kontak: ${order.kontak ?? '—'} -> ${input.kontak ?? '—'}`);
  }
  if (input.jumlah !== order.jumlah) changes.push(`Jumlah: ${order.jumlah} -> ${input.jumlah}`);
  if (input.harga !== order.harga) changes.push(`Harga Jual: ${formatRupiah(order.harga)} -> ${formatRupiah(input.harga)}`);
  if (input.tanggalMasuk !== order.tanggal_masuk) {
    changes.push(`Tanggal Masuk: ${formatTanggal(order.tanggal_masuk)} -> ${formatTanggal(input.tanggalMasuk)}`);
  }
  if (input.deadline !== order.deadline) {
    changes.push(`Deadline: ${formatTanggal(order.deadline)} -> ${formatTanggal(input.deadline)}`);
  }
  if ((input.catatan ?? '') !== (order.catatan ?? '')) changes.push('Catatan/Rincian Pekerjaan diubah');

  updateOrder(orderId, input);

  if (changes.length > 0) {
    logAudit({ entityType: 'order', entityId: orderId, action: 'edit_pesanan', detail: changes.join('; '), oleh: user.name });
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath('/dashboard');
  revalidatePath('/kanban');
  revalidatePath('/kalender');
  revalidatePath('/arsip');
  // Halaman edit meredirect BALIK ke halaman detail pesanan — beda dari
  // aksi lain di aplikasi ini yang tetap di halaman yang sama (cukup
  // revalidatePath tanpa redirect), jadi notifikasi "berhasil disimpan" di
  // sini TIDAK dipasok lewat cookie flash (lihat src/lib/flash.ts) seperti
  // aksi lain — cookie yang diset lalu langsung redirect ke halaman LAIN
  // berisiko dibaca dari cache Next.js yang belum tahu soal cookie barunya
  // (layout di-cache per rute oleh router). Dipasok lewat query `?flash=`
  // sebagai gantinya (dibaca langsung oleh halaman tujuan, bukan lewat
  // cache) — lihat pemakaiannya di src/app/(app)/orders/[id]/page.tsx.
  redirect(`/orders/${orderId}?flash=${encodeURIComponent(`Pesanan ${order.kode} berhasil diperbarui.`)}`);
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

  await setFlash('success', `${files.length} foto desain berhasil ditambahkan.`);
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
