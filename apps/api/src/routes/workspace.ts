import { Elysia, t } from "elysia";
import { getAuthenticatedProfile } from "../auth/auth";

const modulePermission: Record<string, string> = {
  "ops-telco": "ops_telco.view",
  "ops-workshop": "ops_workshop.view",
  project: "project.view",
  "ik-sop": "ik_sop.view"
};

const opsTelcoSectionPermission: Record<string, string> = {
  "assign-job": "ops_telco.job_assignment.view",
  "assign-jadwal-oncall": "ops_telco.schedule.manage",
  "form-pto": "ops_telco.pto.view",
  "jadwal-oncall": "ops_telco.schedule.view",
  "auto-report-wag": "ops_telco.wag_report.view",
  "estimasi-quotation": "ops_telco.estimate.view",
  "dokumentasi-pekerjaan": "ops_telco.documentation.view",
  "form-oncall": "ops_telco.forms.view",
  "form-overtime": "ops_telco.forms.view",
  "form-cuti": "ops_telco.forms.view",
  "form-jsa": "ops_telco.forms.view",
  "approval-form-oncall": "ops_telco.oncall.approve",
  "approval-form-overtime": "ops_telco.forms.manage",
  "report-cuti-teknisi": "ops_telco.forms.manage",
  "kpi-bao-report": "ops_telco.kpi.manage",
  "rfo-report": "ops_telco.rfo.manage",
  "serah-terima-report": "ops_telco.forms.view",
  "inspeksi-tools": "ops_telco.forms.view",
  "inspeksi-apd": "ops_telco.forms.view",
  "inspeksi-tangga": "ops_telco.forms.view",
  "inspeksi-padlock": "ops_telco.forms.view",
  "inspeksi-report": "ops_telco.forms.view"
};

export const workspaceRoutes = new Elysia({ prefix: "/workspace" })
  .get("/ops-telco/:section", async ({ params, request, status }) => {
    const profile = await getAuthenticatedProfile(request.headers, "employee");
    if (!profile) return status(401, { message: "Sesi karyawan tidak valid." });
    const permission = opsTelcoSectionPermission[params.section];
    if (!permission) return status(404, { message: "Submenu OPS Telco tidak ditemukan." });
    const isSupervisorOrAdmin =
      profile.roles.includes("ops-telco-supervisor") ||
      profile.roles.includes("Supervisor OPS Telco") ||
      profile.roles.includes("administrator") ||
      profile.roles.includes("Administrator") ||
      profile.roles.includes("superadmin") ||
      profile.roles.includes("Superadministrator");

    const hasSectionPermission =
      profile.permissions.includes(permission) ||
      (params.section === "rfo-report" && profile.permissions.includes("ops_telco.kpi.manage"));
    const hasViewPermission = profile.permissions.includes("ops_telco.view");

    if (!isSupervisorOrAdmin && (!hasViewPermission || !hasSectionPermission)) {
      return status(403, { message: "Anda tidak memiliki izin untuk submenu ini." });
    }
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
    if (params.module === "ops-workshop" || params.module === "project") {
      return { module: params.module, permission, status: "under_development", items: [] };
    }
    const isSupervisorOrAdmin =
      profile.roles.includes("ops-telco-supervisor") ||
      profile.roles.includes("Supervisor OPS Telco") ||
      profile.roles.includes("administrator") ||
      profile.roles.includes("Administrator") ||
      profile.roles.includes("superadmin") ||
      profile.roles.includes("Superadministrator");

    if (!isSupervisorOrAdmin && !profile.permissions.includes(permission)) {
      return status(403, { message: "Anda tidak memiliki izin untuk modul ini." });
    }
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
