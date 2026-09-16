# Panduan Operasi Database

## Identitas Dokumen

Panduan ini menjelaskan cara memeriksa, membandingkan, dan memperbaiki state database baik di lokal maupun production. **Wajib dibaca** oleh semua agen sebelum melakukan revert, rollback, atau pembersihan data.

## Perbedaan Docker Lokal vs Production

```
┌─────────────────────────────┬──────────────────────────────────┐
│       LOKAL (docker-compose)│       PRODUCTION (Coolify)       │
├─────────────────────────────┼──────────────────────────────────┤
│ Dockerfile.dev              │ apps/api/Dockerfile              │
│ 3 container terpisah:       │ 1 container API + MySQL terpisah │
│   init → api → web          │ (MySQL dikelola Coolify)         │
│                             │                                  │
│ init container:             │ CMD startup (1 langkah):         │
│   1. db:migrate             │   1. bunx drizzle-kit migrate    │
│   2. db:seed                │   2. bun src/db/seed.ts          │
│ api container:              │   3. bun src/index.ts            │
│   3. bun src/index.ts       │                                  │
│                             │                                  │
│ NODE_ENV=development        │ NODE_ENV=production              │
│ MySQL: mknsite-mysql-1      │ MySQL: Coolify private network   │
│ Port: localhost:3306        │ Port: internal only (no public)  │
│ User: mknsite               │ User: mknsite                    │
│ Pass: mknsite-local-only    │ Pass: (di dashboard Coolify)     │
│ Database: mknsite            │ Database: mknsite                │
│                             │                                  │
│ Web: Next.js dev server     │ Web: Vercel (terpisah)           │
│ Port: localhost:3100        │ URL: www.mknsite.online          │
│ Hot reload: Ya              │ Hot reload: Tidak                │
│ Volume: source code mounted │ Volume: uploads only             │
└─────────────────────────────┴──────────────────────────────────┘
```

> [!IMPORTANT]
> **Docker lokal dan production TIDAK identik.** Lokal menggunakan `Dockerfile.dev` dengan 3 container (init → api → web), sedangkan production menggunakan `apps/api/Dockerfile` dengan 1 container API. Frontend production di-deploy terpisah via Vercel.

## Riwayat Migrasi: `__drizzle_migrations`

Drizzle menyimpan riwayat migrasi di tabel internal database bernama `__drizzle_migrations`.

### Mengapa Tabel Fisik Hanya Memiliki 3 Kolom?

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | bigint unsigned | Primary key auto increment (urutan eksekusi) |
| `hash` | text | SHA-256 hash dari berkas SQL migrasi |
| `created_at` | bigint | Timestamp (epoch ms) saat migrasi dieksekusi |

> [!NOTE]
> Tabel fisik `__drizzle_migrations` di MySQL memang **hanya memiliki 3 kolom internal** di atas karena dikelola secara kaku oleh engine `drizzle-kit`. DILARANG menambahkan kolom manual ke tabel ini karena akan menyebabkan `drizzle-kit migrate` gagal.

### Bagaimana Mengetahui Fitur dan Perubahan Skemanya?

Untuk mengetahui **fitur apa yang bertambah**, **tabel apa yang dibuat**, dan **kolom apa yang dimodifikasi**, Drizzle menyimpan metadata pendukung di berkas repository:
1. `apps/api/drizzle/meta/_journal.json`: Memetakan timestamp `created_at` ke nama tag migrasi (contoh: `0003_powerful_puppet_master`).
2. `apps/api/drizzle/xxxx_nama.sql`: Berisi instruksi DDL lengkap (`CREATE TABLE`, `ALTER TABLE ADD COLUMN`, dll).

### Perintah Pemeriksaan Lengkap: `bun run db:status`

Untuk mempermudah pengembang dan agen membaca riwayat migrasi secara manusiawi (bukan sekadar hash), gunakan perintah:

```bash
bun --cwd apps/api db:status
```

Perintah ini otomatis memadukan data tabel `__drizzle_migrations` dengan `_journal.json` dan menghasilkan tabel informatif:

```text
| Idx | Tag / Berkas Migrasi           | Status       | Waktu Dijalankan    | Fitur / Perubahan Skema
| 0   | 0000_confused_power_man        | TERPASANG    | 7/9/2026, 12.09.15  | Skema dasar RBAC (users, roles, permissions...)
| 1   | 0001_funny_marvex              | TERPASANG    | 7/9/2026, 18.45.40  | Tabel Better Auth (auth_user, auth_session...)
| 2   | 0002_strong_korath             | TERPASANG    | 10/9/2026, 14.39.43 | Tabel Navigasi & Menu Dinamis (menus)
| 3   | 0003_powerful_puppet_master    | TERPASANG    | 15/9/2026, 09.37.14 | Master Divisi & kolom profil user (division, avatar, last_login)
```

### Cara Cek Manual via SQL Query

**Lokal:**
```bash
docker exec mknsite-mysql-1 mysql -u mknsite -p"mknsite-local-only" mknsite \
  -e "SELECT * FROM __drizzle_migrations ORDER BY created_at;"
```

**Production (via SSH ke VPS atau Coolify terminal):**
```bash
mysql -u mknsite -p"<PASSWORD>" mknsite \
  -e "SELECT * FROM __drizzle_migrations ORDER BY created_at;"
```

### Membandingkan Lokal vs Production

1. Jalankan `bun --cwd apps/api db:status` di masing-masing lingkungan.
2. Bandingkan status seluruh migrasi (pastikan semua berstatus `TERPASANG`).
3. Jika ada migrasi yang berstatus `PENDING` di production $\rightarrow$ Ada perubahan skema di kode yang belum diterapkan di database.
4. Jika muncul peringatan `ORPHAN` $\rightarrow$ Ada record di database yang berkasnya sudah tidak ada di Git (biasanya terjadi pasca `git revert`).

> [!WARNING]
> **Drizzle TIDAK memiliki fitur rollback otomatis.** Jika perlu rollback migrasi, harus manual: tulis SQL `DROP TABLE` / `ALTER TABLE DROP COLUMN` sendiri, lalu hapus row dari `__drizzle_migrations`.

## Standar Otomasi Rilis Menu dan Modul Portal (Automated Seed & Single-PR Pattern)

Sistem MKN Site menggunakan navigasi modul portal berbasis tabel `menus` di database.
Agar modul baru yang dikembangkan di frontend langsung aktif dan muncul di portal tanpa mengandalkan input manual admin di production, tim MKN Site menetapkan **Pola Otomasi Seed Terintegrasi** sebagai standar baku proyek:

### Prinsip Kerja Otomasi Menu:
1. **Satu Kesatuan PR (Single PR Pattern)**: Setiap developer/agen yang membuat halaman modul baru (misal: `apps/web/app/portal/ops-telco/page.tsx`) **wajib** mendaftarkan permission, role, dan menu di `apps/api/src/db/seed.ts` pada PR yang sama.
2. **Zero Human Error**: Menghindari salah ketik URL tujuan (misal salah ketik `/telco` yang berujung error 404) atau kelupaan mengisi izin akses (`requiredPermission`) di panel admin.
3. **Eksekusi Otomatis pada Deployment**: Saat PR di-merge ke `main`, container backend Coolify di production mengeksekusi urutan startup:
   ```dockerfile
   CMD ["sh", "-c", "bunx drizzle-kit migrate && bun src/db/seed.ts && bun src/index.ts"]
   ```
   Eksekusi `seed.ts` secara otomatis menyisipkan dan menyinkronkan data menu ke database production secara idempoten.
4. **Larangan Input Manual di Production**: QA dilarang meloloskan PR rute portal baru jika kartu menunya tidak didaftarkan di `seed.ts`. Penambahan modul baru tidak boleh bergantung pada tindakan manual pasca-deploy.

## Aturan Penting: Git Revert ≠ Database Revert

> [!CAUTION]
> **`git revert` hanya mengembalikan file/kode, BUKAN data di database.** Ini adalah kesalahan yang sering terjadi.

### Apa yang TIDAK di-revert oleh `git revert`:

| Data | Contoh | Solusi |
|------|--------|--------|
| Row di tabel `menus` | Menu HR, OPS Telco yang dibuat via Admin Panel | Hapus manual via Admin Panel atau SQL DELETE |
| Row di tabel `roles` / `permissions` | Role `ops-telco-supervisor` yang ditambah seed | Hapus manual via SQL DELETE |
| Row di `role_permissions` | Permission grant baru | Hapus manual via SQL DELETE |
| Row di `users` / `auth_user` | User baru yang dibuat seed | Hapus manual via SQL DELETE |
| Tabel baru dari migrasi | Tabel dari `0004_hr_portal.sql` | DROP TABLE manual + hapus row dari `__drizzle_migrations` |
| Perubahan kolom | ALTER TABLE dari migrasi | ALTER TABLE UNDO manual |

### Prosedur Wajib Setelah Git Revert yang Melibatkan Database

1. **Revert kode:** `git revert -m 1 <merge-commit>`
2. **Identifikasi perubahan DB:** Cek migration SQL yang di-revert, cek seed yang di-revert
3. **Bersihkan data runtime:** Hapus row menu, role, permission, user yang ditambahkan oleh kode yang di-revert
4. **Bersihkan tabel migrasi (jika ada tabel baru):**
   ```sql
   -- Hapus tabel yang dibuat oleh migrasi yang di-revert
   DROP TABLE IF EXISTS nama_tabel_baru;
   
   -- Hapus record migrasi dari journal database
   DELETE FROM __drizzle_migrations WHERE id = <id_migrasi_yang_di_revert>;
   ```
5. **Verifikasi:** Bandingkan `__drizzle_migrations` dengan `_journal.json`

### Prosedur Pembersihan Menu di Lokal

```bash
# Cek menu yang ada
docker exec mknsite-mysql-1 mysql -u mknsite -p"mknsite-local-only" mknsite \
  -e "SELECT id, title, url, required_permission FROM menus ORDER BY sort_order;"

# Hapus menu sampah (ganti ID sesuai kebutuhan)
docker exec mknsite-mysql-1 mysql -u mknsite -p"mknsite-local-only" mknsite \
  -e "DELETE FROM menus WHERE id IN (id1, id2, ...);"
```

### Prosedur Pembersihan Menu di Production

```powershell
# Login dan hapus via API
$body = '{"email":"superadmin@mknsite.online","password":"superadmin12345"}'
$r = Invoke-WebRequest -Uri "https://api.mknsite.online/auth/admin/login" `
  -Method POST -ContentType "application/json" -Body $body `
  -UseBasicParsing -SessionVariable sess

# List menus
$menus = Invoke-WebRequest -Uri "https://api.mknsite.online/admin/menus" `
  -UseBasicParsing -WebSession $sess
Write-Host $menus.Content

# Delete menu by ID
Invoke-WebRequest -Uri "https://api.mknsite.online/admin/menus/<ID>" `
  -Method DELETE -UseBasicParsing -WebSession $sess
```

Atau hapus langsung via Admin Panel di `https://www.mknsite.online/admin/menus`.

## Checklist Verifikasi Database Setelah Deploy/Revert

- [ ] Cek `__drizzle_migrations` — jumlah entry sesuai dengan `_journal.json`
- [ ] Cek tabel `menus` — tidak ada menu orphan (mengarah ke halaman yang tidak ada)
- [ ] Cek tabel `roles` — tidak ada role orphan
- [ ] Cek tabel `permissions` — tidak ada permission orphan
- [ ] Cek tabel `users` — semua user punya `auth_user` dan `auth_account` yang valid
- [ ] Test login superadmin → HTTP 200
- [ ] Test login admin → HTTP 200
- [ ] Test login employee → HTTP 200
