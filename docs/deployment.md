# Deployment MKN Site

## Topologi Produksi

```text
Browser
  |-- https://www.mknsite.online  -> Vercel (Next.js frontend)
  |-- https://mknsite.online      -> Vercel (redirect ke www)
  |-- https://api.mknsite.online  -> Coolify VPS -> Elysia :3001
  |-- https://panel.mknsite.online -> Coolify Dashboard
  |-- https://mail.mknsite.online  -> Mailu Mail Server
  |-- https://proxmox.mknsite.online:8006 -> Proxmox VE
                                         |
            Coolify internal network ->  MySQL private (hasihg61agfgvuxib0rp1yzd:3306)
```

Gunakan subdomain dari domain induk yang sama agar cookie, CORS, dan kebijakan browser lebih mudah dikelola.

## Cloudflare DNS Records

| Type | Name | Content | Proxy |
|---|---|---|---|
| A | `@` (mknsite.online) | Vercel (dikelola Vercel) | — |
| CNAME | `www` | cname.vercel-dns.com | — |
| A | `api` | 203.153.127.35 | DNS only |
| A | `panel` | 203.153.127.35 | DNS only |
| A | `mail` | 203.153.127.36 | DNS only |
| A | `proxmox` | 203.153.127.34 | DNS only |

## Vercel (Frontend)

- Root Directory: `apps/web`
- Framework Preset: Next.js
- Environment variable: `NEXT_PUBLIC_API_URL=https://api.mknsite.online`
- Domain: `www.mknsite.online` (primary) dan `mknsite.online` (redirect ke www).
- CI/CD: otomatis deploy pada setiap push ke `main`.

## Coolify (Backend API)

- Aplikasi dibuat dari repository GitHub `MKN-SITE/mknsite`.
- Base Directory / build context: root repository (`/`)
- Dockerfile location: `/apps/api/Dockerfile`
- Build Pack: Dockerfile
- Port exposed: `3001`
- Health check: `/health`
- Domain: `https://api.mknsite.online`
- CI/CD: otomatis deploy via GitHub Webhook pada setiap push ke `main`.

### Environment Variables (Diatur di Dashboard Coolify)

```text
NODE_ENV=production
PORT=3001
APP_ORIGIN=https://mknsite.online,https://www.mknsite.online
DATABASE_URL=mysql://mknsite:<PASSWORD>@<DB_CONTAINER_HOST>:3306/mknsite
BETTER_AUTH_URL=https://api.mknsite.online
BETTER_AUTH_SECRET=<SECRET_ACAK_MINIMAL_32_KARAKTER>
COOKIE_DOMAIN=.mknsite.online
ENABLE_SWAGGER=false
DOCS_PROVIDER=swagger-ui
```

### Penjelasan Variabel Environment:
- **`APP_ORIGIN`**: Daftar origin frontend yang diizinkan CORS (dipisah koma). Pada production, hanya origin yang dikonfigurasi di sini dan domain `mknsite.online` yang dipercaya. Origin `localhost` **tidak** diizinkan pada production.
- **`COOKIE_DOMAIN`**: Set ke `.mknsite.online` agar cookie berlaku di seluruh subdomain. Biarkan kosong untuk development lokal.
- **`BETTER_AUTH_SECRET`**: Wajib pada produksi. Gunakan secret acak tersimpan di secret manager/Coolify, bukan password akun atau nilai contoh. Better Auth menolak secret bawaan pada produksi. Jangan mencatat nilai secret di Git atau laporan review.
- **`ENABLE_SWAGGER`**: Secara default bernilai `false` pada production. Set ke `"true"` hanya jika dideploy pada staging.
- **`DOCS_PROVIDER`**: Renderer dokumentasi interaktif: `"swagger-ui"` (default) atau `"scalar"`.

### Migrasi Database Otomatis

Dockerfile menjalankan `bunx drizzle-kit migrate` sebelum memulai API server pada setiap container startup. Migrasi yang sudah tercatat tidak dijalankan ulang. Migrasi baru dapat mengubah struktur/relasi, sehingga backup dan pengujian upgrade pada salinan database wajib dilakukan sebelum rilis.

```dockerfile
CMD ["sh", "-c", "bunx drizzle-kit migrate && bun src/index.ts"]
```

Tempatkan MySQL sebagai database Coolify pada private network yang sama. Jangan publikasikan port 3306 ke internet.

### Rilis HR/Telco setelah integrasi main

1. Backup database serta direktori unggahan dan uji pemulihannya. Hentikan sementara penulisan aplikasi saat migrasi DDL MySQL dijalankan; DDL tidak seluruhnya transactional.
2. Periksa konfigurasi `DATABASE_URL`, `BETTER_AUTH_SECRET`, `APP_ORIGIN`, `BETTER_AUTH_URL`, `COOKIE_DOMAIN`, dan `NEXT_PUBLIC_API_URL` pada target deployment.
3. Gunakan build context root repository agar `form-templates` ikut masuk image API. Build memverifikasi keberadaan tiga PDF master. Pastikan storage persisten untuk `/app/apps/api/uploads` di Coolify.
4. Terapkan migrasi tersimpan, termasuk `0003_new_wraith` dan `0004_integrate_main_hr`. Jangan mengedit migrasi lama atau memakai `db:push` pada produksi. `0004` menambah schema dari main, mengganti FK HR menjadi RESTRICT, dan memasang katalog izin Telco tanpa menghapus akun/menu. Nama/grant role yang sudah dikustomisasi dipertahankan; role teknisi lama yang memiliki akses induk menerima empat izin teknisi baru satu kali.
5. Melalui Administrasi, pastikan menu `/portal/hr` memakai `hr.view` dan `/portal/ops-telco` memakai `ops_telco.view`. Tinjau role supervisor/teknisi dan pemberian `hr.view` sesuai kebijakan perusahaan. Role teknisi tidak otomatis mendapat akses HR.
6. Setelah restart, uji login, isolasi role, simpan formulir, dan unduh ketiga PDF di staging. Cetak Letter 100% / Actual size untuk persetujuan tata letak oleh pemilik formulir.

Seed development tidak dijalankan di produksi. Jika harus rollback setelah migrasi, pulihkan kode dan backup database yang cocok secara terkoordinasi; mengganti commit saja tidak membatalkan perubahan schema. Push branch fitur dan pembuatan PR terpisah dari persetujuan merge ke main/deployment.

## CI/CD Pipeline (GitHub Webhook)

### Vercel (Frontend)
Otomatis aktif — Vercel mendeteksi push ke `main` dan men-deploy frontend secara mandiri.

### Coolify (Backend)
Webhook GitHub dikonfigurasi di repository `MKN-SITE/mknsite`:
- **Payload URL**: `https://panel.mknsite.online/webhooks/source/github/events/manual`
- **Content type**: `application/json`
- **SSL verification**: Enabled
- **Events**: Just the push event
- **Status**: Active (✔ Last delivery was successful)

### Alur CI/CD Saat Push

```text
git push origin main
       │
       ├─> Vercel: auto-detect, rebuild, deploy frontend
       │
       └─> GitHub Webhook → Coolify:
           1. Pull kode terbaru
           2. Build Docker image
           3. Container start → auto-migrate database
           4. API server online
```

## Alur Migrasi Database

| Langkah | Manual / Otomatis | Keterangan |
|---|---|---|
| Edit `schema.ts` | Manual | Developer mengedit skema di laptop |
| `bun run db:generate` | Manual | Drizzle membuat file .sql migrasi |
| `bun run db:migrate` (lokal) | Manual | Test migrasi di database lokal |
| Push branch fitur dan PR ke main | Manual | Review kode/migrasi serta persetujuan merge sebelum auto-deploy |
| `drizzle-kit migrate` (production) | **Otomatis** | Container CMD menjalankan sebelum API start |

## Environment Variables: Lokal vs Production

| Variabel | Lokal (File `.env`) | Production (Dashboard) |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | `https://api.mknsite.online` (Vercel) |
| `APP_ORIGIN` | `http://localhost:3000` | `https://mknsite.online,https://www.mknsite.online` (Coolify) |
| `BETTER_AUTH_URL` | `http://localhost:3001` | `https://api.mknsite.online` (Coolify) |
| `BETTER_AUTH_SECRET` | opsional pada development | wajib, secret acak dari secret manager (Coolify) |
| `DATABASE_URL` | `mysql://...localhost:3306/mknsite` | `mysql://...<DB_HOST>:3306/mknsite` (Coolify) |
| `COOKIE_DOMAIN` | *(kosong)* | `.mknsite.online` (Coolify) |
| `NODE_ENV` | `development` | `production` (Coolify) |
| `ENABLE_SWAGGER` | `true` (default) | `false` (Coolify) |

File `.env` hanya untuk development lokal dan **tidak di-commit ke Git**. Variabel production disimpan di dashboard Vercel dan Coolify.

## Keamanan Production

- Origin `localhost` **tidak dipercaya** di production (`NODE_ENV=production`).
- Swagger UI dinonaktifkan di production (HTTP 404 pada `/docs` dan `/docs/json`).
- Cookie menggunakan `Secure`, `HttpOnly`, `SameSite=lax`.
- Seed development ditolak pada production; provisioning administrator dilakukan terpisah tanpa password contoh.
- Port database MySQL tidak dipublikasikan ke internet.

## Urutan Rilis & Checklist Pengujian Produksi

1. **Database:** Deploy MySQL dan simpan backup terjadwal.
2. **Backend API:** Deploy API di Coolify dengan environment production.
3. **Migrasi:** Otomatis saat container start via Dockerfile CMD.
4. **DNS:** Pastikan record Cloudflare mengarah ke IP server yang benar.
5. **Verifikasi Keamanan Swagger:** Pastikan `https://api.mknsite.online/docs` mengembalikan `404 Not Found`.
6. **Frontend Web:** Deploy frontend ke Vercel dengan `NEXT_PUBLIC_API_URL=https://api.mknsite.online`.
7. **Verifikasi Fungsional & Integrasi:**
   - [ ] `https://api.mknsite.online/health` → `200 { status: "ok" }`
   - [ ] `https://www.mknsite.online` → `200 OK`
   - [ ] Uji login karyawan via `/login` dan akses workspace berbasis permission.
   - [ ] Uji login admin via `/admin/login` dan akses dashboard manajemen user.
   - [ ] Uji isolasi cookie: logout karyawan tidak mengganggu sesi admin (dan sebaliknya).
   - [ ] Uji CRUD user: `POST /admin/users`, `PATCH /admin/users/:id`, `PATCH /admin/users/:id/roles`, `PATCH /admin/users/:id/status`.
   - [ ] Uji pencabutan sesi: nonaktifkan akun atau panggil `POST /admin/users/:id/revoke-sessions`.
   - [ ] Uji koneksi Realtime SSE pada `/realtime/events?context=admin`.
