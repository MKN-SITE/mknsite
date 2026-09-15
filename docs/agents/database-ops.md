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

## Migration History: `__drizzle_migrations`

Drizzle menyimpan riwayat migrasi di tabel internal `__drizzle_migrations`.

### Struktur Tabel `__drizzle_migrations`

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | bigint unsigned | Primary key, auto increment urutan eksekusi |
| `hash` | text | SHA-256 hash dari berkas SQL migrasi |
| `created_at` | bigint | Timestamp (epoch ms) saat migrasi dieksekusi |

### Cara Praktis Cek Status & Detail Fitur Migrasi

Untuk melihat daftar seluruh migrasi lengkap dengan nama tag, status (`TERPASANG` / `PENDING`), waktu dijalankan, dan ringkasan fitur/perubahan skemanya, jalankan:

```bash
bun --cwd apps/api db:status
```

Perintah ini secara otomatis mencocokkan record di tabel `__drizzle_migrations` dengan metadata di `apps/api/drizzle/meta/_journal.json` dan memberikan output tabel yang jelas serta mendeteksi jika ada migrasi orphan.

### Cara Cek Manual via SQL Query

**Lokal:**
```bash
docker exec mknsite-mysql-1 mysql -u mknsite -p"mknsite-local-only" mknsite \
  -e "SELECT * FROM __drizzle_migrations ORDER BY created_at;"
```

**Production (via SSH ke VPS atau Coolify terminal):**
```bash
# Dari Coolify Terminal atau SSH ke VPS
mysql -u mknsite -p"<PASSWORD>" mknsite \
  -e "SELECT * FROM __drizzle_migrations ORDER BY created_at;"
```

### Membandingkan Lokal vs Production

1. Hitung jumlah entry di `__drizzle_migrations` di kedua environment
2. Bandingkan dengan jumlah entry di `apps/api/drizzle/meta/_journal.json`
3. Jika jumlah di database < jumlah di journal → ada migrasi yang belum diterapkan
4. Jika jumlah di database > jumlah di journal → ada migrasi orphan (file sudah dihapus tapi record masih ada)

```
Contoh perbandingan:

_journal.json entries: 4 (0000, 0001, 0002, 0003)
__drizzle_migrations lokal: 3 → migrasi 0003 BELUM jalan di lokal
__drizzle_migrations prod:  4 → semua migrasi sudah jalan di production
```

> [!WARNING]
> **Drizzle TIDAK memiliki fitur rollback otomatis.** Jika perlu rollback migrasi, harus manual: tulis SQL `DROP TABLE` / `ALTER TABLE DROP COLUMN` sendiri, lalu hapus row dari `__drizzle_migrations`.

## Patokan Otomasi Registrasi Menu Dinamis (Standar Wajib Opsi B)

Sistem MKN Site menggunakan navigasi modul portal berbasis tabel `menus` di database.
Agar modul baru yang dikembangkan di frontend langsung aktif dan muncul di portal tanpa mengandalkan input manual admin di production, tim MKN Site menetapkan **Opsi B (Otomasi via seed.ts)** sebagai standar baku proyek:

### Prinsip Kerja Otomasi Menu:
1. **Satu Kesatuan PR**: Setiap developer/agen yang membuat halaman modul baru (misal: `apps/web/app/portal/ops-telco/page.tsx`) **wajib** mendaftarkan permission, role, dan menu di `apps/api/src/db/seed.ts` pada PR yang sama.
2. **Zero Human Error**: Menghindari salah ketik URL (misal typo `/telco` yang berujung 404) atau kelupaan mengisi `requiredPermission` di panel admin.
3. **Eksekusi Otomatis Coolify**: Saat PR di-merge ke `main`, container backend Coolify di production mengeksekusi startup script:
   ```dockerfile
   CMD ["sh", "-c", "bunx drizzle-kit migrate && bun src/db/seed.ts && bun src/index.ts"]
   ```
   Eksekusi `seed.ts` secara otomatis memasukkan menu ke database production secara idempoten.
4. **Dilarang Bergantung pada Input Manual**: QA dilarang meloloskan PR rute portal baru jika menunya tidak terdaftar di `seed.ts`.

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
