import { Elysia, t } from "elysia";
import { getAuthenticatedProfile } from "../auth/auth";
import { contractService } from "../services/contract.service";

export const personalRoutes = new Elysia({ prefix: "/personal" })
  .get("/", async ({ request, status }) => {
    const profile =
      (await getAuthenticatedProfile(request.headers, "employee")) ||
      (await getAuthenticatedProfile(request.headers, "admin"));

    if (!profile) {
      return status(401, { message: "Sesi tidak valid atau telah berakhir." });
    }

    try {
      const data = await contractService.getPersonalProfileAndContracts(profile.id);
      return {
        success: true,
        data
      };
    } catch (error: any) {
      return status(500, {
        success: false,
        message: error.message || "Gagal mengambil data personal dan kontrak."
      });
    }
  })
  .put(
    "/profile",
    async ({ request, body, status }) => {
      const profile =
        (await getAuthenticatedProfile(request.headers, "employee")) ||
        (await getAuthenticatedProfile(request.headers, "admin"));

      if (!profile) {
        return status(401, { message: "Sesi tidak valid." });
      }

      try {
        const updated = await contractService.updateProfile(profile.id, body);
        return {
          success: true,
          message: "Data diri personal berhasil diperbarui.",
          data: updated
        };
      } catch (error: any) {
        return status(400, {
          success: false,
          message: error.message || "Gagal memperbarui data profil."
        });
      }
    },
    {
      body: t.Object({
        name: t.Optional(t.String()),
        username: t.Optional(t.Nullable(t.String())),
        phone: t.Optional(t.Nullable(t.String())),
        startDate: t.Optional(t.Nullable(t.String())),
        division: t.Optional(t.Nullable(t.String())),
        kpcId: t.Optional(t.Nullable(t.String()))
      })
    }
  )
  .post(
    "/change-password",
    async ({ request, body, status }) => {
      const profile =
        (await getAuthenticatedProfile(request.headers, "employee")) ||
        (await getAuthenticatedProfile(request.headers, "admin"));

      if (!profile) {
        return status(401, { message: "Sesi tidak valid." });
      }

      try {
        const res = await contractService.changePassword(
          profile.id,
          body.currentPassword,
          body.newPassword
        );
        return res;
      } catch (error: any) {
        return status(400, {
          success: false,
          message: error.message || "Gagal mengubah kata sandi."
        });
      }
    },
    {
      body: t.Object({
        currentPassword: t.String(),
        newPassword: t.String()
      })
    }
  )
  .post(
    "/contracts",
    async ({ request, body, status }) => {
      const profile =
        (await getAuthenticatedProfile(request.headers, "employee")) ||
        (await getAuthenticatedProfile(request.headers, "admin"));

      if (!profile) {
        return status(401, { message: "Sesi tidak valid." });
      }

      try {
        const updated = await contractService.createContract(profile.id, body);
        return {
          success: true,
          message: "Periode kontrak baru berhasil ditambahkan.",
          data: updated
        };
      } catch (error: any) {
        return status(400, {
          success: false,
          message: error.message || "Gagal menambahkan periode kontrak."
        });
      }
    },
    {
      body: t.Object({
        contractNumber: t.String(),
        sequenceNumber: t.Optional(t.Number()),
        contractType: t.Optional(t.String()),
        startDate: t.String(),
        endDate: t.String(),
        status: t.Optional(t.String()),
        position: t.Optional(t.Nullable(t.String())),
        notes: t.Optional(t.Nullable(t.String()))
      })
    }
  )
  .put(
    "/contracts/:id",
    async ({ request, params, body, status }) => {
      const profile =
        (await getAuthenticatedProfile(request.headers, "employee")) ||
        (await getAuthenticatedProfile(request.headers, "admin"));

      if (!profile) {
        return status(401, { message: "Sesi tidak valid." });
      }

      try {
        const updated = await contractService.updateContract(
          profile.id,
          Number(params.id),
          body
        );
        return {
          success: true,
          message: "Data periode kontrak berhasil diperbarui.",
          data: updated
        };
      } catch (error: any) {
        return status(400, {
          success: false,
          message: error.message || "Gagal memperbarui data kontrak."
        });
      }
    },
    {
      params: t.Object({
        id: t.Numeric()
      }),
      body: t.Object({
        contractNumber: t.Optional(t.String()),
        sequenceNumber: t.Optional(t.Number()),
        contractType: t.Optional(t.String()),
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
        status: t.Optional(t.String()),
        position: t.Optional(t.Nullable(t.String())),
        notes: t.Optional(t.Nullable(t.String()))
      })
    }
  )
  .delete(
    "/contracts/:id",
    async ({ request, params, status }) => {
      const profile =
        (await getAuthenticatedProfile(request.headers, "employee")) ||
        (await getAuthenticatedProfile(request.headers, "admin"));

      if (!profile) {
        return status(401, { message: "Sesi tidak valid." });
      }

      try {
        const updated = await contractService.deleteContract(
          profile.id,
          Number(params.id)
        );
        return {
          success: true,
          message: "Periode kontrak berhasil dihapus.",
          data: updated
        };
      } catch (error: any) {
        return status(400, {
          success: false,
          message: error.message || "Gagal menghapus periode kontrak."
        });
      }
    },
    {
      params: t.Object({
        id: t.Numeric()
      })
    }
  )
  .post("/check-reminders", async ({ request, status }) => {
    const profile =
      (await getAuthenticatedProfile(request.headers, "employee")) ||
      (await getAuthenticatedProfile(request.headers, "admin"));

    if (!profile) {
      return status(401, { message: "Sesi tidak valid." });
    }

    try {
      const result = await contractService.checkAndSendContractExpiryReminders();
      return {
        success: true,
        message: `Pengecekan selesai. ${result.remindersSent} email pengingat berhasil dikirim dari ${result.processed} kontrak yang mendekati jatuh tempo.`,
        data: result
      };
    } catch (error: any) {
      return status(500, {
        success: false,
        message: error.message || "Gagal memproses pengingat kontrak."
      });
    }
  })
  .post("/test-reminder", async ({ request, status }) => {
    const profile =
      (await getAuthenticatedProfile(request.headers, "employee")) ||
      (await getAuthenticatedProfile(request.headers, "admin"));

    if (!profile) {
      return status(401, { message: "Sesi tidak valid." });
    }

    try {
      const result = await contractService.sendTestReminder(profile.id);
      return result;
    } catch (error: any) {
      return status(400, {
        success: false,
        message: error.message || "Gagal mengirimkan uji pengingat email kontrak."
      });
    }
  });
