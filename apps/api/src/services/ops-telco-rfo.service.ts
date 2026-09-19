import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { db } from "../db";
import {
  kpiCompanies,
  kpiDevices,
  kpiReportProblems,
  kpiReports,
  opsTelcoRfos,
  users
} from "../db/schema";
import { generateRfoPdf } from "./ops-telco-rfo-pdf.service";

export interface CreateRfoDto {
  ticketNumber?: string;
  problemId?: number | null;
  companyId?: number | null;
  deviceId?: number | null;
  rfoDate: string; // YYYY-MM-DD
  startTime: string; // e.g. "16 Mei 2026 13:20 WITA"
  endTime: string;   // e.g. "16 Mei 2026 17:35 WITA"
  cause: string;
  impact: string;
  solution: string;
  status: string;
  notes?: string | null;
}

export interface UpdateRfoDto {
  ticketNumber?: string;
  problemId?: number | null;
  companyId?: number | null;
  deviceId?: number | null;
  rfoDate?: string;
  startTime?: string;
  endTime?: string;
  cause?: string;
  impact?: string;
  solution?: string;
  status?: string;
  notes?: string | null;
}

export class OpsTelcoRfoService {
  /**
   * Auto-generate ticket number for a given date in YYYYMMDDXXX format
   * Example: "2026-05-16" -> "20260516001"
   */
  async generateTicketNumber(dateStr: string): Promise<string> {
    const rawDate = dateStr.replace(/-/g, "").slice(0, 8); // e.g. "20260516"
    const prefix = rawDate;

    const existing = await db
      .select({ ticketNumber: opsTelcoRfos.ticketNumber })
      .from(opsTelcoRfos)
      .where(like(opsTelcoRfos.ticketNumber, `${prefix}%`))
      .orderBy(desc(opsTelcoRfos.ticketNumber));

    let maxSeq = 0;
    for (const item of existing) {
      const seqStr = item.ticketNumber.replace(prefix, "").replace(/\D/g, "");
      const seq = parseInt(seqStr, 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }

    const nextSeq = String(maxSeq + 1).padStart(3, "0");
    return `${prefix}${nextSeq}`;
  }

  /**
   * Get all RFOs with related details
   */
  async getRfos(filters?: {
    problemId?: number;
    companyId?: number;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.min(Math.max(filters?.limit ?? 100, 1), 500);
    const offset = Math.max(filters?.offset ?? 0, 0);

    const query = db
      .select({
        id: opsTelcoRfos.id,
        ticketNumber: opsTelcoRfos.ticketNumber,
        problemId: opsTelcoRfos.problemId,
        companyId: opsTelcoRfos.companyId,
        deviceId: opsTelcoRfos.deviceId,
        rfoDate: opsTelcoRfos.rfoDate,
        startTime: opsTelcoRfos.startTime,
        endTime: opsTelcoRfos.endTime,
        cause: opsTelcoRfos.cause,
        impact: opsTelcoRfos.impact,
        solution: opsTelcoRfos.solution,
        status: opsTelcoRfos.status,
        notes: opsTelcoRfos.notes,
        createdBy: opsTelcoRfos.createdBy,
        createdAt: opsTelcoRfos.createdAt,
        updatedAt: opsTelcoRfos.updatedAt,
        companyName: kpiCompanies.name,
        deviceName: kpiDevices.deviceName,
        deviceLocation: kpiDevices.location,
        creatorName: users.name
      })
      .from(opsTelcoRfos)
      .leftJoin(kpiCompanies, eq(opsTelcoRfos.companyId, kpiCompanies.id))
      .leftJoin(kpiDevices, eq(opsTelcoRfos.deviceId, kpiDevices.id))
      .leftJoin(users, eq(opsTelcoRfos.createdBy, users.id))
      .orderBy(desc(opsTelcoRfos.rfoDate), desc(opsTelcoRfos.id));

    const conditions = [];

    if (filters?.problemId) {
      conditions.push(eq(opsTelcoRfos.problemId, filters.problemId));
    }
    if (filters?.companyId) {
      conditions.push(eq(opsTelcoRfos.companyId, filters.companyId));
    }
    if (filters?.search) {
      const term = `%${filters.search.trim()}%`;
      conditions.push(
        or(
          like(opsTelcoRfos.ticketNumber, term),
          like(opsTelcoRfos.cause, term),
          like(opsTelcoRfos.impact, term),
          like(opsTelcoRfos.solution, term),
          like(opsTelcoRfos.status, term)
        )
      );
    }

    const baseQuery = conditions.length > 0 ? query.where(and(...conditions)) : query;
    return baseQuery.limit(limit).offset(offset);
  }

  /**
   * Get single RFO by ID
   */
  async getRfoById(id: number) {
    const [rfo] = await db
      .select({
        id: opsTelcoRfos.id,
        ticketNumber: opsTelcoRfos.ticketNumber,
        problemId: opsTelcoRfos.problemId,
        companyId: opsTelcoRfos.companyId,
        deviceId: opsTelcoRfos.deviceId,
        rfoDate: opsTelcoRfos.rfoDate,
        startTime: opsTelcoRfos.startTime,
        endTime: opsTelcoRfos.endTime,
        cause: opsTelcoRfos.cause,
        impact: opsTelcoRfos.impact,
        solution: opsTelcoRfos.solution,
        status: opsTelcoRfos.status,
        notes: opsTelcoRfos.notes,
        createdBy: opsTelcoRfos.createdBy,
        createdAt: opsTelcoRfos.createdAt,
        updatedAt: opsTelcoRfos.updatedAt,
        companyName: kpiCompanies.name,
        deviceName: kpiDevices.deviceName,
        deviceLocation: kpiDevices.location,
        creatorName: users.name
      })
      .from(opsTelcoRfos)
      .leftJoin(kpiCompanies, eq(opsTelcoRfos.companyId, kpiCompanies.id))
      .leftJoin(kpiDevices, eq(opsTelcoRfos.deviceId, kpiDevices.id))
      .leftJoin(users, eq(opsTelcoRfos.createdBy, users.id))
      .where(eq(opsTelcoRfos.id, id))
      .limit(1);

    return rfo || null;
  }

  /**
   * Create RFO
   */
  async createRfo(userId: number, data: CreateRfoDto) {
    const ticketNumber = data.ticketNumber?.trim() || (await this.generateTicketNumber(data.rfoDate));

    // If problemId is provided, auto fill companyId and deviceId if not already set
    let resolvedCompanyId = data.companyId || null;
    let resolvedDeviceId = data.deviceId || null;

    if (data.problemId && (!resolvedCompanyId || !resolvedDeviceId)) {
      const [prob] = await db
        .select({
          deviceId: kpiReportProblems.deviceId,
          companyId: kpiReports.companyId
        })
        .from(kpiReportProblems)
        .leftJoin(kpiReports, eq(kpiReportProblems.reportId, kpiReports.id))
        .where(eq(kpiReportProblems.id, data.problemId))
        .limit(1);

      if (prob) {
        if (!resolvedDeviceId) resolvedDeviceId = prob.deviceId;
        if (!resolvedCompanyId) resolvedCompanyId = prob.companyId;
      }
    }

    const [res] = await db.insert(opsTelcoRfos).values({
      ticketNumber,
      problemId: data.problemId || null,
      companyId: resolvedCompanyId,
      deviceId: resolvedDeviceId,
      rfoDate: data.rfoDate,
      startTime: data.startTime.trim(),
      endTime: data.endTime.trim(),
      cause: data.cause.trim(),
      impact: data.impact.trim(),
      solution: data.solution.trim(),
      status: data.status.trim(),
      notes: data.notes?.trim() || null,
      createdBy: userId
    });

    return this.getRfoById(res.insertId);
  }

  /**
   * Update RFO
   */
  async updateRfo(id: number, data: UpdateRfoDto) {
    await db
      .update(opsTelcoRfos)
      .set({
        ...(data.ticketNumber !== undefined && { ticketNumber: data.ticketNumber.trim() }),
        ...(data.problemId !== undefined && { problemId: data.problemId }),
        ...(data.companyId !== undefined && { companyId: data.companyId }),
        ...(data.deviceId !== undefined && { deviceId: data.deviceId }),
        ...(data.rfoDate !== undefined && { rfoDate: data.rfoDate }),
        ...(data.startTime !== undefined && { startTime: data.startTime.trim() }),
        ...(data.endTime !== undefined && { endTime: data.endTime.trim() }),
        ...(data.cause !== undefined && { cause: data.cause.trim() }),
        ...(data.impact !== undefined && { impact: data.impact.trim() }),
        ...(data.solution !== undefined && { solution: data.solution.trim() }),
        ...(data.status !== undefined && { status: data.status.trim() }),
        ...(data.notes !== undefined && { notes: data.notes?.trim() || null })
      })
      .where(eq(opsTelcoRfos.id, id));

    return this.getRfoById(id);
  }

  /**
   * Delete RFO
   */
  async deleteRfo(id: number) {
    await db.delete(opsTelcoRfos).where(eq(opsTelcoRfos.id, id));
    return { success: true };
  }

  /**
   * Generate PDF buffer for given RFO ID
   */
  async generatePdfBuffer(id: number): Promise<{ buffer: Uint8Array; filename: string }> {
    const rfo = await this.getRfoById(id);
    if (!rfo) {
      throw new Error(`Data RFO dengan ID ${id} tidak ditemukan.`);
    }

    const pdfBytes = await generateRfoPdf({
      ticketNumber: rfo.ticketNumber,
      startTime: rfo.startTime,
      endTime: rfo.endTime,
      cause: rfo.cause,
      impact: rfo.impact,
      solution: rfo.solution,
      status: rfo.status
    });

    const cleanTicket = rfo.ticketNumber.replace(/[\/\\]/g, "");
    const filename = `RFO_Tiket_Gangguan_${cleanTicket}.pdf`;

    return { buffer: pdfBytes, filename };
  }
}

export const opsTelcoRfoService = new OpsTelcoRfoService();
