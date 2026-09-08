import { Elysia, t } from "elysia";
import { adminAuth, employeeAuth, findMknAccount, getAuthenticatedProfile } from "../lib/auth";

const credentials = t.Object({ email: t.String({ format: "email" }), password: t.String({ minLength: 8 }) });

function authRequest(request: Request, endpoint: string, body?: unknown) {
  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json");
  return new Request(`${process.env.BETTER_AUTH_URL ?? `http://localhost:${process.env.PORT ?? 3001}`}${endpoint}`, {
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
  .post("/login", ({ request, body, status }) => signIn(request, body, "employee", status), { body: credentials })
  .get("/me", async ({ request, status }) => {
    const user = await getAuthenticatedProfile(request.headers, "employee");
    return user ? { user } : status(401, { message: "Sesi karyawan tidak valid." });
  })
  .post("/logout", ({ request }) => signOut(request, "employee"))
  .post("/admin/login", ({ request, body, status }) => signIn(request, body, "admin", status), { body: credentials })
  .get("/admin/me", async ({ request, status }) => {
    const user = await getAuthenticatedProfile(request.headers, "admin");
    return user ? { user } : status(401, { message: "Sesi administrator tidak valid." });
  })
  .post("/admin/logout", ({ request }) => signOut(request, "admin"));
