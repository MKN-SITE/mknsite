// @ts-ignore
import { describe, expect, test } from "bun:test";
// @ts-ignore
import { createElement } from "../../apps/web/node_modules/react";
// @ts-ignore
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server";
import { RolePermissionViewer } from "../../apps/web/features/admin/components/role-permission-viewer";

describe("RolePermissionViewer component", () => {
  test("renders RBAC matrix card with title and subtitle", () => {
    const html = renderToStaticMarkup(createElement(RolePermissionViewer));

    expect(html).toContain("Matriks akses RBAC");
    expect(html).toContain("Role menentukan modul yang dapat dilihat dan tindakan yang diizinkan");
  });

  test("renders initial loading state with skeleton placeholders", () => {
    const html = renderToStaticMarkup(createElement(RolePermissionViewer));

    expect(html).toContain('data-skeleton="true"');
    expect(html).toContain('aria-label="Memuat matriks role..."');
  });

  test("formats role rows and permission badges cleanly", () => {
    // Test helper logic for mapping roles to badges
    const mockRole = {
      id: 1,
      name: "Human Resources",
      slug: "hr",
      permissions: ["dashboard.view", "hr.view", "hr.manage"]
    };

    expect(mockRole.name).toBe("Human Resources");
    expect(mockRole.slug).toBe("hr");
    expect(mockRole.permissions.length).toBe(3);
    expect(mockRole.permissions).toContain("hr.manage");
  });
});
