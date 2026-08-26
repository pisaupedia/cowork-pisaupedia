/** Escape satu nilai untuk sel CSV (RFC 4180 sederhana): bungkus dengan
 * tanda kutip dua kalau mengandung koma/kutip/baris baru, dan kutip ganda
 * di dalamnya di-escape jadi dua kutip. */
function escapeCsvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Membangun teks CSV dari header + baris data. Ditambah BOM UTF-8 di awal
 * supaya Excel di Windows tidak salah menampilkan karakter non-ASCII. */
export function buildCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(escapeCsvCell).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCsvCell).join(','));
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}

export function csvResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, max-age=0, no-cache',
    },
  });
}
