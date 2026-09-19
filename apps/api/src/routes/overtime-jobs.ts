import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { getAuthenticatedProfile } from "../auth/auth";
import { config } from "../config/env";
import { db } from "../db";
import {
  opsTelcoFormApprovalHistory,
  opsTelcoFormParticipants,
  opsTelcoForms,
  opsTelcoFormSignatures,
  users
} from "../db/schema";
import {
  canAssignParticipants,
  checkAllParticipantsSigned,
  computePayloadHash,
  generateOvertimeFormNumber,
  getFullOvertimeJobDetail,
  isSupervisor,
  logOvertimeAudit,
  validateStatusTransition,
  type AuthenticatedProfile,
  type OvertimeJobStatus
} from "../services/overtime-job.service";
import {
  generateOvertimeJobPdf,
  type OpsTelcoFormData
} from "../services/ops-telco-form-pdf.service";
import {
  editableData,
  formatEmployeeIdentity,
  OpsTelcoFormError,
  validateOpsTelcoData
} from "../services/ops-telco-form-validation";
import {
  getSignatureBuffer,
  saveSignature
} from "../services/signature-storage.service";

type Profile = AuthenticatedProfile;

const checkOrigin = (request: Request) => {
  if (["GET", "HEAD"].includes(request.method)) return true;
  const origin = request.headers.get("origin");
  return origin ? config.allowedOrigins.includes(origin) : false;
};

export const overtimeJobRoutes = new Elysia({ prefix: "/ops-telco/overtime-jobs" })
  .onError(({ error, code, status }) => {
    if (error instanceof OpsTelcoFormError) {
      return status(error.status, { message: error.message });
    }
    if (code !== "VALIDATION" && code !== "NOT_FOUND" && code !== "PARSE") {
      console.error("Overtime Job request failed", error);
      return status(500, {
        message: "Operasi Job Overtime belum dapat diproses. Coba lagi atau hubungi administrator."
      });
    }
  })
  .resolve(async ({ request, status }) => {
    const profile = (await getAuthenticatedProfile(request.headers, "employee")) as Profile | null;
    if (!profile) return status(401, { message: "Sesi karyawan tidak valid." });
    if (!profile.permissions.includes("ops_telco.forms.view")) {
      return status(403, { message: "Akses formulir OPS Telco diperlukan." });
    }
    if (!checkOrigin(request)) {
      return status(403, { message: "Origin permintaan tidak diizinkan." });
    }
    return { profile };
  })

  // 1. List Eligible Technicians for Assignment
  .get("/eligible-technicians", async () => {
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        kpcId: users.kpcId,
        email: users.email,
        division: users.division
      })
      .from(users)
      .where(eq(users.isActive, 1))
      .orderBy(users.name);
    return { data: rows };
  })

  // 2. List Overtime Jobs (Supervisor sees all, Technician sees assigned/created)
  .get("/", async ({ profile, query }) => {
    const isSpv = isSupervisor(profile);

    // Ambil daftar job_id di mana user adalah peserta
    let userFormIds: number[] = [];
    if (!isSpv) {
      const partRows = await db
        .select({ formId: opsTelcoFormParticipants.formId })
        .from(opsTelcoFormParticipants)
        .where(eq(opsTelcoFormParticipants.userId, profile.id));
      userFormIds = partRows.map((r) => r.formId);
    }

    const whereConditions = [eq(opsTelcoForms.formType, "overtime")];

    if (!isSpv) {
      if (userFormIds.length > 0) {
        whereConditions.push(
          or(eq(opsTelcoForms.createdBy, profile.id), inArray(opsTelcoForms.id, userFormIds))!
        );
      } else {
        whereConditions.push(eq(opsTelcoForms.createdBy, profile.id));
      }
    }

    if (query.status) {
      whereConditions.push(eq(opsTelcoForms.status, query.status));
    }

    const rows = await db
      .select({
        id: opsTelcoForms.id,
        formNumber: opsTelcoForms.formNumber,
        status: opsTelcoForms.status,
        jobOrderNo: opsTelcoForms.jobOrderNo,
        workflowVersion: opsTelcoForms.workflowVersion,
        lockedAt: opsTelcoForms.lockedAt,
        submittedAt: opsTelcoForms.submittedAt,
        approvedAt: opsTelcoForms.approvedAt,
        isLegacy: opsTelcoForms.isLegacy,
        createdBy: opsTelcoForms.createdBy,
        data: opsTelcoForms.data,
        createdAt: opsTelcoForms.createdAt,
        updatedAt: opsTelcoForms.updatedAt,
        creatorName: users.name,
        creatorKpcId: users.kpcId
      })
      .from(opsTelcoForms)
      .leftJoin(users, eq(opsTelcoForms.createdBy, users.id))
      .where(and(...whereConditions))
      .orderBy(desc(opsTelcoForms.id))
      .limit(100);

    // Fetch participant summaries for these forms
    const formIds = rows.map((r) => r.id);
    let participantsMap: Record<number, any[]> = {};
    let signaturesCountMap: Record<number, number> = {};

    if (formIds.length > 0) {
      const allParticipants = await db
        .select()
        .from(opsTelcoFormParticipants)
        .where(inArray(opsTelcoFormParticipants.formId, formIds));

      for (const p of allParticipants) {
        if (!participantsMap[p.formId]) participantsMap[p.formId] = [];
        participantsMap[p.formId].push(p);
      }

      const allSignatures = await db
        .select({
          formId: opsTelcoFormSignatures.formId,
          workflowVersion: opsTelcoFormSignatures.workflowVersion
        })
        .from(opsTelcoFormSignatures)
        .where(
          and(
            inArray(opsTelcoFormSignatures.formId, formIds),
            eq(opsTelcoFormSignatures.signerType, "technician")
          )
        );

      for (const s of allSignatures) {
        signaturesCountMap[s.formId] = (signaturesCountMap[s.formId] || 0) + 1;
      }
    }

    const data = rows.map((row) => {
      let parsedData: OpsTelcoFormData = {};
      try {
        parsedData = JSON.parse(row.data);
      } catch {
        parsedData = {};
      }

      const participants = participantsMap[row.id] || [];
      const pic = participants.find((p) => p.participantRole === "pic");

      return {
        id: row.id,
        formNumber: row.formNumber,
        status: row.status as OvertimeJobStatus,
        jobOrderNo: row.jobOrderNo,
        workflowVersion: row.workflowVersion,
        lockedAt: row.lockedAt,
        submittedAt: row.submittedAt,
        approvedAt: row.approvedAt,
        isLegacy: row.isLegacy,
        createdBy: row.createdBy,
        creatorName: row.creatorName,
        creatorKpcId: row.creatorKpcId,
        picName: pic?.nameSnapshot || row.creatorName,
        picKpcId: pic?.kpcIdSnapshot || row.creatorKpcId,
        totalParticipants: participants.length || 1,
        signaturesCount: signaturesCountMap[row.id] || 0,
        data: parsedData,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    });

    return { data };
  }, {
    query: t.Object({
      status: t.Optional(t.String())
    })
  })

  // 3. Create Overtime Job (PIC or Supervisor)
  .post("/", async ({ body, profile, status }) => {
    const isSpv = isSupervisor(profile);
    const { jobOrderNo, data, initialParticipantUserIds = [] } = body;

    const rawInput = { ...data };
    const cleanedData = validateOpsTelcoData("overtime", editableData(rawInput, isSpv));

    const result = await db.transaction(async (tx) => {
      // 1. Insert form with temporary pending number
      const [inserted] = await tx
        .insert(opsTelcoForms)
        .values({
          formType: "overtime",
          formNumber: `PENDING-${crypto.randomUUID()}`,
          status: "draft",
          jobOrderNo: jobOrderNo ? jobOrderNo.trim() : null,
          data: "{}",
          createdBy: profile.id,
          workflowVersion: 1
        })
        .$returningId();

      const formId = inserted.id;
      const finalFormNumber = generateOvertimeFormNumber(formId);

      // Sinergikan data internal: simpan jobOrder pada payload jika ada
      const finalData = {
        ...cleanedData,
        jobOrder: jobOrderNo ? jobOrderNo.trim() : finalFormNumber
      };

      // 2. Update nomor form & data final
      await tx
        .update(opsTelcoForms)
        .set({
          formNumber: finalFormNumber,
          data: JSON.stringify(finalData)
        })
        .where(eq(opsTelcoForms.id, formId));

      // 3. Tambahkan pembuat sebagai PIC otomatis
      await tx.insert(opsTelcoFormParticipants).values({
        formId,
        userId: profile.id,
        participantRole: "pic",
        nameSnapshot: profile.name,
        kpcIdSnapshot: profile.kpcId || null
      });

      // 4. Tambahkan personil tambahan yang dipilih
      const additionalIds = initialParticipantUserIds.filter(
        (uid: number) => uid !== profile.id
      );

      if (additionalIds.length > 0) {
        const selectedUsers = await tx
          .select({ id: users.id, name: users.name, kpcId: users.kpcId })
          .from(users)
          .where(and(inArray(users.id, additionalIds), eq(users.isActive, 1)));

        for (const u of selectedUsers) {
          await tx.insert(opsTelcoFormParticipants).values({
            formId,
            userId: u.id,
            participantRole: "member",
            nameSnapshot: u.name,
            kpcIdSnapshot: u.kpcId || null
          });
        }
      }

      return formId;
    });

    await logOvertimeAudit(profile.id, "ops_telco.overtime.created", String(result));
    const fullDetail = await getFullOvertimeJobDetail(result, profile);
    return status(201, { data: fullDetail });
  }, {
    body: t.Object({
      jobOrderNo: t.Optional(t.String({ maxLength: 100 })),
      data: t.Record(t.String({ maxLength: 80 }), t.String({ maxLength: 2000 })),
      initialParticipantUserIds: t.Optional(t.Array(t.Numeric()))
    })
  })

  // 4. Get Detail Overtime Job
  .get("/:id", async ({ params, profile }) => {
    const formId = Number(params.id);
    const detail = await getFullOvertimeJobDetail(formId, profile);
    return { data: detail };
  }, {
    params: t.Object({ id: t.Numeric() })
  })

  // 5. Update Overtime Job Data
  .put("/:id", async ({ params, body, profile }) => {
    const formId = Number(params.id);
    const detail = await getFullOvertimeJobDetail(formId, profile);

    const isSpv = isSupervisor(profile);
    const isPic = detail.isPic;

    if (!isSpv && !isPic) {
      throw new OpsTelcoFormError(403, "Hanya PIC atau Supervisor yang berhak mengedit data pekerjaan.");
    }

    if (detail.status !== "draft" && detail.status !== "revision_requested") {
      throw new OpsTelcoFormError(
        409,
        `Data pekerjaan tidak dapat diedit saat berstatus '${detail.status}'.`
      );
    }

    const { jobOrderNo, data } = body;
    const rawInput = { ...data };
    const cleanedData = validateOpsTelcoData("overtime", editableData(rawInput, isSpv));

    await db.transaction(async (tx) => {
      const nextVersion =
        detail.status === "revision_requested"
          ? detail.workflowVersion + 1
          : detail.workflowVersion;

      const finalData = {
        ...cleanedData,
        jobOrder: jobOrderNo ? jobOrderNo.trim() : (detail.jobOrderNo || detail.formNumber)
      };

      await tx
        .update(opsTelcoForms)
        .set({
          jobOrderNo: jobOrderNo ? jobOrderNo.trim() : detail.jobOrderNo,
          data: JSON.stringify(finalData),
          workflowVersion: nextVersion,
          status: "draft", // Kembalikan ke draf jika sebelumnya revision_requested
          updatedAt: new Date()
        })
        .where(eq(opsTelcoForms.id, formId));
    });

    await logOvertimeAudit(profile.id, "ops_telco.overtime.updated", String(formId));
    const updated = await getFullOvertimeJobDetail(formId, profile);
    return { data: updated };
  }, {
    params: t.Object({ id: t.Numeric() }),
    body: t.Object({
      jobOrderNo: t.Optional(t.String({ maxLength: 100 })),
      data: t.Record(t.String({ maxLength: 80 }), t.String({ maxLength: 2000 }))
    })
  })

  // 6. Delete Draft Job (Draft only)
  .delete("/:id", async ({ params, profile }) => {
    const formId = Number(params.id);
    const detail = await getFullOvertimeJobDetail(formId, profile);

    const isSpv = isSupervisor(profile);
    const isCreator = detail.createdBy === profile.id;
    const isPic = detail.isPic;

    if (!isSpv && !isCreator && !isPic) {
      throw new OpsTelcoFormError(403, "Anda tidak memiliki izin untuk menghapus pekerjaan ini.");
    }

    if (detail.status !== "draft" && detail.status !== "rejected") {
      throw new OpsTelcoFormError(
        409,
        "Hanya formulir berstatus Draf atau Ditolak yang dapat dihapus secara permanen."
      );
    }

    await db.transaction(async (tx) => {
      // Hapus riwayat approval, tanda tangan, peserta, dan formulir utama
      await tx.delete(opsTelcoFormApprovalHistory).where(eq(opsTelcoFormApprovalHistory.formId, formId));
      await tx.delete(opsTelcoFormSignatures).where(eq(opsTelcoFormSignatures.formId, formId));
      await tx.delete(opsTelcoFormParticipants).where(eq(opsTelcoFormParticipants.formId, formId));
      await tx.delete(opsTelcoForms).where(eq(opsTelcoForms.id, formId));
    });

    await logOvertimeAudit(profile.id, "ops_telco.overtime.deleted", String(formId));
    return { message: "Job Overtime berhasil dihapus." };
  }, {
    params: t.Object({ id: t.Numeric() })
  })

  // 7. Add Participant (PIC or Supervisor)
  .post("/:id/participants", async ({ params, body, profile }) => {
    const formId = Number(params.id);
    const targetUserId = Number(body.userId);

    await db.transaction(async (tx) => {
      const [form] = await tx
        .select()
        .from(opsTelcoForms)
        .where(eq(opsTelcoForms.id, formId))
        .limit(1);

      if (!form || form.formType !== "overtime") {
        throw new OpsTelcoFormError(404, "Job Overtime tidak ditemukan.");
      }

      if (form.status === "approved") {
        throw new OpsTelcoFormError(409, "Tidak dapat menambah teknisi ke pekerjaan yang telah disetujui.");
      }

      const isSpv = isSupervisor(profile);
      const [pic] = await tx
        .select()
        .from(opsTelcoFormParticipants)
        .where(
          and(
            eq(opsTelcoFormParticipants.formId, formId),
            eq(opsTelcoFormParticipants.userId, profile.id),
            eq(opsTelcoFormParticipants.participantRole, "pic")
          )
        )
        .limit(1);

      if (!isSpv && !pic && !profile.permissions.includes("ops_telco.oncall.assign")) {
        throw new OpsTelcoFormError(403, "Hanya PIC atau Supervisor yang dapat menambahkan teknisi.");
      }

      // Cek apakah user sudah terdaftar
      const [existing] = await tx
        .select()
        .from(opsTelcoFormParticipants)
        .where(
          and(
            eq(opsTelcoFormParticipants.formId, formId),
            eq(opsTelcoFormParticipants.userId, targetUserId)
          )
        )
        .limit(1);

      if (existing) {
        throw new OpsTelcoFormError(409, "Teknisi ini sudah terdaftar dalam penugasan pekerjaan.");
      }

      // Ambil user snapshot
      const [targetUser] = await tx
        .select({ name: users.name, kpcId: users.kpcId, isActive: users.isActive })
        .from(users)
        .where(eq(users.id, targetUserId))
        .limit(1);

      if (!targetUser || !targetUser.isActive) {
        throw new OpsTelcoFormError(404, "Teknisi tidak ditemukan atau tidak aktif.");
      }

      await tx.insert(opsTelcoFormParticipants).values({
        formId,
        userId: targetUserId,
        participantRole: body.role === "pic" ? "pic" : "member",
        nameSnapshot: targetUser.name,
        kpcIdSnapshot: targetUser.kpcId || null
      });
    });

    await logOvertimeAudit(profile.id, "ops_telco.overtime.participant_added", `${formId}:${targetUserId}`);
    const result = await getFullOvertimeJobDetail(formId, profile);
    return { data: result };
  }, {
    params: t.Object({ id: t.Numeric() }),
    body: t.Object({
      userId: t.Numeric(),
      role: t.Optional(t.Union([t.Literal("pic"), t.Literal("member")]))
    })
  })

  // 8. Remove Participant
  .delete("/:id/participants/:userId", async ({ params, profile }) => {
    const formId = Number(params.id);
    const targetUserId = Number(params.userId);

    await db.transaction(async (tx) => {
      const [form] = await tx
        .select()
        .from(opsTelcoForms)
        .where(eq(opsTelcoForms.id, formId))
        .limit(1);

      if (!form || form.formType !== "overtime") {
        throw new OpsTelcoFormError(404, "Job Overtime tidak ditemukan.");
      }

      if (form.status === "approved") {
        throw new OpsTelcoFormError(409, "Tidak dapat menghapus teknisi dari pekerjaan yang telah disetujui.");
      }

      const isSpv = isSupervisor(profile);
      const [pic] = await tx
        .select()
        .from(opsTelcoFormParticipants)
        .where(
          and(
            eq(opsTelcoFormParticipants.formId, formId),
            eq(opsTelcoFormParticipants.userId, profile.id),
            eq(opsTelcoFormParticipants.participantRole, "pic")
          )
        )
        .limit(1);

      if (!isSpv && !pic && !profile.permissions.includes("ops_telco.oncall.assign")) {
        throw new OpsTelcoFormError(403, "Hanya PIC atau Supervisor yang dapat menghapus teknisi.");
      }

      const [participant] = await tx
        .select()
        .from(opsTelcoFormParticipants)
        .where(
          and(
            eq(opsTelcoFormParticipants.formId, formId),
            eq(opsTelcoFormParticipants.userId, targetUserId)
          )
        )
        .limit(1);

      if (!participant) {
        throw new OpsTelcoFormError(404, "Peserta tidak ditemukan dalam pekerjaan ini.");
      }

      if (participant.participantRole === "pic") {
        throw new OpsTelcoFormError(409, "PIC tidak dapat dihapus. Ubah peran PIC terlebih dahulu.");
      }

      await tx
        .delete(opsTelcoFormParticipants)
        .where(
          and(
            eq(opsTelcoFormParticipants.formId, formId),
            eq(opsTelcoFormParticipants.userId, targetUserId)
          )
        );
    });

    await logOvertimeAudit(profile.id, "ops_telco.overtime.participant_removed", `${formId}:${targetUserId}`);
    const result = await getFullOvertimeJobDetail(formId, profile);
    return { data: result };
  }, {
    params: t.Object({ id: t.Numeric(), userId: t.Numeric() })
  })

  // 9. Submit Job to Supervisor (Direct submit from draft / revision_requested)
  .post("/:id/submit", async ({ params, profile }) => {
    const formId = Number(params.id);

    await db.transaction(async (tx) => {
      const [form] = await tx
        .select()
        .from(opsTelcoForms)
        .where(eq(opsTelcoForms.id, formId))
        .limit(1);

      if (!form || form.formType !== "overtime") {
        throw new OpsTelcoFormError(404, "Job Overtime tidak ditemukan.");
      }

      const isSpv = isSupervisor(profile);
      const isCreator = form.createdBy === profile.id;
      const [pic] = await tx
        .select()
        .from(opsTelcoFormParticipants)
        .where(
          and(
            eq(opsTelcoFormParticipants.formId, formId),
            eq(opsTelcoFormParticipants.userId, profile.id),
            eq(opsTelcoFormParticipants.participantRole, "pic")
          )
        )
        .limit(1);

      if (!isSpv && !pic && !isCreator) {
        throw new OpsTelcoFormError(403, "Hanya PIC, pembuat form, atau Supervisor yang dapat mengajukan pekerjaan.");
      }

      validateStatusTransition(form.status as OvertimeJobStatus, "submitted", !!pic || isCreator, isSpv);

      await tx
        .update(opsTelcoForms)
        .set({
          status: "submitted",
          submittedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(opsTelcoForms.id, formId));
    });

    await logOvertimeAudit(profile.id, "ops_telco.overtime.submitted", String(formId));
    const result = await getFullOvertimeJobDetail(formId, profile);
    return { data: result };
  }, {
    params: t.Object({ id: t.Numeric() })
  })

  // 10. Supervisor Decision (Approve / Revision / Reject)
  .post("/:id/decision", async ({ params, body, profile }) => {
    const formId = Number(params.id);
    const decision = body.decision;

    if (!isSupervisor(profile)) {
      throw new OpsTelcoFormError(403, "Anda tidak memiliki izin Supervisor untuk menyetujui formulir Overtime.");
    }

    await db.transaction(async (tx) => {
      const [form] = await tx
        .select()
        .from(opsTelcoForms)
        .where(eq(opsTelcoForms.id, formId))
        .limit(1);

      if (!form || form.formType !== "overtime") {
        throw new OpsTelcoFormError(404, "Job Overtime tidak ditemukan.");
      }

      validateStatusTransition(form.status as OvertimeJobStatus, decision as OvertimeJobStatus, false, true);

      if (decision === "approved") {
        if (!body.signatureDataUrl) {
          throw new OpsTelcoFormError(422, "Tanda tangan Supervisor wajib disertakan saat menyetujui formulir.");
        }

        // Simpan tanda tangan supervisor
        const { filePath, sha256 } = await saveSignature(
          formId,
          profile.id,
          body.signatureDataUrl
        );

        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(form.data);
        } catch {
          parsed = {};
        }
        const payloadHash = computePayloadHash(parsed);

        const [sigInsert] = await tx.insert(opsTelcoFormSignatures).values({
          formId,
          signerUserId: profile.id,
          signerType: "supervisor",
          workflowVersion: form.workflowVersion,
          nameSnapshot: profile.name,
          kpcIdSnapshot: profile.kpcId || null,
          signatureFile: filePath,
          signatureSha256: sha256,
          signedPayloadHash: payloadHash
        });

        const sigId = sigInsert.insertId;

        // Catat di approval history
        await tx.insert(opsTelcoFormApprovalHistory).values({
          formId,
          supervisorUserId: profile.id,
          workflowVersion: form.workflowVersion,
          decision: "approved",
          note: body.note?.trim() || null,
          signatureId: sigId
        });

        // Update status form
        await tx
          .update(opsTelcoForms)
          .set({
            status: "approved",
            approvedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(opsTelcoForms.id, formId));
      } else {
        // Revision requested or Rejected: catatan wajib!
        const note = body.note?.trim();
        if (!note || note.length < 3) {
          throw new OpsTelcoFormError(
            422,
            `Alasan/catatan wajib diisi minimal 3 karakter untuk keputusan '${decision}'.`
          );
        }

        await tx.insert(opsTelcoFormApprovalHistory).values({
          formId,
          supervisorUserId: profile.id,
          workflowVersion: form.workflowVersion,
          decision: decision,
          note: note,
          signatureId: null
        });

        await tx
          .update(opsTelcoForms)
          .set({
            status: decision,
            updatedAt: new Date()
          })
          .where(eq(opsTelcoForms.id, formId));
      }
    });

    await logOvertimeAudit(profile.id, `ops_telco.overtime.${decision}`, String(formId));
    const result = await getFullOvertimeJobDetail(formId, profile);
    return { data: result };
  }, {
    params: t.Object({ id: t.Numeric() }),
    body: t.Object({
      decision: t.Union([
        t.Literal("approved"),
        t.Literal("revision_requested"),
        t.Literal("rejected")
      ]),
      note: t.Optional(t.String()),
      signatureDataUrl: t.Optional(t.String())
    })
  })

  // 11. Download PDF (Multi-Page per technician, Watermark if not approved)
  .get("/:id/pdf", async ({ params, profile, set }) => {
    const formId = Number(params.id);
    const detail = await getFullOvertimeJobDetail(formId, profile);

    const supervisorSig = detail.signatures.find(
      (s) => s.signerType === "supervisor" && s.workflowVersion === detail.workflowVersion
    );

    const pdfBuffer = await generateOvertimeJobPdf({
      job: {
        id: detail.id,
        formNumber: detail.formNumber,
        jobOrderNo: detail.jobOrderNo,
        status: detail.status,
        data: detail.data
      },
      participants: detail.participants.map((p) => ({
        userId: p.userId,
        participantRole: p.participantRole as "pic" | "member",
        nameSnapshot: p.nameSnapshot,
        kpcIdSnapshot: p.kpcIdSnapshot
      })),
      signatures: detail.signatures.map((s) => ({
        signerUserId: s.signerUserId,
        signerType: s.signerType as "technician" | "supervisor",
        workflowVersion: s.workflowVersion,
        signatureFile: s.signatureFile
      })),
      supervisorSignature: supervisorSig
        ? {
            nameSnapshot: supervisorSig.nameSnapshot,
            kpcIdSnapshot: supervisorSig.kpcIdSnapshot,
            signatureFile: supervisorSig.signatureFile
          }
        : null
    });

    await logOvertimeAudit(profile.id, "ops_telco.overtime.pdf_downloaded", String(formId));

    const sanitizedJob = (detail.jobOrderNo || detail.formNumber).replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `Overtime-${sanitizedJob}-${detail.formNumber}.pdf`;

    set.headers["Content-Type"] = "application/pdf";
    set.headers["Content-Disposition"] = `inline; filename="${filename}"`;
    return new Response(pdfBuffer as any, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`
      }
    });
  }, {
    params: t.Object({ id: t.Numeric() })
  })

  // 12. Get Private Signature File
  .get("/:id/signatures/:sigId/file", async ({ params, profile, set }) => {
    const formId = Number(params.id);
    const sigId = Number(params.sigId);

    await getFullOvertimeJobDetail(formId, profile);

    const [sig] = await db
      .select()
      .from(opsTelcoFormSignatures)
      .where(
        and(
          eq(opsTelcoFormSignatures.id, sigId),
          eq(opsTelcoFormSignatures.formId, formId)
        )
      )
      .limit(1);

    if (!sig) {
      throw new OpsTelcoFormError(404, "Tanda tangan tidak ditemukan.");
    }

    const buffer = await getSignatureBuffer(sig.signatureFile);

    set.headers["Content-Type"] = "image/png";
    set.headers["Cache-Control"] = "private, max-age=3600";
    return new Response(buffer as any, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=3600"
      }
    });
  }, {
    params: t.Object({ id: t.Numeric(), sigId: t.Numeric() })
  });
