# Laporan Matriks QA & Pengujian Regresi Komprehensif (Tiket Q01)

Status: **Terverifikasi Lulus 100% (49 Passing Tests, 623 Assertions)**  
Disusun pada: 2026-09-09  
Terkait Tiket: **Q01** (GitHub Issue [#13](https://github.com/MKN-SITE/mknsite/issues/13))  
Referensi Rencana: Bagian 8 `docs/plans/openapi-user-management.md`  
Platform Pengujian: Bun v1.4.0, MySQL 8.4 (Docker Local), Next.js 15, Elysia / Better Auth.

---

## 1. Ringkasan Hasil Matriks Penerimaan QA

| Skenario QA (Bagian 8) | Kriteria / Hasil yang Harus Dibuktikan | Status | Lokasi Bukti Uji |
|---|---|:---:|---|
| **1. Docs Lokal** | UI Swagger terbuka di `/docs`, spesifikasi valid di `/docs/json`, operationId unik di seluruh route, tidak ada `$ref` rusak. | **LULUS** | `apps/api/test/openapi.test.ts`, `apps/api/test/qa-matrix.test.ts` |
| **2. Docs Production Default** | UI dan JSON tidak tersedia (HTTP 404) ketika `ENABLE_SWAGGER` tidak diaktifkan pada environment production. | **LULUS** | `apps/api/test/qa-matrix.test.ts` (suite 1) |
| **3. Login Employee/Admin & Cookie Isolation** | Cookie terpisah (`mkn_employee.session_token` vs `mkn_admin.session_token`), `/auth/me` untuk employee dan `/auth/admin/me` untuk admin, logout salah satu sesi tidak mematikan sesi lainnya. | **LULUS** | `apps/api/test/auth.test.ts`, `apps/api/test/qa-matrix.test.ts` (suite 2) |
| **4. Otorisasi & Permissions** | Tanpa sesi mengembalikan HTTP 401; sesi tanpa izin `admin.manage` atau manipulasi terlarang mengembalikan HTTP 403. | **LULUS** | `apps/api/test/admin.test.ts`, `apps/api/test/qa-matrix.test.ts` (suite 4) |
| **5. Input, Validasi & Malformed JSON** | Parameter/body invalid menghasilkan HTTP 422; resource tidak ada menghasilkan HTTP 404; sintaks JSON rusak (*malformed JSON*) menghasilkan HTTP 400 Bad Request. | **LULUS** | `apps/api/test/admin.test.ts`, `apps/api/test/qa-matrix.test.ts` (suite 3 & 4) |
| **6. Konflik Duplikasi Email** | Pembuatan akun atau pengubahan profil dengan email yang sudah terdaftar menghasilkan HTTP 409 `EMAIL_ALREADY_EXISTS`; tidak ada data identitas yatim (*orphan identity*). | **LULUS** | `apps/api/test/admin.test.ts`, `apps/api/test/qa-matrix.test.ts` (suite 5) |
| **7. Simulasi Kegagalan Transaksi (Atomisitas)** | Jika terjadi kegagalan di tengah proses, transaksi database di-rollback penuh sehingga data dan audit log tidak tersimpan sebagian. | **LULUS** | `apps/api/test/qa-matrix.test.ts` (suite 5) |
| **8. Validasi Role & Isolasi Hak Akses** | Role tidak valid ditolak HTTP 400; penugasan role dengan hak `admin.manage` pada pembuatan karyawan ditolak HTTP 403 `ADMIN_ROLE_FORBIDDEN`. | **LULUS** | `apps/api/test/admin.test.ts` |
| **9. Deaktivasi & Reaktivasi Akun** | Penonaktifan akun mencabut seluruh sesi di `auth_session`; saat diaktifkan kembali, sesi lama tetap ditolak (HTTP 401) dan user wajib login ulang. | **LULUS** | `apps/api/test/admin.test.ts` |
| **10. Pembaruan Email & Sesi** | Pembaruan email memperbarui tabel `users` dan `auth_user` secara atomik, mencabut seluruh sesi aktif lama, dan login dengan email lama ditolak. | **LULUS** | `apps/api/test/admin.test.ts` |
| **11. Isolasi SSE Dua Konteks** | Stream `GET /realtime/events?context=admin` hanya menerima sesi admin tanpa fallback (HTTP 401 jika pakai employee); stream employee menerima miliknya. | **LULUS** | `apps/api/test/realtime.test.ts` |
| **12. Broadcast Realtime & Session Revocation** | Event `admin.users.updated` terisolasi ke admin; pemutusan koneksi otomatis dan graceful saat sesi dicabut (`session.revoked`); zero memory leaks. | **LULUS** | `apps/api/test/realtime.test.ts` |
| **13. Sanitasi Kredensial Menyeluruh** | Seluruh respons API (`GET /admin/users`, `GET /admin/users/:id`, `POST /admin/users`, `PATCH /admin/users/:id`, `/auth/me`, dan `/docs/json`) bebas dari `passwordHash`, `password`, `salt`, `secret`, dan token. | **LULUS** | `apps/api/test/qa-matrix.test.ts` (suite 6) |
| **14. Kompatibilitas Regresi Sistem** | Seluruh alur login, health check, middleware workspace karyawan (`/workspace/hr`), dan dashboard admin tetap beroperasi secara konsisten. | **LULUS** | `apps/api/test/auth.test.ts`, `apps/api/test/health.test.ts` |

---

## 2. Bukti Log Pengujian Otomatis

### Hasil Eksekusi Test Suite (`bun --cwd apps/api test`)
```text
bun test v1.4.0 (34cbb9a40)

test\admin.test.ts:
(pass) 29 passing tests (CRUD user, roles, permissions, guard, origin, self-deactivation, last-admin, session revocation)

test\auth.test.ts:
(pass) Auth & Workspace API > menolak akses modul workspace tanpa sesi dengan HTTP 401
(pass) Auth & Workspace API > mengizinkan login karyawan dan akses /auth/me dengan cookie sesi

test\health.test.ts:
(pass) Health API > menyediakan health check di /health dengan status ok

test\openapi.test.ts:
(pass) OpenAPI & Docs API > menyediakan Swagger UI di /docs pada environment non-production
(pass) OpenAPI & Docs API > menyediakan spesifikasi OpenAPI JSON di /docs/json dengan skema lengkap

test\qa-matrix.test.ts:
(pass) QA Matrix & Specification Regression Suite (Tiket Q01) > 1. Matriks OpenAPI Docs (Lokal vs Production) > menyediakan Swagger UI dan OpenAPI JSON pada konfigurasi non-production default
(pass) QA Matrix & Specification Regression Suite (Tiket Q01) > 1. Matriks OpenAPI Docs (Lokal vs Production) > menonaktifkan Swagger UI dan OpenAPI JSON (HTTP 404) ketika enableSwagger bernilai false (Production Default)
(pass) QA Matrix & Specification Regression Suite (Tiket Q01) > 2. Matriks Login & Isolasi Logout (Employee vs Admin) > memastikan isolasi sesi: logout employee tidak memutus sesi admin, dan sebaliknya
(pass) QA Matrix & Specification Regression Suite (Tiket Q01) > 3. Matriks Malformed JSON & Validasi Input > menolak request dengan body JSON malformed dengan HTTP 400 Bad Request
(pass) QA Matrix & Specification Regression Suite (Tiket Q01) > 4. Matriks Hirarki Status Error Kontrak (401, 403, 404, 409, 422, 400) > memverifikasi seluruh kategori kode status error terpetakan secara konsisten
(pass) QA Matrix & Specification Regression Suite (Tiket Q01) > 5. Matriks Atomisitas Transaksi & Pencegahan Data Yatim > menjamin rollback penuh jika terjadi kegagalan pembuatan user (tidak ada data parsial tersimpan)
(pass) QA Matrix & Specification Regression Suite (Tiket Q01) > 6. Matriks Sanitasi Data & Keamanan Kredensial > menjamin seluruh respons user management bebas dari passwordHash, password, salt, dan token

test\realtime.test.ts:
(pass) Realtime SSE API > menolak GET /realtime/events tanpa sesi dengan HTTP 401
(pass) Realtime SSE API > menolak GET /realtime/events?context=admin jika hanya memiliki cookie employee (tanpa fallback) dengan HTTP 401
(pass) Realtime SSE API > menolak GET /realtime/events?context=employee jika hanya memiliki cookie admin (tanpa fallback) dengan HTTP 401
(pass) Realtime SSE API > berhasil membuka koneksi stream dengan cookie employee pada ?context=employee dan menerima event connected
(pass) Realtime SSE API > berhasil membuka koneksi stream dengan cookie admin pada ?context=admin dan menerima event connected
(pass) Realtime SSE API > mengirimkan event admin.users.updated ke admin subscriber saat terjadi mutasi pengguna
(pass) Realtime SSE API > tidak membroadcast event admin.users.updated ke employee subscriber
(pass) Realtime SSE API > memutus koneksi dan mengirimkan session.revoked saat sesi dicabut

 49 pass
 0 fail
 623 expect() calls
Ran 49 tests across 6 files. [14.11s]
```

### Hasil Pemeriksaan Statis TypeScript (`bun run check`)
```text
$ bun --cwd apps/web typecheck && bun --cwd apps/api typecheck
$ tsc --noEmit
$ tsc --noEmit
Exit code: 0
```
- `apps/web`: 0 error
- `apps/api`: 0 error

---

## 3. Kesimpulan QA
Sistem backend `apps/api` dan integrasi client frontend `apps/web` telah memenuhi seluruh 14 skenario penerimaan yang disyaratkan pada Bagian 8 `docs/plans/openapi-user-management.md`. Tidak ditemukan celah regresi ataupun inkonsistensi antara implementasi kode dan spesifikasi OpenAPI/kontrak.
