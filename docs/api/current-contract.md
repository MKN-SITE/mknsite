# Kontrak API Existing (MKN Site)

Status: **Dokumentasi Aktual (Baseline)**  
Disusun pada: 2026-09-09  
Terkait Tiket: **D01** (GitHub Issue [#2](https://github.com/MKN-SITE/mknsite/issues/2))  
Mandat: Memetakan seluruh route API, mekanisme autentikasi, status HTTP, serta membedakan fakta pembacaan kode dengan hasil uji runtime.

---

## 1. Arsitektur & Lingkup API

Backend MKN Site dibangun dengan stack:
- **Runtime & Framework:** Bun & Elysia (`apps/api/src/index.ts`)
- **Database & ORM:** MySQL 8.4 & Drizzle ORM (`apps/api/src/db/schema.ts`)
- **Autentikasi:** Better Auth dengan Drizzle MySQL adapter (`apps/api/src/lib/auth.ts`)
- **Realtime:** Server-Sent Events (SSE) dengan in-memory event hub (`apps/api/src/lib/realtime.ts`)
- **Port & Host:** Default port `3001` (diatur via env `PORT`), binding ke `0.0.0.0`

### Mount Struktur Route di `apps/api/src/index.ts`:
1. `GET /health` — Health check endpoint langsung pada instance Elysia.
2. `mount(employeeAuth.handler)` — Mount handler Better Auth untuk employee pada prefix `/api/auth/employee/*`.
3. `mount(adminAuth.handler)` — Mount handler Better Auth untuk admin pada prefix `/api/auth/admin/*`.
4. `use(authRoutes)` — Wrapper endpoint MKN dengan prefix `/auth`.
5. `use(adminRoutes)` — Endpoint manajemen administrator dengan prefix `/admin`.
6. `use(realtimeRoutes)` — Stream Server-Sent Events dengan prefix `/realtime`.
7. `use(workspaceRoutes)` — Endpoint data workspace modul dengan prefix `/workspace`.

---

## 2. Model Autentikasi, Cookie, dan Sesi

Sistem menerapkan **pemisahan sesi ganda** antara Karyawan (*Employee*) dan Administrator (*Admin*). Keduanya menggunakan instance Better Auth terpisah dengan nama cookie prefix berbeda:

| Karakteristik | Sesi Karyawan (Employee) | Sesi Administrator (Admin) |
|---|---|---|
| **Base Path Better Auth** | `/api/auth/employee` | `/api/auth/admin` |
| **Nama Cookie Sesi** | `mkn_employee.session_token` | `mkn_admin.session_token` |
| **Prefix Cookie Tambahan** | `mkn_employee.session_data`, `mkn_employee.dont_remember` | `mkn_admin.session_data`, `mkn_admin.dont_remember` |
| **Cookie Attributes** | `HttpOnly; Path=/; SameSite=Lax; Max-Age=604800 (7 hari)` | `HttpOnly; Path=/; SameSite=Lax; Max-Age=604800 (7 hari)` |
| **Secure Flag** | Aktif hanya pada `NODE_ENV === "production"` | Aktif hanya pada `NODE_ENV === "production"` |
| **Penyimpanan Sesi** | Tabel database `auth_session` | Tabel database `auth_session` |
| **Tipe Akun MKN** | `accountType: "employee"` pada tabel `users` | `accountType: "admin"` pada tabel `users` |
| **Hubungan Identitas** | `auth_user.mkn_user_id -> users.id` | `auth_user.mkn_user_id -> users.id` |

### Persyaratan Origin & CSRF (Better Auth)
Better Auth memvalidasi header `Origin` pada mutasi state (misalnya `sign-out`).
- Jika header `Origin` tidak disertakan pada request POST logout: Server mengembalikan `HTTP 403 Forbidden` dengan payload:
  ```json
  { "message": "Missing or null Origin", "code": "MISSING_OR_NULL_ORIGIN" }
  ```
- Endpoint harus dipanggil dengan header `Origin` yang terdaftar dalam `trustedOrigins` (default: `http://localhost:3000` via env `APP_ORIGIN`).

---

## 3. Inventaris Endpoint Wrapper MKN

### 3.1. Health Check
- **Endpoint:** `GET /health`
- **Tujuan:** Verifikasi ketersediaan proses API.
- **Autentikasi & Izin:** Publik, tanpa autentikasi.
- **Request:** Tidak menerima query atau body.
- **Response Sukses (HTTP 200):**
  ```json
  {
    "status": "ok",
    "service": "mknsite-api"
  }
  ```
- **Keterbatasan:** Tidak menguji konektivitas aktual ke database MySQL.

---

### 3.2. Auth Employee (Karyawan)

#### `POST /auth/login`
- **Tujuan:** Login karyawan menggunakan email dan password.
- **Autentikasi & Izin:** Publik.
- **Request Body (JSON):**
  ```json
  {
    "email": "hr@mknsite.online",
    "password": "demo12345"
  }
  ```
  *Validasi Elysia:* `email` format string email, `password` minimal 8 karakter.
- **Alur Kerja:**
  1. Mengecek tabel `users` via `findMknAccount(email, "employee")`. Memastikan `accountType === "employee"` dan `isActive === 1`.
  2. Jika akun tidak ada atau bukan employee aktif -> `HTTP 401 Unauthorized`:
     ```json
     { "message": "Email atau kata sandi tidak sesuai." }
     ```
  3. Meneruskan request internal ke Better Auth `/api/auth/employee/sign-in/email` dengan opsi `rememberMe: true`.
- **Response Sukses (HTTP 200):**
  - **Header Set-Cookie:** `mkn_employee.session_token=<token>; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax`
  - **Body Response (Format Asli Better Auth):**
    ```json
    {
      "redirect": false,
      "token": "P0SY5tRHXBgZDef7UaBX8x7gcE8qFngK",
      "user": {
        "id": "09737743-f78c-47c9-927d-72c34fbbdeab",
        "name": "Ayu Prameswari",
        "email": "hr@mknsite.online",
        "emailVerified": true,
        "image": null,
        "createdAt": "2026-09-07T11:53:50.000Z",
        "updatedAt": "2026-09-07T11:53:50.000Z"
      }
    }
    ```
  > **Catatan Penting:** Response login ini adalah payload Better Auth (`id` adalah UUID string dari `auth_user`), **bukan** format profil internal MKN.

#### `GET /auth/me`
- **Tujuan:** Mengambil profil karyawan, role, dan permission aktif dari session cookie.
- **Autentikasi & Izin:** Wajib cookie `mkn_employee.session_token`.
- **Response Sukses (HTTP 200):**
  ```json
  {
    "user": {
      "id": 1,
      "name": "Ayu Prameswari",
      "email": "hr@mknsite.online",
      "actorType": "user",
      "roles": ["HR"],
      "permissions": ["dashboard.view", "hr.view", "hr.manage"]
    }
  }
  ```
- **Response Error (HTTP 401 Unauthorized):**
  ```json
  { "message": "Sesi karyawan tidak valid." }
  ```

#### `POST /auth/logout`
- **Tujuan:** Mengakhiri sesi karyawan dan menghapus cookie.
- **Autentikasi & Izin:** Cookie `mkn_employee.session_token`. Wajib header `Origin` valid.
- **Response Sukses (HTTP 200):**
  - **Header Set-Cookie:** Membersihkan cookie dengan `Max-Age=0`.
  - **Body Response:**
    ```json
    { "success": true }
    ```
- **Response Error:**
  - Tanpa header `Origin` -> `HTTP 403 Forbidden`:
    ```json
    { "message": "Missing or null Origin", "code": "MISSING_OR_NULL_ORIGIN" }
    ```

---

### 3.3. Auth Admin (Administrator)

#### `POST /auth/admin/login`
- **Tujuan:** Login administrator dengan pemisahan sesi terisolasi.
- **Autentikasi & Izin:** Publik.
- **Request Body (JSON):** Sama seperti employee (`email` dan `password`).
- **Alur Kerja:**
  1. Mengecek `findMknAccount(email, "admin")`. Memastikan `accountType === "admin"` dan `isActive === 1`.
  2. Jika akun tidak ada atau bukan admin aktif -> `HTTP 401 Unauthorized`:
     ```json
     { "message": "Kredensial administrator tidak sesuai." }
     ```
  3. Meneruskan ke Better Auth `/api/auth/admin/sign-in/email`.
- **Response Sukses (HTTP 200):**
  - **Header Set-Cookie:** `mkn_admin.session_token=<token>; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax`
  - **Body Response:** Format Better Auth user + token.

#### `GET /auth/admin/me`
- **Tujuan:** Mengambil data profil administrator dan permission.
- **Autentikasi & Izin:** Wajib cookie `mkn_admin.session_token`.
- **Response Sukses (HTTP 200):**
  ```json
  {
    "user": {
      "id": 6,
      "name": "System Administrator",
      "email": "admin@mknsite.online",
      "actorType": "admin",
      "roles": ["Administrator"],
      "permissions": ["dashboard.view", "admin.manage"]
    }
  }
  ```
- **Response Error (HTTP 401 Unauthorized):**
  ```json
  { "message": "Sesi administrator tidak valid." }
  ```

#### `POST /auth/admin/logout`
- **Tujuan:** Logout sesi admin tanpa mengganggu sesi karyawan jika sedang aktif di browser yang sama.
- **Response Sukses (HTTP 200):** `{"success": true}` dan membersihkan cookie `mkn_admin.*`.

---

### 3.4. Workspace Modul

#### `GET /workspace/:module`
- **Tujuan:** Mengambil data bisnis modul spesifik berdasarkan otorisasi RBAC karyawan.
- **Parameter URL:**
  - `:module` (string): `hr`, `ops-telco`, `ops-workshop`, `project`.
- **Pemetaan Hak Akses Modul:**
  - `hr` -> memerlukan permission `hr.view`
  - `ops-telco` -> memerlukan permission `ops_telco.view`
  - `ops-workshop` -> memerlukan permission `ops_workshop.view`
  - `project` -> memerlukan permission `project.view`
- **Autentikasi & Izin:** Wajib cookie `mkn_employee.session_token`.
- **Response Sukses (HTTP 200):**
  ```json
  {
    "module": "hr",
    "permission": "hr.view",
    "items": []
  }
  ```
  *(Catatan: `items` masih berupa array kosong pada implementasi saat ini).*
- **Response Error:**
  - Tidak ada sesi karyawan -> `HTTP 401 Unauthorized`:
    ```json
    { "message": "Sesi karyawan tidak valid." }
    ```
  - Modul tidak terdaftar dalam daftar diizinkan -> `HTTP 404 Not Found`:
    ```json
    { "message": "Modul tidak ditemukan." }
    ```
  - Sesi karyawan ada, tapi tidak memiliki permission modul -> `HTTP 403 Forbidden`:
    ```json
    { "message": "Anda tidak memiliki izin untuk modul ini." }
    ```

---

### 3.5. Administrasi (Admin Routes)

#### `PATCH /admin/users/:id/roles`
- **Tujuan:** Mengganti seluruh role yang dimiliki oleh user target (replace all).
- **Autentikasi & Izin:** Wajib cookie `mkn_admin.session_token` dengan permission `admin.manage`.
- **Parameter URL:** `:id` (numeric string).
- **Request Body (JSON):**
  ```json
  {
    "roleIds": [1, 2]
  }
  ```
- **Response Sukses (HTTP 200):**
  ```json
  { "success": true }
  ```
- **Efek Samping Database & Realtime:**
  - Menghapus semua relasi di tabel `user_roles` untuk `userId = targetId`.
  - Memasukkan `roleId` baru ke tabel `user_roles`.
  - Memasukkan catatan ke `audit_logs` (`action: "rbac.roles.updated", resource: "user"`).
  - Mengirim event realtime via SSE ke target user: `{ "type": "access.updated", "message": "Hak akses Anda diperbarui oleh administrator." }`.
- **Response Error:**
  - Tanpa sesi admin / Tanpa permission `admin.manage` -> `HTTP 403 Forbidden`:
    ```json
    { "message": "Izin administrator diperlukan." }
    ```
    *(Temuan gap: unauthenticated menghasilkan 403, bukan 401).*
  - User ID target tidak ada di database -> `HTTP 404 Not Found`:
    ```json
    { "message": "Pengguna tidak ditemukan." }
    ```
  - Salah satu `roleId` tidak ditemukan di tabel `roles` -> `HTTP 400 Bad Request`:
    ```json
    { "message": "Satu atau lebih role tidak ditemukan." }
    ```

#### `PATCH /admin/users/:id/status`
- **Tujuan:** Mengaktifkan atau menonaktifkan akun user (`isActive: 1 | 0`).
- **Autentikasi & Izin:** Wajib cookie `mkn_admin.session_token` dengan permission `admin.manage`.
- **Request Body (JSON):**
  ```json
  {
    "isActive": false
  }
  ```
- **Response Sukses (HTTP 200):**
  ```json
  { "success": true }
  ```
- **Efek Samping Database & Realtime:**
  - Mengupdate kolom `is_active` di tabel `users`.
  - Menambahkan catatan di `audit_logs` (`action: "account.status.updated"`).
  - Mengirim event realtime via SSE:
    - Jika aktif: `{ "type": "access.updated", "message": "Akun Anda diaktifkan kembali." }`
    - Jika nonaktif: `{ "type": "session.revoked", "message": "Akun Anda dinonaktifkan oleh administrator." }`
- **Response Error:**
  - Tanpa izin admin -> `HTTP 403 Forbidden`.
  - User ID tidak ada -> `HTTP 404 Not Found`.

---

### 3.6. Realtime (Server-Sent Events)

#### `GET /realtime/events`
- **Tujuan:** Membuka koneksi streaming event Server-Sent Events (SSE).
- **Autentikasi & Izin:** Memeriksa cookie `mkn_employee.session_token` terlebih dahulu. Jika tidak ada, baru memeriksa `mkn_admin.session_token`.
- **Headers Response:**
  - `Content-Type: text/event-stream`
  - `Cache-Control: no-cache`
  - `Connection: keep-alive`
- **Payload Awal Saat Terhubung:**
  ```text
  event: connected
  data: {"occurredAt":"2026-09-09T04:18:45.125Z"}
  ```
- **Heartbeat:** Mengirim event setiap 25 detik ke subscriber:
  ```text
  event: notification.created
  data: {"type":"notification.created","message":"keep-alive","occurredAt":"..."}
  ```
- **Event Bisnis:**
  - `access.updated` (perubahan role atau aktivasi akun)
  - `session.revoked` (penonaktifan akun)
- **Response Error (HTTP 401 Unauthorized):**
  Jika tidak ada cookie employee maupun admin yang valid:
  ```json
  { "message": "Sesi tidak valid untuk koneksi realtime." }
  ```

---

## 4. Endpoint Mount Langsung Library Better Auth

Better Auth dipasang di `index.ts` via `.mount(employeeAuth.handler)` dan `.mount(adminAuth.handler)`. Mount ini mengekspos endpoint internal Better Auth langsung ke jaringan:

| Endpoint Langsung | Metode | Perilaku & Hasil Runtime Aktual |
|---|---|---|
| `/api/auth/employee/get-session` | `GET` | **Aktif (HTTP 200)**. Mengembalikan object `{ session, user }` langsung dari tabel Better Auth jika cookie `mkn_employee` valid. |
| `/api/auth/admin/get-session` | `GET` | **Aktif (HTTP 200)**. Mengembalikan object session admin jika cookie `mkn_admin` valid. |
| `/api/auth/employee/sign-in/email` | `POST` | **Aktif (HTTP 200)**. Menerima login email/password langsung. |
| `/api/auth/admin/sign-in/email` | `POST` | **Aktif (HTTP 200)**. Menerima login email/password langsung. |
| `/api/auth/employee/sign-out` | `POST` | **Aktif (HTTP 200)**. Menghapus sesi (membutuhkan header `Origin`). |
| `/api/auth/admin/sign-out` | `POST` | **Aktif (HTTP 200)**. Menghapus sesi admin. |
| `/api/auth/employee/sign-up/email` | `POST` | **Ditolak (HTTP 400)**. Mengembalikan `{"message":"Email and password sign up is not enabled","code":"EMAIL_PASSWORD_SIGN_UP_DISABLED"}` karena `disableSignUp: true`. |
| `/api/auth/admin/sign-up/email` | `POST` | **Ditolak (HTTP 400)**. Sign up publik dinonaktifkan. |

### Celah Bypass Validasi Akun pada Direct Mount:
Pada endpoint wrapper MKN `/auth/login`, sistem menjalankan `findMknAccount(email, "employee")` yang memastikan kecocokan `accountType === "employee"` dan `isActive === 1`. Namun, jika klien langsung memanggil `/api/auth/employee/sign-in/email`:
- Kredensial diverifikasi oleh Better Auth semata. Akun bertipe `admin` pun dapat memperoleh cookie `mkn_employee.session_token`.
- **Namun di layer otorisasi berikutnya:** Saat cookie tersebut dikirim ke `/auth/me` atau `/workspace/:module`, `getAuthenticatedProfile` memvalidasi `profile.actorType === "user"`. Karena actorType adalah `admin`, request tetap ditolak dengan `HTTP 401`.
- **Rekomendasi:** Di masa mendatang, endpoint mount Better Auth sebaiknya diproteksi atau dibatasi agar klien eksternal hanya menggunakan wrapper resmi `/auth/*`.

---

## 5. Matriks Verifikasi: Pembacaan Kode vs Runtime Aktual

| No | Aspek / Skenario | Temuan Pembacaan Kode (Statis) | Hasil Pengujian Runtime (Live API) | Status Kesesuaian |
|---|---|---|---|---|
| 1 | `GET /health` | Mengembalikan status 200 `{ status, service }`. | `HTTP 200` dengan JSON sesuai. Tidak cek DB. | **Sesuai** |
| 2 | `POST /auth/login` respon body | Meneruskan response Better Auth handler. | `HTTP 200`. Mengembalikan object user Better Auth (ID bertipe UUID string), bukan profil MKN. | **Sesuai** |
| 3 | `POST /auth/login` cookie | Mengatur cookie `mkn_employee.session_token`. | `HTTP 200`. Header `Set-Cookie` diterima dengan flag `HttpOnly; SameSite=Lax`. | **Sesuai** |
| 4 | `GET /auth/me` terautentikasi | Mengambil data dari `getAuthenticatedProfile`. | `HTTP 200`. Mengembalikan `{ user: { id (int), name, email, actorType, roles, permissions } }`. | **Sesuai** |
| 5 | `POST /auth/logout` tanpa header Origin | Better Auth menangani sign-out. | `HTTP 403 Forbidden` (`{"message":"Missing or null Origin"}`). Wajib menyertakan header `Origin`. | **Sesuai (Terbukti di runtime)** |
| 6 | `POST /auth/logout` dengan header Origin | Menghapus cookie di browser. | `HTTP 200` (`{"success": true}`). Mengirim `Set-Cookie` dengan `Max-Age=0`. | **Sesuai** |
| 7 | `GET /workspace/hr` tanpa sesi | Menolak request. | `HTTP 401 Unauthorized` (`{"message":"Sesi karyawan tidak valid."}`). | **Sesuai** |
| 8 | `GET /workspace/project` tanpa izin modul | Menolak jika permission tidak cocok. | `HTTP 403 Forbidden` (`{"message":"Anda tidak memiliki izin untuk modul ini."}`). | **Sesuai** |
| 9 | `PATCH /admin/users/:id/roles` tanpa sesi | Kode memeriksa `requireAdmin(request)`. Jika null, return 403. | `HTTP 403 Forbidden` (`{"message":"Izin administrator diperlukan."}`). **Bukan 401.** | **Sesuai Kode (Celah Otorisasi)** |
| 10 | `PATCH /admin/users/9999/roles` user tidak ada | Cek `target` di `users`. | `HTTP 404 Not Found` (`{"message":"Pengguna tidak ditemukan."}`). | **Sesuai** |
| 11 | `PATCH /admin/users/1/roles` role tidak valid | Cek panjang query `inArray` vs array input. | `HTTP 400 Bad Request` (`{"message":"Satu atau lebih role tidak ditemukan."}`). | **Sesuai** |
| 12 | `GET /realtime/events` koneksi SSE | Membuka stream SSE. | Mengirim header `text/event-stream` dan event pertama `event: connected`. | **Sesuai** |
| 13 | Direct Mount `POST /api/auth/employee/sign-up/email` | `disableSignUp: true` pada konfigurasi auth. | `HTTP 400 Bad Request` (`code: EMAIL_PASSWORD_SIGN_UP_DISABLED`). | **Sesuai** |

---

## 6. Laporan Gap & Temuan Teknis untuk Tiket Selanjutnya

Dokumentasi ini mengidentifikasi 7 temuan penting yang harus diselesaikan pada tiket-tiket berikutnya sesuai roadmap rencana `docs/plans/openapi-user-management.md`:

1. **Pemisahan 401 dan 403 pada Route Admin (Target Tiket U01):**
   - *Masalah:* `requireAdmin(request)` mengembalikan 403 untuk request tanpa session (`!session`) maupun request dengan session tanpa izin `admin.manage`.
   - *Dampak:* Frontend/client tidak dapat membedakan apakah pengguna perlu diarahkan ke halaman login (401) atau dilarang mengakses halaman (403).

2. **Inkonsistensi Format Error Response (Target Tiket U01 & D03):**
   - Route MKN mengembalikan `{ "message": string }`.
   - Better Auth mengembalikan `{ "message": string, "code": string }`.
   - Validasi skema Elysia mengembalikan `{ "type": "validation", ... }` atau string teks mentah pada error parsing JSON.
   - *Rekomendasi:* Normalisasi schema error menjadi `{ "code": string, "message": string }` pada route-route MKN baru.

3. **Integritas Penonaktifan Akun & Sesi Database (Target Tiket U06):**
   - *Masalah:* `PATCH /admin/users/:id/status` dengan `isActive: false` hanya mengupdate kolom `is_active` di tabel `users`. Sesi aktif di tabel `auth_session` **tidak dihapus**.
   - *Dampak:* Jika pengguna diaktifkan kembali nanti, cookie lama yang belum kedaluwarsa tetap bisa digunakan kembali. Sesi harus di-revoke secara eksplisit saat nonaktif.

4. **Transaksi Parsial pada Update Status (Target Tiket U06):**
   - *Masalah:* Pada `PATCH /admin/users/:id/status`, operasi `db.update(users)` dan `db.insert(auditLogs)` dijalankan tanpa `db.transaction(...)`. Jika insert audit gagal, perubahan status tetap tersimpan tanpa jejak audit.

5. **Konteks Seleksi Sesi pada Realtime SSE (Target Tiket R01):**
   - *Masalah:* `GET /realtime/events` selalu memprioritaskan cookie employee jika kedua cookie (`mkn_employee` dan `mkn_admin`) ada di browser. Administrator yang membuka tab admin bisa menerima stream dalam konteks employee.
   - *Target R01:* Tambahkan query parameter `?context=employee|admin` dengan default `employee`.

6. **Heartbeat Transport vs Notifikasi Bisnis (Target Tiket R01):**
   - *Masalah:* Heartbeat interval 25 detik saat ini menggunakan event `notification.created` dengan pesan `"keep-alive"`. Ini mencampur event transport dengan event bisnis UI notifikasi.

7. **Ketiadaan Proteksi Last-Admin (Target Tiket U06):**
   - *Masalah:* Saat ini admin dapat menonaktifkan akunnya sendiri atau mengubah role admin lain tanpa validasi jumlah administrator tersisa.
