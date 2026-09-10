import { and, count, desc, eq, inArray, like, ne, or } from "drizzle-orm";
import { db } from "../db";
import { auditLogs, authSessions, authUsers, permissions, rolePermissions, roles, userRoles, users } from "../db/schema";
import { mapUserSummary, type RoleSummaryDto, type UpdateUserProfileDto, type UserListResponseDto, type UserSummaryDto } from "../schemas/admin.dto";
import { publishAdminUsersUpdated, publishRealtimeEvent } from "../realtime/hub";

export type GetUsersOptions = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: "all" | "active" | "inactive";
  accountType?: "all" | "employee" | "admin";
};

export class AdminService {
  async getUsers(options: GetUsersOptions): Promise<UserListResponseDto> {
    const page = Math.max(1, Number(options.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(options.pageSize ?? 20)));
    const search = options.search?.trim();

    const conditions = [];

    if (search && search.length > 0) {
      conditions.push(or(like(users.name, `%${search}%`), like(users.email, `%${search}%`)));
    }

    if (options.status && options.status !== "all") {
      conditions.push(eq(users.isActive, options.status === "active" ? 1 : 0));
    }

    if (options.accountType && options.accountType !== "all") {
      conditions.push(eq(users.accountType, options.accountType));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRow] = await db.select({ total: count() }).from(users).where(whereClause);
    const total = Number(totalRow?.total ?? 0);
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

    if (total === 0 || page > totalPages) {
      return {
        data: [],
        pagination: { page, pageSize, total, totalPages }
      };
    }

    const userRows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        accountType: users.accountType,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt
      })
      .from(users)
      .where(whereClause)
      .orderBy(desc(users.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const userIds = userRows.map((u) => u.id);
    const rolesMap = new Map<number, Array<{ id: number; name: string; slug: string }>>();

    if (userIds.length > 0) {
      const userRoleRows = await db
        .select({
          userId: userRoles.userId,
          id: roles.id,
          name: roles.name,
          slug: roles.slug
        })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(inArray(userRoles.userId, userIds))
        .orderBy(roles.id);

      for (const row of userRoleRows) {
        const list = rolesMap.get(row.userId) ?? [];
        list.push({ id: row.id, name: row.name, slug: row.slug });
        rolesMap.set(row.userId, list);
      }
    }

    const data = userRows.map((u) => mapUserSummary(u, rolesMap.get(u.id) ?? []));

    return {
      data,
      pagination: { page, pageSize, total, totalPages }
    };
  }

  async getUserById(targetId: number): Promise<UserSummaryDto | null> {
    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        accountType: users.accountType,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt
      })
      .from(users)
      .where(eq(users.id, targetId))
      .limit(1);

    if (!user) return null;

    const userRoleRows = await db
      .select({
        id: roles.id,
        name: roles.name,
        slug: roles.slug
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, targetId))
      .orderBy(roles.id);

    return mapUserSummary(user, userRoleRows);
  }

  async getRoles(): Promise<RoleSummaryDto[]> {
    const allRoles = await db
      .select({ id: roles.id, name: roles.name, slug: roles.slug })
      .from(roles)
      .orderBy(roles.id);

    const allGrants = await db
      .select({
        roleId: rolePermissions.roleId,
        permission: permissions.slug
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .orderBy(permissions.id);

    const grantsMap = new Map<number, string[]>();
    for (const grant of allGrants) {
      const list = grantsMap.get(grant.roleId) ?? [];
      list.push(grant.permission);
      grantsMap.set(grant.roleId, list);
    }

    return allRoles.map((role) => ({
      id: role.id,
      name: role.name,
      slug: role.slug,
      permissions: grantsMap.get(role.id) ?? []
    }));
  }

  async isUserSuperadmin(userId: number): Promise<boolean> {
    const superGrants = await db
      .select({ id: userRoles.userId })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(and(eq(userRoles.userId, userId), eq(permissions.slug, "admin.security.manage")))
      .limit(1);
    return superGrants.length > 0;
  }

  async updateUserRoles(
    targetId: number,
    roleIds: number[],
    adminId: number,
    callerPermissions: string[] = []
  ): Promise<{ success: boolean } | { error: { status: number; code: string; message: string } }> {
    const [target] = await db
      .select({ id: users.id, accountType: users.accountType })
      .from(users)
      .where(eq(users.id, targetId))
      .limit(1);
    if (!target) return { error: { status: 404, code: "USER_NOT_FOUND", message: "Pengguna tidak ditemukan." } };

    const isCallerSuperadmin = callerPermissions.includes("admin.security.manage");

    // Proteksi akun Superadministrator: hanya sesama Superadministrator yang boleh memodifikasi role-nya
    const targetIsSuperadmin = await this.isUserSuperadmin(targetId);
    if (targetIsSuperadmin && !isCallerSuperadmin) {
      return {
        error: {
          status: 403,
          code: "SUPERADMIN_PROTECTED",
          message: "Akun Superadministrator dilindungi dari modifikasi oleh administrator standar."
        }
      };
    }

    const selectedRoles = roleIds.length ? await db.select({ id: roles.id }).from(roles).where(inArray(roles.id, roleIds)) : [];
    if (selectedRoles.length !== roleIds.length) {
      return { error: { status: 400, code: "INVALID_ROLES", message: "Satu atau lebih role tidak ditemukan." } };
    }

    // Periksa apakah ada role yang diberikan memuat hak admin.security.manage
    const superGrantsAssigned = roleIds.length
      ? await db
          .select({ roleId: rolePermissions.roleId })
          .from(rolePermissions)
          .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
          .where(and(inArray(rolePermissions.roleId, roleIds), eq(permissions.slug, "admin.security.manage")))
      : [];

    if (superGrantsAssigned.length > 0 && !isCallerSuperadmin) {
      return {
        error: {
          status: 403,
          code: "SUPERADMIN_PERMISSION_REQUIRED",
          message: "Hanya Superadministrator yang dapat menetapkan role Superadministrator."
        }
      };
    }

    if (target.accountType === "admin") {
      const adminGrants = roleIds.length
        ? await db
            .select({ roleId: rolePermissions.roleId })
            .from(rolePermissions)
            .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
            .where(and(inArray(rolePermissions.roleId, roleIds), eq(permissions.slug, "admin.manage")))
        : [];
      const hasAdminManage = adminGrants.length > 0;

      if (!hasAdminManage) {
        if (targetId === adminId) {
          return {
            error: {
              status: 403,
              code: "SELF_ADMIN_REVOKE_FORBIDDEN",
              message: "Administrator tidak dapat mencabut hak akses administrator miliknya sendiri."
            }
          };
        }

        const [adminCount] = await db
          .select({ total: count() })
          .from(users)
          .where(and(eq(users.accountType, "admin"), eq(users.isActive, 1)));

        if (Number(adminCount?.total ?? 0) <= 1) {
          return {
            error: {
              status: 403,
              code: "LAST_ADMIN_PROTECTED",
              message: "Tidak dapat mencabut hak akses administrator terakhir."
            }
          };
        }
      }
    }

    await db.transaction(async (tx) => {
      await tx.delete(userRoles).where(eq(userRoles.userId, targetId));
      if (roleIds.length) {
        await tx.insert(userRoles).values(roleIds.map((roleId) => ({ userId: targetId, roleId })));
      }

      // Cabut sesi aktif user agar login ulang dengan role terbaru
      const [authUser] = await tx
        .select({ id: authUsers.id })
        .from(authUsers)
        .where(eq(authUsers.mknUserId, targetId))
        .limit(1);

      if (authUser) {
        await tx.delete(authSessions).where(eq(authSessions.userId, authUser.id));
      }

      await tx.insert(auditLogs).values({
        actorId: adminId,
        action: "rbac.roles.updated",
        resource: "user",
        resourceId: String(targetId)
      });
    });

    publishRealtimeEvent(targetId, {
      type: "session.revoked",
      message: "Hak akses Anda diperbarui oleh administrator. Silakan login kembali."
    });

    publishAdminUsersUpdated(targetId);

    return { success: true };
  }

  async updateUserStatus(
    targetId: number,
    isActive: boolean,
    adminId: number,
    callerPermissions: string[] = []
  ): Promise<{ success: boolean } | { error: { status: number; code: string; message: string } }> {
    const [target] = await db
      .select({ id: users.id, accountType: users.accountType, isActive: users.isActive })
      .from(users)
      .where(eq(users.id, targetId))
      .limit(1);
    if (!target) return { error: { status: 404, code: "USER_NOT_FOUND", message: "Pengguna tidak ditemukan." } };

    if (!isActive && targetId === adminId) {
      return {
        error: {
          status: 403,
          code: "SELF_DEACTIVATION_FORBIDDEN",
          message: "Administrator tidak dapat menonaktifkan akun sendiri."
        }
      };
    }

    const isCallerSuperadmin = callerPermissions.includes("admin.security.manage");

    // Proteksi akun Superadministrator: hanya sesama Superadministrator yang boleh mengubah statusnya
    const targetIsSuperadmin = await this.isUserSuperadmin(targetId);
    if (targetIsSuperadmin && !isCallerSuperadmin) {
      return {
        error: {
          status: 403,
          code: "SUPERADMIN_PROTECTED",
          message: "Akun Superadministrator dilindungi dari modifikasi status oleh administrator standar."
        }
      };
    }

    if (!isActive) {
      if (target.accountType === "admin") {
        const [adminCount] = await db
          .select({ total: count() })
          .from(users)
          .where(and(eq(users.accountType, "admin"), eq(users.isActive, 1)));

        if (Number(adminCount?.total ?? 0) <= 1) {
          return {
            error: {
              status: 403,
              code: "LAST_ADMIN_PROTECTED",
              message: "Tidak dapat menonaktifkan administrator terakhir."
            }
          };
        }
      }
    }

    await db.transaction(async (tx) => {
      await tx.update(users).set({ isActive: isActive ? 1 : 0 }).where(eq(users.id, targetId));

      if (!isActive) {
        const [authUser] = await tx
          .select({ id: authUsers.id })
          .from(authUsers)
          .where(eq(authUsers.mknUserId, targetId))
          .limit(1);

        if (authUser) {
          await tx.delete(authSessions).where(eq(authSessions.userId, authUser.id));
        }
      }

      await tx.insert(auditLogs).values({
        actorId: adminId,
        action: "account.status.updated",
        resource: "user",
        resourceId: String(targetId)
      });
    });

    publishRealtimeEvent(targetId, {
      type: isActive ? "access.updated" : "session.revoked",
      message: isActive ? "Akun Anda diaktifkan kembali." : "Akun Anda dinonaktifkan oleh administrator."
    });

    publishAdminUsersUpdated(targetId);

    return { success: true };
  }

  async revokeUserSessions(
    targetId: number,
    adminId: number,
    callerPermissions: string[] = []
  ): Promise<{ success: boolean } | { error: { status: number; code: string; message: string } }> {
    const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, targetId)).limit(1);
    if (!target) return { error: { status: 404, code: "USER_NOT_FOUND", message: "Pengguna tidak ditemukan." } };

    const isCallerSuperadmin = callerPermissions.includes("admin.security.manage");

    // Proteksi akun Superadministrator: hanya sesama Superadministrator yang boleh mencabut sesinya
    const targetIsSuperadmin = await this.isUserSuperadmin(targetId);
    if (targetIsSuperadmin && !isCallerSuperadmin) {
      return {
        error: {
          status: 403,
          code: "SUPERADMIN_PROTECTED",
          message: "Akun Superadministrator dilindungi dari pencabutan sesi oleh administrator standar."
        }
      };
    }

    await db.transaction(async (tx) => {
      const [authUser] = await tx
        .select({ id: authUsers.id })
        .from(authUsers)
        .where(eq(authUsers.mknUserId, targetId))
        .limit(1);

      if (authUser) {
        await tx.delete(authSessions).where(eq(authSessions.userId, authUser.id));
      }

      await tx.insert(auditLogs).values({
        actorId: adminId,
        action: "session.revoked",
        resource: "user",
        resourceId: String(targetId)
      });
    });

    publishRealtimeEvent(targetId, {
      type: "session.revoked",
      message: "Sesi Anda telah dicabut oleh administrator. Silakan login kembali."
    });

    publishAdminUsersUpdated(targetId);

    return { success: true };
  }

  async updateUserProfile(
    targetId: number,
    data: UpdateUserProfileDto,
    rawBody: Record<string, unknown>,
    adminId: number
  ): Promise<UpdateProfileResult> {
    const forbiddenKeys = ["password", "passwordHash", "roleIds", "isActive", "accountType"];
    const foundForbidden = forbiddenKeys.find((key) => key in rawBody && rawBody[key] !== undefined);
    if (foundForbidden) {
      return {
        error: {
          status: 400,
          code: "FORBIDDEN_FIELD",
          message: `Field '${foundForbidden}' tidak boleh diubah melalui endpoint profil.`
        }
      };
    }

    const hasName = typeof data.name === "string" && data.name.trim().length > 0;
    const hasEmail = typeof data.email === "string" && data.email.trim().length > 0;
    if (!hasName && !hasEmail) {
      return {
        error: {
          status: 400,
          code: "EMPTY_UPDATE",
          message: "Setidaknya salah satu dari nama atau email harus diberikan."
        }
      };
    }

    const [targetUser] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        accountType: users.accountType,
        isActive: users.isActive
      })
      .from(users)
      .where(eq(users.id, targetId))
      .limit(1);

    if (!targetUser) {
      return {
        error: {
          status: 404,
          code: "USER_NOT_FOUND",
          message: "Pengguna tidak ditemukan."
        }
      };
    }

    if (targetUser.accountType === "admin") {
      return {
        error: {
          status: 403,
          code: "ADMIN_PROFILE_FORBIDDEN",
          message: "Profil akun administrator tidak dapat diubah melalui endpoint ini."
        }
      };
    }

    const newEmail = hasEmail ? data.email!.trim().toLowerCase() : undefined;
    const emailChanged = newEmail !== undefined && newEmail !== targetUser.email.toLowerCase();

    if (emailChanged) {
      const [dupUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, newEmail!), ne(users.id, targetId)))
        .limit(1);

      if (dupUser) {
        return {
          error: {
            status: 409,
            code: "EMAIL_ALREADY_EXISTS",
            message: "Email sudah terdaftar dalam sistem."
          }
        };
      }

      const [dupAuthUser] = await db
        .select({ id: authUsers.id })
        .from(authUsers)
        .where(and(eq(authUsers.email, newEmail!), ne(authUsers.mknUserId, targetId)))
        .limit(1);

      if (dupAuthUser) {
        return {
          error: {
            status: 409,
            code: "EMAIL_ALREADY_EXISTS",
            message: "Email sudah terdaftar dalam sistem."
          }
        };
      }
    }

    const newName = hasName ? data.name!.trim() : undefined;

    try {
      const updatedUser = await db.transaction(async (tx) => {
        const userUpdateValues: { name?: string; email?: string } = {};
        if (newName !== undefined) userUpdateValues.name = newName;
        if (newEmail !== undefined) userUpdateValues.email = newEmail;

        await tx.update(users).set(userUpdateValues).where(eq(users.id, targetId));

        const [authUser] = await tx
          .select({ id: authUsers.id })
          .from(authUsers)
          .where(eq(authUsers.mknUserId, targetId))
          .limit(1);

        if (authUser) {
          await tx.update(authUsers).set(userUpdateValues).where(eq(authUsers.id, authUser.id));

          if (emailChanged) {
            await tx.delete(authSessions).where(eq(authSessions.userId, authUser.id));
          }
        }

        await tx.insert(auditLogs).values({
          actorId: adminId,
          action: "user.profile.updated",
          resource: "user",
          resourceId: String(targetId)
        });

        const [freshUser] = await tx
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            accountType: users.accountType,
            isActive: users.isActive,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt
          })
          .from(users)
          .where(eq(users.id, targetId))
          .limit(1);

        const userRoleRows = await tx
          .select({ id: roles.id, name: roles.name, slug: roles.slug })
          .from(userRoles)
          .innerJoin(roles, eq(userRoles.roleId, roles.id))
          .where(eq(userRoles.userId, targetId))
          .orderBy(roles.id);

        return mapUserSummary(freshUser, userRoleRows);
      });

      if (emailChanged) {
        publishRealtimeEvent(targetId, {
          type: "session.revoked",
          message: "Email akun Anda telah diubah oleh administrator. Silakan login kembali."
        });
      }

      publishAdminUsersUpdated(targetId);

      return { success: true, user: updatedUser };
    } catch (error: any) {
      if (error?.code === "ER_DUP_ENTRY" || error?.errno === 1062 || error?.message?.includes("Duplicate entry")) {
        return {
          error: {
            status: 409,
            code: "EMAIL_ALREADY_EXISTS",
            message: "Email sudah terdaftar dalam sistem."
          }
        };
      }
      throw error;
    }
  }
}

export type UpdateProfileResult =
  | { success: true; user: UserSummaryDto }
  | { error: { status: 400 | 403 | 404 | 409 | 500; code: string; message: string } };

export const adminService = new AdminService();
