import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { authUsers, opsTelcoForms, roles, userRoles, users } from "../src/db/schema";
import { formatEmployeeIdentity, validateOpsTelcoData } from "../src/services/ops-telco-form-validation";
import { generateOpsTelcoPdf } from "../src/services/ops-telco-form-pdf.service";
import { app } from "./setup";

describe("OPS Telco Form Oncall Identity & Automation Suite", () => {
  const ts = Date.now();
  const pass = "Password12345!";

  let empWithKpcCookie = "";
  let empWithKpcUser: { id: number; name: string; kpcId: string };

  let empWithoutKpcCookie = "";
  let empWithoutKpcUser: { id: number; name: string };

  let emp2WithKpcCookie = "";
  let emp2WithKpcUser: { id: number; name: string; kpcId: string };

  let spvCookie = "";
  let spvUser: { id: number; name: string; kpcId: string };

  beforeAll(async () => {
    // 1. Register Employee 1 (with KPC ID)
    const emp1Email = `emp1_${ts}@mknsite.online`;
    const emp1Kpc = `KPC${ts.toString().slice(-5)}`;
    const reg1Res = await app.handle(
      new Request("http://localhost/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Ayu Prameswari",
          kpcId: emp1Kpc,
          username: `ayu_${ts}`,
          email: emp1Email,
          phone: "081234567891",
          startDate: "2024-01-15",
          password: pass,
          confirmPassword: pass
        })
      })
    );
    expect(reg1Res.status).toBe(201);
    const reg1Body = (await reg1Res.json()) as any;
    empWithKpcUser = { id: reg1Body.data.id, name: "Ayu Prameswari", kpcId: emp1Kpc.toUpperCase() };

    // Grant ops-telco-technician to emp1
    const [techRole] = await db.select().from(roles).where(eq(roles.slug, "ops-telco-technician")).limit(1);
    if (techRole) {
      await db.insert(userRoles).values({ userId: empWithKpcUser.id, roleId: techRole.id }).onDuplicateKeyUpdate({ set: { roleId: techRole.id } });
    }
    await db.update(authUsers).set({ emailVerified: true }).where(eq(authUsers.mknUserId, empWithKpcUser.id));

    // Login Emp 1
    const login1Res = await app.handle(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ identifier: emp1Email, password: pass })
      })
    );
    expect(login1Res.status).toBe(200);
    empWithKpcCookie = login1Res.headers.get("set-cookie") ?? "";

    // 2. Register Employee 2 (without KPC ID - simulated by clearing kpcId in users table)
    const emp2Email = `emp2_${ts}@mknsite.online`;
    const reg2Res = await app.handle(
      new Request("http://localhost/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Karyawan Tanpa KPC",
          kpcId: `TMP${ts.toString().slice(-5)}`,
          username: `nokpc_${ts}`,
          email: emp2Email,
          phone: "081234567892",
          startDate: "2024-01-15",
          password: pass,
          confirmPassword: pass
        })
      })
    );
    expect(reg2Res.status).toBe(201);
    const reg2Body = (await reg2Res.json()) as any;
    empWithoutKpcUser = { id: reg2Body.data.id, name: "Karyawan Tanpa KPC" };
    // Clear kpcId
    await db.update(users).set({ kpcId: null }).where(eq(users.id, empWithoutKpcUser.id));
    if (techRole) {
      await db.insert(userRoles).values({ userId: empWithoutKpcUser.id, roleId: techRole.id }).onDuplicateKeyUpdate({ set: { roleId: techRole.id } });
    }
    await db.update(authUsers).set({ emailVerified: true }).where(eq(authUsers.mknUserId, empWithoutKpcUser.id));

    const login2Res = await app.handle(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ identifier: emp2Email, password: pass })
      })
    );
    expect(login2Res.status).toBe(200);
    empWithoutKpcCookie = login2Res.headers.get("set-cookie") ?? "";

    // 3. Register Employee 3 (for duplicate test)
    const emp3Email = `emp3_${ts}@mknsite.online`;
    const emp3Kpc = `KPC888${ts.toString().slice(-4)}`;
    const reg3Res = await app.handle(
      new Request("http://localhost/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Budi Santoso",
          kpcId: emp3Kpc,
          username: `budi_${ts}`,
          email: emp3Email,
          phone: "081234567893",
          startDate: "2024-01-15",
          password: pass,
          confirmPassword: pass
        })
      })
    );
    expect(reg3Res.status).toBe(201);
    const reg3Body = (await reg3Res.json()) as any;
    emp2WithKpcUser = { id: reg3Body.data.id, name: "Budi Santoso", kpcId: emp3Kpc.toUpperCase() };
    if (techRole) {
      await db.insert(userRoles).values({ userId: emp2WithKpcUser.id, roleId: techRole.id }).onDuplicateKeyUpdate({ set: { roleId: techRole.id } });
    }
    await db.update(authUsers).set({ emailVerified: true }).where(eq(authUsers.mknUserId, emp2WithKpcUser.id));

    const login3Res = await app.handle(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ identifier: emp3Email, password: pass })
      })
    );
    emp2WithKpcCookie = login3Res.headers.get("set-cookie") ?? "";

    // 4. Register Supervisor
    const spvEmail = `spv_oncall_${ts}@mknsite.online`;
    const spvKpc = `SPV${ts.toString().slice(-5)}`;
    const regSpv = await app.handle(
      new Request("http://localhost/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Supervisor Oncall",
          kpcId: spvKpc,
          username: `spv_oc_${ts}`,
          email: spvEmail,
          phone: "081234567894",
          startDate: "2024-01-15",
          password: pass,
          confirmPassword: pass
        })
      })
    );
    expect(regSpv.status).toBe(201);
    const spvBody = (await regSpv.json()) as any;
    spvUser = { id: spvBody.data.id, name: "Supervisor Oncall", kpcId: spvKpc.toUpperCase() };
    const [spvRole] = await db.select().from(roles).where(eq(roles.slug, "ops-telco-supervisor")).limit(1);
    if (spvRole) {
      await db.insert(userRoles).values({ userId: spvUser.id, roleId: spvRole.id }).onDuplicateKeyUpdate({ set: { roleId: spvRole.id } });
    }
    await db.update(authUsers).set({ emailVerified: true }).where(eq(authUsers.mknUserId, spvUser.id));

    const spvLoginRes = await app.handle(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ identifier: spvEmail, password: pass })
      })
    );
    expect(spvLoginRes.status).toBe(200);
    spvCookie = spvLoginRes.headers.get("set-cookie") ?? "";
  }, 30000);

  describe("1. Helper & Formatting", () => {
    it("formatEmployeeIdentity menormalisasi whitespace dan huruf kapital", () => {
      const result = formatEmployeeIdentity("  Ayu Prameswari  ", "  kpc12345  ");
      expect(result).toBe("Ayu Prameswari - KPC12345");
    });
  });

  describe("2. Oncall Form Creation & Automation", () => {
    let createdFormId: number;

    it("mengabaikan employeeName dari client dan otomatis menggunakan identitas akun login", async () => {
      const res = await app.handle(
        new Request("http://localhost/ops-telco/forms", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3000",
            Cookie: empWithKpcCookie
          },
          body: JSON.stringify({
            formType: "oncall",
            data: {
              employeeName: "Hacker / Nama Palsu",
              supervisorName: "Supervisor Palsu",
              customerRequestBy: "PT Client Telco",
              dateRequired: "2026-03-20",
              startTime: "08:00",
              endTime: "16:00",
              description: "Perbaikan link radio MW",
              totalHours: "8" // Client mencoba mengirim totalHours
            }
          })
        })
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.data.formType).toBe("oncall");
      expect(body.data.data.employeeName).toBe(`${empWithKpcUser.name} - ${empWithKpcUser.kpcId}`);
      expect(body.data.data.supervisorName).toBe("Supervisor Palsu");
      expect(body.data.data.totalHours).toBeUndefined(); // totalHours harus hilang
      expect(body.data.data.jobOrder).toBe(body.data.formNumber); // default ke nomor otomatis

      createdFormId = body.data.id;
    });

    it("mempertahankan jobOrder manual jika diisi oleh pengguna", async () => {
      const res = await app.handle(
        new Request("http://localhost/ops-telco/forms", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3000",
            Cookie: empWithKpcCookie
          },
          body: JSON.stringify({
            formType: "oncall",
            data: {
              jobOrder: "JO-TELCO-MANUAL-2026",
              dateRequired: "2026-03-21",
              startTime: "09:00",
              endTime: "17:00",
              description: "Instalasi perangkat baru"
            }
          })
        })
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.data.data.jobOrder).toBe("JO-TELCO-MANUAL-2026");
    });

    it("memperbolehkan simpan draf bagi akun tanpa KPC ID, namun menolak pengajuan (submission)", async () => {
      // Simpan draf
      const draftRes = await app.handle(
        new Request("http://localhost/ops-telco/forms", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3000",
            Cookie: empWithoutKpcCookie
          },
          body: JSON.stringify({
            formType: "oncall",
            data: {
              dateRequired: "2026-03-22",
              startTime: "10:00",
              endTime: "15:00",
              description: "Troubleshoot fiber cut"
            }
          })
        })
      );
      expect(draftRes.status).toBe(201);
      const draftBody = (await draftRes.json()) as any;
      const noKpcFormId = draftBody.data.id;

      // Coba ajukan ke Supervisor (status: submitted)
      const submitRes = await app.handle(
        new Request(`http://localhost/ops-telco/forms/${noKpcFormId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3000",
            Cookie: empWithoutKpcCookie
          },
          body: JSON.stringify({
            status: "submitted",
            data: {
              dateRequired: "2026-03-22",
              startTime: "10:00",
              endTime: "15:00",
              description: "Troubleshoot fiber cut"
            }
          })
        })
      );
      expect(submitRes.status).toBe(422);
      const submitBody = (await submitRes.json()) as any;
      expect(submitBody.message).toContain("ID KPC akun Anda belum tersedia. Hubungi administrator sebelum mengajukan Form Oncall.");
    });
  });

  describe("3. Preservation on Edit & Duplication", () => {
    let formIdToEdit: number;

    beforeAll(async () => {
      const res = await app.handle(
        new Request("http://localhost/ops-telco/forms", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3000",
            Cookie: empWithKpcCookie
          },
          body: JSON.stringify({
            formType: "oncall",
            data: {
              dateRequired: "2026-03-25",
              startTime: "08:00",
              endTime: "17:00",
              description: "Preventive maintenance"
            }
          })
        })
      );
      const body = (await res.json()) as any;
      formIdToEdit = body.data.id;
    });

    it("Supervisor mengedit formulir teknisi lain TIDAK mengganti employeeName menjadi identitas Supervisor", async () => {
      const patchRes = await app.handle(
        new Request(`http://localhost/ops-telco/forms/${formIdToEdit}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3000",
            Cookie: spvCookie
          },
          body: JSON.stringify({
            data: {
              description: "Preventive maintenance approved by supervisor"
            }
          })
        })
      );
      expect(patchRes.status).toBe(200);
      const body = (await patchRes.json()) as any;
      expect(body.data.data.employeeName).toBe(`${empWithKpcUser.name} - ${empWithKpcUser.kpcId}`);
      expect(body.data.data.supervisorName).toBe("Rahmansyah - Z110779");
    });

    it("duplikasi formulir oleh Supervisor menggunakan identitas penduplikat (Supervisor), bukan pemilik asal", async () => {
      const dupRes = await app.handle(
        new Request(`http://localhost/ops-telco/forms/${formIdToEdit}/duplicate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3000",
            Cookie: spvCookie
          }
        })
      );
      expect(dupRes.status).toBe(201);
      const body = (await dupRes.json()) as any;
      expect(body.data.createdBy).not.toBe(empWithKpcUser.id);
      expect(body.data.data.employeeName).toContain("Supervisor Oncall");
      expect(body.data.data.supervisorName).toBe("Rahmansyah - Z110779");
      expect(body.data.data.totalHours).toBeUndefined();
    });

    it("duplikasi formulir oleh karyawan pemilik menggunakan identitas karyawan sendiri", async () => {
      const dupRes = await app.handle(
        new Request(`http://localhost/ops-telco/forms/${formIdToEdit}/duplicate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3000",
            Cookie: empWithKpcCookie
          }
        })
      );
      expect(dupRes.status).toBe(201);
      const body = (await dupRes.json()) as any;
      expect(body.data.createdBy).toBe(empWithKpcUser.id);
      expect(body.data.data.employeeName).toBe(`${empWithKpcUser.name} - ${empWithKpcUser.kpcId}`);
      expect(body.data.data.supervisorName).toBe("Rahmansyah - Z110779");
      expect(body.data.data.totalHours).toBeUndefined();
    });
  });

  describe("4. PDF Generation & Signatures", () => {
    it("menghasilkan PDF tanpa error meskipun nama karyawan sangat panjang", async () => {
      const longName = "Muhammad Raden Panji Suryokusumo Hadiningrat Pratama - KPC99999";
      const pdfBytes = await generateOpsTelcoPdf("oncall", {
        employeeName: longName,
        supervisorName: "Rahmansyah - Z110779",
        dateRequired: "2026-03-25",
        startTime: "08:00",
        endTime: "17:00",
        description: "Uji coba cetak PDF nama panjang"
      });
      expect(pdfBytes).toBeDefined();
      expect(pdfBytes.byteLength).toBeGreaterThan(1000);
    });
  });

  describe("5. Regression Protection (Overtime & Cuti)", () => {
    it("Form Overtime tetap berfungsi normal dan tidak dipaksa supervisor oncall", async () => {
      const res = await app.handle(
        new Request("http://localhost/ops-telco/forms", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3000",
            Cookie: empWithKpcCookie
          },
          body: JSON.stringify({
            formType: "overtime",
            data: {
              employeeName: "Custom Employee OT",
              supervisorName: "Custom Supervisor OT",
              dateRequired: "2026-03-26",
              startTime: "18:00",
              endTime: "21:00",
              description: "Overtime kerja malam"
            }
          })
        })
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.data.formType).toBe("overtime");
      expect(body.data.data.employeeName).toBe("Custom Employee OT");
      expect(body.data.data.supervisorName).toBe("Custom Supervisor OT");
    });
  });
});
