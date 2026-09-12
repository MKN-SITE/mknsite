import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { auditLogs, divisions, users } from "../db/schema";
import type { CreateDivisionDto, DivisionSummaryDto, UpdateDivisionDto } from "../schemas/division.dto";

export class DivisionServiceError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = "DivisionServiceError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class DivisionService {
  async getDivisions(): Promise<DivisionSummaryDto[]> {
    const allDivisions = await db.select().from(divisions).orderBy(divisions.name);

    // Hitung jumlah pengguna per divisi
    const userCounts = await db
      .select({
        division: users.division,
        count: sql<number>`count(*)`
      })
      .from(users)
      .where(sql`${users.division} IS NOT NULL`)
      .groupBy(users.division);

    const countMap = new Map<string, number>();
    for (const row of userCounts) {
      if (row.division) {
        countMap.set(row.division.toLowerCase(), Number(row.count));
      }
    }

    return allDivisions.map((div) => ({
      id: div.id,
      name: div.name,
      description: div.description,
      userCount: countMap.get(div.name.toLowerCase()) ?? 0,
      createdAt: div.createdAt.toISOString(),
      updatedAt: div.updatedAt.toISOString()
    }));
  }

  async getDivisionById(id: number): Promise<DivisionSummaryDto> {
    const [division] = await db.select().from(divisions).where(eq(divisions.id, id)).limit(1);
    if (!division) {
      throw new DivisionServiceError("DIVISION_NOT_FOUND", "Divisi tidak ditemukan.", 404);
    }

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.division, division.name));

    return {
      id: division.id,
      name: division.name,
      description: division.description,
      userCount: Number(countResult?.count ?? 0),
      createdAt: division.createdAt.toISOString(),
      updatedAt: division.updatedAt.toISOString()
    };
  }

  async createDivision(dto: CreateDivisionDto, actorId?: number, ipAddress?: string): Promise<DivisionSummaryDto> {
    const trimmedName = dto.name.trim();

    const [existing] = await db
      .select()
      .from(divisions)
      .where(sql`lower(${divisions.name}) = ${trimmedName.toLowerCase()}`)
      .limit(1);

    if (existing) {
      throw new DivisionServiceError("DUPLICATE_DIVISION", `Divisi dengan nama "${trimmedName}" sudah ada.`, 409);
    }

    const [result] = await db.insert(divisions).values({
      name: trimmedName,
      description: dto.description?.trim() || null
    });

    const newId = Number(result.insertId);

    if (actorId) {
      await db.insert(auditLogs).values({
        actorId,
        action: "division.created",
        resource: "division",
        resourceId: String(newId),
        ipAddress: ipAddress ?? null
      });
    }

    return this.getDivisionById(newId);
  }

  async updateDivision(
    id: number,
    dto: UpdateDivisionDto,
    actorId?: number,
    ipAddress?: string
  ): Promise<DivisionSummaryDto> {
    const [existing] = await db.select().from(divisions).where(eq(divisions.id, id)).limit(1);
    if (!existing) {
      throw new DivisionServiceError("DIVISION_NOT_FOUND", "Divisi tidak ditemukan.", 404);
    }

    const oldName = existing.name;
    const newName = dto.name !== undefined ? dto.name.trim() : oldName;
    const newDesc = dto.description !== undefined ? (dto.description?.trim() || null) : existing.description;

    if (newName.toLowerCase() !== oldName.toLowerCase()) {
      const [duplicate] = await db
        .select()
        .from(divisions)
        .where(sql`lower(${divisions.name}) = ${newName.toLowerCase()} AND ${divisions.id} != ${id}`)
        .limit(1);

      if (duplicate) {
        throw new DivisionServiceError("DUPLICATE_DIVISION", `Divisi dengan nama "${newName}" sudah ada.`, 409);
      }
    }

    // Jalankan update divisi dan cascading update ke users jika nama berubah
    await db.transaction(async (tx) => {
      await tx
        .update(divisions)
        .set({
          name: newName,
          description: newDesc
        })
        .where(eq(divisions.id, id));

      if (newName !== oldName) {
        await tx
          .update(users)
          .set({ division: newName })
          .where(eq(users.division, oldName));
      }
    });

    if (actorId) {
      await db.insert(auditLogs).values({
        actorId,
        action: "division.updated",
        resource: "division",
        resourceId: String(id),
        ipAddress: ipAddress ?? null
      });
    }

    return this.getDivisionById(id);
  }

  async deleteDivision(id: number, actorId?: number, ipAddress?: string): Promise<void> {
    const [existing] = await db.select().from(divisions).where(eq(divisions.id, id)).limit(1);
    if (!existing) {
      throw new DivisionServiceError("DIVISION_NOT_FOUND", "Divisi tidak ditemukan.", 404);
    }

    // Pastikan tidak ada pengguna aktif di divisi ini
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.division, existing.name));

    const userCount = Number(countResult?.count ?? 0);
    if (userCount > 0) {
      throw new DivisionServiceError(
        "DIVISION_IN_USE",
        `Divisi "${existing.name}" masih digunakan oleh ${userCount} pengguna. Pindahkan pengguna ke divisi lain terlebih dahulu.`,
        409
      );
    }

    await db.delete(divisions).where(eq(divisions.id, id));

    if (actorId) {
      await db.insert(auditLogs).values({
        actorId,
        action: "division.deleted",
        resource: "division",
        resourceId: String(id),
        ipAddress: ipAddress ?? null
      });
    }
  }
}

export const divisionService = new DivisionService();
