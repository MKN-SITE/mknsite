# Audit integrasi portal HR dan OPS Telco

Tanggal audit: 2026-09-15 16:10 WITA

Platform: Codex; peran Frontend, Backend, DevOps, dan QA Agent

Branch sumber: `codex/hr-telco-portal`

Baseline main: `f019389`
Lingkungan: Docker lokal terisolasi, Bun 1.4.0, MySQL 8.4, Next.js 16.3.4

## Kesimpulan

**Siap untuk cakupan yang diuji dan siap direview melalui PR.** Tidak ditemukan defect terbuka Critical, High, Medium, atau Low pada cakupan HR/Telco setelah perbaikan. Penilaian ini bukan persetujuan deployment produksi: backup, pengujian staging dengan konfigurasi nyata, dan persetujuan hasil cetak tetap wajib.

## Cakupan dan hasil

| Area | Skenario | Status | Bukti |
|---|---|:---:|---|
| Integrasi Git | `origin/main` terbaru menjadi ancestor branch fitur; konflik migrasi dan header diselesaikan | PASS | Pemeriksaan ancestor dan status Git sebelum push |
| Pemeriksaan statis | TypeScript frontend dan API | PASS | `bun run check` |
| Regresi API | Auth, sesi, admin, RBAC, realtime, HR, Telco, divisi, menu, dan OpenAPI | PASS | 92 test, 793 assertion, 0 gagal |
| Regresi frontend | Komponen admin, portal, menu, role, pengguna, dan logo terbaru | PASS | 56 test, 502 assertion, 0 gagal |
| Migrasi | Database fresh, HR legacy, schema hasil `db:push`, schema parsial PR #35, dan database yang sudah menerima main; setiap skenario juga dijalankan ulang | PASS | Lima skenario disposable; data/form/menu/nama role/grant kustom dipertahankan |
| Konsistensi schema | Schema Drizzle terhadap snapshot migrasi | PASS | `db:generate`: tidak ada perubahan baru |
| Build frontend | Build produksi seluruh 26 route | PASS | Next.js production build, 0 error |
| Image API | Build dengan tiga master PDF | PASS | Dockerfile berhenti bila salah satu PDF master hilang |
| Mode produksi API | Migrasi → seed aman → startup; `/health`; docs default tertutup | PASS | `/health` 200; `/docs` dan `/docs/json` 404 |
| HR browser | Login HR uji, simpan draf, nomor otomatis, kunci aksi saat dirty, batalkan, unduh PDF, duplikasi, identitas salinan kosong | PASS | Preview terisolasi `localhost:3101`, nomor uji OC-2026-00037/00038 |
| Otorisasi browser | Akun HR tanpa izin Telco membuka `/portal/ops-telco` | PASS | Halaman menampilkan “Akses tidak tersedia”; API juga menguji matriks submenu |
| Console browser | Error/warning pada alur HR dan penolakan Telco | PASS | Tidak ada error atau warning browser |
| Smoke stack | Web routes, login database, allow/deny RBAC, isolasi sesi admin/karyawan, dan logout | PASS | `scripts/verify-docker.mjs` pada stack preview terisolasi |
| PDF | Oncall, Overtime, dan Cuti dibuat dari image produksi dan dirender | PASS | Letter 612×792; elemen master tetap menjadi background; overflow/karakter font tak didukung ditolak |

## Perbaikan hasil audit

- Migrasi resmi main `0003_powerful_puppet_master` dipertahankan utuh. Migrasi HR aktif dipindahkan sesudahnya menjadi `0004_hr_portal`; sejarah branch lama disimpan di `drizzle/history/hr-legacy`.
- Runner migrasi memakai advisory lock dan menangani schema PR #35 yang pernah dipasang penuh/sebagian lewat `db:push`. Rekonsiliasi hanya berjalan bila baseline `0002` tercatat dan menghentikan pola DDL yang tidak dikenali.
- Seed produksi tidak membuat akun atau password contoh. Seed hanya melengkapi katalog serta memperbaiki relasi Better Auth akun bootstrap yang telah ada menggunakan hash saat ini; konflik identitas dihentikan untuk review.
- Semua endpoint HR memeriksa sesi, `hr.view`, kepemilikan objek atau `hr.manage`, Origin mutasi, input, transisi status, dan batas PDF. Penomoran dibuat server di dalam transaksi.
- Submenu Telco memerlukan izin induk `ops_telco.view` dan izin submenu pada server. Teknisi tidak menerima submenu supervisor; supervisor dapat menerima kedua kelompok sesuai grant.
- UI mencegah unduh, duplikasi, memilih riwayat, membuat formulir baru, mengajukan, dan berpindah route saat ada perubahan belum disimpan. Pengguna harus menyimpan atau membatalkan dulu.
- Contoh konfigurasi produksi memakai placeholder dan mensyaratkan `BETTER_AUTH_SECRET` dari secret manager.

## Batasan dan pemeriksaan sebelum deployment

- Tujuh submenu Telco masih berupa halaman awal dengan otorisasi. Penugasan job, PTO, jadwal, pengiriman WAG, quotation, dan penyimpanan dokumentasi belum diimplementasikan.
- PDF memelihara background master dan menambahkan teks Helvetica. Nama tanda tangan adalah teks tercetak, bukan tanda tangan elektronik. Perhitungan saldo cuti/payroll dari Excel belum otomatis.
- Pemilik formulir harus menyetujui cetak fisik Letter pada skala 100% / Actual size sebelum rilis.
- Deployment live tidak dijalankan pada audit ini. Sebelum merge/deploy: backup dan uji restore, migrasikan salinan database produksi, cek storage upload, variabel Coolify/Vercel, trusted proxy/IP untuk rate limiting, lalu ulangi smoke test login/RBAC/PDF di staging.
- Menu utama HR dan OPS Telco tetap harus dibuat atau diaktifkan melalui Administrasi dengan permission `hr.view` dan `ops_telco.view`.

Data formulir sintetis audit sudah dihapus dari database preview setelah verifikasi. Database aplikasi lokal utama dan aplikasi live tidak diubah.
