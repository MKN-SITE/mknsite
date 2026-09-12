---
name: MKN Oceanic Executive Portal & Command Admin
colors:
  surface: '#ffffff'
  surface-dim: '#f8fafc'
  surface-bright: '#ffffff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f8fafc'
  surface-container: '#f1f5f9'
  surface-container-high: '#e2e8f0'
  surface-container-highest: '#cbd5e1'
  background: '#ebf1f6'
  on-background: '#0f172a'
  on-surface: '#0f172a'
  on-surface-variant: '#475569'
  outline: '#cbd5e1'
  outline-variant: '#e2e8f0'
  primary: '#0284c7'
  on-primary: '#ffffff'
  primary-container: '#e0f2fe'
  on-primary-container: '#0369a1'
  header-start: '#074674'
  header-mid: '#09598c'
  header-end: '#053c61'
  header-text: '#ffffff'
  header-muted: 'rgba(255, 255, 255, 0.82)'
  header-glass: 'rgba(255, 255, 255, 0.14)'
  header-border: 'rgba(255, 255, 255, 0.18)'
  secondary: '#10b981'
  on-secondary: '#ffffff'
  secondary-container: '#d1fae5'
  on-secondary-container: '#047857'
  tertiary: '#6366f1'
  on-tertiary: '#ffffff'
  tertiary-container: '#e0e7ff'
  on-tertiary-container: '#4338ca'
  warning: '#f59e0b'
  warning-container: '#fef3c7'
  on-warning-container: '#b45309'
  error: '#ef4444'
  error-container: '#fee2e2'
  on-error-container: '#b91c1c'
typography:
  display:
    fontFamily: Plus Jakarta Sans
    fontSize: 2.25rem
    fontWeight: '800'
    lineHeight: 2.75rem
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.75rem
    fontWeight: '800'
    lineHeight: 2.25rem
    letterSpacing: -0.025em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.375rem
    fontWeight: '700'
    lineHeight: 1.875rem
    letterSpacing: -0.02em
  title-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 1rem
    fontWeight: '700'
    lineHeight: 1.5rem
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: 1.625rem
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.5rem
    letterSpacing: 0.005em
  body-sm:
    fontFamily: Inter
    fontSize: 0.8125rem
    fontWeight: '400'
    lineHeight: 1.25rem
    letterSpacing: 0.01em
  label-caps:
    fontFamily: Plus Jakarta Sans
    fontSize: 0.6875rem
    fontWeight: '800'
    lineHeight: 0.875rem
    letterSpacing: 0.12em
  code-mono:
    fontFamily: JetBrains Mono
    fontSize: 0.75rem
    fontWeight: '500'
    lineHeight: 1.125rem
    letterSpacing: 0.03em
rounded:
  xs: 0.375rem
  sm: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.25rem
  canvas: 1.5rem
  full: 9999px
spacing:
  container-max: 1520px
  gutter: 1.75rem
  margin-desktop: 3rem
  margin-mobile: 1.25rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
---

# MKN Oceanic Executive Portal & Command Admin — Sistem Desain Riil

## 1. Visi & Filosofi Desain
Sistem desain ini mencerminkan arsitektur riil **MKN Site (PT Multi Kontrol Nusantara)** yang menggabungkan operasi lapangan telekomunikasi, infrastruktur site, manajemen proyek, dan kontrol keamanan RBAC bertingkat enterprise:
* **Kepercayaan & Ketegasan Korporat:** Warna biru samudera korporat (`#074674` ke `#053c61`) memberikan stabilitas visual dan integritas operasional.
* **Arsitektur Kanvas Lapang (1520px):** Menghilangkan rasa sempit dengan memanfaatkan lebar layar modern secara maksimal (`min(1520px, 94vw)`), bukan mengurung konten dalam kontainer sempit 1200px.
* **Integrasi Telemetri Dinamis Riil:** Ringkasan status di beranda membaca langsung jumlah pengguna aktif, jumlah role terdaftar, modul portal aktif, serta status pengamanan Superadministrator.
* **Presisi Branding Anti-Tumpang-Tindih:** Logo resmi MKN (`Logo MKN.png`) dilindungi dalam kapsul badge putih dengan batas visual kaca 1px dan clearance minimal 26px di atas salam pengguna.

---

## 2. Palet Warna (Color Tokens)

### 2.1 Corporate Ocean (Header & Brand Identity)
* **Header Gradient Start (`#074674`)**: Biru laut dalam korporat utama.
* **Header Gradient Mid (`#09598c`)**: Biru safir cerah pada sudut gradien 135°.
* **Header Gradient End (`#053c61`)**: Biru gelap pekat penjaga kontras teks putih.
* **Ocean Azure Accent (`#0284c7`)**: Aksen primer untuk aksi tombol, link aktif, dan focus ring.
* **Cyan Sky Highlight (`#7dd3fc`)**: Teks kicker/chip di atas header biru ("ADMIN", "RUANG ADMINISTRASI").

### 2.2 Foundation & Canvas Surfaces
* **App Backdrop (`#ebf1f6`)**: Abu-abu kebiruan sejuk (cool gray) yang membuat kanvas tampak melayang.
* **Canvas Sheet (`#ffffff`)**: Lembaran putih tempat seluruh kontrol, tabel, dan kartu berada.
* **Sub-surface Paper (`#f8fafc`)**: Latar belakang bilah ringkasan, sidebar navigasi, dan header tabel.
* **Border Line (`#e2e8f0`)**: Garis batas struktural 1px yang lembut dan nyaman dipandang.

### 2.3 Status & RBAC Indicators
* **Success / Online (`#10b981`)**: Hijau emerald untuk akun aktif, izin verified, dan modul operasional aktif.
* **Warning / Standby (`#f59e0b`)**: Kuning amber untuk notifikasi badge modul dan peringatan sesi.
* **Danger / Restricted (`#ef4444`)**: Merah kirmizi untuk akun nonaktif, aksi pencabutan sesi, dan hapus data.
* **System / Superadmin (`#6366f1`)**: Ungu indigo untuk proteksi Superadministrator dan audit log sistem.

---

## 3. Keadaan Riil Modul & RBAC MKN Site

### 3.1 Modul Riil Portal Karyawan (`/portal`)
1. **Self-Service** (`/portal/self-service`)
   - Ikon: `user-circle` | Izin yang dibutuhkan: `dashboard.view`
   - Deskripsi: Portal mandiri karyawan untuk profil, absensi, dan data personal.
2. **HR** (`/portal/hr`)
   - Ikon: `users` | Izin yang dibutuhkan: `hr.view`
   - Deskripsi: Manajemen personalia, cuti, kehadiran, dan administrasi SDM.
3. **OPS Telco** (`/portal/ops-telco`)
   - Ikon: `radio-tower` | Izin yang dibutuhkan: `ops_telco.view`
   - Deskripsi: Operasi telekomunikasi lapangan, tower site, transmisi antena microwave & BTS.
4. **OPS Workshop** (`/portal/ops-workshop`)
   - Ikon: `wrench` | Izin yang dibutuhkan: `ops_workshop.view`
   - Deskripsi: Pemeliharaan peralatan kerja, servis perangkat, dan inventaris workshop.
5. **Project** (`/portal/project`)
   - Ikon: `folder-kanban` | Izin yang dibutuhkan: `project.view`
   - Deskripsi: Pelacakan progres proyek, penugasan teknisi, dan dokumentasi deliverable.

### 3.2 Matriks Role & Hak Akses Riil
* **Superadministrator** (`superadmin`): Kuasa penuh termasuk otorisasi RBAC sistem (`admin.security.manage`, `admin.manage`, `dashboard.view`). Akun dilindungi guard khusus dari mutasi admin biasa.
* **Administrator** (`administrator`): Pengelolaan operasional sistem MKN (`admin.manage`, `dashboard.view`).
* **Manager** (`manager`): Akses lintas divisi operasional (`dashboard.view`, `hr.view`, `ops_telco.view`, `ops_workshop.view`, `project.view`).
* **HR** (`hr`): Hak kelola divisi SDM (`hr.view`, `hr.manage`).
* **OPS Telco** (`ops-telco`): Hak kelola site telekomunikasi (`ops_telco.view`, `ops_telco.manage`).
* **OPS Workshop** (`ops-workshop`): Hak kelola workshop (`ops_workshop.view`, `ops_workshop.manage`).
* **PRJ Project** (`project`): Hak kelola proyek (`project.view`, `project.manage`).

### 3.3 Struktur Rute Navigasi Riil
* **Portal Karyawan**: `/portal` (Grid modul dinamis sesuai role login).
* **Beranda Admin**: `/admin` (Command home dengan Executive Summary Bar dinamis).
* **User Management Workspace**:
  - `/admin/user-management/users` — Tabel akun pengguna, pencarian nama/email, filter role & status, modal buat user baru, detail modal (edit nama, email, role, toggle aktif, cabut sesi paksa).
  - `/admin/user-management/roles` — Manajemen peran (CRUD Role): Buat role kustom, edit nama/slug/deskripsi, centang izin granular, proteksi role sistem bawaan.
  - `/admin/user-management/permissions` — Katalog izin sistem, pencarian nama/slug, inspeksi role pemilik izin.
* **Menu Portal**: `/admin/menus` — Kelola modul portal karyawan (CRUD Menu): judul, ikon preset SVG, URL, required permission, urutan sortOrder, lencana notifikasi, switch aktif/nonaktif.
* **Pengaturan**: `/admin/settings` — Metadata akun admin, daftar peran & izin, proteksi isolasi sesi.

---

## 4. Sistem Logo & Header (Anti-Overlap System)

```
+-------------------------------------------------------------------------------+
|  [Logo Badge MKN] MKN Site [ADMIN]                     (o) Super Admin v      |
|  PT Multi Kontrol Nusantara                                                   |
+-------------------------------------------------------------------------------+
|  (Garis pembatas kaca 1px: rgba(255, 255, 255, 0.14))                         |
|                                                                               |
|  PORTAL ADMINISTRATOR                                                         |
|  Selamat datang, Super Administrator.                                         |
|  Kelola akun pengguna, hak akses tim, dan pengaturan modul portal MKN.        |
+-------------------------------------------------------------------------------+
```

### 4.1 Spesifikasi Kapsul Logo MKN
* **Wadah Kapsul:**
  - Ukuran: `height: 48px; width: 68px;`
  - Latar: `#ffffff; border-radius: 12px;`
  - Border & Shadow: `1px solid rgba(255, 255, 255, 0.9); box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);`
  - `overflow: hidden;` *(mencegah tumpahan pixel)*.
* **Gambar Logo di Dalam Kapsul:**
  - Sumber aset: `apps/web/public/assets/Logo MKN.png`
  - Properti CSS: `height: 38px !important; width: auto !important; max-width: 100% !important; object-fit: contain !important;`
* **Clearance Margin:**
  - Jarak struktural minimum **26px** di atas blok greeting dengan garis pemisah kaca 1px, memastikan tidak ada tumpang tindih visual pada resolusi mana pun.

---

## 5. Tata Letak Kanvas Luas (Expansive Canvas Architecture)

* **Lebar Maksimal Kontainer:** Ditetapkan pada **`1520px`** (`min(1520px, 94vw)`), mengisi ruang monitor desktop 1080p, 1440p, dan ultrawide secara proporsional.
* **Padding Kontainer:** `40px 48px 56px 48px` pada desktop untuk kenyamanan bernapas elemen.
* **Executive Summary Bar Riil:**
  - **Manajemen Akses**: Menampilkan hitungan pengguna dan role terdaftar secara dinamis via hook API.
  - **Modul Portal**: Menampilkan jumlah modul dinamis aktif yang terintegrasi di portal karyawan.
  - **Keamanan & Audit**: Menampilkan status proteksi akun Superadministrator dan audit logging aktif.
* **Lebar Tabel Minimum:** `860px` pada mode desktop sehingga seluruh kolom data, badge role yang panjang, dan tombol aksi tertata lega tanpa pemotongan huruf yang canggung.

---

## 6. Panduan Prompt untuk Google Stitch (Mengikuti Keadaan Riil)

Saat menginstruksikan Stitch untuk menghasilkan atau memodifikasi layar baru dari dokumen ini:
1. **Gunakan Konteks MKN Riil:** *"Halaman ini adalah bagian dari MKN Enterprise Command Portal untuk PT Multi Kontrol Nusantara."*
2. **Sertakan Modul & Role Riil:** *"Tampilkan modul operasional riil: Self-Service, HR, OPS Telco, OPS Workshop, dan Project; serta role: Superadministrator, Administrator, Manager, HR, OPS Telco, OPS Workshop, Project."*
3. **Patuhi Arsitektur Kanvas Lapang:** *"Gunakan full-bleed oceanic dark-blue header (#074674 ke #053c61) dengan elevated white canvas sheet (radius 24px, lebar 1520px) yang luas membentang di bawahnya."*
4. **Patuhi Aturan Logo:** *"Logo MKN berada di dalam kapsul putih rounded pill yang terisolasi dengan overflow hidden, terpisah rapi dengan garis kaca dari teks greeting di bawahnya."*
5. **Tampilkan Telemetri Dinamis:** *"Sertakan Executive Summary Bar 3 kolom di atas kartu navigasi dengan metrik riil: Manajemen Akses, Modul Portal Aktif, dan Proteksi Keamanan RBAC."*
