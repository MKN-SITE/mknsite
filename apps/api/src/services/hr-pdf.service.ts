import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PDFDocument, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { HrError } from "./hr-validation";

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

function draw(page: PDFPage, font: PDFFont, text: string, x: number, y: number, size = 9, width = 550 - x) {
  if (!text) return;
  if (/[\r\n]/.test(text) || font.widthOfTextAtSize(text, size) > width) throw new HrError(422, `Isian "${text.slice(0, 40)}" melebihi ruang pada PDF. Ringkas isian ini.`);
  page.drawText(text, { x, y, size, font });
}

function wrap(page: PDFPage, font: PDFFont, text: string, x: number, y: number, width: number, size = 9, maxLines = 4) {
  if (!text) return;
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (font.widthOfTextAtSize(word, size) > width) throw new HrError(422, "Satu kata pada isian terlalu panjang untuk kolom PDF. Tambahkan spasi atau ringkas isian.");
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) throw new HrError(422, `Isian melebihi ${maxLines} baris pada PDF. Ringkas isian agar seluruh teks tercetak.`);
  lines.forEach((item, index) => draw(page, font, item, x, y - index * (size + 2), size, width));
}

function drawOperational(page: PDFPage, font: PDFFont, data: HrFormData, type: "oncall" | "overtime") {
  const isOncall = type === "oncall";
  const y = isOncall
    ? { date: 596, request: 561, hours: 526, total: 504, job: 470, work: 426, equipment: 385, location: 347, description: 314, done: 253, signature: 132 }
    : { date: 596, request: 0, hours: 562, total: 0, job: 520, work: 479, equipment: 434, location: 389, description: 347, done: 298, signature: 145 };

  draw(page, font, dateValue(data, "dateRequired"), 282, y.date);
  if (isOncall) draw(page, font, value(data, "customerRequestBy"), 282, y.request);
  draw(page, font, value(data, "actualHours"), 282, y.hours, 9, 70);
  draw(page, font, value(data, "startTime"), 425, y.hours, 9, 40);
  draw(page, font, value(data, "endTime"), 495, y.hours, 9, 45);
  if (isOncall) draw(page, font, value(data, "totalHours"), 455, y.total);
  draw(page, font, value(data, "jobOrder"), 282, y.job, 10);
  draw(page, font, value(data, "workOrder"), 282, y.work, 10);
  draw(page, font, value(data, "equipment"), 282, y.equipment, 10);
  wrap(page, font, value(data, "location"), 282, y.location, 270, 9, 2);
  wrap(page, font, value(data, "description"), 282, y.description, 270, 9, isOncall ? 4 : 3);
  wrap(page, font, value(data, "workDone"), 282, y.done, 270, 9, isOncall ? 2 : 5);
  draw(page, font, value(data, "employeeName"), 65, y.signature, 8, 140);
  draw(page, font, value(data, "supervisorName"), 280, y.signature, 8, 130);
  draw(page, font, value(data, "hcName"), 470, y.signature, 8, 95);
}

function drawCuti(page: PDFPage, font: PDFFont, bold: PDFFont, data: HrFormData) {
  draw(page, font, value(data, "employeeName"), 155, 657, 8, 140);
  draw(page, font, value(data, "employeeId"), 350, 657, 8);
  draw(page, font, dateValue(data, "employmentStartDate"), 155, 641, 8);
  draw(page, font, value(data, "department"), 155, 625, 8, 140);
  draw(page, font, value(data, "position"), 350, 625, 8);
  draw(page, font, dateValue(data, "leaveStartDate"), 278, 596, 8, 100);
  draw(page, font, dateValue(data, "leaveEndDate"), 420, 596, 8);
  draw(page, bold, value(data, "workDays"), 68, 579, 8, 30);
  if (value(data, "leaveType") === "paid") draw(page, bold, "X", 55, 565, 9);
  if (value(data, "leaveType") === "unpaid") draw(page, bold, "X", 270, 565, 9);
  wrap(page, font, value(data, "reason"), 185, 544, 350, 8, 1);
  draw(page, font, value(data, "leaveAddress"), 325, 525, 8);
  draw(page, font, value(data, "phone"), 325, 509, 8);
  draw(page, font, value(data, "handoverTo"), 325, 493, 8);
  draw(page, font, value(data, "applicantSignatureName") || value(data, "employeeName"), 55, 455, 8, 190);
  draw(page, font, dateValue(data, "submittedDate"), 474, 439, 8, 55);

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
  hrRows.forEach(([key, x, y]) => draw(page, font, value(data, key), x === 270 ? 276 : x === 454 ? 442 : x, y + 3, 7.5, x === 270 ? 55 : x === 454 ? 28 : 36));
  draw(page, font, value(data, "hrCheckedBy"), 110, 279, 8, 105);
  draw(page, font, dateValue(data, "hrCheckedDate"), 458, 279, 8, 65);
  draw(page, font, value(data, "approvedDays"), 140, 238, 8, 60);
  draw(page, font, value(data, "deferredDays"), 380, 238, 8, 30);
  wrap(page, font, value(data, "approvalNote"), 102, 210, 420, 8, 1);
  draw(page, font, value(data, "hrApprover"), 73, 118, 8, 120);
  draw(page, font, value(data, "departmentApprover"), 205, 118, 8, 155);
  draw(page, font, value(data, "financeApprover"), 375, 118, 8, 150);
}

export async function generateHrPdf(type: HrFormType, data: HrFormData) {
  const templatePath = resolve(import.meta.dir, "../../../../form-templates", templateNames[type]);
  const document = await PDFDocument.create();
  // A separate form XObject contains the master's clipping and graphics state.
  // Appending text to the original page could clip dates after the first digits.
  const [background] = await document.embedPdf(await readFile(templatePath), [0]);
  const page = document.addPage([background.width, background.height]);
  page.drawPage(background);
  const font = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  for (const [key, text] of Object.entries(data)) {
    try { font.encodeText(text.replace(/[\r\n\t]/g, " ")); }
    catch { throw new HrError(422, `Isian ${key} mengandung karakter yang tidak didukung font PDF. Gunakan huruf Latin tanpa emoji.`); }
  }
  if (type === "cuti") drawCuti(page, font, bold, data);
  else drawOperational(page, font, data, type);
  document.setProducer("MKN Site");
  document.setCreator("MKN Site HR");
  return document.save();
}
