"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api, type PortalUser } from "@/lib/api";
import { useRoles, type RoleSummaryDto } from "../hooks/use-roles";
import { useDivisions } from "../hooks/use-divisions";
import type { UserSummaryDto } from "../hooks/use-users";
import styles from "./user-detail-modal.module.css";

export type UserDetailModalProps = {
  open: boolean;
  user: UserSummaryDto | null;
  currentAdmin?: PortalUser | null;
  onClose: () => void;
  onUpdated?: () => void;
};

export function UserDetailModal({ open, user, currentAdmin, onClose, onUpdated }: UserDetailModalProps) {
  const { roles: allRoles, loading: loadingRoles } = useRoles();
  const { divisions } = useDivisions();

  const [currentUser, setCurrentUser] = useState<UserSummaryDto | null>(user);
  const [callerAdmin, setCallerAdmin] = useState<PortalUser | null>(currentAdmin ?? null);
  const [loadingUser, setLoadingUser] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);

  useEffect(() => {
    if (currentAdmin !== undefined) {
      setCallerAdmin(currentAdmin);
    } else if (open) {
      api<{ user: PortalUser }>("/auth/admin/me")
        .then((res) => setCallerAdmin(res.user))
        .catch(() => {});
    }
  }, [open, currentAdmin]);

  // Section 1: Unified Profile edit states
  const [editingProfile, setEditingProfile] = useState(false);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formDivision, setFormDivision] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  // Avatar upload states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  // Section 2: Roles edit states
  const [editingRoles, setEditingRoles] = useState(false);
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
  const [savingRoles, setSavingRoles] = useState(false);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [rolesSuccess, setRolesSuccess] = useState<string | null>(null);

  // Section 3: Status & Sessions states
  const [confirmingStatus, setConfirmingStatus] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  const [savingRevoke, setSavingRevoke] = useState(false);
  const [revokeSuccess, setRevokeSuccess] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  // Section 3: Delete user states
  const [confirmingDeleteUser, setConfirmingDeleteUser] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);
  const [deleteUserError, setDeleteUserError] = useState<string | null>(null);

  // Sync state when modal opens or user prop changes
  useEffect(() => {
    if (open && user) {
      setCurrentUser(user);
      setFormName(user.name);
      setFormEmail(user.email);
      setFormDivision(user.division ?? "");
      setSelectedRoleIds(user.roles.map((r) => r.id));

      // Reset internal edit states
      setEditingProfile(false);
      setProfileError(null);
      setProfileSuccess(null);
      setAvatarError(null);
      setEditingRoles(false);
      setRolesError(null);
      setRolesSuccess(null);
      setConfirmingStatus(false);
      setStatusError(null);
      setConfirmingRevoke(false);
      setRevokeSuccess(null);
      setRevokeError(null);
      setConfirmingDeleteUser(false);
      setDeleteUserError(null);
      setTopError(null);

      // Fetch fresh detail from GET /admin/users/:id
      setLoadingUser(true);
      api<{ data: UserSummaryDto }>(`/admin/users/${user.id}`)
        .then((res) => {
          setCurrentUser(res.data);
          setFormName(res.data.name);
          setFormEmail(res.data.email);
          setFormDivision(res.data.division ?? "");
          setSelectedRoleIds(res.data.roles.map((r) => r.id));
        })
        .catch((err: any) => {
          setTopError(err?.message ?? "Gagal memuat detail terbaru pengguna.");
        })
        .finally(() => {
          setLoadingUser(false);
        });
    }
  }, [open, user]);

  // Agregasi permission unik dari role yang dimiliki user
  const aggregatedPermissions = useMemo(() => {
    if (!currentUser || !Array.isArray(currentUser.roles) || !allRoles.length) return [];
    const userRoleIds = new Set(currentUser.roles.map((r) => r.id));
    const permissionsSet = new Set<string>();

    for (const role of allRoles) {
      if (userRoleIds.has(role.id) && Array.isArray(role.permissions)) {
        for (const perm of role.permissions) {
          permissionsSet.add(perm);
        }
      }
    }
    return Array.from(permissionsSet);
  }, [currentUser, allRoles]);

  const isAdminAccount = currentUser?.accountType === "admin";
  const isCallerSuperadmin = Boolean(callerAdmin?.permissions?.includes("admin.security.manage"));
  const isTargetSuperadmin = useMemo(() => {
    if (!currentUser) return false;
    const hasSuperadminRole = Array.isArray(currentUser.roles) && currentUser.roles.some((r) => r.slug === "superadmin");
    const hasSuperadminPerm = aggregatedPermissions.includes("admin.security.manage");
    return Boolean(hasSuperadminRole || hasSuperadminPerm);
  }, [currentUser, aggregatedPermissions]);

  const isProtectedFromCaller = isTargetSuperadmin && !isCallerSuperadmin;
  const isSelf = Boolean(callerAdmin?.id && currentUser?.id === callerAdmin.id);
  const canEditProfile = !isAdminAccount || (isCallerSuperadmin && !isProtectedFromCaller);

  if (!currentUser && !loadingUser) return null;

  // Unified Profile Edit Handlers
  const handleStartEditProfile = () => {
    setFormName(currentUser?.name ?? "");
    setFormEmail(currentUser?.email ?? "");
    setFormDivision(currentUser?.division ?? "");
    setProfileError(null);
    setProfileSuccess(null);
    setEditingProfile(true);
  };

  const handleCancelEditProfile = () => {
    setEditingProfile(false);
    setProfileError(null);
    setFormName(currentUser?.name ?? "");
    setFormEmail(currentUser?.email ?? "");
    setFormDivision(currentUser?.division ?? "");
  };

  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentUser || savingProfile) return;

    const trimmedName = formName.trim();
    const trimmedEmail = formEmail.trim().toLowerCase();
    const trimmedDivision = formDivision.trim();

    if (!trimmedName) {
      setProfileError("Nama lengkap tidak boleh kosong.");
      return;
    }
    if (trimmedName.length > 160) {
      setProfileError("Nama lengkap maksimal 160 karakter.");
      return;
    }

    if (!trimmedEmail) {
      setProfileError("Alamat email tidak boleh kosong.");
      return;
    }
    if (trimmedEmail.length > 191) {
      setProfileError("Alamat email maksimal 191 karakter.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setProfileError("Format alamat email tidak valid.");
      return;
    }

    setSavingProfile(true);
    setProfileError(null);
    setProfileSuccess(null);

    try {
      const payload: Record<string, any> = {};
      if (trimmedName !== currentUser.name) payload.name = trimmedName;
      if (trimmedEmail !== currentUser.email) payload.email = trimmedEmail;
      if (trimmedDivision !== (currentUser.division ?? "")) payload.division = trimmedDivision || null;

      if (Object.keys(payload).length === 0) {
        setEditingProfile(false);
        return;
      }

      const res = await api<{ user: UserSummaryDto }>(`/admin/users/${currentUser.id}/profile`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });

      setCurrentUser(res.user);
      setEditingProfile(false);
      setProfileSuccess("Profil pengguna berhasil diperbarui.");
      onUpdated?.();
      setTimeout(() => setProfileSuccess(null), 3500);
    } catch (err: any) {
      if (err?.status === 409) {
        setProfileError("Alamat email sudah digunakan oleh akun lain.");
      } else {
        setProfileError(err?.message ?? "Gagal memperbarui profil pengguna.");
      }
    } finally {
      setSavingProfile(false);
    }
  };

  // Helper compress image to WebP client-side
  const compressImage = async (file: File): Promise<Blob> => {
    return new Promise((resolve) => {
      const img = document.createElement("img");
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 400;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => resolve(blob || file),
          "image/webp",
          0.85
        );
      };
      img.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  };

  // Handle Upload Avatar
  const handleUploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentUser) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setAvatarError("Format gambar harus berupa PNG, JPEG, atau WebP.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAvatarError("Ukuran file gambar maksimal 5 MB.");
      return;
    }

    setUploadingAvatar(true);
    setAvatarError(null);

    try {
      const compressedBlob = await compressImage(file);
      const formData = new FormData();
      formData.append("avatar", compressedBlob, "avatar.webp");

      const res = await api<{ data: { avatarUrl: string } }>(`/admin/users/${currentUser.id}/avatar`, {
        method: "POST",
        body: formData
      });

      setCurrentUser((prev) => (prev ? { ...prev, avatarUrl: res.data.avatarUrl } : prev));
      onUpdated?.();
    } catch (err: any) {
      setAvatarError(err?.message ?? "Gagal mengunggah foto profil.");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Handle Delete Avatar
  const handleDeleteAvatar = async () => {
    if (!currentUser) return;
    setUploadingAvatar(true);
    setAvatarError(null);
    try {
      await api(`/admin/users/${currentUser.id}/avatar`, {
        method: "DELETE"
      });
      setCurrentUser((prev) => (prev ? { ...prev, avatarUrl: null } : prev));
      onUpdated?.();
    } catch (err: any) {
      setAvatarError(err?.message ?? "Gagal menghapus foto profil.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Handle Delete User
  const handleDeleteUser = async () => {
    if (!currentUser) return;
    setDeletingUser(true);
    setDeleteUserError(null);

    try {
      await api(`/admin/users/${currentUser.id}`, {
        method: "DELETE"
      });
      onClose();
      onUpdated?.();
    } catch (err: any) {
      setDeleteUserError(err?.message ?? "Gagal menghapus akun pengguna.");
    } finally {
      setDeletingUser(false);
    }
  };

  // Handle Save Roles
  const handleSaveRoles = async () => {
    if (!currentUser) return;
    setSavingRoles(true);
    setRolesError(null);
    setRolesSuccess(null);

    try {
      await api(`/admin/users/${currentUser.id}/roles`, {
        method: "PATCH",
        body: JSON.stringify({ roleIds: selectedRoleIds })
      });

      // Refresh detail
      const res = await api<{ data: UserSummaryDto }>(`/admin/users/${currentUser.id}`);
      setCurrentUser(res.data);
      setEditingRoles(false);
      setRolesSuccess("Role pengguna berhasil diperbarui.");
      onUpdated?.();
    } catch (err: any) {
      setRolesError(err?.message ?? "Gagal memperbarui role.");
    } finally {
      setSavingRoles(false);
    }
  };

  // Handle Toggle Status
  const handleToggleStatus = async () => {
    if (!currentUser) return;
    setSavingStatus(true);
    setStatusError(null);

    const nextStatus = !currentUser.isActive;
    try {
      await api(`/admin/users/${currentUser.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: nextStatus })
      });

      setCurrentUser((prev) => (prev ? { ...prev, isActive: nextStatus } : prev));
      setConfirmingStatus(false);
      onUpdated?.();
    } catch (err: any) {
      setStatusError(err?.message ?? "Gagal mengubah status pengguna.");
    } finally {
      setSavingStatus(false);
    }
  };

  // Handle Revoke Sessions
  const handleRevokeSessions = async () => {
    if (!currentUser) return;
    setSavingRevoke(true);
    setRevokeError(null);
    setRevokeSuccess(null);

    try {
      await api(`/admin/users/${currentUser.id}/revoke-sessions`, {
        method: "POST"
      });
      setRevokeSuccess("Semua sesi aktif pengguna berhasil dicabut.");
      setConfirmingRevoke(false);
    } catch (err: any) {
      setRevokeError(err?.message ?? "Gagal mencabut sesi pengguna.");
    } finally {
      setSavingRevoke(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    try {
      return new Date(dateStr).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={currentUser ? `Detail Pengguna — ${currentUser.name}` : "Detail Pengguna"}
      size="lg"
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", width: "100%" }}>
          <Button variant="secondary" size="md" onClick={onClose}>
            Tutup
          </Button>
        </div>
      }
    >
      <div className={styles.container}>
        {topError && (
          <div className={`${styles.alert} ${styles.alertDanger}`} role="alert">
            <span>{topError}</span>
          </div>
        )}

        {/* SECTION 1: INFO PROFIL */}
        <section className={styles.section} aria-label="Informasi Profil">
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>1. Informasi Profil</h3>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {isAdminAccount && (
                <Badge variant="warning">Akun Administrator</Badge>
              )}
              {canEditProfile && !editingProfile && !isProtectedFromCaller && (
                <Button variant="secondary" size="sm" onClick={handleStartEditProfile}>
                  Edit Profil
                </Button>
              )}
            </div>
          </div>

          {isAdminAccount && !canEditProfile && (
            <div className={`${styles.alert} ${styles.alertInfo}`} role="note">
              <span>
                Akun administrator memiliki proteksi sistem khusus. Nama, email, dan divisi hanya dapat diubah oleh Superadministrator.
              </span>
            </div>
          )}

          {profileSuccess && (
            <div className={`${styles.alert} ${styles.alertSuccess}`} role="status">
              <span>✓ {profileSuccess}</span>
            </div>
          )}

          {/* User Profile Header Card */}
          <div className={styles.profileHeaderCard}>
            <div className={styles.avatarWrapper}>
              <div className={styles.avatarContainer}>
                {currentUser?.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt="" className={styles.avatarImage} />
                ) : (
                  currentUser?.name?.charAt(0).toUpperCase() || "?"
                )}
              </div>
              <span
                className={`${styles.avatarStatusBadge} ${
                  currentUser?.isOnline ? styles.avatarStatusOnline : styles.avatarStatusOffline
                }`}
                title={currentUser?.isOnline ? "Sedang Online (Sesi Aktif)" : "Sedang Offline"}
              />
            </div>

            <div className={styles.profileHeaderInfo}>
              <div className={styles.profileNameRow}>
                <h4 className={styles.profileName}>{currentUser?.name}</h4>
                <span
                  className={`${styles.onlineBadge} ${
                    currentUser?.isOnline ? styles.onlineBadgeActive : styles.onlineBadgeInactive
                  }`}
                >
                  <span
                    className={`${styles.statusDot} ${
                      currentUser?.isOnline ? styles.statusDotActive : styles.statusDotInactive
                    }`}
                  />
                  {currentUser?.isOnline ? "Online" : "Offline"}
                </span>
              </div>
              <span className={styles.profileEmail}>{currentUser?.email}</span>

              <div className={styles.profileBadgesRow}>
                <Badge variant={currentUser?.accountType === "admin" ? "warning" : "neutral"}>
                  {currentUser?.accountType === "admin" ? "Administrator" : "Karyawan"}
                </Badge>
                {currentUser?.division && (
                  <Badge variant="neutral">{currentUser.division}</Badge>
                )}
                <Badge variant={currentUser?.isActive ? "success" : "danger"}>
                  {currentUser?.isActive ? "Akun Aktif" : "Nonaktif"}
                </Badge>
              </div>

              <div className={styles.avatarControls} style={{ marginTop: "6px" }}>
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleUploadAvatar}
                  disabled={uploadingAvatar}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  loading={uploadingAvatar}
                  loadingText="Mengunggah..."
                >
                  {currentUser?.avatarUrl ? "Ganti Foto" : "Unggah Foto"}
                </Button>
                {currentUser?.avatarUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDeleteAvatar}
                    disabled={uploadingAvatar}
                  >
                    Hapus Foto
                  </Button>
                )}
                <span className={styles.avatarHint}>Maks 5MB (WebP/JPG/PNG)</span>
              </div>
              {avatarError && (
                <span className={styles.alertDanger} style={{ fontSize: "11px", padding: "4px 8px", borderRadius: "6px", width: "fit-content" }}>
                  {avatarError}
                </span>
              )}
            </div>
          </div>

          {editingProfile ? (
            <form className={styles.editProfileForm} onSubmit={handleSaveProfile}>
              <div className={styles.editFormGrid}>
                <div className={styles.editFormField}>
                  <label className={styles.formLabel} htmlFor="edit-user-name">
                    Nama Lengkap <span style={{ color: "var(--danger, #a33f36)" }}>*</span>
                  </label>
                  <input
                    id="edit-user-name"
                    type="text"
                    className={styles.formInput}
                    value={formName}
                    maxLength={160}
                    required
                    onChange={(e) => setFormName(e.target.value)}
                    disabled={savingProfile}
                    placeholder="cth. Budi Santoso"
                    autoFocus
                  />
                </div>

                <div className={styles.editFormField}>
                  <label className={styles.formLabel} htmlFor="edit-user-division">
                    Divisi / Departemen
                  </label>
                  <select
                    id="edit-user-division"
                    className={styles.selectInput}
                    value={formDivision}
                    onChange={(e) => setFormDivision(e.target.value)}
                    disabled={savingProfile}
                  >
                    <option value="">-- Pilih atau Kosongkan Divisi --</option>
                    {divisions.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={`${styles.editFormField} ${styles.editFormFull}`}>
                  <label className={styles.formLabel} htmlFor="edit-user-email">
                    Alamat Email <span style={{ color: "var(--danger, #a33f36)" }}>*</span>
                  </label>
                  <input
                    id="edit-user-email"
                    type="email"
                    className={styles.formInput}
                    value={formEmail}
                    maxLength={191}
                    required
                    onChange={(e) => setFormEmail(e.target.value)}
                    disabled={savingProfile}
                    placeholder="budi@mknsite.online"
                  />
                  <div className={styles.emailWarning}>
                    <span>⚠️ <strong>Perhatian:</strong> Mengubah alamat email akan otomatis mengeluarkan pengguna dari seluruh sesi aktif demi keamanan akun.</span>
                  </div>
                </div>
              </div>

              {profileError && (
                <div className={`${styles.alert} ${styles.alertDanger}`} role="alert">
                  <span>{profileError}</span>
                </div>
              )}

              <div className={styles.editActionsBar}>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelEditProfile}
                  disabled={savingProfile}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={savingProfile}
                  loadingText="Menyimpan..."
                >
                  Simpan Perubahan
                </Button>
              </div>
            </form>
          ) : (
            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Divisi / Departemen</span>
                <span className={styles.infoValue}>
                  {currentUser?.division || <span className={styles.emptyText}>Belum ditentukan</span>}
                </span>
              </div>

              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Tipe Akun</span>
                <span className={styles.infoValue}>
                  {currentUser?.accountType === "admin" ? "Administrator" : "Karyawan"}
                </span>
              </div>

              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Status Keaktifan</span>
                <span className={styles.infoValue}>
                  {currentUser?.isActive ? "Aktif" : "Nonaktif"}
                </span>
              </div>

              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Status Sesi</span>
                <span className={styles.infoValue}>
                  {currentUser?.isOnline ? "Sedang Aktif (Online)" : "Tidak Aktif (Offline)"}
                </span>
              </div>

              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Terakhir Login</span>
                <span className={styles.infoValue}>
                  {currentUser?.lastLoginAt ? formatDate(currentUser.lastLoginAt) : "Belum pernah login"}
                </span>
              </div>

              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Tanggal Dibuat</span>
                <span className={styles.infoValue}>{formatDate(currentUser?.createdAt)}</span>
              </div>

              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Terakhir Diperbarui</span>
                <span className={styles.infoValue}>{formatDate(currentUser?.updatedAt)}</span>
              </div>
            </div>
          )}
        </section>

        {/* SECTION 2: ROLE & PERMISSION */}
        <section className={styles.section} aria-label="Role dan Izin">
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>2. Role & Izin Akses</h3>
            {!editingRoles && !isProtectedFromCaller && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSelectedRoleIds(currentUser?.roles.map((r) => r.id) ?? []);
                  setEditingRoles(true);
                  setRolesError(null);
                  setRolesSuccess(null);
                }}
              >
                Ubah Role
              </Button>
            )}
            {isProtectedFromCaller && (
              <Badge variant="neutral">Role Terproteksi (Khusus Superadmin)</Badge>
            )}
          </div>

          {rolesSuccess && (
            <div className={`${styles.alert} ${styles.alertSuccess}`} role="status">
              <span>{rolesSuccess}</span>
            </div>
          )}

          {rolesError && (
            <div className={`${styles.alert} ${styles.alertDanger}`} role="alert">
              <span>{rolesError}</span>
            </div>
          )}

          {!editingRoles ? (
            <>
              <div>
                <span className={styles.infoLabel}>Role Aktif:</span>
                <div className={styles.badgeList} style={{ marginTop: "4px" }}>
                  {currentUser?.roles && currentUser.roles.length > 0 ? (
                    currentUser.roles.map((r) => (
                      <Badge key={r.id} variant="accent">
                        {r.name}
                      </Badge>
                    ))
                  ) : (
                    <span className={styles.emptyText}>Tidak ada role yang ditugaskan.</span>
                  )}
                </div>
              </div>

              <div>
                <span className={styles.permissionTitle}>
                  Izin Akses Efektif (Agregat dari Role):
                </span>
                <div className={styles.badgeList} style={{ marginTop: "4px" }}>
                  {aggregatedPermissions.length > 0 ? (
                    aggregatedPermissions.map((perm) => (
                      <Badge key={perm} variant="neutral" className={styles.permissionBadge}>
                        {perm}
                      </Badge>
                    ))
                  ) : (
                    <span className={styles.emptyText}>Tidak ada permission khusus.</span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className={styles.rolesEditor}>
              <p className={styles.infoLabel}>Pilih satu atau beberapa role untuk pengguna ini:</p>
              {loadingRoles ? (
                <div className={styles.emptyText}>Memuat daftar role...</div>
              ) : (
                <div className={styles.rolesList} role="group" aria-label="Editor Role Pengguna">
                  {allRoles.map((role: RoleSummaryDto) => {
                    const isChecked = selectedRoleIds.includes(role.id);
                    return (
                      <label key={role.id} className={styles.roleItem}>
                        <input
                          type="checkbox"
                          className={styles.roleCheckbox}
                          checked={isChecked}
                          onChange={() => {
                            setSelectedRoleIds((prev) =>
                              prev.includes(role.id)
                                ? prev.filter((id) => id !== role.id)
                                : [...prev, role.id]
                            );
                          }}
                          disabled={savingRoles}
                        />
                        <span className={styles.roleName}>{role.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditingRoles(false);
                    setRolesError(null);
                  }}
                  disabled={savingRoles}
                >
                  Batal
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveRoles}
                  loading={savingRoles}
                  loadingText="Menyimpan..."
                >
                  Simpan Perubahan Role
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* SECTION 3: TINDAKAN AKUN */}
        <section className={styles.section} aria-label="Tindakan Akun">
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>3. Tindakan Akun & Keamanan Sesi</h3>
          </div>

          {isProtectedFromCaller ? (
            <div className={`${styles.alert} ${styles.alertWarning}`} style={{ marginTop: "4px" }}>
              <span>🛡️ Akun Superadministrator memiliki proteksi keamanan sistem khusus. Tindakan penonaktifan akun dan pencabutan sesi hanya dapat dikelola oleh sesama Superadministrator.</span>
            </div>
          ) : (
            <div className={styles.actionsGroup}>
              {/* Action 1: Status Toggle */}
              <div className={styles.actionCard}>
                <div>
                  <span className={styles.actionTitle}>Status Akun</span>
                  <p className={styles.actionDesc}>
                    {currentUser?.isActive
                      ? "Menonaktifkan akun akan langsung mencabut seluruh sesi dan mencegah user login."
                      : "Mengaktifkan kembali akun ini agar pengguna dapat login dan mengakses modul."}
                  </p>
                </div>

                {statusError && (
                  <div className={`${styles.alert} ${styles.alertDanger}`} style={{ padding: "6px 8px", fontSize: "11px" }}>
                    <span>{statusError}</span>
                  </div>
                )}

                {confirmingStatus ? (
                  <div className={styles.confirmBox}>
                    <span>
                      {currentUser?.isActive
                        ? "Konfirmasi nonaktifkan akun ini? Pengguna tidak akan bisa login."
                        : "Konfirmasi aktifkan kembali akun ini?"}
                    </span>
                    <div className={styles.confirmButtons}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmingStatus(false)}
                        disabled={savingStatus}
                      >
                        Batal
                      </Button>
                      <Button
                        variant={currentUser?.isActive ? "danger" : "primary"}
                        size="sm"
                        onClick={handleToggleStatus}
                        loading={savingStatus}
                        loadingText="Memproses..."
                      >
                        Ya, Lanjutkan
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant={currentUser?.isActive ? "danger" : "secondary"}
                    size="sm"
                    onClick={() => {
                      setConfirmingStatus(true);
                      setStatusError(null);
                    }}
                  >
                    {currentUser?.isActive ? "Nonaktifkan Akun" : "Aktifkan Akun"}
                  </Button>
                )}
              </div>

              {/* Action 2: Revoke Sessions */}
              <div className={styles.actionCard}>
                <div>
                  <span className={styles.actionTitle}>Cabut Semua Sesi Aktif</span>
                  <p className={styles.actionDesc}>
                    Mengeluarkan pengguna dari seluruh perangkat dan browser yang sedang terhubung secara paksa.
                  </p>
                </div>

                {revokeSuccess && (
                  <div className={`${styles.alert} ${styles.alertSuccess}`} style={{ padding: "6px 8px", fontSize: "11px" }}>
                    <span>{revokeSuccess}</span>
                  </div>
                )}

                {revokeError && (
                  <div className={`${styles.alert} ${styles.alertDanger}`} style={{ padding: "6px 8px", fontSize: "11px" }}>
                    <span>{revokeError}</span>
                  </div>
                )}

                {confirmingRevoke ? (
                  <div className={styles.confirmBox}>
                    <span>Pengguna akan diminta login ulang di semua perangkat. Lanjutkan?</span>
                    <div className={styles.confirmButtons}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmingRevoke(false)}
                        disabled={savingRevoke}
                      >
                        Batal
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={handleRevokeSessions}
                        loading={savingRevoke}
                        loadingText="Mencabut..."
                      >
                        Ya, Cabut Sesi
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setConfirmingRevoke(true);
                      setRevokeError(null);
                      setRevokeSuccess(null);
                    }}
                  >
                    Cabut Semua Sesi
                  </Button>
                )}
              </div>

              {/* Action 3: Delete User */}
              <div className={`${styles.actionCard} ${styles.actionCardDanger}`}>
                <div>
                  <span className={`${styles.actionTitle} ${styles.actionTitleDanger}`}>
                    Hapus Akun Pengguna
                  </span>
                  <p className={styles.actionDesc}>
                    Menghapus akun secara permanen beserta seluruh relasi role dan sesi aktif. Tindakan ini tidak dapat dibatalkan.
                  </p>
                </div>

                {deleteUserError && (
                  <div className={`${styles.alert} ${styles.alertDanger}`} style={{ padding: "6px 8px", fontSize: "11px" }}>
                    <span>{deleteUserError}</span>
                  </div>
                )}

                {isSelf ? (
                  <span className={styles.emptyText} style={{ fontSize: "11px" }}>
                    Anda tidak dapat menghapus akun Anda sendiri saat sedang aktif.
                  </span>
                ) : isTargetSuperadmin ? (
                  <span className={styles.emptyText} style={{ fontSize: "11px" }}>
                    Akun Superadministrator dilindungi sistem dan tidak dapat dihapus.
                  </span>
                ) : confirmingDeleteUser ? (
                  <div className={styles.confirmBox}>
                    <span style={{ color: "var(--danger)" }}>
                      ⚠️ Hapus permanen akun <strong>{currentUser?.name}</strong> ({currentUser?.email})?
                    </span>
                    <div className={styles.confirmButtons}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmingDeleteUser(false)}
                        disabled={deletingUser}
                      >
                        Batal
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={handleDeleteUser}
                        loading={deletingUser}
                        loadingText="Menghapus..."
                      >
                        Ya, Hapus Permanen
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      setConfirmingDeleteUser(true);
                      setDeleteUserError(null);
                    }}
                  >
                    Hapus Pengguna
                  </Button>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}
