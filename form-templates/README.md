# Master Form Templates

Folder ini menyimpan PDF baku yang menjadi acuan pembuatan formulir digital MKN Site.

## Struktur

- `ops-telco/technician/oncall/` — PDF master & workbook Form Oncall (sebagai arsip/referensi).
- `ops-telco/technician/overtime/` — PDF master Form Overtime.
- `ops-telco/technician/cuti/` — PDF master Form Cuti.

## Cara menambahkan dokumen

1. Simpan PDF asli pada subfolder yang sesuai.
2. Gunakan nama singkat dengan nomor versi, misalnya `form-oncall-v1.pdf`.
3. Jangan menimpa PDF versi lama. Tambahkan versi baru agar perubahan format dapat dilacak.
4. Jika tersedia, sertakan satu PDF kosong dan satu contoh PDF yang sudah diisi.

File di dalam folder ini adalah dokumen acuan. Untuk Form Overtime dan Form Cuti, aplikasi memakai PDF asli sebagai latar tetap lalu menambahkan nilai isian pada koordinat yang sudah dipetakan. Khusus Form Oncall, file master disimpan sebagai arsip/referensi sementara generator PDF Oncall membuat dokumen secara programatik murni tanpa latar belakang master dan tanpa field Total Jam.

Ketiga formulir dipetakan untuk menentukan:

- daftar kolom dan tipe input;
- aturan nomor job Oncall atau Overtime (manual input pada Oncall dengan fallback nomor otomatis OC);
- data karyawan yang diisi otomatis (format `Nama - ID KPC`);
- supervisor otomatis (`Rahmansyah - Z110779` pada Oncall);
- kolom persetujuan dan tanda tangan;
- bagian yang dapat diduplikasi untuk teknisi lain;
- posisi teks pada PDF hasil akhir.

Workbook Excel di setiap subfolder dipertahankan sebagai dasar struktur kolom dan konfigurasi awal. Hasil PDF dibuat dari tombol **Unduh PDF** pada formulir yang sudah tersimpan.
