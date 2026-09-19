import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { db } from "./src/db";
import { opsTelcoHandovers, users } from "./src/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const existingCount = await db.select({ id: opsTelcoHandovers.id }).from(opsTelcoHandovers);
  if (existingCount.length > 0) {
    console.log(`[SEED] ops_telco_handovers already contains ${existingCount.length} records. Skipping seed.`);
    process.exit(0);
  }

  // Get a default technician or user
  const allUsers = await db.select({ id: users.id, name: users.name }).from(users).limit(10);
  const defaultUser = allUsers.find((u) => u.name.toLowerCase().includes("rahman")) || allUsers[0];
  const userId = defaultUser ? defaultUser.id : 1;

  const templateDir = resolve("/app/form-templates/ops-telco/technician/Serah Terima");
  const localTemplateDir = resolve("../../form-templates/ops-telco/technician/Serah Terima");
  const srcDir = existsSync(templateDir) ? templateDir : existsSync(localTemplateDir) ? localTemplateDir : "";

  const uploadDir = resolve("uploads/handovers");
  if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true });
  }

  console.log(`[SEED] Source template dir: ${srcDir}`);

  // Helper to copy file
  function copyImage(filename: string): string | null {
    if (!srcDir) return null;
    const srcPath = join(srcDir, filename);
    if (!existsSync(srcPath)) return null;

    const ext = extname(filename);
    const destName = `handover-sample-${Date.now()}-${Math.random().toString(36).slice(2, 7)}${ext}`;
    const destPath = join(uploadDir, destName);
    copyFileSync(srcPath, destPath);
    return `/uploads/handovers/${destName}`;
  }

  const sampleEntries = [
    {
      handoverDate: "2026-09-09",
      description: "Serah Terima Bracket Antenna 7 ea, Power Beam Ubiquiti 7 ea, Cambium 1 ea, Rocket 1 ea untuk kebutuhan site.",
      files: [
        "09.09.2026 Serah Terima Bracket Antenna 7 ea.jpeg",
        "09.09.2026 Serah Terima Power Beam Ubiquiti 7 ea, Cambium 1 ea, Rocket 1 ea.jpeg"
      ]
    },
    {
      handoverDate: "2026-06-02",
      description: "Serah Terima Power Beam Ubiquiti (2 ea & 3 ea) dan Rack Switch ke pihak lapangan.",
      files: [
        "2.06.2026 serah Terima Power Beam Ubiquiti 2 ea  1.jpeg",
        "2.06.2026 serah terima Power Beam Ubiqiti 3 ea 2.jpeg",
        "2.06.2026 serah terima rack switch.jpeg"
      ]
    },
    {
      handoverDate: "2026-05-15",
      description: "Serah terima 2 ea WiFi Box unit 120 dan 121 lengkap dengan perangkat instalasi.",
      files: [
        "15-5-2026 serah terima 2 ea wifi box  120 121 1.jpeg",
        "15-5-2026 serah terima 2 ea wifi box  120 121 2.jpeg",
        "15-5-2026 serah terima 2 ea wifi box  3.jpeg",
        "15-5-2026 serah terima 2 ea wifi box  4.jpeg"
      ]
    },
    {
      handoverDate: "2026-03-24",
      description: "Serah terima wifi box 2 ea untuk 118 dan 119 ke Bintang Mursalim.",
      files: ["24-3-2026 Serah terima wifi box 2 ea untuk 118 dan 119 ke bintang mursalim.jpeg"]
    },
    {
      handoverDate: "2026-02-03",
      description: "Serah terima MPPT rusak ex repeater radar untuk dilakukan inspeksi dan perbaikan.",
      files: ["3-2-2026 serah terima mppt rusak ex reppeater radar.jpeg"]
    },
    {
      handoverDate: "2026-01-02",
      description: "Serah terima inverter rusak 2 ea ex WAP Bintang kepada tim workshop/maintenance.",
      files: ["2-1-2026 Serah terima inverter rusak 2 ea ex WAP bintang.jpeg"]
    },
    {
      handoverDate: "2025-12-15",
      description: "Serah terima Box WiFi Booster 1 ea ke Pak Mursalim Bintang (kondisi baik).",
      files: [
        "15-12-2025 Serah terima Box Wifi Bosster 1 ea ke Pak Mursalim Bintang 2.jpg",
        "15-12-2025 Serah terima Box Wifi Bosster ke Pak Mursalim Bintang 1 .jpg"
      ]
    },
    {
      handoverDate: "2025-11-26",
      description: "Penyerahan perangkat WiFi Booster IP 19 ke Bintang Office.",
      files: ["26-11-2025 penyerahan  perangkat wifi booster IP 19 ke Bintang Office.jpg"]
    },
    {
      handoverDate: "2025-10-29",
      description: "Perangkat WiFi Booster pertama dipinjamkan ke Bintang dan sudah dikembalikan ke IT (milik IT).",
      files: [
        "29-10-2025 perangkat wifi booster pertama di pinjamkan ke Bintang dan sudah di kembalikan ke IT (milik IT) 1.jpg",
        "29-10-2025 perangkat wifi booster pertama di pinjamkan ke Bintang dan sudah di kembalikan ke IT (milik IT) 2.jpg"
      ]
    },
    {
      handoverDate: "2025-10-29",
      description: "Serah terima ke GA: Spicer TV, Tester, dan DB Meter.",
      files: ["29-10-2025 serah terima ke GA spicer tv tester db meter.jpg"]
    },
    {
      handoverDate: "2025-10-28",
      description: "Telkomsel serah terima ODU dan RRU ke Galih.",
      files: ["28-10-2025 telkomsel serah terima ODU dan RRU ke galih.jpg"]
    }
  ];

  for (const item of sampleEntries) {
    const photos: string[] = [];
    for (const f of item.files) {
      const url = copyImage(f);
      if (url) photos.push(url);
    }

    await db.insert(opsTelcoHandovers).values({
      handoverDate: item.handoverDate,
      description: item.description,
      photos: JSON.stringify(photos),
      createdBy: userId
    });

    console.log(`[SEED] Inserted: ${item.handoverDate} - ${item.description.slice(0, 40)}... (${photos.length} photos)`);
  }

  console.log("[SEED] Selesai seeding data serah terima!");
  process.exit(0);
}

main().catch((err) => {
  console.error("[SEED] Error seeding handovers:", err);
  process.exit(1);
});
