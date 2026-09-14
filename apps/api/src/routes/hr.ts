import { and, desc, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { getAuthenticatedProfile } from "../auth/auth";
import { db } from "../db";
import { hrForms } from "../db/schema";
import { generateHrPdf, type HrFormData, type HrFormType } from "../services/hr-pdf.service";

const formTypes = ["oncall", "overtime", "cuti"] as const;
const operationalTypes = new Set<HrFormType>(["oncall", "overtime"]);
const protectedHrFields = new Set([
  "hrCheckedBy", "hrCheckedDate", "approvedDays", "deferredDays", "approvalNote",
  "hrApprover", "departmentApprover", "financeApprover", "previousYearPeriod",
  "previousYearBalance", "previousYearUsed", "currentYearPeriod", "currentYearBalance",
  "currentYearUsed", "fiveYearBalance", "fiveYearUsed", "totalEntitlementPeriod",
  "totalEntitlement", "totalUsed", "leaveRequestPeriod", "leaveRequestBalance",
  "leaveRequestUsed", "remainingBeforePeriod", "remainingBeforeBalance", "remainingBeforeUsed",
  "deferredPeriod", "deferredBalance", "deferredUsed", "remainingPeriod", "remainingBalance",
  "remainingUsed"
]);

type Profile = NonNullable<Awaited<ReturnType<typeof getAuthenticatedProfile>>>;

function isFormType(value: string): value is HrFormType {
  return formTypes.includes(value as HrFormType);
}

function parseData(data: string): HrFormData {
  try {
    return JSON.parse(data);
  } catch {
    return {};
  }
}

function serialize(row: typeof hrForms.$inferSelect) {
  return { ...row, data: parseData(row.data) };
}

function canView(profile: Profile) {
  return profile.permissions.includes("hr.view");
}

function canManage(profile: Profile) {
  return profile.permissions.includes("hr.manage");
}

function canAccess(row: typeof hrForms.$inferSelect, profile: Profile) {
  return canManage(profile) || row.createdBy === profile.id;
}

function editableData(input: HrFormData, profile: Profile) {
  const result = { ...input };
  if (!canManage(profile)) {
    for (const key of protectedHrFields) delete result[key];
  }
  return result;
}

function withSystemJobOrder(type: HrFormType, data: HrFormData, number: string) {
  return operationalTypes.has(type) ? { ...data, jobOrder: number } : data;
}

function createFormNumber(type: HrFormType, id: number) {
  const prefix = type === "oncall" ? "OC" : type === "overtime" ? "OT" : "CT";
  return `${prefix}-${new Date().getFullYear()}-${String(id).padStart(5, "0")}`;
}

async function findForm(id: number) {
  if (!Number.isInteger(id) || id < 1) return null;
  const [row] = await db.select().from(hrForms).where(eq(hrForms.id, id)).limit(1);
  return row ?? null;
}

export const hrRoutes = new Elysia({ prefix: "/hr/forms" })
  .get("/", async ({ request, query, status }) => {
    const profile = await getAuthenticatedProfile(request.headers, "employee");
    if (!profile) return status(401, { message: "Sesi karyawan tidak valid." });
    if (!canView(profile)) return status(403, { message: "Akses HR diperlukan." });
    if (query.type && !isFormType(query.type)) return status(400, { message: "Jenis formulir tidak valid." });

    const type = query.type as HrFormType | undefined;
    const visibleRows = canManage(profile)
      ? type
        ? db.select().from(hrForms).where(eq(hrForms.formType, type))
        : db.select().from(hrForms)
      : type
        ? db.select().from(hrForms).where(and(eq(hrForms.formType, type), eq(hrForms.createdBy, profile.id)))
        : db.select().from(hrForms).where(eq(hrForms.createdBy, profile.id));
    const rows = await visibleRows.orderBy(desc(hrForms.createdAt)).limit(100);
    return { data: rows.map(serialize) };
  }, { query: t.Object({ type: t.Optional(t.String()) }) })
  .post("/", async ({ request, body, status }) => {
    const profile = await getAuthenticatedProfile(request.headers, "employee");
    if (!profile) return status(401, { message: "Sesi karyawan tidak valid." });
    if (!canView(profile)) return status(403, { message: "Akses HR diperlukan." });
    if (!isFormType(body.formType)) return status(400, { message: "Jenis formulir tidak valid." });

    const row = await db.transaction(async (tx) => {
      const [created] = await tx.insert(hrForms).values({
        formType: body.formType,
        formNumber: `PENDING-${crypto.randomUUID()}`,
        data: JSON.stringify(editableData(body.data, profile)),
        createdBy: profile.id
      }).$returningId();
      const number = createFormNumber(body.formType, created.id);
      const data = withSystemJobOrder(body.formType, editableData(body.data, profile), number);
      await tx.update(hrForms).set({ formNumber: number, data: JSON.stringify(data) }).where(eq(hrForms.id, created.id));
      const [saved] = await tx.select().from(hrForms).where(eq(hrForms.id, created.id)).limit(1);
      if (!saved) throw new Error("Formulir gagal disimpan.");
      return saved;
    });
    return status(201, { data: serialize(row) });
  }, {
    body: t.Object({
      formType: t.String(),
      data: t.Record(t.String(), t.String())
    })
  })
  .patch("/:id", async ({ request, params, body, status }) => {
    const profile = await getAuthenticatedProfile(request.headers, "employee");
    if (!profile) return status(401, { message: "Sesi karyawan tidak valid." });
    if (!canView(profile)) return status(403, { message: "Akses HR diperlukan." });
    const existing = await findForm(Number(params.id));
    if (!existing || !isFormType(existing.formType) || !canAccess(existing, profile)) {
      return status(404, { message: "Formulir tidak ditemukan." });
    }
    if (body.status !== undefined && !canManage(profile)) {
      return status(403, { message: "Hanya HR yang dapat mengubah status formulir." });
    }

    const mergedData = { ...parseData(existing.data), ...editableData(body.data, profile) };
    const data = withSystemJobOrder(existing.formType, mergedData, existing.formNumber);
    await db.update(hrForms).set({
      data: JSON.stringify(data),
      status: body.status ?? existing.status
    }).where(eq(hrForms.id, existing.id));
    const row = await findForm(existing.id);
    if (!row) return status(404, { message: "Formulir tidak ditemukan." });
    return { data: serialize(row) };
  }, {
    body: t.Object({
      data: t.Record(t.String(), t.String()),
      status: t.Optional(t.Union([
        t.Literal("draft"), t.Literal("submitted"), t.Literal("approved"),
        t.Literal("rejected"), t.Literal("deferred")
      ]))
    })
  })
  .post("/:id/duplicate", async ({ request, params, status }) => {
    const profile = await getAuthenticatedProfile(request.headers, "employee");
    if (!profile) return status(401, { message: "Sesi karyawan tidak valid." });
    if (!canView(profile)) return status(403, { message: "Akses HR diperlukan." });
    const source = await findForm(Number(params.id));
    if (!source || !isFormType(source.formType) || !canAccess(source, profile)) {
      return status(404, { message: "Formulir sumber tidak ditemukan." });
    }

    const row = await db.transaction(async (tx) => {
      const data = editableData(parseData(source.data), profile);
      delete data.employeeName;
      delete data.employeeId;
      delete data.employeeSignatureName;
      const [created] = await tx.insert(hrForms).values({
        formType: source.formType,
        formNumber: `PENDING-${crypto.randomUUID()}`,
        data: JSON.stringify(data),
        createdBy: profile.id,
        duplicatedFromId: source.id
      }).$returningId();
      const number = createFormNumber(source.formType, created.id);
      const savedData = withSystemJobOrder(source.formType, data, number);
      await tx.update(hrForms).set({ formNumber: number, data: JSON.stringify(savedData) }).where(eq(hrForms.id, created.id));
      const [saved] = await tx.select().from(hrForms).where(eq(hrForms.id, created.id)).limit(1);
      if (!saved) throw new Error("Duplikasi formulir gagal disimpan.");
      return saved;
    });
    return status(201, { data: serialize(row) });
  })
  .get("/:id/pdf", async ({ request, params, status }) => {
    const profile = await getAuthenticatedProfile(request.headers, "employee");
    if (!profile) return status(401, { message: "Sesi karyawan tidak valid." });
    if (!canView(profile)) return status(403, { message: "Akses HR diperlukan." });
    const row = await findForm(Number(params.id));
    if (!row || !isFormType(row.formType) || !canAccess(row, profile)) {
      return status(404, { message: "Formulir tidak ditemukan." });
    }
    const bytes = await generateHrPdf(row.formType, parseData(row.data));
    const responseBody = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(responseBody).set(bytes);
    return new Response(responseBody, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${row.formNumber}.pdf"`,
        "Cache-Control": "no-store"
      }
    });
  });
