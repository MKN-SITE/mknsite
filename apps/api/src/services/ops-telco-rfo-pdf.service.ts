import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export interface RfoPdfData {
  ticketNumber: string; // e.g. "20260516002" or "20260516/002"
  startTime: string;    // e.g. "16 Mei 2026 13:20 WITA"
  endTime: string;      // e.g. "16 Mei 2026 17:35 WITA"
  cause: string;        // e.g. "Link Backbone Sangatta – Bengalon Problem"
  impact: string;       // e.g. "Layanan Internet ke Bengalon Down"
  solution: string;     // e.g. "Penggantian Perangkat di Tower"
  status: string;       // e.g. "Layanan Internet ke Bengalon Kembali Normal"
}

function resolveLogoPath(): string | null {
  const candidatePaths = [
    resolve(import.meta.dir, "../assets/rfo-logo.png"),
    resolve("/app/apps/api/src/assets/rfo-logo.png"),
    resolve(import.meta.dir, "../../../../form-templates/ops-telco/supervisor/RFO/rfo-logo.png"),
    resolve("/app/form-templates/ops-telco/supervisor/RFO/rfo-logo.png"),
    resolve(import.meta.dir, "../../../../apps/web/public/assets/Logo MKN.png"),
    resolve("/app/apps/web/public/assets/Logo MKN.png")
  ];

  for (const p of candidatePaths) {
    if (existsSync(p)) return p;
  }
  return null;
}

function formatTicketNumberDisplay(raw: string): string {
  if (!raw) return "";
  const clean = raw.trim();
  if (clean.includes("/")) return clean;
  // If format is YYYYMMDDXXX (11 chars)
  if (/^\d{11}$/.test(clean)) {
    return `${clean.slice(0, 8)}/${clean.slice(8)}`;
  }
  return clean;
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  if (!text) return [];
  const lines: string[] = [];
  const paragraphs = text.split(/\r?\n/);

  for (const para of paragraphs) {
    const trimmedPara = para.trim();
    if (!trimmedPara) {
      lines.push("");
      continue;
    }

    const words = trimmedPara.split(/\s+/);
    let currentLine = "";

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      const width = font.widthOfTextAtSize(candidate, fontSize);
      if (width <= maxWidth) {
        currentLine = candidate;
      } else {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          // Single word wider than maxWidth
          lines.push(word);
          currentLine = "";
        }
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines;
}

export async function generateRfoPdf(data: RfoPdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  // Standard A4: 596.04 x 842.04 points
  const page = doc.addPage([596.04, 842.04]);

  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const black = rgb(0, 0, 0);

  // 1. Draw MKN Logo (Exact position from template: x=416.55, y=738.84, w=102.75, h=73.45)
  const logoPath = resolveLogoPath();
  if (logoPath) {
    try {
      const logoBytes = await readFile(logoPath);
      const logoImg = await doc.embedPng(logoBytes);
      page.drawImage(logoImg, {
        x: 416.55,
        y: 738.84,
        width: 102.75,
        height: 73.45
      });
    } catch {
      // Fallback if png decoding error
    }
  }

  // 2. Title Header
  // Line 1: "SURAT KETERANGAN" (Bold 16 pt, underlined)
  const titleLine1 = "SURAT KETERANGAN";
  const title1Size = 15.96;
  const title1X = 211.5;
  const title1Y = 683.9;
  page.drawText(titleLine1, {
    x: title1X,
    y: title1Y,
    size: title1Size,
    font: fontBold,
    color: black
  });

  // Underline for titleLine1 (thick underline from template)
  const title1Width = fontBold.widthOfTextAtSize(titleLine1, title1Size);
  page.drawLine({
    start: { x: title1X, y: title1Y - 2.5 },
    end: { x: title1X + title1Width, y: title1Y - 2.5 },
    thickness: 1.5,
    color: black
  });

  // Line 2: "(RFO) Reason for Outage" (Bold 16 pt, no underline)
  const titleLine2 = "(RFO) Reason for Outage";
  const title2Size = 15.96;
  const title2X = 201.8;
  const title2Y = 665.9;
  page.drawText(titleLine2, {
    x: title2X,
    y: title2Y,
    size: title2Size,
    font: fontBold,
    color: black
  });

  // 3. Nomor Gangguan
  const formattedTicket = formatTicketNumberDisplay(data.ticketNumber);
  const ticketText = `Nomor Gangguan : ${formattedTicket}`;
  page.drawText(ticketText, {
    x: 72.0,
    y: 608.3,
    size: 12,
    font: fontBold,
    color: black
  });

  // 4. Intro text
  const introText = "Berikut adalah penjelasan mengenai kejadian gangguan.";
  page.drawText(introText, {
    x: 72.0,
    y: 577.8,
    size: 12,
    font: fontRegular,
    color: black
  });

  // 5. Six-row Table
  // Left border: 71.8
  // Dividing column line: 227.05
  // Right border: 535.05
  // Width col 1 = 155.25, Width col 2 = 308.0
  const tableX = 71.8;
  const col1W = 155.25;
  const col2W = 308.0;
  const tableW = col1W + col2W; // 535.05 - 71.8 = 463.25
  const divX = tableX + col1W; // 227.05
  const rightX = tableX + tableW; // 535.05

  const tableTopY = 557.0;
  const fontSize = 12;
  const lineHeight = 16;
  const col2MaxTextW = col2W - 25; // max width for text after ":   "

  interface RowConfig {
    label: string;
    value: string;
  }

  const rows: RowConfig[] = [
    { label: "Mulai kejadian", value: data.startTime || "" },
    { label: "Akhir kejadian", value: data.endTime || "" },
    { label: "Penyebab", value: data.cause || "" },
    { label: "Akibat", value: data.impact || "" },
    { label: "Solusi", value: data.solution || "" },
    { label: "Status", value: data.status || "" }
  ];

  let currentY = tableTopY;
  const rowBounds: { topY: number; bottomY: number; label: string; lines: string[] }[] = [];

  for (const r of rows) {
    const wrappedLines = wrapText(r.value, fontRegular, fontSize, col2MaxTextW);
    const numLines = Math.max(1, wrappedLines.length);
    const rowHeight = Math.max(26, numLines * lineHeight + 10);
    const rowBottomY = currentY - rowHeight;

    rowBounds.push({
      topY: currentY,
      bottomY: rowBottomY,
      label: r.label,
      lines: wrappedLines.length > 0 ? wrappedLines : [""]
    });

    currentY = rowBottomY;
  }

  const tableBottomY = currentY;

  // Draw Table Borders
  // 1. Outer box
  page.drawRectangle({
    x: tableX,
    y: tableBottomY,
    width: tableW,
    height: tableTopY - tableBottomY,
    borderWidth: 0.75,
    borderColor: black,
    color: undefined
  });

  // 2. Vertical Divider
  page.drawLine({
    start: { x: divX, y: tableTopY },
    end: { x: divX, y: tableBottomY },
    thickness: 0.75,
    color: black
  });

  // 3. Horizontal Dividers & Row Content
  for (let i = 0; i < rowBounds.length; i++) {
    const rb = rowBounds[i];

    // Horizontal line below row (except last row, which is covered by outer box)
    if (i < rowBounds.length - 1) {
      page.drawLine({
        start: { x: tableX, y: rb.bottomY },
        end: { x: rightX, y: rb.bottomY },
        thickness: 0.75,
        color: black
      });
    }

    // Text in Col 1 (Label)
    // Vertical alignment: aligned near top with padding
    const labelY = rb.topY - 18;
    page.drawText(rb.label, {
      x: tableX + 5.0,
      y: labelY,
      size: fontSize,
      font: fontRegular,
      color: black
    });

    // Text in Col 2 (Value with ":   " prefix)
    const colonPrefix = ":   ";
    const colonW = fontRegular.widthOfTextAtSize(colonPrefix, fontSize);

    rb.lines.forEach((line, lIdx) => {
      const lineY = rb.topY - 18 - lIdx * lineHeight;
      if (lIdx === 0) {
        // Draw colon prefix on first line
        page.drawText(colonPrefix, {
          x: divX + 3.0,
          y: lineY,
          size: fontSize,
          font: fontRegular,
          color: black
        });
        // Draw text
        page.drawText(line, {
          x: divX + 3.0 + colonW,
          y: lineY,
          size: fontSize,
          font: fontRegular,
          color: black
        });
      } else {
        // Indented continuation line
        page.drawText(line, {
          x: divX + 3.0 + colonW,
          y: lineY,
          size: fontSize,
          font: fontRegular,
          color: black
        });
      }
    });
  }

  // 6. Post-table closing text
  // Template:
  // "Demikian Surat Keterangan ini dibuat.  Semoga dapat membantu. Terima kasih"
  // Note: "Surat Keterangan" is bold!
  let textY = tableBottomY - 26;

  let currentClosingX = 72.0;
  page.drawText("Demikian ", {
    x: currentClosingX,
    y: textY,
    size: 12,
    font: fontRegular,
    color: black
  });
  currentClosingX += fontRegular.widthOfTextAtSize("Demikian ", 12);

  page.drawText("Surat Keterangan", {
    x: currentClosingX,
    y: textY,
    size: 12,
    font: fontBold,
    color: black
  });
  currentClosingX += fontBold.widthOfTextAtSize("Surat Keterangan", 12);

  page.drawText(" ini dibuat.  Semoga dapat membantu. Terima kasih", {
    x: currentClosingX,
    y: textY,
    size: 12,
    font: fontRegular,
    color: black
  });

  // 7. Sign-off block
  textY -= 45;
  page.drawText("Hormat Kami,", {
    x: 72.0,
    y: textY,
    size: 12,
    font: fontRegular,
    color: black
  });

  textY -= 16;
  page.drawText("PT. Multi Kontrol Nusantara", {
    x: 72.0,
    y: textY,
    size: 12,
    font: fontBold,
    color: black
  });

  // Signature gap (~65 points)
  textY -= 65;
  page.drawText("Helpdesk", {
    x: 72.0,
    y: textY,
    size: 12,
    font: fontRegular,
    color: black
  });

  // 8. Bottom decorative line (y=82.8, from x=71.8 to 535.05)
  page.drawLine({
    start: { x: 71.8, y: 82.8 },
    end: { x: 535.05, y: 82.8 },
    thickness: 0.75,
    color: black
  });

  return doc.save();
}
