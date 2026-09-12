import { eq, like } from "drizzle-orm";
import { db, pool } from ".";
import { authAccounts, authUsers, divisions, menus, permissions, rolePermissions, roles, userRoles, users } from "./schema";

const defaultMenus = [
  { title: "Self-Service", icon: "user-circle", url: "/portal/self-service", requiredPermission: "dashboard.view", sortOrder: 1 },
  { title: "HR", icon: "users", url: "/portal/hr", requiredPermission: "hr.view", sortOrder: 2 },
  { title: "OPS Telco", icon: "radio-tower", url: "/portal/ops-telco", requiredPermission: "ops_telco.view", sortOrder: 3 },
  { title: "OPS Workshop", icon: "wrench", url: "/portal/ops-workshop", requiredPermission: "ops_workshop.view", sortOrder: 4 },
  { title: "Project", icon: "folder-kanban", url: "/portal/project", requiredPermission: "project.view", sortOrder: 5 }
] as const;


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
  ["Ayu Prameswari", "hr@mknsite.online", "employee", "hr", "Human Resources"],
  ["Rizky Mahendra", "telco@mknsite.online", "employee", "ops-telco", "Telekomunikasi"],
  ["Fajar Nugraha", "workshop@mknsite.online", "employee", "ops-workshop", "Workshop"],
  ["Nadia Kusuma", "project@mknsite.online", "employee", "project", "Project Management"],
  ["Bima Santosa", "manager@mknsite.online", "employee", "manager", "Manajemen & Operasional"],
  ["System Administrator", "admin@mknsite.online", "admin", "administrator", "Teknologi Informasi"],
  ["Super Administrator", "superadmin@mknsite.online", "admin", "superadmin", "Direksi / Eksekutif"]
] as const;

async function seed() {
  // Bersihkan akun legacy berdomain @mknsite.id jika masih tertinggal
  await db.delete(users).where(like(users.email, "%@mknsite.id"));

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

  const passwordHash = await Bun.password.hash("demo12345", { algorithm: "argon2id" });
  const adminHash = await Bun.password.hash("admin12345", { algorithm: "argon2id" });
  const superadminHash = await Bun.password.hash("superadmin12345", { algorithm: "argon2id" });
  for (const [name, email, accountType, roleSlug, division] of accounts) {
    // Cek apakah akun sudah ada — jika sudah, JANGAN timpa password/data
    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing) {
      console.log(`  → Akun ${email} sudah ada (id=${existing.id}), dilewati.`);
      if (!existing.division) {
        await db.update(users).set({ division }).where(eq(users.id, existing.id));
      }
      // Pastikan role tetap terpasang (idempoten, tanpa mengubah data akun)
      const role = allRoles.find((item) => item.slug === roleSlug)!;
      await db.insert(userRoles).values({ userId: existing.id, roleId: role.id }).onDuplicateKeyUpdate({ set: { roleId: role.id } });
      continue;
    }

    // Akun belum ada — buat baru
    const loginHash = email === "superadmin@mknsite.online" ? superadminHash : accountType === "admin" ? adminHash : passwordHash;
    await db.insert(users).values({ name, email, accountType, division, passwordHash: loginHash });
    const [account] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const role = allRoles.find((item) => item.slug === roleSlug)!;
    await db.insert(userRoles).values({ userId: account.id, roleId: role.id }).onDuplicateKeyUpdate({ set: { roleId: role.id } });

    const authUserId = crypto.randomUUID();
    await db.insert(authUsers).values({ id: authUserId, mknUserId: account.id, name, email, emailVerified: true });
    await db.insert(authAccounts).values({
      id: crypto.randomUUID(), accountId: authUserId, providerId: "credential", userId: authUserId, password: loginHash
    });
    console.log(`  ✓ Akun ${email} berhasil dibuat.`);
  }

  // Seed default menus (idempoten)
  const existingMenus = await db.select().from(menus);
  for (const menu of defaultMenus) {
    const found = existingMenus.find((m) => m.url === menu.url);
    if (!found) {
      await db.insert(menus).values({
        title: menu.title,
        icon: menu.icon,
        url: menu.url,
        requiredPermission: menu.requiredPermission,
        sortOrder: menu.sortOrder,
        isActive: 1
      });
      console.log(`  ✓ Menu ${menu.title} berhasil dibuat.`);
    } else {
      console.log(`  → Menu ${menu.title} (${menu.url}) sudah ada, dilewati.`);
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
