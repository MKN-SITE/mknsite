# Deployment MKN Site

## Topologi

```text
Browser
  |-- https://app.example.com  -> Vercel, Next.js
  |-- https://api.example.com  -> Cloudflare Tunnel -> Coolify -> Elysia :3001
                                                        |
                                                        -> MySQL private network
```

Gunakan subdomain dari domain induk yang sama agar cookie, CORS, dan kebijakan browser lebih mudah dikelola.

## Vercel

- Root Directory: `apps/web`
- Framework Preset: Next.js
- Environment variable: `NEXT_PUBLIC_API_URL=https://api.example.com`
- Pasang domain `app.example.com`.

## Coolify

- Buat aplikasi dari repository yang sama.
- Base Directory / build context: root repository (`/`)
- Dockerfile location: `/apps/api/Dockerfile`
- Build Pack: Dockerfile
- Port exposed: `3001`
- Health check: `/health`
- Environment variables:

```text
NODE_ENV=production
PORT=3001
APP_ORIGIN=https://app.example.com
DATABASE_URL=mysql://USER:PASSWORD@mysql:3306/mknsite
BETTER_AUTH_URL=https://api.example.com
COOKIE_DOMAIN=
ENABLE_SWAGGER=false
DOCS_PROVIDER=swagger-ui
```

### Penjelasan Variabel Environment Tambahan:
- **`ENABLE_SWAGGER`**: Secara default bernilai `false` pada environment production (`NODE_ENV=production`). Saat bernilai `false`, rute Swagger UI (`/docs`) dan OpenAPI JSON (`/docs/json`) dinonaktifkan (mengembalikan HTTP 404) demi keamanan. Set ke `"true"` hanya jika dideploy pada staging environment atau lingkungan internal untuk review API.
- **`DOCS_PROVIDER`**: Pilihan renderer dokumentasi interaktif. Mendukung `"swagger-ui"` (default) atau `"scalar"`.
- **`COOKIE_DOMAIN`**: Biarkan kosong agar cookie hanya dikirim ke hostname API. Browser tetap dapat mengirim cookie dari frontend melalui `credentials: "include"`, dengan `APP_ORIGIN` sesuai domain frontend. Gunakan domain induk yang sama untuk frontend dan API.

Tempatkan MySQL sebagai database Coolify atau service pada private network yang sama. Jangan publikasikan port 3306 ke internet.

Dockerfile memakai bun.lock dari root monorepo. Build lokal dari root: `docker build -f apps/api/Dockerfile -t mknsite-api .`. Build container belum diverifikasi di server deployment.

## Cloudflare

- Buat Cloudflare Tunnel di server Coolify.
- Publikasikan hostname `api.example.com` ke service HTTP API pada port yang dipetakan Coolify.
- Pastikan DNS hostname mengarah ke tunnel dan proxy aktif.
- Gunakan mode SSL/TLS Full (strict) bila origin juga memakai TLS.
- Terapkan rate limit pada `/auth/*` dan `/api/auth/*`, WAF, dan bot protection sesuai kebutuhan.
- Jangan cache response `/auth/*`, `/api/auth/*`, `/realtime/*`, atau endpoint data privat.
- **Konfigurasi Khusus Server-Sent Events (SSE):**
  - Cloudflare harus meneruskan SSE pada `GET /realtime/events?context=employee|admin`.
  - Matikan proxy buffering, matikan auto-minify, dan nonaktifkan caching pada rute `/realtime/*` agar koneksi streaming dipertahankan secara stabil.
  - Heartbeat transport server berjalan setiap 25 detik untuk mencegah pemutusan koneksi oleh batas waktu idle proxy Cloudflare.

## Urutan Rilis & Checklist Pengujian Produksi

1. **Database:** Deploy MySQL dan simpan backup terjadwal.
2. **Backend API:** Deploy API di Coolify dengan environment production.
3. **Migrasi:** Jalankan migrasi Drizzle sebagai release command satu kali (`bun run db:migrate`).
4. **Edge / Tunnel:** Aktifkan Cloudflare Tunnel dan uji `https://api.example.com/health` (harus `200 { status: "ok" }`).
5. **Verifikasi Keamanan Swagger:** Pastikan `https://api.example.com/docs` dan `https://api.example.com/docs/json` mengembalikan `404 Not Found` (kecuali jika `ENABLE_SWAGGER=true` disengaja).
6. **Frontend Web:** Deploy frontend ke Vercel dengan `NEXT_PUBLIC_API_URL=https://api.example.com`.
7. **Verifikasi Fungsional & Integrasi:**
   - [ ] Uji login karyawan via `/login` dan akses workspace berbasis permission.
   - [ ] Uji login admin via `/admin/login` dan akses dashboard manajemen user.
   - [ ] Uji isolasi cookie: logout karyawan tidak mengganggu sesi admin (dan sebaliknya).
   - [ ] Uji CRUD user: `POST /admin/users`, `PATCH /admin/users/:id`, `PATCH /admin/users/:id/roles`, `PATCH /admin/users/:id/status`.
   - [ ] Uji pencabutan sesi: nonaktifkan akun atau panggil `POST /admin/users/:id/revoke-sessions`, pastikan sesi akun langsung tertolak.
   - [ ] Uji koneksi Realtime SSE pada `/realtime/events?context=admin` dan periksa penerimaan event saat terjadi mutasi pengguna.
