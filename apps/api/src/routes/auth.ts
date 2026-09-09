import { Elysia, t } from "elysia";
import { adminAuth, employeeAuth, findMknAccount, getAuthenticatedProfile } from "../auth/auth";
import { config } from "../config/env";

const credentials = t.Object({ email: t.String({ format: "email" }), password: t.String({ minLength: 8 }) });

function authRequest(request: Request, endpoint: string, body?: unknown) {
  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json");
  return new Request(`${config.apiOrigin}${endpoint}`, {
    method: "POST",
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
}

async function signIn(request: Request, body: { email: string; password: string }, type: "employee" | "admin", status: (code: number, value: { message: string }) => unknown) {
  const account = await findMknAccount(body.email, type);
  if (!account) return status(401, { message: type === "admin" ? "Kredensial administrator tidak sesuai." : "Email atau kata sandi tidak sesuai." });
  const auth = type === "admin" ? adminAuth : employeeAuth;
  const endpoint = type === "admin" ? "/api/auth/admin/sign-in/email" : "/api/auth/employee/sign-in/email";
  return auth.handler(authRequest(request, endpoint, { ...body, rememberMe: true }));
}

async function signOut(request: Request, type: "employee" | "admin") {
  const auth = type === "admin" ? adminAuth : employeeAuth;
  const endpoint = type === "admin" ? "/api/auth/admin/sign-out" : "/api/auth/employee/sign-out";
  return auth.handler(authRequest(request, endpoint));
}

export const authRoutes = new Elysia({ prefix: "/auth" })
  .post("/login", ({ request, body, status }) => signIn(request, body, "employee", status), {
    body: credentials,
    detail: {
      summary: "Login Karyawan",
      description: "Autentikasi akun karyawan menggunakan email dan password. Mengatur cookie session mkn_employee.session_token.",
      tags: ["Auth Employee"],
      operationId: "employeeLogin",
      responses: {
        200: {
          description: "Login berhasil, session token dan cookie karyawan disetel",
          content: { "application/json": { schema: { $ref: "#/components/schemas/BetterAuthLoginResponse" } } }
        },
        401: {
          description: "Email atau kata sandi tidak sesuai, atau akun tidak aktif",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } }
        }
      }
    }
  })
  .get("/me", async ({ request, status }) => {
    const user = await getAuthenticatedProfile(request.headers, "employee");
    return user ? { user } : status(401, { message: "Sesi karyawan tidak valid." });
  }, {
    detail: {
      summary: "Profil Karyawan Aktif",
      description: "Mengambil data profil, roles, dan permissions karyawan berdasarkan cookie sesi.",
      tags: ["Auth Employee"],
      operationId: "getEmployeeProfile",
      security: [{ employeeSession: [] }],
      responses: {
        200: {
          description: "Data profil karyawan berhasil diambil",
          content: { "application/json": { schema: { $ref: "#/components/schemas/UserProfileResponse" } } }
        },
        401: {
          description: "Sesi karyawan tidak ada atau tidak valid",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } }
        }
      }
    }
  })
  .post("/logout", ({ request }) => signOut(request, "employee"), {
    detail: {
      summary: "Logout Karyawan",
      description: "Mengakhiri sesi karyawan dan membersihkan cookie session mkn_employee. Membutuhkan header Origin yang sah.",
      tags: ["Auth Employee"],
      operationId: "employeeLogout",
      security: [{ employeeSession: [] }],
      responses: {
        200: {
          description: "Logout berhasil, cookie sesi dibersihkan",
          content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } }
        },
        403: {
          description: "Header Origin tidak disertakan atau tidak diizinkan",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } }
        }
      }
    }
  })
  .post("/admin/login", ({ request, body, status }) => signIn(request, body, "admin", status), {
    body: credentials,
    detail: {
      summary: "Login Administrator",
      description: "Autentikasi akun administrator. Mengatur cookie session mkn_admin.session_token secara terisolasi.",
      tags: ["Auth Admin"],
      operationId: "adminLogin",
      responses: {
        200: {
          description: "Login admin berhasil, cookie sesi admin disetel",
          content: { "application/json": { schema: { $ref: "#/components/schemas/BetterAuthLoginResponse" } } }
        },
        401: {
          description: "Kredensial administrator tidak sesuai atau akun tidak aktif",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } }
        }
      }
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
      security: [{ adminSession: [] }],
      responses: {
        200: {
          description: "Data profil administrator berhasil diambil",
          content: { "application/json": { schema: { $ref: "#/components/schemas/UserProfileResponse" } } }
        },
        401: {
          description: "Sesi administrator tidak ada atau tidak valid",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } }
        }
      }
    }
  })
  .post("/admin/logout", ({ request }) => signOut(request, "admin"), {
    detail: {
      summary: "Logout Administrator",
      description: "Mengakhiri sesi administrator dan membersihkan cookie mkn_admin tanpa memengaruhi sesi karyawan.",
      tags: ["Auth Admin"],
      operationId: "adminLogout",
      security: [{ adminSession: [] }],
      responses: {
        200: {
          description: "Logout admin berhasil",
          content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } }
        }
      }
    }
  });
