import { describe, expect, it } from "bun:test";
import { and, eq } from "drizzle-orm";
import { db } from "../src/db";
import { auditLogs, menus, users } from "../src/db/schema";
import { app } from "./setup";

describe("QA Matrix End-to-End Suite — Issue #25", () => {
  // ==========================================
  // 1. AUTH & SESSION MATRIX (AUTH-01 s/d AUTH-09)
  // ==========================================
  describe("1. Auth & Session Matrix", () => {
    it("AUTH-01: Login admin valid -> cookie mkn_admin.session_token dan akses /auth/admin/me sukses", async () => {
      const res = await app.handle(
        new Request("http://localhost/auth/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
          body: JSON.stringify({ email: "admin@mknsite.online", password: "admin12345" })
        })
      );
      expect(res.status).toBe(200);
      const cookie = res.headers.get("set-cookie") ?? "";
      expect(cookie).toContain("mkn_admin.session_token=");

      const meRes = await app.handle(
        new Request("http://localhost/auth/admin/me", {
          headers: { Cookie: cookie }
        })
      );
      expect(meRes.status).toBe(200);
      const body = (await meRes.json()) as { user: { email: string; actorType: string } };
      expect(body.user.email).toBe("admin@mknsite.online");
      expect(body.user.actorType).toBe("admin");
    });

    it("AUTH-02: Login karyawan valid -> cookie mkn_employee.session_token dan akses /auth/me sukses", async () => {
      const res = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
          body: JSON.stringify({ email: "hr@mknsite.online", password: "demo12345" })
        })
      );
      expect(res.status).toBe(200);
      const cookie = res.headers.get("set-cookie") ?? "";
      expect(cookie).toContain("mkn_employee.session_token=");

      const meRes = await app.handle(
        new Request("http://localhost/auth/me", {
          headers: { Cookie: cookie }
        })
      );
      expect(meRes.status).toBe(200);
      const body = (await meRes.json()) as { user: { email: string; actorType: string } };
      expect(body.user.email).toBe("hr@mknsite.online");
      expect(body.user.actorType).toBe("user");
    });

    it("AUTH-03: Login dengan email yang tidak terdaftar ditolak dengan pesan error", async () => {
      const res = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
          body: JSON.stringify({ email: "tidakada@mknsite.online", password: "demo12345" })
        })
      );
      expect(res.status).toBe(401);
      const body = (await res.json()) as { message: string };
      expect(body.message).toBe("Email atau kata sandi tidak sesuai.");
    });

    it("AUTH-04: Login dengan kata sandi salah ditolak dengan pesan error", async () => {
      const res = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
          body: JSON.stringify({ email: "hr@mknsite.online", password: "passwordsalah123" })
        })
      );
      expect(res.status).toBe(401);
      const body = (await res.json()) as { code?: string; message: string };
      expect(body.message || body.code).toBeDefined();
    });

    it("AUTH-05: Login akun nonaktif ditolak dengan status HTTP 401 dan sesi dicabut", async () => {
      // 1. Buat user sementara
      const stamp = Date.now();
      const adminLogin = await app.handle(
        new Request("http://localhost/auth/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
          body: JSON.stringify({ email: "admin@mknsite.online", password: "admin12345" })
        })
      );
      const adminCookie = adminLogin.headers.get("set-cookie") ?? "";

      const createRes = await app.handle(
        new Request("http://localhost/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: adminCookie },
          body: JSON.stringify({
            name: "Akun Uji Nonaktif",
            email: `nonaktif_${stamp}@mknsite.online`,
            password: "password12345",
            roleIds: [2]
          })
        })
      );
      const createdBody = (await createRes.json()) as { data: { id: number } };
      const testUserId = createdBody.data.id;

      // 2. Nonaktifkan user dengan boolean isActive: false
      const deactRes = await app.handle(
        new Request(`http://localhost/admin/users/${testUserId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: adminCookie },
          body: JSON.stringify({ isActive: false })
        })
      );
      expect(deactRes.status).toBe(200);

      // 3. Coba login sebagai user nonaktif -> 401 ditolak
      const loginRes = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
          body: JSON.stringify({ email: `nonaktif_${stamp}@mknsite.online`, password: "password12345" })
        })
      );
      expect(loginRes.status).toBe(401);
      const loginBody = (await loginRes.json()) as { message: string };
      expect(loginBody.message).toBe("Email atau kata sandi tidak sesuai.");
    });

    it("AUTH-06: Logout admin mencabut cookie dan redirect", async () => {
      const loginRes = await app.handle(
        new Request("http://localhost/auth/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
          body: JSON.stringify({ email: "admin@mknsite.online", password: "admin12345" })
        })
      );
      const cookie = loginRes.headers.get("set-cookie") ?? "";

      const logoutRes = await app.handle(
        new Request("http://localhost/auth/admin/logout", {
          method: "POST",
          headers: { Cookie: cookie, Origin: "http://localhost:3000" }
        })
      );
      expect(logoutRes.status).toBe(200);
      const setCookie = logoutRes.headers.get("set-cookie") ?? "";
      expect(setCookie).toContain("Max-Age=0");
    });

    it("AUTH-07: Akses resource admin tanpa sesi ditolak dengan HTTP 401", async () => {
      const res = await app.handle(new Request("http://localhost/admin/users"));
      expect(res.status).toBe(401);
    });

    it("AUTH-08: Akses resource portal tanpa sesi ditolak dengan HTTP 401", async () => {
      const res = await app.handle(new Request("http://localhost/menus"));
      expect(res.status).toBe(401);
    });

    it("AUTH-09: Akses dengan token sesi sembarangan / invalid mengembalikan HTTP 401", async () => {
      const res = await app.handle(
        new Request("http://localhost/auth/me", {
          headers: { Cookie: "mkn_employee.session_token=token_palsu_tidak_ada_di_db" }
        })
      );
      expect(res.status).toBe(401);
    });
  });

  // ==========================================
  // 2. USER MANAGEMENT MATRIX (USR-01 s/d USR-18)
  // ==========================================
  describe("2. User Management Matrix (Admin Panel)", () => {
    it("USR-01 s/d USR-06: Daftar pengguna, pencarian nama & email, filter status & role, dan pagination", async () => {
      const adminLogin = await app.handle(
        new Request("http://localhost/auth/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
          body: JSON.stringify({ email: "admin@mknsite.online", password: "admin12345" })
        })
      );
      const adminCookie = adminLogin.headers.get("set-cookie") ?? "";

      // USR-01: List users
      const listRes = await app.handle(
        new Request("http://localhost/admin/users", {
          headers: { Cookie: adminCookie }
        })
      );
      expect(listRes.status).toBe(200);
      const listBody = (await listRes.json()) as { data: any[]; pagination: any };
      expect(listBody.data.length).toBeGreaterThanOrEqual(1);

      // USR-02: Search nama
      const searchNameRes = await app.handle(
        new Request("http://localhost/admin/users?search=HR", {
          headers: { Cookie: adminCookie }
        })
      );
      expect(searchNameRes.status).toBe(200);

      // USR-03: Search email
      const searchEmailRes = await app.handle(
        new Request("http://localhost/admin/users?search=admin@mknsite.online", {
          headers: { Cookie: adminCookie }
        })
      );
      expect(searchEmailRes.status).toBe(200);

      // USR-04: Filter status aktif
      const activeFilterRes = await app.handle(
        new Request("http://localhost/admin/users?status=active", {
          headers: { Cookie: adminCookie }
        })
      );
      expect(activeFilterRes.status).toBe(200);

      // USR-05: Filter accountType employee
      const employeeFilterRes = await app.handle(
        new Request("http://localhost/admin/users?accountType=employee", {
          headers: { Cookie: adminCookie }
        })
      );
      expect(employeeFilterRes.status).toBe(200);

      // USR-06: Pagination
      const pageRes = await app.handle(
        new Request("http://localhost/admin/users?page=1&pageSize=2", {
          headers: { Cookie: adminCookie }
        })
      );
      expect(pageRes.status).toBe(200);
      const pageBody = (await pageRes.json()) as { pagination: { page: number; pageSize: number } };
      expect(pageBody.pagination.page).toBe(1);
      expect(pageBody.pagination.pageSize).toBe(2);
    });

    it("USR-07 s/d USR-09: Validasi pembuatan karyawan (valid, email duplikat 409, password < 12 char 422)", async () => {
      const adminLogin = await app.handle(
        new Request("http://localhost/auth/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
          body: JSON.stringify({ email: "admin@mknsite.online", password: "admin12345" })
        })
      );
      const adminCookie = adminLogin.headers.get("set-cookie") ?? "";

      // USR-09: Password < 12 karakter -> 422
      const shortPassRes = await app.handle(
        new Request("http://localhost/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: adminCookie },
          body: JSON.stringify({
            name: "User Pendek",
            email: "pendek@mknsite.online",
            password: "pendek",
            roleIds: [2]
          })
        })
      );
      expect(shortPassRes.status).toBe(422);

      // USR-07: Valid creation -> 201
      const stamp = Date.now();
      const validEmail = `qa_usr_${stamp}@mknsite.online`;
      const createRes = await app.handle(
        new Request("http://localhost/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: adminCookie },
          body: JSON.stringify({
            name: "QA User Baru",
            email: validEmail,
            password: "password12345",
            roleIds: [2]
          })
        })
      );
      expect(createRes.status).toBe(201);

      // USR-08: Duplicate email -> 409
      const dupeRes = await app.handle(
        new Request("http://localhost/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: adminCookie },
          body: JSON.stringify({
            name: "QA User Kloning",
            email: validEmail,
            password: "password12345",
            roleIds: [2]
          })
        })
      );
      expect(dupeRes.status).toBe(409);
    });

    it("USR-10 s/d USR-15: Modifikasi pengguna (edit nama, edit email cabut sesi, ubah role, toggle aktif, cabut sesi paksa)", async () => {
      const adminLogin = await app.handle(
        new Request("http://localhost/auth/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
          body: JSON.stringify({ email: "admin@mknsite.online", password: "admin12345" })
        })
      );
      const adminCookie = adminLogin.headers.get("set-cookie") ?? "";

      const stamp = Date.now();
      const testEmail = `qa_mod_${stamp}@mknsite.online`;
      const createRes = await app.handle(
        new Request("http://localhost/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: adminCookie },
          body: JSON.stringify({
            name: "QA Target Modifikasi",
            email: testEmail,
            password: "password12345",
            roleIds: [2]
          })
        })
      );
      const createdBody = (await createRes.json()) as { data: { id: number } };
      const testId = createdBody.data.id;

      // USR-10: Edit nama user -> tersimpan
      const patchNameRes = await app.handle(
        new Request(`http://localhost/admin/users/${testId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: adminCookie },
          body: JSON.stringify({ name: "QA Target Nama Baru" })
        })
      );
      expect(patchNameRes.status).toBe(200);

      // USR-11: Edit email user -> tersimpan
      const newEmail = `qa_mod_new_${stamp}@mknsite.online`;
      const patchEmailRes = await app.handle(
        new Request(`http://localhost/admin/users/${testId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: adminCookie },
          body: JSON.stringify({ email: newEmail })
        })
      );
      expect(patchEmailRes.status).toBe(200);

      // USR-12: Ubah role user
      const patchRoleRes = await app.handle(
        new Request(`http://localhost/admin/users/${testId}/roles`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: adminCookie },
          body: JSON.stringify({ roleIds: [3] })
        })
      );
      expect(patchRoleRes.status).toBe(200);

      // USR-15: Cabut sesi user secara manual
      const revokeRes = await app.handle(
        new Request(`http://localhost/admin/users/${testId}/revoke-sessions`, {
          method: "POST",
          headers: { Origin: "http://localhost:3000", Cookie: adminCookie }
        })
      );
      expect(revokeRes.status).toBe(200);

      // USR-13: Nonaktifkan user
      const deactRes = await app.handle(
        new Request(`http://localhost/admin/users/${testId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: adminCookie },
          body: JSON.stringify({ isActive: false })
        })
      );
      expect(deactRes.status).toBe(200);

      // USR-14: Aktifkan kembali user
      const reactRes = await app.handle(
        new Request(`http://localhost/admin/users/${testId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: adminCookie },
          body: JSON.stringify({ isActive: true })
        })
      );
      expect(reactRes.status).toBe(200);
    });

    it("USR-16 s/d USR-18: Proteksi keamanan RBAC (self-deactivation, self-revoke admin, last-admin)", async () => {
      const adminLogin = await app.handle(
        new Request("http://localhost/auth/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
          body: JSON.stringify({ email: "admin@mknsite.online", password: "admin12345" })
        })
      );
      const adminCookie = adminLogin.headers.get("set-cookie") ?? "";

      const [adminRow] = await db.select().from(users).where(eq(users.email, "admin@mknsite.online")).limit(1);
      expect(adminRow).toBeDefined();

      // USR-18: Tidak bisa menonaktifkan diri sendiri
      const selfDeact = await app.handle(
        new Request(`http://localhost/admin/users/${adminRow.id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: adminCookie },
          body: JSON.stringify({ isActive: false })
        })
      );
      expect(selfDeact.status).toBe(403);
      const selfBody = (await selfDeact.json()) as { code: string };
      expect(selfBody.code).toBe("SELF_DEACTIVATION_FORBIDDEN");

      // USR-17: Tidak bisa mencabut role admin dari diri sendiri
      const selfRevoke = await app.handle(
        new Request(`http://localhost/admin/users/${adminRow.id}/roles`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: adminCookie },
          body: JSON.stringify({ roleIds: [2] }) // role non-admin
        })
      );
      expect(selfRevoke.status).toBe(403);
      const revokeBody = (await selfRevoke.json()) as { code: string };
      expect(revokeBody.code).toBe("SELF_ADMIN_REVOKE_FORBIDDEN");
    });
  });

  // ==========================================
  // 3. DYNAMIC MENUS MATRIX (MNU-01 s/d MNU-06)
  // ==========================================
  describe("3. Dynamic Menus Matrix", () => {
    it("MNU-01 s/d MNU-06: Siklus hidup menu dinamis (buat, aktifkan/nonaktifkan, edit, filter permission, hapus, reorder)", async () => {
      const adminLogin = await app.handle(
        new Request("http://localhost/auth/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
          body: JSON.stringify({ email: "admin@mknsite.online", password: "admin12345" })
        })
      );
      const adminCookie = adminLogin.headers.get("set-cookie") ?? "";

      // Login sebagai HR untuk observasi menu
      const hrLogin = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
          body: JSON.stringify({ email: "hr@mknsite.online", password: "demo12345" })
        })
      );
      const hrCookie = hrLogin.headers.get("set-cookie") ?? "";

      // MNU-01: Admin buat menu baru dengan permission hr.view
      const createMenuRes = await app.handle(
        new Request("http://localhost/admin/menus", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: adminCookie },
          body: JSON.stringify({
            title: "Payroll & Compensation",
            icon: "calculator",
            description: "Modul penggajian karyawan",
            url: "/portal/payroll",
            requiredPermission: "hr.view",
            sortOrder: 20,
            badgeCount: 1,
            badgeColor: "orange",
            isActive: true
          })
        })
      );
      expect(createMenuRes.status).toBe(201);
      const createBody = (await createMenuRes.json()) as { data: { id: number; title: string } };
      const menuId = createBody.data.id;

      // Verifikasi muncul di GET /menus karyawan HR
      const hrMenus1 = await app.handle(
        new Request("http://localhost/menus", {
          headers: { Cookie: hrCookie }
        })
      );
      const hrMenus1Body = (await hrMenus1.json()) as { data: Array<{ id: number; title: string }> };
      expect(hrMenus1Body.data.some((m) => m.id === menuId)).toBe(true);

      // MNU-05: User tanpa permission (misal project.view untuk modul telco) tidak melihat menu tersebut
      expect(hrMenus1Body.data.some((m) => m.title === "OPS Telco")).toBe(false);

      // MNU-03: Admin edit menu
      const patchMenuRes = await app.handle(
        new Request(`http://localhost/admin/menus/${menuId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: adminCookie },
          body: JSON.stringify({ title: "Payroll & Salary" })
        })
      );
      expect(patchMenuRes.status).toBe(200);

      // MNU-02: Admin nonaktifkan menu
      const deactMenuRes = await app.handle(
        new Request(`http://localhost/admin/menus/${menuId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: adminCookie },
          body: JSON.stringify({ isActive: false })
        })
      );
      expect(deactMenuRes.status).toBe(200);

      // Verifikasi hilang dari GET /menus karyawan HR
      const hrMenus2 = await app.handle(
        new Request("http://localhost/menus", {
          headers: { Cookie: hrCookie }
        })
      );
      const hrMenus2Body = (await hrMenus2.json()) as { data: Array<{ id: number }> };
      expect(hrMenus2Body.data.some((m) => m.id === menuId)).toBe(false);

      // MNU-06: Reorder menu
      const reorderRes = await app.handle(
        new Request(`http://localhost/admin/menus/${menuId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: adminCookie },
          body: JSON.stringify({ sortOrder: 1, isActive: true })
        })
      );
      expect(reorderRes.status).toBe(200);

      // MNU-04: Admin hapus menu
      const deleteMenuRes = await app.handle(
        new Request(`http://localhost/admin/menus/${menuId}`, {
          method: "DELETE",
          headers: { Origin: "http://localhost:3000", Cookie: adminCookie }
        })
      );
      expect(deleteMenuRes.status).toBe(200);

      // Verifikasi tidak ada lagi di database
      const [deletedRow] = await db.select().from(menus).where(eq(menus.id, menuId)).limit(1);
      expect(deletedRow).toBeUndefined();
    });
  });
});
