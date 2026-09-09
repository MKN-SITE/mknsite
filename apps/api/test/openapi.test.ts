import { describe, expect, it } from "bun:test";
import { app } from "./setup";

describe("OpenAPI & Docs API", () => {
  it("menyediakan Swagger UI di /docs pada environment non-production", async () => {
    const response = await app.handle(new Request("http://localhost/docs"));
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("swagger-ui");
  });

  it("menyediakan spesifikasi OpenAPI JSON di /docs/json dengan skema lengkap", async () => {
    const response = await app.handle(new Request("http://localhost/docs/json"));
    expect(response.status).toBe(200);
    const spec = (await response.json()) as {
      openapi: string;
      info: { title: string };
      paths: Record<string, Record<string, { operationId?: string; summary?: string }>>;
      components: {
        securitySchemes: Record<string, { type: string; in: string; name: string }>;
        schemas: Record<string, unknown>;
      };
    };
    expect(spec.openapi.startsWith("3.")).toBe(true);
    expect(spec.info.title).toBe("MKN Site API");

    // Verifikasi security schemes
    expect(spec.components.securitySchemes.employeeSession).toBeDefined();
    expect(spec.components.securitySchemes.employeeSession.name).toBe("mkn_employee.session_token");
    expect(spec.components.securitySchemes.adminSession).toBeDefined();
    expect(spec.components.securitySchemes.adminSession.name).toBe("mkn_admin.session_token");

    // Verifikasi komponen schemas
    expect(spec.components.schemas.ErrorResponse).toBeDefined();
    expect(spec.components.schemas.HealthResponse).toBeDefined();
    expect(spec.components.schemas.UserProfileResponse).toBeDefined();
    expect(spec.components.schemas.BetterAuthLoginResponse).toBeDefined();
    expect(spec.components.schemas.UserSummary).toBeDefined();
    expect(spec.components.schemas.UserListResponse).toBeDefined();
    expect(spec.components.schemas.UserDetailResponse).toBeDefined();
    expect(spec.components.schemas.RoleListResponse).toBeDefined();

    // Verifikasi 6 komponen error umum (400, 401, 403, 404, 422, 500)
    expect(spec.components.schemas.BadRequestError).toBeDefined();
    expect(spec.components.schemas.UnauthorizedError).toBeDefined();
    expect(spec.components.schemas.ForbiddenError).toBeDefined();
    expect(spec.components.schemas.NotFoundError).toBeDefined();
    expect(spec.components.schemas.ValidationError).toBeDefined();
    expect(spec.components.schemas.InternalServerError).toBeDefined();

    // Verifikasi seluruh paths utama dan operationId unik
    const operationIds = new Set<string>();
    for (const [, methods] of Object.entries(spec.paths)) {
      for (const [, op] of Object.entries(methods)) {
        expect(op.operationId).toBeDefined();
        expect(op.summary).toBeDefined();
        expect(operationIds.has(op.operationId!)).toBe(false);
        operationIds.add(op.operationId!);
      }
    }
    expect(operationIds.size).toBeGreaterThanOrEqual(14);
  });
});
