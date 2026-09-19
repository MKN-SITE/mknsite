import { and, asc, desc, eq, like, or, sql } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { db } from "../db";
import { masterTowerPhotos, masterTowers, users } from "../db/schema";

export interface MasterTowerDto {
  id: number;
  towerNo: number | null;
  towerCode: string;
  towerName: string;
  towerType: string | null;
  height: string | null;
  heightMeters: number | null;
  locationKecamatan: string | null;
  locationKabupaten: string | null;
  locationProvince: string | null;
  latitude: string | null;
  longitude: string | null;
  altitude: string | null;
  latitudeDec: string | null;
  longitudeDec: string | null;
  operationalStatus: string;
  description: string | null;
  primaryPhotoUrl: string | null;
  createdBy: number | null;
  createdAt: Date;
  updatedAt: Date;
  photosCount?: number;
  photos?: MasterTowerPhotoDto[];
}

export interface MasterTowerPhotoDto {
  id: number;
  towerId: number;
  photoUrl: string;
  caption: string | null;
  isCover: boolean;
  uploadedBy: number | null;
  createdAt: Date;
  uploaderName?: string | null;
}

export interface TowerFilterParams {
  search?: string;
  type?: string;
  kecamatan?: string;
  status?: string;
  sortBy?: "name" | "no" | "height" | "created";
  sortOrder?: "asc" | "desc";
}

/**
 * Mengubah notasi DMS (Degrees Minutes Seconds) string ke format desimal (WGS84).
 * Menangani format unik seperti "000 33' 11.6\" N" atau "1170 29' 00.0\" E".
 */
export function parseDmsToDecimal(dmsStr?: string | null): string | null {
  if (!dmsStr) return null;
  const trimmed = dmsStr.trim();
  if (!trimmed) return null;

  // Jika sudah desimal
  if (!Number.isNaN(Number(trimmed))) {
    return Number(trimmed).toFixed(6);
  }

  // Normalisasi karakter typo umum (misal 000 untuk 0°, 1170 untuk 117°)
  let normalized = trimmed
    .replace(/^000\s*/, "0° ")
    .replace(/^1170\s*/, "117° ")
    .replace(/˚/g, "°");

  // Format regex: angka derajat, menit, detik, arah (N/S/E/W)
  const regex = /([0-9.]+)[°\s]+(?:([0-9.]+)['\s]+)?(?:([0-9.]+)["\s]*)?([NSEWnsew])?/;
  const match = normalized.match(regex);
  if (!match) return null;

  const deg = Number.parseFloat(match[1] || "0");
  const min = Number.parseFloat(match[2] || "0");
  const sec = Number.parseFloat(match[3] || "0");
  const dir = (match[4] || "").toUpperCase();

  let decimal = deg + min / 60 + sec / 3600;
  if (dir === "S" || dir === "W") {
    decimal = -decimal;
  }

  return decimal.toFixed(6);
}

/**
 * Mencari path file template Tower Coordinat1.xls pada host atau docker container.
 */
export function resolveTowerExcelPath(): string | null {
  const possiblePaths = [
    "/app/form-templates/Master/Tower Coordinat1.xls",
    path.resolve(process.cwd(), "form-templates/Master/Tower Coordinat1.xls"),
    path.resolve(process.cwd(), "../../form-templates/Master/Tower Coordinat1.xls"),
    "d:/Project-Web/MKNSite/form-templates/Master/Tower Coordinat1.xls"
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

/**
 * Mengimpor seluruh tower dari file Excel master `Tower Coordinat1.xls`.
 */
export async function seedTowersFromExcel(customFilePath?: string) {
  const filePath = customFilePath || resolveTowerExcelPath();
  if (!filePath || !fs.existsSync(filePath)) {
    console.warn(`[TOWER SEED] File template master tower tidak ditemukan di: ${filePath}`);
    return { success: false, imported: 0, message: "File template tidak ditemukan" };
  }

  console.log(`[TOWER SEED] Membaca file template: ${filePath}`);
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames.includes("Tower") ? "Tower" : workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // Data baris tower dimulai dari index 4
  // Struktur kolom:
  // [0] No. (1, 2, 3...)
  // [1] Tower Name ("Surya", "Bintang", ...)
  // [2] Height ("30 m", "35 m", ...)
  // [3] Type ("SST", "Monopole", ...)
  // [4] Kecamatan ("Sangatta", "Bengalon")
  // [5] Kabupaten ("Kutai Timur")
  // [6] Province ("Kal-Tim")
  // [7] Latitude ("000 33' 11.6\" N")
  // [8] Longitude ("1170 29' 00.0\" E")
  // [9] Altitude ("188 m")

  let count = 0;
  for (let i = 4; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[1] || String(row[1]).trim() === "") continue;

    const rawNo = row[0];
    const towerNo = typeof rawNo === "number" ? rawNo : Number.parseInt(String(rawNo), 10) || (i - 3);
    const towerName = String(row[1]).trim();
    const rawHeight = row[2] ? String(row[2]).trim() : null;
    const heightMeters = rawHeight ? Number.parseInt(rawHeight.replace(/[^0-9]/g, ""), 10) || null : null;
    const towerType = row[3] ? String(row[3]).trim() : "SST";
    const kecamatan = row[4] ? String(row[4]).trim() : "Sangatta";
    const kabupaten = row[5] ? String(row[5]).trim() : "Kutai Timur";
    const province = row[6] ? String(row[6]).trim() : "Kal-Tim";
    const lat = row[7] ? String(row[7]).trim() : null;
    const long = row[8] ? String(row[8]).trim() : null;
    const alt = row[9] ? String(row[9]).trim() : null;

    // Normalisasi Tower Code unik: TWR-SURYA, TWR-HATARI-HARAPAN, dll
    const sanitizedCode = "TWR-" + towerName.toUpperCase().replace(/[^A-Z0-9]/g, "-").replace(/-+/g, "-");

    const latDec = parseDmsToDecimal(lat);
    const longDec = parseDmsToDecimal(long);

    await db.insert(masterTowers).values({
      towerNo,
      towerCode: sanitizedCode,
      towerName,
      towerType,
      height: rawHeight,
      heightMeters,
      locationKecamatan: kecamatan,
      locationKabupaten: kabupaten,
      locationProvince: province,
      latitude: lat,
      longitude: long,
      altitude: alt,
      latitudeDec: latDec,
      longitudeDec: longDec,
      operationalStatus: "Aktif",
      description: `Menara Telekomunikasi ${towerType} ${towerName} setinggi ${rawHeight || "-"} di ${kecamatan}, ${kabupaten}.`
    }).onDuplicateKeyUpdate({
      set: {
        towerNo,
        towerName,
        towerType,
        height: rawHeight,
        heightMeters,
        locationKecamatan: kecamatan,
        locationKabupaten: kabupaten,
        locationProvince: province,
        latitude: lat,
        longitude: long,
        altitude: alt,
        latitudeDec: latDec,
        longitudeDec: longDec
      }
    });

    count++;
  }

  console.log(`[TOWER SEED] Berhasil menyinkronkan ${count} menara dari Excel.`);
  return { success: true, imported: count, message: `Berhasil mengimpor ${count} tower.` };
}

/**
 * Mengambil daftar tower dengan filter dan relasi jumlah foto.
 */
export async function getTowers(params: TowerFilterParams = {}): Promise<MasterTowerDto[]> {
  const conditions = [];

  if (params.search) {
    const q = `%${params.search.trim()}%`;
    conditions.push(
      or(
        like(masterTowers.towerName, q),
        like(masterTowers.towerCode, q),
        like(masterTowers.locationKecamatan, q),
        like(masterTowers.towerType, q)
      )
    );
  }

  if (params.type && params.type !== "ALL") {
    conditions.push(eq(masterTowers.towerType, params.type));
  }

  if (params.kecamatan && params.kecamatan !== "ALL") {
    conditions.push(eq(masterTowers.locationKecamatan, params.kecamatan));
  }

  if (params.status && params.status !== "ALL") {
    conditions.push(eq(masterTowers.operationalStatus, params.status));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  let orderClause = asc(masterTowers.towerNo);
  if (params.sortBy === "name") {
    orderClause = params.sortOrder === "desc" ? desc(masterTowers.towerName) : asc(masterTowers.towerName);
  } else if (params.sortBy === "height") {
    orderClause = params.sortOrder === "desc" ? desc(masterTowers.heightMeters) : asc(masterTowers.heightMeters);
  } else if (params.sortBy === "created") {
    orderClause = params.sortOrder === "desc" ? desc(masterTowers.createdAt) : asc(masterTowers.createdAt);
  } else if (params.sortOrder === "desc") {
    orderClause = desc(masterTowers.towerNo);
  }

  const towersList = await db.select().from(masterTowers).where(whereClause).orderBy(orderClause);

  // Ambil data foto untuk menghitung jumlah dan menentukan cover per tower
  const towerIds = towersList.map((t) => t.id);
  const photos = towerIds.length > 0
    ? await db.select().from(masterTowerPhotos).where(sql`${masterTowerPhotos.towerId} IN (${sql.join(towerIds.map(id => sql`${id}`), sql`, `)})`)
    : [];

  const photoCountMap = new Map<number, number>();
  const coverMap = new Map<number, string>();

  for (const p of photos) {
    photoCountMap.set(p.towerId, (photoCountMap.get(p.towerId) || 0) + 1);
    if (p.isCover || !coverMap.has(p.towerId)) {
      coverMap.set(p.towerId, p.photoUrl);
    }
  }

  return towersList.map((t) => ({
    ...t,
    primaryPhotoUrl: t.primaryPhotoUrl || coverMap.get(t.id) || null,
    photosCount: photoCountMap.get(t.id) || 0
  }));
}

/**
 * Mengambil detail tower spesifik beserta seluruh fotonya.
 */
export async function getTowerById(id: number): Promise<MasterTowerDto | null> {
  const [tower] = await db.select().from(masterTowers).where(eq(masterTowers.id, id)).limit(1);
  if (!tower) return null;

  const photos = await db
    .select({
      id: masterTowerPhotos.id,
      towerId: masterTowerPhotos.towerId,
      photoUrl: masterTowerPhotos.photoUrl,
      caption: masterTowerPhotos.caption,
      isCover: masterTowerPhotos.isCover,
      uploadedBy: masterTowerPhotos.uploadedBy,
      createdAt: masterTowerPhotos.createdAt,
      uploaderName: users.name
    })
    .from(masterTowerPhotos)
    .leftJoin(users, eq(masterTowerPhotos.uploadedBy, users.id))
    .where(eq(masterTowerPhotos.towerId, id))
    .orderBy(desc(masterTowerPhotos.isCover), desc(masterTowerPhotos.createdAt));

  return {
    ...tower,
    photosCount: photos.length,
    photos: photos.map((p) => ({
      id: p.id,
      towerId: p.towerId,
      photoUrl: p.photoUrl,
      caption: p.caption,
      isCover: Boolean(p.isCover),
      uploadedBy: p.uploadedBy,
      createdAt: p.createdAt,
      uploaderName: p.uploaderName
    }))
  };
}

/**
 * Membuat tower baru.
 */
export async function createTower(data: {
  towerName: string;
  towerType?: string;
  height?: string;
  locationKecamatan?: string;
  locationKabupaten?: string;
  locationProvince?: string;
  latitude?: string;
  longitude?: string;
  altitude?: string;
  operationalStatus?: string;
  description?: string;
  createdBy?: number;
}) {
  const countRes = await db.select({ count: sql<number>`count(*)` }).from(masterTowers);
  const nextNo = (countRes[0]?.count || 0) + 1;

  const sanitizedCode = "TWR-" + data.towerName.toUpperCase().replace(/[^A-Z0-9]/g, "-").replace(/-+/g, "-") + (nextNo ? `-${nextNo}` : "");
  const heightMeters = data.height ? Number.parseInt(data.height.replace(/[^0-9]/g, ""), 10) || null : null;

  const [res] = await db.insert(masterTowers).values({
    towerNo: nextNo,
    towerCode: sanitizedCode,
    towerName: data.towerName.trim(),
    towerType: data.towerType || "SST",
    height: data.height || null,
    heightMeters,
    locationKecamatan: data.locationKecamatan || "Sangatta",
    locationKabupaten: data.locationKabupaten || "Kutai Timur",
    locationProvince: data.locationProvince || "Kal-Tim",
    latitude: data.latitude || null,
    longitude: data.longitude || null,
    altitude: data.altitude || null,
    latitudeDec: parseDmsToDecimal(data.latitude),
    longitudeDec: parseDmsToDecimal(data.longitude),
    operationalStatus: data.operationalStatus || "Aktif",
    description: data.description || null,
    createdBy: data.createdBy || null
  });

  return getTowerById(Number(res.insertId));
}

/**
 * Mengubah data tower yang sudah ada.
 */
export async function updateTower(
  id: number,
  data: Partial<{
    towerName: string;
    towerType: string;
    height: string;
    locationKecamatan: string;
    locationKabupaten: string;
    locationProvince: string;
    latitude: string;
    longitude: string;
    altitude: string;
    operationalStatus: string;
    description: string;
  }>
) {
  const updatePayload: Record<string, any> = {};

  if (data.towerName !== undefined) updatePayload.towerName = data.towerName.trim();
  if (data.towerType !== undefined) updatePayload.towerType = data.towerType;
  if (data.height !== undefined) {
    updatePayload.height = data.height;
    updatePayload.heightMeters = data.height ? Number.parseInt(data.height.replace(/[^0-9]/g, ""), 10) || null : null;
  }
  if (data.locationKecamatan !== undefined) updatePayload.locationKecamatan = data.locationKecamatan;
  if (data.locationKabupaten !== undefined) updatePayload.locationKabupaten = data.locationKabupaten;
  if (data.locationProvince !== undefined) updatePayload.locationProvince = data.locationProvince;
  if (data.latitude !== undefined) {
    updatePayload.latitude = data.latitude;
    updatePayload.latitudeDec = parseDmsToDecimal(data.latitude);
  }
  if (data.longitude !== undefined) {
    updatePayload.longitude = data.longitude;
    updatePayload.longitudeDec = parseDmsToDecimal(data.longitude);
  }
  if (data.altitude !== undefined) updatePayload.altitude = data.altitude;
  if (data.operationalStatus !== undefined) updatePayload.operationalStatus = data.operationalStatus;
  if (data.description !== undefined) updatePayload.description = data.description;

  if (Object.keys(updatePayload).length > 0) {
    await db.update(masterTowers).set(updatePayload).where(eq(masterTowers.id, id));
  }

  return getTowerById(id);
}

/**
 * Menghapus data tower dan fotonya.
 */
export async function deleteTower(id: number) {
  const [existing] = await db.select().from(masterTowers).where(eq(masterTowers.id, id)).limit(1);
  if (!existing) return false;

  await db.delete(masterTowers).where(eq(masterTowers.id, id));
  return true;
}

/**
 * Menambahkan foto ke galeri tower.
 */
export async function addTowerPhoto(data: {
  towerId: number;
  photoUrl: string;
  caption?: string;
  isCover?: boolean;
  uploadedBy?: number;
}) {
  if (data.isCover) {
    await db.update(masterTowerPhotos).set({ isCover: false }).where(eq(masterTowerPhotos.towerId, data.towerId));
    await db.update(masterTowers).set({ primaryPhotoUrl: data.photoUrl }).where(eq(masterTowers.id, data.towerId));
  }

  const [res] = await db.insert(masterTowerPhotos).values({
    towerId: data.towerId,
    photoUrl: data.photoUrl,
    caption: data.caption || null,
    isCover: Boolean(data.isCover),
    uploadedBy: data.uploadedBy || null
  });

  return res.insertId;
}

/**
 * Menghapus foto dari galeri tower.
 */
export async function deleteTowerPhoto(photoId: number) {
  const [photo] = await db.select().from(masterTowerPhotos).where(eq(masterTowerPhotos.id, photoId)).limit(1);
  if (!photo) return false;

  await db.delete(masterTowerPhotos).where(eq(masterTowerPhotos.id, photoId));

  // Jika foto yang dihapus adalah cover, perbarui primaryPhotoUrl tower
  if (photo.isCover) {
    const [nextPhoto] = await db
      .select()
      .from(masterTowerPhotos)
      .where(eq(masterTowerPhotos.towerId, photo.towerId))
      .limit(1);

    if (nextPhoto) {
      await db.update(masterTowerPhotos).set({ isCover: true }).where(eq(masterTowerPhotos.id, nextPhoto.id));
      await db.update(masterTowers).set({ primaryPhotoUrl: nextPhoto.photoUrl }).where(eq(masterTowers.id, photo.towerId));
    } else {
      await db.update(masterTowers).set({ primaryPhotoUrl: null }).where(eq(masterTowers.id, photo.towerId));
    }
  }

  return true;
}

/**
 * Menjadikan foto tertentu sebagai cover utama tower.
 */
export async function setCoverPhoto(towerId: number, photoId: number) {
  const [photo] = await db.select().from(masterTowerPhotos).where(eq(masterTowerPhotos.id, photoId)).limit(1);
  if (!photo || photo.towerId !== towerId) return false;

  await db.update(masterTowerPhotos).set({ isCover: false }).where(eq(masterTowerPhotos.towerId, towerId));
  await db.update(masterTowerPhotos).set({ isCover: true }).where(eq(masterTowerPhotos.id, photoId));
  await db.update(masterTowers).set({ primaryPhotoUrl: photo.photoUrl }).where(eq(masterTowers.id, towerId));

  return true;
}
