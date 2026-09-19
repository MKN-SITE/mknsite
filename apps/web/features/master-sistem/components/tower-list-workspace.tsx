"use client";

import React, { useEffect, useMemo, useState } from "react";
import { api, type PortalUser } from "@/lib/api";
import styles from "./master-sistem-app.module.css";
import { TowerPhotoGalleryModal, type TowerDetailData } from "./tower-photo-gallery-modal";
import { TowerFormModal } from "./tower-form-modal";

export interface MasterTowerDto {
  id: number;
  towerNo: number | null;
  towerCode: string;
  towerName: string;
  towerType: string | null;
  height: string | null;
  heightMeters: number | null;
  locationKecamatan: string | null;
  locationKabupaten: string | null;
  locationProvince: string | null;
  latitude: string | null;
  longitude: string | null;
  altitude: string | null;
  latitudeDec: string | null;
  longitudeDec: string | null;
  operationalStatus: string;
  description: string | null;
  primaryPhotoUrl: string | null;
  photosCount?: number;
  createdAt: string;
  updatedAt: string;
}

interface TowerListWorkspaceProps {
  user: PortalUser;
}

export function TowerListWorkspace({ user }: TowerListWorkspaceProps) {
  const [towers, setTowers] = useState<MasterTowerDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [uploadingExcel, setUploadingExcel] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [kecamatanFilter, setKecamatanFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Modal states
  const [galleryTower, setGalleryTower] = useState<TowerDetailData | null>(null);
  const [formTower, setFormTower] = useState<MasterTowerDto | null | "NEW">(null);

  const fetchTowers = async () => {
    setLoading(true);
    try {
      const res = await api<{ success: boolean; data: MasterTowerDto[] }>("/master/towers");
      if (res.success && Array.isArray(res.data)) {
        setTowers(res.data);
      }
    } catch (err) {
      console.error("Gagal memuat daftar menara:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTowers();
  }, []);

  const handleSyncExcel = async () => {
    setSyncing(true);
    try {
      const res = await api<{ success: boolean; message: string; imported: number }>("/master/towers/sync-excel", {
        method: "POST"
      });
      alert(res.message || "Sinkronisasi berhasil.");
      await fetchTowers();
    } catch (err: any) {
      alert(err?.message || "Gagal menyinkronkan data dari file Excel.");
    } finally {
      setSyncing(false);
    }
  };

  const handleUploadExcel = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.name.endsWith(".xls") && !file.name.endsWith(".xlsx")) {
      alert("Harap pilih berkas berekstensi .xls atau .xlsx");
      return;
    }

    setUploadingExcel(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api<{ success: boolean; message: string; imported: number }>("/master/towers/upload-excel", {
        method: "POST",
        body: formData
      });
      alert(res.message || "Berkas Excel berhasil diunggah dan seluruh menara disinkronkan.");
      await fetchTowers();
    } catch (err: any) {
      alert(err?.message || "Gagal mengunggah dan menyinkronkan berkas Excel.");
    } finally {
      setUploadingExcel(false);
    }
  };

  const handleDeleteTower = async (id: number, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus data menara "${name}"?`)) return;

    try {
      await api(`/master/towers/${id}`, { method: "DELETE" });
      setTowers((prev) => prev.filter((t) => t.id !== id));
    } catch (err: any) {
      alert(err?.message || "Gagal menghapus menara.");
    }
  };

  const handleCopyCoords = (tower: MasterTowerDto) => {
    const text = tower.latitude && tower.longitude ? `${tower.latitude}, ${tower.longitude}` : `${tower.latitudeDec}, ${tower.longitudeDec}`;
    navigator.clipboard.writeText(text);
    setCopiedId(tower.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportCsv = () => {
    if (towers.length === 0) return;
    const headers = [
      "No",
      "Tower Name",
      "Type",
      "Height",
      "Kecamatan",
      "Kabupaten",
      "Province",
      "Latitude",
      "Longitude",
      "Altitude",
      "Latitude Decimal",
      "Longitude Decimal",
      "Status",
      "Total Photos"
    ];

    const rows = towers.map((t) => [
      t.towerNo ?? "",
      `"${t.towerName.replace(/"/g, '""')}"`,
      `"${(t.towerType || "").replace(/"/g, '""')}"`,
      `"${(t.height || "").replace(/"/g, '""')}"`,
      `"${(t.locationKecamatan || "").replace(/"/g, '""')}"`,
      `"${(t.locationKabupaten || "").replace(/"/g, '""')}"`,
      `"${(t.locationProvince || "").replace(/"/g, '""')}"`,
      `"${(t.latitude || "").replace(/"/g, '""')}"`,
      `"${(t.longitude || "").replace(/"/g, '""')}"`,
      `"${(t.altitude || "").replace(/"/g, '""')}"`,
      t.latitudeDec ?? "",
      t.longitudeDec ?? "",
      t.operationalStatus,
      t.photosCount ?? 0
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Master_Towers_MKN_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered list
  const filteredTowers = useMemo(() => {
    return towers.filter((t) => {
      const matchSearch =
        !search.trim() ||
        t.towerName.toLowerCase().includes(search.toLowerCase()) ||
        t.towerCode.toLowerCase().includes(search.toLowerCase()) ||
        (t.locationKecamatan && t.locationKecamatan.toLowerCase().includes(search.toLowerCase())) ||
        (t.towerType && t.towerType.toLowerCase().includes(search.toLowerCase()));

      const matchType = typeFilter === "ALL" || t.towerType === typeFilter;
      const matchKecamatan = kecamatanFilter === "ALL" || t.locationKecamatan === kecamatanFilter;

      return matchSearch && matchType && matchKecamatan;
    });
  }, [towers, search, typeFilter, kecamatanFilter]);

  // Metric counts
  const stats = useMemo(() => {
    const total = towers.length;
    const sst = towers.filter((t) => t.towerType === "SST").length;
    const guyWireOrMonopole = towers.filter((t) => t.towerType === "Guy Wire Triangle" || t.towerType === "Monopole").length;
    const transportable = towers.filter((t) => t.towerType === "Transportable Tower").length;
    return { total, sst, guyWireOrMonopole, transportable };
  }, [towers]);

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Header Banner */}
      <div className={styles.headerBanner}>
        <div>
          <div className={styles.headerKicker}>Inventarisasi Aset Lapangan</div>
          <h1 className={styles.headerTitle}>Daftar Menara Telekomunikasi (Tower)</h1>
          <p className={styles.headerDesc}>
            Data master spesifikasi tinggi, tipe struktur menara telekomunikasi, koordinat GPS terverifikasi, elevasi, dan
            dokumentasi galeri foto site operasional Sangatta & Bengalon.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={handleSyncExcel}
            disabled={syncing}
            title="Muat ulang sinkronisasi dari file Tower Coordinat1.xls"
          >
            <span>🔄</span>
            <span>{syncing ? "Menyinkronkan..." : "Sinkron Excel Master"}</span>
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => setFormTower("NEW")}
          >
            <span>➕</span>
            <span>Tambah Tower Baru</span>
          </button>
        </div>
      </div>

      {/* Excel Master Source Card */}
      <div className={styles.excelSourceCard}>
        <div className={styles.excelSourceLeft}>
          <span className={styles.excelFileIcon}>📊</span>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
              <span style={{ fontWeight: 700, color: "#ffffff", fontSize: "0.95rem" }}>Sumber Data File Master:</span>
              <code className={styles.excelFilePath}>Tower Coordinat1.xls</code>
              <span className={styles.excelSyncedBadge}>✓ 15 Menara Terimpor</span>
            </div>
            <p className={styles.excelSourceDesc}>
              Seluruh data koordinat, elevasi, tinggi, dan tipe struktur menara disinkronkan langsung dari sheet <strong>Tower</strong> pada arsip master template <code>form-templates/Master/Tower Coordinat1.xls</code>.
            </p>
          </div>
        </div>
        <div className={styles.excelSourceActions}>
          <a
            href="/api-backend/master/towers/download-excel"
            download="Tower Coordinat1.xls"
            className={`${styles.btnSecondary} ${styles.btnExcelDownload}`}
            title="Unduh berkas asli Tower Coordinat1.xls dari server"
          >
            <span>📥</span>
            <span>Unduh File Asli Excel</span>
          </a>
          <label
            className={styles.btnSecondary}
            style={{ cursor: "pointer" }}
            title="Unggah berkas Excel baru untuk memperbarui seluruh data menara"
          >
            <span>📤</span>
            <span>{uploadingExcel ? "Mengunggah..." : "Upload Excel Baru"}</span>
            <input
              type="file"
              accept=".xls,.xlsx"
              style={{ display: "none" }}
              onChange={(e) => handleUploadExcel(e.target.files)}
              disabled={uploadingExcel}
            />
          </label>
        </div>
      </div>

      {/* Metrics Row */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statIconBox} style={{ background: "rgba(79, 70, 229, 0.15)", color: "#818cf8" }}>
            🗼
          </div>
          <div>
            <div className={styles.statValue}>{stats.total}</div>
            <div className={styles.statLabel}>Total Menara Terdata</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIconBox} style={{ background: "rgba(14, 165, 233, 0.15)", color: "#38bdf8" }}>
            🏗️
          </div>
          <div>
            <div className={styles.statValue}>{stats.sst}</div>
            <div className={styles.statLabel}>Self-Supporting (SST)</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIconBox} style={{ background: "rgba(234, 179, 8, 0.15)", color: "#facc15" }}>
            📐
          </div>
          <div>
            <div className={styles.statValue}>{stats.guyWireOrMonopole}</div>
            <div className={styles.statLabel}>Guy Wire / Monopole</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIconBox} style={{ background: "rgba(34, 197, 94, 0.15)", color: "#4ade80" }}>
            🚛
          </div>
          <div>
            <div className={styles.statValue}>{stats.transportable}</div>
            <div className={styles.statLabel}>Transportable Tower</div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <input
            type="text"
            placeholder="Cari nama menara, kode, tipe, lokasi..."
            className={styles.searchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className={styles.filterSelect}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="ALL">Semua Tipe Struktur</option>
            <option value="SST">SST (Self-Supporting)</option>
            <option value="Guy Wire Triangle">Guy Wire Triangle</option>
            <option value="Monopole">Monopole</option>
            <option value="Transportable Tower">Transportable Tower</option>
          </select>

          <select
            className={styles.filterSelect}
            value={kecamatanFilter}
            onChange={(e) => setKecamatanFilter(e.target.value)}
          >
            <option value="ALL">Semua Wilayah / Kecamatan</option>
            <option value="Sangatta">Sangatta</option>
            <option value="Bengalon">Bengalon</option>
          </select>
        </div>

        <div className={styles.toolbarRight}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={handleExportCsv}
            title="Unduh seluruh data menara ke format CSV"
          >
            <span>📥</span>
            <span>Ekspor CSV</span>
          </button>

          <div className={styles.viewToggle}>
            <button
              type="button"
              className={`${styles.viewToggleBtn} ${viewMode === "grid" ? styles.viewToggleBtnActive : ""}`}
              onClick={() => setViewMode("grid")}
              title="Tampilan Kartu Galeri"
            >
              ⊞ Grid
            </button>
            <button
              type="button"
              className={`${styles.viewToggleBtn} ${viewMode === "table" ? styles.viewToggleBtnActive : ""}`}
              onClick={() => setViewMode("table")}
              title="Tampilan Tabel Data"
            >
              ☰ Tabel
            </button>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "4rem 1rem", color: "#94a3b8" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>⏳</div>
          Sedang memuat data master menara telekomunikasi...
        </div>
      ) : filteredTowers.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem 1rem", color: "#64748b", background: "rgba(15, 23, 42, 0.4)", borderRadius: "1rem" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🔍</div>
          Tidak ditemukan menara yang cocok dengan filter pencarian.
        </div>
      ) : viewMode === "grid" ? (
        /* Grid Card View */
        <div className={styles.towerGrid}>
          {filteredTowers.map((tower) => {
            const hasCoords = Boolean(tower.latitudeDec && tower.longitudeDec);
            const mapsUrl = hasCoords
              ? `https://www.google.com/maps/search/?api=1&query=${tower.latitudeDec},${tower.longitudeDec}`
              : null;

            return (
              <div key={tower.id} className={styles.towerCard}>
                {/* Card Cover Image with Click to open gallery */}
                <div
                  className={styles.towerCardImgWrapper}
                  onClick={() => setGalleryTower(tower as TowerDetailData)}
                  title="Klik untuk membuka galeri foto tower"
                >
                  {tower.primaryPhotoUrl ? (
                    <img src={tower.primaryPhotoUrl} alt={tower.towerName} className={styles.towerCardImg} />
                  ) : (
                    <div className={styles.towerCardImgPlaceholder}>
                      <span style={{ fontSize: "2.5rem" }}>🗼</span>
                      <span>Belum ada foto dokumentasi</span>
                    </div>
                  )}

                  <span className={styles.towerNoBadge}>
                    No. {tower.towerNo || "-"}
                  </span>

                  <span className={styles.towerPhotoCountBadge}>
                    📷 {tower.photosCount || 0} Foto
                  </span>
                </div>

                {/* Card Body */}
                <div className={styles.towerCardBody}>
                  <div className={styles.towerCardHeader}>
                    <div>
                      <h3 className={styles.towerName}>{tower.towerName}</h3>
                      <div className={styles.towerLocation}>
                        <span>📍</span>
                        <span>
                          {tower.locationKecamatan || "-"}, {tower.locationKabupaten || "Kutai Timur"} ({tower.locationProvince || "Kal-Tim"})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.towerTags}>
                    <span className={styles.typeBadge}>{tower.towerType || "SST"}</span>
                    <span className={styles.heightBadge}>Tinggi: {tower.height || "-"}</span>
                    <span className={styles.statusBadge}>{tower.operationalStatus}</span>
                  </div>

                  {/* Coordinates Box */}
                  <div className={styles.coordBox}>
                    <div className={styles.coordRow}>
                      <span className={styles.coordLabel}>Latitude</span>
                      <span className={styles.coordValue}>{tower.latitude || (tower.latitudeDec ? `${tower.latitudeDec}°` : "-")}</span>
                    </div>
                    <div className={styles.coordRow}>
                      <span className={styles.coordLabel}>Longitude</span>
                      <span className={styles.coordValue}>{tower.longitude || (tower.longitudeDec ? `${tower.longitudeDec}°` : "-")}</span>
                    </div>
                    <div className={styles.coordRow}>
                      <span className={styles.coordLabel}>Elevasi</span>
                      <span className={styles.coordValue}>{tower.altitude || "-"}</span>
                    </div>
                  </div>

                  {/* Card Bottom Actions */}
                  <div className={styles.towerCardActions}>
                    <div style={{ display: "flex", gap: "0.35rem" }}>
                      {mapsUrl && (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`${styles.cardActionBtn} ${styles.btnMap}`}
                          title="Buka lokasi di Google Maps"
                        >
                          🗺️ Maps
                        </a>
                      )}
                      <button
                        type="button"
                        className={`${styles.cardActionBtn} ${styles.btnCopy}`}
                        onClick={() => handleCopyCoords(tower)}
                        title="Salin koordinat GPS"
                      >
                        📋 {copiedId === tower.id ? "Tersalin!" : "Salin GPS"}
                      </button>
                    </div>

                    <div style={{ display: "flex", gap: "0.35rem" }}>
                      <button
                        type="button"
                        className={`${styles.cardActionBtn} ${styles.btnGallery}`}
                        onClick={() => setGalleryTower(tower as TowerDetailData)}
                        title="Buka galeri dan unggah foto"
                      >
                        📸 Galeri
                      </button>
                      <button
                        type="button"
                        className={`${styles.cardActionBtn} ${styles.btnEdit}`}
                        onClick={() => setFormTower(tower)}
                        title="Edit data menara"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        className={`${styles.cardActionBtn} ${styles.btnEdit}`}
                        onClick={() => handleDeleteTower(tower.id, tower.towerName)}
                        title="Hapus data menara"
                        style={{ color: "#f87171" }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: "50px" }}>No</th>
                <th style={{ width: "60px" }}>Foto</th>
                <th>Nama Menara</th>
                <th>Tipe</th>
                <th>Tinggi</th>
                <th>Lokasi</th>
                <th>Koordinat Latitude</th>
                <th>Koordinat Longitude</th>
                <th>Elevasi</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredTowers.map((tower) => {
                const hasCoords = Boolean(tower.latitudeDec && tower.longitudeDec);
                const mapsUrl = hasCoords
                  ? `https://www.google.com/maps/search/?api=1&query=${tower.latitudeDec},${tower.longitudeDec}`
                  : null;

                return (
                  <tr key={tower.id}>
                    <td style={{ fontWeight: 700, color: "#94a3b8" }}>{tower.towerNo || "-"}</td>
                    <td>
                      {tower.primaryPhotoUrl ? (
                        <img
                          src={tower.primaryPhotoUrl}
                          alt={tower.towerName}
                          className={styles.tableThumb}
                          onClick={() => setGalleryTower(tower as TowerDetailData)}
                        />
                      ) : (
                        <div
                          className={styles.tableThumb}
                          onClick={() => setGalleryTower(tower as TowerDetailData)}
                          title="Klik untuk tambah foto"
                        >
                          🗼
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: "#ffffff", fontSize: "0.95rem" }}>{tower.towerName}</div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{tower.towerCode}</div>
                    </td>
                    <td>
                      <span className={styles.typeBadge}>{tower.towerType || "SST"}</span>
                    </td>
                    <td style={{ fontWeight: 600, color: "#facc15" }}>{tower.height || "-"}</td>
                    <td>
                      <div style={{ color: "#cbd5e1" }}>{tower.locationKecamatan || "-"}</div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{tower.locationKabupaten || "Kutai Timur"}</div>
                    </td>
                    <td style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "#94a3b8" }}>
                      {tower.latitude || (tower.latitudeDec ? `${tower.latitudeDec}°` : "-")}
                    </td>
                    <td style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "#94a3b8" }}>
                      {tower.longitude || (tower.longitudeDec ? `${tower.longitudeDec}°` : "-")}
                    </td>
                    <td style={{ color: "#e2e8f0", fontWeight: 600 }}>{tower.altitude || "-"}</td>
                    <td>
                      <span className={styles.statusBadge}>{tower.operationalStatus}</span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "0.35rem" }}>
                        {mapsUrl && (
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${styles.cardActionBtn} ${styles.btnMap}`}
                            title="Buka di Google Maps"
                          >
                            🗺️
                          </a>
                        )}
                        <button
                          type="button"
                          className={`${styles.cardActionBtn} ${styles.btnGallery}`}
                          onClick={() => setGalleryTower(tower as TowerDetailData)}
                          title="Buka Galeri Foto"
                        >
                          📷 {tower.photosCount || 0}
                        </button>
                        <button
                          type="button"
                          className={`${styles.cardActionBtn} ${styles.btnEdit}`}
                          onClick={() => setFormTower(tower)}
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          className={`${styles.cardActionBtn} ${styles.btnEdit}`}
                          onClick={() => handleDeleteTower(tower.id, tower.towerName)}
                          title="Hapus"
                          style={{ color: "#f87171" }}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Gallery Modal */}
      {galleryTower && (
        <TowerPhotoGalleryModal
          tower={galleryTower}
          onClose={() => setGalleryTower(null)}
          onRefresh={fetchTowers}
        />
      )}

      {/* Form Modal */}
      {formTower && (
        <TowerFormModal
          initialData={formTower === "NEW" ? null : formTower}
          onClose={() => setFormTower(null)}
          onSuccess={fetchTowers}
        />
      )}
    </div>
  );
}
