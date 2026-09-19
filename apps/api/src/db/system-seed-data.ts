/**
 * Sumber Tunggal Data Sistem (Single Source of Truth)
 * MKN Site — Permission, Role, Menu, Akun Bootstrap, dan Divisi Bawaan.
 *
 * Seluruh data sistem yang dikelola oleh kode WAJIB didefinisikan di sini.
 * Dilarang menduplikasi daftar role atau permission di modul lain.
 */

export interface SystemPermissionDefinition {
  name: string;
  slug: string;
}

export interface SystemRoleDefinition {
  name: string;
  slug: string;
  permissions: readonly string[];
}

export interface BootstrapAccountDefinition {
  name: string;
  email: string;
  accountType: "admin" | "employee";
  roleSlug: string;
  division: string;
  envPasswordKey: "SEED_ADMIN_PASSWORD" | "SEED_SUPERADMIN_PASSWORD" | "SEED_HR_PASSWORD" | "SEED_123_PASSWORD";
}

export interface SystemMenuDefinition {
  title: string;
  icon: string | null;
  description: string | null;
  url: string;
  requiredPermission: string | null;
  sortOrder: number;
  isActive: number;
  badgeCount: number;
  badgeColor: string;
}

export interface DefaultDivisionDefinition {
  name: string;
  description: string;
}

// 1. Daftar seluruh izin sistem (17 izin resmi)
export const SYSTEM_PERMISSIONS: readonly SystemPermissionDefinition[] = [
  { name: "Lihat dashboard", slug: "dashboard.view" },
  { name: "Lihat HR", slug: "hr.view" },
  { name: "Kelola HR", slug: "hr.manage" },
  { name: "Lihat OPS Telco", slug: "ops_telco.view" },
  { name: "Lihat penugasan job", slug: "ops_telco.job_assignment.view" },
  { name: "Kelola jadwal oncall", slug: "ops_telco.schedule.manage" },
  { name: "Lihat formulir PTO", slug: "ops_telco.pto.view" },
  { name: "Lihat jadwal oncall", slug: "ops_telco.schedule.view" },
  { name: "Lihat auto report WAG", slug: "ops_telco.wag_report.view" },
  { name: "Lihat estimasi dan quotation", slug: "ops_telco.estimate.view" },
  { name: "Lihat dokumentasi pekerjaan", slug: "ops_telco.documentation.view" },
  { name: "Lihat formulir OPS Telco", slug: "ops_telco.forms.view" },
  { name: "Kelola formulir OPS Telco", slug: "ops_telco.forms.manage" },
  { name: "Assign Job Oncall", slug: "ops_telco.oncall.assign" },
  { name: "Approve Form Oncall", slug: "ops_telco.oncall.approve" },
  { name: "Kelola KPI & BAO Report", slug: "ops_telco.kpi.manage" },
  { name: "Lihat IK & SOP", slug: "ik_sop.view" },
  { name: "Kelola IK & SOP", slug: "ik_sop.manage" },
  { name: "Kelola sistem", slug: "admin.manage" },
  { name: "Kelola keamanan sistem", slug: "admin.security.manage" }
] as const;

// 2. Daftar seluruh peran sistem beserta hak akses wajib (6 peran resmi)
export const SYSTEM_ROLES: readonly SystemRoleDefinition[] = [
  {
    name: "HR",
    slug: "hr",
    permissions: ["dashboard.view", "hr.view", "hr.manage", "ik_sop.view"]
  },
  {
    name: "Supervisor OPS Telco",
    slug: "ops-telco-supervisor",
    permissions: [
      "dashboard.view",
      "ops_telco.view",
      "ops_telco.job_assignment.view",
      "ops_telco.schedule.manage",
      "ops_telco.pto.view",
      "ops_telco.schedule.view",
      "ops_telco.wag_report.view",
      "ops_telco.estimate.view",
      "ops_telco.documentation.view",
      "ops_telco.forms.view",
      "ops_telco.forms.manage",
      "ops_telco.oncall.assign",
      "ops_telco.oncall.approve",
      "ops_telco.kpi.manage",
      "ik_sop.view"
    ]
  },
  {
    name: "Teknisi OPS Telco",
    slug: "ops-telco-technician",
    permissions: [
      "dashboard.view",
      "ops_telco.view",
      "ops_telco.schedule.view",
      "ops_telco.wag_report.view",
      "ops_telco.estimate.view",
      "ops_telco.documentation.view",
      "ops_telco.forms.view",
      "ik_sop.view"
    ]
  },
  {
    name: "Karyawan Dasar",
    slug: "employee-basic",
    permissions: [
      "dashboard.view",
      "ops_telco.view",
      "ops_telco.schedule.view",
      "ops_telco.wag_report.view",
      "ops_telco.estimate.view",
      "ops_telco.documentation.view",
      "ops_telco.forms.view",
      "ik_sop.view"
    ]
  },
  {
    name: "Administrator",
    slug: "administrator",
    permissions: ["dashboard.view", "admin.manage", "ops_telco.view", "ik_sop.view", "ik_sop.manage", "ops_telco.kpi.manage"]
  },
  {
    name: "Superadministrator",
    slug: "superadmin",
    permissions: ["dashboard.view", "admin.manage", "admin.security.manage", "ops_telco.view", "ik_sop.view", "ik_sop.manage", "ops_telco.kpi.manage"]
  }
] as const;

// 3. Menu bawaan sistem
export const SYSTEM_MENUS: readonly SystemMenuDefinition[] = [
  {
    title: "OPS Telco",
    icon: "radio-tower",
    description: "Operasional Telekomunikasi dan Layanan Teknis Lapangan",
    url: "/portal/ops-telco",
    requiredPermission: "ops_telco.view",
    sortOrder: 1,
    isActive: 1,
    badgeCount: 0,
    badgeColor: "blue"
  },
  {
    title: "IK & SOP",
    icon: "file-text",
    description: "Instruksi Kerja MKN dan Prosedur Standar KPC",
    url: "/portal/ik-sop",
    requiredPermission: "ik_sop.view",
    sortOrder: 2,
    isActive: 1,
    badgeCount: 0,
    badgeColor: "orange"
  },
  {
    title: "Helpdesk",
    icon: "help-circle",
    description: "Pusat Layanan Bantuan IT, Tiket Gangguan, dan Pelaporan Reason For Outage (RFO)",
    url: "/portal/helpdesk",
    requiredPermission: null,
    sortOrder: 3,
    isActive: 1,
    badgeCount: 0,
    badgeColor: "blue"
  },
  {
    title: "Master Sistem",
    icon: "database",
    description: "Data Master Perusahaan, Aset Operasional, dan Infrastruktur Site",
    url: "/portal/master-sistem",
    requiredPermission: null,
    sortOrder: 4,
    isActive: 1,
    badgeCount: 0,
    badgeColor: "blue"
  },
  {
    title: "LV MKN",
    icon: "truck",
    description: "Monitoring GPS Kendaraan, Laporan Overspeed, dan Masa Berlaku Commissioning LV",
    url: "/portal/lv-mkn",
    requiredPermission: null,
    sortOrder: 5,
    isActive: 1,
    badgeCount: 0,
    badgeColor: "blue"
  },
  {
    title: "Safety",
    icon: "hard-hat",
    description: "Pengurusan Permit KPC, Matrix Training Teknisi, dan Pesan Keselamatan Bulanan",
    url: "/portal/safety",
    requiredPermission: null,
    sortOrder: 6,
    isActive: 1,
    badgeCount: 0,
    badgeColor: "orange"
  }
] as const;

// URL menu lama yang dinonaktifkan tetapi tetap tersimpan
export const DEACTIVATED_SYSTEM_MENU_URLS: readonly string[] = ["/portal/hr"] as const;

// 4. Akun bootstrap awal (HANYA admin, superadmin, dan HR)
// Supervisor dan Teknisi berasal dari pendaftaran mandiri dan penugasan role di Administrasi
export const BOOTSTRAP_ACCOUNTS: readonly BootstrapAccountDefinition[] = [
  {
    name: "System Administrator",
    email: "admin@mknsite.online",
    accountType: "admin",
    roleSlug: "administrator",
    division: "Teknologi Informasi",
    envPasswordKey: "SEED_ADMIN_PASSWORD"
  },
  {
    name: "Super Administrator",
    email: "superadmin@mknsite.online",
    accountType: "admin",
    roleSlug: "superadmin",
    division: "Direksi / Eksekutif",
    envPasswordKey: "SEED_SUPERADMIN_PASSWORD"
  },
  {
    name: "Ayu Prameswari",
    email: "hr@mknsite.online",
    accountType: "employee",
    roleSlug: "hr",
    division: "Human Resources",
    envPasswordKey: "SEED_HR_PASSWORD"
  },
  {
    name: "Rahmansyah",
    email: "123@mknsite.online",
    accountType: "employee",
    roleSlug: "ops-telco-supervisor",
    division: "Operasional Telekomunikasi",
    envPasswordKey: "SEED_123_PASSWORD"
  }
] as const;

// 5. Divisi pokok perusahaan
export const DEFAULT_DIVISIONS: readonly DefaultDivisionDefinition[] = [
  {
    name: "Direksi / Eksekutif",
    description: "Dewan pimpinan eksekutif dan direksi perusahaan"
  },
  {
    name: "Teknologi Informasi",
    description: "Infrastruktur IT, pengembangan sistem, dan keamanan siber"
  },
  {
    name: "Human Resources",
    description: "Pengelolaan sumber daya manusia, kepersonaliaan, dan budaya kerja"
  },
  {
    name: "Operasional Telekomunikasi",
    description: "Layanan operasional telekomunikasi, jaringan, dan teknis lapangan"
  }
] as const;

// 6. Set slug untuk validasi cepat dan perlindungan RBAC
export const SYSTEM_ROLE_SLUGS = new Set<string>(SYSTEM_ROLES.map((r) => r.slug));
export const SYSTEM_PERMISSION_SLUGS = new Set<string>(SYSTEM_PERMISSIONS.map((p) => p.slug));

// Seluruh role dan permission sistem dilindungi dari penghapusan atau pengubahan slug
export const PROTECTED_SYSTEM_ROLES = SYSTEM_ROLE_SLUGS;
export const PROTECTED_SYSTEM_PERMISSIONS = SYSTEM_PERMISSION_SLUGS;
