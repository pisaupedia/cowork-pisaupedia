-- Pisaupedia Knife Manufacture - schema database (SQLite)

CREATE TABLE IF NOT EXISTS vendors (
  id TEXT PRIMARY KEY,
  nama TEXT NOT NULL,
  kontak TEXT,
  is_internal INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'VENDOR')),
  vendor_id TEXT REFERENCES vendors(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  kode TEXT NOT NULL UNIQUE,
  nomor_urut INTEGER NOT NULL,
  jenis TEXT NOT NULL,
  pelanggan TEXT NOT NULL,
  kontak TEXT,
  jumlah INTEGER NOT NULL,
  harga INTEGER NOT NULL,
  tanggal_masuk TEXT NOT NULL,
  deadline TEXT NOT NULL,
  is_custom INTEGER NOT NULL DEFAULT 0,
  approval_status TEXT NOT NULL DEFAULT 'DISETUJUI' CHECK (approval_status IN ('MENUNGGU', 'DISETUJUI', 'DITOLAK')),
  approval_note TEXT,
  -- Pesanan yang sudah selesai penuh (semua tahap SELESAI) bisa diarsipkan
  -- oleh admin dari papan Kanban (kolom "Selesai Produksi") supaya tidak
  -- menumpuk di dashboard/kanban/kalender — data TIDAK dihapus, hanya
  -- disembunyikan dari tampilan aktif (lihat listVisibleOrders di view.ts)
  -- dan dipindah ke panel "Arsip" (src/app/(app)/arsip/*).
  archived INTEGER NOT NULL DEFAULT 0,
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- one row per division per order, urutan 0..3 matches DIVISIONS order
CREATE TABLE IF NOT EXISTS order_stages (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  divisi TEXT NOT NULL,
  urutan INTEGER NOT NULL,
  vendor_id TEXT REFERENCES vendors(id),
  status TEXT NOT NULL DEFAULT 'MENUNGGU' CHECK (status IN ('MENUNGGU', 'BERJALAN', 'SELESAI')),
  honor_jumlah INTEGER NOT NULL DEFAULT 0,
  honor_status TEXT NOT NULL DEFAULT 'BELUM' CHECK (honor_status IN ('BELUM', 'SUDAH')),
  honor_tanggal_bayar TEXT,
  -- Komponen harga modal, diisi manual oleh admin (bukan otomatis). Hanya
  -- relevan pada divisi tertentu — lihat src/lib/view.ts untuk pemetaannya:
  -- material_cost dipakai di Cutting & Blacksmith (baja) & Handle & Cover (kayu);
  -- shipping_cost & extra_cost dipakai di Selesai Produksi.
  material_cost INTEGER NOT NULL DEFAULT 0,
  shipping_cost INTEGER NOT NULL DEFAULT 0,
  extra_cost INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (order_id, urutan)
);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  stage_id TEXT NOT NULL REFERENCES order_stages(id),
  penulis TEXT NOT NULL,
  teks TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  stage_id TEXT NOT NULL REFERENCES order_stages(id),
  nama TEXT NOT NULL,
  tipe TEXT NOT NULL CHECK (tipe IN ('foto', 'dokumen')),
  file_path TEXT NOT NULL,
  oleh TEXT NOT NULL,
  pending_sync INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Foto referensi desain pisau untuk sebuah pesanan — beda dari `attachments`
-- di atas: attachments terikat ke satu tahap/divisi tertentu dan hanya
-- terlihat oleh vendor pemilik tahap itu, sedangkan foto desain ini terikat
-- langsung ke pesanan (order_id, bukan stage_id) supaya SEMUA divisi/vendor
-- yang terlibat di pesanan ini bisa langsung melihatnya tanpa dibatasi per
-- tahap — tujuannya menyamakan pemahaman semua tim soal desain pisau yang
-- dikerjakan. Diisi admin saat membuat pesanan baru (minimal 3 foto), dan
-- bisa ditambah lagi kapan saja dari halaman detail pesanan.
CREATE TABLE IF NOT EXISTS design_photos (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  nama TEXT NOT NULL,
  file_path TEXT NOT NULL,
  oleh TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_stages_order ON order_stages(order_id);
CREATE INDEX IF NOT EXISTS idx_stages_vendor ON order_stages(vendor_id);
CREATE INDEX IF NOT EXISTS idx_notes_stage ON notes(stage_id);
CREATE INDEX IF NOT EXISTS idx_attachments_stage ON attachments(stage_id);
CREATE INDEX IF NOT EXISTS idx_design_photos_order ON design_photos(order_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Invoice / Surat Jalan (Delivery Note) / Quotation — modul dokumen niaga,
-- terpisah total dari data pesanan produksi di atas. Admin-only (lihat
-- src/app/(app)/invoices/*): dulunya aplikasi terpisah (file HTML tunggal
-- yang menyimpan datanya hanya di memori JS browser), sekarang diintegrasikan
-- memakai login & database yang sama dengan aplikasi Pisaupedia Knife
-- Manufacture ini.
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('invoice', 'quotation', 'suratjalan')),
  nomor TEXT NOT NULL,
  nomor_urut INTEGER NOT NULL,
  tanggal TEXT NOT NULL,
  due_date TEXT,          -- invoice saja
  client_name TEXT,
  client_address TEXT,
  client_contact TEXT,
  currency TEXT NOT NULL DEFAULT 'IDR',
  overall_discount_percent REAL NOT NULL DEFAULT 0,
  tax_enabled INTEGER NOT NULL DEFAULT 1,
  tax_percent REAL NOT NULL DEFAULT 11,
  grand_total INTEGER NOT NULL DEFAULT 0, -- invoice & quotation saja
  notes TEXT,
  bank_info TEXT,          -- invoice saja
  terms TEXT,              -- quotation saja
  issued_by TEXT,          -- quotation saja
  driver TEXT,             -- suratjalan saja
  sender_name TEXT,        -- suratjalan saja
  driver_sign TEXT,        -- suratjalan saja
  receiver_name TEXT,      -- suratjalan saja
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (type, nomor_urut)
);

CREATE TABLE IF NOT EXISTS document_items (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id),
  urutan INTEGER NOT NULL,
  deskripsi TEXT NOT NULL,
  qty REAL NOT NULL DEFAULT 0,
  unit TEXT,               -- suratjalan saja
  harga REAL NOT NULL DEFAULT 0,       -- invoice & quotation saja
  diskon_percent REAL NOT NULL DEFAULT 0, -- invoice & quotation saja
  catatan TEXT              -- suratjalan saja ("remarks")
);

CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);
CREATE INDEX IF NOT EXISTS idx_document_items_document ON document_items(document_id);
