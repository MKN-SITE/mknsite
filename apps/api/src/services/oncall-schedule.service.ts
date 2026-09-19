import { and, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import { db } from "../db";
import {
  accountAliases,
  authAccounts,
  authUsers,
  oncallCrewMembers,
  oncallScheduleSlots,
  oncallSchedules,
  opsTelcoForms,
  roles,
  userRoles,
  users
} from "../db/schema";

export interface DefaultCrewMember {
  name: string;
  email: string;
  phone?: string;
  kpcId?: string;
  crewType: "telco" | "osp";
  sequenceOrder: number;
}

export const DEFAULT_CREW: DefaultCrewMember[] = [
  // Telco Crew (5 members)
  { name: "Kala", email: "kala@mknsite.online", crewType: "telco", sequenceOrder: 1 },
  { name: "Asrianto", email: "asrianto@mknsite.online", crewType: "telco", sequenceOrder: 2 },
  { name: "Januar", email: "januar@mknsite.online", crewType: "telco", sequenceOrder: 3 },
  { name: "Indra", email: "indra@mknsite.online", crewType: "telco", sequenceOrder: 4 },
  { name: "Imam A.", email: "imama@mknsite.online", crewType: "telco", sequenceOrder: 5 },

  // OSP Crew (4 members)
  { name: "Imam T.", email: "imamt@mknsite.online", crewType: "osp", sequenceOrder: 1 },
  { name: "Yusuf", email: "yusuf@mknsite.online", crewType: "osp", sequenceOrder: 2 },
  { name: "Jacky", email: "jacky@mknsite.online", crewType: "osp", sequenceOrder: 3 },
  { name: "Samsul", email: "samsul@mknsite.online", crewType: "osp", sequenceOrder: 4 }
];

export const PERMANENT_OFFICIALS = {
  telco: {
    name: "Rahmansyah",
    phone: "( 0852 4691 9549 )",
    email: "rahmansyah@mknsite.online"
  },
  osp: {
    name: "Bronson H.",
    phone: "(081254700404)",
    email: "bronson@mknsite.online"
  },
  superintendent: {
    name: "( Wanto )",
    email: "wanto@mknsite.online"
  }
};

export const PERMANENT_NOTES = [
  "# Dilarang merubah jadwal Oncall tanpa sepengetahuan atasan",
  "# Tidak keluar kota saat giliran Oncall kecuali emergency dan melapor ke atasan",
  "# Tidak mematikan Handphone pada saat giliran Oncall"
];

/**
 * Ensure default technicians and supervisors exist in users and oncall_crew_members
 */
export async function ensureDefaultUsersAndCrews(): Promise<void> {
  const defaultPassword = "password123";
  const hashedPassword = await Bun.password.hash(defaultPassword, { algorithm: "argon2id" });

  // 1. Get role IDs
  const allRoles = await db.select().from(roles);
  const techRole = allRoles.find((r) => r.slug === "ops-telco-technician");
  const spvRole = allRoles.find((r) => r.slug === "ops-telco-supervisor");

  // Helper to ensure a single user
  const ensureUser = async (name: string, email: string, phone: string | undefined, roleId?: number) => {
    const normalizedEmail = email.trim().toLowerCase();
    const [existing] = await db.select().from(users).where(eq(users.email, normalizedEmail));
    if (existing) return existing.id;

    const [userInsert] = await db.insert(users).values({
      name,
      email: normalizedEmail,
      passwordHash: hashedPassword,
      phone: phone || null,
      accountType: "employee",
      division: "OPS Telco",
      isActive: 1
    });
    const mknUserId = Number(userInsert.insertId);

    const authUserId = crypto.randomUUID();
    await db.insert(authUsers).values({
      id: authUserId,
      mknUserId,
      name,
      email: normalizedEmail,
      emailVerified: true
    });

    await db.insert(authAccounts).values({
      id: crypto.randomUUID(),
      accountId: authUserId,
      providerId: "credential",
      userId: authUserId,
      password: hashedPassword
    });

    if (roleId) {
      await db.insert(userRoles).values({
        userId: mknUserId,
        roleId
      });
    }

    await db.insert(accountAliases).values({
      userId: mknUserId,
      aliasType: "email",
      normalizedValue: normalizedEmail
    });

    return mknUserId;
  };

  // 2. Ensure permanent supervisors & superintendent
  await ensureUser(
    PERMANENT_OFFICIALS.telco.name,
    PERMANENT_OFFICIALS.telco.email,
    PERMANENT_OFFICIALS.telco.phone,
    spvRole?.id
  );
  await ensureUser(
    PERMANENT_OFFICIALS.osp.name,
    PERMANENT_OFFICIALS.osp.email,
    PERMANENT_OFFICIALS.osp.phone,
    spvRole?.id
  );
  await ensureUser(
    "Wanto",
    PERMANENT_OFFICIALS.superintendent.email,
    undefined,
    spvRole?.id
  );

  // 3. Ensure technician crew members
  for (const crew of DEFAULT_CREW) {
    const userId = await ensureUser(crew.name, crew.email, crew.phone, techRole?.id);

    const [existingCrew] = await db
      .select()
      .from(oncallCrewMembers)
      .where(and(eq(oncallCrewMembers.crewType, crew.crewType), eq(oncallCrewMembers.userId, userId)));

    if (!existingCrew) {
      await db.insert(oncallCrewMembers).values({
        crewType: crew.crewType,
        userId,
        sequenceOrder: crew.sequenceOrder,
        isActive: 1
      });
    }
  }
}

/**
 * Check if a technician is on approved cuti during any day of [startDate, endDate]
 */
/**
 * Check if a technician is on approved cuti during any day of [startDate, endDate]
 */
export async function isTechnicianOnCuti(
  userId: number,
  startDateStr: string,
  endDateStr: string
): Promise<{ onCuti: boolean; reason?: string }> {
  const cutiForms = await db
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
        eq(opsTelcoForms.createdBy, userId),
        sql`${opsTelcoForms.submittedAt} IS NOT NULL`,
        or(
          and(
            lte(opsTelcoForms.leaveStartDate, endDateStr),
            gte(opsTelcoForms.leaveEndDate, startDateStr)
          ),
          sql`${opsTelcoForms.leaveStartDate} IS NULL`
        )
      )
    );

  for (const form of cutiForms) {
    if (form.leaveStartDate && form.leaveEndDate) {
      if (form.leaveStartDate <= endDateStr && form.leaveEndDate >= startDateStr) {
        let reason = `Cuti (${form.leaveStartDate} s/d ${form.leaveEndDate})`;
        try {
          const parsed = JSON.parse(form.data);
          if (parsed.reason) reason = parsed.reason;
        } catch {}
        return { onCuti: true, reason };
      }
    } else {
      try {
        const parsed = JSON.parse(form.data);
        const leaveStart = parsed.leaveStartDate;
        const leaveEnd = parsed.leaveEndDate;
        if (leaveStart && leaveEnd) {
          if (leaveStart <= endDateStr && leaveEnd >= startDateStr) {
            return {
              onCuti: true,
              reason: parsed.reason || `Cuti (${leaveStart} s/d ${leaveEnd})`
            };
          }
        }
      } catch {}
    }
  }

  return { onCuti: false };
}

/**
 * Create an in-memory cuti checker for multiple technicians over a date range.
 * Fetches all relevant cuti records in ONE query and returns a synchronous lookup function.
 */
export async function createCutiChecker(
  userIds: number[],
  minStartDate: string,
  maxEndDate: string
): Promise<(userId: number, slotStart: string, slotEnd: string) => { onCuti: boolean; reason?: string }> {
  if (userIds.length === 0) {
    return () => ({ onCuti: false });
  }

  const cutiForms = await db
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
        inArray(opsTelcoForms.createdBy, userIds),
        sql`${opsTelcoForms.submittedAt} IS NOT NULL`,
        or(
          and(
            lte(opsTelcoForms.leaveStartDate, maxEndDate),
            gte(opsTelcoForms.leaveEndDate, minStartDate)
          ),
          sql`${opsTelcoForms.leaveStartDate} IS NULL`
        )
      )
    );

  const userCutiRecords = new Map<number, Array<{ start: string; end: string; reason: string }>>();
  for (const form of cutiForms) {
    let start = form.leaveStartDate;
    let end = form.leaveEndDate;
    let reason = "";

    try {
      const parsed = JSON.parse(form.data);
      if (!start) start = parsed.leaveStartDate;
      if (!end) end = parsed.leaveEndDate;
      reason = parsed.reason || (start && end ? `Cuti (${start} s/d ${end})` : "Cuti");
    } catch {
      reason = start && end ? `Cuti (${start} s/d ${end})` : "Cuti";
    }

    if (start && end) {
      const records = userCutiRecords.get(form.createdBy) || [];
      records.push({ start, end, reason });
      userCutiRecords.set(form.createdBy, records);
    }
  }

  return (userId: number, slotStart: string, slotEnd: string) => {
    const records = userCutiRecords.get(userId);
    if (!records) return { onCuti: false };

    for (const rec of records) {
      if (rec.start <= slotEnd && rec.end >= slotStart) {
        return { onCuti: true, reason: rec.reason };
      }
    }
    return { onCuti: false };
  };
}

/**
 * Format a Date into YYYY-MM-DD string
 */
export function formatDateIso(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Format Date into ID label, e.g. "16-Agu-26"
 */
export function formatDateDisplay(isoStr: string): string {
  const parts = isoStr.split("-");
  if (parts.length !== 3) return isoStr;
  const yearShort = parts[0].slice(2);
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return `${day}-${monthNames[monthIdx] || parts[1]}-${yearShort}`;
}

/**
 * Indonesian month names for period label
 */
const FULL_MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

/**
 * Auto-generate 1-Year schedule (12 monthly periods, each 10 slots of 3 days = 30 days)
 */
export async function generateFullYearSchedule(
  startYear = 2026,
  startMonth = 8, // 1-indexed: 8 = Agustus
  startDay = 16,
  createdById = 1
): Promise<{ scheduleIds: number[] }> {
  await ensureDefaultUsersAndCrews();

  // Load active crew members sorted by sequenceOrder
  const telcoCrews = await db
    .select({
      id: oncallCrewMembers.id,
      userId: oncallCrewMembers.userId,
      order: oncallCrewMembers.sequenceOrder,
      name: users.name
    })
    .from(oncallCrewMembers)
    .innerJoin(users, eq(oncallCrewMembers.userId, users.id))
    .where(and(eq(oncallCrewMembers.crewType, "telco"), eq(oncallCrewMembers.isActive, 1)))
    .orderBy(oncallCrewMembers.sequenceOrder);

  const ospCrews = await db
    .select({
      id: oncallCrewMembers.id,
      userId: oncallCrewMembers.userId,
      order: oncallCrewMembers.sequenceOrder,
      name: users.name
    })
    .from(oncallCrewMembers)
    .innerJoin(users, eq(oncallCrewMembers.userId, users.id))
    .where(and(eq(oncallCrewMembers.crewType, "osp"), eq(oncallCrewMembers.isActive, 1)))
    .orderBy(oncallCrewMembers.sequenceOrder);

  if (telcoCrews.length === 0 || ospCrews.length === 0) {
    throw new Error("Anggota kru Telco dan OSP belum terdaftar.");
  }

  let telcoPointer = 0;
  let ospPointer = 0;
  let currentDate = new Date(startYear, startMonth - 1, startDay);

  const scheduleIds: number[] = [];

  // Pre-fetch all cuti for all crew members across the full 1-year window in 1 single query
  const scheduleStartDate = new Date(startYear, startMonth - 1, startDay);
  const scheduleEndDate = new Date(startYear, startMonth - 1, startDay);
  scheduleEndDate.setDate(scheduleEndDate.getDate() + (12 * 30) + 15);
  const allCrewUserIds = Array.from(new Set([...telcoCrews.map((c) => c.userId), ...ospCrews.map((c) => c.userId)]));
  const cutiChecker = await createCutiChecker(
    allCrewUserIds,
    formatDateIso(scheduleStartDate),
    formatDateIso(scheduleEndDate)
  );

  // Generate 12 consecutive monthly periods
  for (let periodIdx = 1; periodIdx <= 12; periodIdx++) {
    const periodStart = new Date(currentDate);

    // 10 slots of 3 days = 30 days
    const slotConfigs: {
      slotNumber: number;
      startDate: string;
      endDate: string;
      date1: string;
      date2: string;
      date3: string;
      telcoUserId: number;
      ospUserId: number;
      notes?: string;
    }[] = [];

    for (let s = 1; s <= 10; s++) {
      const d1 = new Date(currentDate);
      currentDate.setDate(currentDate.getDate() + 1);
      const d2 = new Date(currentDate);
      currentDate.setDate(currentDate.getDate() + 1);
      const d3 = new Date(currentDate);
      currentDate.setDate(currentDate.getDate() + 1);

      const d1Str = formatDateIso(d1);
      const d2Str = formatDateIso(d2);
      const d3Str = formatDateIso(d3);

      // Select Telco crew with Cuti guard (fast in-memory check)
      let selectedTelcoUserId = telcoCrews[telcoPointer % telcoCrews.length].userId;
      let skippedTelcoNote = "";
      for (let attempt = 0; attempt < telcoCrews.length; attempt++) {
        const candidate = telcoCrews[(telcoPointer + attempt) % telcoCrews.length];
        const cutiStatus = cutiChecker(candidate.userId, d1Str, d3Str);
        if (!cutiStatus.onCuti) {
          selectedTelcoUserId = candidate.userId;
          if (attempt > 0) {
            skippedTelcoNote = `[Telco: ${telcoCrews[telcoPointer % telcoCrews.length].name} sedang cuti]`;
          }
          telcoPointer = (telcoPointer + attempt + 1) % telcoCrews.length;
          break;
        }
      }

      // Select OSP crew with Cuti guard (fast in-memory check)
      let selectedOspUserId = ospCrews[ospPointer % ospCrews.length].userId;
      let skippedOspNote = "";
      for (let attempt = 0; attempt < ospCrews.length; attempt++) {
        const candidate = ospCrews[(ospPointer + attempt) % ospCrews.length];
        const cutiStatus = cutiChecker(candidate.userId, d1Str, d3Str);
        if (!cutiStatus.onCuti) {
          selectedOspUserId = candidate.userId;
          if (attempt > 0) {
            skippedOspNote = `[OSP: ${ospCrews[ospPointer % ospCrews.length].name} sedang cuti]`;
          }
          ospPointer = (ospPointer + attempt + 1) % ospCrews.length;
          break;
        }
      }

      const notes = [skippedTelcoNote, skippedOspNote].filter(Boolean).join(" ") || undefined;

      slotConfigs.push({
        slotNumber: s,
        startDate: d1Str,
        endDate: d3Str,
        date1: d1Str,
        date2: d2Str,
        date3: d3Str,
        telcoUserId: selectedTelcoUserId,
        ospUserId: selectedOspUserId,
        notes
      });
    }

    const periodEnd = new Date(currentDate);
    periodEnd.setDate(periodEnd.getDate() - 1); // last day was date3 of slot 10

    const mStart = FULL_MONTH_NAMES[periodStart.getMonth()];
    const yStart = periodStart.getFullYear();
    const mEnd = FULL_MONTH_NAMES[periodEnd.getMonth()];
    const yEnd = periodEnd.getFullYear();

    const periodLabel = yStart === yEnd
      ? `${mStart} ${yStart} - ${mEnd} ${yEnd}`
      : `${mStart} ${yStart} - ${mEnd} ${yEnd}`;

    const title = `Jadwal On Call OSP & Telco Crew - Periode ${periodLabel}`;

    // Create schedule master record
    const [insertedSchedule] = await db.insert(oncallSchedules).values({
      title,
      periodLabel,
      periodIndex: periodIdx,
      year: startYear,
      startDate: formatDateIso(periodStart),
      endDate: formatDateIso(periodEnd),
      status: "active",
      notes: "Jadwal Oncall Resmi 1 Tahun",
      telcoSupervisorName: PERMANENT_OFFICIALS.telco.name,
      telcoSupervisorPhone: PERMANENT_OFFICIALS.telco.phone,
      ospSupervisorName: PERMANENT_OFFICIALS.osp.name,
      ospSupervisorPhone: PERMANENT_OFFICIALS.osp.phone,
      superintendentName: PERMANENT_OFFICIALS.superintendent.name,
      createdBy: createdById
    });

    const scheduleId = Number(insertedSchedule.insertId);
    scheduleIds.push(scheduleId);

    // Insert 10 slots
    for (const slot of slotConfigs) {
      await db.insert(oncallScheduleSlots).values({
        scheduleId,
        slotNumber: slot.slotNumber,
        startDate: slot.startDate,
        endDate: slot.endDate,
        date1: slot.date1,
        date2: slot.date2,
        date3: slot.date3,
        datesJson: JSON.stringify([slot.date1, slot.date2, slot.date3]),
        telcoUserId: slot.telcoUserId,
        ospUserId: slot.ospUserId,
        isOverride: false,
        notes: slot.notes || null
      });
    }
  }

  return { scheduleIds };
}

/**
 * Update a specific slot's assigned technicians and optionally cascade subsequent rotation
 */
export async function updateSlotAndCascade(
  scheduleId: number,
  slotId: number,
  payload: {
    telcoUserId?: number;
    ospUserId?: number;
    overrideReason?: string;
    notes?: string;
    cascade?: boolean;
  }
): Promise<void> {
  const [targetSlot] = await db
    .select()
    .from(oncallScheduleSlots)
    .where(and(eq(oncallScheduleSlots.id, slotId), eq(oncallScheduleSlots.scheduleId, scheduleId)));

  if (!targetSlot) {
    throw new Error("Slot jadwal tidak ditemukan.");
  }

  const newTelcoUserId = payload.telcoUserId ?? targetSlot.telcoUserId;
  const newOspUserId = payload.ospUserId ?? targetSlot.ospUserId;

  // Validate Cuti guard for updated technicians
  if (payload.telcoUserId) {
    const cutiCheck = await isTechnicianOnCuti(payload.telcoUserId, targetSlot.startDate, targetSlot.endDate);
    if (cutiCheck.onCuti) {
      throw new Error(`Teknisi Telco sedang cuti (${cutiCheck.reason}). Tidak dapat ditugaskan oncall.`);
    }
  }

  if (payload.ospUserId) {
    const cutiCheck = await isTechnicianOnCuti(payload.ospUserId, targetSlot.startDate, targetSlot.endDate);
    if (cutiCheck.onCuti) {
      throw new Error(`Teknisi OSP sedang cuti (${cutiCheck.reason}). Tidak dapat ditugaskan oncall.`);
    }
  }

  // Update this slot
  await db
    .update(oncallScheduleSlots)
    .set({
      telcoUserId: newTelcoUserId,
      ospUserId: newOspUserId,
      isOverride: true,
      overrideReason: payload.overrideReason || "Diubah oleh Supervisor",
      notes: payload.notes || targetSlot.notes,
      updatedAt: new Date()
    })
    .where(eq(oncallScheduleSlots.id, slotId));

  // If cascade is requested, reorder subsequent slots
  if (payload.cascade) {
    const telcoCrews = await db
      .select({ userId: oncallCrewMembers.userId, order: oncallCrewMembers.sequenceOrder })
      .from(oncallCrewMembers)
      .where(and(eq(oncallCrewMembers.crewType, "telco"), eq(oncallCrewMembers.isActive, 1)))
      .orderBy(oncallCrewMembers.sequenceOrder);

    const ospCrews = await db
      .select({ userId: oncallCrewMembers.userId, order: oncallCrewMembers.sequenceOrder })
      .from(oncallCrewMembers)
      .where(and(eq(oncallCrewMembers.crewType, "osp"), eq(oncallCrewMembers.isActive, 1)))
      .orderBy(oncallCrewMembers.sequenceOrder);

    let telcoIdx = telcoCrews.findIndex((c) => c.userId === newTelcoUserId);
    let ospIdx = ospCrews.findIndex((c) => c.userId === newOspUserId);

    if (telcoIdx === -1) telcoIdx = 0;
    if (ospIdx === -1) ospIdx = 0;

    // Get subsequent slots in this schedule
    const laterSlots = await db
      .select()
      .from(oncallScheduleSlots)
      .where(
        and(
          eq(oncallScheduleSlots.scheduleId, scheduleId),
          sql`${oncallScheduleSlots.slotNumber} > ${targetSlot.slotNumber}`
        )
      )
      .orderBy(oncallScheduleSlots.slotNumber);

    for (const s of laterSlots) {
      // Pick next Telco with cuti guard
      let nextTelcoUserId = s.telcoUserId;
      if (payload.telcoUserId) {
        for (let a = 1; a <= telcoCrews.length; a++) {
          const candidate = telcoCrews[(telcoIdx + a) % telcoCrews.length];
          const cuti = await isTechnicianOnCuti(candidate.userId, s.startDate, s.endDate);
          if (!cuti.onCuti) {
            nextTelcoUserId = candidate.userId;
            telcoIdx = (telcoIdx + a) % telcoCrews.length;
            break;
          }
        }
      }

      // Pick next OSP with cuti guard
      let nextOspUserId = s.ospUserId;
      if (payload.ospUserId) {
        for (let a = 1; a <= ospCrews.length; a++) {
          const candidate = ospCrews[(ospIdx + a) % ospCrews.length];
          const cuti = await isTechnicianOnCuti(candidate.userId, s.startDate, s.endDate);
          if (!cuti.onCuti) {
            nextOspUserId = candidate.userId;
            ospIdx = (ospIdx + a) % ospCrews.length;
            break;
          }
        }
      }

      await db
        .update(oncallScheduleSlots)
        .set({
          telcoUserId: nextTelcoUserId,
          ospUserId: nextOspUserId,
          updatedAt: new Date()
        })
        .where(eq(oncallScheduleSlots.id, s.id));
    }
  }
}

/**
 * Customize the dates of a slot (supports 1, 2, 3, 4, 5+ dates, array or variadic arguments)
 */
export async function updateSlotDates(
  scheduleId: number,
  slotId: number,
  datesInput: string[] | string,
  ...rest: string[]
): Promise<void> {
  const dates = Array.isArray(datesInput) ? datesInput : [datesInput, ...rest];
  if (!dates || dates.length === 0) throw new Error("Minimal harus ada 1 tanggal.");
  const d1 = dates[0];
  const d2 = dates.length > 1 ? dates[1] : dates[0];
  const d3 = dates[dates.length - 1];
  const datesJson = JSON.stringify(dates);

  await db
    .update(oncallScheduleSlots)
    .set({
      date1: d1,
      date2: d2,
      date3: d3,
      startDate: d1,
      endDate: d3,
      datesJson,
      isOverride: true,
      overrideReason: "Tanggal disesuaikan manual",
      updatedAt: new Date()
    })
    .where(and(eq(oncallScheduleSlots.id, slotId), eq(oncallScheduleSlots.scheduleId, scheduleId)));
}

/**
 * Add a new slot row to the schedule (e.g. extending period days)
 */
export async function addScheduleSlot(scheduleId: number): Promise<number> {
  const slots = await db
    .select()
    .from(oncallScheduleSlots)
    .where(eq(oncallScheduleSlots.scheduleId, scheduleId))
    .orderBy(oncallScheduleSlots.slotNumber);

  const nextSlotNumber = slots.length > 0 ? Math.max(...slots.map((s) => s.slotNumber)) + 1 : 1;

  let baseDate = new Date();
  if (slots.length > 0) {
    const lastSlot = slots[slots.length - 1];
    const parts = lastSlot.endDate.split("-");
    baseDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    baseDate.setDate(baseDate.getDate() + 1);
  }

  const d1 = new Date(baseDate);
  baseDate.setDate(baseDate.getDate() + 1);
  const d2 = new Date(baseDate);
  baseDate.setDate(baseDate.getDate() + 1);
  const d3 = new Date(baseDate);

  const d1Str = formatDateIso(d1);
  const d2Str = formatDateIso(d2);
  const d3Str = formatDateIso(d3);

  const telcoCrews = await db
    .select()
    .from(oncallCrewMembers)
    .where(and(eq(oncallCrewMembers.crewType, "telco"), eq(oncallCrewMembers.isActive, 1)))
    .orderBy(oncallCrewMembers.sequenceOrder);
  const ospCrews = await db
    .select()
    .from(oncallCrewMembers)
    .where(and(eq(oncallCrewMembers.crewType, "osp"), eq(oncallCrewMembers.isActive, 1)))
    .orderBy(oncallCrewMembers.sequenceOrder);

  const telcoUserId = telcoCrews.length > 0 ? telcoCrews[(nextSlotNumber - 1) % telcoCrews.length].userId : 1;
  const ospUserId = ospCrews.length > 0 ? ospCrews[(nextSlotNumber - 1) % ospCrews.length].userId : 1;

  const [inserted] = await db.insert(oncallScheduleSlots).values({
    scheduleId,
    slotNumber: nextSlotNumber,
    startDate: d1Str,
    endDate: d3Str,
    date1: d1Str,
    date2: d2Str,
    date3: d3Str,
    datesJson: JSON.stringify([d1Str, d2Str, d3Str]),
    telcoUserId,
    ospUserId,
    isOverride: false
  });

  return Number(inserted.insertId);
}

/**
 * Delete a slot row from the schedule
 */
export async function deleteScheduleSlot(scheduleId: number, slotId: number): Promise<void> {
  await db
    .delete(oncallScheduleSlots)
    .where(and(eq(oncallScheduleSlots.id, slotId), eq(oncallScheduleSlots.scheduleId, scheduleId)));
}

/**
 * Update crew member display name or assigned user
 */
export async function updateCrewMember(
  crewId: number,
  payload: { displayName?: string; userId?: number }
): Promise<void> {
  const updateData: { displayName?: string | null; userId?: number; updatedAt: Date } = {
    updatedAt: new Date()
  };
  if (payload.displayName !== undefined) {
    updateData.displayName = payload.displayName.trim() || null;
  }
  if (payload.userId !== undefined) {
    updateData.userId = payload.userId;
  }

  await db.update(oncallCrewMembers).set(updateData).where(eq(oncallCrewMembers.id, crewId));
}

