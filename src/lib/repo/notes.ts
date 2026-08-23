import { db } from '@/lib/db';
import { newId } from '@/lib/id';
import type { NoteRow } from '@/lib/types';

export function listNotesForStage(stageId: string): NoteRow[] {
  return db
    .prepare('SELECT * FROM notes WHERE stage_id = ? ORDER BY created_at ASC')
    .all(stageId) as unknown as NoteRow[];
}

export function addNote(stageId: string, penulis: string, teks: string): NoteRow {
  const id = newId();
  db.prepare('INSERT INTO notes (id, stage_id, penulis, teks) VALUES (?, ?, ?, ?)').run(id, stageId, penulis, teks);
  return db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as unknown as NoteRow;
}
