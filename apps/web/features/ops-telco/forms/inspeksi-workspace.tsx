"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { api, getAvatarUrl, type PortalUser } from "@/lib/api";
import { INSPECTION_CATEGORIES, type InspectionCategoryKey } from "./inspeksi-templates";
import { InspeksiPdfView, type InspeksiPdfData } from "./inspeksi-pdf-view";
import styles from "./inspeksi-workspace.module.css";

export type InspectionConditionType = "baik" | "rusak_ringan" | "rusak_berat" | "hilang";

export interface InspectionRecord {
  id: number;
  category: string;
  inspectionDate: string;
  itemName: string;
  itemCondition: InspectionConditionType;
  location?: string | null;
  notes?: string | null;
  actionTaken?: string | null;
  photos: string[];
  inspectedBy: number;
  createdAt: string;
  updatedAt: string;
  inspectorName?: string | null;
  inspectorKpcId?: string | null;
  inspectorDivision?: string | null;
  inspectorAvatar?: string | null;
}

export interface InspectionStats {
  total: number;
  byCategory: Record<string, number>;
  byCondition: {
    baik: number;
    rusak_ringan: number;
    rusak_berat: number;
    hilang: number;
  };
}

interface InspeksiWorkspaceProps {
  user?: PortalUser | null;
  initialCategory?: InspectionCategoryKey;
}

export function InspeksiWorkspace({ user, initialCategory = "tools" }: InspeksiWorkspaceProps) {
  const [selectedCategory, setSelectedCategory] = useState<InspectionCategoryKey | "all">(initialCategory);
  const [activeTab, setActiveTab] = useState<"create" | "report">("create");

  // Form states
  const [formCategory, setFormCategory] = useState<InspectionCategoryKey>(initialCategory);
  const [inspectionDate, setInspectionDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [formQuarter, setFormQuarter] = useState<string>("Q2");
  const [formYear, setFormYear] = useState<string>("2026");
  const [itemName, setItemName] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [serialOrRegNo, setSerialOrRegNo] = useState<string>("");
  const [itemCondition, setItemCondition] = useState<InspectionConditionType>("baik");
  const [isSafeToUse, setIsSafeToUse] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>("");
  const [actionTaken, setActionTaken] = useState<string>("");

  // Items checklist state for the active form
  const [formItems, setFormItems] = useState<any[]>([]);

  // Photos state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // List / Report states
  const [records, setRecords] = useState<InspectionRecord[]>([]);
  const [stats, setStats] = useState<InspectionStats | null>(null);
  const [loadingRecords, setLoadingRecords] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterQuarter, setFilterQuarter] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("2026");
  const [filterCondition, setFilterCondition] = useState<string>("all");
  const [startDateFilter, setStartDateFilter] = useState<string>("");
  const [endDateFilter, setEndDateFilter] = useState<string>("");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Lightbox Modal state
  const [lightboxOpen, setLightboxOpen] = useState<boolean>(false);
  const [lightboxPhotos, setLightboxPhotos] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number>(0);
  const [lightboxCaption, setLightboxCaption] = useState<string>("");

  // PDF Preview Modal state
  const [pdfPreviewData, setPdfPreviewData] = useState<InspeksiPdfData | null>(null);

  // Initialize form items whenever formCategory changes
  useEffect(() => {
    const meta = INSPECTION_CATEGORIES[formCategory as InspectionCategoryKey];
    if (meta) {
      setLocation(meta.defaultLocation || "D8 - Tango Delta");
      setItemName(meta.label);
      if (meta.defaultItems) {
        setFormItems(
          meta.defaultItems.map((it: any, idx: number) => ({
            ...it,
            no: it.no || idx + 1,
            condition: meta.type === "inventory" ? "good" : meta.type === "checklist" ? "ok" : undefined,
            remarks: "",
            helm: true,
            kacamata: true,
            earplug: false,
            rompi: true,
            sepatu: true,
            kapan: new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" })
          }))
        );
      } else {
        setFormItems([]);
      }
    }
  }, [formCategory]);

  // Sync initialCategory prop if changed externally
  useEffect(() => {
    if (initialCategory) {
      setSelectedCategory(initialCategory);
      setFormCategory(initialCategory);
    }
  }, [initialCategory]);

  // Update file previews when files change
  useEffect(() => {
    const urls = selectedFiles.map((file: File) => URL.createObjectURL(file));
    setFilePreviews(urls);

    return () => {
      urls.forEach((u: string) => URL.revokeObjectURL(u));
    };
  }, [selectedFiles]);

  // Fetch stats
  const fetchStats = async () => {
    try {
      const res = await api<{ success: boolean; data: InspectionStats }>("/ops-telco/inspections/stats");
      if (res.success && res.data) {
        setStats(res.data);
      }
    } catch (err) {
      console.error("Gagal memuat statistik inspeksi:", err);
    }
  };

  // Fetch records
  const fetchRecords = async () => {
    setLoadingRecords(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== "all") params.set("category", selectedCategory);
      if (filterCondition !== "all") params.set("itemCondition", filterCondition);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      if (startDateFilter) params.set("startDate", startDateFilter);
      if (endDateFilter) params.set("endDate", endDateFilter);

      const res = await api<{ success: boolean; data: InspectionRecord[] }>(
        `/ops-telco/inspections?${params.toString()}`
      );
      if (res.success && res.data) {
        setRecords(res.data);
      }
    } catch (err) {
      console.error("Gagal memuat daftar inspeksi:", err);
    } finally {
      setLoadingRecords(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchRecords();
  }, [selectedCategory, filterCondition, startDateFilter, endDateFilter]);

  // Filter records by quarter and year locally (parsed from notes or inspectionDate)
  const filteredRecords = useMemo(() => {
    return records.filter((r: InspectionRecord) => {
      let q = "";
      let y = "";
      if (r.notes && r.notes.startsWith("{")) {
        try {
          const parsed = JSON.parse(r.notes);
          q = parsed.quarter || "";
          y = parsed.year ? String(parsed.year) : "";
        } catch {}
      }
      if (!y && r.inspectionDate) {
        y = r.inspectionDate.slice(0, 4);
      }

      if (filterQuarter !== "all" && q && q !== filterQuarter) {
        return false;
      }
      if (filterYear !== "all" && y && y !== filterYear) {
        return false;
      }
      return true;
    });
  }, [records, filterQuarter, filterYear]);

  // File Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const incoming = Array.from(e.target.files);
      setSelectedFiles((prev: File[]) => [...prev, ...incoming]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      const incoming = Array.from(e.dataTransfer.files).filter((f: any) => f.type && f.type.startsWith("image/"));
      setSelectedFiles((prev: File[]) => [...prev, ...incoming]);
    }
  };

  const removeFile = (idx: number) => {
    setSelectedFiles((prev: File[]) => prev.filter((_: File, i: number) => i !== idx));
  };

  // Live PDF preview of current draft form
  const handleOpenDraftPdf = () => {
    const draftData: InspeksiPdfData = {
      category: formCategory,
      quarter: formQuarter,
      year: formYear,
      inspectionDate,
      location,
      serialOrRegNo,
      itemSubtype: itemName,
      inspectorName: user?.name || "Teknisi Telco",
      inspectorId: user?.kpcId || "Z125446",
      inspectorPosition: "Teknisi Telco",
      supervisorName: "Rahmansyah",
      supervisorId: "2110997",
      supervisorPosition: "Act. Spv Telco",
      toolInChargeName: user?.name || undefined,
      toolInChargeId: user?.kpcId || undefined,
      isSafeToUse,
      notes,
      actionTaken,
      photos: filePreviews,
      items: formItems.map((it: any) => ({
        ...it,
        description: it.description || it.checkItem || it.personil
      }))
    };
    setPdfPreviewData(draftData);
  };

  // Open PDF preview from existing submitted record
  const handleOpenRecordPdf = (rec: InspectionRecord) => {
    let extraData: any = {};
    if (rec.notes && rec.notes.startsWith("{")) {
      try {
        extraData = JSON.parse(rec.notes);
      } catch {}
    }

    const catKey = (rec.category as InspectionCategoryKey) in INSPECTION_CATEGORIES
      ? (rec.category as InspectionCategoryKey)
      : "tools";

    const pdfData: InspeksiPdfData = {
      id: rec.id,
      category: catKey,
      quarter: extraData.quarter || "Q2",
      year: extraData.year || rec.inspectionDate.slice(0, 4) || "2026",
      inspectionDate: rec.inspectionDate,
      location: rec.location || extraData.location || "D8 Tango Delta",
      serialOrRegNo: extraData.serialOrRegNo || "",
      itemSubtype: rec.itemName,
      inspectorName: rec.inspectorName || user?.name || "Teknisi Telco",
      inspectorId: rec.inspectorKpcId || user?.kpcId || "-",
      inspectorPosition: rec.inspectorDivision || "Teknisi Telco",
      supervisorName: "Rahmansyah",
      supervisorId: "2110997",
      supervisorPosition: "Act. Spv Telco",
      isSafeToUse: extraData.isSafeToUse !== undefined ? extraData.isSafeToUse : rec.itemCondition === "baik",
      notes: extraData.notes || rec.notes,
      actionTaken: rec.actionTaken || "",
      photos: rec.photos || [],
      items: extraData.items || [
        {
          no: 1,
          description: rec.itemName,
          condition: rec.itemCondition === "baik" ? "good" : "broken",
          remarks: rec.actionTaken || ""
        }
      ]
    };
    setPdfPreviewData(pdfData);
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitSuccess(null);
    setSubmitError(null);

    try {
      const formData = new FormData();
      formData.append("category", formCategory);
      formData.append("inspectionDate", inspectionDate);
      formData.append("itemName", itemName.trim() || INSPECTION_CATEGORIES[formCategory as InspectionCategoryKey].label);
      formData.append("itemCondition", itemCondition);
      formData.append("location", location);
      formData.append("actionTaken", actionTaken);

      // Package detailed checklist & metadata in structured notes
      const extraPayload = {
        quarter: formQuarter,
        year: formYear,
        serialOrRegNo,
        isSafeToUse,
        notes: notes.trim(),
        items: formItems.map((it: any) => ({
          ...it,
          description: it.description || it.checkItem || it.personil
        }))
      };
      formData.append("notes", JSON.stringify(extraPayload));

      // Append multi-files
      selectedFiles.forEach((file: File) => {
        formData.append("photos", file);
      });

      const res = await fetch("/api-backend/ops-telco/inspections", {
        method: "POST",
        body: formData,
        credentials: "include"
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Gagal menyimpan form inspeksi.");
      }

      setSubmitSuccess(`Laporan inspeksi ${INSPECTION_CATEGORIES[formCategory as InspectionCategoryKey].label} (${formQuarter} ${formYear}) berhasil disimpan!`);
      setSelectedFiles([]);
      setFilePreviews([]);
      if (fileInputRef.current) fileInputRef.current.value = "";

      // Refresh list & stats
      fetchStats();
      fetchRecords();

      // Switch to report tab after 1.2s to show result
      setTimeout(() => {
        setActiveTab("report");
      }, 1200);
    } catch (err: any) {
      console.error("Gagal mengirim laporan inspeksi:", err);
      setSubmitError(err.message || "Gagal menyimpan laporan inspeksi.");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Handler
  const handleDelete = async (id: number) => {
    if (!confirm("Apakah Anda yakin ingin menghapus data inspeksi ini?")) return;

    try {
      const res = await api<{ success: boolean }>(`/ops-telco/inspections/${id}`, {
        method: "DELETE"
      });
      if (res.success) {
        setRecords((prev: InspectionRecord[]) => prev.filter((r: InspectionRecord) => r.id !== id));
        fetchStats();
      }
    } catch (err: any) {
      alert(err.message || "Gagal menghapus data inspeksi.");
    }
  };

  const activeCategoryMeta = INSPECTION_CATEGORIES[formCategory as InspectionCategoryKey] || INSPECTION_CATEGORIES.tools;

  return (
    <div className={styles.container}>
      {/* ─── Header Area ─── */}
      <div className={styles.headerArea}>
        <div className={styles.titleRow}>
          <div>
            <h1 className={styles.mainTitle}>
              <span>📋</span> Portal Inspeksi OPS Telco
            </h1>
            <p className={styles.mainSubtitle}>
              Standar Pemeriksaan Peralatan, APD, Tangga, dan Alat Keselamatan (Format FM-HSE Q2 2026).
            </p>
          </div>

          {/* Tab Navigation (Tambah Form vs Riwayat) */}
          <div className={styles.tabNav}>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === "create" ? styles.tabBtnActive : ""}`}
              onClick={() => setActiveTab("create")}
            >
              <span>➕ Tambah Form</span>
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === "report" ? styles.tabBtnActive : ""}`}
              onClick={() => setActiveTab("report")}
            >
              <span>📑 Riwayat Form</span>
              <span className={styles.tabCount}>{filteredRecords.length}</span>
            </button>
          </div>
        </div>

        {/* Category Selector Bar (12 Categories) */}
        <div className={styles.categoryBar}>
          <button
            type="button"
            className={`${styles.categoryTab} ${selectedCategory === "all" ? styles.categoryTabActive : ""}`}
            onClick={() => {
              setSelectedCategory("all");
            }}
          >
            <span>🌐</span> Semua Kategori
          </button>
          {(Object.keys(INSPECTION_CATEGORIES) as InspectionCategoryKey[]).map((catKey) => {
            const meta = INSPECTION_CATEGORIES[catKey];
            const isSelected = selectedCategory === catKey;
            const count = stats?.byCategory?.[catKey] || 0;
            return (
              <button
                key={catKey}
                type="button"
                className={`${styles.categoryTab} ${isSelected ? styles.categoryTabActive : ""}`}
                onClick={() => {
                  setSelectedCategory(catKey);
                  setFormCategory(catKey);
                }}
              >
                <span>{meta.icon}</span>
                <span>{meta.label}</span>
                <span className={styles.categoryBadge}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── TAB 1: TAMBAH FORM ─── */}
      {activeTab === "create" && (
        <form className={styles.formCard} onSubmit={handleSubmit}>
          <div className={styles.formHeader}>
            <div>
              <div className={styles.formHeaderTitle}>
                <span>{activeCategoryMeta.icon}</span> Form Inspeksi: {activeCategoryMeta.label}
              </div>
              <div className={styles.formHeaderSubtitle}>
                {activeCategoryMeta.title} • Dokumen: <strong>{activeCategoryMeta.docNo}</strong> (Rev {activeCategoryMeta.rev})
              </div>
            </div>
            <button
              type="button"
              onClick={handleOpenDraftPdf}
              className={styles.btnPreviewPdf}
              title="Lihat format dokumen resmi sebelum disimpan"
            >
              👁️ Lihat Preview Dokumen PDF
            </button>
          </div>

          {submitSuccess && <div className={styles.alertSuccess}>✓ {submitSuccess}</div>}
          {submitError && <div className={styles.alertError}>✕ {submitError}</div>}

          {/* Meta Info Grid */}
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.label}>
                Kategori Inspeksi <span className={styles.req}>*</span>
              </label>
              <select
                className={styles.select}
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as InspectionCategoryKey)}
                required
              >
                {(Object.keys(INSPECTION_CATEGORIES) as InspectionCategoryKey[]).map((key) => (
                  <option key={key} value={key}>
                    {INSPECTION_CATEGORIES[key].label} ({INSPECTION_CATEGORIES[key].docNo})
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>
                Tanggal Inspeksi <span className={styles.req}>*</span>
              </label>
              <input
                type="date"
                className={styles.input}
                value={inspectionDate}
                onChange={(e) => setInspectionDate(e.target.value)}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Periode Triwulan / Kuartal</label>
              <div className={styles.quarterBar}>
                {["Q1", "Q2", "Q3", "Q4"].map((q) => (
                  <button
                    key={q}
                    type="button"
                    className={`${styles.quarterBtn} ${formQuarter === q ? styles.quarterBtnActive : ""}`}
                    onClick={() => setFormQuarter(q)}
                  >
                    {q}
                  </button>
                ))}
                <select
                  className={styles.select}
                  style={{ width: "90px" }}
                  value={formYear}
                  onChange={(e) => setFormYear(e.target.value)}
                >
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                  <option value="2024">2024</option>
                </select>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Lokasi / Area Kerja</label>
              <input
                type="text"
                className={styles.input}
                placeholder="Contoh: D8 - Tango Delta / Swarga Bara"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>No. Register / No. Seri / No. Tangga</label>
              <input
                type="text"
                className={styles.input}
                placeholder="Misal: SE/MKN/LADD-15 atau SE/MKN/TWL 18"
                value={serialOrRegNo}
                onChange={(e) => setSerialOrRegNo(e.target.value)}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Status Umum / Kondisi</label>
              <select
                className={styles.select}
                value={itemCondition}
                onChange={(e) => setItemCondition(e.target.value as InspectionConditionType)}
              >
                <option value="baik">🟢 Baik / Laik Operasi</option>
                <option value="rusak_ringan">🟡 Rusak Ringan / Butuh Perbaikan</option>
                <option value="rusak_berat">🔴 Rusak Berat / Tidak Aman</option>
                <option value="hilang">⚪ Hilang / Proses Pengadaan</option>
              </select>
            </div>
          </div>

          {/* ─── Interactive Checklist Table ─── */}
          <div className={styles.checklistSection}>
            <div className={styles.checklistHeaderRow}>
              <div className={styles.checklistTitle}>
                <span>📝</span> Daftar Periksa Item {activeCategoryMeta.label} ({formItems.length} Item Standar)
              </div>
              <button
                type="button"
                className={styles.btnActionPdf}
                onClick={() => {
                  setFormItems((prev) => [
                    ...prev,
                    {
                      no: prev.length + 1,
                      description: "",
                      merkType: "",
                      unit: "ea",
                      qty: 1,
                      condition: activeCategoryMeta.type === "inventory" ? "good" : "ok",
                      remarks: ""
                    }
                  ]);
                }}
              >
                ➕ Tambah Baris Baru
              </button>
            </div>

            <div className={styles.checklistTableWrapper}>
              {/* Type A: Inventory Tools */}
              {activeCategoryMeta.type === "inventory" && (
                <table className={styles.checklistTable}>
                  <thead>
                    <tr>
                      <th style={{ width: "40px" }}>No</th>
                      <th>Nama Alat / Description</th>
                      <th style={{ width: "160px" }}>Merk / Tipe</th>
                      <th style={{ width: "80px" }}>Satuan</th>
                      <th style={{ width: "70px" }}>Qty</th>
                      <th style={{ width: "130px" }}>Kondisi</th>
                      <th>Catatan / Keterangan</th>
                      <th style={{ width: "50px" }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formItems.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ textAlign: "center" }}>{idx + 1}</td>
                        <td>
                          <input
                            type="text"
                            className={styles.tableInputText}
                            value={item.description || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormItems((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, description: val } : it))
                              );
                            }}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className={styles.tableInputText}
                            value={item.merkType || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormItems((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, merkType: val } : it))
                              );
                            }}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className={styles.tableInputText}
                            style={{ textAlign: "center" }}
                            value={item.unit || "ea"}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormItems((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, unit: val } : it))
                              );
                            }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className={styles.tableInputText}
                            style={{ textAlign: "center" }}
                            value={item.qty || 1}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormItems((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, qty: val } : it))
                              );
                            }}
                          />
                        </td>
                        <td>
                          <select
                            className={styles.tableSelect}
                            value={item.condition || "good"}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormItems((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, condition: val } : it))
                              );
                            }}
                          >
                            <option value="good">✓ Good (Baik)</option>
                            <option value="enough">⚠️ Enough (Cukup)</option>
                            <option value="broken">✕ Broken (Rusak)</option>
                          </select>
                        </td>
                        <td>
                          <input
                            type="text"
                            className={styles.tableInputText}
                            placeholder="Catatan / status perbaikan"
                            value={item.remarks || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormItems((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, remarks: val } : it))
                              );
                            }}
                          />
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            type="button"
                            onClick={() => setFormItems((prev) => prev.filter((_, i) => i !== idx))}
                            style={{ background: "none", border: "none", color: "#f43f5e", cursor: "pointer" }}
                            title="Hapus baris"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Type B: Personnel APD */}
              {activeCategoryMeta.type === "personnel-apd" && (
                <table className={styles.checklistTable}>
                  <thead>
                    <tr>
                      <th style={{ width: "40px" }}>No</th>
                      <th style={{ width: "220px" }}>Nama Personil Teknisi</th>
                      <th style={{ width: "70px", textAlign: "center" }}>Helm</th>
                      <th style={{ width: "80px", textAlign: "center" }}>Kacamata</th>
                      <th style={{ width: "70px", textAlign: "center" }}>EarPlug</th>
                      <th style={{ width: "80px", textAlign: "center" }}>Rompi</th>
                      <th style={{ width: "80px", textAlign: "center" }}>Sepatu</th>
                      <th>Keterangan / Periode</th>
                      <th style={{ width: "50px" }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formItems.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ textAlign: "center" }}>{idx + 1}</td>
                        <td>
                          <input
                            type="text"
                            className={styles.tableInputText}
                            value={item.personil || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormItems((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, personil: val } : it))
                              );
                            }}
                          />
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            className={styles.tableCheckbox}
                            checked={item.helm !== false}
                            onChange={(e) => {
                              const val = e.target.checked;
                              setFormItems((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, helm: val } : it))
                              );
                            }}
                          />
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            className={styles.tableCheckbox}
                            checked={item.kacamata !== false}
                            onChange={(e) => {
                              const val = e.target.checked;
                              setFormItems((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, kacamata: val } : it))
                              );
                            }}
                          />
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            className={styles.tableCheckbox}
                            checked={!!item.earplug}
                            onChange={(e) => {
                              const val = e.target.checked;
                              setFormItems((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, earplug: val } : it))
                              );
                            }}
                          />
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            className={styles.tableCheckbox}
                            checked={item.rompi !== false}
                            onChange={(e) => {
                              const val = e.target.checked;
                              setFormItems((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, rompi: val } : it))
                              );
                            }}
                          />
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            className={styles.tableCheckbox}
                            checked={item.sepatu !== false}
                            onChange={(e) => {
                              const val = e.target.checked;
                              setFormItems((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, sepatu: val } : it))
                              );
                            }}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className={styles.tableInputText}
                            value={item.remarks || `${formQuarter} / ${formYear}`}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormItems((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, remarks: val } : it))
                              );
                            }}
                          />
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            type="button"
                            onClick={() => setFormItems((prev) => prev.filter((_, i) => i !== idx))}
                            style={{ background: "none", border: "none", color: "#f43f5e", cursor: "pointer" }}
                            title="Hapus baris"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Type Padlock */}
              {activeCategoryMeta.type === "padlock" && (
                <table className={styles.checklistTable}>
                  <thead>
                    <tr>
                      <th style={{ width: "40px" }}>No</th>
                      <th>Nama Personil</th>
                      <th style={{ width: "140px" }}>No Badge</th>
                      <th style={{ width: "160px" }}>No Seri Lock</th>
                      <th>Keterangan / Status</th>
                      <th style={{ width: "50px" }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formItems.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ textAlign: "center" }}>{idx + 1}</td>
                        <td>
                          <input
                            type="text"
                            className={styles.tableInputText}
                            value={item.personil || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormItems((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, personil: val } : it))
                              );
                            }}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className={styles.tableInputText}
                            value={item.badgeNo || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormItems((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, badgeNo: val } : it))
                              );
                            }}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className={styles.tableInputText}
                            value={item.lockSerial || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormItems((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, lockSerial: val } : it))
                              );
                            }}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className={styles.tableInputText}
                            value={item.remarks || `${formQuarter} ${formYear}`}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormItems((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, remarks: val } : it))
                              );
                            }}
                          />
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            type="button"
                            onClick={() => setFormItems((prev) => prev.filter((_, i) => i !== idx))}
                            style={{ background: "none", border: "none", color: "#f43f5e", cursor: "pointer" }}
                            title="Hapus baris"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Type Checklist (Tangga, Lanyards, Harness, Katrol, Tali Karmantle) */}
              {activeCategoryMeta.type === "checklist" && (
                <table className={styles.checklistTable}>
                  <thead>
                    <tr>
                      <th style={{ width: "40px" }}>No</th>
                      <th>Hal / Komponen yang Diperiksa</th>
                      <th style={{ width: "160px" }}>Kondisi</th>
                      <th>Keterangan / Temuan</th>
                      <th style={{ width: "50px" }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formItems.map((item, idx) => {
                      const showGroupHeader =
                        item.categoryGroup && (idx === 0 || formItems[idx - 1].categoryGroup !== item.categoryGroup);

                      return (
                        <React.Fragment key={idx}>
                          {showGroupHeader && (
                            <tr className={styles.checkGroupHeader}>
                              <td colSpan={5}>📌 {item.categoryGroup}</td>
                            </tr>
                          )}
                          <tr>
                            <td style={{ textAlign: "center" }}>{idx + 1}</td>
                            <td>
                              <input
                                type="text"
                                className={styles.tableInputText}
                                value={item.checkItem || item.description || ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setFormItems((prev) =>
                                    prev.map((it, i) => (i === idx ? { ...it, checkItem: val, description: val } : it))
                                  );
                                }}
                              />
                            </td>
                            <td>
                              <select
                                className={styles.tableSelect}
                                value={item.condition || "ok"}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setFormItems((prev) =>
                                    prev.map((it, i) => (i === idx ? { ...it, condition: val } : it))
                                  );
                                }}
                              >
                                <option value="ok">✓ Memuaskan / OK (Baik)</option>
                                <option value="not_ok">✕ Tidak Memuaskan / Rusak</option>
                              </select>
                            </td>
                            <td>
                              <input
                                type="text"
                                className={styles.tableInputText}
                                placeholder="Keterangan perbaikan atau temuan"
                                value={item.remarks || ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setFormItems((prev) =>
                                    prev.map((it, i) => (i === idx ? { ...it, remarks: val } : it))
                                  );
                                }}
                              />
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <button
                                type="button"
                                onClick={() => setFormItems((prev) => prev.filter((_, i) => i !== idx))}
                                style={{ background: "none", border: "none", color: "#f43f5e", cursor: "pointer" }}
                                title="Hapus baris"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Safety Verdict */}
          <div className={styles.formGroupFull}>
            <label className={styles.label}>
              Keputusan Kelayakan & Keamanan Penggunaan Alat:
            </label>
            <div className={styles.safeRadioGroup}>
              <label className={styles.safeRadioLabel} style={{ color: "#38bdf8" }}>
                <input
                  type="radio"
                  name="safetyVerdict"
                  checked={isSafeToUse === true}
                  onChange={() => setIsSafeToUse(true)}
                />
                <span>✅ YA (Alat dinyatakan aman untuk digunakan)</span>
              </label>
              <label className={styles.safeRadioLabel} style={{ color: "#f43f5e" }}>
                <input
                  type="radio"
                  name="safetyVerdict"
                  checked={isSafeToUse === false}
                  onChange={() => setIsSafeToUse(false)}
                />
                <span>🚫 TIDAK (Tidak aman / perlu perbaikan segera)</span>
              </label>
            </div>
          </div>

          {/* Notes & Action Taken */}
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Catatan Tambahan / Rekomendasi</label>
              <textarea
                className={styles.textarea}
                rows={2}
                placeholder="Catatan hasil inspeksi..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Tindakan yang Diambil (Action Taken)</label>
              <textarea
                className={styles.textarea}
                rows={2}
                placeholder="Tindakan korektif, pembersihan, atau perbaikan yang telah dilakukan..."
                value={actionTaken}
                onChange={(e) => setActionTaken(e.target.value)}
              />
            </div>
          </div>

          {/* Multi-Photo Upload Section */}
          <div className={styles.formGroupFull}>
            <label className={styles.label}>
              Dokumentasi Foto Inspeksi (Bisa Upload Lebih Dari 1 Foto Sekaligus)
            </label>
            <div
              className={`${styles.dropZone} ${isDragging ? styles.dropZoneActive : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
              <div className={styles.dropZoneContent}>
                <div className={styles.dropIcon}>📸</div>
                <div className={styles.dropText}>
                  <strong>Klik untuk upload</strong> atau seret beberapa foto ke sini
                </div>
                <div className={styles.dropHint}>Mendukung JPG, PNG, WebP (Maks 10MB per foto)</div>
              </div>
            </div>

            {/* Photo Previews */}
            {filePreviews.length > 0 && (
              <div className={styles.previewGrid}>
                {filePreviews.map((src, idx) => (
                  <div key={idx} className={styles.previewItem}>
                    <img src={src} alt={`Preview ${idx + 1}`} className={styles.previewImg} />
                    <button
                      type="button"
                      className={styles.removeBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(idx);
                      }}
                      title="Hapus foto"
                    >
                      ✕
                    </button>
                    <span className={styles.previewBadge}>Foto #{idx + 1}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className={styles.formActions}>
            <button
              type="button"
              onClick={handleOpenDraftPdf}
              className={styles.btnPreviewPdf}
              style={{ marginRight: "auto" }}
            >
              📄 Preview Laporan PDF
            </button>

            <button type="submit" className={styles.btnPrimary} disabled={submitting}>
              {submitting ? "Menyimpan..." : `💾 Simpan Laporan Inspeksi ${activeCategoryMeta.label}`}
            </button>
          </div>
        </form>
      )}

      {/* ─── TAB 2: RIWAYAT FORM ─── */}
      {activeTab === "report" && (
        <div className={styles.reportSection}>
          {/* Stats Bar */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>📦</div>
              <div>
                <div className={styles.statValue}>{stats?.total || 0}</div>
                <div className={styles.statLabel}>Total Seluruh Inspeksi</div>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ color: "#22c55e" }}>🟢</div>
              <div>
                <div className={styles.statValue}>{stats?.byCondition?.baik || 0}</div>
                <div className={styles.statLabel}>Kondisi Baik / Laik</div>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ color: "#eab308" }}>🟡</div>
              <div>
                <div className={styles.statValue}>{stats?.byCondition?.rusak_ringan || 0}</div>
                <div className={styles.statLabel}>Perlu Perbaikan</div>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ color: "#ef4444" }}>🔴</div>
              <div>
                <div className={styles.statValue}>
                  {(stats?.byCondition?.rusak_berat || 0) + (stats?.byCondition?.hilang || 0)}
                </div>
                <div className={styles.statLabel}>Rusak Berat / Hilang</div>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className={styles.filterCard}>
            <div className={styles.filterRow}>
              {/* Quarter buttons */}
              <div className={styles.quarterBar}>
                <span style={{ fontSize: "0.825rem", color: "#94a3b8", marginRight: "0.25rem" }}>Kuartal:</span>
                {["all", "Q1", "Q2", "Q3", "Q4"].map((q) => (
                  <button
                    key={q}
                    type="button"
                    className={`${styles.quarterBtn} ${filterQuarter === q ? styles.quarterBtnActive : ""}`}
                    onClick={() => setFilterQuarter(q)}
                  >
                    {q === "all" ? "Semua" : q}
                  </button>
                ))}
              </div>

              {/* Year Select */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.825rem", color: "#94a3b8" }}>Tahun:</span>
                <select
                  className={styles.select}
                  style={{ width: "90px" }}
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                >
                  <option value="all">Semua</option>
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                  <option value="2024">2024</option>
                </select>
              </div>

              {/* Search input */}
              <div style={{ flex: 1, minWidth: "200px" }}>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Cari alat, personil, nomor seri, catatan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchRecords()}
                />
              </div>

              {/* View Switcher */}
              <div className={styles.viewToggle}>
                <button
                  type="button"
                  className={`${styles.viewBtn} ${viewMode === "grid" ? styles.viewBtnActive : ""}`}
                  onClick={() => setViewMode("grid")}
                  title="Grid View"
                >
                  ▦
                </button>
                <button
                  type="button"
                  className={`${styles.viewBtn} ${viewMode === "table" ? styles.viewBtnActive : ""}`}
                  onClick={() => setViewMode("table")}
                  title="Table View"
                >
                  ☰
                </button>
              </div>
            </div>
          </div>

          {/* Content View */}
          {loadingRecords ? (
            <div className={styles.loadingBox}>Memuat riwayat inspeksi...</div>
          ) : filteredRecords.length === 0 ? (
            <div className={styles.emptyBox}>
              <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🔍</div>
              <div>Belum ada riwayat inspeksi untuk kategori dan kuartal yang dipilih.</div>
              <button
                type="button"
                className={styles.btnPrimary}
                style={{ marginTop: "1rem" }}
                onClick={() => setActiveTab("create")}
              >
                ➕ Buat Inspeksi Baru
              </button>
            </div>
          ) : viewMode === "grid" ? (
            <div className={styles.cardsGrid}>
              {filteredRecords.map((rec) => {
                const catMeta =
                  INSPECTION_CATEGORIES[rec.category as InspectionCategoryKey] || INSPECTION_CATEGORIES.tools;
                let parsedExtra: any = {};
                if (rec.notes && rec.notes.startsWith("{")) {
                  try {
                    parsedExtra = JSON.parse(rec.notes);
                  } catch {}
                }

                return (
                  <div key={rec.id} className={styles.recordCard}>
                    <div className={styles.cardHeader}>
                      <div className={styles.cardHeaderLeft}>
                        <span className={styles.cardBadge}>{catMeta.label}</span>
                        <span className={styles.cardDate}>
                          {new Date(rec.inspectionDate).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric"
                          })}
                        </span>
                        {parsedExtra.quarter && (
                          <span className={styles.badge} style={{ background: "#0369a1", fontSize: "0.7rem" }}>
                            {parsedExtra.quarter} {parsedExtra.year || "2026"}
                          </span>
                        )}
                      </div>
                      <span className={`${styles.statusPill} ${styles[`status_${rec.itemCondition}`]}`}>
                        {rec.itemCondition === "baik"
                          ? "Baik"
                          : rec.itemCondition === "rusak_ringan"
                          ? "Rusak Ringan"
                          : rec.itemCondition === "rusak_berat"
                          ? "Rusak Berat"
                          : "Hilang"}
                      </span>
                    </div>

                    <div className={styles.cardBody}>
                      <h3 className={styles.cardItemName}>{rec.itemName}</h3>
                      {rec.location && <div className={styles.cardMeta}>📍 {rec.location}</div>}
                      {parsedExtra.serialOrRegNo && (
                        <div className={styles.cardMeta}>🏷️ No: {parsedExtra.serialOrRegNo}</div>
                      )}
                      {parsedExtra.notes && (
                        <p className={styles.cardNotes}>
                          <strong>Catatan:</strong> {parsedExtra.notes}
                        </p>
                      )}
                    </div>

                    {/* Photos Preview */}
                    {rec.photos && rec.photos.length > 0 && (
                      <div className={styles.cardPhotos}>
                        {rec.photos.map((pUrl, idx) => (
                          <img
                            key={idx}
                            src={pUrl}
                            alt="Foto inspeksi"
                            className={styles.cardThumb}
                            onClick={() => {
                              setLightboxPhotos(rec.photos);
                              setLightboxIndex(idx);
                              setLightboxCaption(`${catMeta.label} - ${rec.itemName} (${rec.inspectionDate})`);
                              setLightboxOpen(true);
                            }}
                          />
                        ))}
                      </div>
                    )}

                    <div className={styles.cardFooter}>
                      <div className={styles.inspectorInfo}>
                        <span className={styles.inspectorAvatar}>
                          {rec.inspectorAvatar ? (
                            <img src={getAvatarUrl(rec.inspectorAvatar)} alt={rec.inspectorName || "User"} />
                          ) : (
                            rec.inspectorName?.charAt(0) || "T"
                          )}
                        </span>
                        <span className={styles.inspectorName}>{rec.inspectorName || "Teknisi"}</span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <button
                          type="button"
                          className={styles.btnActionPdf}
                          onClick={() => handleOpenRecordPdf(rec)}
                          title="Cetak atau unduh dokumen PDF format resmi MKN"
                        >
                          📄 Cetak PDF
                        </button>
                        <button
                          type="button"
                          className={styles.btnDelete}
                          onClick={() => handleDelete(rec.id)}
                          title="Hapus data inspeksi"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.tableCard}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Periode</th>
                    <th>Kategori</th>
                    <th>Item / Peralatan</th>
                    <th>Lokasi / No. Reg</th>
                    <th>Kondisi</th>
                    <th>Foto</th>
                    <th>Petugas</th>
                    <th style={{ textAlign: "right" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((rec) => {
                    const catMeta =
                      INSPECTION_CATEGORIES[rec.category as InspectionCategoryKey] || INSPECTION_CATEGORIES.tools;
                    let parsedExtra: any = {};
                    if (rec.notes && rec.notes.startsWith("{")) {
                      try {
                        parsedExtra = JSON.parse(rec.notes);
                      } catch {}
                    }

                    return (
                      <tr key={rec.id}>
                        <td>{rec.inspectionDate}</td>
                        <td>
                          <strong>{parsedExtra.quarter || "Q2"}</strong> {parsedExtra.year || "2026"}
                        </td>
                        <td>
                          <span className={styles.cardBadge}>{catMeta.label}</span>
                        </td>
                        <td>
                          <strong>{rec.itemName}</strong>
                        </td>
                        <td>
                          {rec.location || "-"} {parsedExtra.serialOrRegNo ? `(${parsedExtra.serialOrRegNo})` : ""}
                        </td>
                        <td>
                          <span className={`${styles.statusPill} ${styles[`status_${rec.itemCondition}`]}`}>
                            {rec.itemCondition}
                          </span>
                        </td>
                        <td>
                          {rec.photos && rec.photos.length > 0 ? (
                            <div style={{ display: "flex", gap: "4px" }}>
                              {rec.photos.map((url, i) => (
                                <img
                                  key={i}
                                  src={url}
                                  alt="Thumb"
                                  className={styles.tableThumb}
                                  onClick={() => {
                                    setLightboxPhotos(rec.photos);
                                    setLightboxIndex(i);
                                    setLightboxCaption(`${catMeta.label} - ${rec.itemName}`);
                                    setLightboxOpen(true);
                                  }}
                                />
                              ))}
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td>{rec.inspectorName || "-"}</td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            className={styles.btnActionPdf}
                            onClick={() => handleOpenRecordPdf(rec)}
                            style={{ marginRight: "6px" }}
                          >
                            📄 PDF
                          </button>
                          <button
                            type="button"
                            className={styles.btnDelete}
                            onClick={() => handleDelete(rec.id)}
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── Lightbox Modal ─── */}
      {lightboxOpen && (
        <div className={styles.lightboxOverlay} onClick={() => setLightboxOpen(false)}>
          <div className={styles.lightboxContent} onClick={(e) => e.stopPropagation()}>
            <img
              src={lightboxPhotos[lightboxIndex]}
              alt={`Foto ${lightboxIndex + 1}`}
              className={styles.lightboxImage}
            />
            {lightboxCaption && <div className={styles.lightboxCaption}>{lightboxCaption}</div>}

            {lightboxPhotos.length > 1 && (
              <>
                <button
                  type="button"
                  className={`${styles.lightboxNavBtn} ${styles.lightboxPrev}`}
                  onClick={() =>
                    setLightboxIndex((prev) => (prev > 0 ? prev - 1 : lightboxPhotos.length - 1))
                  }
                >
                  ‹
                </button>
                <button
                  type="button"
                  className={`${styles.lightboxNavBtn} ${styles.lightboxNext}`}
                  onClick={() =>
                    setLightboxIndex((prev) => (prev < lightboxPhotos.length - 1 ? prev + 1 : 0))
                  }
                >
                  ›
                </button>
              </>
            )}

            <button
              type="button"
              className={styles.lightboxCloseBtn}
              onClick={() => setLightboxOpen(false)}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ─── PDF Document Print / Export Modal ─── */}
      {pdfPreviewData && (
        <InspeksiPdfView
          data={pdfPreviewData}
          onClose={() => setPdfPreviewData(null)}
        />
      )}
    </div>
  );
}
