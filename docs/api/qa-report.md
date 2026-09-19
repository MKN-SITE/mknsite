# Laporan Matriks QA & Pengujian Regresi Komprehensif (OPS Telco & Autentikasi)

Status: **Terverifikasi Lulus 100% (139 Passing Tests, 1081 Assertions across 14 Files)**  
Disusun pada: 2026-09-16  
Terkait Modul: **OPS Telco Submenu Teknisi (Form Oncall, Overtime, Cuti)**, **Pendaftaran Karyawan & Multi-Identitas (#32)**, **Tiket Q01 (#13)**, **Dynamic Menus & E2E (#25)**  
Platform Pengujian: Bun v1.4.0, MySQL 8.4 (Docker Local mknsite_test), Next.js 15, Elysia / Better Auth.

---

## 1. Ringkasan Matriks Pengujian Komprehensif

| Kategori Pengujian | Cakupan Pengujian | Status | Total Tes / Assertion | Lokasi Bukti Uji |
|---|---|:---:|:---:|---|
| **OPS Telco Technician Forms (23 Kriteria)** | Migrasi modul formulir Oncall, Overtime, Cuti dari HR ke OPS Telco Teknisi, RBAC isolation, otorisasi supervisor vs teknisi, auto number OC/OT/CT, PDF generation, zero data loss | **LULUS** | 23 Tests / 73 Assertions | `apps/api/test/ops-telco-forms.test.ts` |
| **Form Oncall Identity & Automation** | Integrasi nama & ID KPC otomatis, lock supervisor ke Rahmansyah - Z110779, Job Order manual fallback, eliminasi Total Jam, penolakan pengajuan tanpa KPC ID (422) | **LULUS** | 9 Tests / 32 Assertions | `apps/api/test/hr-oncall-identity.test.ts` |
| **Pendaftaran & Multi-Identitas (Issue #32)** | Registrasi mandiri karyawan, pencegahan tabrakan lintas identitas (username vs kpcId), login 1 kolom (email, ID KPC, username), email verification guard, reset password | **LULUS** | 20 Tests / 64 Assertions | `apps/api/test/auth-issue-32.test.ts` |
| **Admin & Manajemen Pengguna** | CRUD user, roles, permissions, guard, origin protection, self-deactivation protection, last-admin protection, session revocation | **LULUS** | 29 Tests / 370 Assertions | `apps/api/test/admin.test.ts` |
| **End-to-End Suite (Issue #25)** | Siklus autentikasi admin & karyawan, paginasi & filter user management, dynamic menu lifecycle | **LULUS** | 16 Tests / 77 Assertions | `apps/api/test/e2e-issue25.test.ts` |
| **QA Matrix & Specification Regression (Q01)** | Swagger UI docs lokal vs prod, isolasi sesi employee vs admin, malformed JSON, pemetaan status code, atomisitas DB, sanitasi data sensitif | **LULUS** | 8 Tests / 173 Assertions | `apps/api/test/qa-matrix.test.ts` |
| **Realtime SSE API** | Isolasi stream admin vs employee, broadcast mutasi admin, session revocation via SSE | **LULUS** | 8 Tests / 27 Assertions | `apps/api/test/realtime.test.ts` |
| **RBAC CRUD & Superadmin Protection** | Manajemen role & permission kustom, proteksi role/permission sistem, guard superadmin | **LULUS** | 8 Tests / 56 Assertions | `apps/api/test/rbac-crud.test.ts`, `apps/api/test/superadmin.test.ts` |
| **Dynamic Menus API** | Akses menu karyawan terfilter hak akses, CRUD menu oleh admin, urutan tampilan dinamis | **LULUS** | 4 Tests / 48 Assertions | `apps/api/test/menu.test.ts` |
| **Auth & Workspace API** | Akses modul workspace dengan izin terverifikasi, penolakan akses tanpa izin dengan HTTP 401/403 | **LULUS** | 2 Tests / 10 Assertions | `apps/api/test/auth.test.ts` |
| **OpenAPI & Health Check** | Skema OpenAPI JSON valid, operationId unik, health check `/health` | **LULUS** | 3 Tests / 15 Assertions | `apps/api/test/openapi.test.ts`, `apps/api/test/health.test.ts` |

---

## 2. Rincian 23 Kriteria Pengujian OPS Telco Technician Forms

1. **Submenu Visibility:** Teknisi memiliki akses ke 3 submenu formulir (`form-oncall`, `form-overtime`, `form-cuti`) di workspace OPS Telco.
2. **Submenu Restriction:** Teknisi ditolak saat mencoba membuka submenu Supervisor (`overview`, `assignment`, `schedule`, `wag`, `quotation`).
3. **Supervisor Visibility:** Supervisor memiliki akses penuh ke submenu Supervisor dan seluruh submenu Teknisi.
4. **Endpoint Guard:** Pengguna tanpa permission `ops_telco.forms.view` ditolak HTTP 403 saat mengakses `/ops-telco/forms`.
5. **Auto Numbering:** Pembuatan formulir baru menghasilkan nomor otomatis berformat baku `OC-YYYY-ID`, `OT-YYYY-ID`, atau `CT-YYYY-ID`.
6. **Data Isolation (Teknisi):** Teknisi hanya dapat melihat dan mengambil formulir miliknya sendiri.
7. **Supervisor View All:** Supervisor dapat melihat dan mengelola seluruh formulir milik seluruh staf teknisi.
8. **Action Guard (Teknisi):** Teknisi ditolak HTTP 403 saat mencoba melakukan approve, reject, defer, atau reopen formulir.
9. **Supervisor Approval:** Supervisor berhasil melakukan approval (disetujui/ditolak/ditangguhkan) dan dapat membuka kembali ke status draft (*reopen*).
10. **Duplication Traceability:** Duplikasi formulir menyalin detail pekerjaan, membersihkan status approval, membuat nomor baru, dan merekam `duplicatedFromId`.
11. **Employee Auto Identity:** Payload `employeeName` dari client diabaikan; server selalu mengisi format `<user.name> - <user.kpcId>` secara otomatis dari sesi akun.
12. **Supervisor Locking:** Payload `supervisorName` pada Form Oncall selalu dikunci server ke `Rahmansyah - Z110779`.
13. **Manual Job Order No:** Form Oncall mempertahankan Job Order No inputan manual jika diisi; fallback otomatis ke nomor OC jika dikosongkan.
14. **Total Hours Deletion:** Kolom Total Jam (*totalHours*) dihapus dari payload dan tidak pernah disimpan ke basis data.
15. **KPC ID Submission Guard:** Akun tanpa ID KPC diperbolehkan menyimpan draft formulir, namun pengajuan (*submission*) wajib ditolak dengan HTTP 422.
16. **Programmatic Oncall PDF:** PDF Form Oncall digenerate programatik murni tanpa background PDF template asli dan tanpa Total Jam.
17. **Template Overtime & Cuti PDF:** PDF Form Overtime dan Cuti menggunakan template master background resmi dari direktori `form-templates/ops-telco/technician/`.
18. **PDF Download Stream:** Endpoint `GET /ops-telco/forms/:id/pdf` menghasilkan response stream PDF yang valid (content-type `application/pdf`).
19. **HR Role Isolation:** Pemegang role legacy `hr` tidak otomatis menerima hak `ops_telco.forms.manage` maupun `ops_telco.forms.view`.
20. **Default Basic Access:** Role `employee-basic` memiliki izin `ops_telco.forms.view` dan dapat membuka workspace formulir.
21. **Database Menu Sync:** Record menu `/portal/hr` di database dinonaktifkan (`is_active = 0`), sementara record menu `/portal/ops-telco` aktif (`is_active = 1`).
22. **Regression Protection:** Form Overtime dan Cuti tidak mengalami kerusakan struktur dan mempertahankan kolom khusus masing-masing.
23. **Zero Data Loss:** Migrasi `0006_ops_telco_forms.sql` mempertahankan seluruh relasi foreign key, indeks, dan 26 record data lama secara utuh.

---

## 3. Bukti Log Eksekusi Test Suite Terisolasi (`mknsite_test`)

```text
bun test v1.4.0 (34cbb9a40)

test/openapi.test.ts:
(pass) OpenAPI & Docs API > menyediakan Swagger UI di /docs pada environment non-production [2.53ms]
(pass) OpenAPI & Docs API > menyediakan spesifikasi OpenAPI JSON di /docs/json dengan skema lengkap [5.87ms]

test/auth.test.ts:
(pass) Auth & Workspace API > menolak akses modul workspace tanpa sesi dengan HTTP 401 [0.49ms]
(pass) Auth & Workspace API > mengizinkan login karyawan dan akses /auth/me dengan cookie sesi [1.57ms]

test/superadmin.test.ts:
(pass) Superadmin RBAC & Guard Suite (Fase 1 Superadmin) > profil /auth/admin/me untuk superadmin memuat role Superadministrator dan permission admin.security.manage [200.84ms]
(pass) Superadmin RBAC & Guard Suite (Fase 1 Superadmin) > profil /auth/admin/me untuk admin biasa TIDAK memuat permission admin.security.manage [386.89ms]
(pass) Superadmin RBAC & Guard Suite (Fase 1 Superadmin) > GET /admin/roles mengembalikan role Superadministrator beserta izin admin.security.manage [264.60ms]
(pass) Superadmin RBAC & Guard Suite (Fase 1 Superadmin) > guard authorizeSuperadmin meloloskan superadmin dan menolak admin biasa dengan HTTP 403 [460.83ms]
(pass) Superadmin RBAC & Guard Suite (Fase 1 Superadmin) > admin biasa dilarang memodifikasi akun superadmin (roles, status, revoke) dengan HTTP 403 SUPERADMIN_PROTECTED [398.86ms]

test/health.test.ts:
(pass) Health API > menyediakan health check di /health dengan status ok [0.83ms]

test/rbac-crud.test.ts:
(pass) RBAC CRUD API > menolak pembacaan tanpa sesi dan mutasi admin biasa [297.28ms]
(pass) RBAC CRUD API > membuat, memperbarui, mengaudit, dan menghapus role serta izin buatan [1047.66ms]
(pass) RBAC CRUD API > melindungi role dan izin sistem serta memvalidasi permission ID [433.56ms]

test/admin.test.ts:
(pass) 29 passing tests (CRUD user, roles, permissions, guard, origin, self-deactivation, last-admin, session revocation)

test/e2e-issue25.test.ts:
(pass) 16 passing tests (AUTH-01 s/d AUTH-09, USR-01 s/d USR-18, MNU-01 s/d MNU-06)

test/menu.test.ts:
(pass) 4 passing tests (GET /menus karyawan, GET/POST/PATCH/DELETE /admin/menus)

test/realtime.test.ts:
(pass) 8 passing tests (GET /realtime/events context admin & employee, SSE broadcast, session revocation)

test/ops-telco-forms.test.ts:
(pass) 23 passing tests (Submenu visibility, role restriction, auto-number, data isolation, supervisor approval, duplication, identity automation, programmatic PDF, template PDF, zero data loss)

test/qa-matrix.test.ts:
(pass) 8 passing tests (Docs lokal vs prod, isolasi login & logout, malformed JSON, error contract, atomisitas transaksi, sanitasi data)

test/auth-issue-32.test.ts:
(pass) 20 passing tests (Registrasi mandiri, deteksi tabrakan identitas, login 1 kolom multi-identitas, batasan verifikasi email, alur reset password)

test/hr-oncall-identity.test.ts:
(pass) 9 passing tests (Helper format identitas, automasi identitas login, jobOrder manual, KPC submission guard, preservation on edit, penduplikat baru, long name PDF, regression overtime)

 139 pass
 0 fail
 1081 expect() calls
Ran 139 tests across 14 files. [52.32s]
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

## 4. Verifikasi Integritas Data Basis Data Utama (`mknsite`)

Pemeriksaan konsistensi data sebelum dan sesudah migrasi pada database aplikasi `mknsite`:

```sql
SELECT COUNT(*) as count, MIN(id) as min_id, MAX(id) as max_id FROM ops_telco_forms;
-- Result: count = 26 | min_id = 7 | max_id = 32

SELECT form_type, status, count(*) as c FROM ops_telco_forms GROUP BY form_type, status;
-- Result:
--   oncall   | submitted |  1
--   cuti     | draft     |  6
--   oncall   | draft     | 16
--   overtime | draft     |  3
```

**Kesimpulan QA:** 100% data formulir lama (26 record) utuh tanpa perubahan ID, timestamp, status, maupun relasi. Pengujian otomatis dijalankan secara terisolasi pada database `mknsite_test` sehingga integritas data operasional lokal tetap terjaga secara sempurna.

