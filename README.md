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

Script ini menguji halaman web, health check API, login MySQL, izin HR, penolakan akses lintas modul, serta isolasi sesi admin dan karyawan. Buat akun karyawan uji dengan role HR melalui Administrasi, lalu isi `VERIFY_EMPLOYEE_EMAIL` dan `VERIFY_EMPLOYEE_PASSWORD`. Kredensial admin dapat diatur lewat `VERIFY_ADMIN_EMAIL` / `VERIFY_ADMIN_PASSWORD`.

## Menjalankan lokal tanpa container aplikasi

1. Salin `.env.example` menjadi `apps/api/.env`. Untuk frontend, isi `apps/web/.env.local` dengan NEXT_PUBLIC_API_URL dari contoh.
2. Jalankan MySQL dengan `docker compose up -d mysql`.
3. Pasang dependency dengan `bun install`.
4. Jalankan migrasi tersimpan dengan `bun run db:migrate`. `db:generate` hanya diperlukan saat pengembang mengubah schema.
5. Buat akun administrator development dengan `bun run db:seed`.
6. Jalankan API menggunakan `bun run dev:api`.
7. Di terminal lain, jalankan frontend menggunakan `bun run dev:web`.

Frontend tersedia di `http://localhost:3000` dan API di `http://localhost:3001`.

## Akun seed
 
Seed development hanya membuat administrator. Buat karyawan dan tetapkan role lewat Administrasi. Akun contoh karyawan `hr`, `telco`, `workshop`, `project`, `manager`, dan `supervisor` hanya dibuat oleh fixture pada database test terpisah.

Akun administrator dan superadministrator:
- Administrator memakai `admin@mknsite.online` dengan password `admin12345`.
- Super Administrator memakai `superadmin@mknsite.online` dengan password `superadmin12345`.

Seed tidak menghapus akun/menu, tidak menimpa password, dan tidak memasang ulang grant pada role yang sudah dikonfigurasi. Akun lama tetap dipertahankan. `db:seed` ditolak jika `NODE_ENV=production`; provisioning administrator produksi harus mengikuti prosedur tim tanpa password contoh.

## Model keamanan

- Better Auth menyimpan session opaque di tabel `auth_session`; cookie tidak memuat role maupun permission.
- Cookie `mkn_employee.session_token` hanya untuk portal karyawan, sedangkan `mkn_admin.session_token` hanya untuk area admin.
- Keduanya HTTP-only dan Secure di produksi. Tidak ada JWT aplikasi untuk sesi login.
- Permission dimuat ulang dari MySQL pada request, sehingga perubahan role berlaku tanpa menunggu token kedaluwarsa.
- Endpoint `/workspace/:module` memeriksa permission di server.

### Konfigurasi menu portal

Menu utama portal dikelola melalui **Administrasi → Menu** dan tidak dibuat ulang oleh seed. Untuk modul pada branch HR/Telco, buat atau aktifkan entri berikut:

| Judul | URL | Permission wajib |
| --- | --- | --- |
| HR | `/portal/hr` | `hr.view` |
| OPS Telco | `/portal/ops-telco` | `ops_telco.view` |

Submenu OPS Telco ditampilkan dari permission role pengguna. Role teknisi hanya menerima submenu teknisi, sedangkan role supervisor menerima submenu supervisor sekaligus submenu teknisi. Perubahan menu atau role tetap diperiksa kembali oleh API; menyembunyikan menu di antarmuka bukan pengganti otorisasi server.
- Tabel `audit_logs` mencatat perubahan role/status lewat API admin.

### Formulir HR dan submenu Telco

Form Oncall, Overtime, dan Cuti menyimpan draf serta menghasilkan PDF dari master asli di `form-templates/hr`. Nomor `OC/OT/CT-tahun-ID` dibuat server secara atomik; nomor dapat memiliki celah setelah transaksi dibatalkan. Riwayat menampilkan 100 formulir terbaru.

Karyawan dengan `hr.view` mengakses formulir sendiri. Role dengan `hr.manage` mengelola semua formulir HR. Alurnya: **Draf → Diajukan → Disetujui / Ditolak / Ditangguhkan**. Pengajuan dikunci bagi karyawan. HR dapat membukanya kembali sebagai draf, yang menghapus keputusan dan perhitungan HR sebelumnya. Semua mutasi mencatat aktor dalam `audit_logs`. Akun pemilik riwayat HR hanya dapat dinonaktifkan; penghapusan ditolak untuk menjaga arsip.

Duplikasi membuat draf bernomor baru dan menyalin rincian pekerjaan; identitas karyawan, nama tanda tangan, dan keputusan HR harus diisi ulang. Pemilik salinan adalah akun pembuat salinan, bukan otomatis akun teknisi yang namanya diketik. Penugasan lintas akun merupakan tahap berikutnya.

PDF mempertahankan halaman master, logo, kotak, dan teks baku. Isian memakai Helvetica 8–10 pt (angka tabel cuti 7,5 pt); bukan tanda tangan elektronik. Isian terlalu panjang dan karakter yang tidak didukung font (misalnya emoji) ditolak sebelum disimpan agar tidak terpotong saat dicetak. Gunakan ukuran kertas **Letter, 100% / Actual size**. File Excel masih menjadi referensi; perhitungan payroll dan saldo cuti otomatis belum diterapkan.

Tujuh submenu Telco saat ini merupakan halaman awal dengan pemeriksaan izin. Alur penugasan, PTO, jadwal, kirim WAG, quotation, dan dokumentasi pekerjaan belum diimplementasikan. Akses setiap submenu mensyaratkan `ops_telco.view` **dan** permission submenu. Menu utama tetap dibuat/diaktifkan melalui Administrasi.

## Auth dan RBAC

`users` adalah data akun MKN dan sumber RBAC. Better Auth memakai tabel tersendiri: `auth_user`, `auth_account`, `auth_session`, dan `auth_verification`. Kolom `auth_user.mkn_user_id` menghubungkan kedua lapisan tersebut.

Halaman login tetap dipisahkan untuk konteks kerja yang jelas:

- Karyawan: `/login` menggunakan session karyawan dan hanya menerima akun bertipe `employee`.
- Admin: `/admin/login` menggunakan session admin dan hanya menerima akun bertipe `admin`.

Satu browser dapat mempertahankan kedua sesi tersebut secara terpisah. Endpoint standar Better Auth dipasang di `/api/auth/employee/*` dan `/api/auth/admin/*`, sementara frontend menggunakan endpoint MKN `/auth/*` agar pembatasan tipe akun konsisten.

## Dokumentasi API Interaktif (OpenAPI & Swagger UI)

Backend menyediakan spesifikasi OpenAPI 3.0 dan antarmuka Swagger UI interaktif:
- **Swagger UI:** `http://localhost:3001/docs` (aktif secara default pada development/staging).
- **Spesifikasi OpenAPI JSON:** `http://localhost:3001/docs/json`.
- **Autentikasi di Swagger:** Menggunakan *cookie-based authentication* (`mkn_employee.session_token` dan `mkn_admin.session_token`). Anda cukup login terlebih dahulu melalui form login web atau via endpoint `/auth/login` / `/auth/admin/login`, dan browser akan otomatis menyertakan session cookie pada request Swagger UI.
- **Keamanan Produksi:** Pada environment production (`NODE_ENV=production`), rute `/docs` dan `/docs/json` **dinonaktifkan secara default** (mengembalikan HTTP 404). Untuk mengaktifkannya pada environment staging atau review internal, atur variabel environment `ENABLE_SWAGGER=true`.

## Endpoint Administrasi Pengguna & RBAC

Seluruh endpoint administrasi dilindungi oleh middleware otorisasi yang memverifikasi sesi admin dan permission `admin.manage`:

| Method | Endpoint | Deskripsi & Perilaku |
|---|---|---|
| `GET` | `/admin/users` | Mengambil daftar pengguna dengan pagination stabil (`page`, `pageSize`), pencarian nama/email (`q`), serta filter status (`isActive`) dan tipe akun (`accountType`). Batch loading roles menghindari N+1 query. |
| `POST` | `/admin/users` | Membuat akun karyawan baru secara atomik (sinkronisasi multi-tabel `users`, `auth_user`, `auth_account`, `user_roles`, `audit_logs`). Menolak pemberian role administrator pada karyawan (HTTP 403) dan menolak email duplikat (HTTP 409). |
| `GET` | `/admin/users/:id` | Mengambil detail profil satu pengguna beserta seluruh role yang dimiliki. |
| `PATCH` | `/admin/users/:id` | Memperbarui nama dan/atau email pengguna. Sinkronisasi atomik ke tabel Better Auth. Pembaruan email otomatis mencabut seluruh sesi aktif pengguna di `auth_session`. |
| `PATCH` | `/admin/users/:id/roles` | Memperbarui daftar role pengguna. Otomatis mencabut sesi aktif target di `auth_session` agar pengguna segera memuat izin terbaru saat login ulang. |
| `PATCH` | `/admin/users/:id/status` | Mengaktifkan atau menonaktifkan akun. Penonaktifan akun langsung mencabut seluruh sesi di `auth_session`. Dilengkapi proteksi pencegahan penonaktifan akun sendiri (*self-deactivation*) dan perlindungan admin terakhir (*last-admin protection*). |
| `POST` | `/admin/users/:id/revoke-sessions` | Mencabut seluruh sesi aktif pengguna seketika tanpa mengubah status keaktifan akun. |
| `GET` | `/admin/roles` | Mengambil daftar seluruh role dan matriks permissions yang tersedia dalam sistem. |

## Pembaruan Langsung (Realtime SSE)

Portal karyawan dan area admin membuka koneksi Server-Sent Events (SSE) ke:
```http
GET /realtime/events?context=employee
GET /realtime/events?context=admin
```

- **Isolasi Konteks:** Parameter `?context=admin` hanya menerima sesi administrator tanpa fallback ke sesi karyawan (HTTP 401 jika menggunakan sesi karyawan, dan sebaliknya).
- **Event `admin.users.updated`:** Event `{ type: "admin.users.updated", userId: number, occurredAt: string }` dikirimkan secara instan ke seluruh admin yang sedang terhubung setiap kali terjadi mutasi data pengguna. Event ini tidak pernah bocor ke koneksi karyawan biasa.
- **Event `access.updated`:** Dikirimkan ke karyawan target ketika rolenya diperbarui oleh admin.
- **Event `session.revoked` & Revalidasi Berkala:** Server memvalidasi keaktifan sesi di database setiap interval heartbeat 25 detik. Jika akun dinonaktifkan atau sesi dicabut, server langsung mengirimkan event `session.revoked`, memutus koneksi secara graceful (`done: true`), dan membersihkan listener memori (*zero memory leaks*).
- **Client Helper Frontend:** Modul `apps/web/lib/sse.ts` menyediakan helper `connectRealtime(context, handlers)` dengan *auto-reconnect* ber-exponential backoff.

## Pengujian & Verifikasi Kualitas (QA)

Backend MKN Site dilengkapi dengan pengujian otomatis komprehensif mencakup 14 skenario matriks penerimaan QA (Docs lokal & production, isolasi logout ganda, validasi input & malformed JSON, atomisitas rollback transaksi, dan audit sanitasi kredensial):

```sh
# Hanya database test disposable yang sudah dimigrasikan:
# DATABASE_URL harus berakhir /nama_test dan ALLOW_TEST_DATABASE=1.
# Fixture otomatis dibuat oleh test preload; jangan memakai database aplikasi.
bun --cwd apps/api test

# Menjalankan pemeriksaan statis TypeScript di seluruh workspace
bun run check

# Tes komponen frontend
bun test scripts/tests

# Uji migrasi fresh / legacy / db:push pada server MySQL test disposable
# Memerlukan kredensial test yang boleh membuat database sementara.
bun --cwd apps/api scripts/verify-hr-migrations.ts

# Contoh PDF berisi data fiktif untuk review cetak (output tmp/pdfs)
bun --cwd apps/api scripts/preview-hr-pdfs.ts
```

Lihat [deployment.md](docs/deployment.md) untuk topologi produksi, Cloudflare DNS, Vercel, Coolify, CI/CD pipeline, dan alur migrasi database.

## Kolaborasi Tim

Rencana bertahap dokumentasi interaktif dan administrasi pengguna telah selesai diimplementasikan berdasarkan [OpenAPI dan User Management](docs/plans/openapi-user-management.md).

Laporan lengkap hasil pengujian matriks QA tersedia di [qa-report.md](docs/api/qa-report.md). Catat perubahan yang telah selesai pada [CHANGELOG.md](docs/CHANGELOG.md).
