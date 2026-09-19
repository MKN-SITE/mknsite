import "dotenv/config";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { Elysia } from "elysia";
import { adminAuth, employeeAuth } from "./auth/auth";
import { config } from "./config/env";
import { openApiSchemas, openApiSecuritySchemes, openApiTags } from "./config/openapi";
import { adminRoutes } from "./routes/admin";
import { authRoutes } from "./routes/auth";
import { opsTelcoFormRoutes } from "./routes/ops-telco-forms";
import { oncallJobRoutes } from "./routes/oncall-jobs";
import { overtimeJobRoutes } from "./routes/overtime-jobs";
import { cutiJobRoutes } from "./routes/cuti-jobs";
import { ikSopRoutes } from "./routes/ik-sop";
import { menuRoutes } from "./routes/menu";
import { realtimeRoutes } from "./routes/realtime";
import { rbacRoutes } from "./routes/rbac";
import { divisionRoutes } from "./routes/division";
import { workspaceRoutes } from "./routes/workspace";
import { ptoFormRoutes } from "./routes/pto-forms";
import { oncallScheduleRoutes } from "./routes/oncall-schedules";
import { personalRoutes } from "./routes/personal";
import { kpiReportRoutes } from "./routes/kpi-report";
import { opsTelcoRfoRoutes } from "./routes/ops-telco-rfo";
import { opsTelcoHandoverRoutes } from "./routes/ops-telco-handovers";
import { opsTelcoInspectionRoutes } from "./routes/ops-telco-inspections";
import { opsTelcoJsaRoutes } from "./routes/ops-telco-jsa";
import { masterTowerRoutes } from "./routes/master-towers";
import { lvMknRoutes } from "./routes/lv-mkn";
import { safetyRoutes } from "./routes/safety";
import { lt } from "drizzle-orm";
import { db } from "./db";
import { authSessions } from "./db/schema";
import { ensureDefaultUsersAndCrews } from "./services/oncall-schedule.service";
import { contractService } from "./services/contract.service";

async function purgeExpiredSessions() {
  try {
    await db.delete(authSessions).where(lt(authSessions.expiresAt, new Date()));
  } catch (err) {
    console.error("[CLEANUP] Gagal membersihkan sesi kedaluwarsa:", err);
  }
}

export const createServer = (options: { enableSwagger?: boolean } = {}) => {
  const isSwaggerEnabled = options.enableSwagger ?? config.enableSwagger;

  return new Elysia()
    .use(
      cors({
        origin: config.isProduction ? (config.allowedOrigins as any) : true,
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization", "Cookie", "Accept", "X-Requested-With"],
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
      })
    )
    .use(
      isSwaggerEnabled
        ? swagger({
            provider: config.docsProvider,
            path: "/docs",
            documentation: {
              info: {
                title: "MKN Site API",
                version: "1.0.0",
                description: "Dokumentasi API MKN Site dengan OpenAPI dan Swagger UI."
              },
              tags: openApiTags,
              components: {
                securitySchemes: openApiSecuritySchemes as any,
                schemas: openApiSchemas as any
              }
            }
          })
        : (a) => a
    )
    .get("/health", () => ({ status: "ok", service: "mknsite-api" }), {
      detail: {
        summary: "Health Check API",
        description: "Memeriksa status ketersediaan proses service backend MKN Site.",
        tags: ["Health"],
        operationId: "getHealth",
        responses: {
          200: {
            description: "Service berjalan normal",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HealthResponse" }
              }
            }
          }
        }
      }
    })
    .get("/uploads/*", async ({ params, set }) => {
      const relativePath = (params as Record<string, string>)["*"];
      if (!relativePath || relativePath.includes("..")) {
        set.status = 400;
        return "Invalid path";
      }
      // Folder signatures adalah private — hanya dapat diakses melalui endpoint terautentikasi
      if (relativePath.startsWith("signatures/") || relativePath.startsWith("signatures\\")) {
        set.status = 403;
        return "Forbidden";
      }
      const file = Bun.file(`uploads/${relativePath}`);
      if (!(await file.exists())) {
        set.status = 404;
        return "File not found";
      }
      set.headers["Cache-Control"] = "public, max-age=31536000, immutable";
      return file;
    })
    .mount(employeeAuth.handler)
    .mount(adminAuth.handler)
    .use(authRoutes)
    .use(adminRoutes)
    .use(rbacRoutes)
    .use(divisionRoutes)
    .use(realtimeRoutes)
    .use(workspaceRoutes)
    .use(opsTelcoFormRoutes)
    .use(oncallJobRoutes)
    .use(overtimeJobRoutes)
    .use(cutiJobRoutes)
    .use(ikSopRoutes)
    .use(ptoFormRoutes)
    .use(oncallScheduleRoutes)
    .use(personalRoutes)
    .use(kpiReportRoutes)
    .use(opsTelcoRfoRoutes)
    .use(opsTelcoHandoverRoutes)
    .use(opsTelcoInspectionRoutes)
    .use(opsTelcoJsaRoutes)
    .use(masterTowerRoutes)
    .use(lvMknRoutes)
    .use(safetyRoutes)
    .use(menuRoutes);
};

export const app = createServer();

if (import.meta.main) {
  // Ensure default users and crews once on startup
  ensureDefaultUsersAndCrews().catch((err) => {
    console.error("[STARTUP] Gagal inisialisasi default users & crews:", err);
  });

  // Check contract expiry reminders on startup and daily (≤ 30 days)
  contractService.checkAndSendContractExpiryReminders().catch((err) => {
    console.error("[STARTUP] Gagal memeriksa pengingat kontrak:", err);
  });
  const contractReminderInterval = setInterval(() => {
    contractService.checkAndSendContractExpiryReminders().catch((err) => {
      console.error("[REMINDER] Gagal memeriksa pengingat kontrak berkala:", err);
    });
  }, 24 * 60 * 60 * 1000);
  if (typeof contractReminderInterval.unref === "function") {
    contractReminderInterval.unref();
  }

  // Purge expired sessions on startup and daily
  purgeExpiredSessions();
  const purgeInterval = setInterval(purgeExpiredSessions, 24 * 60 * 60 * 1000);
  if (typeof purgeInterval.unref === "function") {
    purgeInterval.unref();
  }

  app.listen({ port: config.port, hostname: "0.0.0.0" });
  console.log(`MKN Site API berjalan di http://0.0.0.0:${app.server?.port}`);
}

export type App = typeof app;
