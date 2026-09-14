// @ts-ignore
import { describe, expect, test } from "bun:test";
// @ts-ignore
import { createElement } from "../../apps/web/node_modules/react";
// @ts-ignore
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server";
import { UserList } from "../../apps/web/features/admin/components/user-list";

describe("UserList component", () => {
  test("renders admin user management title and subtitle", () => {
    const html = renderToStaticMarkup(createElement(UserList));
    expect(html).toContain("Pengguna</h3>");
    expect(html).toContain("Kelola akun, status akses, dan role pengguna di sistem MKN.");
    expect(html).toContain("+ Tambah Pengguna</button>");
  });

  test("renders search bar and filter selects", () => {
    const html = renderToStaticMarkup(createElement(UserList));
    expect(html).toContain('placeholder="Cari nama atau email..."');
    expect(html).toContain('aria-label="Filter status pengguna"');
    expect(html).toContain('aria-label="Filter tipe akun"');
    expect(html).toContain("Semua Status</option>");
    expect(html).toContain("Semua Tipe Akun</option>");
  });

  test("renders data table headers for users", () => {
    const html = renderToStaticMarkup(createElement(UserList));
    expect(html).toContain("<table");
    expect(html).toContain(">Nama</th>");
    expect(html).toContain(">Email</th>");
    expect(html).toContain(">Tipe Akun</th>");
    expect(html).toContain(">Status</th>");
    expect(html).toContain(">Role</th>");
    expect(html).toContain(">Dibuat</th>");
    expect(html).toContain(">Aksi</th>");
  });

  test("renders initial loading state with skeleton bars", () => {
    const html = renderToStaticMarkup(createElement(UserList));
    expect(html).toContain('data-skeleton="true"');
  });
});
