import { afterEach, describe, expect, it } from "bun:test";
import { and, eq } from "drizzle-orm";
import { db } from "../src/db";
import { auditLogs, divisions } from "../src/db/schema";
import { app } from "./setup";

let testDivisionId: number | null = null;

async function loginAdmin() {
  const response = await app.handle(
    new Request("http://localhost/auth/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
      body: JSON.stringify({ email: "admin@mknsite.online", password: "admin12345" })
    })
  );
  expect(response.status).toBe(200);
  return response.headers.get("set-cookie") ?? "";
}

function req(path: string, cookie?: string, method = "GET", body?: unknown) {
  return app.handle(
    new Request(`http://localhost${path}`, {
      method,
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        Origin: "http://localhost:3000",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {})
      },
      body: body !== undefined ? JSON.stringify(body) : undefined
    })
  );
}

afterEach(async () => {
  if (testDivisionId) {
    await db.delete(divisions).where(eq(divisions.id, testDivisionId));
    await db.delete(auditLogs).where(
      and(eq(auditLogs.resource, "division"), eq(auditLogs.resourceId, String(testDivisionId)))
    );
    testDivisionId = null;
  }
});

describe("Division CRUD API", () => {
  it("menolak GET /admin/divisions tanpa sesi dengan HTTP 401", async () => {
    const res = await req("/admin/divisions");
    expect(res.status).toBe(401);
  });

  it("mengizinkan admin membaca daftar divisi beserta jumlah pengguna", async () => {
    const cookie = await loginAdmin();
    const res = await req("/admin/divisions", cookie);
    expect(res.status).toBe(200);

    const body = (await res.json()) as { data: any[] };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);

    const itDiv = body.data.find((d) => d.name === "Teknologi Informasi");
    expect(itDiv).toBeDefined();
    expect(typeof itDiv.userCount).toBe("number");
    expect(itDiv.userCount).toBeGreaterThanOrEqual(1); // System Administrator
  });

  it("membuat, mengupdate, dan menghapus divisi baru secara lengkap", async () => {
    const cookie = await loginAdmin();
    const uniqueName = `Divisi Uji Coba QA ${Date.now()}`;

    // 1. Create
    const createRes = await req("/admin/divisions", cookie, "POST", {
      name: uniqueName,
      description: "Unit kerja khusus untuk pengujian QA"
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { data: any };
    expect(created.data.name).toBe(uniqueName);
    expect(created.data.description).toBe("Unit kerja khusus untuk pengujian QA");
    expect(created.data.userCount).toBe(0);
    testDivisionId = created.data.id;

    // 2. Reject duplicate
    const dupeRes = await req("/admin/divisions", cookie, "POST", {
      name: uniqueName,
      description: "Duplikat"
    });
    expect(dupeRes.status).toBe(409);

    // 3. Update description and name
    const updatedName = `${uniqueName} (Updated)`;
    const updateRes = await req(`/admin/divisions/${testDivisionId}`, cookie, "PATCH", {
      name: updatedName,
      description: "Deskripsi berhasil diperbarui"
    });
    expect(updateRes.status).toBe(200);
    const updated = (await updateRes.json()) as { data: any };
    expect(updated.data.name).toBe(updatedName);
    expect(updated.data.description).toBe("Deskripsi berhasil diperbarui");

    // 4. Delete
    const deleteRes = await req(`/admin/divisions/${testDivisionId}`, cookie, "DELETE");
    expect(deleteRes.status).toBe(200);
    testDivisionId = null; // Sudah terhapus

    // 5. Verify 404 after delete
    const getRes = await req(`/admin/divisions/${created.data.id}`, cookie, "DELETE");
    expect(getRes.status).toBe(404);
  });

  it("menolak penghapusan divisi yang masih memiliki pengguna aktif", async () => {
    const cookie = await loginAdmin();
    const listRes = await req("/admin/divisions", cookie);
    const body = (await listRes.json()) as { data: any[] };

    // Cari divisi yang punya userCount > 0 (misal: Teknologi Informasi)
    const inUseDiv = body.data.find((d) => d.userCount > 0);
    expect(inUseDiv).toBeDefined();

    const deleteRes = await req(`/admin/divisions/${inUseDiv.id}`, cookie, "DELETE");
    expect(deleteRes.status).toBe(409);
    const errBody = (await deleteRes.json()) as { code: string; message: string };
    expect(errBody.code).toBe("DIVISION_IN_USE");
    expect(errBody.message).toContain("masih digunakan");
  });
});
