import fs from 'node:fs/promises';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { autoBackupFilePath } from '@/lib/backup';

/** Mengunduh satu file backup OTOMATIS tertentu (lihat src/lib/backup.ts &
 * src/lib/scheduler.ts) — beda dari /api/backup/download yang selalu
 * mengambil snapshot database TERKINI. */
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }): Promise<Response> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { name } = await params;

  let filePath: string;
  try {
    filePath = autoBackupFilePath(name);
  } catch {
    return NextResponse.json({ error: 'Nama file tidak valid.' }, { status: 400 });
  }

  let bytes: Buffer;
  try {
    bytes = await fs.readFile(filePath);
  } catch {
    return NextResponse.json({ error: 'File backup tidak ditemukan.' }, { status: 404 });
  }

  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Content-Length': String(bytes.length),
      'Cache-Control': 'private, max-age=0, no-cache',
    },
  });
}
