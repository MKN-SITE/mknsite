import { asc, eq } from "drizzle-orm";
import { db } from "../db";
import { auditLogs, menus } from "../db/schema";
import {
  mapMenuSummary,
  type CreateMenuDto,
  type MenuSummaryDto,
  type UpdateMenuDto
} from "../schemas/menu.dto";

export class MenuService {
  async getMenusForUser(userPermissions: string[]): Promise<MenuSummaryDto[]> {
    const rows = await db
      .select()
      .from(menus)
      .where(eq(menus.isActive, 1))
      .orderBy(asc(menus.sortOrder), asc(menus.id));

    const permissionSet = new Set(userPermissions);

    const allowedRows = rows.filter((menu) => {
      if (!menu.requiredPermission || menu.requiredPermission.trim() === "") {
        return true;
      }
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

  async getMenuById(id: number): Promise<MenuSummaryDto | null> {
    const [row] = await db
      .select()
      .from(menus)
      .where(eq(menus.id, id))
      .limit(1);

    if (!row) return null;
    return mapMenuSummary(row);
  }

  async createMenu(data: CreateMenuDto, adminId: number): Promise<MenuSummaryDto> {
    const [inserted] = await db.insert(menus).values({
      title: data.title.trim(),
      icon: data.icon ? data.icon.trim() : null,
      description: data.description ? data.description.trim() : null,
      url: data.url ? data.url.trim() : null,
      requiredPermission: data.requiredPermission ? data.requiredPermission.trim() : null,
      sortOrder: data.sortOrder ?? 0,
      isActive: data.isActive !== undefined ? (data.isActive ? 1 : 0) : 1,
      badgeCount: data.badgeCount ?? 0,
      badgeColor: data.badgeColor ? data.badgeColor.trim() : "orange",
      createdBy: adminId
    });

    const newId = Number(inserted.insertId);

    await db.insert(auditLogs).values({
      actorId: adminId,
      action: "menu.created",
      resource: "menu",
      resourceId: String(newId)
    });

    const created = await this.getMenuById(newId);
    return created!;
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
    if (data.url !== undefined) updatePayload.url = data.url ? data.url.trim() : null;
    if (data.requiredPermission !== undefined) {
      updatePayload.requiredPermission = data.requiredPermission ? data.requiredPermission.trim() : null;
    }
    if (data.sortOrder !== undefined) updatePayload.sortOrder = data.sortOrder;
    if (data.isActive !== undefined) updatePayload.isActive = data.isActive ? 1 : 0;
    if (data.badgeCount !== undefined) updatePayload.badgeCount = data.badgeCount;
    if (data.badgeColor !== undefined) {
      updatePayload.badgeColor = data.badgeColor ? data.badgeColor.trim() : "orange";
    }

    if (Object.keys(updatePayload).length > 0) {
      await db.update(menus).set(updatePayload).where(eq(menus.id, id));

      await db.insert(auditLogs).values({
        actorId: adminId,
        action: "menu.updated",
        resource: "menu",
        resourceId: String(id)
      });
    }

    const updated = await this.getMenuById(id);
    return updated!;
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

    await db.delete(menus).where(eq(menus.id, id));

    await db.insert(auditLogs).values({
      actorId: adminId,
      action: "menu.deleted",
      resource: "menu",
      resourceId: String(id)
    });

    return { success: true };
  }
}

export const menuService = new MenuService();
