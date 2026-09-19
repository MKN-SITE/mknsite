import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { JsaFormDto } from "./ops-telco-jsa.service";

function resolveLogoPath(): string | null {
  const candidatePaths = [
    "/app/apps/web/public/assets/Logo MKN.png",
    resolve(import.meta.dir, "../../../../apps/web/public/assets/Logo MKN.png"),
    resolve("apps/web/public/assets/Logo MKN.png"),
    "D:/Project-Web/MKNSite/apps/web/public/assets/Logo MKN.png"
  ];
  for (const p of candidatePaths) {
    if (existsSync(p)) return p;
  }
  return null;
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  if (!text) return [];
  const lines: string[] = [];
  const paragraphs = text.split(/\r?\n/);

  for (const para of paragraphs) {
    const trimmedPara = para.trim();
    if (!trimmedPara) continue;

    const words = trimmedPara.split(/\s+/);
    let currentLine = "";

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      const width = font.widthOfTextAtSize(candidate, fontSize);
      if (width <= maxWidth) {
        currentLine = candidate;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
  }
  return lines;
}

export async function generateJsaPdf(jsa: JsaFormDto): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let logoImage = null;
  const logoPath = resolveLogoPath();
  if (logoPath) {
    try {
      const bytes = await readFile(logoPath);
      logoImage = await doc.embedPng(bytes);
    } catch {
      logoImage = null;
    }
  }

  // A4 Landscape: 841.89 x 595.28
  const PAGE_WIDTH = 841.89;
  const PAGE_HEIGHT = 595.28;
  const MARGIN_X = 24;
  const MARGIN_TOP = 20;
  const MARGIN_BOTTOM = 20;
  const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN_X;

  const colorBlack = rgb(0, 0, 0);
  const colorGray = rgb(0.3, 0.3, 0.3);
  const colorBorder = rgb(0, 0, 0);
  const colorBgHeader = rgb(0.92, 0.92, 0.92);
  const colorChecked = rgb(0.1, 0.4, 0.8);

  const drawRectBorder = (
    page: PDFPage,
    x: number,
    y: number,
    w: number,
    h: number,
    lineWidth = 0.5,
    bgColor?: any
  ) => {
    if (bgColor) {
      page.drawRectangle({
        x,
        y: y - h,
        width: w,
        height: h,
        color: bgColor
      });
    }
    page.drawRectangle({
      x,
      y: y - h,
      width: w,
      height: h,
      borderColor: colorBorder,
      borderWidth: lineWidth
    });
  };

  const drawCheckbox = (
    page: PDFPage,
    x: number,
    y: number,
    size: number,
    label: string,
    checked: boolean,
    fontSize = 6.5
  ) => {
    drawRectBorder(page, x, y, size, size, 0.6);
    if (checked) {
      page.drawText("v", {
        x: x + 1.5,
        y: y - size + 1.5,
        size: size,
        font: helveticaBold,
        color: colorBlack
      });
    }
    if (label) {
      page.drawText(label, {
        x: x + size + 4,
        y: y - size + 1.5,
        size: fontSize,
        font: helvetica,
        color: colorBlack
      });
    }
  };

  const fpeList = jsa.fpeElements || [];
  const permitList = jsa.jobPermits || [];

  // Helper to render Page 1 Header, FPE and Permit blocks
  const renderHeader = (page: PDFPage) => {
    let curY = PAGE_HEIGHT - MARGIN_TOP;

    // Outer Header Box
    const headerHeight = 94;
    drawRectBorder(page, MARGIN_X, curY, CONTENT_WIDTH, headerHeight, 0.8);

    // Section 1: Left (Company & PPE) - Width 210
    const wCol1 = 210;
    // Section 2: Middle (Title, Analyst, Reviewer, Approver) - Width 374
    const wCol2 = 374;
    // Section 3: Right (JSA No, Date, Supervisor, Type) - Width Remaining (CONTENT_WIDTH - 210 - 374 = 210)
    const wCol3 = CONTENT_WIDTH - wCol1 - wCol2;

    const xCol1 = MARGIN_X;
    const xCol2 = xCol1 + wCol1;
    const xCol3 = xCol2 + wCol2;

    // Draw vertical dividers in header
    page.drawLine({
      start: { x: xCol2, y: curY },
      end: { x: xCol2, y: curY - headerHeight },
      thickness: 0.8,
      color: colorBorder
    });
    page.drawLine({
      start: { x: xCol3, y: curY },
      end: { x: xCol3, y: curY - headerHeight },
      thickness: 0.8,
      color: colorBorder
    });

    // Col 1 Content
    if (logoImage) {
      const logoW = 28;
      const logoH = (logoImage.height / logoImage.width) * logoW;
      page.drawImage(logoImage, {
        x: xCol1 + 6,
        y: curY - 22,
        width: logoW,
        height: Math.min(22, logoH)
      });
    }

    page.drawText("PT. MULTI KONTROL NUSANTARA", {
      x: xCol1 + (logoImage ? 38 : 6),
      y: curY - 12,
      size: 8,
      font: helveticaBold,
      color: colorBlack
    });
    page.drawText("Prima Nirbaya Elemen 5.50", {
      x: xCol1 + (logoImage ? 38 : 6),
      y: curY - 22,
      size: 6.5,
      font: helvetica,
      color: colorGray
    });

    // PPE Box inside Col 1
    const ppeBoxY = curY - 28;
    const ppeBoxH = 62;
    page.drawLine({
      start: { x: xCol1, y: ppeBoxY },
      end: { x: xCol2, y: ppeBoxY },
      thickness: 0.5,
      color: colorBorder
    });
    page.drawText("REQUIRED AND / OR RECOMMENDED", {
      x: xCol1 + 4,
      y: ppeBoxY - 9,
      size: 5.5,
      font: helveticaBold,
      color: colorBlack
    });
    page.drawText("PERSONAL PROTECTIVE EQUIPMENT", {
      x: xCol1 + 4,
      y: ppeBoxY - 16,
      size: 5.5,
      font: helveticaBold,
      color: colorBlack
    });

    const ppeLines = wrapText(
      jsa.ppeRequirements ||
        "Safety shoes, Helmet standard, Full body harness & double lanyard, Seragam kerja standard MKN",
      helvetica,
      5.5,
      wCol1 - 10
    );
    let pY = ppeBoxY - 24;
    for (const l of ppeLines.slice(0, 5)) {
      page.drawText(l, {
        x: xCol1 + 6,
        y: pY,
        size: 5.5,
        font: helvetica,
        color: colorBlack
      });
      pY -= 7;
    }

    // Col 2: Title & Details
    page.drawText("JOB SAFETY ANALYSIS", {
      x: xCol2 + wCol2 / 2 - 55,
      y: curY - 13,
      size: 10,
      font: helveticaBold,
      color: colorBlack
    });

    // Divider under Title
    page.drawLine({
      start: { x: xCol2, y: curY - 18 },
      end: { x: xCol3, y: curY - 18 },
      thickness: 0.5,
      color: colorBorder
    });

    // Left sub-col (Labels & Job Info) vs Right sub-col (Signatories)
    const midDividerX = xCol2 + 205;
    page.drawLine({
      start: { x: midDividerX, y: curY - 18 },
      end: { x: midDividerX, y: curY - headerHeight },
      thickness: 0.5,
      color: colorBorder
    });

    // Sub-col A: Job info
    const drawRowInfo = (label: string, value: string, rY: number, maxW: number) => {
      page.drawText(label, {
        x: xCol2 + 4,
        y: rY,
        size: 6,
        font: helveticaBold,
        color: colorBlack
      });
      const valLines = wrapText(value || "-", helvetica, 6, maxW);
      if (valLines[0]) {
        page.drawText(valLines[0], {
          x: xCol2 + 4,
          y: rY - 7.5,
          size: 6,
          font: helvetica,
          color: colorBlack
        });
      }
    };

    drawRowInfo("JOB TITLE (and number if applicable):", jsa.jobTitle, curY - 27, 195);
    drawRowInfo("TITLE OF PERSON WHO DOES JOB:", jsa.personTitle || "Technician", curY - 49, 195);
    drawRowInfo("LOCATION:", jsa.location, curY - 71, 195);

    // Sub-col B: Signatures
    const drawSigRow = (label: string, name: string | null | undefined, badge: string | null | undefined, rY: number) => {
      page.drawText(`${label} : ${name || ""}`, {
        x: midDividerX + 4,
        y: rY,
        size: 6,
        font: helveticaBold,
        color: colorBlack
      });
      page.drawText(`Badge Number (ID) : ${badge || ""}`, {
        x: midDividerX + 4,
        y: rY - 8,
        size: 5.5,
        font: helvetica,
        color: colorGray
      });
    };

    drawSigRow("ANALYSED BY", jsa.analysedBy, jsa.analysedByBadge, curY - 27);
    drawSigRow("REVIEWED BY", jsa.reviewedBy, jsa.reviewedByBadge, curY - 49);
    drawSigRow("APPROVED BY", jsa.approvedBy || "Responsible Area", jsa.approvedByBadge, curY - 71);

    // Col 3: Checkboxes & Meta
    // Checkboxes: New / Review / Urgent / Normal
    const typeX1 = xCol3 + 8;
    const typeX2 = xCol3 + 60;
    const typeX3 = xCol3 + 115;
    const typeX4 = xCol3 + 160;

    const jType = (jsa.jsaType || "normal").toLowerCase();
    drawCheckbox(page, typeX1, curY - 5, 7, "New", jType === "new");
    drawCheckbox(page, typeX2, curY - 5, 7, "Review", jType === "review");
    drawCheckbox(page, typeX3, curY - 5, 7, "Urgent", jType === "urgent");
    drawCheckbox(page, typeX4, curY - 5, 7, "Normal", jType === "normal");

    // Divider under types
    page.drawLine({
      start: { x: xCol3, y: curY - 18 },
      end: { x: xCol3 + wCol3, y: curY - 18 },
      thickness: 0.5,
      color: colorBorder
    });

    const drawMetaRow = (label: string, val: string, rY: number) => {
      page.drawText(label, {
        x: xCol3 + 6,
        y: rY,
        size: 6.5,
        font: helveticaBold,
        color: colorBlack
      });
      page.drawText(val || "-", {
        x: xCol3 + 70,
        y: rY,
        size: 6.5,
        font: helvetica,
        color: colorBlack
      });
    };

    drawMetaRow("JSA No :", jsa.jsaNumber, curY - 28);
    drawMetaRow("JOB No :", jsa.jobNumber || "-", curY - 44);
    drawMetaRow("Date :", jsa.jsaDate, curY - 60);
    drawMetaRow("Supervisor :", jsa.supervisorName || "-", curY - 76);

    curY -= headerHeight + 5;

    // FPE Section
    const fpeBoxH = 54;
    drawRectBorder(page, MARGIN_X, curY, CONTENT_WIDTH, fpeBoxH, 0.6);

    // FPE Header line
    page.drawText("BERI TANDA", {
      x: MARGIN_X + 6,
      y: curY - 9,
      size: 6.5,
      font: helveticaBold,
      color: colorBlack
    });
    drawRectBorder(page, MARGIN_X + 54, curY - 3, 7, 7, 0.5);
    page.drawText("PEKERJAAN BERHUBUNGAN DENGAN FATALITY PREVENTION ELEMENT (FPE) :", {
      x: MARGIN_X + 68,
      y: curY - 9,
      size: 6.5,
      font: helveticaBold,
      color: colorBlack
    });

    // FPE 3 Columns
    const fpeColW = CONTENT_WIDTH / 3;
    const fpeY1 = curY - 18;
    const fpeY2 = curY - 27;
    const fpeY3 = curY - 36;
    const fpeY4 = curY - 45;

    // Column 1
    drawCheckbox(page, MARGIN_X + 6, fpeY1, 6, "Design Pembangunan & Pemeliharaan Jalan (FPE 1.09)", fpeList.includes("1.09"));
    drawCheckbox(page, MARGIN_X + 6, fpeY2, 6, "Keselamatan Dinding Tambang (FPE 1.10)", fpeList.includes("1.10"));
    drawCheckbox(page, MARGIN_X + 6, fpeY3, 6, "Isolasi dan Lock Out (FPE 2.12)", fpeList.includes("2.12"));
    drawCheckbox(page, MARGIN_X + 6, fpeY4, 6, "Bekerja di Ketinggian (FPE 2.14)", fpeList.includes("2.14"));

    // Column 2
    drawCheckbox(page, MARGIN_X + fpeColW + 6, fpeY1, 6, "Pengangkatan & Penyanggaan Beban (FPE 2.15)", fpeList.includes("2.15"));
    drawCheckbox(page, MARGIN_X + fpeColW + 6, fpeY2, 6, "Operasi Kendaraan dan Alat Bergerak (FPE 2.18)", fpeList.includes("2.18"));
    drawCheckbox(page, MARGIN_X + fpeColW + 6, fpeY3, 6, "Kondisi Kendaraan & Alat Bergerak (FPE 2.21)", fpeList.includes("2.21_kendaraan"));
    drawCheckbox(page, MARGIN_X + fpeColW + 6, fpeY4, 6, "Keselamatan Pekerjaan Listrik (FPE 2.21)", fpeList.includes("2.21_listrik"));

    // Column 3
    drawCheckbox(page, MARGIN_X + 2 * fpeColW + 6, fpeY1, 6, "Penanganan & Penggunaan Bahan Peledak (FPE 2.22)", fpeList.includes("2.22"));
    drawCheckbox(page, MARGIN_X + 2 * fpeColW + 6, fpeY2, 6, "Ruang Terbatas (FPE 2.23)", fpeList.includes("2.23"));
    drawCheckbox(page, MARGIN_X + 2 * fpeColW + 6, fpeY3, 6, "Bekerja Dekat Air (FPE 2.24)", fpeList.includes("2.24"));
    drawCheckbox(page, MARGIN_X + 2 * fpeColW + 6, fpeY4, 6, "Other's", fpeList.includes("other"));

    curY -= fpeBoxH + 5;

    // Permit Section
    const permitBoxH = 38;
    drawRectBorder(page, MARGIN_X, curY, CONTENT_WIDTH, permitBoxH, 0.6);

    page.drawText("BERI TANDA", {
      x: MARGIN_X + 6,
      y: curY - 9,
      size: 6.5,
      font: helveticaBold,
      color: colorBlack
    });
    drawRectBorder(page, MARGIN_X + 54, curY - 3, 7, 7, 0.5);
    page.drawText("IJIN PEKERJAAN YANG HARUS DILENGKAPI", {
      x: MARGIN_X + 68,
      y: curY - 9,
      size: 6.5,
      font: helveticaBold,
      color: colorBlack
    });

    const pColW = CONTENT_WIDTH / 3;
    const pY1 = curY - 19;
    const pY2 = curY - 29;

    drawCheckbox(page, MARGIN_X + 6, pY1, 6, "Vicinity Permit", permitList.includes("vicinity"));
    drawCheckbox(page, MARGIN_X + 6, pY2, 6, "Digging Permit", permitList.includes("digging"));

    drawCheckbox(page, MARGIN_X + pColW + 6, pY1, 6, "Confined Spaces", permitList.includes("confined_space"));
    drawCheckbox(page, MARGIN_X + pColW + 6, pY2, 6, "Hot Work", permitList.includes("hot_work"));

    drawCheckbox(page, MARGIN_X + 2 * pColW + 6, pY1, 6, "Working at Height", permitList.includes("wah"));
    drawCheckbox(page, MARGIN_X + 2 * pColW + 6, pY2, 6, "Isolasi / Red Tag", permitList.includes("isolasi") || permitList.includes("red_tag"));

    curY -= permitBoxH + 5;
    return curY;
  };

  // Table Column Definitions
  // NO (26), SQUENCE (168), HAZARDS (195: 25+170), RECOMMENDED (345: 30+315), OBSERVATION (60: 30+30)
  // Total = 26 + 168 + 195 + 345 + 60 = 794 (matches CONTENT_WIDTH = 841.89 - 48 = 793.89)
  const colWidths = {
    no: 26,
    step: 168,
    hNo: 25,
    hazard: 170,
    aNo: 30,
    action: 315,
    obsYes: 30,
    obsNo: 30
  };

  const drawTableHeader = (page: PDFPage, startY: number) => {
    const tableHeaderH = 20;
    drawRectBorder(page, MARGIN_X, startY, CONTENT_WIDTH, tableHeaderH, 0.6, colorBgHeader);

    let curX = MARGIN_X;
    const drawColHeader = (w: number, title: string, sub?: { yes: string; no: string }) => {
      page.drawLine({
        start: { x: curX, y: startY },
        end: { x: curX, y: startY - tableHeaderH },
        thickness: 0.5,
        color: colorBorder
      });

      if (sub) {
        page.drawText(title, {
          x: curX + 6,
          y: startY - 8,
          size: 5.5,
          font: helveticaBold,
          color: colorBlack
        });
        page.drawLine({
          start: { x: curX, y: startY - 10 },
          end: { x: curX + w, y: startY - 10 },
          thickness: 0.5,
          color: colorBorder
        });
        page.drawLine({
          start: { x: curX + w / 2, y: startY - 10 },
          end: { x: curX + w / 2, y: startY - tableHeaderH },
          thickness: 0.5,
          color: colorBorder
        });
        page.drawText(sub.yes, {
          x: curX + 8,
          y: startY - 18,
          size: 5,
          font: helveticaBold,
          color: colorBlack
        });
        page.drawText(sub.no, {
          x: curX + w / 2 + 9,
          y: startY - 18,
          size: 5,
          font: helveticaBold,
          color: colorBlack
        });
      } else {
        page.drawText(title, {
          x: curX + 3,
          y: startY - 12,
          size: 5.5,
          font: helveticaBold,
          color: colorBlack
        });
      }
      curX += w;
    };

    drawColHeader(colWidths.no, "NO");
    drawColHeader(colWidths.step, "SEQUENCE OF BASIC JOB STEPS");
    drawColHeader(colWidths.hNo + colWidths.hazard, "HAZARDS");
    drawColHeader(colWidths.aNo + colWidths.action, "RECOMMENDED ACTION OR PROCEDURE");
    drawColHeader(colWidths.obsYes + colWidths.obsNo, "OBSERVATION", { yes: "YES", no: "NO" });

    return startY - tableHeaderH;
  };

  // Build rows array with pre-calculated wrapped heights
  interface StepRowItem {
    stepNumStr: string;
    stepDescLines: string[];
    hNoStr: string;
    hDescLines: string[];
    aNoStr: string;
    aDescLines: string[];
    rowHeight: number;
  }

  const rawSteps = jsa.steps || [];
  const processedRows: StepRowItem[] = [];

  let lastStepNum: number | null = null;
  for (const s of rawSteps) {
    const isNewStep = lastStepNum !== s.stepNumber;
    lastStepNum = s.stepNumber;

    const stepNumStr = isNewStep ? String(s.stepNumber) : "";
    const stepDescLines = isNewStep ? wrapText(s.stepDescription || "", helvetica, 5.5, colWidths.step - 6) : [];

    const hNoStr = s.hazardNo || "";
    const hDescLines = wrapText(s.hazardDescription || "", helvetica, 5.5, colWidths.hazard - 6);

    const aNoStr = s.actionNo || "";
    const aDescLines = wrapText(s.actionDescription || "", helvetica, 5.5, colWidths.action - 6);

    const maxLines = Math.max(stepDescLines.length, hDescLines.length, aDescLines.length, 1);
    const rowHeight = Math.max(12, maxLines * 7.5 + 4);

    processedRows.push({
      stepNumStr,
      stepDescLines,
      hNoStr,
      hDescLines,
      aNoStr,
      aDescLines,
      rowHeight
    });
  }

  // If no steps, add at least 4 empty rows
  if (processedRows.length === 0) {
    for (let i = 1; i <= 4; i++) {
      processedRows.push({
        stepNumStr: String(i),
        stepDescLines: [],
        hNoStr: "",
        hDescLines: [],
        aNoStr: "",
        aDescLines: [],
        rowHeight: 18
      });
    }
  }

  // Multi-page Rendering Loop
  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let currentY = renderHeader(page);
  currentY = drawTableHeader(page, currentY);

  const renderFooter = (p: PDFPage, bottomY: number) => {
    // Note Block + Worker Signatures
    const noteBoxH = 50;
    drawRectBorder(p, MARGIN_X, bottomY, CONTENT_WIDTH, noteBoxH, 0.6);

    p.drawText("Note :", {
      x: MARGIN_X + 4,
      y: bottomY - 8,
      size: 6,
      font: helveticaBold,
      color: colorBlack
    });

    const notes = [
      "1. JSA ini sudah dibacakan, dipahami dan dimengerti oleh para pekerja.",
      "2. Nomor Telpon Emergency Call Rescue : 3000 atau 0549-52-3000 via Handphone , SOS S Bara : 1541, SOS T Bara : 3244, Radio Channel 1A",
      "3. Pekerja Wajib Menolak Pekerjaan Bila Masih Ada Sumber/Potensi Bahaya Yang Belum Tertuang dan Terkontrol Dengan Baik Dalam JSA.",
      `4. Bila Supervisor sedang tidak berada dilokasi kerja, maka segala tanggung jawab di lokasi kerja menjadi tanggung jawab Kepala Kerja sdr: ${jsa.leadWorkerName || "_________________"}`,
      "5. Sebelum dan sesudah melakukan pemanjatan di tower harus melapor/ijin ke rescue Murung 0548-(52)3000, 3103, 5444 HP 0811-5503000"
    ];

    let nY = bottomY - 16;
    for (const note of notes) {
      p.drawText(note, {
        x: MARGIN_X + 6,
        y: nY,
        size: 5.5,
        font: helvetica,
        color: colorBlack
      });
      nY -= 8;
    }

    // Workers Attendance Table below Notes
    const workerBoxY = bottomY - noteBoxH - 3;
    const workerBoxH = 36;
    drawRectBorder(p, MARGIN_X, workerBoxY, CONTENT_WIDTH, workerBoxH, 0.6);

    // 4 Columns of workers
    const wSectionW = CONTENT_WIDTH / 3;
    for (let c = 0; c < 3; c++) {
      const cX = MARGIN_X + c * wSectionW;
      if (c > 0) {
        p.drawLine({
          start: { x: cX, y: workerBoxY },
          end: { x: cX, y: workerBoxY - workerBoxH },
          thickness: 0.5,
          color: colorBorder
        });
      }

      // Header for worker col
      p.drawText("No.  NAMA                                       BN/ID        TTD", {
        x: cX + 4,
        y: workerBoxY - 8,
        size: 5.5,
        font: helveticaBold,
        color: colorBlack
      });

      // 3 rows of signatures per column
      let sY = workerBoxY - 17;
      for (let r = 0; r < 3; r++) {
        const idx = c * 3 + r + 1;
        const worker = jsa.workers && jsa.workers[idx - 1];
        const wName = worker?.name ? worker.name.slice(0, 18) : "................................";
        const wId = worker?.badgeNumber || "...........";

        p.drawText(`${idx}.   ${wName}   ${wId}    [    ]`, {
          x: cX + 4,
          y: sY,
          size: 5,
          font: helvetica,
          color: colorGray
        });
        sY -= 8;
      }
    }
  };

  const FOOTER_REQUIRED_SPACE = 92;

  for (let i = 0; i < processedRows.length; i++) {
    const row = processedRows[i];

    // Check if row fits, considering footer needs space on the last page
    const isLastItem = i === processedRows.length - 1;
    const neededBottomMargin = isLastItem ? MARGIN_BOTTOM + FOOTER_REQUIRED_SPACE : MARGIN_BOTTOM + 20;

    if (currentY - row.rowHeight < neededBottomMargin) {
      // Create new page
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      currentY = PAGE_HEIGHT - MARGIN_TOP;

      // Small page continuation header
      page.drawText(`JOB SAFETY ANALYSIS (Continued) - JSA No: ${jsa.jsaNumber}`, {
        x: MARGIN_X,
        y: currentY - 8,
        size: 8,
        font: helveticaBold,
        color: colorBlack
      });
      currentY -= 14;
      currentY = drawTableHeader(page, currentY);
    }

    // Draw row borders
    drawRectBorder(page, MARGIN_X, currentY, CONTENT_WIDTH, row.rowHeight, 0.4);

    let cellX = MARGIN_X;

    // Col: No
    page.drawLine({
      start: { x: cellX + colWidths.no, y: currentY },
      end: { x: cellX + colWidths.no, y: currentY - row.rowHeight },
      thickness: 0.4,
      color: colorBorder
    });
    if (row.stepNumStr) {
      page.drawText(row.stepNumStr, {
        x: cellX + 7,
        y: currentY - 9,
        size: 6,
        font: helveticaBold,
        color: colorBlack
      });
    }
    cellX += colWidths.no;

    // Col: Step Description
    page.drawLine({
      start: { x: cellX + colWidths.step, y: currentY },
      end: { x: cellX + colWidths.step, y: currentY - row.rowHeight },
      thickness: 0.4,
      color: colorBorder
    });
    let sY = currentY - 8;
    for (const l of row.stepDescLines) {
      page.drawText(l, {
        x: cellX + 4,
        y: sY,
        size: 5.5,
        font: helveticaBold,
        color: colorBlack
      });
      sY -= 7.5;
    }
    cellX += colWidths.step;

    // Col: Hazard No
    page.drawLine({
      start: { x: cellX + colWidths.hNo, y: currentY },
      end: { x: cellX + colWidths.hNo, y: currentY - row.rowHeight },
      thickness: 0.4,
      color: colorBorder
    });
    if (row.hNoStr) {
      page.drawText(row.hNoStr, {
        x: cellX + 3,
        y: currentY - 8,
        size: 5.5,
        font: helveticaBold,
        color: colorBlack
      });
    }
    cellX += colWidths.hNo;

    // Col: Hazard Description
    page.drawLine({
      start: { x: cellX + colWidths.hazard, y: currentY },
      end: { x: cellX + colWidths.hazard, y: currentY - row.rowHeight },
      thickness: 0.4,
      color: colorBorder
    });
    let hY = currentY - 8;
    for (const l of row.hDescLines) {
      page.drawText(l, {
        x: cellX + 3,
        y: hY,
        size: 5.5,
        font: helvetica,
        color: colorBlack
      });
      hY -= 7.5;
    }
    cellX += colWidths.hazard;

    // Col: Action No
    page.drawLine({
      start: { x: cellX + colWidths.aNo, y: currentY },
      end: { x: cellX + colWidths.aNo, y: currentY - row.rowHeight },
      thickness: 0.4,
      color: colorBorder
    });
    if (row.aNoStr) {
      page.drawText(row.aNoStr, {
        x: cellX + 3,
        y: currentY - 8,
        size: 5.5,
        font: helveticaBold,
        color: colorBlack
      });
    }
    cellX += colWidths.aNo;

    // Col: Action Description
    page.drawLine({
      start: { x: cellX + colWidths.action, y: currentY },
      end: { x: cellX + colWidths.action, y: currentY - row.rowHeight },
      thickness: 0.4,
      color: colorBorder
    });
    let aY = currentY - 8;
    for (const l of row.aDescLines) {
      page.drawText(l, {
        x: cellX + 3,
        y: aY,
        size: 5.5,
        font: helvetica,
        color: colorBlack
      });
      aY -= 7.5;
    }
    cellX += colWidths.action;

    // Col: Observation YES / NO
    page.drawLine({
      start: { x: cellX + colWidths.obsYes, y: currentY },
      end: { x: cellX + colWidths.obsYes, y: currentY - row.rowHeight },
      thickness: 0.4,
      color: colorBorder
    });

    // Draw little empty checkboxes for YES and NO
    drawRectBorder(page, cellX + 11, currentY - 4, 7, 7, 0.4);
    drawRectBorder(page, cellX + colWidths.obsYes + 11, currentY - 4, 7, 7, 0.4);

    currentY -= row.rowHeight;
  }

  // Draw Footer at bottom of the page
  currentY -= 4;
  renderFooter(page, currentY);

  // Page numbering
  const pages = doc.getPages();
  pages.forEach((p, idx) => {
    p.drawText(`Page ${idx + 1} of ${pages.length} - FM-HSE-01-04 Form JSA`, {
      x: PAGE_WIDTH - MARGIN_X - 160,
      y: 10,
      size: 6,
      font: helvetica,
      color: colorGray
    });
  });

  return await doc.save();
}
