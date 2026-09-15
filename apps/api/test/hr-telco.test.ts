import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { and, eq, inArray } from "drizzle-orm";
import { PDFDocument } from "pdf-lib";
import { db } from "../src/db";
import { auditLogs, hrForms, permissions, rolePermissions, roles, users } from "../src/db/schema";
import { UserProvisioningService } from "../src/services/user-provisioning";
import { app } from "./setup";

async function request(path: string, cookie = "", method = "GET", body?: unknown, origin = "http://localhost:3000") {
  return app.handle(new Request(`http://localhost${path}`, { method, headers: { Cookie: cookie, Origin: origin, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
}
async function login(email: string, password = "demo12345", admin = false) {
  const response = await request(admin ? "/auth/admin/login" : "/auth/login", "", "POST", { email, password });
  expect(response.status).toBe(200);
  return response.headers.get("set-cookie")!;
}
async function create(cookie: string, formType = "oncall", data: Record<string, string> = { employeeName: "Teknisi A" }) {
  const response = await request("/hr/forms", cookie, "POST", { formType, data });
  if (response.status !== 201) throw new Error(`Create: ${response.status} ${await response.text()}`);
  return (await response.json()).data;
}

describe("HR forms and Telco authorization", () => {
  let owner = "", other = "", manager = "", admin = "", technician = "", supervisor = "";
  let ownRole = 0, parentPermission = 0;
  const createdUserIds: number[] = [], createdFormIds: number[] = [];
  const fullCuti = { employeeName: "Teknisi A", employeeId: "KPC-001", leaveStartDate: "2026-10-01", leaveEndDate: "2026-10-02", workDays: "2", leaveType: "paid", reason: "Keperluan keluarga" };
  beforeAll(async () => {
    const [adminRow] = await db.select().from(users).where(eq(users.email, "admin@mknsite.online"));
    const [role] = await db.insert(roles).values({ name: "HR test owner", slug: `hr-test-${Date.now()}` }).$returningId();
    ownRole = role.id;
    const grants = await db.select().from(permissions).where(inArray(permissions.slug, ["hr.view", "ops_telco.view", "ops_telco.schedule.view", "ops_telco.wag_report.view", "ops_telco.estimate.view", "ops_telco.documentation.view"]));
    parentPermission = grants.find((p) => p.slug === "ops_telco.view")!.id;
    await db.insert(rolePermissions).values(grants.map((p) => ({ roleId: role.id, permissionId: p.id })));
    for (const letter of ["a", "b"]) {
      const email = `hr-test-${letter}-${role.id}@example.test`;
      const result = await new UserProvisioningService().createEmployee({ name: `Teknisi ${letter}`, email, password: "demo12345", roleIds: [role.id] }, adminRow.id);
      if ("error" in result) throw new Error(result.error.code);
      createdUserIds.push(result.user.id);
      if (letter === "a") owner = await login(email); else other = await login(email);
    }
    manager = await login("hr@mknsite.online");
    technician = await login("telco@mknsite.online");
    supervisor = await login("supervisor@mknsite.online");
    admin = await login("admin@mknsite.online", "admin12345", true);
  });
  afterAll(async () => {
    if (createdFormIds.length) await db.delete(hrForms).where(inArray(hrForms.id, createdFormIds));
    if (createdUserIds.length) {
      await db.delete(hrForms).where(inArray(hrForms.createdBy, createdUserIds));
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
    if (ownRole) await db.delete(roles).where(eq(roles.id, ownRole));
  });

  it("requires employee session, hr.view and allowed Origin for writes", async () => {
    expect((await request("/hr/forms")).status).toBe(401);
    expect((await request("/hr/forms", admin)).status).toBe(401);
    expect((await request("/hr/forms", technician)).status).toBe(403);
    expect((await request("/hr/forms", owner, "POST", { formType: "oncall", data: {} }, "https://evil.example")).status).toBe(403);
  });
  it("enforces ownership for list, updates, duplication and PDF", async () => {
    const form = await create(owner);
    const list = await (await request("/hr/forms", other)).json();
    expect(list.data.some((row: any) => row.id === form.id)).toBe(false);
    for (const [suffix, method, body] of [["", "PATCH", { data: {} }], ["/duplicate", "POST", undefined], ["/pdf", "GET", undefined]] as const) expect((await request(`/hr/forms/${form.id}${suffix}`, other, method, body)).status).toBe(404);
    expect((await request(`/hr/forms/${form.id}`, manager, "PATCH", { data: { employeeName: "Nama diperiksa HR" } })).status).toBe(200);
  });
  it("assigns unique concurrent numbers and ignores client job numbers", async () => {
    const forms = await Promise.all(Array.from({ length: 5 }, () => create(owner, "oncall", { jobOrder: "FORGED" })));
    expect(new Set(forms.map((f) => f.formNumber)).size).toBe(5);
    for (const form of forms) expect(form.data.jobOrder).toBe(form.formNumber);
    const patched = await (await request(`/hr/forms/${forms[0].id}`, owner, "PATCH", { data: { jobOrder: "CHANGED" } })).json();
    expect(patched.data.data.jobOrder).toBe(forms[0].formNumber);
  });
  it("locks submitted and decided forms, sanitizes duplicates, clears decisions on reopen, records audit", async () => {
    const form = await create(owner, "cuti", { ...fullCuti, approvedDays: "999", hrApprover: "FORGED" });
    expect(form.data.approvedDays).toBeUndefined();
    expect(form.data.hrApprover).toBeUndefined();
    expect((await request(`/hr/forms/${form.id}`, owner, "PATCH", { data: {}, status: "approved" })).status).toBe(403);
    expect((await request(`/hr/forms/${form.id}`, owner, "PATCH", { data: {}, status: "submitted" })).status).toBe(200);
    expect((await request(`/hr/forms/${form.id}`, owner, "PATCH", { data: { workDays: "20" } })).status).toBe(409);
    expect((await request(`/hr/forms/${form.id}`, manager, "PATCH", { data: { approvedDays: "2", hrApprover: "HR", applicantSignatureName: "Teknisi A" }, status: "approved" })).status).toBe(200);
    expect((await request(`/hr/forms/${form.id}`, owner, "PATCH", { data: { workDays: "20" } })).status).toBe(409);
    expect((await request(`/hr/forms/${form.id}`, manager, "PATCH", { data: { workDays: "20" } })).status).toBe(409);
    const copy = await (await request(`/hr/forms/${form.id}/duplicate`, manager, "POST")).json();
    createdFormIds.push(copy.data.id);
    expect(copy.data.status).toBe("draft");
    expect(copy.data.duplicatedFromId).toBe(form.id);
    for (const field of ["employeeName", "employeeId", "applicantSignatureName", "hrApprover", "approvedDays", "workDays"]) expect(copy.data.data[field]).toBeUndefined();
    const reopened = await (await request(`/hr/forms/${form.id}`, manager, "PATCH", { data: {}, status: "draft" })).json();
    expect(reopened.data.status).toBe("draft");
    expect(reopened.data.data.approvedDays).toBeUndefined();
    expect(reopened.data.data.hrApprover).toBeUndefined();
    const audits = await db.select().from(auditLogs).where(and(eq(auditLogs.resource, "hr_forms"), eq(auditLogs.resourceId, String(form.id))));
    expect(audits.map((a) => a.action)).toEqual(["hr.form.created", "hr.form.submitted", "hr.form.approved", "hr.form.draft"]);
  });
  it("rejects invalid dates, negative quantities, unsupported characters and PDF overflow before saving", async () => {
    for (const data of [{ leaveStartDate: "2026-02-30" }, { leaveStartDate: "2026-10-03", leaveEndDate: "2026-10-01" }, { workDays: "-2" }, { workDays: "NaN" }, { employeeName: "Teknisi 😀" }, { employeeName: "W".repeat(200) }, { reason: "terlalu panjang ".repeat(100) }, { unknown: "value" }]) {
      const result = await request("/hr/forms", owner, "POST", { formType: "cuti", data });
      expect(result.status).toBe(422);
    }
    const form = await create(owner, "cuti", fullCuti);
    expect((await request(`/hr/forms/${form.id}`, owner, "PATCH", { data: { workDays: "-1" } })).status).toBe(422);
    const [unchanged] = await db.select().from(hrForms).where(eq(hrForms.id, form.id));
    expect(JSON.parse(unchanged.data).workDays).toBe("2");
    expect((await request(`/hr/forms/${form.id}`, manager, "PATCH", { data: {}, status: "approved" })).status).toBe(409);
  });
  it("produces all three Letter PDFs and prevents account deletion from erasing HR history", async () => {
    for (const type of ["oncall", "overtime", "cuti"]) {
      const form = await create(owner, type, type === "cuti" ? fullCuti : { employeeName: "Teknisi A", dateRequired: "2026-09-14" });
      const result = await request(`/hr/forms/${form.id}/pdf`, owner);
      expect(result.status).toBe(200);
      expect(result.headers.get("content-type")).toBe("application/pdf");
      const pdf = await PDFDocument.load(await result.arrayBuffer());
      expect(pdf.getPages()).toHaveLength(1);
      expect(pdf.getPage(0).getSize()).toEqual({ width: 612, height: 792 });
    }
    expect((await request(`/admin/users/${createdUserIds[0]}`, admin, "DELETE")).status).toBe(409);
    await expect(Promise.resolve(db.delete(users).where(eq(users.id, createdUserIds[0])))).rejects.toThrow();
  });
  it("enforces every supervisor/technician submenu and rechecks the parent grant", async () => {
    for (const section of ["assign-job", "assign-jadwal-oncall", "form-pto", "jadwal-oncall", "auto-report-wag", "estimasi-quotation", "dokumentasi-pekerjaan"]) {
      expect((await request(`/workspace/ops-telco/${section}`, supervisor)).status).toBe(200);
      expect((await request(`/workspace/ops-telco/${section}`, owner)).status).toBe(["assign-job", "assign-jadwal-oncall", "form-pto"].includes(section) ? 403 : 200);
    }
    await db.delete(rolePermissions).where(and(eq(rolePermissions.roleId, ownRole), eq(rolePermissions.permissionId, parentPermission)));
    expect((await request("/workspace/ops-telco", owner)).status).toBe(403);
    expect((await request("/workspace/ops-telco/jadwal-oncall", owner)).status).toBe(403);
  });
});
