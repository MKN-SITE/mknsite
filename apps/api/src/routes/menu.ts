import { Elysia, t } from "elysia";
import { getAuthenticatedProfile } from "../auth/auth";
import { authorizeAdmin } from "../guards/admin.guard";
import { CreateMenuSchema, UpdateMenuSchema } from "../schemas/menu.dto";
import { menuService } from "../services/menu.service";

export const menuRoutes = new Elysia()
  .get(
    "/menus",
    async ({ request, status }) => {
      let user = await getAuthenticatedProfile(request.headers, "employee");
      if (!user) {
        user = await getAuthenticatedProfile(request.headers, "admin");
      }

      if (!user) {
        return status(401, {
          code: "UNAUTHORIZED",
          message: "Sesi tidak valid atau belum login."
        });
      }

      const data = await menuService.getMenusForUser(user.permissions);
      return { data };
    },
    {
      detail: {
        summary: "Daftar Menu Karyawan Aktif",
        description:
          "Mengambil daftar menu portal yang aktif dan diizinkan berdasarkan permission pengguna yang sedang login.",
        tags: ["Menus"],
        operationId: "getEmployeeMenus",
        security: [{ employeeSession: [] }, { adminSession: [] }],
        responses: {
          200: {
            description: "Daftar menu berhasil diambil",
            content: { "application/json": { schema: { $ref: "#/components/schemas/MenuListResponse" } } }
          },
          401: {
            description: "Sesi tidak ada atau tidak valid",
            content: { "application/json": { schema: { $ref: "#/components/schemas/UnauthorizedError" } } }
          }
        }
      }
    }
  )
  .group("/admin/menus", (app) =>
    app
      .get(
        "",
        async ({ request, status }) => {
          const auth = await authorizeAdmin(request);
          if (!auth.success) return status(auth.failure.status, auth.failure.error);

          const data = await menuService.getAllMenus();
          return { data };
        },
        {
          detail: {
            summary: "Daftar Semua Menu (Admin)",
            description:
              "Mengambil seluruh menu portal baik aktif maupun nonaktif untuk keperluan manajemen admin.",
            tags: ["Menus"],
            operationId: "getAdminMenus",
            security: [{ adminSession: [] }],
            responses: {
              200: {
                description: "Seluruh menu berhasil diambil",
                content: { "application/json": { schema: { $ref: "#/components/schemas/MenuListResponse" } } }
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
        }
      )
      .post(
        "",
        async ({ request, body, status }) => {
          const auth = await authorizeAdmin(request);
          if (!auth.success) return status(auth.failure.status, auth.failure.error);

          const created = await menuService.createMenu(body, auth.admin.id);
          return status(201, { data: created });
        },
        {
          body: CreateMenuSchema,
          detail: {
            summary: "Buat Menu Baru",
            description: "Membuat item menu portal baru dan mencatat ke dalam audit log.",
            tags: ["Menus"],
            operationId: "createAdminMenu",
            security: [{ adminSession: [] }],
            responses: {
              201: {
                description: "Menu berhasil dibuat",
                content: { "application/json": { schema: { $ref: "#/components/schemas/MenuDetailResponse" } } }
              },
              401: {
                description: "Sesi admin tidak ada atau belum login",
                content: { "application/json": { schema: { $ref: "#/components/schemas/UnauthorizedError" } } }
              },
              403: {
                description: "Akun admin tidak memiliki hak admin.manage atau Origin tidak valid",
                content: { "application/json": { schema: { $ref: "#/components/schemas/ForbiddenError" } } }
              },
              422: {
                description: "Validasi format data gagal",
                content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } }
              }
            }
          }
        }
      )
      .patch(
        "/:id",
        async ({ request, params, body, status }) => {
          const auth = await authorizeAdmin(request);
          if (!auth.success) return status(auth.failure.status, auth.failure.error);

          const targetId = Number(params.id);
          if (targetId <= 0 || !Number.isInteger(targetId)) {
            return status(404, { code: "MENU_NOT_FOUND", message: "Menu tidak ditemukan." });
          }

          const result = await menuService.updateMenu(targetId, body, auth.admin.id);
          if ("error" in result) {
            return status(result.error.status, {
              code: result.error.code,
              message: result.error.message
            });
          }

          return { data: result };
        },
        {
          params: t.Object({ id: t.Numeric({ description: "ID menu" }) }),
          body: UpdateMenuSchema,
          detail: {
            summary: "Perbarui Menu",
            description: "Mengubah data menu portal dan mencatat ke dalam audit log.",
            tags: ["Menus"],
            operationId: "updateAdminMenu",
            security: [{ adminSession: [] }],
            responses: {
              200: {
                description: "Menu berhasil diperbarui",
                content: { "application/json": { schema: { $ref: "#/components/schemas/MenuDetailResponse" } } }
              },
              401: {
                description: "Sesi admin tidak ada atau belum login",
                content: { "application/json": { schema: { $ref: "#/components/schemas/UnauthorizedError" } } }
              },
              403: {
                description: "Akun admin tidak memiliki hak admin.manage atau Origin tidak valid",
                content: { "application/json": { schema: { $ref: "#/components/schemas/ForbiddenError" } } }
              },
              404: {
                description: "Menu tidak ditemukan",
                content: { "application/json": { schema: { $ref: "#/components/schemas/NotFoundError" } } }
              },
              422: {
                description: "Validasi format data gagal",
                content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } }
              }
            }
          }
        }
      )
      .delete(
        "/:id",
        async ({ request, params, status }) => {
          const auth = await authorizeAdmin(request);
          if (!auth.success) return status(auth.failure.status, auth.failure.error);

          const targetId = Number(params.id);
          if (targetId <= 0 || !Number.isInteger(targetId)) {
            return status(404, { code: "MENU_NOT_FOUND", message: "Menu tidak ditemukan." });
          }

          const result = await menuService.deleteMenu(targetId, auth.admin.id);
          if ("error" in result) {
            return status(result.error.status, {
              code: result.error.code,
              message: result.error.message
            });
          }

          return { success: true };
        },
        {
          params: t.Object({ id: t.Numeric({ description: "ID menu" }) }),
          detail: {
            summary: "Hapus Menu",
            description: "Menghapus item menu portal dari database dan mencatat ke audit log.",
            tags: ["Menus"],
            operationId: "deleteAdminMenu",
            security: [{ adminSession: [] }],
            responses: {
              200: {
                description: "Menu berhasil dihapus",
                content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } }
              },
              401: {
                description: "Sesi admin tidak ada atau belum login",
                content: { "application/json": { schema: { $ref: "#/components/schemas/UnauthorizedError" } } }
              },
              403: {
                description: "Akun admin tidak memiliki hak admin.manage atau Origin tidak valid",
                content: { "application/json": { schema: { $ref: "#/components/schemas/ForbiddenError" } } }
              },
              404: {
                description: "Menu tidak ditemukan",
                content: { "application/json": { schema: { $ref: "#/components/schemas/NotFoundError" } } }
              }
            }
          }
        }
      )
  );
