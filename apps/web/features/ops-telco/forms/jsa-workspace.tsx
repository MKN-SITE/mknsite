"use client";

import { useEffect, useState, useMemo } from "react";
import { API_URL, api, type PortalUser } from "@/lib/api";
import styles from "./jsa-workspace.module.css";

export interface JsaStepItem {
  id?: number;
  stepNumber: number;
  sequence: number;
  stepDescription: string;
  hazardNo?: string;
  hazardDescription?: string;
  actionNo?: string;
  actionDescription?: string;
  observation?: string;
}

export interface JsaRecord {
  id: number;
  jsaNumber: string;
  jobNumber?: string | null;
  jobTitle: string;
  personTitle?: string | null;
  location: string;
  jsaDate: string;
  jsaType?: string | null;
  ppeRequirements?: string | null;
  analysedBy?: string | null;
  analysedByBadge?: string | null;
  reviewedBy?: string | null;
  reviewedByBadge?: string | null;
  approvedBy?: string | null;
  approvedByBadge?: string | null;
  supervisorName?: string | null;
  leadWorkerName?: string | null;
  fpeElements?: string[] | null;
  jobPermits?: string[] | null;
  workers?: Array<{ name: string; badgeNumber?: string }> | null;
  status: string;
  steps?: JsaStepItem[];
  createdAt: string;
}

const FPE_DEFINITIONS = [
  { code: "1.09", name: "Design Pembangunan & Pemeliharaan Jalan (FPE 1.09)" },
  { code: "1.10", name: "Keselamatan Dinding Tambang (FPE 1.10)" },
  { code: "2.12", name: "Isolasi dan Lock Out (FPE 2.12)" },
  { code: "2.14", name: "Bekerja di Ketinggian (FPE 2.14)" },
  { code: "2.15", name: "Pengangkatan & Penyanggaan Beban (FPE 2.15)" },
  { code: "2.18", name: "Operasi Kendaraan dan Alat Bergerak (FPE 2.18)" },
  { code: "2.21_kendaraan", name: "Kondisi Kendaraan & Alat Bergerak (FPE 2.21)" },
  { code: "2.21_listrik", name: "Keselamatan Pekerjaan Listrik (FPE 2.21)" },
  { code: "2.22", name: "Penanganan & Penggunaan Bahan Peledak (FPE 2.22)" },
  { code: "2.23", name: "Ruang Terbatas (FPE 2.23)" },
  { code: "2.24", name: "Bekerja Dekat Air (FPE 2.24)" },
  { code: "other", name: "Other's" }
];

const PERMIT_DEFINITIONS = [
  { code: "vicinity", name: "Vicinity Permit" },
  { code: "confined_space", name: "Confined Spaces" },
  { code: "wah", name: "Working at Height" },
  { code: "digging", name: "Digging Permit" },
  { code: "hot_work", name: "Hot Work" },
  { code: "isolasi", name: "Isolasi" },
  { code: "red_tag", name: "Red Tag" },
  { code: "other", name: "Other's" }
];

export function JsaWorkspace({ user }: { user: PortalUser }) {
  const [activeTab, setActiveTab] = useState<"create" | "history">("create");

  // History State
  const [historyList, setHistoryList] = useState<JsaRecord[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [selectedJsa, setSelectedJsa] = useState<JsaRecord | null>(null);

  // Form State
  const [jsaNumber, setJsaNumber] = useState("");
  const [jobNumber, setJobNumber] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [personTitle, setPersonTitle] = useState("Technician + Junior Technician");
  const [location, setLocation] = useState("");
  const [jsaDate, setJsaDate] = useState(new Date().toISOString().split("T")[0]);
  const [jsaType, setJsaType] = useState("normal");
  const [ppeRequirements, setPpeRequirements] = useState(
    "Safety shoes, Helmet standard, Full body harness & double lanyard, Seragam kerja standard MKN"
  );
  const [analysedBy, setAnalysedBy] = useState(user.name || "");
  const [analysedByBadge, setAnalysedByBadge] = useState(user.kpcId || "");
  const [reviewedBy, setReviewedBy] = useState("");
  const [reviewedByBadge, setReviewedByBadge] = useState("");
  const [approvedBy, setApprovedBy] = useState("Responsible Area");
  const [approvedByBadge, setApprovedByBadge] = useState("");
  const [supervisorName, setSupervisorName] = useState("Imam Aulia");
  const [leadWorkerName, setLeadWorkerName] = useState("");

  const [selectedFpe, setSelectedFpe] = useState<string[]>(["2.14"]);
  const [selectedPermits, setSelectedPermits] = useState<string[]>(["wah"]);

  const [steps, setSteps] = useState<JsaStepItem[]>([
    {
      stepNumber: 1,
      sequence: 1,
      stepDescription: "Persiapan kerja, area, peralatan dan tools",
      hazardNo: "1.1",
      hazardDescription: "Terjatuh karena peralatan kerja tidak layak atau rusak",
      actionNo: "1.1.1",
      actionDescription: "Lakukan pengecekan peralatan kerja seperti full body harness dan twin lanyard dalam kondisi aman",
      observation: "YES"
    },
    {
      stepNumber: 2,
      sequence: 2,
      stepDescription: "Personil Naik Tower",
      hazardNo: "2.1",
      hazardDescription: "Terjatuh dari tower",
      actionNo: "2.1.1",
      actionDescription: "Gunakan tiga titik tumpu saat naik tangga dan kaitkan hook lanyard secara bergantian pada rangka tower",
      observation: "YES"
    }
  ]);

  const [workers, setWorkers] = useState<Array<{ name: string; badgeNumber: string }>>([
    { name: user.name || "", badgeNumber: user.kpcId || "" }
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Fetch Next Number
  const fetchNextNumber = async () => {
    try {
      const res = await api<{ success: boolean; data: { jsaNumber: string } }>("/ops-telco/jsa/next-number");
      if (res.data?.jsaNumber) {
        setJsaNumber(res.data.jsaNumber);
      }
    } catch {
      // Fallback format
      const now = new Date();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const y = now.getFullYear();
      setJsaNumber(`MKN/SGT/TLC/001/${m}/${y}`);
    }
  };

  // Fetch History List
  const fetchHistory = async (p = page, s = searchTerm) => {
    setHistoryLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: String(p),
        limit: "15"
      });
      if (s.trim()) queryParams.set("search", s.trim());

      const res = await api<{
        success: boolean;
        items: JsaRecord[];
        total: number;
        page: number;
        limit: number;
      }>(`/ops-telco/jsa?${queryParams.toString()}`);

      setHistoryList(res.items || []);
      setHistoryTotal(res.total || 0);
    } catch (err: any) {
      console.error("Failed to load JSA history:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchNextNumber();
    fetchHistory(1, "");
  }, []);

  // Handle Search in History
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchHistory(1, searchTerm);
  };

  // Step Operations
  const addStep = () => {
    const nextNum = steps.length > 0 ? Math.max(...steps.map((s) => s.stepNumber)) + 1 : 1;
    setSteps([
      ...steps,
      {
        stepNumber: nextNum,
        sequence: steps.length + 1,
        stepDescription: "",
        hazardNo: `${nextNum}.1`,
        hazardDescription: "",
        actionNo: `${nextNum}.1.1`,
        actionDescription: "",
        observation: "YES"
      }
    ]);
  };

  const addSubStep = (stepNum: number) => {
    const existing = steps.filter((s) => s.stepNumber === stepNum);
    const subIdx = existing.length + 1;
    const parentDesc = existing[0]?.stepDescription || "";

    setSteps([
      ...steps,
      {
        stepNumber: stepNum,
        sequence: steps.length + 1,
        stepDescription: parentDesc,
        hazardNo: `${stepNum}.${subIdx}`,
        hazardDescription: "",
        actionNo: `${stepNum}.${subIdx}.1`,
        actionDescription: "",
        observation: "YES"
      }
    ]);
  };

  const removeStep = (index: number) => {
    const updated = [...steps];
    updated.splice(index, 1);
    setSteps(updated);
  };

  const updateStepField = (index: number, field: keyof JsaStepItem, value: any) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], [field]: value };
    setSteps(updated);
  };

  // Worker Operations
  const addWorker = () => {
    setWorkers([...workers, { name: "", badgeNumber: "" }]);
  };

  const removeWorker = (index: number) => {
    const updated = [...workers];
    updated.splice(index, 1);
    setWorkers(updated);
  };

  const updateWorker = (index: number, field: "name" | "badgeNumber", value: string) => {
    const updated = [...workers];
    updated[index][field] = value;
    setWorkers(updated);
  };

  // Toggle FPE & Permits
  const toggleFpe = (code: string) => {
    setSelectedFpe((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  };

  const togglePermit = (code: string) => {
    setSelectedPermits((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  };

  // Submit Handler
  const handleSubmit = async (andDownloadPdf = false) => {
    if (!jobTitle.trim()) {
      setMessage({ type: "error", text: "Judul Pekerjaan (Job Title) wajib diisi." });
      return;
    }
    if (!location.trim()) {
      setMessage({ type: "error", text: "Lokasi Pekerjaan (Location) wajib diisi." });
      return;
    }
    if (steps.length === 0) {
      setMessage({ type: "error", text: "Tambahkan setidaknya satu langkah kerja." });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const payload = {
        jsaNumber: jsaNumber.trim(),
        jobNumber: jobNumber.trim() || undefined,
        jobTitle: jobTitle.trim(),
        personTitle: personTitle.trim() || undefined,
        location: location.trim(),
        jsaDate,
        jsaType,
        ppeRequirements: ppeRequirements.trim() || undefined,
        analysedBy: analysedBy.trim() || undefined,
        analysedByBadge: analysedByBadge.trim() || undefined,
        reviewedBy: reviewedBy.trim() || undefined,
        reviewedByBadge: reviewedByBadge.trim() || undefined,
        approvedBy: approvedBy.trim() || undefined,
        approvedByBadge: approvedByBadge.trim() || undefined,
        supervisorName: supervisorName.trim() || undefined,
        leadWorkerName: leadWorkerName.trim() || undefined,
        fpeElements: selectedFpe,
        jobPermits: selectedPermits,
        workers: workers.filter((w) => w.name.trim()),
        steps
      };

      const res = await api<{ success: boolean; data: JsaRecord }>("/ops-telco/jsa", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      setMessage({
        type: "success",
        text: `Formulir JSA No. ${res.data.jsaNumber} berhasil disimpan!`
      });

      if (andDownloadPdf && res.data.id) {
        window.open(`${API_URL}/ops-telco/jsa/${res.data.id}/pdf`, "_blank");
      }

      // Reset / prepare next
      fetchNextNumber();
      fetchHistory(1, "");
      setActiveTab("history");
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err?.message || "Gagal menyimpan formulir JSA."
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Handler
  const handleDelete = async (id: number) => {
    if (!confirm("Apakah Anda yakin ingin menghapus dokumen JSA ini?")) return;
    try {
      await api(`/ops-telco/jsa/${id}`, { method: "DELETE" });
      setHistoryList(historyList.filter((item) => item.id !== id));
      setHistoryTotal((prev) => Math.max(0, prev - 1));
      if (selectedJsa?.id === id) setSelectedJsa(null);
    } catch (err: any) {
      alert("Gagal menghapus JSA: " + (err?.message || "Error"));
    }
  };

  // View Detail Handler
  const handleViewDetail = async (id: number) => {
    try {
      const res = await api<{ success: boolean; data: JsaRecord }>(`/ops-telco/jsa/${id}`);
      setSelectedJsa(res.data);
    } catch (err: any) {
      alert("Gagal memuat detail JSA: " + (err?.message || "Error"));
    }
  };

  return (
    <div className={styles.container}>
      {/* ─── Header & Top Tabs ─── */}
      <div className={styles.headerArea}>
        <div className={styles.titleRow}>
          <div>
            <h1 className={styles.mainTitle}>
              <span className={styles.titleIcon}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </span>
              Job Safety Analysis (JSA)
            </h1>
            <p className={styles.mainSubtitle}>
              Sistem Analisis Keselamatan Kerja & Pengendalian Bahaya Lapangan Teknisi (Standar FM-HSE-01-04)
            </p>
          </div>

          {/* Top Tabs */}
          <div className={styles.tabsList}>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === "create" ? styles.tabBtnActive : ""}`}
              onClick={() => setActiveTab("create")}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Pembuatan JSA Baru
            </button>

            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === "history" ? styles.tabBtnActive : ""}`}
              onClick={() => {
                setActiveTab("history");
                fetchHistory();
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              History JSA
              {historyTotal > 0 && <span className={styles.tabBadge}>{historyTotal}</span>}
            </button>
          </div>
        </div>
      </div>

      {/* ─── Notification Banner ─── */}
      {message && (
        <div
          style={{
            padding: "0.85rem 1.25rem",
            borderRadius: "0.75rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            backgroundColor: message.type === "success" ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
            border: `1px solid ${message.type === "success" ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
            color: message.type === "success" ? "#4ade80" : "#f87171"
          }}
        >
          <span>{message.type === "success" ? "✓" : "⚠"}</span>
          <span>{message.text}</span>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: PEMBUATAN JSA BARU                                                  */}
      {/* ═════════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "create" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(false);
          }}
          style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
        >
          {/* Section 1: Informasi Pekerjaan */}
          <div className={styles.card}>
            <div className={styles.cardSectionHeader}>
              <div>
                <div className={styles.cardSectionTitle}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                    <line x1="16" x2="16" y1="2" y2="6" />
                    <line x1="8" x2="8" y1="2" y2="6" />
                    <line x1="3" x2="21" y1="10" y2="10" />
                  </svg>
                  1. Informasi Pekerjaan & Lokasi
                </div>
                <div className={styles.cardSectionDesc}>Nomor JSA, judul pekerjaan, lokasi, dan tanggal kerja</div>
              </div>

              {/* JSA Type Radio */}
              <div className={styles.radioGroup}>
                {[
                  { id: "normal", label: "Normal" },
                  { id: "urgent", label: "Urgent" },
                  { id: "new", label: "New" },
                  { id: "review", label: "Review" }
                ].map((t) => (
                  <label
                    key={t.id}
                    className={`${styles.radioOption} ${jsaType === t.id ? styles.radioOptionSelected : ""}`}
                  >
                    <input
                      type="radio"
                      name="jsaType"
                      value={t.id}
                      checked={jsaType === t.id}
                      onChange={() => setJsaType(t.id)}
                      style={{ display: "none" }}
                    />
                    <span>{t.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className={styles.formGrid3}>
              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Nomor JSA <span className={styles.requiredStar}>*</span>
                </label>
                <input
                  type="text"
                  className={styles.input}
                  value={jsaNumber}
                  onChange={(e) => setJsaNumber(e.target.value)}
                  placeholder="MKN/SGT/TLC/001/09/2026"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Nomor Job Order (WO / Job No)</label>
                <input
                  type="text"
                  className={styles.input}
                  value={jobNumber}
                  onChange={(e) => setJobNumber(e.target.value)}
                  placeholder="MKN/WO/2026/089"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Tanggal Pelaksanaan <span className={styles.requiredStar}>*</span>
                </label>
                <input
                  type="date"
                  className={styles.input}
                  value={jsaDate}
                  onChange={(e) => setJsaDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className={styles.formGrid2}>
              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Judul Pekerjaan (Job Title) <span className={styles.requiredStar}>*</span>
                </label>
                <input
                  type="text"
                  className={styles.input}
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="Contoh: Pengecekan Antena Microwave NEC / Install Kabel FO"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Lokasi Pekerjaan <span className={styles.requiredStar}>*</span>
                </label>
                <input
                  type="text"
                  className={styles.input}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Contoh: Tower New AB / Surya Office / Pit J"
                  required
                />
              </div>
            </div>

            <div className={styles.formGrid2}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Jabatan Pelaksana (Title of Person Who Does Job)</label>
                <input
                  type="text"
                  className={styles.input}
                  value={personTitle}
                  onChange={(e) => setPersonTitle(e.target.value)}
                  placeholder="Technician + Junior Technician"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Alat Pelindung Diri (APD / PPE Wajib & Rekomendasi)</label>
                <input
                  type="text"
                  className={styles.input}
                  value={ppeRequirements}
                  onChange={(e) => setPpeRequirements(e.target.value)}
                  placeholder="Safety shoes, Helmet standard, Full body harness & double lanyard..."
                />
              </div>
            </div>
          </div>

          {/* Section 2: Penanggung Jawab & Tanda Tangan */}
          <div className={styles.card}>
            <div className={styles.cardSectionHeader}>
              <div>
                <div className={styles.cardSectionTitle}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  2. Personil Analisis & Pengawas
                </div>
                <div className={styles.cardSectionDesc}>Pejabat penyusun, peninjau, dan pengawas keselamatan</div>
              </div>
            </div>

            <div className={styles.formGrid3}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Dianalisis Oleh (Analysed By)</label>
                <input
                  type="text"
                  className={styles.input}
                  value={analysedBy}
                  onChange={(e) => setAnalysedBy(e.target.value)}
                  placeholder="Nama teknisi / analis"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Badge Number / ID Analis</label>
                <input
                  type="text"
                  className={styles.input}
                  value={analysedByBadge}
                  onChange={(e) => setAnalysedByBadge(e.target.value)}
                  placeholder="Contoh: Z101073"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Supervisor / Pengawas</label>
                <input
                  type="text"
                  className={styles.input}
                  value={supervisorName}
                  onChange={(e) => setSupervisorName(e.target.value)}
                  placeholder="Contoh: Imam Aulia"
                />
              </div>
            </div>

            <div className={styles.formGrid3}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Direview Oleh (Reviewed By)</label>
                <input
                  type="text"
                  className={styles.input}
                  value={reviewedBy}
                  onChange={(e) => setReviewedBy(e.target.value)}
                  placeholder="Nama peninjau / HSE"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Disetujui Oleh (Approved By)</label>
                <input
                  type="text"
                  className={styles.input}
                  value={approvedBy}
                  onChange={(e) => setApprovedBy(e.target.value)}
                  placeholder="Responsible Area"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Kepala Kerja Lapangan (Lead Worker)</label>
                <input
                  type="text"
                  className={styles.input}
                  value={leadWorkerName}
                  onChange={(e) => setLeadWorkerName(e.target.value)}
                  placeholder="Nama kepala kerja jika supervisor tdk di lokasi"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Fatality Prevention Elements (FPE) */}
          <div className={styles.card}>
            <div className={styles.cardSectionHeader}>
              <div>
                <div className={styles.cardSectionTitle}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  3. Fatality Prevention Elements (FPE)
                </div>
                <div className={styles.cardSectionDesc}>
                  Pilih elemen pencegahan fatalitas yang berhubungan dengan pekerjaan ini
                </div>
              </div>
            </div>

            <div className={styles.checklistGrid}>
              {FPE_DEFINITIONS.map((fpe) => {
                const checked = selectedFpe.includes(fpe.code);
                return (
                  <label
                    key={fpe.code}
                    className={`${styles.checkItem} ${checked ? styles.checkItemSelected : ""}`}
                  >
                    <input
                      type="checkbox"
                      className={styles.checkboxInput}
                      checked={checked}
                      onChange={() => toggleFpe(fpe.code)}
                    />
                    <span className={styles.checkLabel}>{fpe.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Section 4: Ijin Pekerjaan yang Harus Dilengkapi */}
          <div className={styles.card}>
            <div className={styles.cardSectionHeader}>
              <div>
                <div className={styles.cardSectionTitle}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                  4. Ijin Pekerjaan yang Harus Dilengkapi (Work Permits)
                </div>
                <div className={styles.cardSectionDesc}>Centang seluruh izin permit kerja yang diperlukan</div>
              </div>
            </div>

            <div className={styles.checklistGrid}>
              {PERMIT_DEFINITIONS.map((p) => {
                const checked = selectedPermits.includes(p.code);
                return (
                  <label
                    key={p.code}
                    className={`${styles.checkItem} ${checked ? styles.checkItemSelected : ""}`}
                  >
                    <input
                      type="checkbox"
                      className={styles.checkboxInput}
                      checked={checked}
                      onChange={() => togglePermit(p.code)}
                    />
                    <span className={styles.checkLabel}>{p.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Section 5: Dynamic Table Langkah Kerja (Job Steps) */}
          <div className={styles.card}>
            <div className={styles.cardSectionHeader}>
              <div>
                <div className={styles.cardSectionTitle}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="8" y1="6" x2="21" y2="6" />
                    <line x1="8" y1="12" x2="21" y2="12" />
                    <line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" />
                    <line x1="3" y1="12" x2="3.01" y2="12" />
                    <line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg>
                  5. Urutan Langkah Kerja, Bahaya & Tindakan Pencegahan
                </div>
                <div className={styles.cardSectionDesc}>
                  Tabel identifikasi bahaya dan prosedur pengendalian untuk setiap langkah kerja
                </div>
              </div>

              <button type="button" className={styles.secondaryBtn} onClick={addStep}>
                + Tambah Langkah Kerja
              </button>
            </div>

            <div className={styles.stepsTableWrapper}>
              <table className={styles.stepsTable}>
                <thead>
                  <tr>
                    <th style={{ width: "45px" }}>No</th>
                    <th style={{ width: "240px" }}>Urutan Langkah Kerja</th>
                    <th style={{ width: "70px" }}>No. Bhy</th>
                    <th style={{ width: "260px" }}>Potensi Bahaya (Hazards)</th>
                    <th style={{ width: "70px" }}>No. Tndk</th>
                    <th>Tindakan / Prosedur Rekomendasi</th>
                    <th style={{ width: "65px", textAlign: "center" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {steps.map((step, idx) => (
                    <tr key={idx}>
                      <td className={styles.stepNumCell}>
                        <input
                          type="number"
                          className={styles.smallInput}
                          style={{ textAlign: "center", width: "40px" }}
                          value={step.stepNumber}
                          onChange={(e) => updateStepField(idx, "stepNumber", Number(e.target.value))}
                        />
                      </td>

                      <td>
                        <textarea
                          className={styles.smallInput}
                          style={{ minHeight: "54px" }}
                          value={step.stepDescription}
                          onChange={(e) => updateStepField(idx, "stepDescription", e.target.value)}
                          placeholder="Deskripsi langkah kerja..."
                        />
                      </td>

                      <td>
                        <input
                          type="text"
                          className={styles.smallInput}
                          value={step.hazardNo || ""}
                          onChange={(e) => updateStepField(idx, "hazardNo", e.target.value)}
                          placeholder="1.1"
                        />
                      </td>

                      <td>
                        <textarea
                          className={styles.smallInput}
                          style={{ minHeight: "54px" }}
                          value={step.hazardDescription || ""}
                          onChange={(e) => updateStepField(idx, "hazardDescription", e.target.value)}
                          placeholder="Potensi bahaya..."
                        />
                      </td>

                      <td>
                        <input
                          type="text"
                          className={styles.smallInput}
                          value={step.actionNo || ""}
                          onChange={(e) => updateStepField(idx, "actionNo", e.target.value)}
                          placeholder="1.1.1"
                        />
                      </td>

                      <td>
                        <textarea
                          className={styles.smallInput}
                          style={{ minHeight: "54px" }}
                          value={step.actionDescription || ""}
                          onChange={(e) => updateStepField(idx, "actionDescription", e.target.value)}
                          placeholder="Tindakan pencegahan..."
                        />
                      </td>

                      <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                          <button
                            type="button"
                            className={styles.dangerBtn}
                            onClick={() => removeStep(idx)}
                            title="Hapus baris ini"
                          >
                            ✕
                          </button>
                          <button
                            type="button"
                            className={styles.secondaryBtn}
                            style={{ padding: "0.2rem 0.4rem", fontSize: "0.7rem" }}
                            onClick={() => addSubStep(step.stepNumber)}
                            title="Tambah sub-bahaya untuk langkah ini"
                          >
                            +Sub
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 6: Personil Pekerja Lapangan (Attendance) */}
          <div className={styles.card}>
            <div className={styles.cardSectionHeader}>
              <div>
                <div className={styles.cardSectionTitle}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  6. Personil Pekerja Lapangan (Daftar Hadir & Tanda Tangan)
                </div>
                <div className={styles.cardSectionDesc}>Daftar anggota tim yang akan menandatangani dokumen JSA</div>
              </div>

              <button type="button" className={styles.secondaryBtn} onClick={addWorker}>
                + Tambah Pekerja
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "0.85rem" }}>
              {workers.map((worker, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    background: "rgba(15, 23, 42, 0.6)",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "0.5rem",
                    border: "1px solid rgba(255, 255, 255, 0.08)"
                  }}
                >
                  <span style={{ fontSize: "0.75rem", color: "#fb923c", fontWeight: 700, width: "20px" }}>
                    {idx + 1}.
                  </span>
                  <input
                    type="text"
                    className={styles.smallInput}
                    value={worker.name}
                    onChange={(e) => updateWorker(idx, "name", e.target.value)}
                    placeholder="Nama pekerja"
                  />
                  <input
                    type="text"
                    className={styles.smallInput}
                    style={{ width: "110px" }}
                    value={worker.badgeNumber}
                    onChange={(e) => updateWorker(idx, "badgeNumber", e.target.value)}
                    placeholder="ID / Badge"
                  />
                  <button
                    type="button"
                    className={styles.dangerBtn}
                    onClick={() => removeWorker(idx)}
                    title="Hapus"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Action Row */}
          <div className={styles.actionRow}>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => {
                if (confirm("Reset formulir ke pengaturan awal?")) {
                  fetchNextNumber();
                  setJobTitle("");
                  setLocation("");
                }
              }}
            >
              Reset Formulir
            </button>

            <button type="submit" className={styles.primaryBtn} disabled={submitting}>
              {submitting ? "Menyimpan..." : "Simpan Dokumen JSA"}
            </button>

            <button
              type="button"
              className={styles.primaryBtn}
              style={{ background: "linear-gradient(135deg, #0284c7, #38bdf8)", boxShadow: "0 4px 14px rgba(2, 132, 199, 0.35)" }}
              disabled={submitting}
              onClick={() => handleSubmit(true)}
            >
              Simpan & Download PDF
            </button>
          </div>
        </form>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: HISTORY JSA                                                          */}
      {/* ═════════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "history" && (
        <div className={styles.card}>
          <div className={styles.filterBar}>
            <form onSubmit={handleSearchSubmit} className={styles.searchBox}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Cari berdasarkan No. JSA, judul pekerjaan, lokasi, analis..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </form>

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => fetchHistory(page, searchTerm)}
                disabled={historyLoading}
              >
                {historyLoading ? "Memuat..." : "Refresh"}
              </button>

              <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
                Total: <strong style={{ color: "#ffffff" }}>{historyTotal}</strong> Dokumen
              </span>
            </div>
          </div>

          <div className={styles.stepsTableWrapper}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>No. JSA</th>
                  <th>Tanggal</th>
                  <th>Judul Pekerjaan</th>
                  <th>Lokasi</th>
                  <th>Dianalisis Oleh</th>
                  <th>Supervisor</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {historyLoading && historyList.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>
                      Memuat riwayat formulir JSA...
                    </td>
                  </tr>
                ) : historyList.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>
                      Belum ada riwayat dokumen JSA yang cocok.
                    </td>
                  </tr>
                ) : (
                  historyList.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600, color: "#fb923c" }}>{item.jsaNumber}</td>
                      <td>{item.jsaDate}</td>
                      <td style={{ fontWeight: 500, color: "#f8fafc", maxWidth: "240px" }}>{item.jobTitle}</td>
                      <td>{item.location}</td>
                      <td>{item.analysedBy || "-"}</td>
                      <td>{item.supervisorName || "-"}</td>
                      <td>
                        <span className={styles.statusBadge}>
                          ✓ {item.status === "completed" ? "Selesai" : item.status}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "0.4rem" }}>
                          <button
                            type="button"
                            className={styles.secondaryBtn}
                            style={{ padding: "0.35rem 0.65rem", fontSize: "0.75rem" }}
                            onClick={() => handleViewDetail(item.id)}
                          >
                            Detail
                          </button>

                          <a
                            href={`${API_URL}/ops-telco/jsa/${item.id}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.primaryBtn}
                            style={{ padding: "0.35rem 0.65rem", fontSize: "0.75rem", textDecoration: "none" }}
                          >
                            PDF
                          </a>

                          <button
                            type="button"
                            className={styles.dangerBtn}
                            style={{ padding: "0.35rem 0.55rem" }}
                            onClick={() => handleDelete(item.id)}
                            title="Hapus dokumen"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {historyTotal > 15 && (
            <div className={styles.paginationBar}>
              <span>
                Menampilkan halaman {page} dari {Math.ceil(historyTotal / 15)}
              </span>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  disabled={page <= 1}
                  onClick={() => {
                    const newP = page - 1;
                    setPage(newP);
                    fetchHistory(newP, searchTerm);
                  }}
                >
                  Sebelumnya
                </button>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  disabled={page >= Math.ceil(historyTotal / 15)}
                  onClick={() => {
                    const newP = page + 1;
                    setPage(newP);
                    fetchHistory(newP, searchTerm);
                  }}
                >
                  Selanjutnya
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Detail Modal ─── */}
      {selectedJsa && (
        <div className={styles.modalBackdrop} onClick={() => setSelectedJsa(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#ffffff" }}>
                  Detail JSA: {selectedJsa.jsaNumber}
                </h2>
                <p style={{ fontSize: "0.825rem", color: "#94a3b8" }}>{selectedJsa.jobTitle}</p>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setSelectedJsa(null)}
              >
                ✕
              </button>
            </div>

            <div className={styles.formGrid3}>
              <div>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Lokasi:</span>
                <p style={{ fontWeight: 600 }}>{selectedJsa.location}</p>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Tanggal:</span>
                <p style={{ fontWeight: 600 }}>{selectedJsa.jsaDate}</p>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Tipe / Status:</span>
                <p style={{ fontWeight: 600, textTransform: "capitalize" }}>
                  {selectedJsa.jsaType || "Normal"} ({selectedJsa.status})
                </p>
              </div>
            </div>

            <div className={styles.formGrid3}>
              <div>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Dianalisis Oleh:</span>
                <p style={{ fontWeight: 600 }}>{selectedJsa.analysedBy || "-"}</p>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Supervisor:</span>
                <p style={{ fontWeight: 600 }}>{selectedJsa.supervisorName || "-"}</p>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Approved By:</span>
                <p style={{ fontWeight: 600 }}>{selectedJsa.approvedBy || "Responsible Area"}</p>
              </div>
            </div>

            {/* Steps Preview */}
            <div>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                Langkah Kerja ({selectedJsa.steps?.length || 0} langkah)
              </h3>
              <div className={styles.stepsTableWrapper} style={{ maxHeight: "320px", overflowY: "auto" }}>
                <table className={styles.stepsTable}>
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Langkah Kerja</th>
                      <th>No</th>
                      <th>Potensi Bahaya</th>
                      <th>No</th>
                      <th>Tindakan Rekomendasi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedJsa.steps && selectedJsa.steps.length > 0 ? (
                      selectedJsa.steps.map((s, idx) => (
                        <tr key={idx}>
                          <td className={styles.stepNumCell}>{s.stepNumber}</td>
                          <td>{s.stepDescription}</td>
                          <td style={{ color: "#fb923c", fontWeight: 600 }}>{s.hazardNo}</td>
                          <td>{s.hazardDescription}</td>
                          <td style={{ color: "#38bdf8", fontWeight: 600 }}>{s.actionNo}</td>
                          <td>{s.actionDescription}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", color: "#94a3b8" }}>
                          Tidak ada rincian langkah kerja tercatat.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
              <a
                href={`${API_URL}/ops-telco/jsa/${selectedJsa.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.primaryBtn}
                style={{ textDecoration: "none" }}
              >
                Download PDF Cetak
              </a>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => setSelectedJsa(null)}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
