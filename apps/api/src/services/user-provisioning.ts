import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { accountAliases, auditLogs, authAccounts, authUsers, permissions, rolePermissions, roles, userRoles, users } from "../db/schema";
import { CreateUserDto, mapUserSummary, UserSummaryDto } from "../schemas/admin.dto";
import { publishAdminDivisionsUpdated, publishAdminRbacUpdated, publishAdminUsersUpdated } from "../realtime/hub";

export type ProvisionResult =
  | { success: true; user: UserSummaryDto }
  | { error: { status: 400 | 403 | 409 | 500; code: string; message: string } };

export type RegisterEmployeeInput = {
  kpcId: string;
  name: string;
  username: string;
  email: string;
  phone: string;
  startDate: string;
  password: string;
};

export type RegisterResult =
  | { success: true; user: { id: number; name: string; email: string; kpcId: string; username: string } }
  | { error: { status: 400 | 409 | 422 | 500; code: string; message: string } };

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
        const division = data.division?.trim() || null;
        // Step 4.1: Insert tabel users (MKN)
        const [userInsert] = await tx.insert(users).values({
          name,
          email,
          passwordHash: hashedPassword,
          accountType: "employee",
          division,
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

        // Step 4.4a: Insert alias email ke account_aliases
        await tx.insert(accountAliases).values({
          userId: mknUserId,
          aliasType: "email",
          normalizedValue: email
        });

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
      publishAdminDivisionsUpdated();
      publishAdminRbacUpdated();

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

  async registerEmployee(data: RegisterEmployeeInput): Promise<RegisterResult> {
    const name = (data.name ?? "").trim();
    const email = (data.email ?? "").trim().toLowerCase();
    const kpcId = (data.kpcId ?? "").trim().toUpperCase();
    const username = (data.username ?? "").trim().toLowerCase();
    const password = data.password ?? "";
    const startDate = (data.startDate ?? "").trim();

    // Normalisasi No. HP WhatsApp (+62...)
    let phone = (data.phone ?? "").trim().replace(/[\s-]/g, "");
    if (phone.startsWith("08")) phone = "+62" + phone.slice(1);
    else if (phone.startsWith("628")) phone = "+" + phone;
    else if (!phone.startsWith("+") && phone.length > 0) phone = "+62" + phone;

    // 1. Validasi Nama
    if (!name || name.length > 160) {
      return { error: { status: 422, code: "INVALID_NAME", message: "Nama lengkap wajib diisi (maksimal 160 karakter)." } };
    }

    // 2. Validasi ID KPC (2-32 karakter, format ^[A-Z0-9][A-Z0-9._/-]{1,31}$)
    if (!/^[A-Z0-9][A-Z0-9._\/-]{1,31}$/.test(kpcId)) {
      return {
        error: {
          status: 422,
          code: "INVALID_KPC_ID",
          message: "Format ID KPC tidak valid (2-32 karakter alfanumerik diawali huruf/angka, simbol . _ / - diizinkan)."
        }
      };
    }

    // 3. Validasi Username (3-32 karakter, format ^[a-z][a-z0-9._-]{2,31}$)
    if (!/^[a-z][a-z0-9._-]{2,31}$/.test(username)) {
      return {
        error: {
          status: 422,
          code: "INVALID_USERNAME",
          message: "Format username tidak valid (3-32 karakter huruf kecil diawali huruf, simbol . _ - diizinkan)."
        }
      };
    }

    // 4. Validasi Email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 191) {
      return { error: { status: 422, code: "INVALID_EMAIL", message: "Format email tidak valid." } };
    }

    // 5. Validasi No. WhatsApp
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
      return {
        error: {
          status: 422,
          code: "INVALID_PHONE",
          message: "Format nomor WhatsApp tidak valid (contoh: 08123456789 atau +628123456789)."
        }
      };
    }

    // 6. Validasi Tanggal Mulai Bekerja (DATE, tidak boleh di masa depan)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      return { error: { status: 422, code: "INVALID_START_DATE", message: "Format tanggal mulai bekerja harus YYYY-MM-DD." } };
    }
    const dateObj = new Date(startDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (isNaN(dateObj.getTime()) || dateObj > today) {
      return { error: { status: 422, code: "INVALID_START_DATE", message: "Tanggal mulai bekerja tidak boleh di masa depan." } };
    }

    // 7. Validasi Password (12-128 karakter)
    if (password.length < 12 || password.length > 128) {
      return { error: { status: 422, code: "INVALID_PASSWORD", message: "Kata sandi minimal 12 karakter dan maksimal 128 karakter." } };
    }

    // 8. Pemeriksaan benturan alias (Email / KPC / Username)
    const normalizedKpc = kpcId.toLowerCase();
    const existingAliases = await db
      .select({ type: accountAliases.aliasType, value: accountAliases.normalizedValue })
      .from(accountAliases)
      .where(inArray(accountAliases.normalizedValue, [email, normalizedKpc, username]));

    if (existingAliases.length > 0) {
      const matched = existingAliases[0];
      if (matched.value === email) {
        return { error: { status: 409, code: "EMAIL_ALREADY_EXISTS", message: "Email sudah terdaftar dalam sistem." } };
      }
      if (matched.value === normalizedKpc) {
        return {
          error: {
            status: 409,
            code: "KPC_ID_ALREADY_EXISTS",
            message: "ID KPC sudah terdaftar atau bertabrakan dengan identitas yang sudah digunakan."
          }
        };
      }
      return {
        error: {
          status: 409,
          code: "USERNAME_ALREADY_EXISTS",
          message: "Username sudah terdaftar atau bertabrakan dengan identitas yang sudah digunakan."
        }
      };
    }

    // 9. Pastikan role employee-basic tersedia
    const [basicRole] = await db.select({ id: roles.id }).from(roles).where(eq(roles.slug, "employee-basic")).limit(1);
    if (!basicRole) {
      return { error: { status: 500, code: "ROLE_NOT_CONFIGURED", message: "Role dasar employee-basic belum terdaftar di database." } };
    }

    // 10. Eksekusi transaksi atomik Drizzle
    const hashedPassword = await Bun.password.hash(password, { algorithm: "argon2id" });

    try {
      const result = await db.transaction(async (tx) => {
        // Step 1: Insert users
        const [userInsert] = await tx.insert(users).values({
          name,
          email,
          kpcId,
          username,
          phone,
          startDate,
          passwordHash: hashedPassword,
          accountType: "employee",
          isActive: 1
        });
        const mknUserId = Number(userInsert.insertId);

        // Step 2: Insert authUsers (Better Auth, emailVerified: false)
        const authUserId = crypto.randomUUID();
        await tx.insert(authUsers).values({
          id: authUserId,
          mknUserId,
          name,
          email,
          emailVerified: false
        });

        // Step 3: Insert authAccounts (Better Auth credential provider)
        await tx.insert(authAccounts).values({
          id: crypto.randomUUID(),
          accountId: authUserId,
          providerId: "credential",
          userId: authUserId,
          password: hashedPassword
        });

        // Step 4: Insert accountAliases (3 entri: email, kpc, username)
        await tx.insert(accountAliases).values([
          { userId: mknUserId, aliasType: "email", normalizedValue: email },
          { userId: mknUserId, aliasType: "kpc", normalizedValue: normalizedKpc },
          { userId: mknUserId, aliasType: "username", normalizedValue: username }
        ]);

        // Step 5: Assign default role employee-basic
        await tx.insert(userRoles).values({
          userId: mknUserId,
          roleId: basicRole.id
        });

        // Step 6: Audit log pendaftaran mandiri
        await tx.insert(auditLogs).values({
          actorId: mknUserId,
          action: "user.self_registered",
          resource: "user",
          resourceId: String(mknUserId)
        });

        return { id: mknUserId, name, email, kpcId, username };
      });

      publishAdminUsersUpdated(result.id);
      return { success: true, user: result };
    } catch (error: any) {
      if (error?.code === "ER_DUP_ENTRY" || error?.errno === 1062 || error?.message?.includes("Duplicate entry")) {
        return {
          error: {
            status: 409,
            code: "IDENTITY_COLLISION",
            message: "Identitas (Email, ID KPC, atau Username) sudah terdaftar dalam sistem."
          }
        };
      }
      throw error;
    }
  }
}

export const userProvisioningService = new UserProvisioningService();
