import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { authAccounts, authSessions, authUsers, authVerifications, users } from "../db/schema";
import { getProfile } from "./access";

type ActorType = "employee" | "admin";

const publicOrigin = process.env.APP_ORIGIN ?? "http://localhost:3000";
const apiOrigin = process.env.BETTER_AUTH_URL ?? `http://localhost:${process.env.PORT ?? 3001}`;
const adapter = drizzleAdapter(db, {
  provider: "mysql",
  schema: { user: authUsers, session: authSessions, account: authAccounts, verification: authVerifications }
});

function createAuth(basePath: string, cookiePrefix: string) {
  return betterAuth({
    baseURL: apiOrigin,
    basePath,
    trustedOrigins: [publicOrigin],
    database: adapter,
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      password: {
        hash: (password) => Bun.password.hash(password, { algorithm: "argon2id" }),
        verify: ({ hash, password }) => Bun.password.verify(password, hash)
      }
    },
    advanced: {
      cookiePrefix,
      defaultCookieAttributes: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        domain: process.env.COOKIE_DOMAIN || undefined
      }
    }
  });
}

export const employeeAuth = createAuth("/api/auth/employee", "mkn_employee");
export const adminAuth = createAuth("/api/auth/admin", "mkn_admin");

export async function findMknAccount(email: string, accountType: ActorType) {
  const [account] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  return account?.accountType === accountType && account.isActive ? account : null;
}

export async function getAuthenticatedProfile(headers: Headers, accountType: ActorType) {
  const auth = accountType === "admin" ? adminAuth : employeeAuth;
  const session = await auth.api.getSession({ headers });
  if (!session) return null;

  const [identity] = await db.select({ mknUserId: authUsers.mknUserId }).from(authUsers).where(eq(authUsers.id, session.user.id)).limit(1);
  if (!identity?.mknUserId) return null;
  const profile = await getProfile(identity.mknUserId);
  if (!profile || profile.actorType !== (accountType === "admin" ? "admin" : "user")) return null;
  return profile;
}
