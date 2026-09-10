import { describe, expect, test } from "bun:test";
import { createElement } from "../../apps/web/node_modules/react";
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server";
import { Button } from "../../apps/web/components/ui/button";
import { Badge } from "../../apps/web/components/ui/badge";
import { FormField } from "../../apps/web/components/ui/form-field";
import { EmptyState } from "../../apps/web/components/ui/empty-state";

// Server-rendered semantic contracts; browser checks cover real interaction and CSS.
describe("UI primitives", () => {
  test("button defaults to a non-submit action and preserves native form attributes", () => {
    const html = renderToStaticMarkup(createElement(Button, { name: "intent", value: "save", form: "editor", children: "Simpan" }));
    expect(html).toContain('type="button"');
    expect(html).toContain('name="intent"');
    expect(html).toContain('value="save"');
    expect(html).toContain('form="editor"');
    expect(renderToStaticMarkup(createElement(Button, { type: "submit" }))).toContain('type="submit"');
  });
  test("loading disables the button and exposes busy text even if disabled=false", () => {
    const html = renderToStaticMarkup(createElement(Button, { loading: true, disabled: false, loadingText: "Menyimpan...", children: "Simpan" }));
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Menyimpan...");
    expect(html).not.toContain(">Simpan<");
    expect(renderToStaticMarkup(createElement(Button, { disabled: true, loading: false }))).toContain('disabled=""');
  });
  test("badge exposes its text for every status, not just a color", () => {
    for (const variant of ["success", "warning", "danger", "neutral", "accent"] as const) {
      expect(renderToStaticMarkup(createElement(Badge, { variant, children: "Status akun" }))).toContain("Status akun</span>");
    }
  });
  test("fields preserve native attributes and associate labels and errors", () => {
    const html = renderToStaticMarkup(createElement(FormField, {
      label: "Email", name: "email", id: "email-input", type: "email", required: true,
      autoComplete: "email", defaultValue: "qa@example.test", error: "Email tidak valid",
      "aria-describedby": "email-hint"
    }));
    for (const value of ['for="email-input"', 'id="email-input"', 'type="email"', 'required=""',
      'autoComplete="email"', 'value="qa@example.test"', 'aria-invalid="true"',
      'aria-describedby="email-hint email-input-error"', 'id="email-input-error"', 'role="alert"']) {
      expect(html).toContain(value);
    }
    expect(html).not.toContain('error="');
  });
  test("repeated field names receive distinct generated ids", () => {
    const html = renderToStaticMarkup(createElement("div", null,
      createElement(FormField, { label: "Email satu", name: "email" }),
      createElement(FormField, { label: "Email dua", name: "email" })
    ));
    const ids = [...html.matchAll(/<input[^>]* id="([^"]+)"/g)].map((match) => match[1]);
    const labels = [...html.matchAll(/for="([^"]+)"/g)].map((match) => match[1]);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    expect(labels).toEqual(ids);
  });
  test("select retains options, default value, required and placeholder", () => {
    const html = renderToStaticMarkup(createElement(FormField, {
      label: "Status", name: "status", type: "select", required: true, defaultValue: "",
      placeholder: "Pilih status", children: createElement("option", { value: "active" }, "Aktif")
    }));
    expect(html).toContain("<select");
    expect(html).toContain('value="" disabled="" selected=""');
    expect(html).toContain('value="active"');
    expect(html).not.toContain('type="select"');
    expect(html).not.toContain('placeholder="');
  });
  test("valid fields do not invent errors and preserve caller accessibility metadata", () => {
    const html = renderToStaticMarkup(createElement(FormField, {
      label: "Nama", name: "name", "aria-describedby": "hint", disabled: true
    }));
    expect(html).toContain('aria-describedby="hint"');
    expect(html).toContain('disabled=""');
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('aria-invalid="true"');
  });
  test("empty state renders an optional non-submit action and hides decorative icon", () => {
    const props = { title: "Belum ada data", description: "Tambahkan data untuk memulai." };
    expect(renderToStaticMarkup(createElement(EmptyState, props))).not.toContain("<button");
    const html = renderToStaticMarkup(createElement(EmptyState, { ...props, icon: "+", action: { label: "Tambah data", onClick: () => {} } }));
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('type="button"');
    expect(html).toContain("Tambah data</button>");
  });
});
