'use server';

import path from 'node:path';
import fs from 'node:fs/promises';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser, requireAdmin } from '@/lib/session';
import { getStageById, setStageStatus, countAttachmentsForStage, reassignStageVendor } from '@/lib/repo/stages';
import { addAttachment } from '@/lib/repo/attachments';
import { addNote } from '@/lib/repo/notes';
import {
  recordHonorPayment,
  updateStageCosts,
  listHonorPaymentsForStage,
  updateHonorPayment,
  deleteHonorPayment,
  recalcPerUnitHonorForOrder,
} from '@/lib/repo/stages';
import { addDesignPhoto } from '@/lib/repo/designPhotos';
import { getOrderById, updateOrder, type UpdateOrderInput } from '@/lib/repo/orders';
import { getVendorById } from '@/lib/repo/vendors';
import { isStageOwn } from '@/lib/view';
import { uploadsDir } from '@/lib/db';
import { db } from '@/lib/db';
import { logAudit } from '@/lib/repo/auditLog';
import { formatRupiah, formatTanggal } from '@/lib/derive';
import { setFlash } from '@/lib/flash';
import { DELETE_CONFIRM_CODE } from '@/lib/constants';

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
  if (!stage) {
    await setFlash('error', 'Tahap tidak ditemukan.');
    return;
  }
  if (!isStageOwn(stage, user)) {
    await setFlash('error', 'Forbidden: bukan tahap Anda.');
    return;
  }
  if (stage.status !== 'BERJALAN') {
    await setFlash('error', 'Tahap ini tidak sedang berjalan.');
    return;
  }
  if (!(file instanceof File) || file.size === 0) {
    await setFlash('error', 'File belum dipilih.');
    return;
  }
  if (file.size > MAX_FILE_BYTES) {
    await setFlash('error', 'Ukuran file maksimal 8MB.');
    return;
  }

  const ext = path.extname(file.name).toLowerCase() || '.bin';
  if (!ALLOWED_EXT.has(ext)) {
    await setFlash('error', 'Format file tidak didukung.');
    return;
  }

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
  if (!stage) {
    await setFlash('error', 'Tahap tidak ditemukan.');
    return;
  }
  if (!isStageOwn(stage, user)) {
    await setFlash('error', 'Forbidden: bukan tahap Anda.');
    return;
  }
  if (stage.status !== 'BERJALAN') {
    await setFlash('error', 'Tahap ini tidak sedang berjalan.');
    return;
  }

  const fotoCount = countAttachmentsForStage(stageId, 'foto');
  if (fotoCount < 1) {
    await setFlash('error', 'Wajib unggah minimal satu foto bukti sebelum menandai tahap selesai.');
    return;
  }

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
  if (user.role !== 'ADMIN') {
    await setFlash('error', 'Forbidden: khusus admin.');
    return;
  }
  const stageId = String(formData.get('stageId') ?? '');
  const jumlahBayar = Number(formData.get('jumlahBayar') ?? 0);
  const catatan = String(formData.get('catatanBayar') ?? '').trim() || null;

  const stage = getStageById(stageId);
  if (!stage) {
    await setFlash('error', 'Tahap tidak ditemukan.');
    return;
  }
  if (!stage.vendor_id || stage.vendor_is_internal === 1) {
    await setFlash('error', 'Tahap ini tidak memiliki honor vendor eksternal.');
    return;
  }
  if (!Number.isFinite(jumlahBayar) || jumlahBayar <= 0) {
    await setFlash('error', 'Jumlah pembayaran harus lebih dari 0.');
    return;
  }
  if (stage.honor_dibayar >= stage.honor_jumlah) return;

  recordHonorPayment(stageId, jumlahBayar, catatan, user.name);
  await setFlash('success', `Pembayaran ${formatRupiah(jumlahBayar)} untuk tahap ${stage.divisi} berhasil dicatat.`);
  revalidateOrder(stageId);
}

/** Admin mengoreksi SATU baris riwayat pembayaran yang sudah tercatat
 * (misalnya salah ketik nominal) — beda dari recordHonorPaymentAction di
 * atas yang menambah baris baru. Ditolak kalau nominal baru membuat total
 * pembayaran tahap ini melebihi honor total, supaya tidak pernah
 * "kelebihan bayar" secara diam-diam — lihat updateHonorPayment di
 * src/lib/repo/stages.ts untuk sinkronisasi honor_dibayar setelahnya. */
export async function editHonorPaymentAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (user.role !== 'ADMIN') {
    await setFlash('error', 'Forbidden: khusus admin.');
    return;
  }

  const stageId = String(formData.get('stageId') ?? '');
  const paymentId = String(formData.get('paymentId') ?? '');
  const jumlahRaw = Number(formData.get('jumlah') ?? 0);
  const catatan = String(formData.get('catatan') ?? '').trim() || null;

  const stage = getStageById(stageId);
  if (!stage) {
    await setFlash('error', 'Tahap tidak ditemukan.');
    return;
  }
  if (!Number.isFinite(jumlahRaw) || jumlahRaw <= 0) {
    await setFlash('error', 'Nominal harus lebih dari 0.');
    return;
  }

  const payments = listHonorPaymentsForStage(stageId);
  const target = payments.find((p) => p.id === paymentId);
  if (!target) {
    await setFlash('error', 'Riwayat pembayaran tidak ditemukan.');
    return;
  }

  const jumlahBaru = Math.round(jumlahRaw);
  const othersTotal = payments.filter((p) => p.id !== paymentId).reduce((sum, p) => sum + p.jumlah, 0);
  const totalBaru = othersTotal + jumlahBaru;
  if (totalBaru > stage.honor_jumlah) {
    await setFlash(
      'error',
      `Nominal ini membuat total pembayaran tahap (${formatRupiah(totalBaru)}) melebihi honor total (${formatRupiah(stage.honor_jumlah)}). Turunkan nominalnya, atau naikkan dulu Honor Vendor di panel Honor & Harga Modal.`
    );
    return;
  }

  updateHonorPayment(paymentId, jumlahBaru, catatan);
  logAudit({
    entityType: 'stage',
    entityId: stageId,
    action: 'edit_pembayaran',
    detail: `${stage.divisi}: koreksi riwayat pembayaran ${formatRupiah(target.jumlah)} -> ${formatRupiah(jumlahBaru)}`,
    oleh: user.name,
  });
  await setFlash('success', `Riwayat pembayaran tahap ${stage.divisi} berhasil diperbarui.`);
  revalidateOrder(stageId);
}

/** Admin menghapus SATU baris riwayat pembayaran yang salah/tidak jadi
 * (misalnya tercatat dua kali) — memakai kode konfirmasi yang sama dengan
 * tombol hapus lain di aplikasi ini (lihat ConfirmDeleteButton). */
export async function deleteHonorPaymentAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (user.role !== 'ADMIN') {
    await setFlash('error', 'Forbidden: khusus admin.');
    return;
  }

  const confirmCode = String(formData.get('confirmCode') ?? '');
  if (confirmCode !== DELETE_CONFIRM_CODE) {
    await setFlash('error', 'Kode konfirmasi hapus salah.');
    return;
  }

  const stageId = String(formData.get('stageId') ?? '');
  const paymentId = String(formData.get('paymentId') ?? '');

  const stage = getStageById(stageId);
  if (!stage) {
    await setFlash('error', 'Tahap tidak ditemukan.');
    return;
  }

  const payments = listHonorPaymentsForStage(stageId);
  const target = payments.find((p) => p.id === paymentId);
  if (!target) {
    await setFlash('error', 'Riwayat pembayaran tidak ditemukan.');
    return;
  }

  deleteHonorPayment(paymentId);
  logAudit({
    entityType: 'stage',
    entityId: stageId,
    action: 'hapus_pembayaran',
    detail: `${stage.divisi}: hapus riwayat pembayaran ${formatRupiah(target.jumlah)}${target.catatan ? ` (${target.catatan})` : ''}`,
    oleh: user.name,
  });
  await setFlash('success', `Riwayat pembayaran tahap ${stage.divisi} dihapus.`);
  revalidateOrder(stageId);
}

export async function updateStageCostAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (user.role !== 'ADMIN') {
    await setFlash('error', 'Forbidden: khusus admin.');
    return;
  }
  const stageId = String(formData.get('stageId') ?? '');

  const stage = getStageById(stageId);
  if (!stage) {
    await setFlash('error', 'Tahap tidak ditemukan.');
    return;
  }

  const honorRaw = formData.get('honorJumlah');
  const honorModeRaw = formData.get('honorMode');
  const honorRateRaw = formData.get('honorRate');
  const materialRaw = formData.get('materialCost');
  const shippingRaw = formData.get('shippingCost');
  const extraRaw = formData.get('extraCost');

  // Mode 'Per Unit': total honor DIHITUNG ULANG di sini (tarif × jumlah
  // pesanan), bukan dipercaya dari field tersembunyi yang dikirim client —
  // supaya tetap benar walau JavaScript nonaktif atau field itu disunting
  // manual lewat devtools (lihat HonorModeField), dan supaya honor_rate yang
  // tersimpan selalu konsisten dengan honor_jumlah (dipakai lagi nanti oleh
  // recalcPerUnitHonorForOrder kalau jumlah pesanan berubah).
  let honorMode: 'BORONGAN' | 'PER_UNIT' | undefined;
  let honorRate: number | undefined;
  let honorJumlah: number | undefined;
  if (honorModeRaw === 'PER_UNIT' || honorModeRaw === 'BORONGAN') {
    honorMode = honorModeRaw;
    honorRate = Math.max(0, Number(honorRateRaw) || 0);
    if (honorMode === 'PER_UNIT') {
      const order = getOrderById(stage.order_id);
      honorJumlah = Math.max(0, Math.round(honorRate * (order?.jumlah ?? 0)));
    } else {
      honorJumlah = honorRaw !== null ? Math.max(0, Number(honorRaw) || 0) : undefined;
    }
  } else if (honorRaw !== null) {
    honorJumlah = Math.max(0, Number(honorRaw) || 0);
  }

  const next = {
    honorJumlah,
    honorMode,
    honorRate,
    materialCost: materialRaw !== null ? Math.max(0, Number(materialRaw) || 0) : undefined,
    shippingCost: shippingRaw !== null ? Math.max(0, Number(shippingRaw) || 0) : undefined,
    extraCost: extraRaw !== null ? Math.max(0, Number(extraRaw) || 0) : undefined,
  };

  const changes: string[] = [];
  if (next.honorJumlah !== undefined && next.honorJumlah !== stage.honor_jumlah) {
    const modeLabel =
      honorMode === 'PER_UNIT' ? ` (Per Unit @ ${formatRupiah(honorRate ?? 0)}/pcs)` : honorMode === 'BORONGAN' ? ' (Borongan)' : '';
    changes.push(`Honor Vendor${modeLabel}: ${formatRupiah(stage.honor_jumlah)} -> ${formatRupiah(next.honorJumlah)}`);
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
  if (!stage) {
    await setFlash('error', 'Tahap tidak ditemukan.');
    return;
  }

  const oldVendorName = stage.vendor_nama ?? '(belum ditugaskan)';
  const newVendor = newVendorId ? getVendorById(newVendorId) : null;
  if (newVendorId && !newVendor) {
    await setFlash('error', 'Vendor tujuan tidak ditemukan.');
    return;
  }
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
  if (!order) {
    await setFlash('error', 'Pesanan tidak ditemukan.');
    return;
  }

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
    await setFlash('error', 'Jenis pisau, nama pelanggan, tanggal masuk, dan deadline wajib diisi.');
    return;
  }
  if (!Number.isFinite(input.jumlah) || input.jumlah <= 0) {
    await setFlash('error', 'Jumlah unit harus lebih dari 0.');
    return;
  }
  if (!Number.isFinite(input.harga) || input.harga < 0) {
    await setFlash('error', 'Harga jual tidak boleh negatif.');
    return;
  }
  if (input.deadline < input.tanggalMasuk) {
    await setFlash('error', 'Deadline tidak boleh lebih awal dari tanggal masuk.');
    return;
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

  // Jumlah pesanan berubah -> honor tahap bermode Per Unit (tarif per pcs)
  // dihitung ulang otomatis (Opsi 1 dari rancangan yang disepakati) supaya
  // totalnya selalu konsisten dengan jumlah terkini — lihat
  // recalcPerUnitHonorForOrder di src/lib/repo/stages.ts. Tahap Borongan
  // tidak tersentuh. Setiap tahap yang berubah dicatat ke audit_log
  // tersendiri (action 'edit_biaya', konsisten dengan updateStageCostAction)
  // dan admin diberi tahu lewat pesan sukses supaya perubahan nominal honor
  // ini tidak lewat tanpa disadari.
  let honorRecalcNote = '';
  if (input.jumlah !== order.jumlah) {
    const recalced = recalcPerUnitHonorForOrder(orderId, input.jumlah);
    for (const r of recalced) {
      logAudit({
        entityType: 'stage',
        entityId: r.stageId,
        action: 'edit_biaya',
        detail: `${r.divisi}: Honor Vendor (Per Unit, jumlah pesanan berubah jadi ${input.jumlah}) ${formatRupiah(r.before)} -> ${formatRupiah(r.after)}`,
        oleh: user.name,
      });
    }
    if (recalced.length > 0) {
      honorRecalcNote = ` Honor pada ${recalced.length} tahap (mode Per Unit) turut disesuaikan mengikuti jumlah baru.`;
    }
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
  // Error di atas TIDAK melalui jalur ini — validasi gagal berarti `return`
  // sebelum baris ini, jadi tetap di halaman edit (tidak redirect), dan
  // flash cookie ('error') aman dibaca di sana seperti aksi lain.
  redirect(`/orders/${orderId}?flash=${encodeURIComponent(`Pesanan ${order.kode} berhasil diperbarui.${honorRecalcNote}`)}`);
}

/** Admin-only: menambah foto desain pisau tambahan kapan saja setelah pesanan
 * dibuat (tidak ada minimal, berbeda dari saat pembuatan pesanan baru). Foto
 * ini langsung terlihat oleh semua divisi/vendor yang terlibat di pesanan
 * ini — lihat catatan di src/lib/schema.sql tabel `design_photos`. */
export async function addDesignPhotosAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (user.role !== 'ADMIN') {
    await setFlash('error', 'Forbidden: khusus admin.');
    return;
  }

  const orderId = String(formData.get('orderId') ?? '');
  const order = getOrderById(orderId);
  if (!order) {
    await setFlash('error', 'Pesanan tidak ditemukan.');
    return;
  }

  const files = formData.getAll('desainFoto').filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) {
    await setFlash('error', 'Belum ada foto yang dipilih.');
    return;
  }
  for (const file of files) {
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_PHOTO_EXT.has(ext)) {
      await setFlash('error', `Format foto "${file.name}" tidak didukung — hanya jpg/jpeg/png/webp.`);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      await setFlash('error', `Foto "${file.name}" lebih dari 8MB — kompres dulu sebelum diunggah.`);
      return;
    }
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
  if (!stage) {
    await setFlash('error', 'Tahap tidak ditemukan.');
    return;
  }
  if (!isStageOwn(stage, user)) {
    await setFlash('error', 'Forbidden: bukan tahap Anda.');
    return;
  }

  addNote(stageId, user.name, teks);
  revalidateOrder(stageId);
}
