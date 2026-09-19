import crypto from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  auditLogs,
  opsTelcoFormApprovalHistory,
  opsTelcoFormParticipants,
  opsTelcoForms,
  opsTelcoFormSignatures,
  users
} from "../db/schema";
import { formatEmployeeIdentity, OpsTelcoFormError } from "./ops-telco-form-validation";

export type OvertimeJobStatus =
  | "draft"
  | "technician_signing"
  | "submitted"
  | "revision_requested"
  | "approved"
  | "rejected";

import type { AuthenticatedProfile } from "../auth/types";
export type { AuthenticatedProfile };

export function computePayloadHash(data: Record<string, unknown>): string {
  const keys = Object.keys(data).sort();
  const sorted: Record<string, unknown> = {};
  for (const k of keys) {
    if (k === "totalHours") continue;
    sorted[k] = data[k] ?? "";
  }
  return crypto.createHash("sha256").update(JSON.stringify(sorted)).digest("hex");
}

export function generateOvertimeFormNumber(id: number): string {
  return `OT-${new Date().getFullYear()}-${String(id).padStart(5, "0")}`;
}

export function isSupervisor(profile: AuthenticatedProfile): boolean {
  return (
    profile.permissions.includes("ops_telco.overtime.approve") ||
    profile.permissions.includes("ops_telco.oncall.approve") ||
    profile.permissions.includes("ops_telco.forms.manage") ||
    profile.roles.includes("ops-telco-supervisor")
  );
}

export function canAssignParticipants(profile: AuthenticatedProfile): boolean {
  return (
    profile.permissions.includes("ops_telco.overtime.assign") ||
    profile.permissions.includes("ops_telco.oncall.assign") ||
    profile.permissions.includes("ops_telco.forms.manage") ||
    isSupervisor(profile)
  );
}

export function validateStatusTransition(
  currentStatus: OvertimeJobStatus,
  targetStatus: OvertimeJobStatus,
  isPicUser: boolean,
  isSpvUser: boolean
): void {
  // Matriks transisi status yang valid:
  const allowedTransitions: Record<OvertimeJobStatus, OvertimeJobStatus[]> = {
    draft: ["technician_signing", "submitted"],
    technician_signing: ["submitted", "draft"],
    submitted: ["approved", "revision_requested", "rejected", "draft"],
    revision_requested: ["draft", "technician_signing", "submitted"],
    rejected: ["draft"], // Hanya supervisor yang bisa membuka kembali ke draft
    approved: [] // FINAL
  };

  const validTargets = allowedTransitions[currentStatus] || [];
  if (!validTargets.includes(targetStatus)) {
    throw new OpsTelcoFormError(
      409,
      `Perubahan status tidak valid dari '${currentStatus}' ke '${targetStatus}'.`
    );
  }

  // Hak akses per transisi
  if (currentStatus === "draft" && targetStatus === "technician_signing") {
    if (!isPicUser && !isSpvUser) {
      throw new OpsTelcoFormError(403, "Hanya PIC atau Supervisor yang dapat mengunci data untuk tanda tangan.");
    }
  } else if (targetStatus === "submitted") {
    if (!isPicUser && !isSpvUser) {
      throw new OpsTelcoFormError(403, "Hanya PIC, pembuat form, atau Supervisor yang dapat mengajukan Job Overtime.");
    }
  } else if (currentStatus === "submitted") {
    if (!isSpvUser) {
      throw new OpsTelcoFormError(403, "Hanya Supervisor yang dapat menyetujui, meminta revisi, atau menolak pengajuan.");
    }
  } else if (currentStatus === "rejected" && targetStatus === "draft") {
    if (!isSpvUser) {
      throw new OpsTelcoFormError(403, "Hanya Supervisor yang dapat membuka kembali Job yang telah ditolak.");
    }
  }
}

export async function checkAllParticipantsSigned(
  tx: any,
  formId: number,
  workflowVersion: number
): Promise<{ allSigned: boolean; missingUserIds: number[] }> {
  const participants = await tx
    .select({ userId: opsTelcoFormParticipants.userId })
    .from(opsTelcoFormParticipants)
    .where(eq(opsTelcoFormParticipants.formId, formId));

  if (participants.length === 0) {
    return { allSigned: false, missingUserIds: [] };
  }

  const signatures = await tx
    .select({ signerUserId: opsTelcoFormSignatures.signerUserId })
    .from(opsTelcoFormSignatures)
    .where(
      and(
        eq(opsTelcoFormSignatures.formId, formId),
        eq(opsTelcoFormSignatures.workflowVersion, workflowVersion),
        eq(opsTelcoFormSignatures.signerType, "technician")
      )
    );

  const signedUserIds = new Set(signatures.map((s: { signerUserId: number }) => s.signerUserId));
  const missingUserIds = participants
    .map((p: { userId: number }) => p.userId)
    .filter((uid: number) => !signedUserIds.has(uid));

  return {
    allSigned: missingUserIds.length === 0,
    missingUserIds
  };
}

export async function getFullOvertimeJobDetail(formId: number, profile: AuthenticatedProfile) {
  const [form] = await db
    .select()
    .from(opsTelcoForms)
    .where(eq(opsTelcoForms.id, formId))
    .limit(1);

  if (!form || form.formType !== "overtime") {
    throw new OpsTelcoFormError(404, "Job Overtime tidak ditemukan.");
  }

  const participants = await db
    .select()
    .from(opsTelcoFormParticipants)
    .where(eq(opsTelcoFormParticipants.formId, formId));

  const isUserParticipant = participants.some((p) => p.userId === profile.id);
  const isSpv = isSupervisor(profile);
  const isCreator = form.createdBy === profile.id;

  if (!isSpv && !isUserParticipant && !isCreator) {
    throw new OpsTelcoFormError(403, "Anda tidak memiliki akses ke Job Overtime ini.");
  }

  const signatures = await db
    .select()
    .from(opsTelcoFormSignatures)
    .where(eq(opsTelcoFormSignatures.formId, formId))
    .orderBy(desc(opsTelcoFormSignatures.signedAt));

  const approvalHistory = await db
    .select()
    .from(opsTelcoFormApprovalHistory)
    .where(eq(opsTelcoFormApprovalHistory.formId, formId))
    .orderBy(desc(opsTelcoFormApprovalHistory.decidedAt));

  let parsedData: Record<string, string> = {};
  try {
    parsedData = JSON.parse(form.data);
  } catch {
    parsedData = {};
  }

  const isPic = participants.some(
    (p) => p.userId === profile.id && p.participantRole === "pic"
  );

  return {
    ...form,
    status: form.status as OvertimeJobStatus,
    data: parsedData,
    participants,
    signatures,
    approvalHistory,
    isPic,
    isParticipant: isUserParticipant,
    isSupervisor: isSpv
  };
}

export async function logOvertimeAudit(
  actorId: number,
  action: string,
  resourceId: string,
  ipAddress?: string
) {
  try {
    await db.insert(auditLogs).values({
      actorId,
      action,
      resource: "ops_telco_forms",
      resourceId,
      ipAddress: ipAddress || null
    });
  } catch (error) {
    console.error("Failed to insert audit log:", error);
  }
}
