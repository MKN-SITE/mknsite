import { Elysia, t } from "elysia";
import { getAuthenticatedProfile } from "../auth/auth";
import { opsTelcoHandoversService } from "../services/ops-telco-handovers.service";
import { existsSync, mkdirSync } from "node:fs";
import { extname, resolve } from "node:path";

export const opsTelcoHandoverRoutes = new Elysia({ prefix: "/ops-telco/handovers" })
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
      return status(403, { message: "Akses menu Laporan Serah Terima diperlukan." });
    }

    return { profile };
  })

  // 1. List handovers
  .get(
    "/",
    async ({ query }) => {
      const search = query.search || undefined;
      const startDate = query.startDate || undefined;
      const endDate = query.endDate || undefined;
      const limit = query.limit ? Number(query.limit) : undefined;
      const offset = query.offset ? Number(query.offset) : undefined;

      const data = await opsTelcoHandoversService.getHandovers({ search, startDate, endDate, limit, offset });
      return { success: true, data };
    },
    {
      query: t.Object({
        search: t.Optional(t.String()),
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String())
      })
    }
  )

  // 2. Get single handover
  .get("/:id", async ({ params, status }) => {
    const id = Number(params.id);
    if (isNaN(id)) return status(400, { message: "ID Serah Terima tidak valid." });

    const data = await opsTelcoHandoversService.getHandoverById(id);
    if (!data) return status(404, { message: "Data serah terima tidak ditemukan." });

    return { success: true, data };
  })

  // 3. Create handover (supports multipart/form-data or application/json)
  .post("/", async ({ request, profile, status }) => {
    const contentType = request.headers.get("content-type") || "";

    try {
      if (contentType.includes("multipart/form-data")) {
        const formData = await request.formData();
        const handoverDate = (formData.get("handoverDate") as string) || "";
        const description = (formData.get("description") as string) || "";

        if (!handoverDate || !description.trim()) {
          return status(400, { message: "Tanggal serah terima dan keterangan wajib diisi." });
        }

        const uploadDir = resolve("uploads/handovers");
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
            const filename = `handover-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${safeExt}`;
            const diskPath = resolve(uploadDir, filename);

            const buffer = await blob.arrayBuffer();
            await Bun.write(diskPath, buffer);
            photoUrls.push(`/uploads/handovers/${filename}`);
          }
        }

        const created = await opsTelcoHandoversService.createHandover(profile.id, {
          handoverDate,
          description: description.trim(),
          photos: photoUrls
        });

        return { success: true, message: "Laporan serah terima berhasil disimpan.", data: created };
      } else {
        const body = (await request.json().catch(() => ({}))) as any;
        const { handoverDate, description, photos } = body;

        if (!handoverDate || !description?.trim()) {
          return status(400, { message: "Tanggal serah terima dan keterangan wajib diisi." });
        }

        const created = await opsTelcoHandoversService.createHandover(profile.id, {
          handoverDate,
          description: description.trim(),
          photos: Array.isArray(photos) ? photos : []
        });

        return { success: true, message: "Laporan serah terima berhasil disimpan.", data: created };
      }
    } catch (err: any) {
      console.error("[OPS TELCO HANDOVER] Error creating handover:", err);
      return status(500, { message: err.message || "Gagal menyimpan laporan serah terima." });
    }
  })

  // 4. Delete handover
  .delete("/:id", async ({ params, profile, status }) => {
    const id = Number(params.id);
    if (isNaN(id)) return status(400, { message: "ID Serah Terima tidak valid." });

    const existing = await opsTelcoHandoversService.getHandoverById(id);
    if (!existing) return status(404, { message: "Data serah terima tidak ditemukan." });

    const isSupervisorOrAdmin =
      profile.roles.includes("ops-telco-supervisor") ||
      profile.roles.includes("Supervisor OPS Telco") ||
      profile.roles.includes("administrator") ||
      profile.roles.includes("Administrator") ||
      profile.roles.includes("superadmin") ||
      profile.roles.includes("Superadministrator");

    if (existing.createdBy !== profile.id && !isSupervisorOrAdmin) {
      return status(403, { message: "Anda tidak memiliki hak untuk menghapus laporan ini." });
    }

    try {
      await opsTelcoHandoversService.deleteHandover(id);
      return { success: true, message: "Laporan serah terima berhasil dihapus." };
    } catch (err: any) {
      return status(500, { message: err.message || "Gagal menghapus laporan serah terima." });
    }
  });
