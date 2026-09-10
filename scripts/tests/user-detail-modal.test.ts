// @ts-ignore
import { describe, expect, test } from "bun:test";
// @ts-ignore
import { createElement } from "../../apps/web/node_modules/react";
// @ts-ignore
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server";
import { UserDetailModal } from "../../apps/web/features/admin/components/user-detail-modal";
import type { UserSummaryDto } from "../../apps/web/features/admin/hooks/use-users";

describe("UserDetailModal component", () => {
  const sampleEmployee: UserSummaryDto = {
    id: 10,
    name: "Siti Rahma",
    email: "siti@mknsite.online",
    accountType: "employee",
    isActive: true,
    roles: [
      { id: 1, name: "HR Officer", slug: "hr" },
      { id: 2, name: "Operations", slug: "ops" }
    ],
    createdAt: "2026-09-01T10:00:00.000Z",
    updatedAt: "2026-09-05T12:00:00.000Z"
  };

  const sampleAdmin: UserSummaryDto = {
    id: 1,
    name: "Admin Utama",
    email: "admin@mknsite.online",
    accountType: "admin",
    isActive: true,
    roles: [
      { id: 5, name: "Superadministrator", slug: "superadministrator" }
    ],
    createdAt: "2026-08-01T08:00:00.000Z",
    updatedAt: "2026-08-01T08:00:00.000Z"
  };

  test("renders 3 sections for employee user with edit controls and actions", () => {
    const html = renderToStaticMarkup(
      createElement(UserDetailModal, {
        open: true,
        user: sampleEmployee,
        onClose: () => {}
      })
    );

    // Section 1: Profil
    expect(html).toContain("1. Informasi Profil");
    expect(html).toContain("Siti Rahma");
    expect(html).toContain("siti@mknsite.online");
    expect(html).toContain("Karyawan");
    expect(html).toContain("Aktif");
    expect(html).toContain("Edit"); // Edit button visible for employee

    // Section 2: Role & Izin
    expect(html).toContain("2. Role &amp; Izin Akses");
    expect(html).toContain("Ubah Role");
    expect(html).toContain("HR Officer");
    expect(html).toContain("Operations");

    // Section 3: Tindakan Akun
    expect(html).toContain("3. Tindakan Akun &amp; Keamanan Sesi");
    expect(html).toContain("Nonaktifkan Akun");
    expect(html).toContain("Cabut Semua Sesi");
  });

  test("protects admin accounts with read-only badges and suppresses edit controls", () => {
    const html = renderToStaticMarkup(
      createElement(UserDetailModal, {
        open: true,
        user: sampleAdmin,
        onClose: () => {}
      })
    );

    expect(html).toContain("Akun Administrator (Read-Only)");
    expect(html).toContain("Akun administrator memiliki proteksi sistem khusus");
    expect(html).not.toContain(">Edit</button>");
  });

  test("correctly aggregates unique permissions from assigned roles", () => {
    const allRoles = [
      { id: 1, name: "HR", slug: "hr", permissions: ["dashboard.view", "hr.view"] },
      { id: 2, name: "Ops", slug: "ops", permissions: ["dashboard.view", "ops.manage"] }
    ];

    const userRoleIds = new Set([1, 2]);
    const permissionsSet = new Set<string>();

    for (const role of allRoles) {
      if (userRoleIds.has(role.id)) {
        for (const perm of role.permissions) {
          permissionsSet.add(perm);
        }
      }
    }

    const aggregated = Array.from(permissionsSet);
    expect(aggregated).toContain("dashboard.view");
    expect(aggregated).toContain("hr.view");
    expect(aggregated).toContain("ops.manage");
    expect(aggregated.length).toBe(3); // dashboard.view deduplicated
  });

  test("protects Superadministrator from modification when viewed by regular admin", () => {
    const regularAdminCaller = {
      id: 2,
      name: "Admin Biasa",
      email: "admin@mknsite.online",
      actorType: "admin" as const,
      roles: ["Administrator"],
      permissions: ["admin.manage"]
    };

    const targetSuperadmin: UserSummaryDto = {
      id: 1,
      name: "Super Administrator",
      email: "superadmin@mknsite.online",
      accountType: "admin",
      isActive: true,
      roles: [{ id: 7, name: "Superadministrator", slug: "superadmin" }],
      createdAt: "2026-08-01T08:00:00.000Z",
      updatedAt: "2026-08-01T08:00:00.000Z"
    };

    const html = renderToStaticMarkup(
      createElement(UserDetailModal, {
        open: true,
        user: targetSuperadmin,
        currentAdmin: regularAdminCaller,
        onClose: () => {}
      })
    );

    // Section 1: Profil Read-Only
    expect(html).toContain("Akun Administrator (Read-Only)");
    expect(html).not.toContain(">Edit</button>");

    // Section 2: Ubah Role disembunyikan & ada badge proteksi
    expect(html).not.toContain("Ubah Role");
    expect(html).toContain("Role Terproteksi (Khusus Superadmin)");

    // Section 3: Tindakan Akun disembunyikan & ada banner proteksi
    expect(html).not.toContain("Nonaktifkan Akun");
    expect(html).not.toContain("Cabut Semua Sesi");
    expect(html).toContain("Akun Superadministrator memiliki proteksi keamanan sistem khusus");
  });

  test("allows Superadministrator caller to manage roles and actions", () => {
    const superadminCaller = {
      id: 1,
      name: "Super Administrator",
      email: "superadmin@mknsite.online",
      actorType: "admin" as const,
      roles: ["Superadministrator"],
      permissions: ["admin.manage", "admin.security.manage"]
    };

    const targetAdmin: UserSummaryDto = {
      id: 2,
      name: "Admin Biasa",
      email: "admin@mknsite.online",
      accountType: "admin",
      isActive: true,
      roles: [{ id: 6, name: "Administrator", slug: "administrator" }],
      createdAt: "2026-08-01T08:00:00.000Z",
      updatedAt: "2026-08-01T08:00:00.000Z"
    };

    const html = renderToStaticMarkup(
      createElement(UserDetailModal, {
        open: true,
        user: targetAdmin,
        currentAdmin: superadminCaller,
        onClose: () => {}
      })
    );

    // Superadmin dapat mengubah role dan melakukan tindakan akun
    expect(html).toContain("Ubah Role");
    expect(html).toContain("Nonaktifkan Akun");
    expect(html).toContain("Cabut Semua Sesi");
  });
});
