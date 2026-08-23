'use server';

import path from 'node:path';
import fs from 'node:fs/promises';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/session';
import { createOrder } from '@/lib/repo/orders';
import { addDesignPhoto } from '@/lib/repo/designPhotos';
import { uploadsDir } from '@/lib/db';
import { DIVISIONS, type Divisi } from '@/lib/constants';

const MIN_DESIGN_PHOTOS = 3;
const MAX_DESIGN_PHOTO_BYTES = 8 * 1024 * 1024;
const ALLOWED_PHOTO_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

export async function createOrderAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();

  const desainFotoFiles = formData
    .getAll('desainFoto')
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (desainFotoFiles.length < MIN_DESIGN_PHOTOS) {
    throw new Error(
      `Wajib mengunggah minimal ${MIN_DESIGN_PHOTOS} foto desain pisau (baru terpilih ${desainFotoFiles.length}) — foto ini akan terlihat oleh semua divisi/vendor yang mengerjakan pesanan ini.`
    );
  }
  for (const file of desainFotoFiles) {
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_PHOTO_EXT.has(ext)) {
      throw new Error(`Format foto desain "${file.name}" tidak didukung — hanya jpg/jpeg/png/webp.`);
    }
    if (file.size > MAX_DESIGN_PHOTO_BYTES) {
      throw new Error(`Foto desain "${file.name}" lebih dari 8MB — kompres dulu sebelum diunggah.`);
    }
  }

  const jenis = String(formData.get('jenis') ?? '').trim();
  const pelanggan = String(formData.get('pelanggan') ?? '').trim();
  const kontak = String(formData.get('kontak') ?? '').trim() || null;
  const jumlah = Number(formData.get('jumlah') ?? 0);
  const harga = Number(formData.get('harga') ?? 0);
  const tanggalMasuk = String(formData.get('tanggalMasuk') ?? '');
  const deadline = String(formData.get('deadline') ?? '');
  const isCustom = formData.get('isCustom') === 'on';
  const approvalNote = String(formData.get('approvalNote') ?? '').trim() || null;

  if (!jenis || !pelanggan || !jumlah || !harga || !tanggalMasuk || !deadline) {
    throw new Error('Semua field wajib diisi.');
  }
  if (isCustom && !approvalNote) {
    throw new Error('Pesanan custom wajib punya catatan alasan untuk ditinjau admin.');
  }

  const vendorPerDivisi: Partial<Record<Divisi, string | null>> = {};
  const honorPerDivisi: Partial<Record<Divisi, number>> = {};
  for (const div of DIVISIONS) {
    const v = String(formData.get(`vendor_${div}`) ?? '').trim();
    vendorPerDivisi[div] = v || null;
    honorPerDivisi[div] = Number(formData.get(`honor_${div}`) ?? 0) || 0;
  }
  const materialCostBaja = Number(formData.get('materialCostBaja') ?? 0) || 0;
  const materialCostKayu = Number(formData.get('materialCostKayu') ?? 0) || 0;
  const shippingCost = Number(formData.get('shippingCost') ?? 0) || 0;
  const extraCost = Number(formData.get('extraCost') ?? 0) || 0;

  const order = createOrder({
    jenis, pelanggan, kontak, jumlah, harga, tanggalMasuk, deadline, isCustom, approvalNote, vendorPerDivisi,
    honorPerDivisi, materialCostBaja, materialCostKayu, shippingCost, extraCost,
  });

  const designDir = path.join(uploadsDir(), 'design', order.id);
  await fs.mkdir(designDir, { recursive: true });
  for (const file of desainFotoFiles) {
    const ext = path.extname(file.name).toLowerCase();
    const storedName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(path.join(designDir, storedName), buffer);
    addDesignPhoto({
      orderId: order.id,
      nama: file.name || storedName,
      filePath: path.join('design', order.id, storedName),
      oleh: user.name,
    });
  }

  revalidatePath('/dashboard');
  revalidatePath('/kanban');
  revalidatePath('/approval');
  redirect(`/orders/${order.id}`);
}
