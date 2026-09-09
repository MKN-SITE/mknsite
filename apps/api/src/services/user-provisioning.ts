import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { auditLogs, authAccounts, authUsers, permissions, rolePermissions, roles, userRoles, users } from "../db/schema";
import { CreateUserDto, mapUserSummary, UserSummaryDto } from "../schemas/admin.dto";
import { publishAdminUsersUpdated } from "../realtime/hub";

export type ProvisionResult =
  | { success: true; user: UserSummaryDto }
  | { error: { status: 400 | 403 | 409 | 500; code: string; message: string } };

export class UserProvisioningService {
  async createEmployee(data: CreateUserDto, adminId: number): Promise<ProvisionResult> {
    const name = data.name.trim();
    const email = data.email.trim().toLowerCase();
    const roleIds = Array.from(new Set(data.roleIds ?? []));

    // 1. Validasi keberadaan role dan pastikan tidak ada role dengan hak admin.manage
    if (roleIds.length > 0) {
      const selectedRoles = await db.select({ id: roles.id }).from(roles).where(inArray(roles.id, roleIds));
      if (selectedRoles.length !== roleIds.length) {
        return {
          error: {
            status: 400,
            code: "INVALID_ROLES",
            message: "Satu atau lebih role tidak ditemukan."
          }
        };
      }

      const adminGrants = await db
        .select({ roleId: rolePermissions.roleId, slug: permissions.slug })
        .from(rolePermissions)
        .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
        .where(and(inArray(rolePermissions.roleId, roleIds), eq(permissions.slug, "admin.manage")));

      if (adminGrants.length > 0) {
        return {
          error: {
            status: 403,
            code: "ADMIN_ROLE_FORBIDDEN",
            message: "Akun karyawan tidak boleh memiliki hak akses administrator."
          }
        };
      }
    }

    // 2. Pemeriksaan awal duplikasi email (fast path)
    const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existingUser) {
      return {
        error: {
          status: 409,
          code: "EMAIL_ALREADY_EXISTS",
          message: "Email sudah terdaftar dalam sistem."
        }
      };
    }

    const [existingAuthUser] = await db.select({ id: authUsers.id }).from(authUsers).where(eq(authUsers.email, email)).limit(1);
    if (existingAuthUser) {
      return {
        error: {
          status: 409,
          code: "EMAIL_ALREADY_EXISTS",
          message: "Email sudah terdaftar dalam sistem."
        }
      };
    }

    // 3. Hash password dengan Argon2id konfigurasi Better Auth
    const hashedPassword = await Bun.password.hash(data.password, { algorithm: "argon2id" });

    // 4. Eksekusi transaksi atomik Drizzle (5 tabel sekaligus)
    try {
      const createdUser = await db.transaction(async (tx) => {
        // Step 4.1: Insert tabel users (MKN)
        const [userInsert] = await tx.insert(users).values({
          name,
          email,
          passwordHash: hashedPassword,
          accountType: "employee",
          isActive: 1
        });
        const mknUserId = Number(userInsert.insertId);

        // Step 4.2: Insert tabel auth_user (Better Auth)
        const authUserId = crypto.randomUUID();
        await tx.insert(authUsers).values({
          id: authUserId,
          mknUserId,
          name,
          email,
          emailVerified: true
        });

        // Step 4.3: Insert tabel auth_account (Better Auth credential provider)
        await tx.insert(authAccounts).values({
          id: crypto.randomUUID(),
          accountId: authUserId,
          providerId: "credential",
          userId: authUserId,
          password: hashedPassword
        });

        // Step 4.4: Insert relasi role di user_roles
        if (roleIds.length > 0) {
          await tx.insert(userRoles).values(
            roleIds.map((roleId) => ({ userId: mknUserId, roleId }))
          );
        }

        // Step 4.5: Insert audit log
        await tx.insert(auditLogs).values({
          actorId: adminId,
          action: "user.created",
          resource: "user",
          resourceId: String(mknUserId)
        });

        // Step 4.6: Query data tersanitasi untuk respons
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
          .where(eq(users.id, mknUserId))
          .limit(1);

        const userRoleRows = roleIds.length > 0
          ? await tx
              .select({ id: roles.id, name: roles.name, slug: roles.slug })
              .from(userRoles)
              .innerJoin(roles, eq(userRoles.roleId, roles.id))
              .where(eq(userRoles.userId, mknUserId))
              .orderBy(roles.id)
          : [];

        return mapUserSummary(freshUser, userRoleRows);
      });

      publishAdminUsersUpdated(createdUser.id);

      return { success: true, user: createdUser };
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

export const userProvisioningService = new UserProvisioningService();
