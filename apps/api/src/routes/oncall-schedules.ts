import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { getAuthenticatedProfile } from "../auth/auth";
import type { AuthenticatedProfile } from "../auth/types";
import { db } from "../db";
import {
  oncallCrewMembers,
  oncallScheduleSlots,
  oncallSchedules,
  users
} from "../db/schema";
import {
  addScheduleSlot,
  createCutiChecker,
  deleteScheduleSlot,
  ensureDefaultUsersAndCrews,
  generateFullYearSchedule,
  isTechnicianOnCuti,
  updateCrewMember,
  updateSlotAndCascade,
  updateSlotDates
} from "../services/oncall-schedule.service";
import { generateOncallSchedulePdf, type OncallCrewDto, type OncallPdfData, type OncallSlotDto } from "../services/oncall-schedule-pdf.service";

const canManageSchedule = (profile: AuthenticatedProfile) =>
  profile.permissions.includes("ops_telco.schedule.manage") ||
  profile.roles.includes("ops-telco-supervisor") ||
  profile.roles.includes("administrator") ||
  profile.roles.includes("superadmin");

const canViewSchedule = (profile: AuthenticatedProfile) =>
  profile.permissions.includes("ops_telco.schedule.view") ||
  profile.permissions.includes("ops_telco.schedule.manage") ||
  profile.roles.includes("ops-telco-technician") ||
  profile.roles.includes("ops-telco-supervisor") ||
  profile.roles.includes("administrator") ||
  profile.roles.includes("superadmin");

export const oncallScheduleRoutes = new Elysia({ prefix: "/ops-telco/oncall-schedules" })
  // 1. List all schedules
  .get("/", async ({ request, query, status }) => {
    const profile = await getAuthenticatedProfile(request.headers, "employee");
    if (!profile) return status(401, { message: "Sesi tidak valid." });
    if (!canViewSchedule(profile)) return status(403, { message: "Akses ditolak." });

    const year = query.year ? parseInt(query.year, 10) : undefined;

    let queryBuilder = db
      .select()
      .from(oncallSchedules)
      .orderBy(asc(oncallSchedules.year), asc(oncallSchedules.periodIndex));

    const results = year
      ? await queryBuilder.where(eq(oncallSchedules.year, year))
      : await queryBuilder;

    return { data: results };
  })

  // 2. Get schedule detail with slots and crew
  .get("/:id", async ({ params, request, status }) => {
    const profile = await getAuthenticatedProfile(request.headers, "employee");
    if (!profile) return status(401, { message: "Sesi tidak valid." });
    if (!canViewSchedule(profile)) return status(403, { message: "Akses ditolak." });

    const scheduleId = parseInt(params.id, 10);
    const [schedule] = await db
      .select()
      .from(oncallSchedules)
      .where(eq(oncallSchedules.id, scheduleId));

    if (!schedule) {
      return status(404, { message: "Jadwal oncall tidak ditemukan." });
    }

    // Load slots with user names
    const slotsRaw = await db
      .select({
        id: oncallScheduleSlots.id,
        slotNumber: oncallScheduleSlots.slotNumber,
        startDate: oncallScheduleSlots.startDate,
        endDate: oncallScheduleSlots.endDate,
        date1: oncallScheduleSlots.date1,
        date2: oncallScheduleSlots.date2,
        date3: oncallScheduleSlots.date3,
        datesJson: oncallScheduleSlots.datesJson,
        telcoUserId: oncallScheduleSlots.telcoUserId,
        ospUserId: oncallScheduleSlots.ospUserId,
        isOverride: oncallScheduleSlots.isOverride,
        overrideReason: oncallScheduleSlots.overrideReason,
        notes: oncallScheduleSlots.notes
      })
      .from(oncallScheduleSlots)
      .where(eq(oncallScheduleSlots.scheduleId, scheduleId))
      .orderBy(asc(oncallScheduleSlots.slotNumber));

    // Check cuti status and get user names for slot participants only (avoid full-table scan on users)
    const allSlotUserIds = Array.from(new Set(slotsRaw.flatMap((s) => [s.telcoUserId, s.ospUserId]).filter(Boolean)));
    const slotUsers = allSlotUserIds.length > 0
      ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, allSlotUserIds))
      : [];
    const userMap = new Map(slotUsers.map((u) => [u.id, u.name]));

    const minDate = slotsRaw.length > 0 ? slotsRaw[0].startDate : "2000-01-01";
    const maxDate = slotsRaw.length > 0 ? slotsRaw[slotsRaw.length - 1].endDate : "2099-12-31";
    const checkCuti = await createCutiChecker(allSlotUserIds, minDate, maxDate);

    const slots = slotsRaw.map((s) => {
      const telcoCuti = checkCuti(s.telcoUserId, s.startDate, s.endDate);
      const ospCuti = checkCuti(s.ospUserId, s.startDate, s.endDate);

      let parsedDates: string[] = [];
      if (s.datesJson) {
        try {
          parsedDates = JSON.parse(s.datesJson);
        } catch {}
      }
      if (!parsedDates || parsedDates.length === 0) {
        parsedDates = [s.date1, s.date2, s.date3].filter(Boolean);
      }

      return {
        ...s,
        dates: parsedDates,
        telcoUserName: userMap.get(s.telcoUserId) || "Unknown",
        ospUserName: userMap.get(s.ospUserId) || "Unknown",
        telcoOnCuti: telcoCuti.onCuti,
        telcoCutiReason: telcoCuti.reason,
        ospOnCuti: ospCuti.onCuti,
        ospCutiReason: ospCuti.reason
      };
    });

    // Get active crews
    const crewsRaw = await db
      .select({
        id: oncallCrewMembers.id,
        userId: oncallCrewMembers.userId,
        crewType: oncallCrewMembers.crewType,
        sequenceOrder: oncallCrewMembers.sequenceOrder,
        displayName: oncallCrewMembers.displayName,
        name: users.name
      })
      .from(oncallCrewMembers)
      .innerJoin(users, eq(oncallCrewMembers.userId, users.id))
      .where(eq(oncallCrewMembers.isActive, 1))
      .orderBy(asc(oncallCrewMembers.sequenceOrder));

    const telcoCrews = crewsRaw
      .filter((c) => c.crewType === "telco")
      .map((c) => ({
        ...c,
        name: c.displayName || c.name
      }));

    const ospCrews = crewsRaw
      .filter((c) => c.crewType === "osp")
      .map((c) => ({
        ...c,
        name: c.displayName || c.name
      }));

    return {
      schedule,
      slots,
      telcoCrews,
      ospCrews
    };
  })

  // 3. Auto-generate 1-Year schedule
  .post("/generate-year", async ({ request, body, status }) => {
    const profile = await getAuthenticatedProfile(request.headers, "employee");
    if (!profile) return status(401, { message: "Sesi tidak valid." });
    if (!canManageSchedule(profile)) {
      return status(403, { message: "Akses ditolak. Memerlukan izin supervisor oncall." });
    }

    const { startYear = 2026, startMonth = 8, startDay = 16 } = (body || {}) as {
      startYear?: number;
      startMonth?: number;
      startDay?: number;
    };

    try {
      const result = await generateFullYearSchedule(startYear, startMonth, startDay, profile.id);
      return {
        message: "Berhasil membuat jadwal oncall 1 tahun penuh.",
        scheduleIds: result.scheduleIds
      };
    } catch (err: any) {
      console.error("Failed to generate 1-year oncall schedule", err);
      return status(500, { message: err.message || "Gagal membuat jadwal oncall." });
    }
  })

  // 4. Update single slot (with cascade option)
  .put("/:id/slots/:slotId", async ({ params, request, body, status }) => {
    const profile = await getAuthenticatedProfile(request.headers, "employee");
    if (!profile) return status(401, { message: "Sesi tidak valid." });
    if (!canManageSchedule(profile)) {
      return status(403, { message: "Akses ditolak. Memerlukan izin supervisor oncall." });
    }

    const scheduleId = parseInt(params.id, 10);
    const slotId = parseInt(params.slotId, 10);
    const payload = body as {
      telcoUserId?: number;
      ospUserId?: number;
      overrideReason?: string;
      notes?: string;
      cascade?: boolean;
    };

    try {
      await updateSlotAndCascade(scheduleId, slotId, payload);
      return { message: "Slot jadwal berhasil diperbarui." };
    } catch (err: any) {
      console.error("Failed to update slot", err);
      return status(400, { message: err.message || "Gagal memperbarui slot jadwal." });
    }
  })

  // 4b. Quick move Oncall to another technician in this slot
  .put("/:id/slots/:slotId/move-oncall", async ({ params, request, body, status }) => {
    const profile = await getAuthenticatedProfile(request.headers, "employee");
    if (!profile) return status(401, { message: "Sesi tidak valid." });
    if (!canManageSchedule(profile)) {
      return status(403, { message: "Akses ditolak. Memerlukan izin supervisor oncall." });
    }

    const scheduleId = parseInt(params.id, 10);
    const slotId = parseInt(params.slotId, 10);
    const { crewType, targetUserId, cascade = false } = body as {
      crewType: "telco" | "osp";
      targetUserId: number;
      cascade?: boolean;
    };

    if (!targetUserId || !crewType) {
      return status(400, { message: "Target teknisi dan tipe kru wajib diisi." });
    }

    try {
      const payload =
        crewType === "telco"
          ? { telcoUserId: targetUserId, cascade, overrideReason: "Pemindahan oncall interaktif" }
          : { ospUserId: targetUserId, cascade, overrideReason: "Pemindahan oncall interaktif" };

      await updateSlotAndCascade(scheduleId, slotId, payload);
      return { message: "Posisi oncall berhasil dipindahkan." };
    } catch (err: any) {
      console.error("Failed to move oncall", err);
      return status(400, { message: err.message || "Gagal memindahkan posisi oncall." });
    }
  })

  // 5. Update slot dates (tanggal bisa disesuaikan, fleksibel 1 s/d 5+ hari)
  .put("/:id/slots/:slotId/dates", async ({ params, request, body, status }) => {
    const profile = await getAuthenticatedProfile(request.headers, "employee");
    if (!profile) return status(401, { message: "Sesi tidak valid." });
    if (!canManageSchedule(profile)) {
      return status(403, { message: "Akses ditolak. Memerlukan izin supervisor oncall." });
    }

    const scheduleId = parseInt(params.id, 10);
    const slotId = parseInt(params.slotId, 10);
    const bodyObj = body as { dates?: string[]; date1?: string; date2?: string; date3?: string };
    const dates = bodyObj.dates || [bodyObj.date1, bodyObj.date2, bodyObj.date3].filter(Boolean) as string[];

    if (!dates || dates.length === 0) {
      return status(400, { message: "Harap masukkan minimal 1 tanggal." });
    }

    try {
      await updateSlotDates(scheduleId, slotId, dates);
      return { message: "Tanggal slot berhasil disesuaikan." };
    } catch (err: any) {
      console.error("Failed to update slot dates", err);
      return status(400, { message: err.message || "Gagal memperbarui tanggal slot." });
    }
  })

  // 5b. Add a new slot row to extend period days
  .post("/:id/slots", async ({ params, request, status }) => {
    const profile = await getAuthenticatedProfile(request.headers, "employee");
    if (!profile) return status(401, { message: "Sesi tidak valid." });
    if (!canManageSchedule(profile)) {
      return status(403, { message: "Akses ditolak. Memerlukan izin supervisor oncall." });
    }

    const scheduleId = parseInt(params.id, 10);
    try {
      const newSlotId = await addScheduleSlot(scheduleId);
      return { message: "Baris slot baru berhasil ditambahkan.", slotId: newSlotId };
    } catch (err: any) {
      console.error("Failed to add slot", err);
      return status(500, { message: err.message || "Gagal menambah baris slot." });
    }
  })

  // 5c. Delete a slot row
  .delete("/:id/slots/:slotId", async ({ params, request, status }) => {
    const profile = await getAuthenticatedProfile(request.headers, "employee");
    if (!profile) return status(401, { message: "Sesi tidak valid." });
    if (!canManageSchedule(profile)) {
      return status(403, { message: "Akses ditolak. Memerlukan izin supervisor oncall." });
    }

    const scheduleId = parseInt(params.id, 10);
    const slotId = parseInt(params.slotId, 10);
    try {
      await deleteScheduleSlot(scheduleId, slotId);
      return { message: "Baris slot berhasil dihapus." };
    } catch (err: any) {
      console.error("Failed to delete slot", err);
      return status(500, { message: err.message || "Gagal menghapus slot." });
    }
  })

  // 5d. Update crew member (ganti nama / ganti akun pengguna)
  .put("/crew-members/:crewId", async ({ params, request, body, status }) => {
    const profile = await getAuthenticatedProfile(request.headers, "employee");
    if (!profile) return status(401, { message: "Sesi tidak valid." });
    if (!canManageSchedule(profile)) {
      return status(403, { message: "Akses ditolak. Memerlukan izin supervisor oncall." });
    }

    const crewId = parseInt(params.crewId, 10);
    const { displayName, userId } = body as { displayName?: string; userId?: number };

    try {
      await updateCrewMember(crewId, { displayName, userId });
      return { message: "Anggota kru berhasil diperbarui." };
    } catch (err: any) {
      console.error("Failed to update crew member", err);
      return status(400, { message: err.message || "Gagal memperbarui anggota kru." });
    }
  })

  // 6. Download PDF (matching jadwal oncall.pdf)
  .get("/:id/pdf", async ({ params, request, status, set }) => {
    const profile = await getAuthenticatedProfile(request.headers, "employee");
    if (!profile) return status(401, { message: "Sesi tidak valid." });
    if (!canViewSchedule(profile)) return status(403, { message: "Akses ditolak." });

    const scheduleId = parseInt(params.id, 10);
    const [schedule] = await db
      .select()
      .from(oncallSchedules)
      .where(eq(oncallSchedules.id, scheduleId));

    if (!schedule) {
      return status(404, { message: "Jadwal oncall tidak ditemukan." });
    }

    // Load slots with user names
    const slotsRaw = await db
      .select({
        id: oncallScheduleSlots.id,
        slotNumber: oncallScheduleSlots.slotNumber,
        startDate: oncallScheduleSlots.startDate,
        endDate: oncallScheduleSlots.endDate,
        date1: oncallScheduleSlots.date1,
        date2: oncallScheduleSlots.date2,
        date3: oncallScheduleSlots.date3,
        datesJson: oncallScheduleSlots.datesJson,
        telcoUserId: oncallScheduleSlots.telcoUserId,
        ospUserId: oncallScheduleSlots.ospUserId,
        notes: oncallScheduleSlots.notes
      })
      .from(oncallScheduleSlots)
      .where(eq(oncallScheduleSlots.scheduleId, scheduleId))
      .orderBy(asc(oncallScheduleSlots.slotNumber));

    const allSlotUserIds = Array.from(new Set(slotsRaw.flatMap((s) => [s.telcoUserId, s.ospUserId]).filter(Boolean)));
    const slotUsers = allSlotUserIds.length > 0
      ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, allSlotUserIds))
      : [];
    const userMap = new Map(slotUsers.map((u) => [u.id, u.name]));

    const slots: OncallSlotDto[] = slotsRaw.map((s) => {
      let dates: string[] = [];
      if (s.datesJson) {
        try {
          dates = JSON.parse(s.datesJson);
        } catch {}
      }
      if (!dates || dates.length === 0) {
        dates = [s.date1, s.date2, s.date3].filter(Boolean);
      }
      return {
        slotNumber: s.slotNumber,
        startDate: s.startDate,
        endDate: s.endDate,
        date1: s.date1,
        date2: s.date2,
        date3: s.date3,
        dates,
        telcoUserId: s.telcoUserId,
        telcoUserName: userMap.get(s.telcoUserId) || "Unknown",
        ospUserId: s.ospUserId,
        ospUserName: userMap.get(s.ospUserId) || "Unknown",
        notes: s.notes
      };
    });

    // Get active crews
    const crewsRaw = await db
      .select({
        id: oncallCrewMembers.id,
        userId: oncallCrewMembers.userId,
        crewType: oncallCrewMembers.crewType,
        sequenceOrder: oncallCrewMembers.sequenceOrder,
        displayName: oncallCrewMembers.displayName,
        name: users.name
      })
      .from(oncallCrewMembers)
      .innerJoin(users, eq(oncallCrewMembers.userId, users.id))
      .where(eq(oncallCrewMembers.isActive, 1))
      .orderBy(asc(oncallCrewMembers.sequenceOrder));

    const telcoCrews: OncallCrewDto[] = crewsRaw
      .filter((c) => c.crewType === "telco")
      .map((c) => ({
        userId: c.userId,
        name: c.displayName || c.name,
        displayName: c.displayName,
        crewType: "telco",
        sequenceOrder: c.sequenceOrder
      }));

    const ospCrews: OncallCrewDto[] = crewsRaw
      .filter((c) => c.crewType === "osp")
      .map((c) => ({
        userId: c.userId,
        name: c.displayName || c.name,
        displayName: c.displayName,
        crewType: "osp",
        sequenceOrder: c.sequenceOrder
      }));

    const pdfData: OncallPdfData = {
      title: schedule.title,
      periodLabel: schedule.periodLabel,
      year: schedule.year,
      telcoSupervisorName: schedule.telcoSupervisorName,
      telcoSupervisorPhone: schedule.telcoSupervisorPhone,
      ospSupervisorName: schedule.ospSupervisorName,
      ospSupervisorPhone: schedule.ospSupervisorPhone,
      superintendentName: schedule.superintendentName,
      telcoCrews,
      ospCrews,
      slots
    };

    const pdfBuffer = await generateOncallSchedulePdf(pdfData);

    set.headers["Content-Type"] = "application/pdf";
    set.headers["Content-Disposition"] = `inline; filename="jadwal oncall.pdf"`;

    return new Response(pdfBuffer as any, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="jadwal oncall.pdf"`
      }
    });
  })

  // 7. Get crew members
  .get("/crew-members", async ({ request, status }) => {
    const profile = await getAuthenticatedProfile(request.headers, "employee");
    if (!profile) return status(401, { message: "Sesi tidak valid." });
    if (!canViewSchedule(profile)) return status(403, { message: "Akses ditolak." });

    const crews = await db
      .select({
        id: oncallCrewMembers.id,
        userId: oncallCrewMembers.userId,
        crewType: oncallCrewMembers.crewType,
        sequenceOrder: oncallCrewMembers.sequenceOrder,
        isActive: oncallCrewMembers.isActive,
        name: users.name,
        email: users.email,
        phone: users.phone
      })
      .from(oncallCrewMembers)
      .innerJoin(users, eq(oncallCrewMembers.userId, users.id))
      .orderBy(asc(oncallCrewMembers.crewType), asc(oncallCrewMembers.sequenceOrder));

    return { data: crews };
  })

  // 8. Check cuti for a user
  .get("/check-cuti", async ({ request, query, status }) => {
    const profile = await getAuthenticatedProfile(request.headers, "employee");
    if (!profile) return status(401, { message: "Sesi tidak valid." });

    const userId = parseInt(query.userId || "0", 10);
    const startDate = query.startDate || "";
    const endDate = query.endDate || "";

    if (!userId || !startDate || !endDate) {
      return status(400, { message: "Parameter userId, startDate, dan endDate wajib diisi." });
    }

    const cutiResult = await isTechnicianOnCuti(userId, startDate, endDate);
    return cutiResult;
  })

  // 9. List selectable users for crew
  .get("/users-list", async ({ request, status }) => {
    const profile = await getAuthenticatedProfile(request.headers, "employee");
    if (!profile) return status(401, { message: "Sesi tidak valid." });
    if (!canManageSchedule(profile)) return status(403, { message: "Akses ditolak." });

    const userList = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        division: users.division,
        phone: users.phone
      })
      .from(users)
      .where(eq(users.isActive, 1))
      .orderBy(asc(users.name));

    return { data: userList };
  });
