import { Elysia, t } from "elysia";
import { authorizeAdmin } from "../guards/admin.guard";
import { DivisionServiceError, divisionService } from "../services/division.service";

const idParams = t.Object({ id: t.Numeric({ minimum: 1, description: "ID Divisi" }) });

const CreateDivisionBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 100, description: "Nama divisi" }),
  description: t.Optional(t.Nullable(t.String({ maxLength: 255, description: "Deskripsi divisi" })))
});

const UpdateDivisionBody = t.Object({
  name: t.Optional(t.String({ minLength: 1, maxLength: 100, description: "Nama divisi" })),
  description: t.Optional(t.Nullable(t.String({ maxLength: 255, description: "Deskripsi divisi" })))
});

const detail = (operationId: string, summary: string, mutation = false) => ({
  summary,
  description: mutation
    ? "Operasi mutasi divisi; memerlukan sesi administrator dengan izin admin.manage dan dicatat dalam audit log."
    : "Memerlukan sesi administrator dengan izin admin.manage.",
  tags: ["Admin Division"],
  operationId,
  security: [{ adminSession: [] }]
});

export const divisionRoutes = new Elysia({ prefix: "/admin/divisions" })
  .get("/", async ({ request, status }) => {
    const auth = await authorizeAdmin(request);
    if (!auth.success) return status(auth.failure.status, auth.failure.error);

    try {
      const data = await divisionService.getDivisions();
      return { data };
    } catch (err: any) {
      return status(500, { code: "INTERNAL_ERROR", message: err?.message ?? "Gagal memuat divisi." });
    }
  }, { detail: detail("getAdminDivisions", "Daftar divisi organisasi") })
  .post("/", async ({ request, body, status }) => {
    const auth = await authorizeAdmin(request);
    if (!auth.success) return status(auth.failure.status, auth.failure.error);

    try {
      const ip = request.headers.get("x-forwarded-for") ?? undefined;
      const data = await divisionService.createDivision(body, auth.admin.id, ip);
      return status(201, { data });
    } catch (err: any) {
      if (err instanceof DivisionServiceError) {
        return status(err.statusCode, { code: err.code, message: err.message });
      }
      return status(500, { code: "INTERNAL_ERROR", message: err?.message ?? "Gagal membuat divisi." });
    }
  }, { body: CreateDivisionBody, detail: detail("createAdminDivision", "Buat divisi baru", true) })
  .patch("/:id", async ({ request, params, body, status }) => {
    const auth = await authorizeAdmin(request);
    if (!auth.success) return status(auth.failure.status, auth.failure.error);

    try {
      const ip = request.headers.get("x-forwarded-for") ?? undefined;
      const data = await divisionService.updateDivision(Number(params.id), body, auth.admin.id, ip);
      return { data };
    } catch (err: any) {
      if (err instanceof DivisionServiceError) {
        return status(err.statusCode, { code: err.code, message: err.message });
      }
      return status(500, { code: "INTERNAL_ERROR", message: err?.message ?? "Gagal memperbarui divisi." });
    }
  }, { params: idParams, body: UpdateDivisionBody, detail: detail("updateAdminDivision", "Perbarui divisi", true) })
  .delete("/:id", async ({ request, params, status }) => {
    const auth = await authorizeAdmin(request);
    if (!auth.success) return status(auth.failure.status, auth.failure.error);

    try {
      const ip = request.headers.get("x-forwarded-for") ?? undefined;
      await divisionService.deleteDivision(Number(params.id), auth.admin.id, ip);
      return { success: true, message: "Divisi berhasil dihapus." };
    } catch (err: any) {
      if (err instanceof DivisionServiceError) {
        return status(err.statusCode, { code: err.code, message: err.message });
      }
      return status(500, { code: "INTERNAL_ERROR", message: err?.message ?? "Gagal menghapus divisi." });
    }
  }, { params: idParams, detail: detail("deleteAdminDivision", "Hapus divisi", true) });
