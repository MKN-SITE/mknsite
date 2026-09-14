import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PDFDocument, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";

export type HrFormType = "oncall" | "overtime" | "cuti";
export type HrFormData = Record<string, string>;

const templateNames: Record<HrFormType, string> = {
  oncall: "hr/oncall/From Oncall.pdf",
  overtime: "hr/overtime/From Overtime.pdf",
  cuti: "hr/cuti/From Cuti.pdf"
};

function value(data: HrFormData, key: string) {
  return String(data[key] ?? "").trim();
}

function dateValue(data: HrFormData, key: string) {
  const raw = value(data, key);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : raw;
}

function draw(page: PDFPage, font: PDFFont, text: string, x: number, y: number, size = 9) {
  if (!text) return;
  page.drawText(text, { x, y, size, font });
}

function wrap(page: PDFPage, font: PDFFont, text: string, x: number, y: number, width: number, size = 9, maxLines = 4) {
  if (!text) return;
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  lines.slice(0, maxLines).forEach((item, index) => draw(page, font, item, x, y - index * (size + 2), size));
}

function drawOperational(page: PDFPage, font: PDFFont, data: HrFormData, type: "oncall" | "overtime") {
  const isOncall = type === "oncall";
  const y = isOncall
    ? { date: 596, request: 555, hours: 520, total: 504, job: 470, work: 426, equipment: 385, location: 347, description: 314, done: 253, signature: 132 }
    : { date: 596, request: 0, hours: 557, total: 0, job: 520, work: 479, equipment: 434, location: 389, description: 347, done: 302, signature: 132 };

  draw(page, font, dateValue(data, "dateRequired"), 282, y.date);
  if (isOncall) draw(page, font, value(data, "customerRequestBy"), 282, y.request);
  draw(page, font, value(data, "actualHours"), 282, y.hours);
  draw(page, font, value(data, "startTime"), 425, y.hours);
  draw(page, font, value(data, "endTime"), 495, y.hours);
  if (isOncall) draw(page, font, value(data, "totalHours"), 455, y.total);
  draw(page, font, value(data, "jobOrder"), 282, y.job, 10);
  draw(page, font, value(data, "workOrder"), 282, y.work, 10);
  draw(page, font, value(data, "equipment"), 282, y.equipment, 10);
  wrap(page, font, value(data, "location"), 282, y.location, 270, 9, 2);
  wrap(page, font, value(data, "description"), 282, y.description, 270, 9, isOncall ? 4 : 3);
  wrap(page, font, value(data, "workDone"), 282, y.done, 270, 9, isOncall ? 4 : 6);
  draw(page, font, value(data, "employeeName"), 65, y.signature, 8);
  draw(page, font, value(data, "supervisorName"), 280, y.signature, 8);
  draw(page, font, value(data, "hcName"), 470, y.signature, 8);
}

function drawCuti(page: PDFPage, font: PDFFont, bold: PDFFont, data: HrFormData) {
  draw(page, font, value(data, "employeeName"), 155, 657, 8);
  draw(page, font, value(data, "employeeId"), 350, 657, 8);
  draw(page, font, dateValue(data, "employmentStartDate"), 155, 641, 8);
  draw(page, font, value(data, "department"), 155, 625, 8);
  draw(page, font, value(data, "position"), 350, 625, 8);
  draw(page, font, dateValue(data, "leaveStartDate"), 278, 596, 8);
  draw(page, font, dateValue(data, "leaveEndDate"), 420, 596, 8);
  draw(page, bold, value(data, "workDays"), 68, 579, 8);
  if (value(data, "leaveType") === "paid") draw(page, bold, "X", 55, 565, 9);
  if (value(data, "leaveType") === "unpaid") draw(page, bold, "X", 270, 565, 9);
  wrap(page, font, value(data, "reason"), 185, 541, 350, 8, 2);
  draw(page, font, value(data, "leaveAddress"), 325, 525, 8);
  draw(page, font, value(data, "phone"), 325, 509, 8);
  draw(page, font, value(data, "handoverTo"), 325, 493, 8);
  draw(page, font, value(data, "applicantSignatureName") || value(data, "employeeName"), 73, 450, 8);
  draw(page, font, dateValue(data, "submittedDate"), 455, 450, 8);

  const hrRows: Array<[string, number, number]> = [
    ["previousYearPeriod", 270, 396], ["previousYearBalance", 374, 396], ["previousYearUsed", 454, 396],
    ["currentYearPeriod", 270, 381], ["currentYearBalance", 374, 381], ["currentYearUsed", 454, 381],
    ["fiveYearBalance", 374, 366], ["fiveYearUsed", 454, 366],
    ["totalEntitlementPeriod", 270, 351], ["totalEntitlement", 374, 351], ["totalUsed", 454, 351],
    ["leaveRequestPeriod", 270, 336], ["leaveRequestBalance", 374, 336], ["leaveRequestUsed", 454, 336],
    ["remainingBeforePeriod", 270, 321], ["remainingBeforeBalance", 374, 321], ["remainingBeforeUsed", 454, 321],
    ["deferredPeriod", 270, 306], ["deferredBalance", 374, 306], ["deferredUsed", 454, 306],
    ["remainingPeriod", 270, 291], ["remainingBalance", 374, 291], ["remainingUsed", 454, 291]
  ];
  hrRows.forEach(([key, x, y]) => draw(page, font, value(data, key), x, y, 7.5));
  draw(page, font, value(data, "hrCheckedBy"), 110, 276, 8);
  draw(page, font, dateValue(data, "hrCheckedDate"), 458, 276, 8);
  draw(page, font, value(data, "approvedDays"), 195, 232, 8);
  draw(page, font, value(data, "deferredDays"), 405, 232, 8);
  wrap(page, font, value(data, "approvalNote"), 100, 204, 420, 8, 2);
  draw(page, font, value(data, "hrApprover"), 73, 110, 8);
  draw(page, font, value(data, "departmentApprover"), 205, 110, 8);
  draw(page, font, value(data, "financeApprover"), 375, 110, 8);
}

export async function generateHrPdf(type: HrFormType, data: HrFormData) {
  const templatePath = resolve(import.meta.dir, "../../../../form-templates", templateNames[type]);
  const document = await PDFDocument.load(await readFile(templatePath));
  const font = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const page = document.getPages()[0];
  if (type === "cuti") drawCuti(page, font, bold, data);
  else drawOperational(page, font, data, type);
  document.setProducer("MKN Site");
  document.setCreator("MKN Site HR");
  return document.save();
}
