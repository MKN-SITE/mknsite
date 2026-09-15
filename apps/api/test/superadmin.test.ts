import { describe, expect, it } from "bun:test";
import { app } from "./setup";
import { authorizeSuperadmin } from "../src/guards/admin.guard";

describe("Superadmin RBAC & Guard Suite (Fase 1 Superadmin)", () => {
  it("mengizinkan login akun superadmin@mknsite.online via /auth/admin/login", async () => {
    const res = await app.handle(
      new Request("http://localhost/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "superadmin@mknsite.online", password: "superadmin12345" })
      })
    );
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("mkn_admin.session_token=");
  });

  it("profil /auth/admin/me untuk superadmin memuat role Superadministrator dan permission admin.security.manage", async () => {
    const loginRes = await app.handle(
      new Request("http://localhost/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "superadmin@mknsite.online", password: "superadmin12345" })
      })
    );
    const cookie = loginRes.headers.get("set-cookie") ?? "";

    const meRes = await app.handle(
      new Request("http://localhost/auth/admin/me", {
        headers: { Cookie: cookie }
      })
    );
    expect(meRes.status).toBe(200);
    const body = (await meRes.json()) as any;
    expect(body.user.email).toBe("superadmin@mknsite.online");
    expect(body.user.roles).toContain("Superadministrator");
    expect(body.user.permissions).toContain("admin.manage");
    expect(body.user.permissions).toContain("admin.security.manage");
  });

  it("profil /auth/admin/me untuk admin biasa TIDAK memuat permission admin.security.manage", async () => {
    const loginRes = await app.handle(
      new Request("http://localhost/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "admin@mknsite.online", password: "admin12345" })
      })
    );
    const cookie = loginRes.headers.get("set-cookie") ?? "";

    const meRes = await app.handle(
      new Request("http://localhost/auth/admin/me", {
        headers: { Cookie: cookie }
      })
    );
    expect(meRes.status).toBe(200);
    const body = (await meRes.json()) as any;
    expect(body.user.email).toBe("admin@mknsite.online");
    expect(body.user.roles).toContain("Administrator");
    expect(body.user.roles).not.toContain("Superadministrator");
    expect(body.user.permissions).toContain("admin.manage");
    expect(body.user.permissions).not.toContain("admin.security.manage");
  });

  it("GET /admin/roles mengembalikan role Superadministrator beserta izin admin.security.manage", async () => {
    const loginRes = await app.handle(
      new Request("http://localhost/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "admin@mknsite.online", password: "admin12345" })
      })
    );
    const cookie = loginRes.headers.get("set-cookie") ?? "";

    const res = await app.handle(
      new Request("http://localhost/admin/roles", {
        headers: { Cookie: cookie }
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    const superadminRole = body.data.find((r: any) => r.slug === "superadmin");
    expect(superadminRole).toBeDefined();
    expect(superadminRole.name).toBe("Superadministrator");
    expect(superadminRole.permissions).toContain("admin.security.manage");
    expect(superadminRole.permissions).toContain("admin.manage");
  });

  it("guard authorizeSuperadmin meloloskan superadmin dan menolak admin biasa dengan HTTP 403", async () => {
    // 1. Superadmin Cookie
    const superLoginRes = await app.handle(
      new Request("http://localhost/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "superadmin@mknsite.online", password: "superadmin12345" })
      })
    );
    const superCookie = superLoginRes.headers.get("set-cookie") ?? "";

    // 2. Regular Admin Cookie
    const adminLoginRes = await app.handle(
      new Request("http://localhost/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "admin@mknsite.online", password: "admin12345" })
      })
    );
    const adminCookie = adminLoginRes.headers.get("set-cookie") ?? "";

    // Uji authorizeSuperadmin dengan superadmin cookie
    const superReq = new Request("http://localhost/admin/users", { headers: { Cookie: superCookie } });
    const superResult = await authorizeSuperadmin(superReq);
    expect(superResult.success).toBe(true);
    if (superResult.success) {
      expect(superResult.admin.email).toBe("superadmin@mknsite.online");
    }

    // Uji authorizeSuperadmin dengan regular admin cookie
    const adminReq = new Request("http://localhost/admin/users", { headers: { Cookie: adminCookie } });
    const adminResult = await authorizeSuperadmin(adminReq);
    expect(adminResult.success).toBe(false);
    if (!adminResult.success) {
      expect(adminResult.failure.status).toBe(403);
      expect(adminResult.failure.error.code).toBe("SUPERADMIN_PERMISSION_REQUIRED");
    }
  });

  it("admin biasa dilarang memodifikasi akun superadmin (roles, status, revoke) dengan HTTP 403 SUPERADMIN_PROTECTED", async () => {
    // 1. Login sebagai admin biasa
    const adminLoginRes = await app.handle(
      new Request("http://localhost/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "admin@mknsite.online", password: "admin12345" })
      })
    );
    const adminCookie = adminLoginRes.headers.get("set-cookie") ?? "";

    // 2. Ambil ID superadmin
    const usersRes = await app.handle(
      new Request("http://localhost/admin/users?search=superadmin@mknsite.online", {
        headers: { Cookie: adminCookie }
      })
    );
    const usersBody = (await usersRes.json()) as { data: Array<{ id: number; email: string }> };
    const superadminUser = usersBody.data.find((u) => u.email === "superadmin@mknsite.online");
    expect(superadminUser).toBeDefined();
    const superadminId = superadminUser!.id;

    // 3. Admin coba ubah role superadmin -> 403 SUPERADMIN_PROTECTED
    const rolePatchRes = await app.handle(
      new Request(`http://localhost/admin/users/${superadminId}/roles`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: adminCookie },
        body: JSON.stringify({ roleIds: [6] }) // role administrator biasa
      })
    );
    expect(rolePatchRes.status).toBe(403);
    const roleBody = (await rolePatchRes.json()) as { code: string };
    expect(roleBody.code).toBe("SUPERADMIN_PROTECTED");

    // 4. Admin coba nonaktifkan superadmin -> 403 SUPERADMIN_PROTECTED
    const statusPatchRes = await app.handle(
      new Request(`http://localhost/admin/users/${superadminId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: adminCookie },
        body: JSON.stringify({ isActive: false })
      })
    );
    expect(statusPatchRes.status).toBe(403);
    const statusBody = (await statusPatchRes.json()) as { code: string };
    expect(statusBody.code).toBe("SUPERADMIN_PROTECTED");

    // 5. Admin coba cabut sesi superadmin -> 403 SUPERADMIN_PROTECTED
    const revokeRes = await app.handle(
      new Request(`http://localhost/admin/users/${superadminId}/revoke-sessions`, {
        method: "POST",
        headers: { Origin: "http://localhost:3000", Cookie: adminCookie }
      })
    );
    expect(revokeRes.status).toBe(403);
    const revokeBody = (await revokeRes.json()) as { code: string };
    expect(revokeBody.code).toBe("SUPERADMIN_PROTECTED");
  });
});
