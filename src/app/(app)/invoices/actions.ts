'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/session';
import { deleteDocument } from '@/lib/repo/documents';
import { DELETE_CONFIRM_CODE } from '@/lib/constants';

export async function deleteDocumentAction(formData: FormData): Promise<void> {
  await requireAdmin();
  // Kode konfirmasi hapus (lihat ConfirmDeleteButton) divalidasi ulang di
  // sini supaya tidak bisa dilewati hanya dengan menonaktifkan JavaScript.
  const confirmCode = String(formData.get('confirmCode') ?? '');
  if (confirmCode !== DELETE_CONFIRM_CODE) throw new Error('Kode konfirmasi hapus salah.');
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('ID dokumen tidak valid.');
  deleteDocument(id);
  revalidatePath('/invoices');
  // Redirect selalu ke daftar dokumen — baik tombol Delete ini dipanggil
  // dari baris tabel /invoices (tidak berpindah halaman, hanya refresh)
  // maupun dari halaman lihat/edit /invoices/[id] (yang tanpa redirect ini
  // akan tetap menampilkan dokumen yang sudah tidak ada lagi).
  redirect('/invoices');
}
