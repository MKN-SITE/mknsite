"use client";

import React, { useRef, useState } from "react";
import { api } from "@/lib/api";
import styles from "./master-sistem-app.module.css";

export interface TowerPhotoItem {
  id: number;
  towerId: number;
  photoUrl: string;
  caption: string | null;
  isCover: boolean;
  uploadedBy: number | null;
  createdAt: string;
  uploaderName?: string | null;
}

export interface TowerDetailData {
  id: number;
  towerNo: number | null;
  towerCode: string;
  towerName: string;
  towerType: string | null;
  height: string | null;
  locationKecamatan: string | null;
  locationKabupaten: string | null;
  locationProvince: string | null;
  latitude: string | null;
  longitude: string | null;
  altitude: string | null;
  primaryPhotoUrl: string | null;
  photosCount?: number;
  photos?: TowerPhotoItem[];
}

interface TowerPhotoGalleryModalProps {
  tower: TowerDetailData;
  onClose: () => void;
  onRefresh: () => void;
}

export function TowerPhotoGalleryModal({ tower, onClose, onRefresh }: TowerPhotoGalleryModalProps) {
  const [photos, setPhotos] = useState<TowerPhotoItem[]>(tower.photos || []);
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchPhotos = async () => {
    try {
      const res = await api<{ success: boolean; data: TowerDetailData }>(`/master/towers/${tower.id}`);
      if (res.success && res.data.photos) {
        setPhotos(res.data.photos);
      }
    } catch {
      // Ignored
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    setErrorMsg(null);

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("photos", files[i]);
    }
    formData.append("caption", `Foto Tower ${tower.towerName}`);

    try {
      const res = await api<{ success: boolean; message?: string }>(`/master/towers/${tower.id}/photos`, {
        method: "POST",
        body: formData
      });

      if (res.success) {
        await fetchPhotos();
        onRefresh();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Gagal mengunggah foto menara.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeletePhoto = async (photoId: number) => {
    if (!confirm("Apakah Anda yakin ingin menghapus foto ini?")) return;

    try {
      const res = await api<{ success: boolean }>(`/master/towers/${tower.id}/photos/${photoId}`, {
        method: "DELETE"
      });
      if (res.success) {
        setPhotos((prev) => prev.filter((p) => p.id !== photoId));
        onRefresh();
      }
    } catch (err: any) {
      alert(err?.message || "Gagal menghapus foto.");
    }
  };

  const handleSetCover = async (photoId: number) => {
    try {
      const res = await api<{ success: boolean }>(`/master/towers/${tower.id}/photos/${photoId}/set-cover`, {
        method: "POST"
      });
      if (res.success) {
        setPhotos((prev) =>
          prev.map((p) => ({
            ...p,
            isCover: p.id === photoId
          }))
        );
        onRefresh();
      }
    } catch (err: any) {
      alert(err?.message || "Gagal mengatur foto sampul.");
    }
  };

  return (
    <>
      <div className={styles.modalOverlay} onClick={onClose}>
        <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
          <div className={styles.modalHeader}>
            <div>
              <div style={{ fontSize: "0.75rem", color: "#818cf8", fontWeight: 700, textTransform: "uppercase" }}>
                Galeri Foto & Dokumentasi Site
              </div>
              <h2 className={styles.modalTitle}>
                Tower {tower.towerName} ({tower.height || "-"})
              </h2>
            </div>
            <button type="button" className={styles.modalCloseBtn} onClick={onClose} aria-label="Tutup">
              ✕
            </button>
          </div>

          <div className={styles.modalBody}>
            {/* Upload Area */}
            <div
              className={styles.dropzone}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFileUpload(e.dataTransfer.files);
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => handleFileUpload(e.target.files)}
              />
              <span style={{ fontSize: "2rem" }}>📸</span>
              <div style={{ fontWeight: 600, color: "#ffffff", fontSize: "0.9rem" }}>
                {uploading ? "Sedang Mengunggah Foto..." : "Klik atau seret foto dokumentasi menara ke sini"}
              </div>
              <div style={{ fontSize: "0.775rem", color: "#94a3b8" }}>
                Mendukung banyak berkas foto sekaligus (JPG, PNG, WebP)
              </div>
            </div>

            {errorMsg && (
              <div style={{ padding: "0.75rem", background: "rgba(239, 68, 68, 0.15)", color: "#f87171", borderRadius: "0.5rem", fontSize: "0.825rem" }}>
                ⚠️ {errorMsg}
              </div>
            )}

            {/* Gallery Grid */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#cbd5e1" }}>
                  Koleksi Foto ({photos.length})
                </span>
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                  Klik foto untuk pratinjau resolusi tinggi
                </span>
              </div>

              {photos.length === 0 ? (
                <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: "#64748b", background: "rgba(15, 23, 42, 0.4)", borderRadius: "0.75rem" }}>
                  <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🖼️</div>
                  Belum ada foto dokumentasi untuk tower ini. Silakan unggah foto melalui area di atas.
                </div>
              ) : (
                <div className={styles.galleryGrid}>
                  {photos.map((photo) => (
                    <div key={photo.id} className={styles.galleryItem}>
                      <img
                        src={photo.photoUrl}
                        alt={photo.caption || tower.towerName}
                        className={styles.galleryImg}
                        onClick={() => setSelectedImage(photo.photoUrl)}
                      />
                      {photo.isCover && <span className={styles.galleryCoverBadge}>★ Sampul Utama</span>}
                      <div className={styles.galleryActions}>
                        {!photo.isCover && (
                          <button
                            type="button"
                            className={`${styles.galleryBtn} ${styles.galleryBtnCover}`}
                            onClick={() => handleSetCover(photo.id)}
                            title="Jadikan Foto Sampul"
                          >
                            Set Sampul
                          </button>
                        )}
                        <button
                          type="button"
                          className={styles.galleryBtn}
                          onClick={() => handleDeletePhoto(photo.id)}
                          title="Hapus Foto"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>
              Selesai & Tutup
            </button>
          </div>
        </div>
      </div>

      {/* Fullscreen Lightbox */}
      {selectedImage && (
        <div className={styles.lightboxOverlay} onClick={() => setSelectedImage(null)}>
          <button type="button" className={styles.lightboxCloseBtn} onClick={() => setSelectedImage(null)}>
            ✕
          </button>
          <img src={selectedImage} alt="Preview Tower" className={styles.lightboxImg} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}
