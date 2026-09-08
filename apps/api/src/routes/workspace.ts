import { Elysia, t } from "elysia";
import { getAuthenticatedProfile } from "../lib/auth";

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
  }, { params: t.Object({ module: t.String() }) });
