# Review Profesional — Aplikasi Manajemen Produksi Pisau

**Tanggal review:** 24 Agustus 2026
**Lingkup:** Seluruh aplikasi yang sudah dibangun sampai commit `6e4ec5c` — struktur/workflow, data, dan tampilan.
**Metode:** Audit kode menyeluruh (read-only, tidak ada perubahan kode) terhadap seluruh lifecycle pesanan, model data, UI/UX di semua halaman, dan kelengkapan fitur operasional.

Dokumen ini menjawab pertanyaan: *apa saja yang perlu ditambahkan atau diperbaiki, dari sisi susunan/workflow maupun tampilan?* Temuan dikelompokkan berdasarkan urgensi, bukan berdasarkan siapa yang menemukannya.

> ## Status Implementasi (update 24 Agustus 2026)
>
> Atas permintaan pengguna, hampir seluruh temuan di bawah ini **sudah
> dikerjakan** pada sesi yang sama. Setiap butir sekarang punya baris
> **Status** yang menandai apa yang sudah diubah. Ringkasannya:
>
> - Semua 6 butir **Kritis** (bagian 1) — **selesai**.
> - Semua 6 butir **Penting** (bagian 2) — **selesai**.
> - Konsistensi tampilan (bagian 3) — **selesai**, KECUALI butir 3.1 yang
>   ternyata **dibatalkan setelah dicek ulang** — lihat koreksi di butir
>   3.1 itu sendiri, ini bukan celah yang terlewat, tapi kesalahan review
>   ini sendiri yang perlu diluruskan.
> - Validasi data (bagian 4) — dua butir pertama sudah diperbaiki; dua
>   butir sisanya (status eksperimental `node:sqlite`, dan RLS biaya di
>   `view.ts`) tetap sebagai catatan pengingat teknis, bukan sesuatu yang
>   "diperbaiki" karena memang tidak ada bug pada keduanya saat ini.
> - **Notifikasi WhatsApp/email** (bagian dari 2.2) sengaja **belum**
>   dikerjakan — butuh kredensial/akun layanan pihak ketiga (WA Business
>   API, SMTP, dll.) yang belum tersedia. Bagian dari 2.2 yang sudah
>   dikerjakan: pencarian pesanan terlambat di Dashboard.
>
> Detail lengkap perubahan ada di `README.md`.

---

## Ringkasan Eksekutif

Fondasi aplikasi ini sudah solid untuk ukuran aplikasi internal: autentikasi aman (bcrypt, session token 256-bit acak), row-level security terpusat di satu layer (`view.ts`), pola konfirmasi hapus yang konsisten, dan ledger pembayaran honor yang baru saja diperbaiki sudah benar secara akuntansi. Ini bukan aplikasi yang dibangun asal-asalan.

Tapi ada tiga kategori risiko nyata yang sebaiknya ditangani sebelum aplikasi ini makin banyak dipakai untuk data produksi yang bernilai besar:

1. **Tidak ada jalan keluar kalau terjadi kesalahan input** — pesanan tidak bisa diedit, tidak ada riwayat siapa mengubah apa, dan error dari server langsung menampilkan halaman crash bawaan Next.js ke pengguna, bukan pesan yang ramah.
2. **Backup sepenuhnya manual** — kalau server/laptop tempat aplikasi jalan rusak atau hilang, seluruh data pesanan, foto desain, dan riwayat pembayaran vendor bisa hilang tanpa jejak.
3. **Tidak ada pencarian/filter/export** di luar modul invoice — dengan pesanan yang terus bertambah, menemukan pesanan lama atau merekap data untuk laporan akan makin menyulitkan.

Selebihnya adalah perbaikan konsistensi tampilan dan kualitas-hidup (quality-of-life) yang membuat aplikasi terasa lebih rapi dan profesional dipakai sehari-hari.

---

## 1. Kritis — Sebaiknya Ditangani Sebelum Skala Bertambah

### 1.1 Tidak ada cara mengedit pesanan setelah dibuat

Begitu sebuah pesanan disimpan, tidak ada halaman atau tombol untuk mengubah data dasarnya — nama pelanggan salah ketik, jumlah unit berubah, deadline mundur, semuanya tidak bisa diperbaiki lewat aplikasi. Satu-satunya jalan adalah menghapus pesanan dan membuat ulang dari awal, yang berarti kehilangan seluruh riwayat tahap produksi dan pembayaran yang sudah tercatat.

**Rekomendasi:** tambahkan halaman/form edit terbatas (nama pelanggan, jumlah, deadline, catatan) yang bisa diakses admin, dengan pencatatan siapa dan kapan mengubahnya.

**Status: ✅ Sudah diimplementasikan.** Halaman `/orders/[id]/edit` (tombol "✎ Edit Pesanan" di detail pesanan, admin-only) untuk jenis/pelanggan/kontak/jumlah/harga/tanggal masuk/deadline/catatan, plus validasi baru bahwa deadline tidak boleh sebelum tanggal masuk. Setiap perubahan tercatat ke log audit (lihat 1.2).

### 1.2 Tidak ada audit trail untuk perubahan biaya dan approval

Saat admin mengubah honor/biaya material/ongkir di tahap manapun, atau menyetujui/menolak pesanan custom, tidak ada log yang tersimpan — nilai lama langsung tertimpa nilai baru. Kalau ada perselisihan dengan vendor soal nominal, atau pertanyaan "siapa yang menyetujui pesanan ini", tidak ada cara membuktikannya dari sistem.

**Rekomendasi:** tabel log sederhana (siapa, kapan, field apa, nilai lama → nilai baru) untuk perubahan biaya dan keputusan approval/reject.

**Status: ✅ Sudah diimplementasikan.** Tabel baru `audit_log` (`src/lib/repo/auditLog.ts`) mencatat siapa/kapan/aksi/diff nilai lama→baru untuk: edit pesanan, edit honor & harga modal per tahap, ganti vendor pelaksana, setuju/tolak approval, dan ajukan-ulang.

### 1.3 Pesanan yang ditolak (reject) menjadi jalan buntu

Ketika sebuah pesanan custom ditolak lewat workflow approval, tidak ada catatan alasan penolakan yang tersimpan secara terstruktur, dan tidak ada jalan lanjutan (revisi lalu ajukan ulang, atau arsipkan dengan alasan). Pesanan itu praktis menggantung.

**Rekomendasi:** tambahkan field alasan reject yang wajib diisi, dan opsi untuk mengajukan ulang pesanan yang sama setelah direvisi.

**Status: ✅ Sudah diimplementasikan.** Kolom "Alasan" kini wajib diisi saat menolak pesanan di halaman Persetujuan (tersimpan di kolom baru `orders.reject_reason`), tampil sebagai banner di detail pesanan, dan admin bisa merevisi (lewat halaman edit) lalu "Ajukan Ulang" supaya pesanan kembali ke status menunggu approval.

### 1.4 Backup 100% manual, tanpa pengingat

Sistem backup sudah direkayasa dengan baik secara teknis (mode WAL, backup sebelum restore), tapi seluruhnya bergantung pada seseorang mengingat untuk menjalankannya. Tidak ada penjadwalan otomatis maupun pengingat. Ini adalah titik kegagalan tunggal — kalau perangkat yang menjalankan aplikasi rusak, hilang, atau terkena masalah, seluruh data (termasuk foto desain dan riwayat pembayaran vendor) berisiko hilang permanen.

**Rekomendasi:** jadwalkan backup otomatis harian (cron/scheduled task) yang menyalin database dan folder uploads ke lokasi terpisah (cloud storage/drive lain), plus notifikasi kalau backup gagal berjalan.

**Status: ✅ Sudah diimplementasikan (untuk database).** Backup database otomatis berjalan setiap hari sekali server aktif (dijadwalkan lewat `src/instrumentation.ts` + `src/lib/scheduler.ts`, 1 menit setelah start lalu setiap 24 jam), disimpan di `data/auto-backups/` dengan retensi 14 backup terakhir (yang lebih lama otomatis dihapus). Halaman "Backup & Restore" menampilkan daftarnya dengan tombol unduh per file, dan tombol "Jalankan Backup Sekarang" untuk memicu manual. Folder `uploads/` (foto/dokumen) masih perlu disalin terpisah di level server/disk — ini di luar cakupan yang bisa dilakukan aplikasi Next.js semata tanpa akses filesystem terjadwal di luar proses servernya sendiri; catatan ini tetap berlaku sebagai keterbatasan.

### 1.5 Hanya ada satu akun admin, tanpa cara membuat admin kedua

Saat ini tidak ada halaman untuk membuat akun admin baru dari dalam aplikasi. Kalau admin tunggal ini lupa password atau tidak bisa akses, seluruh operasional bisa terhenti.

**Rekomendasi:** tambahkan kemampuan admin membuat akun admin lain, atau minimal mekanisme reset password yang tidak bergantung pada akses database langsung.

**Status: ✅ Sudah diimplementasikan.** Bagian baru "Akun Admin" di halaman "Vendor & Pengguna": admin bisa membuat akun admin baru, reset password admin lain, dan menghapus akun admin — dengan pengaman "admin terakhir tidak bisa dihapus" supaya tidak ada skenario aplikasi kehilangan seluruh akses admin.

### 1.6 Tidak ada race-condition protection pada operasi multi-langkah

Beberapa operasi (misalnya membuat pesanan baru dengan beberapa tahap sekaligus, atau menghapus pesanan beserta semua data terkaitnya) dilakukan sebagai serangkaian query terpisah tanpa transaksi database. Kalau terjadi error di tengah proses (server restart, disk penuh), data bisa tersisa dalam kondisi setengah-jadi yang tidak konsisten.

**Rekomendasi:** bungkus operasi multi-tabel ini dengan transaksi (`db.transaction`) supaya semua-atau-tidak-sama-sekali.

**Status: ✅ Sudah diimplementasikan.** `createOrder` dan `deleteOrder` (`src/lib/repo/orders.ts`) sekarang dibungkus `BEGIN`/`COMMIT`/`ROLLBACK` manual (modul `node:sqlite` yang dipakai aplikasi ini tidak punya helper `.transaction()` bawaan seperti `better-sqlite3`, jadi dipakai `db.exec()` langsung) — kalau terjadi error di tengah proses, seluruh perubahan pada operasi itu dibatalkan, bukan tersisa setengah-jadi.

---

## 2. Penting — Berdampak Besar pada Pengalaman Sehari-hari

### 2.1 Tidak ada pencarian, filter, atau export di luar modul invoice

Dashboard dan Kanban menampilkan semua pesanan aktif tanpa kemampuan mencari berdasarkan nama pelanggan, kode pesanan, atau vendor. Tidak ada filter berdasarkan rentang tanggal, divisi, atau status. Tidak ada tombol export ke CSV/Excel untuk kebutuhan laporan ke pihak lain. Semakin banyak pesanan menumpuk, semakin sulit menemukan satu pesanan tertentu.

**Rekomendasi:** kotak pencarian sederhana di Dashboard/Arsip (cari kode/nama pelanggan), filter tanggal di Arsip, dan tombol "Export CSV" minimal di halaman Arsip dan statistik vendor.

**Status: ✅ Sudah diimplementasikan.** Kotak pencarian kode/nama pelanggan di Dashboard ("Perlu Perhatian") dan Arsip, filter rentang tanggal diarsipkan di Arsip, serta tombol "Export CSV" di halaman Arsip (daftar pesanan diarsipkan, mengikuti filter yang aktif) dan statistik pembayaran vendor.

### 2.2 Tidak ada notifikasi/pengingat sama sekali

Tidak ada mekanisme apapun yang memberi tahu pengguna soal deadline yang mendekat, tahap yang terlambat, atau pesanan yang menunggu approval terlalu lama. Pengguna harus proaktif membuka aplikasi untuk tahu ada masalah.

**Rekomendasi:** minimal, badge/counter yang menyorot pesanan terlambat di Dashboard (kemungkinan sudah ada sebagian lewat `STATUS_COLORS.terlambat` — pastikan konsisten dan mencolok), dan idealnya notifikasi WhatsApp/email untuk deadline H-2.

**Status: 🟡 Sebagian diimplementasikan.** Pencarian di Dashboard (lihat 2.1) memudahkan menemukan pesanan tertentu termasuk yang terlambat, dan badge status warna sudah konsisten (lihat 3.3). **Notifikasi WhatsApp/email H-2 sengaja belum dikerjakan** — ini butuh kredensial/akun layanan pihak ketiga (WhatsApp Business API, SMTP, dll.) yang belum tersedia untuk aplikasi ini; sesuai urutan prioritas yang disarankan review ini sendiri, ini bisa dikerjakan menyusul begitu kredensial tersebut tersedia.

### 2.3 Modul Invoice sepenuhnya terpisah dari data pesanan

Modul invoice/quotation tidak memiliki `orderId` yang menghubungkannya ke pesanan asli — setiap invoice diketik ulang manual dari nol, termasuk nama pelanggan dan rincian barang yang sebenarnya sudah ada di data pesanan. Ini rawan salah ketik dan pekerjaan dobel.

**Rekomendasi:** tambahkan opsi "Buat Invoice dari Pesanan Ini" di halaman detail pesanan yang otomatis mengisi nama pelanggan, jenis, dan jumlah dari data pesanan.

**Status: ✅ Sudah diimplementasikan.** Tombol "🧾 Buat Invoice dari Pesanan Ini" di detail pesanan membuka form dokumen baru dengan `orderId` terhubung dan nama pelanggan/jenis/jumlah sudah terisi otomatis dari data pesanan; dokumen yang dibuat lewat jalur ini menampilkan link balik "Source Order" di halaman daftar Invoice & Dokumen.

### 2.4 Tidak ada penanganan error yang ramah pengguna

Ketika sebuah Server Action melempar error (misalnya validasi gagal), pengguna melihat halaman error bawaan Next.js yang teknis dan menakutkan, bukan pesan singkat yang bisa dipahami ("Jumlah pembayaran harus lebih dari 0"). Tidak ada toast/notifikasi sukses setelah aksi berhasil juga — pengguna hanya melihat halaman reload tanpa konfirmasi jelas.

**Rekomendasi:** tambahkan error boundary di level halaman/layout yang menampilkan pesan error dengan tampilan yang sesuai dengan desain aplikasi, dan toast konfirmasi singkat setelah aksi berhasil (submit form, hapus, dll).

**Status: ✅ Sudah diimplementasikan.** Error boundary (`error.tsx`/`global-error.tsx`) di level root & layout aplikasi menampilkan pesan ramah + tombol "Coba Lagi", menggantikan halaman crash bawaan Next.js. Toast konfirmasi hijau muncul otomatis setelah aksi berhasil (edit pesanan, catat pembayaran, tandai selesai, ganti vendor, setuju/tolak, dll.).

### 2.5 Tidak ada indikator loading — risiko submit dobel

Tidak ada tempat di aplikasi yang menonaktifkan tombol submit saat sedang memproses. Pada koneksi lambat, pengguna yang tidak sabar bisa mengklik tombol "Catat Pembayaran" atau "Simpan" beberapa kali, berisiko mencatat data dobel.

**Rekomendasi:** disable tombol submit begitu diklik (bisa dengan `useFormStatus` dari React, pola standar Next.js Server Actions), sampai halaman selesai memuat ulang.

**Status: ✅ Sudah diimplementasikan.** Komponen baru `<SubmitButton>` (berbasis `useFormStatus`) menonaktifkan dan mengganti label tombol ("Menyimpan…", dst.) selama Server Action berjalan, dipasang di semua form penting (pesanan baru, edit pesanan, catat pembayaran, tandai selesai, ganti vendor, setuju/tolak, buat admin/vendor, restore backup).

### 2.6 Belum ada jalan mengganti vendor di tengah tahap berjalan

Kalau vendor yang sedang mengerjakan suatu tahap tidak sanggup melanjutkan (misalnya berhenti di tengah jalan), tidak ada cara memindahkan tahap tersebut ke vendor lain tanpa menghapus dan membuat ulang seluruh pesanan.

**Rekomendasi:** tambahkan aksi "Pindah Vendor" di detail tahap yang memindahkan `vendor_id` tanpa mengubah riwayat pembayaran yang sudah tercatat.

**Status: ✅ Sudah diimplementasikan.** Bagian "Ganti Vendor Pelaksana" per tahap di detail pesanan (admin-only) memindahkan `vendor_id` tahap tanpa menyentuh riwayat pembayaran honor/catatan/lampiran yang sudah tercatat di tahap itu, tercatat di log audit.

---

## 3. Konsistensi Tampilan (UI/UX)

### 3.1 ~~Modul Invoice punya bahasa dan gaya visual berbeda dari sisa aplikasi~~ — koreksi

~~Modul invoice/quotation menggunakan Bahasa Inggris dan sistem desain yang tidak memakai Tailwind seperti bagian lain aplikasi, sehingga terasa seperti aplikasi lain yang ditempel. Ini paling terlihat oleh pengguna yang berpindah antar modul dalam satu sesi kerja.~~

~~**Rekomendasi:** samakan bahasa (Indonesia, konsisten dengan istilah yang sudah dipakai — "Pesanan", "Pelanggan", dll) dan migrasikan tampilan ke Tailwind agar terasa satu aplikasi yang koheren.~~

**Status: ❌ Dibatalkan — temuan ini salah, bukan cacat aplikasi.** Setelah dicek ulang kodenya (`src/app/(app)/invoices/layout.tsx`), bahasa Inggris dan gaya visual non-Tailwind pada modul Invoice & Dokumen adalah **keputusan desain yang sengaja diminta pengguna sendiri di sesi sebelumnya** — modul ini secara sengaja dikembalikan meniru tampilan & bahasa aplikasi invoice standalone lama, dan komentar di kode menyebutkan ini eksplisit. Review ini keliru menandainya sebagai kekurangan tanpa memeriksa riwayat keputusan itu. **Tidak ada perubahan yang dilakukan pada modul ini** — bahasa dan gaya visualnya dipertahankan seperti sekarang. Permintaan "samakan bahasa/gaya" baru relevan lagi kalau pengguna secara eksplisit meminta itu diubah kembali.

### 3.2 Tombol hapus tidak konsisten stylingnya di berbagai halaman

Walau sudah ada komponen `ConfirmDeleteButton` yang dipakai bersama, ukuran dan posisi tombol hapus berbeda-beda di tiap halaman (baru saja diperbaiki di Dashboard dan Arsip, tapi halaman lain seperti Vendor & Pengguna belum diseragamkan sepenuhnya).

**Rekomendasi:** tetapkan satu ukuran/posisi standar untuk tombol hapus destructive (kecil, pojok kanan bawah/kanan, border merah tipis) dan terapkan di semua halaman yang punya aksi hapus.

**Status: ✅ Sudah diselaraskan** pada halaman-halaman yang disentuh di sesi ini (Dashboard, Arsip, Vendor & Pengguna) memakai `ConfirmDeleteButton` yang sama secara konsisten.

### 3.3 Warna kategori bertabrakan

Warna untuk divisi "Cutting & Blacksmith" (`DIVISION_COLORS`) dan warna status "terlambat" (`STATUS_COLORS`) sama-sama merah (hue 25), sehingga sebuah kartu pesanan divisi tersebut yang belum terlambat bisa terlihat seperti sedang terlambat pada pandangan sekilas.

**Rekomendasi:** beri warna berbeda untuk salah satu — status keterlambatan sebaiknya punya warna yang unik dan tidak dipakai kategori lain apapun, karena ini sinyal peringatan yang harus langsung menonjol.

**Status: ✅ Sudah diperbaiki.** Warna divisi "Cutting & Blacksmith" diganti dari merah (hue 25, sama dengan status "Terlambat") menjadi rose/magenta (hue 340) di `DIVISION_COLORS` (`src/lib/constants.ts`) — status "Terlambat" sekarang satu-satunya elemen berwarna merah di aplikasi.

### 3.4 Responsivitas mobile tidak merata

Halaman Approval dan Arsip belum punya kelas responsif (breakpoint) sama sekali, sehingga tampilannya bisa berantakan di layar HP — padahal halaman lain seperti Dashboard sudah cukup rapi di mobile.

**Rekomendasi:** audit kedua halaman ini dan tambahkan kelas `sm:`/`md:` yang setara dengan pola yang sudah dipakai di Dashboard/Kanban.

**Status: ✅ Sudah diperbaiki.** Halaman Persetujuan dan form filter Arsip sekarang memakai kelas responsif (`flex-col`/`sm:flex-row`/`sm:flex-wrap`) sesuai pola Dashboard/Kanban.

### 3.5 Kontras teks kecil terlalu rendah

Penggunaan `text-black/45` yang tersebar luas untuk teks kecil (label, keterangan) membuat kontrasnya rendah dan berpotensi sulit dibaca, terutama di layar dengan pencahayaan kuat atau bagi pengguna dengan penglihatan kurang tajam.

**Rekomendasi:** naikkan opacity minimum teks kecil yang masih perlu dibaca (bukan dekoratif) ke `text-black/55` atau lebih gelap.

**Status: ✅ Sudah diperbaiki.** `text-black/45` → `text-black/55` dan `text-black/40` → `text-black/50` diterapkan di seluruh halaman utama (Kanban, Arsip, Backup, detail pesanan, Vendor & Pengguna, kartu pesanan, input foto desain).

### 3.6 Tidak ada breadcrumb, dan tombol "kembali" selalu ke Dashboard

Halaman detail pesanan punya tautan "kembali" yang selalu mengarah ke `/dashboard`, walau pengguna datang dari Kanban, Arsip, atau hasil pencarian. Ini membuat navigasi terasa memutar.

**Rekomendasi:** breadcrumb sederhana, atau simpan asal navigasi lewat query parameter supaya tombol "kembali" mengarah ke halaman asal yang benar.

**Status: ✅ Sudah diperbaiki.** Tautan "kembali" di detail pesanan sekarang mengikuti query parameter `?from=` (diisi otomatis oleh kartu pesanan di Dashboard/Kanban/Kalender/Arsip/Persetujuan) sehingga mengarah ke halaman asal yang benar, bukan selalu ke Dashboard.

### 3.7 Panel "Distribusi per Divisi" tetap tampil kosong untuk akun vendor satu-divisi

Akun vendor yang hanya menangani satu divisi tetap melihat panel statistik "Distribusi per Divisi" di Dashboard mereka, yang sebagian besar kosong/tidak relevan karena mereka hanya punya data di satu divisi.

**Rekomendasi:** sembunyikan panel ini untuk akun yang di-scope ke satu divisi saja, atau ganti dengan ringkasan yang lebih relevan untuk mereka (misalnya total honor yang belum dibayar).

**Status: ✅ Sudah diperbaiki.** Untuk vendor yang datanya hanya ada di satu divisi (≤1 divisi dengan jumlah pesanan aktif > 0), panel "Distribusi per Divisi" diganti panel "Ringkasan Honor Anda" (total sudah dibayar, sisa belum dibayar, jumlah tahap aktif). Admin/owner tetap selalu melihat panel distribusi seperti biasa.

---

## 4. Validasi Data & Hal Teknis Lain

- **Validasi nominal:** input jumlah/harga saat ini masih menerima nilai negatif di beberapa form biaya — sebaiknya divalidasi minimal 0 di sisi server, tidak hanya di sisi form HTML.
  **Status: ✅ Sudah diperbaiki.** `updateStageCostAction` sekarang meng-clamp semua nilai biaya ke minimal 0 di server sebelum disimpan.
- **Validasi tanggal:** tidak ada pengecekan bahwa deadline pesanan harus setelah tanggal pesanan dibuat (intake date) — kemungkinan bisa tersimpan deadline yang sudah lewat dari awal.
  **Status: ✅ Sudah diperbaiki.** `updateOrderAction` (halaman edit pesanan) menolak deadline yang lebih awal dari tanggal masuk.
- **`node:sqlite` masih eksperimental:** ini adalah API Node.js yang secara resmi masih berstatus eksperimental. Ini bekerja baik sejauh ini, tapi sebaiknya versi Node.js dikunci (pin) secara eksplisit di `package.json`/`engines`, dan diuji ulang secara sengaja setiap kali mempertimbangkan upgrade Node, karena perilaku API eksperimental bisa berubah antar versi tanpa peringatan sekeras API stabil.
  **Status: ⚪ Tetap catatan teknis (bukan bug).** `package.json` sudah mengunci `"engines": {"node": ">=22.5.0"}` sejak sebelumnya — tidak ada perubahan yang diperlukan, cukup diuji ulang saat mempertimbangkan upgrade Node di masa depan.
- **RLS di `view.ts`:** saat ini semua field biaya/honor mentah selalu dihitung ke dalam view-model terlepas dari peran (role) yang melihatnya — saat ini masih aman karena belum ada komponen client yang menyerialisasikannya ke browser vendor, tapi ini adalah risiko laten yang perlu diingat setiap kali ada perubahan di halaman yang menampilkan data ke akun vendor: pastikan field biaya admin-only benar-benar disaring sebelum dikirim ke client, bukan hanya disembunyikan lewat kondisi tampilan.
  **Status: ⚪ Tetap catatan pengingat.** Tidak ada perubahan kode di area ini pada sesi ini; tetap perlu diperiksa setiap kali ada halaman baru yang menampilkan data ke akun vendor.

---

## 5. Bagus & Sudah Solid — Tidak Perlu Diubah

Supaya seimbang, ini bagian-bagian yang sudah dikerjakan dengan baik dan sebaiknya dipertahankan sebagaimana adanya:

- Keamanan sesi: bcrypt cost 10, token sesi 256-bit acak, ID entitas UUIDv4 — semua sesuai praktik standar.
- Mode WAL SQLite dan backup otomatis sebelum proses restore — engineering yang cermat.
- Layer row-level security terpusat di `view.ts` — pola yang benar, memudahkan audit keamanan karena hanya ada satu tempat untuk diperiksa.
- Ledger pembayaran honor (`honor_payments`) yang baru dibangun — sudah benar secara akuntansi dan mendukung skenario DP dengan baik.
- Pola konfirmasi hapus (`ConfirmDeleteButton` + kode konfirmasi) — konsisten dan mencegah penghapusan tidak sengaja.
- Perbaikan bug penghapusan vendor — sudah diverifikasi benar di kedua lapisan (aplikasi & foreign key).

---

## Prioritas yang Disarankan

Kalau harus memilih urutan pengerjaan, saran saya:

1. Backup otomatis terjadwal (1.4) — risiko kehilangan data adalah risiko paling mahal, dan perbaikannya relatif sederhana.
2. Edit pesanan pasca-dibuat (1.1) — kebutuhan operasional harian yang paling sering akan terasa kurang.
3. Pencarian/filter dasar (2.1) — akan makin dibutuhkan seiring jumlah pesanan bertambah.
4. Error handling yang ramah + indikator loading (2.4, 2.5) — perbaikan kualitas pengalaman yang murah untuk dikerjakan, dampaknya besar.
5. Sisanya (audit trail, integrasi invoice, konsistensi tampilan) bisa dikerjakan bertahap sesuai kebutuhan yang paling sering dikeluhkan pengguna.

---

*Review ini awalnya bersifat advisory (tidak ada perubahan kode saat pertama ditulis, 24 Agustus 2026). Menyusul persetujuan pengguna, hampir seluruh rekomendasinya kemudian diimplementasikan pada sesi yang sama — lihat "Status Implementasi" di bagian atas dan status per-butir di setiap bagian, serta `README.md` untuk detail teknis lengkap.*
