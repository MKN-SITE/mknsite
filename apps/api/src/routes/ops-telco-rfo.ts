import { Elysia, t } from "elysia";
import { getAuthenticatedProfile } from "../auth/auth";
import { opsTelcoRfoService } from "../services/ops-telco-rfo.service";

export const opsTelcoRfoRoutes = new Elysia({ prefix: "/ops-telco/rfo" })
  .resolve(async ({ request, status }) => {
    const profile = await getAuthenticatedProfile(request.headers, "employee");
    if (!profile) return status(401, { message: "Sesi karyawan tidak valid." });

    const hasAccess =
      profile.permissions.includes("ops_telco.rfo.manage") ||
      profile.permissions.includes("ops_telco.kpi.manage") ||
      profile.permissions.includes("ops_telco.view") ||
      profile.permissions.includes("helpdesk.view") ||
      profile.roles.includes("helpdesk") ||
      profile.roles.includes("Helpdesk") ||
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
      return status(403, { message: "Akses kelola Reason For Outage (RFO) diperlukan." });
    }

    return { profile };
  })

  // 1. Get next ticket number preview
  .get(
    "/next-ticket",
    async ({ query }) => {
      const date = query.date || new Date().toISOString().slice(0, 10);
      const ticketNumber = await opsTelcoRfoService.generateTicketNumber(date);
      return { success: true, data: { ticketNumber } };
    },
    {
      query: t.Object({
        date: t.Optional(t.String())
      })
    }
  )

  // 2. List RFOs
  .get(
    "/",
    async ({ query }) => {
      const problemId = query.problemId ? Number(query.problemId) : undefined;
      const companyId = query.companyId ? Number(query.companyId) : undefined;
      const search = query.search || undefined;
      const limit = query.limit ? Number(query.limit) : undefined;
      const offset = query.offset ? Number(query.offset) : undefined;

      const data = await opsTelcoRfoService.getRfos({ problemId, companyId, search, limit, offset });
      return { success: true, data };
    },
    {
      query: t.Object({
        problemId: t.Optional(t.String()),
        companyId: t.Optional(t.String()),
        search: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String())
      })
    }
  )

  // 3. Get single RFO
  .get("/:id", async ({ params, status }) => {
    const id = Number(params.id);
    if (isNaN(id)) return status(400, { message: "ID RFO tidak valid." });

    const data = await opsTelcoRfoService.getRfoById(id);
    if (!data) return status(404, { message: "Data RFO tidak ditemukan." });

    return { success: true, data };
  })

  // 4. Create RFO
  .post(
    "/",
    async ({ body, profile, status }) => {
      try {
        const data = await opsTelcoRfoService.createRfo(profile.id, body);
        return { success: true, message: "Laporan RFO berhasil dibuat", data };
      } catch (err: any) {
        return status(500, { message: err.message || "Gagal membuat laporan RFO." });
      }
    },
    {
      body: t.Object({
        ticketNumber: t.Optional(t.String()),
        problemId: t.Optional(t.Nullable(t.Number())),
        companyId: t.Optional(t.Nullable(t.Number())),
        deviceId: t.Optional(t.Nullable(t.Number())),
        rfoDate: t.String({ minLength: 10 }),
        startTime: t.String({ minLength: 2 }),
        endTime: t.String({ minLength: 2 }),
        cause: t.String({ minLength: 2 }),
        impact: t.String({ minLength: 2 }),
        solution: t.String({ minLength: 2 }),
        status: t.String({ minLength: 2 }),
        notes: t.Optional(t.Nullable(t.String()))
      })
    }
  )

  // 5. Update RFO
  .put(
    "/:id",
    async ({ params, body, status }) => {
      const id = Number(params.id);
      if (isNaN(id)) return status(400, { message: "ID RFO tidak valid." });

      try {
        const data = await opsTelcoRfoService.updateRfo(id, body);
        return { success: true, message: "Laporan RFO berhasil diperbarui", data };
      } catch (err: any) {
        return status(500, { message: err.message || "Gagal memperbarui laporan RFO." });
      }
    },
    {
      body: t.Object({
        ticketNumber: t.Optional(t.String()),
        problemId: t.Optional(t.Nullable(t.Number())),
        companyId: t.Optional(t.Nullable(t.Number())),
        deviceId: t.Optional(t.Nullable(t.Number())),
        rfoDate: t.Optional(t.String()),
        startTime: t.Optional(t.String()),
        endTime: t.Optional(t.String()),
        cause: t.Optional(t.String()),
        impact: t.Optional(t.String()),
        solution: t.Optional(t.String()),
        status: t.Optional(t.String()),
        notes: t.Optional(t.Nullable(t.String()))
      })
    }
  )

  // 6. Delete RFO
  .delete("/:id", async ({ params, status }) => {
    const id = Number(params.id);
    if (isNaN(id)) return status(400, { message: "ID RFO tidak valid." });

    try {
      await opsTelcoRfoService.deleteRfo(id);
      return { success: true, message: "Laporan RFO berhasil dihapus." };
    } catch (err: any) {
      return status(500, { message: err.message || "Gagal menghapus laporan RFO." });
    }
  })

  // 7. Download / Preview PDF
  .get("/:id/pdf", async ({ params, set, status }) => {
    const id = Number(params.id);
    if (isNaN(id)) return status(400, { message: "ID RFO tidak valid." });

    try {
      const { buffer, filename } = await opsTelcoRfoService.generatePdfBuffer(id);

      set.headers["Content-Type"] = "application/pdf";
      set.headers["Content-Disposition"] = `inline; filename="${filename}"`;

      return new Response(buffer as any, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${filename}"`
        }
      });
    } catch (err: any) {
      return status(500, { message: err.message || "Gagal membuat dokumen PDF RFO." });
    }
  });
