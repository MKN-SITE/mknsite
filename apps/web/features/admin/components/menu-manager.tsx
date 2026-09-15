"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { api } from "@/lib/api";
import { useRoles } from "../hooks/use-roles";
import { useMenus, type MenuSummaryDto } from "../hooks/use-menus";
import { MenuIcon, PRESET_MENU_ICONS } from "./menu-icon";
import styles from "./menu-manager.module.css";

export function MenuManager() {
  const { menus, loading, error, refresh, toggleStatus, reorderMenu, deleteMenu } = useMenus();
  const { roles } = useRoles();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<MenuSummaryDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MenuSummaryDto | null>(null);

  // Form states
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("user-circle");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [requiredPermission, setRequiredPermission] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [badgeCount, setBadgeCount] = useState(0);
  const [badgeColor, setBadgeColor] = useState("orange");
  const [isActive, setIsActive] = useState(true);

  // Enhanced Icon Picker states
  const [iconTab, setIconTab] = useState<"preset" | "upload" | "custom">("preset");
  const [iconSearch, setIconSearch] = useState("");
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fieldErrors, setFieldErrors] = useState<{ title?: string; url?: string }>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Filtered preset icons based on search keyword
  const filteredPresetIcons = useMemo(() => {
    const q = iconSearch.trim().toLowerCase();
    if (!q) return PRESET_MENU_ICONS;
    return PRESET_MENU_ICONS.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.label.toLowerCase().includes(q) ||
        item.keywords.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [iconSearch]);

  // Extract unique permissions from roles
  const availablePermissions = useMemo(() => {
    const set = new Set<string>();
    roles.forEach((r) => {
      r.permissions?.forEach((p) => set.add(p));
    });
    if (editingMenu?.requiredPermission) {
      set.add(editingMenu.requiredPermission);
    }
    return Array.from(set).sort();
  }, [roles, editingMenu?.requiredPermission]);

  const openCreateModal = () => {
    setEditingMenu(null);
    setTitle("");
    setIcon("user-circle");
    setIconTab("preset");
    setIconSearch("");
    setUploadError(null);
    setDescription("");
    setUrl("/portal/");
    setRequiredPermission("");
    setSortOrder(menus.length > 0 ? Math.max(...menus.map((m) => m.sortOrder)) + 1 : 1);
    setBadgeCount(0);
    setBadgeColor("orange");
    setIsActive(true);
    setFieldErrors({});
    setApiError(null);
    setModalOpen(true);
  };

  const openEditModal = (menu: MenuSummaryDto) => {
    setEditingMenu(menu);
    setTitle(menu.title);
    const menuIcon = menu.icon || "user-circle";
    setIcon(menuIcon);
    setIconSearch("");
    setUploadError(null);
    if (menuIcon.startsWith("/") || menuIcon.startsWith("http") || menuIcon.startsWith("data:image/")) {
      setIconTab("upload");
    } else if (menuIcon.startsWith("<svg")) {
      setIconTab("custom");
    } else {
      setIconTab("preset");
    }
    setDescription(menu.description || "");
    setUrl(menu.url || "");
    setRequiredPermission(menu.requiredPermission || "");
    setSortOrder(menu.sortOrder);
    setBadgeCount(menu.badgeCount || 0);
    setBadgeColor(menu.badgeColor || "orange");
    setIsActive(Boolean(menu.isActive));
    setFieldErrors({});
    setApiError(null);
    setModalOpen(true);
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);

    if (file.size > 2 * 1024 * 1024) {
      setUploadError("Ukuran file icon maksimal 2 MB.");
      return;
    }

    setUploadingIcon(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api<{ data: { iconUrl: string } }>("/admin/menus/upload-icon", {
        method: "POST",
        body: formData
      });
      if (res?.data?.iconUrl) {
        setIcon(res.data.iconUrl);
      }
    } catch (err: any) {
      setUploadError(err?.message || "Gagal mengunggah icon.");
    } finally {
      setUploadingIcon(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const validate = (): boolean => {
    const errors: { title?: string; url?: string } = {};
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      errors.title = "Judul menu wajib diisi";
    } else if (trimmedTitle.length > 100) {
      errors.title = "Judul menu maksimal 100 karakter";
    }

    const trimmedUrl = url.trim();
    if (trimmedUrl.length > 500) {
      errors.url = "URL tujuan maksimal 500 karakter";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveMenu = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!validate()) return;

    setSubmitting(true);
    setApiError(null);

    const payload = {
      title: title.trim(),
      icon: icon || null,
      description: description.trim() || null,
      url: url.trim() || null,
      requiredPermission: requiredPermission.trim() || null,
      sortOrder: Number(sortOrder) || 0,
      badgeCount: 0,
      badgeColor: "orange",
      isActive: Boolean(isActive)
    };

    try {
      if (editingMenu) {
        await api(`/admin/menus/${editingMenu.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload)
        });
      } else {
        await api("/admin/menus", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      }

      setModalOpen(false);
      await refresh();
    } catch (err: any) {
      setApiError(err?.message ?? "Gagal menyimpan data menu.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await deleteMenu(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err: any) {
      alert(err?.message ?? "Gagal menghapus menu.");
    } finally {
      setDeleting(false);
    }
  };

  const getBadgeClass = (color: string) => {
    switch (color) {
      case "blue":
        return styles.badgePillBlue;
      case "red":
        return styles.badgePillRed;
      case "green":
        return styles.badgePillGreen;
      case "orange":
      default:
        return styles.badgePillOrange;
    }
  };

  const columns: Column<MenuSummaryDto>[] = [
    {
      key: "sortOrder",
      header: "Urutan",
      render: (row: MenuSummaryDto) => {
        const currentIndex = menus.findIndex((m) => m.id === row.id);
        const isFirst = currentIndex === 0;
        const isLast = currentIndex === menus.length - 1;

        return (
          <div className={styles.orderCell}>
            <span className={styles.orderNumber}>{row.sortOrder}</span>
            <div className={styles.reorderBtns}>
              <button
                type="button"
                className={styles.reorderBtn}
                onClick={() => reorderMenu(row.id, "up")}
                disabled={isFirst}
                aria-label={`Pindahkan menu ${row.title} ke atas`}
                title="Pindah ke atas"
              >
                ▲
              </button>
              <button
                type="button"
                className={styles.reorderBtn}
                onClick={() => reorderMenu(row.id, "down")}
                disabled={isLast}
                aria-label={`Pindahkan menu ${row.title} ke bawah`}
                title="Pindah ke bawah"
              >
                ▼
              </button>
            </div>
          </div>
        );
      }
    },
    {
      key: "menu",
      header: "Menu",
      render: (row: MenuSummaryDto) => (
        <div className={styles.menuCell}>
          <div className={styles.iconBox}>
            <MenuIcon name={row.icon} size={20} />
          </div>
          <div className={styles.menuMeta}>
            <div className={styles.menuTitleRow}>
              <span className={styles.menuTitle}>{row.title}</span>
              {row.badgeCount > 0 && (
                <span className={`${styles.badgePill} ${getBadgeClass(row.badgeColor)}`}>
                  {row.badgeCount}
                </span>
              )}
            </div>
            {row.description && <span className={styles.menuDesc}>{row.description}</span>}
          </div>
        </div>
      )
    },
    {
      key: "url",
      header: "URL Tujuan",
      render: (row: MenuSummaryDto) => <span className={styles.urlCell}>{row.url || "-"}</span>
    },
    {
      key: "permission",
      header: "Izin Akses",
      render: (row: MenuSummaryDto) =>
        row.requiredPermission ? (
          <Badge variant="accent">{row.requiredPermission}</Badge>
        ) : (
          <Badge variant="neutral">Semua Karyawan</Badge>
        )
    },
    {
      key: "status",
      header: "Status",
      render: (row: MenuSummaryDto) => (
        <button
          type="button"
          className={`${styles.statusToggleBtn} ${row.isActive ? styles.statusActive : styles.statusInactive}`}
          onClick={() => toggleStatus(row.id, row.isActive)}
          aria-label={`Ubah status menu ${row.title} menjadi ${row.isActive ? "Nonaktif" : "Aktif"}`}
        >
          <span>{row.isActive ? "● Aktif" : "○ Nonaktif"}</span>
        </button>
      )
    },
    {
      key: "actions",
      header: "Aksi",
      render: (row: MenuSummaryDto) => (
        <div className={styles.actionCell}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => openEditModal(row)}
            aria-label={`Edit menu ${row.title}`}
          >
            Edit
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setDeleteTarget(row)}
            aria-label={`Hapus menu ${row.title}`}
          >
            Hapus
          </Button>
        </div>
      )
    }
  ];

  return (
    <section className={styles.menuSection} aria-label="Manajemen Menu">
      <div className={styles.headerRow}>
        <div>
          <h3 className={styles.sectionTitle}>Menu Dinamis</h3>
          <p className={styles.sectionSubtitle}>
            Atur navigasi karyawan, gerbang modul bisnis, dan izin akses role.
            {!loading && <span className={styles.totalBadge}> Total: {menus.length} Menu</span>}
          </p>
        </div>
        <Button variant="primary" size="md" onClick={openCreateModal}>
          + Tambah Menu
        </Button>
      </div>

      {error && (
        <div className={styles.errorBanner} role="alert">
          <span>{error}</span>
          <Button variant="secondary" size="sm" onClick={() => refresh()}>
            Coba lagi
          </Button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={menus}
        loading={loading}
        emptyState={
          <EmptyState
            title="Belum ada menu"
            description="Tambahkan menu pertama agar modul bisnis dapat diakses karyawan."
          />
        }
      />

      {/* Modal Tambah / Edit Menu */}
      <Modal
        open={modalOpen}
        onClose={() => !submitting && setModalOpen(false)}
        title={editingMenu ? "Edit Menu" : "Tambah Menu Baru"}
        size="lg"
      >
        <p className={styles.modalSubtitle}>
          Kelola informasi menu, icon visual, URL tujuan, dan permission RBAC.
        </p>

        <form onSubmit={handleSaveMenu} className={styles.modalForm}>
          {apiError && (
            <div className={styles.errorBanner} role="alert">
              <span>{apiError}</span>
            </div>
          )}

          {/* Live Card Preview */}
          <div className={styles.cardPreviewSection}>
            <div className={styles.previewHeader}>
              <span className={styles.previewTitle}>Live Preview Kartu Menu</span>
              <span className={styles.previewHint}>Simulasi tampilan riil di portal karyawan</span>
            </div>
            <div className={styles.previewCardWrap}>
              <div className={styles.previewCard}>
                <div className={styles.previewIconWrapper}>
                  <MenuIcon name={icon} size={42} />
                </div>
                <div className={styles.previewTitleRow}>
                  <span className={styles.previewCardLabel}>
                    {title.trim() || "Judul Menu Baru"}
                  </span>
                </div>
                <span className={styles.previewCardDesc}>
                  {description.trim() || "Deskripsi fungsi modul operasional akan tampil di sini..."}
                </span>
              </div>
            </div>
          </div>

          <div className={styles.formGrid2}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="menu-title">
                Judul Menu <span className={styles.requiredAsterisk}>*</span>
              </label>
              <input
                id="menu-title"
                type="text"
                className={styles.inputControl}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: HR & Personalia"
                maxLength={100}
                required
              />
              <span className={styles.fieldHint}>
                Nama modul yang tampil pada navigasi karyawan
              </span>
              {fieldErrors.title && <p className={styles.fieldError}>{fieldErrors.title}</p>}
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="menu-url">
                URL Tujuan
              </label>
              <input
                id="menu-url"
                type="text"
                className={styles.inputControl}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="/portal/hr"
                maxLength={500}
              />
              <span className={styles.fieldHint}>Path tujuan dalam aplikasi web</span>
              {fieldErrors.url && <p className={styles.fieldError}>{fieldErrors.url}</p>}
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="menu-desc">
              Deskripsi Singkat
            </label>
            <input
              id="menu-desc"
              type="text"
              className={styles.inputControl}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contoh: Pengelolaan absensi, klaim, dan persetujuan cuti"
              maxLength={255}
            />
            <span className={styles.fieldHint}>Keterangan fungsi modul (opsional)</span>
          </div>

          {/* Enhanced Icon Picker with Tabs */}
          <div className={styles.iconPickerWrap}>
            <div className={styles.headerRow}>
              <span className={styles.fieldLabel}>Icon Menu Visual</span>
              <div className={styles.selectedIconChip}>
                Terpilih: <MenuIcon name={icon} size={16} /> <strong>{icon.length > 25 ? `${icon.substring(0, 22)}...` : icon}</strong>
              </div>
            </div>

            <div className={styles.iconTabs} role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={iconTab === "preset"}
                className={`${styles.iconTabBtn} ${iconTab === "preset" ? styles.iconTabBtnActive : ""}`}
                onClick={() => setIconTab("preset")}
              >
                Preset Icon ({PRESET_MENU_ICONS.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={iconTab === "upload"}
                className={`${styles.iconTabBtn} ${iconTab === "upload" ? styles.iconTabBtnActive : ""}`}
                onClick={() => setIconTab("upload")}
              >
                Upload File (SVG / PNG / WebP)
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={iconTab === "custom"}
                className={`${styles.iconTabBtn} ${iconTab === "custom" ? styles.iconTabBtnActive : ""}`}
                onClick={() => setIconTab("custom")}
              >
                URL / Kode SVG
              </button>
            </div>

            {iconTab === "preset" && (
              <>
                <input
                  type="text"
                  className={styles.iconSearchInput}
                  placeholder="Cari icon... (misal: tower, truk, helm, k3, wifi, database, kas, dokumen)"
                  value={iconSearch}
                  onChange={(e) => setIconSearch(e.target.value)}
                />
                <div className={styles.iconGrid} role="radiogroup" aria-label="Preset Icon Visual">
                  {filteredPresetIcons.length === 0 ? (
                    <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "12px", color: "var(--ink-soft)", fontSize: "12px" }}>
                      Tidak ada icon yang cocok dengan &quot;{iconSearch}&quot;
                    </div>
                  ) : (
                    filteredPresetIcons.map((item) => (
                      <button
                        key={item.name}
                        type="button"
                        role="radio"
                        aria-checked={icon === item.name}
                        className={`${styles.iconPickerItem} ${icon === item.name ? styles.iconPickerItemSelected : ""}`}
                        onClick={() => setIcon(item.name)}
                        title={`${item.label} (${item.category})`}
                        aria-label={item.label}
                      >
                        <MenuIcon name={item.name} size={22} />
                      </button>
                    ))
                  )}
                </div>
              </>
            )}

            {iconTab === "upload" && (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".svg,image/svg+xml,.png,image/png,.webp,image/webp,.jpg,.jpeg,image/jpeg"
                  style={{ display: "none" }}
                  onChange={handleIconUpload}
                />
                {icon.startsWith("/uploads/icons/") || icon.startsWith("data:image/") ? (
                  <div className={styles.uploadSuccess}>
                    <div className={styles.uploadPreviewItem}>
                      <div className={styles.uploadThumbnail}>
                        <MenuIcon name={icon} size={32} />
                      </div>
                      <div className={styles.uploadMeta}>
                        <span className={styles.uploadFileName}>Custom Icon Aktif</span>
                        <span className={styles.uploadFileStatus}>Tersimpan di server dan siap tampil</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingIcon}
                      >
                        {uploadingIcon ? "Mengunggah..." : "Ganti File"}
                      </Button>
                      <button
                        type="button"
                        className={styles.removeIconBtn}
                        onClick={() => setIcon("user-circle")}
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={styles.uploadDropzone}
                    onClick={() => !uploadingIcon && fileInputRef.current?.click()}
                  >
                    <div className={styles.uploadDropzoneInner}>
                      <MenuIcon name="camera" size={28} style={{ color: "var(--accent)" }} />
                      <span className={styles.uploadDropzoneText}>
                        {uploadingIcon ? "Sedang mengunggah file..." : "Klik untuk Pilih File Icon (SVG, PNG, WebP)"}
                      </span>
                      <span className={styles.uploadDropzoneSubtext}>
                        Ukuran maksimal 2 MB. Disarankan rasio kotak (1:1) dengan latar transparan.
                      </span>
                    </div>
                  </div>
                )}
                {uploadError && <p className={styles.fieldError}>{uploadError}</p>}
              </div>
            )}

            {iconTab === "custom" && (
              <div>
                <textarea
                  className={styles.customCodeTextarea}
                  placeholder="Tempelkan URL gambar (https://...) atau kode SVG (<svg>...</svg>)"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                />
                <span className={styles.fieldHint}>
                  Mendukung URL web gambar atau tag SVG inline langsung.
                </span>
              </div>
            )}
          </div>

          <div className={styles.formGrid2}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="menu-permission">
                Izin Akses (Permission)
              </label>
              <select
                id="menu-permission"
                className={styles.inputControl}
                value={requiredPermission}
                onChange={(e) => setRequiredPermission(e.target.value)}
              >
                <option value="">(Tanpa Izin / Terbuka untuk Semua Karyawan)</option>
                {availablePermissions.map((perm) => (
                  <option key={perm} value={perm}>
                    {perm}
                  </option>
                ))}
              </select>
              <span className={styles.fieldHint}>
                Karyawan dengan permission ini yang dapat melihat menu
              </span>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="menu-sort">
                Urutan Tampil (Sort Order)
              </label>
              <input
                id="menu-sort"
                type="number"
                className={styles.inputControl}
                value={sortOrder}
                onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
                min={0}
              />
              <span className={styles.fieldHint}>
                Urutan kemunculan menu di portal (angka kecil di atas)
              </span>
            </div>
          </div>


          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              className={styles.checkboxControl}
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <span className={styles.checkboxLabel}>Aktifkan menu ini untuk karyawan</span>
          </label>

          <div className={styles.modalFooter}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              {submitting ? "Menyimpan..." : editingMenu ? "Simpan Perubahan" : "Buat Menu"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Konfirmasi Hapus */}
      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => !deleting && setDeleteTarget(null)}
        title="Hapus Menu"
        size="sm"
      >
        <div className={styles.modalForm}>
          <p className={styles.deleteWarning}>
            Apakah Anda yakin ingin menghapus menu <strong>{deleteTarget?.title}</strong>? Menu ini
            tidak akan lagi muncul untuk karyawan. Tindakan ini dicatat dalam log audit.
          </p>

          <div className={styles.modalFooter}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={deleting}
              onClick={handleConfirmDelete}
            >
              {deleting ? "Menghapus..." : "Ya, Hapus Menu"}
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
