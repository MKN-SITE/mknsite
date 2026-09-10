"use client";

import { Button } from "@/components/ui/button";
import { useRoles, type RoleSummaryDto } from "../hooks/use-roles";
import styles from "./role-permission-viewer.module.css";

export function RolePermissionViewer() {
  const { roles, loading, error, refresh } = useRoles();

  return (
    <section className={`${styles.card} admin-card`} aria-label="Matriks Hak Akses RBAC">
      <h3 className={styles.title}>Matriks akses RBAC</h3>
      <p className={styles.subtitle}>
        Role menentukan modul yang dapat dilihat dan tindakan yang diizinkan dalam sistem MKN.
      </p>

      {error && (
        <div className={styles.errorBanner} role="alert">
          <span>{error}</span>
          <Button variant="secondary" size="sm" onClick={() => refresh()}>
            Coba lagi
          </Button>
        </div>
      )}

      {loading && (
        <div aria-label="Memuat matriks role..." data-skeleton="true">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={styles.skeletonRow}>
              <div className={styles.skeletonMeta}>
                <div className={styles.skeletonText} style={{ width: "110px" }} />
                <div className={styles.skeletonText} style={{ width: "70px", height: "11px" }} />
              </div>
              <div className={styles.skeletonTags}>
                <div className={styles.skeletonTag} />
                <div className={styles.skeletonTag} />
                <div className={styles.skeletonTag} />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && roles.length === 0 && (
        <div className={styles.emptyState}>
          Belum ada data role dan permission yang terdaftar dalam sistem.
        </div>
      )}

      {!loading && !error && roles.length > 0 && (
        <div role="list" aria-label="Daftar Role dan Permission">
          {roles.map((role: RoleSummaryDto) => (
            <div key={role.id} className={`${styles.roleRow} role-row`} role="listitem">
              <div className={styles.roleMeta}>
                <strong className={styles.roleName}>{role.name}</strong>
                <span className={styles.roleSlug}>{role.slug}</span>
              </div>
              <div className={`${styles.permissionTags} permission-tags`}>
                {role.permissions && role.permissions.length > 0 ? (
                  role.permissions.map((permission) => (
                    <span
                      key={permission}
                      className={`${styles.permissionTag} permission-tag`}
                    >
                      {permission}
                    </span>
                  ))
                ) : (
                  <span className={styles.emptyPermissions}>Tidak ada izin khusus</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
