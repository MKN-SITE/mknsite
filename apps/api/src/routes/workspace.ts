import { Elysia, t } from "elysia";
import { getAuthenticatedProfile } from "../auth/auth";

const modulePermission: Record<string, string> = {
  hr: "hr.view",
  "ops-telco": "ops_telco.view",
  "ops-workshop": "ops_workshop.view",
  project: "project.view"
};

export const workspaceRoutes = new Elysia({ prefix: "/workspace" })
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
