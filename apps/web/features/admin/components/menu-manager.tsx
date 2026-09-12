"use client";

import { useMemo, useState, type FormEvent } from "react";
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

  const [fieldErrors, setFieldErrors] = useState<{ title?: string; url?: string }>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
    setIcon(menu.icon || "user-circle");
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
      badgeCount: Number(badgeCount) || 0,
      badgeColor: badgeColor || "orange",
      isActive: isActive ? 1 : 0
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

          {/* Icon Picker Grid */}
          <div className={styles.iconPickerWrap}>
            <div className={styles.headerRow}>
              <span className={styles.fieldLabel}>Pilih Icon Visual</span>
              <div className={styles.selectedIconChip}>
                Terpilih: <MenuIcon name={icon} size={16} /> <strong>{icon}</strong>
              </div>
            </div>
            <div className={styles.iconGrid} role="radiogroup" aria-label="Preset Icon Visual">
              {PRESET_MENU_ICONS.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  role="radio"
                  aria-checked={icon === item.name}
                  className={`${styles.iconPickerItem} ${icon === item.name ? styles.iconPickerItemSelected : ""}`}
                  onClick={() => setIcon(item.name)}
                  title={item.label}
                  aria-label={item.label}
                >
                  <MenuIcon name={item.name} size={20} />
                </button>
              ))}
            </div>
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

          <div className={styles.formGrid2}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="menu-badge-count">
                Badge Notifikasi (Count)
              </label>
              <input
                id="menu-badge-count"
                type="number"
                className={styles.inputControl}
                value={badgeCount}
                onChange={(e) => setBadgeCount(parseInt(e.target.value, 10) || 0)}
                min={0}
              />
              <span className={styles.fieldHint}>Jumlah angka badge (0 = sembunyikan)</span>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="menu-badge-color">
                Warna Badge
              </label>
              <select
                id="menu-badge-color"
                className={styles.inputControl}
                value={badgeColor}
                onChange={(e) => setBadgeColor(e.target.value)}
              >
                <option value="orange">Orange (Default)</option>
                <option value="blue">Blue</option>
                <option value="red">Red</option>
                <option value="green">Green</option>
              </select>
              <span className={styles.fieldHint}>Warna aksen indikator badge</span>
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
