import { Elysia } from "elysia";
import { getAuthenticatedProfile } from "../lib/auth";
import { userEventStream } from "../lib/realtime";

export const realtimeRoutes = new Elysia({ prefix: "/realtime" })
  .get("/events", async ({ request, status }) => {
    const employee = await getAuthenticatedProfile(request.headers, "employee");
    const admin = employee ? null : await getAuthenticatedProfile(request.headers, "admin");
    const user = employee ?? admin;
    if (!user) return status(401, { message: "Sesi tidak valid untuk koneksi realtime." });
    return userEventStream(user.id);
  });
