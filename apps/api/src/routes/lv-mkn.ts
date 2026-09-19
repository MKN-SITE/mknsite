import { Elysia, t } from "elysia";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../db";
import { lvCommissioning, lvGpsInfo, lvOverspeedLogs } from "../db/schema";
import { getAuthenticatedProfile } from "../auth/auth";

export const lvMknRoutes = new Elysia({ prefix: "/lv-mkn" })
  .resolve(async ({ request }) => {
    let profile = await getAuthenticatedProfile(request.headers, "employee");
    if (!profile) {
      profile = await getAuthenticatedProfile(request.headers, "admin");
    }
    return { profile };
  })

  // ==========================================
  // 1. STATS & SUMMARY
  // ==========================================
  .get("/stats", async () => {
    const [gpsCount] = await db.select({ count: sql<number>`count(*)` }).from(lvGpsInfo);
    const [overspeedCount] = await db.select({ count: sql<number>`count(*)` }).from(lvOverspeedLogs);
    const [commissioningCount] = await db.select({ count: sql<number>`count(*)` }).from(lvCommissioning);

    // Hitung unit yang masa berlaku commissioning < 30 hari
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const dateStr = thirtyDaysFromNow.toISOString().split("T")[0];
    const todayStr = new Date().toISOString().split("T")[0];

    const [expiringSoon] = await db
      .select({ count: sql<number>`count(*)` })
      .from(lvCommissioning)
      .where(and(lte(lvCommissioning.validityDate, dateStr), gte(lvCommissioning.validityDate, todayStr)));

    return {
      success: true,
      data: {
        totalGpsUnits: Number(gpsCount?.count || 0),
        totalOverspeedLogs: Number(overspeedCount?.count || 0),
        totalCommissioning: Number(commissioningCount?.count || 0),
        expiringSoonCount: Number(expiringSoon?.count || 0)
      }
    };
  })

  // ==========================================
  // 2. GPS INFO (Tab 3)
  // ==========================================
  .get("/gps-info", async () => {
    const rows = await db.select().from(lvGpsInfo).orderBy(desc(lvGpsInfo.createdAt));
    return { success: true, data: rows };
  })

  .post(
    "/gps-info",
    async ({ body, profile, set }) => {
      try {
        const [existing] = await db.select().from(lvGpsInfo).where(eq(lvGpsInfo.imei, body.imei.trim())).limit(1);
        if (existing) {
          set.status = 400;
          return { success: false, message: `Nomor IMEI ${body.imei} sudah terdaftar!` };
        }

        await db.insert(lvGpsInfo).values({
          imei: body.imei.trim(),
          lvNumber: body.lvNumber.trim(),
          gsmNumber: body.gsmNumber.trim(),
          simProvider: body.simProvider?.trim() || "Telkomsel",
          activeUntil: body.activeUntil || null,
          notes: body.notes?.trim() || null,
          createdBy: profile?.id ? Number(profile.id) : null
        });

        return { success: true, message: "Data IMEI GPS berhasil disimpan" };
      } catch (err: any) {
        set.status = 500;
        return { success: false, message: err?.message || "Gagal menyimpan data GPS" };
      }
    },
    {
      body: t.Object({
        imei: t.String(),
        lvNumber: t.String(),
        gsmNumber: t.String(),
        simProvider: t.Optional(t.String()),
        activeUntil: t.Optional(t.String()),
        notes: t.Optional(t.String())
      })
    }
  )

  .put(
    "/gps-info/:id",
    async ({ params, body, set }) => {
      try {
        const id = Number(params.id);
        await db
          .update(lvGpsInfo)
          .set({
            imei: body.imei.trim(),
            lvNumber: body.lvNumber.trim(),
            gsmNumber: body.gsmNumber.trim(),
            simProvider: body.simProvider?.trim() || "Telkomsel",
            activeUntil: body.activeUntil || null,
            notes: body.notes?.trim() || null,
            updatedAt: new Date()
          })
          .where(eq(lvGpsInfo.id, id));

        return { success: true, message: "Data IMEI GPS berhasil diperbarui" };
      } catch (err: any) {
        set.status = 500;
        return { success: false, message: err?.message || "Gagal memperbarui data" };
      }
    },
    {
      body: t.Object({
        imei: t.String(),
        lvNumber: t.String(),
        gsmNumber: t.String(),
        simProvider: t.Optional(t.String()),
        activeUntil: t.Optional(t.String()),
        notes: t.Optional(t.String())
      })
    }
  )

  .delete("/gps-info/:id", async ({ params, set }) => {
    try {
      const id = Number(params.id);
      await db.delete(lvGpsInfo).where(eq(lvGpsInfo.id, id));
      return { success: true, message: "Data GPS berhasil dihapus" };
    } catch (err: any) {
      set.status = 500;
      return { success: false, message: err?.message || "Gagal menghapus data" };
    }
  })

  // ==========================================
  // 3. LAPORAN OVERSPEED (Tab 2)
  // ==========================================
  .get("/overspeed-logs", async () => {
    const rows = await db.select().from(lvOverspeedLogs).orderBy(desc(lvOverspeedLogs.occurredAt));
    return { success: true, data: rows };
  })

  .post(
    "/overspeed-logs",
    async ({ body, set }) => {
      try {
        await db.insert(lvOverspeedLogs).values({
          lvNumber: body.lvNumber.trim(),
          location: body.location.trim(),
          speed: body.speed,
          speedLimit: body.speedLimit || 60,
          occurredAt: body.occurredAt ? new Date(body.occurredAt) : new Date(),
          driverName: body.driverName?.trim() || null,
          notes: body.notes?.trim() || null
        });

        return { success: true, message: "Laporan Overspeed berhasil ditambahkan" };
      } catch (err: any) {
        set.status = 500;
        return { success: false, message: err?.message || "Gagal menyimpan laporan overspeed" };
      }
    },
    {
      body: t.Object({
        lvNumber: t.String(),
        location: t.String(),
        speed: t.Number(),
        speedLimit: t.Optional(t.Number()),
        occurredAt: t.Optional(t.String()),
        driverName: t.Optional(t.String()),
        notes: t.Optional(t.String())
      })
    }
  )

  // ==========================================
  // 4. COMMISSIONING LV
  // ==========================================
  .get("/commissioning", async () => {
    const rows = await db.select().from(lvCommissioning).orderBy(lvCommissioning.validityDate);

    // Hitung status dinamis berdasarkan tanggal
    const today = new Date();
    const thirtyDaysAhead = new Date();
    thirtyDaysAhead.setDate(today.getDate() + 30);

    const enriched = rows.map((row) => {
      const vDate = new Date(row.validityDate);
      let calculatedStatus = "Aktif";
      const diffTime = vDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        calculatedStatus = "Kedaluwarsa";
      } else if (diffDays <= 30) {
        calculatedStatus = "Segera Habis";
      }

      return {
        ...row,
        daysRemaining: diffDays,
        status: calculatedStatus
      };
    });

    return { success: true, data: enriched };
  })

  .post(
    "/commissioning",
    async ({ body, set }) => {
      try {
        await db.insert(lvCommissioning).values({
          lvNumber: body.lvNumber.trim(),
          kpcCommissioningNo: body.kpcCommissioningNo?.trim() || null,
          validityDate: body.validityDate,
          status: "Aktif",
          reminderEmail: body.reminderEmail?.trim() || null,
          notes: body.notes?.trim() || null
        });

        return { success: true, message: "Data Commissioning LV berhasil disimpan" };
      } catch (err: any) {
        set.status = 500;
        return { success: false, message: err?.message || "Gagal menyimpan commissioning" };
      }
    },
    {
      body: t.Object({
        lvNumber: t.String(),
        kpcCommissioningNo: t.Optional(t.String()),
        validityDate: t.String(),
        reminderEmail: t.Optional(t.String()),
        notes: t.Optional(t.String())
      })
    }
  )

  .put(
    "/commissioning/:id",
    async ({ params, body, set }) => {
      try {
        const id = Number(params.id);
        await db
          .update(lvCommissioning)
          .set({
            lvNumber: body.lvNumber.trim(),
            kpcCommissioningNo: body.kpcCommissioningNo?.trim() || null,
            validityDate: body.validityDate,
            reminderEmail: body.reminderEmail?.trim() || null,
            notes: body.notes?.trim() || null,
            updatedAt: new Date()
          })
          .where(eq(lvCommissioning.id, id));

        return { success: true, message: "Data Commissioning LV berhasil diperbarui" };
      } catch (err: any) {
        set.status = 500;
        return { success: false, message: err?.message || "Gagal memperbarui data" };
      }
    },
    {
      body: t.Object({
        lvNumber: t.String(),
        kpcCommissioningNo: t.Optional(t.String()),
        validityDate: t.String(),
        reminderEmail: t.Optional(t.String()),
        notes: t.Optional(t.String())
      })
    }
  )

  .delete("/commissioning/:id", async ({ params, set }) => {
    try {
      const id = Number(params.id);
      await db.delete(lvCommissioning).where(eq(lvCommissioning.id, id));
      return { success: true, message: "Data Commissioning berhasil dihapus" };
    } catch (err: any) {
      set.status = 500;
      return { success: false, message: err?.message || "Gagal menghapus data" };
    }
  })

  // Trigger manual cek reminder email (1 bulan sebelum habis)
  .post("/commissioning/check-reminders", async () => {
    const today = new Date();
    const thirtyDaysAhead = new Date();
    thirtyDaysAhead.setDate(today.getDate() + 30);

    const rows = await db.select().from(lvCommissioning);
    const triggered: string[] = [];

    for (const row of rows) {
      const vDate = new Date(row.validityDate);
      const diffTime = vDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays >= 0 && diffDays <= 30) {
        triggered.push(row.lvNumber);
        await db
          .update(lvCommissioning)
          .set({ lastReminderSentAt: new Date() })
          .where(eq(lvCommissioning.id, row.id));
      }
    }

    return {
      success: true,
      message: `Pemeriksaan selesai. ${triggered.length} unit mendekati masa berlaku 30 hari.`,
      units: triggered
    };
  });
