import { eq, like } from "drizzle-orm";
import { db, pool } from ".";
import { authAccounts, authUsers, permissions, rolePermissions, roles, userRoles, users } from "./schema";

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
  ["Ayu Prameswari", "hr@mknsite.online", "employee", "hr"],
  ["Rizky Mahendra", "telco@mknsite.online", "employee", "ops-telco"],
  ["Fajar Nugraha", "workshop@mknsite.online", "employee", "ops-workshop"],
  ["Nadia Kusuma", "project@mknsite.online", "employee", "project"],
  ["Bima Santosa", "manager@mknsite.online", "employee", "manager"],
  ["System Administrator", "admin@mknsite.online", "admin", "administrator"],
  ["Super Administrator", "superadmin@mknsite.online", "admin", "superadmin"]
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
  for (const [name, email, accountType, roleSlug] of accounts) {
    const loginHash = email === "superadmin@mknsite.online" ? superadminHash : accountType === "admin" ? adminHash : passwordHash;
    await db.insert(users).values({ name, email, accountType, passwordHash: loginHash }).onDuplicateKeyUpdate({ set: { name, accountType, passwordHash: loginHash } });
    const [account] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const role = allRoles.find((item) => item.slug === roleSlug)!;
    await db.insert(userRoles).values({ userId: account.id, roleId: role.id }).onDuplicateKeyUpdate({ set: { roleId: role.id } });

    let [identity] = await db.select().from(authUsers).where(eq(authUsers.mknUserId, account.id)).limit(1);
    if (!identity) {
      const id = crypto.randomUUID();
      await db.insert(authUsers).values({ id, mknUserId: account.id, name, email, emailVerified: true });
      [identity] = await db.select().from(authUsers).where(eq(authUsers.id, id)).limit(1);
    } else {
      await db.update(authUsers).set({ name, email, emailVerified: true }).where(eq(authUsers.id, identity.id));
    }
    await db.insert(authAccounts).values({
      id: crypto.randomUUID(), accountId: identity.id, providerId: "credential", userId: identity.id, password: loginHash
    }).onDuplicateKeyUpdate({ set: { password: loginHash } });
  }
  console.log("Seed MKN Site selesai.");
  await pool.end();
}

seed().catch(async (error) => { console.error(error); await pool.end(); process.exit(1); });
