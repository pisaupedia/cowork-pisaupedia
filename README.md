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
  bersangkutan. Semua angka ini (honor + material + shipping + extra cost)
  digabung otomatis menjadi **Harga Modal (Total)** yang tampil di tab
  Ringkasan pesanan — khusus admin, tidak pernah terlihat oleh vendor.
- **Pembayaran honor vendor bisa dicicil/DP, tidak harus lunas sekaligus** —
  setiap tahap yang dikerjakan vendor eksternal menampilkan "Total
  Pembayaran" (honor yang disepakati) dan "Sudah Dibayarkan" (akumulasi
  yang sudah dibayar), plus sisa yang belum dibayar dan badge status
  (Belum Dibayar / DP Terbayar / Lunas). Ini untuk kasus vendor yang minta
  dibayar sebagian dulu (down payment) sebelum lanjut kerja: admin cukup
  mencatat nominal yang dibayarkan lewat form "Catat Pembayaran" di tab
  "Riwayat Tahap & Catatan" (default-nya sisa yang belum dibayar, tapi bisa
  diubah untuk mencatat DP), plus catatan opsional (misalnya "DP" atau
  "Pelunasan") untuk menandai pembayaran itu — dan bisa dipanggil
  berkali-kali sampai lunas. Setiap pembayaran (bukan cuma totalnya)
  tersimpan sebagai satu baris riwayat di tabel `honor_payments`, tampil
  sebagai daftar "Riwayat Pembayaran (N)" (bisa dibuka/tutup) di bawah form
  tersebut — berisi nominal, catatan, tanggal, dan siapa yang mencatatnya.
  Vendor bisa melihat nominal & status pembayarannya sendiri (termasuk
  riwayatnya) tapi tidak bisa mengubah apa pun.
- **Laporan Riwayat** — tab khusus admin yang hanya muncul untuk pesanan
  yang seluruh 4 tahapnya sudah "Selesai", berisi ringkasan foto/dokumen/
  catatan/total honor/total harga modal dari awal sampai akhir.
- **Upload file sungguhan** — foto/dokumen tersimpan di folder `uploads/`
  di server dan disajikan lewat route berautentikasi
  (`/api/files/[id]`) yang menegakkan aturan akses yang sama seperti
  halaman lain — bukan lewat folder publik.
- **Admin bisa membuat pesanan baru & vendor/pengguna baru** langsung dari
  aplikasi (menu "Pesanan Baru" dan "Vendor & Pengguna").
- **Catatan / Rincian Pekerjaan (opsional)** — kolom teks bebas di form
  "Pesanan Baru", di bawah field jenis/pelanggan/harga/tanggal, untuk
  rincian tambahan yang tidak tercakup kolom lain (ukuran, jenis bahan,
  dst.). Beda dari catatan alasan pesanan custom di bawahnya (yang khusus
  untuk ditinjau admin/sales) — dua kolom ini independen, keduanya selalu
  terlihat di form terlepas dari centang "Pesanan custom" dicek atau
  tidak. Kalau diisi, tampil di tab "Ringkasan" halaman detail pesanan,
  terlihat oleh semua yang boleh melihat pesanan itu (admin & vendor yang
  terlibat).
- **Foto desain pisau (referensi) yang terlihat SEMUA divisi** — saat
  membuat pesanan baru (menu "Pesanan Baru"), admin wajib mengunggah
  minimal 1 foto desain/referensi pisau yang dipesan, lewat 4 slot bertanda
  "Tampak Depan/Belakang/Samping/Atas" (kotak putus-putus "+ Upload" yang
  langsung menampilkan thumbnail begitu foto dipilih) — supaya admin
  diarahkan mengambil foto dari sudut yang lengkap, tapi tidak wajib
  mengisi keempatnya. Slot mana yang diisi hanya panduan visual; semua
  foto tetap dikirim & disimpan dengan cara yang sama, tidak dibedakan per
  "tampak" di data. Berbeda dari foto bukti pengerjaan per tahap (yang
  hanya terlihat oleh vendor pemilik tahap itu), foto desain ini langsung
  terlihat oleh SEMUA divisi/vendor yang mengerjakan pesanan tersebut —
  tujuannya menyamakan pemahaman semua tim mengenai desain pisau sebelum
  mulai bekerja. Foto ini ditampilkan sebagai galeri di halaman detail
  pesanan, selalu terlihat di atas tab-tab lain (tidak perlu diklik
  dulu). Admin bisa menambah foto
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
  menu "Vendor & Pengguna", satu toggle "Edit Vendor & Akun" per vendor
  mengubah nama/kontak vendor SEKALIGUS username akun login-nya dalam satu
  form yang sama (bukan dua form terpisah) — karena setiap vendor hanya
  punya satu akun. Nama vendor dan nama akun juga digabung jadi SATU field
  ("Nama Vendor / Akun", bukan dua field "Nama Vendor" & "Nama Akun"
  terpisah) supaya keduanya selalu sama — sesuai kondisi aslinya waktu
  vendor pertama dibuat. Kalau vendor itu belum/tidak punya akun (misalnya
  akunnya sudah dihapus), form ini otomatis hanya menampilkan field
  nama/kontak vendor tanpa field akun (username). Vendor maupun akun login masing-
  masing punya tombol hapus sendiri (memakai popup kode konfirmasi yang
  sama seperti penghapusan dokumen di modul Invoice). Vendor yang masih
  ditugaskan pada satu atau lebih tahap yang BELUM SELESAI ditandai
  "Ditugaskan (N) — tidak bisa dihapus" dan tombol hapusnya disembunyikan
  — harus diselesaikan/dilepas dari tugas aktifnya dulu. Tahap lama yang
  sudah "Selesai" (termasuk yang pesanannya sudah diarsipkan) TIDAK
  dihitung sebagai penghalang — sebelumnya dihitung juga, sehingga vendor
  yang pernah mengerjakan pekerjaan apa pun jadi tidak akan pernah bisa
  dihapus meski semua tugasnya sudah lama selesai (bug, sudah diperbaiki).
  Saat vendor benar-benar dihapus, `vendor_id` pada tahap-tahap lamanya
  yang sudah selesai itu di-kosongkan (bukan dihapus barisnya) supaya
  tidak melanggar foreign key — datanya (divisi, honor, dst.) tetap
  tersimpan, hanya kolom "Pelaksana"-nya jadi kosong. Menghapus akun login
  tidak menghapus riwayat lama (catatan, lampiran, foto desain yang pernah
  dibuat akun itu) karena kolom `penulis`/`oleh` di tabel-tabel tersebut
  hanya menyimpan nama sebagai teks, bukan foreign key ke akun.
- **Dashboard "Perlu Perhatian" menampilkan SEMUA pesanan aktif kecuali
  yang sudah di divisi "Selesai Produksi" (bukan hanya yang berisiko),
  dengan tombol hapus per pesanan** — sebelumnya daftar ini hanya berisi
  pesanan yang mendekati/lewat deadline (pesanan "aman" tidak ditampilkan
  sama sekali). Sekarang daftar ini menampilkan seluruh pesanan aktif yang
  terlihat oleh user itu, KECUALI yang sudah berada di divisi "Selesai
  Produksi" (pesanan di divisi itu sudah di ujung alur produksi, jadi
  tidak perlu ikut nongkrong di sini — cek jumlahnya lewat kartu statistik
  "Selesai Produksi" di atasnya, atau papan Kanban), tetap diurutkan
  terlambat → mendekati deadline → aman supaya yang paling butuh perhatian
  tetap di atas. Setiap kartu pesanan di daftar ini juga punya tombol
  "🗑 Hapus" (admin-only — vendor tidak pernah melihat tombol ini),
  memakai popup kode konfirmasi yang sama seperti penghapusan lain di
  aplikasi ini. Beda dari "Arsipkan" (yang hanya menyembunyikan pesanan,
  data tetap ada dan bisa dikembalikan dari menu Arsip), tombol ini
  **menghapus pesanan secara permanen**: seluruh baris tahap, catatan,
  lampiran, dan foto desainnya di database, SEKALIGUS folder fisiknya di
  `uploads/` (folder per tahap dan folder `design/<orderId>/`) — tidak
  bisa dikembalikan lagi setelah dihapus.
- **Dashboard, Papan Kanban, dan Kalender Deadline** — semuanya dihitung
  dari data pesanan yang sama secara real-time, bukan data statis. Kalender
  sudah dirapikan untuk layar kecil: sel tanggal dan tombol navigasi
  bulan punya target sentuh yang lebih besar, dan kode pesanan pada sel
  tanggal disingkat jadi badge jumlah ("● 2") di layar sempit lalu muncul
  penuh lagi mulai lebar tablet (`sm:`) ke atas.
- **Warna identitas per divisi** — label "Distribusi per Divisi" di
  Dashboard (teks & bar) dan judul kolom di Papan Kanban sekarang berwarna
  sesuai divisinya: Cutting & Blacksmith merah, Shaping & Heat Threatment
  kuning, Handle & Cover coklat, Selesai Produksi hijau — supaya keempat
  divisi langsung dikenali dari warnanya di kedua halaman itu. Kode: map
  warna `DIVISION_COLORS` di `src/lib/constants.ts`, dipakai di
  `src/app/(app)/dashboard/page.tsx` dan `src/app/(app)/kanban/page.tsx`.
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

**Menghapus pesanan yang sudah diarsipkan** — tiap pesanan di daftar Arsip
juga punya tombol "Hapus Permanen" (popup kode konfirmasi yang sama seperti
penghapusan lain di aplikasi ini) untuk pesanan yang datanya memang sudah
tidak diperlukan lagi, bukan cuma disembunyikan. Ini memakai action hapus
permanen yang sama dengan yang di Dashboard (`deleteOrderAction`, lihat
"Dashboard 'Perlu Perhatian'" di atas) — seluruh tahap, catatan, lampiran,
riwayat pembayaran honor, dan foto desainnya (baris database maupun file
fisiknya) ikut terhapus dan **tidak bisa dikembalikan**, beda dari
"Batalkan Arsip" yang cuma memindahkan kembali ke tampilan aktif.

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

## Pembaruan besar (24 Agustus 2026) — implementasi hasil Review Profesional

Setelah `REVIEW-PROFESIONAL.md` diselesaikan, hampir seluruh rekomendasinya
diimplementasikan pada sesi yang sama. Bagian ini merangkum apa yang baru;
lihat `REVIEW-PROFESIONAL.md` untuk detail temuan aslinya dan status
per-butirnya.

### Edit pesanan & audit trail

- **Edit pesanan pasca-dibuat** — tombol "✎ Edit Pesanan" (admin-only) di
  halaman detail pesanan membuka `/orders/[id]/edit`, form untuk
  jenis/pelanggan/kontak/jumlah/harga/tanggal masuk/deadline/catatan.
  Kode pesanan, status approval, vendor per tahap, dan biaya per tahap
  **tidak** diedit lewat form ini (masing-masing punya jalur edit sendiri
  yang sudah ada, supaya log audit tetap rapi dan bermakna per jenis
  perubahan). Server memvalidasi jumlah > 0, harga ≥ 0, dan deadline tidak
  boleh lebih awal dari tanggal masuk.
- **Log audit** (`audit_log`) — setiap perubahan pesanan, perubahan
  honor/harga modal per tahap, pergantian vendor pelaksana, dan keputusan
  approval (setuju/tolak/ajukan-ulang) tercatat: siapa, kapan, aksi apa,
  dan ringkasan nilai lama → baru. Belum ada halaman UI khusus untuk
  menampilkan log ini (baru tersimpan di database) — bisa ditambahkan
  kalau nanti dibutuhkan tampilan riwayat perubahan secara langsung.
- **Alasan tolak & ajukan ulang** — menolak pesanan di halaman Persetujuan
  sekarang mewajibkan mengisi alasan (tersimpan di `orders.reject_reason`).
  Pesanan yang ditolak menampilkan banner alasan di halaman detailnya, dan
  admin bisa merevisi datanya (lewat halaman edit) lalu klik "Ajukan Ulang"
  supaya pesanan kembali masuk status menunggu approval — tidak lagi jalan
  buntu.
- **Transaksi database** — pembuatan pesanan baru (insert pesanan + 4 baris
  tahap) dan penghapusan pesanan (semua tabel terkait) sekarang dibungkus
  transaksi `BEGIN`/`COMMIT`/`ROLLBACK`, supaya tidak ada kondisi
  setengah-jadi kalau terjadi error di tengah proses.

### Backup otomatis

- Backup database berjalan otomatis setiap hari (mulai 1 menit setelah
  server dinyalakan, lalu setiap 24 jam), tersimpan di
  `data/auto-backups/` dengan retensi 14 backup terakhir (yang lebih lama
  otomatis terhapus). Kalau proses backup gagal, error-nya dicatat ke log
  server tapi tidak menghentikan aplikasi.
- Halaman "Backup & Restore" menampilkan daftar backup otomatis (tanggal,
  ukuran, tombol unduh per file) dan tombol "Jalankan Backup Sekarang"
  untuk memicu manual di luar jadwal.
- Backup manual (unduh/restore) yang sudah ada sebelumnya tidak berubah.

### Admin kedua & manajemen akun admin

- Bagian baru "Akun Admin" di halaman "Vendor & Pengguna": admin bisa
  membuat akun admin baru, reset password admin lain, dan menghapus akun
  admin. Menghapus admin terakhir yang tersisa **tidak diizinkan** (server
  menolak dengan pesan error) — supaya tidak ada skenario kehilangan
  seluruh akses admin ke aplikasi.

### Ganti vendor pelaksana

- Setiap tahap di halaman detail pesanan punya bagian "Ganti Vendor
  Pelaksana" (admin-only, bisa dibuka/tutup) untuk memindahkan tahap ke
  vendor lain (atau melepas penugasan) tanpa menyentuh riwayat pembayaran
  honor, catatan, atau lampiran yang sudah tercatat di tahap itu.

### Pencarian, filter & export CSV

- Dashboard ("Perlu Perhatian") dan Arsip punya kotak pencarian
  kode/nama pelanggan. Arsip juga punya filter rentang tanggal diarsipkan.
- Tombol "Export CSV" di halaman Arsip: satu untuk daftar pesanan
  diarsipkan (mengikuti filter yang aktif), satu untuk statistik
  pembayaran per vendor. File CSV memakai BOM UTF-8 supaya nama dengan
  karakter khusus tetap terbaca benar saat dibuka di Excel.

### Notifikasi & indikator loading

- **Toast konfirmasi** — banner hijau muncul otomatis setelah aksi
  berhasil (edit pesanan, catat pembayaran, tandai tahap selesai, ganti
  vendor, setuju/tolak pesanan, dll.), hilang otomatis setelah beberapa
  detik atau bisa ditutup manual.
- **Error boundary ramah** — kalau terjadi error di server (misalnya
  validasi gagal), pengguna melihat pesan singkat dengan tombol "Coba
  Lagi", bukan halaman crash teknis bawaan Next.js.
- **Tombol submit dinonaktifkan saat memproses** (`<SubmitButton>`,
  berbasis `useFormStatus`) di semua form penting — mencegah submit dobel
  kalau pengguna mengklik berkali-kali pada koneksi lambat.
- **Belum dikerjakan (sengaja):** notifikasi WhatsApp/email untuk deadline
  mendekat — ini butuh kredensial/akun layanan pihak ketiga (WhatsApp
  Business API, SMTP, dll.) yang belum tersedia untuk aplikasi ini.

### Invoice terhubung ke data pesanan

- Tombol "🧾 Buat Invoice dari Pesanan Ini" di halaman detail pesanan
  membuka form dokumen baru dengan nama pelanggan, jenis, dan jumlah sudah
  terisi otomatis dari data pesanan, dan tersimpan dengan `order_id` yang
  menghubungkannya balik ke pesanan asal. Halaman daftar Invoice &
  Dokumen menampilkan link "Source Order" untuk dokumen yang dibuat lewat
  jalur ini.
- **Catatan penting:** bahasa Inggris dan gaya visual non-Tailwind pada
  modul Invoice & Dokumen **tidak diubah** — ini keputusan desain yang
  sengaja diminta pengguna sebelumnya (lihat bagian "Modul Invoice,
  Quotation & Delivery Note" di atas), bukan sesuatu yang perlu
  diseragamkan.

### Konsistensi tampilan

- Warna divisi "Cutting & Blacksmith" diganti dari merah menjadi
  rose/magenta (`DIVISION_COLORS`, `src/lib/constants.ts`) supaya tidak
  lagi bertabrakan secara visual dengan warna status "Terlambat" — status
  terlambat sekarang satu-satunya elemen berwarna merah di aplikasi.
- Kontras teks kecil dinaikkan (`text-black/45` → `/55`, `/40` → `/50`) di
  seluruh halaman utama.
- Halaman Persetujuan dan filter Arsip dirapikan responsivitasnya untuk
  layar mobile.
- Tautan "kembali" di halaman detail pesanan sekarang mengarah ke halaman
  asal yang benar (Dashboard/Kanban/Kalender/Arsip/Persetujuan) lewat
  parameter `?from=`, bukan selalu ke Dashboard.
- Panel "Distribusi per Divisi" di Dashboard diganti panel "Ringkasan
  Honor Anda" untuk akun vendor yang datanya hanya ada di satu divisi
  (panel distribusi tetap tampil seperti biasa untuk admin/owner dan
  vendor multi-divisi).

### Pembaruan susulan (24 Agustus 2026) — tata letak dokumen & upload foto

Dua penyesuaian lagi berdasarkan masukan langsung setelah pembaruan besar
di atas dikirim:

- **Kop surat & blok alamat modul Invoice & Dokumen dirapikan.** Header
  (logo, nama perusahaan, nomor/tanggal dokumen) dan blok "Bill To"/"Quote
  To"/"Deliver To" sebelumnya memakan banyak ruang vertikal dan — khusus
  untuk Invoice/Quotation yang cuma punya satu blok alamat — melebar
  mengisi seluruh sisa lebar dokumen sampai ke kanan. Sekarang jarak
  antar-baris dipadatkan, lebar blok alamat dibatasi (~320px), dan pada
  Invoice/Quotation, pemilih mata uang ("Currency") ditaruh sebaris di
  sebelah kanan blok alamat alih-alih menggantung sendirian di bawahnya —
  mengikuti tata letak aplikasi invoice standalone asli milik pengguna
  (dikonfirmasi langsung dari cuplikan layarnya). Bahasa Inggris & gaya
  visual modul ini tetap tidak diubah (lihat catatan di atas). Kode:
  `src/app/(app)/invoices/invoice-theme.css`, prop `billTo` baru di
  `src/components/invoice/DocumentEditor.tsx` yang dipakai oleh
  `src/app/(app)/invoices/new/page.tsx` dan `.../[id]/page.tsx`.
- **Kotak upload foto bergaya dropzone**, bukan `<input type="file">`
  polos bawaan browser ("Choose File / No file chosen") — dipakai ulang
  dari pola yang sudah ada di form foto desain pesanan baru (kotak
  putus-putus "+ Upload" yang berganti jadi thumbnail preview begitu foto
  dipilih). Diterapkan di dua tempat: upload foto bukti per tahap (di tab
  "Riwayat Tahap & Catatan") dan "+ Tambah Foto Desain" susulan di detail
  pesanan (yang mendukung pilih banyak foto sekaligus, dengan badge "+N"
  di kotaknya kalau lebih dari satu foto dipilih). Komponen baru:
  `src/components/file-dropzone-input.tsx` (`FileDropzoneInput`) — murni
  perubahan tampilan sisi klien, nama field/atribut wajib/Server Action
  penerimanya semua tidak berubah.

### Pembaruan susulan (26 Agustus 2026) — Nama Vendor & Akun digabung jadi satu

Di backend, nama vendor (`vendor.nama`) dan nama akun login (`user.name`)
sebenarnya sudah selalu disamakan otomatis setiap kali vendor dibuat/diedit
(lihat `createVendorAction`/`updateVendorAction` di
`src/app/(app)/vendors/actions.ts`) — tapi di halaman **Vendor & Pengguna**
keduanya masih tampil seperti dua hal terpisah: nama akun (`@username`)
muncul di kotak tersendiri di bawah nama vendor, dan ada dua tombol hapus
berbeda ("Hapus Vendor" & "Hapus Akun") padahal menghapus vendor sudah
otomatis menghapus akun login-nya juga. Diperbaiki:

- Nama vendor & username sekarang tampil jadi satu baris di header kartu
  vendor ("Vendor Tajam Abadi · @tajamabadi"), bukan di blok terpisah.
- Tombol "Reset Password" dipindah ke baris aksi utama (sebelah "Edit
  Vendor & Akun"), bukan lagi di sub-daftar akun terpisah.
- Tombol "Hapus Akun" (`deleteUserAction`, hapus akun login saja tanpa
  hapus vendornya) dihapus total. Sekarang hanya ada **satu** aksi hapus
  per vendor — "Hapus Vendor" — yang tetap menghapus vendor beserta akun
  login-nya sekaligus, seperti sebelumnya.

Kode: `src/app/(app)/vendors/page.tsx`, `src/app/(app)/vendors/actions.ts`
(fungsi `deleteUserAction` dihapus, tidak dipakai lagi di mana pun).

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
  dari `attachments` yang terikat per tahap). Diunggah lewat form 4-slot
  (`src/components/design-photo-input.tsx`) di
  `src/app/(app)/orders/new/page.tsx` (wajib minimal 1, divalidasi di
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
