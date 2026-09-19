import { Elysia, t } from "elysia";
import { getAuthenticatedProfile } from "../auth/auth";
import { generateJsaPdf } from "../services/ops-telco-jsa-pdf.service";
import { opsTelcoJsaService } from "../services/ops-telco-jsa.service";

export const opsTelcoJsaRoutes = new Elysia({ prefix: "/ops-telco/jsa" })
  .resolve(async ({ request, status }) => {
    const profile = await getAuthenticatedProfile(request.headers, "employee");
    if (!profile) return status(401, { message: "Sesi karyawan tidak valid." });

    const hasAccess =
      profile.permissions.includes("ops_telco.forms.view") ||
      profile.permissions.includes("ops_telco.view") ||
      profile.roles.includes("ops-telco-technician") ||
      profile.roles.includes("Teknisi OPS Telco") ||
      profile.roles.includes("teknisi") ||
      profile.roles.includes("ops-telco-supervisor") ||
      profile.roles.includes("Supervisor OPS Telco") ||
      profile.roles.includes("supervisor") ||
      profile.roles.includes("administrator") ||
      profile.roles.includes("Administrator") ||
      profile.roles.includes("superadmin") ||
      profile.roles.includes("Superadministrator");

    if (!hasAccess) {
      return status(403, { message: "Akses menu Job Safety Analysis (JSA) diperlukan." });
    }

    return { profile };
  })

  // 1. Get next JSA number
  .get("/next-number", async () => {
    const jsaNumber = await opsTelcoJsaService.getNextJsaNumber();
    return { success: true, data: { jsaNumber } };
  })

  // 2. List JSA
  .get(
    "/",
    async ({ query }) => {
      const page = query.page ? Number(query.page) : 1;
      const limit = query.limit ? Number(query.limit) : 20;
      const search = query.search || undefined;

      const data = await opsTelcoJsaService.listJsa({ page, limit, search });
      return { success: true, ...data };
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        search: t.Optional(t.String())
      })
    }
  )

  // 3. Get single JSA detail
  .get(
    "/:id",
    async ({ params, status }) => {
      const id = Number(params.id);
      if (isNaN(id)) return status(400, { message: "ID tidak valid." });

      const form = await opsTelcoJsaService.getJsaById(id);
      if (!form) return status(404, { message: "Form JSA tidak ditemukan." });

      return { success: true, data: form };
    },
    {
      params: t.Object({ id: t.String() })
    }
  )

  // 4. Create JSA
  .post(
    "/",
    async ({ body, profile, status }) => {
      try {
        const created = await opsTelcoJsaService.createJsa(body as any, profile.id);
        return status(201, { success: true, data: created });
      } catch (err: any) {
        console.error("Error creating JSA:", err);
        return status(400, {
          success: false,
          message: err?.message || "Gagal menyimpan formulir JSA."
        });
      }
    },
    {
      body: t.Object({
        jsaNumber: t.Optional(t.String()),
        jobNumber: t.Optional(t.String()),
        jobTitle: t.String(),
        personTitle: t.Optional(t.String()),
        location: t.String(),
        jsaDate: t.String(),
        jsaType: t.Optional(t.String()),
        ppeRequirements: t.Optional(t.String()),
        analysedBy: t.Optional(t.String()),
        analysedByBadge: t.Optional(t.String()),
        reviewedBy: t.Optional(t.String()),
        reviewedByBadge: t.Optional(t.String()),
        approvedBy: t.Optional(t.String()),
        approvedByBadge: t.Optional(t.String()),
        supervisorName: t.Optional(t.String()),
        leadWorkerName: t.Optional(t.String()),
        fpeElements: t.Optional(t.Array(t.String())),
        jobPermits: t.Optional(t.Array(t.String())),
        workers: t.Optional(
          t.Array(
            t.Object({
              name: t.String(),
              badgeNumber: t.Optional(t.String())
            })
          )
        ),
        steps: t.Optional(
          t.Array(
            t.Object({
              stepNumber: t.Number(),
              sequence: t.Optional(t.Number()),
              stepDescription: t.String(),
              hazardNo: t.Optional(t.String()),
              hazardDescription: t.Optional(t.String()),
              actionNo: t.Optional(t.String()),
              actionDescription: t.Optional(t.String()),
              observation: t.Optional(t.String())
            })
          )
        )
      })
    }
  )

  // 5. Delete JSA
  .delete(
    "/:id",
    async ({ params, status }) => {
      const id = Number(params.id);
      if (isNaN(id)) return status(400, { message: "ID tidak valid." });

      const deleted = await opsTelcoJsaService.deleteJsa(id);
      return { success: true, deleted };
    },
    {
      params: t.Object({ id: t.String() })
    }
  )

  // 6. Download PDF
  .get(
    "/:id/pdf",
    async ({ params, set, status }) => {
      const id = Number(params.id);
      if (isNaN(id)) return status(400, { message: "ID tidak valid." });

      const form = await opsTelcoJsaService.getJsaById(id);
      if (!form) return status(404, { message: "Form JSA tidak ditemukan." });

      const pdfBytes = await generateJsaPdf(form);
      const safeNumber = (form.jsaNumber || `JSA_${form.id}`).replace(/[^a-zA-Z0-9_-]/g, "_");

      set.headers["Content-Type"] = "application/pdf";
      set.headers["Content-Disposition"] = `inline; filename="JSA_${safeNumber}.pdf"`;
      return new Response(pdfBytes as unknown as BodyInit, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="JSA_${safeNumber}.pdf"`
        }
      });
    },
    {
      params: t.Object({ id: t.String() })
    }
  )

  // 7. Re-import historical files
  .post("/import-history", async () => {
    const res = await opsTelcoJsaService.importHistoryFromDirectory();
    return { success: true, data: res };
  });
