"use client";

import React, { useEffect, useMemo, useState } from "react";
import { API_URL, api, type PortalUser } from "@/lib/api";
import { SignaturePad } from "./signature-pad";
import styles from "./pto-form-workspace.module.css";

export interface PtoItem {
  no: string | number;
  taskStep: string;
  deviation: string;
  cause: string;
  suggestion: string;
}

export interface PtoRecord {
  id?: number;
  formNumber?: string;
  status?: "draft" | "completed";
  procedureTitle: string;
  department: string;
  observationArea: string;
  date: string;
  time: string;
  workerNotified?: "ya" | "tidak" | boolean;
  peerReview?: string;
  items: PtoItem[];
  observerName?: string;
  observerSignature?: string;
  observedPerson?: string;
  superintendent?: string;
  comments?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface DocumentItem {
  id: string;
  filename: string;
  title: string;
  name?: string;
  subCategory: string;
  subCategoryName?: string;
  category: string;
  categoryName?: string;
  relPath?: string;
  extension?: string;
}

function getDocDisplayTitle(doc: DocumentItem): string {
  if (doc.title && doc.title.trim()) return doc.title.trim();
  if (doc.filename) return doc.filename.replace(/\.[^/.]+$/, "").replace(/_/g, " ").trim();
  if (doc.name && doc.name.trim()) return doc.name.trim();
  return "Dokumen Prosedur";
}

const DEFAULT_DIVISIONS = [
  "Operasional Telekomunikasi",
  "Teknologi Informasi",
  "Human Resources",
  "Direksi / Eksekutif",
  "Civil & Mining Support",
  "HSE & Security"
];

const QUICK_AREAS = [
  "Pit J East Hatari Repeater Site",
  "Pit AB Tower Site",
  "Main Office MKN Sangatta",
  "Bengalon Port Office",
  "KPC Coal Processing Plant (CPP)",
  "Switch Room Telco Sangatta"
];

const IK_FILTER_CATEGORIES = ["Semua", "Telco", "OSP", "PIT", "Bengalon", "Engineer", "Helpdesk", "HSE", "KPC"];

const DEFAULT_SPV_MASTER_SIGNATURE =
  "data:image/png;base64,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";

export function PtoFormWorkspace({ user }: { user: PortalUser }) {
  // Navigation View: "form" vs "history"
  const [activeTab, setActiveTab] = useState<"form" | "history">("form");

  // State: List of PTOs
  const [ptoList, setPtoList] = useState<PtoRecord[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // State: IK Documents for procedure combobox & intelligent search
  const [ikDocuments, setIkDocuments] = useState<DocumentItem[]>([]);
  const [ikLoading, setIkLoading] = useState(false);
  const [selectedIkCategory, setSelectedIkCategory] = useState("Semua");
  const [procedureMode, setProcedureMode] = useState<"ik" | "manual">("ik");
  const [ikSearchTerm, setIkSearchTerm] = useState("");
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const comboboxRef = React.useRef<HTMLDivElement>(null);

  // Close combobox dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (comboboxRef.current && !comboboxRef.current.contains(event.target as Node)) {
        setIsSearchDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // State: History observation areas for autocomplete
  const [historyAreas, setHistoryAreas] = useState<string[]>([]);

  // State: Form values
  const [current, setCurrent] = useState<PtoRecord>({
    procedureTitle: "",
    department: user.division || "Operasional Telekomunikasi",
    observationArea: "",
    date: new Date().toISOString().split("T")[0],
    time: "09:00 - 11:30 WITA",
    workerNotified: "ya",
    peerReview: "Crew A",
    items: [
      {
        no: 1,
        taskStep: "",
        deviation: "",
        cause: "",
        suggestion: ""
      }
    ],
    observerName: "Rahmansyah - Z110997",
    observerSignature: DEFAULT_SPV_MASTER_SIGNATURE,
    observedPerson: "",
    superintendent: "Wanto",
    comments: "",
    status: "draft"
  });

  // State: Signature mode ("master" vs "manual")
  const [sigMode, setSigMode] = useState<"master" | "manual">("master");

  // State: UI feedback & modals
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [flash, setFlash] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);

  // Load IK & SOP documents
  useEffect(() => {
    async function loadIkDocs() {
      setIkLoading(true);
      try {
        const res = await api<{ data: DocumentItem[] }>("/ik-sop/documents");
        if (Array.isArray(res.data)) {
          setIkDocuments(res.data);
        }
      } catch (err) {
        console.error("Gagal memuat dokumen IK & SOP", err);
      } finally {
        setIkLoading(false);
      }
    }
    loadIkDocs();
  }, []);

  // Filtered & Searched IK Documents (Search-as-you-type across title, filename, and subcategory)
  const searchedIkDocs = useMemo(() => {
    let list = ikDocuments;

    // Filter by Category if not "Semua"
    if (selectedIkCategory !== "Semua") {
      if (selectedIkCategory === "KPC") {
        list = list.filter((d) => d.category === "prosedur-kpc");
      } else {
        list = list.filter(
          (d) =>
            (d.subCategory && d.subCategory.toLowerCase() === selectedIkCategory.toLowerCase()) ||
            (d.subCategoryName && d.subCategoryName.toLowerCase() === selectedIkCategory.toLowerCase())
        );
      }
    }

    // Deduplicate documents with the exact same subCategory and title, prioritizing PDF
    const uniqueDocsMap = new Map<string, DocumentItem>();
    for (const doc of list) {
      const title = getDocDisplayTitle(doc);
      const key = `${doc.subCategory || doc.category}_${title.toLowerCase()}`;
      const existing = uniqueDocsMap.get(key);
      if (!existing) {
        uniqueDocsMap.set(key, doc);
      } else if (doc.filename && doc.filename.toLowerCase().endsWith(".pdf")) {
        uniqueDocsMap.set(key, doc);
      }
    }
    const dedupedList = Array.from(uniqueDocsMap.values());

    const q = ikSearchTerm.trim().toLowerCase();
    if (!q) {
      return dedupedList.slice(0, 60);
    }

    // Split search terms for multi-word search, agnostic of hyphens and underscores
    const terms = q.replace(/[-_]/g, " ").split(/\s+/).filter(Boolean);

    return dedupedList
      .filter((doc) => {
        const titleNorm = getDocDisplayTitle(doc).toLowerCase().replace(/[-_]/g, " ");
        const fileNorm = (doc.filename || "").toLowerCase().replace(/[-_]/g, " ");
        const subNorm = (doc.subCategoryName || doc.subCategory || "").toLowerCase();
        const combined = `${titleNorm} ${fileNorm} ${subNorm}`;

        return terms.every((t) => combined.includes(t));
      })
      .slice(0, 60);
  }, [ikDocuments, selectedIkCategory, ikSearchTerm]);

  // Load history observation areas
  useEffect(() => {
    async function loadHistoryAreas() {
      try {
        const res = await api<{ data: string[] }>("/ops-telco/pto/history-areas");
        if (Array.isArray(res.data)) {
          setHistoryAreas(res.data);
        }
      } catch (err) {
        console.error("Gagal memuat riwayat area observasi", err);
      }
    }
    loadHistoryAreas();
  }, []);

  // Load list of PTOs
  const fetchPtoList = async () => {
    setListLoading(true);
    try {
      const res = await api<{ data: PtoRecord[] }>("/ops-telco/pto");
      if (Array.isArray(res.data)) {
        setPtoList(res.data);
      }
    } catch (err: any) {
      console.error("Gagal memuat daftar form PTO", err);
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    fetchPtoList();
  }, []);

  // Filtered PTO list
  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return ptoList;
    const q = searchQuery.toLowerCase();
    return ptoList.filter(
      (p) =>
        (p.formNumber && p.formNumber.toLowerCase().includes(q)) ||
        (p.procedureTitle && p.procedureTitle.toLowerCase().includes(q)) ||
        (p.observationArea && p.observationArea.toLowerCase().includes(q))
    );
  }, [ptoList, searchQuery]);

  // Handle select PTO from history or dropdown
  const handleSelectPto = async (id: number) => {
    setSelectedId(id);
    setFlash(null);
    try {
      const res = await api<{ data: PtoRecord }>(`/ops-telco/pto/${id}`);
      if (res.data) {
        setCurrent(res.data);
        setIkSearchTerm(res.data.procedureTitle || "");
        setActiveTab("form");
        if (res.data.observerSignature && res.data.observerSignature !== DEFAULT_SPV_MASTER_SIGNATURE) {
          setSigMode("manual");
        } else {
          setSigMode("master");
        }
      }
    } catch (err: any) {
      setFlash({ type: "err", msg: err?.message || "Gagal memuat detail form PTO." });
    }
  };

  // Handle Reset / New Form
  const handleNewPto = () => {
    setSelectedId(null);
    setFlash(null);
    setActiveTab("form");
    setSigMode("master");
    setProcedureMode("ik");
    setIkSearchTerm("");
    setCurrent({
      procedureTitle: "",
      department: user.division || "Operasional Telekomunikasi",
      observationArea: "",
      date: new Date().toISOString().split("T")[0],
      time: "09:00 - 11:30 WITA",
      workerNotified: "ya",
      peerReview: "Crew A",
      items: [
        {
          no: 1,
          taskStep: "",
          deviation: "",
          cause: "",
          suggestion: ""
        }
      ],
      observerName: "Rahmansyah - Z110997",
      observerSignature: DEFAULT_SPV_MASTER_SIGNATURE,
      observedPerson: "",
      superintendent: "Wanto",
      comments: "",
      status: "draft"
    });
  };

  // Handle row addition/removal (max 7 rows)
  const handleAddItem = () => {
    if (current.items.length >= 7) {
      setFlash({ type: "err", msg: "Maksimal 7 baris observasi sesuai format template master FM-HSE-10-43." });
      return;
    }
    const nextNo = current.items.length + 1;
    setCurrent((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          no: nextNo,
          taskStep: "",
          deviation: "",
          cause: "",
          suggestion: ""
        }
      ]
    }));
  };

  const handleRemoveItem = (index: number) => {
    if (current.items.length <= 1) {
      setFlash({ type: "err", msg: "Minimal harus ada 1 baris observasi." });
      return;
    }
    const updated = current.items.filter((_, i) => i !== index).map((it, idx) => ({ ...it, no: idx + 1 }));
    setCurrent((prev) => ({ ...prev, items: updated }));
  };

  const handleItemChange = (index: number, field: keyof PtoItem, val: string) => {
    const updated = [...current.items];
    updated[index] = { ...updated[index], [field]: val };
    setCurrent((prev) => ({ ...prev, items: updated }));
  };

  // Save PTO
  const handleSave = async (status: "draft" | "completed") => {
    setSaving(true);
    setFlash(null);

    if (!current.procedureTitle.trim()) {
      setFlash({ type: "err", msg: "Judul prosedur wajib diisi atau dipilih dari portal IK & SOP." });
      setSaving(false);
      return;
    }
    if (!current.observationArea.trim()) {
      setFlash({ type: "err", msg: "Area observasi wajib diisi." });
      setSaving(false);
      return;
    }
    if (!current.date) {
      setFlash({ type: "err", msg: "Tanggal observasi wajib dipilih." });
      setSaving(false);
      return;
    }

    const payload = {
      ...current,
      status,
      observerName: "Rahmansyah - Z110997",
      observerSignature:
        sigMode === "master" ? DEFAULT_SPV_MASTER_SIGNATURE : current.observerSignature || DEFAULT_SPV_MASTER_SIGNATURE,
      observedPerson: "",
      superintendent: "Wanto"
    };

    try {
      let savedRecord: PtoRecord;
      if (selectedId) {
        const res = await api<{ message: string; data: PtoRecord }>(`/ops-telco/pto/${selectedId}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        savedRecord = res.data;
        setFlash({ type: "ok", msg: res.message || "Form PTO berhasil diperbarui." });
      } else {
        const res = await api<{ message: string; data: PtoRecord }>("/ops-telco/pto", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        savedRecord = res.data;
        setSelectedId(savedRecord.id!);
        setFlash({ type: "ok", msg: res.message || "Form PTO berhasil dibuat." });
      }

      setCurrent(savedRecord);
      await fetchPtoList();

      const areasRes = await api<{ data: string[] }>("/ops-telco/pto/history-areas");
      if (Array.isArray(areasRes.data)) setHistoryAreas(areasRes.data);

      if (status === "completed" && savedRecord.id) {
        handleOpenPreview(savedRecord.id);
      }
    } catch (err: any) {
      setFlash({ type: "err", msg: err?.message || "Gagal menyimpan form PTO." });
    } finally {
      setSaving(false);
    }
  };

  // Delete PTO
  const handleDelete = async (idToDelete?: number) => {
    const targetId = idToDelete || selectedId;
    if (!targetId) return;
    if (!confirm("Hapus dokumen PTO ini? Tindakan ini tidak dapat dibatalkan.")) return;

    setDeleting(true);
    try {
      await api(`/ops-telco/pto/${targetId}`, { method: "DELETE" });
      setFlash({ type: "ok", msg: "Form PTO berhasil dihapus." });
      if (selectedId === targetId) {
        handleNewPto();
      }
      await fetchPtoList();
    } catch (err: any) {
      setFlash({ type: "err", msg: err?.message || "Gagal menghapus form PTO." });
    } finally {
      setDeleting(false);
    }
  };

  // Download PDF
  const handleDownloadPdf = (id?: number) => {
    const targetId = id || selectedId;
    if (!targetId) return;
    const url = `${API_URL}/ops-telco/pto/${targetId}/pdf`;
    window.open(url, "_blank");
  };

  // Preview Modal
  const handleOpenPreview = (id?: number) => {
    const targetId = id || selectedId;
    if (!targetId) return;
    setPreviewPdfUrl(`${API_URL}/ops-telco/pto/${targetId}/pdf?t=${Date.now()}`);
  };

  // Count lines of comments
  const commentLineCount = useMemo(() => {
    if (!current.comments?.trim()) return 0;
    return current.comments.trim().split(/\r?\n/).length;
  }, [current.comments]);

  return (
    <div className={styles.container}>
      {/* ── TOP NAVIGATION BAR (Mode Tabs + Quick Switcher) ── */}
      <div className={styles.navModeBar}>
        <div className={styles.modeTabs}>
          <button
            type="button"
            className={`${styles.modeTabBtn} ${activeTab === "form" ? styles.modeTabBtnActive : ""}`}
            onClick={() => setActiveTab("form")}
          >
            <span>📝</span>
            <span>Formulir Input PTO</span>
          </button>
          <button
            type="button"
            className={`${styles.modeTabBtn} ${activeTab === "history" ? styles.modeTabBtnActive : ""}`}
            onClick={() => setActiveTab("history")}
          >
            <span>📋</span>
            <span>Riwayat Dokumen</span>
            <span className={styles.modeTabBadge}>{ptoList.length}</span>
          </button>
        </div>

        {/* Quick Document Switcher */}
        {ptoList.length > 0 && (
          <div className={styles.quickDocSelector}>
            <label className={styles.quickDocLabel}>Buka Cepat Dokumen:</label>
            <select
              className={styles.quickDocSelect}
              value={selectedId || ""}
              onChange={(e) => {
                if (e.target.value) handleSelectPto(Number(e.target.value));
                else handleNewPto();
              }}
            >
              <option value="">＋ Buat Form PTO Baru</option>
              {ptoList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.formNumber} — {p.observationArea || "Area"} ({p.date})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── TAB 1: FORMULIR INPUT (FULL WIDTH, TIDAK TERHIMPIT SIDEBAR) ── */}
      {activeTab === "form" && (
        <>
          {/* Hero Banner */}
          <div className={styles.heroBanner}>
            <div className={styles.heroContent}>
              <span className={styles.heroBadge}>HSE Standard Operational Form</span>
              <h2>Plan Task Observation (PTO)</h2>
              <p>
                <span>📄 Formulir Master FM-HSE-10-43 Rev 1</span>
                <span>•</span>
                <span>🏢 KPC / MKN Telco Operations</span>
              </p>
            </div>
            {current.formNumber ? (
              <div className={styles.heroDocBox}>
                <small>Nomor Dokumen</small>
                <strong>{current.formNumber}</strong>
              </div>
            ) : (
              <div className={styles.heroDocBox} style={{ background: "rgba(2, 132, 199, 0.25)" }}>
                <small>Status Pembuatan</small>
                <strong style={{ color: "#ffffff" }}>DRAF BARU</strong>
              </div>
            )}
          </div>

          {/* Action Toolbar */}
          <div className={styles.actionBar}>
            <div className={styles.actionGroup}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={handleNewPto}
                disabled={saving}
              >
                <span>＋</span> PTO Baru
              </button>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => handleSave("draft")}
                disabled={saving}
              >
                <span>💾</span> {saving ? "Menyimpan..." : "Simpan Draf"}
              </button>
              <button
                type="button"
                className={styles.btnSuccess}
                onClick={() => handleSave("completed")}
                disabled={saving}
              >
                <span>🚀</span> Simpan &amp; Rilis
              </button>
            </div>

            <div className={styles.actionGroup}>
              {selectedId && (
                <>
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    onClick={() => handleOpenPreview()}
                  >
                    <span>👁️</span> Pratinjau PDF
                  </button>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => handleDownloadPdf()}
                  >
                    <span>📥</span> Unduh PDF
                  </button>
                  <button
                    type="button"
                    className={styles.btnDanger}
                    onClick={() => handleDelete()}
                    disabled={deleting}
                  >
                    <span>🗑️</span> Hapus
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Feedback Alert */}
          {flash && (
            <div className={`${styles.flashMessage} ${flash.type === "ok" ? styles.flashOk : styles.flashErr}`}>
              <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {flash.type === "ok" ? "✅" : "⚠️"} {flash.msg}
              </span>
              <button
                type="button"
                onClick={() => setFlash(null)}
                style={{ background: "none", border: "none", cursor: "pointer", fontWeight: "bold", fontSize: "16px" }}
              >
                ✕
              </button>
            </div>
          )}

          {/* SECTION 1: Identitas & Prosedur Tugas (Rapi 50% / 50% Sejajar) */}
          <div className={styles.sectionCard}>
            <div className={styles.sectionTitleRow}>
              <div className={styles.sectionTitleGroup}>
                <div className={`${styles.sectionIcon} ${styles.iconBlue}`}>📋</div>
                <div>
                  <h3>1. Data Master &amp; Prosedur Tugas</h3>
                  <p>Identifikasi prosedur kerja standar, divisi penanggung jawab, dan lokasi pelaksanaan</p>
                </div>
              </div>
              {current.status && (
                <span
                  className={current.status === "completed" ? styles.statusPillCompleted : styles.statusPillDraft}
                >
                  {current.status === "completed" ? "Selesai / Rilis" : "Draf"}
                </span>
              )}
            </div>

            {/* Row 1: Judul Prosedur (Full Width) */}
            <div className={styles.field} style={{ marginBottom: "20px" }}>
              <div className={styles.procToggleBar}>
                <label className={styles.fieldLabel}>
                  <span>Judul Prosedur / Procedure Title <span className={styles.required}>*</span></span>
                </label>

                <div className={styles.toggleSwitch}>
                  <button
                    type="button"
                    className={`${styles.toggleBtn} ${procedureMode === "ik" ? styles.toggleBtnActive : ""}`}
                    onClick={() => setProcedureMode("ik")}
                  >
                    📁 Portal IK &amp; SOP ({ikDocuments.length})
                  </button>
                  <button
                    type="button"
                    className={`${styles.toggleBtn} ${procedureMode === "manual" ? styles.toggleBtnActive : ""}`}
                    onClick={() => setProcedureMode("manual")}
                  >
                    ✏️ Tulis Manual
                  </button>
                </div>
              </div>

              {procedureMode === "ik" ? (
                <div>
                  {/* Category Pills Filter */}
                  <div className={styles.catFilterRow}>
                    <span className={styles.catFilterLabel}>Kategori:</span>
                    {IK_FILTER_CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        className={`${styles.catPill} ${selectedIkCategory === cat ? styles.catPillActive : ""}`}
                        onClick={() => {
                          setSelectedIkCategory(cat);
                          setIsSearchDropdownOpen(true);
                        }}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  {/* Search-as-you-type Combobox */}
                  <div className={styles.comboboxWrapper} ref={comboboxRef}>
                    <div className={styles.comboboxInputWrapper}>
                      <span className={styles.comboboxSearchIcon}>🔍</span>
                      <input
                        type="text"
                        className={styles.comboboxInput}
                        placeholder="Ketik pencarian judul dokumen / nomor IK (contoh: CCTV, Monopoli, IK-OPS-05-47, Radio)..."
                        value={ikSearchTerm}
                        onChange={(e) => {
                          setIkSearchTerm(e.target.value);
                          setIsSearchDropdownOpen(true);
                        }}
                        onFocus={() => setIsSearchDropdownOpen(true)}
                      />
                      {ikSearchTerm && (
                        <button
                          type="button"
                          className={styles.comboboxClearBtn}
                          onClick={() => {
                            setIkSearchTerm("");
                            setCurrent((prev) => ({ ...prev, procedureTitle: "" }));
                            setIsSearchDropdownOpen(true);
                          }}
                          title="Hapus pencarian"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Autocomplete Dropdown List */}
                    {isSearchDropdownOpen && (
                      <div className={styles.comboboxDropdown}>
                        <div className={styles.comboboxHeader}>
                          <span>
                            {searchedIkDocs.length} Dokumen Cocok
                            {selectedIkCategory !== "Semua" ? ` (${selectedIkCategory})` : " (Semua Kategori)"}
                          </span>
                          <span style={{ fontSize: "10px", color: "#94a3b8" }}>
                            {ikLoading ? "Memuat..." : "Pilih untuk menggunakan"}
                          </span>
                        </div>

                        {ikLoading ? (
                          <div className={styles.comboboxEmpty}>Memuat daftar dokumen IK &amp; SOP...</div>
                        ) : searchedIkDocs.length === 0 ? (
                          <div className={styles.comboboxEmpty}>
                            <p style={{ margin: "0 0 6px", fontWeight: 700, color: "#334155" }}>
                              Tidak ditemukan dokumen IK yang cocok dengan &quot;{ikSearchTerm}&quot;
                            </p>
                            <span style={{ fontSize: "11px", color: "#64748b" }}>
                              Coba kata kunci yang lebih pendek atau beralih ke tombol &quot;Tulis Manual&quot;.
                            </span>
                          </div>
                        ) : (
                          <div className={styles.comboboxList}>
                            {searchedIkDocs.map((doc) => {
                              const docTitle = getDocDisplayTitle(doc);
                              const isSelected = current.procedureTitle === docTitle;
                              return (
                                <button
                                  key={doc.id}
                                  type="button"
                                  className={`${styles.comboboxItem} ${isSelected ? styles.comboboxItemActive : ""}`}
                                  onClick={() => {
                                    setCurrent((prev) => ({ ...prev, procedureTitle: docTitle }));
                                    setIkSearchTerm(docTitle);
                                    setIsSearchDropdownOpen(false);
                                  }}
                                >
                                  <div className={styles.comboboxItemMain}>
                                    <span className={styles.comboboxItemTitle}>
                                      {docTitle}
                                    </span>
                                    <span className={styles.comboboxItemFilename}>
                                      📄 {doc.filename}
                                    </span>
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    <span className={styles.comboboxItemBadge}>
                                      {doc.subCategory?.toUpperCase() || doc.category?.toUpperCase()}
                                    </span>
                                    {isSelected && (
                                      <span style={{ color: "#16a34a", fontWeight: 800, fontSize: "14px" }}>
                                        ✓
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Selected Document Notification Banner */}
                  {current.procedureTitle && (
                    <div className={styles.selectedDocBanner}>
                      <div className={styles.selectedDocBannerText}>
                        <strong>✓ Dokumen Prosedur Terpilih:</strong>
                        <span>{current.procedureTitle}</span>
                      </div>
                      <button
                        type="button"
                        className={styles.selectedDocClearBtn}
                        onClick={() => {
                          setCurrent((prev) => ({ ...prev, procedureTitle: "" }));
                          setIkSearchTerm("");
                          setIsSearchDropdownOpen(true);
                        }}
                      >
                        ✕ Ganti / Cari Ulang
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Ketik judul prosedur manual (contoh: IK-OPS-05-47 Perbaikan CCTV Di Tiang Monopoli)"
                  value={current.procedureTitle}
                  onChange={(e) => setCurrent((prev) => ({ ...prev, procedureTitle: e.target.value }))}
                />
              )}
            </div>

            {/* Row 2: Departemen & Area Observasi (SEJAJAR 50% / 50%) */}
            <div className={styles.formRow2}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>
                  <span>Departemen / Divisi <span className={styles.required}>*</span></span>
                </label>
                <select
                  className={styles.select}
                  value={current.department}
                  onChange={(e) => setCurrent((prev) => ({ ...prev, department: e.target.value }))}
                >
                  {DEFAULT_DIVISIONS.map((div) => (
                    <option key={div} value={div}>
                      {div}
                    </option>
                  ))}
                </select>
                <div className={styles.fieldHint}>
                  <span>🏢 Divisi penanggung jawab operasional pekerjaan</span>
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>
                  <span>Area Observasi / Observation Area <span className={styles.required}>*</span></span>
                </label>
                <input
                  type="text"
                  list="pto-history-areas"
                  className={styles.input}
                  placeholder="Ketik atau pilih area (misal: Pit J East Hatari)"
                  value={current.observationArea}
                  onChange={(e) => setCurrent((prev) => ({ ...prev, observationArea: e.target.value }))}
                />
                <datalist id="pto-history-areas">
                  {historyAreas.map((area, idx) => (
                    <option key={idx} value={area} />
                  ))}
                </datalist>

                {/* Quick Area Suggestion Chips */}
                <div className={styles.chipsRow}>
                  <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>Saran Cepat:</span>
                  {QUICK_AREAS.slice(0, 3).map((area, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={styles.chip}
                      onClick={() => setCurrent((prev) => ({ ...prev, observationArea: area }))}
                    >
                      {area.split(" ")[0]} {area.split(" ")[1]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Row 3: Tanggal & Waktu (SEJAJAR 50% / 50%) */}
            <div className={styles.formRow2}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>
                  <span>Tanggal Pelaksanaan Observasi <span className={styles.required}>*</span></span>
                </label>
                <input
                  type="date"
                  className={styles.input}
                  value={current.date}
                  onChange={(e) => setCurrent((prev) => ({ ...prev, date: e.target.value }))}
                />
                <div className={styles.fieldHint}>
                  <span>📅 Format standar: Tanggal/Bulan/Tahun</span>
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>
                  <span>Waktu Pelaksanaan (Jam / WITA)</span>
                </label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Contoh: 09:30 - 11:45 WITA"
                  value={current.time}
                  onChange={(e) => setCurrent((prev) => ({ ...prev, time: e.target.value }))}
                />
                <div className={styles.fieldHint}>
                  <span>⏰ Rentang jam pengamatan di lapangan</span>
                </div>
              </div>
            </div>

            {/* Row 4: Pemberitahuan Pekerja & PTO Pembanding (SEJAJAR 50% / 50%) */}
            <div className={styles.formRow2} style={{ marginBottom: 0 }}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>
                  <span>Pekerja Diberitahu Sebelumnya? (Notified in Advance) <span className={styles.required}>*</span></span>
                </label>
                <div className={styles.optionCardsGrid}>
                  <div
                    className={`${styles.optionCard} ${
                      current.workerNotified === "ya" || current.workerNotified === true ? styles.optionCardActive : ""
                    }`}
                    onClick={() => setCurrent((prev) => ({ ...prev, workerNotified: "ya" }))}
                  >
                    <div className={styles.optionCircle} />
                    <div className={styles.optionText}>
                      <strong>Ya, Diberitahu</strong>
                      <span>Observasi terencana</span>
                    </div>
                  </div>

                  <div
                    className={`${styles.optionCard} ${
                      current.workerNotified === "tidak" || current.workerNotified === false ? styles.optionCardActive : ""
                    }`}
                    onClick={() => setCurrent((prev) => ({ ...prev, workerNotified: "tidak" }))}
                  >
                    <div className={styles.optionCircle} />
                    <div className={styles.optionText}>
                      <strong>Tidak Diberitahu</strong>
                      <span>Observasi acak / mendadak</span>
                    </div>
                  </div>
                </div>
                <div className={styles.fieldHint}>
                  <span>🎯 Status observasi terencana atau inspeksi mendadak</span>
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>
                  <span>PTO Pembanding / Peer Review</span>
                </label>
                <select
                  className={styles.select}
                  value={current.peerReview || ""}
                  onChange={(e) => setCurrent((prev) => ({ ...prev, peerReview: e.target.value }))}
                >
                  <option value="Crew A">Crew A (Tim Shift A)</option>
                  <option value="Crew B">Crew B (Tim Shift B)</option>
                  <option value="Crew C">Crew C (Tim Shift C)</option>
                  <option value="Supervisor Telco">Supervisor Telco</option>
                  <option value="HSE Officer">HSE Officer KPC</option>
                  <option value="">Tidak Ada (None)</option>
                </select>
                <div className={styles.fieldHint}>
                  <span>👥 Personel rekan pembanding atau peer review</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: Tabel Observasi Tugas Terencana (FULL LEBAR) */}
          <div className={styles.sectionCard}>
            <div className={styles.sectionTitleRow}>
              <div className={styles.sectionTitleGroup}>
                <div className={`${styles.sectionIcon} ${styles.iconAmber}`}>🔍</div>
                <div>
                  <h3>2. Uraian Tugas &amp; Penyimpangan Observasi</h3>
                  <p>Tabel pencatatan tahapan tugas, deviasi temuan di lapangan, akar penyebab, dan rekomendasi perbaikan</p>
                </div>
              </div>

              <button
                type="button"
                className={styles.btnSecondary}
                onClick={handleAddItem}
                disabled={current.items.length >= 7}
                style={{ fontSize: "12.5px" }}
              >
                <span>＋</span> Tambah Baris ({current.items.length}/7)
              </button>
            </div>

            <div className={styles.tableContainer}>
              <table className={styles.obsTable}>
                <thead>
                  <tr>
                    <th style={{ width: "42px", textAlign: "center" }}>No</th>
                    <th style={{ width: "26%" }}>📝 Uraian Tugas / Tahapan *</th>
                    <th style={{ width: "24%" }}>⚠️ Penyimpangan Observasi</th>
                    <th style={{ width: "23%" }}>❓ Penyebab Masalah</th>
                    <th style={{ width: "25%" }}>💡 Saran Perbaikan / Peningkatan</th>
                    <th style={{ width: "40px", textAlign: "center" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {current.items.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ verticalAlign: "middle" }}>
                        <div className={styles.rowBadge}>{idx + 1}</div>
                      </td>
                      <td>
                        <textarea
                          rows={2}
                          placeholder="Uraian langkah kerja yang diamati..."
                          value={item.taskStep}
                          onChange={(e) => handleItemChange(idx, "taskStep", e.target.value)}
                        />
                      </td>
                      <td>
                        <textarea
                          rows={2}
                          placeholder="Temuan penyimpangan atau kondisi tidak aman..."
                          value={item.deviation}
                          onChange={(e) => handleItemChange(idx, "deviation", e.target.value)}
                        />
                      </td>
                      <td>
                        <textarea
                          rows={2}
                          placeholder="Penyebab terjadinya deviasi..."
                          value={item.cause}
                          onChange={(e) => handleItemChange(idx, "cause", e.target.value)}
                        />
                      </td>
                      <td>
                        <textarea
                          rows={2}
                          placeholder="Rekomendasi koreksi/pencegahan..."
                          value={item.suggestion}
                          onChange={(e) => handleItemChange(idx, "suggestion", e.target.value)}
                        />
                      </td>
                      <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                        <button
                          type="button"
                          className={styles.deleteBtn}
                          onClick={() => handleRemoveItem(idx)}
                          title="Hapus baris"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.tableNotice}>
              <span>
                ℹ️ <strong>Ketentuan Master FM-HSE-10-43:</strong> Hanya isikan tugas/tahapan bila ditemukan penyimpangan, peluang perbaikan, atau tindakan tidak aman.
              </span>
              <span style={{ fontWeight: 700, color: "#0284c7" }}>
                Kapasitas: {current.items.length} dari 7 baris terisi
              </span>
            </div>
          </div>

          {/* SECTION 3: Otorisasi & Tanda Tangan (3 Kolom Sejajar & Simetris) */}
          <div className={styles.sectionCard}>
            <div className={styles.sectionTitleRow}>
              <div className={styles.sectionTitleGroup}>
                <div className={`${styles.sectionIcon} ${styles.iconEmerald}`}>✍️</div>
                <div>
                  <h3>3. Otorisasi &amp; Tanda Tangan</h3>
                  <p>Verifikasi pengamat tugas, pekerja lapangan, dan pengawas penanggung jawab</p>
                </div>
              </div>
            </div>

            <div className={styles.authGrid3}>
              {/* Kolom 1: Yang Mengobservasi (Supervisor) */}
              <div className={styles.authCard}>
                <div className={styles.authHeader}>
                  <div className={`${styles.authAvatar} ${styles.avatarSpv}`}>RS</div>
                  <div className={styles.authMeta}>
                    <strong>Yang Mengobservasi</strong>
                    <span style={{ color: "#0284c7", fontWeight: 700 }}>Rahmansyah - Z110997</span>
                  </div>
                </div>

                {/* Mode Tabs */}
                <div className={styles.toggleSwitch} style={{ width: "100%", justifyContent: "center" }}>
                  <button
                    type="button"
                    className={`${styles.toggleBtn} ${sigMode === "master" ? styles.toggleBtnActive : ""}`}
                    style={{ flex: 1 }}
                    onClick={() => {
                      setSigMode("master");
                      setCurrent((prev) => ({ ...prev, observerSignature: DEFAULT_SPV_MASTER_SIGNATURE }));
                    }}
                  >
                    ✓ TTD Tersimpan
                  </button>
                  <button
                    type="button"
                    className={`${styles.toggleBtn} ${sigMode === "manual" ? styles.toggleBtnActive : ""}`}
                    style={{ flex: 1 }}
                    onClick={() => setSigMode("manual")}
                  >
                    ✍️ Buat TTD Baru
                  </button>
                </div>

                {sigMode === "master" ? (
                  <div>
                    <div className={styles.sigPreviewBox}>
                      <img src={DEFAULT_SPV_MASTER_SIGNATURE} alt="Tanda Tangan Supervisor" />
                      <span className={styles.sealBadge}>Baku Aktif</span>
                    </div>
                    <span style={{ fontSize: "11px", color: "#16a34a", fontWeight: 600, display: "block", marginTop: "4px" }}>
                      ✓ Tanda tangan baku tersimpan aktif
                    </span>
                  </div>
                ) : (
                  <div>
                    {current.observerSignature && current.observerSignature !== DEFAULT_SPV_MASTER_SIGNATURE ? (
                      <div>
                        <div className={styles.sigPreviewBox}>
                          <img src={current.observerSignature} alt="Tanda Tangan Kustom" />
                          <span className={styles.sealBadge} style={{ background: "#e0f2fe", color: "#0369a1", borderColor: "#bae6fd" }}>
                            TTD Baru
                          </span>
                        </div>
                        <button
                          type="button"
                          className={styles.btnSecondary}
                          style={{ fontSize: "11.5px", padding: "5px 8px", width: "100%", marginTop: "6px" }}
                          onClick={() => setCurrent((prev) => ({ ...prev, observerSignature: "" }))}
                        >
                          ✏️ Gores Ulang Tanda Tangan
                        </button>
                      </div>
                    ) : (
                      <SignaturePad
                        onSave={(dataUrl) => {
                          setCurrent((prev) => ({ ...prev, observerSignature: dataUrl }));
                        }}
                        title="Gores Tanda Tangan Supervisor"
                        subtitle="Tanda tangani di dalam kotak"
                        submitLabel="Gunakan TTD Ini"
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Kolom 2: Yang Diobservasi (Pekerja) */}
              <div className={styles.authCard} style={{ background: "#fbfcfe" }}>
                <div className={styles.authHeader}>
                  <div className={`${styles.authAvatar} ${styles.avatarObserved}`}>👤</div>
                  <div className={styles.authMeta}>
                    <strong>Yang Diobservasi</strong>
                    <span>Pekerja Lapangan</span>
                  </div>
                </div>

                <div style={{ marginTop: "auto", marginBottom: "auto", padding: "20px 14px", background: "#f1f5f9", borderRadius: "8px", textAlign: "center" }}>
                  <span style={{ display: "block", fontSize: "13px", fontWeight: 750, color: "#64748b" }}>
                    [ KOSONG ]
                  </span>
                  <span style={{ display: "block", fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>
                    Dikosongkan sesuai instruksi formulir
                  </span>
                </div>
              </div>

              {/* Kolom 3: Superintendent */}
              <div className={styles.authCard} style={{ background: "#fbfcfe" }}>
                <div className={styles.authHeader}>
                  <div className={`${styles.authAvatar} ${styles.avatarSupt}`}>WT</div>
                  <div className={styles.authMeta}>
                    <strong>Superintendent</strong>
                    <span style={{ color: "#16a34a", fontWeight: 700 }}>Wanto</span>
                  </div>
                </div>

                <div style={{ marginTop: "auto", marginBottom: "auto", padding: "20px 14px", background: "#f0fdf4", borderRadius: "8px", textAlign: "center", border: "1px solid #bbf7d0" }}>
                  <span style={{ display: "block", fontSize: "13px", fontWeight: 750, color: "#15803d" }}>
                    ✓ Terotorisasi
                  </span>
                  <span style={{ display: "block", fontSize: "11px", color: "#16a34a", marginTop: "4px" }}>
                    Nama superintendent terisi otomatis
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 4: Catatan & Komentar Observasi (Full Lebar Bergaris) */}
          <div className={styles.sectionCard}>
            <div className={styles.sectionTitleRow}>
              <div className={styles.sectionTitleGroup}>
                <div className={`${styles.sectionIcon} ${styles.iconIndigo}`}>💬</div>
                <div>
                  <h3>4. Catatan &amp; Komentar Observasi</h3>
                  <p>Teks otomatis dicetak berbaris rapi tepat di atas 6 garis formulir master PDF</p>
                </div>
              </div>

              <span style={{ fontSize: "12px", fontWeight: 700, color: commentLineCount > 6 ? "#ef4444" : "#0284c7" }}>
                {commentLineCount}/6 baris komentar
              </span>
            </div>

            <div>
              <textarea
                rows={5}
                className={styles.commentsTextarea}
                placeholder="Tuliskan catatan, evaluasi keselamatan, atau rekomendasi observasi tugas di sini..."
                value={current.comments}
                onChange={(e) => setCurrent((prev) => ({ ...prev, comments: e.target.value }))}
              />
              <div className={styles.commentsHelper}>
                <span>ℹ️ Pola garis buku membantu visualisasi teks yang akan dicetak di atas 6 garis formulir PDF master.</span>
                <span>Font PDF: Helvetica 7.5pt</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── TAB 2: RIWAYAT DOKUMEN PTO (TABEL LENGKAP & LEBAR) ── */}
      {activeTab === "history" && (
        <section className={styles.historyView} aria-label="Tabel Riwayat PTO">
          <div className={styles.historyToolbar}>
            <div>
              <h3 style={{ margin: "0 0 4px", fontSize: "17px", fontWeight: 800, color: "#0f172a" }}>
                Riwayat Seluruh Dokumen PTO ({filteredList.length})
              </h3>
              <p style={{ margin: 0, fontSize: "12.5px", color: "#64748b" }}>
                Daftar lengkap formulir observasi tugas terencana yang telah dibuat di sistem
              </p>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <input
                type="text"
                className={styles.historySearchInput}
                placeholder="🔍 Cari nomor, judul prosedur, atau area..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={handleNewPto}
              >
                <span>＋</span> Buat PTO Baru
              </button>
            </div>
          </div>

          {listLoading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
              Memuat daftar riwayat dokumen PTO...
            </div>
          ) : filteredList.length === 0 ? (
            <div style={{ padding: "50px", textAlign: "center", color: "#94a3b8" }}>
              Belum ada formulir PTO yang ditemukan.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className={styles.historyTable}>
                <thead>
                  <tr>
                    <th style={{ width: "160px" }}>Nomor Dokumen</th>
                    <th>Judul Prosedur</th>
                    <th style={{ width: "180px" }}>Area Observasi</th>
                    <th style={{ width: "110px" }}>Tanggal</th>
                    <th style={{ width: "90px", textAlign: "center" }}>Status</th>
                    <th style={{ width: "200px", textAlign: "center" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredList.map((pto) => (
                    <tr key={pto.id}>
                      <td style={{ fontWeight: 800, color: "#0284c7", fontFamily: "monospace" }}>
                        {pto.formNumber}
                      </td>
                      <td style={{ fontWeight: 600, color: "#1e293b" }}>
                        {pto.procedureTitle || "Tanpa Judul"}
                      </td>
                      <td style={{ color: "#475569" }}>
                        📍 {pto.observationArea || "-"}
                      </td>
                      <td style={{ color: "#64748b" }}>
                        📅 {pto.date || "-"}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span
                          className={
                            pto.status === "completed" ? styles.statusPillCompleted : styles.statusPillDraft
                          }
                        >
                          {pto.status === "completed" ? "Rilis" : "Draf"}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                          <button
                            type="button"
                            className={styles.btnSecondary}
                            style={{ padding: "5px 9px", fontSize: "11.5px" }}
                            onClick={() => handleSelectPto(pto.id!)}
                            title="Buka dan edit formulir ini"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            className={styles.btnPrimary}
                            style={{ padding: "5px 9px", fontSize: "11.5px" }}
                            onClick={() => handleOpenPreview(pto.id!)}
                            title="Pratinjau PDF master"
                          >
                            👁️ Preview
                          </button>
                          <button
                            type="button"
                            className={styles.btnSecondary}
                            style={{ padding: "5px 9px", fontSize: "11.5px" }}
                            onClick={() => handleDownloadPdf(pto.id!)}
                            title="Unduh file PDF"
                          >
                            📥
                          </button>
                          <button
                            type="button"
                            className={styles.btnDanger}
                            style={{ padding: "5px 8px", fontSize: "11.5px" }}
                            onClick={() => handleDelete(pto.id!)}
                            title="Hapus formulir ini"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── MODAL PRATINJAU PDF MASTER ── */}
      {previewPdfUrl && (
        <div className={styles.modalBackdrop} onClick={() => setPreviewPdfUrl(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <span className={styles.heroBadge} style={{ marginBottom: "4px" }}>
                  Pratinjau Dokumen Cetak PDF
                </span>
                <h3>{current.formNumber || "Plan Task Observation (PTO)"}</h3>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setPreviewPdfUrl(null)}
                title="Tutup Pratinjau"
              >
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              <iframe src={previewPdfUrl} title="PDF Preview" />
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setPreviewPdfUrl(null)}
              >
                Tutup
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => handleDownloadPdf()}
              >
                <span>📥</span> Unduh Dokumen PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
