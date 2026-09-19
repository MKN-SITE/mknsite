process.env.NODE_ENV = "test";

import { afterAll } from "bun:test";
import { eq, notInArray, sql } from "drizzle-orm";
import { app } from "../src/index";
import { db } from "../src/db";
import { accountAliases, authAccounts, authSessions, authUsers, userRoles, users } from "../src/db/schema";

function parseAndValidateTestDatabase(urlStr: string): string {
  if (!urlStr || urlStr.trim() === "") {
    throw new Error("[SECURITY GUARD] Environment DATABASE_URL belum diatur untuk pengujian.");
  }

  let dbName = "";
  try {
    const parsed = new URL(urlStr);
    dbName = parsed.pathname.replace(/^\/+/, "").split("?")[0].trim();
  } catch {
    throw new Error("[SECURITY GUARD] Format DATABASE_URL tidak valid.");
  }

  if (!dbName || !dbName.endsWith("_test")) {
    throw new Error(
      `[SECURITY GUARD] Automated tests hanya boleh dijalankan pada database test yang berakhiran '_test' (misal: mknsite_test). Database terdeteksi: '${dbName || "tidak terdefinisi"}'`
    );
  }

  return dbName;
}

parseAndValidateTestDatabase(process.env.DATABASE_URL || "");

export { app };

const OFFICIAL_EMAILS = [
  "admin@mknsite.online",
  "superadmin@mknsite.online",
  "hr@mknsite.online"
];

export async function cleanTestUsers() {
  // Verifikasi runtime nama database aktual sebelum melakukan pembersihan
  const [dbResult] = await db.execute<any>(sql`SELECT DATABASE() as current_db`);
  const activeDb =
    (dbResult as any)?.[0]?.current_db ??
    (dbResult as any)?.[0]?.["DATABASE()"] ??
    "";

  if (typeof activeDb !== "string" || !activeDb.endsWith("_test")) {
    throw new Error(
      `[SECURITY GUARD] Database runtime aktif '${activeDb || "unknown"}' bukan database uji yang berakhiran '_test'. Pembersihan dibatalkan demi keamanan.`
    );
  }

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
      await db.delete(accountAliases).where(eq(accountAliases.userId, u.id));
      await db.delete(userRoles).where(eq(userRoles.userId, u.id));
      await db.delete(users).where(eq(users.id, u.id));
    }
  } catch (err: any) {
    if (err?.message?.includes("[SECURITY GUARD]")) {
      throw err;
    }
    // Ignore cleanup error in case database pool is already closed
  }
}

afterAll(async () => {
  await cleanTestUsers();
});
