// @ts-ignore
import { describe, expect, mock, test } from "bun:test";

mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {}
  }),
  usePathname: () => "/portal"
}));

// @ts-ignore
import { createElement } from "../../apps/web/node_modules/react";
// @ts-ignore
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server";
import { MenuGrid } from "../../apps/web/features/portal/components/menu-grid";
import { PortalIcon } from "../../apps/web/features/portal/components/portal-icons";
import { PRESET_MENU_ICONS } from "../../apps/web/features/admin/components/menu-icon";

const mockUser = {
  id: 1,
  name: "Budi Santoso",
  email: "budi@mknsite.online",
  actorType: "user" as const,
  roles: ["Karyawan", "HR Specialist"],
  permissions: ["dashboard.view", "hr.view"]
};

describe("MenuGrid component", () => {
  test("renders header with MKN logo, user name, and welcome title", () => {
    const html = renderToStaticMarkup(
      createElement(MenuGrid, {
        user: mockUser,
        onLogout: () => {}
      })
    );

    expect(html).toContain("MKN Site</span>");
    expect(html).toContain("PT Multi Kontrol Nusantara</span>");
    expect(html).toContain("Welcome, Budi</h1>");
    expect(html).toContain("Empower your business with real-time insights");
    expect(html).toContain("Budi Santoso</span>");
    expect(html).toContain("Pusat Bantuan");
  });

  test("renders initial loading state with skeleton cards", () => {
    const html = renderToStaticMarkup(
      createElement(MenuGrid, {
        user: mockUser,
        onLogout: () => {}
      })
    );

    expect(html).toContain('data-skeleton="true"');
    expect(html).toContain('aria-label="Memuat menu portal..."');
  });
});

describe("PortalIcon component", () => {
  test("renders all 14 preset SVG icons at 64x64", () => {
    for (const preset of PRESET_MENU_ICONS) {
      const html = renderToStaticMarkup(createElement(PortalIcon, { name: preset.name }));
      expect(html).toContain("<svg");
      expect(html).toContain('width="64"');
      expect(html).toContain('height="64"');
      expect(html).toContain('viewBox="0 0 24 24"');
    }
  });

  test("renders custom size when passed", () => {
    const html = renderToStaticMarkup(createElement(PortalIcon, { name: "briefcase", size: 48 }));
    expect(html).toContain('width="48"');
    expect(html).toContain('height="48"');
  });

  test("renders fallback SVG icon for unknown icon", () => {
    const html = renderToStaticMarkup(createElement(PortalIcon, { name: "invalid-icon" }));
    expect(html).toContain("<svg");
    expect(html).toContain("<circle");
  });
});
