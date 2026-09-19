"use client";

import { useEffect, useState, useMemo } from "react";
import { API_URL, api, type PortalUser } from "@/lib/api";
import styles from "./kpi-bao-workspace.module.css";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface KpiCompany {
  id: number;
  name: string;
  type: string;
  clientCompanyName?: string | null;
  clientAddress?: string | null;
  contractTitle?: string | null;
  serviceDescription?: string | null;
  mknSignerName?: string | null;
  mknSignerRole?: string | null;
  clientSignerName?: string | null;
  clientSignerRole?: string | null;
  clientSignerLocation?: string | null;
  isActive: boolean;
  sortOrder: number;
  deviceCount: number;
  devices: KpiDevice[];
}

export interface KpiDevice {
  id: number;
  companyId: number;
  deviceName: string;
  location?: string | null;
  orderIndex: number;
}

export interface KpiHoliday {
  id: number;
  holidayDate: string;
  description: string;
}

export interface KpiProblem {
  id: number;
  reportId: number;
  deviceId: number;
  problemDate: string;
  downtimeHours: number;
  downtimeMinutes: number;
  downtimeSeconds: number;
  totalSeconds: number;
  description?: string | null;
  deviceName: string;
  location?: string | null;
}

export interface DeviceStat {
  device: KpiDevice;
  totalDowntimeSeconds: number;
  downtimeHours: number;
  downtimeMinutes: number;
  downtimeSeconds: number;
  availabilityPercent: number;
  problems: KpiProblem[];
}

export interface MonthlyReportData {
  company: KpiCompany;
  year: number;
  month: number;
  monthName: string;
  daysInMonth: number;
  firstWorkingDay: {
    dayNumber: number;
    dayName: string;
    dayWord: string;
    monthName: string;
    monthWord: string;
    yearWord: string;
    dateStr: string;
    isoDate: string;
  };
  overallAvailability: string;
  deviceStats: DeviceStat[];
  problems: KpiProblem[];
}

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

// ─── Main Component ──────────────────────────────────────────────────────────

export function KpiBaoWorkspace({ user }: { user: PortalUser }) {
  // Tab State
  const [activeTab, setActiveTab] = useState<"report" | "companies" | "holidays">("report");

  // Selection Filters
  const [companies, setCompanies] = useState<KpiCompany[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);

  // Data States
  const [reportData, setReportData] = useState<MonthlyReportData | null>(null);
  const [holidays, setHolidays] = useState<KpiHoliday[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState<boolean>(true);
  const [loadingReport, setLoadingReport] = useState<boolean>(false);
  const [downloadingExcel, setDownloadingExcel] = useState<boolean>(false);
  const [downloadingWord, setDownloadingWord] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modals
  const [showProblemModal, setShowProblemModal] = useState<boolean>(false);
  const [problemForm, setProblemForm] = useState({
    deviceId: 0,
    problemDate: new Date().toISOString().split("T")[0],
    downtimeHours: 0,
    downtimeMinutes: 0,
    downtimeSeconds: 0,
    description: ""
  });
  const [savingProblem, setSavingProblem] = useState<boolean>(false);

  // Company Modal
  const [showCompanyModal, setShowCompanyModal] = useState<boolean>(false);
  const [editingCompanyId, setEditingCompanyId] = useState<number | null>(null);
  const [companyForm, setCompanyForm] = useState({
    name: "",
    type: "kpc",
    clientCompanyName: "",
    clientAddress: "",
    contractTitle: "",
    serviceDescription: "",
    mknSignerName: "Joko Triono",
    mknSignerRole: "PJO",
    clientSignerName: "",
    clientSignerRole: "",
    clientSignerLocation: "Sangatta",
    isActive: true
  });
  const [savingCompany, setSavingCompany] = useState<boolean>(false);

  // Device Modal
  const [showDeviceModal, setShowDeviceModal] = useState<boolean>(false);
  const [deviceTargetCompanyId, setDeviceTargetCompanyId] = useState<number | null>(null);
  const [deviceForm, setDeviceForm] = useState({ deviceName: "", location: "" });
  const [savingDevice, setSavingDevice] = useState<boolean>(false);

  // Holiday Modal
  const [showHolidayModal, setShowHolidayModal] = useState<boolean>(false);
  const [holidayForm, setHolidayForm] = useState({
    holidayDate: new Date().toISOString().split("T")[0],
    description: ""
  });
  const [savingHoliday, setSavingHoliday] = useState<boolean>(false);

  // RFO Integration
  const [problemRfos, setProblemRfos] = useState<Record<number, { id: number; ticketNumber: string }>>({});
  const [showRfoModal, setShowRfoModal] = useState<boolean>(false);
  const [rfoForm, setRfoForm] = useState({
    ticketNumber: "",
    problemId: null as number | null,
    companyId: null as number | null,
    deviceId: null as number | null,
    rfoDate: "",
    startTime: "",
    endTime: "",
    cause: "",
    impact: "",
    solution: "",
    status: "",
    notes: ""
  });
  const [savingRfo, setSavingRfo] = useState<boolean>(false);

  // Load Companies & Holidays on mount
  useEffect(() => {
    loadCompanies();
    loadHolidays();
  }, []);

  // When company or month/year changes, load monthly report
  useEffect(() => {
    if (selectedCompanyId) {
      loadReport(selectedCompanyId, year, month);
    }
  }, [selectedCompanyId, year, month]);

  async function loadCompanies() {
    setLoadingCompanies(true);
    try {
      const res = await api<{ data: KpiCompany[] }>("/ops-telco/kpi/companies");
      setCompanies(res.data || []);
      if (res.data && res.data.length > 0 && !selectedCompanyId) {
        setSelectedCompanyId(res.data[0].id);
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Gagal memuat daftar perusahaan." });
    } finally {
      setLoadingCompanies(false);
    }
  }

  async function loadHolidays() {
    try {
      const res = await api<{ data: KpiHoliday[] }>(`/ops-telco/kpi/holidays?year=${year}`);
      setHolidays(res.data || []);
    } catch (err: any) {
      console.error("Gagal memuat tanggal merah:", err);
    }
  }

  async function loadReport(companyId: number, y: number, m: number) {
    setLoadingReport(true);
    setMessage(null);
    try {
      const [res, rfoRes] = await Promise.all([
        api<{ data: MonthlyReportData }>(`/ops-telco/kpi/report/${companyId}/${y}/${m}`),
        api<{ success: boolean; data: any[] }>(`/ops-telco/rfo?companyId=${companyId}`)
      ]);
      setReportData(res.data);
      if (rfoRes?.success && Array.isArray(rfoRes.data)) {
        const mapping: Record<number, { id: number; ticketNumber: string }> = {};
        for (const r of rfoRes.data) {
          if (r.problemId) {
            mapping[r.problemId] = { id: r.id, ticketNumber: r.ticketNumber };
          }
        }
        setProblemRfos(mapping);
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Gagal memuat laporan kpi." });
      setReportData(null);
    } finally {
      setLoadingReport(false);
    }
  }

  // ─── Download Handlers ───────────────────────────────────────────────────────

  async function handleDownload(type: "excel" | "word") {
    if (!selectedCompanyId || !reportData) return;
    const isExcel = type === "excel";
    if (isExcel) setDownloadingExcel(true);
    else setDownloadingWord(true);

    try {
      const endpoint = `/ops-telco/kpi/report/${selectedCompanyId}/${year}/${month}/download-${type}`;
      const base = API_URL ? (API_URL.endsWith("/") ? API_URL.slice(0, -1) : API_URL) : "";
      const res = await fetch(`${base}${endpoint}`, { credentials: "include" });

      if (!res.ok) throw new Error(`Gagal mendownload file ${type.toUpperCase()}`);

      const blob = await res.blob();
      const sanitizedName = reportData.company.name.replace(/[^a-zA-Z0-9_-]/g, "_");
      const filename = isExcel
        ? `KPI_Availability_${sanitizedName}_${month}_${year}.xlsx`
        : `BAO_${sanitizedName}_${month}_${year}.docx`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setMessage({ type: "success", text: `File ${filename} berhasil diunduh!` });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Gagal mengunduh dokumen." });
    } finally {
      if (isExcel) setDownloadingExcel(false);
      else setDownloadingWord(false);
    }
  }

  // ─── Problem Handlers ───────────────────────────────────────────────────────

  async function handleSaveProblem(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCompanyId) return;
    if (!problemForm.deviceId) {
      alert("Pilih perangkat / link terlebih dahulu.");
      return;
    }
    if (problemForm.downtimeHours === 0 && problemForm.downtimeMinutes === 0 && problemForm.downtimeSeconds === 0) {
      alert("Durasi downtime tidak boleh 0.");
      return;
    }

    setSavingProblem(true);
    try {
      await api(`/ops-telco/kpi/report/${selectedCompanyId}/${year}/${month}/problem`, {
        method: "POST",
        body: JSON.stringify(problemForm)
      });
      setShowProblemModal(false);
      setMessage({ type: "success", text: "Gangguan berhasil dicatat. Persentase KPI diperbarui otomatis." });
      await loadReport(selectedCompanyId, year, month);
    } catch (err: any) {
      alert(err.message || "Gagal menyimpan masalah.");
    } finally {
      setSavingProblem(false);
    }
  }

  async function handleDeleteProblem(problemId: number) {
    if (!confirm("Hapus catatan gangguan ini? Persentase KPI akan dikalkulasi ulang.")) return;
    if (!selectedCompanyId) return;

    try {
      await api(`/ops-telco/kpi/report/${selectedCompanyId}/${year}/${month}/problem/${problemId}`, {
        method: "DELETE"
      });
      setMessage({ type: "success", text: "Catatan gangguan berhasil dihapus." });
      await loadReport(selectedCompanyId, year, month);
    } catch (err: any) {
      alert(err.message || "Gagal menghapus masalah.");
    }
  }

  // ─── RFO Handlers ───────────────────────────────────────────────────────────

  async function openCreateRfoFromProblem(p: KpiProblem) {
    const d = new Date(p.problemDate);
    const dateFormatted = isNaN(d.getTime()) ? p.problemDate : `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
    const dateYmd = p.problemDate;

    let ticketNumber = "";
    try {
      const nextRes = await api<{ success: boolean; data: { ticketNumber: string } }>(
        `/ops-telco/rfo/next-ticket?date=${dateYmd}`
      );
      if (nextRes.success) ticketNumber = nextRes.data.ticketNumber;
    } catch {
      // ignore
    }

    setRfoForm({
      ticketNumber,
      problemId: p.id,
      companyId: selectedCompanyId,
      deviceId: p.deviceId,
      rfoDate: dateYmd,
      startTime: `${dateFormatted} 08:00 WITA`,
      endTime: `${dateFormatted} 12:00 WITA`,
      cause: p.description || "Gangguan link jaringan telekomunikasi",
      impact: `Layanan ${p.deviceName} Down`,
      solution: "Normalisasi dan reset perangkat jaringan",
      status: `Layanan ${p.deviceName} Kembali Normal`,
      notes: `Downtime tercatat: ${p.downtimeHours} jam ${p.downtimeMinutes} menit ${p.downtimeSeconds} detik`
    });
    setShowRfoModal(true);
  }

  async function handleSaveRfo(e: React.FormEvent) {
    e.preventDefault();
    setSavingRfo(true);
    try {
      await api("/ops-telco/rfo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rfoForm)
      });
      setMessage({ type: "success", text: `Laporan RFO ${rfoForm.ticketNumber} berhasil dibuat dan dihubungkan ke KPI.` });
      setShowRfoModal(false);
      if (selectedCompanyId) {
        loadReport(selectedCompanyId, year, month);
      }
    } catch (err: any) {
      alert(err.message || "Gagal membuat laporan RFO.");
    } finally {
      setSavingRfo(false);
    }
  }

  // ─── Company Handlers ───────────────────────────────────────────────────────

  function openCreateCompanyModal() {
    setEditingCompanyId(null);
    setCompanyForm({
      name: "",
      type: "kpc",
      clientCompanyName: "PT KALTIM PRIMA COAL",
      clientAddress: "PT Kaltim Prima Coal d/a ISD M3 Building mine Site Sangatta, Kalimantan Timur",
      contractTitle: "pengadaan link Radio Transmissions & Maintenance Support",
      serviceDescription: "Radio Transmission And Maintenance Support",
      mknSignerName: "Joko Triono",
      mknSignerRole: "PJO",
      clientSignerName: "Suluh Basuki",
      clientSignerRole: "ISD KPC",
      clientSignerLocation: "Sangatta",
      isActive: true
    });
    setShowCompanyModal(true);
  }

  function openEditCompanyModal(c: KpiCompany) {
    setEditingCompanyId(c.id);
    setCompanyForm({
      name: c.name,
      type: c.type || "kpc",
      clientCompanyName: c.clientCompanyName || "",
      clientAddress: c.clientAddress || "",
      contractTitle: c.contractTitle || "",
      serviceDescription: c.serviceDescription || "",
      mknSignerName: c.mknSignerName || (c.type === "kpc" ? "Joko Triono" : "Wanto"),
      mknSignerRole: c.mknSignerRole || (c.type === "kpc" ? "PJO" : "Project Manager"),
      clientSignerName: c.clientSignerName || "",
      clientSignerRole: c.clientSignerRole || "",
      clientSignerLocation: c.clientSignerLocation || "Site Sangatta",
      isActive: c.isActive
    });
    setShowCompanyModal(true);
  }

  async function handleSaveCompany(e: React.FormEvent) {
    e.preventDefault();
    if (!companyForm.name.trim()) {
      alert("Nama perusahaan wajib diisi.");
      return;
    }

    setSavingCompany(true);
    try {
      if (editingCompanyId) {
        await api(`/ops-telco/kpi/companies/${editingCompanyId}`, {
          method: "PUT",
          body: JSON.stringify(companyForm)
        });
        setMessage({ type: "success", text: "Data perusahaan berhasil diperbarui." });
      } else {
        const res = await api<{ data: KpiCompany }>("/ops-telco/kpi/companies", {
          method: "POST",
          body: JSON.stringify(companyForm)
        });
        setMessage({ type: "success", text: "Perusahaan baru berhasil ditambahkan." });
        if (res.data) setSelectedCompanyId(res.data.id);
      }
      setShowCompanyModal(false);
      await loadCompanies();
    } catch (err: any) {
      alert(err.message || "Gagal menyimpan perusahaan.");
    } finally {
      setSavingCompany(false);
    }
  }

  async function handleDeleteCompany(c: KpiCompany) {
    if (!confirm(`Hapus perusahaan "${c.name}" beserta seluruh daftar link dan laporannya? Tindakan ini tidak dapat dibatalkan.`)) return;

    try {
      await api(`/ops-telco/kpi/companies/${c.id}`, { method: "DELETE" });
      setMessage({ type: "success", text: `Perusahaan ${c.name} berhasil dihapus.` });
      if (selectedCompanyId === c.id) setSelectedCompanyId(null);
      await loadCompanies();
    } catch (err: any) {
      alert(err.message || "Gagal menghapus perusahaan.");
    }
  }

  // ─── Device Handlers ────────────────────────────────────────────────────────

  async function handleAddDevice(e: React.FormEvent) {
    e.preventDefault();
    if (!deviceTargetCompanyId) return;
    if (!deviceForm.deviceName.trim()) {
      alert("Nama link / perangkat wajib diisi.");
      return;
    }

    setSavingDevice(true);
    try {
      await api(`/ops-telco/kpi/companies/${deviceTargetCompanyId}/devices`, {
        method: "POST",
        body: JSON.stringify(deviceForm)
      });
      setShowDeviceModal(false);
      setDeviceForm({ deviceName: "", location: "" });
      setMessage({ type: "success", text: "Perangkat / Link berhasil ditambahkan." });
      await loadCompanies();
      if (selectedCompanyId === deviceTargetCompanyId) {
        await loadReport(deviceTargetCompanyId, year, month);
      }
    } catch (err: any) {
      alert(err.message || "Gagal menambahkan perangkat.");
    } finally {
      setSavingDevice(false);
    }
  }

  async function handleDeleteDevice(deviceId: number, companyId: number) {
    if (!confirm("Hapus link / perangkat ini dari daftar?")) return;

    try {
      await api(`/ops-telco/kpi/devices/${deviceId}`, { method: "DELETE" });
      setMessage({ type: "success", text: "Perangkat berhasil dihapus." });
      await loadCompanies();
      if (selectedCompanyId === companyId) {
        await loadReport(companyId, year, month);
      }
    } catch (err: any) {
      alert(err.message || "Gagal menghapus perangkat.");
    }
  }

  // ─── Holiday Handlers ───────────────────────────────────────────────────────

  async function handleAddHoliday(e: React.FormEvent) {
    e.preventDefault();
    if (!holidayForm.holidayDate || !holidayForm.description.trim()) {
      alert("Tanggal dan keterangan libur wajib diisi.");
      return;
    }

    setSavingHoliday(true);
    try {
      await api("/ops-telco/kpi/holidays", {
        method: "POST",
        body: JSON.stringify(holidayForm)
      });
      setShowHolidayModal(false);
      setHolidayForm({ holidayDate: "", description: "" });
      setMessage({ type: "success", text: "Tanggal merah berhasil ditambahkan." });
      await loadHolidays();
      if (selectedCompanyId) await loadReport(selectedCompanyId, year, month);
    } catch (err: any) {
      alert(err.message || "Gagal menambahkan tanggal merah.");
    } finally {
      setSavingHoliday(false);
    }
  }

  async function handleDeleteHoliday(id: number) {
    if (!confirm("Hapus tanggal merah ini?")) return;

    try {
      await api(`/ops-telco/kpi/holidays/${id}`, { method: "DELETE" });
      setMessage({ type: "success", text: "Tanggal merah berhasil dihapus." });
      await loadHolidays();
      if (selectedCompanyId) await loadReport(selectedCompanyId, year, month);
    } catch (err: any) {
      alert(err.message || "Gagal menghapus tanggal merah.");
    }
  }

  const selectedCompany = useMemo(() => {
    return companies.find((c) => c.id === selectedCompanyId);
  }, [companies, selectedCompanyId]);

  return (
    <div className={styles.container}>
      {/* ─── Header & Navigation Tabs ─── */}
      <div className={styles.headerArea}>
        <div className={styles.titleRow}>
          <div>
            <h1 className={styles.mainTitle}>
              <span>📊</span> KPI & BAO Sangatta Report
            </h1>
            <p className={styles.mainSubtitle}>
              Otomatisasi laporan ketersediaan jaringan (Availability 100%) dan Berita Acara Operasi Sangatta.
            </p>
          </div>

          <div className={styles.tabsNav}>
            <button
              className={`${styles.tabButton} ${activeTab === "report" ? styles.activeTab : ""}`}
              onClick={() => setActiveTab("report")}
            >
              <span>📄 Laporan Bulanan</span>
            </button>
            <button
              className={`${styles.tabButton} ${activeTab === "companies" ? styles.activeTab : ""}`}
              onClick={() => setActiveTab("companies")}
            >
              <span>🏢 Master Perusahaan</span>
              <span className={styles.tabBadge}>{companies.length}</span>
            </button>
            <button
              className={`${styles.tabButton} ${activeTab === "holidays" ? styles.activeTab : ""}`}
              onClick={() => setActiveTab("holidays")}
            >
              <span>📅 Master Tanggal Merah</span>
              <span className={styles.tabBadge}>{holidays.length}</span>
            </button>
          </div>
        </div>

        {/* Global Notification Banner */}
        {message && (
          <div
            style={{
              padding: "0.75rem 1rem",
              borderRadius: "0.5rem",
              background: message.type === "success" ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
              border: `1px solid ${message.type === "success" ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
              color: message.type === "success" ? "#34d399" : "#f87171",
              fontSize: "0.875rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}
          >
            <span>{message.text}</span>
            <button
              onClick={() => setMessage(null)}
              style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer" }}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* ─── TAB 1: LAPORAN BULANAN ─── */}
      {activeTab === "report" && (
        <>
          {/* Filter Bar */}
          <div className={styles.filterCard}>
            <div className={styles.filterGroup}>
              <label>Perusahaan / Project</label>
              <select
                className={styles.selectInput}
                value={selectedCompanyId || ""}
                onChange={(e) => setSelectedCompanyId(Number(e.target.value))}
                disabled={loadingCompanies}
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.type.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label>Bulan Laporan</label>
              <select
                className={styles.selectInput}
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
              >
                {MONTH_NAMES.map((name, i) => (
                  <option key={i + 1} value={i + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label>Tahun</label>
              <select
                className={styles.selectInput}
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              >
                {[2024, 2025, 2026, 2027, 2028].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              className={styles.btnSecondary}
              onClick={() => selectedCompanyId && loadReport(selectedCompanyId, year, month)}
              disabled={loadingReport}
              style={{ height: "40px" }}
            >
              {loadingReport ? "Memuat..." : "🔄 Segarkan Data"}
            </button>
          </div>

          {/* Hero Metrics */}
          {reportData && (
            <div className={styles.heroGrid}>
              <div className={styles.heroCard}>
                <div className={styles.heroCardTitle}>
                  <span>🎯</span> Overall Availability (KPI)
                </div>
                <div
                  className={`${styles.heroCardValue} ${
                    Number(reportData.overallAvailability) === 100
                      ? styles.badgeSuccess
                      : Number(reportData.overallAvailability) >= 99
                      ? styles.badgeWarning
                      : styles.badgeDanger
                  }`}
                >
                  {reportData.overallAvailability}%
                </div>
                <div className={styles.heroCardSub}>
                  {reportData.problems.length === 0
                    ? "✨ Sempurna! Tidak ada catatan downtime bulan ini."
                    : `⚠️ Terdapat ${reportData.problems.length} catatan downtime teknis.`}
                </div>
              </div>

              <div className={styles.heroCard}>
                <div className={styles.heroCardTitle}>
                  <span>📅</span> Hari Kerja Pertama (BAO Date)
                </div>
                <div style={{ marginTop: "0.25rem" }}>
                  <span className={styles.baoDateBadge}>
                    {reportData.firstWorkingDay.dayName}, {reportData.firstWorkingDay.dateStr}
                  </span>
                </div>
                <div className={styles.heroCardSub} style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                  Teks BAO: "Pada hari ini {reportData.firstWorkingDay.dayName} tanggal{" "}
                  <strong>{reportData.firstWorkingDay.dayWord}</strong> bulan{" "}
                  <strong>{reportData.firstWorkingDay.monthWord}</strong> tahun{" "}
                  <strong>{reportData.firstWorkingDay.yearWord}</strong>..."
                </div>
              </div>

              <div className={styles.heroCard}>
                <div className={styles.heroCardTitle}>
                  <span>✍️</span> Penandatangan Dokumen (TTD)
                </div>
                <div style={{ fontSize: "0.95rem", fontWeight: "700", color: "#ffffff" }}>
                  MKN: {reportData.company.mknSignerName || (reportData.company.type === "kpc" ? "Joko Triono (PJO)" : "Wanto (PM)")}
                </div>
                <div className={styles.heroCardSub}>
                  Klien: {reportData.company.clientSignerName || "-"} ({reportData.company.clientSignerRole || "Klien"})
                  <br />
                  <span style={{ fontSize: "0.75rem", color: "#60a5fa" }}>
                    Tipe: {reportData.company.type === "kpc" ? "KPC Group (PJO Joko Triono)" : "Non-KPC (PM Wanto)"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Action Bar */}
          <div className={styles.actionBar}>
            <div>
              <strong style={{ color: "#ffffff" }}>Generate Laporan & Unduh</strong>
              <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                Format Word & Excel persis sama dengan template resmi Sangatta.
              </div>
            </div>

            <div className={styles.actionBtnGroup}>
              <button
                className={styles.btnPrimary}
                onClick={() => {
                  if (reportData && reportData.company.devices.length > 0) {
                    setProblemForm({
                      deviceId: reportData.company.devices[0].id,
                      problemDate: `${year}-${String(month).padStart(2, "0")}-01`,
                      downtimeHours: 0,
                      downtimeMinutes: 0,
                      downtimeSeconds: 0,
                      description: ""
                    });
                  }
                  setShowProblemModal(true);
                }}
              >
                <span>➕</span> Catat Masalah (Downtime)
              </button>

              <button
                className={styles.btnExcel}
                onClick={() => handleDownload("excel")}
                disabled={downloadingExcel}
              >
                <span>📥</span> {downloadingExcel ? "Menyiapkan Excel..." : "Download Excel (KPI)"}
              </button>

              <button
                className={styles.btnWord}
                onClick={() => handleDownload("word")}
                disabled={downloadingWord}
              >
                <span>📥</span> {downloadingWord ? "Menyiapkan Word..." : "Download Word (BAO)"}
              </button>
            </div>
          </div>

          {/* Table: Device Availability */}
          <div className={styles.tableCard}>
            <div className={styles.tableTitleBar}>
              <div className={styles.tableTitle}>
                <span>📡</span> Rincian Availability per Link / Perangkat
              </div>
              <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                Periode: {MONTH_NAMES[month - 1]} {year} ({reportData?.daysInMonth || 30} Hari)
              </span>
            </div>

            <div className={styles.tableContainer}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th style={{ width: "50px" }}>No</th>
                    <th>Nama Perangkat / Link</th>
                    <th>Lokasi</th>
                    <th>Total Downtime</th>
                    <th style={{ textAlign: "right" }}>Availability</th>
                    <th style={{ textAlign: "center" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData && reportData.deviceStats.length > 0 ? (
                    reportData.deviceStats.map((stat, idx) => (
                      <tr key={stat.device.id}>
                        <td>{idx + 1}</td>
                        <td style={{ fontWeight: "600", color: "#ffffff" }}>{stat.device.deviceName}</td>
                        <td>{stat.device.location || "-"}</td>
                        <td>
                          {stat.totalDowntimeSeconds > 0 ? (
                            <span style={{ color: "#f87171", fontWeight: "600" }}>
                              {stat.downtimeHours} jam {stat.downtimeMinutes} m {stat.downtimeSeconds} s
                            </span>
                          ) : (
                            <span style={{ color: "#94a3b8" }}>0 jam (Nol Gangguan)</span>
                          )}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: "700" }}>
                          <span
                            style={{
                              color: stat.availabilityPercent === 100 ? "#34d399" : "#f87171"
                            }}
                          >
                            {stat.availabilityPercent.toFixed(2)}%
                          </span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {stat.availabilityPercent === 100 ? (
                            <span className={`${styles.statusPill} ${styles.pillGreen}`}>✓ Aman (100%)</span>
                          ) : (
                            <span className={`${styles.statusPill} ${styles.pillAmber}`}>⚠️ Terganggu</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "2rem" }}>
                        {loadingReport ? "Memuat rincian perangkat..." : "Belum ada link/perangkat terdaftar untuk perusahaan ini."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table: Problem Logs */}
          <div className={styles.tableCard}>
            <div className={styles.tableTitleBar}>
              <div className={styles.tableTitle}>
                <span>📝</span> Catatan Masalah / Gangguan Bulan Ini (Remarks)
              </div>
              <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                {reportData?.problems.length || 0} masalah tercatat
              </span>
            </div>

            <div className={styles.tableContainer}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th style={{ width: "50px" }}>No</th>
                    <th>Tanggal</th>
                    <th>Link / Perangkat</th>
                    <th>Durasi Downtime</th>
                    <th>Keterangan Gangguan</th>
                    <th style={{ width: "80px", textAlign: "center" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData && reportData.problems.length > 0 ? (
                    reportData.problems.map((p, idx) => (
                      <tr key={p.id}>
                        <td>{idx + 1}</td>
                        <td style={{ whiteSpace: "nowrap" }}>{p.problemDate}</td>
                        <td style={{ fontWeight: "600", color: "#ffffff" }}>{p.deviceName}</td>
                        <td>
                          {p.downtimeHours} jam {p.downtimeMinutes} menit {p.downtimeSeconds} detik
                        </td>
                        <td>{p.description || "-"}</td>
                        <td style={{ textAlign: "center" }}>
                          <div style={{ display: "flex", gap: "0.4rem", justifyContent: "center", flexWrap: "wrap" }}>
                            {problemRfos[p.id] ? (
                              <a
                                href={`${API_URL}/ops-telco/rfo/${problemRfos[p.id].id}/pdf`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  background: "linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.3))",
                                  color: "#fca5a5",
                                  border: "1px solid rgba(239, 68, 68, 0.4)",
                                  borderRadius: "0.4rem",
                                  padding: "0.3rem 0.6rem",
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  textDecoration: "none",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.25rem"
                                }}
                                title="Download PDF RFO yang sudah terbit"
                              >
                                📄 RFO PDF
                              </a>
                            ) : (
                              <button
                                className={styles.btnSecondary}
                                style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem", color: "#38bdf8", borderColor: "rgba(56, 189, 248, 0.3)" }}
                                onClick={() => openCreateRfoFromProblem(p)}
                                title="Buat Surat Keterangan RFO untuk gangguan ini"
                              >
                                📄 Buat RFO
                              </button>
                            )}
                            <button
                              className={styles.btnDanger}
                              onClick={() => handleDeleteProblem(p.id)}
                              title="Hapus catatan gangguan ini"
                            >
                              Hapus
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "#34d399" }}>
                        ✓ Tidak ada masalah gangguan pada bulan ini. KPI otomatis 100%.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ─── TAB 2: MASTER PERUSAHAAN ─── */}
      {activeTab === "companies" && (
        <div className={styles.tableCard}>
          <div className={styles.tableTitleBar}>
            <div>
              <div className={styles.tableTitle}>🏢 Daftar Perusahaan Klien</div>
              <p style={{ fontSize: "0.8rem", color: "#94a3b8", margin: 0 }}>
                Tambah, edit, atau hapus perusahaan dan daftar link/perangkat sesuai kontrak aktif.
              </p>
            </div>
            <button className={styles.btnPrimary} onClick={openCreateCompanyModal}>
              <span>➕</span> Tambah Perusahaan
            </button>
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th style={{ width: "50px" }}>No</th>
                  <th>Nama Perusahaan</th>
                  <th>Tipe (TTD)</th>
                  <th>Penandatangan MKN</th>
                  <th>Pejabat Klien</th>
                  <th style={{ textAlign: "center" }}>Jml Device</th>
                  <th style={{ width: "160px", textAlign: "center" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c, idx) => (
                  <tr key={c.id}>
                    <td>{idx + 1}</td>
                    <td>
                      <strong style={{ color: "#ffffff" }}>{c.name}</strong>
                      {c.clientCompanyName && (
                        <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{c.clientCompanyName}</div>
                      )}
                    </td>
                    <td>
                      <span className={`${styles.statusPill} ${c.type === "kpc" ? styles.pillGreen : styles.pillAmber}`}>
                        {c.type === "kpc" ? "KPC (Pak Joko Triono)" : "Non-KPC (Pak Wanto)"}
                      </span>
                    </td>
                    <td>{c.mknSignerName || (c.type === "kpc" ? "Joko Triono (PJO)" : "Wanto (PM)")}</td>
                    <td>{c.clientSignerName ? `${c.clientSignerName} (${c.clientSignerRole || "Klien"})` : "-"}</td>
                    <td style={{ textAlign: "center" }}>
                      <span
                        style={{
                          background: "rgba(59, 130, 246, 0.15)",
                          color: "#60a5fa",
                          padding: "0.2rem 0.6rem",
                          borderRadius: "1rem",
                          fontWeight: "700"
                        }}
                      >
                        {c.deviceCount} link
                      </span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <div style={{ display: "flex", gap: "0.4rem", justifyContent: "center" }}>
                        <button
                          className={styles.btnSecondary}
                          style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}
                          onClick={() => openEditCompanyModal(c)}
                        >
                          Edit
                        </button>
                        <button
                          className={styles.btnSecondary}
                          style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem", color: "#60a5fa" }}
                          onClick={() => {
                            setDeviceTargetCompanyId(c.id);
                            setShowDeviceModal(true);
                          }}
                        >
                          + Link
                        </button>
                        <button
                          className={styles.btnDanger}
                          onClick={() => handleDeleteCompany(c)}
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 3: MASTER TANGGAL MERAH (HOLIDAYS) ─── */}
      {activeTab === "holidays" && (
        <div className={styles.tableCard}>
          <div className={styles.tableTitleBar}>
            <div>
              <div className={styles.tableTitle}>📅 Master Tanggal Merah (Hari Libur Nasional)</div>
              <p style={{ fontSize: "0.8rem", color: "#94a3b8", margin: 0 }}>
                Daftar libur nasional yang dilewati (skip) saat mencari Hari Kerja Pertama bulan laporan pada dokumen BAO.
              </p>
            </div>
            <button
              className={styles.btnPrimary}
              onClick={() => {
                setHolidayForm({ holidayDate: `${year}-01-01`, description: "" });
                setShowHolidayModal(true);
              }}
            >
              <span>➕</span> Tambah Hari Libur
            </button>
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th style={{ width: "50px" }}>No</th>
                  <th style={{ width: "160px" }}>Tanggal Libur</th>
                  <th>Keterangan Libur</th>
                  <th style={{ width: "80px", textAlign: "center" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {holidays.map((h, idx) => (
                  <tr key={h.id}>
                    <td>{idx + 1}</td>
                    <td style={{ fontWeight: "700", color: "#f87171" }}>{h.holidayDate}</td>
                    <td>{h.description}</td>
                    <td style={{ textAlign: "center" }}>
                      <button className={styles.btnDanger} onClick={() => handleDeleteHoliday(h.id)}>
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── MODAL: CATAT MASALAH (DOWNTIME) ─── */}
      {showProblemModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>➕ Catat Masalah (Downtime Jaringan)</h3>
              <button className={styles.modalCloseBtn} onClick={() => setShowProblemModal(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveProblem}>
              <div className={styles.modalBody}>
                <div className={styles.filterGroup}>
                  <label>Pilih Perangkat / Link</label>
                  <select
                    className={styles.selectInput}
                    value={problemForm.deviceId}
                    onChange={(e) => setProblemForm({ ...problemForm, deviceId: Number(e.target.value) })}
                    required
                  >
                    <option value="">-- Pilih Link --</option>
                    {reportData?.company.devices.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.deviceName} {d.location ? `(${d.location})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.filterGroup}>
                  <label>Tanggal Gangguan</label>
                  <input
                    type="date"
                    className={styles.textInput}
                    value={problemForm.problemDate}
                    onChange={(e) => setProblemForm({ ...problemForm, problemDate: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <div className={styles.filterGroup} style={{ flex: 1 }}>
                    <label>Durasi Jam</label>
                    <input
                      type="number"
                      min="0"
                      max="744"
                      className={styles.textInput}
                      value={problemForm.downtimeHours}
                      onChange={(e) =>
                        setProblemForm({ ...problemForm, downtimeHours: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className={styles.filterGroup} style={{ flex: 1 }}>
                    <label>Durasi Menit</label>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      className={styles.textInput}
                      value={problemForm.downtimeMinutes}
                      onChange={(e) =>
                        setProblemForm({ ...problemForm, downtimeMinutes: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className={styles.filterGroup} style={{ flex: 1 }}>
                    <label>Durasi Detik</label>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      className={styles.textInput}
                      value={problemForm.downtimeSeconds}
                      onChange={(e) =>
                        setProblemForm({ ...problemForm, downtimeSeconds: Number(e.target.value) })
                      }
                    />
                  </div>
                </div>

                <div className={styles.filterGroup}>
                  <label>Keterangan Masalah / Tindakan</label>
                  <textarea
                    className={styles.textInput}
                    rows={3}
                    placeholder="Contoh: Radio Link Obstacle, Radio off karena pemadaman genset..."
                    value={problemForm.description}
                    onChange={(e) => setProblemForm({ ...problemForm, description: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setShowProblemModal(false)}
                >
                  Batal
                </button>
                <button type="submit" className={styles.btnPrimary} disabled={savingProblem}>
                  {savingProblem ? "Menyimpan..." : "Simpan Masalah"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: TAMBAH / EDIT PERUSAHAAN ─── */}
      {showCompanyModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ maxWidth: "640px" }}>
            <div className={styles.modalHeader}>
              <h3>{editingCompanyId ? "✏️ Edit Perusahaan" : "➕ Tambah Perusahaan Baru"}</h3>
              <button className={styles.modalCloseBtn} onClick={() => setShowCompanyModal(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveCompany}>
              <div className={styles.modalBody}>
                <div className={styles.filterGroup}>
                  <label>Nama Project / Singkat</label>
                  <input
                    type="text"
                    className={styles.textInput}
                    placeholder="Contoh: KPC Microwave, NAP 20 Mbps, Hexindo..."
                    value={companyForm.name}
                    onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className={styles.filterGroup}>
                  <label>Tipe Perusahaan (Menentukan Penandatangan MKN)</label>
                  <select
                    className={styles.selectInput}
                    value={companyForm.type}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCompanyForm({
                        ...companyForm,
                        type: val,
                        mknSignerName: val === "kpc" ? "Joko Triono" : "Wanto",
                        mknSignerRole: val === "kpc" ? "PJO" : "Project Manager"
                      });
                    }}
                  >
                    <option value="kpc">KPC Group (TTD: Pak Joko Triono - PJO)</option>
                    <option value="non-kpc">Non-KPC / Kontrak Lain (TTD: Pak Wanto - PM)</option>
                  </select>
                </div>

                <div className={styles.filterGroup}>
                  <label>Nama Resmi Perusahaan Klien</label>
                  <input
                    type="text"
                    className={styles.textInput}
                    placeholder="Contoh: PT KALTIM PRIMA COAL, PT HEXINDO ADIPERKASA, TBK..."
                    value={companyForm.clientCompanyName}
                    onChange={(e) => setCompanyForm({ ...companyForm, clientCompanyName: e.target.value })}
                  />
                </div>

                <div className={styles.filterGroup}>
                  <label>Alamat / Lokasi Klien (Muncul di BAO)</label>
                  <input
                    type="text"
                    className={styles.textInput}
                    placeholder="Contoh: PT Kaltim Prima Coal d/a ISD M3 Building mine Site Sangatta, Kalimantan Timur"
                    value={companyForm.clientAddress}
                    onChange={(e) => setCompanyForm({ ...companyForm, clientAddress: e.target.value })}
                  />
                </div>

                <div className={styles.filterGroup}>
                  <label>Judul Pengadaan / Kontrak</label>
                  <input
                    type="text"
                    className={styles.textInput}
                    placeholder="Contoh: pengadaan link Microwave Radio Transmissions, Contract KPC - 34 - 0044"
                    value={companyForm.contractTitle}
                    onChange={(e) => setCompanyForm({ ...companyForm, contractTitle: e.target.value })}
                  />
                </div>

                <div className={styles.filterGroup}>
                  <label>Uraian Pekerjaan / Layanan di Tabel BAO</label>
                  <input
                    type="text"
                    className={styles.textInput}
                    placeholder="Contoh: Microwave Radio Transmission And Maintenance Support ( 15 Link )"
                    value={companyForm.serviceDescription}
                    onChange={(e) => setCompanyForm({ ...companyForm, serviceDescription: e.target.value })}
                  />
                </div>

                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <div className={styles.filterGroup} style={{ flex: 1 }}>
                    <label>Pejabat MKN</label>
                    <input
                      type="text"
                      className={styles.textInput}
                      value={companyForm.mknSignerName}
                      onChange={(e) => setCompanyForm({ ...companyForm, mknSignerName: e.target.value })}
                    />
                  </div>
                  <div className={styles.filterGroup} style={{ flex: 1 }}>
                    <label>Jabatan MKN</label>
                    <input
                      type="text"
                      className={styles.textInput}
                      value={companyForm.mknSignerRole}
                      onChange={(e) => setCompanyForm({ ...companyForm, mknSignerRole: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <div className={styles.filterGroup} style={{ flex: 1 }}>
                    <label>Pejabat Klien (Signer)</label>
                    <input
                      type="text"
                      className={styles.textInput}
                      placeholder="Contoh: Suluh Basuki, Suryadi..."
                      value={companyForm.clientSignerName}
                      onChange={(e) => setCompanyForm({ ...companyForm, clientSignerName: e.target.value })}
                    />
                  </div>
                  <div className={styles.filterGroup} style={{ flex: 1 }}>
                    <label>Jabatan Klien</label>
                    <input
                      type="text"
                      className={styles.textInput}
                      placeholder="Contoh: ISD KPC, PM Sangatta..."
                      value={companyForm.clientSignerRole}
                      onChange={(e) => setCompanyForm({ ...companyForm, clientSignerRole: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setShowCompanyModal(false)}
                >
                  Batal
                </button>
                <button type="submit" className={styles.btnPrimary} disabled={savingCompany}>
                  {savingCompany ? "Menyimpan..." : "Simpan Perusahaan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: TAMBAH PERANGKAT / LINK ─── */}
      {showDeviceModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>➕ Tambah Link / Perangkat Baru</h3>
              <button className={styles.modalCloseBtn} onClick={() => setShowDeviceModal(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleAddDevice}>
              <div className={styles.modalBody}>
                <div className={styles.filterGroup}>
                  <label>Nama Perangkat / Link</label>
                  <input
                    type="text"
                    className={styles.textInput}
                    placeholder="Contoh: M5 to SURYA, Link Internet 20 Mbps..."
                    value={deviceForm.deviceName}
                    onChange={(e) => setDeviceForm({ ...deviceForm, deviceName: e.target.value })}
                    required
                  />
                </div>

                <div className={styles.filterGroup}>
                  <label>Lokasi (Opsional)</label>
                  <input
                    type="text"
                    className={styles.textInput}
                    placeholder="Contoh: Site Sangatta, TBTS, Pit J..."
                    value={deviceForm.location}
                    onChange={(e) => setDeviceForm({ ...deviceForm, location: e.target.value })}
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setShowDeviceModal(false)}
                >
                  Batal
                </button>
                <button type="submit" className={styles.btnPrimary} disabled={savingDevice}>
                  {savingDevice ? "Menambahkan..." : "Tambah Perangkat"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: TAMBAH TANGGAL MERAH ─── */}
      {showHolidayModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>📅 Tambah Tanggal Merah (Libur Nasional)</h3>
              <button className={styles.modalCloseBtn} onClick={() => setShowHolidayModal(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleAddHoliday}>
              <div className={styles.modalBody}>
                <div className={styles.filterGroup}>
                  <label>Tanggal Libur</label>
                  <input
                    type="date"
                    className={styles.textInput}
                    value={holidayForm.holidayDate}
                    onChange={(e) => setHolidayForm({ ...holidayForm, holidayDate: e.target.value })}
                    required
                  />
                </div>

                <div className={styles.filterGroup}>
                  <label>Keterangan Libur</label>
                  <input
                    type="text"
                    className={styles.textInput}
                    placeholder="Contoh: Hari Raya Idul Fitri 1447 H..."
                    value={holidayForm.description}
                    onChange={(e) => setHolidayForm({ ...holidayForm, description: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setShowHolidayModal(false)}
                >
                  Batal
                </button>
                <button type="submit" className={styles.btnPrimary} disabled={savingHoliday}>
                  {savingHoliday ? "Menyimpan..." : "Simpan Libur"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ─── MODAL RFO DARI KPI ─── */}
      {showRfoModal && (
        <div className={styles.modalOverlay} onClick={() => !savingRfo && setShowRfoModal(false)}>
          <div className={styles.modalContent} style={{ maxWidth: "700px" }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                <span>📄</span> Buat Reason For Outage (RFO) dari Gangguan KPI
              </div>
              <button
                className={styles.modalClose}
                onClick={() => !savingRfo && setShowRfoModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRfo}>
              <div className={styles.modalBody}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem" }}>
                  <div className={styles.filterGroup}>
                    <label>Nomor Gangguan (Tiket) *</label>
                    <input
                      type="text"
                      className={styles.textInput}
                      style={{ fontFamily: "monospace", fontWeight: "700" }}
                      value={rfoForm.ticketNumber}
                      onChange={(e) => setRfoForm({ ...rfoForm, ticketNumber: e.target.value })}
                      required
                    />
                  </div>

                  <div className={styles.filterGroup}>
                    <label>Tanggal Kejadian *</label>
                    <input
                      type="date"
                      className={styles.textInput}
                      value={rfoForm.rfoDate}
                      onChange={(e) => setRfoForm({ ...rfoForm, rfoDate: e.target.value })}
                      required
                    />
                  </div>

                  <div className={styles.filterGroup}>
                    <label>Mulai Kejadian *</label>
                    <input
                      type="text"
                      className={styles.textInput}
                      value={rfoForm.startTime}
                      onChange={(e) => setRfoForm({ ...rfoForm, startTime: e.target.value })}
                      placeholder="Contoh: 16 Mei 2026 13:20 WITA"
                      required
                    />
                  </div>

                  <div className={styles.filterGroup}>
                    <label>Akhir Kejadian *</label>
                    <input
                      type="text"
                      className={styles.textInput}
                      value={rfoForm.endTime}
                      onChange={(e) => setRfoForm({ ...rfoForm, endTime: e.target.value })}
                      placeholder="Contoh: 16 Mei 2026 17:35 WITA"
                      required
                    />
                  </div>

                  <div className={styles.filterGroup} style={{ gridColumn: "span 2" }}>
                    <label>Penyebab (Cause) *</label>
                    <textarea
                      className={styles.textInput}
                      style={{ minHeight: "65px", resize: "vertical", fontFamily: "inherit" }}
                      value={rfoForm.cause}
                      onChange={(e) => setRfoForm({ ...rfoForm, cause: e.target.value })}
                      required
                    />
                  </div>

                  <div className={styles.filterGroup} style={{ gridColumn: "span 2" }}>
                    <label>Akibat (Impact) *</label>
                    <textarea
                      className={styles.textInput}
                      style={{ minHeight: "65px", resize: "vertical", fontFamily: "inherit" }}
                      value={rfoForm.impact}
                      onChange={(e) => setRfoForm({ ...rfoForm, impact: e.target.value })}
                      required
                    />
                  </div>

                  <div className={styles.filterGroup} style={{ gridColumn: "span 2" }}>
                    <label>Solusi (Solution) *</label>
                    <textarea
                      className={styles.textInput}
                      style={{ minHeight: "65px", resize: "vertical", fontFamily: "inherit" }}
                      value={rfoForm.solution}
                      onChange={(e) => setRfoForm({ ...rfoForm, solution: e.target.value })}
                      required
                    />
                  </div>

                  <div className={styles.filterGroup} style={{ gridColumn: "span 2" }}>
                    <label>Status (Resolution Status) *</label>
                    <textarea
                      className={styles.textInput}
                      style={{ minHeight: "65px", resize: "vertical", fontFamily: "inherit" }}
                      value={rfoForm.status}
                      onChange={(e) => setRfoForm({ ...rfoForm, status: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setShowRfoModal(false)}
                  disabled={savingRfo}
                >
                  Batal
                </button>
                <button type="submit" className={styles.btnPrimary} disabled={savingRfo}>
                  {savingRfo ? "Menerbitkan..." : "Terbitkan RFO & Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
