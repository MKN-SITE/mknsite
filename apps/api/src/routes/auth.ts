import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { accountAliases, authUsers, users } from "../db/schema";
import { adminAuth, employeeAuth, findMknAccount, getAuthenticatedProfile } from "../auth/auth";
import { config } from "../config/env";
import { userProvisioningService } from "../services/user-provisioning";

// In-memory rate limiter sederhana & aman dengan pembersihan berkala
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Bersihkan entry yang kedaluwarsa secara berkala (setiap 5 menit) untuk mencegah memory leak
const rateLimitCleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap.entries()) {
    if (now > val.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);
if (typeof rateLimitCleanupInterval.unref === "function") {
  rateLimitCleanupInterval.unref();
}

function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  if (process.env.NODE_ENV === "test") return true;
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) {
    return false;
  }
  entry.count++;
  return true;
}

const loginCredentials = t.Object({
  identifier: t.Optional(t.String()),
  email: t.Optional(t.String()),
  password: t.String({ minLength: 1 })
});

const adminCredentials = t.Object({
  email: t.String({ format: "email" }),
  password: t.String({ minLength: 8 })
});

const registerSchema = t.Object({
  kpcId: t.String({ minLength: 2, maxLength: 32 }),
  name: t.String({ minLength: 1, maxLength: 160 }),
  username: t.String({ minLength: 3, maxLength: 32 }),
  email: t.String({ format: "email" }),
  phone: t.String({ minLength: 8, maxLength: 20 }),
  startDate: t.String(),
  password: t.String({ minLength: 12, maxLength: 128 }),
  confirmPassword: t.String()
});

const forgotPasswordSchema = t.Object({
  identifier: t.String({ minLength: 2, maxLength: 191 })
});

const resetPasswordSchema = t.Object({
  token: t.String({ minLength: 1 }),
  password: t.String({ minLength: 12, maxLength: 128 }),
  confirmPassword: t.Optional(t.String())
});

const verifyEmailSchema = t.Object({
  token: t.String({ minLength: 1 })
});

function authRequest(request: Request, endpoint: string, body?: unknown) {
  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json");
  return new Request(`${config.apiOrigin}${endpoint}`, {
    method: "POST",
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
}

export async function resolveEmployeeAccount(rawIdentifier: string) {
  const clean = rawIdentifier.trim().toLowerCase();
  if (!clean) return null;

  // 1. Cari alias di account_aliases (unique index)
  const [alias] = await db
    .select({ userId: accountAliases.userId })
    .from(accountAliases)
    .where(eq(accountAliases.normalizedValue, clean))
    .limit(1);

  if (alias) {
    const [user] = await db.select().from(users).where(eq(users.id, alias.userId)).limit(1);
    return user?.accountType === "employee" && user.isActive ? user : null;
  }

  // Fallback: pencarian langsung ke users.email
  const [user] = await db.select().from(users).where(eq(users.email, clean)).limit(1);
  return user?.accountType === "employee" && user.isActive ? user : null;
}

async function signIn(
  request: Request,
  body: { identifier?: string; email?: string; password: string },
  type: "employee" | "admin",
  status: (code: number, value: { message: string }) => unknown
) {
  const rawId = body.identifier || body.email || "";
  const ip = request.headers.get("x-forwarded-for") || "local";
  const rateLimitKey = `login:${type}:${rawId.trim().toLowerCase() || ip}`;

  if (!checkRateLimit(rateLimitKey, 15, 60_000)) {
    return status(429, { message: "Terlalu banyak percobaan login. Silakan tunggu 1 menit lagi." });
  }

  const account = type === "admin"
    ? await findMknAccount(rawId, "admin")
    : await resolveEmployeeAccount(rawId);

  if (!account) {
    return status(401, { message: type === "admin" ? "Kredensial administrator tidak sesuai." : "Email atau kata sandi tidak sesuai." });
  }

  const auth = type === "admin" ? adminAuth : employeeAuth;
  const endpoint = type === "admin" ? "/api/auth/admin/sign-in/email" : "/api/auth/employee/sign-in/email";
  const res = await auth.handler(authRequest(request, endpoint, { email: account.email, password: body.password, rememberMe: true }));

  if (res.ok) {
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, account.id));
  } else {
    return status(401, { message: type === "admin" ? "Kredensial administrator tidak sesuai." : "Email atau kata sandi tidak sesuai." });
  }
  return res;
}

async function signOut(request: Request, type: "employee" | "admin") {
  const auth = type === "admin" ? adminAuth : employeeAuth;
  const endpoint = type === "admin" ? "/api/auth/admin/sign-out" : "/api/auth/employee/sign-out";
  return auth.handler(authRequest(request, endpoint));
}

export const authRoutes = new Elysia({ prefix: "/auth" })
  .post("/login", ({ request, body, status }) => signIn(request, body, "employee", status), {
    body: loginCredentials,
    detail: {
      summary: "Login Karyawan",
      description: "Autentikasi akun karyawan menggunakan Email, ID KPC, atau Username dan kata sandi.",
      tags: ["Auth Employee"],
      operationId: "employeeLogin"
    }
  })
  .post("/register", async ({ request, body, status }) => {
    const ip = request.headers.get("x-forwarded-for") || "local";
    if (!checkRateLimit(`register:${ip}`, 10, 300_000)) {
      return status(429, { code: "RATE_LIMITED", message: "Terlalu banyak permintaan pendaftaran. Silakan coba lagi beberapa saat." });
    }

    if (body.password !== body.confirmPassword) {
      return status(422, { code: "PASSWORD_MISMATCH", message: "Konfirmasi kata sandi tidak sesuai." });
    }

    const result = await userProvisioningService.registerEmployee({
      kpcId: body.kpcId,
      name: body.name,
      username: body.username,
      email: body.email,
      phone: body.phone,
      startDate: body.startDate,
      password: body.password
    });

    if ("error" in result) {
      return status(result.error.status, { code: result.error.code, message: result.error.message });
    }

    // Picu email verifikasi Better Auth setelah commit database
    try {
      await employeeAuth.api.sendVerificationEmail({
        body: { email: result.user.email }
      });
    } catch (e) {
      console.error("Gagal mengirim email verifikasi Better Auth:", e);
    }

    return status(201, {
      success: true,
      message: "Pendaftaran berhasil. Silakan login.",
      data: result.user
    });
  }, {
    body: registerSchema,
    detail: {
      summary: "Pendaftaran Akun Karyawan Mandiri",
      description: "Mendaftarkan karyawan baru dengan role dasar employee-basic dan status email belum terverifikasi.",
      tags: ["Auth Employee"]
    }
  })
  .post("/forgot-password", async ({ request, body, status }) => {
    const ip = request.headers.get("x-forwarded-for") || "local";
    if (!checkRateLimit(`forgot:${ip}:${body.identifier.trim().toLowerCase()}`, 5, 600_000)) {
      return status(429, { message: "Terlalu banyak permintaan reset kata sandi. Silakan tunggu beberapa saat." });
    }

    const genericResponse = {
      success: true,
      message: "Jika akun sesuai, tautan pemulihan akan dikirim ke email yang terdaftar."
    };

    const account = await resolveEmployeeAccount(body.identifier);
    if (!account || !account.isActive || account.accountType !== "employee") {
      return genericResponse;
    }

    try {
      await employeeAuth.api.requestPasswordReset({
        body: {
          email: account.email,
          redirectTo: `${config.appOrigin}/reset-password`
        }
      });
    } catch (e) {
      console.error("Gagal memproses requestPasswordReset Better Auth:", e);
    }

    return genericResponse;
  }, {
    body: forgotPasswordSchema,
    detail: {
      summary: "Lupa Kata Sandi",
      description: "Meminta tautan pemulihan kata sandi berdasarkan Email, ID KPC, atau Username dengan respons generik.",
      tags: ["Auth Employee"]
    }
  })
  .post("/reset-password", async ({ request, body, status }) => {
    const ip = request.headers.get("x-forwarded-for") || "local";
    if (!checkRateLimit(`reset:${ip}`, 10, 600_000)) {
      return status(429, { message: "Terlalu banyak percobaan reset kata sandi. Silakan tunggu beberapa saat." });
    }

    if (body.confirmPassword && body.password !== body.confirmPassword) {
      return status(422, { code: "PASSWORD_MISMATCH", message: "Konfirmasi kata sandi tidak cocok." });
    }

    if (body.password.length < 12 || body.password.length > 128) {
      return status(422, { code: "INVALID_PASSWORD", message: "Kata sandi minimal 12 karakter dan maksimal 128 karakter." });
    }

    try {
      const res = await employeeAuth.api.resetPassword({
        body: {
          token: body.token,
          newPassword: body.password
        }
      });

      if (!res || !res.status) {
        return status(400, { code: "INVALID_TOKEN", message: "Tautan pemulihan tidak valid atau sudah kedaluwarsa." });
      }

      // Selaraskan passwordHash legacy pada tabel users jika diperlukan
      const hashed = await Bun.password.hash(body.password, { algorithm: "argon2id" });
      const [authUser] = await db
        .select({ mknUserId: authUsers.mknUserId })
        .from(authUsers)
        .innerJoin(users, eq(users.id, authUsers.mknUserId))
        .where(eq(authUsers.email, (res as any)?.user?.email ?? ""))
        .limit(1);

      if (authUser?.mknUserId) {
        await db.update(users).set({ passwordHash: hashed }).where(eq(users.id, authUser.mknUserId));
      }

      return {
        success: true,
        message: "Kata sandi berhasil diperbarui. Silakan login kembali."
      };
    } catch (e) {
      return status(400, { code: "INVALID_TOKEN", message: "Tautan pemulihan tidak valid atau sudah kedaluwarsa." });
    }
  }, {
    body: resetPasswordSchema,
    detail: {
      summary: "Reset Kata Sandi",
      description: "Memperbarui kata sandi menggunakan token verifikasi email dan mencabut seluruh sesi aktif.",
      tags: ["Auth Employee"]
    }
  })
  .post("/verify-email", async ({ body, status }) => {
    try {
      const res = await employeeAuth.api.verifyEmail({
        query: { token: body.token }
      });
      if (!res || !res.status) {
        return status(400, { code: "INVALID_TOKEN", message: "Tautan verifikasi email tidak valid atau sudah kedaluwarsa." });
      }
      return { success: true, message: "Email berhasil diverifikasi." };
    } catch {
      return status(400, { code: "INVALID_TOKEN", message: "Tautan verifikasi email tidak valid atau sudah kedaluwarsa." });
    }
  }, {
    body: verifyEmailSchema,
    detail: {
      summary: "Verifikasi Email",
      description: "Memvalidasi token verifikasi email karyawan.",
      tags: ["Auth Employee"]
    }
  })
  .post("/resend-verification", async ({ request, body, status }) => {
    const rawId = (body as any)?.identifier || (body as any)?.email || "";
    const ip = request.headers.get("x-forwarded-for") || "local";
    if (!checkRateLimit(`resend:${ip}:${rawId.toLowerCase()}`, 3, 600_000)) {
      return status(429, { message: "Terlalu banyak permintaan kirim ulang verifikasi. Silakan tunggu 10 menit." });
    }

    const account = await resolveEmployeeAccount(rawId);
    if (account) {
      const [authUser] = await db.select().from(authUsers).where(eq(authUsers.mknUserId, account.id)).limit(1);
      if (authUser && !authUser.emailVerified) {
        try {
          await employeeAuth.api.sendVerificationEmail({
            body: { email: account.email }
          });
        } catch (e) {
          console.error("Gagal mengirim ulang email verifikasi:", e);
        }
      }
    }

    return {
      success: true,
      message: "Jika akun sesuai dan belum diverifikasi, tautan verifikasi baru akan dikirimkan."
    };
  }, {
    body: t.Object({ identifier: t.Optional(t.String()), email: t.Optional(t.String()) }),
    detail: {
      summary: "Kirim Ulang Email Verifikasi",
      description: "Mengirimkan kembali tautan verifikasi email ke akun yang belum terverifikasi.",
      tags: ["Auth Employee"]
    }
  })
  .get("/me", async ({ request, status }) => {
    const user = await getAuthenticatedProfile(request.headers, "employee");
    return user ? { user } : status(401, { message: "Sesi karyawan tidak valid." });
  }, {
    detail: {
      summary: "Profil Karyawan Aktif",
      description: "Mengambil data profil, roles, and permissions karyawan berdasarkan cookie sesi.",
      tags: ["Auth Employee"],
      operationId: "getEmployeeProfile",
      security: [{ employeeSession: [] }]
    }
  })
  .post("/logout", ({ request }) => signOut(request, "employee"), {
    detail: {
      summary: "Logout Karyawan",
      description: "Mengakhiri sesi karyawan dan membersihkan cookie session mkn_employee. Membutuhkan header Origin yang sah.",
      tags: ["Auth Employee"],
      operationId: "employeeLogout",
      security: [{ employeeSession: [] }]
    }
  })
  .post("/admin/login", ({ request, body, status }) => signIn(request, body, "admin", status), {
    body: adminCredentials,
    detail: {
      summary: "Login Administrator",
      description: "Autentikasi akun administrator. Mengatur cookie session mkn_admin.session_token secara terisolasi.",
      tags: ["Auth Admin"],
      operationId: "adminLogin"
    }
  })
  .get("/admin/me", async ({ request, status }) => {
    const user = await getAuthenticatedProfile(request.headers, "admin");
    return user ? { user } : status(401, { message: "Sesi administrator tidak valid." });
  }, {
    detail: {
      summary: "Profil Administrator Aktif",
      description: "Mengambil data profil dan permission admin berdasarkan cookie sesi mkn_admin.",
      tags: ["Auth Admin"],
      operationId: "getAdminProfile",
      security: [{ adminSession: [] }]
    }
  })
  .post("/admin/logout", ({ request }) => signOut(request, "admin"), {
    detail: {
      summary: "Logout Administrator",
      description: "Mengakhiri sesi administrator dan membersihkan cookie mkn_admin tanpa memengaruhi sesi karyawan.",
      tags: ["Auth Admin"],
      operationId: "adminLogout",
      security: [{ adminSession: [] }]
    }
  });
