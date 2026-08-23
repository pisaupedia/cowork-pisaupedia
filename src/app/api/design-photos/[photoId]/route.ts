import fs from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { getDesignPhotoById } from '@/lib/repo/designPhotos';
import { buildOrderDetail } from '@/lib/view';
import { uploadsDir } from '@/lib/db';

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ photoId: string }> }
): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { photoId } = await params;
  const photo = getDesignPhotoById(photoId);
  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Pengecekan hak akses dipakai ulang dari buildOrderDetail (satu-satunya
  // jalur RLS di aplikasi ini) — mengembalikan null berarti user ini sama
  // sekali tidak berhak melihat pesanan ini (misal vendor yang tidak
  // ditugaskan di tahap manapun pada pesanan tersebut).
  const detail = buildOrderDetail(photo.order_id, user);
  if (!detail) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const fullPath = path.join(uploadsDir(), photo.file_path);
  let bytes: Buffer;
  try {
    bytes = await fs.readFile(fullPath);
  } catch {
    return NextResponse.json({ error: 'File tidak ditemukan di server.' }, { status: 404 });
  }

  const ext = path.extname(photo.file_path).toLowerCase();
  const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream';

  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(photo.nama)}"`,
      'Cache-Control': 'private, max-age=0, no-cache',
    },
  });
}
