import React from "react";

export type PortalIconProps = {
  name: string | null | undefined;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
};

export type PresetMenuItem = {
  name: string;
  label: string;
  category: "Operasional" | "Manajemen & HR" | "Keuangan" | "Teknologi & Telco" | "Umum";
  keywords: string;
};

export const PRESET_MENU_ICONS: PresetMenuItem[] = [
  // Operasional & Lapangan
  { name: "radio-tower", label: "Tower Telco", category: "Operasional", keywords: "tower antena pemancar telco seluler radio" },
  { name: "wrench", label: "Kunci Bengkel", category: "Operasional", keywords: "kunci pas bengkel workshop mekanik perbaikan alat" },
  { name: "truck", label: "Truk Armada", category: "Operasional", keywords: "truk mobil armada logistik pengiriman transport kendaraan" },
  { name: "hard-hat", label: "Helm Safety / K3", category: "Operasional", keywords: "helm safety k3 keselamatan kerja lapangan proyek" },
  { name: "folder-kanban", label: "Folder Proyek", category: "Operasional", keywords: "proyek project kanban milestone berkas" },
  { name: "package", label: "Paket / Gudang", category: "Operasional", keywords: "gudang inventaris box kardus stok material barang" },
  { name: "map-pin", label: "Pin Lokasi / Site", category: "Operasional", keywords: "lokasi gps koordinat peta site area" },
  { name: "compass", label: "Kompas / Navigasi", category: "Operasional", keywords: "arah navigasi panduan peta survei lapangan" },
  { name: "camera", label: "Kamera / Foto Site", category: "Operasional", keywords: "foto dokumentasi bukti gambar lapangan lensa" },
  { name: "activity", label: "Aktivitas / Monitoring", category: "Operasional", keywords: "status denyut performa monitoring operasional real time" },

  // Manajemen & HR
  { name: "user-circle", label: "Profil Mandiri", category: "Manajemen & HR", keywords: "profil karyawan pribadi self service akun person" },
  { name: "users", label: "Tim / Karyawan", category: "Manajemen & HR", keywords: "karyawan orang hr people personil tim divisi human" },
  { name: "briefcase", label: "Tas Kerja / Bisnis", category: "Manajemen & HR", keywords: "bisnis kantor eksekutif pimpinan korporat karir" },
  { name: "building", label: "Kantor / Gedung", category: "Manajemen & HR", keywords: "gedung kantor cabang head office divisi unit" },
  { name: "calendar", label: "Kalender / Roster", category: "Manajemen & HR", keywords: "jadwal cuti kalender tanggal shift roster agenda" },
  { name: "clock", label: "Jam / Presensi", category: "Manajemen & HR", keywords: "waktu jam absensi presensi lembur durasi" },
  { name: "clipboard-check", label: "Persetujuan / Tugas", category: "Manajemen & HR", keywords: "approval ceklis checklist formulir persetujuan tugas task" },
  { name: "award", label: "KPI / Penghargaan", category: "Manajemen & HR", keywords: "prestasi kpi reward sertifikat pencapaian medali" },
  { name: "target", label: "Target / Sasaran", category: "Manajemen & HR", keywords: "goal sasaran target kpi capaian panah" },

  // Keuangan & Akuntansi
  { name: "calculator", label: "Kalkulator / Pajak", category: "Keuangan", keywords: "hitung kalkulator pajak hitungan akuntansi angka" },
  { name: "wallet", label: "Dompet / Kas Kecil", category: "Keuangan", keywords: "kas dompet petty cash saldo pengeluaran biaya" },
  { name: "credit-card", label: "Kartu Pembayaran", category: "Keuangan", keywords: "kartu kredit pembayaran transfer perbankan transaksi" },
  { name: "receipt", label: "Kuitansi / Faktur", category: "Keuangan", keywords: "nota kuitansi faktur invoice bukti bayar tagihan" },
  { name: "scale", label: "Timbangan / Legal", category: "Keuangan", keywords: "hukum legal kepatuhan compliance aturan timbangan" },

  // Teknologi & Telco
  { name: "database", label: "Database / Server", category: "Teknologi & Telco", keywords: "database server data sql hosting backend sistem" },
  { name: "cloud", label: "Cloud / Backup", category: "Teknologi & Telco", keywords: "awan cloud drive backup penyimpanan unduh online" },
  { name: "wifi", label: "Sinyal Wi-Fi / Jaringan", category: "Teknologi & Telco", keywords: "wifi internet jaringan hotspot nirkabel koneksi" },
  { name: "cpu", label: "Prosesor / Hardware", category: "Teknologi & Telco", keywords: "chip processor hardware komputer alat it teknologi" },
  { name: "zap", label: "Listrik / Power", category: "Teknologi & Telco", keywords: "daya listrik petir power voltase baterai genset" },
  { name: "globe", label: "Portal Web / Global", category: "Teknologi & Telco", keywords: "web website internet link url situs portal global" },

  // Umum & Dokumen
  { name: "file-text", label: "Dokumen Teks", category: "Umum", keywords: "dokumen berkas surat sop file text formulir" },
  { name: "file-spreadsheet", label: "Spreadsheet / Excel", category: "Umum", keywords: "excel spreadsheet rekap tabel lembar kerja laporan" },
  { name: "chart-bar", label: "Grafik Laporan", category: "Umum", keywords: "laporan analitik chart diagram grafik statistik tren" },
  { name: "search", label: "Pencarian / Audit", category: "Umum", keywords: "cari kaca pembesar periksa temukan filter audit" },
  { name: "shield", label: "Keamanan / Proteksi", category: "Umum", keywords: "keamanan security perisai lindung proteksi guard" },
  { name: "lock", label: "Gembok / Rahasia", category: "Umum", keywords: "kunci gembok privat aman rahasia akses terbatas" },
  { name: "key", label: "Kunci Akses / Lisensi", category: "Umum", keywords: "kunci lisensi token otorisasi izin password" },
  { name: "bell", label: "Notifikasi / Lonceng", category: "Umum", keywords: "lonceng pengumuman pemberitahuan notif reminder" },
  { name: "mail", label: "Surat / Email", category: "Umum", keywords: "surat email amplop kirim pesan kotak masuk inbox" },
  { name: "phone", label: "Telepon / Kontak", category: "Umum", keywords: "telepon panggilan kontak customer service hubungi cs" },
  { name: "settings", label: "Pengaturan Sistem", category: "Umum", keywords: "pengaturan konfigurasi gear gerigi sistem preferensi" },
  { name: "printer", label: "Printer / Cetak", category: "Umum", keywords: "cetak printer surat jalan fisik print dokumen" },
  { name: "help-circle", label: "Bantuan / Tanya Jawab", category: "Umum", keywords: "bantuan faq tanya pusat informasi panduan info" },
  { name: "check-circle", label: "Selesai / Sukses", category: "Umum", keywords: "sukses centang verifikasi selesai valid benar" }
];

const ICON_COLORS: Record<string, string> = {
  "user-circle": "#ea580c",
  users: "#4f46e5",
  briefcase: "#0284c7",
  "radio-tower": "#0d9488",
  wrench: "#d97706",
  "folder-kanban": "#10b981",
  "chart-bar": "#7c3aed",
  shield: "#dc2626",
  search: "#0284c7",
  "file-text": "#64748b",
  calculator: "#059669",
  scale: "#b45309",
  settings: "#475569",
  "clipboard-check": "#0891b2",
  truck: "#ea580c",
  "hard-hat": "#f59e0b",
  building: "#3b82f6",
  database: "#6366f1",
  cloud: "#06b6d4",
  wifi: "#14b8a6",
  phone: "#10b981",
  mail: "#8b5cf6",
  bell: "#f97316",
  package: "#84cc16",
  "map-pin": "#ef4444",
  compass: "#0284c7",
  wallet: "#10b981",
  "credit-card": "#3b82f6",
  receipt: "#6366f1",
  cpu: "#64748b",
  zap: "#eab308",
  calendar: "#0ea5e9",
  clock: "#f59e0b",
  award: "#eab308",
  target: "#ef4444",
  layers: "#8b5cf6",
  activity: "#ec4899",
  printer: "#64748b",
  camera: "#0284c7",
  key: "#d97706",
  lock: "#dc2626",
  "help-circle": "#0ea5e9",
  "file-spreadsheet": "#10b981",
  globe: "#0284c7",
  "check-circle": "#16a34a"
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function resolveIconSrc(src: string): string {
  if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:")) {
    return src;
  }
  if (src.startsWith("/")) {
    return `${API_URL}${src}`;
  }
  return src;
}

export function PortalIcon({ name, size = 64, className, style }: PortalIconProps) {
  const iconStr = (name || "").trim();

  // 1. Kasus Custom Image URL (Upload PNG, JPG, WebP, SVG via URL, atau Data URL)
  if (
    iconStr.startsWith("/") ||
    iconStr.startsWith("http://") ||
    iconStr.startsWith("https://") ||
    iconStr.startsWith("data:image/")
  ) {
    const fullSrc = resolveIconSrc(iconStr);
    return (
      <img
        src={fullSrc}
        alt=""
        width={size}
        height={size}
        className={className}
        style={{
          width: size,
          height: size,
          maxWidth: "100%",
          maxHeight: "100%",
          objectFit: "contain",
          display: "inline-block",
          verticalAlign: "middle",
          ...style
        }}
        loading="lazy"
      />
    );
  }

  // 2. Kasus Raw SVG String (<svg ...> ... </svg>)
  if (iconStr.startsWith("<svg") && iconStr.includes("</svg>")) {
    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          ...style
        }}
        dangerouslySetInnerHTML={{ __html: iconStr }}
        aria-hidden="true"
      />
    );
  }

  // 3. Preset Vector Icons
  const iconColor = style?.color || ICON_COLORS[iconStr] || "currentColor";
  const iconProps = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.75",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    style: { color: iconColor, ...style },
    "aria-hidden": true
  };

  switch (iconStr) {
    case "user-circle":
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="10" r="3" />
          <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662" />
        </svg>
      );
    case "users":
      return (
        <svg {...iconProps}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "briefcase":
      return (
        <svg {...iconProps}>
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      );
    case "radio-tower":
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="8" r="2" />
          <path d="M4.93 19 12 4l7.07 15" />
          <path d="M7.5 14h9" />
          <path d="M12 8v13" />
        </svg>
      );
    case "wrench":
      return (
        <svg {...iconProps}>
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      );
    case "folder-kanban":
      return (
        <svg {...iconProps}>
          <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
          <path d="M8 10v4" />
          <path d="M12 10v2" />
          <path d="M16 10v6" />
        </svg>
      );
    case "chart-bar":
      return (
        <svg {...iconProps}>
          <line x1="12" y1="20" x2="12" y2="10" />
          <line x1="18" y1="20" x2="18" y2="4" />
          <line x1="6" y1="20" x2="6" y2="16" />
          <line x1="3" y1="20" x2="21" y2="20" />
        </svg>
      );
    case "shield":
      return (
        <svg {...iconProps}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case "search":
      return (
        <svg {...iconProps}>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      );
    case "file-text":
      return (
        <svg {...iconProps}>
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <line x1="10" y1="9" x2="8" y2="9" />
        </svg>
      );
    case "calculator":
      return (
        <svg {...iconProps}>
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <line x1="8" y1="6" x2="16" y2="6" />
          <line x1="16" y1="14" x2="16" y2="18" />
          <path d="M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01" />
        </svg>
      );
    case "scale":
      return (
        <svg {...iconProps}>
          <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1ZM2 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1ZM7 21h10M12 3v18M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
        </svg>
      );
    case "settings":
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
    case "clipboard-check":
      return (
        <svg {...iconProps}>
          <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <path d="m9 14 2 2 4-4" />
        </svg>
      );
    case "truck":
      return (
        <svg {...iconProps}>
          <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
          <path d="M15 18H9" />
          <path d="M19 18h2a1 1 0 0 0 1-1v-5l-3-4h-5v10" />
          <circle cx="7" cy="18" r="2" />
          <circle cx="17" cy="18" r="2" />
        </svg>
      );
    case "hard-hat":
      return (
        <svg {...iconProps}>
          <path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v2z" />
          <path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5" />
          <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
        </svg>
      );
    case "building":
      return (
        <svg {...iconProps}>
          <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
          <path d="M9 22v-4h6v4" />
          <path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" />
        </svg>
      );
    case "database":
      return (
        <svg {...iconProps}>
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
        </svg>
      );
    case "cloud":
      return (
        <svg {...iconProps}>
          <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
        </svg>
      );
    case "wifi":
      return (
        <svg {...iconProps}>
          <path d="M12 20h.01" />
          <path d="M2 8.82a15 15 0 0 1 20 0" />
          <path d="M5 12.859a10 10 0 0 1 14 0" />
          <path d="M8.5 16.429a5 5 0 0 1 7 0" />
        </svg>
      );
    case "phone":
      return (
        <svg {...iconProps}>
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
      );
    case "mail":
      return (
        <svg {...iconProps}>
          <rect width="20" height="16" x="2" y="4" rx="2" />
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
      );
    case "bell":
      return (
        <svg {...iconProps}>
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
      );
    case "package":
      return (
        <svg {...iconProps}>
          <path d="m16.5 9.4 4.5-2.8a2 2 0 0 0 0-3.4L13.5 1.2a2 2 0 0 0-2 0L4 5.2a2 2 0 0 0 0 3.4l4.5 2.8" />
          <path d="m12 12.5 8.5-5.3V17a2 2 0 0 1-1 1.7L13 22.5a2 2 0 0 1-2 0L4.5 18.7a2 2 0 0 1-1-1.7V7.2l8.5 5.3Z" />
          <path d="M12 22.5V12.5" />
        </svg>
      );
    case "map-pin":
      return (
        <svg {...iconProps}>
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      );
    case "compass":
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="10" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </svg>
      );
    case "wallet":
      return (
        <svg {...iconProps}>
          <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
          <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
        </svg>
      );
    case "credit-card":
      return (
        <svg {...iconProps}>
          <rect width="20" height="14" x="2" y="5" rx="2" />
          <line x1="2" x2="22" y1="10" y2="10" />
        </svg>
      );
    case "receipt":
      return (
        <svg {...iconProps}>
          <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z" />
          <path d="M8 7h8M8 11h8M8 15h5" />
        </svg>
      );
    case "cpu":
      return (
        <svg {...iconProps}>
          <rect width="16" height="16" x="4" y="4" rx="2" />
          <rect width="6" height="6" x="9" y="9" rx="1" />
          <path d="M15 2v2M9 2v2M20 15h2M20 9h2M9 20v2M15 20v2M2 9h2M2 15h2" />
        </svg>
      );
    case "zap":
      return (
        <svg {...iconProps}>
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...iconProps}>
          <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
          <line x1="16" x2="16" y1="2" y2="6" />
          <line x1="8" x2="8" y1="2" y2="6" />
          <line x1="3" x2="21" y1="10" y2="10" />
        </svg>
      );
    case "clock":
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case "award":
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="8" r="6" />
          <path d="m15.477 12.89 2.523 8.11-6-4-6 4 2.523-8.11" />
        </svg>
      );
    case "target":
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      );
    case "layers":
      return (
        <svg {...iconProps}>
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
      );
    case "activity":
      return (
        <svg {...iconProps}>
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      );
    case "printer":
      return (
        <svg {...iconProps}>
          <polyline points="6 9 6 2 18 2 18 9" />
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
          <rect width="12" height="8" x="6" y="14" />
        </svg>
      );
    case "camera":
      return (
        <svg {...iconProps}>
          <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
          <circle cx="12" cy="13" r="3" />
        </svg>
      );
    case "key":
      return (
        <svg {...iconProps}>
          <path d="m21 2-2 2m-1.5 1.5L14 9l-2-2-4 4 2 2-3 3-2-2-2 2a4.95 4.95 0 0 1 0-7 4.95 4.95 0 0 1 7 0l2-2" />
          <circle cx="7.5" cy="16.5" r="1.5" />
        </svg>
      );
    case "lock":
      return (
        <svg {...iconProps}>
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      );
    case "help-circle":
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case "file-spreadsheet":
      return (
        <svg {...iconProps}>
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="M8 13h8M8 17h8M12 13v8" />
        </svg>
      );
    case "globe":
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="10" />
          <line x1="2" x2="22" y1="12" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      );
    case "check-circle":
      return (
        <svg {...iconProps}>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );
    default:
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      );
  }
}
