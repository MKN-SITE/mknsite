import { and, asc, eq, isNull, ne } from "drizzle-orm";
import { db } from "../db";
import { auditLogs, menus, permissions } from "../db/schema";
import {
  mapMenuSummary,
  type CreateMenuDto,
  type MenuSummaryDto,
  type UpdateMenuDto
} from "../schemas/menu.dto";

/**
 * Melakukan normalisasi canonical URL menu:
 * 1. Trim spasi.
 * 2. Rute internal diawali garis miring.
 * 3. Hapus trailing slash, kecuali URL root "/".
 * 4. String kosong disimpan sebagai null.
 */
export function normalizeMenuUrl(url?: string | null): string | null {
  if (url === undefined || url === null) return null;
  let trimmed = url.trim();
  if (trimmed === "") return null;

  const isExternal = /^https?:\/\//i.test(trimmed);
  if (!isExternal) {
    if (!trimmed.startsWith("/")) {
      trimmed = "/" + trimmed;
    }
  }

  if (trimmed !== "/" && trimmed.endsWith("/")) {
    trimmed = trimmed.replace(/\/+$/, "");
  }

  return trimmed === "" ? null : trimmed;
}

export class MenuService {
  async getMenusForUser(userPermissions: string[], userRoles: string[] = []): Promise<MenuSummaryDto[]> {
    const rows = await db
      .select()
      .from(menus)
      .where(eq(menus.isActive, 1))
      .orderBy(asc(menus.sortOrder), asc(menus.id));

    const permissionSet = new Set(userPermissions);
    const roleSet = new Set(userRoles.map((r) => r.toLowerCase()));

    const isAdmin =
      permissionSet.has("admin.manage") ||
      roleSet.has("administrator") ||
      roleSet.has("superadmin");

    const isTelcoSupervisor =
      roleSet.has("ops-telco-supervisor") ||
      roleSet.has("supervisor ops telco");

    const allowedRows = rows.filter((menu) => {
      if (!menu.requiredPermission || menu.requiredPermission.trim() === "") {
        return true;
      }
      if (isAdmin) return true;
      if (isTelcoSupervisor && menu.requiredPermission.startsWith("ops_telco.")) return true;
      return permissionSet.has(menu.requiredPermission);
    });

    return allowedRows.map(mapMenuSummary);
  }

  async getAllMenus(): Promise<MenuSummaryDto[]> {
    const rows = await db
      .select()
      .from(menus)
      .orderBy(asc(menus.sortOrder), asc(menus.id));

    return rows.map(mapMenuSummary);
  }

  async getMenuById(id: number, executor: any = db): Promise<MenuSummaryDto | null> {
    const [row] = await executor
      .select()
      .from(menus)
      .where(eq(menus.id, id))
      .limit(1);

    if (!row) return null;
    return mapMenuSummary(row);
  }

  async createMenu(
    data: CreateMenuDto,
    adminId: number
  ): Promise<MenuSummaryDto | { error: { status: number; code: string; message: string } }> {
    const normalizedUrl = normalizeMenuUrl(data.url);
    const requiredPermission = data.requiredPermission ? data.requiredPermission.trim() : null;

    try {
      return await db.transaction(async (tx) => {
        // 1. Validasi duplikasi URL jika url tidak null
        if (normalizedUrl !== null) {
          const [duplicate] = await tx
            .select({ id: menus.id, title: menus.title })
            .from(menus)
            .where(eq(menus.url, normalizedUrl))
            .limit(1);

          if (duplicate) {
            return {
              error: {
                status: 409,
                code: "MENU_URL_EXISTS",
                message: `URL menu '${normalizedUrl}' sudah digunakan oleh menu lain.`
              }
            };
          }
        } else {
          // 1b. Validasi duplikasi judul untuk menu tanpa URL (null URL)
          const trimmedTitle = data.title.trim();
          const [duplicateTitle] = await tx
            .select({ id: menus.id })
            .from(menus)
            .where(and(isNull(menus.url), eq(menus.title, trimmedTitle)))
            .limit(1);

          if (duplicateTitle) {
            return {
              error: {
                status: 409,
                code: "MENU_TITLE_EXISTS",
                message: `Menu tanpa URL dengan judul '${trimmedTitle}' sudah ada.`
              }
            };
          }
        }

        // 2. Validasi keberadaan requiredPermission jika diisi
        if (requiredPermission !== null && requiredPermission !== "") {
          const [existingPerm] = await tx
            .select({ id: permissions.id })
            .from(permissions)
            .where(eq(permissions.slug, requiredPermission))
            .limit(1);

          if (!existingPerm) {
            return {
              error: {
                status: 400,
                code: "PERMISSION_NOT_FOUND",
                message: `Permission '${requiredPermission}' tidak ditemukan dalam sistem.`
              }
            };
          }
        }

        const [inserted] = await tx.insert(menus).values({
          title: data.title.trim(),
          icon: data.icon ? data.icon.trim() : null,
          description: data.description ? data.description.trim() : null,
          url: normalizedUrl,
          requiredPermission: requiredPermission !== "" ? requiredPermission : null,
          sortOrder: data.sortOrder ?? 0,
          isActive: data.isActive !== undefined ? (data.isActive ? 1 : 0) : 1,
          badgeCount: data.badgeCount ?? 0,
          badgeColor: data.badgeColor ? data.badgeColor.trim() : "orange",
          createdBy: adminId
        });

        const newId = Number(inserted.insertId);

        await tx.insert(auditLogs).values({
          actorId: adminId,
          action: "menu.created",
          resource: "menu",
          resourceId: String(newId)
        });

        const created = await this.getMenuById(newId, tx);
        return created!;
      });
    } catch (err: any) {
      if (
        err?.code === "ER_DUP_ENTRY" ||
        String(err?.message).includes("Duplicate entry") ||
        String(err?.message).includes("menus_url_unique")
      ) {
        return {
          error: {
            status: 409,
            code: "MENU_URL_EXISTS",
            message: "URL menu sudah digunakan oleh menu lain."
          }
        };
      }
      throw err;
    }
  }

  async updateMenu(
    id: number,
    data: UpdateMenuDto,
    adminId: number
  ): Promise<MenuSummaryDto | { error: { status: number; code: string; message: string } }> {
    const existing = await this.getMenuById(id);
    if (!existing) {
      return {
        error: {
          status: 404,
          code: "MENU_NOT_FOUND",
          message: "Menu tidak ditemukan."
        }
      };
    }

    const updatePayload: Record<string, any> = {};

    if (data.title !== undefined) updatePayload.title = data.title.trim();
    if (data.icon !== undefined) updatePayload.icon = data.icon ? data.icon.trim() : null;
    if (data.description !== undefined) {
      updatePayload.description = data.description ? data.description.trim() : null;
    }
    if (data.url !== undefined) {
      updatePayload.url = normalizeMenuUrl(data.url);
    }
    if (data.requiredPermission !== undefined) {
      const perm = data.requiredPermission ? data.requiredPermission.trim() : null;
      updatePayload.requiredPermission = perm !== "" ? perm : null;
    }
    if (data.sortOrder !== undefined) updatePayload.sortOrder = data.sortOrder;
    if (data.isActive !== undefined) updatePayload.isActive = data.isActive ? 1 : 0;
    if (data.badgeCount !== undefined) updatePayload.badgeCount = data.badgeCount;
    if (data.badgeColor !== undefined) {
      updatePayload.badgeColor = data.badgeColor ? data.badgeColor.trim() : "orange";
    }

    try {
      return await db.transaction(async (tx) => {
        // 1. Validasi duplikasi URL jika url diubah dan tidak null
        if (updatePayload.url !== undefined && updatePayload.url !== null) {
          const conflicting = await tx
            .select({ id: menus.id })
            .from(menus)
            .where(eq(menus.url, updatePayload.url))
            .limit(2);

          const isDuplicate = conflicting.some((m) => m.id !== id);
          if (isDuplicate) {
            return {
              error: {
                status: 409,
                code: "MENU_URL_EXISTS",
                message: `URL menu '${updatePayload.url}' sudah digunakan oleh menu lain.`
              }
            };
          }
        } else {
          // 1b. Jika URL efektif bernilai null, validasi keunikan judul terhadap menu tanpa URL lain
          const effectiveUrl = updatePayload.url !== undefined ? updatePayload.url : existing.url;
          if (effectiveUrl === null) {
            const effectiveTitle = (updatePayload.title !== undefined ? updatePayload.title : existing.title).trim();
            const [conflictingTitle] = await tx
              .select({ id: menus.id })
              .from(menus)
              .where(and(isNull(menus.url), eq(menus.title, effectiveTitle), ne(menus.id, id)))
              .limit(1);

            if (conflictingTitle) {
              return {
                error: {
                  status: 409,
                  code: "MENU_TITLE_EXISTS",
                  message: `Menu tanpa URL dengan judul '${effectiveTitle}' sudah ada.`
                }
              };
            }
          }
        }

        // 2. Validasi keberadaan requiredPermission jika diisi
        if (
          updatePayload.requiredPermission !== undefined &&
          updatePayload.requiredPermission !== null &&
          updatePayload.requiredPermission !== ""
        ) {
          const [existingPerm] = await tx
            .select({ id: permissions.id })
            .from(permissions)
            .where(eq(permissions.slug, updatePayload.requiredPermission))
            .limit(1);

          if (!existingPerm) {
            return {
              error: {
                status: 400,
                code: "PERMISSION_NOT_FOUND",
                message: `Permission '${updatePayload.requiredPermission}' tidak ditemukan dalam sistem.`
              }
            };
          }
        }

        if (Object.keys(updatePayload).length > 0) {
          await tx.update(menus).set(updatePayload).where(eq(menus.id, id));

          await tx.insert(auditLogs).values({
            actorId: adminId,
            action: "menu.updated",
            resource: "menu",
            resourceId: String(id)
          });
        }

        const updated = await this.getMenuById(id, tx);
        return updated!;
      });
    } catch (err: any) {
      if (
        err?.code === "ER_DUP_ENTRY" ||
        String(err?.message).includes("Duplicate entry") ||
        String(err?.message).includes("menus_url_unique")
      ) {
        return {
          error: {
            status: 409,
            code: "MENU_URL_EXISTS",
            message: "URL menu sudah digunakan oleh menu lain."
          }
        };
      }
      throw err;
    }
  }

  async deleteMenu(
    id: number,
    adminId: number
  ): Promise<{ success: boolean } | { error: { status: number; code: string; message: string } }> {
    const existing = await this.getMenuById(id);
    if (!existing) {
      return {
        error: {
          status: 404,
          code: "MENU_NOT_FOUND",
          message: "Menu tidak ditemukan."
        }
      };
    }

    await db.transaction(async (tx) => {
      await tx.delete(menus).where(eq(menus.id, id));

      await tx.insert(auditLogs).values({
        actorId: adminId,
        action: "menu.deleted",
        resource: "menu",
        resourceId: String(id)
      });
    });

    return { success: true };
  }
}

export const menuService = new MenuService();
