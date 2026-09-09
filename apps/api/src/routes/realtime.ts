import { Elysia, t } from "elysia";
import { getAuthenticatedProfile } from "../auth/auth";
import { userEventStream } from "../realtime/hub";

export const realtimeRoutes = new Elysia({ prefix: "/realtime" })
  .get("/events", async ({ query, request, status }) => {
    const context = query.context ?? "employee";
    const user = await getAuthenticatedProfile(request.headers, context);
    if (!user) {
      return status(401, { message: `Sesi ${context} tidak valid untuk koneksi realtime.` });
    }

    if (context === "admin" && !user.permissions.includes("admin.manage")) {
      return status(403, { message: "Akun admin tidak memiliki hak akses admin.manage." });
    }

    return userEventStream(user.id, context, request.headers);
  }, {
    query: t.Object({
      context: t.Optional(
        t.Union([t.Literal("employee"), t.Literal("admin")], {
          default: "employee",
          description: "Konteks sesi SSE (employee atau admin, default employee)"
        })
      )
    }),
    detail: {
      summary: "Stream Event Realtime (SSE)",
      description: "Membuka koneksi streaming Server-Sent Events (SSE) dengan format text/event-stream untuk menerima pembaruan hak akses, status pengguna, atau pencabutan sesi secara langsung.",
      tags: ["Realtime"],
      operationId: "getRealtimeEvents",
      security: [{ employeeSession: [] }, { adminSession: [] }],
      responses: {
        200: {
          description: "Koneksi stream SSE berhasil dibuka",
          content: {
            "text/event-stream": {
              schema: {
                type: "string",
                example: "event: connected\ndata: {\"occurredAt\":\"2026-09-09T04:18:45.125Z\"}\n\n"
              }
            }
          }
        },
        401: {
          description: "Sesi untuk konteks yang diminta tidak valid",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } }
        },
        403: {
          description: "Akun tidak memiliki izin yang sesuai",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ForbiddenError" } } }
        }
      }
    }
  });
