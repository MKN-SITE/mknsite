import { describe, expect, it } from "bun:test";
import { app } from "./setup";

describe("Auth & Workspace API", () => {
  it("menolak akses modul workspace tanpa sesi dengan HTTP 401", async () => {
    const response = await app.handle(new Request("http://localhost/workspace/hr"));
    expect(response.status).toBe(401);
  });

  it("mengizinkan login karyawan dan akses /auth/me dengan cookie sesi", async () => {
    const loginRes = await app.handle(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "hr@mknsite.online", password: "demo12345" })
      })
    );
    expect(loginRes.status).toBe(200);
    const cookie = loginRes.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("mkn_employee.session_token=");

    const meRes = await app.handle(
      new Request("http://localhost/auth/me", {
        headers: { Cookie: cookie }
      })
    );
    expect(meRes.status).toBe(200);
    const meBody = (await meRes.json()) as { user: { email: string; roles: string[]; permissions: string[] } };
    expect(meBody.user.email).toBe("hr@mknsite.online");
    expect(meBody.user.roles).toContain("HR");
    expect(meBody.user.permissions).toContain("hr.view");
  });
});
