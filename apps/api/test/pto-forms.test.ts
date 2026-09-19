import { beforeAll, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { authUsers, roles, userRoles } from "../src/db/schema";
import { app } from "./setup";

describe("PTO Forms Suite", () => {
  const ts = Date.now();
  const pass = "Password12345!";

  let spvUser: { id: number; email: string };
  let spvCookie = "";
  let createdPtoId = 0;

  beforeAll(async () => {
    // 1. Register supervisor user
    const email = `spv_pto_${ts}@mknsite.online`;
    const regRes = await app.handle(
      new Request("http://localhost/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Supervisor Test PTO",
          kpcId: `Z${ts.toString().slice(-6)}`,
          username: `spvpto_${ts}`,
          email,
          phone: "081234567888",
          startDate: "2023-05-10",
          password: pass,
          confirmPassword: pass
        })
      })
    );
    expect(regRes.status).toBe(201);
    const regBody = (await regRes.json()) as any;
    spvUser = { id: regBody.data.id, email };

    // Assign ops-telco-supervisor role
    const [spvRole] = await db.select().from(roles).where(eq(roles.slug, "ops-telco-supervisor")).limit(1);
    if (spvRole) {
      await db.insert(userRoles).values({ userId: spvUser.id, roleId: spvRole.id }).onDuplicateKeyUpdate({ set: { roleId: spvRole.id } });
    }
    await db.update(authUsers).set({ emailVerified: true }).where(eq(authUsers.mknUserId, spvUser.id));

    // Login supervisor
    const loginRes = await app.handle(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: email,
          password: pass
        })
      })
    );
    expect(loginRes.status).toBe(200);
    spvCookie = loginRes.headers.get("set-cookie") || "";
    expect(spvCookie).toBeTruthy();
  });

  it("1. GET /ops-telco/pto/history-areas harus mengembalikan daftar area historis", async () => {
    const res = await app.handle(
      new Request("http://localhost/ops-telco/pto/history-areas", {
        headers: { cookie: spvCookie }
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  it("2. POST /ops-telco/pto harus berhasil membuat form PTO baru dan men-generate nomor dokumen", async () => {
    const res = await app.handle(
      new Request("http://localhost/ops-telco/pto", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: spvCookie
        },
        body: JSON.stringify({
          procedureTitle: "IK-MKN-TELCO-01 Pemeliharaan Perangkat Radio Repeater",
          department: "Operasional Telekomunikasi",
          observationArea: "Pit J East Hatari Repeater Site",
          date: "2026-09-17",
          time: "09:00 - 11:30 WITA",
          workerNotified: "ya",
          peerReview: "Crew A",
          items: [
            {
              no: "1",
              taskStep: "Pemeriksaan grounding dan koneksi kabel antena",
              deviation: "Klem grounding longgar pada bracket",
              cause: "Vibrasi dan cuaca luar",
              suggestion: "Kencangkan baut klem dan lapisi grease anti korosi"
            }
          ],
          observerName: "Rahmansyah - Z110997",
          observedPerson: "",
          superintendent: "Wanto",
          comments: "Pekerjaan berjalan aman dan sesuai standar keselamatan MKN.",
          status: "completed"
        })
      })
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.data.id).toBeDefined();
    expect(body.data.formNumber).toMatch(/^PTO-\d{4}-\d{5}$/);
    expect(body.data.observerName).toBe("Rahmansyah - Z110997");
    expect(body.data.superintendent).toBe("Wanto");
    expect(body.data.observedPerson).toBe("");

    createdPtoId = body.data.id;
  });

  it("3. GET /ops-telco/pto/:id harus mengembalikan data lengkap PTO yang tersimpan", async () => {
    const res = await app.handle(
      new Request(`http://localhost/ops-telco/pto/${createdPtoId}`, {
        headers: { cookie: spvCookie }
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.id).toBe(createdPtoId);
    expect(body.data.procedureTitle).toBe("IK-MKN-TELCO-01 Pemeliharaan Perangkat Radio Repeater");
    expect(body.data.observationArea).toBe("Pit J East Hatari Repeater Site");
    expect(body.data.items.length).toBe(1);
  });

  it("4. GET /ops-telco/pto/:id/pdf harus menghasilkan PDF valid dari master template", async () => {
    const res = await app.handle(
      new Request(`http://localhost/ops-telco/pto/${createdPtoId}/pdf`, {
        headers: { cookie: spvCookie }
      })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    const arrayBuf = await res.arrayBuffer();
    expect(arrayBuf.byteLength).toBeGreaterThan(100000); // Master PDF template is ~400KB
  });

  it("5. PUT /ops-telco/pto/:id harus berhasil memperbarui data PTO", async () => {
    const res = await app.handle(
      new Request(`http://localhost/ops-telco/pto/${createdPtoId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          cookie: spvCookie
        },
        body: JSON.stringify({
          procedureTitle: "IK-MKN-TELCO-01 Pemeliharaan Perangkat Radio Repeater (Updated)",
          department: "Operasional Telekomunikasi",
          observationArea: "Pit J East Hatari Repeater Site",
          date: "2026-09-17",
          time: "09:00 - 12:00 WITA",
          workerNotified: "ya",
          peerReview: "Crew B",
          items: [
            {
              no: "1",
              taskStep: "Pemeriksaan grounding dan koneksi kabel antena",
              deviation: "Klem grounding longgar pada bracket",
              cause: "Vibrasi dan cuaca luar",
              suggestion: "Kencangkan baut klem dan lapisi grease anti korosi"
            },
            {
              no: "2",
              taskStep: "Pengukuran power output dan VSWR",
              deviation: "VSWR sedikit tinggi (1.4)",
              cause: "Konektor N-type agak lembap",
              suggestion: "Beri seal vulcanizing tape baru"
            }
          ],
          observerName: "Rahmansyah - Z110997",
          observedPerson: "",
          superintendent: "Wanto",
          comments: "Update: semua temuan sudah ditindaklanjuti.",
          status: "completed"
        })
      })
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.items.length).toBe(2);
    expect(body.data.procedureTitle).toContain("(Updated)");
  });
});
