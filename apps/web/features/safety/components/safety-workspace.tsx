"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { PortalWorkspaceLayout } from "@/components/layout/portal-workspace-layout";
import { type PortalUser, api } from "@/lib/api";
import styles from "./safety-workspace.module.css";

interface SafetyWorkspaceProps {
  user?: PortalUser;
  onLogout?: () => void;
}

interface SafetyPermitItem {
  id: number;
  permitNumber: string;
  permitType: string;
  title: string;
  location: string;
  gpsCoordinates: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
  picName: string | null;
  picPhone: string | null;
  scannedDocUrl: string | null;
  description: string | null;
  createdAt: string;
}

interface TrainingCourseItem {
  id: number;
  courseCode: string;
  courseTitle: string;
  category: string;
}

interface MatrixEmployeeItem {
  badgeNumber: string;
  employeeName: string;
  positionTitle: string | null;
  department: string | null;
  trainings: Record<string, { status: string; trainingDate: string | null; notes: string | null }>;
}

interface SafetyMessageItem {
  id: number;
  monthYear: string;
  title: string;
  content: string | null;
  attendeeName: string | null;
  attendeeBadge: string | null;
  signatureData: string | null;
  signedAt: string | null;
  createdAt: string;
}

interface SafetyStats {
  totalPermits: number;
  activePermits: number;
  totalTrainingRecords: number;
  totalSafetyMessages: number;
}

export function SafetyWorkspace({ user: initialUser, onLogout: initialOnLogout }: SafetyWorkspaceProps) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<PortalUser | null>(initialUser || null);

  // Sidebar navigation menu: "permits" | "matrix-training" | "safety-messages"
  const [activeMenu, setActiveMenu] = useState<"permits" | "matrix-training" | "safety-messages">("permits");

  // Sub-tabs for Pengurusan Permit KPC
  const [activePermitTab, setActivePermitTab] = useState<"form" | "history">("form");

  // Data states
  const [stats, setStats] = useState<SafetyStats>({
    totalPermits: 0,
    activePermits: 0,
    totalTrainingRecords: 0,
    totalSafetyMessages: 0
  });
  const [permitsList, setPermitsList] = useState<SafetyPermitItem[]>([]);
  const [courses, setCourses] = useState<TrainingCourseItem[]>([]);
  const [employees, setEmployees] = useState<MatrixEmployeeItem[]>([]);
  const [messagesList, setMessagesList] = useState<SafetyMessageItem[]>([]);
  const [searchEmployee, setSearchEmployee] = useState("");
  const [permitFilterType, setPermitFilterType] = useState("Semua");
  const [permitFilterStatus, setPermitFilterStatus] = useState("Semua");
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Modals
  const [showTrainingModal, setShowTrainingModal] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  const [selectedMessageForSign, setSelectedMessageForSign] = useState<SafetyMessageItem | null>(null);

  // Forms
  const [permitForm, setPermitForm] = useState({
    permitNumber: `PRM-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
    permitType: "Digging Permit",
    title: "",
    location: "",
    gpsCoordinates: "",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
    status: "Draft",
    picName: "",
    picPhone: "",
    scannedDocUrl: "",
    description: ""
  });

  const [trainingForm, setTrainingForm] = useState({
    badgeNumber: "",
    employeeName: "",
    positionTitle: "",
    department: "Ops",
    courseCode: "",
    status: "c",
    trainingDate: new Date().toISOString().slice(0, 10),
    notes: ""
  });

  const [signatureName, setSignatureName] = useState("");
  const [signatureBadge, setSignatureBadge] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  // Toast notification
  const showToast = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Load stats and data
  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, permitsRes, matrixRes, messagesRes] = await Promise.all([
        api<{ success: boolean; data: SafetyStats }>("/safety/stats").catch(() => ({ data: null })),
        api<{ success: boolean; data: SafetyPermitItem[] }>("/safety/permits").catch(() => ({ data: [] })),
        api<{ success: boolean; courses: TrainingCourseItem[]; employees: MatrixEmployeeItem[] }>("/safety/trainings/matrix").catch(() => ({ courses: [], employees: [] })),
        api<{ success: boolean; data: SafetyMessageItem[] }>("/safety/messages").catch(() => ({ data: [] }))
      ]);

      if (statsRes?.data) setStats(statsRes.data);
      if (permitsRes?.data) setPermitsList(permitsRes.data);
      if (matrixRes?.courses) setCourses(matrixRes.courses);
      if (matrixRes?.employees) setEmployees(matrixRes.employees);
      if (messagesRes?.data) setMessagesList(messagesRes.data);
    } catch (err: any) {
      console.error("Gagal memuat data Safety:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser) {
      api<{ user: PortalUser }>("/auth/me")
        .then((res) => {
          setCurrentUser(res.user);
          setPermitForm((prev) => ({ ...prev, picName: res.user.name }));
          setSignatureName(res.user.name);
          setSignatureBadge(res.user.kpcId || "");
        })
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

  // -------------------------------------------------------------
  // PERMIT HANDLERS
  // -------------------------------------------------------------
  const handleSavePermit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api("/safety/permits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(permitForm)
      });
      showToast("success", "Form Pengurusan Permit KPC berhasil disimpan");
      setPermitForm({
        permitNumber: `PRM-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
        permitType: "Digging Permit",
        title: "",
        location: "",
        gpsCoordinates: "",
        startDate: new Date().toISOString().slice(0, 10),
        endDate: "",
        status: "Draft",
        picName: currentUser?.name || "",
        picPhone: "",
        scannedDocUrl: "",
        description: ""
      });
      setActivePermitTab("history");
      loadData();
    } catch (err: any) {
      showToast("error", err?.message || "Gagal menyimpan permit");
    }
  };

  const handleDeletePermit = async (id: number) => {
    if (!confirm("Apakah Anda yakin ingin menghapus data permit ini?")) return;
    try {
      await api(`/safety/permits/${id}`, { method: "DELETE" });
      showToast("success", "Permit berhasil dihapus");
      loadData();
    } catch (err: any) {
      showToast("error", err?.message || "Gagal menghapus permit");
    }
  };

  // -------------------------------------------------------------
  // MATRIX TRAINING HANDLERS
  // -------------------------------------------------------------
  const handleSaveTrainingRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api("/safety/trainings/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(trainingForm)
      });
      showToast("success", "Catatan training teknisi berhasil diperbarui");
      setShowTrainingModal(false);
      loadData();
    } catch (err: any) {
      showToast("error", err?.message || "Gagal memperbarui catatan training");
    }
  };

  const handleReseedCsv = async () => {
    if (!confirm("Muat ulang & sinkronisasi data dari berkas CSV Matrix Training 2026?")) return;
    try {
      const res = await api<{ success: boolean; message: string }>("/safety/trainings/seed-from-template", {
        method: "POST"
      });
      showToast("success", res.message || "Sinkronisasi selesai");
      loadData();
    } catch (err: any) {
      showToast("error", err?.message || "Gagal sinkronisasi data CSV");
    }
  };

  // -------------------------------------------------------------
  // PESAN KESELAMATAN & SIGNATURE CANVAS HANDLERS
  // -------------------------------------------------------------
  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#0f172a";
    setHasSignature(false);
  };

  useEffect(() => {
    if (showSignModal) {
      setTimeout(initCanvas, 100);
    }
  }, [showSignModal]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setIsDrawing(true);
    setHasSignature(true);
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleSaveSignature = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMessageForSign) return;
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) {
      showToast("error", "Silakan bubuhkan tanda tangan pada kotak canvas terlebih dahulu.");
      return;
    }

    const dataUrl = canvas.toDataURL("image/png");
    try {
      await api(`/safety/messages/${selectedMessageForSign.id}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendeeName: signatureName,
          attendeeBadge: signatureBadge,
          signatureData: dataUrl
        })
      });
      showToast("success", "Tanda tangan kehadiran Safety Talk berhasil disimpan");
      setShowSignModal(false);
      clearCanvas();
      loadData();
    } catch (err: any) {
      showToast("error", err?.message || "Gagal menyimpan tanda tangan");
    }
  };

  // Filtered lists
  const filteredPermits = permitsList.filter((p) => {
    const matchType = permitFilterType === "Semua" || p.permitType === permitFilterType;
    const matchStatus = permitFilterStatus === "Semua" || p.status === permitFilterStatus;
    return matchType && matchStatus;
  });

  const filteredEmployees = employees.filter((emp) => {
    const q = searchEmployee.toLowerCase();
    return (
      emp.employeeName.toLowerCase().includes(q) ||
      emp.badgeNumber.toLowerCase().includes(q) ||
      (emp.positionTitle || "").toLowerCase().includes(q)
    );
  });

  // Sidebar navigation configuration
  const sidebarGroups = [
    {
      group: "Keselamatan Kerja (K3 / Safety)",
      items: [
        {
          id: "permits",
          title: "Pengurusan Permit KPC",
          badge: "Permit",
          description: "Digging, Vicinity, Bekerja di Atap",
          isActive: activeMenu === "permits",
          onClick: () => setActiveMenu("permits")
        },
        {
          id: "matrix-training",
          title: "Matrix Training",
          badge: "Matrix",
          description: "Data Kualifikasi & Sertifikasi Teknisi",
          isActive: activeMenu === "matrix-training",
          onClick: () => setActiveMenu("matrix-training")
        },
        {
          id: "safety-messages",
          title: "Pesan Keselamatan KPC",
          badge: "Pesan K3",
          description: "Materi Bulanan & Tanda Tangan Kehadiran",
          isActive: activeMenu === "safety-messages",
          onClick: () => setActiveMenu("safety-messages")
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
      portalTitle="Safety"
      portalSubtitle="Pengurusan Permit KPC, Matrix Training, dan Pesan Keselamatan Kerja"
      portalIcon="👷"
      portalColor="amber"
      sidebarGroups={sidebarGroups}
      breadcrumbs={[
        { label: "Portal", href: "/portal" },
        { label: "Safety", href: "/portal/safety" },
        {
          label:
            activeMenu === "permits"
              ? "Pengurusan Permit KPC"
              : activeMenu === "matrix-training"
              ? "Matrix Training"
              : "Pesan Keselamatan KPC"
        }
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
            <span className={styles.statTitle}>Total Pengurusan Permit</span>
            <span className={styles.statValue}>{stats.totalPermits}</span>
            <span className={styles.statSub}>Digging, Vicinity & Atap</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statTitle}>Permit Disetujui (Aktif)</span>
            <span className={styles.statValue} style={{ color: "#059669" }}>
              {stats.activePermits}
            </span>
            <span className={styles.statSub}>Izin kerja sedang berjalan</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statTitle}>Tenaga Kerja / Teknisi</span>
            <span className={styles.statValue}>{employees.length}</span>
            <span className={styles.statSub}>Tercatat di Matrix Training</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statTitle}>Pesan Keselamatan</span>
            <span className={styles.statValue}>{stats.totalSafetyMessages}</span>
            <span className={styles.statSub}>Materi Safety Talk bulanan</span>
          </div>
        </div>

        {/* ======================================================== */}
        {/* MENU 1: PENGURUSAN PERMIT KPC                            */}
        {/* ======================================================== */}
        {activeMenu === "permits" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Tab Navigasi Atas */}
            <div className={styles.tabBar}>
              <button
                type="button"
                className={`${styles.tabButton} ${activePermitTab === "form" ? styles.tabActive : ""}`}
                onClick={() => setActivePermitTab("form")}
              >
                📝 Tab 1: Form Pengurusan Permit Baru
              </button>
              <button
                type="button"
                className={`${styles.tabButton} ${activePermitTab === "history" ? styles.tabActive : ""}`}
                onClick={() => setActivePermitTab("history")}
              >
                📋 Tab 2: Riwayat Permit History & Report ({permitsList.length})
              </button>
            </div>

            {/* TAB 1: FORM PENGURUSAN PERMIT BARU */}
            {activePermitTab === "form" && (
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <h2 className={styles.cardTitle}>Formulir Pengajuan Izin Kerja KPC (Permit to Work)</h2>
                    <p className={styles.cardSubtitle}>
                      Pilih jenis izin kerja, masukkan lokasi/titik koordinat GPS, dan dokumentasi yang akan di-progress.
                    </p>
                  </div>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => setActivePermitTab("history")}
                  >
                    Lihat Riwayat Permit ➔
                  </button>
                </div>

                <form onSubmit={handleSavePermit}>
                  <div className={styles.formGrid}>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Jenis Izin Kerja (Permit Type) *</label>
                      <select
                        className={styles.select}
                        value={permitForm.permitType}
                        onChange={(e) => setPermitForm({ ...permitForm, permitType: e.target.value })}
                      >
                        <option value="Digging Permit">Digging Permit (Pekerjaan Penggalian Tanah)</option>
                        <option value="Vicinity Permit">Vicinity Permit (Pekerjaan di Dekat Fasilitas Listrik / Bahaya)</option>
                        <option value="Bekerja di Atap">Bekerja di Atap (Working on Roofs)</option>
                        <option value="Confined Space">Confined Space (Ruang Terbatas)</option>
                        <option value="Hot Work Permit">Hot Work Permit (Pengelasan & Api)</option>
                      </select>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.label}>Nomor Permit (Auto / Manual) *</label>
                      <input
                        type="text"
                        className={styles.input}
                        required
                        value={permitForm.permitNumber}
                        onChange={(e) => setPermitForm({ ...permitForm, permitNumber: e.target.value })}
                      />
                    </div>

                    <div className={styles.formGroup} style={{ gridColumn: "span 2" }}>
                      <label className={styles.label}>Judul Pekerjaan / Proyek *</label>
                      <input
                        type="text"
                        className={styles.input}
                        required
                        placeholder="Contoh: Digging Install Tower Harapan atau Install Tiang & FO Murung"
                        value={permitForm.title}
                        onChange={(e) => setPermitForm({ ...permitForm, title: e.target.value })}
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.label}>Lokasi Pekerjaan di KPC *</label>
                      <input
                        type="text"
                        className={styles.input}
                        required
                        placeholder="Contoh: Pit Surya, Jalur Simulator Murung to Coal Mining"
                        value={permitForm.location}
                        onChange={(e) => setPermitForm({ ...permitForm, location: e.target.value })}
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.label}>Titik Koordinat GPS (Latitude, Longitude)</label>
                      <input
                        type="text"
                        className={styles.input}
                        placeholder="Contoh: -0.452100, 117.382100"
                        value={permitForm.gpsCoordinates}
                        onChange={(e) => setPermitForm({ ...permitForm, gpsCoordinates: e.target.value })}
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.label}>Tanggal Mulai Pelaksanaan</label>
                      <input
                        type="date"
                        className={styles.input}
                        value={permitForm.startDate}
                        onChange={(e) => setPermitForm({ ...permitForm, startDate: e.target.value })}
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.label}>Tanggal Selesai (Target)</label>
                      <input
                        type="date"
                        className={styles.input}
                        value={permitForm.endDate}
                        onChange={(e) => setPermitForm({ ...permitForm, endDate: e.target.value })}
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.label}>Penanggung Jawab Lapangan (PIC)</label>
                      <input
                        type="text"
                        className={styles.input}
                        placeholder="Nama Pengawas / PIC Pekerjaan"
                        value={permitForm.picName}
                        onChange={(e) => setPermitForm({ ...permitForm, picName: e.target.value })}
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.label}>Kontak No. HP / Radio PIC</label>
                      <input
                        type="text"
                        className={styles.input}
                        placeholder="081234567890 / Ch. 12"
                        value={permitForm.picPhone}
                        onChange={(e) => setPermitForm({ ...permitForm, picPhone: e.target.value })}
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.label}>Status Pengurusan</label>
                      <select
                        className={styles.select}
                        value={permitForm.status}
                        onChange={(e) => setPermitForm({ ...permitForm, status: e.target.value })}
                      >
                        <option value="Draft">Draft (Dalam Persiapan)</option>
                        <option value="Diajukan">Diajukan ke KPC</option>
                        <option value="Disetujui">Disetujui (Approved)</option>
                        <option value="Selesai">Pekerjaan Selesai (Closed)</option>
                      </select>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.label}>Link Dokumen Pendukung / File Scan</label>
                      <input
                        type="text"
                        className={styles.input}
                        placeholder="URL atau nama berkas scan yang di-print"
                        value={permitForm.scannedDocUrl}
                        onChange={(e) => setPermitForm({ ...permitForm, scannedDocUrl: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className={styles.formGroup} style={{ marginBottom: "1.5rem" }}>
                    <label className={styles.label}>Uraian Rencana Kerja & Tindakan Pencegahan Bahaya (JSA)</label>
                    <textarea
                      className={styles.textarea}
                      placeholder="Jelaskan tahapan kerja, alat berat/manual yang digunakan, dan koordinasi dengan pengawas area..."
                      value={permitForm.description}
                      onChange={(e) => setPermitForm({ ...permitForm, description: e.target.value })}
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      onClick={() => window.print()}
                    >
                      🖨️ Cetak Draft Form
                    </button>
                    <button type="submit" className={styles.btnPrimary}>
                      Simpan Pengajuan Permit
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* TAB 2: RIWAYAT PERMIT HISTORY & REPORT */}
            {activePermitTab === "history" && (
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <h2 className={styles.cardTitle}>Daftar Riwayat Permit KPC & Laporan</h2>
                    <p className={styles.cardSubtitle}>
                      Semua dokumen perizinan kerja yang pernah diajukan beserta status persetujuannya.
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <select
                      className={styles.select}
                      style={{ width: "auto" }}
                      value={permitFilterType}
                      onChange={(e) => setPermitFilterType(e.target.value)}
                    >
                      <option value="Semua">Semua Jenis Permit</option>
                      <option value="Digging Permit">Digging Permit</option>
                      <option value="Vicinity Permit">Vicinity Permit</option>
                      <option value="Bekerja di Atap">Bekerja di Atap</option>
                    </select>

                    <select
                      className={styles.select}
                      style={{ width: "auto" }}
                      value={permitFilterStatus}
                      onChange={(e) => setPermitFilterStatus(e.target.value)}
                    >
                      <option value="Semua">Semua Status</option>
                      <option value="Draft">Draft</option>
                      <option value="Diajukan">Diajukan</option>
                      <option value="Disetujui">Disetujui</option>
                      <option value="Selesai">Selesai</option>
                    </select>

                    <button
                      type="button"
                      className={styles.btnPrimary}
                      onClick={() => setActivePermitTab("form")}
                    >
                      + Buat Permit Baru
                    </button>
                  </div>
                </div>

                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>No.</th>
                        <th>Nomor Permit</th>
                        <th>Jenis Permit</th>
                        <th>Judul Pekerjaan</th>
                        <th>Lokasi & GPS</th>
                        <th>Masa Berlaku</th>
                        <th>PIC</th>
                        <th>Status</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPermits.length === 0 ? (
                        <tr>
                          <td colSpan={9} style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
                            Tidak ada data permit yang cocok dengan filter.
                          </td>
                        </tr>
                      ) : (
                        filteredPermits.map((item, index) => {
                          let badgeStyle = styles.badgeYellow;
                          if (item.status === "Disetujui") badgeStyle = styles.badgeGreen;
                          if (item.status === "Selesai") badgeStyle = styles.badgeBlue;

                          return (
                            <tr key={item.id}>
                              <td>{index + 1}</td>
                              <td><code>{item.permitNumber}</code></td>
                              <td>
                                <span className={`${styles.badge} ${styles.badgeOrange}`}>
                                  {item.permitType}
                                </span>
                              </td>
                              <td><strong>{item.title}</strong></td>
                              <td>
                                <div>{item.location}</div>
                                {item.gpsCoordinates && (
                                  <a
                                    href={`https://www.google.com/maps?q=${encodeURIComponent(item.gpsCoordinates)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ fontSize: "0.75rem", color: "#0284c7", textDecoration: "none" }}
                                  >
                                    📍 {item.gpsCoordinates} ↗
                                  </a>
                                )}
                              </td>
                              <td>
                                {item.startDate ? new Date(item.startDate).toLocaleDateString("id-ID") : "-"}
                                {item.endDate ? ` s/d ${new Date(item.endDate).toLocaleDateString("id-ID")}` : ""}
                              </td>
                              <td>
                                <div>{item.picName || "-"}</div>
                                <small style={{ color: "#64748b" }}>{item.picPhone || ""}</small>
                              </td>
                              <td>
                                <span className={`${styles.badge} ${badgeStyle}`}>
                                  {item.status}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: "flex", gap: "0.4rem" }}>
                                  <button
                                    type="button"
                                    className={styles.btnEdit}
                                    onClick={() => {
                                      alert(
                                        `Detail Permit:\nNomor: ${item.permitNumber}\nJenis: ${item.permitType}\nJudul: ${item.title}\nLokasi: ${item.location}\nDeskripsi: ${item.description || "-"}`
                                      );
                                    }}
                                  >
                                    Detail
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.btnDanger}
                                    onClick={() => handleDeletePermit(item.id)}
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
          </div>
        )}

        {/* ======================================================== */}
        {/* MENU 2: MATRIX TRAINING                                  */}
        {/* ======================================================== */}
        {activeMenu === "matrix-training" && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>Matrix Training Karyawan & Teknisi (Acuan Juli 2026)</h2>
                <p className={styles.cardSubtitle}>
                  Pemantauan kelulusan kursus keselamatan kerja (HSE Induction, JSA, First Aid, Working at Heights, POP, dll).
                </p>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <input
                  type="text"
                  className={styles.input}
                  style={{ width: "240px" }}
                  placeholder="Cari Nama / Badge No..."
                  value={searchEmployee}
                  onChange={(e) => setSearchEmployee(e.target.value)}
                />
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={handleReseedCsv}
                >
                  🔄 Sinkron Ulang dari CSV
                </button>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={() => {
                    if (employees.length > 0 && courses.length > 0) {
                      setTrainingForm({
                        badgeNumber: employees[0].badgeNumber,
                        employeeName: employees[0].employeeName,
                        positionTitle: employees[0].positionTitle || "",
                        department: employees[0].department || "Ops",
                        courseCode: courses[0].courseCode,
                        status: "c",
                        trainingDate: new Date().toISOString().slice(0, 10),
                        notes: ""
                      });
                    }
                    setShowTrainingModal(true);
                  }}
                >
                  + Update Training Teknisi
                </button>
              </div>
            </div>

            <div style={{ marginBottom: "0.75rem", display: "flex", gap: "1rem", fontSize: "0.85rem" }}>
              <div>
                <span className={styles.matrixCellC} style={{ marginRight: "0.35rem" }}>c</span> = Selesai / Completed
              </div>
              <div>
                <span className={styles.matrixCellR} style={{ marginRight: "0.35rem" }}>R</span> = Wajib Mengikuti / Required
              </div>
            </div>

            <div className={styles.matrixWrapper}>
              <table className={styles.matrixTable}>
                <thead>
                  <tr>
                    <th className={styles.stickyColNo}>No.</th>
                    <th className={styles.stickyColBadge}>Badge (B/N)</th>
                    <th className={styles.stickyColName}>Nama Karyawan</th>
                    <th style={{ color: "#0f172a" }}>Jabatan</th>
                    <th style={{ color: "#0f172a" }}>Dept</th>
                    {courses.map((course) => (
                      <th key={course.id} title={`${course.courseCode} - ${course.courseTitle}`}>
                        <div style={{ fontWeight: 700, color: "#ea580c" }}>{course.courseCode}</div>
                        <div style={{ fontSize: "0.7rem", fontWeight: 500, maxWidth: "110px", textOverflow: "ellipsis", overflow: "hidden", color: "#334155" }}>
                          {course.courseTitle}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={5 + courses.length} style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
                        Tidak ada data karyawan di Matrix Training.
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map((emp, idx) => (
                      <tr key={emp.badgeNumber}>
                        <td className={styles.stickyColNo}>{idx + 1}</td>
                        <td className={styles.stickyColBadge}>
                          <code>{emp.badgeNumber}</code>
                        </td>
                        <td className={styles.stickyColName}>
                          <span className={styles.matrixEmployeeName}>{emp.employeeName}</span>
                        </td>
                        <td style={{ color: "#0f172a" }}>{emp.positionTitle || "-"}</td>
                        <td style={{ color: "#0f172a" }}>{emp.department || "Ops"}</td>
                        {courses.map((c) => {
                          const record = emp.trainings[c.courseCode];
                          if (!record) {
                            return (
                              <td key={c.courseCode}>
                                <span className={styles.matrixCellEmpty}>-</span>
                              </td>
                            );
                          }

                          return (
                            <td
                              key={c.courseCode}
                              style={{ cursor: "pointer" }}
                              title={`Tanggal: ${record.trainingDate || "Tidak tercatat"}\nKlik untuk ubah`}
                              onClick={() => {
                                setTrainingForm({
                                  badgeNumber: emp.badgeNumber,
                                  employeeName: emp.employeeName,
                                  positionTitle: emp.positionTitle || "",
                                  department: emp.department || "Ops",
                                  courseCode: c.courseCode,
                                  status: record.status,
                                  trainingDate: record.trainingDate || new Date().toISOString().slice(0, 10),
                                  notes: record.notes || ""
                                });
                                setShowTrainingModal(true);
                              }}
                            >
                              {record.status === "c" ? (
                                <span className={styles.matrixCellC}>c</span>
                              ) : (
                                <span className={styles.matrixCellR}>R</span>
                              )}
                              {record.trainingDate && (
                                <div style={{ fontSize: "0.65rem", color: "#64748b" }}>
                                  {record.trainingDate.slice(2, 7)}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MENU 3: PESAN KESELAMATAN KPC                            */}
        {/* ======================================================== */}
        {activeMenu === "safety-messages" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2 className={styles.cardTitle}>Pesan Keselamatan KPC Bulanan (Safety Talk)</h2>
                  <p className={styles.cardSubtitle}>
                    Materi sosialisasi keselamatan kerja bulanan dan pengisian daftar hadir bertanda tangan digital.
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {messagesList.length === 0 ? (
                  <p style={{ color: "#64748b", textAlign: "center", padding: "2rem" }}>
                    Belum ada materi pesan keselamatan bulanan.
                  </p>
                ) : (
                  messagesList.map((msg) => (
                    <div
                      key={msg.id}
                      style={{
                        border: "1px solid #e2e8f0",
                        borderRadius: "10px",
                        padding: "1.25rem",
                        background: "#fafafa"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
                        <div>
                          <span className={`${styles.badge} ${styles.badgeOrange}`} style={{ marginBottom: "0.4rem" }}>
                            Periode: {msg.monthYear}
                          </span>
                          <h3 style={{ margin: "0.25rem 0", color: "#0f172a", fontSize: "1.1rem" }}>
                            {msg.title}
                          </h3>
                        </div>
                        <button
                          type="button"
                          className={styles.btnPrimary}
                          onClick={() => {
                            setSelectedMessageForSign(msg);
                            setShowSignModal(true);
                          }}
                        >
                          ✍️ Tanda Tangan Kehadiran
                        </button>
                      </div>

                      <div
                        style={{
                          whiteSpace: "pre-wrap",
                          fontSize: "0.9rem",
                          color: "#334155",
                          lineHeight: "1.6",
                          background: "#ffffff",
                          padding: "1rem",
                          borderRadius: "8px",
                          border: "1px solid #e2e8f0",
                          marginBottom: "1rem"
                        }}
                      >
                        {msg.content}
                      </div>

                      {/* Info TTD Terakhir jika ada */}
                      {msg.signatureData && (
                        <div
                          style={{
                            background: "#ecfdf5",
                            border: "1px solid #a7f3d0",
                            borderRadius: "8px",
                            padding: "0.85rem 1.25rem",
                            display: "flex",
                            alignItems: "center",
                            gap: "1.5rem",
                            flexWrap: "wrap"
                          }}
                        >
                          <div>
                            <div style={{ fontSize: "0.8rem", color: "#047857", fontWeight: 600 }}>TANDA TANGAN TERAKHIR</div>
                            <div style={{ fontWeight: 700, color: "#065f46" }}>
                              {msg.attendeeName} ({msg.attendeeBadge || "Teknisi"})
                            </div>
                            <small style={{ color: "#047857" }}>
                              Ditandatangani: {msg.signedAt ? new Date(msg.signedAt).toLocaleString("id-ID") : "-"}
                            </small>
                          </div>
                          <div style={{ background: "#ffffff", padding: "0.25rem 0.5rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={msg.signatureData}
                              alt="Tanda Tangan"
                              style={{ height: "45px", display: "block" }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MODAL: UPDATE TRAINING RECORD                            */}
        {/* ======================================================== */}
        {showTrainingModal && (
          <div className={styles.modalBackdrop}>
            <div className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Update Catatan Training Karyawan</h3>
                <button
                  type="button"
                  className={styles.modalClose}
                  onClick={() => setShowTrainingModal(false)}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveTrainingRecord}>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Badge No (B/N) *</label>
                    <input
                      type="text"
                      className={styles.input}
                      required
                      value={trainingForm.badgeNumber}
                      onChange={(e) => setTrainingForm({ ...trainingForm, badgeNumber: e.target.value })}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Nama Karyawan *</label>
                    <input
                      type="text"
                      className={styles.input}
                      required
                      value={trainingForm.employeeName}
                      onChange={(e) => setTrainingForm({ ...trainingForm, employeeName: e.target.value })}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Kursus Pelatihan *</label>
                    <select
                      className={styles.select}
                      value={trainingForm.courseCode}
                      onChange={(e) => setTrainingForm({ ...trainingForm, courseCode: e.target.value })}
                    >
                      {courses.map((c) => (
                        <option key={c.courseCode} value={c.courseCode}>
                          {c.courseCode} - {c.courseTitle}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Status Kelulusan *</label>
                    <select
                      className={styles.select}
                      value={trainingForm.status}
                      onChange={(e) => setTrainingForm({ ...trainingForm, status: e.target.value })}
                    >
                      <option value="c">c (Selesai / Lulus)</option>
                      <option value="R">R (Wajib Mengikuti / Required)</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Tanggal Training Dilaksanakan</label>
                    <input
                      type="date"
                      className={styles.input}
                      value={trainingForm.trainingDate}
                      onChange={(e) => setTrainingForm({ ...trainingForm, trainingDate: e.target.value })}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Departemen</label>
                    <input
                      type="text"
                      className={styles.input}
                      value={trainingForm.department}
                      onChange={(e) => setTrainingForm({ ...trainingForm, department: e.target.value })}
                    />
                  </div>
                </div>

                <div className={styles.formGroup} style={{ marginBottom: "1rem" }}>
                  <label className={styles.label}>Catatan Sertifikat / Keterangan</label>
                  <textarea
                    className={styles.textarea}
                    placeholder="Nomor sertifikat atau tanggal expired masa berlaku..."
                    value={trainingForm.notes}
                    onChange={(e) => setTrainingForm({ ...trainingForm, notes: e.target.value })}
                  />
                </div>

                <div className={styles.modalFooter}>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => setShowTrainingModal(false)}
                  >
                    Batal
                  </button>
                  <button type="submit" className={styles.btnPrimary}>
                    Simpan Catatan
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MODAL: TANDA TANGAN PESAN KESELAMATAN                     */}
        {/* ======================================================== */}
        {showSignModal && (
          <div className={styles.modalBackdrop}>
            <div className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Tanda Tangan Kehadiran Safety Talk</h3>
                <button
                  type="button"
                  className={styles.modalClose}
                  onClick={() => setShowSignModal(false)}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveSignature}>
                <div style={{ marginBottom: "1rem", color: "#64748b", fontSize: "0.85rem" }}>
                  Materi: <strong>{selectedMessageForSign?.title}</strong> ({selectedMessageForSign?.monthYear})
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Nama Lengkap *</label>
                    <input
                      type="text"
                      className={styles.input}
                      required
                      value={signatureName}
                      onChange={(e) => setSignatureName(e.target.value)}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Nomor Badge (B/N)</label>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="Contoh: Z110997"
                      value={signatureBadge}
                      onChange={(e) => setSignatureBadge(e.target.value)}
                    />
                  </div>
                </div>

                <div className={styles.formGroup} style={{ marginBottom: "1rem" }}>
                  <label className={styles.label}>Bubuhkan Tanda Tangan Digital di Bawah ini *</label>
                  <div className={styles.signatureContainer}>
                    <canvas
                      ref={canvasRef}
                      className={styles.signatureCanvas}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                    />
                    <div className={styles.signatureControls}>
                      <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                        Goreskan tanda tangan dengan jari / mouse
                      </span>
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}
                        onClick={clearCanvas}
                      >
                        Bersihkan Kanvas
                      </button>
                    </div>
                  </div>
                </div>

                <div className={styles.modalFooter}>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => setShowSignModal(false)}
                  >
                    Batal
                  </button>
                  <button type="submit" className={styles.btnPrimary}>
                    Konfirmasi Tanda Tangan
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
