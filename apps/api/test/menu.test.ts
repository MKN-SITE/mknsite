import { describe, expect, it } from "bun:test";
import { and, eq } from "drizzle-orm";

import { db } from "../src/db";
import { auditLogs, menus } from "../src/db/schema";
import { app } from "./setup";

describe("Menu API", () => {
  it("menolak GET /menus tanpa sesi dengan HTTP 401", async () => {
    const response = await app.handle(new Request("http://localhost/menus"));
    expect(response.status).toBe(401);
    const body = (await response.json()) as { code: string; message: string };
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("menolak GET /admin/menus dan mutasi admin menu tanpa sesi admin", async () => {
    const getRes = await app.handle(new Request("http://localhost/admin/menus"));
    expect(getRes.status).toBe(401);

    const postRes = await app.handle(
      new Request("http://localhost/admin/menus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Menu Baru" })
      })
    );
    expect(postRes.status).toBe(401);

    const patchRes = await app.handle(
      new Request("http://localhost/admin/menus/1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Menu Edit" })
      })
    );
    expect(patchRes.status).toBe(401);

    const deleteRes = await app.handle(
      new Request("http://localhost/admin/menus/1", {
        method: "DELETE"
      })
    );
    expect(deleteRes.status).toBe(401);
  });

  it("mengembalikan menu yang sesuai dengan permission karyawan pada GET /menus", async () => {
    // Login sebagai HR (memiliki permission dashboard.view, hr.view, hr.manage)
    const loginRes = await app.handle(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "hr@mknsite.online", password: "demo12345" })
      })
    );
    expect(loginRes.status).toBe(200);
    const cookie = loginRes.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("mkn_employee.session_token=");

    const res = await app.handle(
      new Request("http://localhost/menus", {
        headers: { Cookie: cookie }
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ title: string; requiredPermission: string | null }> };

    expect(Array.isArray(body.data)).toBe(true);
    // HR harus bisa melihat Self-Service (dashboard.view) dan HR (hr.view)
    const titles = body.data.map((m) => m.title);
    expect(titles).toContain("Self-Service");
    expect(titles).toContain("HR");

    // HR TIDAK memiliki permission ops_telco.view, ops_workshop.view, project.view
    expect(titles).not.toContain("OPS Telco");
    expect(titles).not.toContain("OPS Workshop");
    expect(titles).not.toContain("Project");
  });

  it("mengizinkan admin membaca seluruh menu (GET /admin/menus), membuat (POST), mengedit (PATCH), dan menghapus (DELETE)", async () => {
    // 1. Login sebagai Admin
    const loginRes = await app.handle(
      new Request("http://localhost/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "admin@mknsite.online", password: "admin12345" })
      })
    );
    expect(loginRes.status).toBe(200);
    const adminCookie = loginRes.headers.get("set-cookie") ?? "";
    expect(adminCookie).toContain("mkn_admin.session_token=");

    // 2. GET /admin/menus mengembalikan semua menu default
    const listRes = await app.handle(
      new Request("http://localhost/admin/menus", {
        headers: { Cookie: adminCookie }
      })
    );
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as { data: Array<{ id: number; title: string }> };
    expect(listBody.data.length).toBeGreaterThanOrEqual(5);

    // 3. POST /admin/menus membuat menu baru
    const createRes = await app.handle(
      new Request("http://localhost/admin/menus", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
          Cookie: adminCookie
        },
        body: JSON.stringify({
          title: "Warehouse Portal",
          icon: "warehouse",
          description: "Manajemen logistik dan gudang",
          url: "/portal/warehouse",
          requiredPermission: "dashboard.view",
          sortOrder: 10,
          badgeCount: 3,
          badgeColor: "blue"
        })
      })
    );
    expect(createRes.status).toBe(201);
    const createBody = (await createRes.json()) as { data: { id: number; title: string; badgeCount: number; badgeColor: string } };
    const newMenuId = createBody.data.id;
    expect(newMenuId).toBeGreaterThan(0);
    expect(createBody.data.title).toBe("Warehouse Portal");
    expect(createBody.data.badgeCount).toBe(3);
    expect(createBody.data.badgeColor).toBe("blue");

    // Periksa audit log untuk pembuatan menu
    const [createAudit] = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.resource, "menu"), eq(auditLogs.resourceId, String(newMenuId))))
      .orderBy(auditLogs.id);
    expect(createAudit).toBeDefined();
    expect(createAudit?.action).toBe("menu.created");


    // 4. PATCH /admin/menus/:id memperbarui menu
    const patchRes = await app.handle(
      new Request(`http://localhost/admin/menus/${newMenuId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
          Cookie: adminCookie
        },
        body: JSON.stringify({
          title: "Warehouse & Supply",
          sortOrder: 12
        })
      })
    );
    expect(patchRes.status).toBe(200);
    const patchBody = (await patchRes.json()) as { data: { title: string; sortOrder: number } };
    expect(patchBody.data.title).toBe("Warehouse & Supply");
    expect(patchBody.data.sortOrder).toBe(12);

    // 5. DELETE /admin/menus/:id menghapus menu
    const deleteRes = await app.handle(
      new Request(`http://localhost/admin/menus/${newMenuId}`, {
        method: "DELETE",
        headers: {
          Origin: "http://localhost:3000",
          Cookie: adminCookie
        }
      })
    );
    expect(deleteRes.status).toBe(200);
    const deleteBody = (await deleteRes.json()) as { success: boolean };
    expect(deleteBody.success).toBe(true);

    // Verifikasi menu sudah terhapus dari database
    const [deletedRow] = await db.select().from(menus).where(eq(menus.id, newMenuId)).limit(1);
    expect(deletedRow).toBeUndefined();

    // 6. DELETE dan PATCH pada menu yang tidak ada mengembalikan 404
    const notFoundPatch = await app.handle(
      new Request(`http://localhost/admin/menus/999999`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
          Cookie: adminCookie
        },
        body: JSON.stringify({ title: "None" })
      })
    );
    expect(notFoundPatch.status).toBe(404);

    const notFoundDelete = await app.handle(
      new Request(`http://localhost/admin/menus/999999`, {
        method: "DELETE",
        headers: {
          Origin: "http://localhost:3000",
          Cookie: adminCookie
        }
      })
    );
    expect(notFoundDelete.status).toBe(404);
  });
});
