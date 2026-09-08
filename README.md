# MKN Site

Monorepo aplikasi internal MKN dengan halaman publik, portal karyawan berbasis RBAC, dan area administrator dengan login terpisah.

## Stack

- Frontend: Next.js App Router dan React
- Backend: Bun dan Elysia
- Database: MySQL 8.4
- ORM dan migrasi: Drizzle ORM dan Drizzle Kit
- Auth: Better Auth, Drizzle adapter, dan database session MySQL
- Pembaruan langsung: Server-Sent Events (SSE)
- Frontend hosting: Vercel
- Backend hosting: Coolify pada server lokal
- Edge dan ingress: Cloudflare DNS, WAF, dan Tunnel

## Struktur

```text
apps/
  web/    Next.js public site, login, portal, admin
  api/    Elysia API, autentikasi, RBAC, Drizzle
docker-compose.yml    MySQL lokal untuk development
```

## Menjalankan dengan Docker (untuk tim)

Jalankan Docker Desktop dalam mode Linux containers, lalu dari root repository:

```sh
docker compose up --build -d
```

Compose menjalankan MySQL, migrasi yang sudah tersimpan, seed akun development, API, lalu Next.js. Buka `http://localhost:3100`; API di `http://localhost:3001`. Port frontend 3100 dipakai agar tidak bentrok dengan Next.js yang dijalankan langsung pada port 3000.

Tidak perlu memasang Bun atau MySQL pada komputer host. Gunakan commit repository yang sama; dependency dikunci lewat bun.lock. Data tiap anggota tim disimpan dalam volume lokal masing-masing dan tidak tersinkron otomatis.

Lihat status dengan `docker compose ps -a` dan log dengan `docker compose logs --tail=100`. Hentikan menggunakan `docker compose down` (data tetap tersimpan). Setelah mengubah kode, jalankan kembali `docker compose up --build -d`. Compose ini khusus development dengan akun dan secret contoh, bukan konfigurasi produksi.

Verifikasi lingkungan tim:

```sh
bun scripts/verify-docker.mjs
```

Script ini menguji halaman web, health check API, login MySQL, izin HR, penolakan akses lintas modul, serta isolasi sesi admin dan karyawan.

## Menjalankan lokal tanpa container aplikasi

1. Salin `.env.example` menjadi `apps/api/.env`. Untuk frontend, isi `apps/web/.env.local` dengan NEXT_PUBLIC_API_URL dari contoh.
2. Jalankan MySQL dengan `docker compose up -d mysql`.
3. Pasang dependency dengan `bun install`.
4. Buat dan jalankan migrasi dengan `bun run db:generate` lalu `bun run db:migrate`.
5. Isi akun demo dengan `bun run db:seed`.
6. Jalankan API menggunakan `bun run dev:api`.
7. Di terminal lain, jalankan frontend menggunakan `bun run dev:web`.

Frontend tersedia di `http://localhost:3000` dan API di `http://localhost:3001`.

## Akun seed

Semua akun karyawan memakai password `demo12345`:

- `manager@mknsite.id`
- `hr@mknsite.id`
- `telco@mknsite.id`
- `workshop@mknsite.id`
- `project@mknsite.id`

Administrator memakai `admin@mknsite.id` dengan password `admin12345`.

Ganti seluruh password seed sebelum memakai data produksi.

## Model keamanan

- Better Auth menyimpan session opaque di tabel `auth_session`; cookie tidak memuat role maupun permission.
- Cookie `mkn_employee.session_token` hanya untuk portal karyawan, sedangkan `mkn_admin.session_token` hanya untuk area admin.
- Keduanya HTTP-only dan Secure di produksi. Tidak ada JWT aplikasi untuk sesi login.
- Permission dimuat ulang dari MySQL pada request, sehingga perubahan role berlaku tanpa menunggu token kedaluwarsa.
- Endpoint `/workspace/:module` memeriksa permission di server.
- Tabel `audit_logs` mencatat perubahan role/status lewat API admin.

## Auth dan RBAC

`users` adalah data akun MKN dan sumber RBAC. Better Auth memakai tabel tersendiri: `auth_user`, `auth_account`, `auth_session`, dan `auth_verification`. Kolom `auth_user.mkn_user_id` menghubungkan kedua lapisan tersebut.

Halaman login tetap dipisahkan untuk konteks kerja yang jelas:

- Karyawan: `/login` menggunakan session karyawan dan hanya menerima akun bertipe `employee`.
- Admin: `/admin/login` menggunakan session admin dan hanya menerima akun bertipe `admin`.

Satu browser dapat mempertahankan kedua sesi tersebut secara terpisah. Endpoint standar Better Auth dipasang di `/api/auth/employee/*` dan `/api/auth/admin/*`, sementara frontend menggunakan endpoint MKN `/auth/*` agar pembatasan tipe akun konsisten.

## Pembaruan langsung

Portal dan admin membuka koneksi SSE ke `GET /realtime/events`. Koneksi memakai cookie session yang sama, tidak menerima token dari JavaScript. Saat admin mengubah role melalui `PATCH /admin/users/:id/roles`, API menyimpan audit log lalu mengirim event `access.updated` kepada pengguna target. Browser memuat ulang aksesnya. Saat akun dinonaktifkan dengan `PATCH /admin/users/:id/status`, event `session.revoked` mengarahkan pengguna ke halaman login.

Implementasi ini memakai event hub dalam memori dan tepat untuk satu instance API. Jika API diskalakan ke beberapa instance Coolify, ganti event hub dengan Redis Pub/Sub atau broker setara agar event diteruskan ke semua instance.

Lihat [deployment.md](docs/deployment.md) untuk topologi Vercel, Coolify, MySQL, dan Cloudflare.

## Kolaborasi tim

Paket prompt untuk Frontend Agent, Backend Agent, QA Agent, dan Agent-log tersedia di [docs/agents](docs/agents/README.md). Catat perubahan yang telah selesai pada [CHANGELOG.md](docs/CHANGELOG.md).
