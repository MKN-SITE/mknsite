import { and, desc, eq, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { getAuthenticatedProfile } from "../auth/auth";
import type { AuthenticatedProfile } from "../auth/types";
import { db } from "../db";
import { auditLogs, opsTelcoForms } from "../db/schema";
import { generatePtoPdf, type PtoFormData } from "../services/pto-pdf.service";

type Profile = AuthenticatedProfile;

const canViewPto = (profile: Profile) =>
  profile.permissions.includes("ops_telco.pto.view") ||
  profile.permissions.includes("ops_telco.forms.manage") ||
  profile.roles.includes("ops-telco-supervisor") ||
  profile.roles.includes("superadmin") ||
  profile.roles.includes("admin");

const numberForPto = (id: number) =>
  `PTO-${new Date().getFullYear()}-${String(id).padStart(5, "0")}`;

const PtoItemSchema = t.Object({
  no: t.Union([t.String(), t.Number()]),
  taskStep: t.String(),
  deviation: t.String(),
  cause: t.String(),
  suggestion: t.String()
});

const PtoBodySchema = t.Object({
  procedureTitle: t.String({ minLength: 1 }),
  department: t.Optional(t.String()),
  observationArea: t.String({ minLength: 1 }),
  date: t.String({ minLength: 1 }),
  time: t.Optional(t.String()),
  workerNotified: t.Optional(t.Union([t.Literal("ya"), t.Literal("tidak"), t.Boolean()])),
  peerReview: t.Optional(t.String()),
  items: t.Optional(t.Array(PtoItemSchema)),
  observerName: t.Optional(t.String()),
  observerSignature: t.Optional(t.String()),
  observedPerson: t.Optional(t.String()),
  superintendent: t.Optional(t.String()),
  comments: t.Optional(t.String()),
  status: t.Optional(t.Union([t.Literal("draft"), t.Literal("completed")]))
});

export const ptoFormRoutes = new Elysia({ prefix: "/ops-telco/pto" })
  .resolve(async ({ request, status }) => {
    const profile = await getAuthenticatedProfile(request.headers, "employee");
    if (!profile) {
      return status(401, { message: "Sesi tidak valid atau telah berakhir." });
    }
    if (!canViewPto(profile)) {
      return status(403, { message: "Akses ditolak. Memerlukan izin Form PTO." });
    }
    return { profile };
  })

  // 1. Get unique observation areas from history for autocomplete
  .get("/history-areas", async ({ status }) => {
    try {
      const rows = await db
        .select({ data: opsTelcoForms.data })
        .from(opsTelcoForms)
        .where(eq(opsTelcoForms.formType, "pto"))
        .orderBy(desc(opsTelcoForms.id))
        .limit(100);

      const areaSet = new Set<string>();
      for (const r of rows) {
        try {
          const parsed = JSON.parse(r.data);
          if (parsed.observationArea && typeof parsed.observationArea === "string") {
            const area = parsed.observationArea.trim();
            if (area) areaSet.add(area);
          }
        } catch {
          // ignore
        }
      }

      // Default common areas if empty
      if (areaSet.size === 0) {
        areaSet.add("Pit J East Hatari Repeater Site");
        areaSet.add("Pit AB Tower Site");
        areaSet.add("Main Office MKN Sangatta");
        areaSet.add("Bengalon Port Office");
        areaSet.add("KPC Coal Processing Plant (CPP)");
      }

      return { data: Array.from(areaSet) };
    } catch (err: any) {
      console.error("Failed to load PTO history areas", err);
      return status(500, { message: "Gagal memuat riwayat area observasi." });
    }
  })

  // 2. List all PTO forms with pagination
  .get("/", async ({ query, status }) => {
    try {
      const pageLimit = query?.limit ? Math.min(Math.max(Number(query.limit), 1), 200) : 50;
      const pageOffset = query?.offset ? Math.max(Number(query.offset), 0) : 0;

      const [totalRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(opsTelcoForms)
        .where(eq(opsTelcoForms.formType, "pto"));
      const total = Number(totalRow?.count ?? 0);

      const rows = await db
        .select()
        .from(opsTelcoForms)
        .where(eq(opsTelcoForms.formType, "pto"))
        .orderBy(desc(opsTelcoForms.id))
        .limit(pageLimit)
        .offset(pageOffset);

      const data = rows.map((r) => {
        let parsed: any = {};
        try {
          parsed = JSON.parse(r.data);
        } catch {}
        return {
          id: r.id,
          formNumber: r.formNumber,
          status: r.status,
          procedureTitle: parsed.procedureTitle || "-",
          observationArea: parsed.observationArea || "-",
          department: parsed.department || "Operasional Telekomunikasi",
          date: parsed.date || "-",
          time: parsed.time || "-",
          itemsCount: Array.isArray(parsed.items) ? parsed.items.length : 0,
          observerName: parsed.observerName || "Rahmansyah - Z110997",
          superintendent: parsed.superintendent || "Wanto",
          createdAt: r.createdAt,
          updatedAt: r.updatedAt
        };
      });

      return { data, total, limit: pageLimit, offset: pageOffset };
    } catch (err: any) {
      console.error("Failed to list PTO forms", err);
      return status(500, { message: "Gagal memuat daftar form PTO." });
    }
  }, {
    query: t.Object({
      limit: t.Optional(t.Numeric()),
      offset: t.Optional(t.Numeric())
    })
  })

  // 3. Get single PTO form detail
  .get("/:id", async ({ params, status }) => {
    try {
      const id = Number(params.id);
      const [row] = await db
        .select()
        .from(opsTelcoForms)
        .where(and(eq(opsTelcoForms.id, id), eq(opsTelcoForms.formType, "pto")))
        .limit(1);

      if (!row) {
        return status(404, { message: "Form PTO tidak ditemukan." });
      }

      let parsed: PtoFormData = {
        procedureTitle: "",
        department: "Operasional Telekomunikasi",
        observationArea: "",
        date: "",
        time: "",
        items: []
      };
      try {
        parsed = JSON.parse(row.data);
      } catch {}

      return {
        data: {
          id: row.id,
          formNumber: row.formNumber,
          status: row.status,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          ...parsed
        }
      };
    } catch (err: any) {
      console.error("Failed to get PTO form detail", err);
      return status(500, { message: "Gagal memuat formulir PTO." });
    }
  })

  // 4. Create new PTO form
  .post("/", async ({ body, profile, status }) => {
    try {
      const payload: PtoFormData = {
        procedureTitle: body.procedureTitle.trim(),
        department: (body.department || "Operasional Telekomunikasi").trim(),
        observationArea: body.observationArea.trim(),
        date: body.date,
        time: (body.time || "").trim(),
        workerNotified: body.workerNotified ?? "ya",
        peerReview: (body.peerReview || "").trim(),
        items: body.items || [],
        observerName: (body.observerName || "Rahmansyah - Z110997").trim(),
        observerSignature: body.observerSignature || "",
        observedPerson: "", // left blank per requirement
        superintendent: (body.superintendent || "Wanto").trim(),
        comments: (body.comments || "").trim()
      };

      // Test PDF generation to validate data integrity
      await generatePtoPdf(payload);

      const formStatus = body.status === "completed" ? "completed" : "draft";

      const created = await db.transaction(async (tx) => {
        const [inserted] = await tx.insert(opsTelcoForms).values({
          formType: "pto",
          formNumber: `PENDING-${crypto.randomUUID()}`,
          status: formStatus,
          data: "{}",
          createdBy: profile.id
        }).$returningId();

        const formNumber = numberForPto(inserted.id);
        const finalData: PtoFormData = { ...payload, formNumber };

        await tx.update(opsTelcoForms).set({
          formNumber,
          data: JSON.stringify(finalData)
        }).where(eq(opsTelcoForms.id, inserted.id));

        await tx.insert(auditLogs).values({
          actorId: profile.id,
          action: "ops_telco.pto.created",
          resource: "ops_telco_forms",
          resourceId: String(inserted.id)
        });

        const [saved] = await tx.select().from(opsTelcoForms).where(eq(opsTelcoForms.id, inserted.id));
        return saved;
      });

      return status(201, {
        message: "Form PTO berhasil disimpan.",
        data: {
          id: created.id,
          formNumber: created.formNumber,
          status: created.status,
          ...JSON.parse(created.data)
        }
      });
    } catch (err: any) {
      console.error("Failed to create PTO form", err);
      return status(500, { message: err?.message || "Gagal membuat form PTO." });
    }
  }, { body: PtoBodySchema })

  // 5. Update existing PTO form
  .put("/:id", async ({ params, body, profile, status }) => {
    try {
      const id = Number(params.id);
      const [existing] = await db
        .select()
        .from(opsTelcoForms)
        .where(and(eq(opsTelcoForms.id, id), eq(opsTelcoForms.formType, "pto")))
        .limit(1);

      if (!existing) {
        return status(404, { message: "Form PTO tidak ditemukan." });
      }

      const payload: PtoFormData = {
        formNumber: existing.formNumber,
        procedureTitle: body.procedureTitle.trim(),
        department: (body.department || "Operasional Telekomunikasi").trim(),
        observationArea: body.observationArea.trim(),
        date: body.date,
        time: (body.time || "").trim(),
        workerNotified: body.workerNotified ?? "ya",
        peerReview: (body.peerReview || "").trim(),
        items: body.items || [],
        observerName: (body.observerName || "Rahmansyah - Z110997").trim(),
        observerSignature: body.observerSignature || "",
        observedPerson: "", // left blank per requirement
        superintendent: (body.superintendent || "Wanto").trim(),
        comments: (body.comments || "").trim()
      };

      // Test PDF generation
      await generatePtoPdf(payload);

      const formStatus = body.status === "completed" ? "completed" : "draft";

      await db.update(opsTelcoForms).set({
        status: formStatus,
        data: JSON.stringify(payload)
      }).where(eq(opsTelcoForms.id, id));

      await db.insert(auditLogs).values({
        actorId: profile.id,
        action: "ops_telco.pto.updated",
        resource: "ops_telco_forms",
        resourceId: String(id)
      });

      return {
        message: "Form PTO berhasil diperbarui.",
        data: {
          id,
          formNumber: existing.formNumber,
          status: formStatus,
          ...payload
        }
      };
    } catch (err: any) {
      console.error("Failed to update PTO form", err);
      return status(500, { message: err?.message || "Gagal memperbarui form PTO." });
    }
  }, { body: PtoBodySchema })

  // 6. Delete draft PTO form
  .delete("/:id", async ({ params, profile, status }) => {
    try {
      const id = Number(params.id);
      const [existing] = await db
        .select()
        .from(opsTelcoForms)
        .where(and(eq(opsTelcoForms.id, id), eq(opsTelcoForms.formType, "pto")))
        .limit(1);

      if (!existing) {
        return status(404, { message: "Form PTO tidak ditemukan." });
      }

      await db.delete(opsTelcoForms).where(eq(opsTelcoForms.id, id));

      await db.insert(auditLogs).values({
        actorId: profile.id,
        action: "ops_telco.pto.deleted",
        resource: "ops_telco_forms",
        resourceId: String(id)
      });

      return { message: "Form PTO berhasil dihapus." };
    } catch (err: any) {
      console.error("Failed to delete PTO form", err);
      return status(500, { message: "Gagal menghapus form PTO." });
    }
  })

  // 7. Download/Preview PDF
  .get("/:id/pdf", async ({ params, set, status }) => {
    try {
      const id = Number(params.id);
      const [row] = await db
        .select()
        .from(opsTelcoForms)
        .where(and(eq(opsTelcoForms.id, id), eq(opsTelcoForms.formType, "pto")))
        .limit(1);

      if (!row) {
        return status(404, { message: "Form PTO tidak ditemukan." });
      }

      let parsed: PtoFormData = {
        procedureTitle: "",
        department: "Operasional Telekomunikasi",
        observationArea: "",
        date: "",
        time: "",
        items: []
      };
      try {
        parsed = JSON.parse(row.data);
      } catch {}

      parsed.formNumber = row.formNumber;
      const pdfBytes = await generatePtoPdf(parsed);
      const body = new ArrayBuffer(pdfBytes.byteLength);
      new Uint8Array(body).set(pdfBytes);

      set.headers["content-type"] = "application/pdf";
      set.headers["content-disposition"] = `inline; filename="${row.formNumber}.pdf"`;
      return new Response(body, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${row.formNumber}.pdf"`
        }
      });
    } catch (err: any) {
      console.error("Failed to generate PTO PDF", err);
      return status(500, { message: "Gagal mencetak dokumen PDF PTO." });
    }
  });
