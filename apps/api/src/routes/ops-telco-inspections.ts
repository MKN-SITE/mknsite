import { Elysia, t } from "elysia";
import { getAuthenticatedProfile } from "../auth/auth";
import { opsTelcoInspectionsService } from "../services/ops-telco-inspections.service";
import { existsSync, mkdirSync } from "node:fs";
import { extname, resolve } from "node:path";

export const opsTelcoInspectionRoutes = new Elysia({ prefix: "/ops-telco/inspections" })
  .resolve(async ({ request, status }) => {
    const profile = await getAuthenticatedProfile(request.headers, "employee");
    if (!profile) return status(401, { message: "Sesi karyawan tidak valid." });

    const hasAccess =
      profile.permissions.includes("ops_telco.forms.view") ||
      profile.permissions.includes("ops_telco.forms.manage") ||
      profile.permissions.includes("ops_telco.view") ||
      profile.roles.includes("ops-telco-supervisor") ||
      profile.roles.includes("Supervisor OPS Telco") ||
      profile.roles.includes("administrator") ||
      profile.roles.includes("Administrator") ||
      profile.roles.includes("superadmin") ||
      profile.roles.includes("Superadministrator");

    if (!hasAccess) {
      return status(403, { message: "Akses menu Inspeksi diperlukan." });
    }

    return { profile };
  })

  // 1. Get inspection summary stats
  .get("/stats", async () => {
    const stats = await opsTelcoInspectionsService.getInspectionStats();
    return { success: true, data: stats };
  })

  // 2. List inspections with filters
  .get(
    "/",
    async ({ query }) => {
      const category = query.category || undefined;
      const itemCondition = query.itemCondition || undefined;
      const search = query.search || undefined;
      const startDate = query.startDate || undefined;
      const endDate = query.endDate || undefined;
      const limit = query.limit ? Number(query.limit) : undefined;
      const offset = query.offset ? Number(query.offset) : undefined;

      const data = await opsTelcoInspectionsService.getInspections({
        category,
        itemCondition,
        search,
        startDate,
        endDate,
        limit,
        offset
      });
      return { success: true, data };
    },
    {
      query: t.Object({
        category: t.Optional(t.String()),
        itemCondition: t.Optional(t.String()),
        search: t.Optional(t.String()),
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String())
      })
    }
  )

  // 3. Get single inspection
  .get("/:id", async ({ params, status }) => {
    const id = Number(params.id);
    if (isNaN(id)) return status(400, { message: "ID Inspeksi tidak valid." });

    const data = await opsTelcoInspectionsService.getInspectionById(id);
    if (!data) return status(404, { message: "Data inspeksi tidak ditemukan." });

    return { success: true, data };
  })

  // 4. Create inspection (supports multipart/form-data or application/json)
  .post("/", async ({ request, profile, status }) => {
    const contentType = request.headers.get("content-type") || "";

    try {
      if (contentType.includes("multipart/form-data")) {
        const formData = await request.formData();
        const category = ((formData.get("category") as string) || "tools").toLowerCase().trim();
        const inspectionDate = (formData.get("inspectionDate") as string) || "";
        const itemName = (formData.get("itemName") as string) || "";
        const itemCondition = (formData.get("itemCondition") as string) || "baik";
        const location = (formData.get("location") as string) || "";
        const notes = (formData.get("notes") as string) || "";
        const actionTaken = (formData.get("actionTaken") as string) || "";

        if (!inspectionDate || !itemName.trim()) {
          return status(400, { message: "Tanggal inspeksi dan nama item wajib diisi." });
        }

        const uploadDir = resolve("uploads/inspections");
        if (!existsSync(uploadDir)) {
          mkdirSync(uploadDir, { recursive: true });
        }

        const photoUrls: string[] = [];
        const files = formData.getAll("photos");

        for (const file of files) {
          if (file && typeof file === "object" && "arrayBuffer" in file && (file as Blob).size > 0) {
            const blob = file as Blob & { name?: string };
            const originalExt = blob.name ? extname(blob.name).toLowerCase() : "";
            const safeExt = originalExt || (blob.type.includes("png") ? ".png" : blob.type.includes("webp") ? ".webp" : ".jpg");
            const filename = `inspection-${category}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${safeExt}`;
            const diskPath = resolve(uploadDir, filename);

            const buffer = await blob.arrayBuffer();
            await Bun.write(diskPath, buffer);
            photoUrls.push(`/uploads/inspections/${filename}`);
          }
        }

        const created = await opsTelcoInspectionsService.createInspection(profile.id, {
          category,
          inspectionDate,
          itemName: itemName.trim(),
          itemCondition,
          location: location.trim(),
          notes: notes.trim(),
          actionTaken: actionTaken.trim(),
          photos: photoUrls
        });

        return { success: true, message: "Laporan inspeksi berhasil disimpan.", data: created };
      } else {
        const body = (await request.json().catch(() => ({}))) as any;
        const { category, inspectionDate, itemName, itemCondition, location, notes, actionTaken, photos } = body;

        if (!inspectionDate || !itemName?.trim()) {
          return status(400, { message: "Tanggal inspeksi dan nama item wajib diisi." });
        }

        const created = await opsTelcoInspectionsService.createInspection(profile.id, {
          category: (category || "tools").toLowerCase().trim(),
          inspectionDate,
          itemName: itemName.trim(),
          itemCondition: itemCondition || "baik",
          location: location?.trim(),
          notes: notes?.trim(),
          actionTaken: actionTaken?.trim(),
          photos: Array.isArray(photos) ? photos : []
        });

        return { success: true, message: "Laporan inspeksi berhasil disimpan.", data: created };
      }
    } catch (err: any) {
      console.error("[OPS TELCO INSPECTION] Error creating inspection:", err);
      return status(500, { message: err.message || "Gagal menyimpan laporan inspeksi." });
    }
  })

  // 5. Delete inspection
  .delete("/:id", async ({ params, profile, status }) => {
    const id = Number(params.id);
    if (isNaN(id)) return status(400, { message: "ID Inspeksi tidak valid." });

    const existing = await opsTelcoInspectionsService.getInspectionById(id);
    if (!existing) return status(404, { message: "Data inspeksi tidak ditemukan." });

    const isSupervisorOrAdmin =
      profile.roles.includes("ops-telco-supervisor") ||
      profile.roles.includes("Supervisor OPS Telco") ||
      profile.roles.includes("administrator") ||
      profile.roles.includes("Administrator") ||
      profile.roles.includes("superadmin") ||
      profile.roles.includes("Superadministrator");

    if (existing.inspectedBy !== profile.id && !isSupervisorOrAdmin) {
      return status(403, { message: "Anda tidak memiliki hak untuk menghapus laporan inspeksi ini." });
    }

    try {
      await opsTelcoInspectionsService.deleteInspection(id);
      return { success: true, message: "Laporan inspeksi berhasil dihapus." };
    } catch (err: any) {
      return status(500, { message: err.message || "Gagal menghapus laporan inspeksi." });
    }
  });
