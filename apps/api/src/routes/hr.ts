import { desc, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { getAuthenticatedProfile } from "../auth/auth";
import { db } from "../db";
import { hrForms } from "../db/schema";
import { generateHrPdf, type HrFormData, type HrFormType } from "../services/hr-pdf.service";

const formTypes = ["oncall", "overtime", "cuti"] as const;

function isFormType(value: string): value is HrFormType {
  return formTypes.includes(value as HrFormType);
}

function parseData(data: string): HrFormData {
  try { return JSON.parse(data); } catch { return {}; }
}

function serialize(row: typeof hrForms.$inferSelect) {
  return { ...row, data: parseData(row.data) };
}

async function authorized(headers: Headers) {
  const profile = await getAuthenticatedProfile(headers, "employee");
  if (!profile || !profile.permissions.includes("hr.view")) return null;
  return profile;
}

export const hrRoutes = new Elysia({ prefix: "/hr/forms" })
  .get("/", async ({ request, query, status }) => {
    const profile = await authorized(request.headers);
    if (!profile) return status(403, { message: "Akses HR diperlukan." });
    const type = query.type;
    const rows = type && isFormType(type)
      ? await db.select().from(hrForms).where(eq(hrForms.formType, type)).orderBy(desc(hrForms.createdAt)).limit(100)
      : await db.select().from(hrForms).orderBy(desc(hrForms.createdAt)).limit(100);
    return { data: rows.map(serialize) };
  }, { query: t.Object({ type: t.Optional(t.String()) }) })
  .post("/", async ({ request, body, status }) => {
    const profile = await authorized(request.headers);
    if (!profile) return status(403, { message: "Akses HR diperlukan." });
    if (!isFormType(body.formType)) return status(400, { message: "Jenis formulir tidak valid." });
    const [created] = await db.insert(hrForms).values({
      formType: body.formType,
      formNumber: `PENDING-${crypto.randomUUID()}`,
      data: JSON.stringify(body.data),
      createdBy: profile.id,
      duplicatedFromId: body.duplicatedFromId
    }).$returningId();
    const prefix = body.formType === "oncall" ? "OC" : body.formType === "overtime" ? "OT" : "CT";
    const year = new Date().getFullYear();
    const formNumber = `${prefix}-${year}-${String(created.id).padStart(5, "0")}`;
    const savedData = (body.formType === "oncall" || body.formType === "overtime") && !body.data.jobOrder
      ? { ...body.data, jobOrder: formNumber }
      : body.data;
    await db.update(hrForms).set({ formNumber, data: JSON.stringify(savedData) }).where(eq(hrForms.id, created.id));
    const [row] = await db.select().from(hrForms).where(eq(hrForms.id, created.id)).limit(1);
    return status(201, { data: serialize(row) });
  }, {
    body: t.Object({
      formType: t.String(),
      data: t.Record(t.String(), t.String()),
      duplicatedFromId: t.Optional(t.Number())
    })
  })
  .patch("/:id", async ({ request, params, body, status }) => {
    const profile = await authorized(request.headers);
    if (!profile) return status(403, { message: "Akses HR diperlukan." });
    const id = Number(params.id);
    const [existing] = await db.select().from(hrForms).where(eq(hrForms.id, id)).limit(1);
    if (!existing) return status(404, { message: "Formulir tidak ditemukan." });
    await db.update(hrForms).set({ data: JSON.stringify(body.data), status: body.status ?? existing.status }).where(eq(hrForms.id, id));
    const [row] = await db.select().from(hrForms).where(eq(hrForms.id, id)).limit(1);
    return { data: serialize(row) };
  }, {
    body: t.Object({ data: t.Record(t.String(), t.String()), status: t.Optional(t.String()) })
  })
  .post("/:id/duplicate", async ({ request, params, status }) => {
    const profile = await authorized(request.headers);
    if (!profile) return status(403, { message: "Akses HR diperlukan." });
    const id = Number(params.id);
    const [source] = await db.select().from(hrForms).where(eq(hrForms.id, id)).limit(1);
    if (!source) return status(404, { message: "Formulir sumber tidak ditemukan." });
    const data = parseData(source.data);
    delete data.employeeName;
    delete data.employeeId;
    delete data.employeeSignatureName;
    const [created] = await db.insert(hrForms).values({
      formType: source.formType,
      formNumber: `PENDING-${crypto.randomUUID()}`,
      data: JSON.stringify(data),
      createdBy: profile.id,
      duplicatedFromId: source.id
    }).$returningId();
    const prefix = source.formType === "oncall" ? "OC" : source.formType === "overtime" ? "OT" : "CT";
    const formNumber = `${prefix}-${new Date().getFullYear()}-${String(created.id).padStart(5, "0")}`;
    if (source.formType === "oncall" || source.formType === "overtime") data.jobOrder = formNumber;
    await db.update(hrForms).set({ formNumber, data: JSON.stringify(data) }).where(eq(hrForms.id, created.id));
    const [row] = await db.select().from(hrForms).where(eq(hrForms.id, created.id)).limit(1);
    return status(201, { data: serialize(row) });
  })
  .get("/:id/pdf", async ({ request, params, status }) => {
    const profile = await authorized(request.headers);
    if (!profile) return status(403, { message: "Akses HR diperlukan." });
    const [row] = await db.select().from(hrForms).where(eq(hrForms.id, Number(params.id))).limit(1);
    if (!row || !isFormType(row.formType)) return status(404, { message: "Formulir tidak ditemukan." });
    const bytes = await generateHrPdf(row.formType, parseData(row.data));
    const body = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(body).set(bytes);
    return new Response(body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${row.formNumber}.pdf"`,
        "Cache-Control": "no-store"
      }
    });
  });
