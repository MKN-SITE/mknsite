import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatDateDisplay, PERMANENT_NOTES } from "./oncall-schedule.service";

export interface OncallSlotDto {
  slotNumber: number;
  startDate: string;
  endDate: string;
  date1: string;
  date2: string;
  date3: string;
  dates?: string[];
  telcoUserId: number;
  telcoUserName: string;
  ospUserId: number;
  ospUserName: string;
  notes?: string | null;
}

export interface OncallCrewDto {
  userId: number;
  name: string;
  displayName?: string | null;
  crewType: "telco" | "osp";
  sequenceOrder: number;
}

export interface OncallPdfData {
  title: string;
  periodLabel: string;
  year: number;
  telcoSupervisorName: string;
  telcoSupervisorPhone: string;
  ospSupervisorName: string;
  ospSupervisorPhone: string;
  superintendentName: string;
  telcoCrews: OncallCrewDto[];
  ospCrews: OncallCrewDto[];
  slots: OncallSlotDto[];
}

function resolveLogoPath(): string | null {
  const candidatePaths = [
    resolve(import.meta.dir, "../../../../apps/web/public/assets/Logo MKN.png"),
    resolve("/app/apps/web/public/assets/Logo MKN.png"),
    resolve(import.meta.dir, "../../../../form-templates/ops-telco/supervisor/jadwaloncall/logo.png"),
    resolve("apps/web/public/assets/Logo MKN.png")
  ];

  for (const p of candidatePaths) {
    if (existsSync(p)) return p;
  }
  return null;
}

export async function generateOncallSchedulePdf(data: OncallPdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]); // Standard Letter Portrait

  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  // 1. Draw MKN Logo if available
  const logoPath = resolveLogoPath();
  if (logoPath) {
    try {
      const logoBytes = await readFile(logoPath);
      const logoImg = await doc.embedPng(logoBytes);
      const logoDims = logoImg.scale(0.08); // scale nicely
      // Fit to max width 90, max height 40
      const targetW = Math.min(90, logoDims.width);
      const targetH = (targetW / logoDims.width) * logoDims.height;
      page.drawImage(logoImg, {
        x: 36,
        y: 728,
        width: targetW,
        height: targetH
      });
    } catch {
      // Logo drawing fallback
    }
  }

  // 2. Title & Header
  const titleText = "Jadwal On Call OSP & Telco Crew";
  const titleW = fontBold.widthOfTextAtSize(titleText, 14);
  page.drawText(titleText, {
    x: (612 - titleW) / 2,
    y: 742,
    size: 14,
    font: fontBold,
    color: rgb(0, 0, 0)
  });

  const periodText = `Periode : ${data.periodLabel}`;
  const periodW = fontBold.widthOfTextAtSize(periodText, 9.5);
  // Aligned towards right column or top of table
  page.drawText(periodText, {
    x: 576 - periodW,
    y: 712,
    size: 9.5,
    font: fontBold,
    color: rgb(0, 0, 0)
  });

  // 3. Table Column Layout
  // Total printable width = 612 - (36 * 2) = 540 pt
  const startX = 36;
  let currentY = 700;

  const colWidths = {
    no: 28,
    periode: 82,
    telco: 48, // 5 cols * 48 = 240
    osp: 47.5  // 4 cols * 47.5 = 190 => 28 + 82 + 240 + 190 = 540 pt exactly
  };

  const telcoList = data.telcoCrews.slice(0, 5);
  const ospList = data.ospCrews.slice(0, 4);

  const totalTelcoW = colWidths.telco * 5;
  const totalOspW = colWidths.osp * 4;

  const headerRow1H = 20;
  const headerRow2H = 20;
  const totalHeaderH = headerRow1H + headerRow2H;

  const borderColor = rgb(0, 0, 0);
  const borderW = 0.6;
  const yellowColor = rgb(1, 1, 0); // #FFFF00

  // --- DRAW HEADER ROW 1 & 2 ---
  // No column (spans 2 rows)
  page.drawRectangle({
    x: startX,
    y: currentY - totalHeaderH,
    width: colWidths.no,
    height: totalHeaderH,
    borderColor,
    borderWidth: borderW
  });
  const noTextW = fontBold.widthOfTextAtSize("No", 9);
  page.drawText("No", {
    x: startX + (colWidths.no - noTextW) / 2,
    y: currentY - totalHeaderH / 2 - 3,
    size: 9,
    font: fontBold
  });

  // Periode column (spans 2 rows)
  const periodeX = startX + colWidths.no;
  page.drawRectangle({
    x: periodeX,
    y: currentY - totalHeaderH,
    width: colWidths.periode,
    height: totalHeaderH,
    borderColor,
    borderWidth: borderW
  });
  const perTextW = fontBold.widthOfTextAtSize("Periode", 9);
  page.drawText("Periode", {
    x: periodeX + (colWidths.periode - perTextW) / 2,
    y: currentY - totalHeaderH / 2 - 3,
    size: 9,
    font: fontBold
  });

  // Crew Telco header group
  const telcoStartX = periodeX + colWidths.periode;
  page.drawRectangle({
    x: telcoStartX,
    y: currentY - headerRow1H,
    width: totalTelcoW,
    height: headerRow1H,
    borderColor,
    borderWidth: borderW
  });
  const telcoGroupW = fontBold.widthOfTextAtSize("Crew Telco", 9);
  page.drawText("Crew Telco", {
    x: telcoStartX + (totalTelcoW - telcoGroupW) / 2,
    y: currentY - headerRow1H / 2 - 3,
    size: 9,
    font: fontBold
  });

  // Crew OSP header group
  const ospStartX = telcoStartX + totalTelcoW;
  page.drawRectangle({
    x: ospStartX,
    y: currentY - headerRow1H,
    width: totalOspW,
    height: headerRow1H,
    borderColor,
    borderWidth: borderW
  });
  const ospGroupW = fontBold.widthOfTextAtSize("Crew OSP", 9);
  page.drawText("Crew OSP", {
    x: ospStartX + (totalOspW - ospGroupW) / 2,
    y: currentY - headerRow1H / 2 - 3,
    size: 9,
    font: fontBold
  });

  // Header Row 2: Sub-columns for individual technician names
  // Telco sub-headers
  for (let i = 0; i < 5; i++) {
    const subX = telcoStartX + i * colWidths.telco;
    page.drawRectangle({
      x: subX,
      y: currentY - totalHeaderH,
      width: colWidths.telco,
      height: headerRow2H,
      borderColor,
      borderWidth: borderW
    });
    const crewName = telcoList[i]?.displayName || telcoList[i]?.name || "";
    if (crewName) {
      const nameW = fontBold.widthOfTextAtSize(crewName, 8);
      page.drawText(crewName, {
        x: subX + (colWidths.telco - nameW) / 2,
        y: currentY - totalHeaderH + 6,
        size: 8,
        font: fontBold
      });
    }
  }

  // OSP sub-headers
  for (let i = 0; i < 4; i++) {
    const subX = ospStartX + i * colWidths.osp;
    page.drawRectangle({
      x: subX,
      y: currentY - totalHeaderH,
      width: colWidths.osp,
      height: headerRow2H,
      borderColor,
      borderWidth: borderW
    });
    const crewName = ospList[i]?.displayName || ospList[i]?.name || "";
    if (crewName) {
      const nameW = fontBold.widthOfTextAtSize(crewName, 8);
      page.drawText(crewName, {
        x: subX + (colWidths.osp - nameW) / 2,
        y: currentY - totalHeaderH + 6,
        size: 8,
        font: fontBold
      });
    }
  }

  currentY -= totalHeaderH;

  // 4. Draw Data Rows (Slots)
  for (const slot of data.slots) {
    const dateList = (slot.dates && slot.dates.length > 0)
      ? slot.dates
      : [slot.date1, slot.date2, slot.date3].filter(Boolean);

    const rowHeight = Math.max(31, dateList.length * 10 + 2);
    const rowY = currentY - rowHeight;

    // Col 0: No
    page.drawRectangle({
      x: startX,
      y: rowY,
      width: colWidths.no,
      height: rowHeight,
      borderColor,
      borderWidth: borderW
    });
    const noStr = String(slot.slotNumber);
    const noW = fontRegular.widthOfTextAtSize(noStr, 9);
    page.drawText(noStr, {
      x: startX + (colWidths.no - noW) / 2,
      y: rowY + rowHeight / 2 - 3,
      size: 9,
      font: fontRegular
    });

    // Col 1: Periode (stacked dates)
    page.drawRectangle({
      x: periodeX,
      y: rowY,
      width: colWidths.periode,
      height: rowHeight,
      borderColor,
      borderWidth: borderW
    });

    const fontSize = dateList.length > 3 ? 6.5 : 7.5;
    const step = (rowHeight - 6) / Math.max(dateList.length, 1);
    for (let di = 0; di < dateList.length; di++) {
      const dtText = formatDateDisplay(dateList[di]);
      const dtW = fontRegular.widthOfTextAtSize(dtText, fontSize);
      const textY = rowY + rowHeight - 9 - di * step;
      page.drawText(dtText, {
        x: periodeX + (colWidths.periode - dtW) / 2,
        y: textY,
        size: fontSize,
        font: fontRegular
      });
    }

    // Telco cells (5 columns)
    for (let i = 0; i < 5; i++) {
      const subX = telcoStartX + i * colWidths.telco;
      const tech = telcoList[i];
      const isOncall = tech && tech.userId === slot.telcoUserId;

      if (isOncall) {
        page.drawRectangle({
          x: subX,
          y: rowY,
          width: colWidths.telco,
          height: rowHeight,
          color: yellowColor,
          borderColor,
          borderWidth: borderW
        });
        const oncallW = fontBold.widthOfTextAtSize("Oncall", 8);
        page.drawText("Oncall", {
          x: subX + (colWidths.telco - oncallW) / 2,
          y: rowY + rowHeight / 2 - 3,
          size: 8,
          font: fontBold,
          color: rgb(0, 0, 0)
        });
      } else {
        page.drawRectangle({
          x: subX,
          y: rowY,
          width: colWidths.telco,
          height: rowHeight,
          borderColor,
          borderWidth: borderW
        });
      }
    }

    // OSP cells (4 columns)
    for (let i = 0; i < 4; i++) {
      const subX = ospStartX + i * colWidths.osp;
      const tech = ospList[i];
      const isOncall = tech && tech.userId === slot.ospUserId;

      if (isOncall) {
        page.drawRectangle({
          x: subX,
          y: rowY,
          width: colWidths.osp,
          height: rowHeight,
          color: yellowColor,
          borderColor,
          borderWidth: borderW
        });
        const oncallW = fontBold.widthOfTextAtSize("Oncall", 8);
        page.drawText("Oncall", {
          x: subX + (colWidths.osp - oncallW) / 2,
          y: rowY + rowHeight / 2 - 3,
          size: 8,
          font: fontBold,
          color: rgb(0, 0, 0)
        });
      } else {
        page.drawRectangle({
          x: subX,
          y: rowY,
          width: colWidths.osp,
          height: rowHeight,
          borderColor,
          borderWidth: borderW
        });
      }
    }

    currentY -= rowHeight;
  }

  // 5. Notes Section
  currentY -= 14;
  page.drawText("Note:", {
    x: startX,
    y: currentY,
    size: 8.5,
    font: fontBold,
    color: rgb(0, 0, 0)
  });

  for (const noteLine of PERMANENT_NOTES) {
    currentY -= 11;
    page.drawText(noteLine, {
      x: startX,
      y: currentY,
      size: 7.5,
      font: fontRegular,
      color: rgb(0, 0, 0)
    });
  }

  // 6. Signatures / Pejabat Section
  currentY -= 20;

  const sigCol1X = startX + 50;  // Telco
  const sigCol2X = startX + 220; // OSP
  const sigCol3X = startX + 410; // Mengetahui

  // Headers: Telco, OSP, Mengetahui
  const drawCentered = (text: string, centerX: number, y: number, font: PDFFont, size: number) => {
    const w = font.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: centerX - w / 2,
      y,
      size,
      font,
      color: rgb(0, 0, 0)
    });
  };

  drawCentered("Telco", sigCol1X, currentY, fontBold, 9);
  drawCentered("OSP", sigCol2X, currentY, fontBold, 9);
  drawCentered("Mengetahui", sigCol3X, currentY, fontBold, 9);

  // Spacing for signature
  const nameY = currentY - 38;
  const phoneY = nameY - 11;

  // Telco Official
  drawCentered(data.telcoSupervisorName, sigCol1X, nameY, fontBold, 9);
  drawCentered(data.telcoSupervisorPhone, sigCol1X, phoneY, fontRegular, 8);

  // OSP Official
  drawCentered(data.ospSupervisorName, sigCol2X, nameY, fontBold, 9);
  drawCentered(data.ospSupervisorPhone, sigCol2X, phoneY, fontRegular, 8);

  // Superintendent
  drawCentered(data.superintendentName, sigCol3X, nameY, fontBold, 9);

  return doc.save();
}
