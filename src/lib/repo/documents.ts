import { db } from '@/lib/db';
import { newId } from '@/lib/id';
import { DOC_TYPE_PREFIX } from '@/lib/constants';
import { computeDocumentTotals } from '@/lib/docTotals';
import type { DocType, DocumentRow, DocumentItemRow, CurrencyCode } from '@/lib/types';

export function listDocuments(opts?: { type?: DocType; search?: string }): DocumentRow[] {
  const clauses: string[] = [];
  const params: string[] = [];
  if (opts?.type) {
    clauses.push('type = ?');
    params.push(opts.type);
  }
  if (opts?.search) {
    clauses.push('(nomor LIKE ? OR client_name LIKE ?)');
    const like = `%${opts.search}%`;
    params.push(like, like);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return db
    .prepare(`SELECT * FROM documents ${where} ORDER BY created_at DESC`)
    .all(...params) as unknown as DocumentRow[];
}

export function getDocumentById(id: string): DocumentRow | undefined {
  return db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as DocumentRow | undefined;
}

export function listDocumentItems(documentId: string): DocumentItemRow[] {
  return db
    .prepare('SELECT * FROM document_items WHERE document_id = ? ORDER BY urutan ASC')
    .all(documentId) as unknown as DocumentItemRow[];
}

/** Nomor urut & format nomor dokumen berikutnya untuk satu jenis dokumen (per-type, terpisah). */
export function nextDocumentNumber(type: DocType): { nomor: string; nomorUrut: number } {
  const row = db.prepare('SELECT MAX(nomor_urut) AS m FROM documents WHERE type = ?').get(type) as {
    m: number | null;
  };
  const nomorUrut = (row.m ?? 0) + 1;
  const nomor = DOC_TYPE_PREFIX[type] + String(nomorUrut).padStart(4, '0');
  return { nomor, nomorUrut };
}

export interface DocumentItemInput {
  deskripsi: string;
  qty: number;
  unit?: string | null;
  harga?: number;
  diskonPercent?: number;
  catatan?: string | null;
}

export interface DocumentInput {
  type: DocType;
  tanggal: string;
  dueDate?: string | null;
  clientName?: string | null;
  clientAddress?: string | null;
  clientContact?: string | null;
  currency?: CurrencyCode;
  overallDiscountPercent?: number;
  taxEnabled?: boolean;
  taxPercent?: number;
  notes?: string | null;
  bankInfo?: string | null;
  terms?: string | null;
  issuedBy?: string | null;
  driver?: string | null;
  senderName?: string | null;
  driverSign?: string | null;
  receiverName?: string | null;
  items: DocumentItemInput[];
}

/** Hitung ulang grand_total di server — jangan pernah percaya total yang dikirim client. */
function recomputeGrandTotal(input: DocumentInput): number {
  if (input.type === 'suratjalan') return 0;
  const { grand } = computeDocumentTotals(
    input.items.map((it) => ({ qty: it.qty, harga: it.harga, diskonPercent: it.diskonPercent })),
    input.overallDiscountPercent ?? 0,
    input.taxEnabled ?? true,
    input.taxPercent ?? 11
  );
  return Math.round(grand);
}

function insertItems(documentId: string, items: DocumentItemInput[]): void {
  items.forEach((it, i) => {
    db.prepare(
      `INSERT INTO document_items (id, document_id, urutan, deskripsi, qty, unit, harga, diskon_percent, catatan)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      newId(),
      documentId,
      i,
      it.deskripsi,
      it.qty,
      it.unit ?? null,
      it.harga ?? 0,
      it.diskonPercent ?? 0,
      it.catatan ?? null
    );
  });
}

/** Nomor & nomor_urut selalu dihitung ulang di server (bukan dari input client)
 * supaya tidak pernah bentrok/duplikat walau ada dua admin membuat dokumen bersamaan. */
export function createDocument(input: DocumentInput, createdBy: string): DocumentRow {
  const id = newId();
  const { nomor, nomorUrut } = nextDocumentNumber(input.type);
  const grandTotal = recomputeGrandTotal(input);

  db.prepare(
    `INSERT INTO documents (
      id, type, nomor, nomor_urut, tanggal, due_date, client_name, client_address, client_contact,
      currency, overall_discount_percent, tax_enabled, tax_percent, grand_total, notes, bank_info, terms,
      issued_by, driver, sender_name, driver_sign, receiver_name, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.type,
    nomor,
    nomorUrut,
    input.tanggal,
    input.dueDate ?? null,
    input.clientName ?? null,
    input.clientAddress ?? null,
    input.clientContact ?? null,
    input.currency ?? 'IDR',
    input.overallDiscountPercent ?? 0,
    input.taxEnabled === false ? 0 : 1,
    input.taxPercent ?? 11,
    grandTotal,
    input.notes ?? null,
    input.bankInfo ?? null,
    input.terms ?? null,
    input.issuedBy ?? null,
    input.driver ?? null,
    input.senderName ?? null,
    input.driverSign ?? null,
    input.receiverName ?? null,
    createdBy
  );

  insertItems(id, input.items);
  return getDocumentById(id) as DocumentRow;
}

/** Update dokumen yang sudah ada. Nomor & nomor_urut tidak diubah — hanya isi & item-nya. */
export function updateDocument(id: string, input: DocumentInput): void {
  const grandTotal = recomputeGrandTotal(input);

  db.prepare(
    `UPDATE documents SET
      tanggal = ?, due_date = ?, client_name = ?, client_address = ?, client_contact = ?,
      currency = ?, overall_discount_percent = ?, tax_enabled = ?, tax_percent = ?, grand_total = ?,
      notes = ?, bank_info = ?, terms = ?, issued_by = ?, driver = ?, sender_name = ?, driver_sign = ?,
      receiver_name = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    input.tanggal,
    input.dueDate ?? null,
    input.clientName ?? null,
    input.clientAddress ?? null,
    input.clientContact ?? null,
    input.currency ?? 'IDR',
    input.overallDiscountPercent ?? 0,
    input.taxEnabled === false ? 0 : 1,
    input.taxPercent ?? 11,
    grandTotal,
    input.notes ?? null,
    input.bankInfo ?? null,
    input.terms ?? null,
    input.issuedBy ?? null,
    input.driver ?? null,
    input.senderName ?? null,
    input.driverSign ?? null,
    input.receiverName ?? null,
    id
  );

  db.prepare('DELETE FROM document_items WHERE document_id = ?').run(id);
  insertItems(id, input.items);
}

export function deleteDocument(id: string): void {
  db.prepare('DELETE FROM document_items WHERE document_id = ?').run(id);
  db.prepare('DELETE FROM documents WHERE id = ?').run(id);
}

export interface DocumentStats {
  total: number;
  invoiceCount: number;
  suratJalanCount: number;
  quotationCount: number;
  totalInvoiceValue: number;
}

export function documentStats(): DocumentStats {
  const counts = db
    .prepare('SELECT type, COUNT(*) AS n FROM documents GROUP BY type')
    .all() as { type: DocType; n: number }[];
  const byType: Record<DocType, number> = { invoice: 0, quotation: 0, suratjalan: 0 };
  counts.forEach((c) => (byType[c.type] = c.n));

  const omzetRow = db
    .prepare("SELECT COALESCE(SUM(grand_total), 0) AS total FROM documents WHERE type = 'invoice'")
    .get() as { total: number };

  return {
    total: byType.invoice + byType.quotation + byType.suratjalan,
    invoiceCount: byType.invoice,
    suratJalanCount: byType.suratjalan,
    quotationCount: byType.quotation,
    totalInvoiceValue: omzetRow.total,
  };
}
