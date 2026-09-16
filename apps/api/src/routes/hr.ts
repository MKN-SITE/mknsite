import { and, desc, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { getAuthenticatedProfile } from "../auth/auth";
import { config } from "../config/env";
import { db } from "../db";
import { auditLogs, hrForms } from "../db/schema";
import { generateHrPdf, type HrFormData, type HrFormType } from "../services/hr-pdf.service";
import { duplicateData, editableData, HrError, requireSubmission, validateHrData } from "../services/hr-validation";

type Profile = NonNullable<Awaited<ReturnType<typeof getAuthenticatedProfile>>>;
const isFormType = (value: string): value is HrFormType => ["oncall", "overtime", "cuti"].includes(value);
const canManage = (profile: Profile) => profile.permissions.includes("hr.manage");
const canAccess = (row: typeof hrForms.$inferSelect, profile: Profile) => canManage(profile) || row.createdBy === profile.id;
const parseData = (data: string): HrFormData => JSON.parse(data);
const serialize = (row: typeof hrForms.$inferSelect) => ({ ...row, data: parseData(row.data) });
const numberFor = (type: HrFormType, id: number) => `${{ oncall: "OC", overtime: "OT", cuti: "CT" }[type]}-${new Date().getFullYear()}-${String(id).padStart(5, "0")}`;
const systemData = (type: HrFormType, data: HrFormData, number: string) => type === "cuti" ? data : { ...data, jobOrder: number };
const formData = t.Record(t.String({ maxLength: 80 }), t.String({ maxLength: 2000 }));
const idParams = t.Object({ id: t.Numeric({ minimum: 1, maximum: 2147483647, multipleOf: 1 }) });
const detail = (operationId: string, summary: string) => ({ operationId, summary, tags: ["HR"], security: [{ employeeSession: [] }], description: "Memerlukan hr.view. Karyawan mengakses formulir sendiri; hr.manage mengakses semua. Mutasi memerlukan Origin yang diizinkan. Isian tidak valid: 422; status terkunci: 409." });

async function findForm(id: number, profile: Profile) {
  const [row] = await db.select().from(hrForms).where(eq(hrForms.id, id)).limit(1);
  if (!row || !isFormType(row.formType) || !canAccess(row, profile)) throw new HrError(404, "Formulir tidak ditemukan.");
  return { ...row, formType: row.formType };
}
async function createForm(type: HrFormType, input: HrFormData, profile: Profile, sourceId?: number) {
  const clean = validateHrData(type, editableData(input, canManage(profile)));
  await generateHrPdf(type, systemData(type, clean, numberFor(type, 2147483647)));
  return db.transaction(async (tx) => {
    const [created] = await tx.insert(hrForms).values({ formType: type, formNumber: `PENDING-${crypto.randomUUID()}`, data: "{}", createdBy: profile.id, duplicatedFromId: sourceId }).$returningId();
    const number = numberFor(type, created.id);
    await tx.update(hrForms).set({ formNumber: number, data: JSON.stringify(systemData(type, clean, number)) }).where(eq(hrForms.id, created.id));
    await tx.insert(auditLogs).values({ actorId: profile.id, action: sourceId ? "hr.form.duplicated" : "hr.form.created", resource: "hr_forms", resourceId: String(created.id) });
    const [saved] = await tx.select().from(hrForms).where(eq(hrForms.id, created.id));
    return saved;
  });
}

export const hrRoutes = new Elysia({ prefix: "/hr/forms" })
  .onError(({ error, code, status }) => {
    if (error instanceof HrError) return status(error.status, { message: error.message });
    if (code !== "VALIDATION" && code !== "NOT_FOUND" && code !== "PARSE") {
      console.error("HR request failed", error);
      return status(500, { message: "Formulir belum dapat diproses. Coba lagi atau hubungi administrator." });
    }
  })
  .resolve(async ({ request, status }) => {
    const profile = await getAuthenticatedProfile(request.headers, "employee");
    if (!profile) return status(401, { message: "Sesi karyawan tidak valid." });
    if (!profile.permissions.includes("hr.view")) return status(403, { message: "Akses HR diperlukan." });
    if (!["GET", "HEAD"].includes(request.method) && !config.allowedOrigins.includes(request.headers.get("origin") ?? "")) return status(403, { message: "Origin permintaan tidak diizinkan." });
    return { profile };
  })
  .get("/", async ({ query, profile }) => {
    if (query.type && !isFormType(query.type)) throw new HrError(422, "Jenis formulir tidak valid.");
    const rows = await db.select().from(hrForms).where(and(query.type ? eq(hrForms.formType, query.type) : undefined, canManage(profile) ? undefined : eq(hrForms.createdBy, profile.id))).orderBy(desc(hrForms.id)).limit(100);
    return { data: rows.map(serialize) };
  }, { query: t.Object({ type: t.Optional(t.String()) }), detail: detail("listHrForms", "Riwayat 100 formulir HR terbaru") })
  .post("/", async ({ body, profile, status }) => {
    if (!isFormType(body.formType)) throw new HrError(422, "Jenis formulir tidak valid.");
    return status(201, { data: serialize(await createForm(body.formType, body.data, profile)) });
  }, { body: t.Object({ formType: t.String(), data: formData }), detail: detail("createHrForm", "Simpan draf formulir HR dan nomor otomatis") })
  .patch("/:id", async ({ params, body, profile }) => {
    const row = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(hrForms).where(eq(hrForms.id, params.id)).limit(1).for("update");
      if (!existing || !isFormType(existing.formType) || !canAccess(existing, profile)) throw new HrError(404, "Formulir tidak ditemukan.");
      const manage = canManage(profile);
      const nextStatus = body.status ?? existing.status;
      if (!manage && body.status !== undefined && !(existing.status === "draft" && nextStatus === "submitted")) throw new HrError(403, "Hanya HR yang dapat memutuskan atau membuka kembali formulir.");
      const reopening = manage && nextStatus === "draft" && existing.status !== "draft";
      if (existing.status !== "draft" && !reopening && (!manage || existing.status !== "submitted")) throw new HrError(409, "Formulir terkunci. Minta HR membuka kembali sebagai draf sebelum mengubah isian.");
      const transitions: Record<string, string[]> = { draft: ["draft", "submitted"], submitted: ["submitted", "draft", "approved", "rejected", "deferred"], approved: ["draft"], rejected: ["draft"], deferred: ["draft"] };
      if (!transitions[existing.status]?.includes(nextStatus)) throw new HrError(409, "Perubahan status tidak valid. Ajukan draf terlebih dahulu.");
      const merged = { ...parseData(existing.data), ...editableData(body.data, manage) };
      // Reopening invalidates the previous HR decision and balance calculation.
      const data = validateHrData(existing.formType, systemData(existing.formType, reopening ? editableData(merged, false) : merged, existing.formNumber));
      if (nextStatus !== "draft") requireSubmission(existing.formType, data);
      await generateHrPdf(existing.formType, data);
      await tx.update(hrForms).set({ data: JSON.stringify(data), status: nextStatus }).where(eq(hrForms.id, existing.id));
      await tx.insert(auditLogs).values({ actorId: profile.id, action: nextStatus !== existing.status ? `hr.form.${nextStatus}` : "hr.form.updated", resource: "hr_forms", resourceId: String(existing.id) });
      const [saved] = await tx.select().from(hrForms).where(eq(hrForms.id, existing.id));
      return saved;
    });
    return { data: serialize(row) };
  }, { params: idParams, body: t.Object({ data: formData, status: t.Optional(t.Union([t.Literal("draft"), t.Literal("submitted"), t.Literal("approved"), t.Literal("rejected"), t.Literal("deferred")])) }), detail: detail("updateHrForm", "Ubah isian atau status formulir HR") })
  .post("/:id/duplicate", async ({ params, profile, status }) => {
    const source = await findForm(params.id, profile);
    return status(201, { data: serialize(await createForm(source.formType, duplicateData(source.formType, parseData(source.data)), profile, source.id)) });
  }, { params: idParams, detail: detail("duplicateHrForm", "Duplikasi pekerjaan menjadi draf dengan nomor baru") })
  .get("/:id/pdf", async ({ params, profile }) => {
    const row = await findForm(params.id, profile);
    const bytes = await generateHrPdf(row.formType, validateHrData(row.formType, parseData(row.data)));
    const body = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(body).set(bytes);
    return new Response(body, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${row.formNumber}.pdf"`, "Cache-Control": "no-store" } });
  }, { params: idParams, detail: detail("downloadHrFormPdf", "Unduh PDF dari isian terakhir yang tersimpan") });
