import { beforeAll, describe, expect, it } from "bun:test";
import { and, eq } from "drizzle-orm";
import { app } from "../src/index";
import { db } from "../src/db";
import {
  oncallCrewMembers,
  oncallScheduleSlots,
  oncallSchedules,
  opsTelcoForms,
  users
} from "../src/db/schema";
import {
  DEFAULT_CREW,
  ensureDefaultUsersAndCrews,
  generateFullYearSchedule,
  isTechnicianOnCuti,
  PERMANENT_OFFICIALS,
  updateSlotAndCascade,
  updateSlotDates
} from "../src/services/oncall-schedule.service";
import { generateOncallSchedulePdf } from "../src/services/oncall-schedule-pdf.service";

describe("Oncall Schedule Management", () => {
  let supervisorCookie = "";
  let supervisorUser: any = null;

  beforeAll(async () => {
    await ensureDefaultUsersAndCrews();

    // Find supervisor Rahmansyah
    const [spv] = await db
      .select()
      .from(users)
      .where(eq(users.email, PERMANENT_OFFICIALS.telco.email));
    supervisorUser = spv;

    // Login as supervisor
    const loginRes = await app.handle(
      new Request("http://localhost/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: PERMANENT_OFFICIALS.telco.email,
          password: "password123"
        })
      })
    );

    const setCookie = loginRes.headers.get("set-cookie");
    if (setCookie) {
      supervisorCookie = setCookie;
    }
  });

  it("1. memastikan default crew dan supervisor terdaftar di database", async () => {
    const crews = await db.select().from(oncallCrewMembers);
    expect(crews.length).toBeGreaterThanOrEqual(9);

    const telcoCrews = crews.filter((c) => c.crewType === "telco");
    const ospCrews = crews.filter((c) => c.crewType === "osp");

    expect(telcoCrews.length).toBe(5);
    expect(ospCrews.length).toBe(4);

    // Verify supervisor Rahmansyah and Bronson exist
    const [spvTelco] = await db
      .select()
      .from(users)
      .where(eq(users.email, PERMANENT_OFFICIALS.telco.email));
    expect(spvTelco).toBeDefined();
    expect(spvTelco.name).toBe("Rahmansyah");

    const [spvOsp] = await db
      .select()
      .from(users)
      .where(eq(users.email, PERMANENT_OFFICIALS.osp.email));
    expect(spvOsp).toBeDefined();
    expect(spvOsp.name).toBe("Bronson H.");
  });

  it("2. auto-generate jadwal 1 tahun (12 periode, masing-masing 10 slot)", async () => {
    const result = await generateFullYearSchedule(2026, 8, 16, supervisorUser.id);
    expect(result.scheduleIds.length).toBe(12);

    // Check first schedule
    const firstId = result.scheduleIds[0];
    const [firstSched] = await db
      .select()
      .from(oncallSchedules)
      .where(eq(oncallSchedules.id, firstId));
    expect(firstSched).toBeDefined();
    expect(firstSched.year).toBe(2026);
    expect(firstSched.periodIndex).toBe(1);
    expect(firstSched.telcoSupervisorName).toBe("Rahmansyah");
    expect(firstSched.ospSupervisorName).toBe("Bronson H.");

    // Check slots
    const slots = await db
      .select()
      .from(oncallScheduleSlots)
      .where(eq(oncallScheduleSlots.scheduleId, firstId));
    expect(slots.length).toBe(10);

    // Slot 1 dates: 2026-08-16 to 2026-08-18
    const slot1 = slots.find((s) => s.slotNumber === 1);
    expect(slot1).toBeDefined();
    expect(slot1?.startDate).toBe("2026-08-16");
    expect(slot1?.endDate).toBe("2026-08-18");
    expect(slot1?.date1).toBe("2026-08-16");
    expect(slot1?.date2).toBe("2026-08-17");
    expect(slot1?.date3).toBe("2026-08-18");
  });

  it("3. memvalidasi proteksi cuti (Cuti Guard) melompati teknisi yang sedang cuti", async () => {
    // Find Kala
    const [kala] = await db.select().from(users).where(eq(users.email, "kala@mknsite.online"));
    expect(kala).toBeDefined();

    // Create a mock approved cuti for Kala on 2027-01-01 s/d 2027-01-10
    const [insertedCuti] = await db.insert(opsTelcoForms).values({
      formType: "cuti",
      formNumber: `CT-TEST-${Date.now()}`,
      createdBy: kala.id,
      data: JSON.stringify({
        employeeName: "Kala",
        leaveType: "tahunan",
        leaveStartDate: "2027-01-01",
        leaveEndDate: "2027-01-10",
        totalDays: 10,
        reason: "Liburan tahun baru"
      }),
      submittedAt: new Date()
    });

    const checkCuti = await isTechnicianOnCuti(kala.id, "2027-01-02", "2027-01-04");
    expect(checkCuti.onCuti).toBe(true);

    const checkCutiOutside = await isTechnicianOnCuti(kala.id, "2027-02-01", "2027-02-03");
    expect(checkCutiOutside.onCuti).toBe(false);

    // Cleanup mock cuti
    await db.delete(opsTelcoForms).where(eq(opsTelcoForms.id, Number(insertedCuti.insertId)));
  });

  it("4. edit posisi oncall dengan cascade rotation", async () => {
    const [schedule] = await db.select().from(oncallSchedules).limit(1);
    expect(schedule).toBeDefined();

    const slots = await db
      .select()
      .from(oncallScheduleSlots)
      .where(eq(oncallScheduleSlots.scheduleId, schedule.id))
      .orderBy(oncallScheduleSlots.slotNumber);

    const slot2 = slots[1];
    expect(slot2).toBeDefined();

    // Find Indra and Jacky
    const [indra] = await db.select().from(users).where(eq(users.email, "indra@mknsite.online"));
    const [jacky] = await db.select().from(users).where(eq(users.email, "jacky@mknsite.online"));

    // Update slot 2 to Indra and Jacky with cascade
    await updateSlotAndCascade(schedule.id, slot2.id, {
      telcoUserId: indra.id,
      ospUserId: jacky.id,
      cascade: true,
      overrideReason: "Penyesuaian shift"
    });

    // Verify slot 2 is updated
    const [updatedSlot2] = await db
      .select()
      .from(oncallScheduleSlots)
      .where(eq(oncallScheduleSlots.id, slot2.id));
    expect(updatedSlot2.telcoUserId).toBe(indra.id);
    expect(updatedSlot2.ospUserId).toBe(jacky.id);
    expect(updatedSlot2.isOverride).toBe(true);

    // Slot 3 should cascade to the next members after Indra and Jacky
    // Telco after Indra (idx 3) is Imam A. (idx 4)
    // OSP after Jacky (idx 2) is Samsul (idx 3)
    const slot3 = slots[2];
    const [updatedSlot3] = await db
      .select()
      .from(oncallScheduleSlots)
      .where(eq(oncallScheduleSlots.id, slot3.id));

    const [imamA] = await db.select().from(users).where(eq(users.email, "imama@mknsite.online"));
    const [samsul] = await db.select().from(users).where(eq(users.email, "samsul@mknsite.online"));

    expect(updatedSlot3.telcoUserId).toBe(imamA.id);
    expect(updatedSlot3.ospUserId).toBe(samsul.id);
  });

  it("5. penyesuaian tanggal slot (tanggal bisa disesuaikan)", async () => {
    const [schedule] = await db.select().from(oncallSchedules).limit(1);
    const slots = await db
      .select()
      .from(oncallScheduleSlots)
      .where(eq(oncallScheduleSlots.scheduleId, schedule.id))
      .orderBy(oncallScheduleSlots.slotNumber);

    const slot1 = slots[0];
    await updateSlotDates(schedule.id, slot1.id, "2026-08-17", "2026-08-18", "2026-08-19");

    const [updatedSlot1] = await db
      .select()
      .from(oncallScheduleSlots)
      .where(eq(oncallScheduleSlots.id, slot1.id));

    expect(updatedSlot1.date1).toBe("2026-08-17");
    expect(updatedSlot1.date2).toBe("2026-08-18");
    expect(updatedSlot1.date3).toBe("2026-08-19");
    expect(updatedSlot1.startDate).toBe("2026-08-17");
    expect(updatedSlot1.endDate).toBe("2026-08-19");
  });

  it("6. memastikan generator PDF menghasilkan file Letter 612x792 pt valid", async () => {
    const [schedule] = await db.select().from(oncallSchedules).limit(1);
    const slotsRaw = await db
      .select()
      .from(oncallScheduleSlots)
      .where(eq(oncallScheduleSlots.scheduleId, schedule.id))
      .orderBy(oncallScheduleSlots.slotNumber);

    const allUsers = await db.select().from(users);
    const userMap = new Map(allUsers.map((u) => [u.id, u.name]));

    const slots = slotsRaw.map((s) => ({
      slotNumber: s.slotNumber,
      startDate: s.startDate,
      endDate: s.endDate,
      date1: s.date1,
      date2: s.date2,
      date3: s.date3,
      telcoUserId: s.telcoUserId,
      telcoUserName: userMap.get(s.telcoUserId) || "Unknown",
      ospUserId: s.ospUserId,
      ospUserName: userMap.get(s.ospUserId) || "Unknown",
      notes: s.notes
    }));

    const crews = await db.select().from(oncallCrewMembers);
    const telcoCrews = crews
      .filter((c) => c.crewType === "telco")
      .map((c) => ({
        userId: c.userId,
        name: userMap.get(c.userId) || "Unknown",
        crewType: "telco" as const,
        sequenceOrder: c.sequenceOrder
      }));

    const ospCrews = crews
      .filter((c) => c.crewType === "osp")
      .map((c) => ({
        userId: c.userId,
        name: userMap.get(c.userId) || "Unknown",
        crewType: "osp" as const,
        sequenceOrder: c.sequenceOrder
      }));

    const pdfBuffer = await generateOncallSchedulePdf({
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
    });

    expect(pdfBuffer).toBeDefined();
    expect(pdfBuffer.length).toBeGreaterThan(1000);

    // Verify PDF starts with %PDF-
    const header = Buffer.from(pdfBuffer.slice(0, 5)).toString("utf-8");
    expect(header).toBe("%PDF-");
  });
});
