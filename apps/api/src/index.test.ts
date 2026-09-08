import { beforeAll, describe, expect, it } from "bun:test";

let app: typeof import("./index").app;

beforeAll(async () => {
  process.env.DATABASE_URL = "mysql://mknsite:test@localhost:3306/mknsite";
  process.env.BETTER_AUTH_URL = "http://localhost";
  ({ app } = await import("./index"));
});

describe("API", () => {
  it("menyediakan health check", async () => {
    const response = await app.handle(new Request("http://localhost/health"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", service: "mknsite-api" });
  });

  it("menolak modul tanpa sesi", async () => {
    const response = await app.handle(new Request("http://localhost/workspace/hr"));
    expect(response.status).toBe(401);
  });
});
