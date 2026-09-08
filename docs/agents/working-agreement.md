# Standar Kerja Bersama

## Sikap profesional

Bertindak sebagai spesialis yang bertanggung jawab atas hasil kerja. Jelaskan keputusan menggunakan bukti dari repository, kebutuhan pengguna, dan pengujian. Sampaikan keberatan teknis secara konkret beserta alternatif yang masuk akal. Jangan mengklaim pengalaman pribadi, sertifikasi, atau pengujian yang tidak dilakukan.

## Memulai tugas

- Baca instruksi repository yang berlaku, dokumen peran, dan kode area terdampak.
- Pastikan tujuan serta kriteria penerimaan jelas. Selesaikan pilihan implementasi rutin secara mandiri.
- Nyatakan asumsi yang memengaruhi hasil. Minta klarifikasi bila pilihan mengubah kebutuhan produk secara material.
- Periksa kondisi kerja dan pertahankan perubahan yang sudah ada.
- Verifikasi perilaku kode saat ini; dokumentasi arsitektur bukan bukti bahwa fitur sudah bekerja.

## Menyelesaikan pekerjaan

- Buat perubahan yang terarah, konsisten dengan arsitektur, dan mudah direview.
- Jangan memperluas tugas menjadi migrasi stack, refactor besar, atau deployment tanpa kebutuhan.
- Jaga kontrak antarperan. Catat perubahan request, response, status HTTP, izin, dan event.
- Uji berdasarkan risiko. Bedakan pemeriksaan statis, unit test, integrasi, dan browser.
- Jangan menulis "lulus" untuk pemeriksaan yang belum dijalankan. Catat keterbatasan lingkungan.
- Jangan menyimpan secret, cookie, token, atau data pribadi dalam log dan bukti.
- Perubahan selesai jika kriteria penerimaan terpenuhi, pemeriksaan relevan selesai, dan keterbatasan disampaikan.

## Format brief

```text
ID tugas:
Peran:
Platform agen: [Codex / Antigravity / platform aktual]
Username GitHub pengarah: [terkonfirmasi / belum dikonfirmasi]
Tujuan dan alasan:
Cakupan file/modul:
Kriteria penerimaan:
Kontrak atau dependensi:
Batasan:
Hasil yang diharapkan:
```

## Format serah terima

```text
ID tugas / Peran:
Platform pelaksana / Username GitHub pengarah:
User/Pengarah (nama yang diketahui):
Author Git / commit terkait: [metadata commit atau belum di-commit]
Committer Git jika berbeda / Pelaku push jika relevan:
Status: Selesai | Sebagian | Terblokir
Hasil dan perubahan perilaku:
File yang diubah:
Keputusan serta alasan:
Verifikasi: perintah/skenario, lingkungan, hasil aktual
Keterbatasan atau risiko tersisa:
Tindak lanjut dan penanggung jawab:
Ringkasan untuk agent-log:
```

Status implementasi selesai tidak otomatis berarti siap produksi. Penilaian rilis harus mempertimbangkan integrasi, migrasi, konfigurasi lingkungan, dan temuan QA yang relevan.
