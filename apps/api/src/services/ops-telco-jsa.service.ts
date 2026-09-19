import { desc, eq, like, or, sql } from "drizzle-orm";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import * as xlsx from "xlsx";
import { db } from "../db";
import { opsTelcoJsaForms, opsTelcoJsaSteps } from "../db/schema";

export interface JsaStepDto {
  id?: number;
  jsaId?: number;
  stepNumber: number;
  sequence: number;
  stepDescription: string;
  hazardNo?: string | null;
  hazardDescription?: string | null;
  actionNo?: string | null;
  actionDescription?: string | null;
  observation?: string | null;
}

export interface JsaFormDto {
  id: number;
  jsaNumber: string;
  jobNumber?: string | null;
  jobTitle: string;
  personTitle?: string | null;
  location: string;
  jsaDate: string;
  jsaType?: string | null;
  ppeRequirements?: string | null;
  analysedBy?: string | null;
  analysedByBadge?: string | null;
  reviewedBy?: string | null;
  reviewedByBadge?: string | null;
  approvedBy?: string | null;
  approvedByBadge?: string | null;
  supervisorName?: string | null;
  leadWorkerName?: string | null;
  fpeElements?: string[] | null;
  jobPermits?: string[] | null;
  workers?: Array<{ name: string; badgeNumber?: string }> | null;
  status: string;
  createdBy?: number | null;
  createdAt: Date;
  updatedAt: Date;
  steps?: JsaStepDto[];
}

export interface CreateJsaPayload {
  jsaNumber?: string;
  jobNumber?: string;
  jobTitle: string;
  personTitle?: string;
  location: string;
  jsaDate: string;
  jsaType?: string;
  ppeRequirements?: string;
  analysedBy?: string;
  analysedByBadge?: string;
  reviewedBy?: string;
  reviewedByBadge?: string;
  approvedBy?: string;
  approvedByBadge?: string;
  supervisorName?: string;
  leadWorkerName?: string;
  fpeElements?: string[];
  jobPermits?: string[];
  workers?: Array<{ name: string; badgeNumber?: string }>;
  steps?: JsaStepDto[];
}

function normalizeDateToIso(raw: any): string {
  if (!raw) return new Date().toISOString().split("T")[0];
  if (typeof raw === "number") {
    const d = new Date(Math.round((raw - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  }
  const str = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  const monthMap: Record<string, string> = {
    jan: "01", januari: "01",
    feb: "02", februari: "02",
    mar: "03", maret: "03",
    apr: "04", april: "04",
    mei: "05", may: "05",
    jun: "06", juni: "06",
    jul: "07", juli: "07",
    agu: "08", agust: "08", agustus: "08", aug: "08", august: "08",
    sep: "09", september: "09",
    okt: "10", oktober: "10", oct: "10", october: "10",
    nop: "11", nov: "11", november: "11",
    des: "12", desember: "12", dec: "12", december: "12"
  };

  const m1 = str.match(/^(\d{1,2})[\s\-\/\.]+([a-zA-Z]+)[\s\-\/\.]+(\d{4})$/);
  if (m1) {
    const day = m1[1].padStart(2, "0");
    const mKey = m1[2].toLowerCase();
    const month = monthMap[mKey] || "01";
    const year = m1[3];
    return `${year}-${month}-${day}`;
  }

  const m2 = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m2) {
    return `${m2[3]}-${m2[2].padStart(2, "0")}-${m2[1].padStart(2, "0")}`;
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }

  return new Date().toISOString().split("T")[0];
}

export const opsTelcoJsaService = {
  async getNextJsaNumber(): Promise<string> {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    const prefix = `MKN/SGT/TLC/`;

    const [latest] = await db
      .select({ jsaNumber: opsTelcoJsaForms.jsaNumber })
      .from(opsTelcoJsaForms)
      .where(like(opsTelcoJsaForms.jsaNumber, `${prefix}%/${month}/${year}`))
      .orderBy(desc(opsTelcoJsaForms.id))
      .limit(1);

    let nextSeq = 1;
    if (latest?.jsaNumber) {
      const parts = latest.jsaNumber.split("/");
      if (parts.length >= 4) {
        const num = parseInt(parts[3], 10);
        if (!isNaN(num)) nextSeq = num + 1;
      }
    }
    const seqStr = String(nextSeq).padStart(3, "0");
    return `${prefix}${seqStr}/${month}/${year}`;
  },

  async listJsa(query: { search?: string; page?: number; limit?: number }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const offset = (page - 1) * limit;

    let condition = undefined;
    if (query.search && query.search.trim()) {
      const term = `%${query.search.trim()}%`;
      condition = or(
        like(opsTelcoJsaForms.jsaNumber, term),
        like(opsTelcoJsaForms.jobTitle, term),
        like(opsTelcoJsaForms.location, term),
        like(opsTelcoJsaForms.analysedBy, term)
      );
    }

    const rows = await db
      .select()
      .from(opsTelcoJsaForms)
      .where(condition)
      .orderBy(desc(opsTelcoJsaForms.jsaDate), desc(opsTelcoJsaForms.id))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(opsTelcoJsaForms)
      .where(condition);

    const total = Number(countResult?.count || 0);

    const parsedRows = rows.map((r) => ({
      ...r,
      fpeElements: r.fpeElements ? JSON.parse(r.fpeElements) : [],
      jobPermits: r.jobPermits ? JSON.parse(r.jobPermits) : [],
      workers: r.workers ? JSON.parse(r.workers) : []
    }));

    return {
      items: parsedRows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  },

  async getJsaById(id: number): Promise<JsaFormDto | null> {
    const [form] = await db
      .select()
      .from(opsTelcoJsaForms)
      .where(eq(opsTelcoJsaForms.id, id))
      .limit(1);

    if (!form) return null;

    const steps = await db
      .select()
      .from(opsTelcoJsaSteps)
      .where(eq(opsTelcoJsaSteps.jsaId, id))
      .orderBy(opsTelcoJsaSteps.stepNumber, opsTelcoJsaSteps.sequence, opsTelcoJsaSteps.id);

    return {
      ...form,
      fpeElements: form.fpeElements ? JSON.parse(form.fpeElements) : [],
      jobPermits: form.jobPermits ? JSON.parse(form.jobPermits) : [],
      workers: form.workers ? JSON.parse(form.workers) : [],
      steps
    };
  },

  async createJsa(payload: CreateJsaPayload, createdByUserId?: number): Promise<JsaFormDto> {
    const jsaNumber = payload.jsaNumber?.trim() || (await this.getNextJsaNumber());

    const jsaId = await db.transaction(async (tx) => {
      const [inserted] = await tx.insert(opsTelcoJsaForms).values({
        jsaNumber,
        jobNumber: payload.jobNumber?.trim() || null,
        jobTitle: payload.jobTitle.trim(),
        personTitle: payload.personTitle?.trim() || "Technician + Junior Technician",
        location: payload.location.trim(),
        jsaDate: payload.jsaDate,
        jsaType: payload.jsaType || "normal",
        ppeRequirements:
          payload.ppeRequirements?.trim() ||
          "Safety shoes, Helmet standard, Full body harness & double lanyard, Seragam kerja standard MKN",
        analysedBy: payload.analysedBy?.trim() || null,
        analysedByBadge: payload.analysedByBadge?.trim() || null,
        reviewedBy: payload.reviewedBy?.trim() || null,
        reviewedByBadge: payload.reviewedByBadge?.trim() || null,
        approvedBy: payload.approvedBy?.trim() || null,
        approvedByBadge: payload.approvedByBadge?.trim() || null,
        supervisorName: payload.supervisorName?.trim() || null,
        leadWorkerName: payload.leadWorkerName?.trim() || null,
        fpeElements: payload.fpeElements ? JSON.stringify(payload.fpeElements) : JSON.stringify([]),
        jobPermits: payload.jobPermits ? JSON.stringify(payload.jobPermits) : JSON.stringify([]),
        workers: payload.workers ? JSON.stringify(payload.workers) : JSON.stringify([]),
        status: "completed",
        createdBy: createdByUserId || null
      });

      const id = Number(inserted.insertId);

      if (payload.steps && payload.steps.length > 0) {
        for (let i = 0; i < payload.steps.length; i++) {
          const s = payload.steps[i];
          await tx.insert(opsTelcoJsaSteps).values({
            jsaId: id,
            stepNumber: s.stepNumber || 1,
            sequence: s.sequence || i + 1,
            stepDescription: s.stepDescription || "",
            hazardNo: s.hazardNo?.trim() || null,
            hazardDescription: s.hazardDescription?.trim() || null,
            actionNo: s.actionNo?.trim() || null,
            actionDescription: s.actionDescription?.trim() || null,
            observation: s.observation || null
          });
        }
      }

      return id;
    });

    const created = await this.getJsaById(jsaId);
    return created!;
  },

  async deleteJsa(id: number): Promise<boolean> {
    const res = await db.delete(opsTelcoJsaForms).where(eq(opsTelcoJsaForms.id, id));
    return true;
  },

  parseExcelFile(filePath: string): CreateJsaPayload | null {
    try {
      const wb = xlsx.readFile(filePath);
      const s = wb.Sheets[wb.SheetNames[0]];
      if (!s) return null;
      const rows = xlsx.utils.sheet_to_json(s, { header: 1 }) as any[][];

      let jobTitle = "";
      let jsaNo = "";
      let jobNo = "";
      let location = "";
      let jsaDate = "";
      let supervisor = "";
      let analysedBy = "";
      let analysedByBadge = "";
      let reviewedBy = "";
      let reviewedByBadge = "";
      let approvedBy = "";
      let approvedByBadge = "";
      let ppe = "";
      let personTitle = "";
      let jsaType = "normal";

      // Scan rows 0 to 20 for headers
      for (let r = 0; r < Math.min(25, rows.length); r++) {
        const row = rows[r] || [];
        for (let c = 0; c < row.length; c++) {
          const val = String(row[c] || "").trim();
          if (val.includes("JOB TITLE")) {
            const nextRow = rows[r + 1] || [];
            jobTitle = nextRow[c] || nextRow[2] || "";
          }
          if (val.includes("JSA No")) {
            jsaNo = row[c + 1] || row[c + 2] || (rows[r + 1] && rows[r + 1][c]) || "";
          }
          if (val.includes("JOB No")) {
            jobNo = row[c + 1] || row[c + 2] || (rows[r + 1] && rows[r + 1][c]) || "";
          }
          if (val.includes("LOCATION")) {
            const nextRow = rows[r + 1] || [];
            location = nextRow[c] || nextRow[2] || "";
          }
          if (val === "Date :" || val.startsWith("Date")) {
            const rawD = row[c + 1] || row[c + 2] || (rows[r + 1] && rows[r + 1][c]);
            if (rawD) {
              jsaDate = normalizeDateToIso(rawD);
            }
          }
          if (val.includes("ANALYSED BY")) {
            const parts = val.split(":");
            if (parts[1]?.trim()) analysedBy = parts[1].trim();
            else if (row[c + 1]) analysedBy = String(row[c + 1]).trim();
          }
          if (val.includes("REVIEWED BY")) {
            const parts = val.split(":");
            if (parts[1]?.trim()) reviewedBy = parts[1].trim();
            else if (row[c + 1]) reviewedBy = String(row[c + 1]).trim();
          }
          if (val.includes("APPROVED BY")) {
            const parts = val.split(":");
            if (parts[1]?.trim()) approvedBy = parts[1].trim();
            else if (row[c + 1]) approvedBy = String(row[c + 1]).trim();
          }
          if (val.includes("Supervisor") || val.includes("Pengawas")) {
            const parts = val.split(":");
            if (parts[1]?.trim()) supervisor = parts[1].trim();
            else if (row[c + 1]) supervisor = String(row[c + 1]).trim();
            else if (rows[r + 1] && rows[r + 1][c]) supervisor = String(rows[r + 1][c]).trim();
          }
          if (val.includes("TITLE OF PERSON")) {
            const nextRow = rows[r + 1] || [];
            personTitle = nextRow[c] || nextRow[2] || "";
          }
          if (val.includes("PROTECTIVE EQUIPMENT") || val.includes("PERSONAL PROTECTIVE")) {
            const nextRow = rows[r + 1] || [];
            ppe = [row[2], nextRow[2]].filter(Boolean).join(", ");
          }
        }
      }

      if (!jsaDate) {
        jsaDate = new Date().toISOString().split("T")[0];
      }
      if (!jobTitle) {
        jobTitle = "Pekerjaan Lapangan Telco";
      }
      if (!location) {
        location = "Area Operasi MKN Sangatta";
      }

      // Check FPE and Job Permits
      const fpeElements: string[] = [];
      const jobPermits: string[] = [];

      // Scan rows 17 to 34 for checkboxes
      for (let r = 16; r < Math.min(35, rows.length); r++) {
        const row = rows[r] || [];
        for (let c = 0; c < row.length; c++) {
          const v = String(row[c] || "").trim();
          if (v.includes("1.09")) fpeElements.push("1.09");
          if (v.includes("1.10")) fpeElements.push("1.10");
          if (v.includes("2.12")) fpeElements.push("2.12");
          if (v.includes("2.14")) fpeElements.push("2.14");
          if (v.includes("2.15")) fpeElements.push("2.15");
          if (v.includes("2.18")) fpeElements.push("2.18");
          if (v.includes("2.21") && v.includes("Kondisi")) fpeElements.push("2.21_kendaraan");
          if (v.includes("2.21") && v.includes("Listrik")) fpeElements.push("2.21_listrik");
          if (v.includes("2.22")) fpeElements.push("2.22");
          if (v.includes("2.23")) fpeElements.push("2.23");
          if (v.includes("2.24")) fpeElements.push("2.24");

          if (v.toLowerCase().includes("vicinity")) jobPermits.push("vicinity");
          if (v.toLowerCase().includes("confined")) jobPermits.push("confined_space");
          if (v.toLowerCase().includes("height")) jobPermits.push("wah");
          if (v.toLowerCase().includes("digging")) jobPermits.push("digging");
          if (v.toLowerCase().includes("hot work")) jobPermits.push("hot_work");
          if (v.toLowerCase().includes("isolasi")) jobPermits.push("isolasi");
          if (v.toLowerCase().includes("red tag")) jobPermits.push("red_tag");
        }
      }

      // Parse Steps
      const steps: JsaStepDto[] = [];
      let inSteps = false;
      let currentStepNum = 1;
      let currentStepDesc = "";

      for (let r = 0; r < rows.length; r++) {
        const row = rows[r] || [];
        const rStr = row.map((x) => String(x || "").trim()).join(" ");

        if (rStr.includes("SQUENCE OF BASIC") || rStr.includes("SEQUENCE OF BASIC")) {
          inSteps = true;
          continue;
        }

        if (inSteps) {
          if (
            rStr.includes("Note :") ||
            rStr.includes("NOTE :") ||
            rStr.includes("JSA ini  sudah dibacakan") ||
            rStr.includes("JSA ini sudah dibacakan")
          ) {
            inSteps = false;
            break;
          }

          if (row[8] === "YES" || row[9] === "YES" || row[10] === "YES") continue;

          const col0 = row[0];
          const col1 = row[1];
          const col2 = row[2];
          const col3 = row[3] || row[4];
          const col5 = row[5];
          const col6 = row[6] || row[7];

          if (col0 && !isNaN(Number(col0))) {
            currentStepNum = Number(col0);
            currentStepDesc = String(col1 || "").trim();
          } else if (col1 && !col0 && !col2 && !col3 && !currentStepDesc) {
            currentStepDesc = String(col1).trim();
          }

          let hNo = col2 ? String(col2).trim() : "";
          let hDesc = col3 ? String(col3).trim() : "";
          let aNo = col5 ? String(col5).trim() : "";
          let aDesc = col6 ? String(col6).trim() : "";

          if (aNo.length > 20 && !aDesc) {
            aDesc = aNo;
            aNo = "";
          }
          if (hNo.length > 20 && !hDesc) {
            hDesc = hNo;
            hNo = "";
          }

          if (hDesc || aDesc || currentStepDesc) {
            steps.push({
              stepNumber: currentStepNum,
              sequence: steps.length + 1,
              stepDescription: currentStepDesc,
              hazardNo: hNo ? hNo.slice(0, 100) : null,
              hazardDescription: hDesc || null,
              actionNo: aNo ? aNo.slice(0, 100) : null,
              actionDescription: aDesc || null,
              observation: "YES"
            });
          }
        }
      }

      return {
        jsaNumber: String(jsaNo).trim(),
        jobNumber: String(jobNo).trim() || undefined,
        jobTitle: String(jobTitle).trim(),
        personTitle: String(personTitle).trim() || "Technician + Junior Technician",
        location: String(location).trim(),
        jsaDate,
        jsaType,
        ppeRequirements: String(ppe).trim() || undefined,
        analysedBy: String(analysedBy).trim() || undefined,
        analysedByBadge: String(analysedByBadge).trim() || undefined,
        reviewedBy: String(reviewedBy).trim() || undefined,
        reviewedByBadge: String(reviewedByBadge).trim() || undefined,
        approvedBy: String(approvedBy).trim() || undefined,
        approvedByBadge: String(approvedByBadge).trim() || undefined,
        supervisorName: String(supervisor).trim() || undefined,
        fpeElements: Array.from(new Set(fpeElements)),
        jobPermits: Array.from(new Set(jobPermits)),
        steps: steps.length > 0 ? steps : undefined
      };
    } catch (err) {
      console.error("Error parsing excel JSA:", filePath, err);
      return null;
    }
  },

  async importHistoryFromDirectory(dirPath?: string): Promise<{ imported: number; skipped: number; total: number }> {
    const targetDir =
      dirPath ||
      (existsSync("/app/form-templates/ops-telco/technician/JSA/# JSA 2026")
        ? "/app/form-templates/ops-telco/technician/JSA/# JSA 2026"
        : "D:/Project-Web/MKNSite/form-templates/ops-telco/technician/JSA/# JSA 2026");

    if (!existsSync(targetDir)) {
      console.warn("JSA History directory not found:", targetDir);
      return { imported: 0, skipped: 0, total: 0 };
    }

    const files: string[] = [];
    function walk(d: string) {
      const items = readdirSync(d);
      for (const it of items) {
        const p = join(d, it);
        if (statSync(p).isDirectory()) {
          walk(p);
        } else if (it.endsWith(".xls") || it.endsWith(".xlsx")) {
          files.push(p);
        }
      }
    }
    walk(targetDir);

    let imported = 0;
    let skipped = 0;

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const parsed = this.parseExcelFile(f);
      if (!parsed) {
        skipped++;
        continue;
      }

      let jsaNumber = parsed.jsaNumber?.trim();
      if (!jsaNumber) {
        jsaNumber = `MKN/SGT/TLC/HIST-${String(i + 1).padStart(3, "0")}/2026`;
      }

      // Check duplicate
      const [existing] = await db
        .select({ id: opsTelcoJsaForms.id })
        .from(opsTelcoJsaForms)
        .where(eq(opsTelcoJsaForms.jsaNumber, jsaNumber))
        .limit(1);

      if (existing) {
        skipped++;
        continue;
      }

      await this.createJsa({
        ...parsed,
        jsaNumber
      });
      imported++;
    }

    return { imported, skipped, total: files.length };
  }
};
