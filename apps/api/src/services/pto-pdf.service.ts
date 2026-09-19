import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export interface PtoItem {
  no: string | number;
  taskStep: string;
  deviation: string;
  cause: string;
  suggestion: string;
}

export interface PtoFormData {
  formNumber?: string;
  procedureTitle: string;
  department: string;
  observationArea: string;
  date: string;
  time: string;
  workerNotified?: "ya" | "tidak" | boolean;
  peerReview?: string;
  items: PtoItem[];
  observerName?: string;
  observerSignature?: string;
  observedPerson?: string;
  superintendent?: string;
  comments?: string;
}

function resolveTemplatePath(subPath: string): string {
  const devPath = resolve(import.meta.dir, "../../../../form-templates", subPath);
  if (existsSync(devPath)) return devPath;
  const containerPath = resolve("/app/form-templates", subPath);
  if (existsSync(containerPath)) return containerPath;
  return devPath;
}

function formatDate(rawDate?: string): string {
  if (!rawDate) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(rawDate);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  try {
    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch {
    // fallback
  }
  return rawDate.slice(0, 10);
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  if (!text) return [];
  const lines: string[] = [];
  const rawParagraphs = text.split(/\r?\n/);

  for (const para of rawParagraphs) {
    if (!para.trim()) {
      lines.push("");
      continue;
    }
    const words = para.trim().split(/\s+/);
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = font.widthOfTextAtSize(testLine, fontSize);
      if (width <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines;
}

function drawTruncated(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  fontSize: number,
  font: PDFFont,
  color = rgb(0.1, 0.1, 0.1)
) {
  if (!text) return;
  let t = text.trim();
  if (font.widthOfTextAtSize(t, fontSize) > maxWidth) {
    while (t.length > 3 && font.widthOfTextAtSize(`${t}...`, fontSize) > maxWidth) {
      t = t.slice(0, -1);
    }
    t = `${t}...`;
  }
  page.drawText(t, { x, y, size: fontSize, font, color });
}

export async function generatePtoPdf(data: PtoFormData): Promise<Uint8Array> {
  const templateRelPath = "ops-telco/supervisor/pto/FM-HSE-10-43 Rev 1 Plan Task Observation.pdf";
  const templatePath = resolveTemplatePath(templateRelPath);
  const templateBytes = await readFile(templatePath);

  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true });
  const page = pdfDoc.getPages()[0];

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const textColor = rgb(0.1, 0.1, 0.1);
  const markColor = rgb(0.05, 0.1, 0.55);

  // 1. Procedure Title (x: 180, y: 425.0, max width ~ 570)
  drawTruncated(page, data.procedureTitle || "", 180, 424.5, 570, 8.5, font, textColor);

  // 2. Department (x: 180, y: 412.7, max width ~ 240)
  drawTruncated(page, data.department || "Operasional Telekomunikasi", 180, 412.2, 240, 8.5, font, textColor);

  // 3. Observation Area (x: 595, y: 412.3, max width ~ 160)
  drawTruncated(page, data.observationArea || "", 595, 411.8, 160, 8.5, font, textColor);

  // 4. Date (x: 180, y: 400.3, max width ~ 240)
  const displayDate = formatDate(data.date);
  drawTruncated(page, displayDate, 180, 399.8, 240, 8.5, font, textColor);

  // 5. Time (x: 595, y: 400.0, max width ~ 160)
  drawTruncated(page, data.time || "", 595, 399.5, 160, 8.5, font, textColor);

  // 6. Worker Notified in Advance (Ya / Tidak)
  // In template: "Ya / tidak" is at X=317.2, Y=387.6
  const isNotified = data.workerNotified === true || data.workerNotified === "ya";
  if (isNotified) {
    // Draw checkmark and circle around "Ya"
    page.drawText("[V] Ya", {
      x: 310,
      y: 387.2,
      size: 7.5,
      font: fontBold,
      color: markColor
    });
  } else if (data.workerNotified === false || data.workerNotified === "tidak") {
    page.drawText("[V] Tidak", {
      x: 345,
      y: 387.2,
      size: 7.5,
      font: fontBold,
      color: markColor
    });
  }

  // Peer review / Crew
  if (data.peerReview && data.peerReview.trim()) {
    page.drawText(data.peerReview.trim(), {
      x: 648,
      y: 387.2,
      size: 7.5,
      font: fontBold,
      color: markColor
    });
  }

  // 7. Table rows: up to 7 rows
  const rowY = [340.0, 327.6, 315.2, 302.8, 290.4, 278.0, 265.6];
  const items = Array.isArray(data.items) ? data.items.slice(0, 7) : [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const y = rowY[i];
    const noStr = String(item.no || i + 1);

    // No. (centered in x: 41.8 -> 78.0)
    page.drawText(noStr, {
      x: 58,
      y: y - 1,
      size: 7.5,
      font: fontBold,
      color: textColor
    });

    // Task / Step (x: 82, max width ~ 170)
    drawTruncated(page, item.taskStep || "", 82, y - 1, 170, 7, font, textColor);

    // Deviation (x: 260, max width ~ 168)
    drawTruncated(page, item.deviation || "", 260, y - 1, 168, 7, font, textColor);

    // Causes (x: 435, max width ~ 148)
    drawTruncated(page, item.cause || "", 435, y - 1, 148, 7, font, textColor);

    // Improvement Suggestion (x: 590, max width ~ 165)
    drawTruncated(page, item.suggestion || "", 590, y - 1, 165, 7, font, textColor);
  }

  // 8. Signatures & Identity
  // Observer (Supervisor): "Rahmansyah - Z110997"
  const observerName = data.observerName || "Rahmansyah - Z110997";
  page.drawText(observerName, {
    x: 175,
    y: 216.5,
    size: 8,
    font: fontBold,
    color: textColor
  });

  // Observer Signature:
  if (data.observerSignature && data.observerSignature.startsWith("data:image/")) {
    try {
      const base64Data = data.observerSignature.split(",")[1];
      if (base64Data) {
        const sigBytes = Buffer.from(base64Data, "base64");
        const sigImage = await pdfDoc.embedPng(sigBytes).catch(() => pdfDoc.embedJpg(sigBytes));
        // Draw in signature box: x=330, y=198, width=95, height=28
        page.drawImage(sigImage, {
          x: 330,
          y: 198,
          width: 95,
          height: 28
        });
      }
    } catch {
      // ignore signature embed error
    }
  }

  // Observee: "Yang di observasi kosong saja" -> left blank!

  // Superintendent: "Wanto"
  const superintendentName = data.superintendent || "Wanto";
  page.drawText(superintendentName, {
    x: 175,
    y: 139.5,
    size: 8,
    font: fontBold,
    color: textColor
  });

  // 9. Comments: rendered neatly across the 6 lines
  // Master lines at Y = [211.4, 196.1, 180.7, 165.4, 150.0, 134.6]
  // Text sits at Y = [213.5, 198.1, 182.7, 167.4, 152.0, 136.6]
  // X = 522, max width = 234
  if (data.comments && data.comments.trim()) {
    const commentLines = wrapText(data.comments.trim(), font, 7.5, 234);
    const commentY = [213.5, 198.1, 182.7, 167.4, 152.0, 136.6];

    for (let i = 0; i < commentLines.length && i < commentY.length; i++) {
      page.drawText(commentLines[i], {
        x: 522,
        y: commentY[i],
        size: 7.5,
        font,
        color: textColor
      });
    }
  }

  return await pdfDoc.save();
}
