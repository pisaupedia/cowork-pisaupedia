# Pisaupedia Knife Manufacture

Aplikasi web untuk mengelola workflow produksi pisau lintas 4 divisi (Cutting &
Blacksmith → Shaping & Heat Threatment → Handle & Cover → Selesai Produksi)
dan vendor eksternal, dengan approval pesanan, tracking honor vendor per
tahap, dan laporan riwayat untuk pesanan yang sudah selesai penuh.

Ini adalah aplikasi **fungsional** (bukan mockup) — ada database sungguhan,
login & sesi sungguhan, dan setiap aksi ditegakkan di server (bukan hanya
disembunyikan di tampilan).

## Menjalankan aplikasi

### Prasyarat

- **Node.js 22.5 atau lebih baru** (wajib — aplikasi ini memakai modul
  bawaan Node `node:sqlite` sebagai database, yang baru tersedia mulai versi
  tersebut). Cek versi dengan `node -v`.
- Tidak perlu database server terpisah, tidak perlu Docker, tidak perlu akun
  cloud apa pun untuk menjalankan secara lokal.

### Langkah pertama kali

```bash
npm install
npm run dev
```

Buka **http://localhost:3000** di browser.

Saat pertama kali dijalankan, aplikasi otomatis membuat database SQLite di
folder `data/` dan mengisinya dengan data contoh (vendor, pengguna, dan 8
pesanan dalam berbagai status) — tidak ada langkah migrasi atau seed manual
yang perlu dijalankan. Proses ini hanya berjalan sekali; jika `data/pisau.db`
sudah ada, isinya tidak akan ditimpa.

Saat startup kamu akan melihat baris seperti:

```
(node:xxxx) ExperimentalWarning: SQLite is an experimental feature and might change at any time
```

Ini **normal dan aman diabaikan** — ini hanya peringatan dari Node bahwa
modul `node:sqlite` masih berstatus eksperimental, bukan tanda ada yang
salah.

### Akun demo

| Peran | Username | Password |
|---|---|---|
| Admin/Owner (internal) | `pisaupedia2026` | `Gyuto240mm` |
| Vendor — Tajam Abadi | `tajamabadi` | `vendor123` |
| Vendor — UD Baja Nusantara | `bajanusantara` | `vendor123` |
| Vendor — CV Aji Logam Perkasa | `ajilogam` | `vendor123` |
| Vendor — CV Kilau Sempurna | `kilausempurna` | `vendor123` |
| Vendor — Kayu Jati Makmur | `kayujati` | `vendor123` |
| Vendor — UD Sarung Kulit Prima | `sarungkulit` | `vendor123` |

Login sebagai `pisaupedia2026` untuk melihat semua fitur (Persetujuan, Pesanan Baru,
Vendor & Pengguna, Laporan Riwayat). Login sebagai salah satu vendor untuk
melihat tampilan yang sudah dibatasi hak aksesnya (hanya tahap miliknya
sendiri, harga & data pelanggan disembunyikan, tidak ada menu admin).

### Mengulang dari data bersih

Untuk menghapus semua data (termasuk pesanan/vendor yang kamu buat sendiri
saat mencoba aplikasi) dan mengisi ulang dengan data contoh:

```bash
npm run db:reset
rm -rf uploads/*   # hapus file yang sudah diunggah (opsional)
npm run dev
```

Database akan otomatis diisi ulang saat aplikasi dibuka kembali.

### Menjalankan versi production-style

```bash
npm run build
npm run start
```

## Yang sudah berfungsi sungguhan (bukan sekadar tampilan)

- **Login & sesi** — cookie sesi httpOnly, password di-hash (bcrypt), dicek
  ulang di server pada setiap aksi.
- **Hak akses per peran & per tahap (row-level security)** — vendor hanya
  bisa melihat pesanan yang memuat tahap miliknya, dan di dalam pesanan itu
  hanya tahap miliknya sendiri yang detail/lampiran/catatannya terbuka.
  Pesanan yang masih menunggu/ditolak approval tidak terlihat oleh siapa pun
  di luar panel Persetujuan. Ini semua ditegakkan ulang di server (lihat
  `src/lib/view.ts`), bukan hanya disembunyikan di tampilan.
- **Approval pesanan baru** — pesanan custom perlu disetujui/ditolak admin
  sebelum masuk ke tahap Cutting & Blacksmith.
- **Aturan foto wajib sebelum tahap ditandai selesai** — tombol "Tandai
  Tahap Selesai" baru muncul setelah ada minimal satu foto bukti terunggah.
- **Honor vendor & harga modal diinput manual oleh admin** — bukan
  dihitung otomatis. Saat membuat pesanan baru (menu "Pesanan Baru"), admin
  mengisi sendiri honor vendor per divisi, harga modal material baja
  (Cutting & Blacksmith), harga modal bahan kayu (Handle & Cover), serta
  harga shipping & "Extra Cost" (Selesai Produksi). Semua angka ini bisa
  diubah lagi kapan saja dari halaman detail pesanan → tab "Riwayat Tahap
  & Catatan" → buka bagian "Edit Honor & Harga Modal (admin)" di tahap yang
  bersangkutan. Admin bisa menandai honor sudah dibayar; vendor bisa
  melihat nominal & status honornya sendiri tapi tidak bisa mengubah
  apa pun. Semua angka ini (honor + material + shipping + extra cost)
  digabung otomatis menjadi **Harga Modal (Total)** yang tampil di tab
  Ringkasan pesanan — khusus admin, tidak pernah terlihat oleh vendor.
- **Laporan Riwayat** — tab khusus admin yang hanya muncul untuk pesanan
  yang seluruh 4 tahapnya sudah "Selesai", berisi ringkasan foto/dokumen/
  catatan/total honor/total harga modal dari awal sampai akhir.
- **Upload file sungguhan** — foto/dokumen tersimpan di folder `uploads/`
  di server dan disajikan lewat route berautentikasi
  (`/api/files/[id]`) yang menegakkan aturan akses yang sama seperti
  halaman lain — bukan lewat folder publik.
- **Admin bisa membuat pesanan baru & vendor/pengguna baru** langsung dari
  aplikasi (menu "Pesanan Baru" dan "Vendor & Pengguna").
- **Foto desain pisau (referensi) yang terlihat SEMUA divisi** — saat
  membuat pesanan baru (menu "Pesanan Baru"), admin wajib mengunggah
  minimal 3 foto desain/referensi pisau yang dipesan. Berbeda dari foto
  bukti pengerjaan per tahap (yang hanya terlihat oleh vendor pemilik
  tahap itu), foto desain ini langsung terlihat oleh SEMUA divisi/vendor
  yang mengerjakan pesanan tersebut — tujuannya menyamakan pemahaman
  semua tim mengenai desain pisau sebelum mulai bekerja. Foto ini
  ditampilkan sebagai galeri di halaman detail pesanan, selalu terlihat di
  atas tab-tab lain (tidak perlu diklik dulu). Admin bisa menambah foto
  desain lagi kapan saja dari halaman detail pesanan (tidak ada minimal
  untuk penambahan susulan). **Foto pertama juga muncul sebagai thumbnail
  kecil langsung di kartu pesanan** pada Dashboard ("Perlu Perhatian"),
  Papan Kanban, dan Kalender — dengan badge "+N" kalau ada lebih dari satu
  foto — supaya vendor maupun owner langsung melihat sekilas desain
  pisaunya tanpa perlu membuka detail pesanan dulu. Kartu pesanan yang
  belum punya foto desain (misalnya data contoh lama) tetap tampil normal
  tanpa thumbnail.
- **Semua foto lampiran di halaman detail pesanan juga tampil sebagai
  thumbnail** — di tab "Lampiran" maupun "Laporan Riwayat", setiap
  lampiran bertipe foto (bukan dokumen seperti PDF/txt) menampilkan
  preview gambar kecil di sebelah nama filenya, memakai pola thumbnail
  CSS yang sama seperti foto desain/kartu pesanan (bukan file thumbnail
  baru yang dibuat di server) — supaya vendor maupun admin lebih mudah
  mengenali isi lampiran tanpa harus membuka satu-satu.
- **Admin bisa reset password vendor yang lupa password-nya** — di menu
  "Vendor & Pengguna", tiap akun login vendor punya tombol "Reset Password"
  sendiri. Username tidak ikut berubah (dan bisa dilihat admin di halaman
  yang sama), hanya password-nya yang diganti baru. Password baru harus
  diberitahukan admin ke vendor secara langsung (WA/telepon/dll.) — aplikasi
  ini tidak mengirim email/SMS otomatis. Vendor sendiri tidak punya menu
  ganti password sendiri di aplikasi ini; semua lewat admin.
- **Admin bisa mengedit dan menghapus vendor maupun akun login-nya** — di
  menu "Vendor & Pengguna": "Edit Vendor" mengubah nama/kontak, "Edit Akun"
  mengubah username/nama tampilan akun login, dan masing-masing punya tombol
  hapus sendiri (memakai popup kode konfirmasi yang sama seperti penghapusan
  dokumen di modul Invoice). Vendor yang masih ditugaskan di satu atau lebih
  tahap pesanan (`order_stages`) ditandai "Ditugaskan (N) — tidak bisa
  dihapus" dan tombol hapusnya disembunyikan — harus dilepas dari semua
  tugasnya dulu. Menghapus akun login tidak menghapus riwayat lama (catatan,
  lampiran, foto desain yang pernah dibuat akun itu) karena kolom
  `penulis`/`oleh` di tabel-tabel tersebut hanya menyimpan nama sebagai teks,
  bukan foreign key ke akun.
- **Dashboard, Papan Kanban, dan Kalender Deadline** — semuanya dihitung
  dari data pesanan yang sama secara real-time, bukan data statis. Kalender
  sudah dirapikan untuk layar kecil: sel tanggal dan tombol navigasi
  bulan punya target sentuh yang lebih besar, dan kode pesanan pada sel
  tanggal disingkat jadi badge jumlah ("● 2") di layar sempit lalu muncul
  penuh lagi mulai lebar tablet (`sm:`) ke atas.
- **Modul "Invoice & Dokumen"** — pembuatan Invoice, Quotation, dan Delivery
  Note (Surat Jalan), tersimpan sungguhan di database yang sama dengan data
  produksi (bukan lagi hanya di memori browser). Lihat bagian khusus di
  bawah.
- **Modul "Backup & Restore"** — admin bisa mengunduh dan memulihkan seluruh
  database dari satu file `.db` sungguhan, langsung dari aplikasi (tidak
  perlu akses server/terminal). Lihat bagian khusus di bawah.
- **Modul "Arsip"** — pesanan yang sudah selesai penuh bisa diarsipkan admin
  dari papan Kanban (kolom "Selesai Produksi") supaya tidak menumpuk di
  dashboard/kanban/kalender, dengan statistik jumlah pesanan & pembayaran
  honor per vendor dari pesanan yang sudah diarsipkan. Lihat bagian khusus
  di bawah.
- **Konfirmasi kode sebelum menghapus data** — supaya tidak ada yang tidak
  sengaja terhapus karena salah klik, setiap tombol "Delete" (saat ini:
  menghapus dokumen Invoice/Quotation/Delivery Note di menu "Invoice &
  Documents") memunculkan popup yang meminta kode konfirmasi (`1234`
  secara default) sebelum penghapusan benar-benar dijalankan — salah kode
  akan ditolak dengan pesan error, baik di popup-nya maupun kalau dicoba
  dilewati langsung ke server. Ini murni pengaman salah klik, bukan
  password akun kedua, dan kodenya sama untuk semua operasi hapus di
  aplikasi ini (lihat `DELETE_CONFIRM_CODE` di `src/lib/constants.ts` kalau
  ingin diganti).

## Modul Invoice, Quotation & Delivery Note

Menu **"Invoice & Dokumen"** di sidebar (khusus admin) adalah hasil
mengintegrasikan aplikasi pembuatan invoice yang sebelumnya berdiri sendiri
(satu file HTML) ke dalam sistem ini, supaya datanya tidak lagi hilang saat
tab browser ditutup dan supaya login-nya konsisten dengan sistem produksi.

Yang berubah dari versi standalone-nya:

- **Data tersimpan permanen di database** (tabel `documents` &
  `document_items`), bukan lagi array JavaScript yang hilang saat halaman
  di-refresh atau tab ditutup.
- **Password akses terpisah (`pisaupedia2026`) dihapus.** Versi standalone
  memakai password statis yang tertulis langsung di kode halaman (terlihat
  oleh siapa pun yang membuka "view source") — ini sengaja diganti dengan
  login & sesi yang sama dengan aplikasi Pisaupedia Knife Manufacture ini, dan menu
  "Invoice & Dokumen" hanya muncul/bisa diakses oleh akun **admin**. Ini
  lebih aman dan tidak butuh password kedua untuk diingat.
- **Nomor dokumen (INV-####/PQ-####/DN-####) dihitung di server**, bukan di
  browser — supaya tidak mungkin dua dokumen kebetulan punya nomor yang
  sama.
- **Total (subtotal, diskon, pajak, grand total) dihitung ulang di server**
  saat disimpan — nilai yang tampil di form hanya pratinjau, bukan yang
  benar-benar dipercaya & disimpan.

Fitur-fitur dari versi aslinya yang dipertahankan: 3 jenis dokumen (Invoice,
Quotation/Penawaran, Delivery Note/Surat Jalan) dengan field yang berbeda
sesuai jenisnya, dukungan 5 mata uang (IDR/USD/EUR/SGD/MYR), diskon per-item
& diskon keseluruhan, PPN opsional, letterhead perusahaan (Pisaupedia
Knives & Cutlery) dengan logo, serta tombol cetak/simpan PDF lewat
`window.print()` (sidebar & semua tombol non-cetak otomatis tersembunyi
saat mode cetak).

Halaman daftar dokumen (`/invoices`) menampilkan statistik ringkas (total
dokumen, jumlah per jenis, total nilai invoice), pencarian berdasarkan
nomor/nama klien, dan filter per jenis dokumen.

**Tampilan & bahasa panel ini dikembalikan sama seperti aplikasi standalone
aslinya, khusus dalam bahasa Inggris.** Atas permintaan pengguna, seluruh
halaman di bawah `/invoices/*` (daftar dokumen, form dokumen baru, halaman
lihat/edit dokumen) dan komponennya (`DocumentEditor`, `PrintButton`)
memakai ulang gaya visual (warna hijau untuk Invoice, biru untuk Quotation,
cokelat untuk Delivery Note, letterhead, tata letak tabel item, kotak
tanda tangan, footer "Follow us" dengan ikon TikTok/Instagram, dsb.) dan
seluruh label/placeholder dari versi standalone-nya — semuanya dalam
bahasa Inggris, khusus untuk panel ini saja (halaman lain di aplikasi ini
tetap berbahasa Indonesia). Gaya ini di-scope lewat file CSS terpisah
(`src/app/(app)/invoices/invoice-theme.css`) yang hanya di-*import* oleh
`src/app/(app)/invoices/layout.tsx`, jadi tidak memengaruhi tampilan
dashboard/kanban/kalender/dll. Yang **tidak** ikut dikembalikan: password
akses terpisah dan penyimpanan hanya-di-memori dari versi standalone
(lihat poin-poin di atas) — login, database, dan gerbang akses admin-only
yang sudah terintegrasi tetap dipakai seperti sekarang, karena permintaan
revisi ini hanya mengenai tampilan & bahasa, bukan cara kerja datanya.

## Modul Backup & Restore Database

Menu **"Backup & Restore"** di sidebar (khusus admin, `/backup`) mengelola
seluruh database aplikasi (SQLite) sebagai satu file — tanpa perlu masuk ke
server atau terminal.

**Unduh backup** — tombol "Unduh Backup Database" mengunduh salinan lengkap
database saat ini (`pisaupedia-backup-YYYYMMDD-HHMM.db`). File ini berisi
semua data (pesanan, tahap, vendor, pengguna/akun login, honor, dokumen
invoice, dll.) dalam satu file SQLite. **File attachment (foto & dokumen
yang diunggah vendor di folder `uploads/`) TIDAK ikut ada di dalam file
backup ini** — ini disebutkan jelas di halamannya supaya admin tidak salah
kira satu file ini mencakup semuanya. Kalau ingin backup penuh (termasuk
foto), folder `uploads/` perlu disalin terpisah di level server/disk.

**Pulihkan dari backup** — mengunggah file `.db`/`.sqlite`/`.sqlite3` dan
menekan "Pulihkan Database Sekarang" akan **mengganti seluruh data yang
sedang aktif** dengan isi file yang diunggah. Sebelum benar-benar dijalankan,
sistem melakukan validasi berlapis: memeriksa file benar-benar file SQLite
yang valid (bukan sekadar file yang diberi nama `.db`), lalu memeriksa isi
tabelnya benar-benar cocok dengan struktur aplikasi ini (bukan file `.db`
lain yang kebetulan diunggah) — kalau salah satu gagal, restore dibatalkan
dan data yang sedang aktif **tidak tersentuh sama sekali**, dengan pesan
error yang jelas di halaman `/backup`.

Beberapa hal penting soal proses restore:

- **Selalu ada salinan pengaman otomatis.** Sesaat sebelum data ditimpa,
  server menyimpan satu salinan dari database yang sedang aktif ke folder
  `data/pre-restore-backups/` di server — jadi kalau ternyata file yang
  diunggah salah/ketinggalan zaman, masih ada jalan manual (lewat
  server/terminal) untuk mengembalikannya. Ini bukan pengganti kebiasaan
  mengunduh backup terbaru sebelum memulihkan file lain.
- **Semua orang otomatis logout setelah restore** — begitu proses selesai,
  seluruh sesi login (termasuk sesi admin yang sedang menjalankan restore
  itu sendiri) dihapus tanpa terkecuali, lalu diarahkan ke halaman login
  dengan pesan konfirmasi. Ini berlaku selalu, apa pun isi tabel sesi di
  dalam file backup yang diunggah — supaya tidak ada sesi lama yang
  "nyangkut" tetap login setelah database ditimpa.
- **Tidak bisa dibatalkan dari dalam aplikasi** — begitu restore berjalan,
  satu-satunya jalan mundur adalah salinan pengaman otomatis di atas
  (manual, lewat server) atau mengunggah ulang backup lain yang benar.

## Modul Arsip

Menu **"Arsip"** di sidebar (khusus admin, `/arsip`, posisinya di atas
"Backup & Restore") adalah tempat menyimpan pesanan yang sudah selesai
penuh supaya dashboard, papan Kanban, dan Kalender tidak terus menumpuk
dengan pekerjaan lama yang sudah tuntas.

**Cara mengarsipkan** — di papan Kanban, kolom **"Selesai Produksi"**,
setiap kartu pesanan yang sudah selesai di keempat tahapnya (bukan baru
sampai di divisi ini, tapi benar-benar SELESAI semua tahap) punya tombol
**"🗄 Arsipkan"**. Klik tombol ini langsung memindahkan pesanan tersebut ke
Arsip — pesanan itu langsung hilang dari dashboard, Kanban, dan Kalender
untuk semua orang (admin maupun vendor), tapi datanya **tidak dihapus**:
masih bisa dibuka langsung dari halaman Arsip lewat tombol "Lihat Detail",
dan bisa dikembalikan ke tampilan aktif kapan saja lewat tombol "Batalkan
Arsip" kalau ternyata salah klik.

**Statistik Pembayaran Vendor** — di bagian atas halaman Arsip, ada tabel
ringkasan per vendor eksternal: berapa kali vendor tersebut dilibatkan di
pesanan yang **sudah diarsipkan** (dihitung per pesanan, bukan per tahap —
jadi vendor yang mengerjakan lebih dari satu tahap pada pesanan yang sama
tetap dihitung satu kali), berapa total honor yang sudah dibayar, dan
berapa yang masih belum dibayar. Statistik ini sengaja **hanya menghitung
dari pesanan yang sudah diarsipkan** — pesanan yang masih aktif di
Kanban/dashboard tidak ikut terhitung sampai diarsipkan juga.

## Yang bersifat ilustratif (belum/tidak diimplementasikan penuh)

Tiga hal ini didesain di tampilan sesuai permintaan, tapi secara teknis
**tidak bisa** diimplementasikan sepenuhnya sebagai aplikasi web biasa yang
dijalankan di browser — ini butuh aplikasi mobile native (atau minimal
Progressive Web App dengan service worker + background sync) untuk benar-benar
berfungsi:

- **Mode offline / upload tertunda** — ada badge "Menunggu Sinkronisasi"
  sebagai contoh tampilan (lihat pesanan Pisau Dapur di data contoh), tapi
  aplikasi ini belum benar-benar menyimpan foto secara offline di perangkat
  lalu menyinkronkannya otomatis saat online kembali.
- **Kompresi otomatis foto sebelum unggah** — belum diimplementasikan.
- **Integrasi kamera langsung (bukan pilih dari galeri)** — di browser
  mobile modern, `<input type="file" accept="image/*">` biasanya sudah
  menawarkan opsi "Ambil Foto" langsung dari kamera, tapi ini tergantung
  browser/perangkat pengguna dan tidak bisa dipaksakan/dijamin dari sisi
  aplikasi web seperti aplikasi native.

Jika ketiga hal ini penting untuk dipakai sungguhan di lapangan (misalnya
vendor sering bekerja di lokasi dengan sinyal lemah), langkah selanjutnya
yang disarankan adalah membangun companion app mobile (React Native/Flutter)
khusus untuk alur unggah foto vendor, yang bicara ke API yang sama.

## Status hosting/deployment

Aplikasi ini saat ini disiapkan untuk **dijalankan secara lokal** (`npm run
dev` / `npm run build && npm run start`) sesuai kesepakatan — keputusan soal
di mana/bagaimana meng-hosting-nya secara permanen (server sendiri, VPS,
Vercel, dll.) sengaja belum diambil dan bisa didiskusikan kapan saja
setelah aplikasi ini dicoba dan disetujui alurnya.

Satu hal yang perlu diperhatikan bila nanti akan di-deploy ke server
sungguhan: folder `data/` (database) dan `uploads/` (file yang diunggah)
harus berada di disk yang persisten (tidak ikut terhapus setiap deploy) —
ini bukan sesuatu yang perlu dipikirkan saat menjalankan secara lokal.

## Struktur proyek (untuk yang ingin menelusuri kode)

- `src/lib/schema.sql` — struktur database.
- `src/lib/repo/*` — akses data per entitas (vendor, user, order, stage,
  note, attachment).
- `src/lib/view.ts` — semua logika hak akses (RLS) & tampilan gabungan
  (dashboard, kanban, detail pesanan).
- `src/lib/seed.ts` — data contoh yang otomatis diisi saat pertama kali
  dijalankan.
- `src/app/(app)/*` — halaman-halaman setelah login.
- `src/app/api/files/[attachmentId]/route.ts` — penyaji file terunggah yang
  berautentikasi.
- `src/lib/repo/documents.ts`, `src/lib/docTotals.ts`,
  `src/app/(app)/invoices/*`, `src/components/invoice/*` — modul Invoice,
  Quotation & Delivery Note (lihat bagian "Modul Invoice, Quotation &
  Delivery Note" di atas).
- `src/lib/backup.ts`, `src/app/(app)/backup/*`,
  `src/app/api/backup/download/route.ts` — modul Backup & Restore Database
  (lihat bagian "Modul Backup & Restore Database" di atas). `src/lib/db.ts`
  meng-export koneksi database (`db`) sebagai `Proxy` (bukan instance
  langsung) supaya proses restore bisa mengganti koneksi database yang
  sedang aktif secara langsung (tanpa restart server) tanpa perlu mengubah
  file-file lain yang memakai `db`.
- `src/lib/repo/designPhotos.ts`, tabel `design_photos` (lihat
  `src/lib/schema.sql`), `src/app/api/design-photos/[photoId]/route.ts` —
  foto desain pisau per pesanan yang terlihat semua divisi/vendor (beda
  dari `attachments` yang terikat per tahap). Diunggah lewat form di
  `src/app/(app)/orders/new/page.tsx` (wajib minimal 3, divalidasi di
  `src/app/(app)/orders/new/actions.ts`) dan bisa ditambah lagi dari
  `src/app/(app)/orders/[id]/page.tsx` (`addDesignPhotosAction`, admin-only,
  tanpa minimal). Foto pertama pesanan juga muncul sebagai thumbnail di
  kartu Dashboard/Kanban/Kalender lewat `thumbUrl`/`designPhotoCount` di
  `OrderCardView` (`toOrderCard()` di `src/lib/view.ts`), dirender di
  `src/components/order-card.tsx`.
- `src/app/(app)/arsip/*` — modul Arsip (lihat bagian "Modul Arsip" di
  atas). Kolom `archived`/`archived_at` di tabel `orders`
  (`src/lib/schema.sql`); `archiveOrder`/`unarchiveOrder`/
  `listArchivedOrders` di `src/lib/repo/orders.ts`; tombol "Arsipkan" di
  Kanban ada di `src/components/order-card.tsx` (diteruskan sebagai prop
  `archiveAction` dari `src/app/(app)/kanban/page.tsx`, hanya untuk kartu
  admin di kolom "Selesai Produksi" yang sudah selesai penuh);
  `buildVendorArchiveStats`/`buildArchivedOrdersList` di `src/lib/view.ts`.
