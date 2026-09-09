import { describe, expect, it } from "bun:test";
import { app } from "./setup";

describe("Health API", () => {
  it("menyediakan health check di /health dengan status ok", async () => {
    const response = await app.handle(new Request("http://localhost/health"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", service: "mknsite-api" });
  });
});
