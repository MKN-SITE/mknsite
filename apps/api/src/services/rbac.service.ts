import { count, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { auditLogs, menus, permissions, rolePermissions, roles, userRoles } from "../db/schema";
import type {
  CreatePermissionDto,
  CreateRoleDto,
  PermissionSummaryDto,
  RoleSummaryDto,
  UpdatePermissionDto,
  UpdateRoleDto
} from "../schemas/admin.dto";
import { publishRealtimeEvent } from "../realtime/hub";

type ServiceError = { error: { status: 400 | 403 | 404 | 409; code: string; message: string } };

const SYSTEM_ROLES = new Set(["hr", "ops-telco", "ops-workshop", "project", "manager", "administrator", "superadmin"]);
const SYSTEM_PERMISSIONS = new Set([
  "dashboard.view", "hr.view", "hr.manage", "ops_telco.view", "ops_telco.manage",
  "ops_workshop.view", "ops_workshop.manage", "project.view", "project.manage",
  "admin.manage", "admin.security.manage"
]);

function normalizeIds(ids: number[] = []) {
  return [...new Set(ids)];
}

function conflict(code: string, message: string): ServiceError {
  return { error: { status: 409, code, message } };
}

export class RbacService {
  async getRoles(): Promise<RoleSummaryDto[]> {
    const [allRoles, grants, assignments] = await Promise.all([
      db.select({ id: roles.id, name: roles.name, slug: roles.slug }).from(roles).orderBy(roles.id),
      db.select({ roleId: rolePermissions.roleId, permissionId: permissions.id, slug: permissions.slug })
        .from(rolePermissions).innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id)).orderBy(permissions.id),
      db.select({ roleId: userRoles.roleId, total: count() }).from(userRoles).groupBy(userRoles.roleId)
    ]);
    const grantMap = new Map<number, Array<{ id: number; slug: string }>>();
    for (const grant of grants) {
      const list = grantMap.get(grant.roleId) ?? [];
      list.push({ id: grant.permissionId, slug: grant.slug });
      grantMap.set(grant.roleId, list);
    }
    const userCounts = new Map(assignments.map((row) => [row.roleId, Number(row.total)]));
    return allRoles.map((role) => {
      const roleGrants = grantMap.get(role.id) ?? [];
      return {
        ...role,
        permissions: roleGrants.map((item) => item.slug),
        permissionIds: roleGrants.map((item) => item.id),
        userCount: userCounts.get(role.id) ?? 0,
        isSystem: SYSTEM_ROLES.has(role.slug)
      };
    });
  }

  async getPermissions(): Promise<PermissionSummaryDto[]> {
    const [rows, roleCounts, menuCounts] = await Promise.all([
      db.select().from(permissions).orderBy(permissions.slug),
      db.select({ permissionId: rolePermissions.permissionId, total: count() }).from(rolePermissions).groupBy(rolePermissions.permissionId),
      db.select({ slug: menus.requiredPermission, total: count() }).from(menus).groupBy(menus.requiredPermission)
    ]);
    const rolesByPermission = new Map(roleCounts.map((row) => [row.permissionId, Number(row.total)]));
    const menusBySlug = new Map(menuCounts.filter((row) => row.slug).map((row) => [row.slug!, Number(row.total)]));
    return rows.map((permission) => ({
      id: permission.id,
      name: permission.name,
      slug: permission.slug,
      roleCount: rolesByPermission.get(permission.id) ?? 0,
      menuCount: menusBySlug.get(permission.slug) ?? 0,
      isSystem: SYSTEM_PERMISSIONS.has(permission.slug),
      createdAt: permission.createdAt.toISOString()
    }));
  }

  private async validatePermissions(permissionIds: number[]): Promise<ServiceError | null> {
    if (!permissionIds.length) return null;
    const found = await db.select({ id: permissions.id }).from(permissions).where(inArray(permissions.id, permissionIds));
    return found.length === permissionIds.length ? null : { error: { status: 400, code: "INVALID_PERMISSIONS", message: "Satu atau lebih izin tidak ditemukan." } };
  }

  private async notifyRoleUsers(roleId: number) {
    const affected = await db.select({ userId: userRoles.userId }).from(userRoles).where(eq(userRoles.roleId, roleId));
    for (const { userId } of affected) {
      publishRealtimeEvent(userId, { type: "access.updated", message: "Hak akses Anda diperbarui oleh administrator." });
    }
  }

  async createRole(data: CreateRoleDto, actorId: number): Promise<RoleSummaryDto | ServiceError> {
    const slug = data.slug.trim().toLowerCase();
    const name = data.name.trim();
    const permissionIds = normalizeIds(data.permissionIds);
    const [duplicate] = await db.select({ id: roles.id }).from(roles).where(eq(roles.slug, slug)).limit(1);
    if (duplicate) return conflict("ROLE_SLUG_EXISTS", "Slug role sudah digunakan.");
    const invalid = await this.validatePermissions(permissionIds);
    if (invalid) return invalid;
    let newId = 0;
    await db.transaction(async (tx) => {
      const [inserted] = await tx.insert(roles).values({ name, slug });
      newId = Number(inserted.insertId);
      if (permissionIds.length) await tx.insert(rolePermissions).values(permissionIds.map((permissionId) => ({ roleId: newId, permissionId })));
      await tx.insert(auditLogs).values({ actorId, action: "rbac.role.created", resource: "role", resourceId: String(newId) });
    });
    return (await this.getRoles()).find((role) => role.id === newId)!;
  }

  async updateRole(id: number, data: UpdateRoleDto, actorId: number): Promise<RoleSummaryDto | ServiceError> {
    const [existing] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
    if (!existing) return { error: { status: 404, code: "ROLE_NOT_FOUND", message: "Role tidak ditemukan." } };
    const nextSlug = data.slug?.trim().toLowerCase() ?? existing.slug;
    if (SYSTEM_ROLES.has(existing.slug) && nextSlug !== existing.slug) {
      return { error: { status: 403, code: "SYSTEM_ROLE_SLUG_PROTECTED", message: "Slug role bawaan tidak dapat diubah." } };
    }
    if (nextSlug !== existing.slug) {
      const [duplicate] = await db.select({ id: roles.id }).from(roles).where(eq(roles.slug, nextSlug)).limit(1);
      if (duplicate) return conflict("ROLE_SLUG_EXISTS", "Slug role sudah digunakan.");
    }
    const permissionIds = data.permissionIds === undefined ? undefined : normalizeIds(data.permissionIds);
    if (permissionIds) {
      const invalid = await this.validatePermissions(permissionIds);
      if (invalid) return invalid;
      const selected = permissionIds.length
        ? await db.select({ slug: permissions.slug }).from(permissions).where(inArray(permissions.id, permissionIds))
        : [];
      const slugs = new Set(selected.map((item) => item.slug));
      if (existing.slug === "administrator" && !slugs.has("admin.manage")) {
        return { error: { status: 403, code: "SYSTEM_ROLE_REQUIREMENT", message: "Role Administrator harus tetap memiliki izin admin.manage." } };
      }
      if (existing.slug === "superadmin" && (!slugs.has("admin.manage") || !slugs.has("admin.security.manage"))) {
        return { error: { status: 403, code: "SYSTEM_ROLE_REQUIREMENT", message: "Role Superadministrator harus tetap memiliki izin admin.manage dan admin.security.manage." } };
      }
    }
    await db.transaction(async (tx) => {
      await tx.update(roles).set({ name: data.name?.trim() ?? existing.name, slug: nextSlug }).where(eq(roles.id, id));
      if (permissionIds) {
        await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, id));
        if (permissionIds.length) await tx.insert(rolePermissions).values(permissionIds.map((permissionId) => ({ roleId: id, permissionId })));
      }
      await tx.insert(auditLogs).values({ actorId, action: "rbac.role.updated", resource: "role", resourceId: String(id) });
    });
    await this.notifyRoleUsers(id);
    return (await this.getRoles()).find((role) => role.id === id)!;
  }

  async deleteRole(id: number, actorId: number): Promise<{ success: true } | ServiceError> {
    const [existing] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
    if (!existing) return { error: { status: 404, code: "ROLE_NOT_FOUND", message: "Role tidak ditemukan." } };
    if (SYSTEM_ROLES.has(existing.slug)) return { error: { status: 403, code: "SYSTEM_ROLE_PROTECTED", message: "Role bawaan tidak dapat dihapus." } };
    const [usage] = await db.select({ total: count() }).from(userRoles).where(eq(userRoles.roleId, id));
    if (Number(usage?.total ?? 0) > 0) return conflict("ROLE_IN_USE", "Role masih digunakan oleh pengguna dan tidak dapat dihapus.");
    await db.transaction(async (tx) => {
      await tx.delete(roles).where(eq(roles.id, id));
      await tx.insert(auditLogs).values({ actorId, action: "rbac.role.deleted", resource: "role", resourceId: String(id) });
    });
    return { success: true };
  }

  async createPermission(data: CreatePermissionDto, actorId: number): Promise<PermissionSummaryDto | ServiceError> {
    const slug = data.slug.trim().toLowerCase();
    const [duplicate] = await db.select({ id: permissions.id }).from(permissions).where(eq(permissions.slug, slug)).limit(1);
    if (duplicate) return conflict("PERMISSION_SLUG_EXISTS", "Slug izin sudah digunakan.");
    let newId = 0;
    await db.transaction(async (tx) => {
      const [inserted] = await tx.insert(permissions).values({ name: data.name.trim(), slug });
      newId = Number(inserted.insertId);
      await tx.insert(auditLogs).values({ actorId, action: "rbac.permission.created", resource: "permission", resourceId: String(newId) });
    });
    return (await this.getPermissions()).find((permission) => permission.id === newId)!;
  }

  async updatePermission(id: number, data: UpdatePermissionDto, actorId: number): Promise<PermissionSummaryDto | ServiceError> {
    const [existing] = await db.select().from(permissions).where(eq(permissions.id, id)).limit(1);
    if (!existing) return { error: { status: 404, code: "PERMISSION_NOT_FOUND", message: "Izin tidak ditemukan." } };
    const nextSlug = data.slug?.trim().toLowerCase() ?? existing.slug;
    if (SYSTEM_PERMISSIONS.has(existing.slug) && nextSlug !== existing.slug) {
      return { error: { status: 403, code: "SYSTEM_PERMISSION_SLUG_PROTECTED", message: "Slug izin bawaan tidak dapat diubah." } };
    }
    if (nextSlug !== existing.slug) {
      const [duplicate] = await db.select({ id: permissions.id }).from(permissions).where(eq(permissions.slug, nextSlug)).limit(1);
      if (duplicate) return conflict("PERMISSION_SLUG_EXISTS", "Slug izin sudah digunakan.");
    }
    const roleRows = await db.select({ roleId: rolePermissions.roleId }).from(rolePermissions).where(eq(rolePermissions.permissionId, id));
    await db.transaction(async (tx) => {
      await tx.update(permissions).set({ name: data.name?.trim() ?? existing.name, slug: nextSlug }).where(eq(permissions.id, id));
      if (nextSlug !== existing.slug) await tx.update(menus).set({ requiredPermission: nextSlug }).where(eq(menus.requiredPermission, existing.slug));
      await tx.insert(auditLogs).values({ actorId, action: "rbac.permission.updated", resource: "permission", resourceId: String(id) });
    });
    for (const roleId of new Set(roleRows.map((row) => row.roleId))) await this.notifyRoleUsers(roleId);
    return (await this.getPermissions()).find((permission) => permission.id === id)!;
  }

  async deletePermission(id: number, actorId: number): Promise<{ success: true } | ServiceError> {
    const [existing] = await db.select().from(permissions).where(eq(permissions.id, id)).limit(1);
    if (!existing) return { error: { status: 404, code: "PERMISSION_NOT_FOUND", message: "Izin tidak ditemukan." } };
    if (SYSTEM_PERMISSIONS.has(existing.slug)) return { error: { status: 403, code: "SYSTEM_PERMISSION_PROTECTED", message: "Izin bawaan tidak dapat dihapus." } };
    const [[roleUsage], [menuUsage]] = await Promise.all([
      db.select({ total: count() }).from(rolePermissions).where(eq(rolePermissions.permissionId, id)),
      db.select({ total: count() }).from(menus).where(eq(menus.requiredPermission, existing.slug))
    ]);
    if (Number(roleUsage?.total ?? 0) > 0 || Number(menuUsage?.total ?? 0) > 0) {
      return conflict("PERMISSION_IN_USE", "Izin masih digunakan oleh role atau menu portal dan tidak dapat dihapus.");
    }
    await db.transaction(async (tx) => {
      await tx.delete(permissions).where(eq(permissions.id, id));
      await tx.insert(auditLogs).values({ actorId, action: "rbac.permission.deleted", resource: "permission", resourceId: String(id) });
    });
    return { success: true };
  }
}

export const rbacService = new RbacService();
