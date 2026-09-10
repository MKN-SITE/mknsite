"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormField } from "@/components/ui/form-field";
import { EmptyState } from "@/components/ui/empty-state";

// Temporary QA route: copy to apps/web/app/qa-ui-primitives/page.tsx.
// The fixture never calls the API or changes application data.
export default function UiPrimitivesFixture() {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [compact, setCompact] = useState(false);
  return (
    <main id="main" style={{ maxWidth: compact ? 360 : 1000, margin: "auto", padding: 20, display: "grid", gap: 24 }}>
      <h1>QA komponen UI</h1>
      <Button variant="ghost" onClick={() => setCompact(!compact)}>Ubah lebar pengujian</Button>
      <p role="status">Aksi: {count}</p>
      <form onSubmit={(event) => { event.preventDefault(); setLoading(true); }} style={{ display: "grid", gap: 20 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {(["primary", "secondary", "danger", "ghost"] as const).map((variant) => (
            <Button key={variant} variant={variant} onClick={() => setCount(count + 1)}>{variant}</Button>
          ))}
          <Button size="sm" onClick={() => setCount(count + 1)}>Kecil</Button>
          <Button disabled onClick={() => setCount(count + 1)}>Nonaktif</Button>
          <Button loading onClick={() => setCount(count + 1)}>Tidak terkirim</Button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {(["success", "warning", "danger", "neutral", "accent"] as const).map((variant) => <Badge key={variant} variant={variant}>{variant}</Badge>)}
        </div>
        <FormField label="Nama" name="name" placeholder="Nama lengkap" required />
        <FormField label="Email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} error={email && !email.includes("@") ? "Email tidak valid" : undefined} aria-describedby="email-hint" />
        <p id="email-hint">Gunakan alamat email yang valid.</p>
        <FormField label="Kata sandi" name="password" type="password" autoComplete="new-password" />
        <FormField label="Status" name="status" type="select" placeholder="Pilih status" defaultValue="" required>
          <option value="active">Aktif</option><option value="inactive">Nonaktif</option>
        </FormField>
        <FormField label="Tidak dapat diedit" name="disabled" disabled defaultValue="Terkunci" />
        <Button type="submit" loading={loading} loadingText="Menyimpan...">Kirim formulir</Button>
        <Button variant="ghost" onClick={() => setLoading(false)}>Pulihkan tombol</Button>
      </form>
      <EmptyState icon="+" title="Belum ada pengguna" description="Tambahkan pengguna untuk mulai mengelola akses." action={{ label: "Tambah pengguna", onClick: () => setCount(count + 1) }} />
      <EmptyState title="Tidak ada hasil" description="Coba kata pencarian lain." />
    </main>
  );
}
