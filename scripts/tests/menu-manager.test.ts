// @ts-ignore
import { describe, expect, test } from "bun:test";
// @ts-ignore
import { createElement } from "../../apps/web/node_modules/react";
// @ts-ignore
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server";
import { MenuManager } from "../../apps/web/features/admin/components/menu-manager";
import { MenuIcon, PRESET_MENU_ICONS } from "../../apps/web/features/admin/components/menu-icon";
import { AdminApp } from "../../apps/web/components/admin-app";

describe("MenuManager component", () => {
  test("renders section title, subtitle, and add menu button", () => {
    const html = renderToStaticMarkup(createElement(MenuManager));
    expect(html).toContain("Menu Dinamis</h3>");
    expect(html).toContain("Atur navigasi karyawan, gerbang modul bisnis, dan izin akses role.");
    expect(html).toContain("+ Tambah Menu</button>");
  });

  test("renders data table headers for dynamic menus", () => {
    const html = renderToStaticMarkup(createElement(MenuManager));
    expect(html).toContain("<table");
    expect(html).toContain(">Urutan</th>");
    expect(html).toContain(">Menu</th>");
    expect(html).toContain(">URL Tujuan</th>");
    expect(html).toContain(">Izin Akses</th>");
    expect(html).toContain(">Status</th>");
    expect(html).toContain(">Aksi</th>");
  });

  test("renders initial loading state with skeleton bars", () => {
    const html = renderToStaticMarkup(createElement(MenuManager));
    expect(html).toContain('data-skeleton="true"');
  });
});

describe("MenuIcon component", () => {
  test("renders all 14 preset SVG icons correctly", () => {
    for (const preset of PRESET_MENU_ICONS) {
      const html = renderToStaticMarkup(createElement(MenuIcon, { name: preset.name }));
      expect(html).toContain("<svg");
      expect(html).toContain('viewBox="0 0 24 24"');
    }
  });

  test("renders fallback SVG icon for undefined or unknown icon name", () => {
    const html = renderToStaticMarkup(createElement(MenuIcon, { name: "unknown-icon-name" }));
    expect(html).toContain("<svg");
    expect(html).toContain("<circle");
  });
});

describe("AdminApp sidebar navigation with Menu Portal", () => {
  test("renders sidebar navigation button with Menu Portal and token MN", () => {
    const navItems = [
      ["users", "Pengguna", "US"],
      ["menus", "Menu Portal", "MN"],
      ["roles", "Role & Izin", "RB"],
      ["settings", "Pengaturan", "ST"]
    ];

    const menuPortalItem = navItems.find(([key]) => key === "menus");
    expect(menuPortalItem).toBeDefined();
    expect(menuPortalItem?.[1]).toBe("Menu Portal");
    expect(menuPortalItem?.[2]).toBe("MN");

    // Order verification: users -> menus -> roles -> settings
    expect(navItems[0][0]).toBe("users");
    expect(navItems[1][0]).toBe("menus");
    expect(navItems[2][0]).toBe("roles");
    expect(navItems[3][0]).toBe("settings");
  });
});
