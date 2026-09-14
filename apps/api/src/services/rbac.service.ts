import { count, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { auditLogs, menus, permissions, rolePermissions, roles, userRoles, users } from "../db/schema";
import type {
  CreatePermissionDto,
  CreateRoleDto,
  PermissionSummaryDto,
  RoleSummaryDto,
  UpdatePermissionDto,
  UpdateRoleDto
} from "../schemas/admin.dto";
import { publishAdminRbacUpdated, publishRealtimeEvent } from "../realtime/hub";

type ServiceError = { error: { status: 400 | 403 | 404 | 409; code: string; message: string } };

// Hanya role dan permission inti sistem yang dikunci permanen dari penghapusan
export const PROTECTED_SYSTEM_ROLES = new Set(["administrator", "superadmin"]);
export const PROTECTED_SYSTEM_PERMISSIONS = new Set([
  "dashboard.view",
  "admin.manage",
  "admin.security.manage"
]);

function normalizeIds(ids: number[] = []) {
  return [...new Set(ids)];
}

function conflict(code: string, message: string): ServiceError {
  return { error: { status: 409, code, message } };
}

export class RbacService {
  async getRoles(): Promise<RoleSummaryDto[]> {
    const [allRoles, grants, assignments, userLinks] = await Promise.all([
      db.select({ id: roles.id, name: roles.name, slug: roles.slug }).from(roles).orderBy(roles.id),
      db.select({
        roleId: rolePermissions.roleId,
        permissionId: permissions.id,
        slug: permissions.slug,
        name: permissions.name
      })
        .from(rolePermissions)
        .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
        .orderBy(permissions.id),
      db.select({ roleId: userRoles.roleId, total: count() }).from(userRoles).groupBy(userRoles.roleId),
      db.select({
        roleId: userRoles.roleId,
        userId: users.id,
        userName: users.name,
        userEmail: users.email
      })
        .from(userRoles)
        .innerJoin(users, eq(userRoles.userId, users.id))
        .orderBy(users.name)
    ]);

    const grantMap = new Map<number, Array<{ id: number; slug: string; name: string }>>();
    for (const grant of grants) {
      const list = grantMap.get(grant.roleId) ?? [];
      list.push({ id: grant.permissionId, slug: grant.slug, name: grant.name });
      grantMap.set(grant.roleId, list);
    }

    const userMap = new Map<number, Array<{ id: number; name: string; email: string }>>();
    for (const link of userLinks) {
      const list = userMap.get(link.roleId) ?? [];
      list.push({ id: link.userId, name: link.userName, email: link.userEmail });
      userMap.set(link.roleId, list);
    }

    const userCounts = new Map(assignments.map((row) => [row.roleId, Number(row.total)]));

    return allRoles.map((role) => {
      const roleGrants = grantMap.get(role.id) ?? [];
      const roleUsers = userMap.get(role.id) ?? [];
      return {
        ...role,
        permissions: roleGrants.map((item) => item.slug),
        permissionDetails: roleGrants.map((item) => ({ id: item.id, name: item.name, slug: item.slug })),
        permissionIds: roleGrants.map((item) => item.id),
        userCount: userCounts.get(role.id) ?? 0,
        users: roleUsers,
        isSystem: PROTECTED_SYSTEM_ROLES.has(role.slug)
      };
    });
  }

  async getPermissions(): Promise<PermissionSummaryDto[]> {
    const [rows, roleLinks, menuRows] = await Promise.all([
      db.select().from(permissions).orderBy(permissions.slug),
      db.select({
        permissionId: rolePermissions.permissionId,
        roleId: roles.id,
        roleName: roles.name,
        roleSlug: roles.slug
      })
        .from(rolePermissions)
        .innerJoin(roles, eq(rolePermissions.roleId, roles.id))
        .orderBy(roles.id),
      db.select({
        id: menus.id,
        title: menus.title,
        url: menus.url,
        requiredPermission: menus.requiredPermission
      })
        .from(menus)
        .orderBy(menus.sortOrder)
    ]);

    const rolesByPermission = new Map<number, Array<{ id: number; name: string; slug: string }>>();
    for (const link of roleLinks) {
      const list = rolesByPermission.get(link.permissionId) ?? [];
      list.push({ id: link.roleId, name: link.roleName, slug: link.roleSlug });
      rolesByPermission.set(link.permissionId, list);
    }

    const menusByPermissionSlug = new Map<string, Array<{ id: number; title: string; url: string | null }>>();
    for (const menu of menuRows) {
      if (menu.requiredPermission) {
        const list = menusByPermissionSlug.get(menu.requiredPermission) ?? [];
        list.push({ id: menu.id, title: menu.title, url: menu.url });
        menusByPermissionSlug.set(menu.requiredPermission, list);
      }
    }

    return rows.map((permission) => {
      const linkedRoles = rolesByPermission.get(permission.id) ?? [];
      const linkedMenus = menusByPermissionSlug.get(permission.slug) ?? [];
      return {
        id: permission.id,
        name: permission.name,
        slug: permission.slug,
        roleCount: linkedRoles.length,
        menuCount: linkedMenus.length,
        roles: linkedRoles,
        menus: linkedMenus,
        isSystem: PROTECTED_SYSTEM_PERMISSIONS.has(permission.slug),
        createdAt: permission.createdAt.toISOString()
      };
    });
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

  async createRole(data: CreateRoleDto, actorId: number, callerPermissions: string[] = []): Promise<RoleSummaryDto | ServiceError> {
    const slug = data.slug.trim().toLowerCase();
    const name = data.name.trim();
    const permissionIds = normalizeIds(data.permissionIds);
    const isCallerSuperadmin = callerPermissions.includes("admin.security.manage");

    if (slug === "superadmin" && !isCallerSuperadmin) {
      return { error: { status: 403, code: "SUPERADMIN_PERMISSION_REQUIRED", message: "Hanya Superadministrator yang dapat membuat role Superadministrator." } };
    }

    const [duplicate] = await db.select({ id: roles.id }).from(roles).where(eq(roles.slug, slug)).limit(1);
    if (duplicate) return conflict("ROLE_SLUG_EXISTS", "Slug role sudah digunakan.");

    const invalid = await this.validatePermissions(permissionIds);
    if (invalid) return invalid;

    if (permissionIds.length) {
      const selected = await db.select({ slug: permissions.slug }).from(permissions).where(inArray(permissions.id, permissionIds));
      if (selected.some((p) => p.slug === "admin.security.manage") && !isCallerSuperadmin) {
        return { error: { status: 403, code: "SUPERADMIN_PERMISSION_REQUIRED", message: "Hanya Superadministrator yang dapat memberikan izin admin.security.manage." } };
      }
    }

    let newId = 0;
    await db.transaction(async (tx) => {
      const [inserted] = await tx.insert(roles).values({ name, slug });
      newId = Number(inserted.insertId);
      if (permissionIds.length) await tx.insert(rolePermissions).values(permissionIds.map((permissionId) => ({ roleId: newId, permissionId })));
      await tx.insert(auditLogs).values({ actorId, action: "rbac.role.created", resource: "role", resourceId: String(newId) });
    });
    publishAdminRbacUpdated();
    return (await this.getRoles()).find((role) => role.id === newId)!;
  }

  async updateRole(id: number, data: UpdateRoleDto, actorId: number, callerPermissions: string[] = []): Promise<RoleSummaryDto | ServiceError> {
    const [existing] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
    if (!existing) return { error: { status: 404, code: "ROLE_NOT_FOUND", message: "Role tidak ditemukan." } };

    const isCallerSuperadmin = callerPermissions.includes("admin.security.manage");
    if (existing.slug === "superadmin" && !isCallerSuperadmin) {
      return { error: { status: 403, code: "SUPERADMIN_PERMISSION_REQUIRED", message: "Role Superadministrator hanya dapat dimodifikasi oleh sesama Superadministrator." } };
    }

    const nextSlug = data.slug?.trim().toLowerCase() ?? existing.slug;
    if (PROTECTED_SYSTEM_ROLES.has(existing.slug) && nextSlug !== existing.slug) {
      return { error: { status: 403, code: "SYSTEM_ROLE_SLUG_PROTECTED", message: "Slug role sistem tidak dapat diubah." } };
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

      if (slugs.has("admin.security.manage") && !isCallerSuperadmin) {
        return { error: { status: 403, code: "SUPERADMIN_PERMISSION_REQUIRED", message: "Hanya Superadministrator yang dapat memberikan izin admin.security.manage." } };
      }
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
    publishAdminRbacUpdated();
    return (await this.getRoles()).find((role) => role.id === id)!;
  }

  async deleteRole(id: number, actorId: number, callerPermissions: string[] = []): Promise<{ success: true } | ServiceError> {
    const [existing] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
    if (!existing) return { error: { status: 404, code: "ROLE_NOT_FOUND", message: "Role tidak ditemukan." } };

    if (PROTECTED_SYSTEM_ROLES.has(existing.slug)) {
      return { error: { status: 403, code: "SYSTEM_ROLE_PROTECTED", message: "Role sistem dilindungi dari penghapusan." } };
    }

    const [usage] = await db.select({ total: count() }).from(userRoles).where(eq(userRoles.roleId, id));
    if (Number(usage?.total ?? 0) > 0) {
      return conflict("ROLE_IN_USE", "Role masih digunakan oleh pengguna dan tidak dapat dihapus.");
    }

    await db.transaction(async (tx) => {
      await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, id));
      await tx.delete(roles).where(eq(roles.id, id));
      await tx.insert(auditLogs).values({ actorId, action: "rbac.role.deleted", resource: "role", resourceId: String(id) });
    });
    publishAdminRbacUpdated();
    return { success: true };
  }

  async createPermission(data: CreatePermissionDto, actorId: number, callerPermissions: string[] = []): Promise<PermissionSummaryDto | ServiceError> {
    const slug = data.slug.trim().toLowerCase();
    const isCallerSuperadmin = callerPermissions.includes("admin.security.manage");

    if (slug === "admin.security.manage" && !isCallerSuperadmin) {
      return { error: { status: 403, code: "SUPERADMIN_PERMISSION_REQUIRED", message: "Hanya Superadministrator yang dapat mengelola izin ini." } };
    }

    const [duplicate] = await db.select({ id: permissions.id }).from(permissions).where(eq(permissions.slug, slug)).limit(1);
    if (duplicate) return conflict("PERMISSION_SLUG_EXISTS", "Slug izin sudah digunakan.");

    let newId = 0;
    await db.transaction(async (tx) => {
      const [inserted] = await tx.insert(permissions).values({ name: data.name.trim(), slug });
      newId = Number(inserted.insertId);
      await tx.insert(auditLogs).values({ actorId, action: "rbac.permission.created", resource: "permission", resourceId: String(newId) });
    });
    publishAdminRbacUpdated();
    return (await this.getPermissions()).find((permission) => permission.id === newId)!;
  }

  async updatePermission(id: number, data: UpdatePermissionDto, actorId: number, callerPermissions: string[] = []): Promise<PermissionSummaryDto | ServiceError> {
    const [existing] = await db.select().from(permissions).where(eq(permissions.id, id)).limit(1);
    if (!existing) return { error: { status: 404, code: "PERMISSION_NOT_FOUND", message: "Izin tidak ditemukan." } };

    const isCallerSuperadmin = callerPermissions.includes("admin.security.manage");
    if (existing.slug === "admin.security.manage" && !isCallerSuperadmin) {
      return { error: { status: 403, code: "SUPERADMIN_PERMISSION_REQUIRED", message: "Hanya Superadministrator yang dapat memodifikasi izin ini." } };
    }

    const nextSlug = data.slug?.trim().toLowerCase() ?? existing.slug;
    if (PROTECTED_SYSTEM_PERMISSIONS.has(existing.slug) && nextSlug !== existing.slug) {
      return { error: { status: 403, code: "SYSTEM_PERMISSION_SLUG_PROTECTED", message: "Slug izin sistem tidak dapat diubah." } };
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
    publishAdminRbacUpdated();
    return (await this.getPermissions()).find((permission) => permission.id === id)!;
  }

  async deletePermission(id: number, actorId: number, callerPermissions: string[] = []): Promise<{ success: true } | ServiceError> {
    const [existing] = await db.select().from(permissions).where(eq(permissions.id, id)).limit(1);
    if (!existing) return { error: { status: 404, code: "PERMISSION_NOT_FOUND", message: "Izin tidak ditemukan." } };

    if (PROTECTED_SYSTEM_PERMISSIONS.has(existing.slug)) {
      return { error: { status: 403, code: "SYSTEM_PERMISSION_PROTECTED", message: "Izin sistem dilindungi dari penghapusan." } };
    }

    const [[roleUsage], [menuUsage]] = await Promise.all([
      db.select({ total: count() }).from(rolePermissions).where(eq(rolePermissions.permissionId, id)),
      db.select({ total: count() }).from(menus).where(eq(menus.requiredPermission, existing.slug))
    ]);
    if (Number(roleUsage?.total ?? 0) > 0 || Number(menuUsage?.total ?? 0) > 0) {
      return conflict("PERMISSION_IN_USE", "Izin masih digunakan oleh role atau menu dan tidak dapat dihapus.");
    }
    await db.transaction(async (tx) => {
      await tx.delete(permissions).where(eq(permissions.id, id));
      await tx.insert(auditLogs).values({ actorId, action: "rbac.permission.deleted", resource: "permission", resourceId: String(id) });
    });
    publishAdminRbacUpdated();
    return { success: true };
  }
}

export const rbacService = new RbacService();
