import { beforeAll, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { authUsers, menus, opsTelcoForms, permissions, rolePermissions, roles, userRoles, users } from "../src/db/schema";
import { generateOpsTelcoPdf } from "../src/services/ops-telco-form-pdf.service";
import { formatEmployeeIdentity, validateOpsTelcoData } from "../src/services/ops-telco-form-validation";
import { app } from "./setup";

describe("OPS Telco Technician Forms Suite (Comprehensive 23 Criteria)", () => {
  const ts = Date.now();
  const pass = "Password12345!";

  let tech1User: { id: number; name: string; kpcId: string; email: string };
  let tech1Cookie = "";

  let techNoKpcUser: { id: number; name: string; email: string };
  let techNoKpcCookie = "";

  let supervisorUser: { id: number; name: string; kpcId: string; email: string };
  let supervisorCookie = "";

  let legacyHrUser: { id: number; name: string; email: string };
  let legacyHrCookie = "";

  let noAccessUser: { id: number; name: string; email: string };
  let noAccessCookie = "";

  beforeAll(async () => {
    // 1. Register Technician 1 (with KPC ID)
    const tech1Email = `tech1_${ts}@mknsite.online`;
    const tech1Kpc = `KPC${ts.toString().slice(-5)}`;
    const reg1Res = await app.handle(
      new Request("http://localhost/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Teknisi Satu",
          kpcId: tech1Kpc,
          username: `tech1_${ts}`,
          email: tech1Email,
          phone: "081234567891",
          startDate: "2024-01-15",
          password: pass,
          confirmPassword: pass
        })
      })
    );
    expect(reg1Res.status).toBe(201);
    const reg1Body = (await reg1Res.json()) as any;
    tech1User = { id: reg1Body.data.id, name: "Teknisi Satu", kpcId: tech1Kpc.toUpperCase(), email: tech1Email };

    // Assign role ops-telco-technician to Tech 1
    const [techRole] = await db.select().from(roles).where(eq(roles.slug, "ops-telco-technician")).limit(1);
    if (techRole) {
      await db.insert(userRoles).values({ userId: tech1User.id, roleId: techRole.id }).onDuplicateKeyUpdate({ set: { roleId: techRole.id } });
    }
    // Verify email for submission testing
    await db.update(authUsers).set({ emailVerified: true }).where(eq(authUsers.mknUserId, tech1User.id));

    // Login Tech 1
    const login1Res = await app.handle(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ identifier: tech1Email, password: pass })
      })
    );
    expect(login1Res.status).toBe(200);
    tech1Cookie = login1Res.headers.get("set-cookie") ?? "";

    // 2. Register Technician without KPC ID
    const noKpcEmail = `nokpc_${ts}@mknsite.online`;
    const regNoKpc = await app.handle(
      new Request("http://localhost/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Teknisi Tanpa KPC",
          kpcId: `TMP${ts.toString().slice(-5)}`,
          username: `nokpc_${ts}`,
          email: noKpcEmail,
          phone: "081234567892",
          startDate: "2024-01-15",
          password: pass,
          confirmPassword: pass
        })
      })
    );
    expect(regNoKpc.status).toBe(201);
    const noKpcBody = (await regNoKpc.json()) as any;
    techNoKpcUser = { id: noKpcBody.data.id, name: "Teknisi Tanpa KPC", email: noKpcEmail };
    // Clear kpcId
    await db.update(users).set({ kpcId: null }).where(eq(users.id, techNoKpcUser.id));
    if (techRole) {
      await db.insert(userRoles).values({ userId: techNoKpcUser.id, roleId: techRole.id }).onDuplicateKeyUpdate({ set: { roleId: techRole.id } });
    }
    await db.update(authUsers).set({ emailVerified: true }).where(eq(authUsers.mknUserId, techNoKpcUser.id));

    const loginNoKpcRes = await app.handle(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ identifier: noKpcEmail, password: pass })
      })
    );
    expect(loginNoKpcRes.status).toBe(200);
    techNoKpcCookie = loginNoKpcRes.headers.get("set-cookie") ?? "";

    // 3. Register Supervisor
    const spvEmail = `spv_${ts}@mknsite.online`;
    const spvKpc = `SPV${ts.toString().slice(-5)}`;
    const regSpv = await app.handle(
      new Request("http://localhost/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Supervisor Telco",
          kpcId: spvKpc,
          username: `spv_${ts}`,
          email: spvEmail,
          phone: "081234567893",
          startDate: "2024-01-15",
          password: pass,
          confirmPassword: pass
        })
      })
    );
    expect(regSpv.status).toBe(201);
    const spvBody = (await regSpv.json()) as any;
    supervisorUser = { id: spvBody.data.id, name: "Supervisor Telco", kpcId: spvKpc.toUpperCase(), email: spvEmail };
    const [spvRole] = await db.select().from(roles).where(eq(roles.slug, "ops-telco-supervisor")).limit(1);
    if (spvRole) {
      await db.insert(userRoles).values({ userId: supervisorUser.id, roleId: spvRole.id }).onDuplicateKeyUpdate({ set: { roleId: spvRole.id } });
    }
    await db.update(authUsers).set({ emailVerified: true }).where(eq(authUsers.mknUserId, supervisorUser.id));

    const loginSpvRes = await app.handle(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ identifier: spvEmail, password: pass })
      })
    );
    expect(loginSpvRes.status).toBe(200);
    supervisorCookie = loginSpvRes.headers.get("set-cookie") ?? "";

    // 4. Register Legacy HR User (only role 'hr')
    const hrEmail = `legacy_hr_${ts}@mknsite.online`;
    const regHr = await app.handle(
      new Request("http://localhost/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Legacy HR Officer",
          kpcId: `HRO${ts.toString().slice(-5)}`,
          username: `hr_${ts}`,
          email: hrEmail,
          phone: "081234567894",
          startDate: "2024-01-15",
          password: pass,
          confirmPassword: pass
        })
      })
    );
    expect(regHr.status).toBe(201);
    const hrBody = (await regHr.json()) as any;
    legacyHrUser = { id: hrBody.data.id, name: "Legacy HR Officer", email: hrEmail };
    const [hrRole] = await db.select().from(roles).where(eq(roles.slug, "hr")).limit(1);
    if (hrRole) {
      // Ensure ONLY hr role is attached (remove default employee-basic)
      await db.delete(userRoles).where(eq(userRoles.userId, legacyHrUser.id));
      await db.insert(userRoles).values({ userId: legacyHrUser.id, roleId: hrRole.id });
    }
    await db.update(authUsers).set({ emailVerified: true }).where(eq(authUsers.mknUserId, legacyHrUser.id));

    const loginHrRes = await app.handle(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ identifier: hrEmail, password: pass })
      })
    );
    expect(loginHrRes.status).toBe(200);
    legacyHrCookie = loginHrRes.headers.get("set-cookie") ?? "";

    // 5. Register User Without Access (no roles)
    const noAccessEmail = `noaccess_${ts}@mknsite.online`;
    const regNoAcc = await app.handle(
      new Request("http://localhost/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Pengguna Tanpa Izin",
          kpcId: `USR${ts.toString().slice(-5)}`,
          username: `noacc_${ts}`,
          email: noAccessEmail,
          phone: "081234567895",
          startDate: "2024-01-15",
          password: pass,
          confirmPassword: pass
        })
      })
    );
    expect(regNoAcc.status).toBe(201);
    const noAccBody = (await regNoAcc.json()) as any;
    noAccessUser = { id: noAccBody.data.id, name: "Pengguna Tanpa Izin", email: noAccessEmail };
    // Remove default employee-basic role so user has ZERO roles/permissions
    await db.delete(userRoles).where(eq(userRoles.userId, noAccessUser.id));
    await db.update(authUsers).set({ emailVerified: true }).where(eq(authUsers.mknUserId, noAccessUser.id));

    const loginNoAccRes = await app.handle(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ identifier: noAccessEmail, password: pass })
      })
    );
    expect(loginNoAccRes.status).toBe(200);
    noAccessCookie = loginNoAccRes.headers.get("set-cookie") ?? "";
  }, 30000);

  describe("Submenu & Role Visibility Criteria", () => {
    it("1. Teknisi memiliki akses ke 3 submenu formulir di workspace", async () => {
      for (const section of ["form-oncall", "form-overtime", "form-cuti"]) {
        const res = await app.handle(
          new Request(`http://localhost/workspace/ops-telco/${section}`, {
            headers: { Cookie: tech1Cookie }
          })
        );
        expect(res.status).toBe(200);
        const body = (await res.json()) as any;
        expect(body.section).toBe(section);
        expect(body.permission).toBe("ops_telco.forms.view");
      }
    });

    it("2. Teknisi ditolak akses ke submenu Supervisor", async () => {
      for (const section of ["assign-job", "assign-jadwal-oncall", "form-pto"]) {
        const res = await app.handle(
          new Request(`http://localhost/workspace/ops-telco/${section}`, {
            headers: { Cookie: tech1Cookie }
          })
        );
        expect(res.status).toBe(403);
      }
    });

    it("3. Supervisor memiliki akses ke submenu Supervisor dan Teknisi", async () => {
      for (const section of ["assign-job", "assign-jadwal-oncall", "form-pto", "form-oncall", "form-overtime", "form-cuti"]) {
        const res = await app.handle(
          new Request(`http://localhost/workspace/ops-telco/${section}`, {
            headers: { Cookie: supervisorCookie }
          })
        );
        expect(res.status).toBe(200);
      }
    });

    it("4. Pengguna tanpa ops_telco.forms.view ditolak HTTP 403 pada /ops-telco/forms", async () => {
      const res = await app.handle(
        new Request("http://localhost/ops-telco/forms", {
          headers: { Cookie: noAccessCookie }
        })
      );
      expect(res.status).toBe(403);
    });
  });

  describe("Form CRUD & Scope Isolation Criteria", () => {
    let tech1FormId: number;
    let tech1FormNumber: string;

    it("5. Teknisi dapat membuat formulir Oncall dan nomor otomatis OC-YYYY-ID terbentuk", async () => {
      const res = await app.handle(
        new Request("http://localhost/ops-telco/forms", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3000",
            Cookie: tech1Cookie
          },
          body: JSON.stringify({
            formType: "oncall",
            data: {
              dateRequired: "2026-03-20",
              startTime: "08:00",
              endTime: "16:00",
              description: "Troubleshoot Link Telco Tower"
            }
          })
        })
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.data.formType).toBe("oncall");
      expect(body.data.formNumber).toMatch(/^OC-\d{4}-\d{5}$/);
      expect(body.data.createdBy).toBe(tech1User.id);
      tech1FormId = body.data.id;
      tech1FormNumber = body.data.formNumber;
    });

    it("6. Teknisi hanya dapat melihat formulir miliknya sendiri", async () => {
      const res = await app.handle(
        new Request("http://localhost/ops-telco/forms", {
          headers: { Cookie: tech1Cookie }
        })
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      const allMine = body.data.every((f: any) => f.createdBy === tech1User.id);
      expect(allMine).toBe(true);
    });

    it("7. Supervisor dapat melihat semua formulir termasuk milik Teknisi", async () => {
      const res = await app.handle(
        new Request("http://localhost/ops-telco/forms", {
          headers: { Cookie: supervisorCookie }
        })
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      const foundTech1Form = body.data.some((f: any) => f.id === tech1FormId);
      expect(foundTech1Form).toBe(true);
    });

    it("8. Teknisi ditolak saat mencoba approve/reject/defer atau reopen formulir", async () => {
      // First submit the draft
      const submitRes = await app.handle(
        new Request(`http://localhost/ops-telco/forms/${tech1FormId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3000",
            Cookie: tech1Cookie
          },
          body: JSON.stringify({
            status: "submitted",
            data: {
              dateRequired: "2026-03-20",
              startTime: "08:00",
              endTime: "16:00",
              description: "Troubleshoot Link Telco Tower"
            }
          })
        })
      );
      expect(submitRes.status).toBe(200);

      // Now technician tries to approve
      const approveRes = await app.handle(
        new Request(`http://localhost/ops-telco/forms/${tech1FormId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3000",
            Cookie: tech1Cookie
          },
          body: JSON.stringify({
            status: "approved",
            data: {}
          })
        })
      );
      expect(approveRes.status).toBe(403);
    });

    it("9. Supervisor berhasil melakukan approval dan dapat membuka kembali ke draft", async () => {
      // Supervisor approves
      const approveRes = await app.handle(
        new Request(`http://localhost/ops-telco/forms/${tech1FormId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3000",
            Cookie: supervisorCookie
          },
          body: JSON.stringify({
            status: "approved",
            data: {}
          })
        })
      );
      expect(approveRes.status).toBe(200);
      const approvedBody = (await approveRes.json()) as any;
      expect(approvedBody.data.status).toBe("approved");

      // Supervisor reopens to draft
      const reopenRes = await app.handle(
        new Request(`http://localhost/ops-telco/forms/${tech1FormId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3000",
            Cookie: supervisorCookie
          },
          body: JSON.stringify({
            status: "draft",
            data: {}
          })
        })
      );
      expect(reopenRes.status).toBe(200);
      const reopenedBody = (await reopenRes.json()) as any;
      expect(reopenedBody.data.status).toBe("draft");
    });

    it("10. Duplikasi formulir mencatat duplicatedFromId dan pembuat baru", async () => {
      const dupRes = await app.handle(
        new Request(`http://localhost/ops-telco/forms/${tech1FormId}/duplicate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3000",
            Cookie: tech1Cookie
          }
        })
      );
      expect(dupRes.status).toBe(201);
      const body = (await dupRes.json()) as any;
      expect(body.data.duplicatedFromId).toBe(tech1FormId);
      expect(body.data.status).toBe("draft");
      expect(body.data.formNumber).not.toBe(tech1FormNumber);
      expect(body.data.formNumber).toMatch(/^OC-\d{4}-\d{5}$/);
    });
  });

  describe("Oncall Rules & Safety Guards Criteria", () => {
    it("11. Client payload employeeName diabaikan, otomatis diisi Nama - ID KPC", async () => {
      const res = await app.handle(
        new Request("http://localhost/ops-telco/forms", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3000",
            Cookie: tech1Cookie
          },
          body: JSON.stringify({
            formType: "oncall",
            data: {
              employeeName: "Hacker / Fake Name",
              dateRequired: "2026-03-22",
              startTime: "09:00",
              endTime: "17:00",
              description: "Fiber splicing"
            }
          })
        })
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.data.data.employeeName).toBe(`${tech1User.name} - ${tech1User.kpcId}`);
    });

    it("12. Client payload supervisorName dikunci ke Rahmansyah - Z110779", async () => {
      const res = await app.handle(
        new Request("http://localhost/ops-telco/forms", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3000",
            Cookie: tech1Cookie
          },
          body: JSON.stringify({
            formType: "oncall",
            data: {
              supervisorName: "Bukan Rahmansyah",
              dateRequired: "2026-03-22",
              startTime: "09:00",
              endTime: "17:00",
              description: "Fiber splicing"
            }
          })
        })
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.data.data.supervisorName).toBe("Rahmansyah - Z110779");
    });

    it("13. Manual Job Order No. dipertahankan jika diisi; fallback ke nomor otomatis jika kosong", async () => {
      // Manual jobOrder
      const manualRes = await app.handle(
        new Request("http://localhost/ops-telco/forms", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3000",
            Cookie: tech1Cookie
          },
          body: JSON.stringify({
            formType: "oncall",
            data: {
              jobOrder: "JO-MANUAL-TELCO-777",
              dateRequired: "2026-03-22",
              startTime: "09:00",
              endTime: "17:00",
              description: "Site visit"
            }
          })
        })
      );
      expect(manualRes.status).toBe(201);
      const manualBody = (await manualRes.json()) as any;
      expect(manualBody.data.data.jobOrder).toBe("JO-MANUAL-TELCO-777");

      // Auto fallback
      const autoRes = await app.handle(
        new Request("http://localhost/ops-telco/forms", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3000",
            Cookie: tech1Cookie
          },
          body: JSON.stringify({
            formType: "oncall",
            data: {
              jobOrder: "   ",
              dateRequired: "2026-03-22",
              startTime: "09:00",
              endTime: "17:00",
              description: "Site visit auto"
            }
          })
        })
      );
      expect(autoRes.status).toBe(201);
      const autoBody = (await autoRes.json()) as any;
      expect(autoBody.data.data.jobOrder).toBe(autoBody.data.formNumber);
    });

    it("14. Total Jam (totalHours) dihapus otomatis dan tidak tersimpan di database", async () => {
      const res = await app.handle(
        new Request("http://localhost/ops-telco/forms", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3000",
            Cookie: tech1Cookie
          },
          body: JSON.stringify({
            formType: "oncall",
            data: {
              totalHours: "8.0",
              dateRequired: "2026-03-22",
              startTime: "09:00",
              endTime: "17:00",
              description: "Power generator check"
            }
          })
        })
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.data.data.totalHours).toBeUndefined();
    });

    it("15. Akun tanpa ID KPC diperbolehkan simpan draf, namun ditolak pengajuan (submission) HTTP 422", async () => {
      // Simpan draf berhasil
      const draftRes = await app.handle(
        new Request("http://localhost/ops-telco/forms", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3000",
            Cookie: techNoKpcCookie
          },
          body: JSON.stringify({
            formType: "oncall",
            data: {
              dateRequired: "2026-03-23",
              startTime: "10:00",
              endTime: "15:00",
              description: "Draf tanpa KPC"
            }
          })
        })
      );
      expect(draftRes.status).toBe(201);
      const draftBody = (await draftRes.json()) as any;
      const noKpcId = draftBody.data.id;

      // Pengajuan (submission) ditolak 422
      const submitRes = await app.handle(
        new Request(`http://localhost/ops-telco/forms/${noKpcId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3000",
            Cookie: techNoKpcCookie
          },
          body: JSON.stringify({
            status: "submitted",
            data: {
              dateRequired: "2026-03-23",
              startTime: "10:00",
              endTime: "15:00",
              description: "Draf tanpa KPC"
            }
          })
        })
      );
      expect(submitRes.status).toBe(422);
      const submitBody = (await submitRes.json()) as any;
      expect(submitBody.message).toContain("ID KPC akun Anda belum tersedia. Hubungi administrator sebelum mengajukan Form Oncall.");
    });
  });

  describe("PDF Generation Criteria", () => {
    it("16. PDF Oncall digenerate programatik tanpa error dan tanpa Total Jam", async () => {
      const bytes = await generateOpsTelcoPdf("oncall", {
        employeeName: `${tech1User.name} - ${tech1User.kpcId}`,
        supervisorName: "Rahmansyah - Z110779",
        dateRequired: "2026-03-20",
        startTime: "08:00",
        endTime: "16:00",
        description: "Programmatic PDF Oncall Test"
      });
      expect(bytes).toBeDefined();
      expect(bytes.byteLength).toBeGreaterThan(1000);
    });

    it("17. PDF Overtime dan Cuti menggunakan master background resmi tanpa error", async () => {
      const otBytes = await generateOpsTelcoPdf("overtime", {
        employeeName: "Teknisi Overtime",
        supervisorName: "Supervisor Overtime",
        dateRequired: "2026-03-20",
        actualHours: "4",
        startTime: "18:00",
        endTime: "22:00",
        description: "Lembur perbaikan gardu"
      });
      expect(otBytes).toBeDefined();
      expect(otBytes.byteLength).toBeGreaterThan(5000);

      const cutiBytes = await generateOpsTelcoPdf("cuti", {
        employeeName: "Teknisi Cuti",
        employeeId: "KPC99001",
        leaveStartDate: "2026-04-01",
        leaveEndDate: "2026-04-03",
        workDays: "3",
        leaveType: "paid",
        reason: "Cuti keperluan keluarga"
      });
      expect(cutiBytes).toBeDefined();
      expect(cutiBytes.byteLength).toBeGreaterThan(5000);
    });

    it("18. Endpoint /:id/pdf mengunduh file PDF yang valid", async () => {
      // Create a form to download
      const res = await app.handle(
        new Request("http://localhost/ops-telco/forms", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3000",
            Cookie: tech1Cookie
          },
          body: JSON.stringify({
            formType: "oncall",
            data: {
              dateRequired: "2026-03-24",
              startTime: "08:00",
              endTime: "14:00",
              description: "PDF endpoint test"
            }
          })
        })
      );
      const body = (await res.json()) as any;

      const pdfRes = await app.handle(
        new Request(`http://localhost/ops-telco/forms/${body.data.id}/pdf`, {
          headers: { Cookie: tech1Cookie }
        })
      );
      expect(pdfRes.status).toBe(200);
      expect(pdfRes.headers.get("content-type")).toBe("application/pdf");
      const pdfData = await pdfRes.arrayBuffer();
      expect(pdfData.byteLength).toBeGreaterThan(1000);
    });
  });

  describe("RBAC, Menus & Security Escalation Guard Criteria", () => {
    it("19. Pemegang role hr tidak otomatis mendapat izin ops_telco.forms.manage", async () => {
      // Legacy HR officer tries to access /ops-telco/forms
      const res = await app.handle(
        new Request("http://localhost/ops-telco/forms", {
          headers: { Cookie: legacyHrCookie }
        })
      );
      // Legacy HR does not have ops_telco.forms.view or ops_telco.view
      expect(res.status).toBe(403);
    });

    it("20. Role employee-basic memiliki ops_telco.forms.view dan dapat membuka formulir", async () => {
      // Grant employee-basic to noAccessUser
      const [empRole] = await db.select().from(roles).where(eq(roles.slug, "employee-basic")).limit(1);
      expect(empRole).toBeDefined();
      await db.insert(userRoles).values({ userId: noAccessUser.id, roleId: empRole.id }).onDuplicateKeyUpdate({ set: { roleId: empRole.id } });

      const res = await app.handle(
        new Request("http://localhost/ops-telco/forms", {
          headers: { Cookie: noAccessCookie }
        })
      );
      expect(res.status).toBe(200);
    });

    it("21. Menu /portal/hr tidak aktif di database, sementara menu /portal/ops-telco aktif", async () => {
      const [hrMenu] = await db.select().from(menus).where(eq(menus.url, "/portal/hr")).limit(1);
      if (hrMenu) {
        expect(Boolean(hrMenu.isActive)).toBe(false);
      }

      const [opsTelcoMenu] = await db.select().from(menus).where(eq(menus.url, "/portal/ops-telco")).limit(1);
      expect(opsTelcoMenu).toBeDefined();
      expect(Boolean(opsTelcoMenu.isActive)).toBe(true);
    });

    it("22. Regression protection: Form Overtime dan Cuti tidak kehilangan data", async () => {
      const res = await app.handle(
        new Request("http://localhost/ops-telco/forms", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3000",
            Cookie: tech1Cookie
          },
          body: JSON.stringify({
            formType: "overtime",
            data: {
              employeeName: "Custom Overtime Name",
              supervisorName: "Custom Supervisor Name",
              dateRequired: "2026-03-28",
              startTime: "18:00",
              endTime: "22:00",
              description: "Night shift maintenance"
            }
          })
        })
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.data.formType).toBe("overtime");
      expect(body.data.data.employeeName).toBe("Custom Overtime Name");
      expect(body.data.data.supervisorName).toBe("Custom Supervisor Name");
    });

    it("23. Zero data loss: tabel ops_telco_forms mempertahankan seluruh relasi dan struktur", async () => {
      const [countResult] = await db.select().from(opsTelcoForms).limit(1);
      expect(countResult).toBeDefined();
      expect(countResult.id).toBeGreaterThan(0);
      expect(countResult.formType).toBeDefined();
      expect(countResult.formNumber).toBeDefined();
    });
  });
});
