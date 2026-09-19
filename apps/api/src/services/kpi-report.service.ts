import { and, desc, eq, inArray, sql } from "drizzle-orm";
import ExcelJS from "exceljs";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Header,
  HeightRule,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType
} from "docx";
import { db } from "../db";
import {
  kpiCompanies,
  kpiDevices,
  kpiHolidays,
  kpiReportProblems,
  kpiReports
} from "../db/schema";

export const MONTH_NAMES_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

export const DAY_NAMES_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export function angkaTerbilang(n: number): string {
  const satuan = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
  if (n < 0) return "Minus " + angkaTerbilang(Math.abs(n));
  if (n < 12) return satuan[n];
  if (n < 20) return satuan[n - 10] + " Belas";
  if (n < 100) return satuan[Math.floor(n / 10)] + " Puluh" + (n % 10 !== 0 ? " " + satuan[n % 10] : "");
  if (n < 200) return "Seratus" + (n % 100 !== 0 ? " " + angkaTerbilang(n % 100) : "");
  if (n < 1000) return satuan[Math.floor(n / 100)] + " Ratus" + (n % 100 !== 0 ? " " + angkaTerbilang(n % 100) : "");
  if (n < 2000) return "Seribu" + (n % 1000 !== 0 ? " " + angkaTerbilang(n % 1000) : "");
  if (n < 10000) return satuan[Math.floor(n / 1000)] + " Ribu" + (n % 1000 !== 0 ? " " + angkaTerbilang(n % 1000) : "");
  return String(n);
}

export function toRomanMonth(month: number): string {
  const romans = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  return romans[month - 1] || String(month);
}

export interface FirstWorkingDayResult {
  dayNumber: number;
  dayName: string;
  dayWord: string;
  monthName: string;
  monthWord: string;
  yearWord: string;
  dateStr: string;
  isoDate: string;
}

export function calculateFirstWorkingDay(
  year: number,
  month: number,
  holidaysSet: Set<string>
): FirstWorkingDayResult {
  const daysInMonth = new Date(year, month, 0).getDate();
  let candidate = 1;

  while (candidate <= daysInMonth) {
    const d = new Date(Date.UTC(year, month - 1, candidate));
    const dayOfWeek = d.getUTCDay(); // 0 is Sunday, 6 is Saturday
    const isoDate = `${year}-${String(month).padStart(2, "0")}-${String(candidate).padStart(2, "0")}`;

    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidaysSet.has(isoDate)) {
      const dateStr = `${String(candidate).padStart(2, "0")}-${String(month).padStart(2, "0")}-${year}`;
      return {
        dayNumber: candidate,
        dayName: DAY_NAMES_ID[dayOfWeek],
        dayWord: angkaTerbilang(candidate),
        monthName: MONTH_NAMES_ID[month - 1],
        monthWord: MONTH_NAMES_ID[month - 1],
        yearWord: angkaTerbilang(year),
        dateStr,
        isoDate
      };
    }
    candidate++;
  }

  // Fallback
  return {
    dayNumber: 1,
    dayName: "Senin",
    dayWord: "Satu",
    monthName: MONTH_NAMES_ID[month - 1],
    monthWord: MONTH_NAMES_ID[month - 1],
    yearWord: angkaTerbilang(year),
    dateStr: `01-${String(month).padStart(2, "0")}-${year}`,
    isoDate: `${year}-${String(month).padStart(2, "0")}-01`
  };
}

export class KpiReportService {
  // ==========================================
  // COMPANY MANAGEMENT
  // ==========================================
  async getCompanies() {
    const companies = await db
      .select()
      .from(kpiCompanies)
      .orderBy(kpiCompanies.sortOrder, kpiCompanies.id);

    const devices = await db.select().from(kpiDevices);
    const devicesByCompany = new Map<number, typeof devices>();

    for (const d of devices) {
      const list = devicesByCompany.get(d.companyId) || [];
      list.push(d);
      devicesByCompany.set(d.companyId, list);
    }

    return companies.map((c) => ({
      ...c,
      deviceCount: (devicesByCompany.get(c.id) || []).length,
      devices: devicesByCompany.get(c.id) || []
    }));
  }

  async getCompanyById(id: number) {
    const [company] = await db
      .select()
      .from(kpiCompanies)
      .where(eq(kpiCompanies.id, id))
      .limit(1);

    if (!company) return null;

    const devices = await db
      .select()
      .from(kpiDevices)
      .where(eq(kpiDevices.companyId, id))
      .orderBy(kpiDevices.orderIndex, kpiDevices.id);

    return { ...company, devices };
  }

  async createCompany(data: {
    name: string;
    type?: string;
    clientCompanyName?: string;
    clientAddress?: string;
    contractTitle?: string;
    serviceDescription?: string;
    mknSignerName?: string;
    mknSignerRole?: string;
    clientSignerName?: string;
    clientSignerRole?: string;
    clientSignerLocation?: string;
    devices?: Array<{ deviceName: string; location?: string }>;
  }) {
    const type = data.type === "kpc" ? "kpc" : "non-kpc";
    const mknSignerName = data.mknSignerName || (type === "kpc" ? "Joko Triono" : "Wanto");
    const mknSignerRole = data.mknSignerRole || (type === "kpc" ? "PJO" : "Project Manager");

    const [result] = await db.insert(kpiCompanies).values({
      name: data.name,
      type,
      clientCompanyName: data.clientCompanyName || null,
      clientAddress: data.clientAddress || null,
      contractTitle: data.contractTitle || null,
      serviceDescription: data.serviceDescription || null,
      mknSignerName,
      mknSignerRole,
      clientSignerName: data.clientSignerName || null,
      clientSignerRole: data.clientSignerRole || null,
      clientSignerLocation: data.clientSignerLocation || "Site Sangatta",
      isActive: true,
      sortOrder: 100
    });

    const companyId = result.insertId;

    if (data.devices && data.devices.length > 0) {
      for (let i = 0; i < data.devices.length; i++) {
        const d = data.devices[i];
        if (d.deviceName && d.deviceName.trim().length > 0) {
          await db.insert(kpiDevices).values({
            companyId,
            deviceName: d.deviceName.trim(),
            location: d.location?.trim() || null,
            orderIndex: i + 1
          });
        }
      }
    }

    return this.getCompanyById(companyId);
  }

  async updateCompany(
    id: number,
    data: {
      name?: string;
      type?: string;
      clientCompanyName?: string;
      clientAddress?: string;
      contractTitle?: string;
      serviceDescription?: string;
      mknSignerName?: string;
      mknSignerRole?: string;
      clientSignerName?: string;
      clientSignerRole?: string;
      clientSignerLocation?: string;
      isActive?: boolean;
      sortOrder?: number;
    }
  ) {
    await db
      .update(kpiCompanies)
      .set({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.type !== undefined && { type: data.type === "kpc" ? "kpc" : "non-kpc" }),
        ...(data.clientCompanyName !== undefined && { clientCompanyName: data.clientCompanyName }),
        ...(data.clientAddress !== undefined && { clientAddress: data.clientAddress }),
        ...(data.contractTitle !== undefined && { contractTitle: data.contractTitle }),
        ...(data.serviceDescription !== undefined && { serviceDescription: data.serviceDescription }),
        ...(data.mknSignerName !== undefined && { mknSignerName: data.mknSignerName }),
        ...(data.mknSignerRole !== undefined && { mknSignerRole: data.mknSignerRole }),
        ...(data.clientSignerName !== undefined && { clientSignerName: data.clientSignerName }),
        ...(data.clientSignerRole !== undefined && { clientSignerRole: data.clientSignerRole }),
        ...(data.clientSignerLocation !== undefined && { clientSignerLocation: data.clientSignerLocation }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder })
      })
      .where(eq(kpiCompanies.id, id));

    return this.getCompanyById(id);
  }

  async deleteCompany(id: number) {
    await db.delete(kpiCompanies).where(eq(kpiCompanies.id, id));
    return { success: true, message: "Perusahaan berhasil dihapus" };
  }

  // ==========================================
  // DEVICE MANAGEMENT
  // ==========================================
  async addDevice(companyId: number, data: { deviceName: string; location?: string }) {
    const existing = await db
      .select()
      .from(kpiDevices)
      .where(eq(kpiDevices.companyId, companyId));

    const [result] = await db.insert(kpiDevices).values({
      companyId,
      deviceName: data.deviceName.trim(),
      location: data.location?.trim() || null,
      orderIndex: existing.length + 1
    });

    return { id: result.insertId, ...data, companyId };
  }

  async updateDevice(
    deviceId: number,
    data: { deviceName?: string; location?: string; orderIndex?: number }
  ) {
    await db
      .update(kpiDevices)
      .set({
        ...(data.deviceName !== undefined && { deviceName: data.deviceName.trim() }),
        ...(data.location !== undefined && { location: data.location.trim() }),
        ...(data.orderIndex !== undefined && { orderIndex: data.orderIndex })
      })
      .where(eq(kpiDevices.id, deviceId));

    return { success: true };
  }

  async deleteDevice(deviceId: number) {
    await db.delete(kpiDevices).where(eq(kpiDevices.id, deviceId));
    return { success: true };
  }

  // ==========================================
  // HOLIDAY MANAGEMENT
  // ==========================================
  async getHolidays(year?: number) {
    const holidays = await db
      .select()
      .from(kpiHolidays)
      .orderBy(kpiHolidays.holidayDate);

    if (year) {
      return holidays.filter((h) => h.holidayDate.startsWith(String(year)));
    }
    return holidays;
  }

  async createHoliday(data: { holidayDate: string; description: string }) {
    const [result] = await db.insert(kpiHolidays).values({
      holidayDate: data.holidayDate,
      description: data.description
    });
    return { id: result.insertId, ...data };
  }

  async deleteHoliday(id: number) {
    await db.delete(kpiHolidays).where(eq(kpiHolidays.id, id));
    return { success: true };
  }

  // ==========================================
  // KPI CALCULATION & MONTHLY REPORT
  // ==========================================
  async getMonthlyReportData(companyId: number, year: number, month: number) {
    const company = await this.getCompanyById(companyId);
    if (!company) throw new Error("Perusahaan tidak ditemukan");

    // Days in month
    const daysInMonth = new Date(year, month, 0).getDate();
    const totalSecondsInMonth = daysInMonth * 24 * 3600;

    // Find or create report record
    let [report] = await db
      .select()
      .from(kpiReports)
      .where(
        and(
          eq(kpiReports.companyId, companyId),
          eq(kpiReports.year, year),
          eq(kpiReports.month, month)
        )
      )
      .limit(1);

    // Fetch holidays to calculate first working day
    const holidays = await this.getHolidays(year);
    const holidaysSet = new Set(holidays.map((h) => h.holidayDate));
    const firstWorkingDay = calculateFirstWorkingDay(year, month, holidaysSet);

    // Fetch existing problems if report exists
    let problems: any[] = [];
    if (report) {
      problems = await db
        .select({
          id: kpiReportProblems.id,
          reportId: kpiReportProblems.reportId,
          deviceId: kpiReportProblems.deviceId,
          problemDate: kpiReportProblems.problemDate,
          downtimeHours: kpiReportProblems.downtimeHours,
          downtimeMinutes: kpiReportProblems.downtimeMinutes,
          downtimeSeconds: kpiReportProblems.downtimeSeconds,
          totalSeconds: kpiReportProblems.totalSeconds,
          description: kpiReportProblems.description,
          deviceName: kpiDevices.deviceName,
          location: kpiDevices.location
        })
        .from(kpiReportProblems)
        .leftJoin(kpiDevices, eq(kpiReportProblems.deviceId, kpiDevices.id))
        .where(eq(kpiReportProblems.reportId, report.id))
        .orderBy(kpiReportProblems.problemDate, kpiReportProblems.id);
    }

    // Calculate availability per device
    const deviceStats = company.devices.map((dev) => {
      const devProblems = problems.filter((p) => p.deviceId === dev.id);
      const totalDowntimeSec = devProblems.reduce((sum, p) => sum + (p.totalSeconds || 0), 0);
      const availRatio = Math.max(0, (totalSecondsInMonth - totalDowntimeSec) / totalSecondsInMonth);
      const availPercent = parseFloat((availRatio * 100).toFixed(2));

      return {
        device: dev,
        totalDowntimeSeconds: totalDowntimeSec,
        downtimeHours: Math.floor(totalDowntimeSec / 3600),
        downtimeMinutes: Math.floor((totalDowntimeSec % 3600) / 60),
        downtimeSeconds: totalDowntimeSec % 60,
        availabilityPercent: availPercent,
        problems: devProblems
      };
    });

    // Calculate overall availability
    let overallAvail = 100.0;
    if (deviceStats.length > 0) {
      const sumAvail = deviceStats.reduce((acc, curr) => acc + curr.availabilityPercent, 0);
      overallAvail = parseFloat((sumAvail / deviceStats.length).toFixed(2));
    }

    const overallStr = overallAvail.toFixed(2);

    return {
      company,
      year,
      month,
      monthName: MONTH_NAMES_ID[month - 1],
      daysInMonth,
      firstWorkingDay,
      overallAvailability: overallStr,
      report,
      deviceStats,
      problems
    };
  }

  async ensureReportExists(companyId: number, year: number, month: number, userId: number) {
    let [report] = await db
      .select()
      .from(kpiReports)
      .where(
        and(
          eq(kpiReports.companyId, companyId),
          eq(kpiReports.year, year),
          eq(kpiReports.month, month)
        )
      )
      .limit(1);

    if (!report) {
      const [res] = await db.insert(kpiReports).values({
        companyId,
        year,
        month,
        overallAvailability: "100.00",
        createdBy: userId,
        status: "draft"
      });
      [report] = await db.select().from(kpiReports).where(eq(kpiReports.id, res.insertId)).limit(1);
    }

    return report;
  }

  async addProblem(
    companyId: number,
    year: number,
    month: number,
    userId: number,
    data: {
      deviceId: number;
      problemDate: string; // YYYY-MM-DD
      downtimeHours: number;
      downtimeMinutes: number;
      downtimeSeconds?: number;
      description: string;
    }
  ) {
    const report = await this.ensureReportExists(companyId, year, month, userId);

    const hours = Math.max(0, Number(data.downtimeHours) || 0);
    const minutes = Math.max(0, Number(data.downtimeMinutes) || 0);
    const seconds = Math.max(0, Number(data.downtimeSeconds) || 0);
    const totalSec = hours * 3600 + minutes * 60 + seconds;

    const [res] = await db.insert(kpiReportProblems).values({
      reportId: report.id,
      deviceId: data.deviceId,
      problemDate: data.problemDate,
      downtimeHours: hours,
      downtimeMinutes: minutes,
      downtimeSeconds: seconds,
      totalSeconds: totalSec,
      description: data.description.trim()
    });

    // Recalculate overall availability
    const reportData = await this.getMonthlyReportData(companyId, year, month);
    await db
      .update(kpiReports)
      .set({ overallAvailability: reportData.overallAvailability })
      .where(eq(kpiReports.id, report.id));

    return { id: res.insertId, ...data, totalSeconds: totalSec };
  }

  async deleteProblem(problemId: number, companyId: number, year: number, month: number) {
    await db.delete(kpiReportProblems).where(eq(kpiReportProblems.id, problemId));

    // Recalculate
    const reportData = await this.getMonthlyReportData(companyId, year, month);
    if (reportData.report) {
      await db
        .update(kpiReports)
        .set({ overallAvailability: reportData.overallAvailability })
        .where(eq(kpiReports.id, reportData.report.id));
    }

    return { success: true };
  }

  // ==========================================
  // EXCEL GENERATION (Availability KPI)
  // ==========================================
  async generateExcelBuffer(companyId: number, year: number, month: number): Promise<Buffer> {
    const data = await this.getMonthlyReportData(companyId, year, month);
    const { company, daysInMonth, monthName, deviceStats, problems, overallAvailability } = data;

    const wb = new ExcelJS.Workbook();
    wb.creator = "PT Multi Kontrol Nusantara";
    wb.created = new Date();

    const ws = wb.addWorksheet("Availability", {
      views: [{ showGridLines: true }]
    });

    // Column definitions
    // Col 1: No (5), Col 2: Device Name (35), Col 3: Location (25)
    // Col 4..3+daysInMonth: Days (9)
    const columns: Partial<ExcelJS.Column>[] = [
      { key: "no", width: 6 },
      { key: "deviceName", width: 36 },
      { key: "location", width: 26 }
    ];
    for (let d = 1; d <= daysInMonth; d++) {
      columns.push({ key: `day_${d}`, width: 9 });
    }
    ws.columns = columns;

    // Header styling helper
    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };

    // Row 1 & 2: MKN header
    const r1 = ws.getRow(1);
    r1.getCell(1).value = "PT MULTI KONTROL NUSANTARA";
    r1.getCell(1).font = { name: "Arial", size: 12, bold: true };

    const r2 = ws.getRow(2);
    r2.getCell(1).value = "Sangatta Operation";
    r2.getCell(1).font = { name: "Arial", size: 10, bold: true };

    // Row 4 & 5: Service Title & Daily Report
    const r4 = ws.getRow(4);
    r4.getCell(1).value = `Device Availability - ${company.name}`;
    r4.getCell(1).font = { name: "Arial", size: 11, bold: true };

    const r5 = ws.getRow(5);
    r5.getCell(1).value = "Dailly Report";
    r5.getCell(1).font = { name: "Arial", size: 10, italic: true };

    // Row 7: Month
    const r7 = ws.getRow(7);
    r7.getCell(1).value = "Month :";
    r7.getCell(1).font = { name: "Arial", size: 10, bold: true };
    r7.getCell(3).value = `${monthName} ${year}`;
    r7.getCell(3).font = { name: "Arial", size: 10, bold: true };

    // Row 8: Date
    const r8 = ws.getRow(8);
    r8.getCell(1).value = "Date :";
    r8.getCell(1).font = { name: "Arial", size: 10, bold: true };
    r8.getCell(3).value = daysInMonth;
    r8.getCell(3).font = { name: "Arial", size: 10, bold: true };

    // Table Header at Row 10 & 11
    const r10 = ws.getRow(10);
    const r11 = ws.getRow(11);

    r10.getCell(1).value = "No";
    r10.getCell(2).value = "Device Name";
    r10.getCell(3).value = "Location";

    // Merge A10:A11, B10:B11, C10:C11
    ws.mergeCells("A10:A11");
    ws.mergeCells("B10:B11");
    ws.mergeCells("C10:C11");

    for (let c = 1; c <= 3; c++) {
      const cell = r10.getCell(c);
      cell.font = { name: "Arial", size: 10, bold: true };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD9E1F2" }
      };
      cell.border = thinBorder;
      r11.getCell(c).border = thinBorder;
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const colIdx = 3 + d;
      const c10 = r10.getCell(colIdx);
      const c11 = r11.getCell(colIdx);

      c10.value = d;
      c10.font = { name: "Arial", size: 9, bold: true };
      c10.alignment = { vertical: "middle", horizontal: "center" };
      c10.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD9E1F2" }
      };
      c10.border = thinBorder;

      c11.value = "Downtime";
      c11.font = { name: "Arial", size: 8, italic: true };
      c11.alignment = { vertical: "middle", horizontal: "center" };
      c11.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF2F2F2" }
      };
      c11.border = thinBorder;
    }

    // Devices rows (start at Row 13)
    let currentRow = 13;

    // Pre-map problems by deviceId and dayNumber
    const problemMap = new Map<string, number>(); // "devId_day" -> totalSeconds
    for (const p of problems) {
      const pDay = parseInt(p.problemDate.split("-")[2], 10);
      const key = `${p.deviceId}_${pDay}`;
      problemMap.set(key, (problemMap.get(key) || 0) + (p.totalSeconds || 0));
    }

    deviceStats.forEach((stat, idx) => {
      const row = ws.getRow(currentRow);
      row.getCell(1).value = idx + 1;
      row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(1).border = thinBorder;

      row.getCell(2).value = stat.device.deviceName;
      row.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
      row.getCell(2).border = thinBorder;

      row.getCell(3).value = stat.device.location || "-";
      row.getCell(3).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(3).border = thinBorder;

      for (let d = 1; d <= daysInMonth; d++) {
        const colIdx = 3 + d;
        const key = `${stat.device.id}_${d}`;
        const downtimeSec = problemMap.get(key) || 0;
        const cell = row.getCell(colIdx);

        if (downtimeSec > 0) {
          const h = Math.floor(downtimeSec / 3600);
          const m = Math.floor((downtimeSec % 3600) / 60);
          const s = downtimeSec % 60;
          const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
          cell.value = timeStr;
          cell.font = { name: "Arial", size: 8, bold: true, color: { argb: "FFFF0000" } };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFE6E6" }
          };
        } else {
          cell.value = "00:00:00";
          cell.font = { name: "Arial", size: 8, color: { argb: "FF7F7F7F" } };
        }
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = thinBorder;
      }

      currentRow++;
    });

    // Remarks Section
    currentRow += 2;
    const rRemarksHeader = ws.getRow(currentRow);
    rRemarksHeader.getCell(2).value = "Catatan Masalah (Remarks)";
    rRemarksHeader.getCell(2).font = { name: "Arial", size: 10, bold: true };
    currentRow++;

    if (problems.length === 0) {
      const rEmpty = ws.getRow(currentRow);
      rEmpty.getCell(2).value = "100% Availability — Tidak ada kendala / downtime operasional sepanjang bulan ini.";
      rEmpty.getCell(2).font = { name: "Arial", size: 9, italic: true, color: { argb: "FF1E7E34" } };
      currentRow++;
    } else {
      // Header for remarks
      const rRemH = ws.getRow(currentRow);
      rRemH.getCell(1).value = "No";
      rRemH.getCell(2).value = "Device / Link";
      rRemH.getCell(3).value = "Tanggal";
      rRemH.getCell(4).value = "Durasi Downtime";
      rRemH.getCell(5).value = "Keterangan";
      for (let c = 1; c <= 5; c++) {
        const cell = rRemH.getCell(c);
        cell.font = { name: "Arial", size: 9, bold: true };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
        cell.border = thinBorder;
      }
      currentRow++;

      problems.forEach((p, pIdx) => {
        const rRem = ws.getRow(currentRow);
        rRem.getCell(1).value = pIdx + 1;
        rRem.getCell(1).alignment = { horizontal: "center" };
        rRem.getCell(1).border = thinBorder;

        rRem.getCell(2).value = p.deviceName;
        rRem.getCell(2).border = thinBorder;

        rRem.getCell(3).value = p.problemDate;
        rRem.getCell(3).alignment = { horizontal: "center" };
        rRem.getCell(3).border = thinBorder;

        const h = Math.floor(p.totalSeconds / 3600);
        const m = Math.floor((p.totalSeconds % 3600) / 60);
        const s = p.totalSeconds % 60;
        rRem.getCell(4).value = `${h} jam ${m} menit ${s} detik`;
        rRem.getCell(4).alignment = { horizontal: "center" };
        rRem.getCell(4).border = thinBorder;

        rRem.getCell(5).value = p.description || "-";
        rRem.getCell(5).border = thinBorder;

        currentRow++;
      });
    }

    // Summary Section
    currentRow += 2;
    const rSumTitle = ws.getRow(currentRow);
    rSumTitle.getCell(1).value = "Summary Availability";
    rSumTitle.getCell(1).font = { name: "Arial", size: 11, bold: true };
    currentRow++;

    // Summary Header
    const rSumH1 = ws.getRow(currentRow);
    const rSumH2 = ws.getRow(currentRow + 1);

    rSumH1.getCell(1).value = "No";
    rSumH1.getCell(2).value = "Description";
    rSumH1.getCell(3).value = "Availability";
    rSumH1.getCell(4).value = "Total Downtime";
    rSumH1.getCell(5).value = "Total Downtime";

    ws.mergeCells(`A${currentRow}:A${currentRow + 1}`);
    ws.mergeCells(`B${currentRow}:B${currentRow + 1}`);
    ws.mergeCells(`C${currentRow}:C${currentRow + 1}`);
    ws.mergeCells(`D${currentRow}:E${currentRow}`);

    rSumH2.getCell(4).value = "Hours";
    rSumH2.getCell(5).value = "Min Sec";

    for (let c = 1; c <= 5; c++) {
      const c1 = rSumH1.getCell(c);
      const c2 = rSumH2.getCell(c);
      c1.font = { name: "Arial", size: 9, bold: true };
      c2.font = { name: "Arial", size: 9, bold: true };
      c1.alignment = { horizontal: "center", vertical: "middle" };
      c2.alignment = { horizontal: "center", vertical: "middle" };
      c1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } };
      c2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } };
      c1.border = thinBorder;
      c2.border = thinBorder;
    }

    currentRow += 2;

    deviceStats.forEach((stat, idx) => {
      const row = ws.getRow(currentRow);
      row.getCell(1).value = idx + 1;
      row.getCell(1).alignment = { horizontal: "center" };
      row.getCell(1).border = thinBorder;

      row.getCell(2).value = stat.device.deviceName;
      row.getCell(2).border = thinBorder;

      row.getCell(3).value = `${stat.availabilityPercent.toFixed(2)}%`;
      row.getCell(3).alignment = { horizontal: "right" };
      row.getCell(3).font = {
        name: "Arial",
        size: 9,
        bold: true,
        color: { argb: stat.availabilityPercent < 100 ? "FFC00000" : "FF006100" }
      };
      row.getCell(3).border = thinBorder;

      row.getCell(4).value = stat.downtimeHours;
      row.getCell(4).alignment = { horizontal: "center" };
      row.getCell(4).border = thinBorder;

      row.getCell(5).value = `${String(stat.downtimeMinutes).padStart(2, "0")} m ${String(stat.downtimeSeconds).padStart(2, "0")} s`;
      row.getCell(5).alignment = { horizontal: "center" };
      row.getCell(5).border = thinBorder;

      currentRow++;
    });

    // Overall Availability Row
    const rOverall = ws.getRow(currentRow);
    rOverall.getCell(2).value = "Availability (Overall)";
    rOverall.getCell(2).font = { name: "Arial", size: 10, bold: true };
    rOverall.getCell(2).border = thinBorder;

    rOverall.getCell(3).value = `${overallAvailability}%`;
    rOverall.getCell(3).font = { name: "Arial", size: 10, bold: true, color: { argb: "FF002060" } };
    rOverall.getCell(3).alignment = { horizontal: "right" };
    rOverall.getCell(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2EFDA" } };
    rOverall.getCell(3).border = thinBorder;

    rOverall.getCell(1).border = thinBorder;
    rOverall.getCell(4).border = thinBorder;
    rOverall.getCell(5).border = thinBorder;

    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // ==========================================
  // WORD GENERATION (BAO Document)
  // ==========================================
  async generateWordBuffer(companyId: number, year: number, month: number): Promise<Buffer> {
    const data = await this.getMonthlyReportData(companyId, year, month);
    const { company, monthName, firstWorkingDay, overallAvailability } = data;

    // Rules:
    // TTD: KPC -> Pak Joko Triono (PJO)
    // Non-KPC -> Pak Wanto (Project Manager)
    const isKpc = company.type === "kpc";
    const mknSignerName = company.mknSignerName || (isKpc ? "Joko Triono" : "Wanto");
    const mknSignerRole = company.mknSignerRole || (isKpc ? "PJO" : "Project Manager");

    const clientCompany = company.clientCompanyName || "PT KALTIM PRIMA COAL";
    const clientLocation = company.clientSignerLocation || "Sangatta";
    const clientSignerName = company.clientSignerName || "Suluh Basuki";
    const clientSignerRole = company.clientSignerRole || "ISD KPC";

    const docNumber = company.name.toLowerCase().includes("kpc")
      ? `Nomor :          /MKN-KPC/BAO/${toRomanMonth(month)}/${year}`
      : company.name.toLowerCase().includes("nap")
      ? `Nomor :          /MKN-NAP/BAO/${toRomanMonth(month)}/${year}`
      : company.name.toLowerCase().includes("hex")
      ? `Nomor :          /MKN-HEX/BAO/${toRomanMonth(month)}/${year}`
      : company.name.toLowerCase().includes("ut")
      ? `Nomor :          /MKN-UT/BAO/${toRomanMonth(month)}/${year}`
      : `Nomor :          /MKN/BAO/${toRomanMonth(month)}/${year}`;

    const serviceDesc =
      company.serviceDescription ||
      (isKpc
        ? `Microwave Radio Transmission And Maintenance Support ( ${company.devices.length} Link )`
        : `Layanan Komunikasi Link ${company.name}`);

    const clientAddress =
      company.clientAddress || "PT Kaltim Prima Coal d/a ISD M3 Building mine Site Sangatta, Kalimantan Timur";
    const contractTitle =
      company.contractTitle || "pengadaan link Radio Transmissions & Maintenance Support";

    const openingText = `Pada hari ini ${firstWorkingDay.dayName} tanggal ${firstWorkingDay.dayWord} bulan ${firstWorkingDay.monthWord} tahun ${firstWorkingDay.yearWord} (${firstWorkingDay.dateStr}), bertempat di ${clientAddress}, ditandatangani Berita Acara Operasi atas ${contractTitle}`;

    // Construct docx Document
    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1440, // 1 inch
                bottom: 1440,
                left: 1440,
                right: 1440
              }
            }
          },
          children: [
            // Title Header
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 60 },
              children: [
                new TextRun({
                  text: "BERITA ACARA OPERASI",
                  bold: true,
                  size: 26, // 13pt
                  font: "Arial"
                })
              ]
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 60 },
              children: [
                new TextRun({
                  text: "antara",
                  size: 22, // 11pt
                  font: "Arial"
                })
              ]
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 60 },
              children: [
                new TextRun({
                  text: clientCompany,
                  bold: true,
                  size: 24, // 12pt
                  font: "Arial"
                })
              ]
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 60 },
              children: [
                new TextRun({
                  text: "dengan",
                  size: 22,
                  font: "Arial"
                })
              ]
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 120 },
              children: [
                new TextRun({
                  text: "PT MULTI KONTROL NUSANTARA",
                  bold: true,
                  size: 24,
                  font: "Arial"
                })
              ]
            }),
            // Nomor BAO (Nomor blank as requested)
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 280 },
              children: [
                new TextRun({
                  text: docNumber,
                  bold: true,
                  size: 22,
                  font: "Arial"
                })
              ]
            }),
            // Opening Paragraph
            new Paragraph({
              alignment: AlignmentType.JUSTIFIED,
              spacing: { line: 280, after: 180 },
              children: [
                new TextRun({
                  text: openingText,
                  size: 22,
                  font: "Arial"
                })
              ]
            }),
            // Subtitle
            new Paragraph({
              spacing: { after: 60 },
              children: [
                new TextRun({
                  text: "Dengan uraian sebagai berikut :",
                  size: 22,
                  font: "Arial"
                })
              ]
            }),
            new Paragraph({
              spacing: { after: 180 },
              children: [
                new TextRun({
                  text: `Periode   : ${monthName} ${year}`,
                  size: 22,
                  font: "Arial"
                })
              ]
            }),
            // Table: No | Uraian | Status
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  tableHeader: true,
                  children: [
                    new TableCell({
                      width: { size: 10, type: WidthType.PERCENTAGE },
                      shading: { fill: "E0E0E0", type: ShadingType.CLEAR },
                      verticalAlign: VerticalAlign.CENTER,
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [new TextRun({ text: "No", bold: true, font: "Arial", size: 20 })]
                        })
                      ]
                    }),
                    new TableCell({
                      width: { size: 60, type: WidthType.PERCENTAGE },
                      shading: { fill: "E0E0E0", type: ShadingType.CLEAR },
                      verticalAlign: VerticalAlign.CENTER,
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [new TextRun({ text: "Uraian", bold: true, font: "Arial", size: 20 })]
                        })
                      ]
                    }),
                    new TableCell({
                      width: { size: 30, type: WidthType.PERCENTAGE },
                      shading: { fill: "E0E0E0", type: ShadingType.CLEAR },
                      verticalAlign: VerticalAlign.CENTER,
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [new TextRun({ text: "Status", bold: true, font: "Arial", size: 20 })]
                        })
                      ]
                    })
                  ]
                }),
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 10, type: WidthType.PERCENTAGE },
                      verticalAlign: VerticalAlign.CENTER,
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [new TextRun({ text: "1", font: "Arial", size: 20 })]
                        })
                      ]
                    }),
                    new TableCell({
                      width: { size: 60, type: WidthType.PERCENTAGE },
                      verticalAlign: VerticalAlign.CENTER,
                      children: [
                        new Paragraph({
                          spacing: { before: 80, after: 80 },
                          children: [new TextRun({ text: serviceDesc, font: "Arial", size: 20 })]
                        })
                      ]
                    }),
                    new TableCell({
                      width: { size: 30, type: WidthType.PERCENTAGE },
                      verticalAlign: VerticalAlign.CENTER,
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          spacing: { before: 80, after: 80 },
                          children: [
                            new TextRun({
                              text: `Availability ( ${overallAvailability.replace(".", ",")} ) %`,
                              bold: true,
                              font: "Arial",
                              size: 20
                            })
                          ]
                        })
                      ]
                    })
                  ]
                })
              ]
            }),
            // Spacer
            new Paragraph({
              spacing: { before: 300, after: 100 },
              children: []
            }),
            // Signatures Table (MKN on left, Client on right)
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE, size: 0, color: "auto" },
                bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
                left: { style: BorderStyle.NONE, size: 0, color: "auto" },
                right: { style: BorderStyle.NONE, size: 0, color: "auto" },
                insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
                insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" }
              },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 50, type: WidthType.PERCENTAGE },
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [
                            new TextRun({
                              text: "PT MULTI KONTROL NUSANTARA",
                              bold: true,
                              font: "Arial",
                              size: 20
                            })
                          ]
                        }),
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [
                            new TextRun({
                              text: "Kaltim Operation",
                              font: "Arial",
                              size: 20
                            })
                          ]
                        }),
                        new Paragraph({
                          spacing: { before: 1100, after: 60 },
                          children: []
                        }),
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [
                            new TextRun({
                              text: mknSignerName,
                              bold: true,
                              underline: {},
                              font: "Arial",
                              size: 20
                            })
                          ]
                        }),
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [
                            new TextRun({
                              text: mknSignerRole,
                              font: "Arial",
                              size: 20
                            })
                          ]
                        })
                      ]
                    }),
                    new TableCell({
                      width: { size: 50, type: WidthType.PERCENTAGE },
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [
                            new TextRun({
                              text: clientCompany,
                              bold: true,
                              font: "Arial",
                              size: 20
                            })
                          ]
                        }),
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [
                            new TextRun({
                              text: clientLocation,
                              font: "Arial",
                              size: 20
                            })
                          ]
                        }),
                        new Paragraph({
                          spacing: { before: 1100, after: 60 },
                          children: []
                        }),
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [
                            new TextRun({
                              text: clientSignerName,
                              bold: true,
                              underline: {},
                              font: "Arial",
                              size: 20
                            })
                          ]
                        }),
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [
                            new TextRun({
                              text: clientSignerRole,
                              font: "Arial",
                              size: 20
                            })
                          ]
                        })
                      ]
                    })
                  ]
                })
              ]
            })
          ]
        }
      ]
    });

    const buffer = await Packer.toBuffer(doc);
    return buffer;
  }
}

export const kpiReportService = new KpiReportService();
