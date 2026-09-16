# Master Form Templates

Folder ini menyimpan PDF baku yang menjadi acuan pembuatan formulir digital MKN Site.

## Struktur

- `hr/oncall/` — PDF master Form Oncall.
- `hr/overtime/` — PDF master Form Overtime.
- `hr/cuti/` — PDF master Form Cuti.

## Cara menambahkan dokumen

1. Simpan PDF asli pada subfolder yang sesuai.
2. Gunakan nama singkat dengan nomor versi, misalnya `form-oncall-v1.pdf`.
3. Jangan menimpa PDF versi lama. Tambahkan versi baru agar perubahan format dapat dilacak.
4. Jika tersedia, sertakan satu PDF kosong dan satu contoh PDF yang sudah diisi.

File di dalam folder ini adalah dokumen acuan. Aplikasi memakai PDF asli sebagai latar tetap lalu menambahkan nilai isian pada koordinat yang sudah dipetakan. Master tidak pernah ditimpa, sehingga logo, garis, judul, ukuran kertas, dan elemen tetap lain tetap sama dengan dokumen acuan.

Ketiga template saat ini sudah dipetakan untuk menentukan:

- daftar kolom dan tipe input;
- aturan nomor job Oncall atau Overtime;
- data karyawan yang dapat diisi otomatis;
- kolom persetujuan dan tanda tangan;
- bagian yang dapat diduplikasi untuk teknisi lain;
- posisi teks pada PDF hasil akhir.

Workbook Excel di setiap subfolder dipertahankan sebagai dasar struktur kolom dan konfigurasi awal. Hasil PDF dibuat dari tombol **Unduh PDF** pada formulir yang sudah tersimpan.
