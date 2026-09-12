"use client";

import { useMemo, useState, type FormEvent } from "react";
import { ApiError, api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { Modal } from "@/components/ui/modal";
import { usePermissions, type PermissionSummaryDto } from "../hooks/use-permissions";
import { useRoles, type RoleSummaryDto } from "../hooks/use-roles";
import styles from "./role-permission-viewer.module.css";

type View = "roles" | "permissions";
type Editor = { kind: "role"; item?: RoleSummaryDto } | { kind: "permission"; item?: PermissionSummaryDto };

export function RolePermissionViewer({ view = "roles", canManage = false }: { view?: View; canManage?: boolean }) {
  const roleState = useRoles();
  const permissionState = usePermissions();
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoleSummaryDto | PermissionSummaryDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const query = search.trim().toLocaleLowerCase("id");
  const isRoles = view === "roles";
  const items = isRoles ? roleState.roles : permissionState.permissions;
  const loading = isRoles ? roleState.loading : permissionState.loading;
  const error = isRoles ? roleState.error ?? (canManage ? permissionState.error : null) : permissionState.error;
  const visibleItems = items.filter((item) => {
    const values = "permissions" in item ? [item.name, item.slug, ...item.permissions] : [item.name, item.slug];
    return values.some((value) => value.toLocaleLowerCase("id").includes(query));
  });

  async function refreshAll() {
    await Promise.all([roleState.refresh(), permissionState.refresh()]);
  }

  async function submitEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || saving) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const slug = String(form.get("slug") ?? "").trim().toLowerCase();
    const base = editor.kind === "role" ? "/admin/rbac/roles" : "/admin/rbac/permissions";
    const body = editor.kind === "role"
      ? { name, slug, permissionIds: form.getAll("permissionIds").map(Number) }
      : { name, slug };
    setSaving(true);
    setFormError(null);
    try {
      await api(`${base}${editor.item ? `/${editor.item.id}` : ""}`, {
        method: editor.item ? "PATCH" : "POST",
        body: JSON.stringify(body)
      });
      setEditor(null);
      setNotice(`${editor.kind === "role" ? "Role" : "Izin"} berhasil ${editor.item ? "diperbarui" : "dibuat"}.`);
      await refreshAll();
    } catch (reason) {
      setFormError(reason instanceof ApiError ? reason.message : "Perubahan belum dapat disimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || saving) return;
    const kind = "permissions" in deleteTarget ? "role" : "permission";
    setSaving(true);
    setFormError(null);
    try {
      await api(`/admin/rbac/${kind === "role" ? "roles" : "permissions"}/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      setNotice(`${kind === "role" ? "Role" : "Izin"} berhasil dihapus.`);
      await refreshAll();
    } catch (reason) {
      setFormError(reason instanceof ApiError ? reason.message : "Data belum dapat dihapus.");
    } finally {
      setSaving(false);
    }
  }

  const editorTitle = editor ? `${editor.item ? "Edit" : "Tambah"} ${editor.kind === "role" ? "role" : "izin"}` : "Editor akses";
  return (
    <section className={styles.card} aria-label={isRoles ? "Manajemen role" : "Manajemen izin"}>
      <div className={styles.heading}>
        <div><p className={styles.kicker}>{isRoles ? "ROLE" : "IZIN AKSES"}</p><h3 className={styles.title}>{isRoles ? "Role dan cakupan akses" : "Katalog izin sistem"}</h3><p className={styles.subtitle}>{isRoles ? "Atur kelompok akses dan izin yang dimiliki setiap role." : "Kelola identifier izin yang dipakai oleh role dan menu."}</p></div>
        {canManage && <Button onClick={() => { setFormError(null); setEditor({ kind: isRoles ? "role" : "permission" }); }}>+ Tambah {isRoles ? "Role" : "Izin"}</Button>}
      </div>
      {!canManage && <p className={styles.readonlyNote}>Mode baca. Perubahan role dan izin hanya tersedia untuk Superadministrator.</p>}
      {notice && <div className={styles.notice} role="status"><span>{notice}</span><button type="button" onClick={() => setNotice(null)} aria-label="Tutup pemberitahuan">×</button></div>}
      <div className={styles.toolbar}><FormField label={`Cari ${isRoles ? "role" : "izin"}`} name="access-search" type="text" placeholder={`Cari nama atau slug ${isRoles ? "role" : "izin"}...`} value={search} onChange={(event) => setSearch(event.target.value)} /><Button variant="secondary" size="sm" loading={loading} loadingText="Memuat..." onClick={refreshAll}>Muat ulang</Button></div>
      {error && <div className={styles.errorBanner} role="alert"><span>{error}</span><Button variant="secondary" size="sm" onClick={refreshAll}>Coba lagi</Button></div>}
      {loading && <div role="status" aria-label={`Memuat ${isRoles ? "role" : "izin"}...`} data-skeleton="true">{[1, 2, 3].map((i) => <div className={styles.skeletonRow} key={i} />)}</div>}
      {!loading && !error && <><p className={styles.summary} role="status">{visibleItems.length} {isRoles ? "role" : "izin"}{query ? " ditemukan" : " tersedia"}</p>{visibleItems.length === 0 ? <EmptyState title={query ? "Tidak ada hasil" : `Belum ada ${isRoles ? "role" : "izin"}`} description={query ? "Coba nama atau slug yang berbeda." : "Data akses baru akan tampil di sini."} /> : <div className={styles.grid}>{isRoles ? (visibleItems as RoleSummaryDto[]).map((role) => <RoleCard key={role.id} role={role} canManage={canManage} onEdit={() => { setFormError(null); setEditor({ kind: "role", item: role }); }} onDelete={() => { setFormError(null); setDeleteTarget(role); }} />) : (visibleItems as PermissionSummaryDto[]).map((permission) => <PermissionCard key={permission.id} permission={permission} canManage={canManage} onEdit={() => { setFormError(null); setEditor({ kind: "permission", item: permission }); }} onDelete={() => { setFormError(null); setDeleteTarget(permission); }} />)}</div>}</>}
      <Modal open={Boolean(editor)} onClose={() => !saving && setEditor(null)} title={editorTitle} size="md" footer={<><Button variant="secondary" disabled={saving} onClick={() => setEditor(null)}>Batal</Button><Button type="submit" form="rbac-editor" loading={saving} loadingText="Menyimpan...">Simpan</Button></>}>
        {editor && <RbacEditor editor={editor} permissions={permissionState.permissions} error={formError} onSubmit={submitEditor} />}
      </Modal>
      <Modal open={Boolean(deleteTarget)} onClose={() => !saving && setDeleteTarget(null)} title={`Hapus ${deleteTarget && "permissions" in deleteTarget ? "role" : "izin"}?`} size="sm" footer={<><Button variant="secondary" disabled={saving} onClick={() => setDeleteTarget(null)}>Batal</Button><Button variant="danger" loading={saving} loadingText="Menghapus..." onClick={confirmDelete}>Hapus permanen</Button></>}>
        <p className={styles.confirmText}>Data <strong>{deleteTarget?.name}</strong> akan dihapus. Tindakan ini hanya tersedia ketika data tidak sedang digunakan.</p>{formError && <p className={styles.formError} role="alert">{formError}</p>}
      </Modal>
    </section>
  );
}

function RoleCard({ role, canManage, onEdit, onDelete }: { role: RoleSummaryDto; canManage: boolean; onEdit: () => void; onDelete: () => void }) {
  return <article className={styles.itemCard}><div className={styles.itemHead}><div><h4>{role.name}</h4><code>{role.slug}</code></div>{role.isSystem && <Badge variant="neutral">Bawaan</Badge>}</div><div className={styles.metrics}><span><strong>{role.userCount}</strong> pengguna</span><span><strong>{role.permissions.length}</strong> izin</span></div><div className={styles.permissionTags}>{role.permissions.length ? role.permissions.map((permission) => <Badge key={permission} variant="accent">{permission}</Badge>) : <span className={styles.muted}>Tanpa izin</span>}</div>{canManage && <div className={styles.actions}><Button variant="secondary" size="sm" onClick={onEdit}>Edit</Button><Button variant="ghost" size="sm" disabled={role.isSystem || role.userCount > 0} title={role.isSystem ? "Role bawaan dilindungi" : role.userCount > 0 ? "Role masih digunakan" : undefined} onClick={onDelete}>Hapus</Button></div>}</article>;
}

function PermissionCard({ permission, canManage, onEdit, onDelete }: { permission: PermissionSummaryDto; canManage: boolean; onEdit: () => void; onDelete: () => void }) {
  return <article className={styles.itemCard}><div className={styles.itemHead}><div><h4>{permission.name}</h4><code>{permission.slug}</code></div>{permission.isSystem && <Badge variant="neutral">Bawaan</Badge>}</div><div className={styles.metrics}><span><strong>{permission.roleCount}</strong> role</span><span><strong>{permission.menuCount}</strong> menu</span></div><p className={styles.muted}>{permission.roleCount || permission.menuCount ? "Izin sedang digunakan dan terlindung dari penghapusan." : "Belum digunakan oleh role atau menu."}</p>{canManage && <div className={styles.actions}><Button variant="secondary" size="sm" onClick={onEdit}>Edit</Button><Button variant="ghost" size="sm" disabled={permission.isSystem || permission.roleCount > 0 || permission.menuCount > 0} title={permission.isSystem ? "Izin bawaan dilindungi" : permission.roleCount || permission.menuCount ? "Izin masih digunakan" : undefined} onClick={onDelete}>Hapus</Button></div>}</article>;
}

function RbacEditor({ editor, permissions, error, onSubmit }: { editor: Editor; permissions: PermissionSummaryDto[]; error: string | null; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const role = editor.kind === "role" ? editor.item : undefined;
  const permission = editor.kind === "permission" ? editor.item : undefined;
  const selected = useMemo(() => new Set(role?.permissionIds ?? []), [role]);
  const slugLocked = Boolean(editor.item?.isSystem);
  return <form id="rbac-editor" className={styles.form} onSubmit={onSubmit}><FormField label="Nama" name="name" required maxLength={editor.kind === "role" ? 100 : 140} defaultValue={role?.name ?? permission?.name ?? ""} placeholder={editor.kind === "role" ? "Contoh: Supervisor Lapangan" : "Contoh: Lihat laporan aset"} /><FormField label="Slug" name="slug" required maxLength={editor.kind === "role" ? 100 : 140} pattern="[a-z0-9]+(?:[._-][a-z0-9]+)*" defaultValue={role?.slug ?? permission?.slug ?? ""} readOnly={slugLocked} aria-describedby="slug-help" placeholder={editor.kind === "role" ? "supervisor-lapangan" : "asset.report.view"} /><p className={styles.help} id="slug-help">Gunakan huruf kecil, angka, titik, garis bawah, atau tanda hubung.{slugLocked ? " Slug bawaan dikunci agar integrasi tetap aman." : ""}</p>{editor.kind === "role" && <fieldset className={styles.permissionPicker}><legend>Izin role</legend><p>Pilih izin yang langsung dimiliki role ini.</p><div className={styles.checkGrid}>{permissions.map((item) => <label key={item.id}><input type="checkbox" name="permissionIds" value={item.id} defaultChecked={selected.has(item.id)} /><span><strong>{item.name}</strong><code>{item.slug}</code></span></label>)}</div></fieldset>}{error && <p className={styles.formError} role="alert">{error}</p>}</form>;
}
