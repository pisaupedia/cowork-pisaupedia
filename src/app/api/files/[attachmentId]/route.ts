import fs from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { getAttachmentById } from '@/lib/repo/attachments';
import { getStageById } from '@/lib/repo/stages';
import { isStageOwn } from '@/lib/view';
import { uploadsDir } from '@/lib/db';

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ attachmentId: string }> }
): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { attachmentId } = await params;
  const attachment = getAttachmentById(attachmentId);
  if (!attachment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const stage = getStageById(attachment.stage_id);
  if (!stage || !isStageOwn(stage, user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const fullPath = path.join(uploadsDir(), attachment.file_path);
  let bytes: Buffer;
  try {
    bytes = await fs.readFile(fullPath);
  } catch {
    return NextResponse.json({ error: 'File tidak ditemukan di server.' }, { status: 404 });
  }

  const ext = path.extname(attachment.file_path).toLowerCase();
  const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream';

  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(attachment.nama)}"`,
      'Cache-Control': 'private, max-age=0, no-cache',
    },
  });
}
