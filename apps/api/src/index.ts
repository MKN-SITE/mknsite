import "dotenv/config";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { Elysia } from "elysia";
import { adminAuth, employeeAuth } from "./auth/auth";
import { config } from "./config/env";
import { openApiSchemas, openApiSecuritySchemes, openApiTags } from "./config/openapi";
import { adminRoutes } from "./routes/admin";
import { authRoutes } from "./routes/auth";
import { realtimeRoutes } from "./routes/realtime";
import { workspaceRoutes } from "./routes/workspace";

export const createServer = (options: { enableSwagger?: boolean } = {}) => {
  const isSwaggerEnabled = options.enableSwagger ?? config.enableSwagger;

  return new Elysia()
    .use(
      cors({
        origin: config.allowedOrigins as any,
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization", "Cookie", "Accept", "X-Requested-With"],
        methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"]
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
    .mount(employeeAuth.handler)
    .mount(adminAuth.handler)
    .use(authRoutes)
    .use(adminRoutes)
    .use(realtimeRoutes)
    .use(workspaceRoutes);
};

export const app = createServer();

if (import.meta.main) {
  app.listen({ port: config.port, hostname: "0.0.0.0" });
  console.log(`MKN Site API berjalan di http://0.0.0.0:${app.server?.port}`);
}

export type App = typeof app;
