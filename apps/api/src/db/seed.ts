import { eq, like } from "drizzle-orm";
import { db, pool } from ".";
import { authAccounts, authUsers, divisions, menus, permissions, rolePermissions, roles, userRoles, users } from "./schema";

const permissionRows = [
  ["Lihat dashboard", "dashboard.view"], ["Lihat HR", "hr.view"], ["Kelola HR", "hr.manage"],
  ["Lihat OPS Telco", "ops_telco.view"], ["Kelola OPS Telco", "ops_telco.manage"],
  ["Lihat OPS Workshop", "ops_workshop.view"], ["Kelola OPS Workshop", "ops_workshop.manage"],
  ["Lihat Project", "project.view"], ["Kelola Project", "project.manage"], ["Kelola sistem", "admin.manage"],
  ["Kelola keamanan sistem", "admin.security.manage"]
] as const;

const roleRows = [
  ["HR", "hr", ["dashboard.view", "hr.view", "hr.manage"]],
  ["OPS Telco", "ops-telco", ["dashboard.view", "ops_telco.view", "ops_telco.manage"]],
  ["OPS Workshop", "ops-workshop", ["dashboard.view", "ops_workshop.view", "ops_workshop.manage"]],
  ["PRJ Project", "project", ["dashboard.view", "project.view", "project.manage"]],
  ["Manager", "manager", permissionRows.filter(([, slug]) => slug !== "admin.manage" && slug !== "admin.security.manage").map(([, slug]) => slug)],
  ["Administrator", "administrator", ["dashboard.view", "admin.manage"]],
  ["Superadministrator", "superadmin", ["dashboard.view", "admin.manage", "admin.security.manage"]]
] as const;

const accounts = [
  ["System Administrator", "admin@mknsite.online", "admin", "administrator", "Teknologi Informasi"],
  ["Super Administrator", "superadmin@mknsite.online", "admin", "superadmin", "Direksi / Eksekutif"]
] as const;

async function seed() {
  // Bersihkan akun legacy berdomain @mknsite.id jika masih tertinggal
  await db.delete(users).where(like(users.email, "%@mknsite.id"));

  // Bersihkan akun dummy/demo agar hanya tersisa admin & superadmin
  const dummyEmails = [
    "hr@mknsite.online",
    "telco@mknsite.online",
    "workshop@mknsite.online",
    "project@mknsite.online",
    "manager@mknsite.online"
  ];
  for (const email of dummyEmails) {
    await db.delete(users).where(eq(users.email, email));
  }

  // Bersihkan menu dummy/invalid agar hanya menu HR yang aktif
  const staleMenuUrls = [
    "/hr", // URL cacat warisan PR lama
    "/finance",
    "/portal/self-service",
    "/portal/ops-telco",
    "/portal/ops-workshop",
    "/portal/project",
    "/portal/payroll"
  ];
  for (const url of staleMenuUrls) {
    await db.delete(menus).where(eq(menus.url, url));
  }

  // Seed Menu HR secara idempoten
  const hrMenuData = {
    title: "HR",
    icon: "users",
    description: "Pengelolaan Absensi, Cuti, dan Data Karyawan",
    url: "/portal/hr",
    requiredPermission: "hr.view",
    sortOrder: 1,
    isActive: 1,
    badgeCount: 0,
    badgeColor: "orange"
  };
  const [existingHrMenu] = await db.select().from(menus).where(eq(menus.url, "/portal/hr")).limit(1);
  if (!existingHrMenu) {
    await db.insert(menus).values(hrMenuData);
    console.log("  ✓ Menu HR (/portal/hr) berhasil dibuat.");
  } else {
    await db.update(menus).set(hrMenuData).where(eq(menus.id, existingHrMenu.id));
    console.log("  ✓ Menu HR (/portal/hr) berhasil disinkronkan.");
  }

  for (const [name, slug] of permissionRows) await db.insert(permissions).values({ name, slug }).onDuplicateKeyUpdate({ set: { name } });
  for (const [name, slug] of roleRows) await db.insert(roles).values({ name, slug }).onDuplicateKeyUpdate({ set: { name } });

  const allPermissions = await db.select().from(permissions);
  const allRoles = await db.select().from(roles);
  for (const [, roleSlug, grants] of roleRows) {
    const role = allRoles.find((item) => item.slug === roleSlug)!;
    for (const grant of grants) {
      const permission = allPermissions.find((item) => item.slug === grant)!;
      await db.insert(rolePermissions).values({ roleId: role.id, permissionId: permission.id }).onDuplicateKeyUpdate({ set: { roleId: role.id } });
    }
  }

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
    const role = allRoles.find((item) => item.slug === roleSlug)!;
    await db.insert(userRoles).values({ userId: accountId, roleId: role.id }).onDuplicateKeyUpdate({ set: { roleId: role.id } });

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

  // Seed default divisions (idempoten)
  const defaultDivisions = [
    ["Direksi / Eksekutif", "Dewan pimpinan eksekutif dan direksi perusahaan"],
    ["Teknologi Informasi", "Infrastruktur IT, pengembangan sistem, dan keamanan siber"],
    ["Human Resources", "Pengelolaan sumber daya manusia, kepersonaliaan, dan budaya kerja"],
    ["Telekomunikasi", "Operasional jaringan, infrastruktur telco, dan pemeliharaan site"],
    ["Workshop", "Bengkel fabrikasi, perbaikan mekanik, dan peralatan lapangan"],
    ["Project Management", "Manajemen proyek lapangan, timeline kerja, dan koordinasi site"],
    ["Manajemen & Operasional", "Manajemen umum, kepengawasan, dan operasional harian"],
    ["Keuangan & Akuntansi", "Manajemen keuangan, kas, faktur, dan akuntansi bisnis"],
    ["Logistik & Pengadaan", "Pengadaan barang, logistik material, dan manajemen aset"]
  ] as const;

  for (const [name, description] of defaultDivisions) {
    await db.insert(divisions).values({ name, description }).onDuplicateKeyUpdate({ set: { description } });
  }

  console.log("Seed MKN Site selesai.");
  await pool.end();

}

seed().catch(async (error) => { console.error(error); await pool.end(); process.exit(1); });
