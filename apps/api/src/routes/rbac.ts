import { Elysia, t } from "elysia";
import { authorizeAdmin } from "../guards/admin.guard";
import {
  CreatePermissionSchema,
  CreateRoleSchema,
  UpdatePermissionSchema,
  UpdateRoleSchema
} from "../schemas/admin.dto";
import { rbacService } from "../services/rbac.service";

const idParams = t.Object({ id: t.Numeric({ minimum: 1, description: "ID resource RBAC" }) });
const detail = (operationId: string, summary: string, mutation = false) => ({
  summary,
  description: mutation
    ? "Operasi mutasi RBAC; memerlukan sesi administrator dengan izin admin.manage dan dicatat dalam audit log."
    : "Memerlukan sesi administrator dengan izin admin.manage.",
  tags: ["Admin RBAC"],
  operationId,
  security: [{ adminSession: [] }]
});

function sendResult(status: (code: any, body: any) => unknown, result: any, successStatus: 200 | 201 = 200) {
  if (result && "error" in result) return status(result.error.status, { code: result.error.code, message: result.error.message });
  return status(successStatus, "success" in result ? result : { data: result });
}

export const rbacRoutes = new Elysia({ prefix: "/admin/rbac" })
  .get("/roles", async ({ request, status }) => {
    const auth = await authorizeAdmin(request);
    if (!auth.success) return status(auth.failure.status, auth.failure.error);
    return { data: await rbacService.getRoles() };
  }, { detail: detail("getAdminRbacRoles", "Daftar role RBAC") })
  .post("/roles", async ({ request, body, status }) => {
    const auth = await authorizeAdmin(request);
    if (!auth.success) return status(auth.failure.status, auth.failure.error);
    return sendResult(status, await rbacService.createRole(body, auth.admin.id, auth.admin.permissions), 201);
  }, { body: CreateRoleSchema, detail: detail("createAdminRbacRole", "Buat role RBAC", true) })
  .patch("/roles/:id", async ({ request, params, body, status }) => {
    const auth = await authorizeAdmin(request);
    if (!auth.success) return status(auth.failure.status, auth.failure.error);
    return sendResult(status, await rbacService.updateRole(Number(params.id), body, auth.admin.id, auth.admin.permissions));
  }, { params: idParams, body: UpdateRoleSchema, detail: detail("updateAdminRbacRole", "Perbarui role RBAC", true) })
  .delete("/roles/:id", async ({ request, params, status }) => {
    const auth = await authorizeAdmin(request);
    if (!auth.success) return status(auth.failure.status, auth.failure.error);
    return sendResult(status, await rbacService.deleteRole(Number(params.id), auth.admin.id, auth.admin.permissions));
  }, { params: idParams, detail: detail("deleteAdminRbacRole", "Hapus role RBAC", true) })
  .get("/permissions", async ({ request, status }) => {
    const auth = await authorizeAdmin(request);
    if (!auth.success) return status(auth.failure.status, auth.failure.error);
    return { data: await rbacService.getPermissions() };
  }, { detail: detail("getAdminRbacPermissions", "Daftar izin RBAC") })
  .post("/permissions", async ({ request, body, status }) => {
    const auth = await authorizeAdmin(request);
    if (!auth.success) return status(auth.failure.status, auth.failure.error);
    return sendResult(status, await rbacService.createPermission(body, auth.admin.id, auth.admin.permissions), 201);
  }, { body: CreatePermissionSchema, detail: detail("createAdminRbacPermission", "Buat izin RBAC", true) })
  .patch("/permissions/:id", async ({ request, params, body, status }) => {
    const auth = await authorizeAdmin(request);
    if (!auth.success) return status(auth.failure.status, auth.failure.error);
    return sendResult(status, await rbacService.updatePermission(Number(params.id), body, auth.admin.id, auth.admin.permissions));
  }, { params: idParams, body: UpdatePermissionSchema, detail: detail("updateAdminRbacPermission", "Perbarui izin RBAC", true) })
  .delete("/permissions/:id", async ({ request, params, status }) => {
    const auth = await authorizeAdmin(request);
    if (!auth.success) return status(auth.failure.status, auth.failure.error);
    return sendResult(status, await rbacService.deletePermission(Number(params.id), auth.admin.id, auth.admin.permissions));
  }, { params: idParams, detail: detail("deleteAdminRbacPermission", "Hapus izin RBAC", true) });
