import { and, desc, eq, or } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { getAuthenticatedProfile } from "../auth/auth";
import { config } from "../config/env";
import { db } from "../db";
import { opsTelcoForms, users } from "../db/schema";
import {
  generateCutiFormNumber,
  getFullCutiDetail,
  isSupervisor,
  listCutiForms,
  logCutiAudit,
  type AuthenticatedProfile,
  type CutiStatus
} from "../services/cuti-job.service";
import { generateCutiJobPdf } from "../services/ops-telco-form-pdf.service";
import { OpsTelcoFormError } from "../services/ops-telco-form-validation";

type Profile = AuthenticatedProfile;

const checkOrigin = (request: Request) => {
  if (["GET", "HEAD"].includes(request.method)) return true;
  const origin = request.headers.get("origin");
  return origin ? config.allowedOrigins.includes(origin) : false;
};

export const cutiJobRoutes = new Elysia({ prefix: "/ops-telco/cuti-jobs" })
  .onError(({ error, code, status }) => {
    if (error instanceof OpsTelcoFormError) {
      return status(error.status, { message: error.message });
    }
    if (code === "VALIDATION") {
      const msg = (error as any)?.all?.[0]?.summary || (error as any)?.message || "Validasi data formulir tidak sesuai.";
      return status(422, { message: msg });
    }
    if (code !== "NOT_FOUND" && code !== "PARSE") {
      console.error("Cuti Job request failed", error);
      return status(500, {
        message: "Operasi Formulir Cuti belum dapat diproses. Coba lagi atau hubungi administrator."
      });
    }
  })
  .resolve(async ({ request, status }) => {
    const profile = (await getAuthenticatedProfile(request.headers, "employee")) as Profile | null;
    if (!profile) return status(401, { message: "Sesi karyawan tidak valid." });
    if (!profile.permissions.includes("ops_telco.forms.view")) {
      return status(403, { message: "Akses formulir OPS Telco diperlukan." });
    }
    if (!checkOrigin(request)) {
      return status(403, { message: "Origin permintaan tidak diizinkan." });
    }
    return { profile };
  })

  // 1. List all cuti forms (own forms for technician, all for supervisor)
  .get("/", async ({ profile, query }) => {
    const limit = query?.limit ? Math.min(Math.max(Number(query.limit), 1), 200) : 100;
    const offset = query?.offset ? Math.max(Number(query.offset), 0) : 0;
    const forms = await listCutiForms(profile, {
      limit,
      offset,
      status: query?.status as CutiStatus | undefined
    });
    return { items: forms, total: forms.length, limit, offset };
  }, {
    query: t.Object({
      status: t.Optional(t.String()),
      limit: t.Optional(t.Numeric()),
      offset: t.Optional(t.Numeric())
    })
  })

  // 2. Create new cuti draft
  .post("/", async ({ profile, body, request }) => {
    if (!checkOrigin(request)) throw new OpsTelcoFormError(403, "Origin tidak diizinkan.");

    // Validate required fields
    const data = body as Record<string, string>;
    if (!data.leaveStartDate || !data.leaveEndDate) {
      throw new OpsTelcoFormError(422, "Tanggal mulai dan selesai cuti wajib diisi.");
    }
    if (!data.leaveType) {
      throw new OpsTelcoFormError(422, "Jenis cuti wajib dipilih.");
    }
    if (!data.reason || data.reason.trim().length < 3) {
      throw new OpsTelcoFormError(422, "Alasan cuti wajib diisi minimal 3 karakter.");
    }
    if (data.leaveStartDate > data.leaveEndDate) {
      throw new OpsTelcoFormError(422, "Tanggal mulai cuti tidak boleh setelah tanggal selesai cuti.");
    }

    // Auto-populate user details
    const [userRow] = await db
      .select({
        name: users.name,
        kpcId: users.kpcId,
        division: users.division,
        startDate: users.startDate
      })
      .from(users)
      .where(eq(users.id, profile.id))
      .limit(1);

    const enrichedData = {
      ...data,
      employeeName: userRow?.name ?? profile.name,
      kpcId: userRow?.kpcId ?? profile.kpcId ?? "",
      division: userRow?.division ?? "",
      startDate: userRow?.startDate ?? ""
    };

    // Create the form record with a placeholder form number
    const [insertResult] = await db.insert(opsTelcoForms).values({
      formType: "cuti",
      formNumber: `CT-TEMP-${Date.now()}`,
      status: "draft",
      data: JSON.stringify(enrichedData),
      leaveStartDate: data.leaveStartDate ? (data.leaveStartDate as any) : null,
      leaveEndDate: data.leaveEndDate ? (data.leaveEndDate as any) : null,
      createdBy: profile.id,
      workflowVersion: 1
    });

    const newId = (insertResult as { insertId: number }).insertId;
    const formNumber = generateCutiFormNumber(newId);

    await db
      .update(opsTelcoForms)
      .set({ formNumber })
      .where(eq(opsTelcoForms.id, newId));

    await logCutiAudit(
      profile.id,
      "cuti.create",
      String(newId),
      request.headers.get("x-forwarded-for") ?? undefined
    );

    return {
      id: newId,
      formNumber,
      status: "draft",
      message: "Formulir cuti berhasil disimpan sebagai draf."
    };
  }, {
    body: t.Record(t.String(), t.String())
  })

  // 3. Get detail of a cuti form
  .get("/:id", async ({ profile, params }) => {
    const formId = parseInt(params.id, 10);
    if (isNaN(formId)) throw new OpsTelcoFormError(422, "ID formulir tidak valid.");
    const detail = await getFullCutiDetail(formId, profile);
    return detail;
  }, {
    params: t.Object({ id: t.String() })
  })

  // 4. Update (save/edit) a cuti draft
  .put("/:id", async ({ profile, params, body, request }) => {
    if (!checkOrigin(request)) throw new OpsTelcoFormError(403, "Origin tidak diizinkan.");
    const formId = parseInt(params.id, 10);
    if (isNaN(formId)) throw new OpsTelcoFormError(422, "ID formulir tidak valid.");

    const detail = await getFullCutiDetail(formId, profile);

    if (detail.status !== "draft") {
      throw new OpsTelcoFormError(409, "Formulir cuti yang sudah diajukan tidak dapat diedit.");
    }
    if (!detail.isCreator && !detail.isSupervisor) {
      throw new OpsTelcoFormError(403, "Hanya pembuat formulir yang dapat mengedit draf cuti.");
    }

    const data = body as Record<string, string>;

    // Auto-populate user details again to ensure consistency
    const [userRow] = await db
      .select({
        name: users.name,
        kpcId: users.kpcId,
        division: users.division,
        startDate: users.startDate
      })
      .from(users)
      .where(eq(users.id, detail.createdBy))
      .limit(1);

    const enrichedData = {
      ...data,
      employeeName: userRow?.name ?? detail.data.employeeName ?? "",
      kpcId: userRow?.kpcId ?? detail.data.kpcId ?? "",
      division: userRow?.division ?? detail.data.division ?? "",
      startDate: userRow?.startDate ?? detail.data.startDate ?? ""
    };

    await db
      .update(opsTelcoForms)
      .set({
        data: JSON.stringify(enrichedData),
        leaveStartDate: data.leaveStartDate ? (data.leaveStartDate as any) : undefined,
        leaveEndDate: data.leaveEndDate ? (data.leaveEndDate as any) : undefined
      })
      .where(eq(opsTelcoForms.id, formId));

    await logCutiAudit(
      profile.id,
      "cuti.update",
      String(formId),
      request.headers.get("x-forwarded-for") ?? undefined
    );

    return { message: "Formulir cuti berhasil diperbarui." };
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Record(t.String(), t.String())
  })

  // 5. Submit cuti form (draft → submitted)
  .post("/:id/submit", async ({ profile, params, request }) => {
    if (!checkOrigin(request)) throw new OpsTelcoFormError(403, "Origin tidak diizinkan.");
    const formId = parseInt(params.id, 10);
    if (isNaN(formId)) throw new OpsTelcoFormError(422, "ID formulir tidak valid.");

    const detail = await getFullCutiDetail(formId, profile);

    if (detail.status !== "draft") {
      throw new OpsTelcoFormError(409, `Formulir tidak dapat diajukan dari status '${detail.status}'.`);
    }
    if (!detail.isCreator && !detail.isSupervisor) {
      throw new OpsTelcoFormError(403, "Hanya pembuat formulir yang dapat mengajukan cuti.");
    }

    // Validate completeness before submit
    const d = detail.data;
    if (!d.leaveStartDate || !d.leaveEndDate || !d.leaveType || !d.reason) {
      throw new OpsTelcoFormError(422, "Lengkapi semua data yang diperlukan sebelum menyimpan formulir cuti.");
    }

    await db
      .update(opsTelcoForms)
      .set({ status: "submitted", submittedAt: new Date() })
      .where(eq(opsTelcoForms.id, formId));

    await logCutiAudit(
      profile.id,
      "cuti.submit",
      String(formId),
      request.headers.get("x-forwarded-for") ?? undefined
    );

    return { message: "Formulir cuti berhasil disimpan dan tercatat dalam sistem." };
  }, {
    params: t.Object({ id: t.String() })
  })

  // 6. Cancel/delete cuti form (only draft, only creator or supervisor)
  .delete("/:id", async ({ profile, params, request }) => {
    if (!checkOrigin(request)) throw new OpsTelcoFormError(403, "Origin tidak diizinkan.");
    const formId = parseInt(params.id, 10);
    if (isNaN(formId)) throw new OpsTelcoFormError(422, "ID formulir tidak valid.");

    const detail = await getFullCutiDetail(formId, profile);

    if (detail.status !== "draft" && !detail.isSupervisor) {
      throw new OpsTelcoFormError(409, "Hanya draf yang dapat dihapus, atau hubungi Supervisor.");
    }
    if (!detail.isCreator && !detail.isSupervisor) {
      throw new OpsTelcoFormError(403, "Hanya pembuat formulir atau Supervisor yang dapat menghapus formulir cuti.");
    }

    await db.delete(opsTelcoForms).where(eq(opsTelcoForms.id, formId));

    await logCutiAudit(
      profile.id,
      "cuti.delete",
      String(formId),
      request.headers.get("x-forwarded-for") ?? undefined
    );

    return { message: "Formulir cuti berhasil dihapus." };
  }, {
    params: t.Object({ id: t.String() })
  })

  // 6b. Download or preview PDF for cuti form
  .get("/:id/pdf", async ({ profile, params, query }) => {
    const formId = parseInt(params.id, 10);
    if (isNaN(formId)) throw new OpsTelcoFormError(422, "ID formulir tidak valid.");

    const detail = await getFullCutiDetail(formId, profile);
    if (!detail.isCreator && !detail.isSupervisor) {
      throw new OpsTelcoFormError(403, "Anda tidak memiliki akses untuk mengunduh formulir cuti ini.");
    }

    const pdfBytes = await generateCutiJobPdf({
      form: {
        id: detail.id,
        formNumber: detail.formNumber,
        status: detail.status,
        data: detail.data,
        createdAt: detail.createdAt,
        submittedAt: detail.submittedAt
      }
    });

    const isInline = query.inline === "1" || query.inline === "true" || query.view === "1";
    const disposition = isInline
      ? `inline; filename="${detail.formNumber}.pdf"`
      : `attachment; filename="${detail.formNumber}.pdf"`;

    const body = new ArrayBuffer(pdfBytes.byteLength);
    new Uint8Array(body).set(pdfBytes);

    return new Response(body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": disposition,
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0"
      }
    });
  }, {
    params: t.Object({ id: t.String() }),
    query: t.Object({
      inline: t.Optional(t.String()),
      view: t.Optional(t.String()),
      t: t.Optional(t.String()),
      _t: t.Optional(t.String())
    })
  })

  // 7. Supervisor: List all technician cuti (report view)
  .get("/report/all", async ({ profile, query }) => {
    if (!isSupervisor(profile)) {
      throw new OpsTelcoFormError(403, "Hanya Supervisor yang dapat melihat report cuti seluruh teknisi.");
    }
    const forms = await listCutiForms(profile, {
      limit: 500,
      offset: 0,
      status: "submitted"
    });
    return { items: forms, total: forms.length };
  }, {
    query: t.Object({
      status: t.Optional(t.String())
    })
  })

  // 8. Check oncall conflict for a user on a given date (utility for scheduling)
  .get("/check-conflict/:userId/:date", async ({ profile, params }) => {
    if (!isSupervisor(profile)) {
      throw new OpsTelcoFormError(403, "Akses terbatas untuk Supervisor.");
    }
    const userId = parseInt(params.userId, 10);
    if (isNaN(userId)) throw new OpsTelcoFormError(422, "ID user tidak valid.");

    // Inline check - get all cuti for user and check date
    const rows = await db
      .select({ id: opsTelcoForms.id, data: opsTelcoForms.data, formNumber: opsTelcoForms.formNumber })
      .from(opsTelcoForms)
      .where(
        and(
          eq(opsTelcoForms.formType, "cuti"),
          eq(opsTelcoForms.createdBy, userId),
          eq(opsTelcoForms.status, "submitted")
        )
      );

    const checkDate = params.date;
    const conflicts = [];
    for (const row of rows) {
      try {
        const d = JSON.parse(row.data);
        if (d.leaveStartDate && d.leaveEndDate && checkDate >= d.leaveStartDate && checkDate <= d.leaveEndDate) {
          conflicts.push({ id: row.id, formNumber: row.formNumber, leaveStartDate: d.leaveStartDate, leaveEndDate: d.leaveEndDate });
        }
      } catch {
        // ignore
      }
    }

    return { hasConflict: conflicts.length > 0, conflicts };
  }, {
    params: t.Object({ userId: t.String(), date: t.String() })
  });
