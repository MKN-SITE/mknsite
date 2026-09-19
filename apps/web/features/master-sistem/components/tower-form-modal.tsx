"use client";

import React, { useState } from "react";
import { api } from "@/lib/api";
import styles from "./master-sistem-app.module.css";
import type { MasterTowerDto } from "./tower-list-workspace";

interface TowerFormModalProps {
  initialData?: MasterTowerDto | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function TowerFormModal({ initialData, onClose, onSuccess }: TowerFormModalProps) {
  const isEdit = Boolean(initialData);

  const [towerName, setTowerName] = useState(initialData?.towerName || "");
  const [towerType, setTowerType] = useState(initialData?.towerType || "SST");
  const [height, setHeight] = useState(initialData?.height || "30 m");
  const [locationKecamatan, setLocationKecamatan] = useState(initialData?.locationKecamatan || "Sangatta");
  const [locationKabupaten, setLocationKabupaten] = useState(initialData?.locationKabupaten || "Kutai Timur");
  const [locationProvince, setLocationProvince] = useState(initialData?.locationProvince || "Kal-Tim");
  const [latitude, setLatitude] = useState(initialData?.latitude || "");
  const [longitude, setLongitude] = useState(initialData?.longitude || "");
  const [altitude, setAltitude] = useState(initialData?.altitude || "");
  const [operationalStatus, setOperationalStatus] = useState(initialData?.operationalStatus || "Aktif");
  const [description, setDescription] = useState(initialData?.description || "");

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!towerName.trim()) {
      setErrorMsg("Nama menara (Tower Name) wajib diisi.");
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    const payload = {
      towerName: towerName.trim(),
      towerType,
      height: height.trim() || undefined,
      locationKecamatan: locationKecamatan.trim() || undefined,
      locationKabupaten: locationKabupaten.trim() || undefined,
      locationProvince: locationProvince.trim() || undefined,
      latitude: latitude.trim() || undefined,
      longitude: longitude.trim() || undefined,
      altitude: altitude.trim() || undefined,
      operationalStatus,
      description: description.trim() || undefined
    };

    try {
      if (isEdit && initialData) {
        await api(`/master/towers/${initialData.id}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
      } else {
        await api("/master/towers", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || "Gagal menyimpan data menara.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <div style={{ fontSize: "0.75rem", color: "#818cf8", fontWeight: 700, textTransform: "uppercase" }}>
              {isEdit ? "Perbarui Data Menara" : "Registrasi Menara Baru"}
            </div>
            <h2 className={styles.modalTitle}>
              {isEdit ? `Edit Tower: ${initialData?.towerName}` : "Tambah Tower Telekomunikasi"}
            </h2>
          </div>
          <button type="button" className={styles.modalCloseBtn} onClick={onClose} aria-label="Tutup">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            {errorMsg && (
              <div style={{ padding: "0.75rem", background: "rgba(239, 68, 68, 0.15)", color: "#f87171", borderRadius: "0.5rem", fontSize: "0.825rem" }}>
                ⚠️ {errorMsg}
              </div>
            )}

            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Nama Menara (Tower Name) *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Surya, Far North, Pinang..."
                  className={styles.formInput}
                  value={towerName}
                  onChange={(e) => setTowerName(e.target.value)}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Tipe Struktur Menara</label>
                <select
                  className={styles.formSelect}
                  value={towerType}
                  onChange={(e) => setTowerType(e.target.value)}
                >
                  <option value="SST">SST (Self-Supporting Tower)</option>
                  <option value="Guy Wire Triangle">Guy Wire Triangle</option>
                  <option value="Monopole">Monopole</option>
                  <option value="Transportable Tower">Transportable Tower (Pit Portable)</option>
                  <option value="Rooftop Pole">Rooftop Pole</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Tinggi Menara (Height)</label>
                <input
                  type="text"
                  placeholder="Contoh: 30 m, 45 m, 82 m"
                  className={styles.formInput}
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Status Operasional</label>
                <select
                  className={styles.formSelect}
                  value={operationalStatus}
                  onChange={(e) => setOperationalStatus(e.target.value)}
                >
                  <option value="Aktif">Aktif</option>
                  <option value="Maintenance">Maintenance / Perbaikan</option>
                  <option value="Non-Aktif">Non-Aktif / Dismantled</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Kecamatan</label>
                <input
                  type="text"
                  placeholder="Contoh: Sangatta, Bengalon..."
                  className={styles.formInput}
                  value={locationKecamatan}
                  onChange={(e) => setLocationKecamatan(e.target.value)}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Kabupaten & Provinsi</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  <input
                    type="text"
                    placeholder="Kabupaten"
                    className={styles.formInput}
                    value={locationKabupaten}
                    onChange={(e) => setLocationKabupaten(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Provinsi"
                    className={styles.formInput}
                    value={locationProvince}
                    onChange={(e) => setLocationProvince(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Koordinat Latitude (Lintang)</label>
                <input
                  type="text"
                  placeholder="Contoh: 000 33' 11.6&quot; N atau 0.553222"
                  className={styles.formInput}
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Koordinat Longitude (Bujur)</label>
                <input
                  type="text"
                  placeholder="Contoh: 1170 29' 00.0&quot; E atau 117.483333"
                  className={styles.formInput}
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Elevasi / Ketinggian (Altitude)</label>
                <input
                  type="text"
                  placeholder="Contoh: 188 m dpl"
                  className={styles.formInput}
                  value={altitude}
                  onChange={(e) => setAltitude(e.target.value)}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Catatan / Deskripsi Tambahan</label>
                <input
                  type="text"
                  placeholder="Catatan akses site, shelter, atau coverage link..."
                  className={styles.formInput}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button type="button" className={styles.btnSecondary} onClick={onClose} disabled={saving}>
              Batal
            </button>
            <button type="submit" className={styles.btnPrimary} disabled={saving}>
              {saving ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Tambah Menara"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
