"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PortalWorkspaceLayout } from "@/components/layout/portal-workspace-layout";
import { type PortalUser, api } from "@/lib/api";
import styles from "./lv-workspace.module.css";

interface LvWorkspaceProps {
  user?: PortalUser;
  onLogout?: () => void;
}

interface GpsInfoItem {
  id: number;
  imei: string;
  lvNumber: string;
  gsmNumber: string;
  simProvider: string;
  activeUntil: string | null;
  notes: string | null;
  createdAt: string;
}

interface OverspeedLogItem {
  id: number;
  lvNumber: string;
  location: string;
  speed: number;
  speedLimit: number;
  occurredAt: string;
  driverName: string | null;
  notes: string | null;
}

interface CommissioningItem {
  id: number;
  lvNumber: string;
  kpcCommissioningNo: string | null;
  validityDate: string;
  status: string;
  reminderEmail: string | null;
  daysRemaining?: number;
  notes: string | null;
}

interface LvStats {
  totalGpsUnits: number;
  totalOverspeedLogs: number;
  totalCommissioning: number;
  expiringSoonCount: number;
}

export function LvWorkspace({ user: initialUser, onLogout: initialOnLogout }: LvWorkspaceProps) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<PortalUser | null>(initialUser || null);

  // Sidebar navigation menu
  const [activeMenu, setActiveMenu] = useState<"gps-lv" | "commissioning-lv">("gps-lv");
  // Sub-tabs for GPS LV
  const [activeGpsTab, setActiveGpsTab] = useState<"live" | "overspeed" | "imei">("live");

  // Data states
  const [stats, setStats] = useState<LvStats>({
    totalGpsUnits: 0,
    totalOverspeedLogs: 0,
    totalCommissioning: 0,
    expiringSoonCount: 0
  });
  const [gpsList, setGpsList] = useState<GpsInfoItem[]>([]);
  const [overspeedList, setOverspeedList] = useState<OverspeedLogItem[]>([]);
  const [commissioningList, setCommissioningList] = useState<CommissioningItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Modals
  const [showGpsModal, setShowGpsModal] = useState(false);
  const [showOverspeedModal, setShowOverspeedModal] = useState(false);
  const [showCommModal, setShowCommModal] = useState(false);
  const [editingGpsId, setEditingGpsId] = useState<number | null>(null);
  const [editingCommId, setEditingCommId] = useState<number | null>(null);

  // Forms
  const [gpsForm, setGpsForm] = useState({
    imei: "",
    lvNumber: "",
    gsmNumber: "",
    simProvider: "Telkomsel",
    activeUntil: "",
    notes: ""
  });

  const [overspeedForm, setOverspeedForm] = useState({
    lvNumber: "",
    location: "",
    speed: 65,
    speedLimit: 60,
    driverName: "",
    occurredAt: new Date().toISOString().slice(0, 16),
    notes: ""
  });

  const [commForm, setCommForm] = useState({
    lvNumber: "",
    kpcCommissioningNo: "",
    validityDate: "",
    reminderEmail: "ops.telco@mknsite.online",
    notes: ""
  });

  // Load stats & lists
  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, gpsRes, overspeedRes, commRes] = await Promise.all([
        api<{ success: boolean; data: LvStats }>("/lv-mkn/stats").catch(() => ({ data: null })),
        api<{ success: boolean; data: GpsInfoItem[] }>("/lv-mkn/gps-info").catch(() => ({ data: [] })),
        api<{ success: boolean; data: OverspeedLogItem[] }>("/lv-mkn/overspeed-logs").catch(() => ({ data: [] })),
        api<{ success: boolean; data: CommissioningItem[] }>("/lv-mkn/commissioning").catch(() => ({ data: [] }))
      ]);

      if (statsRes?.data) setStats(statsRes.data);
      if (gpsRes?.data) setGpsList(gpsRes.data);
      if (overspeedRes?.data) setOverspeedList(overspeedRes.data);
      if (commRes?.data) setCommissioningList(commRes.data);
    } catch (err: any) {
      console.error("Gagal memuat data LV MKN:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser) {
      api<{ user: PortalUser }>("/auth/me")
        .then((res) => setCurrentUser(res.user))
        .catch(() => router.replace("/login"));
    }
    loadData();
  }, [currentUser, router]);

  const handleLogout = async () => {
    if (initialOnLogout) {
      initialOnLogout();
      return;
    }
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
  };

  const showToast = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Handlers for GPS info
  const handleSaveGps = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingGpsId) {
        await api(`/lv-mkn/gps-info/${editingGpsId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(gpsForm)
        });
        showToast("success", "Data IMEI GPS berhasil diperbarui");
      } else {
        await api("/lv-mkn/gps-info", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(gpsForm)
        });
        showToast("success", "Data IMEI GPS baru berhasil disimpan");
      }
      setShowGpsModal(false);
      setEditingGpsId(null);
      setGpsForm({ imei: "", lvNumber: "", gsmNumber: "", simProvider: "Telkomsel", activeUntil: "", notes: "" });
      loadData();
    } catch (err: any) {
      showToast("error", err?.message || "Gagal menyimpan data IMEI GPS");
    }
  };

  const handleDeleteGps = async (id: number) => {
    if (!confirm("Hapus data IMEI GPS ini?")) return;
    try {
      await api(`/lv-mkn/gps-info/${id}`, { method: "DELETE" });
      showToast("success", "Data IMEI GPS berhasil dihapus");
      loadData();
    } catch (err: any) {
      showToast("error", err?.message || "Gagal menghapus data");
    }
  };

  // Handlers for Overspeed
  const handleSaveOverspeed = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api("/lv-mkn/overspeed-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...overspeedForm,
          speed: Number(overspeedForm.speed),
          speedLimit: Number(overspeedForm.speedLimit)
        })
      });
      showToast("success", "Laporan overspeed berhasil disimpan");
      setShowOverspeedModal(false);
      setOverspeedForm({
        lvNumber: "",
        location: "",
        speed: 65,
        speedLimit: 60,
        driverName: "",
        occurredAt: new Date().toISOString().slice(0, 16),
        notes: ""
      });
      loadData();
    } catch (err: any) {
      showToast("error", err?.message || "Gagal menyimpan laporan overspeed");
    }
  };

  // Handlers for Commissioning
  const handleSaveComm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCommId) {
        await api(`/lv-mkn/commissioning/${editingCommId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(commForm)
        });
        showToast("success", "Data Commissioning LV berhasil diperbarui");
      } else {
        await api("/lv-mkn/commissioning", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(commForm)
        });
        showToast("success", "Data Commissioning LV berhasil ditambahkan");
      }
      setShowCommModal(false);
      setEditingCommId(null);
      setCommForm({ lvNumber: "", kpcCommissioningNo: "", validityDate: "", reminderEmail: "ops.telco@mknsite.online", notes: "" });
      loadData();
    } catch (err: any) {
      showToast("error", err?.message || "Gagal menyimpan data Commissioning");
    }
  };

  const handleDeleteComm = async (id: number) => {
    if (!confirm("Hapus data Commissioning LV ini?")) return;
    try {
      await api(`/lv-mkn/commissioning/${id}`, { method: "DELETE" });
      showToast("success", "Data Commissioning berhasil dihapus");
      loadData();
    } catch (err: any) {
      showToast("error", err?.message || "Gagal menghapus data");
    }
  };

  const handleCheckReminders = async () => {
    try {
      const res = await api<{ success: boolean; message: string; units: string[] }>("/lv-mkn/commissioning/check-reminders", {
        method: "POST"
      });
      showToast("success", res.message || "Pengecekan selesai");
      loadData();
    } catch (err: any) {
      showToast("error", err?.message || "Gagal memeriksa reminder");
    }
  };

  // Navigation sidebar configuration
  const sidebarGroups = [
    {
      group: "Manajemen Armada LV",
      items: [
        {
          id: "gps-lv",
          title: "GPS LV",
          badge: "GPS",
          description: "Live Tracking, Overspeed & Data IMEI",
          isActive: activeMenu === "gps-lv",
          onClick: () => setActiveMenu("gps-lv")
        },
        {
          id: "commissioning-lv",
          title: "Commissioning LV",
          badge: "KPC",
          description: "Masa Berlaku Stiker & Email Reminder",
          isActive: activeMenu === "commissioning-lv",
          onClick: () => setActiveMenu("commissioning-lv")
        }
      ]
    }
  ];

  if (!currentUser) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <p style={{ color: "#64748b", fontWeight: 600 }}>Memuat profil pengguna...</p>
      </div>
    );
  }

  return (
    <PortalWorkspaceLayout
      user={currentUser}
      portalTitle="LV MKN"
      portalSubtitle="Sistem Pelacakan GPS, Kecepatan, dan Commissioning Unit Lapangan"
      portalIcon="🚗"
      portalColor="sky"
      sidebarGroups={sidebarGroups}
      breadcrumbs={[
        { label: "Portal", href: "/portal" },
        { label: "LV MKN", href: "/portal/lv-mkn" },
        { label: activeMenu === "gps-lv" ? "GPS LV" : "Commissioning LV" }
      ]}
      onLogout={handleLogout}
    >
      <div className={styles.container}>
        {/* Notifikasi Toast */}
        {notification && (
          <div
            style={{
              padding: "0.85rem 1.25rem",
              borderRadius: "8px",
              background: notification.type === "success" ? "#ecfdf5" : "#fef2f2",
              border: `1px solid ${notification.type === "success" ? "#a7f3d0" : "#fecaca"}`,
              color: notification.type === "success" ? "#065f46" : "#991b1b",
              fontWeight: 600,
              fontSize: "0.9rem"
            }}
          >
            {notification.message}
          </div>
        )}

        {/* Ringkasan Statistik */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statTitle}>Total Unit GPS Terdaftar</span>
            <span className={styles.statValue}>{stats.totalGpsUnits}</span>
            <span className={styles.statSub}>Unit kendaraan terlacak</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statTitle}>Laporan Overspeed</span>
            <span className={styles.statValue}>{stats.totalOverspeedLogs}</span>
            <span className={styles.statSub}>Total insiden tercatat</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statTitle}>Commissioning LV</span>
            <span className={styles.statValue}>{stats.totalCommissioning}</span>
            <span className={styles.statSub}>Total unit terdaftar di KPC</span>
          </div>
          <div className={`${styles.statCard} ${stats.expiringSoonCount > 0 ? styles.statAlert : ""}`}>
            <span className={styles.statTitle}>Masa Berlaku &lt; 30 Hari</span>
            <span className={styles.statValue} style={{ color: stats.expiringSoonCount > 0 ? "#d97706" : "#0f172a" }}>
              {stats.expiringSoonCount} Unit
            </span>
            <span className={styles.statSub}>Perlu perpanjangan commissioning</span>
          </div>
        </div>

        {/* ======================================================== */}
        {/* MENU 1: GPS LV                                           */}
        {/* ======================================================== */}
        {activeMenu === "gps-lv" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Tab Navigasi Atas */}
            <div className={styles.tabBar}>
              <button
                type="button"
                className={`${styles.tabButton} ${activeGpsTab === "live" ? styles.tabActive : ""}`}
                onClick={() => setActiveGpsTab("live")}
              >
                📍 Tab 1: Live GPS LV
              </button>
              <button
                type="button"
                className={`${styles.tabButton} ${activeGpsTab === "overspeed" ? styles.tabActive : ""}`}
                onClick={() => setActiveGpsTab("overspeed")}
              >
                ⚡ Tab 2: Laporan Overspeed
              </button>
              <button
                type="button"
                className={`${styles.tabButton} ${activeGpsTab === "imei" ? styles.tabActive : ""}`}
                onClick={() => setActiveGpsTab("imei")}
              >
                📶 Tab 3: Data IMEI & GSM GPS
              </button>
            </div>

            {/* TAB 1: LIVE GPS */}
            {activeGpsTab === "live" && (
              <div className={styles.gpsFrameContainer}>
                <div className={styles.gpsNotice}>
                  <div>
                    <p className={styles.gpsNoticeText}>
                      <strong>Integrasi GPS Live:</strong> Layanan pelacak terhubung ke sistem pemantauan GPS armada MKN.
                    </p>
                    <small style={{ color: "#64748b" }}>
                      Untuk akses langsung atau konfigurasi akun pelacak, Anda dapat membuka dashboard Zumiot GPS secara terpisah.
                    </small>
                  </div>
                  <a
                    href="https://gps.zumiot.id/Home"
                    target="_blank"
                    rel="noreferrer"
                    className={styles.btnSecondary}
                    style={{ textDecoration: "none" }}
                  >
                    Buka gps.zumiot.id ↗
                  </a>
                </div>

                <div className={styles.gpsIframeWrapper}>
                  <iframe
                    src="https://gps.zumiot.id/"
                    title="Live Tracking Zumiot GPS"
                    className={styles.gpsIframe}
                    sandbox="allow-scripts allow-same-origin allow-forms"
                  />
                </div>
              </div>
            )}

            {/* TAB 2: LAPORAN OVERSPEED */}
            {activeGpsTab === "overspeed" && (
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <h2 className={styles.cardTitle}>Laporan Kecepatan Melebihi Batas (Overspeed)</h2>
                    <p className={styles.cardSubtitle}>
                      Pencatatan pelanggaran batas kecepatan (Speed Limit) kendaraan di area operasional site.
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      onClick={() => window.print()}
                    >
                      🖨️ Cetak Rekap Laporan
                    </button>
                    <button
                      type="button"
                      className={styles.btnPrimary}
                      onClick={() => setShowOverspeedModal(true)}
                    >
                      + Buat Laporan Overspeed
                    </button>
                  </div>
                </div>

                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>No.</th>
                        <th>Nomor LV</th>
                        <th>Waktu Kejadian</th>
                        <th>Lokasi Kejadian</th>
                        <th>Kecepatan</th>
                        <th>Batas (Limit)</th>
                        <th>Pengemudi (Driver)</th>
                        <th>Keterangan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overspeedList.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
                            Belum ada catatan overspeed kendaraan.
                          </td>
                        </tr>
                      ) : (
                        overspeedList.map((log, index) => (
                          <tr key={log.id}>
                            <td>{index + 1}</td>
                            <td><strong>{log.lvNumber}</strong></td>
                            <td>{new Date(log.occurredAt).toLocaleString("id-ID")}</td>
                            <td>{log.location}</td>
                            <td>
                              <span className={`${styles.badge} ${styles.badgeRed}`}>
                                {log.speed} km/jam
                              </span>
                            </td>
                            <td>{log.speedLimit} km/jam</td>
                            <td>{log.driverName || "-"}</td>
                            <td>{log.notes || "-"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: DATA IMEI GPS */}
            {activeGpsTab === "imei" && (
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <h2 className={styles.cardTitle}>Data Registrasi IMEI GPS & Kartu GSM</h2>
                    <p className={styles.cardSubtitle}>
                      Informasi identitas modul GPS, nomor lambung LV, dan masa aktif kuota GSM.
                    </p>
                  </div>
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    onClick={() => {
                      setEditingGpsId(null);
                      setGpsForm({ imei: "", lvNumber: "", gsmNumber: "", simProvider: "Telkomsel", activeUntil: "", notes: "" });
                      setShowGpsModal(true);
                    }}
                  >
                    + Daftarkan IMEI GPS
                  </button>
                </div>

                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>No.</th>
                        <th>Nomor IMEI GPS</th>
                        <th>Nomor LV</th>
                        <th>Nomor Kartu GSM</th>
                        <th>Provider SIM</th>
                        <th>Masa Aktif Kartu</th>
                        <th>Catatan</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gpsList.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
                            Belum ada data IMEI GPS yang terdaftar.
                          </td>
                        </tr>
                      ) : (
                        gpsList.map((item, index) => (
                          <tr key={item.id}>
                            <td>{index + 1}</td>
                            <td><code>{item.imei}</code></td>
                            <td><strong>{item.lvNumber}</strong></td>
                            <td>{item.gsmNumber}</td>
                            <td>{item.simProvider}</td>
                            <td>
                              {item.activeUntil ? (
                                <span className={`${styles.badge} ${styles.badgeBlue}`}>
                                  {new Date(item.activeUntil).toLocaleDateString("id-ID")}
                                </span>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td>{item.notes || "-"}</td>
                            <td>
                              <div style={{ display: "flex", gap: "0.4rem" }}>
                                <button
                                  type="button"
                                  className={styles.btnEdit}
                                  onClick={() => {
                                    setEditingGpsId(item.id);
                                    setGpsForm({
                                      imei: item.imei,
                                      lvNumber: item.lvNumber,
                                      gsmNumber: item.gsmNumber,
                                      simProvider: item.simProvider || "Telkomsel",
                                      activeUntil: item.activeUntil || "",
                                      notes: item.notes || ""
                                    });
                                    setShowGpsModal(true);
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className={styles.btnDanger}
                                  onClick={() => handleDeleteGps(item.id)}
                                >
                                  Hapus
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* MENU 2: COMMISSIONING LV                                 */}
        {/* ======================================================== */}
        {activeMenu === "commissioning-lv" && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>Status Masa Berlaku Commissioning LV di KPC</h2>
                <p className={styles.cardSubtitle}>
                  Sistem otomatis memberikan peringatan jika masa berlaku stiker commissioning kurang dari 1 bulan (30 hari).
                </p>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={handleCheckReminders}
                >
                  🔔 Cek & Kirim Reminder Email
                </button>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={() => {
                    setEditingCommId(null);
                    setCommForm({ lvNumber: "", kpcCommissioningNo: "", validityDate: "", reminderEmail: "ops.telco@mknsite.online", notes: "" });
                    setShowCommModal(true);
                  }}
                >
                  + Tambah Data Commissioning
                </button>
              </div>
            </div>

            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>Nomor LV</th>
                    <th>No. Commissioning KPC</th>
                    <th>Masa Berlaku</th>
                    <th>Sisa Waktu</th>
                    <th>Status</th>
                    <th>Email Pengingat</th>
                    <th>Catatan</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {commissioningList.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
                        Belum ada data commissioning kendaraan.
                      </td>
                    </tr>
                  ) : (
                    commissioningList.map((comm, index) => {
                      let badgeClass = styles.badgeGreen;
                      if (comm.status === "Segera Habis") badgeClass = styles.badgeYellow;
                      if (comm.status === "Kedaluwarsa") badgeClass = styles.badgeRed;

                      return (
                        <tr key={comm.id}>
                          <td>{index + 1}</td>
                          <td><strong>{comm.lvNumber}</strong></td>
                          <td>{comm.kpcCommissioningNo || "-"}</td>
                          <td>{new Date(comm.validityDate).toLocaleDateString("id-ID")}</td>
                          <td>
                            {comm.daysRemaining !== undefined ? (
                              comm.daysRemaining < 0 ? (
                                <span style={{ color: "#ef4444", fontWeight: 600 }}>
                                  Lewat {Math.abs(comm.daysRemaining)} hari
                                </span>
                              ) : (
                                <span style={{ color: comm.daysRemaining <= 30 ? "#d97706" : "#059669", fontWeight: 600 }}>
                                  {comm.daysRemaining} hari lagi
                                </span>
                              )
                            ) : (
                              "-"
                            )}
                          </td>
                          <td>
                            <span className={`${styles.badge} ${badgeClass}`}>
                              {comm.status}
                            </span>
                          </td>
                          <td>{comm.reminderEmail || "-"}</td>
                          <td>{comm.notes || "-"}</td>
                          <td>
                            <div style={{ display: "flex", gap: "0.4rem" }}>
                              <button
                                type="button"
                                className={styles.btnEdit}
                                onClick={() => {
                                  setEditingCommId(comm.id);
                                  setCommForm({
                                    lvNumber: comm.lvNumber,
                                    kpcCommissioningNo: comm.kpcCommissioningNo || "",
                                    validityDate: comm.validityDate,
                                    reminderEmail: comm.reminderEmail || "ops.telco@mknsite.online",
                                    notes: comm.notes || ""
                                  });
                                  setShowCommModal(true);
                                }}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className={styles.btnDanger}
                                onClick={() => handleDeleteComm(comm.id)}
                              >
                                Hapus
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MODAL FORM: IMEI GPS                                     */}
        {/* ======================================================== */}
        {showGpsModal && (
          <div className={styles.modalBackdrop}>
            <div className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>
                  {editingGpsId ? "Edit Data IMEI GPS" : "Daftarkan IMEI GPS Baru"}
                </h3>
                <button
                  type="button"
                  className={styles.modalClose}
                  onClick={() => setShowGpsModal(false)}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveGps}>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Nomor IMEI GPS *</label>
                    <input
                      type="text"
                      className={styles.input}
                      required
                      placeholder="Contoh: 864201048291038"
                      value={gpsForm.imei}
                      onChange={(e) => setGpsForm({ ...gpsForm, imei: e.target.value })}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Nomor Lambung LV *</label>
                    <input
                      type="text"
                      className={styles.input}
                      required
                      placeholder="Contoh: LV-01 (KT 1234 MK)"
                      value={gpsForm.lvNumber}
                      onChange={(e) => setGpsForm({ ...gpsForm, lvNumber: e.target.value })}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Nomor GSM Kartu SIM *</label>
                    <input
                      type="text"
                      className={styles.input}
                      required
                      placeholder="Contoh: 081255431201"
                      value={gpsForm.gsmNumber}
                      onChange={(e) => setGpsForm({ ...gpsForm, gsmNumber: e.target.value })}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Provider SIM</label>
                    <select
                      className={styles.select}
                      value={gpsForm.simProvider}
                      onChange={(e) => setGpsForm({ ...gpsForm, simProvider: e.target.value })}
                    >
                      <option value="Telkomsel">Telkomsel</option>
                      <option value="Indosat">Indosat</option>
                      <option value="XL Axiata">XL Axiata</option>
                      <option value="Smartfren">Smartfren</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Masa Aktif Kuota/SIM</label>
                    <input
                      type="date"
                      className={styles.input}
                      value={gpsForm.activeUntil}
                      onChange={(e) => setGpsForm({ ...gpsForm, activeUntil: e.target.value })}
                    />
                  </div>
                </div>

                <div className={styles.formGroup} style={{ marginBottom: "1rem" }}>
                  <label className={styles.label}>Catatan Tambahan</label>
                  <textarea
                    className={styles.textarea}
                    placeholder="Catatan penempatan perangkat atau riwayat servis..."
                    value={gpsForm.notes}
                    onChange={(e) => setGpsForm({ ...gpsForm, notes: e.target.value })}
                  />
                </div>

                <div className={styles.modalFooter}>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => setShowGpsModal(false)}
                  >
                    Batal
                  </button>
                  <button type="submit" className={styles.btnPrimary}>
                    Simpan Data IMEI
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MODAL FORM: OVERSPEED LOG                                */}
        {/* ======================================================== */}
        {showOverspeedModal && (
          <div className={styles.modalBackdrop}>
            <div className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Buat Laporan Overspeed Kendaraan</h3>
                <button
                  type="button"
                  className={styles.modalClose}
                  onClick={() => setShowOverspeedModal(false)}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveOverspeed}>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Nomor Lambung LV *</label>
                    <input
                      type="text"
                      className={styles.input}
                      required
                      placeholder="Contoh: LV-01"
                      value={overspeedForm.lvNumber}
                      onChange={(e) => setOverspeedForm({ ...overspeedForm, lvNumber: e.target.value })}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Lokasi Kejadian *</label>
                    <input
                      type="text"
                      className={styles.input}
                      required
                      placeholder="Contoh: Hauling Road KM 12"
                      value={overspeedForm.location}
                      onChange={(e) => setOverspeedForm({ ...overspeedForm, location: e.target.value })}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Waktu & Jam Kejadian *</label>
                    <input
                      type="datetime-local"
                      className={styles.input}
                      required
                      value={overspeedForm.occurredAt}
                      onChange={(e) => setOverspeedForm({ ...overspeedForm, occurredAt: e.target.value })}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Kecepatan Terdeteksi (km/jam) *</label>
                    <input
                      type="number"
                      className={styles.input}
                      required
                      min={1}
                      max={180}
                      value={overspeedForm.speed}
                      onChange={(e) => setOverspeedForm({ ...overspeedForm, speed: Number(e.target.value) })}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Batas Kecepatan Area (km/jam)</label>
                    <input
                      type="number"
                      className={styles.input}
                      required
                      value={overspeedForm.speedLimit}
                      onChange={(e) => setOverspeedForm({ ...overspeedForm, speedLimit: Number(e.target.value) })}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Nama Pengemudi (Driver)</label>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="Nama pengemudi bertugas"
                      value={overspeedForm.driverName}
                      onChange={(e) => setOverspeedForm({ ...overspeedForm, driverName: e.target.value })}
                    />
                  </div>
                </div>

                <div className={styles.formGroup} style={{ marginBottom: "1rem" }}>
                  <label className={styles.label}>Catatan Insiden</label>
                  <textarea
                    className={styles.textarea}
                    placeholder="Alasan overspeed atau tindakan pembinaan..."
                    value={overspeedForm.notes}
                    onChange={(e) => setOverspeedForm({ ...overspeedForm, notes: e.target.value })}
                  />
                </div>

                <div className={styles.modalFooter}>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => setShowOverspeedModal(false)}
                  >
                    Batal
                  </button>
                  <button type="submit" className={styles.btnPrimary}>
                    Simpan Laporan
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MODAL FORM: COMMISSIONING LV                             */}
        {/* ======================================================== */}
        {showCommModal && (
          <div className={styles.modalBackdrop}>
            <div className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>
                  {editingCommId ? "Update Masa Berlaku Commissioning" : "Tambah Data Commissioning LV"}
                </h3>
                <button
                  type="button"
                  className={styles.modalClose}
                  onClick={() => setShowCommModal(false)}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveComm}>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Nomor Lambung LV *</label>
                    <input
                      type="text"
                      className={styles.input}
                      required
                      placeholder="Contoh: LV-01 (KT 1234 MK)"
                      value={commForm.lvNumber}
                      onChange={(e) => setCommForm({ ...commForm, lvNumber: e.target.value })}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Nomor Commissioning KPC</label>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="Contoh: KPC-COMM-2026-001"
                      value={commForm.kpcCommissioningNo}
                      onChange={(e) => setCommForm({ ...commForm, kpcCommissioningNo: e.target.value })}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Tanggal Masa Berlaku *</label>
                    <input
                      type="date"
                      className={styles.input}
                      required
                      value={commForm.validityDate}
                      onChange={(e) => setCommForm({ ...commForm, validityDate: e.target.value })}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Email Tujuan Reminder</label>
                    <input
                      type="email"
                      className={styles.input}
                      placeholder="ops.telco@mknsite.online"
                      value={commForm.reminderEmail}
                      onChange={(e) => setCommForm({ ...commForm, reminderEmail: e.target.value })}
                    />
                  </div>
                </div>

                <div className={styles.formGroup} style={{ marginBottom: "1rem" }}>
                  <label className={styles.label}>Catatan Unit</label>
                  <textarea
                    className={styles.textarea}
                    placeholder="Kelengkapan safety cone, apar, kotak p3k, rotari..."
                    value={commForm.notes}
                    onChange={(e) => setCommForm({ ...commForm, notes: e.target.value })}
                  />
                </div>

                <div className={styles.modalFooter}>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => setShowCommModal(false)}
                  >
                    Batal
                  </button>
                  <button type="submit" className={styles.btnPrimary}>
                    Simpan Commissioning
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </PortalWorkspaceLayout>
  );
}
