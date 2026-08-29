'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/session';
import { getDocumentById, updateDocument, type DocumentItemInput } from '@/lib/repo/documents';
import type { CurrencyCode } from '@/lib/types';
import { setFlash } from '@/lib/flash';

function parseItems(raw: string): DocumentItemInput[] {
  let parsed: unknown[];
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Data item tidak valid.');
  }
  if (!Array.isArray(parsed)) throw new Error('Data item tidak valid.');
  return parsed
    .map((it) => {
      const r = it as Record<string, unknown>;
      return {
        deskripsi: String(r.deskripsi ?? '').trim(),
        qty: Number(r.qty) || 0,
        unit: r.unit ? String(r.unit) : null,
        harga: Number(r.harga) || 0,
        diskonPercent: Number(r.diskonPercent) || 0,
        catatan: r.catatan ? String(r.catatan) : null,
      };
    })
    .filter((it) => it.deskripsi.length > 0);
}

export async function updateDocumentAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get('id') ?? '');
  const existing = getDocumentById(id);
  if (!existing) {
    await setFlash('error', 'Dokumen tidak ditemukan.');
    return;
  }

  const type = existing.type;
  const tanggal = String(formData.get('tanggal') ?? '');
  if (!tanggal) {
    await setFlash('error', 'Tanggal wajib diisi.');
    return;
  }

  // parseItems melempar Error kalau JSON item rusak/tidak valid — ditangkap
  // di sini (bukan di dalam parseItems sendiri) supaya pesan errornya tetap
  // bisa ditampilkan lewat flash message, bukan layar error teknis.
  let items: DocumentItemInput[];
  try {
    items = parseItems(String(formData.get('itemsJson') ?? '[]'));
  } catch (err) {
    await setFlash('error', err instanceof Error ? err.message : 'Data item tidak valid.');
    return;
  }
  if (items.length === 0) {
    await setFlash('error', 'Minimal satu item harus diisi.');
    return;
  }

  updateDocument(id, {
    type,
    tanggal,
    dueDate: type === 'invoice' ? String(formData.get('dueDate') ?? '') || null : null,
    clientName: String(formData.get('clientName') ?? '').trim() || null,
    clientAddress: String(formData.get('clientAddress') ?? '').trim() || null,
    clientContact: String(formData.get('clientContact') ?? '').trim() || null,
    currency: (String(formData.get('currency') ?? existing.currency) as CurrencyCode) || 'IDR',
    overallDiscountPercent: Number(formData.get('overallDiscountPercent') ?? 0) || 0,
    taxEnabled: formData.get('taxEnabled') === 'on',
    taxPercent: Number(formData.get('taxPercent') ?? 11) || 0,
    notes: String(formData.get('notes') ?? '').trim() || null,
    bankInfo: type === 'invoice' ? String(formData.get('bankInfo') ?? '').trim() || null : null,
    terms: type === 'quotation' ? String(formData.get('terms') ?? '').trim() || null : null,
    issuedBy: type === 'quotation' ? String(formData.get('issuedBy') ?? '').trim() || null : null,
    driver: type === 'suratjalan' ? String(formData.get('driver') ?? '').trim() || null : null,
    senderName: type === 'suratjalan' ? String(formData.get('senderName') ?? '').trim() || null : null,
    driverSign: type === 'suratjalan' ? String(formData.get('driverSign') ?? '').trim() || null : null,
    receiverName: type === 'suratjalan' ? String(formData.get('receiverName') ?? '').trim() || null : null,
    items,
  });

  revalidatePath('/invoices');
  revalidatePath(`/invoices/${id}`);
  redirect(`/invoices/${id}`);
}
