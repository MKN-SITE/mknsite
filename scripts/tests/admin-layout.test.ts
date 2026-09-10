// @ts-ignore
import { describe, expect, test } from "bun:test";
// @ts-ignore
import { createElement } from "../../apps/web/node_modules/react";
// @ts-ignore
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server";
import { DataTable, type Column } from "../../apps/web/components/ui/data-table";
import { Modal } from "../../apps/web/components/ui/modal";
import { SearchBar } from "../../apps/web/components/ui/search-bar";
import { Pagination } from "../../apps/web/components/ui/pagination";

describe("Admin layout components", () => {
  // 1. DataTable
  describe("DataTable", () => {
    type TestRow = { id: number; name: string; role: string };
    const columns: Column<TestRow>[] = [
      { key: "id", header: "ID", render: (r) => `#${r.id}` },
      { key: "name", header: "Nama", render: (r) => r.name },
      { key: "role", header: "Role", render: (r) => r.role }
    ];
    const data: TestRow[] = [
      { id: 1, name: "Ahmad", role: "Teknisi" },
      { id: 2, name: "Budi", role: "Admin" }
    ];

    test("renders semantic table headers, rows, and data-label attributes", () => {
      const html = renderToStaticMarkup(createElement(DataTable, { columns, data }));
      expect(html).toContain("<table");
      expect(html).toContain("<thead");
      expect(html).toContain("<tbody");
      expect(html).toContain("scope=\"col\"");
      expect(html).toContain(">ID</th>");
      expect(html).toContain(">Nama</th>");
      expect(html).toContain(">Role</th>");
      expect(html).toContain("data-label=\"Nama\"");
      expect(html).toContain("Ahmad");
      expect(html).toContain("Budi");
      expect(html).toContain("#1");
      expect(html).toContain("#2");
    });

    test("renders skeleton placeholder bars when loading=true", () => {
      const html = renderToStaticMarkup(createElement(DataTable, { columns, data, loading: true }));
      expect(html).not.toContain("Ahmad");
      expect(html).toContain('data-skeleton="true"');
      const skeletonBars = [...html.matchAll(/data-skeleton="true"/g)];
      expect(skeletonBars.length).toBe(columns.length * 4);
    });

    test("renders custom empty state when data is empty", () => {
      const html = renderToStaticMarkup(createElement(DataTable, {
        columns,
        data: [],
        emptyState: createElement("div", { id: "custom-empty" }, "Data tidak ditemukan")
      }));
      expect(html).toContain('id="custom-empty"');
      expect(html).toContain("Data tidak ditemukan");
      expect(html).toContain('colSpan="3"');
    });

    test("enables row click interactivity and keyboard accessibility when onRowClick is provided", () => {
      const html = renderToStaticMarkup(createElement(DataTable, {
        columns,
        data,
        onRowClick: () => {}
      }));
      expect(html).toContain('tabindex="0"');
    });
  });

  // 2. Modal
  describe("Modal", () => {
    test("renders semantic <dialog> with title, close button, content, and footer", () => {
      const html = renderToStaticMarkup(createElement(Modal, {
        open: true,
        onClose: () => {},
        title: "Konfirmasi Hapus",
        size: "sm",
        footer: createElement("button", { type: "button" }, "Batal"),
        children: createElement("p", null, "Apakah Anda yakin ingin menghapus data ini?")
      }));

      expect(html).toContain("<dialog");
      expect(html).toContain("Konfirmasi Hapus</h2>");
      expect(html).toContain('aria-label="Tutup dialog"');
      expect(html).toContain("Apakah Anda yakin ingin menghapus data ini?");
      expect(html).toContain("Batal</button>");
      expect(html).toContain('aria-labelledby="');
    });

    test("applies correct size classes for dialog sizing", () => {
      for (const size of ["sm", "md", "lg"] as const) {
        const html = renderToStaticMarkup(createElement(Modal, {
          open: true,
          onClose: () => {},
          title: `Modal ${size}`,
          size,
          children: "Konten"
        }));
        expect(html).toContain(size);
      }
    });
  });

  // 3. SearchBar
  describe("SearchBar", () => {
    test("renders input with inline SVG search icon and accessible aria-label", () => {
      const html = renderToStaticMarkup(createElement(SearchBar, {
        value: "",
        onChange: () => {},
        placeholder: "Cari pengguna...",
        "aria-label": "Cari data pengguna"
      }));

      expect(html).toContain('type="text"');
      expect(html).toContain('placeholder="Cari pengguna..."');
      expect(html).toContain('aria-label="Cari data pengguna"');
      expect(html).toContain("<svg");
      expect(html).not.toContain('aria-label="Hapus pencarian"');
    });

    test("renders clear button when search text is present", () => {
      const html = renderToStaticMarkup(createElement(SearchBar, {
        value: "jupri",
        onChange: () => {}
      }));

      expect(html).toContain('value="jupri"');
      expect(html).toContain('aria-label="Hapus pencarian"');
    });

    test("does not render clear button when disabled", () => {
      const html = renderToStaticMarkup(createElement(SearchBar, {
        value: "jupri",
        onChange: () => {},
        disabled: true
      }));

      expect(html).toContain('disabled=""');
      expect(html).not.toContain('aria-label="Hapus pencarian"');
    });
  });

  // 4. Pagination
  describe("Pagination", () => {
    test("disables Previous on page 1 and enables Next when more pages exist", () => {
      const html = renderToStaticMarkup(createElement(Pagination, {
        page: 1,
        totalPages: 5,
        onPageChange: () => {}
      }));

      expect(html).toContain("<nav");
      expect(html).toContain('aria-label="Navigasi halaman"');
      const prevButton = html.match(/<button[^>]*aria-label="Halaman sebelumnya"[^>]*>/);
      expect(prevButton?.[0]).toContain('disabled=""');

      const nextButton = html.match(/<button[^>]*aria-label="Halaman berikutnya"[^>]*>/);
      expect(nextButton?.[0]).not.toContain('disabled=""');
    });

    test("disables Next on the final page", () => {
      const html = renderToStaticMarkup(createElement(Pagination, {
        page: 5,
        totalPages: 5,
        onPageChange: () => {}
      }));

      const nextButton = html.match(/<button[^>]*aria-label="Halaman berikutnya"[^>]*>/);
      expect(nextButton?.[0]).toContain('disabled=""');
    });

    test("renders max 5 page numbers + ellipsis when totalPages > 5", () => {
      const html = renderToStaticMarkup(createElement(Pagination, {
        page: 1,
        totalPages: 10,
        onPageChange: () => {}
      }));

      expect(html).toContain('aria-label="Halaman 1"');
      expect(html).toContain('aria-label="Halaman 2"');
      expect(html).toContain('aria-label="Halaman 3"');
      expect(html).toContain('aria-label="Halaman 4"');
      expect(html).toContain('aria-label="Halaman 10"');
      expect(html).toContain("…");
    });

    test("marks the active page with aria-current=\"page\"", () => {
      const html = renderToStaticMarkup(createElement(Pagination, {
        page: 3,
        totalPages: 5,
        onPageChange: () => {}
      }));

      expect(html).toContain('aria-current="page" aria-label="Halaman 3"');
    });

    test("returns null when totalPages <= 0", () => {
      const html = renderToStaticMarkup(createElement(Pagination, {
        page: 1,
        totalPages: 0,
        onPageChange: () => {}
      }));

      expect(html).toBe("");
    });
  });
});
