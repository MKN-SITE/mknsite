import { t } from "elysia";

export type UserRoleDto = {
  id: number;
  name: string;
  slug: string;
};

export type UserSummaryDto = {
  id: number;
  name: string;
  email: string;
  accountType: "employee" | "admin";
  division?: string | null;
  avatarUrl?: string | null;
  isActive: boolean;
  lastLoginAt?: string | null;
  isOnline: boolean;
  roles: UserRoleDto[];
  createdAt: string;
  updatedAt: string;
};

export type PaginationMetaDto = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type UserListResponseDto = {
  data: UserSummaryDto[];
  pagination: PaginationMetaDto;
};

export type UserDetailResponseDto = {
  data: UserSummaryDto;
};

export type RoleSummaryDto = {
  id: number;
  name: string;
  slug: string;
  permissions: string[];
  permissionIds: number[];
  userCount: number;
  isSystem: boolean;
};

export type PermissionSummaryDto = {
  id: number;
  name: string;
  slug: string;
  roleCount: number;
  menuCount: number;
  isSystem: boolean;
  createdAt: string;
};

export type RoleListResponseDto = {
  data: RoleSummaryDto[];
};

export const UserRoleSchema = t.Object({
  id: t.Integer({ description: "ID role" }),
  name: t.String({ description: "Nama role tampilan" }),
  slug: t.String({ description: "Slug role identifier" })
});

export const UserSummarySchema = t.Object({
  id: t.Integer({ description: "ID pengguna internal MKN" }),
  name: t.String({ description: "Nama lengkap pengguna" }),
  email: t.String({ description: "Alamat email pengguna" }),
  accountType: t.Union([t.Literal("employee"), t.Literal("admin")], { description: "Jenis akun pengguna" }),
  division: t.Optional(t.Nullable(t.String({ description: "Divisi organisasi pengguna" }))),
  avatarUrl: t.Optional(t.Nullable(t.String({ description: "URL foto profil pengguna" }))),
  isActive: t.Boolean({ description: "Status keaktifan akun" }),
  lastLoginAt: t.Optional(t.Nullable(t.String({ description: "Waktu login terakhir dalam format ISO 8601" }))),
  isOnline: t.Boolean({ description: "Status apakah pengguna sedang aktif memiliki sesi login" }),
  roles: t.Array(UserRoleSchema, { description: "Daftar role yang dimiliki pengguna" }),
  createdAt: t.String({ description: "Waktu pembuatan akun dalam format ISO 8601" }),
  updatedAt: t.String({ description: "Waktu pembaruan akun terakhir dalam format ISO 8601" })
});

export const PaginationMetaSchema = t.Object({
  page: t.Integer({ description: "Nomor halaman saat ini" }),
  pageSize: t.Integer({ description: "Jumlah data per halaman" }),
  total: t.Integer({ description: "Total seluruh rekaman setelah filter" }),
  totalPages: t.Integer({ description: "Total jumlah halaman" })
});

export const UserListResponseSchema = t.Object({
  data: t.Array(UserSummarySchema, { description: "Daftar data pengguna pada halaman ini" }),
  pagination: PaginationMetaSchema
});

export const UserDetailResponseSchema = t.Object({
  data: UserSummarySchema
});

export const RoleSummarySchema = t.Object({
  id: t.Integer({ description: "ID role" }),
  name: t.String({ description: "Nama role" }),
  slug: t.String({ description: "Slug role" }),
  permissions: t.Array(t.String(), { description: "Daftar slug izin akses (permissions) yang dimiliki role" }),
  permissionIds: t.Array(t.Integer(), { description: "Daftar ID permission yang dimiliki role" }),
  userCount: t.Integer({ description: "Jumlah pengguna yang memakai role" }),
  isSystem: t.Boolean({ description: "Role bawaan yang tidak dapat dihapus atau diubah slug-nya" })
});

export const RoleListResponseSchema = t.Object({
  data: t.Array(RoleSummarySchema, { description: "Daftar seluruh role beserta izin aksesnya" })
});

const roleSlugSchema = t.String({
  minLength: 2,
  maxLength: 100,
  pattern: "^[a-z0-9]+(?:[._-][a-z0-9]+)*$",
  description: "Identifier lowercase; boleh memakai titik, garis bawah, atau tanda hubung"
});

const permissionSlugSchema = t.String({
  minLength: 2,
  maxLength: 140,
  pattern: "^[a-z0-9]+(?:[._-][a-z0-9]+)*$",
  description: "Identifier lowercase; boleh memakai titik, garis bawah, atau tanda hubung"
});

export const CreateRoleSchema = t.Object({
  name: t.String({ minLength: 2, maxLength: 100 }),
  slug: roleSlugSchema,
  permissionIds: t.Optional(t.Array(t.Integer({ minimum: 1 }), { default: [], uniqueItems: true, maxItems: 200 }))
});

export const UpdateRoleSchema = t.Object({
  name: t.Optional(t.String({ minLength: 2, maxLength: 100 })),
  slug: t.Optional(roleSlugSchema),
  permissionIds: t.Optional(t.Array(t.Integer({ minimum: 1 }), { uniqueItems: true, maxItems: 200 }))
}, { minProperties: 1 });

export const CreatePermissionSchema = t.Object({
  name: t.String({ minLength: 2, maxLength: 140 }),
  slug: permissionSlugSchema
});

export const UpdatePermissionSchema = t.Object({
  name: t.Optional(t.String({ minLength: 2, maxLength: 140 })),
  slug: t.Optional(permissionSlugSchema)
}, { minProperties: 1 });

export type CreateRoleDto = typeof CreateRoleSchema.static;
export type UpdateRoleDto = typeof UpdateRoleSchema.static;
export type CreatePermissionDto = typeof CreatePermissionSchema.static;
export type UpdatePermissionDto = typeof UpdatePermissionSchema.static;

export const UserQuerySchema = t.Object({
  page: t.Optional(t.Numeric({ minimum: 1, default: 1, description: "Nomor halaman (default 1)" })),
  pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100, default: 20, description: "Jumlah data per halaman (default 20, maks 100)" })),
  search: t.Optional(t.String({ maxLength: 100, description: "Pencarian nama atau email (maks 100 karakter)" })),
  status: t.Optional(t.Union([t.Literal("all"), t.Literal("active"), t.Literal("inactive")], { default: "all", description: "Filter status akun (all, active, inactive)" })),
  accountType: t.Optional(t.Union([t.Literal("all"), t.Literal("employee"), t.Literal("admin")], { default: "all", description: "Filter jenis akun (all, employee, admin)" })),
  division: t.Optional(t.String({ maxLength: 100, description: "Filter divisi pengguna" }))
});

export function mapUserSummary(
  user: {
    id: number;
    name: string;
    email: string;
    accountType: string;
    division?: string | null;
    avatarUrl?: string | null;
    isActive: number;
    lastLoginAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
  },
  roles: UserRoleDto[],
  isOnline = false
): UserSummaryDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    accountType: user.accountType === "admin" ? "admin" : "employee",
    division: user.division ?? null,
    avatarUrl: user.avatarUrl ?? null,
    isActive: Boolean(user.isActive),
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    isOnline,
    roles,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  };
}

export const CreateUserSchema = t.Object({
  name: t.String({ minLength: 1, maxLength: 160, description: "Nama lengkap karyawan (1-160 karakter)" }),
  email: t.String({ format: "email", maxLength: 191, description: "Alamat email resmi karyawan (maks 191 karakter)" }),
  password: t.String({ minLength: 12, maxLength: 128, description: "Kata sandi akun karyawan (12-128 karakter)" }),
  division: t.Optional(t.String({ maxLength: 100, description: "Divisi karyawan" })),
  roleIds: t.Optional(t.Array(t.Integer(), { default: [], description: "Daftar ID role yang diberikan (tidak boleh memuat izin admin.manage)" }))
});

export type CreateUserDto = typeof CreateUserSchema.static;

export const UpdateUserProfileSchema = t.Object({
  name: t.Optional(t.String({ minLength: 1, maxLength: 160, description: "Nama lengkap pengguna (1-160 karakter)" })),
  email: t.Optional(t.String({ format: "email", maxLength: 191, description: "Alamat email resmi pengguna (maks 191 karakter)" })),
  division: t.Optional(t.Nullable(t.String({ maxLength: 100, description: "Divisi pengguna" }))),
  avatarUrl: t.Optional(t.Nullable(t.String({ maxLength: 500, description: "URL foto profil pengguna" }))),
  password: t.Optional(t.Any({ description: "Field terlarang (menghasilkan HTTP 400 jika dikirim)" })),
  passwordHash: t.Optional(t.Any({ description: "Field terlarang (menghasilkan HTTP 400 jika dikirim)" })),
  roleIds: t.Optional(t.Any({ description: "Field terlarang (menghasilkan HTTP 400 jika dikirim)" })),
  isActive: t.Optional(t.Any({ description: "Field terlarang (menghasilkan HTTP 400 jika dikirim)" })),
  accountType: t.Optional(t.Any({ description: "Field terlarang (menghasilkan HTTP 400 jika dikirim)" }))
});

export type UpdateUserProfileDto = typeof UpdateUserProfileSchema.static;
