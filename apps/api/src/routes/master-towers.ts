import { Elysia, t } from "elysia";
import { existsSync, mkdirSync } from "node:fs";
import { extname, resolve } from "node:path";
import { getAuthenticatedProfile } from "../auth/auth";
import {
  addTowerPhoto,
  createTower,
  deleteTower,
  deleteTowerPhoto,
  getTowerById,
  getTowers,
  resolveTowerExcelPath,
  seedTowersFromExcel,
  setCoverPhoto,
  updateTower
} from "../services/master-tower.service";

export const masterTowerRoutes = new Elysia({ prefix: "/master/towers" })
  .resolve(async ({ request }) => {
    let profile = await getAuthenticatedProfile(request.headers, "employee");
    if (!profile) {
      profile = await getAuthenticatedProfile(request.headers, "admin");
    }
    return { profile };
  })

  // 1. Ambil daftar seluruh tower dengan filter & pencarian
  .get(
    "/",
    async ({ query }) => {
      const towers = await getTowers({
        search: query.search || undefined,
        type: query.type || undefined,
        kecamatan: query.kecamatan || undefined,
        status: query.status || undefined,
        sortBy: (query.sortBy as any) || "no",
        sortOrder: (query.sortOrder as any) || "asc"
      });

      return {
        success: true,
        data: towers,
        total: towers.length
      };
    },
    {
      query: t.Object({
        search: t.Optional(t.String()),
        type: t.Optional(t.String()),
        kecamatan: t.Optional(t.String()),
        status: t.Optional(t.String()),
        sortBy: t.Optional(t.String()),
        sortOrder: t.Optional(t.String())
      })
    }
  )

  // 2. Unduh berkas asli template Excel Tower Coordinat1.xls
  .get("/download-excel", async ({ set }) => {
    const filePath = resolveTowerExcelPath();
    if (!filePath || !existsSync(filePath)) {
      return { success: false, message: "Berkas template Excel tidak ditemukan." };
    }

    const file = Bun.file(filePath);
    set.headers["content-type"] = "application/vnd.ms-excel";
    set.headers["content-disposition"] = "attachment; filename=\"Tower Coordinat1.xls\"";
    return file;
  })

  // 3. Sinkronisasi ulang data dari file Excel Master
  .post("/sync-excel", async () => {
    const result = await seedTowersFromExcel();
    return {
      success: result.success,
      message: result.message,
      imported: result.imported
    };
  })

  // 4. Upload berkas Excel baru untuk sinkronisasi massal data menara
  .post("/upload-excel", async ({ request, profile, status }) => {
    if (!profile) return status(401, { message: "Sesi tidak valid." });

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file !== "object" || !("arrayBuffer" in file)) {
      return status(400, { message: "Berkas Excel tidak valid." });
    }

    const blob = file as Blob & { name?: string };
    const buffer = await blob.arrayBuffer();
    const targetPath = resolve("form-templates/Master/Tower Coordinat1.xls");

    const parentDir = resolve("form-templates/Master");
    if (!existsSync(parentDir)) {
      mkdirSync(parentDir, { recursive: true });
    }

    await Bun.write(targetPath, buffer);
    const result = await seedTowersFromExcel(targetPath);

    return {
      success: true,
      message: `Berkas Excel berhasil diunggah dan ${result.imported} data menara berhasil disinkronkan.`,
      imported: result.imported
    };
  })

  // 5. Ambil detail spesifik satu tower beserta galeri foto
  .get("/:id", async ({ params, status }) => {
    const id = Number.parseInt(params.id, 10);
    if (Number.isNaN(id)) return status(400, { message: "ID tower tidak valid." });

    const tower = await getTowerById(id);
    if (!tower) return status(404, { message: "Data menara tidak ditemukan." });

    return { success: true, data: tower };
  })

  // 6. Tambah data tower baru
  .post(
    "/",
    async ({ body, profile, status }) => {
      if (!profile) return status(401, { message: "Sesi tidak valid." });

      const { towerName } = body;
      if (!towerName || !towerName.trim()) {
        return status(400, { message: "Nama menara wajib diisi." });
      }

      const created = await createTower({
        ...body,
        createdBy: profile.id
      });

      return {
        success: true,
        message: "Menara baru berhasil ditambahkan.",
        data: created
      };
    },
    {
      body: t.Object({
        towerName: t.String(),
        towerType: t.Optional(t.String()),
        height: t.Optional(t.String()),
        locationKecamatan: t.Optional(t.String()),
        locationKabupaten: t.Optional(t.String()),
        locationProvince: t.Optional(t.String()),
        latitude: t.Optional(t.String()),
        longitude: t.Optional(t.String()),
        altitude: t.Optional(t.String()),
        operationalStatus: t.Optional(t.String()),
        description: t.Optional(t.String())
      })
    }
  )

  // 7. Perbarui data tower
  .put(
    "/:id",
    async ({ params, body, profile, status }) => {
      if (!profile) return status(401, { message: "Sesi tidak valid." });

      const id = Number.parseInt(params.id, 10);
      if (Number.isNaN(id)) return status(400, { message: "ID tower tidak valid." });

      const updated = await updateTower(id, body);
      if (!updated) return status(404, { message: "Data menara tidak ditemukan." });

      return {
        success: true,
        message: "Data menara berhasil diperbarui.",
        data: updated
      };
    },
    {
      body: t.Object({
        towerName: t.Optional(t.String()),
        towerType: t.Optional(t.String()),
        height: t.Optional(t.String()),
        locationKecamatan: t.Optional(t.String()),
        locationKabupaten: t.Optional(t.String()),
        locationProvince: t.Optional(t.String()),
        latitude: t.Optional(t.String()),
        longitude: t.Optional(t.String()),
        altitude: t.Optional(t.String()),
        operationalStatus: t.Optional(t.String()),
        description: t.Optional(t.String())
      })
    }
  )

  // 8. Hapus data tower
  .delete("/:id", async ({ params, profile, status }) => {
    if (!profile) return status(401, { message: "Sesi tidak valid." });

    const id = Number.parseInt(params.id, 10);
    if (Number.isNaN(id)) return status(400, { message: "ID tower tidak valid." });

    const deleted = await deleteTower(id);
    if (!deleted) return status(404, { message: "Data menara tidak ditemukan." });

    return {
      success: true,
      message: "Data menara berhasil dihapus."
    };
  })

  // 9. Unggah foto dokumentasi tower (multi-part / form-data)
  .post("/:id/photos", async ({ params, request, profile, status }) => {
    if (!profile) return status(401, { message: "Sesi tidak valid." });

    const id = Number.parseInt(params.id, 10);
    if (Number.isNaN(id)) return status(400, { message: "ID tower tidak valid." });

    const tower = await getTowerById(id);
    if (!tower) return status(404, { message: "Data menara tidak ditemukan." });

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return status(400, { message: "Permintaan harus berupa multipart/form-data." });
    }

    const formData = await request.formData();
    const files = formData.getAll("photos");
    const caption = (formData.get("caption") as string) || "";
    const isCoverRequested = formData.get("isCover") === "true";

    if (!files || files.length === 0) {
      return status(400, { message: "Tidak ada berkas foto yang diunggah." });
    }

    const uploadDir = resolve(`uploads/towers/${id}`);
    if (!existsSync(uploadDir)) {
      mkdirSync(uploadDir, { recursive: true });
    }

    const uploadedResults = [];
    let isFirst = tower.photosCount === 0;

    for (const file of files) {
      if (file && typeof file === "object" && "arrayBuffer" in file && (file as Blob).size > 0) {
        const blob = file as Blob & { name?: string };
        const originalExt = blob.name ? extname(blob.name).toLowerCase() : "";
        const safeExt = originalExt || (blob.type.includes("png") ? ".png" : blob.type.includes("webp") ? ".webp" : ".jpg");
        const filename = `tower-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}${safeExt}`;
        const diskPath = resolve(uploadDir, filename);

        const buffer = await blob.arrayBuffer();
        await Bun.write(diskPath, buffer);

        const photoUrl = `/uploads/towers/${id}/${filename}`;
        const shouldBeCover = isFirst || isCoverRequested;
        isFirst = false;

        const photoId = await addTowerPhoto({
          towerId: id,
          photoUrl,
          caption: caption || blob.name || "Foto Dokumentasi Tower",
          isCover: shouldBeCover,
          uploadedBy: profile.id
        });

        uploadedResults.push({ id: photoId, photoUrl });
      }
    }

    const updatedTower = await getTowerById(id);
    return {
      success: true,
      message: `Berhasil mengunggah ${uploadedResults.length} foto.`,
      data: updatedTower
    };
  })

  // 10. Hapus foto dari galeri
  .delete("/:id/photos/:photoId", async ({ params, profile, status }) => {
    if (!profile) return status(401, { message: "Sesi tidak valid." });

    const photoId = Number.parseInt(params.photoId, 10);
    if (Number.isNaN(photoId)) return status(400, { message: "ID foto tidak valid." });

    const deleted = await deleteTowerPhoto(photoId);
    if (!deleted) return status(404, { message: "Foto tidak ditemukan." });

    return { success: true, message: "Foto berhasil dihapus." };
  })

  // 11. Tetapkan foto sebagai sampul utama
  .post("/:id/photos/:photoId/set-cover", async ({ params, profile, status }) => {
    if (!profile) return status(401, { message: "Sesi tidak valid." });

    const towerId = Number.parseInt(params.id, 10);
    const photoId = Number.parseInt(params.photoId, 10);
    if (Number.isNaN(towerId) || Number.isNaN(photoId)) {
      return status(400, { message: "ID tidak valid." });
    }

    const ok = await setCoverPhoto(towerId, photoId);
    if (!ok) return status(404, { message: "Foto tidak ditemukan." });

    return { success: true, message: "Foto sampul berhasil diatur." };
  });
