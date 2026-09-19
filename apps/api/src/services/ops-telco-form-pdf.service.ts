import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { PDFDocument, StandardFonts, rgb, degrees, type PDFFont, type PDFPage } from "pdf-lib";
import { OpsTelcoFormError, type OpsTelcoFormData, type OpsTelcoFormType } from "./ops-telco-form-validation";

export type { OpsTelcoFormType, OpsTelcoFormData };
// Backwards compatibility aliases
export type HrFormType = OpsTelcoFormType;
export type HrFormData = OpsTelcoFormData;

const templateNames: Record<"overtime" | "cuti" | "oncall", string> = {
  overtime: "ops-telco/technician/overtime/From Overtime.pdf",
  cuti: "ops-telco/technician/cuti/From Cuti.pdf",
  oncall: "ops-telco/technician/oncall/From Oncall.pdf"
};

function resolveTemplatePath(subPath: string): string {
  // Try relative to source file (local development & standard monorepo build)
  const devPath = resolve(import.meta.dir, "../../../../form-templates", subPath);
  if (existsSync(devPath)) return devPath;

  // Try container root fallback (/app/form-templates/...)
  const containerPath = resolve("/app/form-templates", subPath);
  if (existsSync(containerPath)) return containerPath;

  // Fallback to devPath if neither exists yet
  return devPath;
}

function value(data: OpsTelcoFormData, key: string) {
  return String(data[key] ?? "").trim();
}

function dateValue(data: OpsTelcoFormData, key: string) {
  const raw = value(data, key);
  if (!raw) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  try {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch {
    // ignore
  }
  return raw.slice(0, 10);
}

function draw(page: PDFPage, font: PDFFont, text: string, x: number, y: number, size = 9, width = 550 - x) {
  if (!text) return;
  if (/[\r\n]/.test(text) || font.widthOfTextAtSize(text, size) > width) {
    throw new OpsTelcoFormError(422, `Isian "${text.slice(0, 40)}" melebihi ruang pada PDF. Ringkas isian ini.`);
  }
  page.drawText(text, { x, y, size, font });
}

function drawSignature(page: PDFPage, font: PDFFont, text: string, x: number, y: number, initialSize = 8, width = 140) {
  if (!text) return;
  const textClean = text.replace(/[\r\n]+/g, " ").trim();
  const currentWidth = font.widthOfTextAtSize(textClean, initialSize);
  let size = initialSize;
  if (currentWidth > width) {
    const fittedSize = Math.floor((width / currentWidth) * initialSize * 10) / 10;
    size = Math.max(5, Math.min(initialSize, fittedSize));
  }
  page.drawText(textClean, { x, y, size, font });
}

function drawCentered(page: PDFPage, font: PDFFont, text: string, startX: number, endX: number, y: number, size = 9) {
  if (!text) return;
  const clean = text.replace(/[\r\n]+/g, " ").trim();
  const textWidth = font.widthOfTextAtSize(clean, size);
  const centerX = (startX + endX) / 2;
  const x = Math.round(centerX - textWidth / 2);
  page.drawText(clean, { x, y, size, font });
}

function wrap(page: PDFPage, font: PDFFont, text: string, x: number, y: number, width: number, size = 9, maxLines = 4) {
  if (!text) return;
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (font.widthOfTextAtSize(word, size) > width) {
      throw new OpsTelcoFormError(422, "Satu kata pada isian terlalu panjang untuk kolom PDF. Tambahkan spasi atau ringkas isian.");
    }
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    throw new OpsTelcoFormError(422, `Isian melebihi ${maxLines} baris pada PDF. Ringkas isian agar seluruh teks tercetak.`);
  }
  lines.forEach((item, index) => draw(page, font, item, x, y - index * (size + 2), size, width));
}

function drawOncall(page: PDFPage, font: PDFFont, bold: PDFFont, data: OpsTelcoFormData) {
  // Coordinates calibrated from visual audit of From Oncall.pdf master template
  // Right value column starts at x≈303 (after the vertical divider line)
  // Signature labels (Employee/Supervisor/HC) are at approximately y=158
  const xVal = 303; // start of right value column

  // Row Y positions (middle of each row, calibrated from Y-ruler overlay)
  const y = {
    date: 593,        // Date Required row (vertically centered in 573..618 box)
    request: 563,     // Customer Request by row (vertically centered in 556..573 box)
    hours: 524,       // Actual Hours row (centered baseline above dotted lines)
    job: 480,         // Job Order No. row
    work: 435,        // Work Order No. row
    equipment: 393,   // Equipment No. row
    location: 355,    // Location row
    description: 310, // Description row
    done: 255,        // Work Done row
    signature: 158    // Signature row (Employee/Supervisor/HC)
  };

  draw(page, font, dateValue(data, "dateRequired"), xVal, y.date, 9.5);
  draw(page, font, value(data, "customerRequestBy"), xVal, y.request, 9);

  // Cover static "Total Hours :" from template background without touching bottom dotted border (y=499.2)
  page.drawRectangle({
    x: 385,
    y: 501,
    width: 90,
    height: 11,
    color: rgb(1, 1, 1)
  });

  // Cover original asymmetric dotted lines & "S / d" (x=406 to 560, y=517 to 529)
  page.drawRectangle({
    x: 406,
    y: 517,
    width: 154,
    height: 12,
    color: rgb(1, 1, 1)
  });

  // Center "S / d" and draw identical length dotted lines before and after
  const sdText = "S / d";
  const sdWidth = bold.widthOfTextAtSize(sdText, 8.5);
  const sdX = Math.round(483 - sdWidth / 2); // ~474
  page.drawText(sdText, { x: sdX, y: 523, size: 8.5, font: bold });

  const dotLen = 52;
  const line1End = sdX - 6; // 468
  const line1Start = line1End - dotLen; // 416
  const line2Start = sdX + sdWidth + 6; // 498
  const line2End = line2Start + dotLen; // 550

  // Draw identical dotted lines
  page.drawLine({
    start: { x: line1Start, y: 521.5 },
    end: { x: line1End, y: 521.5 },
    thickness: 0.8,
    dashArray: [1, 1.8],
    color: rgb(0.25, 0.25, 0.25)
  });

  page.drawLine({
    start: { x: line2Start, y: 521.5 },
    end: { x: line2End, y: 521.5 },
    thickness: 0.8,
    dashArray: [1, 1.8],
    color: rgb(0.25, 0.25, 0.25)
  });

  // Actual hours: value centered over dots (x=280..325)
  // Start time: centered over first dotted line (x=416..468)
  // End time: centered over second dotted line (x=498..550)
  drawCentered(page, font, value(data, "actualHours"), 280, 325, y.hours, 9.5);
  drawCentered(page, font, value(data, "startTime"), line1Start, line1End, y.hours, 9);
  drawCentered(page, font, value(data, "endTime"), line2Start, line2End, y.hours, 9);

  draw(page, font, value(data, "jobOrder"), xVal, y.job, 10);
  draw(page, font, value(data, "workOrder"), xVal, y.work, 10);
  draw(page, font, value(data, "equipment"), xVal, y.equipment, 10);
  wrap(page, font, value(data, "location"), xVal, y.location, 280, 9, 2);
  wrap(page, font, value(data, "description"), xVal, y.description, 280, 9, 3);
  wrap(page, font, value(data, "workDone"), xVal, y.done, 280, 9, 3);
  // Cover static "Print Name & Badge No" text from template with clean white rectangles
  // Employee block
  page.drawRectangle({
    x: 64,
    y: 141,
    width: 140,
    height: 14,
    color: rgb(1, 1, 1)
  });
  // Supervisor block
  page.drawRectangle({
    x: 277,
    y: 141,
    width: 140,
    height: 14,
    color: rgb(1, 1, 1)
  });
  // Dynamic names replace "Print Name & Badge No" position directly (baseline y = 145)
  drawSignature(page, font, value(data, "employeeName"), 65, 145, 8.5, 190);
  drawSignature(page, font, value(data, "supervisorName") || "Rahmansyah - Z110997", 278, 145, 8.5, 190);

  // HC block: hanya tutupi dan isi jika hcName diinput, jika tidak biarkan teks asli template "Print Name & Badge No" tetap ada
  const hcName = value(data, "hcName");
  if (hcName) {
    page.drawRectangle({
      x: 468,
      y: 141,
      width: 140,
      height: 14,
      color: rgb(1, 1, 1)
    });
    drawSignature(page, font, hcName, 469, 145, 8.5, 140);
  }
}


function drawOvertime(page: PDFPage, font: PDFFont, bold: PDFFont, data: OpsTelcoFormData) {
  const xVal = 282;
  const y = {
    date: 595,
    hours: 562,
    job: 505,
    work: 462,
    equipment: 418,
    location: 375,
    description: 338,
    done: 282
  };
  draw(page, font, dateValue(data, "dateRequired"), xVal, y.date, 9.5);
  drawCentered(page, font, value(data, "actualHours"), 280, 335, y.hours, 9.5);
  drawCentered(page, font, value(data, "startTime"), 410, 450, y.hours, 9);
  drawCentered(page, font, value(data, "endTime"), 475, 535, y.hours, 9);
  draw(page, font, value(data, "jobOrder"), xVal, y.job, 10);
  draw(page, font, value(data, "workOrder"), xVal, y.work, 10);
  draw(page, font, value(data, "equipment"), xVal, y.equipment, 10);
  wrap(page, font, value(data, "location"), xVal, y.location, 270, 9, 2);
  wrap(page, font, value(data, "description"), xVal, y.description, 270, 9, 3);
  wrap(page, font, value(data, "workDone"), xVal, y.done, 270, 9, 4);

  // Cover static "Print Name & Badge No"
  // Employee block
  page.drawRectangle({
    x: 64,
    y: 156,
    width: 145,
    height: 14,
    color: rgb(1, 1, 1)
  });
  // Supervisor block
  page.drawRectangle({
    x: 235,
    y: 156,
    width: 145,
    height: 14,
    color: rgb(1, 1, 1)
  });

  drawSignature(page, font, value(data, "employeeName"), 65, 160, 8.5, 190);
  drawSignature(page, font, value(data, "supervisorName") || "Rahmansyah - Z110997", 238, 160, 8.5, 190);

  const hcName = value(data, "hcName");
  if (hcName) {
    page.drawRectangle({
      x: 410,
      y: 156,
      width: 140,
      height: 14,
      color: rgb(1, 1, 1)
    });
    drawSignature(page, font, hcName, 412, 160, 8.5, 140);
  }
}

function drawCuti(page: PDFPage, font: PDFFont, bold: PDFFont, data: OpsTelcoFormData) {
  // Identity (baselines matched exactly to From Cuti.pdf stream: 655.7, 639.5, 623.3)
  const empName = value(data, "employeeName");
  const empId = value(data, "kpcId") || value(data, "employeeId");
  const startWorkDate = dateValue(data, "startDate") || dateValue(data, "employmentStartDate");
  const division = value(data, "division") || value(data, "department") || "OPS Telco";
  const position = value(data, "position");

  // Left column: colons end at 152.6, text starts at 160
  draw(page, bold, empName, 160, 655.7, 9);
  draw(page, font, startWorkDate, 160, 639.5, 9);
  draw(page, font, division, 160, 623.3, 9);

  // Right column: colons end at 338.9, text starts at 345
  draw(page, bold, empId, 345, 655.7, 9);
  drawSignature(page, font, position, 345, 623.3, 8.5, 205);

  // Dates & Duration (calibrated directly from PDF stream vector lines)
  // Date 1 underline: x=277.2..342.0 (center 309.6), y=596.4
  // Date 2 underline: x=420.2..484.6 (center 452.4), y=596.8
  // Duration underline: x=50.9..117.0 (center 84.0), y=578.8
  const sDate = dateValue(data, "leaveStartDate");
  const eDate = dateValue(data, "leaveEndDate");
  const days = value(data, "totalDays") || value(data, "workDays");

  drawCentered(page, bold, sDate, 277.2, 342.0, 598.0, 8.5);
  drawCentered(page, bold, eDate, 420.2, 484.6, 598.0, 8.5);
  drawCentered(page, bold, days, 50.9, 117.0, 580.5, 9.5);

  // Leave Type (Check X, centered inside parentheses)
  // Checkbox 1: parentheses at 53.5 and 61.0 (center 57.25)
  // Checkbox 2: parentheses at 269.0 and 292.5 (center 280.75)
  const lType = value(data, "leaveType");
  const isPaid = lType !== "unpaid" && lType !== "tanpa_upah";
  if (isPaid) {
    drawCentered(page, bold, "X", 53.5, 61.0, 566.0, 8.5);
  } else {
    drawCentered(page, bold, "X", 269.0, 292.5, 566.0, 8.5);
  }

  // Reason with Leave Category (underline: x=183.0..540.6, y=541.0)
  const leaveTypeLabelMap: Record<string, string> = {
    tahunan: "Cuti Tahunan",
    sakit: "Cuti Sakit",
    melahirkan: "Cuti Melahirkan",
    penting: "Keperluan Penting",
    lainnya: "Lainnya"
  };
  const categoryLabel = leaveTypeLabelMap[lType] || (lType === "paid" ? "Cuti Tahunan" : lType);
  const rawReason = value(data, "reason");
  const reasonText = categoryLabel ? `[${categoryLabel}] ${rawReason}` : rawReason;
  drawSignature(page, font, reasonText, 185, 543.0, 8.5, 355);

  // Address & Contacts (colons at 320.9, baselines: 526.1, 511.2, 496.3)
  const address = value(data, "leaveAddress") || "Sangatta, Kutai Timur";
  const phone = value(data, "contactDuringLeave") || value(data, "phone");
  const handover = value(data, "notes") || value(data, "handoverTo") || "Tim Teknisi OPS Telco";

  drawSignature(page, font, address, 329, 526.1, 8.5, 215);
  drawSignature(page, bold, phone, 329, 511.2, 8.5, 215);
  drawSignature(page, font, handover, 329, 496.3, 8.5, 215);

  // Applicant Signature Block (dots: x=52.8..151.7, y=449.6)
  page.drawRectangle({
    x: 50,
    y: 445,
    width: 104,
    height: 11,
    color: rgb(1, 1, 1)
  });
  const sigApplicant = value(data, "applicantSignatureName") || empName;
  drawCentered(page, bold, `( ${sigApplicant} )`, 52.8, 151.7, 449.6, 8.5);

  // Submission Date (dots: x=471.0..522.0, baseline y=436.0)
  const subDate = dateValue(data, "submittedDate") || dateValue(data, "createdAt");
  if (subDate) {
    page.drawRectangle({
      x: 471,
      y: 432,
      width: 53,
      height: 11,
      color: rgb(1, 1, 1)
    });
    drawCentered(page, bold, subDate, 471, 524, 436.0, 8);
  }

  // Top Right Form Number
  const fNum = value(data, "formNumber");
  if (fNum) {
    draw(page, font, `No. Form: ${fNum}`, 440, 765, 8.5, 160);
  }

  // Section C: Head of Dept. approval is left completely blank
}


export async function generateOpsTelcoPdf(type: OpsTelcoFormType, data: OpsTelcoFormData) {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);

  for (const [key, text] of Object.entries(data)) {
    try {
      font.encodeText(text.replace(/[\r\n\t]/g, " "));
    } catch {
      throw new OpsTelcoFormError(422, `Isian ${key} mengandung karakter yang tidak didukung font PDF. Gunakan huruf Latin tanpa emoji.`);
    }
  }

  const templatePath = resolveTemplatePath(templateNames[type]);
  const [background] = await document.embedPdf(await readFile(templatePath), [0]);
  const page = document.addPage([background.width, background.height]);
  page.drawPage(background);

  if (type === "cuti") {
    drawCuti(page, font, bold, data);
  } else if (type === "oncall") {
    drawOncall(page, font, bold, data);
  } else {
    drawOvertime(page, font, bold, data);
  }

  document.setProducer("MKN Site");
  document.setCreator("MKN Site OPS Telco");
  return document.save();
}

// Backwards compatibility alias
export const generateHrPdf = generateOpsTelcoPdf;

export interface OncallJobPdfParticipant {
  userId: number;
  participantRole: "pic" | "member";
  nameSnapshot: string;
  kpcIdSnapshot: string | null;
}

export interface OncallJobPdfSignature {
  signerUserId: number;
  signerType: "technician" | "supervisor";
  workflowVersion: number;
  signatureFile: string;
}

export interface GenerateOncallJobPdfParams {
  job: {
    id: number;
    formNumber: string;
    jobOrderNo: string | null;
    status: string;
    data: OpsTelcoFormData;
  };
  participants: OncallJobPdfParticipant[];
  signatures: OncallJobPdfSignature[];
  supervisorSignature?: {
    nameSnapshot: string;
    kpcIdSnapshot?: string | null;
    signatureFile: string;
  } | null;
}

function drawWatermark(page: PDFPage, font: PDFFont) {
  const { width, height } = page.getSize();
  const text = "DRAFT / BELUM DISETUJUI";
  const size = 32;
  const textWidth = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: (width - textWidth) / 2 - 20,
    y: height / 2 - 20,
    size,
    font,
    color: rgb(0.85, 0.25, 0.25),
    opacity: 0.35,
    rotate: degrees(35)
  });
}

/**
 * Generate multi-page PDF for an Oncall Job:
 * One page per technician (PIC first, then members).
 * Each page has shared work data + individual technician signature + supervisor signature if approved.
 */
export async function generateOncallJobPdf(params: GenerateOncallJobPdfParams): Promise<Uint8Array> {
  const { job, participants, signatures, supervisorSignature } = params;
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);

  const sharedData: OpsTelcoFormData = {
    ...job.data,
    jobOrder: job.jobOrderNo || job.data.jobOrder || job.formNumber
  };

  // Sort participants: PIC first, then by name
  const sortedParticipants = [...participants].sort((a, b) => {
    if (a.participantRole === "pic" && b.participantRole !== "pic") return -1;
    if (a.participantRole !== "pic" && b.participantRole === "pic") return 1;
    return a.nameSnapshot.localeCompare(b.nameSnapshot);
  });

  // If no participants found, fallback to at least one page
  const techList = sortedParticipants.length > 0 ? sortedParticipants : [
    {
      userId: 0,
      participantRole: "pic" as const,
      nameSnapshot: value(sharedData, "employeeName") || "Teknisi",
      kpcIdSnapshot: null
    }
  ];

  // Pre-load supervisor signature PNG if available
  let spvImage: any = null;
  if (supervisorSignature?.signatureFile) {
    try {
      const { getSignatureBuffer } = await import("./signature-storage.service");
      const spvBuffer = await getSignatureBuffer(supervisorSignature.signatureFile);
      spvImage = await document.embedPng(spvBuffer);
    } catch {
      spvImage = null;
    }
  }

  const isApproved = job.status === "approved";

  for (let idx = 0; idx < techList.length; idx++) {
    const tech = techList[idx];
    // Embed background template
    const templatePath = resolveTemplatePath(templateNames["oncall"]);
    const templateBytes = await readFile(templatePath);
    const [background] = await document.embedPdf(templateBytes, [0]);
    const page = document.addPage([background.width, background.height]);
    page.drawPage(background);

    const techIdentity = tech.kpcIdSnapshot
      ? `${tech.nameSnapshot} - ${tech.kpcIdSnapshot}`
      : tech.nameSnapshot;

    const pageData: OpsTelcoFormData = {
      ...sharedData,
      employeeName: techIdentity,
      supervisorName: supervisorSignature?.nameSnapshot
        ? (supervisorSignature.kpcIdSnapshot ? `${supervisorSignature.nameSnapshot} - ${supervisorSignature.kpcIdSnapshot}` : supervisorSignature.nameSnapshot)
        : "Rahmansyah - Z110997"
    };

    // Draw oncall data fields onto the template
    drawOncall(page, font, bold, pageData);

    // Draw Page X of Y indicator - place in top right area of template
    const pageIndicator = `Halaman ${idx + 1} / ${techList.length} (${tech.participantRole.toUpperCase()})`;
    page.drawText(pageIndicator, {
      x: 380,
      y: 760,
      size: 7,
      font,
      color: rgb(0.4, 0.4, 0.4)
    });

    // Embed technician signature image if exists
    const techSig = signatures.find(
      (s) => s.signerUserId === tech.userId && s.signerType === "technician"
    );
    if (techSig?.signatureFile) {
      try {
        const { getSignatureBuffer } = await import("./signature-storage.service");
        const sigBuffer = await getSignatureBuffer(techSig.signatureFile);
        const techImage = await document.embedPng(sigBuffer);
        // Employee signature box: tepat di atas teks "Employee" (y=170..215)
        const maxW = 140;
        const maxH = 45;
        const scale = Math.min(maxW / techImage.width, maxH / techImage.height);
        const imgW = techImage.width * scale;
        const imgH = techImage.height * scale;
        const posX = 65 + (150 - imgW) / 2;
        page.drawImage(techImage, {
          x: posX,
          y: 172,
          width: imgW,
          height: imgH
        });
      } catch {
        // Fallback: continue without signature image
      }
    }

    // Embed supervisor signature image if approved
    if (isApproved && spvImage) {
      try {
        // Supervisor signature box: tepat di atas teks "Supervisor" (y=170..215)
        const maxW = 140;
        const maxH = 45;
        const scale = Math.min(maxW / spvImage.width, maxH / spvImage.height);
        const imgW = spvImage.width * scale;
        const imgH = spvImage.height * scale;
        const posX = 278 + (150 - imgW) / 2;
        page.drawImage(spvImage, {
          x: posX,
          y: 172,
          width: imgW,
          height: imgH
        });
      } catch {
        // Fallback: continue without supervisor image
      }
    }

    // Watermark if not approved
    if (!isApproved) {
      drawWatermark(page, bold);
    }
  }

  document.setProducer("MKN Site");
  document.setCreator("MKN Site OPS Telco");
  return document.save();
}

export type OvertimeJobPdfParticipant = OncallJobPdfParticipant;
export type OvertimeJobPdfSignature = OncallJobPdfSignature;
export type GenerateOvertimeJobPdfParams = GenerateOncallJobPdfParams;

/**
 * Generate multi-page PDF for an Overtime Job:
 * One page per technician (PIC first, then members).
 * Each page has shared work data + individual technician signature + supervisor signature if approved.
 */
export async function generateOvertimeJobPdf(params: GenerateOvertimeJobPdfParams): Promise<Uint8Array> {
  const { job, participants, signatures, supervisorSignature } = params;
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);

  const sharedData: OpsTelcoFormData = {
    ...job.data,
    jobOrder: job.jobOrderNo || job.data.jobOrder || job.formNumber
  };

  // Sort participants: PIC first, then by name
  const sortedParticipants = [...participants].sort((a, b) => {
    if (a.participantRole === "pic" && b.participantRole !== "pic") return -1;
    if (a.participantRole !== "pic" && b.participantRole === "pic") return 1;
    return a.nameSnapshot.localeCompare(b.nameSnapshot);
  });

  // If no participants found, fallback to at least one page
  const techList = sortedParticipants.length > 0 ? sortedParticipants : [
    {
      userId: 0,
      participantRole: "pic" as const,
      nameSnapshot: value(sharedData, "employeeName") || "Teknisi",
      kpcIdSnapshot: null
    }
  ];

  // Pre-load supervisor signature PNG if available
  let spvImage: any = null;
  if (supervisorSignature?.signatureFile) {
    try {
      const { getSignatureBuffer } = await import("./signature-storage.service");
      const spvBuffer = await getSignatureBuffer(supervisorSignature.signatureFile);
      spvImage = await document.embedPng(spvBuffer);
    } catch {
      spvImage = null;
    }
  }

  const isApproved = job.status === "approved";

  for (let idx = 0; idx < techList.length; idx++) {
    const tech = techList[idx];
    // Embed background template
    const templatePath = resolveTemplatePath(templateNames["overtime"]);
    const templateBytes = await readFile(templatePath);
    const [background] = await document.embedPdf(templateBytes, [0]);
    const page = document.addPage([background.width, background.height]);
    page.drawPage(background);

    const techIdentity = tech.kpcIdSnapshot
      ? `${tech.nameSnapshot} - ${tech.kpcIdSnapshot}`
      : tech.nameSnapshot;

    const pageData: OpsTelcoFormData = {
      ...sharedData,
      employeeName: techIdentity,
      supervisorName: supervisorSignature?.nameSnapshot
        ? (supervisorSignature.kpcIdSnapshot ? `${supervisorSignature.nameSnapshot} - ${supervisorSignature.kpcIdSnapshot}` : supervisorSignature.nameSnapshot)
        : "Rahmansyah - Z110997"
    };

    // Draw overtime data fields onto the template
    drawOvertime(page, font, bold, pageData);

    // Draw Page X of Y indicator - place in top right area of template
    const pageIndicator = `Halaman ${idx + 1} / ${techList.length} (${tech.participantRole.toUpperCase()})`;
    page.drawText(pageIndicator, {
      x: 380,
      y: 760,
      size: 7,
      font,
      color: rgb(0.4, 0.4, 0.4)
    });

    // Embed technician signature image if exists
    const techSig = signatures.find(
      (s) => s.signerUserId === tech.userId && s.signerType === "technician"
    );
    if (techSig?.signatureFile) {
      try {
        const { getSignatureBuffer } = await import("./signature-storage.service");
        const sigBuffer = await getSignatureBuffer(techSig.signatureFile);
        const techImage = await document.embedPng(sigBuffer);
        // Employee signature box: tepat di atas teks "Employee" (y=175..220)
        const maxW = 140;
        const maxH = 45;
        const scale = Math.min(maxW / techImage.width, maxH / techImage.height);
        const imgW = techImage.width * scale;
        const imgH = techImage.height * scale;
        const posX = 65 + (150 - imgW) / 2;
        page.drawImage(techImage, {
          x: posX,
          y: 175,
          width: imgW,
          height: imgH
        });
      } catch {
        // Fallback: continue without signature image
      }
    }

    // Embed supervisor signature image if approved
    if (isApproved && spvImage) {
      try {
        // Supervisor signature box: tepat di atas teks "Supervisor" (y=175..220)
        const maxW = 140;
        const maxH = 45;
        const scale = Math.min(maxW / spvImage.width, maxH / spvImage.height);
        const imgW = spvImage.width * scale;
        const imgH = spvImage.height * scale;
        const posX = 238 + (150 - imgW) / 2;
        page.drawImage(spvImage, {
          x: posX,
          y: 175,
          width: imgW,
          height: imgH
        });
      } catch {
        // Fallback: continue without supervisor image
      }
    }

    // Watermark if not approved
    if (!isApproved) {
      drawWatermark(page, bold);
    }
  }

  document.setProducer("MKN Site");
  document.setCreator("MKN Site OPS Telco");
  return document.save();
}

export interface GenerateCutiJobPdfParams {
  form: {
    id: number;
    formNumber: string;
    status: string;
    data: OpsTelcoFormData;
    createdAt?: string | Date;
    submittedAt?: string | Date | null;
  };
  applicantSignature?: {
    nameSnapshot: string;
    signatureFile?: string | null;
  } | null;
  supervisorSignature?: {
    nameSnapshot: string;
    kpcIdSnapshot?: string | null;
    signatureFile?: string | null;
  } | null;
}

/**
 * Generate official PDF for Form Cuti based on From Cuti.pdf master template.
 */
export async function generateCutiJobPdf(params: GenerateCutiJobPdfParams): Promise<Uint8Array> {
  const { form, applicantSignature, supervisorSignature } = params;
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);

  const templatePath = resolveTemplatePath(templateNames["cuti"]);
  const templateBytes = await readFile(templatePath);
  const [background] = await document.embedPdf(templateBytes, [0]);
  const page = document.addPage([background.width, background.height]);
  page.drawPage(background);

  const pageData: OpsTelcoFormData = {
    ...form.data,
    formNumber: form.formNumber,
    submittedDate: form.submittedAt
      ? (form.submittedAt instanceof Date ? form.submittedAt.toISOString().split("T")[0] : String(form.submittedAt).split("T")[0])
      : (form.createdAt ? (form.createdAt instanceof Date ? form.createdAt.toISOString().split("T")[0] : String(form.createdAt).split("T")[0]) : "")
  };

  // Draw calibrated cuti fields onto From Cuti.pdf (Section C is left blank)
  drawCuti(page, font, bold, pageData);

  // If applicant has a signature image, embed it above ( Rahmansyah )
  if (applicantSignature?.signatureFile) {
    try {
      const { getSignatureBuffer } = await import("./signature-storage.service");
      const appBuffer = await getSignatureBuffer(applicantSignature.signatureFile);
      const appImage = await document.embedPng(appBuffer);
      const maxW = 95;
      const maxH = 34;
      const scale = Math.min(maxW / appImage.width, maxH / appImage.height);
      const w = appImage.width * scale;
      const h = appImage.height * scale;
      const x = 42 + (106 - w) / 2;
      page.drawImage(appImage, {
        x,
        y: 460,
        width: w,
        height: h
      });
    } catch {
      // ignore
    }
  }

  // Watermark if draft
  if (form.status === "draft") {
    drawWatermark(page, bold);
  }

  document.setProducer("MKN Site");
  document.setCreator("MKN Site OPS Telco");
  return document.save();
}

