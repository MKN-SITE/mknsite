import { eq, inArray, like, ne, notInArray } from "drizzle-orm";
import { db, pool } from ".";
import { authAccounts, authUsers, divisions, menus, permissions, rolePermissions, roles, userRoles, users } from "./schema";

// Izin sistem: Dashboard, HR, OPS Telco, dan Administrasi
const permissionRows = [
  ["Lihat dashboard", "dashboard.view"],
  ["Lihat HR", "hr.view"],
  ["Kelola HR", "hr.manage"],
  ["Lihat OPS Telco", "ops_telco.view"],
  ["Lihat penugasan job", "ops_telco.job_assignment.view"],
  ["Kelola jadwal oncall", "ops_telco.schedule.manage"],
  ["Lihat formulir PTO", "ops_telco.pto.view"],
  ["Lihat jadwal oncall", "ops_telco.schedule.view"],
  ["Lihat auto report WAG", "ops_telco.wag_report.view"],
  ["Lihat estimasi dan quotation", "ops_telco.estimate.view"],
  ["Lihat dokumentasi pekerjaan", "ops_telco.documentation.view"],
  ["Kelola sistem", "admin.manage"],
  ["Kelola keamanan sistem", "admin.security.manage"]
] as const;

// Role sistem: HR, Supervisor Telco, Teknisi Telco, Administrator, dan Superadministrator
const roleRows = [
  ["HR", "hr", ["dashboard.view", "hr.view", "hr.manage"]],
  ["Supervisor OPS Telco", "ops-telco-supervisor", [
    "dashboard.view",
    "ops_telco.view",
    "ops_telco.job_assignment.view",
    "ops_telco.schedule.manage",
    "ops_telco.pto.view",
    "ops_telco.schedule.view",
    "ops_telco.wag_report.view",
    "ops_telco.estimate.view",
    "ops_telco.documentation.view"
  ]],
  ["Teknisi OPS Telco", "ops-telco-technician", [
    "dashboard.view",
    "ops_telco.view",
    "ops_telco.schedule.view",
    "ops_telco.wag_report.view",
    "ops_telco.estimate.view",
    "ops_telco.documentation.view"
  ]],
  ["Administrator", "administrator", ["dashboard.view", "admin.manage"]],
  ["Superadministrator", "superadmin", ["dashboard.view", "admin.manage", "admin.security.manage"]]
] as const;

// Akun kredensial utama sistem
const accounts = [
  ["System Administrator", "admin@mknsite.online", "admin", "administrator", "Teknologi Informasi"],
  ["Super Administrator", "superadmin@mknsite.online", "admin", "superadmin", "Direksi / Eksekutif"]
] as const;

// Divisi pokok perusahaan
const defaultDivisions = [
  ["Direksi / Eksekutif", "Dewan pimpinan eksekutif dan direksi perusahaan"],
  ["Teknologi Informasi", "Infrastruktur IT, pengembangan sistem, dan keamanan siber"],
  ["Human Resources", "Pengelolaan sumber daya manusia, kepersonaliaan, dan budaya kerja"],
  ["Operasional Telekomunikasi", "Layanan operasional telekomunikasi, jaringan, dan teknis lapangan"]
] as const;

async function seed() {
  console.log("Memulai seeding MKN Site (Admin, Superadmin, HR & OPS Telco)...");

  // 1. Bersihkan akun legacy berdomain @mknsite.id jika masih tertinggal
  await db.delete(users).where(like(users.email, "%@mknsite.id"));

  // 2. Bersihkan akun dummy non-resmi agar hanya akun admin & superadmin yang ada
  const dummyEmails = [
    "telco@mknsite.online",
    "workshop@mknsite.online",
    "project@mknsite.online",
    "manager@mknsite.online"
  ];
  for (const email of dummyEmails) {
    await db.delete(users).where(eq(users.email, email));
  }

  // 3. Sinkronkan Menu Utama (HR dan OPS Telco) secara idempoten tanpa menghapus menu lain buatan Admin
  const defaultMenus = [
    {
      title: "HR",
      icon: "users",
      description: "Pengelolaan Absensi, Cuti, dan Data Karyawan",
      url: "/portal/hr",
      requiredPermission: "hr.view",
      sortOrder: 1,
      isActive: 1,
      badgeCount: 0,
      badgeColor: "orange"
    },
    {
      title: "OPS Telco",
      icon: "radio",
      description: "Operasional Telekomunikasi dan Layanan Teknis Lapangan",
      url: "/portal/ops-telco",
      requiredPermission: "ops_telco.view",
      sortOrder: 2,
      isActive: 1,
      badgeCount: 0,
      badgeColor: "blue"
    }
  ];

  for (const menuData of defaultMenus) {
    const [existingMenu] = await db.select().from(menus).where(eq(menus.url, menuData.url)).limit(1);
    if (!existingMenu) {
      await db.insert(menus).values(menuData);
      console.log(`  ✓ Menu ${menuData.title} (${menuData.url}) berhasil dibuat.`);
    } else {
      await db.update(menus).set(menuData).where(eq(menus.id, existingMenu.id));
      console.log(`  ✓ Menu ${menuData.title} (${menuData.url}) berhasil disinkronkan.`);
    }
  }

  // 4. Sinkronkan permission & role yang diizinkan (idempoten, tidak menghapus role custom admin)
  for (const [name, slug] of permissionRows) {
    await db.insert(permissions).values({ name, slug }).onDuplicateKeyUpdate({ set: { name } });
  }
  for (const [name, slug] of roleRows) {
    await db.insert(roles).values({ name, slug }).onDuplicateKeyUpdate({ set: { name } });
  }

  const allPermissions = await db.select().from(permissions);
  const allRoles = await db.select().from(roles);
  for (const [, roleSlug, grants] of roleRows) {
    const role = allRoles.find((item) => item.slug === roleSlug);
    if (!role) continue;
    for (const grant of grants) {
      const permission = allPermissions.find((item) => item.slug === grant);
      if (!permission) continue;
      await db.insert(rolePermissions).values({ roleId: role.id, permissionId: permission.id }).onDuplicateKeyUpdate({ set: { roleId: role.id } });
    }
  }

  // 7. Seed akun admin & superadmin
  const adminHash = await Bun.password.hash("admin12345", { algorithm: "argon2id" });
  const superadminHash = await Bun.password.hash("superadmin12345", { algorithm: "argon2id" });
  for (const [name, email, accountType, roleSlug, division] of accounts) {
    const loginHash = email === "superadmin@mknsite.online" ? superadminHash : adminHash;
    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    let accountId: number;

    if (existing) {
      console.log(`  → Akun ${email} sudah ada (id=${existing.id}), memastikan integritas auth...`);
      accountId = existing.id;
      if (!existing.division) {
        await db.update(users).set({ division }).where(eq(users.id, existing.id));
      }
    } else {
      await db.insert(users).values({ name, email, accountType, division, passwordHash: loginHash });
      const [account] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      accountId = account.id;
      console.log(`  ✓ Akun ${email} berhasil dibuat di tabel users.`);
    }

    // Pastikan role tetap terpasang
    const role = allRoles.find((item) => item.slug === roleSlug);
    if (role) {
      await db.insert(userRoles).values({ userId: accountId, roleId: role.id }).onDuplicateKeyUpdate({ set: { roleId: role.id } });
    }

    // Pastikan Better Auth auth_user & auth_account ada
    const [existingAuthUser] = await db.select().from(authUsers).where(eq(authUsers.email, email)).limit(1);
    let authUserId: string;

    if (!existingAuthUser) {
      authUserId = crypto.randomUUID();
      await db.insert(authUsers).values({ id: authUserId, mknUserId: accountId, name, email, emailVerified: true });
      console.log(`  ✓ Akun ${email} berhasil didaftarkan ke Better Auth (auth_user).`);
    } else {
      authUserId = existingAuthUser.id;
      if (!existingAuthUser.mknUserId) {
        await db.update(authUsers).set({ mknUserId: accountId }).where(eq(authUsers.id, authUserId));
      }
    }

    const [existingAuthAccount] = await db.select().from(authAccounts).where(eq(authAccounts.userId, authUserId)).limit(1);
    if (!existingAuthAccount) {
      await db.insert(authAccounts).values({
        id: crypto.randomUUID(), accountId: authUserId, providerId: "credential", userId: authUserId, password: loginHash
      });
      console.log(`  ✓ Kredensial ${email} berhasil didaftarkan ke Better Auth (auth_account).`);
    }
  }

  // 8. Seed default divisions pokok (idempoten)
  for (const [name, description] of defaultDivisions) {
    await db.insert(divisions).values({ name, description }).onDuplicateKeyUpdate({ set: { description } });
  }

  console.log("Seed MKN Site minimal selesai.");
  await pool.end();
}

seed().catch(async (error) => { console.error(error); await pool.end(); process.exit(1); });
