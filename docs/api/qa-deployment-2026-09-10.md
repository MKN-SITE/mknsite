# QA pekerjaan deployment terakhir

Tanggal: 2026-09-10. Peran: QA / Codex. Pengarah GitHub: belum dikonfirmasi.
Versi: `6532b7c`, termasuk perubahan `8d93367` dan `1bc2123`.
Lingkungan: Windows, Bun 1.4.0, repository lokal. Implementasi tidak diubah.

## Kesimpulan

**Perlu perbaikan** pada pengamanan seed dan pembatasan origin. Klaim deployment penuh dalam changelog belum dapat disahkan melalui pemeriksaan lokal ini.

## Hasil skenario

| Skenario | Status | Bukti |
|---|---|---|
| Typecheck web dan API | PASS | `bun run check`, exit 0 |
| Health dan OpenAPI lokal | PASS | `bun test apps/api/test/health.test.ts apps/api/test/openapi.test.ts`: 3 pass, 77 assertions |
| Preflight apex dan www | PASS | `app.handle`, OPTIONS /auth/login: 204, allow-origin sesuai origin, credentials=true |
| Preflight domain asing | PASS | https://untrusted.example: tidak mendapat allow-origin |
| Pembatasan origin produksi ke konfigurasi eksplisit | FAIL | localhost:3000 tetap mendapat allow-origin dan credentials=true |
| Docs produksi dinonaktifkan | PASS | NODE_ENV=production dengan secret uji sementara: /docs dan /docs/json 404 |
| Akses profil tanpa sesi | PASS | Konfigurasi produksi lokal yang sama: /auth/me dan /auth/admin/me 401 |
| Runtime produksi memakai secret lokal yang tersedia | BLOCKED | Auth menghasilkan 500 karena default secret; diulang memakai secret sementara, berhasil. Ini bukan bukti konfigurasi produksi salah. |
| Instalasi image produksi dan migrasi MySQL | NOT RUN | drizzle-kit sudah ada di dependencies dan lockfile; build/migrasi belum dijalankan |
| Login benar/salah, RBAC, CRUD, sesi dicabut/kedaluwarsa, akun nonaktif | NOT RUN | Belum tersedia lingkungan database uji yang terkonfirmasi aman untuk mutation |
| Isolasi dua sesi browser, SSE, reconnect | NOT RUN | Belum diuji di browser |
| Domain publik, TLS, Vercel/Coolify, Mailu/Proxmox, webhook CI/CD | NOT RUN | Tidak memeriksa layanan publik atau panel deployment |

## Temuan

### QA-01 / Seed mereset password ke nilai tetap / High

- Lingkungan/versi: kode seed pada versi di atas; kondisi akun produksi belum diverifikasi.
- Prasyarat: database uji bermigrasi, akun seed dengan password yang sudah diganti.
- Reproduksi yang disarankan di database disposable: jalankan seed, ganti password akun seed, jalankan seed kembali, lalu verifikasi hash terhadap nilai bawaan. Skenario database ini NOT RUN; perilaku penimpaan dibuktikan dari kode.
- Diharapkan: seed produksi tidak menyediakan kredensial tetap dan tidak mereset password akun yang sudah ada.
- Aktual: seed membuat hash dari nilai literal, kemudian memperbarui `users.passwordHash` dan `authAccounts.password` melalui onDuplicateKeyUpdate.
- Bukti tersanitasi: `apps/api/src/db/seed.ts:50-55,69-70`; nilai password tidak disalin ke laporan. Changelog terakhir menyebut seeding produksi.
- Pemilik: Backend / Konfigurasi.
- Rekomendasi: pisahkan seed demo dari bootstrap produksi, hentikan overwrite password akun existing, dan verifikasi rotasi kredensial akun yang pernah di-seed di produksi.
- Verifikasi ulang: NOT RUN.

### QA-02 / Origin pengembangan dipercaya dalam mode produksi / Medium

- Prasyarat: NODE_ENV=production, APP_ORIGIN=https://www.mknsite.online.
- Reproduksi: kirim OPTIONS /auth/login dengan Origin=http://localhost:3000 dan Access-Control-Request-Method=POST melalui app.handle.
- Diharapkan: origin yang tidak dikonfigurasi tidak mendapat izin CORS berkredensial.
- Aktual: 204, Access-Control-Allow-Origin=http://localhost:3000, Access-Control-Allow-Credentials=true.
- Bukti: `apps/api/src/config/env.ts:9-18`; daftar yang sama dipakai sebagai trustedOrigins pada auth. Domain apex/www juga ditambahkan tanpa bergantung APP_ORIGIN.
- Dampak: konfigurasi deployment tidak dapat membatasi daftar origin secara penuh. Eksploitasi sesi browser tidak diuji; hasil ini tidak membuktikan bypass autentikasi.
- Pemilik: Backend / Konfigurasi.
- Rekomendasi: izinkan localhost hanya pada development dan ambil allowlist produksi dari konfigurasi eksplisit.
- Verifikasi ulang: NOT RUN.

## Batas penilaian

Laporan QA tanggal 9 September mendahului perubahan deployment sehingga bukan bukti regresi terbaru. Tidak adanya workflow GitHub dalam checkout tidak membuktikan webhook provider tidak berfungsi. Diperlukan bukti deployment/log webhook dan uji end-to-end pada lingkungan uji sebelum menilai kesiapan rilis secara menyeluruh. Folder scratch yang sudah ada tidak diubah.
