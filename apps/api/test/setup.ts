import { afterAll } from "bun:test";
import { eq, notInArray } from "drizzle-orm";
import { app } from "../src/index";
import { db } from "../src/db";
import { authAccounts, authSessions, authUsers, userRoles, users } from "../src/db/schema";

export { app };

const OFFICIAL_EMAILS = [
  "admin@mknsite.online",
  "superadmin@mknsite.online",
  "hr@mknsite.online",
  "telco@mknsite.online",
  "workshop@mknsite.online",
  "project@mknsite.online",
  "manager@mknsite.online"
];

export async function cleanTestUsers() {
  try {
    const testUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(notInArray(users.email, OFFICIAL_EMAILS));

    for (const u of testUsers) {
      const [authUser] = await db
        .select({ id: authUsers.id })
        .from(authUsers)
        .where(eq(authUsers.mknUserId, u.id))
        .limit(1);

      if (authUser) {
        await db.delete(authSessions).where(eq(authSessions.userId, authUser.id));
        await db.delete(authAccounts).where(eq(authAccounts.userId, authUser.id));
        await db.delete(authUsers).where(eq(authUsers.id, authUser.id));
      }
      await db.delete(userRoles).where(eq(userRoles.userId, u.id));
      await db.delete(users).where(eq(users.id, u.id));
    }
  } catch {
    // Ignore cleanup error in case database pool is already closed
  }
}

afterAll(async () => {
  await cleanTestUsers();
});
