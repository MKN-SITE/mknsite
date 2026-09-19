import { and, desc, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { getAuthenticatedProfile } from "../auth/auth";
import { config } from "../config/env";
import { db } from "../db";
import { auditLogs, opsTelcoForms, users } from "../db/schema";
import { generateOpsTelcoPdf, type OpsTelcoFormData, type OpsTelcoFormType } from "../services/ops-telco-form-pdf.service";
import {
  duplicateOpsTelcoData,
  editableData,
  formatEmployeeIdentity,
  OpsTelcoFormError,
  requireSubmission,
  validateOpsTelcoData
} from "../services/ops-telco-form-validation";

type Profile = NonNullable<Awaited<ReturnType<typeof getAuthenticatedProfile>>>;
const isFormType = (value: string): value is OpsTelcoFormType => ["oncall", "overtime", "cuti"].includes(value);
const canManage = (profile: Profile) => profile.permissions.includes("ops_telco.forms.manage");
const canAccess = (row: typeof opsTelcoForms.$inferSelect, profile: Profile) => canManage(profile) || row.createdBy === profile.id;
const parseData = (data: string): OpsTelcoFormData => JSON.parse(data);
const serialize = (row: typeof opsTelcoForms.$inferSelect) => ({ ...row, data: parseData(row.data) });
const numberFor = (type: OpsTelcoFormType, id: number) => `${{ oncall: "OC", overtime: "OT", cuti: "CT" }[type]}-${new Date().getFullYear()}-${String(id).padStart(5, "0")}`;

const systemData = (type: OpsTelcoFormType, data: OpsTelcoFormData, number: string) => {
  if (type === "cuti") return data;
  if (type === "oncall") {
    const jobOrder = data.jobOrder && typeof data.jobOrder === "string" && data.jobOrder.trim() ? data.jobOrder.trim() : number;
    return { ...data, jobOrder };
  }
  return { ...data, jobOrder: number };
};

const formData = t.Record(t.String({ maxLength: 80 }), t.String({ maxLength: 2000 }));
const idParams = t.Object({ id: t.Numeric({ minimum: 1, maximum: 2147483647, multipleOf: 1 }) });
const detail = (operationId: string, summary: string) => ({
  operationId,
  summary,
  tags: ["OPS Telco Forms"],
  security: [{ employeeSession: [] }],
  description: "Memerlukan ops_telco.forms.view. Karyawan/Teknisi mengakses formulir sendiri; ops_telco.forms.manage mengakses semua. Mutasi memerlukan Origin yang diizinkan. Isian tidak valid: 422; status terkunci: 409."
});

async function findForm(id: number, profile: Profile) {
  const [row] = await db.select().from(opsTelcoForms).where(eq(opsTelcoForms.id, id)).limit(1);
  if (!row || !isFormType(row.formType) || !canAccess(row, profile)) {
    throw new OpsTelcoFormError(404, "Formulir tidak ditemukan.");
  }
  return { ...row, formType: row.formType };
}

async function createForm(type: OpsTelcoFormType, input: OpsTelcoFormData, profile: Profile, sourceId?: number) {
  const formInput = { ...input };
  if (type === "oncall") {
    formInput.employeeName = profile.kpcId ? formatEmployeeIdentity(profile.name, profile.kpcId) : profile.name.trim();
    formInput.supervisorName = "Rahmansyah - Z110779";
    delete formInput.totalHours;
  }
  const clean = validateOpsTelcoData(type, editableData(formInput, canManage(profile)));
  await generateOpsTelcoPdf(type, systemData(type, clean, numberFor(type, 2147483647)));

  return db.transaction(async (tx) => {
    const [created] = await tx.insert(opsTelcoForms).values({
      formType: type,
      formNumber: `PENDING-${crypto.randomUUID()}`,
      data: "{}",
      createdBy: profile.id,
      duplicatedFromId: sourceId
    }).$returningId();

    const number = numberFor(type, created.id);
    const finalData = systemData(type, clean, number);

    await tx.update(opsTelcoForms).set({
      formNumber: number,
      data: JSON.stringify(finalData)
    }).where(eq(opsTelcoForms.id, created.id));

    await tx.insert(auditLogs).values({
      actorId: profile.id,
      action: sourceId ? "ops_telco.form.duplicated" : "ops_telco.form.created",
      resource: "ops_telco_forms",
      resourceId: String(created.id)
    });

    const [saved] = await tx.select().from(opsTelcoForms).where(eq(opsTelcoForms.id, created.id));
    return saved;
  });
}

export const opsTelcoFormRoutes = new Elysia({ prefix: "/ops-telco/forms" })
  .onError(({ error, code, status }) => {
    if (error instanceof OpsTelcoFormError) return status(error.status, { message: error.message });
    if (code !== "VALIDATION" && code !== "NOT_FOUND" && code !== "PARSE") {
      console.error("OPS Telco form request failed", error);
      return status(500, { message: "Formulir belum dapat diproses. Coba lagi atau hubungi administrator." });
    }
  })
  .resolve(async ({ request, status }) => {
    const profile = await getAuthenticatedProfile(request.headers, "employee");
    if (!profile) return status(401, { message: "Sesi karyawan tidak valid." });
    if (!profile.permissions.includes("ops_telco.forms.view")) {
      return status(403, { message: "Akses formulir OPS Telco diperlukan." });
    }
    if (!["GET", "HEAD"].includes(request.method) && !config.allowedOrigins.includes(request.headers.get("origin") ?? "")) {
      return status(403, { message: "Origin permintaan tidak diizinkan." });
    }
    return { profile };
  })
  .get("/", async ({ query, profile }) => {
    if (query.type && !isFormType(query.type)) throw new OpsTelcoFormError(422, "Jenis formulir tidak valid.");
    const rows = await db
      .select({
        form: opsTelcoForms,
        creatorName: users.name,
        creatorKpcId: users.kpcId
      })
      .from(opsTelcoForms)
      .leftJoin(users, eq(opsTelcoForms.createdBy, users.id))
      .where(and(query.type ? eq(opsTelcoForms.formType, query.type) : undefined, canManage(profile) ? undefined : eq(opsTelcoForms.createdBy, profile.id)))
      .orderBy(desc(opsTelcoForms.id))
      .limit(100);

    const data = rows.map(({ form, creatorName, creatorKpcId }) => {
      const parsed = parseData(form.data);
      if (form.formType === "oncall") {
        if (creatorName && creatorKpcId) {
          parsed.employeeName = formatEmployeeIdentity(creatorName, creatorKpcId);
        }
      }
      return { ...form, data: parsed };
    });
    return { data };
  }, { query: t.Object({ type: t.Optional(t.String()) }), detail: detail("listOpsTelcoForms", "Riwayat 100 formulir OPS Telco terbaru") })
  .post("/", async ({ body, profile, status }) => {
    if (!isFormType(body.formType)) throw new OpsTelcoFormError(422, "Jenis formulir tidak valid.");
    return status(201, { data: serialize(await createForm(body.formType, body.data, profile)) });
  }, { body: t.Object({ formType: t.String(), data: formData }), detail: detail("createOpsTelcoForm", "Simpan draf formulir OPS Telco dan nomor otomatis") })
  .patch("/:id", async ({ params, body, profile }) => {
    const row = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(opsTelcoForms).where(eq(opsTelcoForms.id, params.id)).limit(1).for("update");
      if (!existing || !isFormType(existing.formType) || !canAccess(existing, profile)) {
        throw new OpsTelcoFormError(404, "Formulir tidak ditemukan.");
      }
      const manage = canManage(profile);
      const nextStatus = body.status ?? existing.status;
      if (!manage && body.status !== undefined && !(existing.status === "draft" && nextStatus === "submitted")) {
        throw new OpsTelcoFormError(403, "Hanya Supervisor yang dapat memutuskan atau membuka kembali formulir.");
      }
      if (nextStatus === "submitted" && !profile.emailVerified && !manage) {
        throw new OpsTelcoFormError(403, "Email belum terverifikasi. Silakan verifikasi email Anda terlebih dahulu sebelum mengajukan formulir resmi.");
      }
      const reopening = manage && nextStatus === "draft" && existing.status !== "draft";
      if (existing.status !== "draft" && !reopening && (!manage || existing.status !== "submitted")) {
        throw new OpsTelcoFormError(409, "Formulir terkunci. Minta Supervisor membuka kembali sebagai draf sebelum mengubah isian.");
      }
      const transitions: Record<string, string[]> = {
        draft: ["draft", "submitted"],
        submitted: ["submitted", "draft", "approved", "rejected", "deferred"],
        approved: ["draft"],
        rejected: ["draft"],
        deferred: ["draft"]
      };
      if (!transitions[existing.status]?.includes(nextStatus)) {
        throw new OpsTelcoFormError(409, "Perubahan status tidak valid. Ajukan draf terlebih dahulu.");
      }

      const [owner] = await tx.select({ id: users.id, name: users.name, kpcId: users.kpcId }).from(users).where(eq(users.id, existing.createdBy)).limit(1);

      if (existing.formType === "oncall" && nextStatus === "submitted") {
        if (!owner?.kpcId) {
          throw new OpsTelcoFormError(422, "ID KPC akun Anda belum tersedia. Hubungi administrator sebelum mengajukan Form Oncall.");
        }
      }

      const existingData = parseData(existing.data);
      const merged = { ...existingData, ...editableData(body.data, manage) };

      if (existing.formType === "oncall") {
        if (owner?.kpcId) {
          merged.employeeName = formatEmployeeIdentity(owner.name, owner.kpcId);
        } else {
          merged.employeeName = existingData.employeeName || (owner ? owner.name.trim() : "");
        }
        delete merged.totalHours;
      }

      // Reopening invalidates previous approval decision and calculations
      const data = validateOpsTelcoData(existing.formType, systemData(existing.formType, reopening ? editableData(merged, false) : merged, existing.formNumber));
      if (nextStatus !== "draft") requireSubmission(existing.formType, data);
      await generateOpsTelcoPdf(existing.formType, data);

      await tx.update(opsTelcoForms).set({ data: JSON.stringify(data), status: nextStatus }).where(eq(opsTelcoForms.id, existing.id));
      await tx.insert(auditLogs).values({
        actorId: profile.id,
        action: nextStatus !== existing.status ? `ops_telco.form.${nextStatus}` : "ops_telco.form.updated",
        resource: "ops_telco_forms",
        resourceId: String(existing.id)
      });

      const [saved] = await tx.select().from(opsTelcoForms).where(eq(opsTelcoForms.id, existing.id));
      return saved;
    });
    return { data: serialize(row) };
  }, { params: idParams, body: t.Object({ data: formData, status: t.Optional(t.Union([t.Literal("draft"), t.Literal("submitted"), t.Literal("approved"), t.Literal("rejected"), t.Literal("deferred")])) }), detail: detail("updateOpsTelcoForm", "Ubah isian atau status formulir OPS Telco") })
  .post("/:id/duplicate", async ({ params, profile, status }) => {
    const source = await findForm(params.id, profile);
    const duplicatedInput = duplicateOpsTelcoData(source.formType, parseData(source.data));
    if (source.formType === "oncall") {
      duplicatedInput.employeeName = profile.kpcId ? formatEmployeeIdentity(profile.name, profile.kpcId) : profile.name.trim();
      delete duplicatedInput.totalHours;
    }
    return status(201, { data: serialize(await createForm(source.formType, duplicatedInput, profile, source.id)) });
  }, { params: idParams, detail: detail("duplicateOpsTelcoForm", "Duplikasi pekerjaan menjadi draf dengan nomor baru") })
  .get("/:id/pdf", async ({ params, profile }) => {
    const row = await findForm(params.id, profile);
    if (row.status !== "draft" && !profile.emailVerified && !canManage(profile)) {
      throw new OpsTelcoFormError(403, "Email belum terverifikasi. Silakan verifikasi email Anda terlebih dahulu sebelum mengunduh PDF resmi.");
    }
    const [owner] = await db.select({ name: users.name, kpcId: users.kpcId }).from(users).where(eq(users.id, row.createdBy)).limit(1);
    const rawData = parseData(row.data);
    if (row.formType === "oncall") {
      if (owner?.name && owner?.kpcId) {
        rawData.employeeName = formatEmployeeIdentity(owner.name, owner.kpcId);
      }
      delete rawData.totalHours;
    }
    const data = validateOpsTelcoData(row.formType, rawData);
    const bytes = await generateOpsTelcoPdf(row.formType, data);
    const body = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(body).set(bytes);
    return new Response(body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${row.formNumber}.pdf"`,
        "Cache-Control": "no-store"
      }
    });
  }, { params: idParams, detail: detail("downloadOpsTelcoFormPdf", "Unduh PDF dari isian terakhir yang tersimpan") });
