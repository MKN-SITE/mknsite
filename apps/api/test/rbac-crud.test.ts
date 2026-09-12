import { afterEach, describe, expect, it } from "bun:test";
import { and, eq } from "drizzle-orm";
import { db } from "../src/db";
import { auditLogs, permissions, rolePermissions, roles } from "../src/db/schema";
import { app } from "./setup";

const marker = `qa-rbac-${Date.now()}`;
let roleId: number | null = null;
let permissionId: number | null = null;

async function login(email: string, password: string) {
  const response = await app.handle(new Request("http://localhost/auth/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
    body: JSON.stringify({ email, password })
  }));
  expect(response.status).toBe(200);
  return response.headers.get("set-cookie") ?? "";
}

function request(path: string, cookie: string, method = "GET", body?: unknown) {
  return app.handle(new Request(`http://localhost${path}`, {
    method,
    headers: {
      Cookie: cookie,
      Origin: "http://localhost:3000",
      ...(body === undefined ? {} : { "Content-Type": "application/json" })
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  }));
}

afterEach(async () => {
  if (roleId) await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
  if (roleId) await db.delete(roles).where(eq(roles.id, roleId));
  if (permissionId) await db.delete(permissions).where(eq(permissions.id, permissionId));
  if (roleId) await db.delete(auditLogs).where(and(eq(auditLogs.resource, "role"), eq(auditLogs.resourceId, String(roleId))));
  if (permissionId) await db.delete(auditLogs).where(and(eq(auditLogs.resource, "permission"), eq(auditLogs.resourceId, String(permissionId))));
  roleId = null;
  permissionId = null;
});

describe("RBAC CRUD API", () => {
  it("menolak pembacaan tanpa sesi dan mutasi admin biasa", async () => {
    expect((await app.handle(new Request("http://localhost/admin/rbac/roles"))).status).toBe(401);
    const adminCookie = await login("admin@mknsite.online", "admin12345");
    const denied = await request("/admin/rbac/roles", adminCookie, "POST", {
      name: "QA Restricted",
      slug: `${marker}-restricted`
    });
    expect(denied.status).toBe(403);
    expect((await denied.json() as { code: string }).code).toBe("SUPERADMIN_PERMISSION_REQUIRED");
  });

  it("membuat, memperbarui, mengaudit, dan menghapus role serta izin buatan", async () => {
    const cookie = await login("superadmin@mknsite.online", "superadmin12345");

    const permissionResponse = await request("/admin/rbac/permissions", cookie, "POST", {
      name: "QA Lihat Aset",
      slug: `${marker}.view`
    });
    expect(permissionResponse.status).toBe(201);
    const permission = await permissionResponse.json() as { data: { id: number; slug: string } };
    permissionId = permission.data.id;

    const duplicate = await request("/admin/rbac/permissions", cookie, "POST", {
      name: "QA Duplikat",
      slug: `${marker}.view`
    });
    expect(duplicate.status).toBe(409);

    const roleResponse = await request("/admin/rbac/roles", cookie, "POST", {
      name: "QA Auditor",
      slug: `${marker}-role`,
      permissionIds: [permissionId]
    });
    expect(roleResponse.status).toBe(201);
    const role = await roleResponse.json() as { data: { id: number; permissions: string[]; userCount: number } };
    roleId = role.data.id;
    expect(role.data.permissions).toEqual([`${marker}.view`]);
    expect(role.data.userCount).toBe(0);

    const protectedPermission = await request(`/admin/rbac/permissions/${permissionId}`, cookie, "DELETE");
    expect(protectedPermission.status).toBe(409);

    const updateRole = await request(`/admin/rbac/roles/${roleId}`, cookie, "PATCH", {
      name: "QA Auditor Diperbarui",
      permissionIds: []
    });
    expect(updateRole.status).toBe(200);
    expect((await updateRole.json() as { data: { name: string; permissions: string[] } }).data).toEqual(
      expect.objectContaining({ name: "QA Auditor Diperbarui", permissions: [] })
    );

    const updatePermission = await request(`/admin/rbac/permissions/${permissionId}`, cookie, "PATCH", {
      name: "QA Lihat Aset Diperbarui"
    });
    expect(updatePermission.status).toBe(200);

    const auditRows = await db.select({ action: auditLogs.action }).from(auditLogs).where(
      and(eq(auditLogs.resource, "role"), eq(auditLogs.resourceId, String(roleId)))
    );
    expect(auditRows.map((row) => row.action)).toEqual(expect.arrayContaining(["rbac.role.created", "rbac.role.updated"]));

    expect((await request(`/admin/rbac/roles/${roleId}`, cookie, "DELETE")).status).toBe(200);
    expect((await request(`/admin/rbac/permissions/${permissionId}`, cookie, "DELETE")).status).toBe(200);
  });

  it("melindungi role dan izin sistem serta memvalidasi permission ID", async () => {
    const cookie = await login("superadmin@mknsite.online", "superadmin12345");
    const rolesResponse = await request("/admin/rbac/roles", cookie);
    const roleList = await rolesResponse.json() as { data: Array<{ id: number; slug: string }> };
    const systemRole = roleList.data.find((item) => item.slug === "superadmin");
    expect(systemRole).toBeDefined();
    expect((await request(`/admin/rbac/roles/${systemRole!.id}`, cookie, "DELETE")).status).toBe(403);

    const permissionsResponse = await request("/admin/rbac/permissions", cookie);
    const permissionList = await permissionsResponse.json() as { data: Array<{ id: number; slug: string }> };
    const systemPermission = permissionList.data.find((item) => item.slug === "admin.security.manage");
    expect(systemPermission).toBeDefined();
    expect((await request(`/admin/rbac/permissions/${systemPermission!.id}`, cookie, "DELETE")).status).toBe(403);

    const invalid = await request("/admin/rbac/roles", cookie, "POST", {
      name: "QA Invalid",
      slug: `${marker}-invalid`,
      permissionIds: [2147483647]
    });
    expect(invalid.status).toBe(400);
    expect((await invalid.json() as { code: string }).code).toBe("INVALID_PERMISSIONS");
  });
});
