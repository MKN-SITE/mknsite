import { afterAll } from "bun:test";
import { eq, notInArray } from "drizzle-orm";
import { db } from "../src/db";
import { hrForms, roles, users } from "../src/db/schema";
export { app, createServer } from "../src/index";

const initialIds = (await db.select({ id: users.id }).from(users)).map((row) => row.id);
export async function roleId(slug: string) {
  const [role] = await db.select().from(roles).where(eq(roles.slug, slug));
  if (!role) throw new Error(`Missing fixture role ${slug}`);
  return role.id;
}
export async function cleanTestUsers() {
  if (process.env.ALLOW_TEST_DATABASE !== "1" || !new URL(process.env.DATABASE_URL!).pathname.endsWith("_test")) throw new Error("Unsafe test cleanup refused.");
  // Delete only users created during this test process; never seed/application accounts.
  const added = await db.select().from(users).where(notInArray(users.id, initialIds));
  for (const user of added) {
    const [form] = await db.select({ id: hrForms.id }).from(hrForms).where(eq(hrForms.createdBy, user.id)).limit(1);
    if (!form) await db.delete(users).where(eq(users.id, user.id));
  }
}
afterAll(cleanTestUsers);
