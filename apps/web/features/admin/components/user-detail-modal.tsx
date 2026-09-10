"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api, type PortalUser } from "@/lib/api";
import { useRoles, type RoleSummaryDto } from "../hooks/use-roles";
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

  // Section 1: Profil edit states
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [editingEmail, setEditingEmail] = useState(false);
  const [tempEmail, setTempEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

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

  // Sync state when modal opens or user prop changes
  useEffect(() => {
    if (open && user) {
      setCurrentUser(user);
      setTempName(user.name);
      setTempEmail(user.email);
      setSelectedRoleIds(user.roles.map((r) => r.id));

      // Reset internal edit states
      setEditingName(false);
      setNameError(null);
      setEditingEmail(false);
      setEmailError(null);
      setEditingRoles(false);
      setRolesError(null);
      setRolesSuccess(null);
      setConfirmingStatus(false);
      setStatusError(null);
      setConfirmingRevoke(false);
      setRevokeSuccess(null);
      setRevokeError(null);
      setTopError(null);

      // Fetch fresh detail from GET /admin/users/:id
      setLoadingUser(true);
      api<{ data: UserSummaryDto }>(`/admin/users/${user.id}`)
        .then((res) => {
          setCurrentUser(res.data);
          setTempName(res.data.name);
          setTempEmail(res.data.email);
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
    if (!currentUser || !allRoles.length) return [];
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

  if (!currentUser && !loadingUser) return null;

  // Handle Save Name
  const handleSaveName = async () => {
    if (!currentUser) return;
    const trimmed = tempName.trim();
    if (!trimmed) {
      setNameError("Nama tidak boleh kosong.");
      return;
    }
    if (trimmed.length > 160) {
      setNameError("Nama maksimal 160 karakter.");
      return;
    }

    setSavingName(true);
    setNameError(null);
    try {
      const res = await api<{ data: UserSummaryDto }>(`/admin/users/${currentUser.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: trimmed })
      });
      setCurrentUser(res.data);
      setEditingName(false);
      onUpdated?.();
    } catch (err: any) {
      setNameError(err?.message ?? "Gagal menyimpan nama.");
    } finally {
      setSavingName(false);
    }
  };

  // Handle Save Email
  const handleSaveEmail = async () => {
    if (!currentUser) return;
    const trimmed = tempEmail.trim().toLowerCase();
    if (!trimmed) {
      setEmailError("Email tidak boleh kosong.");
      return;
    }
    if (trimmed.length > 191) {
      setEmailError("Email maksimal 191 karakter.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError("Format email tidak valid.");
      return;
    }

    setSavingEmail(true);
    setEmailError(null);
    try {
      const res = await api<{ data: UserSummaryDto }>(`/admin/users/${currentUser.id}`, {
        method: "PATCH",
        body: JSON.stringify({ email: trimmed })
      });
      setCurrentUser(res.data);
      setEditingEmail(false);
      onUpdated?.();
    } catch (err: any) {
      if (err?.status === 409) {
        setEmailError("Email sudah digunakan oleh akun lain.");
      } else {
        setEmailError(err?.message ?? "Gagal menyimpan email.");
      }
    } finally {
      setSavingEmail(false);
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

  const isAdminAccount = currentUser?.accountType === "admin";
  const isCallerSuperadmin = Boolean(callerAdmin?.permissions?.includes("admin.security.manage"));
  const isTargetSuperadmin = useMemo(() => {
    if (!currentUser) return false;
    return (
      currentUser.roles.some((r) => r.slug === "superadmin") ||
      aggregatedPermissions.includes("admin.security.manage")
    );
  }, [currentUser, aggregatedPermissions]);

  const isProtectedFromCaller = isTargetSuperadmin && !isCallerSuperadmin;

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
            {isAdminAccount && (
              <Badge variant="warning">Akun Administrator (Read-Only)</Badge>
            )}
          </div>

          {isAdminAccount && (
            <div className={`${styles.alert} ${styles.alertInfo}`} role="note">
              <span>
                Akun administrator memiliki proteksi sistem khusus. Nama dan email tidak dapat diubah melalui panel admin standar.
              </span>
            </div>
          )}

          <div className={styles.infoGrid}>
            {/* Field: Nama */}
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Nama Lengkap</span>
              {editingName ? (
                <div className={styles.inlineEditForm}>
                  <div className={styles.inlineInputRow}>
                    <input
                      type="text"
                      className={styles.inlineInput}
                      value={tempName}
                      maxLength={160}
                      onChange={(e) => setTempName(e.target.value)}
                      disabled={savingName}
                      autoFocus
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleSaveName}
                      loading={savingName}
                      loadingText="Simpan"
                    >
                      Simpan
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingName(false);
                        setTempName(currentUser?.name ?? "");
                        setNameError(null);
                      }}
                      disabled={savingName}
                    >
                      Batal
                    </Button>
                  </div>
                  {nameError && (
                    <span className={styles.alertDanger} style={{ fontSize: "11px", padding: "4px 8px", borderRadius: "6px" }}>
                      {nameError}
                    </span>
                  )}
                </div>
              ) : (
                <div className={styles.infoValueRow}>
                  <strong className={styles.infoValue}>{currentUser?.name}</strong>
                  {!isAdminAccount && (
                    <Button variant="ghost" size="sm" onClick={() => setEditingName(true)}>
                      Edit
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Field: Email */}
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Alamat Email</span>
              {editingEmail ? (
                <div className={styles.inlineEditForm}>
                  <div className={`${styles.alert} ${styles.alertWarning}`} style={{ padding: "6px 10px", fontSize: "11px" }}>
                    <span>⚠️ Mengubah email akan mengeluarkan user dari semua sesi aktif.</span>
                  </div>
                  <div className={styles.inlineInputRow}>
                    <input
                      type="email"
                      className={styles.inlineInput}
                      value={tempEmail}
                      maxLength={191}
                      onChange={(e) => setTempEmail(e.target.value)}
                      disabled={savingEmail}
                      autoFocus
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleSaveEmail}
                      loading={savingEmail}
                      loadingText="Simpan"
                    >
                      Simpan
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingEmail(false);
                        setTempEmail(currentUser?.email ?? "");
                        setEmailError(null);
                      }}
                      disabled={savingEmail}
                    >
                      Batal
                    </Button>
                  </div>
                  {emailError && (
                    <span className={styles.alertDanger} style={{ fontSize: "11px", padding: "4px 8px", borderRadius: "6px" }}>
                      {emailError}
                    </span>
                  )}
                </div>
              ) : (
                <div className={styles.infoValueRow}>
                  <span className={styles.infoValue}>{currentUser?.email}</span>
                  {!isAdminAccount && (
                    <Button variant="ghost" size="sm" onClick={() => setEditingEmail(true)}>
                      Edit
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Field: Tipe Akun */}
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Tipe Akun</span>
              <div className={styles.infoValueRow}>
                <Badge variant={currentUser?.accountType === "admin" ? "warning" : "neutral"}>
                  {currentUser?.accountType === "admin" ? "Administrator" : "Karyawan"}
                </Badge>
              </div>
            </div>

            {/* Field: Status */}
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Status Keaktifan</span>
              <div className={styles.infoValueRow}>
                <Badge variant={currentUser?.isActive ? "success" : "danger"}>
                  {currentUser?.isActive ? "Aktif" : "Nonaktif"}
                </Badge>
              </div>
            </div>

            {/* Field: Tanggal Dibuat */}
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Tanggal Dibuat</span>
              <span className={styles.infoValue}>{formatDate(currentUser?.createdAt)}</span>
            </div>

            {/* Field: Tanggal Diperbarui */}
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Terakhir Diperbarui</span>
              <span className={styles.infoValue}>{formatDate(currentUser?.updatedAt)}</span>
            </div>
          </div>
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
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}
