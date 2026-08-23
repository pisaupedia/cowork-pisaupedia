import { db } from '@/lib/db';
import { newId } from '@/lib/id';
import type { AttachmentRow } from '@/lib/types';

export function listAttachmentsForStage(stageId: string): AttachmentRow[] {
  return db
    .prepare('SELECT * FROM attachments WHERE stage_id = ? ORDER BY created_at ASC')
    .all(stageId) as unknown as AttachmentRow[];
}

export function getAttachmentById(id: string): AttachmentRow | undefined {
  return db.prepare('SELECT * FROM attachments WHERE id = ?').get(id) as AttachmentRow | undefined;
}

export function addAttachment(opts: {
  stageId: string;
  nama: string;
  tipe: 'foto' | 'dokumen';
  filePath: string;
  oleh: string;
  pendingSync?: boolean;
}): AttachmentRow {
  const id = newId();
  db.prepare(
    'INSERT INTO attachments (id, stage_id, nama, tipe, file_path, oleh, pending_sync) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, opts.stageId, opts.nama, opts.tipe, opts.filePath, opts.oleh, opts.pendingSync ? 1 : 0);
  return getAttachmentById(id) as AttachmentRow;
}
