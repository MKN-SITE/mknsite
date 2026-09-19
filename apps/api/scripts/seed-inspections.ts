import { db } from "../src/db";
import { opsTelcoInspections, users } from "../src/db/schema";

async function main() {
  const existing = await db.select({ id: opsTelcoInspections.id }).from(opsTelcoInspections);
  if (existing.length > 0) {
    console.log(`[SEED] ops_telco_inspections already has ${existing.length} records. Skipping.`);
    process.exit(0);
  }

  const allUsers = await db.select({ id: users.id, name: users.name }).from(users).limit(10);
  const user = allUsers[0];
  const userId = user ? user.id : 1;

  const samples = [
    {
      category: "tools",
      inspectionDate: "2026-09-17",
      itemName: "Fiber Optic Fusion Splicer Fujikura 70S",
      itemCondition: "baik",
      location: "Workshop Sangatta",
      notes: "Kondisi elektroda bersih, baterai terisi penuh 100%, motor alignment presisi.",
      actionTaken: "Pembersihan cermin dan kalibrasi rutin berkala.",
      photos: JSON.stringify([])
    },
    {
      category: "tools",
      inspectionDate: "2026-09-15",
      itemName: "Optical Time Domain Reflectometer (OTDR) Anritsu",
      itemCondition: "rusak_ringan",
      location: "Workshop Telco",
      notes: "Port konektor FC sedikit berdebu dan stylus layar sentuh hilang.",
      actionTaken: "Pembersihan port optik dengan optic cleaner, pengadaan stylus pengganti.",
      photos: JSON.stringify([])
    },
    {
      category: "tools",
      inspectionDate: "2026-09-12",
      itemName: "Tool Bag & Crimping Set Teknisi A",
      itemCondition: "baik",
      location: "Mobil Ops Telco 01",
      notes: "Tang crimping RJ45, stripper drop core, obeng set, dan multimeter lengkap.",
      actionTaken: "Inventarisasi bulanan lengkap siap jalan.",
      photos: JSON.stringify([])
    },
    {
      category: "apd",
      inspectionDate: "2026-09-16",
      itemName: "Full Body Harness Double Lanyard Petzl Volt",
      itemCondition: "baik",
      location: "Gudang APD Sangatta",
      notes: "Jahitan webbing utuh tidak berserabut, shock absorber belum pernah trigger, karabiner auto-lock lancar.",
      actionTaken: "Diberi label lolos inspeksi K3 periode September 2026.",
      photos: JSON.stringify([])
    },
    {
      category: "apd",
      inspectionDate: "2026-09-14",
      itemName: "Safety Helmet MSA V-Gard White + Chinstrap",
      itemCondition: "baik",
      location: "Loker Teknisi Telco",
      notes: "Tali dagu elastis baik, suspensi ratchet tidak longgar, shell helm bebas retak benturan.",
      actionTaken: "Pembersihan helm dan siap digunakan untuk kerja ketinggian.",
      photos: JSON.stringify([])
    },
    {
      category: "apd",
      inspectionDate: "2026-09-10",
      itemName: "Safety Shoes King's KWD 205 (Size 42)",
      itemCondition: "rusak_ringan",
      location: "Pos Lapangan",
      notes: "Sol karet bagian samping kanan mulai sedikit terkelupas akibat kontak medan bebatuan.",
      actionTaken: "Diajukan form penggantian APD baru ke Safety Officer.",
      photos: JSON.stringify([])
    },
    {
      category: "tangga",
      inspectionDate: "2026-09-18",
      itemName: "Tangga Fibreglass Extensible 6 Meter Werner",
      itemCondition: "baik",
      location: "Mobil Ops Telco 02",
      notes: "Material fiberglass non-conductive mulus tanpa retak, tali katrol pengerek lancar, rung lock mengunci kuat.",
      actionTaken: "Pemeriksaan fungsi pengunci dan uji stabilitas beban aman.",
      photos: JSON.stringify([])
    },
    {
      category: "tangga",
      inspectionDate: "2026-09-11",
      itemName: "Tangga Aluminium Multipurpose 4.7m",
      itemCondition: "rusak_ringan",
      location: "Workshop Telco",
      notes: "Karet anti-slip pada kaki tangga sebelah kiri bawah aus dan tipis.",
      actionTaken: "Dipasang karet sepatu tangga pengganti sebelum diizinkan mobilisasi.",
      photos: JSON.stringify([])
    },
    {
      category: "padlock",
      inspectionDate: "2026-09-17",
      itemName: "Padlock Outdoor Heavy Duty Shelter Swarga Bara",
      itemCondition: "baik",
      location: "Shelter Swarga Bara",
      notes: "Gembok stainless steel tahan cuaca, silinder kunci lancar dibuka dan ditutup.",
      actionTaken: "Dilumasi pelumas khusus silinder kunci agar tidak macet debu tambang.",
      photos: JSON.stringify([])
    },
    {
      category: "padlock",
      inspectionDate: "2026-09-13",
      itemName: "Padlock Enclosure Rack Tower Pinang",
      itemCondition: "baik",
      location: "Repeater Tower Pinang",
      notes: "Shackle kokoh, kunci master dan kunci duplikat cocok, penutup lubang kunci rapat.",
      actionTaken: "Pengecekan fisik dan verifikasi pengamanan perimeter tower.",
      photos: JSON.stringify([])
    }
  ];

  for (const s of samples) {
    await db.insert(opsTelcoInspections).values({
      ...s,
      inspectedBy: userId
    });
  }

  console.log(`[SEED] Berhasil menginjeksi ${samples.length} data inspeksi awal.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[SEED] Error seeding inspections:", err);
  process.exit(1);
});
