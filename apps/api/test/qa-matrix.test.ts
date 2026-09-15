import { describe, expect, it } from "bun:test";
import { app, createServer } from "../src/index";
import { db } from "../src/db";
import { authUsers, users } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { userProvisioningService } from "../src/services/user-provisioning";

describe("QA Matrix & Specification Regression Suite (Tiket Q01)", () => {
  // 1. Matriks Docs Lokal vs Production
  describe("1. Matriks OpenAPI Docs (Lokal vs Production)", () => {
    it("menyediakan Swagger UI dan OpenAPI JSON pada konfigurasi non-production default", async () => {
      const docsRes = await app.handle(new Request("http://localhost/docs"));
      expect(docsRes.status).toBe(200);
      const docsHtml = await docsRes.text();
      expect(docsHtml).toContain("swagger-ui");

      const jsonRes = await app.handle(new Request("http://localhost/docs/json"));
      expect(jsonRes.status).toBe(200);
      const jsonSpec = (await jsonRes.json()) as any;
      expect(jsonSpec.openapi.startsWith("3.")).toBe(true);
      expect(jsonSpec.info.title).toBe("MKN Site API");
      expect(jsonSpec.paths["/admin/users"]).toBeDefined();
    });

    it("menonaktifkan Swagger UI dan OpenAPI JSON (HTTP 404) ketika enableSwagger bernilai false (Production Default)", async () => {
      const prodApp = createServer({ enableSwagger: false });
      const docsRes = await prodApp.handle(new Request("http://localhost/docs"));
      expect(docsRes.status).toBe(404);

      const jsonRes = await prodApp.handle(new Request("http://localhost/docs/json"));
      expect(jsonRes.status).toBe(404);
    });
  });

  // 2. Matriks Autentikasi, Cookie, dan Isolasi Logout
  describe("2. Matriks Login & Isolasi Logout (Employee vs Admin)", () => {
    it("memastikan isolasi sesi: logout employee tidak memutus sesi admin, dan sebaliknya", async () => {
      // 1. Login HR (employee)
      const empLoginRes = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
          body: JSON.stringify({ email: "hr@mknsite.online", password: "demo12345" })
        })
      );
      expect(empLoginRes.status).toBe(200);
      const empCookie = empLoginRes.headers.get("set-cookie") ?? "";
      expect(empCookie).toContain("mkn_employee.session_token=");

      // 2. Login Admin
      const adminLoginRes = await app.handle(
        new Request("http://localhost/auth/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
          body: JSON.stringify({ email: "admin@mknsite.online", password: "admin12345" })
        })
      );
      expect(adminLoginRes.status).toBe(200);
      const adminCookie = adminLoginRes.headers.get("set-cookie") ?? "";
      expect(adminCookie).toContain("mkn_admin.session_token=");

      // 3. Verifikasi kedua sesi valid pada endpoint masing-masing
      const meBefore = await app.handle(new Request("http://localhost/auth/me", { headers: { Cookie: empCookie } }));
      expect(meBefore.status).toBe(200);

      const adminBefore = await app.handle(new Request("http://localhost/admin/users", { headers: { Cookie: adminCookie } }));
      expect(adminBefore.status).toBe(200);

      // 4. Logout Employee via POST /auth/logout
      const empLogoutRes = await app.handle(
        new Request("http://localhost/auth/logout", {
          method: "POST",
          headers: { Cookie: empCookie, Origin: "http://localhost:3000" }
        })
      );
      expect(empLogoutRes.status).toBe(200);

      // 5. Verifikasi Sesi Employee mati, tapi Sesi Admin TETAP HIDUP
      const meAfterEmpLogout = await app.handle(new Request("http://localhost/auth/me", { headers: { Cookie: empCookie } }));
      expect(meAfterEmpLogout.status).toBe(401);

      const adminStillAlive = await app.handle(new Request("http://localhost/admin/users", { headers: { Cookie: adminCookie } }));
      expect(adminStillAlive.status).toBe(200);

      // 6. Logout Admin via POST /auth/admin/logout
      const adminLogoutRes = await app.handle(
        new Request("http://localhost/auth/admin/logout", {
          method: "POST",
          headers: { Cookie: adminCookie, Origin: "http://localhost:3000" }
        })
      );
      expect(adminLogoutRes.status).toBe(200);

      // 7. Verifikasi Sesi Admin mati
      const adminAfterLogout = await app.handle(new Request("http://localhost/admin/users", { headers: { Cookie: adminCookie } }));
      expect(adminAfterLogout.status).toBe(401);
    });
  });

  // 3. Matriks Malformed JSON & Validasi Input
  describe("3. Matriks Malformed JSON & Validasi Input", () => {
    it("menolak request dengan body JSON malformed dengan HTTP 400 Bad Request", async () => {
      const loginRes = await app.handle(
        new Request("http://localhost/auth/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
          body: JSON.stringify({ email: "admin@mknsite.online", password: "admin12345" })
        })
      );
      const adminCookie = loginRes.headers.get("set-cookie") ?? "";

      const res = await app.handle(
        new Request("http://localhost/admin/users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: adminCookie,
            Origin: "http://localhost:3000"
          },
          body: '{"name": "Incomplete JSON, missing closing brace'
        })
      );
      expect(res.status).toBe(400);
    });
  });

  // 4. Matriks Hirarki Error Kontrak
  describe("4. Matriks Hirarki Status Error Kontrak (401, 403, 404, 409, 422, 400)", () => {
    it("memverifikasi seluruh kategori kode status error terpetakan secara konsisten", async () => {
      // 401: Unauthorized tanpa sesi
      const unauthRes = await app.handle(new Request("http://localhost/admin/users"));
      expect(unauthRes.status).toBe(401);

      // Login Admin untuk otorisasi selanjutnya
      const loginRes = await app.handle(
        new Request("http://localhost/auth/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
          body: JSON.stringify({ email: "admin@mknsite.online", password: "admin12345" })
        })
      );
      const adminCookie = loginRes.headers.get("set-cookie") ?? "";

      // 403: Forbidden saat mutasi dengan origin tidak diizinkan
      const badOriginRes = await app.handle(
        new Request("http://localhost/admin/users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: adminCookie,
            Origin: "http://evil-attacker.com"
          },
          body: JSON.stringify({ name: "Evil", email: "evil@mknsite.online", password: "Password12345!" })
        })
      );
      expect(badOriginRes.status).toBe(403);

      // 404: Not Found saat ID pengguna tidak ada
      const notFoundRes = await app.handle(
        new Request("http://localhost/admin/users/999999", {
          headers: { Cookie: adminCookie }
        })
      );
      expect(notFoundRes.status).toBe(404);

      // 409: Conflict saat email duplikat
      const conflictRes = await app.handle(
        new Request("http://localhost/admin/users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: adminCookie,
            Origin: "http://localhost:3000"
          },
          body: JSON.stringify({ name: "HR Duplicate", email: "hr@mknsite.online", password: "Password12345!" })
        })
      );
      expect(conflictRes.status).toBe(409);

      // 422: Unprocessable Entity saat validasi schema TypeBox gagal (password terlalu pendek)
      const unprocRes = await app.handle(
        new Request("http://localhost/admin/users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: adminCookie,
            Origin: "http://localhost:3000"
          },
          body: JSON.stringify({ name: "Short Pass", email: "shortpass@mknsite.online", password: "short" })
        })
      );
      expect(unprocRes.status).toBe(422);

      // 400: Bad Request saat body kosong tanpa perubahan pada PATCH
      const badReqRes = await app.handle(
        new Request("http://localhost/admin/users/2", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: adminCookie,
            Origin: "http://localhost:3000"
          },
          body: JSON.stringify({})
        })
      );
      expect(badReqRes.status).toBe(400);
    });
  });

  // 5. Matriks Atomisitas Transaksi & Pencegahan Orphan Identity
  describe("5. Matriks Atomisitas Transaksi & Pencegahan Data Yatim", () => {
    it("menjamin rollback penuh jika terjadi kegagalan pembuatan user (tidak ada data parsial tersimpan)", async () => {
      const duplicateEmail = "hr@mknsite.online";
      const countBeforeUsers = await db.select().from(users).where(eq(users.email, duplicateEmail));
      const countBeforeAuth = await db.select().from(authUsers).where(eq(authUsers.email, duplicateEmail));

      // Percobaan membuat user dengan email yang sudah ada
      const result = await userProvisioningService.createEmployee(
        {
          name: "Test Rollback",
          email: duplicateEmail,
          password: "SecurePassword123!",
          roleIds: []
        },
        1
      );

      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error.status).toBe(409);
        expect(result.error.code).toBe("EMAIL_ALREADY_EXISTS");
      }

      // Verifikasi data di database tidak bertambah sedikitpun
      const countAfterUsers = await db.select().from(users).where(eq(users.email, duplicateEmail));
      const countAfterAuth = await db.select().from(authUsers).where(eq(authUsers.email, duplicateEmail));

      expect(countAfterUsers.length).toBe(countBeforeUsers.length);
      expect(countAfterAuth.length).toBe(countBeforeAuth.length);
    });
  });

  // 6. Matriks Sanitasi Respons Data Bebas Kredensial
  describe("6. Matriks Sanitasi Data & Keamanan Kredensial", () => {
    it("menjamin seluruh respons user management bebas dari passwordHash, password, salt, dan token", async () => {
      const loginRes = await app.handle(
        new Request("http://localhost/auth/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
          body: JSON.stringify({ email: "admin@mknsite.online", password: "admin12345" })
        })
      );
      const adminCookie = loginRes.headers.get("set-cookie") ?? "";

      // 1. Cek GET /admin/users
      const listRes = await app.handle(new Request("http://localhost/admin/users", { headers: { Cookie: adminCookie } }));
      const listBody = (await listRes.json()) as any;
      expect(listBody.data).toBeDefined();
      for (const u of listBody.data) {
        expect(u.password).toBeUndefined();
        expect(u.passwordHash).toBeUndefined();
        expect(u.salt).toBeUndefined();
        expect(u.token).toBeUndefined();
      }

      // 2. Cek GET /admin/users/:id
      const sampleUserId = listBody.data[0].id;
      const detailRes = await app.handle(new Request(`http://localhost/admin/users/${sampleUserId}`, { headers: { Cookie: adminCookie } }));
      const detailBody = (await detailRes.json()) as any;
      expect(detailBody.data.password).toBeUndefined();
      expect(detailBody.data.passwordHash).toBeUndefined();
      expect(detailBody.data.salt).toBeUndefined();

      // 3. Cek GET /auth/admin/me
      const adminMeRes = await app.handle(new Request("http://localhost/auth/admin/me", { headers: { Cookie: adminCookie } }));
      const adminMeBody = (await adminMeRes.json()) as any;
      expect(adminMeBody.user.password).toBeUndefined();
      expect(adminMeBody.user.passwordHash).toBeUndefined();

      // 4. Cek GET /auth/me dengan cookie employee
      const empLogin = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
          body: JSON.stringify({ email: "hr@mknsite.online", password: "demo12345" })
        })
      );
      const empCookie = empLogin.headers.get("set-cookie") ?? "";
      const empMeRes = await app.handle(new Request("http://localhost/auth/me", { headers: { Cookie: empCookie } }));
      const empMeBody = (await empMeRes.json()) as any;
      expect(empMeBody.user.password).toBeUndefined();
      expect(empMeBody.user.passwordHash).toBeUndefined();

      // 5. Cek spesifikasi OpenAPI JSON di /docs/json tidak mendefinisikan field sensitif di UserSummary
      const specRes = await app.handle(new Request("http://localhost/docs/json"));
      const spec = (await specRes.json()) as any;
      const userSummaryProps = spec.components.schemas.UserSummary.properties;
      expect(userSummaryProps.password).toBeUndefined();
      expect(userSummaryProps.passwordHash).toBeUndefined();
      expect(userSummaryProps.salt).toBeUndefined();
    });
  });
});
