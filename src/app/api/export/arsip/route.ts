import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { buildArchivedOrdersList } from '@/lib/view';
import { buildCsv, csvResponse } from '@/lib/csv';

/** Export CSV daftar pesanan yang diarsipkan — menghormati filter pencarian
 * & rentang tanggal yang sama seperti di halaman Arsip (lihat
 * buildArchivedOrdersList di src/lib/view.ts, dipakai bersama). */
export async function GET(req: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get('q') ?? undefined;
  const dari = url.searchParams.get('dari') ?? undefined;
  const sampai = url.searchParams.get('sampai') ?? undefined;

  const rows = buildArchivedOrdersList({ q, dateFrom: dari, dateTo: sampai });
  const csv = buildCsv(
    ['Kode Pesanan', 'Jenis', 'Pelanggan', 'Jumlah Unit', 'Tanggal Diarsipkan'],
    rows.map((r) => [r.kode, r.jenis, r.pelanggan, r.jumlah, r.archivedAtRaw?.slice(0, 10) ?? ''])
  );

  return csvResponse(`arsip-pisaupedia-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
