import { beforeAll, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { authUsers, menus, permissions, rolePermissions, roles, userRoles, users } from "../src/db/schema";
import { app } from "./setup";

describe("Portal IK & SOP Suite", () => {
  const ts = Date.now();
  const pass = "Password12345!";

  let employeeUser: { id: number; email: string };
  let employeeCookie = "";

  beforeAll(async () => {
    // 1. Register employee
    const email = `iksop_user_${ts}@mknsite.online`;
    const regRes = await app.handle(
      new Request("http://localhost/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "User IK SOP",
          kpcId: `KPC${ts.toString().slice(-5)}`,
          username: `iksop_${ts}`,
          email,
          phone: "081234567899",
          startDate: "2024-01-15",
          password: pass,
          confirmPassword: pass
        })
      })
    );
    expect(regRes.status).toBe(201);
    const regBody = (await regRes.json()) as any;
    employeeUser = { id: regBody.data.id, email };

    // Assign employee-basic role
    const [basicRole] = await db.select().from(roles).where(eq(roles.slug, "employee-basic")).limit(1);
    if (basicRole) {
      await db.insert(userRoles).values({ userId: employeeUser.id, roleId: basicRole.id }).onDuplicateKeyUpdate({ set: { roleId: basicRole.id } });
    }
    await db.update(authUsers).set({ emailVerified: true }).where(eq(authUsers.mknUserId, employeeUser.id));

    // Login employee
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
    employeeCookie = loginRes.headers.get("set-cookie") || "";
    expect(employeeCookie).toBeTruthy();
  });

  it("1. Menu IK & SOP harus ada dan aktif di daftar menu portal", async () => {
    const res = await app.handle(
      new Request("http://localhost/menus", {
        headers: { Cookie: employeeCookie }
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    const ikSopMenu = body.data.find((m: any) => m.url === "/portal/ik-sop");
    expect(ikSopMenu).toBeTruthy();
    expect(ikSopMenu.title).toBe("IK & SOP");
    expect(ikSopMenu.isActive).toBeTruthy();
  });

  it("2. GET /ik-sop/tree mengembalikan kategori IK MKN (10 sub) dan Prosedure KPC (3 sub)", async () => {
    const res = await app.handle(
      new Request("http://localhost/ik-sop/tree", {
        headers: { Cookie: employeeCookie }
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data).toBeArray();
    expect(body.data.length).toBe(2);

    const ikMkn = body.data.find((c: any) => c.id === "ik-mkn");
    expect(ikMkn).toBeTruthy();
    expect(ikMkn.name).toBe("IK MKN");
    expect(ikMkn.subcategories.length).toBe(10);
    const mknSubs = ikMkn.subcategories.map((s: any) => s.id);
    expect(mknSubs).toEqual([
      "telco",
      "osp",
      "pit",
      "hse",
      "engineer",
      "bengalon",
      "helpdesk",
      "hc",
      "finance",
      "warehouse"
    ]);

    const prosedurKpc = body.data.find((c: any) => c.id === "prosedur-kpc");
    expect(prosedurKpc).toBeTruthy();
    expect(prosedurKpc.name).toBe("Prosedure KPC");
    expect(prosedurKpc.subcategories.length).toBe(3);
    const kpcSubs = prosedurKpc.subcategories.map((s: any) => s.id);
    expect(kpcSubs).toEqual(["peraturan", "training", "emergency"]);
  });

  it("3. POST /ik-sop/upload dapat mengunggah file dan terbaca di GET /ik-sop/documents", async () => {
    const dummyContent = "Test IK SOP Document Content";
    const blob = new Blob([dummyContent], { type: "application/pdf" });
    const file = new File([blob], "IK-TELCO-TEST.pdf", { type: "application/pdf" });

    const formData = new FormData();
    formData.append("category", "ik-mkn");
    formData.append("subCategory", "telco");
    formData.append("file", file);

    const uploadRes = await app.handle(
      new Request("http://localhost/ik-sop/upload", {
        method: "POST",
        headers: { Cookie: employeeCookie },
        body: formData
      })
    );
    expect(uploadRes.status).toBe(201);
    const uploadBody = (await uploadRes.json()) as any;
    expect(uploadBody.data.filename).toBe("IK-TELCO-TEST.pdf");
    expect(uploadBody.data.subCategory).toBe("telco");

    // Fetch documents in telco
    const listRes = await app.handle(
      new Request("http://localhost/ik-sop/documents?category=ik-mkn&subCategory=telco", {
        headers: { Cookie: employeeCookie }
      })
    );
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as any;
    const found = listBody.data.find((d: any) => d.filename === "IK-TELCO-TEST.pdf");
    expect(found).toBeTruthy();
    expect(found.extension).toBe("pdf");
  });

  it("4. GET /ik-sop/documents/file dapat men-stream file dan menolak traversal", async () => {
    // Download legitimate file
    const streamRes = await app.handle(
      new Request("http://localhost/ik-sop/documents/file?path=ik-mkn/telco/IK-TELCO-TEST.pdf", {
        headers: { Cookie: employeeCookie }
      })
    );
    expect(streamRes.status).toBe(200);
    expect(streamRes.headers.get("content-type")).toContain("application/pdf");

    // Attempt path traversal
    const traversalRes = await app.handle(
      new Request("http://localhost/ik-sop/documents/file?path=../../../../etc/passwd", {
        headers: { Cookie: employeeCookie }
      })
    );
    expect([400, 403, 404]).toContain(traversalRes.status);
  });
});
