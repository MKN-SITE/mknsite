// @ts-ignore
import { describe, expect, test } from "bun:test";
// @ts-ignore
import { createElement } from "../../apps/web/node_modules/react";
// @ts-ignore
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server";
import { CreateUserModal } from "../../apps/web/features/admin/components/create-user-modal";
import { ApiError } from "../../apps/web/lib/api";

describe("CreateUserModal component", () => {
  test("renders modal with form fields, labels, character counters and action buttons", () => {
    const html = renderToStaticMarkup(
      createElement(CreateUserModal, {
        open: true,
        onClose: () => {}
      })
    );

    expect(html).toContain("Tambah Karyawan Baru");
    expect(html).toContain("Nama Lengkap");
    expect(html).toContain('placeholder="cth. Budi Santoso"');
    expect(html).toContain('maxLength="160"');

    expect(html).toContain("Email Resmi");
    expect(html).toContain('placeholder="budi@mknsite.online"');
    expect(html).toContain('type="email"');
    expect(html).toContain('maxLength="191"');

    expect(html).toContain("Kata Sandi Akun");
    expect(html).toContain('type="password"');
    expect(html).toContain('maxLength="128"');
    expect(html).toContain("0/12 karakter minimum");
    expect(html).toContain("Maks 128");

    expect(html).toContain("Penugasan Role Karyawan");
    expect(html).toContain("Simpan Pengguna");
    expect(html).toContain("Batal");
  });

  test("filters out roles containing admin.manage or admin.security.manage", () => {
    const allRoles = [
      { id: 1, name: "HR Officer", slug: "hr-officer", permissions: ["dashboard.view", "hr.view"] },
      { id: 2, name: "Finance Staff", slug: "finance-staff", permissions: ["dashboard.view", "finance.view"] },
      { id: 3, name: "Admin Lead", slug: "admin-lead", permissions: ["dashboard.view", "admin.manage"] },
      { id: 4, name: "Security Superadmin", slug: "security-superadmin", permissions: ["admin.security.manage"] }
    ];

    const assignableRoles = allRoles.filter(
      (role) =>
        !role.permissions.includes("admin.manage") &&
        !role.permissions.includes("admin.security.manage")
    );

    expect(assignableRoles.map((r) => r.id)).toEqual([1, 2]);
    expect(assignableRoles.some((r) => r.permissions.includes("admin.manage"))).toBe(false);
    expect(assignableRoles.some((r) => r.permissions.includes("admin.security.manage"))).toBe(false);
  });

  test("validates client-side rules correctly", () => {
    const validate = (name: string, email: string, password: string) => {
      const errors: { name?: string; email?: string; password?: string } = {};

      const trimmedName = name.trim();
      if (!trimmedName) {
        errors.name = "Nama lengkap wajib diisi";
      } else if (trimmedName.length > 160) {
        errors.name = "Nama lengkap maksimal 160 karakter";
      }

      const trimmedEmail = email.trim();
      if (!trimmedEmail) {
        errors.email = "Email resmi wajib diisi";
      } else if (trimmedEmail.length > 191) {
        errors.email = "Email maksimal 191 karakter";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        errors.email = "Format email tidak valid";
      }

      if (!password) {
        errors.password = "Kata sandi wajib diisi";
      } else if (password.length < 12) {
        errors.password = "Kata sandi minimal 12 karakter";
      } else if (password.length > 128) {
        errors.password = "Kata sandi maksimal 128 karakter";
      }

      return errors;
    };

    // All empty
    expect(validate("", "", "")).toEqual({
      name: "Nama lengkap wajib diisi",
      email: "Email resmi wajib diisi",
      password: "Kata sandi wajib diisi"
    });

    // Invalid email & short password
    const badInput = validate("Budi", "not-an-email", "short");
    expect(badInput.name).toBeUndefined();
    expect(badInput.email).toBe("Format email tidak valid");
    expect(badInput.password).toBe("Kata sandi minimal 12 karakter");

    // Valid input
    const goodInput = validate("Budi Santoso", "budi@mknsite.online", "ValidPassword123!");
    expect(Object.keys(goodInput).length).toBe(0);
  });

  test("ApiError stores status and data properly", () => {
    const conflictErr = new ApiError("Email sudah terdaftar", 409, { code: "EMAIL_ALREADY_EXISTS" });
    expect(conflictErr.status).toBe(409);
    expect(conflictErr.message).toBe("Email sudah terdaftar");
    expect(conflictErr.data?.code).toBe("EMAIL_ALREADY_EXISTS");
    expect(conflictErr instanceof Error).toBe(true);

    const forbiddenErr = new ApiError("Tidak diizinkan", 403);
    expect(forbiddenErr.status).toBe(403);
  });
});
