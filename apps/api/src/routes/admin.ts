import { eq, inArray } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "../db";
import { auditLogs, roles, userRoles, users } from "../db/schema";
import { getAuthenticatedProfile } from "../lib/auth";
import { publishRealtimeEvent } from "../lib/realtime";

async function requireAdmin(request: Request) {
  const admin = await getAuthenticatedProfile(request.headers, "admin");
  return admin?.permissions.includes("admin.manage") ? admin : null;
}

export const adminRoutes = new Elysia({ prefix: "/admin" })
  .patch("/users/:id/roles", async ({ params, body, request, status }) => {
    const admin = await requireAdmin(request);
    if (!admin) return status(403, { message: "Izin administrator diperlukan." });
    const targetId = Number(params.id);
    const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, targetId)).limit(1);
    if (!target) return status(404, { message: "Pengguna tidak ditemukan." });
    const selectedRoles = body.roleIds.length ? await db.select({ id: roles.id }).from(roles).where(inArray(roles.id, body.roleIds)) : [];
    if (selectedRoles.length !== body.roleIds.length) return status(400, { message: "Satu atau lebih role tidak ditemukan." });

    await db.transaction(async (tx) => {
      await tx.delete(userRoles).where(eq(userRoles.userId, targetId));
      if (body.roleIds.length) await tx.insert(userRoles).values(body.roleIds.map((roleId) => ({ userId: targetId, roleId })));
      await tx.insert(auditLogs).values({ actorId: admin.id, action: "rbac.roles.updated", resource: "user", resourceId: String(targetId) });
    });
    publishRealtimeEvent(targetId, { type: "access.updated", message: "Hak akses Anda diperbarui oleh administrator." });
    return { success: true };
  }, { params: t.Object({ id: t.Numeric() }), body: t.Object({ roleIds: t.Array(t.Integer()) }) })
  .patch("/users/:id/status", async ({ params, body, request, status }) => {
    const admin = await requireAdmin(request);
    if (!admin) return status(403, { message: "Izin administrator diperlukan." });
    const targetId = Number(params.id);
    const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, targetId)).limit(1);
    if (!target) return status(404, { message: "Pengguna tidak ditemukan." });
    await db.update(users).set({ isActive: body.isActive ? 1 : 0 }).where(eq(users.id, targetId));
    await db.insert(auditLogs).values({ actorId: admin.id, action: "account.status.updated", resource: "user", resourceId: String(targetId) });
    publishRealtimeEvent(targetId, { type: body.isActive ? "access.updated" : "session.revoked", message: body.isActive ? "Akun Anda diaktifkan kembali." : "Akun Anda dinonaktifkan oleh administrator." });
    return { success: true };
  }, { params: t.Object({ id: t.Numeric() }), body: t.Object({ isActive: t.Boolean() }) });
