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
import { clearAllAdminCaches } from "../utils/admin-cache";
import styles from "./role-permission-viewer.module.css";

type View = "roles" | "permissions";
type Editor = { kind: "role"; item?: RoleSummaryDto } | { kind: "permission"; item?: PermissionSummaryDto };
type DetailTarget = { kind: "role"; item: RoleSummaryDto } | { kind: "permission"; item: PermissionSummaryDto };

export function RolePermissionViewer({ view = "roles", canManage = false }: { view?: View; canManage?: boolean }) {
  const roleState = useRoles();
  const permissionState = usePermissions();
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoleSummaryDto | PermissionSummaryDto | null>(null);
  const [detailTarget, setDetailTarget] = useState<DetailTarget | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const query = search.trim().toLocaleLowerCase("id");
  const isRoles = view === "roles";
  const items = isRoles ? roleState.roles : permissionState.permissions;
  const loading = isRoles ? roleState.loading : permissionState.loading;
  const error = isRoles ? roleState.error ?? (canManage ? permissionState.error : null) : permissionState.error;

  const visibleItems = items.filter((item) => {
    if ("permissions" in item) {
      // Role search: name, slug, permission slugs, permission names, user names
      const values = [
        item.name,
        item.slug,
        ...item.permissions,
        ...(item.permissionDetails?.map((p) => p.name) ?? []),
        ...(item.users?.map((u) => u.name) ?? [])
      ];
      return values.some((value) => value.toLocaleLowerCase("id").includes(query));
    } else {
      // Permission search: name, slug, connected role names, connected menu titles
      const values = [
        item.name,
        item.slug,
        ...(item.roles?.map((r) => r.name) ?? []),
        ...(item.menus?.map((m) => m.title) ?? [])
      ];
      return values.some((value) => value.toLocaleLowerCase("id").includes(query));
    }
  });

  async function refreshAll() {
    clearAllAdminCaches();
    await Promise.all([roleState.refresh(), permissionState.refresh()]);
  }

  async function submitEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || saving) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const slug = String(form.get("slug") ?? "").trim().toLowerCase();
    const base = editor.kind === "role" ? "/admin/rbac/roles" : "/admin/rbac/permissions";
    const body =
      editor.kind === "role"
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

  const editorTitle = editor
    ? `${editor.item ? "Edit" : "Tambah"} ${editor.kind === "role" ? "role" : "izin"}`
    : "Editor akses";

  return (
    <section className={styles.card} aria-label={isRoles ? "Manajemen role" : "Manajemen izin"}>
      <div className={styles.heading}>
        <div>
          <p className={styles.kicker}>{isRoles ? "ROLE" : "IZIN AKSES"}</p>
          <h3 className={styles.title}>{isRoles ? "Role dan cakupan akses" : "Katalog izin sistem"}</h3>
          <p className={styles.subtitle}>
            {isRoles
              ? "Atur kelompok akses dan izin yang dimiliki setiap role. Role kemudian diberikan kepada akun pengguna."
              : "Kelola identifier izin yang dipakai oleh role dan menu. Izin yang sedang aktif terikat tidak dapat dihapus."}
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => {
              setFormError(null);
              setEditor({ kind: isRoles ? "role" : "permission" });
            }}
          >
            + Tambah {isRoles ? "Role" : "Izin"}
          </Button>
        )}
      </div>

      {!canManage && (
        <p className={styles.readonlyNote}>Mode baca. Perubahan role dan izin hanya tersedia untuk Administrator.</p>
      )}

      {/* Educational Banner */}
      {!isRoles ? (
        <div className={styles.infoBanner}>
          <div className={styles.infoBannerIcon}>💡</div>
          <div className={styles.infoBannerContent}>
            <h4 className={styles.infoBannerTitle}>Panduan Izin Akses &amp; Mengapa Tombol Hapus Nonaktif</h4>
            <div className={styles.infoBannerGrid}>
              <div className={styles.infoBannerCol}>
                <strong>1. Apa itu Izin (Permission)?</strong>
                <p>
                  Izin adalah hak akses spesifik (misal: melihat data, mengelola fitur). Izin dikelompokkan ke dalam{" "}
                  <strong>Role</strong>, lalu Role diberikan ke pengguna.
                </p>
              </div>
              <div className={styles.infoBannerCol}>
                <strong>2. Hubungan dengan Menu</strong>
                <p>
                  Menu navigasi memakai izin sebagai syarat tampil. Hanya pengguna dengan role yang memiliki izin tersebut
                  yang dapat melihat menu bersangkutan.
                </p>
              </div>
              <div className={styles.infoBannerCol}>
                <strong>3. Cara Menghapus Izin</strong>
                <p>
                  Izin hanya bisa dihapus jika <strong>0 role</strong> dan <strong>0 menu</strong> yang menggunakannya.
                  Lepaskan izin dari role di menu <em>Role</em> untuk mengaktifkan tombol hapus.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.infoBanner}>
          <div className={styles.infoBannerIcon}>🛡️</div>
          <div className={styles.infoBannerContent}>
            <h4 className={styles.infoBannerTitle}>Panduan Role &amp; Hak Akses Pengguna</h4>
            <div className={styles.infoBannerGrid}>
              <div className={styles.infoBannerCol}>
                <strong>1. Apa itu Role?</strong>
                <p>Role adalah peran pekerjaan (misal: Administrator, HR, Ops Telco) yang memegang satu set izin akses.</p>
              </div>
              <div className={styles.infoBannerCol}>
                <strong>2. Hubungan dengan Pengguna</strong>
                <p>Satu pengguna dapat memiliki beberapa role. Hak akses pengguna adalah gabungan seluruh izin dari role-nya.</p>
              </div>
              <div className={styles.infoBannerCol}>
                <strong>3. Syarat Hapus Role</strong>
                <p>Role hanya dapat dihapus jika <strong>0 pengguna</strong> terdaftar dan bukan merupakan role bawaan sistem.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {notice && (
        <div className={styles.notice} role="status">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Tutup pemberitahuan">
            ×
          </button>
        </div>
      )}

      <div className={styles.toolbar}>
        <FormField
          label={`Cari ${isRoles ? "role" : "izin"}`}
          name="access-search"
          type="text"
          placeholder={`Cari nama, slug ${isRoles ? "role, izin, atau pengguna" : "izin, role terkait, atau menu"}...`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Button variant="secondary" size="sm" loading={loading} loadingText="Memuat..." onClick={refreshAll}>
          Muat ulang
        </Button>
      </div>

      {error && (
        <div className={styles.errorBanner} role="alert">
          <span>{error}</span>
          <Button variant="secondary" size="sm" onClick={refreshAll}>
            Coba lagi
          </Button>
        </div>
      )}

      {loading && (
        <div role="status" aria-label={`Memuat ${isRoles ? "role" : "izin"}...`} data-skeleton="true">
          {[1, 2, 3].map((i) => (
            <div className={styles.skeletonRow} key={i} />
          ))}
        </div>
      )}

      {!loading && !error && (
        <>
          <p className={styles.summary} role="status">
            {visibleItems.length} {isRoles ? "role" : "izin"}
            {query ? " ditemukan" : " tersedia"}
          </p>
          {visibleItems.length === 0 ? (
            <EmptyState
              title={query ? "Tidak ada hasil" : `Belum ada ${isRoles ? "role" : "izin"}`}
              description={query ? "Coba nama atau slug yang berbeda." : "Data akses baru akan tampil di sini."}
            />
          ) : (
            <div className={styles.grid}>
              {isRoles
                ? (visibleItems as RoleSummaryDto[]).map((role) => (
                    <RoleCard
                      key={role.id}
                      role={role}
                      canManage={canManage}
                      onOpenDetail={() => setDetailTarget({ kind: "role", item: role })}
                      onEdit={() => {
                        setFormError(null);
                        setEditor({ kind: "role", item: role });
                      }}
                      onDelete={() => {
                        setFormError(null);
                        setDeleteTarget(role);
                      }}
                    />
                  ))
                : (visibleItems as PermissionSummaryDto[]).map((permission) => (
                    <PermissionCard
                      key={permission.id}
                      permission={permission}
                      canManage={canManage}
                      onOpenDetail={() => setDetailTarget({ kind: "permission", item: permission })}
                      onEdit={() => {
                        setFormError(null);
                        setEditor({ kind: "permission", item: permission });
                      }}
                      onDelete={() => {
                        setFormError(null);
                        setDeleteTarget(permission);
                      }}
                    />
                  ))}
            </div>
          )}
        </>
      )}

      {/* Editor Modal */}
      <Modal
        open={Boolean(editor)}
        onClose={() => !saving && setEditor(null)}
        title={editorTitle}
        size="md"
        footer={
          <>
            <Button variant="secondary" disabled={saving} onClick={() => setEditor(null)}>
              Batal
            </Button>
            <Button type="submit" form="rbac-editor" loading={saving} loadingText="Menyimpan...">
              Simpan
            </Button>
          </>
        }
      >
        {editor && (
          <RbacEditor
            editor={editor}
            permissions={permissionState.permissions}
            error={formError}
            onSubmit={submitEditor}
          />
        )}
      </Modal>

      {/* Detail Keterkaitan Modal */}
      <Modal
        open={Boolean(detailTarget)}
        onClose={() => setDetailTarget(null)}
        title={
          detailTarget?.kind === "permission"
            ? `Detail Keterkaitan Izin: ${detailTarget.item.name}`
            : `Detail Role: ${detailTarget?.item.name}`
        }
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDetailTarget(null)}>
              Tutup
            </Button>
            {detailTarget &&
              canManage &&
              !detailTarget.item.isSystem &&
              (detailTarget.kind === "permission"
                ? detailTarget.item.roleCount === 0 && detailTarget.item.menuCount === 0
                : detailTarget.item.userCount === 0) && (
                <Button
                  variant="danger"
                  onClick={() => {
                    const item = detailTarget.item;
                    setDetailTarget(null);
                    setDeleteTarget(item);
                  }}
                >
                  Hapus {detailTarget.kind === "permission" ? "Izin" : "Role"} Sekarang
                </Button>
              )}
          </>
        }
      >
        {detailTarget && (
          <DetailModalContent
            target={detailTarget}
            onNavigateRole={() => setDetailTarget(null)}
          />
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => !saving && setDeleteTarget(null)}
        title={`Hapus ${deleteTarget && "permissions" in deleteTarget ? "role" : "izin"}?`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" disabled={saving} onClick={() => setDeleteTarget(null)}>
              Batal
            </Button>
            <Button variant="danger" loading={saving} loadingText="Menghapus..." onClick={confirmDelete}>
              Hapus permanen
            </Button>
          </>
        }
      >
        <p className={styles.confirmText}>
          Data <strong>{deleteTarget?.name}</strong> akan dihapus permanen dari sistem.
        </p>
        {formError && (
          <p className={styles.formError} role="alert">
            {formError}
          </p>
        )}
      </Modal>
    </section>
  );
}

function RoleCard({
  role,
  canManage,
  onOpenDetail,
  onEdit,
  onDelete
}: {
  role: RoleSummaryDto;
  canManage: boolean;
  onOpenDetail: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isDeletable = !role.isSystem && role.userCount === 0;

  return (
    <article className={styles.itemCard}>
      <div className={styles.itemHead}>
        <div>
          <h4>{role.name}</h4>
          <code>{role.slug}</code>
        </div>
        {role.isSystem ? (
          <Badge variant="warning">Bawaan Sistem</Badge>
        ) : role.userCount > 0 ? (
          <Badge variant="neutral">{role.userCount} Pengguna</Badge>
        ) : (
          <Badge variant="success">Siap Dihapus</Badge>
        )}
      </div>

      <div className={styles.metrics}>
        <span>
          <strong>{role.userCount}</strong> pengguna
        </span>
        <span>
          <strong>{role.permissions.length}</strong> izin
        </span>
      </div>

      {/* Pengguna Terdaftar */}
      <div className={styles.sectionBlock}>
        <div className={styles.sectionLabel}>
          <span>Pengguna yang Memiliki Role Ini</span>
          <span className={styles.countBadge}>{role.users?.length ?? role.userCount}</span>
        </div>
        <div className={styles.pillList}>
          {role.users && role.users.length > 0 ? (
            <>
              {role.users.slice(0, 3).map((user) => (
                <span key={user.id} className={styles.userPill} title={user.email}>
                  👤 {user.name}
                </span>
              ))}
              {role.users.length > 3 && (
                <span className={styles.morePill}>+{role.users.length - 3} lainnya</span>
              )}
            </>
          ) : (
            <span className={styles.emptyNote}>Belum ada pengguna yang memiliki role ini</span>
          )}
        </div>
      </div>

      {/* Izin Akses */}
      <div className={styles.sectionBlock}>
        <div className={styles.sectionLabel}>
          <span>Cakupan Izin Akses</span>
          <span className={styles.countBadge}>{role.permissions.length}</span>
        </div>
        <div className={styles.pillList}>
          {role.permissionDetails && role.permissionDetails.length > 0 ? (
            <>
              {role.permissionDetails.slice(0, 4).map((permission) => (
                <Badge key={permission.id} variant="accent" title={`Slug: ${permission.slug}`}>
                  {permission.name}
                </Badge>
              ))}
              {role.permissionDetails.length > 4 && (
                <span className={styles.morePill}>+{role.permissionDetails.length - 4} lainnya</span>
              )}
            </>
          ) : role.permissions.length > 0 ? (
            <>
              {role.permissions.slice(0, 4).map((slug) => (
                <Badge key={slug} variant="accent">
                  {slug}
                </Badge>
              ))}
              {role.permissions.length > 4 && (
                <span className={styles.morePill}>+{role.permissions.length - 4} lainnya</span>
              )}
            </>
          ) : (
            <span className={styles.emptyNote}>Tanpa izin</span>
          )}
        </div>
      </div>

      {/* Status Box */}
      <div
        className={`${styles.statusBox} ${
          role.isSystem ? styles.statusSystem : role.userCount > 0 ? styles.statusInUse : styles.statusReady
        }`}
      >
        {role.isSystem ? (
          <>
            <span className={styles.statusIcon}>🔒</span>
            <div>
              <strong>Role Bawaan Sistem Dilindungi</strong>
              <p>Role ini merupakan peran inti administratif dan dilindungi permanen dari penghapusan.</p>
            </div>
          </>
        ) : role.userCount > 0 ? (
          <>
            <span className={styles.statusIcon}>⚠️</span>
            <div>
              <strong>Role Sedang Digunakan ({role.userCount} pengguna)</strong>
              <p>
                Untuk menghapus, ubah atau lepaskan role ini dari akun pengguna terkait di menu{" "}
                <em>Pengguna</em>.
              </p>
            </div>
          </>
        ) : (
          <>
            <span className={styles.statusIcon}>✅</span>
            <div>
              <strong>Aman untuk Dihapus</strong>
              <p>Role ini tidak sedang digunakan oleh pengguna manapun.</p>
            </div>
          </>
        )}
      </div>

      <div className={styles.actions}>
        <Button variant="secondary" size="sm" onClick={onOpenDetail}>
          Detail Role
        </Button>
        {canManage && (
          <>
            <Button variant="secondary" size="sm" onClick={onEdit}>
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={!isDeletable}
              title={
                role.isSystem
                  ? "Role bawaan dilindungi"
                  : role.userCount > 0
                  ? `Masih digunakan oleh ${role.userCount} pengguna`
                  : undefined
              }
              onClick={onDelete}
            >
              Hapus
            </Button>
          </>
        )}
      </div>
    </article>
  );
}

function PermissionCard({
  permission,
  canManage,
  onOpenDetail,
  onEdit,
  onDelete
}: {
  permission: PermissionSummaryDto;
  canManage: boolean;
  onOpenDetail: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isDeletable = !permission.isSystem && permission.roleCount === 0 && permission.menuCount === 0;

  return (
    <article className={styles.itemCard}>
      <div className={styles.itemHead}>
        <div>
          <h4>{permission.name}</h4>
          <code>{permission.slug}</code>
        </div>
        {permission.isSystem ? (
          <Badge variant="warning">Bawaan Sistem</Badge>
        ) : permission.roleCount > 0 || permission.menuCount > 0 ? (
          <Badge variant="neutral">
            Digunakan ({permission.roleCount} role{permission.menuCount > 0 ? `, ${permission.menuCount} menu` : ""})
          </Badge>
        ) : (
          <Badge variant="success">Siap Dihapus</Badge>
        )}
      </div>

      <div className={styles.metrics}>
        <span>
          <strong>{permission.roleCount}</strong> role
        </span>
        <span>
          <strong>{permission.menuCount}</strong> menu
        </span>
      </div>

      {/* Role Terhubung */}
      <div className={styles.sectionBlock}>
        <div className={styles.sectionLabel}>
          <span>Role yang Menggunakan Izin Ini</span>
          <span className={styles.countBadge}>{permission.roles?.length ?? permission.roleCount}</span>
        </div>
        <div className={styles.pillList}>
          {permission.roles && permission.roles.length > 0 ? (
            <>
              {permission.roles.slice(0, 4).map((role) => (
                <span key={role.id} className={styles.rolePill} title={`Slug: ${role.slug}`}>
                  🛡️ {role.name}
                </span>
              ))}
              {permission.roles.length > 4 && (
                <span className={styles.morePill}>+{permission.roles.length - 4} lainnya</span>
              )}
            </>
          ) : (
            <span className={styles.emptyNote}>Tidak ada role yang menggunakan izin ini</span>
          )}
        </div>
      </div>

      {/* Menu Navigasi Terkait */}
      <div className={styles.sectionBlock}>
        <div className={styles.sectionLabel}>
          <span>Menu Navigasi Terkait</span>
          <span className={styles.countBadge}>{permission.menus?.length ?? permission.menuCount}</span>
        </div>
        <div className={styles.pillList}>
          {permission.menus && permission.menus.length > 0 ? (
            <>
              {permission.menus.slice(0, 3).map((menu) => (
                <span key={menu.id} className={styles.menuPill} title={menu.url ?? undefined}>
                  🧭 {menu.title} {menu.url ? `(${menu.url})` : ""}
                </span>
              ))}
              {permission.menus.length > 3 && (
                <span className={styles.morePill}>+{permission.menus.length - 3} lainnya</span>
              )}
            </>
          ) : (
            <span className={styles.emptyNote}>Tidak ada menu yang mensyaratkan izin ini</span>
          )}
        </div>
      </div>

      {/* Status Box */}
      <div
        className={`${styles.statusBox} ${
          permission.isSystem
            ? styles.statusSystem
            : permission.roleCount > 0 || permission.menuCount > 0
            ? styles.statusInUse
            : styles.statusReady
        }`}
      >
        {permission.isSystem ? (
          <>
            <span className={styles.statusIcon}>🔒</span>
            <div>
              <strong>Izin Inti Sistem Dilindungi</strong>
              <p>Izin bawaan aplikasi terkunci permanen agar stabilitas dan keamanan sistem tetap terjaga.</p>
            </div>
          </>
        ) : permission.roleCount > 0 || permission.menuCount > 0 ? (
          <>
            <span className={styles.statusIcon}>⚠️</span>
            <div>
              <strong>Izin Terkunci dari Penghapusan</strong>
              <p>
                Masih terikat pada{" "}
                <strong>
                  {permission.roles && permission.roles.length > 0
                    ? permission.roles.map((r) => r.name).join(", ")
                    : `${permission.roleCount} role`}
                </strong>
                {permission.menuCount > 0 ? ` dan ${permission.menuCount} menu` : ""}. Untuk menghapus, hilangkan centang
                izin ini dari role terkait di menu <em>Role</em>.
              </p>
            </div>
          </>
        ) : (
          <>
            <span className={styles.statusIcon}>✅</span>
            <div>
              <strong>Aman untuk Dihapus</strong>
              <p>Izin ini tidak sedang digunakan oleh role maupun menu manapun.</p>
            </div>
          </>
        )}
      </div>

      <div className={styles.actions}>
        <Button variant="secondary" size="sm" onClick={onOpenDetail}>
          Detail Keterkaitan
        </Button>
        {canManage && (
          <>
            <Button variant="secondary" size="sm" onClick={onEdit}>
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={!isDeletable}
              title={
                permission.isSystem
                  ? "Izin bawaan sistem dilindungi"
                  : permission.roleCount > 0 || permission.menuCount > 0
                  ? `Masih digunakan oleh ${permission.roleCount} role dan ${permission.menuCount} menu`
                  : undefined
              }
              onClick={onDelete}
            >
              Hapus
            </Button>
          </>
        )}
      </div>
    </article>
  );
}

function DetailModalContent({
  target,
  onNavigateRole
}: {
  target: DetailTarget;
  onNavigateRole?: () => void;
}) {
  if (target.kind === "permission") {
    const permission = target.item;
    const isLocked = permission.isSystem || permission.roleCount > 0 || permission.menuCount > 0;

    return (
      <div>
        <div className={styles.detailSection}>
          <div className={styles.detailHeader}>
            <h4>Informasi Izin</h4>
            {permission.isSystem ? (
              <Badge variant="warning">Izin Inti Bawaan</Badge>
            ) : (
              <Badge variant="neutral">Izin Kustom</Badge>
            )}
          </div>
          <div className={styles.detailRow}>
            <span>Nama Izin:</span>
            <strong>{permission.name}</strong>
          </div>
          <div className={styles.detailRow} style={{ marginTop: 6 }}>
            <span>Slug Teknis:</span>
            <code>{permission.slug}</code>
          </div>
        </div>

        <div className={styles.detailSection}>
          <div className={styles.detailHeader}>
            <h4>Role yang Menggunakan ({permission.roles?.length ?? permission.roleCount})</h4>
          </div>
          {permission.roles && permission.roles.length > 0 ? (
            <div className={styles.detailList}>
              {permission.roles.map((role) => (
                <div key={role.id} className={styles.detailRow}>
                  <div>
                    <strong>🛡️ {role.name}</strong>
                    <div>
                      <code style={{ fontSize: 10 }}>{role.slug}</code>
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: "#2563eb" }}>Terhubung</span>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.emptyNote}>Tidak ada role yang menggunakan izin ini.</p>
          )}
        </div>

        <div className={styles.detailSection}>
          <div className={styles.detailHeader}>
            <h4>Menu Navigasi yang Mensyaratkan ({permission.menus?.length ?? permission.menuCount})</h4>
          </div>
          {permission.menus && permission.menus.length > 0 ? (
            <div className={styles.detailList}>
              {permission.menus.map((menu) => (
                <div key={menu.id} className={styles.detailRow}>
                  <div>
                    <strong>🧭 {menu.title}</strong>
                    {menu.url && <div style={{ fontSize: 11, color: "#64748b" }}>{menu.url}</div>}
                  </div>
                  <span style={{ fontSize: 11, color: "#059669" }}>Memerlukan Izin</span>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.emptyNote}>Tidak ada menu yang mensyaratkan izin ini.</p>
          )}
        </div>

        {/* Panduan Penghapusan */}
        <div className={styles.guideBox}>
          <div className={styles.guideBoxTitle}>
            <span>ℹ️</span> Panduan Menghapus Izin Ini:
          </div>
          {permission.isSystem ? (
            <p style={{ margin: 0 }}>
              Izin ini dibuat oleh sistem inti aplikasi MKN Site. Izin tidak dapat dihapus demi keamanan dan keutuhan
              sistem aplikasi.
            </p>
          ) : isLocked ? (
            <ol>
              <li>
                Buka tab <strong>Role</strong> pada menu User Management.
              </li>
              <li>
                Cari role yang tercantum di atas (
                {permission.roles?.map((r) => r.name).join(", ") || "role terkait"}), klik tombol <strong>Edit</strong>
                , dan hilangkan centang pada izin <strong>{permission.name}</strong>.
              </li>
              {permission.menuCount > 0 && (
                <li>
                  Buka menu <strong>Menu Navigasi</strong>, lalu ubah atau kosongkan syarat izin pada menu terkait.
                </li>
              )}
              <li>
                Setelah role dan menu menjadi <strong>0</strong>, kembali ke tab ini dan tombol <strong>Hapus</strong>{" "}
                akan aktif secara otomatis.
              </li>
            </ol>
          ) : (
            <p style={{ margin: 0 }}>
              Izin ini tidak sedang digunakan oleh role maupun menu manapun. Anda dapat langsung menghapusnya secara aman
              menggunakan tombol hapus di bawah.
            </p>
          )}
        </div>
      </div>
    );
  }

  // target.kind === "role"
  const role = target.item;
  const isLocked = role.isSystem || role.userCount > 0;

  return (
    <div>
      <div className={styles.detailSection}>
        <div className={styles.detailHeader}>
          <h4>Informasi Role</h4>
          {role.isSystem ? (
            <Badge variant="warning">Role Inti Bawaan</Badge>
          ) : (
            <Badge variant="neutral">Role Kustom</Badge>
          )}
        </div>
        <div className={styles.detailRow}>
          <span>Nama Role:</span>
          <strong>{role.name}</strong>
        </div>
        <div className={styles.detailRow} style={{ marginTop: 6 }}>
          <span>Slug Teknis:</span>
          <code>{role.slug}</code>
        </div>
      </div>

      <div className={styles.detailSection}>
        <div className={styles.detailHeader}>
          <h4>Pengguna yang Terdaftar ({role.users?.length ?? role.userCount})</h4>
        </div>
        {role.users && role.users.length > 0 ? (
          <div className={styles.detailList}>
            {role.users.map((user) => (
              <div key={user.id} className={styles.detailRow}>
                <div>
                  <strong>👤 {user.name}</strong>
                  <div style={{ fontSize: 11, color: "#64748b" }}>{user.email}</div>
                </div>
                <span style={{ fontSize: 11, color: "#7c3aed" }}>Aktif</span>
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.emptyNote}>Belum ada pengguna yang terdaftar pada role ini.</p>
        )}
      </div>

      <div className={styles.detailSection}>
        <div className={styles.detailHeader}>
          <h4>Izin yang Dimiliki ({role.permissions.length})</h4>
        </div>
        <div className={styles.pillList}>
          {role.permissionDetails && role.permissionDetails.length > 0 ? (
            role.permissionDetails.map((p) => (
              <Badge key={p.id} variant="accent" title={`Slug: ${p.slug}`}>
                {p.name}
              </Badge>
            ))
          ) : role.permissions.length > 0 ? (
            role.permissions.map((slug) => (
              <Badge key={slug} variant="accent">
                {slug}
              </Badge>
            ))
          ) : (
            <span className={styles.emptyNote}>Role ini belum memiliki izin akses.</span>
          )}
        </div>
      </div>

      <div className={styles.guideBox}>
        <div className={styles.guideBoxTitle}>
          <span>ℹ️</span> Panduan Menghapus Role Ini:
        </div>
        {role.isSystem ? (
          <p style={{ margin: 0 }}>
            Role ini adalah role inti sistem (Administrator/Superadmin) dan dilindungi permanen dari penghapusan.
          </p>
        ) : isLocked ? (
          <ol>
            <li>
              Buka menu <strong>Pengguna</strong> pada User Management.
            </li>
            <li>
              Cari pengguna yang tercantum di atas, buka detail pengguna lalu ubah atau hapus role ini dari akun mereka.
            </li>
            <li>
              Setelah jumlah pengguna menjadi <strong>0</strong>, kembali ke tab ini dan tombol <strong>Hapus</strong>{" "}
              akan aktif secara otomatis.
            </li>
          </ol>
        ) : (
          <p style={{ margin: 0 }}>
            Role ini tidak digunakan oleh pengguna manapun. Anda dapat langsung menghapusnya secara aman.
          </p>
        )}
      </div>
    </div>
  );
}

function RbacEditor({
  editor,
  permissions,
  error,
  onSubmit
}: {
  editor: Editor;
  permissions: PermissionSummaryDto[];
  error: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const role = editor.kind === "role" ? editor.item : undefined;
  const permission = editor.kind === "permission" ? editor.item : undefined;
  const selected = useMemo(() => new Set(role?.permissionIds ?? []), [role]);
  const slugLocked = Boolean(editor.item?.isSystem);

  return (
    <form id="rbac-editor" className={styles.form} onSubmit={onSubmit}>
      <FormField
        label="Nama"
        name="name"
        required
        maxLength={editor.kind === "role" ? 100 : 140}
        defaultValue={role?.name ?? permission?.name ?? ""}
        placeholder={editor.kind === "role" ? "Contoh: Supervisor Lapangan" : "Contoh: Lihat laporan aset"}
      />
      <FormField
        label="Slug"
        name="slug"
        required
        maxLength={editor.kind === "role" ? 100 : 140}
        pattern="[a-z0-9]+(?:[-._][a-z0-9]+)*"
        defaultValue={role?.slug ?? permission?.slug ?? ""}
        readOnly={slugLocked}
        aria-describedby="slug-help"
        placeholder={editor.kind === "role" ? "supervisor-lapangan" : "asset.report.view"}
      />
      <p className={styles.help} id="slug-help">
        Gunakan huruf kecil, angka, titik, garis bawah, atau tanda hubung.
        {slugLocked ? " Slug bawaan dikunci agar integrasi tetap aman." : ""}
      </p>
      {editor.kind === "role" && (
        <fieldset className={styles.permissionPicker}>
          <legend>Izin role</legend>
          <p>Pilih izin yang langsung dimiliki role ini.</p>
          <div className={styles.checkGrid}>
            {permissions.map((item) => (
              <label key={item.id}>
                <input
                  type="checkbox"
                  name="permissionIds"
                  value={item.id}
                  defaultChecked={selected.has(item.id)}
                />
                <span>
                  <strong>{item.name}</strong>
                  <code>{item.slug}</code>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {error && (
        <p className={styles.formError} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
