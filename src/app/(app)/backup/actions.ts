'use server';

import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/session';
import { validateRestoreCandidate, restoreFromBuffer, RestoreValidationError } from '@/lib/backup';

export async function restoreBackupAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const confirmed = formData.get('confirm') === 'on';
  if (!confirmed) {
    redirect('/backup?error=confirm');
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    redirect('/backup?error=nofile');
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    validateRestoreCandidate(buffer);
  } catch (err) {
    if (err instanceof RestoreValidationError) {
      redirect(`/backup?error=invalid&msg=${encodeURIComponent(err.message)}`);
    }
    throw err;
  }

  restoreFromBuffer(buffer);

  // Restore mengganti seluruh tabel `sessions` — sesi admin yang sedang
  // login pun ikut tidak valid lagi di database yang baru dipulihkan, jadi
  // arahkan ke halaman login (bukan balik ke /backup, yang akan langsung
  // gagal di requireAdmin() karena sesinya sudah tidak ada).
  redirect('/login?restored=1');
}
