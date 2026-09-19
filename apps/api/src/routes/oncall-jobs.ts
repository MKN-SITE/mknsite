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
  generateOncallFormNumber,
  getFullJobDetail,
  isSupervisor,
  logOncallAudit,
  validateStatusTransition,
  type AuthenticatedProfile,
  type OncallJobStatus
} from "../services/oncall-job.service";
import { batchHasActiveCutiOnDate, hasActiveCutiOnDate } from "../services/cuti-job.service";
import {
  generateOncallJobPdf,
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

export const oncallJobRoutes = new Elysia({ prefix: "/ops-telco/oncall-jobs" })
  .onError(({ error, code, status }) => {
    if (error instanceof OpsTelcoFormError) {
      return status(error.status, { message: error.message });
    }
    if (code !== "VALIDATION" && code !== "NOT_FOUND" && code !== "PARSE") {
      console.error("Oncall Job request failed", error);
      return status(500, {
        message: "Operasi Job Oncall belum dapat diproses. Coba lagi atau hubungi administrator."
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
  .get("/eligible-technicians", async ({ query }) => {
    const checkDate = query?.date as string | undefined;
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

    if (checkDate) {
      const activeCutiUserIds = await batchHasActiveCutiOnDate(checkDate);
      const enriched = rows.map((u) => ({
        ...u,
        isOnCuti: activeCutiUserIds.has(u.id)
      }));
      return { data: enriched };
    }

    return { data: rows.map((u) => ({ ...u, isOnCuti: false })) };
  }, {
    query: t.Object({
      date: t.Optional(t.String())
    })
  })

  // 2. List Oncall Jobs (Supervisor sees all, Technician sees assigned/created)
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

    const whereConditions = [eq(opsTelcoForms.formType, "oncall")];

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

      const parts = participantsMap[row.id] || [];
      const pic = parts.find((p) => p.participantRole === "pic");

      return {
        ...row,
        status: row.status as OncallJobStatus,
        data: parsedData,
        picName: pic?.nameSnapshot || row.creatorName || "Belum ditentukan",
        picKpcId: pic?.kpcIdSnapshot || row.creatorKpcId || null,
        totalParticipants: parts.length,
        signaturesCount: signaturesCountMap[row.id] || 0,
        isPic: parts.some((p) => p.userId === profile.id && p.participantRole === "pic"),
        isParticipant: parts.some((p) => p.userId === profile.id)
      };
    });

    return { data };
  }, {
    query: t.Object({
      status: t.Optional(t.String()),
      tab: t.Optional(t.String())
    })
  })

  // 3. Create New Oncall Job
  .post("/", async ({ body, profile, status }) => {
    const rawJobOrderNo = body.jobOrderNo?.trim() || "";
    if (rawJobOrderNo) {
      // Cek apakah Job Order No sudah dipakai pada Oncall aktif
      const [existing] = await db
        .select({ id: opsTelcoForms.id })
        .from(opsTelcoForms)
        .where(
          and(
            eq(opsTelcoForms.formType, "oncall"),
            eq(opsTelcoForms.jobOrderNo, rawJobOrderNo)
          )
        )
        .limit(1);

      if (existing) {
        throw new OpsTelcoFormError(
          409,
          `Nomor Job Order '${rawJobOrderNo}' sudah digunakan pada Formulir Oncall lain (ID: ${existing.id}).`
        );
      }
    }

    const cleanData = validateOpsTelcoData("oncall", editableData(body.data, isSupervisor(profile)));

    // Cek apakah pembuat form sedang dalam masa cuti pada tanggal oncall
    if (cleanData.dateRequired) {
      const creatorOnCuti = await hasActiveCutiOnDate(profile.id, cleanData.dateRequired);
      if (creatorOnCuti) {
        throw new OpsTelcoFormError(
          422,
          `Anda sedang dalam masa cuti pada tanggal pelaksanaan oncall (${cleanData.dateRequired}) sehingga tidak dapat ditugaskan sebagai PIC.`
        );
      }
    }

    const createdJob = await db.transaction(async (tx) => {
      // Dapatkan next auto-increment id
      const [insertResult] = await tx.insert(opsTelcoForms).values({
        formType: "oncall",
        formNumber: "PENDING",
        status: "draft",
        data: JSON.stringify(cleanData),
        jobOrderNo: rawJobOrderNo || null,
        workflowVersion: 1,
        createdBy: profile.id,
        isLegacy: false
      });

      const newId = insertResult.insertId;
      const formNumber = generateOncallFormNumber(newId);

      await tx
        .update(opsTelcoForms)
        .set({ formNumber })
        .where(eq(opsTelcoForms.id, newId));

      // Otomatis assign pembuat form sebagai PIC
      const [creatorUser] = await tx
        .select({ name: users.name, kpcId: users.kpcId })
        .from(users)
        .where(eq(users.id, profile.id))
        .limit(1);

      await tx.insert(opsTelcoFormParticipants).values({
        formId: newId,
        userId: profile.id,
        participantRole: "pic",
        nameSnapshot: creatorUser?.name || profile.name,
        kpcIdSnapshot: creatorUser?.kpcId || profile.kpcId || null
      });

      // Tambahkan peserta awal jika disediakan
      if (Array.isArray(body.participantUserIds) && body.participantUserIds.length > 0) {
        const uniqueMemberIds = [
          ...new Set(body.participantUserIds.filter((uid) => uid !== profile.id))
        ];

        if (uniqueMemberIds.length > 0) {
          const memberUsers = await tx
            .select({ id: users.id, name: users.name, kpcId: users.kpcId })
            .from(users)
            .where(inArray(users.id, uniqueMemberIds));

          for (const u of memberUsers) {
            await tx.insert(opsTelcoFormParticipants).values({
              formId: newId,
              userId: u.id,
              participantRole: "member",
              nameSnapshot: u.name,
              kpcIdSnapshot: u.kpcId
            });
          }
        }
      }

      return newId;
    });

    await logOncallAudit(profile.id, "ops_telco.oncall.created", String(createdJob));

    const result = await getFullJobDetail(createdJob, profile);
    return status(201, { data: result });
  }, {
    body: t.Object({
      jobOrderNo: t.Optional(t.String({ maxLength: 100 })),
      data: t.Record(t.String({ maxLength: 80 }), t.String({ maxLength: 2000 })),
      participantUserIds: t.Optional(t.Array(t.Numeric()))
    })
  })

  // 4. Detail Job
  .get("/:id", async ({ params, profile }) => {
    const job = await getFullJobDetail(Number(params.id), profile);
    return { data: job };
  }, {
    params: t.Object({ id: t.Numeric() })
  })

  // 4b. Delete Draft Job (PIC, Creator, or Supervisor)
  .delete("/:id", async ({ params, profile }) => {
    const formId = Number(params.id);

    await db.transaction(async (tx) => {
      const [form] = await tx
        .select()
        .from(opsTelcoForms)
        .where(eq(opsTelcoForms.id, formId))
        .limit(1);

      if (!form || form.formType !== "oncall") {
        throw new OpsTelcoFormError(404, "Job Oncall tidak ditemukan.");
      }

      if (form.status !== "draft" && form.status !== "rejected") {
        throw new OpsTelcoFormError(409, "Hanya formulir dengan status Draf atau Ditolak yang dapat dihapus.");
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

      if (!isSpv && !isCreator && !pic && !profile.permissions.includes("ops_telco.forms.manage")) {
        throw new OpsTelcoFormError(403, "Anda tidak memiliki wewenang untuk menghapus formulir ini.");
      }

      // Hapus data berelasi
      await tx.delete(opsTelcoFormApprovalHistory).where(eq(opsTelcoFormApprovalHistory.formId, formId));
      await tx.delete(opsTelcoFormSignatures).where(eq(opsTelcoFormSignatures.formId, formId));
      await tx.delete(opsTelcoFormParticipants).where(eq(opsTelcoFormParticipants.formId, formId));
      await tx.delete(opsTelcoForms).where(eq(opsTelcoForms.id, formId));
    });

    await logOncallAudit(profile.id, "ops_telco.oncall.deleted", String(formId));
    return { success: true, message: "Job Oncall berhasil dihapus." };
  }, {
    params: t.Object({ id: t.Numeric() })
  })

  // 5. Update Shared Job Details (PIC only, Draft / Revision Requested)
  .patch("/:id/details", async ({ params, body, profile }) => {
    const formId = Number(params.id);

    const updated = await db.transaction(async (tx) => {
      const [form] = await tx
        .select()
        .from(opsTelcoForms)
        .where(eq(opsTelcoForms.id, formId))
        .limit(1);

      if (!form || form.formType !== "oncall") {
        throw new OpsTelcoFormError(404, "Job Oncall tidak ditemukan.");
      }

      const isSpv = isSupervisor(profile);
      const [picParticipant] = await tx
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

      if (!isSpv && !picParticipant) {
        throw new OpsTelcoFormError(403, "Hanya PIC atau Supervisor yang dapat memperbarui data pekerjaan.");
      }

      if (form.status === "approved") {
        throw new OpsTelcoFormError(409, "Formulir yang telah disetujui bersifat final dan tidak dapat diubah.");
      }

      const rawJobOrderNo = body.jobOrderNo?.trim();
      if (rawJobOrderNo && rawJobOrderNo !== form.jobOrderNo) {
        const [duplicate] = await tx
          .select({ id: opsTelcoForms.id })
          .from(opsTelcoForms)
          .where(
            and(
              eq(opsTelcoForms.formType, "oncall"),
              eq(opsTelcoForms.jobOrderNo, rawJobOrderNo),
              sql`${opsTelcoForms.id} != ${formId}`
            )
          )
          .limit(1);

        if (duplicate) {
          throw new OpsTelcoFormError(
            409,
            `Nomor Job Order '${rawJobOrderNo}' sudah digunakan pada formulir lain (ID: ${duplicate.id}).`
          );
        }
      }

      const cleanData = validateOpsTelcoData("oncall", editableData(body.data, isSpv));

      // Jika tanggal oncall diubah, pastikan tidak ada teknisi peserta yang sedang cuti di tanggal baru tersebut
      if (cleanData.dateRequired) {
        const assignedParticipants = await tx
          .select({
            userId: opsTelcoFormParticipants.userId,
            nameSnapshot: opsTelcoFormParticipants.nameSnapshot
          })
          .from(opsTelcoFormParticipants)
          .where(eq(opsTelcoFormParticipants.formId, formId));

        for (const p of assignedParticipants) {
          const participantOnCuti = await hasActiveCutiOnDate(p.userId, cleanData.dateRequired);
          if (participantOnCuti) {
            throw new OpsTelcoFormError(
              422,
              `Teknisi ${p.nameSnapshot || "Peserta"} tercatat sedang dalam masa cuti pada tanggal ${cleanData.dateRequired}. Harap sesuaikan tanggal atau keluarkan teknisi dari penugasan terlebih dahulu.`
            );
          }
        }
      }

      // Jika diubah saat technician_signing: naikkan workflow_version agar tanda tangan lama invalidated
      let newWorkflowVersion = form.workflowVersion;
      let newStatus = form.status;

      if (form.status === "technician_signing") {
        newWorkflowVersion = form.workflowVersion + 1;
        newStatus = "draft"; // Kembali ke draf untuk dikunci ulang
      }

      await tx
        .update(opsTelcoForms)
        .set({
          data: JSON.stringify(cleanData),
          jobOrderNo: rawJobOrderNo !== undefined ? (rawJobOrderNo || null) : form.jobOrderNo,
          workflowVersion: newWorkflowVersion,
          status: newStatus,
          lockedAt: newStatus === "draft" ? null : form.lockedAt,
          updatedAt: new Date()
        })
        .where(eq(opsTelcoForms.id, formId));

      return formId;
    });

    await logOncallAudit(profile.id, "ops_telco.oncall.data_updated", String(formId));
    const result = await getFullJobDetail(updated, profile);
    return { data: result };
  }, {
    params: t.Object({ id: t.Numeric() }),
    body: t.Object({
      jobOrderNo: t.Optional(t.String({ maxLength: 100 })),
      data: t.Record(t.String({ maxLength: 80 }), t.String({ maxLength: 2000 }))
    })
  })

  // 6. Add Participant (PIC or oncall.assign / Supervisor)
  .post("/:id/participants", async ({ params, body, profile }) => {
    const formId = Number(params.id);
    const targetUserId = Number(body.userId);

    await db.transaction(async (tx) => {
      const [form] = await tx
        .select()
        .from(opsTelcoForms)
        .where(eq(opsTelcoForms.id, formId))
        .limit(1);

      if (!form || form.formType !== "oncall") {
        throw new OpsTelcoFormError(404, "Job Oncall tidak ditemukan.");
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

      // Pastikan target user belum terdaftar
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

      // Validasi: Cek apakah teknisi sedang dalam masa cuti pada tanggal pelaksanaan oncall
      try {
        const formData = JSON.parse(form.data || "{}") as Record<string, string>;
        if (formData.dateRequired) {
          const isTargetOnCuti = await hasActiveCutiOnDate(targetUserId, formData.dateRequired);
          if (isTargetOnCuti) {
            throw new OpsTelcoFormError(
              422,
              `Teknisi ${targetUser.name} sedang dalam masa cuti pada tanggal pelaksanaan oncall (${formData.dateRequired}) sehingga tidak dapat ditugaskan.`
            );
          }
        }
      } catch (err) {
        if (err instanceof OpsTelcoFormError) throw err;
      }

      await tx.insert(opsTelcoFormParticipants).values({
        formId,
        userId: targetUserId,
        participantRole: body.role === "pic" ? "pic" : "member",
        nameSnapshot: targetUser.name,
        kpcIdSnapshot: targetUser.kpcId || null
      });
    });

    await logOncallAudit(profile.id, "ops_telco.oncall.participant_added", `${formId}:${targetUserId}`);
    const result = await getFullJobDetail(formId, profile);
    return { data: result };
  }, {
    params: t.Object({ id: t.Numeric() }),
    body: t.Object({
      userId: t.Numeric(),
      role: t.Optional(t.Union([t.Literal("pic"), t.Literal("member")]))
    })
  })

  // 7. Remove Participant
  .delete("/:id/participants/:userId", async ({ params, profile }) => {
    const formId = Number(params.id);
    const targetUserId = Number(params.userId);

    await db.transaction(async (tx) => {
      const [form] = await tx
        .select()
        .from(opsTelcoForms)
        .where(eq(opsTelcoForms.id, formId))
        .limit(1);

      if (!form || form.formType !== "oncall") {
        throw new OpsTelcoFormError(404, "Job Oncall tidak ditemukan.");
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

      // Cek apakah peserta sudah tanda tangan di versi saat ini
      const [signed] = await tx
        .select()
        .from(opsTelcoFormSignatures)
        .where(
          and(
            eq(opsTelcoFormSignatures.formId, formId),
            eq(opsTelcoFormSignatures.signerUserId, targetUserId),
            eq(opsTelcoFormSignatures.workflowVersion, form.workflowVersion)
          )
        )
        .limit(1);

      if (signed) {
        throw new OpsTelcoFormError(
          409,
          "Teknisi yang telah menandatangani versi ini tidak dapat dihapus. Perbarui data pekerjaan terlebih dahulu jika ingin mereset tanda tangan."
        );
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

    await logOncallAudit(profile.id, "ops_telco.oncall.participant_removed", `${formId}:${targetUserId}`);
    const result = await getFullJobDetail(formId, profile);
    return { data: result };
  }, {
    params: t.Object({ id: t.Numeric(), userId: t.Numeric() })
  })

  // 8. Lock Job for Technician Signing (PIC or Supervisor)
  .post("/:id/lock", async ({ params, profile }) => {
    const formId = Number(params.id);

    await db.transaction(async (tx) => {
      const [form] = await tx
        .select()
        .from(opsTelcoForms)
        .where(eq(opsTelcoForms.id, formId))
        .limit(1);

      if (!form || form.formType !== "oncall") {
        throw new OpsTelcoFormError(404, "Job Oncall tidak ditemukan.");
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

      if (!isSpv && !pic) {
        throw new OpsTelcoFormError(403, "Hanya PIC atau Supervisor yang dapat mengunci data untuk tanda tangan.");
      }

      validateStatusTransition(form.status as OncallJobStatus, "technician_signing", !!pic, isSpv);

      // Validasi kelengkapan data bersama
      let parsed: OpsTelcoFormData = {};
      try {
        parsed = JSON.parse(form.data);
      } catch {
        parsed = {};
      }

      const requiredKeys = ["dateRequired", "startTime", "endTime", "description"];
      for (const k of requiredKeys) {
        if (!parsed[k] || !parsed[k].trim()) {
          throw new OpsTelcoFormError(422, `Isian '${k}' wajib diisi sebelum data dapat dikunci untuk tanda tangan.`);
        }
      }

      // Pastikan ada setidaknya 1 peserta
      const participants = await tx
        .select()
        .from(opsTelcoFormParticipants)
        .where(eq(opsTelcoFormParticipants.formId, formId));

      if (participants.length === 0) {
        throw new OpsTelcoFormError(422, "Pekerjaan harus memiliki setidaknya satu teknisi (PIC).");
      }

      await tx
        .update(opsTelcoForms)
        .set({
          status: "technician_signing",
          lockedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(opsTelcoForms.id, formId));
    });

    await logOncallAudit(profile.id, "ops_telco.oncall.locked", String(formId));
    const result = await getFullJobDetail(formId, profile);
    return { data: result };
  }, {
    params: t.Object({ id: t.Numeric() })
  })

  // 9. Technician Signs (Individual Digital Signature)
  .post("/:id/sign", async ({ params, body, profile }) => {
    const formId = Number(params.id);

    await db.transaction(async (tx) => {
      const [form] = await tx
        .select()
        .from(opsTelcoForms)
        .where(eq(opsTelcoForms.id, formId))
        .limit(1);

      if (!form || form.formType !== "oncall") {
        throw new OpsTelcoFormError(404, "Job Oncall tidak ditemukan.");
      }

      if (form.status !== "technician_signing") {
        throw new OpsTelcoFormError(
          409,
          "Tanda tangan teknisi hanya dapat dilakukan saat status 'Menunggu Tanda Tangan' (technician_signing)."
        );
      }

      // Pastikan user adalah peserta aktif dalam job ini
      const [participant] = await tx
        .select()
        .from(opsTelcoFormParticipants)
        .where(
          and(
            eq(opsTelcoFormParticipants.formId, formId),
            eq(opsTelcoFormParticipants.userId, profile.id)
          )
        )
        .limit(1);

      if (!participant) {
        throw new OpsTelcoFormError(403, "Anda bukan teknisi yang ditugaskan pada pekerjaan ini.");
      }

      // Cek apakah sudah tanda tangan untuk workflow_version ini
      const [alreadySigned] = await tx
        .select()
        .from(opsTelcoFormSignatures)
        .where(
          and(
            eq(opsTelcoFormSignatures.formId, formId),
            eq(opsTelcoFormSignatures.signerUserId, profile.id),
            eq(opsTelcoFormSignatures.workflowVersion, form.workflowVersion)
          )
        )
        .limit(1);

      if (alreadySigned) {
        throw new OpsTelcoFormError(409, "Anda sudah menandatangani dokumen untuk versi ini.");
      }

      // Simpan file tanda tangan
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

      await tx.insert(opsTelcoFormSignatures).values({
        formId,
        signerUserId: profile.id,
        signerType: "technician",
        workflowVersion: form.workflowVersion,
        nameSnapshot: participant.nameSnapshot,
        kpcIdSnapshot: participant.kpcIdSnapshot,
        signatureFile: filePath,
        signatureSha256: sha256,
        signedPayloadHash: payloadHash
      });
    });

    await logOncallAudit(profile.id, "ops_telco.oncall.signed", String(formId));
    const result = await getFullJobDetail(formId, profile);
    return { data: result };
  }, {
    params: t.Object({ id: t.Numeric() }),
    body: t.Object({
      signatureDataUrl: t.String()
    })
  })

  // 10. Submit Job to Supervisor (PIC only, requires all signatures)
  .post("/:id/submit", async ({ params, profile }) => {
    const formId = Number(params.id);

    await db.transaction(async (tx) => {
      const [form] = await tx
        .select()
        .from(opsTelcoForms)
        .where(eq(opsTelcoForms.id, formId))
        .limit(1);

      if (!form || form.formType !== "oncall") {
        throw new OpsTelcoFormError(404, "Job Oncall tidak ditemukan.");
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

      validateStatusTransition(form.status as OncallJobStatus, "submitted", !!pic || isCreator, isSpv);

      await tx
        .update(opsTelcoForms)
        .set({
          status: "submitted",
          submittedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(opsTelcoForms.id, formId));
    });

    await logOncallAudit(profile.id, "ops_telco.oncall.submitted", String(formId));
    const result = await getFullJobDetail(formId, profile);
    return { data: result };
  }, {
    params: t.Object({ id: t.Numeric() })
  })

  // 11. Supervisor Decision (Approve / Revision / Reject)
  .post("/:id/decision", async ({ params, body, profile }) => {
    const formId = Number(params.id);
    const decision = body.decision;

    if (!profile.permissions.includes("ops_telco.oncall.approve") && !isSupervisor(profile)) {
      throw new OpsTelcoFormError(403, "Anda tidak memiliki izin untuk menyetujui formulir Oncall (ops_telco.oncall.approve).");
    }

    await db.transaction(async (tx) => {
      const [form] = await tx
        .select()
        .from(opsTelcoForms)
        .where(eq(opsTelcoForms.id, formId))
        .limit(1);

      if (!form || form.formType !== "oncall") {
        throw new OpsTelcoFormError(404, "Job Oncall tidak ditemukan.");
      }

      validateStatusTransition(form.status as OncallJobStatus, decision as OncallJobStatus, false, true);

      if (decision === "approved") {
        if (!body.signatureDataUrl) {
          throw new OpsTelcoFormError(422, "Tanda tangan Supervisor wajib diisi saat menyetujui formulir.");
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

    await logOncallAudit(profile.id, `ops_telco.oncall.${decision}`, String(formId));
    const result = await getFullJobDetail(formId, profile);
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

  // 12. Download PDF (Multi-Page, Draft Watermark if not approved)
  .get("/:id/pdf", async ({ params, profile, set }) => {
    const formId = Number(params.id);
    const detail = await getFullJobDetail(formId, profile);

    const supervisorSig = detail.signatures.find(
      (s) => s.signerType === "supervisor" && s.workflowVersion === detail.workflowVersion
    );

    const pdfBuffer = await generateOncallJobPdf({
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

    await logOncallAudit(profile.id, "ops_telco.oncall.pdf_downloaded", String(formId));

    const sanitizedJob = (detail.jobOrderNo || detail.formNumber).replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `Oncall-${sanitizedJob}-${detail.formNumber}.pdf`;

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

  // 13. Get Private Signature File (Auth required, for authorized participants/supervisor only)
  .get("/:id/signatures/:sigId/file", async ({ params, profile, set }) => {
    const formId = Number(params.id);
    const sigId = Number(params.sigId);

    // Verifikasi otorisasi akses ke formulir
    await getFullJobDetail(formId, profile);

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
