import { Elysia, t } from "elysia";
import { getAuthenticatedProfile } from "../auth/auth";
import { authorizeAdmin } from "../guards/admin.guard";
import { publishAdminMenusUpdated } from "../realtime/hub";
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

      const data = await menuService.getMenusForUser(user.permissions, user.roles);
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
          if ("error" in created) {
            return status(created.error.status, {
              code: created.error.code,
              message: created.error.message
            });
          }

          publishAdminMenusUpdated();
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
              409: {
                description: "URL menu sudah digunakan oleh menu lain",
                content: { "application/json": { schema: { $ref: "#/components/schemas/ConflictError" } } }
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

          publishAdminMenusUpdated();
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
              409: {
                description: "URL menu sudah digunakan oleh menu lain",
                content: { "application/json": { schema: { $ref: "#/components/schemas/ConflictError" } } }
              },
              422: {
                description: "Validasi format data gagal",
                content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } }
              }
            }
          }
        }
      )
      .post(
        "/upload-icon",
        async ({ request, status }) => {
          const auth = await authorizeAdmin(request);
          if (!auth.success) return status(auth.failure.status, auth.failure.error);

          const contentType = request.headers.get("content-type") || "";
          let iconUrl = "";

          const fs = await import("fs");
          const path = await import("path");
          const uploadDir = path.resolve("uploads/icons");
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }

          if (contentType.includes("multipart/form-data")) {
            const formData = await request.formData();
            const file = formData.get("file") || formData.get("icon");
            if (!file || !(file instanceof Blob)) {
              return status(400, { code: "INVALID_FILE", message: "File gambar/SVG tidak ditemukan dalam permintaan." });
            }
            if (file.size > 2 * 1024 * 1024) {
              return status(400, { code: "FILE_TOO_LARGE", message: "Ukuran file icon maksimal 2 MB." });
            }
            const mime = file.type || "";
            let ext = "png";
            if (mime.includes("svg") || (file instanceof File && file.name.endsWith(".svg"))) {
              ext = "svg";
            } else if (mime.includes("webp")) {
              ext = "webp";
            } else if (mime.includes("jpeg") || mime.includes("jpg")) {
              ext = "jpg";
            }

            const filename = `icon-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
            const filePath = `uploads/icons/${filename}`;
            const arrayBuffer = await file.arrayBuffer();
            await Bun.write(filePath, arrayBuffer);
            iconUrl = `/uploads/icons/${filename}`;
          } else if (contentType.includes("application/json")) {
            const json = (await request.json().catch(() => ({}))) as Record<string, any>;
            if (typeof json.iconUrl === "string") {
              iconUrl = json.iconUrl;
            } else if (typeof json.dataUrl === "string" && (json.dataUrl.startsWith("data:image/") || json.dataUrl.startsWith("data:image/svg+xml"))) {
              const matches = json.dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
              if (matches && matches.length === 3) {
                const mimeType = matches[1];
                const base64Data = matches[2];
                const buffer = Buffer.from(base64Data, "base64");
                if (buffer.length > 2 * 1024 * 1024) {
                  return status(400, { code: "FILE_TOO_LARGE", message: "Ukuran icon maksimal 2 MB." });
                }
                const ext = mimeType.includes("svg") ? "svg" : mimeType.includes("webp") ? "webp" : mimeType.includes("png") ? "png" : "jpg";
                const filename = `icon-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
                const filePath = `uploads/icons/${filename}`;
                await Bun.write(filePath, buffer);
                iconUrl = `/uploads/icons/${filename}`;
              } else if (json.dataUrl.startsWith("data:image/svg+xml;utf8,") || json.dataUrl.startsWith("data:image/svg+xml,")) {
                const rawSvg = decodeURIComponent(json.dataUrl.replace(/^data:image\/svg\+xml(;utf8)?,/, ""));
                const filename = `icon-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.svg`;
                const filePath = `uploads/icons/${filename}`;
                await Bun.write(filePath, rawSvg);
                iconUrl = `/uploads/icons/${filename}`;
              } else {
                return status(400, { code: "INVALID_IMAGE_DATA", message: "Format data gambar base64 tidak valid." });
              }
            } else if (typeof json.svg === "string" && json.svg.trim().startsWith("<svg")) {
              const filename = `icon-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.svg`;
              const filePath = `uploads/icons/${filename}`;
              await Bun.write(filePath, json.svg.trim());
              iconUrl = `/uploads/icons/${filename}`;
            } else {
              return status(400, { code: "INVALID_BODY", message: "File, data URL, atau kode SVG diperlukan." });
            }
          } else {
            return status(400, { code: "UNSUPPORTED_MEDIA_TYPE", message: "Content-Type harus multipart/form-data atau application/json." });
          }

          return { data: { iconUrl } };
        },
        {
          detail: {
            summary: "Unggah Icon Menu Custom",
            description: "Mengunggah file gambar (PNG, SVG, WebP, JPG) atau kode SVG untuk digunakan sebagai icon menu portal.",
            tags: ["Menus"],
            operationId: "uploadMenuIcon",
            security: [{ adminSession: [] }]
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

          publishAdminMenusUpdated();
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
