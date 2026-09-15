import { and, eq, or } from "drizzle-orm";
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
  const production = process.env.NODE_ENV === "production";
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

  for (const [name, email, accountType, roleSlug, division] of accounts) {
    await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(users).where(eq(users.email, email)).limit(1).for("update");
      if (!existing && production) return; // No sample passwords or new users in production.
      if (existing && existing.accountType !== "admin") throw new Error("Email bootstrap sudah digunakan akun non-admin. Periksa konfigurasi.");
      let account = existing;
      if (!account) {
        const passwordHash = await Bun.password.hash(email === "superadmin@mknsite.online" ? "superadmin12345" : "admin12345", { algorithm: "argon2id" });
        const [created] = await tx.insert(users).values({ name, email, accountType, division, passwordHash }).$returningId();
        [account] = await tx.select().from(users).where(eq(users.id, created.id));
        const role = allRoles.find((item) => item.slug === roleSlug)!;
        await tx.insert(userRoles).values({ userId: account.id, roleId: role.id });
      }

      // Repair missing Better Auth records with the account's current hash, never a demo hash.
      const identities = await tx.select().from(authUsers).where(or(eq(authUsers.mknUserId, account.id), eq(authUsers.email, account.email)));
      if (identities.length > 1) throw new Error("Relasi Better Auth ambigu; periksa akun bootstrap.");
      let identity = identities[0];
      if (identity && (identity.email !== account.email || (identity.mknUserId !== null && identity.mknUserId !== account.id))) throw new Error("Relasi Better Auth tidak cocok; periksa akun bootstrap.");
      if (!identity) {
        const id = crypto.randomUUID();
        await tx.insert(authUsers).values({ id, mknUserId: account.id, name: account.name, email: account.email, emailVerified: true });
        [identity] = await tx.select().from(authUsers).where(eq(authUsers.id, id));
      } else if (identity.mknUserId === null) {
        await tx.update(authUsers).set({ mknUserId: account.id }).where(eq(authUsers.id, identity.id));
      }
      const [credential] = await tx.select().from(authAccounts).where(and(eq(authAccounts.userId, identity.id), eq(authAccounts.providerId, "credential"))).limit(1);
      if (!credential) await tx.insert(authAccounts).values({ id: crypto.randomUUID(), accountId: identity.id, providerId: "credential", userId: identity.id, password: account.passwordHash });
    });
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
