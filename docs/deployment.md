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
```

Tempatkan MySQL sebagai database Coolify atau service pada private network yang sama. Jangan publikasikan port 3306 ke internet.

Biarkan COOKIE_DOMAIN kosong agar cookie hanya dikirim ke hostname API. Browser tetap dapat mengirim cookie dari frontend melalui credentials: include, dengan APP_ORIGIN sesuai domain frontend. Gunakan domain induk yang sama untuk frontend dan API.

Dockerfile memakai bun.lock dari root monorepo. Build lokal dari root: `docker build -f apps/api/Dockerfile -t mknsite-api .`. Build container belum diverifikasi di server deployment.

## Cloudflare

- Buat Cloudflare Tunnel di server Coolify.
- Publikasikan hostname `api.example.com` ke service HTTP API pada port yang dipetakan Coolify.
- Pastikan DNS hostname mengarah ke tunnel dan proxy aktif.
- Gunakan mode SSL/TLS Full (strict) bila origin juga memakai TLS.
- Terapkan rate limit pada `/auth/*` dan `/api/auth/*`, WAF, dan bot protection sesuai kebutuhan.
- Jangan cache response `/auth/*`, `/api/auth/*`, `/realtime/*`, atau endpoint data privat.
- Cloudflare harus meneruskan SSE pada `/realtime/events`; matikan caching endpoint tersebut dan pertahankan koneksi streaming.

## Urutan rilis

1. Deploy MySQL dan simpan backup terjadwal.
2. Deploy API di Coolify dengan environment production.
3. Jalankan migrasi Drizzle sebagai release command satu kali.
4. Aktifkan Cloudflare Tunnel dan uji `https://api.example.com/health`.
5. Deploy frontend ke Vercel dengan URL API production.
6. Uji login karyawan, penolakan modul tanpa permission, login admin, logout, CORS, dan koneksi SSE `/realtime/events`.
