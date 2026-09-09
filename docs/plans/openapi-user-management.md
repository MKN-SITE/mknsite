# Rencana OpenAPI/Swagger dan API Pengaturan Pengguna

Status: **rencana, belum diimplementasikan**. Disusun 2026-09-09 untuk MKN Site berdasarkan kode repository. Dokumen ini tidak mengizinkan deployment, migrasi database produksi, atau push secara otomatis.

## 1. Hasil akhir yang dituju

1. Developer membuka `http://localhost:3001/docs` untuk melihat dan mencoba API HTTP.
2. Spesifikasi tersedia di `/docs/json` untuk frontend, alat pengujian, dan agen.
3. Dokumentasi mencakup Auth, Workspace, Admin, Realtime, serta Error.
4. Admin dapat melihat, membuat, mengubah profil, mengatur role/status, dan mencabut sesi pengguna.
5. Setiap perubahan memiliki validasi, otorisasi, audit log, dan test yang relevan.

**OpenAPI** adalah kontrak API yang bisa dibaca mesin. **Swagger UI** menampilkan kontrak tersebut sebagai halaman interaktif. **Schema** menentukan bentuk input/output. **Session** membuktikan pengguna telah login; **permission** menentukan tindakan yang boleh dilakukan.

Tahap pertama berfokus pada dokumentasi endpoint existing. Fitur pengaturan pengguna dikerjakan sesudahnya, satu tugas kecil per iterasi.

## 2. Kondisi saat ini

| Area | Sudah ada dalam kode | Belum ada / perlu diperiksa |
|---|---|---|
| Health | GET /health | Tidak membuktikan koneksi database |
| Auth | Login, logout, me untuk employee/admin | Schema response lengkap; perilaku endpoint Better Auth yang dipasang langsung |
| Workspace | GET /workspace/:module | Data bisnis masih items kosong |
| Admin | PATCH role dan status pengguna | Daftar, detail, buat, edit profil, daftar role, revoke sesi |
| Realtime | GET /realtime/events, event hub memori | Memilih sesi secara eksplisit, revalidasi sesi, replay |
| Dokumentasi | Panduan deployment | Swagger UI dan spesifikasi OpenAPI |

Temuan dari pembacaan kode, **bukan hasil pengujian runtime**:
- Route admin mengembalikan 403 baik untuk sesi tidak ada maupun permission tidak cukup.
- Login meneruskan Response Better Auth; jangan menganggap hasilnya identik dengan `{ user: profil MKN }` dari /me.
- Penonaktifan akun mengubah isActive tetapi belum menghapus sesi database; akun aktif kembali bisa menggunakan sesi lama.
- Mutation status dan audit belum dalam satu transaksi.
- SSE memilih employee terlebih dahulu jika dua cookie tersedia. Tab admin bisa menerima konteks employee.
- SSE hanya memeriksa autentikasi saat koneksi dibuka; heartbeat menggunakan notification.created dengan pesan keep-alive.
- Hub berada di memori satu proses; tidak ada event ID tersimpan atau replay.
- Password tersimpan sebagai hash pada users dan auth_account; pembuatan/edit pengguna perlu menghindari ketidaksinkronan.
- Terdapat dua mount handler Better Auth; periksa route yang benar-benar terpasang dan jalur yang dapat melewati aturan wrapper.

Jangan menyatakan masalah tersebut sudah diperbaiki hanya karena sudah didokumentasikan.

## 3. Keputusan rancangan

- Pertahankan Bun/Elysia, Drizzle/MySQL, Better Auth, dan pemisahan session admin/karyawan.
- Gunakan generator OpenAPI yang kompatibel dengan versi Elysia terpasang dan Swagger UI. Verifikasi nama package, versi, dan opsi provider dari dokumentasi resmi sebelum install; jangan menyalin API plugin lama tanpa pemeriksaan.
- Metadata/schema route menjadi sumber kontrak; hindari membuat spesifikasi kedua yang harus diedit manual.
- Endpoint yang hanya direncanakan tidak dimasukkan sebagai endpoint aktif ke Swagger.
- Dokumentasi aktif untuk development. Pada production default nonaktif; bila dibutuhkan, UI dan JSON sama-sama harus dibatasi aksesnya.
- MVP administrasi memakai permission existing `admin.manage`; tidak menambah sistem permission baru pada iterasi ini.
- MVP membuat akun employee. Pembuatan admin, perubahan accountType, reset password, undangan email, hard delete, dan CRUD role/permission ditunda.
- Role yang dapat diberikan ke employee tidak boleh memberi `admin.manage`. Backend memvalidasi batas ini, bukan hanya frontend.

## 4. Cakupan OpenAPI

| Tag | Endpoint | Dokumentasi minimum |
|---|---|---|
| Health | GET /health | Contoh response dan keterbatasan health check |
| Auth Employee | POST /auth/login, POST /auth/logout, GET /auth/me | Body, cookie, contoh sukses/gagal, masa berlaku aktual |
| Auth Admin | POST /auth/admin/login, POST /auth/admin/logout, GET /auth/admin/me | Cookie admin, batas accountType, isolasi logout |
| Workspace | GET /workspace/{module} | Enum modul, permission, items masih kosong |
| Admin | PATCH /admin/users/{id}/roles dan /status | Validasi ID/body, hak akses, audit, efek SSE |
| Realtime | GET /realtime/events | text/event-stream, autentikasi, event, reconnect |
| Error | Komponen schema yang dipakai route | Status HTTP, message, code bila tersedia |

Permission modul: hr → hr.view; ops-telco → ops_telco.view; ops-workshop → ops_workshop.view; project → project.view.

Setiap operasi memiliki operationId unik, ringkasan bahasa Indonesia, tag, parameter, schema body, schema response per status, contoh tanpa data pribadi, security requirement, dan efek samping yang relevan.

Endpoint Better Auth yang dipasang langsung harus diinventarisasi. Jangan menganggap mount otomatis muncul lengkap pada generator OpenAPI. MVP menjelaskan endpoint wrapper MKN sebagai antarmuka utama; endpoint library yang tidak didokumentasikan tetap perlu diuji aksesnya, bukan dianggap tersembunyi atau aman.

### Login di Swagger

Definisikan dua security scheme cookie dengan `type: apiKey`, `in: cookie`, dan nama cookie aktual per lingkungan. Verifikasi prefix Secure pada production dari konfigurasi/response, jangan menebak.

Swagger UI tidak dapat menyetel header Cookie secara manual lewat tombol Authorize seperti bearer token. Rencana pengujian:
1. Jalankan docs pada origin API yang sama.
2. Login melalui endpoint /auth yang didokumentasikan; browser menyimpan cookie HttpOnly.
3. Panggil /me dan endpoint privat dengan cookie browser.
4. Uji logout lalu pastikan request berikutnya ditolak.
5. Pastikan origin docs diizinkan secara eksplisit jika Better Auth memerlukannya. Jangan mematikan CSRF atau memakai wildcard demi membuat Swagger bekerja.
6. Gunakan profil browser terpisah saat menguji isolasi akun. Jangan menyimpan password atau token di contoh/spec/localStorage.

Lakukan proof of concept alur ini sebelum mendokumentasikan seluruh API. Jika browser tidak mengirim cookie, periksa origin, credentials, SameSite, Secure, dan trustedOrigins. Jangan mengganti session menjadi JWT sebagai jalan pintas.

### Error

Tahap dokumentasi mencatat hasil aktual. Normalisasi perilaku dilakukan sebagai perubahan terpisah dengan test kompatibilitas frontend.

| Status target | Makna | Contoh |
|---|---|---|
| 400 | JSON/request tidak dapat diproses | Body JSON rusak |
| 401 | Sesi tidak ada/tidak valid atau login salah | Cookie kedaluwarsa |
| 403 | Sudah dikenali tetapi tidak diizinkan; juga kegagalan origin/CSRF | Employee mengakses administrasi |
| 404 | Resource atau modul tidak ditemukan | ID user valid tetapi tidak ada |
| 409 | Konflik data/aturan bisnis | Email duplikat, admin terakhir |
| 422 | Validasi schema gagal | ID negatif, field kosong |
| 429 | Terlalu banyak request, jika limiter aktif | Percobaan login berulang |
| 500 | Kegagalan internal | Pesan umum, tanpa SQL/stack trace |

Target error route MKN baru: `{ "code": "USER_NOT_FOUND", "message": "Pengguna tidak ditemukan." }`.
Tambahkan field validation bila diperlukan tanpa mengembalikan input password. Jangan mengganti seluruh Response Better Auth tanpa mempertahankan Set-Cookie dan statusnya.

## 5. Kontrak API pengaturan pengguna (usulan MVP)

Semua endpoint berikut membutuhkan **sesi admin + admin.manage**. Tanpa sesi admin valid → 401; akun admin tanpa permission → 403. Field tambahan di luar whitelist ditolak.

| Metode dan path | Status | Input utama | Response sukses |
|---|---|---|---|
| GET /admin/users | Baru | page, pageSize, search, status, accountType | 200, data dan pagination |
| GET /admin/users/{id} | Baru | ID integer positif | 200, data UserSummary |
| GET /admin/roles | Baru | Tidak ada | 200, id/name/slug/permissions tiap role |
| POST /admin/users | Baru | name, email, password, roleIds | 201, data UserSummary |
| PATCH /admin/users/{id} | Baru | name dan/atau email | 200, data UserSummary |
| PATCH /admin/users/{id}/roles | Existing, diperkuat | roleIds | 200, success true |
| PATCH /admin/users/{id}/status | Existing, diperkuat | isActive boolean | 200, success true |
| POST /admin/users/{id}/revoke-sessions | Baru | Tanpa body | 200, success true |

UserSummary: id, name, email, accountType, isActive (boolean pada API), roles [{id,name,slug}], createdAt, updatedAt. Semua tanggal response ISO 8601. Jangan mengembalikan passwordHash, auth password, session token, atau credential provider. Existing /auth/me tetap menggunakan kontraknya sendiri.

Daftar: page default 1, pageSize default 20/maksimum 100; search maksimum 100 karakter; status all/active/inactive default all; accountType employee/admin optional. Urutan id descending agar pagination stabil. Response:
```json
{
  "data": [],
  "pagination": { "page": 1, "pageSize": 20, "total": 0, "totalPages": 0 }
}
```
total dihitung setelah filter. Page melewati hasil → array kosong. Ambil role secara batch agar tidak satu query per pengguna.

Create: name trim 1–160, email trim/lowercase maksimum 191 dengan format valid, password 12–128 karakter sebagai usulan kebijakan baru, roleIds unik dan valid. Server menetapkan accountType employee dan isActive true. roleIds kosong diperbolehkan: akun belum memiliki akses modul. Hash password memakai konfigurasi Better Auth yang sama. Kebijakan password create ini tidak mengubah aturan login akun lama.

Edit profil MVP hanya untuk employee, minimal satu field; email unik → 409 saat bentrok. Jangan mengizinkan password, roleIds, isActive, atau accountType melalui endpoint profil.

### Integritas data dan aturan admin

- User MKN, identity Better Auth, credential account, role, dan audit harus konsisten. Gunakan satu service provisioning dengan transaksi yang jelas.
- Engineer berpengalaman terlebih dahulu memvalidasi cara provisioning yang kompatibel dengan Better Auth terpasang. Jangan mengaktifkan signup publik untuk membuat user internal. Jangan menjalankan operasi adapter di koneksi berbeda lalu mengklaim satu transaksi.
- Audit dan sinkronisasi nama/email di kedua tabel dilakukan atomik. Email baru tidak otomatis ditandai verified; verifikasi email dan dampaknya terhadap login harus dijelaskan.
- Hapus kebutuhan hash duplikat melalui migrasi tambahan yang mempertahankan akun existing; jika belum dilakukan, service harus menangani kolom legacy secara eksplisit dan test konsistensinya. Jangan mengubah migrasi lama yang sudah diterapkan.
- MVP menolak perubahan role/status akun admin melalui route pengaturan employee. Dengan batas ini, admin tidak bisa menonaktifkan diri atau menghapus admin terakhir. Pengelolaan lifecycle admin berikutnya memerlukan aturan last-admin yang aman terhadap request bersamaan.
- Nonaktifkan user dan cabut semua sesi milik identity-nya dalam transaksi bersama audit. Aktivasi ulang tidak menghidupkan sesi lama.
- Perubahan email dan role mencabut sesi target sebagai kebijakan MVP agar user login ulang dengan akses terbaru. Dokumentasikan efek ini pada API.
- Revoke sesi tidak menonaktifkan akun; login baru tetap diperbolehkan.
- Emit event sesudah commit. Kegagalan pengiriman event tidak membatalkan perubahan DB; request selanjutnya tetap harus mengecek otorisasi.
- Audit minimal actorId dari sesi admin, action, resource user, resourceId, waktu. Jangan mencatat password/body penuh.
- Uji request bersamaan untuk email duplikat dan perubahan role/status; gunakan constraint dan strategi locking/transaksi yang ditinjau sebelum implementasi.

## 6. SSE dan live update

**Dokumentasi tahap pertama:** jelaskan kondisi existing dengan jujur: connected, access.updated, session.revoked, notification.created (termasuk keep-alive), payload, satu instance, tanpa replay.

**Target setelah perbaikan:**
- `GET /realtime/events?context=employee|admin`; default employee untuk kompatibilitas, UI admin mengirim context=admin. Jangan otomatis berpindah ke cookie lain jika sesi konteks yang diminta tidak valid.
- Event connected: {occurredAt}; heartbeat transport terpisah dari notifikasi bisnis.
- Event access.updated dan session.revoked: {type,message,occurredAt}. Perubahan yang mencabut sesi mengirim session.revoked.
- Event admin.users.updated (baru): {userId,occurredAt}, hanya ke admin berizin untuk menyegarkan daftar; jangan broadcast informasi akun ke employee lain.
- Revalidasi sesi/permission koneksi secara berkala, misalnya tiap heartbeat 25 detik, dan saat event sensitif dikirim. Tutup stream invalid tanpa menunggu pengguna reload.
- Abort/disconnect membersihkan listener/timer; batasi antrean dan tangani client lambat.
- EventSource reconnect otomatis saat gangguan jaringan. Setelah reconnect, frontend fetch ulang data/profil; tidak mengandalkan replay karena belum ada penyimpanan event.
- SSE bukan respons JSON biasa. Swagger memuat kontrak dan contoh; uji streaming menggunakan EventSource atau curl streaming dengan cookie jar lokal. Jangan menjanjikan viewer SSE lengkap di Swagger.
- Multi-instance dengan Redis/broker dan durable replay di luar MVP.

## 7. Urutan tiket kecil

Setiap tiket harus diserahkan dengan file yang berubah, perintah/skenario uji, hasil aktual, dan batasan. Jangan menjalankan semua tiket sekaligus.

| ID | Dependensi | Tugas dan file utama | Kriteria selesai |
|---|---|---|---|
| D01 | Tidak ada | Inventaris route dan response; routes/*.ts, lib/auth.ts; tulis docs/api/current-contract.md | Endpoint/status/cookie aktual tercatat, termasuk mount library |
| D02 | D01 | Pilih/pin plugin; package.json, bun.lock, index.ts; buat docs UI dan JSON | /docs dan /docs/json 200 lokal; production nonaktif secara default |
| D03 | D02 | Schema/tag/error/security untuk Auth, Workspace, Admin | Seluruh route existing tampil; response sesuai runtime; login → me → logout dari browser berhasil |
| D04 | D03 | Dokumentasi SSE dan contoh client di docs/api/realtime.md | Event existing serta keterbatasan tertulis; stream terautentikasi dapat diuji |
| U01 | D03 | Guard admin dan error schema bersama; routes/admin.ts, lib/auth.ts | 401/403 terpisah; CSRF/origin pada mutation teruji; regression wrapper dan mount |
| U02 | U01 | Schema DTO + daftar/detail user dan daftar role | Pagination/filter/field whitelist teruji; tidak ada credential bocor |
| U03 | U02 | Review provisioning, credential legacy, migrasi dan transaksi | Keputusan teknis serta rencana rollback ditulis; test data lama disiapkan sebelum CRUD |
| U04 | U03 | Service create employee dan POST /admin/users | Akun baru bisa login; email duplikat 409; kegagalan transaksi tidak meninggalkan akun parsial |
| U05 | U04 | PATCH profil dan sinkronisasi identity | Nama/email konsisten; field terlarang ditolak; sesi dicabut jika email berubah |
| U06 | U05 | Perkuat PATCH role/status; tambah revoke-sessions | Role valid, admin terlindungi, audit atomik, sesi lama tidak dapat dipakai ulang |
| R01 | U06 | Konteks/revalidasi/cleanup SSE dan admin.users.updated; sesuaikan client SSE | Dua sesi aktif bersamaan benar; revoke/disconnect teruji; admin lain menerima invalidasi sesuai izin |
| Q01 | R01 | QA lengkap dan regresi spec; index.test.ts dan test tambahan | Matriks di bawah lulus atau gap dilaporkan; docs dan kode cocok |
| L01 | Q01 | Panduan developer, deployment docs, changelog | Instruksi dapat diulang; author/user/platform dan hasil aktual dicatat |

D01–D04 boleh menjadi rilis dokumentasi sendiri. Jangan menunggu CRUD selesai untuk menyediakan referensi API existing.

U03 dan bagian keamanan U01/R01 memerlukan review berpengalaman. Agen dengan konteks terbatas boleh mengerjakan tiket tersebut hanya setelah kontrak detail/strategi transaksinya dipastikan; jangan menyuruhnya menebak cara kerja auth.

## 8. Matriks penerimaan QA

| Skenario | Hasil yang harus dibuktikan |
|---|---|
| Docs lokal | UI terbuka, spec valid, operationId unik, tidak ada $ref rusak |
| Docs production default | UI dan JSON tidak tersedia |
| Login employee/admin | Cookie benar, /me sesuai, logout sesi satu tidak menghapus sesi lain |
| Tanpa sesi / salah permission | 401 / 403 sesuai kontrak target |
| User tidak ada / input salah | 404 / 422; malformed JSON sesuai kontrak 400 |
| Dua create email sama | Satu berhasil, satu konflik; tidak ada identity yatim |
| Simulasi kegagalan transaksi | Data dan audit tidak tersimpan sebagian |
| Role salah/duplikat/admin untuk employee | Ditolak sesuai schema dan kebijakan |
| Nonaktif → aktif kembali | Cookie lama tetap ditolak; login baru bisa setelah aktif |
| Edit email | Kedua tabel sinkron; email lama gagal login; sesi lama invalid |
| SSE dua konteks | Tab admin menerima konteks admin, employee menerima miliknya |
| Reconnect/revoke/slow client | Refetch saat reconnect; sesi invalid ditutup; resource dibersihkan |
| Sanitasi | Response dan spec bebas hash, token nyata, serta credential |
| Kompatibilitas | Login/portal/admin existing tetap berfungsi |

Perintah baseline dari root: `bun run check`, `bun --cwd apps/api test`.
Test integrasi harus menggunakan database uji dan mencatat versi/config yang digunakan. Jangan menjalankan seed yang dapat mengubah kredensial pada database tim/produksi. Test existing saja belum mencakup seluruh matriks di atas.

## 9. Prompt siap pakai untuk junior atau agen

```text
Baca docs/agents/working-agreement.md, docs/agents/backend-agent.md,
dan docs/plans/openapi-user-management.md.

Kerjakan hanya tiket D01. Jangan install package atau membuat endpoint baru.
Baca route serta auth yang terkait, lalu dokumentasikan kontrak aktual,
termasuk error, cookie, dan endpoint library yang terpasang.
Bedakan hasil pembacaan kode dengan hasil pengujian runtime.
Output: docs/api/current-contract.md dan laporan gap.
Jangan commit/push kecuali diminta.
```

Untuk tiket berikutnya:
```text
Kerjakan hanya tiket [ID] dari docs/plans/openapi-user-management.md.
Dependensi yang sudah selesai: [ID dan bukti].
Kontrak yang harus diikuti: [tautan dokumen atau schema].
File yang boleh diubah: [daftar sesuai tiket].
Kriteria selesai: [salin baris tiket dan skenario QA terkait].
Jika dependensi belum tersedia, laporkan gap; jangan mengarang kontrak.
Laporkan hasil, file, test aktual, dan risiko tersisa.
```

Satu tiket kecil per task menjaga konteks tetap jelas. Ukuran model tidak menggantikan review untuk session, otorisasi, dan transaksi data.

## 10. Referensi dan batas rencana

- [Elysia OpenAPI](https://elysiajs.com/tutorial/features/openapi/) — integrasi generator kontrak.
- [Swagger cookie authentication](https://swagger.io/docs/specification/v3_0/authentication/cookie-authentication/) — cookie scheme dan batas interaksi browser.
- [Swagger UI limitations](https://swagger.io/docs/open-source-tools/swagger-ui/usage/limitations/) — cookie tidak dapat dikontrol manual seperti header biasa.

Rencana ini belum memasang dependency, membuat endpoint, menjalankan migrasi, atau mengubah frontend. Pilihan provisioning credential dan detail kompatibilitas plugin dipastikan pada tiket yang ditentukan sebelum implementasi lanjut.

