# Contoh Penggunaan Agen

Semua contoh fitur dan laporan di halaman ini adalah **ilustrasi tugas**, bukan pernyataan bahwa fitur sudah diimplementasikan atau pengujian telah lulus. Jalankan prompt pada task yang memiliki akses repository MKN Site.

## Frontend

```text
Baca docs/agents/working-agreement.md dan docs/agents/frontend-agent.md.
Jalankan tugas ini sebagai Frontend Agent.

ID: ADMIN-USERS-01
Tujuan: admin dapat melihat daftar pengguna dan memfilter akun aktif.
Cakupan: apps/web; ikuti instruksi repository yang berlaku.
Kriteria:
- Tersedia pencarian, filter status, loading, empty state, dan error dengan retry.
- Dapat digunakan pada mobile dan dengan keyboard.
- Akses mengikuti sesi admin dan kontrak API yang tersedia.
Periksa kontrak nyata terlebih dahulu. Jika endpoint belum ada, dokumentasikan
kebutuhan backend dan labeli fixture sebagai data contoh.
Serahkan file yang berubah, hasil uji aktual, serta keterbatasan integrasi.
```

## Refactor global CSS dan komponen bersama

```text
Baca docs/agents/working-agreement.md dan docs/agents/frontend-agent.md,
terutama standar wajib CSS dan komponen reusable.
Jalankan tugas ini sebagai Frontend Agent.

Tujuan: merapikan frontend MKN Site dengan global CSS dan komponen reusable.
Cakupan: apps/web; pertahankan perilaku dan identitas visual saat ini.
Audit komponen serta CSS existing terlebih dahulu, lalu:
- Pisahkan token tema ke styles/tokens.css, diimpor oleh app/globals.css.
- Pertahankan reset/base dan aksesibilitas global di globals.css.
- Pindahkan gaya khusus komponen ke CSS Modules secara bertahap.
- Ekstrak pola yang berulang, misalnya Button, Badge, dan PageHeader.
- Migrasikan pemakai agar benar-benar menggunakan komponen bersama tersebut.
- Jaga komponen UI bebas dari fetch dan aturan bisnis.
Kriteria: tampilan dan alur login/portal/admin tidak berubah, typecheck lulus,
dan browser mobile/desktop diperiksa untuk area yang direfactor.
Laporkan bukti aktual dan catat hasil melalui Agent-log.
```

Prompt ini meminta refactor implementasi secara eksplisit. Menambahkan standar ke dokumen agen saja belum mengubah kode frontend.

## Backend

```text
Baca docs/agents/working-agreement.md dan docs/agents/backend-agent.md.
Jalankan tugas ini sebagai Backend Agent.

ID: ADMIN-USERS-01
Tujuan: menyediakan API daftar pengguna untuk halaman admin.
Cakupan: apps/api dan dokumentasi kontrak yang diperlukan.
Kriteria:
- Hanya admin dengan permission admin.manage yang dapat mengakses.
- Pencarian, filter status, dan pagination memiliki input tervalidasi.
- Response tidak memuat password hash, session token, atau secret.
- Ada bukti pengujian untuk admin sah, karyawan, dan request tanpa sesi.
Periksa route existing agar tidak membuat endpoint duplikat.
Dokumentasikan kontrak final untuk Frontend Agent.
```

## QA

```text
Baca docs/agents/working-agreement.md dan docs/agents/qa-agent.md.
Jalankan tugas ini sebagai QA Agent.

ID: ADMIN-USERS-01
Tujuan: verifikasi daftar pengguna admin berdasarkan hasil FE dan BE.
Gunakan lingkungan lokal dan data uji.
Periksa login admin, daftar/filter/pagination, akses karyawan ditolak,
tanpa sesi ditolak, serta response tidak mengandung credential.
Jangan mengubah kode fitur. Laporkan PASS/FAIL/BLOCKED/NOT RUN,
langkah reproduksi, severity, bukti, dan area penanggung jawab.
Jika prasyarat tidak tersedia, sebutkan secara spesifik.
```

## Agent-log

```text
Baca docs/agents/working-agreement.md dan docs/agents/agent-log.md.
Jalankan tugas ini sebagai Agent-log.

Catat aktivitas ADMIN-USERS-01 yang benar-benar selesai di docs/CHANGELOG.md.
Gunakan hasil perubahan dan laporan QA pada task ini sebagai sumber.
Ambil waktu aktual WITA. Cantumkan file serta hasil uji yang terverifikasi.
Catat permintaan User dan pekerjaan Agent pada baris terpisah.
Gunakan Agent (nama platform aktual), lalu cantumkan peran pada deskripsi.
Gunakan username GitHub pengarah yang terkonfirmasi; jika belum diketahui,
tulis User (GitHub belum dikonfirmasi). Jangan menebak dari pemilik remote.
Jika QA belum dijalankan, tulis "QA belum dijalankan".
Jangan memasukkan contoh laporan dari docs/agents/examples.md sebagai bukti.
```

## Satu permintaan untuk alur lintas peran

```text
Gunakan pedoman docs/agents/README.md dan standar kerja bersama.
Implementasikan daftar pengguna admin melalui peran Backend dan Frontend,
lalu lakukan QA dan catat hasil dengan Agent-log.

Sepakati kontrak API terlebih dahulu. Kerjakan tiap peran berurutan,
gunakan format serah terima, dan selesaikan temuan dalam cakupan tugas.
Kriteria: daftar/filter/pagination berfungsi, hanya admin berizin dapat
mengakses, response bebas credential, dan state UI penting tertangani.
```

Satu agen dapat menjalankan peran secara bergantian. Jika menggunakan beberapa agen secara paralel, berikan cakupan file terpisah dan satu pengintegrasi; kontrak harus sudah jelas sebelum integrasi.

## Contoh serah terima

Template berikut diisi dengan hasil nyata setelah pengerjaan.

```text
ID tugas / Peran: ADMIN-USERS-01 / Backend Agent
Platform pelaksana: [platform yang benar-benar mengerjakan]
Username GitHub pengarah: [username terkonfirmasi / belum dikonfirmasi]
User/Pengarah: [nama pengguna yang diketahui]
Author Git / commit: [metadata commit terkait / belum di-commit]
Pelaku push: [pelaku berdasarkan bukti / belum dilakukan]
Status: [Selesai / Sebagian / Terblokir]
Hasil: [Perilaku endpoint yang benar-benar tersedia]
File: [Path yang benar-benar berubah]
Keputusan: [Alasan kontrak atau implementasi]
Verifikasi: [Perintah/skenario, lingkungan, hasil aktual]
Keterbatasan: [Misalnya browser belum diuji]
Tindak lanjut: [Integrasi FE atau perbaikan yang diperlukan]
Untuk agent-log: [Ringkasan faktual]
```

## Contoh baris log

| Waktu (WITA) | Aktor | Deskripsi Aktivitas |
|---|---|---|
| YYYY-MM-DD HH:mm WITA | User (username-github) | [ID tugas] Meminta halaman daftar pengguna admin dengan pencarian dan filter status. |
| YYYY-MM-DD HH:mm WITA | Agent (Codex) | [ID tugas] Peran: Backend Agent; membuat endpoint daftar pengguna; file: path aktual; hasil uji aktual; Pengarah: username-github. |
| YYYY-MM-DD HH:mm WITA | Agent (Antigravity) | [ID tugas] Peran: Frontend Agent; menghubungkan halaman pengguna ke API; file: path aktual; hasil uji aktual; Pengarah: username-github. |
| YYYY-MM-DD HH:mm WITA | Agent (Codex) | [ID tugas] Peran: QA Agent; memverifikasi akses admin dan penolakan karyawan; bukti serta hasil aktual; Pengarah: username-github. |

Ganti placeholder berdasarkan bukti saat pencatatan. Simpan contoh hanya pada panduan ini.

Contoh atribusi pengguna: jika pengguna menyatakan username GitHub-nya `arwan-d3v`, tulis `User (arwan-d3v)`. Nama pada contoh yang ditempel bukan konfirmasi identitas pengguna saat ini.

Dengan format ini, kolom Aktor menjelaskan siapa atau platform apa yang mengerjakan; deskripsi menjelaskan peran agen, lokasi file yang diedit, hasil, dan anggota tim pengarahnya. Agent-log menyimpan semuanya di `docs/CHANGELOG.md`.

## Contoh atribusi author dan pengguna

Ilustrasi format untuk metadata yang sudah tersedia; jangan menganggap author Git sama dengan akun yang melakukan push.

| Waktu (WITA) | Aktor | Deskripsi Aktivitas |
|---|---|---|
| YYYY-MM-DD HH:mm WITA | Agent (Codex) | Peran: Frontend Agent; memperbarui komponen; User/Pengarah: nama pengguna; GitHub: handle terkonfirmasi; Author Git: nama author (hash terkait); hasil uji aktual. |
| YYYY-MM-DD HH:mm WITA | User (nama pengguna) | Melakukan push commit terkait; User/Pengarah: nama pengguna; Author Git: nama author (hash terkait); Pelaku push: nama pengguna, berdasarkan konfirmasi pengguna; GitHub: belum dikonfirmasi. |
| YYYY-MM-DD HH:mm WITA | Agent (Codex) | Memperbarui dokumentasi; User/Pengarah: nama pengguna; GitHub: belum dikonfirmasi; Author Git: belum ada (belum di-commit). |
