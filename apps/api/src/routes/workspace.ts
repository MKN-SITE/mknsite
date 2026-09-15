import { Elysia, t } from "elysia";
import { getAuthenticatedProfile } from "../auth/auth";

const modulePermission: Record<string, string> = {
  hr: "hr.view",
  "ops-telco": "ops_telco.view",
  "ops-workshop": "ops_workshop.view",
  project: "project.view"
};

const opsTelcoSectionPermission: Record<string, string> = {
  "assign-job": "ops_telco.job_assignment.view",
  "assign-jadwal-oncall": "ops_telco.schedule.manage",
  "form-pto": "ops_telco.pto.view",
  "jadwal-oncall": "ops_telco.schedule.view",
  "auto-report-wag": "ops_telco.wag_report.view",
  "estimasi-quotation": "ops_telco.estimate.view",
  "dokumentasi-pekerjaan": "ops_telco.documentation.view"
};

export const workspaceRoutes = new Elysia({ prefix: "/workspace" })
  .get("/ops-telco/:section", async ({ params, request, status }) => {
    const profile = await getAuthenticatedProfile(request.headers, "employee");
    if (!profile) return status(401, { message: "Sesi karyawan tidak valid." });
    const permission = opsTelcoSectionPermission[params.section];
    if (!permission) return status(404, { message: "Submenu OPS Telco tidak ditemukan." });
    if (!profile.permissions.includes("ops_telco.view") || !profile.permissions.includes(permission)) return status(403, { message: "Anda tidak memiliki izin untuk submenu ini." });
    return { module: "ops-telco", section: params.section, permission, items: [] };
  }, {
    params: t.Object({ section: t.String() }),
    detail: {
      summary: "Akses submenu OPS Telco",
      description: "Memerlukan sesi karyawan, ops_telco.view, dan izin khusus submenu. Data pekerjaan belum tersedia pada tahap ini.",
      tags: ["Workspace"],
      operationId: "getOpsTelcoSection",
      security: [{ employeeSession: [] }]
    }
  })
  .get("/:module", async ({ params, request, status }) => {
    const profile = await getAuthenticatedProfile(request.headers, "employee");
    if (!profile) return status(401, { message: "Sesi karyawan tidak valid." });
    const permission = modulePermission[params.module];
    if (!permission) return status(404, { message: "Modul tidak ditemukan." });
    if (!profile.permissions.includes(permission)) return status(403, { message: "Anda tidak memiliki izin untuk modul ini." });
    return { module: params.module, permission, items: [] };
  }, {
    params: t.Object({
      module: t.String({
        description: "Slug modul workspace (hr, ops-telco, ops-workshop, project)",
        examples: ["hr", "ops-telco", "ops-workshop", "project"]
      })
    }),
    detail: {
      summary: "Data Modul Workspace",
      description: "Mengambil data workspace karyawan berdasarkan modul dan izin RBAC yang dimiliki.",
      tags: ["Workspace"],
      operationId: "getWorkspaceModule",
      security: [{ employeeSession: [] }],
      responses: {
        200: {
          description: "Data modul berhasil dimuat",
          content: { "application/json": { schema: { $ref: "#/components/schemas/WorkspaceModuleResponse" } } }
        },
        401: {
          description: "Sesi karyawan tidak ada atau kedaluwarsa",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } }
        },
        403: {
          description: "Karyawan tidak memiliki izin akses untuk modul ini",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } }
        },
        404: {
          description: "Modul yang diminta tidak terdaftar",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } }
        }
      }
    }
  });
