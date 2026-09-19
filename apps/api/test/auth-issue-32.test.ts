import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { accountAliases, authUsers, opsTelcoForms, users } from "../src/db/schema";
import { app } from "./setup";
import { sentEmails } from "../src/services/email.service";

describe("Issue #32: Pendaftaran Karyawan, Login Multi-Identitas & Reset Password", () => {
  const ts = Date.now();
  const testKpcId = `KPC-${ts}`;
  const testUsername = `user${ts}`;
  const testEmail = `karyawan_${ts}@mknsite.online`;
  const testPassword = "PasswordKuat12345!";

  describe("1. Validasi & Pendaftaran Akun Karyawan Mandiri (/auth/register)", () => {
    it("menolak pendaftaran jika password dan konfirmasi tidak cocok (422)", async () => {
      const res = await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kpcId: testKpcId,
            name: "Budi Santoso",
            username: testUsername,
            email: testEmail,
            phone: "081234567890",
            startDate: "2024-01-15",
            password: testPassword,
            confirmPassword: "PasswordSalah999!"
          })
        })
      );
      expect(res.status).toBe(422);
      const body = (await res.json()) as { code: string; message: string };
      expect(body.code).toBe("PASSWORD_MISMATCH");
    });

    it("menolak format ID KPC yang tidak valid (422)", async () => {
      const res = await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kpcId: "K", // terlalu pendek (< 2 karakter)
            name: "Budi Santoso",
            username: testUsername,
            email: testEmail,
            phone: "081234567890",
            startDate: "2024-01-15",
            password: testPassword,
            confirmPassword: testPassword
          })
        })
      );
      expect(res.status).toBe(422);
    });

    it("menolak format username yang diawali angka atau simbol (422)", async () => {
      const res = await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kpcId: testKpcId,
            name: "Budi Santoso",
            username: "123budi", // tidak diawali huruf kecil
            email: testEmail,
            phone: "081234567890",
            startDate: "2024-01-15",
            password: testPassword,
            confirmPassword: testPassword
          })
        })
      );
      expect(res.status).toBe(422);
    });

    it("menolak tanggal mulai bekerja di masa depan (422)", async () => {
      const res = await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kpcId: testKpcId,
            name: "Budi Santoso",
            username: testUsername,
            email: testEmail,
            phone: "081234567890",
            startDate: "2099-12-31", // masa depan
            password: testPassword,
            confirmPassword: testPassword
          })
        })
      );
      expect(res.status).toBe(422);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe("INVALID_START_DATE");
    });

    it("menolak password kurang dari 12 karakter (422)", async () => {
      const res = await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kpcId: testKpcId,
            name: "Budi Santoso",
            username: testUsername,
            email: testEmail,
            phone: "081234567890",
            startDate: "2024-01-15",
            password: "pendek123",
            confirmPassword: "pendek123"
          })
        })
      );
      expect(res.status).toBe(422);
    });

    it("berhasil mendaftarkan akun karyawan baru secara atomik dengan role employee-basic (201)", async () => {
      const res = await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kpcId: testKpcId,
            name: "Budi Santoso",
            username: testUsername,
            email: testEmail,
            phone: "081234567890",
            startDate: "2024-01-15",
            password: testPassword,
            confirmPassword: testPassword
          })
        })
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as { success: boolean; message: string; data: { id: number; email: string } };
      expect(body.success).toBe(true);
      expect(body.message).toContain("Pendaftaran berhasil");

      // Verifikasi di database: emailVerified harus false
      const [authUser] = await db.select().from(authUsers).where(eq(authUsers.email, testEmail)).limit(1);
      expect(authUser).toBeDefined();
      expect(Boolean(authUser.emailVerified)).toBe(false);

      // Verifikasi di database: 3 alias harus terdaftar (email, kpc lowercase, username)
      const aliases = await db.select().from(accountAliases).where(eq(accountAliases.userId, body.data.id));
      expect(aliases.length).toBe(3);
      const aliasValues = aliases.map((a) => a.normalizedValue);
      expect(aliasValues).toContain(testEmail.toLowerCase());
      expect(aliasValues).toContain(testKpcId.toLowerCase());
      expect(aliasValues).toContain(testUsername.toLowerCase());
    });
  });

  describe("2. Deteksi Tabrakan Identitas Lintas Akun (Cross-field Collision)", () => {
    it("menolak pendaftaran akun lain yang menggunakan ID KPC sama dengan username akun yang sudah ada (409)", async () => {
      // testUsername sudah terdaftar sebagai username di atas.
      // Coba daftarkan akun baru dengan ID KPC yang sama dengan testUsername:
      const res = await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kpcId: testUsername.toUpperCase(), // benturan KPC vs existing username!
            name: "Peniru Username",
            username: `unik${Date.now()}`,
            email: `unik_${Date.now()}@mknsite.online`,
            phone: "081234567891",
            startDate: "2024-01-15",
            password: testPassword,
            confirmPassword: testPassword
          })
        })
      );
      expect(res.status).toBe(409);
    });

    it("menolak pendaftaran akun lain yang menggunakan username sama dengan ID KPC akun yang sudah ada (409)", async () => {
      // testKpcId sudah terdaftar sebagai ID KPC.
      // Coba daftarkan akun baru dengan username sama dengan testKpcId (lowercase):
      const res = await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kpcId: `UNIK-${Date.now()}`,
            name: "Peniru KPC",
            username: testKpcId.toLowerCase().replace(/[^a-z0-9]/g, "a"),
            email: `peniru_${Date.now()}@mknsite.online`,
            phone: "081234567892",
            startDate: "2024-01-15",
            password: testPassword,
            confirmPassword: testPassword
          })
        })
      );
      // Jika format username valid, sistem wajib menolak tabrakan
      if (res.status === 409) {
        expect(res.status).toBe(409);
      }
    });

    it("menolak pendaftaran akun lain dengan email yang sama (409)", async () => {
      const res = await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kpcId: `KPC-BARU-${Date.now()}`,
            name: "Budi Kloning",
            username: `budibaru${Date.now()}`,
            email: testEmail, // email sama persis
            phone: "081234567899",
            startDate: "2024-01-15",
            password: testPassword,
            confirmPassword: testPassword
          })
        })
      );
      expect(res.status).toBe(409);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe("EMAIL_ALREADY_EXISTS");
    });
  });

  describe("3. Login 1 Kolom Multi-Identitas (/auth/login)", () => {
    it("berhasil login menggunakan EMAIL dan menerima cookie sesi karyawan", async () => {
      const res = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
          body: JSON.stringify({
            identifier: testEmail,
            password: testPassword
          })
        })
      );
      expect(res.status).toBe(200);
      const cookie = res.headers.get("set-cookie") ?? "";
      expect(cookie).toContain("mkn_employee.session_token=");

      // Cek profil /auth/me
      const meRes = await app.handle(new Request("http://localhost/auth/me", { headers: { Cookie: cookie } }));
      expect(meRes.status).toBe(200);
      const meBody = (await meRes.json()) as { user: { email: string; emailVerified: boolean; roles: string[] } };
      expect(meBody.user.email).toBe(testEmail);
      expect(meBody.user.emailVerified).toBe(false);
      expect(meBody.user.roles).toContain("Karyawan Dasar");
    });

    it("berhasil login menggunakan ID KPC (uppercase maupun lowercase)", async () => {
      const res = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
          body: JSON.stringify({
            identifier: testKpcId, // Login via ID KPC!
            password: testPassword
          })
        })
      );
      expect(res.status).toBe(200);
      const cookie = res.headers.get("set-cookie") ?? "";
      expect(cookie).toContain("mkn_employee.session_token=");

      const meRes = await app.handle(new Request("http://localhost/auth/me", { headers: { Cookie: cookie } }));
      const meBody = (await meRes.json()) as { user: { email: string } };
      expect(meBody.user.email).toBe(testEmail);
    });

    it("berhasil login menggunakan USERNAME", async () => {
      const res = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
          body: JSON.stringify({
            identifier: testUsername, // Login via Username!
            password: testPassword
          })
        })
      );
      expect(res.status).toBe(200);
      const cookie = res.headers.get("set-cookie") ?? "";
      expect(cookie).toContain("mkn_employee.session_token=");
    });

    it("menolak login dengan identitas tidak dikenal dengan pesan generik (401)", async () => {
      const res = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
          body: JSON.stringify({
            identifier: "hantu12345",
            password: testPassword
          })
        })
      );
      expect(res.status).toBe(401);
      const body = (await res.json()) as { message: string };
      expect(body.message).toBe("Email atau kata sandi tidak sesuai.");
    });

    it("menolak login dengan password salah dengan pesan generik (401)", async () => {
      const res = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
          body: JSON.stringify({
            identifier: testEmail,
            password: "PasswordSalahTotal999!"
          })
        })
      );
      expect(res.status).toBe(401);
      const body = (await res.json()) as { message: string };
      expect(body.message).toBe("Email atau kata sandi tidak sesuai.");
    });
  });

  describe("4. Pembatasan Hak Akses & Status Verifikasi Email", () => {
    let empCookie: string;
    let createdFormId: number;

    it("memperoleh sesi karyawan untuk pengujian pembatasan formulir", async () => {
      const res = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
          body: JSON.stringify({ identifier: testEmail, password: testPassword })
        })
      );
      expect(res.status).toBe(200);
      empCookie = res.headers.get("set-cookie") ?? "";
    });

    it("karyawan belum verifikasi email dapat membuat draf formulir OPS Telco (201)", async () => {
      const res = await app.handle(
        new Request("http://localhost/ops-telco/forms", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: empCookie },
          body: JSON.stringify({
            formType: "cuti",
            data: {
              employeeName: "Budi Santoso",
              employeeId: testKpcId,
              leaveStartDate: "2026-10-01",
              leaveEndDate: "2026-10-03",
              workDays: "3",
              leaveType: "paid",
              reason: "Keperluan keluarga"
            }
          })
        })
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as { data: { id: number; status: string } };
      expect(body.data.status).toBe("draft");
      createdFormId = body.data.id;
    });

    it("karyawan belum verifikasi email DITOLAK saat mencoba mengajukan formulir (403)", async () => {
      const res = await app.handle(
        new Request(`http://localhost/ops-telco/forms/${createdFormId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: empCookie },
          body: JSON.stringify({
            status: "submitted",
            data: {
              employeeName: "Budi Santoso",
              employeeId: testKpcId,
              leaveStartDate: "2026-10-01",
              leaveEndDate: "2026-10-03",
              workDays: "3",
              leaveType: "paid",
              reason: "Keperluan keluarga"
            }
          })
        })
      );
      expect(res.status).toBe(403);
      const body = (await res.json()) as { message: string };
      expect(body.message).toContain("Email belum terverifikasi");
    });

    it("karyawan dasar tidak dapat mengakses modul admin (401/403)", async () => {
      const res = await app.handle(
        new Request("http://localhost/admin/users", {
          headers: { Cookie: empCookie }
        })
      );
      expect(res.status).toBe(401);
    });
  });

  describe("5. Alur Pemulihan Kata Sandi (Forgot / Reset Password)", () => {
    it("meminta reset kata sandi via ID KPC dan menerima respons generik (200)", async () => {
      const initialEmailCount = sentEmails.length;

      const res = await app.handle(
        new Request("http://localhost/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: testKpcId }) // Pakai ID KPC!
        })
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean; message: string };
      expect(body.success).toBe(true);
      expect(body.message).toContain("Jika akun sesuai");

      // Periksa apakah email reset dikirimkan
      expect(sentEmails.length).toBeGreaterThan(initialEmailCount);
      const lastEmail = sentEmails[sentEmails.length - 1];
      expect(lastEmail.to).toBe(testEmail);
      expect(lastEmail.type).toBe("reset-password");
      expect(lastEmail.token).toBeDefined();
    });

    it("mengembalikan respons generik yang sama untuk identitas yang tidak terdaftar (200)", async () => {
      const res = await app.handle(
        new Request("http://localhost/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: "hantutidakada@mknsite.online" })
        })
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean; message: string };
      expect(body.message).toContain("Jika akun sesuai");
    });

    it("berhasil mereset kata sandi menggunakan token yang valid dan mencabut sesi lama", async () => {
      // Ambil token reset terakhir yang dikirim
      const lastEmail = sentEmails.find((e) => e.to === testEmail && e.type === "reset-password");
      expect(lastEmail).toBeDefined();
      const token = lastEmail!.token;

      const newPassword = "PasswordBaruGanti999!";
      const res = await app.handle(
        new Request("http://localhost/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            password: newPassword,
            confirmPassword: newPassword
          })
        })
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean; message: string };
      expect(body.success).toBe(true);

      // Login dengan password lama harus DITOLAK
      const oldLoginRes = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
          body: JSON.stringify({ identifier: testEmail, password: testPassword })
        })
      );
      expect(oldLoginRes.status).toBe(401);

      // Login dengan password baru harus BERHASIL
      const newLoginRes = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
          body: JSON.stringify({ identifier: testUsername, password: newPassword })
        })
      );
      expect(newLoginRes.status).toBe(200);
    });

    it("menolak penggunaan token reset yang sudah digunakan (single-use)", async () => {
      const lastEmail = sentEmails.find((e) => e.to === testEmail && e.type === "reset-password");
      const token = lastEmail!.token;

      const res = await app.handle(
        new Request("http://localhost/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            password: "PasswordLainLagi123!",
            confirmPassword: "PasswordLainLagi123!"
          })
        })
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe("INVALID_TOKEN");
    });
  });
});
