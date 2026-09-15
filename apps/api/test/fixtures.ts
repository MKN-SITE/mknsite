// Run before any test imports application code. Tests mutate data and need a disposable DB.
const database = new URL(process.env.DATABASE_URL ?? "mysql://invalid/invalid");
if (process.env.ALLOW_TEST_DATABASE !== "1" || !database.pathname.endsWith("_test") || process.env.NODE_ENV === "production") {
  throw new Error("Tests require ALLOW_TEST_DATABASE=1 and a dedicated DATABASE_URL ending in _test. Never use the application database.");
}
const seed = Bun.spawn([process.execPath, "src/db/seed.ts"], { cwd: import.meta.dir + "/..", stdout: "ignore", stderr: "inherit" });
if (await seed.exited !== 0) throw new Error("Test seed failed.");
const { db } = await import("../src/db");
const { users, roles, menus } = await import("../src/db/schema");
const { eq } = await import("drizzle-orm");
const { UserProvisioningService } = await import("../src/services/user-provisioning");
const [admin] = await db.select().from(users).where(eq(users.email, "admin@mknsite.online"));
const allRoles = await db.select().from(roles);
const fixtures = [
  ["Ayu HR", "hr", "hr"], ["Teknisi Telco", "telco", "ops-telco"],
  ["Teknisi Workshop", "workshop", "ops-workshop"], ["Project", "project", "project"],
  ["Manager", "manager", "manager"], ["Supervisor Telco", "supervisor", "ops-telco-supervisor"]
];
for (const [name, username, slug] of fixtures) {
  const email = `${username}@mknsite.online`;
  if ((await db.select().from(users).where(eq(users.email, email))).length) continue;
  const role = allRoles.find((role) => role.slug === slug)!;
  const result = await new UserProvisioningService().createEmployee({ name, email, password: "demo12345", roleIds: [role.id] }, admin.id);
  if ("error" in result) throw new Error(`Fixture failed: ${result.error.code}`);
}
// Fixtures are explicitly test-only. Production menus remain managed through Administrasi.
for (const [title, slug, permission] of [["Self-Service", "self-service", "dashboard.view"], ["HR", "hr", "hr.view"], ["OPS Telco", "ops-telco", "ops_telco.view"], ["OPS Workshop", "ops-workshop", "ops_workshop.view"], ["Project", "project", "project.view"]]) {
  const url = `/portal/${slug}`;
  if (!(await db.select().from(menus).where(eq(menus.url, url))).length) await db.insert(menus).values({ title, url, requiredPermission: permission });
}
export {};
