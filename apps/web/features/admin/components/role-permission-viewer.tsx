"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { useRoles } from "../hooks/use-roles";
import { getPermissionUsage } from "../lib/permission-usage";
import styles from "./role-permission-viewer.module.css";

export function RolePermissionViewer({ view = "roles" }: { view?: "roles" | "permissions" }) {
  const { roles, loading, error, refresh } = useRoles();
  const [search, setSearch] = useState("");
  const query = search.trim().toLocaleLowerCase("id");
  const visibleRoles = roles.filter((role) => [role.name, role.slug, ...role.permissions].some((value) => value.toLocaleLowerCase("id").includes(query)));
  const permissions = getPermissionUsage(roles);
  const visiblePermissions = permissions.filter((permission) => [permission.slug, ...permission.roles.map((role) => role.name)].some((value) => value.toLocaleLowerCase("id").includes(query)));
  const isRoles = view === "roles";
  const count = isRoles ? visibleRoles.length : visiblePermissions.length;
  return (
    <section className={styles.card} aria-label={isRoles ? "Matriks Hak Akses RBAC" : "Izin yang digunakan role"}>
      <div className={styles.heading}>
        <div><h3 className={styles.title}>{isRoles ? "Matriks akses RBAC" : "Daftar izin pada role"}</h3>
          <p className={styles.subtitle}>{isRoles ? "Role menentukan modul yang dapat dilihat dan tindakan yang diizinkan dalam sistem MKN." : "Lihat izin yang telah terhubung ke role dan role mana yang menggunakannya."}</p></div>
        <Button variant="secondary" size="sm" loading={loading} loadingText="Memuat..." onClick={() => refresh()}>Muat ulang</Button>
      </div>
      <FormField label={isRoles ? "Cari role atau izin" : "Cari izin atau role"} name="access-search" type="text" placeholder={isRoles ? "Cari nama role atau kode izin..." : "Cari kode izin atau nama role..."} value={search} onChange={(event) => setSearch(event.target.value)} />
      {error && <div className={styles.errorBanner} role="alert"><span>{error}</span><Button variant="secondary" size="sm" onClick={() => refresh()}>Coba lagi</Button></div>}
      {loading && <div role="status" aria-label="Memuat matriks role..." data-skeleton="true"><p className={styles.summary}>Memuat data akses...</p>{[1, 2, 3].map((i) => <div className={styles.skeletonRow} key={i} />)}</div>}
      {!loading && !error && <>
        <p className={styles.summary} role="status">{count} {isRoles ? "role" : "izin"}{query ? " ditemukan" : " tersedia"}</p>
        {count === 0 ? <EmptyState title={query ? "Tidak ada hasil" : isRoles ? "Belum ada role" : "Belum ada izin pada role"} description={query ? "Coba nama role atau kode izin yang berbeda." : "Data akses akan tampil di sini setelah tersedia."} /> :
          <ul className={styles.list} aria-label={isRoles ? "Daftar Role dan Permission" : "Daftar Izin dan Role"}>
            {isRoles ? visibleRoles.map((role) => <li key={role.id} className={styles.roleRow}>
              <div className={styles.roleMeta}><strong className={styles.roleName}>{role.name}</strong><span className={styles.roleSlug}>{role.slug}</span><span className={styles.summary}>{role.permissions.length} izin</span></div>
              <div className={styles.permissionTags}>{role.permissions.length ? role.permissions.map((permission) => <Badge key={permission} variant="accent">{permission}</Badge>) : <span className={styles.summary}>Tidak ada izin khusus</span>}</div>
            </li>) : visiblePermissions.map((permission) => <li key={permission.slug} className={styles.roleRow}>
              <div className={styles.roleMeta}><strong className={styles.permissionCode}>{permission.slug}</strong><span className={styles.summary}>Digunakan oleh {permission.roles.length} role</span></div>
              <div className={styles.permissionTags}>{permission.roles.map((role) => <Badge key={role.id} variant="neutral">{role.name}</Badge>)}</div>
            </li>)}
          </ul>}
        <p className={styles.note}>{isRoles ? "Untuk mengubah role seorang pengguna, buka Pengguna lalu pilih Detail." : "Daftar ini hanya mencakup izin yang digunakan oleh role. Penetapan akses pengguna dilakukan melalui role."}</p>
      </>}
    </section>
  );
}
