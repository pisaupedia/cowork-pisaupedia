import './invoice-theme.css';

// Panel "Invoice & Dokumen" sengaja dikembalikan ke tampilan & bahasa
// (Inggris) aplikasi invoice standalone yang lama — atas permintaan
// pengguna. Layout ini hanya membungkus route /invoices/* dengan CSS
// bertema terpisah (invoice-theme.css, class ber-prefix "iv-") supaya
// tidak mengubah tampilan bagian lain aplikasi (dashboard, kanban, dll.
// yang masih memakai tema biru/merah utama). Login, database, dan gate
// admin-only tetap seperti aplikasi yang sudah terintegrasi — cuma
// tampilan & bahasa panel ini yang dikembalikan.
export default function InvoicesLayout({ children }: { children: React.ReactNode }) {
  return <div className="iv-root">{children}</div>;
}
