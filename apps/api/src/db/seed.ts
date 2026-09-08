import { eq } from "drizzle-orm";
import { db, pool } from ".";
import { authAccounts, authUsers, permissions, rolePermissions, roles, userRoles, users } from "./schema";

const permissionRows = [
  ["Lihat dashboard", "dashboard.view"], ["Lihat HR", "hr.view"], ["Kelola HR", "hr.manage"],
  ["Lihat OPS Telco", "ops_telco.view"], ["Kelola OPS Telco", "ops_telco.manage"],
  ["Lihat OPS Workshop", "ops_workshop.view"], ["Kelola OPS Workshop", "ops_workshop.manage"],
  ["Lihat Project", "project.view"], ["Kelola Project", "project.manage"], ["Kelola sistem", "admin.manage"]
] as const;

const roleRows = [
  ["HR", "hr", ["dashboard.view", "hr.view", "hr.manage"]],
  ["OPS Telco", "ops-telco", ["dashboard.view", "ops_telco.view", "ops_telco.manage"]],
  ["OPS Workshop", "ops-workshop", ["dashboard.view", "ops_workshop.view", "ops_workshop.manage"]],
  ["PRJ Project", "project", ["dashboard.view", "project.view", "project.manage"]],
  ["Manager", "manager", permissionRows.filter(([, slug]) => slug !== "admin.manage").map(([, slug]) => slug)],
  ["Administrator", "administrator", ["dashboard.view", "admin.manage"]]
] as const;

const accounts = [
  ["Ayu Prameswari", "hr@mknsite.id", "employee", "hr"],
  ["Rizky Mahendra", "telco@mknsite.id", "employee", "ops-telco"],
  ["Fajar Nugraha", "workshop@mknsite.id", "employee", "ops-workshop"],
  ["Nadia Kusuma", "project@mknsite.id", "employee", "project"],
  ["Bima Santosa", "manager@mknsite.id", "employee", "manager"],
  ["System Administrator", "admin@mknsite.id", "admin", "administrator"]
] as const;

async function seed() {
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
  for (const [name, email, accountType, roleSlug] of accounts) {
    const loginHash = accountType === "admin" ? adminHash : passwordHash;
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
