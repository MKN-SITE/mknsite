import { eq } from "drizzle-orm";
import { db, pool } from ".";
import { authAccounts, authUsers, divisions, permissions, rolePermissions, roles, userRoles, users } from "./schema";

const permissionRows = [
  ["Lihat dashboard", "dashboard.view"], ["Lihat HR", "hr.view"], ["Kelola HR", "hr.manage"],
  ["Lihat OPS Telco", "ops_telco.view"], ["Kelola OPS Telco", "ops_telco.manage"],
  ["Lihat penugasan job Telco", "ops_telco.job_assignment.view"],
  ["Kelola jadwal oncall Telco", "ops_telco.schedule.manage"],
  ["Lihat Form PTO Telco", "ops_telco.pto.view"],
  ["Lihat jadwal oncall Telco", "ops_telco.schedule.view"],
  ["Lihat auto report WAG Telco", "ops_telco.wag_report.view"],
  ["Lihat estimasi dan quotation Telco", "ops_telco.estimate.view"],
  ["Lihat dokumentasi pekerjaan Telco", "ops_telco.documentation.view"],
  ["Lihat OPS Workshop", "ops_workshop.view"], ["Kelola OPS Workshop", "ops_workshop.manage"],
  ["Lihat Project", "project.view"], ["Kelola Project", "project.manage"], ["Kelola sistem", "admin.manage"],
  ["Kelola keamanan sistem", "admin.security.manage"]
] as const;

const roleRows = [
  ["HR", "hr", ["dashboard.view", "hr.view", "hr.manage"]],
  ["OPS Telco Teknisi", "ops-telco", [
    "dashboard.view", "ops_telco.view", "ops_telco.schedule.view", "ops_telco.wag_report.view",
    "ops_telco.estimate.view", "ops_telco.documentation.view"
  ]],
  ["OPS Telco Supervisor", "ops-telco-supervisor", [
    "dashboard.view", "ops_telco.view", "ops_telco.manage", "ops_telco.job_assignment.view",
    "ops_telco.schedule.manage", "ops_telco.pto.view", "ops_telco.schedule.view", "ops_telco.wag_report.view",
    "ops_telco.estimate.view", "ops_telco.documentation.view"
  ]],
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
  if (process.env.NODE_ENV === "production") throw new Error("Seed akun contoh hanya untuk development/test.");
  // Seed is additive. Existing accounts, menu configuration and RBAC stay owned by Administrasi.
  const existingRoles = new Set((await db.select().from(roles)).map((role) => role.slug));
  for (const [name, slug] of permissionRows) await db.insert(permissions).ignore().values({ name, slug });
  for (const [name, slug] of roleRows) await db.insert(roles).ignore().values({ name, slug });

  const allPermissions = await db.select().from(permissions);
  const allRoles = await db.select().from(roles);
  for (const [, roleSlug, grants] of roleRows) {
    if (existingRoles.has(roleSlug)) continue;
    const role = allRoles.find((item) => item.slug === roleSlug)!;
    for (const grant of grants) {
      const permission = allPermissions.find((item) => item.slug === grant)!;
      await db.insert(rolePermissions).values({ roleId: role.id, permissionId: permission.id }).onDuplicateKeyUpdate({ set: { roleId: role.id } });
    }
  }

  const adminHash = await Bun.password.hash("admin12345", { algorithm: "argon2id" });
  const superadminHash = await Bun.password.hash("superadmin12345", { algorithm: "argon2id" });
  for (const [name, email, accountType, roleSlug, division] of accounts) {
    // Cek apakah akun sudah ada — jika sudah, JANGAN timpa password/data
    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing) {
      console.log(`  → Akun ${email} sudah ada (id=${existing.id}), dilewati.`);
      continue;
    }

    // Akun belum ada — buat baru
    const loginHash = email === "superadmin@mknsite.online" ? superadminHash : adminHash;
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
    await db.insert(divisions).ignore().values({ name, description });
  }

  console.log("Seed MKN Site selesai.");
  await pool.end();

}

seed().catch(async (error) => { console.error(error); await pool.end(); process.exit(1); });
