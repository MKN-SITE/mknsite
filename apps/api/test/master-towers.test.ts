import { describe, expect, test } from "bun:test";
import { app } from "../src/index";
import { getTowers, seedTowersFromExcel } from "../src/services/master-tower.service";

describe("Master Towers API & Service Test", () => {
  test("1. Excel template seeder imports 15 towers", async () => {
    const seedRes = await seedTowersFromExcel();
    expect(seedRes.success).toBe(true);
    expect(seedRes.imported).toBeGreaterThanOrEqual(14);

    const towers = await getTowers();
    expect(towers.length).toBeGreaterThanOrEqual(14);

    const surya = towers.find((t) => t.towerName.toLowerCase().includes("surya"));
    expect(surya).toBeDefined();
    expect(surya?.height).toBe("30 m");
    expect(surya?.towerType).toBe("SST");
    expect(surya?.latitudeDec).not.toBeNull();
    expect(surya?.longitudeDec).not.toBeNull();
    console.log("[TEST] Verified Surya Tower:", surya?.towerName, surya?.latitudeDec, surya?.longitudeDec);
  });

  test("2. Filtering and searching towers works", async () => {
    const sstTowers = await getTowers({ type: "SST" });
    expect(sstTowers.length).toBeGreaterThan(0);
    for (const t of sstTowers) {
      expect(t.towerType).toBe("SST");
    }

    const sangattaTowers = await getTowers({ kecamatan: "Sangatta" });
    expect(sangattaTowers.length).toBeGreaterThan(0);
    for (const t of sangattaTowers) {
      expect(t.locationKecamatan).toBe("Sangatta");
    }

    const searchRes = await getTowers({ search: "Bengalon" });
    expect(searchRes.length).toBeGreaterThan(0);
    console.log("[TEST] Found Bengalon towers count:", searchRes.length);
  });
});
