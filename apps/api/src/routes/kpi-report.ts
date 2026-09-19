import { Elysia, t } from "elysia";
import { getAuthenticatedProfile } from "../auth/auth";
import { kpiReportService } from "../services/kpi-report.service";

export const kpiReportRoutes = new Elysia({ prefix: "/ops-telco/kpi" })
  .resolve(async ({ request, status }) => {
    const profile = await getAuthenticatedProfile(request.headers, "employee");
    if (!profile) return status(401, { message: "Sesi karyawan tidak valid." });

    const hasAccess =
      profile.permissions.includes("ops_telco.kpi.manage") ||
      profile.permissions.includes("ops_telco.view") ||
      profile.roles.includes("ops-telco-supervisor") ||
      profile.roles.includes("administrator") ||
      profile.roles.includes("superadmin");

    if (!hasAccess) {
      return status(403, { message: "Akses kelola KPI & BAO Report diperlukan." });
    }

    return { profile };
  })

  // 1. Get companies
  .get("/companies", async () => {
    const data = await kpiReportService.getCompanies();
    return { data };
  })

  // 2. Get company detail
  .get("/companies/:id", async ({ params, status }) => {
    const id = Number(params.id);
    if (isNaN(id)) return status(400, { message: "ID perusahaan tidak valid." });
    const data = await kpiReportService.getCompanyById(id);
    if (!data) return status(404, { message: "Perusahaan tidak ditemukan." });
    return { data };
  })

  // 3. Create company
  .post(
    "/companies",
    async ({ body }) => {
      const data = await kpiReportService.createCompany(body);
      return { success: true, message: "Perusahaan berhasil ditambahkan", data };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 2 }),
        type: t.Optional(t.String()),
        clientCompanyName: t.Optional(t.String()),
        clientAddress: t.Optional(t.String()),
        contractTitle: t.Optional(t.String()),
        serviceDescription: t.Optional(t.String()),
        mknSignerName: t.Optional(t.String()),
        mknSignerRole: t.Optional(t.String()),
        clientSignerName: t.Optional(t.String()),
        clientSignerRole: t.Optional(t.String()),
        clientSignerLocation: t.Optional(t.String()),
        devices: t.Optional(
          t.Array(
            t.Object({
              deviceName: t.String(),
              location: t.Optional(t.String())
            })
          )
        )
      })
    }
  )

  // 4. Update company
  .put(
    "/companies/:id",
    async ({ params, body, status }) => {
      const id = Number(params.id);
      if (isNaN(id)) return status(400, { message: "ID perusahaan tidak valid." });
      const data = await kpiReportService.updateCompany(id, body);
      return { success: true, message: "Perusahaan berhasil diperbarui", data };
    },
    {
      body: t.Object({
        name: t.Optional(t.String()),
        type: t.Optional(t.String()),
        clientCompanyName: t.Optional(t.String()),
        clientAddress: t.Optional(t.String()),
        contractTitle: t.Optional(t.String()),
        serviceDescription: t.Optional(t.String()),
        mknSignerName: t.Optional(t.String()),
        mknSignerRole: t.Optional(t.String()),
        clientSignerName: t.Optional(t.String()),
        clientSignerRole: t.Optional(t.String()),
        clientSignerLocation: t.Optional(t.String()),
        isActive: t.Optional(t.Boolean()),
        sortOrder: t.Optional(t.Number())
      })
    }
  )

  // 5. Delete company
  .delete("/companies/:id", async ({ params, status }) => {
    const id = Number(params.id);
    if (isNaN(id)) return status(400, { message: "ID perusahaan tidak valid." });
    await kpiReportService.deleteCompany(id);
    return { success: true, message: "Perusahaan berhasil dihapus" };
  })

  // 6. Add device to company
  .post(
    "/companies/:id/devices",
    async ({ params, body, status }) => {
      const companyId = Number(params.id);
      if (isNaN(companyId)) return status(400, { message: "ID perusahaan tidak valid." });
      const data = await kpiReportService.addDevice(companyId, body);
      return { success: true, message: "Perangkat / Link berhasil ditambahkan", data };
    },
    {
      body: t.Object({
        deviceName: t.String({ minLength: 2 }),
        location: t.Optional(t.String())
      })
    }
  )

  // 7. Update device
  .put(
    "/devices/:deviceId",
    async ({ params, body, status }) => {
      const deviceId = Number(params.deviceId);
      if (isNaN(deviceId)) return status(400, { message: "ID perangkat tidak valid." });
      await kpiReportService.updateDevice(deviceId, body);
      return { success: true, message: "Perangkat / Link berhasil diperbarui" };
    },
    {
      body: t.Object({
        deviceName: t.Optional(t.String()),
        location: t.Optional(t.String()),
        orderIndex: t.Optional(t.Number())
      })
    }
  )

  // 8. Delete device
  .delete("/devices/:deviceId", async ({ params, status }) => {
    const deviceId = Number(params.deviceId);
    if (isNaN(deviceId)) return status(400, { message: "ID perangkat tidak valid." });
    await kpiReportService.deleteDevice(deviceId);
    return { success: true, message: "Perangkat berhasil dihapus" };
  })

  // 9. Holidays
  .get("/holidays", async ({ query }) => {
    const year = query?.year ? Number(query.year) : undefined;
    const data = await kpiReportService.getHolidays(year);
    return { data };
  })

  .post(
    "/holidays",
    async ({ body }) => {
      const data = await kpiReportService.createHoliday(body);
      return { success: true, message: "Hari libur berhasil ditambahkan", data };
    },
    {
      body: t.Object({
        holidayDate: t.String(),
        description: t.String({ minLength: 2 })
      })
    }
  )

  .delete("/holidays/:id", async ({ params, status }) => {
    const id = Number(params.id);
    if (isNaN(id)) return status(400, { message: "ID hari libur tidak valid." });
    await kpiReportService.deleteHoliday(id);
    return { success: true, message: "Hari libur berhasil dihapus" };
  })

  // 10. Monthly Report Data
  .get("/report/:companyId/:year/:month", async ({ params, status }) => {
    const companyId = Number(params.companyId);
    const year = Number(params.year);
    const month = Number(params.month);

    if (isNaN(companyId) || isNaN(year) || isNaN(month)) {
      return status(400, { message: "Parameter laporan tidak valid." });
    }

    try {
      const data = await kpiReportService.getMonthlyReportData(companyId, year, month);
      return { data };
    } catch (err: any) {
      return status(404, { message: err.message || "Laporan tidak ditemukan." });
    }
  })

  // 11. Add problem (downtime log)
  .post(
    "/report/:companyId/:year/:month/problem",
    async ({ params, body, profile, status }) => {
      const companyId = Number(params.companyId);
      const year = Number(params.year);
      const month = Number(params.month);

      if (isNaN(companyId) || isNaN(year) || isNaN(month)) {
        return status(400, { message: "Parameter laporan tidak valid." });
      }

      try {
        const result = await kpiReportService.addProblem(companyId, year, month, profile.id, body);
        return { success: true, message: "Catatan gangguan berhasil disimpan", data: result };
      } catch (err: any) {
        return status(500, { message: err.message || "Gagal mencatat masalah gangguan." });
      }
    },
    {
      body: t.Object({
        deviceId: t.Number(),
        problemDate: t.String(),
        downtimeHours: t.Number(),
        downtimeMinutes: t.Number(),
        downtimeSeconds: t.Optional(t.Number()),
        description: t.String({ minLength: 2 })
      })
    }
  )

  // 12. Delete problem
  .delete("/report/:companyId/:year/:month/problem/:problemId", async ({ params, status }) => {
    const companyId = Number(params.companyId);
    const year = Number(params.year);
    const month = Number(params.month);
    const problemId = Number(params.problemId);

    if (isNaN(companyId) || isNaN(year) || isNaN(month) || isNaN(problemId)) {
      return status(400, { message: "Parameter tidak valid." });
    }

    await kpiReportService.deleteProblem(problemId, companyId, year, month);
    return { success: true, message: "Catatan gangguan berhasil dihapus" };
  })

  // 13. Download Excel (KPI Availability)
  .get("/report/:companyId/:year/:month/download-excel", async ({ params, set }) => {
    const companyId = Number(params.companyId);
    const year = Number(params.year);
    const month = Number(params.month);

    const buffer = await kpiReportService.generateExcelBuffer(companyId, year, month);
    const company = await kpiReportService.getCompanyById(companyId);
    const sanitizedName = (company?.name || "Company").replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `KPI_Availability_${sanitizedName}_${month}_${year}.xlsx`;

    set.headers["Content-Type"] =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    set.headers["Content-Disposition"] = `attachment; filename="${filename}"`;

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });
  })

  // 14. Download Word (BAO Document)
  .get("/report/:companyId/:year/:month/download-word", async ({ params, set }) => {
    const companyId = Number(params.companyId);
    const year = Number(params.year);
    const month = Number(params.month);

    const buffer = await kpiReportService.generateWordBuffer(companyId, year, month);
    const company = await kpiReportService.getCompanyById(companyId);
    const sanitizedName = (company?.name || "Company").replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `BAO_${sanitizedName}_${month}_${year}.docx`;

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });
  });
