"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { PortalWorkspaceLayout } from "@/components/layout/portal-workspace-layout";
import { api, ApiError, type PortalUser } from "@/lib/api";
import styles from "./ik-sop-app.module.css";

export interface SubCategoryItem {
  id: string;
  name: string;
  category: string;
  relPath: string;
  count: number;
}

export interface CategoryItem {
  id: string;
  name: string;
  description: string;
  subcategories: SubCategoryItem[];
}

export interface DocumentItem {
  id: string;
  filename: string;
  title: string;
  category: string;
  categoryName: string;
  subCategory: string;
  subCategoryName: string;
  relPath: string;
  size: number;
  extension: string;
  modifiedAt: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  } catch {
    return iso;
  }
}

function getFileBadge(ext: string) {
  const e = ext.toLowerCase();
  if (e === "pdf") return { label: "PDF", cls: styles.fileBadgePdf };
  if (["doc", "docx"].includes(e)) return { label: "DOC", cls: styles.fileBadgeWord };
  if (["xls", "xlsx", "csv"].includes(e)) return { label: "XLS", cls: styles.fileBadgeExcel };
  if (["ppt", "pptx"].includes(e)) return { label: "PPT", cls: styles.fileBadgePpt };
  return { label: e.toUpperCase().slice(0, 3) || "FILE", cls: styles.fileBadgeDefault };
}

export function IkSopApp({
  initialCategory = "ik-mkn",
  initialSubCategory = "telco"
}: {
  initialCategory?: string;
  initialSubCategory?: string;
}) {
  const router = useRouter();
  const [user, setUser] = useState<PortalUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const [tree, setTree] = useState<CategoryItem[]>([]);
  const [activeCat, setActiveCat] = useState<string>(initialCategory);
  const [activeSub, setActiveSub] = useState<string>(initialSubCategory);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [search, setSearch] = useState("");

  // Preview & Upload Modal
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCat, setUploadCat] = useState(initialCategory);
  const [uploadSub, setUploadSub] = useState(initialSubCategory);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Authenticate user
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      api<{ user: PortalUser }>("/auth/me", { signal: controller.signal }),
      api<{ data: CategoryItem[] }>("/ik-sop/tree", { signal: controller.signal })
    ])
      .then(([session, treeRes]) => {
        setUser(session.user);
        setTree(treeRes.data);
      })
      .catch((reason) => {
        if (reason instanceof ApiError && reason.status === 401) {
          return router.replace("/login");
        }
        if (reason?.name !== "AbortError") {
          setError("Gagal memuat portal IK & SOP.");
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [router]);

  // 2. Fetch documents when active subcategory changes
  const loadDocuments = async (cat: string, sub: string, q = "") => {
    setLoadingDocs(true);
    try {
      const queryParams = new URLSearchParams();
      if (cat) queryParams.set("category", cat);
      if (sub) queryParams.set("subCategory", sub);
      if (q) queryParams.set("search", q);

      const res = await api<{ data: DocumentItem[] }>(`/ik-sop/documents?${queryParams.toString()}`);
      setDocuments(res.data);
    } catch {
      // keep previous docs or empty
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    if (!loading && user) {
      loadDocuments(activeCat, activeSub, search);
    }
  }, [activeCat, activeSub, search, loading, user]);

  const refreshTree = async () => {
    try {
      const res = await api<{ data: CategoryItem[] }>("/ik-sop/tree");
      setTree(res.data);
      await loadDocuments(activeCat, activeSub, search);
    } catch {}
  };

  async function logout() {
    setLoggingOut(true);
    try {
      await api("/auth/logout", { method: "POST" });
      router.replace("/login");
    } finally {
      setLoggingOut(false);
    }
  }

  // Handle file upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError("Pilih file dokumen yang akan diunggah.");
      return;
    }
    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("category", uploadCat);
      formData.append("subCategory", uploadSub);
      formData.append("file", uploadFile);

      const res = await fetch("/api-backend/ik-sop/upload", {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || "Gagal mengunggah dokumen.");
      }

      setUploadOpen(false);
      setUploadFile(null);
      await refreshTree();
    } catch (err: any) {
      setUploadError(err.message || "Terjadi kesalahan saat mengunggah.");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <main className="loading-page" aria-label="Memuat IK & SOP">
        <div className="loading-block" />
        <div className="loading-block short" />
      </main>
    );
  }

  if (error || !user) {
    return (
      <main className={styles.errorPage}>
        <div className={styles.errorCard}>
          <span>IK & SOP</span>
          <h1>Akses tidak tersedia</h1>
          <p>{error ?? "Sesi pengguna tidak tersedia."}</p>
          <Link href="/portal">Kembali ke Portal</Link>
        </div>
      </main>
    );
  }

  const currentCategory = tree.find((c) => c.id === activeCat);
  const currentSub = currentCategory?.subcategories.find((s) => s.id === activeSub);

  return (
    <PortalWorkspaceLayout
      user={user}
      portalTitle="IK & SOP"
      portalSubtitle="Instruksi Kerja & Standar Prosedur"
      portalIcon="📚"
      portalColor="amber"
      breadcrumbs={[
        { label: "IK & SOP", href: "/portal/ik-sop" },
        ...(currentCategory ? [{ label: currentCategory.name }] : []),
        ...(currentSub ? [{ label: currentSub.name }] : [])
      ]}
      sidebarGroups={tree.map((cat) => ({
        group: cat.name,
        items: cat.subcategories.map((sub) => ({
          id: `${cat.id}-${sub.id}`,
          title: sub.name,
          badge: sub.name.slice(0, 2).toUpperCase(),
          description: `${sub.count} Dokumen`,
          tag: sub.count > 0 ? `${sub.count}` : undefined,
          isActive: activeCat === cat.id && activeSub === sub.id,
          onClick: () => {
            setActiveCat(cat.id);
            setActiveSub(sub.id);
          }
        }))
      }))}
      sidebarFooterLinks={[
        {
          href: "/portal/ops-telco",
          label: "Buka Portal OPS Telco →",
          icon: <span>📡</span>
        },
        {
          href: "/portal/master-sistem",
          label: "Buka Master Sistem →",
          icon: <span>🏢</span>
        },
        {
          href: "/portal/helpdesk",
          label: "Buka Portal Helpdesk →",
          icon: <span>🎧</span>
        }
      ]}
      onLogout={logout}
      loggingOut={loggingOut}
      headerEyebrow="Knowledge & Standards"
      headerTitle="IK & SOP"
      headerDescription="Pusat Instruksi Kerja MKN dan Prosedur Standar Kaltim Prima Coal (KPC)."
    >
      <section className={styles.contentArea}>
              <div className={styles.contentHeader}>
                <div>
                  <p className={styles.kicker}>
                    {currentCategory?.name || "IK & SOP"} &rsaquo; {currentSub?.name || "Semua"}
                  </p>
                  <h2 className={styles.contentTitle}>
                    {currentSub ? `${currentCategory?.name} — ${currentSub.name}` : "Daftar Dokumen"}
                  </h2>
                  <p className={styles.contentDesc}>
                    {currentCategory?.description || "Standar operasional dan instruksi kerja lapangan."}
                  </p>
                </div>
              </div>

              {/* Toolbar */}
              <div className={styles.toolbar}>
                <div className={styles.searchBox}>
                  <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    className={styles.searchInput}
                    placeholder={`Cari dokumen di ${currentSub?.name || "folder"}...`}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {search && (
                    <button type="button" className={styles.clearSearch} onClick={() => setSearch("")}>
                      &times;
                    </button>
                  )}
                </div>

                <div className={styles.actionButtons}>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={refreshTree}
                    title="Pindai ulang folder penyimpanan"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                    </svg>
                    Refresh
                  </button>

                  <button
                    type="button"
                    className={styles.btnPrimary}
                    onClick={() => {
                      setUploadCat(activeCat);
                      setUploadSub(activeSub);
                      setUploadOpen(true);
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                    </svg>
                    Upload Dokumen
                  </button>
                </div>
              </div>

              {/* Documents Grid */}
              {loadingDocs ? (
                <div style={{ padding: "40px 0", textAlign: "center", color: "#64748b" }}>
                  Memindai dokumen...
                </div>
              ) : documents.length > 0 ? (
                <div className={styles.docGrid}>
                  {documents.map((doc) => {
                    const badge = getFileBadge(doc.extension);
                    const fileUrl = `/api-backend/ik-sop/documents/file?path=${encodeURIComponent(doc.relPath)}`;
                    const downloadUrl = `${fileUrl}&download=1`;

                    return (
                      <article className={styles.docCard} key={doc.id}>
                        <div className={styles.docTop}>
                          <span className={`${styles.fileBadge} ${badge.cls}`}>{badge.label}</span>
                          <div className={styles.docMeta}>
                            <h3 className={styles.docTitle} title={doc.filename}>
                              {doc.title}
                            </h3>
                            <div className={styles.docSub}>
                              <span className={styles.docPath}>{doc.subCategoryName}</span>
                              <span>&bull;</span>
                              <span>{formatBytes(doc.size)}</span>
                              <span>&bull;</span>
                              <span>{formatDate(doc.modifiedAt)}</span>
                            </div>
                          </div>
                        </div>

                        <div className={styles.docBottom}>
                          <div className={styles.docActions}>
                            <button
                              type="button"
                              className={styles.btnPreview}
                              onClick={() => setPreviewDoc(doc)}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                              Lihat Dokumen
                            </button>

                            <a
                              href={downloadUrl}
                              className={styles.btnDownload}
                              title="Unduh file asli"
                              download={doc.filename}
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                              </svg>
                            </a>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>📄</div>
                  <h3>Belum ada dokumen di kategori ini</h3>
                  <p>
                    Anda dapat menaruh file dokumen (PDF, Word, Excel) langsung ke folder penyimpanan fisik di:
                  </p>
                  <div className={styles.folderHint}>
                    storage/ik-sop/{activeCat}/{activeSub}/
                  </div>
                  <p style={{ marginTop: "12px" }}>
                    Atau gunakan tombol di bawah untuk mengunggah dokumen langsung melalui website.
                  </p>
                  <div className={styles.emptyActions}>
                    <button
                      type="button"
                      className={styles.btnPrimary}
                      onClick={() => {
                        setUploadCat(activeCat);
                        setUploadSub(activeSub);
                        setUploadOpen(true);
                      }}
                    >
                      Upload Dokumen Sekarang
                    </button>
                  </div>
                </div>
              )}
      </section>

      {/* Document Preview Modal */}
      {previewDoc && (
        <div className={styles.modalOverlay} onClick={() => setPreviewDoc(null)}>
          <div className={styles.previewModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.previewHeader}>
              <div className={styles.previewTitleWrap}>
                <span style={{ fontSize: "18px" }}>📄</span>
                <h4 className={styles.previewTitle}>{previewDoc.filename}</h4>
              </div>
              <div className={styles.previewActions}>
                <a
                  href={`/api-backend/ik-sop/documents/file?path=${encodeURIComponent(previewDoc.relPath)}&download=1`}
                  className={styles.btnSecondary}
                  style={{ height: "32px", fontSize: "12px", background: "#ffffff22", color: "#fff", borderColor: "transparent" }}
                  download={previewDoc.filename}
                >
                  Unduh File
                </a>
                <button
                  type="button"
                  className={styles.btnModalClose}
                  onClick={() => setPreviewDoc(null)}
                  title="Tutup"
                >
                  &times;
                </button>
              </div>
            </div>

            <div className={styles.previewBody}>
              {previewDoc.extension.toLowerCase() === "pdf" ? (
                <iframe
                  src={`/api-backend/ik-sop/documents/file?path=${encodeURIComponent(previewDoc.relPath)}#toolbar=1`}
                  className={styles.previewIframe}
                  title={previewDoc.filename}
                />
              ) : ["jpg", "jpeg", "png"].includes(previewDoc.extension.toLowerCase()) ? (
                <div style={{ width: "100%", height: "100%", overflow: "auto", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", background: "#334155" }}>
                  <img
                    src={`/api-backend/ik-sop/documents/file?path=${encodeURIComponent(previewDoc.relPath)}`}
                    alt={previewDoc.filename}
                    style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: "8px", boxShadow: "0 10px 30px rgba(0,0,0,0.35)", background: "#fff" }}
                  />
                </div>
              ) : (
                <div className={styles.previewFallback}>
                  <div style={{ fontSize: "40px", marginBottom: "12px" }}>📑</div>
                  <h4>Format {previewDoc.extension.toUpperCase()}</h4>
                  <p>
                    Format file ini lebih optimal dibuka menggunakan aplikasi desktop (Microsoft Word / Excel).
                  </p>
                  <a
                    href={`/api-backend/ik-sop/documents/file?path=${encodeURIComponent(previewDoc.relPath)}&download=1`}
                    className={styles.btnPrimary}
                    download={previewDoc.filename}
                  >
                    Unduh Dokumen
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {uploadOpen && (
        <div className={styles.modalOverlay} onClick={() => !uploading && setUploadOpen(false)}>
          <div className={styles.uploadModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.uploadHeader}>
              <h3>Unggah Dokumen IK & SOP</h3>
              <button
                type="button"
                className={styles.btnModalClose}
                onClick={() => !uploading && setUploadOpen(false)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleUploadSubmit}>
              <div className={styles.uploadBody}>
                {uploadError && (
                  <div style={{ padding: "10px 14px", color: "#dc2626", background: "#fef2f2", borderRadius: "8px", fontSize: "13px" }}>
                    {uploadError}
                  </div>
                )}

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Kategori Utama</label>
                  <select
                    className={styles.formSelect}
                    value={uploadCat}
                    onChange={(e) => {
                      const newCat = e.target.value;
                      setUploadCat(newCat);
                      const catDef = tree.find((c) => c.id === newCat);
                      if (catDef && catDef.subcategories.length > 0) {
                        setUploadSub(catDef.subcategories[0].id);
                      }
                    }}
                    disabled={uploading}
                  >
                    {tree.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Subkategori / Bagian</label>
                  <select
                    className={styles.formSelect}
                    value={uploadSub}
                    onChange={(e) => setUploadSub(e.target.value)}
                    disabled={uploading}
                  >
                    {tree
                      .find((c) => c.id === uploadCat)
                      ?.subcategories.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Pilih File Dokumen</label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: "none" }}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.txt"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setUploadFile(e.target.files[0]);
                      }
                    }}
                  />
                  {uploadFile ? (
                    <div className={styles.selectedFile}>
                      <span>📄 {uploadFile.name} ({formatBytes(uploadFile.size)})</span>
                      <button
                        type="button"
                        style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontWeight: "bold" }}
                        onClick={() => setUploadFile(null)}
                      >
                        Hapus
                      </button>
                    </div>
                  ) : (
                    <div
                      className={styles.dropZone}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <svg className={styles.dropZoneIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                      </svg>
                      <p className={styles.dropZoneText}>Klik untuk memilih file dokumen</p>
                      <p className={styles.dropZoneHint}>Format didukung: PDF, Word, Excel, PowerPoint (Maks. 50 MB)</p>
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.uploadFooter}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setUploadOpen(false)}
                  disabled={uploading}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  disabled={uploading || !uploadFile}
                >
                  {uploading ? "Mengunggah..." : "Simpan Dokumen"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PortalWorkspaceLayout>
  );
}
