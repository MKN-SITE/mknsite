param(
  [string]$repo = 'MKN-SITE/mknsite',
  [string]$Token,
  [pscredential]$credential,
  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not $Token) {
  if ($credential) {
    $Token = [System.Net.NetworkCredential]::new('', $credential.Password).Password
  } elseif ($env:GITHUB_TOKEN) {
    $Token = $env:GITHUB_TOKEN
  } elseif ($env:GH_TOKEN) {
    $Token = $env:GH_TOKEN
  } else {
    # Coba ambil token dari gh CLI jika ada
    try {
      $ghToken = (gh auth token 2>$null)
      if ($ghToken -and $LASTEXITCODE -eq 0) {
        $Token = $ghToken.Trim()
      }
    } catch {}
  }
}

if (-not $Token -and -not $DryRun) {
  # Coba Get-Credential jika ada UI/interaktif
  try {
    $cred = Get-Credential -UserName 'token' -Message 'Masukkan GitHub Personal Access Token (PAT) sebagai password'
    $Token = [System.Net.NetworkCredential]::new('', $cred.Password).Password
  } catch {
    throw 'GitHub Token belum tersedia. Jalankan dengan: .\scripts\publish-plan-issues.ps1 -Token "ghp_xxx" atau set $env:GITHUB_TOKEN="ghp_xxx"'
  }
}

$headers = @{}
if ($Token) {
  $headers = @{
    Authorization = "Bearer $Token"
    Accept = 'application/vnd.github+json'
    'X-GitHub-Api-Version' = '2022-11-28'
  }
}

function Request-GitHub($method, $path, $payload = $null) {
  try {
    $args = @{ Method = $method; Uri = "https://api.github.com/$path"; Headers = $headers }
    if ($null -ne $payload) {
      $args.Body = [Text.Encoding]::UTF8.GetBytes(($payload | ConvertTo-Json -Depth 20))
      $args.ContentType = 'application/json; charset=utf-8'
    }
    Invoke-RestMethod @args
  } catch {
    # Do not emit request headers or credential-bearing exception details.
    $statusCode = $_.Exception.Response.StatusCode.value__
    throw "GitHub request failed: $method $path (HTTP $statusCode). Periksa token/akses repositori."
  }
}

$existingIssues = @()
if ($Token) {
  $repoInfo = Request-GitHub GET "repos/$repo"
  $viewer = Request-GitHub GET 'user'
  Write-Output "Repository: $($repoInfo.full_name); private: $($repoInfo.private); authenticated user: $($viewer.login)"

  Write-Output "Mengambil daftar existing issues..."
  for ($page = 1; ; $page++) {
    $batch = @(Request-GitHub GET "repos/$repo/issues?state=all&per_page=100&page=$page")
    $existingIssues += $batch | Where-Object { -not $_.pull_request }
    if ($batch.Count -lt 100) { break }
  }
  Write-Output "Ditemukan $($existingIssues.Count) existing issues."
} else {
  Write-Output "[DRY-RUN OFFLINE] Berjalan dalam mode preview offline tanpa token GitHub."
}

$planTickets = @(
  @{
    Id = 'D01'
    Title = '[D01] Inventaris kontrak API existing'
    Labels = @('documentation', 'api')
    Dependencies = 'Tidak ada'
    Files = 'apps/api/src/routes/*.ts, apps/api/src/lib/auth.ts, docs/api/current-contract.md'
    Criteria = 'Endpoint, HTTP status, dan cookie aktual tercatat lengkap (termasuk mount library Better Auth).'
    Body = @"
## Referensi Rencana
Berdasarkan rencana: ``docs/plans/openapi-user-management.md`` (Tiket D01).

### Deskripsi Tugas
Lakukan inventarisasi menyeluruh terhadap semua route API, handler wrapper, Better Auth mount, status HTTP aktual, dan mekanisme session cookie yang saat ini berjalan di codebase.

### File Utama Terkait
- ``apps/api/src/routes/*.ts``
- ``apps/api/src/lib/auth.ts``
- ``docs/api/current-contract.md`` (Output baru)

### Kriteria Selesai (Acceptance Criteria)
- [ ] Dokumentasikan semua endpoint existing (Health, Auth, Workspace, Admin, Realtime).
- [ ] Catat format request body, header, query parameter, dan bentuk response per status HTTP.
- [ ] Inventarisasi endpoint Better Auth yang dipasang langsung (`/api/auth/*`) vs wrapper MKN (`/auth/*`).
- [ ] Pisahkan fakta pembacaan kode dengan hasil runtime aktual.
- [ ] Simpan dokumen di ``docs/api/current-contract.md``.

> **Catatan:** Jangan install package baru atau mengubah endpoint pada tiket ini.
"@
  },
  @{
    Id = 'D02'
    Title = '[D02] Pasang OpenAPI dan Swagger UI'
    Labels = @('documentation', 'api', 'backend')
    Dependencies = 'D01'
    Files = 'apps/api/package.json, apps/api/src/index.ts, bun.lock'
    Criteria = '/docs dan /docs/json mengembalikan HTTP 200 lokal; di production nonaktif secara default.'
    Body = @"
## Referensi Rencana
Berdasarkan rencana: ``docs/plans/openapi-user-management.md`` (Tiket D02).

### Deskripsi Tugas
Pilih dan pasang generator OpenAPI & Swagger UI yang kompatibel dengan versi Elysia dan Bun yang terpasang di repository.

### File Utama Terkait
- ``apps/api/package.json``
- ``apps/api/src/index.ts``
- ``bun.lock``

### Kriteria Selesai (Acceptance Criteria)
- [ ] Generator OpenAPI dan Swagger UI terpasang tanpa merusak dependency lain.
- [ ] Endpoint `/docs` (Swagger UI) dan `/docs/json` (OpenAPI spec) mengembalikan status 200 di lingkungan lokal.
- [ ] Dokumentasi nonaktif secara default di production (dibatasi oleh environment variable).
- [ ] Operasi baseline lulus: ``bun run check`` dan ``bun --cwd apps/api test``.
"@
  },
  @{
    Id = 'D03'
    Title = '[D03] Dokumentasikan Auth, Workspace, Admin, dan Error'
    Labels = @('documentation', 'api')
    Dependencies = 'D02'
    Files = 'apps/api/src/routes/*.ts'
    Criteria = 'Seluruh route existing tampil di Swagger; response sesuai runtime; alur login -> me -> logout dari Swagger berhasil.'
    Body = @"
## Referensi Rencana
Berdasarkan rencana: ``docs/plans/openapi-user-management.md`` (Tiket D03).

### Deskripsi Tugas
Lengkapi metadata OpenAPI (schema input/output, tags, security requirement cookie, operationId unik) untuk endpoint Health, Auth (Employee & Admin), Workspace, Admin, dan Error components.

### File Utama Terkait
- ``apps/api/src/routes/health.ts``
- ``apps/api/src/routes/auth.ts``
- ``apps/api/src/routes/workspace.ts``
- ``apps/api/src/routes/admin.ts``

### Kriteria Selesai (Acceptance Criteria)
- [ ] Setiap route memiliki tag, operationId unik, summary bahasa Indonesia, dan schema body/response.
- [ ] Konfigurasi 2 cookie security scheme (`mkn_employee` & `mkn_admin`).
- [ ] Alur uji Swagger lokal: Login melalui Swagger -> Cookie tersimpan di browser -> Panggil /me berhasil -> Logout berhasil.
- [ ] Komponen error umum (400, 401, 403, 404, 422, 500) terdokumentasi tanpa membocorkan data sensitif.
"@
  },
  @{
    Id = 'D04'
    Title = '[D04] Dokumentasikan SSE dan contoh client'
    Labels = @('documentation', 'api', 'realtime')
    Dependencies = 'D03'
    Files = 'docs/api/realtime.md'
    Criteria = 'Event existing serta batasan single-instance/replay tertulis; skenario stream terautentikasi dapat diuji.'
    Body = @"
## Referensi Rencana
Berdasarkan rencana: ``docs/plans/openapi-user-management.md`` (Tiket D04).

### Deskripsi Tugas
Buat dokumentasi teknis mendalam untuk Server-Sent Events (SSE) `GET /realtime/events` beserta contoh implementasi client dan penanganan reconnect.

### File Utama Terkait
- ``docs/api/realtime.md`` (Output baru)

### Kriteria Selesai (Acceptance Criteria)
- [ ] Dokumentasikan format `text/event-stream` dan event yang ada (`connected`, `access.updated`, `session.revoked`, `notification.created`).
- [ ] Dokumentasikan keterbatasan runtime saat ini (in-memory single process hub, belum ada event replay, pemilihan cookie fallback).
- [ ] Berikan contoh client EventSource JavaScript/TypeScript dan contoh pengujian via curl/streaming dengan cookie jar.
"@
  },
  @{
    Id = 'U01'
    Title = '[U01] Guard admin dan error schema bersama'
    Labels = @('backend', 'security')
    Dependencies = 'D03'
    Files = 'apps/api/src/routes/admin.ts, apps/api/src/lib/auth.ts'
    Criteria = 'Status 401 (belum login) dan 403 (tidak berizin) terpisah jelas; proteksi CSRF/origin mutation teruji.'
    Body = @"
## Referensi Rencana
Berdasarkan rencana: ``docs/plans/openapi-user-management.md`` (Tiket U01).

### Deskripsi Tugas
Perkuat admin middleware/guard sehingga pemisahan autentikasi (401) dan otorisasi (403) berjalan konsisten, serta pastikan verifikasi origin/CSRF pada mutasi.

### File Utama Terkait
- ``apps/api/src/routes/admin.ts``
- ``apps/api/src/lib/auth.ts``

### Kriteria Selesai (Acceptance Criteria)
- [ ] Request tanpa session admin valid menghasilkan HTTP 401.
- [ ] Request dengan session admin tapi tanpa permission `admin.manage` menghasilkan HTTP 403.
- [ ] Skema respon error mengikuti standar bersama `{ "code": "...", "message": "..." }`.
- [ ] Test otomatis membuktikan isolasi 401 vs 403.
"@
  },
  @{
    Id = 'U02'
    Title = '[U02] Schema DTO + daftar/detail user dan daftar role'
    Labels = @('backend', 'api')
    Dependencies = 'U01'
    Files = 'apps/api/src/routes/admin.ts, apps/api/src/lib/dto.ts'
    Criteria = 'Pagination/filter/field whitelist teruji; respons bebas dari hash password, session token, atau credential provider.'
    Body = @"
## Referensi Rencana
Berdasarkan rencana: ``docs/plans/openapi-user-management.md`` (Tiket U02).

### Deskripsi Tugas
Implementasikan endpoint pembacaan data administrasi:
- `GET /admin/users` (daftar dengan pagination, search, filter status & accountType)
- `GET /admin/users/:id` (detail user)
- `GET /admin/roles` (daftar role dan permission yang tersedia)

### File Utama Terkait
- ``apps/api/src/routes/admin.ts``

### Kriteria Selesai (Acceptance Criteria)
- [ ] Kontrak `UserSummary` mengembalikan `id`, `name`, `email`, `accountType`, `isActive`, `roles`, `createdAt`, `updatedAt`.
- [ ] Response disanitasi: tidak boleh memuat `passwordHash`, credential provider, atau auth tokens.
- [ ] Query pagination stabil (sort id desc) dan batch loading untuk role (menghindari N+1 query).
- [ ] Test unit/integrasi untuk filter, pagination, dan batasan pageSize.
"@
  },
  @{
    Id = 'U03'
    Title = '[U03] Review provisioning, credential legacy, migrasi dan transaksi'
    Labels = @('backend', 'database', 'security')
    Dependencies = 'U02'
    Files = 'docs/plans/user-provisioning-review.md'
    Criteria = 'Keputusan teknis provisioning identity Better Auth + MKN DB dan rencana rollback ditulis sebelum implementasi create/update.'
    Body = @"
## Referensi Rencana
Berdasarkan rencana: ``docs/plans/openapi-user-management.md`` (Tiket U03).

### Deskripsi Tugas
Lakukan review teknis mendalam tentang cara provisioning user yang kompatibel antara tabel `users` MKN dan tabel Better Auth (`auth_user`, `auth_account`), pengelolaan hashing, serta transactional safety.

### Kriteria Selesai (Acceptance Criteria)
- [ ] Review strategi transaksi bersama antara pembuatan identitas Better Auth dan user internal MKN.
- [ ] Pastikan tidak ada akun yang tertinggal dalam keadaan setengah dibuat (orphaned identity).
- [ ] Tulis keputusan teknis dan rencana rollback di `docs/plans/user-provisioning-review.md`.
"@
  },
  @{
    Id = 'U04'
    Title = '[U04] Service create employee dan POST /admin/users'
    Labels = @('backend', 'api')
    Dependencies = 'U03'
    Files = 'apps/api/src/routes/admin.ts, apps/api/src/services/user-provisioning.ts'
    Criteria = 'Akun baru employee berhasil login; email duplikat 409; kegagalan transaksi tidak meninggalkan akun parsial.'
    Body = @"
## Referensi Rencana
Berdasarkan rencana: ``docs/plans/openapi-user-management.md`` (Tiket U04).

### Deskripsi Tugas
Implementasikan endpoint `POST /admin/users` untuk membuat akun karyawan baru oleh admin dengan transaksi aman.

### File Utama Terkait
- ``apps/api/src/routes/admin.ts``
- Service provisioning terkait

### Kriteria Selesai (Acceptance Criteria)
- [ ] Validasi input: nama trim (1-160), email valid (maks 191), password (12-128 karakter), roleIds valid.
- [ ] Penolakan pemberian hak `admin.manage` pada akun karyawan di layer backend.
- [ ] Penanganan konflik email duplikat mengembalikan status HTTP 409.
- [ ] Transaksi DB atomik: jika salah satu langkah gagal, seluruh perubahan di-rollback.
- [ ] Akun yang baru dibuat dapat login melalui portal `/login`.
- [ ] Pencatatan ke tabel `audit_logs`.
"@
  },
  @{
    Id = 'U05'
    Title = '[U05] PATCH profil dan sinkronisasi identity'
    Labels = @('backend', 'api')
    Dependencies = 'U04'
    Files = 'apps/api/src/routes/admin.ts'
    Criteria = 'Nama & email konsisten di kedua tabel; field terlarang ditolak; sesi dicabut jika email berubah.'
    Body = @"
## Referensi Rencana
Berdasarkan rencana: ``docs/plans/openapi-user-management.md`` (Tiket U05).

### Deskripsi Tugas
Implementasikan endpoint `PATCH /admin/users/:id` untuk mengubah profil pengguna (nama dan/atau email) dengan sinkronisasi atomik ke tabel identitas auth.

### Kriteria Selesai (Acceptance Criteria)
- [ ] Perubahan nama/email tersinkronisasi di tabel `users` dan `auth_user`.
- [ ] Field terlarang (`password`, `roleIds`, `isActive`, `accountType`) ditolak pada endpoint profil ini.
- [ ] Jika email diubah, semua session aktif user tersebut dicabut (revoke) sehingga wajib login ulang dengan email baru.
- [ ] Pencatatan ke tabel `audit_logs`.
"@
  },
  @{
    Id = 'U06'
    Title = '[U06] Perkuat PATCH role/status; tambah revoke-sessions'
    Labels = @('backend', 'api', 'security')
    Dependencies = 'U05'
    Files = 'apps/api/src/routes/admin.ts'
    Criteria = 'Role valid, akun admin terlindungi, audit atomik, sesi lama tidak dapat dipakai ulang.'
    Body = @"
## Referensi Rencana
Berdasarkan rencana: ``docs/plans/openapi-user-management.md`` (Tiket U06).

### Deskripsi Tugas
Perkuat endpoint existing `PATCH /admin/users/:id/roles` dan `PATCH /admin/users/:id/status`, serta buat endpoint baru `POST /admin/users/:id/revoke-sessions`.

### Kriteria Selesai (Acceptance Criteria)
- [ ] Saat akun dinonaktifkan (`isActive: false`), seluruh sesi di database langsung dicabut dalam satu transaksi.
- [ ] Akun yang diaktifkan kembali tidak menghidupkan kembali sesi lama.
- [ ] Admin tidak dapat menonaktifkan akunnya sendiri atau mencabut status admin terakhir (last-admin protection).
- [ ] Perubahan role otomatis mencabut sesi aktif agar user login ulang dengan hak akses terbaru.
- [ ] Endpoint `POST /admin/users/:id/revoke-sessions` mencabut sesi tanpa menonaktifkan user.
"@
  },
  @{
    Id = 'R01'
    Title = '[R01] Konteks/revalidasi/cleanup SSE dan admin.users.updated'
    Labels = @('backend', 'realtime')
    Dependencies = 'U06'
    Files = 'apps/api/src/routes/realtime.ts, apps/web/lib/sse.ts'
    Criteria = 'Dua sesi aktif (admin & employee) terisolasi benar; revoke/disconnect teruji; admin lain menerima event pembaruan.'
    Body = @"
## Referensi Rencana
Berdasarkan rencana: ``docs/plans/openapi-user-management.md`` (Tiket R01).

### Deskripsi Tugas
Perbarui SSE `GET /realtime/events`:
- Dukungan parameter `?context=employee|admin`.
- Event baru `admin.users.updated` khusus untuk administrator yang berhak.
- Revalidasi berkala pada koneksi aktif stream.

### Kriteria Selesai (Acceptance Criteria)
- [ ] Tab admin mengirimkan `context=admin` dan menerima konteks admin, bukan fallback ke employee.
- [ ] Event `admin.users.updated` hanya dikirim ke admin terotorisasi saat ada perubahan user.
- [ ] Sesi yang di-revoke memicu pengiriman event `session.revoked` dan pemutusan koneksi stream.
- [ ] Disconnect/abort membersihkan listener memori dan timer.
"@
  },
  @{
    Id = 'Q01'
    Title = '[Q01] QA lengkap dan regresi spec'
    Labels = @('qa', 'testing')
    Dependencies = 'R01'
    Files = 'apps/api/test/**/*.test.ts'
    Criteria = 'Seluruh matriks penerimaan QA lulus atau gap dilaporkan; spesifikasi docs dan implementasi kode cocok.'
    Body = @"
## Referensi Rencana
Berdasarkan rencana: ``docs/plans/openapi-user-management.md`` (Tiket Q01).

### Deskripsi Tugas
Jalankan pengujian komprehensif terhadap seluruh matriks penerimaan QA yang tertulis di Bagian 8 `docs/plans/openapi-user-management.md`.

### Skenario Uji Matriks QA
- [ ] Docs lokal: UI terbuka, spec valid, operationId unik.
- [ ] Docs production: UI & JSON nonaktif secara default.
- [ ] Login employee/admin: Cookie benar, /me sesuai, isolasi logout.
- [ ] Otorisasi: 401 & 403 terpisah sesuai kontrak.
- [ ] Input & Validasi: 404, 422, dan 400 malformed JSON.
- [ ] Konflik & Transaksi: Email duplikat 409, simulasi rollback atomik.
- [ ] Keamanan: Sesi dicabut pada nonaktif/ganti email/ganti role; password & token tidak bocor di response.
- [ ] SSE: Isolasi konteks employee/admin dan pemutusan koneksi otomatis saat session revoked.
"@
  },
  @{
    Id = 'L01'
    Title = '[L01] Panduan developer, deployment docs, changelog'
    Labels = @('documentation')
    Dependencies = 'Q01'
    Files = 'docs/deployment.md, docs/CHANGELOG.md, README.md'
    Criteria = 'Instruksi dapat direproduksi; dokumentasi deployment diperbarui; perubahan dicatat di CHANGELOG.md.'
    Body = @"
## Referensi Rencana
Berdasarkan rencana: ``docs/plans/openapi-user-management.md`` (Tiket L01).

### Deskripsi Tugas
Lengkapi seluruh dokumentasi pengembang, petunjuk deployment ke Coolify/Vercel, serta pencatatan changelog sesuai standar proyek.

### Kriteria Selesai (Acceptance Criteria)
- [ ] Panduan pengoperasian Swagger dan endpoint admin diperbarui di dokumentasi pengembang.
- [ ] Variabel environment baru untuk produksi didokumentasikan di `docs/deployment.md`.
- [ ] Riwayat perubahan dicatat secara ringkas di `docs/CHANGELOG.md`.
"@
  }
)

Write-Output "Memproses $($planTickets.Count) tiket rencana..."

foreach ($t in $planTickets) {
  $existing = $existingIssues | Where-Object { $_.title -like "*$($t.Id)*" }
  if ($existing) {
    Write-Output "[-] Tiket $($t.Id) sudah ada: Issue #$($existing.number) - $($existing.title)"
    continue
  }

  $labelsToAdd = @('plan') + $t.Labels

  if ($DryRun) {
    Write-Output "[DRY-RUN] Akan membuat Issue: $($t.Title) [Labels: $($labelsToAdd -join ', ')]"
    continue
  }

  Write-Output "[+] Membuat Issue: $($t.Title)..."
  $payload = @{
    title = $t.Title
    body = $t.Body
    labels = $labelsToAdd
  }

  $created = Request-GitHub POST "repos/$repo/issues" $payload
  Write-Output "    -> Berhasil dibuat: Issue #$($created.number) ($($created.html_url))"
  Start-Sleep -Milliseconds 500
}

Write-Output "Selesai memproses seluruh tiket."
