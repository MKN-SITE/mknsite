"use client";

import { useEffect, useRef, useState } from "react";
import { api, getAvatarUrl, type PortalUser } from "@/lib/api";
import styles from "./handover-workspace.module.css";

export interface HandoverRecord {
  id: number;
  handoverDate: string;
  description: string;
  photos: string[];
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  creatorName?: string | null;
  creatorKpcId?: string | null;
  creatorDivision?: string | null;
  creatorAvatar?: string | null;
}

interface HandoverWorkspaceProps {
  user?: PortalUser | null;
}

export function HandoverWorkspace({ user }: HandoverWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<"create" | "report">("create");

  // Form states
  const [handoverDate, setHandoverDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [description, setDescription] = useState<string>("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Report / List states
  const [records, setRecords] = useState<HandoverRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [startDateFilter, setStartDateFilter] = useState<string>("");
  const [endDateFilter, setEndDateFilter] = useState<string>("");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Lightbox Modal state
  const [lightboxOpen, setLightboxOpen] = useState<boolean>(false);
  const [lightboxPhotos, setLightboxPhotos] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number>(0);
  const [lightboxCaption, setLightboxCaption] = useState<string>("");

  // Update file previews when files change
  useEffect(() => {
    const urls = selectedFiles.map((file) => URL.createObjectURL(file));
    setFilePreviews(urls);

    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [selectedFiles]);

  // Fetch list of records
  const fetchRecords = async () => {
    setLoadingRecords(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      if (startDateFilter) params.set("startDate", startDateFilter);
      if (endDateFilter) params.set("endDate", endDateFilter);

      const qs = params.toString() ? `?${params.toString()}` : "";
      const res = await api<{ success: boolean; data: HandoverRecord[] }>(`/ops-telco/handovers${qs}`);
      if (res.success && Array.isArray(res.data)) {
        setRecords(res.data);
      }
    } catch (err: any) {
      console.error("Gagal memuat daftar serah terima:", err);
    } finally {
      setLoadingRecords(false);
    }
  };

  useEffect(() => {
    if (activeTab === "report") {
      fetchRecords();
    }
  }, [activeTab, searchQuery, startDateFilter, endDateFilter]);

  // Handle file addition
  const handleAddFiles = (newFiles: FileList | File[]) => {
    const validFiles: File[] = [];
    for (let i = 0; i < newFiles.length; i++) {
      const file = newFiles[i];
      if (file.type.startsWith("image/")) {
        validFiles.push(file);
      }
    }
    if (validFiles.length > 0) {
      setSelectedFiles((prev) => [...prev, ...validFiles]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleAddFiles(e.dataTransfer.files);
    }
  };

  // Submit new handover form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    if (!handoverDate) {
      setSubmitError("Tanggal serah terima wajib diisi.");
      return;
    }

    if (!description.trim()) {
      setSubmitError("Keterangan serah terima wajib diisi.");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("handoverDate", handoverDate);
      formData.append("description", description.trim());

      for (const file of selectedFiles) {
        formData.append("photos", file);
      }

      const res = await api<{ success: boolean; message?: string; data: HandoverRecord }>("/ops-telco/handovers", {
        method: "POST",
        body: formData
      });

      if (res.success) {
        setSubmitSuccess("Laporan serah terima berhasil disimpan!");
        setDescription("");
        setSelectedFiles([]);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    } catch (err: any) {
      setSubmitError(err.message || "Gagal menyimpan laporan serah terima.");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete record
  const handleDeleteRecord = async (id: number) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus catatan serah terima ini?")) {
      return;
    }

    try {
      await api(`/ops-telco/handovers/${id}`, { method: "DELETE" });
      setRecords((prev) => prev.filter((r) => r.id !== id));
    } catch (err: any) {
      alert(err.message || "Gagal menghapus laporan serah terima.");
    }
  };

  // Open Lightbox
  const openLightbox = (photos: string[], index: number, caption: string) => {
    setLightboxPhotos(photos);
    setLightboxIndex(index);
    setLightboxCaption(caption);
    setLightboxOpen(true);
  };

  // Keyboard navigation for Lightbox
  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowLeft") {
        setLightboxIndex((prev) => (prev > 0 ? prev - 1 : prev));
      }
      if (e.key === "ArrowRight") {
        setLightboxIndex((prev) => (prev < lightboxPhotos.length - 1 ? prev + 1 : prev));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxOpen, lightboxPhotos.length]);

  // Statistics calculation
  const totalRecords = records.length;
  const totalPhotos = records.reduce((acc, curr) => acc + (curr.photos?.length || 0), 0);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const thisMonthRecords = records.filter((r) => r.handoverDate?.startsWith(currentMonth)).length;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric"
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className={styles.container}>
      {/* ─── Header ─── */}
      <div className={styles.headerArea}>
        <div className={styles.titleRow}>
          <div>
            <h1 className={styles.mainTitle}>
              <span>📦</span> Laporan Serah Terima
            </h1>
            <p className={styles.mainSubtitle}>
              Pencatatan dan arsip serah terima perangkat, material, serta hasil pekerjaan operasional telekomunikasi.
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className={styles.tabNav}>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === "create" ? styles.tabBtnActive : ""}`}
              onClick={() => setActiveTab("create")}
            >
              <span>✏️</span> Buat Laporan
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === "report" ? styles.tabBtnActive : ""}`}
              onClick={() => setActiveTab("report")}
            >
              <span>📋</span> Catatan & Riwayat
              {totalRecords > 0 && <span className={styles.tabBadge}>{totalRecords}</span>}
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statTitle}>
              <span>📑</span> Total Serah Terima
            </span>
            <span className={styles.statValue}>{totalRecords}</span>
            <span className={styles.statDesc}>Dokumentasi serah terima tercatat</span>
          </div>
          <div className={`${styles.statCard} ${styles.statCardPhotos}`}>
            <span className={styles.statTitle}>
              <span>🖼️</span> Total Foto Bukti
            </span>
            <span className={styles.statValue}>{totalPhotos}</span>
            <span className={styles.statDesc}>Foto fisik perangkat & pekerjaan</span>
          </div>
          <div className={`${styles.statCard} ${styles.statCardMonth}`}>
            <span className={styles.statTitle}>
              <span>📅</span> Periode Bulan Ini
            </span>
            <span className={styles.statValue}>{thisMonthRecords}</span>
            <span className={styles.statDesc}>Laporan serah terima bulan ini</span>
          </div>
        </div>
      </div>

      {/* ─── TAB 1: Buat Laporan ─── */}
      {activeTab === "create" && (
        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <h2 className={styles.formTitle}>Formulir Serah Terima Baru</h2>
            <p className={styles.formSubtitle}>
              Isi tanggal, uraian serah terima (barang/pekerjaan), dan lampirkan foto fisik secara bersamaan.
            </p>
          </div>

          {submitSuccess && (
            <div className={styles.alertSuccess}>
              <div>
                <strong>Berhasil!</strong> {submitSuccess}
              </div>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => {
                  setSubmitSuccess(null);
                  setActiveTab("report");
                }}
              >
                Lihat di Riwayat &rarr;
              </button>
            </div>
          )}

          {submitError && (
            <div className={styles.alertError}>
              <strong>Gagal:</strong> {submitError}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Tanggal Serah Terima */}
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="handoverDate">
                Tanggal Serah Terima <span className={styles.requiredStar}>*</span>
              </label>
              <input
                id="handoverDate"
                type="date"
                className={styles.inputField}
                value={handoverDate}
                onChange={(e) => setHandoverDate(e.target.value)}
                required
              />
            </div>

            {/* Keterangan Serah Terima */}
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="handoverDescription">
                Keterangan / Uraian Serah Terima <span className={styles.requiredStar}>*</span>
              </label>
              <textarea
                id="handoverDescription"
                className={styles.textareaField}
                placeholder="Contoh: Serah terima Bracket Antenna 7 ea, Cambium 1 ea, Rocket 1 ea ke Pak Mursalim Bintang 2 dalam kondisi baik..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            {/* Upload Foto (Multi File) */}
            <div className={styles.formGroup}>
              <label className={styles.label}>
                Dokumentasi Foto Serah Terima (Bisa lebih dari 1 foto sekaligus)
              </label>

              {/* Dropzone */}
              <div
                className={`${styles.dropzone} ${isDragging ? styles.dropzoneActive : ""}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className={styles.dropzoneIcon}>📷</div>
                <div className={styles.dropzoneTitle}>Klik untuk pilih foto atau seret foto ke sini</div>
                <div className={styles.dropzoneHint}>
                  Mendukung format JPG, PNG, WEBP. Dapat memilih banyak foto sekaligus.
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  className={styles.hiddenFileInput}
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleAddFiles(e.target.files);
                    }
                  }}
                />
              </div>

              {/* Preview Selected Photos */}
              {selectedFiles.length > 0 && (
                <div>
                  <div style={{ fontSize: "0.85rem", color: "#94a3b8", marginTop: "0.5rem" }}>
                    {selectedFiles.length} foto terpilih:
                  </div>
                  <div className={styles.previewGrid}>
                    {selectedFiles.map((file, idx) => (
                      <div key={idx} className={styles.previewCard}>
                        {filePreviews[idx] && (
                          <img
                            src={filePreviews[idx]}
                            alt={`Preview ${idx + 1}`}
                            className={styles.previewImage}
                          />
                        )}
                        <button
                          type="button"
                          className={styles.removePhotoBtn}
                          title="Hapus foto ini"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFile(idx);
                          }}
                        >
                          &times;
                        </button>
                        <div className={styles.previewInfo}>
                          {file.name} ({(file.size / 1024).toFixed(0)} KB)
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => {
                  setDescription("");
                  setSelectedFiles([]);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                disabled={submitting}
              >
                Reset Form
              </button>
              <button type="submit" className={styles.btnPrimary} disabled={submitting}>
                {submitting ? "Menyimpan..." : "💾 Simpan Laporan Serah Terima"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── TAB 2: Catatan & Riwayat ─── */}
      {activeTab === "report" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Toolbar & Filters */}
          <div className={styles.toolbarCard}>
            <div className={styles.filterControls}>
              <input
                type="text"
                placeholder="Cari keterangan, nama, atau ID karyawan..."
                className={styles.searchInput}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Dari:</span>
                <input
                  type="date"
                  className={styles.dateFilterInput}
                  value={startDateFilter}
                  onChange={(e) => setStartDateFilter(e.target.value)}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Sampai:</span>
                <input
                  type="date"
                  className={styles.dateFilterInput}
                  value={endDateFilter}
                  onChange={(e) => setEndDateFilter(e.target.value)}
                />
              </div>
              {(searchQuery || startDateFilter || endDateFilter) && (
                <button
                  type="button"
                  className={styles.btnSecondary}
                  style={{ padding: "0.4rem 0.75rem", fontSize: "0.8rem" }}
                  onClick={() => {
                    setSearchQuery("");
                    setStartDateFilter("");
                    setEndDateFilter("");
                  }}
                >
                  Reset Filter
                </button>
              )}
            </div>

            {/* View Mode Switcher */}
            <div className={styles.viewModeToggle}>
              <button
                type="button"
                className={`${styles.viewModeBtn} ${viewMode === "grid" ? styles.viewModeBtnActive : ""}`}
                onClick={() => setViewMode("grid")}
              >
                <span>🗂️</span> Card
              </button>
              <button
                type="button"
                className={`${styles.viewModeBtn} ${viewMode === "table" ? styles.viewModeBtnActive : ""}`}
                onClick={() => setViewMode("table")}
              >
                <span>📊</span> Tabel
              </button>
            </div>
          </div>

          {/* Loading Indicator */}
          {loadingRecords && (
            <div style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>
              Memuat data serah terima...
            </div>
          )}

          {/* Empty State */}
          {!loadingRecords && records.length === 0 && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📦</div>
              <div className={styles.emptyTitle}>Belum Ada Catatan Serah Terima</div>
              <p className={styles.emptyDesc}>
                Belum ada data laporan serah terima yang tersimpan untuk filter saat ini. Buat laporan baru melalui tab
                "Buat Laporan".
              </p>
              <button
                type="button"
                className={styles.btnPrimary}
                style={{ marginTop: "0.5rem" }}
                onClick={() => setActiveTab("create")}
              >
                + Buat Laporan Baru
              </button>
            </div>
          )}

          {/* Grid / Card View */}
          {!loadingRecords && viewMode === "grid" && records.length > 0 && (
            <div className={styles.recordsList}>
              {records.map((item) => (
                <div key={item.id} className={styles.recordCard}>
                  {/* Header Row */}
                  <div className={styles.recordHeader}>
                    <div className={styles.dateBadge}>
                      <span>📅</span> {formatDate(item.handoverDate)}
                    </div>

                    <div className={styles.creatorInfo}>
                      {item.creatorAvatar ? (
                        <img
                          src={getAvatarUrl(item.creatorAvatar)}
                          alt={item.creatorName || "Pelapor"}
                          className={styles.creatorAvatar}
                        />
                      ) : (
                        <div className={styles.creatorAvatar}>
                          {(item.creatorName || "P").charAt(0)}
                        </div>
                      )}
                      <div>
                        <strong style={{ color: "#f8fafc" }}>{item.creatorName || "Karyawan"}</strong>
                        {item.creatorKpcId && (
                          <span style={{ marginLeft: "0.4rem", color: "#64748b" }}>({item.creatorKpcId})</span>
                        )}
                        {item.creatorDivision && (
                          <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{item.creatorDivision}</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <div className={styles.recordDescription}>{item.description}</div>

                  {/* Photo Gallery */}
                  {item.photos && item.photos.length > 0 && (
                    <div className={styles.gallerySection}>
                      <span className={styles.galleryLabel}>
                        <span>📷</span> Dokumentasi ({item.photos.length} Foto) — Klik untuk memperbesar
                      </span>
                      <div className={styles.photoGrid}>
                        {item.photos.map((photoUrl, pIdx) => (
                          <div
                            key={pIdx}
                            className={styles.photoThumb}
                            onClick={() => openLightbox(item.photos, pIdx, item.description)}
                          >
                            <img
                              src={getAvatarUrl(photoUrl)}
                              alt={`Dokumentasi ${pIdx + 1}`}
                              className={styles.photoThumbImg}
                              loading="lazy"
                            />
                            <div className={styles.photoOverlay}>🔍</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Footer */}
                  <div className={styles.recordFooter}>
                    <span>
                      Dicatat pada: {new Date(item.createdAt).toLocaleString("id-ID")}
                    </span>

                    {(user?.id === item.createdBy ||
                      user?.roles?.some((r) =>
                        ["administrator", "Administrator", "superadmin", "Superadministrator", "ops-telco-supervisor"].includes(r)
                      )) && (
                      <button
                        type="button"
                        className={styles.btnDeleteRecord}
                        onClick={() => handleDeleteRecord(item.id)}
                        title="Hapus Laporan Serah Terima"
                      >
                        <span>🗑️</span> Hapus
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Table View */}
          {!loadingRecords && viewMode === "table" && records.length > 0 && (
            <div className={styles.tableCard}>
              <table className={styles.recordsTable}>
                <thead>
                  <tr>
                    <th style={{ width: "50px" }}>No</th>
                    <th style={{ width: "140px" }}>Tanggal</th>
                    <th style={{ width: "200px" }}>Pelapor</th>
                    <th>Keterangan Serah Terima</th>
                    <th style={{ width: "160px" }}>Dokumentasi Foto</th>
                    <th style={{ width: "80px", textAlign: "center" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((item, index) => (
                    <tr key={item.id}>
                      <td style={{ color: "#64748b" }}>{index + 1}</td>
                      <td>
                        <strong style={{ color: "#38bdf8" }}>{formatDate(item.handoverDate)}</strong>
                      </td>
                      <td>
                        <div>
                          <strong>{item.creatorName || "-"}</strong>
                          {item.creatorKpcId && (
                            <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{item.creatorKpcId}</div>
                          )}
                        </div>
                      </td>
                      <td style={{ whiteSpace: "pre-wrap", maxWidth: "450px" }}>{item.description}</td>
                      <td>
                        {item.photos && item.photos.length > 0 ? (
                          <div style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
                            {item.photos.slice(0, 3).map((photoUrl, pIdx) => (
                              <img
                                key={pIdx}
                                src={getAvatarUrl(photoUrl)}
                                alt="Thumb"
                                style={{
                                  width: "36px",
                                  height: "36px",
                                  borderRadius: "4px",
                                  objectFit: "cover",
                                  cursor: "pointer"
                                }}
                                onClick={() => openLightbox(item.photos, pIdx, item.description)}
                              />
                            ))}
                            {item.photos.length > 3 && (
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  background: "rgba(255,255,255,0.1)",
                                  padding: "0.2rem 0.4rem",
                                  borderRadius: "4px",
                                  cursor: "pointer"
                                }}
                                onClick={() => openLightbox(item.photos, 3, item.description)}
                              >
                                +{item.photos.length - 3}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: "#64748b", fontSize: "0.8rem" }}>Tanpa foto</span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {(user?.id === item.createdBy ||
                          user?.roles?.some((r) =>
                            ["administrator", "Administrator", "superadmin", "Superadministrator", "ops-telco-supervisor"].includes(r)
                          )) && (
                          <button
                            type="button"
                            className={styles.btnDeleteRecord}
                            onClick={() => handleDeleteRecord(item.id)}
                            title="Hapus Catatan"
                          >
                            🗑️
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── Lightbox Modal ─── */}
      {lightboxOpen && lightboxPhotos.length > 0 && (
        <div className={styles.lightboxModal} onClick={() => setLightboxOpen(false)}>
          <div className={styles.lightboxHeader} onClick={(e) => e.stopPropagation()}>
            <div className={styles.lightboxCounter}>
              Foto {lightboxIndex + 1} dari {lightboxPhotos.length}
            </div>
            <div className={styles.lightboxActions}>
              <a
                href={getAvatarUrl(lightboxPhotos[lightboxIndex])}
                target="_blank"
                rel="noreferrer"
                className={styles.lightboxBtn}
                title="Buka / Unduh foto resolusi asli"
                download
              >
                ⬇️
              </a>
              <button
                type="button"
                className={styles.lightboxBtn}
                onClick={() => setLightboxOpen(false)}
                title="Tutup (Esc)"
              >
                &times;
              </button>
            </div>
          </div>

          <div className={styles.lightboxBody} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.lightboxNavBtn}
              onClick={() => setLightboxIndex((prev) => (prev > 0 ? prev - 1 : prev))}
              disabled={lightboxIndex === 0}
              title="Foto Sebelumnya"
            >
              &#10094;
            </button>

            <div className={styles.lightboxImageContainer}>
              <img
                src={getAvatarUrl(lightboxPhotos[lightboxIndex])}
                alt={`Lightbox view ${lightboxIndex + 1}`}
                className={styles.lightboxImage}
              />
            </div>

            <button
              type="button"
              className={styles.lightboxNavBtn}
              onClick={() => setLightboxIndex((prev) => (prev < lightboxPhotos.length - 1 ? prev + 1 : prev))}
              disabled={lightboxIndex === lightboxPhotos.length - 1}
              title="Foto Selanjutnya"
            >
              &#10095;
            </button>
          </div>

          <div className={styles.lightboxFooter} onClick={(e) => e.stopPropagation()}>
            {lightboxCaption && <p style={{ margin: 0 }}>{lightboxCaption}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
