import fs from 'node:fs/promises';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { dbFilePath } from '@/lib/db';
import { checkpointForBackup, backupFileName } from '@/lib/backup';

export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  checkpointForBackup();

  let bytes: Buffer;
  try {
    bytes = await fs.readFile(dbFilePath());
  } catch {
    return NextResponse.json({ error: 'Database belum ada di server.' }, { status: 404 });
  }

  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${backupFileName()}"`,
      'Content-Length': String(bytes.length),
      'Cache-Control': 'private, max-age=0, no-cache',
    },
  });
}
