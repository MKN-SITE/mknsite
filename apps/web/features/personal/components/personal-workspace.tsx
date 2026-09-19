"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PortalHeader } from "@/components/layout/portal-header";
import { api, type PortalUser } from "@/lib/api";
import styles from "./personal-workspace.module.css";

export type PersonalProfileData = {
  user: {
    id: number;
    name: string;
    username: string | null;
    email: string;
    phone: string | null;
    startDate: string | null;
    division: string | null;
    kpcId: string | null;
    avatarUrl: string | null;
    accountType: string;
    tenure: {
      years: number;
      months: number;
      days: number;
      formatted: string;
    } | null;
  };
  contracts: Array<{
    id: number;
    contractNumber: string;
    sequenceNumber: number;
    sequenceLabel: string;
    contractType: string;
    startDate: string;
    endDate: string;
    durationDays: number;
    status: string;
    position: string | null;
    notes: string | null;
    reminderSentAt: string | null;
  }>;
  summary: {
    totalContracts: number;
    extensionCount: number;
    activeContract: {
      id: number;
      contractNumber: string;
      sequenceNumber: number;
      sequenceLabel: string;
      contractType: string;
      startDate: string;
      endDate: string;
      daysRemaining: number;
      isExpiringSoon: boolean;
      isExpired: boolean;
      position: string | null;
    } | null;
  };
};

function formatDateIndo(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  } catch {
    return dateStr;
  }
}

export function PersonalWorkspace() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<PortalUser | null>(null);
  const [data, setData] = useState<PersonalProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Quick Action Alerts & Reminder State
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [globalToast, setGlobalToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Modals state
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: "",
    username: "",
    phone: "",
    startDate: "",
    division: "",
    kpcId: ""
  });

  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [contractModalMode, setContractModalMode] = useState<"create" | "edit">("create");
  const [contractIdToEdit, setContractIdToEdit] = useState<number | null>(null);
  const [contractForm, setContractForm] = useState({
    contractNumber: "",
    sequenceNumber: 1,
    contractType: "PKWT",
    startDate: "",
    endDate: "",
    status: "active",
    position: "Teknisi Telco",
    notes: ""
  });

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [contractToDelete, setContractToDelete] = useState<{ id: number; contractNumber: string } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        const [meRes, personalRes] = await Promise.all([
          api<{ user: PortalUser }>("/auth/me"),
          api<{ success: boolean; data: PersonalProfileData }>("/personal")
        ]);

        if (isMounted) {
          setCurrentUser(meRes.user);
          setData(personalRes.data);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || "Gagal memuat data personal dan kontrak kerja.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Auto-hide toast notification after 5 seconds
  useEffect(() => {
    if (!globalToast) return;
    const timer = setTimeout(() => setGlobalToast(null), 5000);
    return () => clearTimeout(timer);
  }, [globalToast]);

  async function handleLogout() {
    await api("/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  async function handleSendTestReminder() {
    try {
      setSendingTest(true);
      setTestResult(null);

      const res = await api<{ success: boolean; message: string; recipient: string; daysRemaining: number }>(
        "/personal/test-reminder",
        { method: "POST" }
      );

      setTestResult({
        success: true,
        message: res.message || "Uji notifikasi email pengingat 30 hari berhasil dikirimkan!"
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "Gagal mengirimkan notifikasi email uji."
      });
    } finally {
      setSendingTest(false);
    }
  }

  // --- Modal Openers ---
  function openEditProfile() {
    if (!data) return;
    setProfileForm({
      name: data.user.name || "",
      username: data.user.username || "",
      phone: data.user.phone || "",
      startDate: data.user.startDate || "",
      division: data.user.division || "OPS Telco",
      kpcId: data.user.kpcId || ""
    });
    setModalError(null);
    setIsEditProfileOpen(true);
  }

  function openChangePassword() {
    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: ""
    });
    setModalError(null);
    setIsChangePasswordOpen(true);
  }

  function openAddContract() {
    if (!data) return;
    const nextSeq = data.summary.totalContracts + 1;
    const nextLabel = nextSeq === 1 ? "PKWT Awal" : `Perpanjangan Ke-${nextSeq - 1}`;
    setContractModalMode("create");
    setContractIdToEdit(null);
    setContractForm({
      contractNumber: "",
      sequenceNumber: nextSeq,
      contractType: nextLabel,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: "",
      status: "active",
      position: data.contracts[0]?.position || "Teknisi Telco",
      notes: ""
    });
    setModalError(null);
    setIsContractModalOpen(true);
  }

  function openEditContract(c: PersonalProfileData["contracts"][0]) {
    setContractModalMode("edit");
    setContractIdToEdit(c.id);
    setContractForm({
      contractNumber: c.contractNumber,
      sequenceNumber: c.sequenceNumber,
      contractType: c.contractType,
      startDate: c.startDate,
      endDate: c.endDate,
      status: c.status,
      position: c.position || "",
      notes: c.notes || ""
    });
    setModalError(null);
    setIsContractModalOpen(true);
  }

  function openDeleteContract(c: { id: number; contractNumber: string }) {
    setContractToDelete(c);
    setModalError(null);
    setIsDeleteModalOpen(true);
  }

  // --- Modal Submits ---
  async function handleSubmitProfile(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSubmitting(true);
      setModalError(null);

      const res = await api<{ success: boolean; message: string; data: PersonalProfileData }>(
        "/personal/profile",
        {
          method: "PUT",
          body: JSON.stringify(profileForm)
        }
      );

      setData(res.data);
      if (currentUser) {
        setCurrentUser({ ...currentUser, name: profileForm.name, division: profileForm.division });
      }
      setIsEditProfileOpen(false);
      setGlobalToast({ type: "success", message: res.message || "Data diri personal berhasil diperbarui." });
    } catch (err: any) {
      setModalError(err.message || "Gagal memperbarui profil.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setModalError("Kata sandi baru dan konfirmasi kata sandi tidak cocok.");
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      setModalError("Kata sandi baru minimal 8 karakter.");
      return;
    }

    try {
      setSubmitting(true);
      setModalError(null);

      const res = await api<{ success: boolean; message: string }>(
        "/personal/change-password",
        {
          method: "POST",
          body: JSON.stringify({
            currentPassword: passwordForm.currentPassword,
            newPassword: passwordForm.newPassword
          })
        }
      );

      setIsChangePasswordOpen(false);
      setGlobalToast({ type: "success", message: res.message || "Kata sandi berhasil diperbarui!" });
    } catch (err: any) {
      setModalError(err.message || "Gagal mengubah kata sandi.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitContract(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSubmitting(true);
      setModalError(null);

      if (contractModalMode === "create") {
        const res = await api<{ success: boolean; message: string; data: PersonalProfileData }>(
          "/personal/contracts",
          {
            method: "POST",
            body: JSON.stringify(contractForm)
          }
        );
        setData(res.data);
        setIsContractModalOpen(false);
        setGlobalToast({ type: "success", message: res.message || "Periode kontrak baru berhasil ditambahkan." });
      } else if (contractModalMode === "edit" && contractIdToEdit) {
        const res = await api<{ success: boolean; message: string; data: PersonalProfileData }>(
          `/personal/contracts/${contractIdToEdit}`,
          {
            method: "PUT",
            body: JSON.stringify(contractForm)
          }
        );
        setData(res.data);
        setIsContractModalOpen(false);
        setGlobalToast({ type: "success", message: res.message || "Data kontrak berhasil diperbarui." });
      }
    } catch (err: any) {
      setModalError(err.message || "Gagal menyimpan data kontrak.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmDeleteContract() {
    if (!contractToDelete) return;
    try {
      setSubmitting(true);
      setModalError(null);

      const res = await api<{ success: boolean; message: string; data: PersonalProfileData }>(
        `/personal/contracts/${contractToDelete.id}`,
        { method: "DELETE" }
      );

      setData(res.data);
      setIsDeleteModalOpen(false);
      setContractToDelete(null);
      setGlobalToast({ type: "success", message: res.message || "Periode kontrak berhasil dihapus." });
    } catch (err: any) {
      setModalError(err.message || "Gagal menghapus kontrak.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.loadingPage}>
        <div className={styles.loadingSpinner} />
        <p className={styles.loadingText}>Memuat data personal &amp; kontrak...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.container}>
        <div className={styles.contentWrapper}>
          <div className={styles.topNav}>
            <Link href="/portal" className={styles.backLink}>
              &larr; Kembali ke Portal
            </Link>
          </div>
          <div className={styles.panel} style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
            <h3 style={{ color: "#f87171", marginBottom: "0.5rem" }}>Terjadi Kendala</h3>
            <p style={{ color: "#94a3b8" }}>{error || "Data tidak ditemukan."}</p>
            <div style={{ marginTop: "1.5rem" }}>
              <button
                onClick={() => window.location.reload()}
                className={styles.testButton}
                style={{ display: "inline-flex" }}
              >
                Muat Ulang Halaman
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { user, contracts, summary } = data;
  const activeContract = summary.activeContract;

  return (
    <div className={styles.container}>
      <PortalHeader
        homeHref="/portal"
        homeLabel="MKN Site"
        name={currentUser?.name || user.name || "User"}
        role={currentUser?.roles?.join(", ") || user.accountType || "Karyawan"}
        eyebrow="Portal Karyawan"
        title="Personal"
        description="Data diri personal pendaftaran, riwayat perjanjian kerja, dan status perpanjangan kontrak"
        avatarUrl={currentUser?.avatarUrl || user.avatarUrl}
        division={currentUser?.division || user.division}
        onLogout={handleLogout}
      />

      <div className={styles.contentWrapper}>
        {/* Toast Notification */}
        {globalToast && (
          <div
            className={`${styles.feedbackNotice} ${
              globalToast.type === "success" ? styles.feedbackSuccess : styles.feedbackError
            }`}
            style={{ marginBottom: "0.5rem" }}
          >
            {globalToast.message}
          </div>
        )}

        {/* Navigation & Breadcrumb */}
        <div className={styles.topNav}>
          <Link href="/portal" className={styles.backLink}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Kembali ke Portal
          </Link>
          <span className={styles.pageBadge}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            Notifikasi Otomatis Aktif (H-30)
          </span>
        </div>

        {/* Quick Highlights / Stats Ribbon */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.statIconBlue}`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Masa Kerja</span>
              <span className={styles.statValue}>{user.tenure ? user.tenure.formatted : "-"}</span>
              <span className={styles.statHint}>Mulai: {formatDateIndo(user.startDate)}</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.statIconAmber}`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Total Kontrak</span>
              <span className={styles.statValue}>{summary.totalContracts} Periode</span>
              <span className={styles.statHint}>
                {summary.extensionCount > 0 ? `Lanjut ${summary.extensionCount} Kali` : "Kontrak Pertama"}
              </span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.statIconEmerald}`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Sisa Masa Berlaku</span>
              <span className={styles.statValue}>
                {activeContract
                  ? activeContract.daysRemaining >= 0
                    ? `${activeContract.daysRemaining} Hari`
                    : "Kedaluwarsa"
                  : "-"}
              </span>
              <span className={styles.statHint}>
                {activeContract?.isExpiringSoon ? "Perlu Pembaruan" : "Status Aktif"}
              </span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.statIconPurple}`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Pengingat Email</span>
              <span className={styles.statValue}>1 Bulan (H-30)</span>
              <span className={styles.statHint}>Terkirim ke teknisi</span>
            </div>
          </div>
        </div>

        {/* Main 2-Column Grid */}
        <div className={styles.mainGrid}>
          {/* Left Column: Data Diri Personal */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <div className={styles.panelTitleGroup}>
                <div className={styles.panelIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <div>
                  <h3 className={styles.panelTitle}>Data Diri Personal</h3>
                  <p className={styles.panelSubtitle}>Informasi akun saat registrasi karyawan</p>
                </div>
              </div>

              {/* Edit Profile & Change Password Actions */}
              <div className={styles.headerActions}>
                <button
                  type="button"
                  onClick={openEditProfile}
                  className={styles.actionBtnOutline}
                  title="Edit data diri personal"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Edit Profil
                </button>
                <button
                  type="button"
                  onClick={openChangePassword}
                  className={styles.actionBtnOutline}
                  title="Ubah kata sandi akun"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Ubah Password
                </button>
              </div>
            </div>

            <div className={styles.profileList}>
              <div className={styles.profileItem}>
                <span className={styles.profileItemLabel}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  Nama Lengkap
                </span>
                <span className={styles.profileItemValue}>{user.name}</span>
              </div>

              <div className={styles.profileItem}>
                <span className={styles.profileItemLabel}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
                  </svg>
                  Username
                </span>
                <span className={`${styles.profileItemValue} ${styles.profileItemValueHighlight}`}>
                  @{user.username || "-"}
                </span>
              </div>

              <div className={styles.profileItem}>
                <span className={styles.profileItemLabel}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  Alamat Email
                </span>
                <span className={styles.profileItemValue}>{user.email}</span>
              </div>

              <div className={styles.profileItem}>
                <span className={styles.profileItemLabel}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  Nomor HP / WhatsApp
                </span>
                <span className={styles.profileItemValue}>{user.phone || "-"}</span>
              </div>

              <div className={styles.profileItem}>
                <span className={styles.profileItemLabel}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  Tanggal Mulai Bekerja
                </span>
                <span className={styles.profileItemValue}>{formatDateIndo(user.startDate)}</span>
              </div>

              <div className={styles.profileItem}>
                <span className={styles.profileItemLabel}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 14 14" />
                  </svg>
                  Total Masa Kerja
                </span>
                <span className={`${styles.profileItemValue} ${styles.profileItemValueHighlight}`}>
                  {user.tenure ? user.tenure.formatted : "-"}
                </span>
              </div>

              <div className={styles.profileItem}>
                <span className={styles.profileItemLabel}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  </svg>
                  Divisi Kerja
                </span>
                <span className={styles.profileItemValue}>{user.division || "Telco & Operasional"}</span>
              </div>

              <div className={styles.profileItem}>
                <span className={styles.profileItemLabel}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                  ID KPC
                </span>
                <span className={styles.profileItemValue}>{user.kpcId || "-"}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Active Contract & Expiry Notification */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <div className={styles.panelTitleGroup}>
                <div className={styles.panelIcon} style={{ background: "rgba(245, 158, 11, 0.12)", color: "#fbbf24" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <div>
                  <h3 className={styles.panelTitle}>Status Kontrak Berjalan</h3>
                  <p className={styles.panelSubtitle}>Perjanjian kerja aktif &amp; pengingat perpanjangan</p>
                </div>
              </div>
            </div>

            {activeContract ? (
              <div className={styles.activeContractCard}>
                <div className={styles.contractHeaderRow}>
                  <div>
                    <span className={styles.timelineLabel}>{activeContract.sequenceLabel} ({activeContract.contractType})</span>
                    <div className={styles.contractNum}>{activeContract.contractNumber}</div>
                    <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "0.2rem" }}>
                      Posisi: {activeContract.position || "Teknisi"}
                    </div>
                  </div>
                  <span
                    className={`${styles.contractBadge} ${
                      activeContract.isExpired
                        ? styles.badgeExpired
                        : activeContract.isExpiringSoon
                        ? styles.badgeExtended
                        : styles.badgeActive
                    }`}
                  >
                    {activeContract.isExpired
                      ? "Kedaluwarsa"
                      : activeContract.isExpiringSoon
                      ? "Mendekati Jatuh Tempo"
                      : "Aktif"}
                  </span>
                </div>

                <div className={styles.contractTimelineRow}>
                  <div className={styles.timelineCol}>
                    <span className={styles.timelineLabel}>Tanggal Mulai</span>
                    <span className={styles.timelineDate}>{formatDateIndo(activeContract.startDate)}</span>
                  </div>
                  <div className={styles.timelineCol}>
                    <span className={styles.timelineLabel}>Tanggal Selesai</span>
                    <span className={styles.timelineDate} style={{ color: activeContract.isExpiringSoon ? "#fbbf24" : "#ffffff" }}>
                      {formatDateIndo(activeContract.endDate)}
                    </span>
                  </div>
                </div>

                {/* Expiry Alert (≤ 30 Days) */}
                {activeContract.isExpiringSoon && (
                  <div className={styles.expiryAlert}>
                    <div className={styles.alertIcon}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                    </div>
                    <div>
                      <h4 className={styles.alertTitle}>Peringatan Masa Berlaku Kontrak (H-30)</h4>
                      <p className={styles.alertText}>
                        Kontrak kerja Anda akan berakhir dalam <strong>{activeContract.daysRemaining} hari</strong>.
                        Sistem otomatis mengirimkan email pengingat 1 bulan sebelum kontrak berakhir ke alamat <strong>{user.email}</strong>.
                      </p>
                    </div>
                  </div>
                )}

                {/* Manual Test Trigger */}
                <div className={styles.contractActions}>
                  <button
                    onClick={handleSendTestReminder}
                    disabled={sendingTest}
                    className={styles.testButton}
                  >
                    {sendingTest ? (
                      <>
                        <div className={styles.btnSpinner} />
                        Mengirim Uji Notifikasi...
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                          <polyline points="22,6 12,13 2,6" />
                        </svg>
                        Kirim Uji Notifikasi Email (30 Hari)
                      </>
                    )}
                  </button>

                  {testResult && (
                    <div
                      className={`${styles.feedbackNotice} ${
                        testResult.success ? styles.feedbackSuccess : styles.feedbackError
                      }`}
                    >
                      {testResult.message}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className={styles.emptyState}>
                Belum ada data kontrak kerja aktif yang terdaftar.
              </div>
            )}
          </div>
        </div>

        {/* Full-Width Section: Riwayat Kontrak & List Lanjut Kontrak */}
        <div className={styles.historySection}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitleGroup}>
              <div className={styles.panelIcon} style={{ background: "rgba(16, 185, 129, 0.12)", color: "#34d399" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </div>
              <div>
                <h3 className={styles.panelTitle}>Riwayat Kontrak &amp; Perpanjangan</h3>
                <p className={styles.panelSubtitle}>
                  Daftar urutan perpanjangan kontrak (Lanjut ke berapa kali) dan rincian periode
                </p>
              </div>
            </div>

            {/* Add Contract Button */}
            <button
              type="button"
              onClick={openAddContract}
              className={styles.actionBtnPrimary}
              title="Tambah periode kontrak baru"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Tambah Kontrak
            </button>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Tahap &amp; Lanjut</th>
                  <th>Nomor Kontrak</th>
                  <th>Posisi / Jabatan</th>
                  <th>Periode Kontrak</th>
                  <th>Durasi</th>
                  <th>Status</th>
                  <th>Notifikasi H-30</th>
                  <th>Catatan</th>
                  <th style={{ textAlign: "center" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {contracts.length > 0 ? (
                  contracts.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div className={styles.sequenceTag}>
                          <span className={styles.sequenceNumBadge}>{c.sequenceNumber}</span>
                          <div>
                            <div>{c.sequenceLabel}</div>
                            <div style={{ fontSize: "0.72rem", color: "#64748b" }}>
                              {c.sequenceNumber === 1
                                ? "Kontrak Awal"
                                : `Lanjut ke-${c.sequenceNumber - 1}`}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={styles.contractCode}>{c.contractNumber}</span>
                        <div style={{ fontSize: "0.72rem", color: "#64748b" }}>{c.contractType}</div>
                      </td>
                      <td>{c.position || "Teknisi"}</td>
                      <td>
                        <div>{formatDateIndo(c.startDate)}</div>
                        <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                          s/d {formatDateIndo(c.endDate)}
                        </div>
                      </td>
                      <td>{c.durationDays} Hari</td>
                      <td>
                        <span
                          className={`${styles.contractBadge} ${
                            c.status === "active"
                              ? styles.badgeActive
                              : c.status === "extended"
                              ? styles.badgeExtended
                              : styles.badgeExpired
                          }`}
                        >
                          {c.status === "active"
                            ? "Aktif"
                            : c.status === "extended"
                            ? "Diperpanjang"
                            : "Selesai"}
                        </span>
                      </td>
                      <td>
                        {c.reminderSentAt ? (
                          <span className={styles.reminderSentBadge} title={`Terkirim: ${c.reminderSentAt}`}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            Terkirim
                          </span>
                        ) : c.status === "active" ? (
                          <span style={{ fontSize: "0.75rem", color: "#fbbf24" }}>Menunggu Jatuh Tempo</span>
                        ) : (
                          <span style={{ fontSize: "0.75rem", color: "#64748b" }}>-</span>
                        )}
                      </td>
                      <td style={{ fontSize: "0.78rem", color: "#94a3b8", maxWidth: "220px" }}>
                        {c.notes || "-"}
                      </td>
                      <td>
                        <div className={styles.tableActions}>
                          <button
                            type="button"
                            onClick={() => openEditContract(c)}
                            className={styles.tableActionBtn}
                            title="Edit data kontrak ini"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => openDeleteContract({ id: c.id, contractNumber: c.contractNumber })}
                            className={`${styles.tableActionBtn} ${styles.tableActionBtnDelete}`}
                            title="Hapus periode kontrak ini"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className={styles.emptyState}>
                      Tidak ada riwayat kontrak kerja yang tercatat.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* --- MODAL: EDIT DATA DIRI PERSONAL --- */}
      {isEditProfileOpen && (
        <div className={styles.modalOverlay} onClick={() => !submitting && setIsEditProfileOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Edit Data Diri Personal</h3>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => !submitting && setIsEditProfileOpen(false)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmitProfile}>
              <div className={styles.modalBody}>
                {modalError && <div className={`${styles.feedbackNotice} ${styles.feedbackError}`}>{modalError}</div>}

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    className={styles.formInput}
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  />
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Username</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      placeholder="username_anda"
                      value={profileForm.username}
                      onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
                    />
                    <span className={styles.formHint}>Huruf kecil, angka, atau garis bawah</span>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Nomor HP / WA</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      placeholder="081234567890"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Tanggal Mulai Bekerja</label>
                    <input
                      type="date"
                      className={styles.formInput}
                      value={profileForm.startDate}
                      onChange={(e) => setProfileForm({ ...profileForm, startDate: e.target.value })}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>ID KPC</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      placeholder="KPC-88201"
                      value={profileForm.kpcId}
                      onChange={(e) => setProfileForm({ ...profileForm, kpcId: e.target.value })}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Divisi Kerja</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={profileForm.division}
                    onChange={(e) => setProfileForm({ ...profileForm, division: e.target.value })}
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setIsEditProfileOpen(false)}
                  className={styles.btnCancel}
                >
                  Batal
                </button>
                <button type="submit" disabled={submitting} className={styles.btnSave}>
                  {submitting ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: UBAH KATA SANDI --- */}
      {isChangePasswordOpen && (
        <div className={styles.modalOverlay} onClick={() => !submitting && setIsChangePasswordOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Ubah Kata Sandi</h3>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => !submitting && setIsChangePasswordOpen(false)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmitPassword}>
              <div className={styles.modalBody}>
                {modalError && <div className={`${styles.feedbackNotice} ${styles.feedbackError}`}>{modalError}</div>}

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Kata Sandi Saat Ini</label>
                  <input
                    type="password"
                    required
                    className={styles.formInput}
                    placeholder="Masukkan kata sandi lama Anda"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Kata Sandi Baru</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    className={styles.formInput}
                    placeholder="Minimal 8 karakter"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Konfirmasi Kata Sandi Baru</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    className={styles.formInput}
                    placeholder="Ulangi kata sandi baru"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setIsChangePasswordOpen(false)}
                  className={styles.btnCancel}
                >
                  Batal
                </button>
                <button type="submit" disabled={submitting} className={styles.btnSave}>
                  {submitting ? "Memproses..." : "Perbarui Kata Sandi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: TAMBAH / EDIT KONTRAK KERJA --- */}
      {isContractModalOpen && (
        <div className={styles.modalOverlay} onClick={() => !submitting && setIsContractModalOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                {contractModalMode === "create" ? "Tambah Periode Kontrak Baru" : "Edit Periode Kontrak"}
              </h3>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => !submitting && setIsContractModalOpen(false)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmitContract}>
              <div className={styles.modalBody}>
                {modalError && <div className={`${styles.feedbackNotice} ${styles.feedbackError}`}>{modalError}</div>}

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Nomor Kontrak</label>
                    <input
                      type="text"
                      required
                      placeholder="015/PKWT-MKN/I/2026"
                      className={styles.formInput}
                      value={contractForm.contractNumber}
                      onChange={(e) => setContractForm({ ...contractForm, contractNumber: e.target.value })}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Urutan Tahap (Ke-X)</label>
                    <input
                      type="number"
                      required
                      min={1}
                      className={styles.formInput}
                      value={contractForm.sequenceNumber}
                      onChange={(e) =>
                        setContractForm({ ...contractForm, sequenceNumber: parseInt(e.target.value) || 1 })
                      }
                    />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Jenis / Tahap Kontrak</label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Perpanjangan Ke-2"
                      className={styles.formInput}
                      value={contractForm.contractType}
                      onChange={(e) => setContractForm({ ...contractForm, contractType: e.target.value })}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Status Kontrak</label>
                    <select
                      className={styles.formSelect}
                      value={contractForm.status}
                      onChange={(e) => setContractForm({ ...contractForm, status: e.target.value })}
                    >
                      <option value="active">Aktif (Sedang Berjalan)</option>
                      <option value="extended">Diperpanjang (Lanjut)</option>
                      <option value="completed">Selesai (Completed)</option>
                    </select>
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Tanggal Mulai</label>
                    <input
                      type="date"
                      required
                      className={styles.formInput}
                      value={contractForm.startDate}
                      onChange={(e) => setContractForm({ ...contractForm, startDate: e.target.value })}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Tanggal Selesai</label>
                    <input
                      type="date"
                      required
                      className={styles.formInput}
                      value={contractForm.endDate}
                      onChange={(e) => setContractForm({ ...contractForm, endDate: e.target.value })}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Posisi / Jabatan</label>
                  <input
                    type="text"
                    placeholder="Teknisi Telco Senior"
                    className={styles.formInput}
                    value={contractForm.position}
                    onChange={(e) => setContractForm({ ...contractForm, position: e.target.value })}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Catatan Evaluasi / Keterangan</label>
                  <textarea
                    rows={3}
                    placeholder="Catatan hasil evaluasi kerja atau perpanjangan kontrak"
                    className={styles.formTextarea}
                    value={contractForm.notes}
                    onChange={(e) => setContractForm({ ...contractForm, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setIsContractModalOpen(false)}
                  className={styles.btnCancel}
                >
                  Batal
                </button>
                <button type="submit" disabled={submitting} className={styles.btnSave}>
                  {submitting ? "Menyimpan..." : "Simpan Kontrak"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: KONFIRMASI HAPUS KONTRAK --- */}
      {isDeleteModalOpen && contractToDelete && (
        <div className={styles.modalOverlay} onClick={() => !submitting && setIsDeleteModalOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle} style={{ color: "#f87171" }}>
                Konfirmasi Hapus Kontrak
              </h3>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => !submitting && setIsDeleteModalOpen(false)}
              >
                &times;
              </button>
            </div>

            <div className={styles.modalBody}>
              {modalError && <div className={`${styles.feedbackNotice} ${styles.feedbackError}`}>{modalError}</div>}

              <p style={{ color: "#e2e8f0", lineHeight: 1.5, margin: 0 }}>
                Apakah Anda yakin ingin menghapus data kontrak nomor{" "}
                <strong style={{ color: "#38bdf8" }}>{contractToDelete.contractNumber}</strong>?
              </p>
              <p style={{ color: "#94a3b8", fontSize: "0.8rem", margin: "0.5rem 0 0 0" }}>
                Tindakan ini akan menghapus periode kontrak tersebut dari riwayat sistem dan memperbarui kembali total hitungan perpanjangan kontrak.
              </p>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setIsDeleteModalOpen(false)}
                className={styles.btnCancel}
              >
                Batal
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmDeleteContract}
                className={styles.btnDanger}
              >
                {submitting ? "Menghapus..." : "Hapus Permanen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
