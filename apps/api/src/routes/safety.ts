import { Elysia, t } from "elysia";
import { and, desc, eq, sql } from "drizzle-orm";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { db } from "../db";
import { safetyEmployeeTrainings, safetyMessages, safetyPermits, safetyTrainings } from "../db/schema";
import { getAuthenticatedProfile } from "../auth/auth";

export const safetyRoutes = new Elysia({ prefix: "/safety" })
  .resolve(async ({ request }) => {
    let profile = await getAuthenticatedProfile(request.headers, "employee");
    if (!profile) {
      profile = await getAuthenticatedProfile(request.headers, "admin");
    }
    return { profile };
  })

  // ==========================================
  // 1. STATS & OVERVIEW
  // ==========================================
  .get("/stats", async () => {
    const [permitCount] = await db.select({ count: sql<number>`count(*)` }).from(safetyPermits);
    const [activePermits] = await db
      .select({ count: sql<number>`count(*)` })
      .from(safetyPermits)
      .where(eq(safetyPermits.status, "Disetujui"));
    const [trainingRecords] = await db.select({ count: sql<number>`count(*)` }).from(safetyEmployeeTrainings);
    const [messagesCount] = await db.select({ count: sql<number>`count(*)` }).from(safetyMessages);

    return {
      success: true,
      data: {
        totalPermits: Number(permitCount?.count || 0),
        activePermits: Number(activePermits?.count || 0),
        totalTrainingRecords: Number(trainingRecords?.count || 0),
        totalSafetyMessages: Number(messagesCount?.count || 0)
      }
    };
  })

  // ==========================================
  // 2. PENGURUSAN PERMIT KPC
  // ==========================================
  .get("/permits", async ({ query }) => {
    let rows = await db.select().from(safetyPermits).orderBy(desc(safetyPermits.createdAt));

    if (query?.type) {
      rows = rows.filter((r) => r.permitType.toLowerCase() === query.type?.toLowerCase());
    }
    if (query?.status) {
      rows = rows.filter((r) => r.status.toLowerCase() === query.status?.toLowerCase());
    }

    return { success: true, data: rows };
  }, {
    query: t.Optional(t.Object({
      type: t.Optional(t.String()),
      status: t.Optional(t.String())
    }))
  })

  .post(
    "/permits",
    async ({ body, profile, set }) => {
      try {
        const permitNo = body.permitNumber.trim() || `PRM-${Date.now().toString().slice(-6)}`;
        await db.insert(safetyPermits).values({
          permitNumber: permitNo,
          permitType: body.permitType,
          title: body.title.trim(),
          location: body.location.trim(),
          gpsCoordinates: body.gpsCoordinates?.trim() || null,
          startDate: body.startDate || null,
          endDate: body.endDate || null,
          status: body.status || "Draft",
          picName: body.picName?.trim() || null,
          picPhone: body.picPhone?.trim() || null,
          scannedDocUrl: body.scannedDocUrl?.trim() || null,
          description: body.description?.trim() || null,
          additionalData: body.additionalData ? JSON.stringify(body.additionalData) : null,
          createdBy: profile?.id ? Number(profile.id) : null
        });

        return { success: true, message: "Permit berhasil dibuat" };
      } catch (err: any) {
        set.status = 500;
        return { success: false, message: err?.message || "Gagal membuat permit" };
      }
    },
    {
      body: t.Object({
        permitNumber: t.String(),
        permitType: t.String(),
        title: t.String(),
        location: t.String(),
        gpsCoordinates: t.Optional(t.String()),
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
        status: t.Optional(t.String()),
        picName: t.Optional(t.String()),
        picPhone: t.Optional(t.String()),
        scannedDocUrl: t.Optional(t.String()),
        description: t.Optional(t.String()),
        additionalData: t.Optional(t.Any())
      })
    }
  )

  .put(
    "/permits/:id",
    async ({ params, body, set }) => {
      try {
        const id = Number(params.id);
        await db
          .update(safetyPermits)
          .set({
            permitNumber: body.permitNumber.trim(),
            permitType: body.permitType,
            title: body.title.trim(),
            location: body.location.trim(),
            gpsCoordinates: body.gpsCoordinates?.trim() || null,
            startDate: body.startDate || null,
            endDate: body.endDate || null,
            status: body.status || "Draft",
            picName: body.picName?.trim() || null,
            picPhone: body.picPhone?.trim() || null,
            scannedDocUrl: body.scannedDocUrl?.trim() || null,
            description: body.description?.trim() || null,
            additionalData: body.additionalData ? JSON.stringify(body.additionalData) : null,
            updatedAt: new Date()
          })
          .where(eq(safetyPermits.id, id));

        return { success: true, message: "Data Permit berhasil diperbarui" };
      } catch (err: any) {
        set.status = 500;
        return { success: false, message: err?.message || "Gagal memperbarui permit" };
      }
    },
    {
      body: t.Object({
        permitNumber: t.String(),
        permitType: t.String(),
        title: t.String(),
        location: t.String(),
        gpsCoordinates: t.Optional(t.String()),
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
        status: t.Optional(t.String()),
        picName: t.Optional(t.String()),
        picPhone: t.Optional(t.String()),
        scannedDocUrl: t.Optional(t.String()),
        description: t.Optional(t.String()),
        additionalData: t.Optional(t.Any())
      })
    }
  )

  .delete("/permits/:id", async ({ params, set }) => {
    try {
      const id = Number(params.id);
      await db.delete(safetyPermits).where(eq(safetyPermits.id, id));
      return { success: true, message: "Permit berhasil dihapus" };
    } catch (err: any) {
      set.status = 500;
      return { success: false, message: err?.message || "Gagal menghapus permit" };
    }
  })

  // ==========================================
  // 3. MATRIX TRAINING
  // ==========================================
  .get("/trainings/courses", async () => {
    let courses = await db.select().from(safetyTrainings);
    return { success: true, data: courses };
  })

  .get("/trainings/matrix", async () => {
    const courses = await db.select().from(safetyTrainings);
    const records = await db.select().from(safetyEmployeeTrainings);

    // Group by badgeNumber
    const employeeMap = new Map<string, {
      badgeNumber: string;
      employeeName: string;
      positionTitle: string | null;
      department: string | null;
      trainings: Record<string, { status: string; trainingDate: string | null; notes: string | null }>;
    }>();

    for (const rec of records) {
      if (!employeeMap.has(rec.badgeNumber)) {
        employeeMap.set(rec.badgeNumber, {
          badgeNumber: rec.badgeNumber,
          employeeName: rec.employeeName,
          positionTitle: rec.positionTitle,
          department: rec.department,
          trainings: {}
        });
      }
      const emp = employeeMap.get(rec.badgeNumber)!;
      emp.trainings[rec.courseCode] = {
        status: rec.status,
        trainingDate: rec.trainingDate,
        notes: rec.notes
      };
    }

    return {
      success: true,
      courses,
      employees: Array.from(employeeMap.values())
    };
  })

  .post(
    "/trainings/record",
    async ({ body, set }) => {
      try {
        const [existing] = await db
          .select()
          .from(safetyEmployeeTrainings)
          .where(
            and(
              eq(safetyEmployeeTrainings.badgeNumber, body.badgeNumber.trim()),
              eq(safetyEmployeeTrainings.courseCode, body.courseCode.trim())
            )
          )
          .limit(1);

        if (existing) {
          await db
            .update(safetyEmployeeTrainings)
            .set({
              status: body.status,
              trainingDate: body.trainingDate || null,
              notes: body.notes?.trim() || null,
              updatedAt: new Date()
            })
            .where(eq(safetyEmployeeTrainings.id, existing.id));
        } else {
          await db.insert(safetyEmployeeTrainings).values({
            badgeNumber: body.badgeNumber.trim(),
            employeeName: body.employeeName.trim(),
            positionTitle: body.positionTitle?.trim() || null,
            department: body.department?.trim() || "Ops",
            courseCode: body.courseCode.trim(),
            status: body.status,
            trainingDate: body.trainingDate || null,
            notes: body.notes?.trim() || null
          });
        }

        return { success: true, message: "Catatan training berhasil disimpan" };
      } catch (err: any) {
        set.status = 500;
        return { success: false, message: err?.message || "Gagal menyimpan catatan training" };
      }
    },
    {
      body: t.Object({
        badgeNumber: t.String(),
        employeeName: t.String(),
        positionTitle: t.Optional(t.String()),
        department: t.Optional(t.String()),
        courseCode: t.String(),
        status: t.String(),
        trainingDate: t.Optional(t.String()),
        notes: t.Optional(t.String())
      })
    }
  )

  // Auto-seed matrix from CSV template if empty
  .post("/trainings/seed-from-template", async () => {
    const csvPaths = [
      resolve(process.cwd(), "form-templates/Safety/Matrix Training/Matrix training update juli 26(EMPLOYEES REV 2026).csv"),
      resolve("/app/form-templates/Safety/Matrix Training/Matrix training update juli 26(EMPLOYEES REV 2026).csv"),
      resolve("/app/apps/web/form-templates/Safety/Matrix Training/Matrix training update juli 26(EMPLOYEES REV 2026).csv")
    ];

    let foundPath = "";
    for (const p of csvPaths) {
      if (existsSync(p)) {
        foundPath = p;
        break;
      }
    }

    if (!foundPath) {
      return { success: false, message: "File template CSV Matrix Training tidak ditemukan." };
    }

    try {
      const content = readFileSync(foundPath, "utf-8");
      const lines = content.split(/\r?\n/).filter(Boolean);
      if (lines.length < 5) {
        return { success: false, message: "Format file CSV tidak valid." };
      }

      // Line 1: Course code header
      // Line 2: Course codes (A4219, A2638, etc.)
      // Line 3: Course titles
      const codes = lines[1].split(";").map((c) => c.trim());
      const titles = lines[2].split(";").map((t) => t.trim());

      // Collect courses (starting index 6)
      const courseMap: { code: string; title: string }[] = [];
      for (let col = 6; col < codes.length; col++) {
        const code = codes[col];
        const title = titles[col] || code;
        if (code && code !== "") {
          courseMap.push({ code, title });
        }
      }

      // Insert courses
      for (const c of courseMap) {
        const [exist] = await db.select().from(safetyTrainings).where(eq(safetyTrainings.courseCode, c.code)).limit(1);
        if (!exist) {
          await db.insert(safetyTrainings).values({
            courseCode: c.code,
            courseTitle: c.title,
            category: "SAFETY"
          });
        }
      }

      // Read employee records from Line 5 onwards
      let importedEmployees = 0;
      for (let i = 4; i < Math.min(lines.length, 35); i++) {
        const row = lines[i].split(";");
        const badge = row[1]?.trim();
        const name = row[2]?.trim();
        const position = row[3]?.trim();
        const dept = row[5]?.trim() || "Ops";

        if (!badge || !name || badge === "") continue;
        importedEmployees++;

        // Map courses for this employee
        for (let col = 6; col < codes.length; col++) {
          const code = codes[col];
          const val = row[col]?.trim();
          if (code && val && (val === "c" || val === "R")) {
            const [exist] = await db
              .select()
              .from(safetyEmployeeTrainings)
              .where(
                and(
                  eq(safetyEmployeeTrainings.badgeNumber, badge),
                  eq(safetyEmployeeTrainings.courseCode, code)
                )
              )
              .limit(1);

            if (!exist) {
              await db.insert(safetyEmployeeTrainings).values({
                badgeNumber: badge,
                employeeName: name,
                positionTitle: position,
                department: dept,
                courseCode: code,
                status: val,
                trainingDate: val === "c" ? "2026-07-01" : null
              });
            }
          }
        }
      }

      return {
        success: true,
        message: `Sinkronisasi berhasil! ${courseMap.length} Course dan ${importedEmployees} Karyawan telah disinkronkan.`,
        coursesCount: courseMap.length,
        employeesCount: importedEmployees
      };
    } catch (err: any) {
      return { success: false, message: err?.message || "Gagal sinkronisasi CSV" };
    }
  })

  // ==========================================
  // 4. PESAN KESELAMATAN KPC
  // ==========================================
  .get("/messages", async () => {
    const rows = await db.select().from(safetyMessages).orderBy(desc(safetyMessages.createdAt));
    return { success: true, data: rows };
  })

  .post(
    "/messages",
    async ({ body, set }) => {
      try {
        await db.insert(safetyMessages).values({
          monthYear: body.monthYear.trim(),
          title: body.title.trim(),
          content: body.content?.trim() || null,
          documentUrl: body.documentUrl?.trim() || null
        });

        return { success: true, message: "Pesan Keselamatan bulanan berhasil dibuat" };
      } catch (err: any) {
        set.status = 500;
        return { success: false, message: err?.message || "Gagal membuat pesan keselamatan" };
      }
    },
    {
      body: t.Object({
        monthYear: t.String(),
        title: t.String(),
        content: t.Optional(t.String()),
        documentUrl: t.Optional(t.String())
      })
    }
  )

  // Sign Pesan Keselamatan (Nama & TTD Canvas)
  .post(
    "/messages/:id/sign",
    async ({ params, body, set }) => {
      try {
        const id = Number(params.id);
        await db
          .update(safetyMessages)
          .set({
            attendeeName: body.attendeeName.trim(),
            attendeeBadge: body.attendeeBadge?.trim() || null,
            signatureData: body.signatureData,
            signedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(safetyMessages.id, id));

        return { success: true, message: "Tanda tangan kehadiran berhasil disimpan" };
      } catch (err: any) {
        set.status = 500;
        return { success: false, message: err?.message || "Gagal menandatangani pesan keselamatan" };
      }
    },
    {
      body: t.Object({
        attendeeName: t.String(),
        attendeeBadge: t.Optional(t.String()),
        signatureData: t.String()
      })
    }
  );
