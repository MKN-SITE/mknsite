import { describe, expect, it } from "bun:test";
import { app } from "./setup";
import { publishAdminUsersUpdated, publishRealtimeEvent } from "../src/realtime/hub";

const decodeChunk = (val: unknown): string =>
  typeof val === "string" ? val : new TextDecoder().decode(val as any);

describe("Realtime SSE API", () => {
  it("menolak GET /realtime/events tanpa sesi dengan HTTP 401", async () => {
    const res = await app.handle(new Request("http://localhost/realtime/events"));
    expect(res.status).toBe(401);
  });

  it("menolak GET /realtime/events?context=admin jika hanya memiliki cookie employee (tanpa fallback) dengan HTTP 401", async () => {
    const loginRes = await app.handle(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "hr@mknsite.online", password: "demo12345" })
      })
    );
    expect(loginRes.status).toBe(200);
    const empCookie = loginRes.headers.get("set-cookie") ?? "";

    const res = await app.handle(
      new Request("http://localhost/realtime/events?context=admin", {
        headers: { Cookie: empCookie }
      })
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { message: string };
    expect(body.message).toContain("Sesi admin tidak valid");
  });

  it("menolak GET /realtime/events?context=employee jika hanya memiliki cookie admin (tanpa fallback) dengan HTTP 401", async () => {
    const loginRes = await app.handle(
      new Request("http://localhost/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "admin@mknsite.online", password: "admin12345" })
      })
    );
    expect(loginRes.status).toBe(200);
    const adminCookie = loginRes.headers.get("set-cookie") ?? "";

    const res = await app.handle(
      new Request("http://localhost/realtime/events?context=employee", {
        headers: { Cookie: adminCookie }
      })
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { message: string };
    expect(body.message).toContain("Sesi employee tidak valid");
  });

  it("berhasil membuka koneksi stream dengan cookie employee pada ?context=employee dan menerima event connected", async () => {
    const loginRes = await app.handle(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "hr@mknsite.online", password: "demo12345" })
      })
    );
    const empCookie = loginRes.headers.get("set-cookie") ?? "";

    const res = await app.handle(
      new Request("http://localhost/realtime/events?context=employee", {
        headers: { Cookie: empCookie }
      })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    const reader = res.body?.getReader();
    expect(reader).toBeDefined();

    const chunk = await reader!.read();
    const text = decodeChunk(chunk.value);
    expect(text).toContain("event: connected");
    expect(text).toContain("occurredAt");

    await reader!.cancel();
  });

  it("berhasil membuka koneksi stream dengan cookie admin pada ?context=admin dan menerima event connected", async () => {
    const loginRes = await app.handle(
      new Request("http://localhost/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "admin@mknsite.online", password: "admin12345" })
      })
    );
    const adminCookie = loginRes.headers.get("set-cookie") ?? "";

    const res = await app.handle(
      new Request("http://localhost/realtime/events?context=admin", {
        headers: { Cookie: adminCookie }
      })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    const reader = res.body?.getReader();
    expect(reader).toBeDefined();

    const chunk = await reader!.read();
    const text = decodeChunk(chunk.value);
    expect(text).toContain("event: connected");

    await reader!.cancel();
  });

  it("mengirimkan event admin.users.updated ke admin subscriber saat terjadi mutasi pengguna", async () => {
    const loginRes = await app.handle(
      new Request("http://localhost/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "admin@mknsite.online", password: "admin12345" })
      })
    );
    const adminCookie = loginRes.headers.get("set-cookie") ?? "";

    const res = await app.handle(
      new Request("http://localhost/realtime/events?context=admin", {
        headers: { Cookie: adminCookie }
      })
    );
    expect(res.status).toBe(200);

    const reader = res.body?.getReader();
    // 1. Baca initial connected event
    await reader!.read();

    // 2. Trigger admin.users.updated
    publishAdminUsersUpdated(999);

    // 3. Baca chunk berikutnya
    const chunk = await reader!.read();
    const text = decodeChunk(chunk.value);
    expect(text).toContain("event: admin.users.updated");
    expect(text).toContain('"userId":999');

    await reader!.cancel();
  });

  it("tidak membroadcast event admin.users.updated ke employee subscriber", async () => {
    const loginRes = await app.handle(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "hr@mknsite.online", password: "demo12345" })
      })
    );
    const empCookie = loginRes.headers.get("set-cookie") ?? "";

    const res = await app.handle(
      new Request("http://localhost/realtime/events?context=employee", {
        headers: { Cookie: empCookie }
      })
    );
    const reader = res.body?.getReader();
    const meRes = await app.handle(new Request("http://localhost/auth/me", { headers: { Cookie: empCookie } }));
    const meBody = (await meRes.json()) as any;
    const hrUserId = meBody.user.id;

    // Baca initial connected event
    await reader!.read();

    // Broadcast admin.users.updated
    publishAdminUsersUpdated(888);

    // Kirim event khusus employee untuk memastikan stream tetap hidup
    publishRealtimeEvent(hrUserId, { type: "access.updated", message: "Tes akses employee" });

    const chunk = await reader!.read();
    const text = decodeChunk(chunk.value);

    // Harus menerima access.updated dan TIDAK memuat admin.users.updated
    expect(text).toContain("event: access.updated");
    expect(text).not.toContain("admin.users.updated");

    await reader!.cancel();
  });

  it("memutus koneksi dan mengirimkan session.revoked saat sesi dicabut", async () => {
    const loginRes = await app.handle(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "hr@mknsite.online", password: "demo12345" })
      })
    );
    const empCookie = loginRes.headers.get("set-cookie") ?? "";

    const meRes = await app.handle(new Request("http://localhost/auth/me", { headers: { Cookie: empCookie } }));
    const meBody = (await meRes.json()) as any;
    const hrUserId = meBody.user.id;

    const res = await app.handle(
      new Request("http://localhost/realtime/events?context=employee", {
        headers: { Cookie: empCookie }
      })
    );
    const reader = res.body?.getReader();
    await reader!.read(); // event: connected

    // Kirim session.revoked
    publishRealtimeEvent(hrUserId, { type: "session.revoked", message: "Sesi dicabut oleh admin" });

    const chunk = await reader!.read();
    const text = decodeChunk(chunk.value);
    expect(text).toContain("event: session.revoked");
    expect(text).toContain("Sesi dicabut oleh admin");

    // Generator harus langsung selesai (done: true)
    const nextChunk = await reader!.read();
    expect(nextChunk.done).toBe(true);
  });
});
