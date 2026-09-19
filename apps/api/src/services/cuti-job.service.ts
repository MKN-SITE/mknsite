import { and, desc, eq, gte, lte, or, sql } from "drizzle-orm";
import { db } from "../db";
import {
  auditLogs,
  opsTelcoForms,
  users
} from "../db/schema";
import { OpsTelcoFormError } from "./ops-telco-form-validation";

export type CutiStatus = "draft" | "submitted" | "cancelled";

export type CutiLeaveType =
  | "tahunan"
  | "sakit"
  | "melahirkan"
  | "penting"
  | "lainnya";

import type { AuthenticatedProfile } from "../auth/types";
export type { AuthenticatedProfile };

export interface CutiData {
  // Auto-populated from user profile
  employeeName: string;
  kpcId: string;
  position: string;
  startDate: string; // tanggal mulai kerja (join date)
  division: string;

  // Form input fields
  leaveType: CutiLeaveType;
  leaveStartDate: string; // YYYY-MM-DD
  leaveEndDate: string;   // YYYY-MM-DD
  totalDays: number;
  reason: string;
  emergencyPhone?: string;
  addressDuringLeave?: string;

  // Signature data
  employeeSignatureUrl?: string;
  supervisorSignatureUrl?: string;
}

export function isSupervisor(profile: AuthenticatedProfile): boolean {
  return (
    profile.permissions.includes("ops_telco.oncall.approve") ||
    profile.permissions.includes("ops_telco.forms.manage") ||
    profile.roles.includes("ops-telco-supervisor")
  );
}

export function generateCutiFormNumber(id: number): string {
  return `CT-${new Date().getFullYear()}-${String(id).padStart(5, "0")}`;
}

/**
 * Check if the given user has any active leave that overlaps with dateRange.
 * Used by oncall scheduling to block technicians on leave.
 */
export async function hasActiveCutiOnDate(
  userId: number,
  checkDate: string // YYYY-MM-DD
): Promise<boolean> {
  const rows = await db
    .select({
      id: opsTelcoForms.id,
      leaveStartDate: opsTelcoForms.leaveStartDate,
      leaveEndDate: opsTelcoForms.leaveEndDate,
      data: opsTelcoForms.data
    })
    .from(opsTelcoForms)
    .where(
      and(
        eq(opsTelcoForms.formType, "cuti"),
        eq(opsTelcoForms.createdBy, userId),
        eq(opsTelcoForms.status, "submitted")
      )
    );

  for (const row of rows) {
    if (row.leaveStartDate && row.leaveEndDate) {
      if (checkDate >= row.leaveStartDate && checkDate <= row.leaveEndDate) {
        return true;
      }
    } else {
      try {
        const data = JSON.parse(row.data) as Partial<CutiData>;
        if (data.leaveStartDate && data.leaveEndDate) {
          if (checkDate >= data.leaveStartDate && checkDate <= data.leaveEndDate) {
            return true;
          }
        }
      } catch {
        // ignore parse errors
      }
    }
  }
  return false;
}

/**
 * Batch check active cuti on checkDate for all users.
 * Returns a Set of userIds who have active submitted cuti on checkDate in 1 query.
 */
export async function batchHasActiveCutiOnDate(
  checkDate: string
): Promise<Set<number>> {
  const onLeaveUserIds = new Set<number>();

  const rows = await db
    .select({
      id: opsTelcoForms.id,
      createdBy: opsTelcoForms.createdBy,
      leaveStartDate: opsTelcoForms.leaveStartDate,
      leaveEndDate: opsTelcoForms.leaveEndDate,
      data: opsTelcoForms.data
    })
    .from(opsTelcoForms)
    .where(
      and(
        eq(opsTelcoForms.formType, "cuti"),
        eq(opsTelcoForms.status, "submitted"),
        or(
          and(
            lte(opsTelcoForms.leaveStartDate, checkDate),
            gte(opsTelcoForms.leaveEndDate, checkDate)
          ),
          sql`${opsTelcoForms.leaveStartDate} IS NULL`
        )
      )
    );

  for (const row of rows) {
    if (row.leaveStartDate && row.leaveEndDate) {
      if (checkDate >= row.leaveStartDate && checkDate <= row.leaveEndDate) {
        onLeaveUserIds.add(row.createdBy);
      }
    } else {
      try {
        const data = JSON.parse(row.data) as Partial<CutiData>;
        if (data.leaveStartDate && data.leaveEndDate) {
          if (checkDate >= data.leaveStartDate && checkDate <= data.leaveEndDate) {
            onLeaveUserIds.add(row.createdBy);
          }
        }
      } catch {
        // ignore parse errors
      }
    }
  }

  return onLeaveUserIds;
}

/**
 * Get all cuti records for a specific user with overlap on a date range.
 * Returns the overlapping cuti forms (for oncall conflict display).
 */
export async function getCutiForDateRange(
  userId: number,
  rangeStart: string,
  rangeEnd: string
): Promise<Array<{ id: number; leaveStartDate: string; leaveEndDate: string; leaveType: string }>> {
  const rows = await db
    .select({
      id: opsTelcoForms.id,
      leaveStartDate: opsTelcoForms.leaveStartDate,
      leaveEndDate: opsTelcoForms.leaveEndDate,
      data: opsTelcoForms.data
    })
    .from(opsTelcoForms)
    .where(
      and(
        eq(opsTelcoForms.formType, "cuti"),
        eq(opsTelcoForms.createdBy, userId),
        eq(opsTelcoForms.status, "submitted")
      )
    );

  const result = [];
  for (const row of rows) {
    const startDate = row.leaveStartDate;
    const endDate = row.leaveEndDate;
    if (startDate && endDate) {
      if (startDate <= rangeEnd && endDate >= rangeStart) {
        let leaveType = "lainnya";
        try {
          const data = JSON.parse(row.data) as Partial<CutiData>;
          leaveType = data.leaveType ?? "lainnya";
        } catch {}
        result.push({
          id: row.id,
          leaveStartDate: startDate,
          leaveEndDate: endDate,
          leaveType
        });
      }
    } else {
      try {
        const data = JSON.parse(row.data) as Partial<CutiData>;
        if (data.leaveStartDate && data.leaveEndDate) {
          if (data.leaveStartDate <= rangeEnd && data.leaveEndDate >= rangeStart) {
            result.push({
              id: row.id,
              leaveStartDate: data.leaveStartDate,
              leaveEndDate: data.leaveEndDate,
              leaveType: data.leaveType ?? "lainnya"
            });
          }
        }
      } catch {
        // ignore parse errors
      }
    }
  }
  return result;
}

export async function getFullCutiDetail(formId: number, profile: AuthenticatedProfile) {
  const [form] = await db
    .select()
    .from(opsTelcoForms)
    .where(eq(opsTelcoForms.id, formId))
    .limit(1);

  if (!form || form.formType !== "cuti") {
    throw new OpsTelcoFormError(404, "Formulir Cuti tidak ditemukan.");
  }

  const isSpv = isSupervisor(profile);
  const isCreator = form.createdBy === profile.id;

  if (!isSpv && !isCreator) {
    throw new OpsTelcoFormError(403, "Anda tidak memiliki akses ke Formulir Cuti ini.");
  }

  let parsedData: Record<string, string> = {};
  try {
    parsedData = JSON.parse(form.data);
  } catch {
    parsedData = {};
  }

  return {
    ...form,
    status: form.status as CutiStatus,
    data: parsedData,
    isSupervisor: isSpv,
    isCreator
  };
}

/**
 * List all cuti forms (for supervisor report view) or filtered to own forms (technician view).
 */
export async function listCutiForms(
  profile: AuthenticatedProfile,
  options: {
    limit?: number;
    offset?: number;
    search?: string;
    status?: CutiStatus;
  } = {}
) {
  const isSpv = isSupervisor(profile);
  const { limit = 50, offset = 0 } = options;

  const baseQuery = db
    .select({
      id: opsTelcoForms.id,
      formNumber: opsTelcoForms.formNumber,
      status: opsTelcoForms.status,
      data: opsTelcoForms.data,
      createdBy: opsTelcoForms.createdBy,
      createdAt: opsTelcoForms.createdAt,
      updatedAt: opsTelcoForms.updatedAt,
      creatorName: users.name,
      creatorKpcId: users.kpcId,
      creatorDivision: users.division
    })
    .from(opsTelcoForms)
    .leftJoin(users, eq(opsTelcoForms.createdBy, users.id))
    .where(
      and(
        eq(opsTelcoForms.formType, "cuti"),
        isSpv ? undefined : eq(opsTelcoForms.createdBy, profile.id),
        options.status ? eq(opsTelcoForms.status, options.status) : undefined
      )
    )
    .orderBy(desc(opsTelcoForms.createdAt))
    .limit(limit)
    .offset(offset);

  const rows = await baseQuery;

  return rows.map((row) => {
    let parsedData: Record<string, string> = {};
    try {
      parsedData = JSON.parse(row.data);
    } catch {
      // ignore
    }
    return {
      ...row,
      status: row.status as CutiStatus,
      data: parsedData
    };
  });
}

export async function logCutiAudit(
  actorId: number,
  action: string,
  resourceId: string,
  ipAddress?: string
) {
  try {
    await db.insert(auditLogs).values({
      actorId,
      action,
      resource: "ops_telco_forms_cuti",
      resourceId,
      ipAddress: ipAddress || null
    });
  } catch (error) {
    console.error("Failed to insert cuti audit log:", error);
  }
}
