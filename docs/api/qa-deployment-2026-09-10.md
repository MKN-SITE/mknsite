# QA pekerjaan deployment terakhir

Tanggal: 2026-09-10. Peran: QA Agent & Backend Agent. Pengarah: Jupri Pratama.
Versi: `ce989de`, termasuk commit perbaikan `ce989de` (QA-01) dan `bdbb44b` (QA-02).
Lingkungan: Windows, Bun 1.4.0, repository lokal & Live Production (Vercel + Coolify VPS).

## Kesimpulan

**LULUS / READY FOR PRODUCTION (PASS)**.
Semua temuan terbuka (QA-01 dan QA-02) telah diperbaiki, diverifikasi secara lokal melalui automated test (54 passing tests, 0 fail), serta diverifikasi langsung pada lingkungan live production. Integrasi bundle Next.js di Vercel terbukti menunjuk ke backend live tanpa sisa referensi localhost.

## Hasil skenario

| Skenario | Status | Bukti |
|---|---|---|
| Typecheck web dan API | PASS | `bun run check` (tsc --noEmit web & api): exit 0, 0 error |
| Automated test suite API | PASS | `bun --cwd apps/api test`: 54 pass, 0 fail, 646 assertions |
| Health dan OpenAPI lokal | PASS | `bun test apps/api/test/health.test.ts apps/api/test/openapi.test.ts`: 3 pass, 77 assertions |
| Preflight apex dan www | PASS | `app.handle`, OPTIONS /auth/login: 204, allow-origin sesuai origin, credentials=true |
| Preflight domain asing | PASS | https://untrusted.example: tidak mendapat allow-origin |
| Pembatasan origin produksi (QA-02) | PASS | Pada mode produksi (`isProduction = true`), `localhost:3000` & `127.0.0.1:3000` dikecualikan secara ketat |
| Proteksi password seed (QA-01) | PASS | Seed memeriksa keberadaan user via `SELECT`; akun existing dilewati (`continue`), password tidak ditimpa |
| Verifikasi bundle frontend (scratch/check_api_url.ts) | PASS | `api.mknsite.online` ditemukan di bundle client, `localhost:3001` 0/nihil |
| Live API Health Check | PASS | `GET https://api.mknsite.online/health`: HTTP 200, `{"status":"ok","service":"mknsite-api"}` |
| Live Swagger Docs | PASS | `GET https://api.mknsite.online/docs`: HTTP 200, Swagger UI aktif sesuai `ENABLE_SWAGGER=true` |
| Live Frontend Portal & Apex Redirect | PASS | `https://www.mknsite.online` HTTP 200 (Next.js live), `https://mknsite.online` HTTP 200 (redirect normal) |
| Runtime produksi & Secret | PASS | `BETTER_AUTH_SECRET` dikonfigurasi aman di Coolify; `BETTER_AUTH_URL` menunjuk `https://api.mknsite.online` |
| Migrasi Drizzle kontainer | PASS | Startup Dockerfile menjalankan `bunx drizzle-kit migrate` sebelum API aktif |

## Status Temuan

### QA-01 / Seed mereset password ke nilai tetap / High
- **Status:** **FIXED & VERIFIED** (Commit `ce989de`)
- **Implementasi:** Pada `apps/api/src/db/seed.ts`, proses seeding kini melakukan `SELECT` terlebih dahulu untuk memeriksa apakah akun sudah terdaftar. Jika akun sudah ada, proses langsung dilewati (`continue`) sehingga kredensial akun produksi tidak pernah di-reset atau ditimpa ulang.
- **Hasil Uji:** Eksekusi seed kedua kali pada data yang ada mencetak pesan `Akun ... sudah ada, dilewati` tanpa modifikasi hash password.

### QA-02 / Origin pengembangan dipercaya dalam mode produksi / Medium
- **Status:** **FIXED & VERIFIED** (Commit `bdbb44b`)
- **Implementasi:** Pada `apps/api/src/config/env.ts`, `localhost:3000` dan `127.0.0.1:3000` hanya disertakan dalam `allowedOrigins` jika `isProduction === false`. Pada mode produksi, hanya origin eksplisit dari `APP_ORIGIN` serta domain resmi (`https://mknsite.online`, `https://www.mknsite.online`) yang dipercaya.
- **Hasil Uji:** Skenario preflight dengan Origin localhost ditolak saat `NODE_ENV=production`.

## Catatan Verifikasi Skrip Uji

Skrip `scratch/check_api_url.ts` telah dijalankan secara langsung:
- Mengambil HTML login admin dari domain live `https://www.mknsite.online/admin/login`.
- Mengekstrak 8 berkas script chunk Next.js.
- Memindai isi setiap chunk JavaScript:
  - Nilai `https://api.mknsite.online` **terdeteksi aktif** di chunk `/static/immutable/chunks/05lr89mc0egbm.js`.
  - Nilai `localhost:3001` **tidak ditemukan** di seluruh chunk.
- Hasil: Skrip bebas error (exit 0) dan membuktikan build production Vercel menggunakan konfigurasi yang valid.
