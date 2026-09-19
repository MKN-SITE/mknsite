import { expect, test, describe } from "bun:test";
import { app } from "../src/index";
import { opsTelcoJsaService } from "../src/services/ops-telco-jsa.service";
import { generateJsaPdf } from "../src/services/ops-telco-jsa-pdf.service";

describe("Job Safety Analysis (JSA) Integration Test", () => {
  test("1. Database has imported historical JSA records", async () => {
    const list = await opsTelcoJsaService.listJsa({ limit: 10 });
    expect(list.total).toBeGreaterThan(50);
    expect(list.items.length).toBeGreaterThan(0);
    console.log(`[TEST] Historical records verified: Total = ${list.total}`);
  });

  test("2. Generate next JSA number", async () => {
    const num = await opsTelcoJsaService.getNextJsaNumber();
    expect(num).toMatch(/^MKN\/SGT\/TLC\/\d{3}\/\d{2}\/\d{4}$/);
    console.log(`[TEST] Next JSA number: ${num}`);
  });

  test("3. Create a new JSA form and verify steps", async () => {
    const created = await opsTelcoJsaService.createJsa({
      jobTitle: "Testing JSA Tower Maintenance",
      location: "Tower Harapan Test Site",
      jsaDate: "2026-09-18",
      jsaType: "normal",
      personTitle: "Technician + Junior Technician",
      analysedBy: "Budi Santoso",
      analysedByBadge: "Z199001",
      supervisorName: "Imam Aulia",
      fpeElements: ["2.14", "2.18"],
      jobPermits: ["wah", "confined_space"],
      workers: [
        { name: "Budi Santoso", badgeNumber: "Z199001" },
        { name: "Dwi Prasetyo", badgeNumber: "Z199002" }
      ],
      steps: [
        {
          stepNumber: 1,
          sequence: 1,
          stepDescription: "Persiapan peralatan dan safety briefing",
          hazardNo: "1.1",
          hazardDescription: "Peralatan tidak lengkap atau rusak",
          actionNo: "1.1.1",
          actionDescription: "Lakukan inspeksi APD dan peralatan kerja sebelum naik tower",
          observation: "YES"
        },
        {
          stepNumber: 2,
          sequence: 2,
          stepDescription: "Pemanjatan tower dan instalasi antena",
          hazardNo: "2.1",
          hazardDescription: "Terjatuh dari ketinggian",
          actionNo: "2.1.1",
          actionDescription: "Wajib menggunakan full body harness dengan twin lanyard 100% tie-off",
          observation: "YES"
        }
      ]
    });

    expect(created.id).toBeDefined();
    expect(created.jobTitle).toBe("Testing JSA Tower Maintenance");
    expect(created.steps?.length).toBe(2);
    expect(created.fpeElements).toContain("2.14");
    expect(created.jobPermits).toContain("wah");

    console.log(`[TEST] Created JSA Form ID = ${created.id}, Number = ${created.jsaNumber}`);

    // Test PDF generation for the created JSA
    const pdfBytes = await generateJsaPdf(created);
    expect(pdfBytes.byteLength).toBeGreaterThan(10000);
    console.log(`[TEST] Generated PDF byte length = ${pdfBytes.byteLength}`);

    // Clean up test record
    await opsTelcoJsaService.deleteJsa(created.id);
    console.log(`[TEST] Cleaned up test record ID = ${created.id}`);
  });
});
