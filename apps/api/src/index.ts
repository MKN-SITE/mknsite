import "dotenv/config";
import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { adminAuth, employeeAuth } from "./lib/auth";
import { adminRoutes } from "./routes/admin";
import { authRoutes } from "./routes/auth";
import { realtimeRoutes } from "./routes/realtime";
import { workspaceRoutes } from "./routes/workspace";

const origin = process.env.APP_ORIGIN ?? "http://localhost:3000";
const port = Number(process.env.PORT ?? 3001);

export const app = new Elysia()
  .use(cors({ origin, credentials: true, allowedHeaders: ["Content-Type"], methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"] }))
  .get("/health", () => ({ status: "ok", service: "mknsite-api" }))
  .mount(employeeAuth.handler)
  .mount(adminAuth.handler)
  .use(authRoutes)
  .use(adminRoutes)
  .use(realtimeRoutes)
  .use(workspaceRoutes);

if (import.meta.main) {
  app.listen({ port, hostname: "0.0.0.0" });
  console.log(`MKN Site API berjalan di http://0.0.0.0:${app.server?.port}`);
}

export type App = typeof app;
