import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { eq } from "drizzle-orm";
import { config } from "../config/env";
import { db } from "../db";
import { authAccounts, authSessions, authUsers, authVerifications, users } from "../db/schema";
import { getProfile } from "../services/access.service";
import { emailService } from "../services/email.service";
export * from "./types";
import type { ActorType, AuthenticatedProfile } from "./types";

const adapter = drizzleAdapter(db, {
  provider: "mysql",
  schema: { user: authUsers, session: authSessions, account: authAccounts, verification: authVerifications }
});

function createAuth(basePath: string, cookiePrefix: string) {
  return betterAuth({
    secret: config.betterAuthSecret,
    baseURL: config.apiOrigin,
    basePath,
    trustedOrigins: config.allowedOrigins as unknown as string[],
    database: adapter,
    emailVerification: {
      sendVerificationEmail: async ({ user, url, token }) => {
        await emailService.sendVerificationEmail({
          email: user.email,
          name: user.name,
          url,
          token
        });
      }
    },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url, token }) => {
        await emailService.sendPasswordResetEmail({
          email: user.email,
          name: user.name,
          url,
          token
        });
      },
      password: {
        hash: (password) => Bun.password.hash(password, { algorithm: "argon2id" }),
        verify: ({ hash, password }) => Bun.password.verify(password, hash)
      }
    },
    advanced: {
      cookiePrefix,
      defaultCookieAttributes: {
        httpOnly: true,
        secure: config.isProduction,
        sameSite: "lax",
        path: "/",
        domain: config.cookieDomain
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

export async function getAuthenticatedProfile(headers: Headers, accountType: ActorType): Promise<AuthenticatedProfile | null> {
  const auth = accountType === "admin" ? adminAuth : employeeAuth;
  const session = await auth.api.getSession({ headers });
  if (!session) return null;

  const [identity] = await db
    .select({ mknUserId: authUsers.mknUserId, emailVerified: authUsers.emailVerified })
    .from(authUsers)
    .where(eq(authUsers.id, session.user.id))
    .limit(1);
  if (!identity?.mknUserId) {
    console.warn(`[AUTH] Sesi ${session.user.id} (${session.user.email}) belum terhubung dengan akun mknUserId`);
    return null;
  }

  const profile = await getProfile(identity.mknUserId);
  if (!profile) {
    console.warn(`[AUTH] Profil MKN tidak ditemukan untuk mknUserId ${identity.mknUserId}`);
    return null;
  }
  if (profile.actorType !== (accountType === "admin" ? "admin" : "user")) return null;
  return { ...profile, emailVerified: Boolean(identity.emailVerified) };
}
