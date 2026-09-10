import { Elysia, t } from "elysia";
import { authorizeAdmin } from "../guards/admin.guard";
import { CreateUserSchema, UpdateUserProfileSchema, UserQuerySchema } from "../schemas/admin.dto";
import { adminService } from "../services/admin.service";
import { userProvisioningService } from "../services/user-provisioning";

export const adminRoutes = new Elysia({ prefix: "/admin" })
  .get("/users", async ({ query, request, status }) => {
    const auth = await authorizeAdmin(request);
    if (!auth.success) return status(auth.failure.status, auth.failure.error);

    return adminService.getUsers(query);
  }, {
    query: UserQuerySchema,
    detail: {
      summary: "Daftar Pengguna Sistem",
      description: "Mengambil daftar seluruh pengguna (karyawan dan admin) dengan pagination, pencarian nama/email, serta filter status dan jenis akun. Memerlukan sesi admin dengan hak admin.manage.",
      tags: ["Admin"],
      operationId: "getAdminUsers",
      security: [{ adminSession: [] }],
      responses: {
        200: {
          description: "Daftar pengguna berhasil diambil",
          content: { "application/json": { schema: { $ref: "#/components/schemas/UserListResponse" } } }
        },
        401: {
          description: "Sesi admin tidak ada atau belum login",
          content: { "application/json": { schema: { $ref: "#/components/schemas/UnauthorizedError" } } }
        },
        403: {
          description: "Akun admin tidak memiliki hak admin.manage",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ForbiddenError" } } }
        },
        422: {
          description: "Parameter query pagination atau filter tidak valid",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } }
        }
      }
    }
  })
  .post("/users", async ({ body, request, status }) => {
    const auth = await authorizeAdmin(request);
    if (!auth.success) return status(auth.failure.status, auth.failure.error);

    const result = await userProvisioningService.createEmployee(body, auth.admin.id);
    if ("error" in result) {
      return status(result.error.status, { code: result.error.code, message: result.error.message });
    }

    return status(201, { data: result.user });
  }, {
    body: CreateUserSchema,
    detail: {
      summary: "Buat Akun Karyawan Baru",
      description: "Membuat akun karyawan baru secara atomik bersama identitas Better Auth, penugasan role, dan pencatatan audit log. Memerlukan sesi admin dengan hak admin.manage.",
      tags: ["Admin"],
      operationId: "createAdminUser",
      security: [{ adminSession: [] }],
      responses: {
        201: {
          description: "Pengguna karyawan baru berhasil dibuat",
          content: { "application/json": { schema: { $ref: "#/components/schemas/UserDetailResponse" } } }
        },
        400: {
          description: "Format input salah atau roleId tidak ditemukan",
          content: { "application/json": { schema: { $ref: "#/components/schemas/BadRequestError" } } }
        },
        401: {
          description: "Sesi admin tidak ada atau belum login",
          content: { "application/json": { schema: { $ref: "#/components/schemas/UnauthorizedError" } } }
        },
        403: {
          description: "Akun admin tidak memiliki hak admin.manage, atau mencoba memberikan hak admin pada karyawan",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ForbiddenError" } } }
        },
        409: {
          description: "Email sudah terdaftar dalam sistem",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ConflictError" } } }
        },
        422: {
          description: "Validasi skema gagal (misal: password kurang dari 12 karakter atau email tidak valid)",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } }
        }
      }
    }
  })
  .get("/users/:id", async ({ params, request, status }) => {
    const auth = await authorizeAdmin(request);
    if (!auth.success) return status(auth.failure.status, auth.failure.error);

    const targetId = Number(params.id);
    if (targetId <= 0 || !Number.isInteger(targetId)) {
      return status(404, { code: "USER_NOT_FOUND", message: "Pengguna tidak ditemukan." });
    }

    const user = await adminService.getUserById(targetId);
    if (!user) {
      return status(404, { code: "USER_NOT_FOUND", message: "Pengguna tidak ditemukan." });
    }

    return { data: user };
  }, {
    params: t.Object({ id: t.Numeric({ description: "ID pengguna internal MKN" }) }),
    detail: {
      summary: "Detail Pengguna Sistem",
      description: "Mengambil detail satu pengguna beserta daftar role yang dimiliki. Memerlukan sesi admin dengan hak admin.manage.",
      tags: ["Admin"],
      operationId: "getAdminUserById",
      security: [{ adminSession: [] }],
      responses: {
        200: {
          description: "Detail pengguna berhasil diambil",
          content: { "application/json": { schema: { $ref: "#/components/schemas/UserDetailResponse" } } }
        },
        401: {
          description: "Sesi admin tidak ada atau belum login",
          content: { "application/json": { schema: { $ref: "#/components/schemas/UnauthorizedError" } } }
        },
        403: {
          description: "Akun admin tidak memiliki hak admin.manage",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ForbiddenError" } } }
        },
        404: {
          description: "Pengguna dengan ID target tidak ditemukan",
          content: { "application/json": { schema: { $ref: "#/components/schemas/NotFoundError" } } }
        }
      }
    }
  })
  .patch("/users/:id", async ({ params, body, request, status }) => {
    const auth = await authorizeAdmin(request);
    if (!auth.success) return status(auth.failure.status, auth.failure.error);

    const targetId = Number(params.id);
    if (targetId <= 0 || !Number.isInteger(targetId)) {
      return status(404, { code: "USER_NOT_FOUND", message: "Pengguna tidak ditemukan." });
    }

    const result = await adminService.updateUserProfile(targetId, body, body as Record<string, unknown>, auth.admin.id);
    if ("error" in result) {
      return status(result.error.status, { code: result.error.code, message: result.error.message });
    }

    return { data: result.user };
  }, {
    params: t.Object({ id: t.Numeric({ description: "ID pengguna internal MKN" }) }),
    body: UpdateUserProfileSchema,
    detail: {
      summary: "Perbarui Profil Pengguna",
      description: "Memperbarui nama dan/atau email pengguna dengan sinkronisasi atomik ke tabel auth_user. Jika email berubah, seluruh sesi aktif pengguna dicabut.",
      tags: ["Admin"],
      operationId: "updateAdminUserProfile",
      security: [{ adminSession: [] }],
      responses: {
        200: {
          description: "Profil berhasil diperbarui",
          content: { "application/json": { schema: { $ref: "#/components/schemas/UserDetailResponse" } } }
        },
        400: {
          description: "Field terlarang disertakan atau body kosong",
          content: { "application/json": { schema: { $ref: "#/components/schemas/BadRequestError" } } }
        },
        401: {
          description: "Sesi admin tidak ada atau belum login",
          content: { "application/json": { schema: { $ref: "#/components/schemas/UnauthorizedError" } } }
        },
        403: {
          description: "Mencoba mengubah profil akun administrator atau CSRF tidak valid",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ForbiddenError" } } }
        },
        404: {
          description: "Pengguna tidak ditemukan",
          content: { "application/json": { schema: { $ref: "#/components/schemas/NotFoundError" } } }
        },
        409: {
          description: "Email baru sudah digunakan oleh akun lain",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ConflictError" } } }
        },
        422: {
          description: "Validasi format email atau panjang nama gagal",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } }
        }
      }
    }
  })
  .get("/roles", async ({ request, status }) => {
    const auth = await authorizeAdmin(request);
    if (!auth.success) return status(auth.failure.status, auth.failure.error);

    const data = await adminService.getRoles();
    return { data };
  }, {
    detail: {
      summary: "Daftar Role dan Permission",
      description: "Mengambil daftar seluruh role dan permission yang terdaftar dalam sistem RBAC. Memerlukan sesi admin dengan hak admin.manage.",
      tags: ["Admin"],
      operationId: "getAdminRoles",
      security: [{ adminSession: [] }],
      responses: {
        200: {
          description: "Daftar role berhasil diambil",
          content: { "application/json": { schema: { $ref: "#/components/schemas/RoleListResponse" } } }
        },
        401: {
          description: "Sesi admin tidak ada atau belum login",
          content: { "application/json": { schema: { $ref: "#/components/schemas/UnauthorizedError" } } }
        },
        403: {
          description: "Akun admin tidak memiliki hak admin.manage",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ForbiddenError" } } }
        }
      }
    }
  })
  .patch("/users/:id/roles", async ({ params, body, request, status }) => {
    const auth = await authorizeAdmin(request);
    if (!auth.success) return status(auth.failure.status, auth.failure.error);

    const result = await adminService.updateUserRoles(Number(params.id), body.roleIds, auth.admin.id, auth.admin.permissions);
    if ("error" in result) {
      return status(result.error.status, { code: result.error.code, message: result.error.message });
    }
    return { success: true };
  }, {
    params: t.Object({ id: t.Numeric({ description: "ID pengguna MKN" }) }),
    body: t.Object({ roleIds: t.Array(t.Integer(), { description: "Daftar ID role yang diberikan" }) }),
    detail: {
      summary: "Perbarui Role Pengguna",
      description: "Mengganti daftar role yang dimiliki pengguna target. Memerlukan sesi admin dengan hak admin.manage.",
      tags: ["Admin"],
      operationId: "updateUserRoles",
      security: [{ adminSession: [] }],
      responses: {
        200: {
          description: "Role pengguna berhasil diperbarui",
          content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } }
        },
        400: {
          description: "Satu atau lebih roleId tidak valid atau tidak ditemukan di database",
          content: { "application/json": { schema: { $ref: "#/components/schemas/BadRequestError" } } }
        },
        401: {
          description: "Sesi admin tidak ada atau belum login",
          content: { "application/json": { schema: { $ref: "#/components/schemas/UnauthorizedError" } } }
        },
        403: {
          description: "Akun admin tidak memiliki hak admin.manage, mencoba mencabut hak admin sendiri, atau Origin CSRF tidak valid",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ForbiddenError" } } }
        },
        404: {
          description: "Pengguna dengan ID target tidak ditemukan",
          content: { "application/json": { schema: { $ref: "#/components/schemas/NotFoundError" } } }
        }
      }
    }
  })
  .patch("/users/:id/status", async ({ params, body, request, status }) => {
    const auth = await authorizeAdmin(request);
    if (!auth.success) return status(auth.failure.status, auth.failure.error);

    const result = await adminService.updateUserStatus(Number(params.id), body.isActive, auth.admin.id, auth.admin.permissions);
    if ("error" in result) {
      return status(result.error.status, { code: result.error.code, message: result.error.message });
    }
    return { success: true };
  }, {
    params: t.Object({ id: t.Numeric({ description: "ID pengguna MKN" }) }),
    body: t.Object({ isActive: t.Boolean({ description: "Status aktif akun (true untuk aktif, false untuk nonaktif)" }) }),
    detail: {
      summary: "Perbarui Status Aktif Pengguna",
      description: "Mengubah status aktif/nonaktif akun pengguna dan mencabut sesi jika dinonaktifkan. Memerlukan sesi admin dengan hak admin.manage.",
      tags: ["Admin"],
      operationId: "updateUserStatus",
      security: [{ adminSession: [] }],
      responses: {
        200: {
          description: "Status aktif pengguna berhasil diubah",
          content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } }
        },
        401: {
          description: "Sesi admin tidak ada atau belum login",
          content: { "application/json": { schema: { $ref: "#/components/schemas/UnauthorizedError" } } }
        },
        403: {
          description: "Mencoba menonaktifkan akun sendiri, menonaktifkan admin terakhir, atau Origin CSRF tidak valid",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ForbiddenError" } } }
        },
        404: {
          description: "Pengguna dengan ID target tidak ditemukan",
          content: { "application/json": { schema: { $ref: "#/components/schemas/NotFoundError" } } }
        }
      }
    }
  })
  .post("/users/:id/revoke-sessions", async ({ params, request, status }) => {
    const auth = await authorizeAdmin(request);
    if (!auth.success) return status(auth.failure.status, auth.failure.error);

    const targetId = Number(params.id);
    if (targetId <= 0 || !Number.isInteger(targetId)) {
      return status(404, { code: "USER_NOT_FOUND", message: "Pengguna tidak ditemukan." });
    }

    const result = await adminService.revokeUserSessions(targetId, auth.admin.id, auth.admin.permissions);
    if ("error" in result) {
      return status(result.error.status, { code: result.error.code, message: result.error.message });
    }

    return { success: true };
  }, {
    params: t.Object({ id: t.Numeric({ description: "ID pengguna MKN" }) }),
    detail: {
      summary: "Cabut Sesi Pengguna",
      description: "Mencabut seluruh sesi aktif pengguna tanpa menonaktifkan akun. Pengguna wajib login ulang.",
      tags: ["Admin"],
      operationId: "revokeAdminUserSessions",
      security: [{ adminSession: [] }],
      responses: {
        200: {
          description: "Seluruh sesi pengguna berhasil dicabut",
          content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } }
        },
        401: {
          description: "Sesi admin tidak ada atau belum login",
          content: { "application/json": { schema: { $ref: "#/components/schemas/UnauthorizedError" } } }
        },
        403: {
          description: "Akun admin tidak memiliki hak admin.manage atau Origin CSRF tidak valid",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ForbiddenError" } } }
        },
        404: {
          description: "Pengguna dengan ID target tidak ditemukan",
          content: { "application/json": { schema: { $ref: "#/components/schemas/NotFoundError" } } }
        }
      }
    }
  });
