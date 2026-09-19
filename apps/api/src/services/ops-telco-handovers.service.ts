import { and, desc, eq, gte, like, lte, or } from "drizzle-orm";
import { db } from "../db";
import { opsTelcoHandovers, users } from "../db/schema";

export interface CreateHandoverDto {
  handoverDate: string; // YYYY-MM-DD
  description: string;
  photos?: string[]; // Array of image URLs
}

export interface UpdateHandoverDto {
  handoverDate?: string;
  description?: string;
  photos?: string[];
}

export interface GetHandoversFilter {
  search?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export class OpsTelcoHandoversService {
  async getHandovers(filter: GetHandoversFilter = {}) {
    const limit = Math.min(Math.max(filter.limit ?? 100, 1), 500);
    const offset = Math.max(filter.offset ?? 0, 0);
    const conditions: any[] = [];

    if (filter.search) {
      const term = `%${filter.search}%`;
      conditions.push(
        or(
          like(opsTelcoHandovers.description, term),
          like(users.name, term),
          like(users.kpcId, term)
        )
      );
    }

    if (filter.startDate) {
      conditions.push(gte(opsTelcoHandovers.handoverDate, filter.startDate));
    }

    if (filter.endDate) {
      conditions.push(lte(opsTelcoHandovers.handoverDate, filter.endDate));
    }

    const rows = await db
      .select({
        id: opsTelcoHandovers.id,
        handoverDate: opsTelcoHandovers.handoverDate,
        description: opsTelcoHandovers.description,
        photos: opsTelcoHandovers.photos,
        createdBy: opsTelcoHandovers.createdBy,
        createdAt: opsTelcoHandovers.createdAt,
        updatedAt: opsTelcoHandovers.updatedAt,
        creatorName: users.name,
        creatorKpcId: users.kpcId,
        creatorDivision: users.division,
        creatorAvatar: users.avatarUrl
      })
      .from(opsTelcoHandovers)
      .leftJoin(users, eq(opsTelcoHandovers.createdBy, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(opsTelcoHandovers.handoverDate), desc(opsTelcoHandovers.id))
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

  async getHandoverById(id: number) {
    const [row] = await db
      .select({
        id: opsTelcoHandovers.id,
        handoverDate: opsTelcoHandovers.handoverDate,
        description: opsTelcoHandovers.description,
        photos: opsTelcoHandovers.photos,
        createdBy: opsTelcoHandovers.createdBy,
        createdAt: opsTelcoHandovers.createdAt,
        updatedAt: opsTelcoHandovers.updatedAt,
        creatorName: users.name,
        creatorKpcId: users.kpcId,
        creatorDivision: users.division,
        creatorAvatar: users.avatarUrl
      })
      .from(opsTelcoHandovers)
      .leftJoin(users, eq(opsTelcoHandovers.createdBy, users.id))
      .where(eq(opsTelcoHandovers.id, id))
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

  async createHandover(userId: number, dto: CreateHandoverDto) {
    const photosJson = JSON.stringify(dto.photos || []);

    const [result] = await db.insert(opsTelcoHandovers).values({
      handoverDate: dto.handoverDate,
      description: dto.description,
      photos: photosJson,
      createdBy: userId
    });

    const insertId = result.insertId;
    return this.getHandoverById(insertId);
  }

  async updateHandover(id: number, dto: UpdateHandoverDto) {
    const values: Record<string, any> = {};
    if (dto.handoverDate !== undefined) values.handoverDate = dto.handoverDate;
    if (dto.description !== undefined) values.description = dto.description;
    if (dto.photos !== undefined) values.photos = JSON.stringify(dto.photos);

    if (Object.keys(values).length > 0) {
      await db.update(opsTelcoHandovers).set(values).where(eq(opsTelcoHandovers.id, id));
    }

    return this.getHandoverById(id);
  }

  async deleteHandover(id: number) {
    await db.delete(opsTelcoHandovers).where(eq(opsTelcoHandovers.id, id));
    return { success: true };
  }
}

export const opsTelcoHandoversService = new OpsTelcoHandoversService();
