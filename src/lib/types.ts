export type Role = 'ADMIN' | 'VENDOR';
export type ApprovalStatus = 'MENUNGGU' | 'DISETUJUI' | 'DITOLAK';
export type StageStatus = 'MENUNGGU' | 'BERJALAN' | 'SELESAI';
export type PaymentStatus = 'BELUM' | 'SUDAH';

export interface VendorRow {
  id: string;
  nama: string;
  kontak: string | null;
  is_internal: number;
  created_at: string;
}

export interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  name: string;
  role: Role;
  vendor_id: string | null;
  created_at: string;
}

export interface SessionUser {
  id: string;
  username: string;
  name: string;
  role: Role;
  vendorId: string | null;
  vendorNama: string | null;
}

export interface OrderRow {
  id: string;
  kode: string;
  nomor_urut: number;
  jenis: string;
  pelanggan: string;
  kontak: string | null;
  jumlah: number;
  harga: number;
  tanggal_masuk: string;
  deadline: string;
  is_custom: number;
  approval_status: ApprovalStatus;
  approval_note: string | null;
  archived: number;
  archived_at: string | null;
  created_at: string;
}

export interface StageRow {
  id: string;
  order_id: string;
  divisi: string;
  urutan: number;
  vendor_id: string | null;
  status: StageStatus;
  honor_jumlah: number;
  honor_status: PaymentStatus;
  honor_tanggal_bayar: string | null;
  material_cost: number;
  shipping_cost: number;
  extra_cost: number;
  updated_at: string;
  vendor_nama?: string | null;
  vendor_is_internal?: number | null;
}

export interface NoteRow {
  id: string;
  stage_id: string;
  penulis: string;
  teks: string;
  created_at: string;
}

export interface AttachmentRow {
  id: string;
  stage_id: string;
  nama: string;
  tipe: 'foto' | 'dokumen';
  file_path: string;
  oleh: string;
  pending_sync: number;
  created_at: string;
}

export interface DesignPhotoRow {
  id: string;
  order_id: string;
  nama: string;
  file_path: string;
  oleh: string;
  created_at: string;
}

export type DocType = 'invoice' | 'quotation' | 'suratjalan';
export type CurrencyCode = 'IDR' | 'USD' | 'EUR' | 'SGD' | 'MYR';

export interface DocumentRow {
  id: string;
  type: DocType;
  nomor: string;
  nomor_urut: number;
  tanggal: string;
  due_date: string | null;
  client_name: string | null;
  client_address: string | null;
  client_contact: string | null;
  currency: CurrencyCode;
  overall_discount_percent: number;
  tax_enabled: number;
  tax_percent: number;
  grand_total: number;
  notes: string | null;
  bank_info: string | null;
  terms: string | null;
  issued_by: string | null;
  driver: string | null;
  sender_name: string | null;
  driver_sign: string | null;
  receiver_name: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentItemRow {
  id: string;
  document_id: string;
  urutan: number;
  deskripsi: string;
  qty: number;
  unit: string | null;
  harga: number;
  diskon_percent: number;
  catatan: string | null;
}
