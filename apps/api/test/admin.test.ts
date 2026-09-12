import { afterAll, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { authUsers, users } from "../src/db/schema";
import { app, cleanTestUsers } from "./setup";

describe("Admin API", () => {
  it("menolak mutasi admin tanpa sesi dengan HTTP 401 dan skema error standar", async () => {
    const response = await app.handle(
      new Request("http://localhost/admin/users/1/roles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleIds: [] })
      })
    );
    expect(response.status).toBe(401);
    const body = (await response.json()) as { code: string; message: string };
    expect(body.code).toBe("UNAUTHORIZED");
    expect(body.message).toContain("Sesi administrator tidak valid");
  });

  it("menolak mutasi admin dari origin tidak diizinkan dengan HTTP 403 INVALID_ORIGIN", async () => {
    const response = await app.handle(
      new Request("http://localhost/admin/users/1/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Origin: "http://evil.com" },
        body: JSON.stringify({ isActive: false })
      })
    );
    expect(response.status).toBe(403);
    const body = (await response.json()) as { code: string; message: string };
    expect(body.code).toBe("INVALID_ORIGIN");
    expect(body.message).toContain("Origin permintaan tidak diizinkan");
  });

  it("menolak akses read admin (users, users/:id, roles) tanpa sesi admin valid", async () => {
    const resUsers = await app.handle(new Request("http://localhost/admin/users"));
    expect(resUsers.status).toBe(401);
    const bodyUsers = (await resUsers.json()) as { code: string; message: string };
    expect(bodyUsers.code).toBe("UNAUTHORIZED");

    const resUserDetail = await app.handle(new Request("http://localhost/admin/users/1"));
    expect(resUserDetail.status).toBe(401);
    const bodyDetail = (await resUserDetail.json()) as { code: string; message: string };
    expect(bodyDetail.code).toBe("UNAUTHORIZED");

    const resRoles = await app.handle(new Request("http://localhost/admin/roles"));
    expect(resRoles.status).toBe(401);
    const bodyRoles = (await resRoles.json()) as { code: string; message: string };
    expect(bodyRoles.code).toBe("UNAUTHORIZED");
  });

  it("menolak query parameter invalid pada GET /admin/users dengan HTTP 422", async () => {
    const resPageSize = await app.handle(new Request("http://localhost/admin/users?pageSize=150"));
    expect(resPageSize.status).toBe(422);

    const resStatus = await app.handle(new Request("http://localhost/admin/users?status=invalid_status"));
    expect(resStatus.status).toBe(422);

    const resAccountType = await app.handle(new Request("http://localhost/admin/users?accountType=invalid_type"));
    expect(resAccountType.status).toBe(422);
  });

  it("mengizinkan admin membaca daftar pengguna dengan pagination, filter, dan sanitasi penuh", async () => {
    const loginRes = await app.handle(
      new Request("http://localhost/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "admin@mknsite.online", password: "admin12345" })
      })
    );
    expect(loginRes.status).toBe(200);
    const cookie = loginRes.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("mkn_admin.session_token=");

    const res = await app.handle(
      new Request("http://localhost/admin/users", {
        headers: { Cookie: cookie }
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: Array<Record<string, unknown>>;
      pagination: { page: number; pageSize: number; total: number; totalPages: number };
    };

    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(6);
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.pageSize).toBe(20);
    expect(body.pagination.total).toBeGreaterThanOrEqual(6);
    expect(body.pagination.totalPages).toBeGreaterThanOrEqual(1);

    for (const item of body.data) {
      expect(typeof item.id).toBe("number");
      expect(typeof item.name).toBe("string");
      expect(typeof item.email).toBe("string");
      expect(["employee", "admin"]).toContain(item.accountType as string);
      expect(typeof item.isActive).toBe("boolean");
      expect(Array.isArray(item.roles)).toBe(true);
      expect(typeof item.createdAt).toBe("string");
      expect(typeof item.updatedAt).toBe("string");

      expect(item.passwordHash).toBeUndefined();
      expect(item.password).toBeUndefined();
      expect(item.token).toBeUndefined();
      expect(item.accessToken).toBeUndefined();
    }

    const searchRes = await app.handle(
      new Request("http://localhost/admin/users?search=Ayu", {
        headers: { Cookie: cookie }
      })
    );
    expect(searchRes.status).toBe(200);
    const searchBody = (await searchRes.json()) as { data: Array<{ name: string; email: string }> };
    expect(searchBody.data.length).toBeGreaterThanOrEqual(1);
    expect(searchBody.data.some((u) => u.name.includes("Ayu"))).toBe(true);

    const adminTypeRes = await app.handle(
      new Request("http://localhost/admin/users?accountType=admin", {
        headers: { Cookie: cookie }
      })
    );
    expect(adminTypeRes.status).toBe(200);
    const adminTypeBody = (await adminTypeRes.json()) as { data: Array<{ accountType: string }> };
    expect(adminTypeBody.data.length).toBeGreaterThanOrEqual(1);
    expect(adminTypeBody.data.every((u) => u.accountType === "admin")).toBe(true);

    const empTypeRes = await app.handle(
      new Request("http://localhost/admin/users?accountType=employee", {
        headers: { Cookie: cookie }
      })
    );
    expect(empTypeRes.status).toBe(200);
    const empTypeBody = (await empTypeRes.json()) as { data: Array<{ accountType: string }> };
    expect(empTypeBody.data.length).toBeGreaterThanOrEqual(1);
    expect(empTypeBody.data.every((u) => u.accountType === "employee")).toBe(true);

    const pageRes = await app.handle(
      new Request("http://localhost/admin/users?page=1&pageSize=2", {
        headers: { Cookie: cookie }
      })
    );
    expect(pageRes.status).toBe(200);
    const pageBody = (await pageRes.json()) as {
      data: unknown[];
      pagination: { page: number; pageSize: number; totalPages: number };
    };
    expect(pageBody.data.length).toBe(2);
    expect(pageBody.pagination.pageSize).toBe(2);
    expect(pageBody.pagination.totalPages).toBeGreaterThanOrEqual(3);

    const emptyPageRes = await app.handle(
      new Request("http://localhost/admin/users?page=999&pageSize=20", {
        headers: { Cookie: cookie }
      })
    );
    expect(emptyPageRes.status).toBe(200);
    const emptyPageBody = (await emptyPageRes.json()) as { data: unknown[] };
    expect(emptyPageBody.data).toEqual([]);
  });

  it("mengizinkan admin membaca detail pengguna tunggal dan mengembalikan 404 jika tidak ada", async () => {
    const loginRes = await app.handle(
      new Request("http://localhost/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "admin@mknsite.online", password: "admin12345" })
      })
    );
    const cookie = loginRes.headers.get("set-cookie") ?? "";

    const listRes = await app.handle(
      new Request("http://localhost/admin/users", {
        headers: { Cookie: cookie }
      })
    );
    const listBody = (await listRes.json()) as { data: Array<{ id: number; roles?: Array<unknown> }> };
    const targetUser = listBody.data.find((u) => u.roles && u.roles.length > 0) ?? listBody.data[0];

    const res = await app.handle(
      new Request(`http://localhost/admin/users/${targetUser.id}`, {
        headers: { Cookie: cookie }
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: Record<string, unknown> & { id: number; name: string; roles: Array<{ id: number; name: string; slug: string }> };
    };
    expect(body.data).toBeDefined();
    expect(body.data.id).toBe(targetUser.id);
    expect(typeof body.data.name).toBe("string");
    expect(Array.isArray(body.data.roles)).toBe(true);
    expect(body.data.roles.length).toBeGreaterThanOrEqual(1);
    expect(typeof body.data.isActive).toBe("boolean");

    expect(body.data.passwordHash).toBeUndefined();
    expect(body.data.password).toBeUndefined();

    const notFoundRes = await app.handle(
      new Request("http://localhost/admin/users/99999", {
        headers: { Cookie: cookie }
      })
    );
    expect(notFoundRes.status).toBe(404);
    const notFoundBody = (await notFoundRes.json()) as { code: string; message: string };
    expect(notFoundBody.code).toBe("USER_NOT_FOUND");
    expect(notFoundBody.message).toContain("Pengguna tidak ditemukan");
  });

  it("mengizinkan admin membaca daftar role dan matriks permission", async () => {
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
    const body = (await res.json()) as {
      data: Array<{ id: number; name: string; slug: string; permissions: string[] }>;
    };

    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(5);

    const adminRole = body.data.find((r) => r.slug === "administrator");
    expect(adminRole).toBeDefined();
    expect(adminRole?.permissions).toContain("admin.manage");

    const hrRole = body.data.find((r) => r.slug === "hr");
    expect(hrRole).toBeDefined();
    expect(hrRole?.permissions).toContain("hr.manage");
    expect(hrRole?.permissions).toContain("dashboard.view");
  });

  it("menolak POST /admin/users tanpa sesi admin dengan HTTP 401", async () => {
    const res = await app.handle(
      new Request("http://localhost/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test Employee",
          email: "test.employee@mknsite.online",
          password: "password12345"
        })
      })
    );
    expect(res.status).toBe(401);
  });

  it("menolak POST /admin/users dengan input tidak valid (password < 12 karakter atau email invalid) dengan HTTP 422", async () => {
    const loginRes = await app.handle(
      new Request("http://localhost/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "admin@mknsite.online", password: "admin12345" })
      })
    );
    const cookie = loginRes.headers.get("set-cookie") ?? "";

    // 1. Password kurang dari 12 karakter
    const shortPassRes = await app.handle(
      new Request("http://localhost/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: cookie },
        body: JSON.stringify({
          name: "Budi Santoso",
          email: "budi@mknsite.online",
          password: "pendek"
        })
      })
    );
    expect(shortPassRes.status).toBe(422);

    // 2. Format email salah
    const badEmailRes = await app.handle(
      new Request("http://localhost/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: cookie },
        body: JSON.stringify({
          name: "Budi Santoso",
          email: "bukan-email",
          password: "password123456"
        })
      })
    );
    expect(badEmailRes.status).toBe(422);
  });

  it("menolak pemberian role administrator pada pembuatan karyawan dengan HTTP 403", async () => {
    const loginRes = await app.handle(
      new Request("http://localhost/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "admin@mknsite.online", password: "admin12345" })
      })
    );
    const cookie = loginRes.headers.get("set-cookie") ?? "";

    // Role 6 adalah Administrator (memuat permission admin.manage)
    const res = await app.handle(
      new Request("http://localhost/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: cookie },
        body: JSON.stringify({
          name: "Karyawan Ilegal",
          email: "ilegal@mknsite.online",
          password: "password123456",
          roleIds: [6]
        })
      })
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string; message: string };
    expect(body.code).toBe("ADMIN_ROLE_FORBIDDEN");
    expect(body.message).toContain("tidak boleh memiliki hak akses administrator");
  });

  it("menolak roleId yang tidak terdaftar di database dengan HTTP 400", async () => {
    const loginRes = await app.handle(
      new Request("http://localhost/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "admin@mknsite.online", password: "admin12345" })
      })
    );
    const cookie = loginRes.headers.get("set-cookie") ?? "";

    const res = await app.handle(
      new Request("http://localhost/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: cookie },
        body: JSON.stringify({
          name: "Role Fiktif",
          email: "fiktif@mknsite.online",
          password: "password123456",
          roleIds: [99999]
        })
      })
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string; message: string };
    expect(body.code).toBe("INVALID_ROLES");
  });

  it("menolak email duplikat dengan HTTP 409 EMAIL_ALREADY_EXISTS", async () => {
    const loginRes = await app.handle(
      new Request("http://localhost/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "admin@mknsite.online", password: "admin12345" })
      })
    );
    const cookie = loginRes.headers.get("set-cookie") ?? "";

    // hr@mknsite.online sudah ada di seed database
    const res = await app.handle(
      new Request("http://localhost/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: cookie },
        body: JSON.stringify({
          name: "Ayu Kloning",
          email: "hr@mknsite.online",
          password: "password123456"
        })
      })
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { code: string; message: string };
    expect(body.code).toBe("EMAIL_ALREADY_EXISTS");
    expect(body.message).toContain("Email sudah terdaftar");
  });

  it("berhasil membuat akun karyawan baru secara atomik, sanitasi respons, dan akun dapat langsung login", async () => {
    const loginRes = await app.handle(
      new Request("http://localhost/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "admin@mknsite.online", password: "admin12345" })
      })
    );
    const cookie = loginRes.headers.get("set-cookie") ?? "";

    const uniqueTimestamp = Date.now();
    const newEmail = `employee.${uniqueTimestamp}@mknsite.online`;
    const newPassword = "PasswordKaryawanBaru123!";

    // 1. Eksekusi pembuatan user
    const createRes = await app.handle(
      new Request("http://localhost/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: cookie },
        body: JSON.stringify({
          name: "Karyawan Baru Terverifikasi",
          email: newEmail,
          password: newPassword,
          roleIds: [1] // Role HR
        })
      })
    );

    expect(createRes.status).toBe(201);
    const createBody = (await createRes.json()) as {
      data: Record<string, unknown> & {
        id: number;
        name: string;
        email: string;
        accountType: string;
        isActive: boolean;
        roles: Array<{ id: number; name: string; slug: string }>;
      };
    };

    expect(createBody.data).toBeDefined();
    expect(createBody.data.id).toBeGreaterThan(0);
    expect(createBody.data.name).toBe("Karyawan Baru Terverifikasi");
    expect(createBody.data.email).toBe(newEmail);
    expect(createBody.data.accountType).toBe("employee");
    expect(createBody.data.isActive).toBe(true);
    expect(createBody.data.roles.length).toBe(1);
    expect(createBody.data.roles[0].slug).toBe("hr");

    // Sanitasi data
    expect(createBody.data.passwordHash).toBeUndefined();
    expect(createBody.data.password).toBeUndefined();
    expect(createBody.data.token).toBeUndefined();

    // 2. Login menggunakan akun yang baru saja dibuat
    const empLoginRes = await app.handle(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({
          email: newEmail,
          password: newPassword
        })
      })
    );
    expect(empLoginRes.status).toBe(200);
    const empCookie = empLoginRes.headers.get("set-cookie") ?? "";
    expect(empCookie).toContain("mkn_employee.session_token=");

    // 3. Panggil /auth/me untuk memverifikasi profil dan permission akun baru
    const meRes = await app.handle(
      new Request("http://localhost/auth/me", {
        headers: { Cookie: empCookie }
      })
    );
    expect(meRes.status).toBe(200);
    const meBody = (await meRes.json()) as {
      user: { id: number; email: string; roles: string[]; permissions: string[] };
    };
    expect(meBody.user.id).toBe(createBody.data.id);
    expect(meBody.user.email).toBe(newEmail);
    expect(meBody.user.roles).toContain("HR");
    expect(meBody.user.permissions).toContain("hr.manage");
  });

  it("menolak PATCH /admin/users/:id tanpa sesi admin dengan HTTP 401", async () => {
    const res = await app.handle(
      new Request("http://localhost/admin/users/1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Nama Baru" })
      })
    );
    expect(res.status).toBe(401);
  });

  it("menolak PATCH /admin/users/:id jika menyertakan field terlarang dengan HTTP 400", async () => {
    const loginRes = await app.handle(
      new Request("http://localhost/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "admin@mknsite.online", password: "admin12345" })
      })
    );
    const cookie = loginRes.headers.get("set-cookie") ?? "";

    // Coba kirim field password
    const resPass = await app.handle(
      new Request("http://localhost/admin/users/1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: cookie },
        body: JSON.stringify({ name: "Ayu", password: "newpassword123" })
      })
    );
    expect(resPass.status).toBe(400);
    const bodyPass = (await resPass.json()) as { code: string; message: string };
    expect(bodyPass.code).toBe("FORBIDDEN_FIELD");

    // Coba kirim field roleIds
    const resRole = await app.handle(
      new Request("http://localhost/admin/users/1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: cookie },
        body: JSON.stringify({ roleIds: [1, 2] })
      })
    );
    expect(resRole.status).toBe(400);
    const bodyRole = (await resRole.json()) as { code: string; message: string };
    expect(bodyRole.code).toBe("FORBIDDEN_FIELD");

    // Coba kirim field isActive
    const resActive = await app.handle(
      new Request("http://localhost/admin/users/1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: cookie },
        body: JSON.stringify({ isActive: false })
      })
    );
    expect(resActive.status).toBe(400);

    // Coba kirim field accountType
    const resType = await app.handle(
      new Request("http://localhost/admin/users/1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: cookie },
        body: JSON.stringify({ accountType: "admin" })
      })
    );
    expect(resType.status).toBe(400);
  });

  it("menolak PATCH /admin/users/:id jika body kosong tanpa nama maupun email dengan HTTP 400", async () => {
    const loginRes = await app.handle(
      new Request("http://localhost/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "admin@mknsite.online", password: "admin12345" })
      })
    );
    const cookie = loginRes.headers.get("set-cookie") ?? "";

    const res = await app.handle(
      new Request("http://localhost/admin/users/1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: cookie },
        body: JSON.stringify({})
      })
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string; message: string };
    expect(body.code).toBe("EMPTY_UPDATE");
  });

  it("menolak PATCH /admin/users/:id pada akun administrator dengan HTTP 403", async () => {
    const loginRes = await app.handle(
      new Request("http://localhost/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "admin@mknsite.online", password: "admin12345" })
      })
    );
    const cookie = loginRes.headers.get("set-cookie") ?? "";
    const meRes = await app.handle(new Request("http://localhost/auth/admin/me", { headers: { Cookie: cookie } }));
    const adminUser = ((await meRes.json()) as { user: { id: number } }).user;

    const res = await app.handle(
      new Request(`http://localhost/admin/users/${adminUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: cookie },
        body: JSON.stringify({ name: "Ganti Nama Admin" })
      })
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string; message: string };
    expect(body.code).toBe("ADMIN_PROFILE_FORBIDDEN");
  });

  it("menolak PATCH /admin/users/:id dengan ID tidak ditemukan dengan HTTP 404", async () => {
    const loginRes = await app.handle(
      new Request("http://localhost/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "admin@mknsite.online", password: "admin12345" })
      })
    );
    const cookie = loginRes.headers.get("set-cookie") ?? "";

    const res = await app.handle(
      new Request("http://localhost/admin/users/99999", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: cookie },
        body: JSON.stringify({ name: "Nama Tidak Ada" })
      })
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { code: string; message: string };
    expect(body.code).toBe("USER_NOT_FOUND");
  });

  it("menolak PATCH /admin/users/:id jika email baru sudah digunakan akun lain dengan HTTP 409", async () => {
    const loginRes = await app.handle(
      new Request("http://localhost/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "admin@mknsite.online", password: "admin12345" })
      })
    );
    const cookie = loginRes.headers.get("set-cookie") ?? "";

    const listRes = await app.handle(new Request("http://localhost/admin/users", { headers: { Cookie: cookie } }));
    const listBody = (await listRes.json()) as { data: Array<{ id: number; email: string; accountType: string }> };
    const otherUser = listBody.data.find((u) => u.email !== "hr@mknsite.online" && u.accountType === "employee")!;

    const res = await app.handle(
      new Request(`http://localhost/admin/users/${otherUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: cookie },
        body: JSON.stringify({ email: "hr@mknsite.online" })
      })
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { code: string; message: string };
    expect(body.code).toBe("EMAIL_ALREADY_EXISTS");
  });

  it("berhasil memperbarui nama pengguna secara atomik di users dan auth_user", async () => {
    const loginRes = await app.handle(
      new Request("http://localhost/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "admin@mknsite.online", password: "admin12345" })
      })
    );
    const cookie = loginRes.headers.get("set-cookie") ?? "";

    const ts = Date.now();
    // 1. Buat user dummy
    const createRes = await app.handle(
      new Request("http://localhost/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: cookie },
        body: JSON.stringify({
          name: `Employee Pre-Patch ${ts}`,
          email: `patch.name.${ts}@mknsite.online`,
          password: "PasswordKaryawanBaru123!"
        })
      })
    );
    expect(createRes.status).toBe(201);
    const createdUser = ((await createRes.json()) as { data: { id: number } }).data;

    // 2. Patch nama user
    const updatedName = `Employee Post-Patch ${ts}`;
    const patchRes = await app.handle(
      new Request(`http://localhost/admin/users/${createdUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: cookie },
        body: JSON.stringify({ name: updatedName })
      })
    );
    expect(patchRes.status).toBe(200);
    const patchBody = (await patchRes.json()) as {
      data: { id: number; name: string; email: string; passwordHash?: string; password?: string };
    };
    expect(patchBody.data.id).toBe(createdUser.id);
    expect(patchBody.data.name).toBe(updatedName);
    expect(patchBody.data.passwordHash).toBeUndefined();
    expect(patchBody.data.password).toBeUndefined();

    // 3. Verifikasi konsistensi atomik di database level users dan auth_user
    const [userRow] = await db.select().from(users).where(eq(users.id, createdUser.id)).limit(1);
    const [authRow] = await db.select().from(authUsers).where(eq(authUsers.mknUserId, createdUser.id)).limit(1);
    expect(userRow?.name).toBe(updatedName);
    expect(authRow?.name).toBe(updatedName);
  });

  it("berhasil memperbarui email pengguna, mencabut seluruh sesi aktif, dan sesi lama tidak valid lagi", async () => {
    const adminLoginRes = await app.handle(
      new Request("http://localhost/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "admin@mknsite.online", password: "admin12345" })
      })
    );
    const adminCookie = adminLoginRes.headers.get("set-cookie") ?? "";

    const ts = Date.now();
    const originalEmail = `session.revoke.${ts}@mknsite.online`;
    const newEmail = `session.revoked.new.${ts}@mknsite.online`;
    const rawPassword = "PasswordKaryawanRevoke123!";

    // 1. Buat user baru
    const createRes = await app.handle(
      new Request("http://localhost/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: adminCookie },
        body: JSON.stringify({
          name: `User Sesi Revoke ${ts}`,
          email: originalEmail,
          password: rawPassword
        })
      })
    );
    expect(createRes.status).toBe(201);
    const createdUser = ((await createRes.json()) as { data: { id: number } }).data;

    // 2. User login untuk mendapatkan sesi aktif
    const userLoginRes = await app.handle(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: originalEmail, password: rawPassword })
      })
    );
    expect(userLoginRes.status).toBe(200);
    const oldSessionCookie = userLoginRes.headers.get("set-cookie") ?? "";
    expect(oldSessionCookie).toContain("mkn_employee.session_token=");

    // 3. Pastikan sesi aktif valid mengakses /auth/me
    const meBeforeRes = await app.handle(
      new Request("http://localhost/auth/me", {
        headers: { Cookie: oldSessionCookie }
      })
    );
    expect(meBeforeRes.status).toBe(200);

    // 4. Admin ubah email pengguna via PATCH /admin/users/:id
    const patchRes = await app.handle(
      new Request(`http://localhost/admin/users/${createdUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: adminCookie },
        body: JSON.stringify({ email: newEmail })
      })
    );
    expect(patchRes.status).toBe(200);
    const patchBody = (await patchRes.json()) as { data: { email: string } };
    expect(patchBody.data.email).toBe(newEmail);

    // 5. Verifikasi bahwa sesi lama telah dicabut (revoke): panggil /auth/me harus 401
    const meAfterRes = await app.handle(
      new Request("http://localhost/auth/me", {
        headers: { Cookie: oldSessionCookie }
      })
    );
    expect(meAfterRes.status).toBe(401);

    // 6. Login dengan email baru dan password lama berhasil
    const newLoginRes = await app.handle(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: newEmail, password: rawPassword })
      })
    );
    expect(newLoginRes.status).toBe(200);
    const newSessionCookie = newLoginRes.headers.get("set-cookie") ?? "";
    expect(newSessionCookie).toContain("mkn_employee.session_token=");

    // 7. Panggil /auth/me dengan cookie sesi baru berhasil
    const meNewRes = await app.handle(
      new Request("http://localhost/auth/me", {
        headers: { Cookie: newSessionCookie }
      })
    );
    expect(meNewRes.status).toBe(200);
    const meNewBody = (await meNewRes.json()) as { user: { email: string } };
    expect(meNewBody.user.email).toBe(newEmail);
  });

  it("menolak penonaktifan akun sendiri oleh admin dengan HTTP 403 SELF_DEACTIVATION_FORBIDDEN", async () => {
    const loginRes = await app.handle(
      new Request("http://localhost/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "admin@mknsite.online", password: "admin12345" })
      })
    );
    const cookie = loginRes.headers.get("set-cookie") ?? "";

    const meRes = await app.handle(new Request("http://localhost/auth/admin/me", { headers: { Cookie: cookie } }));
    const adminMe = ((await meRes.json()) as any).user;

    const res = await app.handle(
      new Request(`http://localhost/admin/users/${adminMe.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: cookie },
        body: JSON.stringify({ isActive: false })
      })
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string; message: string };
    expect(body.code).toBe("SELF_DEACTIVATION_FORBIDDEN");
  });

  it("menolak pencabutan hak admin dari diri sendiri dengan HTTP 403 SELF_ADMIN_REVOKE_FORBIDDEN", async () => {
    const loginRes = await app.handle(
      new Request("http://localhost/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "admin@mknsite.online", password: "admin12345" })
      })
    );
    const cookie = loginRes.headers.get("set-cookie") ?? "";

    const meRes = await app.handle(new Request("http://localhost/auth/admin/me", { headers: { Cookie: cookie } }));
    const adminMe = ((await meRes.json()) as any).user;

    // Role 1 adalah HR (tidak punya admin.manage)
    const res = await app.handle(
      new Request(`http://localhost/admin/users/${adminMe.id}/roles`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: cookie },
        body: JSON.stringify({ roleIds: [1] })
      })
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string; message: string };
    expect(body.code).toBe("SELF_ADMIN_REVOKE_FORBIDDEN");
  });

  it("menolak penonaktifan administrator terakhir jika bukan akun sendiri dengan HTTP 403 LAST_ADMIN_PROTECTED", async () => {
    const adminLoginRes = await app.handle(
      new Request("http://localhost/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "admin@mknsite.online", password: "admin12345" })
      })
    );
    const adminCookie = adminLoginRes.headers.get("set-cookie") ?? "";
    const meRes = await app.handle(new Request("http://localhost/auth/admin/me", { headers: { Cookie: adminCookie } }));
    const adminMe = ((await meRes.json()) as any).user;
    const adminId = adminMe.id;

    // Buat akun admin kedua di DB untuk pengujian
    const ts = Date.now();
    const [secondAdmin] = await db.insert(users).values({
      name: `Admin Kedua ${ts}`,
      email: `admin2.${ts}@mknsite.online`,
      passwordHash: await Bun.password.hash("admin12345", { algorithm: "argon2id" }),
      accountType: "admin",
      isActive: 1
    });
    const secondAdminId = Number(secondAdmin.insertId);

    // 1. Nonaktifkan admin kedua (seharusnya berhasil karena admin utama masih aktif)
    const deactRes = await app.handle(
      new Request(`http://localhost/admin/users/${secondAdminId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: adminCookie },
        body: JSON.stringify({ isActive: false })
      })
    );
    expect(deactRes.status).toBe(200);

    // 2. Nonaktifkan superadmin sementara agar hanya ada 1 admin aktif tersisa
    await db.update(users).set({ isActive: 0 }).where(eq(users.email, "superadmin@mknsite.online"));

    try {
      // Sekarang hanya adminId yang aktif. Coba ganti role adminId menjadi role non-admin (roleIds: [])
      const lastAdminRes = await app.handle(
        new Request(`http://localhost/admin/users/${adminId}/roles`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: adminCookie },
          body: JSON.stringify({ roleIds: [] })
        })
      );
      expect(lastAdminRes.status).toBe(403);
    } finally {
      // Pulihkan superadmin
      await db.update(users).set({ isActive: 1 }).where(eq(users.email, "superadmin@mknsite.online"));
    }
  });

  it("berhasil menonaktifkan akun karyawan dan langsung mencabut sesi aktif di database", async () => {
    const adminLoginRes = await app.handle(
      new Request("http://localhost/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "admin@mknsite.online", password: "admin12345" })
      })
    );
    const adminCookie = adminLoginRes.headers.get("set-cookie") ?? "";

    const ts = Date.now();
    const email = `deact.${ts}@mknsite.online`;
    const password = "PasswordKaryawanDeact123!";

    // 1. Buat karyawan
    const createRes = await app.handle(
      new Request("http://localhost/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: adminCookie },
        body: JSON.stringify({ name: `User Deact ${ts}`, email, password })
      })
    );
    expect(createRes.status).toBe(201);
    const empId = ((await createRes.json()) as { data: { id: number } }).data.id;

    // 2. Karyawan login
    const loginRes = await app.handle(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email, password })
      })
    );
    expect(loginRes.status).toBe(200);
    const empCookie = loginRes.headers.get("set-cookie") ?? "";

    // 3. Verifikasi sesi aktif
    const meBefore = await app.handle(new Request("http://localhost/auth/me", { headers: { Cookie: empCookie } }));
    expect(meBefore.status).toBe(200);

    // 4. Admin nonaktifkan karyawan
    const deactRes = await app.handle(
      new Request(`http://localhost/admin/users/${empId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: adminCookie },
        body: JSON.stringify({ isActive: false })
      })
    );
    expect(deactRes.status).toBe(200);

    // 5. Verifikasi sesi langsung ditolak (401)
    const meAfter = await app.handle(new Request("http://localhost/auth/me", { headers: { Cookie: empCookie } }));
    expect(meAfter.status).toBe(401);
  });

  it("mengaktifkan kembali akun tidak menghidupkan sesi lama (sesi lama tetap 401)", async () => {
    const adminLoginRes = await app.handle(
      new Request("http://localhost/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "admin@mknsite.online", password: "admin12345" })
      })
    );
    const adminCookie = adminLoginRes.headers.get("set-cookie") ?? "";

    const ts = Date.now();
    const email = `react.${ts}@mknsite.online`;
    const password = "PasswordKaryawanReact123!";

    // 1. Buat karyawan & login
    const createRes = await app.handle(
      new Request("http://localhost/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: adminCookie },
        body: JSON.stringify({ name: `User React ${ts}`, email, password })
      })
    );
    const empId = ((await createRes.json()) as { data: { id: number } }).data.id;

    const loginRes = await app.handle(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email, password })
      })
    );
    const oldCookie = loginRes.headers.get("set-cookie") ?? "";

    // 2. Nonaktifkan karyawan
    await app.handle(
      new Request(`http://localhost/admin/users/${empId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: adminCookie },
        body: JSON.stringify({ isActive: false })
      })
    );

    // 3. Aktifkan kembali karyawan
    const reactRes = await app.handle(
      new Request(`http://localhost/admin/users/${empId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: adminCookie },
        body: JSON.stringify({ isActive: true })
      })
    );
    expect(reactRes.status).toBe(200);

    // 4. Verifikasi sesi lama TETAP 401
    const meOld = await app.handle(new Request("http://localhost/auth/me", { headers: { Cookie: oldCookie } }));
    expect(meOld.status).toBe(401);

    // 5. Karyawan harus login ulang untuk mendapat sesi baru
    const newLoginRes = await app.handle(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email, password })
      })
    );
    expect(newLoginRes.status).toBe(200);
    const newCookie = newLoginRes.headers.get("set-cookie") ?? "";

    const meNew = await app.handle(new Request("http://localhost/auth/me", { headers: { Cookie: newCookie } }));
    expect(meNew.status).toBe(200);
  });

  it("perubahan role via PATCH /admin/users/:id/roles otomatis mencabut sesi aktif karyawan", async () => {
    const adminLoginRes = await app.handle(
      new Request("http://localhost/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "admin@mknsite.online", password: "admin12345" })
      })
    );
    const adminCookie = adminLoginRes.headers.get("set-cookie") ?? "";

    const ts = Date.now();
    const email = `rolechange.${ts}@mknsite.online`;
    const password = "PasswordRoleChange123!";

    // 1. Buat karyawan dengan role 1 (HR)
    const createRes = await app.handle(
      new Request("http://localhost/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: adminCookie },
        body: JSON.stringify({ name: `User Role Change ${ts}`, email, password, roleIds: [1] })
      })
    );
    const empId = ((await createRes.json()) as { data: { id: number } }).data.id;

    // 2. Karyawan login
    const loginRes = await app.handle(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email, password })
      })
    );
    const empCookie = loginRes.headers.get("set-cookie") ?? "";

    const meBefore = await app.handle(new Request("http://localhost/auth/me", { headers: { Cookie: empCookie } }));
    expect(meBefore.status).toBe(200);

    // 3. Admin ubah role karyawan menjadi role 2 (OPS Telco)
    const updateRolesRes = await app.handle(
      new Request(`http://localhost/admin/users/${empId}/roles`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: adminCookie },
        body: JSON.stringify({ roleIds: [2] })
      })
    );
    expect(updateRolesRes.status).toBe(200);

    // 4. Verifikasi sesi lama telah dicabut (401)
    const meAfter = await app.handle(new Request("http://localhost/auth/me", { headers: { Cookie: empCookie } }));
    expect(meAfter.status).toBe(401);

    // 5. Login ulang dan verifikasi role baru
    const reloginRes = await app.handle(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email, password })
      })
    );
    expect(reloginRes.status).toBe(200);
    const newCookie = reloginRes.headers.get("set-cookie") ?? "";

    const meNew = await app.handle(new Request("http://localhost/auth/me", { headers: { Cookie: newCookie } }));
    expect(meNew.status).toBe(200);
    const meNewBody = (await meNew.json()) as { user: { roles: string[]; permissions: string[] } };
    expect(meNewBody.user.roles).toContain("OPS Telco");
    expect(meNewBody.user.permissions).toContain("ops_telco.manage");
  });

  it("POST /admin/users/:id/revoke-sessions berhasil mencabut sesi aktif tanpa menonaktifkan user", async () => {
    const adminLoginRes = await app.handle(
      new Request("http://localhost/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "admin@mknsite.online", password: "admin12345" })
      })
    );
    const adminCookie = adminLoginRes.headers.get("set-cookie") ?? "";

    const ts = Date.now();
    const email = `revokeonly.${ts}@mknsite.online`;
    const password = "PasswordRevokeOnly123!";

    // 1. Buat karyawan
    const createRes = await app.handle(
      new Request("http://localhost/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: adminCookie },
        body: JSON.stringify({ name: `User Revoke Only ${ts}`, email, password })
      })
    );
    const empId = ((await createRes.json()) as { data: { id: number } }).data.id;

    // 2. Karyawan login
    const loginRes = await app.handle(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email, password })
      })
    );
    const empCookie = loginRes.headers.get("set-cookie") ?? "";

    // 3. Admin mencabut sesi via POST /admin/users/:id/revoke-sessions
    const revokeRes = await app.handle(
      new Request(`http://localhost/admin/users/${empId}/revoke-sessions`, {
        method: "POST",
        headers: { Origin: "http://localhost:3000", Cookie: adminCookie }
      })
    );
    expect(revokeRes.status).toBe(200);
    expect(await revokeRes.json()).toEqual({ success: true });

    // 4. Verifikasi sesi lama ditolak (401)
    const meAfter = await app.handle(new Request("http://localhost/auth/me", { headers: { Cookie: empCookie } }));
    expect(meAfter.status).toBe(401);

    // 5. Verifikasi di DB bahwa user TETAP aktif
    const [userRow] = await db.select().from(users).where(eq(users.id, empId)).limit(1);
    expect(userRow?.isActive).toBe(1);

    // 6. User dapat langsung login kembali
    const reloginRes = await app.handle(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email, password })
      })
    );
    expect(reloginRes.status).toBe(200);
  });

  it("POST /admin/users/:id/revoke-sessions menolak request tanpa sesi admin (401) dan ID tidak ditemukan (404)", async () => {
    // 1. Tanpa auth -> 401
    const noAuthRes = await app.handle(
      new Request("http://localhost/admin/users/1/revoke-sessions", {
        method: "POST",
        headers: { Origin: "http://localhost:3000" }
      })
    );
    expect(noAuthRes.status).toBe(401);

    // 2. Dengan auth tapi ID fiktif -> 404
    const adminLoginRes = await app.handle(
      new Request("http://localhost/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "admin@mknsite.online", password: "admin12345" })
      })
    );
    const adminCookie = adminLoginRes.headers.get("set-cookie") ?? "";

    const notFoundRes = await app.handle(
      new Request("http://localhost/admin/users/99999/revoke-sessions", {
        method: "POST",
        headers: { Origin: "http://localhost:3000", Cookie: adminCookie }
      })
    );
    expect(notFoundRes.status).toBe(404);
    const body = (await notFoundRes.json()) as { code: string; message: string };
    expect(body.code).toBe("USER_NOT_FOUND");
  });

  it("berhasil mengunggah dan menghapus avatar profil pengguna", async () => {
    const adminLogin = await app.handle(
      new Request("http://localhost/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "admin@mknsite.online", password: "admin12345" })
      })
    );
    const adminCookie = adminLogin.headers.get("set-cookie") ?? "";

    // Buat employee sementara untuk uji avatar
    const createRes = await app.handle(
      new Request("http://localhost/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: adminCookie },
        body: JSON.stringify({
          name: "Avatar Test User",
          email: `avatar.${Date.now()}@mknsite.online`,
          password: "password123456",
          division: "Telekomunikasi"
        })
      })
    );
    const created = ((await createRes.json()) as any).data;

    // Upload avatar via dataUrl
    const uploadRes = await app.handle(
      new Request(`http://localhost/admin/users/${created.id}/avatar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: adminCookie },
        body: JSON.stringify({
          dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        })
      })
    );
    expect(uploadRes.status).toBe(200);
    const uploadBody = (await uploadRes.json()) as any;
    expect(uploadBody.data.avatarUrl).toContain("/uploads/avatars/");

    // Delete avatar
    const delAvatarRes = await app.handle(
      new Request(`http://localhost/admin/users/${created.id}/avatar`, {
        method: "DELETE",
        headers: { Origin: "http://localhost:3000", Cookie: adminCookie }
      })
    );
    expect(delAvatarRes.status).toBe(200);
    const delBody = (await delAvatarRes.json()) as any;
    expect(delBody.data.avatarUrl).toBeNull();

    // Hapus user uji
    const delUserRes = await app.handle(
      new Request(`http://localhost/admin/users/${created.id}`, {
        method: "DELETE",
        headers: { Origin: "http://localhost:3000", Cookie: adminCookie }
      })
    );
    expect(delUserRes.status).toBe(200);
  });

  it("DELETE /admin/users/:id menolak penghapusan diri sendiri dan ID tidak ditemukan", async () => {
    const adminLogin = await app.handle(
      new Request("http://localhost/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "admin@mknsite.online", password: "admin12345" })
      })
    );
    const adminCookie = adminLogin.headers.get("set-cookie") ?? "";
    const meRes = await app.handle(new Request("http://localhost/auth/admin/me", { headers: { Cookie: adminCookie } }));
    const myId = ((await meRes.json()) as any).user.id;

    // Coba hapus diri sendiri -> 403
    const selfDelRes = await app.handle(
      new Request(`http://localhost/admin/users/${myId}`, {
        method: "DELETE",
        headers: { Origin: "http://localhost:3000", Cookie: adminCookie }
      })
    );
    expect(selfDelRes.status).toBe(403);
    expect(((await selfDelRes.json()) as any).code).toBe("SELF_DELETION_FORBIDDEN");

    // ID tidak ditemukan -> 404
    const notFoundRes = await app.handle(
      new Request("http://localhost/admin/users/99999", {
        method: "DELETE",
        headers: { Origin: "http://localhost:3000", Cookie: adminCookie }
      })
    );
    expect(notFoundRes.status).toBe(404);
  });

  afterAll(async () => {
    await cleanTestUsers();
  });
});
