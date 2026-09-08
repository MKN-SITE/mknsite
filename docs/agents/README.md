# Panduan Agen MKN Site

Paket ini mendefinisikan empat peran engineering dengan tanggung jawab, standar kualitas, dan hasil kerja yang dapat diperiksa. Instruksi peran adalah pedoman kerja; hasilnya tetap harus dibuktikan melalui review dan pengujian.

## Konteks produk

Proyek repository ini adalah **MKN Site**: halaman publik, portal HR, OPS Telco, OPS Workshop, PRJ Project, dan administrasi berbasis RBAC. Stack: Next.js/React, Bun/Elysia, Drizzle/MySQL, Better Auth session, dan SSE. Target deployment: frontend Vercel, backend Coolify dengan Cloudflare.

Nama Enterprise FMS pada dokumen awal berasal dari contoh pencatatan sebelumnya. Pedoman agen ini menggunakan MKN Site sesuai repository. Bila dipakai untuk FMS atau proyek lain, ubah konteks produk dan stack secara eksplisit sebelum menjalankan tugas.

## Pilih peran

| Peran | Tanggung jawab utama | Area kerja |
|---|---|---|
| [Frontend Agent](frontend-agent.md) | Antarmuka, aksesibilitas, integrasi API | apps/web |
| [Backend Agent](backend-agent.md) | Kontrak API, otorisasi, data, realtime | apps/api |
| [QA Agent](qa-agent.md) | Pengujian berbasis risiko dan laporan bukti | Test, laporan QA |
| [Agent-log](agent-log.md) | Riwayat pengembangan yang akurat | docs/CHANGELOG.md |

Semua peran wajib membaca [standar kerja bersama](working-agreement.md). Lihat [contoh penggunaan](examples.md) untuk prompt siap salin, tugas lintas peran, dan format laporan.

## Cara menjalankan

1. Buka task pada repository yang sama dan minta agen membaca standar bersama serta dokumen perannya.
2. Berikan tujuan, cakupan file, kriteria penerimaan, dan batasan.
3. Periksa hasil serah terima beserta bukti uji.
4. Minta QA memverifikasi perilaku penting, lalu agent-log mencatat hasil aktual.

Jika agen tidak memiliki akses file, salin seluruh standar bersama dan dokumen peran ke percakapan. Dokumen ini tidak otomatis membuat proses agen berjalan atau menjamin suatu platform membacanya.

## Urutan kolaborasi

Sepakati kebutuhan dan kontrak API, kerjakan backend dan frontend sesuai kontrak, jalankan QA, perbaiki temuan, verifikasi ulang area terdampak, lalu catat hasil. Frontend dapat bekerja dengan fixture yang diberi label selama API belum tersedia; integrasi baru dinyatakan selesai setelah API nyata diuji.

Jika pengguna meminta pekerjaan paralel, bagi kepemilikan file terlebih dahulu. Tetapkan satu agen sebagai pengintegrasi. Perubahan pada file bersama perlu dikoordinasikan agar pekerjaan anggota lain tidak tertimpa.
