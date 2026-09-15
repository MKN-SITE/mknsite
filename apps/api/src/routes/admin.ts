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

    const result = await adminService.updateUserProfile(targetId, body, body as Record<string, unknown>, auth.admin.id, auth.admin.permissions);
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
  .delete("/users/:id", async ({ params, request, status }) => {
    const auth = await authorizeAdmin(request);
    if (!auth.success) return status(auth.failure.status, auth.failure.error);

    const targetId = Number(params.id);
    if (targetId <= 0 || !Number.isInteger(targetId)) {
      return status(404, { code: "USER_NOT_FOUND", message: "Pengguna tidak ditemukan." });
    }

    const result = await adminService.deleteUser(targetId, auth.admin.id, auth.admin.permissions);
    if ("error" in result) {
      return status(result.error.status, { code: result.error.code, message: result.error.message });
    }

    return { success: true };
  }, {
    params: t.Object({ id: t.Numeric({ description: "ID pengguna internal MKN" }) }),
    detail: {
      summary: "Hapus Pengguna Sistem",
      description: "Menghapus akun pengguna secara permanen, mencabut seluruh sesi aktif, dan mencatat audit log. Memerlukan hak admin.manage.",
      tags: ["Admin"],
      operationId: "deleteAdminUser",
      security: [{ adminSession: [] }]
    }
  })
  .post("/users/:id/avatar", async ({ params, request, status }) => {
    const auth = await authorizeAdmin(request);
    if (!auth.success) return status(auth.failure.status, auth.failure.error);

    const targetId = Number(params.id);
    if (targetId <= 0 || !Number.isInteger(targetId)) {
      return status(404, { code: "USER_NOT_FOUND", message: "Pengguna tidak ditemukan." });
    }

    const contentType = request.headers.get("content-type") || "";
    let avatarUrl = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") || formData.get("avatar");
      if (!file || !(file instanceof Blob)) {
        return status(400, { code: "INVALID_FILE", message: "File gambar tidak ditemukan dalam permintaan." });
      }
      if (file.size > 5 * 1024 * 1024) {
        return status(400, { code: "FILE_TOO_LARGE", message: "Ukuran file avatar maksimal 5 MB." });
      }
      const ext = file.type.includes("png") ? "png" : file.type.includes("webp") ? "webp" : "jpg";
      const filename = `avatar-${targetId}-${Date.now()}.${ext}`;
      const filePath = `uploads/avatars/${filename}`;
      const arrayBuffer = await file.arrayBuffer();
      await Bun.write(filePath, arrayBuffer);
      avatarUrl = `/uploads/avatars/${filename}`;
    } else if (contentType.includes("application/json")) {
      const json = (await request.json().catch(() => ({}))) as Record<string, any>;
      if (typeof json.avatarUrl === "string") {
        avatarUrl = json.avatarUrl;
      } else if (typeof json.dataUrl === "string" && json.dataUrl.startsWith("data:image/")) {
        const matches = json.dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
          return status(400, { code: "INVALID_IMAGE_DATA", message: "Format data gambar base64 tidak valid." });
        }
        const mimeType = matches[1];
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, "base64");
        if (buffer.length > 5 * 1024 * 1024) {
          return status(400, { code: "FILE_TOO_LARGE", message: "Ukuran gambar maksimal 5 MB." });
        }
        const ext = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
        const filename = `avatar-${targetId}-${Date.now()}.${ext}`;
        const filePath = `uploads/avatars/${filename}`;
        await Bun.write(filePath, buffer);
        avatarUrl = `/uploads/avatars/${filename}`;
      } else {
        return status(400, { code: "INVALID_BODY", message: "File atau data URL gambar diperlukan." });
      }
    } else {
      return status(400, { code: "UNSUPPORTED_MEDIA_TYPE", message: "Content-Type harus multipart/form-data atau application/json." });
    }

    const result = await adminService.updateUserProfile(targetId, { avatarUrl }, { avatarUrl }, auth.admin.id, auth.admin.permissions);
    if ("error" in result) {
      return status(result.error.status, { code: result.error.code, message: result.error.message });
    }

    return { data: result.user };
  }, {
    params: t.Object({ id: t.Numeric({ description: "ID pengguna internal MKN" }) }),
    detail: {
      summary: "Unggah Foto Profil Pengguna",
      description: "Mengunggah dan memperbarui foto profil pengguna.",
      tags: ["Admin"],
      operationId: "uploadAdminUserAvatar",
      security: [{ adminSession: [] }]
    }
  })
  .delete("/users/:id/avatar", async ({ params, request, status }) => {
    const auth = await authorizeAdmin(request);
    if (!auth.success) return status(auth.failure.status, auth.failure.error);

    const targetId = Number(params.id);
    if (targetId <= 0 || !Number.isInteger(targetId)) {
      return status(404, { code: "USER_NOT_FOUND", message: "Pengguna tidak ditemukan." });
    }

    const result = await adminService.updateUserProfile(targetId, { avatarUrl: null }, { avatarUrl: null }, auth.admin.id, auth.admin.permissions);
    if ("error" in result) {
      return status(result.error.status, { code: result.error.code, message: result.error.message });
    }

    return { data: result.user };
  }, {
    params: t.Object({ id: t.Numeric({ description: "ID pengguna internal MKN" }) }),
    detail: {
      summary: "Hapus Foto Profil Pengguna",
      description: "Menghapus foto profil pengguna (reset ke inisial).",
      tags: ["Admin"],
      operationId: "deleteAdminUserAvatar",
      security: [{ adminSession: [] }]
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
