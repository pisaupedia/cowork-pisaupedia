import fs from 'node:fs';
import path from 'node:path';
import { db, uploadsDir } from '@/lib/db';
import { createVendor } from '@/lib/repo/vendors';
import { createUser } from '@/lib/repo/users';
import { createOrder } from '@/lib/repo/orders';
import { listStagesForOrder } from '@/lib/repo/stages';
import { addNote } from '@/lib/repo/notes';
import { addAttachment } from '@/lib/repo/attachments';
import type { Divisi } from '@/lib/constants';

// PNG 1x1 transparan — dipakai sebagai file foto contoh supaya rute
// penyajian file (/api/files/[id]) punya berkas nyata untuk disajikan.
const PLACEHOLDER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

function daysFromNow(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function round1000(n: number): number {
  return Math.round(n / 1000) * 1000;
}

/** Contoh honor manual per divisi (kira-kira 30/30/25% dari harga jual — sekadar angka contoh masuk akal, bukan rumus otomatis). */
function contohHonor(harga: number): Partial<Record<Divisi, number>> {
  return {
    'Cutting & Blacksmith': round1000(harga * 0.3),
    'Shaping & Heat Threatment': round1000(harga * 0.3),
    'Handle & Cover': round1000(harga * 0.25),
    'Selesai Produksi': 0,
  };
}

function writePlaceholderFile(stageId: string, filename: string, kind: 'foto' | 'dokumen'): string {
  const dir = path.join(uploadsDir(), stageId);
  fs.mkdirSync(dir, { recursive: true });
  const full = path.join(dir, filename);
  if (kind === 'foto') {
    fs.writeFileSync(full, PLACEHOLDER_PNG);
  } else {
    fs.writeFileSync(full, `Dokumen contoh (seed data): ${filename}\n`);
  }
  return path.join(stageId, filename);
}

function stageOf(orderId: string, divisi: Divisi) {
  const stage = listStagesForOrder(orderId).find((s) => s.divisi === divisi);
  if (!stage) throw new Error(`Seed: tahap ${divisi} tidak ditemukan untuk order ${orderId}`);
  return stage;
}

function setStage(
  stageId: string,
  opts: { status?: 'MENUNGGU' | 'BERJALAN' | 'SELESAI'; honorStatus?: 'BELUM' | 'SUDAH' }
) {
  if (opts.status) {
    db.prepare("UPDATE order_stages SET status = ?, updated_at = datetime('now') WHERE id = ?").run(
      opts.status,
      stageId
    );
  }
  if (opts.honorStatus) {
    db.prepare(
      "UPDATE order_stages SET honor_status = ?, honor_tanggal_bayar = CASE WHEN ? = 'SUDAH' THEN datetime('now') ELSE NULL END WHERE id = ?"
    ).run(opts.honorStatus, opts.honorStatus, stageId);
  }
}

export function isSeeded(): boolean {
  const row = db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
  return row.n > 0;
}

export function runSeed(): void {
  if (isSeeded()) return;

  // --- Vendors -------------------------------------------------------
  const internal = createVendor('Tim Internal Produksi', null, true);
  const tajamAbadi = createVendor('Vendor Tajam Abadi', '0811-1111-0001');
  const bajaNusantara = createVendor('UD Baja Nusantara', '0811-1111-0002');
  const ajiLogam = createVendor('CV Aji Logam Perkasa', '0811-1111-0003');
  const kilauSempurna = createVendor('CV Kilau Sempurna', '0811-1111-0004');
  const kayuJati = createVendor('Vendor Kayu Jati Makmur', '0811-1111-0005');
  const sarungKulit = createVendor('UD Sarung Kulit Prima', '0811-1111-0006');

  // --- Users -----------------------------------------------------------
  createUser({ username: 'pisaupedia2026', password: 'Gyuto240mm', name: 'Admin Pisaupedia', role: 'ADMIN' });
  createUser({ username: 'tajamabadi', password: 'vendor123', name: 'Vendor Tajam Abadi', role: 'VENDOR', vendorId: tajamAbadi.id });
  createUser({ username: 'bajanusantara', password: 'vendor123', name: 'UD Baja Nusantara', role: 'VENDOR', vendorId: bajaNusantara.id });
  createUser({ username: 'ajilogam', password: 'vendor123', name: 'CV Aji Logam Perkasa', role: 'VENDOR', vendorId: ajiLogam.id });
  createUser({ username: 'kilausempurna', password: 'vendor123', name: 'CV Kilau Sempurna', role: 'VENDOR', vendorId: kilauSempurna.id });
  createUser({ username: 'kayujati', password: 'vendor123', name: 'Vendor Kayu Jati Makmur', role: 'VENDOR', vendorId: kayuJati.id });
  createUser({ username: 'sarungkulit', password: 'vendor123', name: 'UD Sarung Kulit Prima', role: 'VENDOR', vendorId: sarungKulit.id });

  const V = {
    internal: internal.id,
    tajamAbadi: tajamAbadi.id,
    bajaNusantara: bajaNusantara.id,
    ajiLogam: ajiLogam.id,
    kilauSempurna: kilauSempurna.id,
    kayuJati: kayuJati.id,
    sarungKulit: sarungKulit.id,
  };

  // --- Orders ------------------------------------------------------------
  // 1) Golok-014 — mendekati deadline, satu tahap selesai tapi honor belum dibayar (demo)
  const o1 = createOrder({
    jenis: 'Golok', pelanggan: 'Toko Sumber Rejeki', kontak: '0812-3456-7890', jumlah: 20, harga: 9_000_000,
    tanggalMasuk: daysFromNow(-35), deadline: daysFromNow(3), isCustom: false, approvalNote: null,
    vendorPerDivisi: {
      'Cutting & Blacksmith': V.tajamAbadi, 'Shaping & Heat Threatment': V.tajamAbadi,
      'Handle & Cover': V.kayuJati, 'Selesai Produksi': V.internal,
    },
    honorPerDivisi: contohHonor(9_000_000),
    materialCostBaja: 1_800_000,
    materialCostKayu: 950_000,
    shippingCost: 250_000,
    extraCost: 100_000,
  });
  {
    const s0 = stageOf(o1.id, 'Cutting & Blacksmith');
    const s1 = stageOf(o1.id, 'Shaping & Heat Threatment');
    setStage(s0.id, { status: 'SELESAI', honorStatus: 'BELUM' });
    setStage(s1.id, { status: 'BERJALAN' });
    addNote(s0.id, 'Vendor Tajam Abadi', 'Bahan baja sudah ditempa sesuai pola golok standar.');
    addNote(s0.id, 'Vendor Tajam Abadi', 'Selesai ditempa, 20 unit siap diserahkan ke Shaping.');
    addAttachment({ stageId: s0.id, nama: 'foto_hasil_tempa_golok014.jpg', tipe: 'foto', oleh: 'Vendor Tajam Abadi', filePath: writePlaceholderFile(s0.id, 'foto_hasil_tempa_golok014.jpg', 'foto') });
    addNote(s1.id, 'Vendor Tajam Abadi', 'Proses pengasahan awal selesai untuk 12 dari 20 unit.');
    addAttachment({ stageId: s1.id, nama: 'foto_progres_asah_golok014.jpg', tipe: 'foto', oleh: 'Vendor Tajam Abadi', filePath: writePlaceholderFile(s1.id, 'foto_progres_asah_golok014.jpg', 'foto') });
    addAttachment({ stageId: s1.id, nama: 'hasil_uji_kekerasan_golok014.txt', tipe: 'dokumen', oleh: 'Vendor Tajam Abadi', filePath: writePlaceholderFile(s1.id, 'hasil_uji_kekerasan_golok014.txt', 'dokumen') });
  }

  // 2) Parang-015 — terlambat, satu tahap sudah dibayar honornya
  const o2 = createOrder({
    jenis: 'Parang', pelanggan: 'Bpk. Hendra Wijaya', kontak: '0813-9988-2211', jumlah: 10, harga: 5_500_000,
    tanggalMasuk: daysFromNow(-30), deadline: daysFromNow(-2), isCustom: false, approvalNote: null,
    vendorPerDivisi: {
      'Cutting & Blacksmith': V.bajaNusantara, 'Shaping & Heat Threatment': V.tajamAbadi,
      'Handle & Cover': V.sarungKulit, 'Selesai Produksi': V.internal,
    },
    honorPerDivisi: contohHonor(5_500_000),
  });
  {
    const s0 = stageOf(o2.id, 'Cutting & Blacksmith');
    const s1 = stageOf(o2.id, 'Shaping & Heat Threatment');
    setStage(s0.id, { status: 'SELESAI', honorStatus: 'SUDAH' });
    setStage(s1.id, { status: 'BERJALAN' });
    addAttachment({ stageId: s0.id, nama: 'foto_hasil_tempa_parang015.jpg', tipe: 'foto', oleh: 'UD Baja Nusantara', filePath: writePlaceholderFile(s0.id, 'foto_hasil_tempa_parang015.jpg', 'foto') });
  }

  // 3) Pisau Dapur-016 — masih di tahap awal, contoh lampiran offline (menunggu sinkronisasi)
  const o3 = createOrder({
    jenis: 'Pisau Dapur', pelanggan: 'CV Dapur Nusantara', kontak: '0821-4455-6677', jumlah: 50, harga: 7_500_000,
    tanggalMasuk: daysFromNow(-10), deadline: daysFromNow(20), isCustom: false, approvalNote: null,
    vendorPerDivisi: {
      'Cutting & Blacksmith': V.ajiLogam, 'Shaping & Heat Threatment': V.kilauSempurna,
      'Handle & Cover': V.kayuJati, 'Selesai Produksi': V.internal,
    },
    honorPerDivisi: contohHonor(7_500_000),
  });
  {
    const s0 = stageOf(o3.id, 'Cutting & Blacksmith');
    addAttachment({ stageId: s0.id, nama: 'foto_progres_dapur016.jpg', tipe: 'foto', oleh: 'CV Aji Logam Perkasa', filePath: writePlaceholderFile(s0.id, 'foto_progres_dapur016.jpg', 'foto') });
    addAttachment({ stageId: s0.id, nama: 'foto_bukti_tempa_dapur016_offline.jpg', tipe: 'foto', oleh: 'CV Aji Logam Perkasa', pendingSync: true, filePath: writePlaceholderFile(s0.id, 'foto_bukti_tempa_dapur016_offline.jpg', 'foto') });
  }

  // 4) Golok-017 — awal tahap, mendekati deadline
  createOrder({
    jenis: 'Golok', pelanggan: 'Toko Rimba Jaya', kontak: '0852-1122-3344', jumlah: 15, harga: 6_750_000,
    tanggalMasuk: daysFromNow(-8), deadline: daysFromNow(5), isCustom: false, approvalNote: null,
    vendorPerDivisi: {
      'Cutting & Blacksmith': V.bajaNusantara, 'Shaping & Heat Threatment': V.tajamAbadi,
      'Handle & Cover': V.sarungKulit, 'Selesai Produksi': V.internal,
    },
    honorPerDivisi: contohHonor(6_750_000),
  });

  // 5) Pisau Buruh-018 — sudah di tahap ke-3, ada foto progres
  const o5 = createOrder({
    jenis: 'Pisau Buruh', pelanggan: 'Koperasi Tani Makmur', kontak: '0857-6543-2100', jumlah: 30, harga: 4_500_000,
    tanggalMasuk: daysFromNow(-20), deadline: daysFromNow(0), isCustom: false, approvalNote: null,
    vendorPerDivisi: {
      'Cutting & Blacksmith': V.ajiLogam, 'Shaping & Heat Threatment': V.kilauSempurna,
      'Handle & Cover': V.kayuJati, 'Selesai Produksi': V.internal,
    },
    honorPerDivisi: contohHonor(4_500_000),
    materialCostBaja: 900_000,
    materialCostKayu: 480_000,
  });
  {
    const s0 = stageOf(o5.id, 'Cutting & Blacksmith');
    const s1 = stageOf(o5.id, 'Shaping & Heat Threatment');
    const s2 = stageOf(o5.id, 'Handle & Cover');
    setStage(s0.id, { status: 'SELESAI', honorStatus: 'SUDAH' });
    setStage(s1.id, { status: 'SELESAI', honorStatus: 'SUDAH' });
    setStage(s2.id, { status: 'BERJALAN' });
    addNote(s2.id, 'Vendor Kayu Jati Makmur', 'Bahan kayu jati untuk 30 pegangan sudah dipotong dan dihaluskan.');
    addNote(s2.id, 'Vendor Kayu Jati Makmur', '22 dari 30 unit selesai pemasangan handle, sisanya menyusul besok.');
    addAttachment({ stageId: s2.id, nama: 'foto_progres_handle_buruh018.jpg', tipe: 'foto', oleh: 'Vendor Kayu Jati Makmur', filePath: writePlaceholderFile(s2.id, 'foto_progres_handle_buruh018.jpg', 'foto') });
  }

  // 6) Golok-019
  const o6 = createOrder({
    jenis: 'Golok', pelanggan: 'Toko Sumber Rejeki', kontak: '0812-3456-7890', jumlah: 5, harga: 2_250_000,
    tanggalMasuk: daysFromNow(-12), deadline: daysFromNow(25), isCustom: false, approvalNote: null,
    vendorPerDivisi: {
      'Cutting & Blacksmith': V.bajaNusantara, 'Shaping & Heat Threatment': V.tajamAbadi,
      'Handle & Cover': V.sarungKulit, 'Selesai Produksi': V.internal,
    },
    honorPerDivisi: contohHonor(2_250_000),
  });
  {
    const s0 = stageOf(o6.id, 'Cutting & Blacksmith');
    const s1 = stageOf(o6.id, 'Shaping & Heat Threatment');
    const s2 = stageOf(o6.id, 'Handle & Cover');
    setStage(s0.id, { status: 'SELESAI', honorStatus: 'SUDAH' });
    setStage(s1.id, { status: 'SELESAI', honorStatus: 'SUDAH' });
    setStage(s2.id, { status: 'BERJALAN' });
  }

  // 7) Parang-020 — sudah selesai penuh (demo Laporan Riwayat)
  const o7 = createOrder({
    jenis: 'Parang', pelanggan: 'UD Sumber Makmur', kontak: '0838-7766-5544', jumlah: 12, harga: 6_000_000,
    tanggalMasuk: daysFromNow(-25), deadline: daysFromNow(-5), isCustom: false, approvalNote: null,
    vendorPerDivisi: {
      'Cutting & Blacksmith': V.ajiLogam, 'Shaping & Heat Threatment': V.kilauSempurna,
      'Handle & Cover': V.kayuJati, 'Selesai Produksi': V.internal,
    },
    honorPerDivisi: contohHonor(6_000_000),
    materialCostBaja: 1_200_000,
    materialCostKayu: 620_000,
    shippingCost: 180_000,
    extraCost: 0,
  });
  {
    const stages = listStagesForOrder(o7.id);
    for (const s of stages) {
      setStage(s.id, { status: 'SELESAI', honorStatus: 'SUDAH' });
      addNote(s.id, s.vendor_nama ?? 'Tim Internal Produksi', `Tahap ${s.divisi} selesai dikerjakan sesuai standar.`);
      addAttachment({ stageId: s.id, nama: `foto_hasil_${s.divisi.split(' ')[0].toLowerCase()}_parang020.jpg`, tipe: 'foto', oleh: s.vendor_nama ?? 'Tim Internal Produksi', filePath: writePlaceholderFile(s.id, `foto_hasil_${s.divisi.split(' ')[0].toLowerCase()}_parang020.jpg`, 'foto') });
    }
  }

  // 8) Golok-023 — pesanan custom, masih menunggu approval
  createOrder({
    jenis: 'Golok', pelanggan: 'Bpk. Wirawan Kusuma', kontak: '0819-5566-7788', jumlah: 3, harga: 5_400_000,
    tanggalMasuk: daysFromNow(-1), deadline: daysFromNow(30), isCustom: true,
    approvalNote: 'Pesanan custom: ukiran naga di bilah golok. Perlu konfirmasi kelayakan produksi & harga tambahan sebelum masuk ke Cutting & Blacksmith.',
    vendorPerDivisi: {
      'Cutting & Blacksmith': V.ajiLogam, 'Shaping & Heat Threatment': V.kilauSempurna,
      'Handle & Cover': V.kayuJati, 'Selesai Produksi': V.internal,
    },
    honorPerDivisi: contohHonor(5_400_000),
  });
}
