import { and, desc, eq, gte, like, lte, or, sql } from "drizzle-orm";
import { db } from "../db";
import { opsTelcoInspections, users } from "../db/schema";

export type InspectionCategory = "tools" | "apd" | "tangga" | "padlock";
export type InspectionCondition = "baik" | "rusak_ringan" | "rusak_berat" | "hilang";

export interface CreateInspectionDto {
  category: string;
  inspectionDate: string; // YYYY-MM-DD
  itemName: string;
  itemCondition?: string;
  location?: string;
  notes?: string;
  actionTaken?: string;
  photos?: string[]; // Array of image URLs
}

export interface UpdateInspectionDto {
  category?: string;
  inspectionDate?: string;
  itemName?: string;
  itemCondition?: string;
  location?: string;
  notes?: string;
  actionTaken?: string;
  photos?: string[];
}

export interface GetInspectionsFilter {
  category?: string;
  itemCondition?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export class OpsTelcoInspectionsService {
  async getInspections(filter: GetInspectionsFilter = {}) {
    const limit = Math.min(Math.max(filter.limit ?? 100, 1), 500);
    const offset = Math.max(filter.offset ?? 0, 0);
    const conditions: any[] = [];

    if (filter.category && filter.category !== "all") {
      conditions.push(eq(opsTelcoInspections.category, filter.category));
    }

    if (filter.itemCondition && filter.itemCondition !== "all") {
      conditions.push(eq(opsTelcoInspections.itemCondition, filter.itemCondition));
    }

    if (filter.startDate) {
      conditions.push(gte(opsTelcoInspections.inspectionDate, filter.startDate));
    }

    if (filter.endDate) {
      conditions.push(lte(opsTelcoInspections.inspectionDate, filter.endDate));
    }

    if (filter.search) {
      const term = `%${filter.search}%`;
      conditions.push(
        or(
          like(opsTelcoInspections.itemName, term),
          like(opsTelcoInspections.location, term),
          like(opsTelcoInspections.notes, term),
          like(opsTelcoInspections.actionTaken, term),
          like(users.name, term),
          like(users.kpcId, term)
        )
      );
    }

    const rows = await db
      .select({
        id: opsTelcoInspections.id,
        category: opsTelcoInspections.category,
        inspectionDate: opsTelcoInspections.inspectionDate,
        itemName: opsTelcoInspections.itemName,
        itemCondition: opsTelcoInspections.itemCondition,
        location: opsTelcoInspections.location,
        notes: opsTelcoInspections.notes,
        actionTaken: opsTelcoInspections.actionTaken,
        photos: opsTelcoInspections.photos,
        inspectedBy: opsTelcoInspections.inspectedBy,
        createdAt: opsTelcoInspections.createdAt,
        updatedAt: opsTelcoInspections.updatedAt,
        inspectorName: users.name,
        inspectorKpcId: users.kpcId,
        inspectorDivision: users.division,
        inspectorAvatar: users.avatarUrl
      })
      .from(opsTelcoInspections)
      .leftJoin(users, eq(opsTelcoInspections.inspectedBy, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(opsTelcoInspections.inspectionDate), desc(opsTelcoInspections.id))
      .limit(limit)
      .offset(offset);

    return rows.map((r) => {
      let parsedPhotos: string[] = [];
      if (r.photos) {
        try {
          parsedPhotos = JSON.parse(r.photos);
        } catch {
          parsedPhotos = [];
        }
      }
      return {
        ...r,
        photos: parsedPhotos
      };
    });
  }

  async getInspectionById(id: number) {
    const [row] = await db
      .select({
        id: opsTelcoInspections.id,
        category: opsTelcoInspections.category,
        inspectionDate: opsTelcoInspections.inspectionDate,
        itemName: opsTelcoInspections.itemName,
        itemCondition: opsTelcoInspections.itemCondition,
        location: opsTelcoInspections.location,
        notes: opsTelcoInspections.notes,
        actionTaken: opsTelcoInspections.actionTaken,
        photos: opsTelcoInspections.photos,
        inspectedBy: opsTelcoInspections.inspectedBy,
        createdAt: opsTelcoInspections.createdAt,
        updatedAt: opsTelcoInspections.updatedAt,
        inspectorName: users.name,
        inspectorKpcId: users.kpcId,
        inspectorDivision: users.division,
        inspectorAvatar: users.avatarUrl
      })
      .from(opsTelcoInspections)
      .leftJoin(users, eq(opsTelcoInspections.inspectedBy, users.id))
      .where(eq(opsTelcoInspections.id, id))
      .limit(1);

    if (!row) return null;

    let parsedPhotos: string[] = [];
    if (row.photos) {
      try {
        parsedPhotos = JSON.parse(row.photos);
      } catch {
        parsedPhotos = [];
      }
    }

    return {
      ...row,
      photos: parsedPhotos
    };
  }

  async createInspection(userId: number, dto: CreateInspectionDto) {
    const photosJson = JSON.stringify(dto.photos || []);

    const [result] = await db.insert(opsTelcoInspections).values({
      category: dto.category.toLowerCase().trim(),
      inspectionDate: dto.inspectionDate,
      itemName: dto.itemName.trim(),
      itemCondition: dto.itemCondition || "baik",
      location: dto.location ? dto.location.trim() : null,
      notes: dto.notes ? dto.notes.trim() : null,
      actionTaken: dto.actionTaken ? dto.actionTaken.trim() : null,
      photos: photosJson,
      inspectedBy: userId
    });

    const insertId = result.insertId;
    return this.getInspectionById(insertId);
  }

  async updateInspection(id: number, dto: UpdateInspectionDto) {
    const values: Record<string, any> = {};
    if (dto.category !== undefined) values.category = dto.category.toLowerCase().trim();
    if (dto.inspectionDate !== undefined) values.inspectionDate = dto.inspectionDate;
    if (dto.itemName !== undefined) values.itemName = dto.itemName.trim();
    if (dto.itemCondition !== undefined) values.itemCondition = dto.itemCondition;
    if (dto.location !== undefined) values.location = dto.location.trim();
    if (dto.notes !== undefined) values.notes = dto.notes.trim();
    if (dto.actionTaken !== undefined) values.actionTaken = dto.actionTaken.trim();
    if (dto.photos !== undefined) values.photos = JSON.stringify(dto.photos);

    if (Object.keys(values).length > 0) {
      await db.update(opsTelcoInspections).set(values).where(eq(opsTelcoInspections.id, id));
    }

    return this.getInspectionById(id);
  }

  async deleteInspection(id: number) {
    await db.delete(opsTelcoInspections).where(eq(opsTelcoInspections.id, id));
    return { success: true };
  }

  async getInspectionStats() {
    const rows = await db
      .select({
        category: opsTelcoInspections.category,
        itemCondition: opsTelcoInspections.itemCondition,
        count: sql<number>`count(*)`
      })
      .from(opsTelcoInspections)
      .groupBy(opsTelcoInspections.category, opsTelcoInspections.itemCondition);

    const stats = {
      total: 0,
      byCategory: {
        tools: 0,
        "special-tools": 0,
        "genset-tools": 0,
        apd: 0,
        "double-lanyard": 0,
        "full-body-harness": 0,
        katrol: 0,
        padlock: 0,
        "pole-harness": 0,
        "single-lanyard": 0,
        "tali-karmantle": 0,
        tangga: 0
      } as Record<string, number>,
      byCondition: {
        baik: 0,
        rusak_ringan: 0,
        rusak_berat: 0,
        hilang: 0
      } as Record<string, number>
    };

    for (const r of rows) {
      const cnt = Number(r.count);
      stats.total += cnt;
      if (!stats.byCategory[r.category]) {
        stats.byCategory[r.category] = 0;
      }
      stats.byCategory[r.category] += cnt;

      if (stats.byCondition[r.itemCondition] !== undefined) {
        stats.byCondition[r.itemCondition] += cnt;
      }
    }

    return stats;
  }
}

export const opsTelcoInspectionsService = new OpsTelcoInspectionsService();
