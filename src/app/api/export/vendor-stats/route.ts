import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { buildVendorArchiveStats } from '@/lib/view';
import { buildCsv, csvResponse } from '@/lib/csv';

/** Export CSV statistik pembayaran vendor (dihitung dari pesanan yang sudah
 * diarsipkan — sama seperti panel "Statistik Pembayaran Vendor" di halaman Arsip). */
export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rows = buildVendorArchiveStats();
  const csv = buildCsv(
    ['Vendor', 'Jumlah Pesanan', 'Sudah Dibayar (Rp)', 'Belum Dibayar (Rp)'],
    rows.map((r) => [r.vendorNama, r.jumlahPesanan, r.totalSudahDibayar, r.totalBelumDibayar])
  );

  return csvResponse(`statistik-vendor-pisaupedia-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
