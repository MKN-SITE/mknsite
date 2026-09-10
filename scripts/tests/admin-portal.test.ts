// @ts-ignore Bun is provided by the repository runtime.
import { describe, expect, test } from "bun:test";
// @ts-ignore React resolves from the web workspace.
import { createElement } from "../../apps/web/node_modules/react";
// @ts-ignore React DOM resolves from the web workspace.
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server";
import { AdminPortalHome, UserManagementNav } from "../../apps/web/features/admin/components/admin-portal";
import { getPermissionUsage } from "../../apps/web/features/admin/lib/permission-usage";
import { RolePermissionViewer } from "../../apps/web/features/admin/components/role-permission-viewer";

describe("Admin portal navigation", () => {
  test("groups users, roles and permissions behind one portal category and preserves other admin entries", () => {
    const html = renderToStaticMarkup(createElement(AdminPortalHome));
    const links = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
    expect(links).toEqual(["/admin/user-management/users", "/admin/menus", "/admin/settings"]);
    expect(html).toContain("User Management");
    expect(html).toContain("Pengguna");
    expect(html).toContain("Role");
    expect(html).toContain("Izin");
  });
  test("each submenu has a durable URL and exactly one current-page marker", () => {
    for (const view of ["users", "roles", "permissions"] as const) {
      const html = renderToStaticMarkup(createElement(UserManagementNav, { view }));
      expect([...html.matchAll(/aria-current="page"/g)]).toHaveLength(1);
      expect(html).toMatch(new RegExp(`href="/admin/user-management/${view}"[^>]*aria-current="page"|aria-current="page"[^>]*href="/admin/user-management/${view}"`));
      expect(html).toContain('aria-label="User Management"');
    }
  });
  test("permissions screen explicitly describes the assigned-permission scope", () => {
    const html = renderToStaticMarkup(createElement(RolePermissionViewer, { view: "permissions" }));
    expect(html).toContain("Daftar izin pada role");
    expect(html).toContain("Cari izin atau role");
    expect(html).not.toContain("Matriks akses RBAC");
  });
});

describe("Permission usage", () => {
  test("deduplicates permission slugs within a role and preserves every granting role", () => {
    expect(getPermissionUsage([
      { id: 1, name: "HR", slug: "hr", permissions: ["hr.view", "hr.view", "dashboard.view"] },
      { id: 2, name: "Manager", slug: "manager", permissions: ["hr.view"] },
      { id: 3, name: "Empty", slug: "empty", permissions: [] }
    ])).toEqual([
      { slug: "dashboard.view", roles: [{ id: 1, name: "HR" }] },
      { slug: "hr.view", roles: [{ id: 1, name: "HR" }, { id: 2, name: "Manager" }] }
    ]);
  });
  test("does not invent permissions for empty data or mutate the source", () => {
    expect(getPermissionUsage([])).toEqual([]);
    const role = { id: 1, name: "Empty", slug: "empty", permissions: [] };
    expect(getPermissionUsage([role])).toEqual([]);
    expect(role.permissions).toEqual([]);
  });
});
