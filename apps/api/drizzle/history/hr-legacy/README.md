# Arsip migrasi HR sebelum integrasi PR #35

File di folder ini adalah sejarah branch HR, bukan migrasi aktif. Runner hanya membaca jurnal di `drizzle/meta/_journal.json`; jangan menjalankan arsip secara manual.

Main memperkenalkan migrasi `0003_powerful_puppet_master` setelah branch HR memiliki `0003_new_wraith` dan rekonsiliasi lokal `0004_integrate_main_hr`. Integrasi mempertahankan SQL/snapshot/jurnal resmi main, lalu menghasilkan snapshot baru dan migrasi aktif `0004_hr_portal`. SQL HR lama dipertahankan di sini untuk pengujian upgrade dan penelusuran sejarah.

Gunakan `bun run db:migrate`, bukan `drizzle-kit migrate` langsung. Runner mengunci migrasi per database. Untuk schema PR #35 yang pernah dipasang dengan `db:push`, runner memerlukan catatan baseline `0002`, melengkapi perintah DDL yang belum ada, lalu mencatat hash dan timestamp asli migrasi main. Database baru dan database yang telah menerima migrasi main mengikuti migrator Drizzle biasa. Migrasi HR baru aman dijalankan setelah tabel HR lama dan mempertahankan isinya.

Backup dan uji upgrade pada salinan database target sebelum deployment. Jalur rekonsiliasi ini mengenali schema proyek yang diuji; ini bukan perbaikan otomatis untuk semua bentuk schema manual.
