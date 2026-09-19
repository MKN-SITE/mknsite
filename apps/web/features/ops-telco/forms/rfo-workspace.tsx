"use client";

import { useEffect, useState, useMemo } from "react";
import { API_URL, api, type PortalUser } from "@/lib/api";
import styles from "./rfo-workspace.module.css";

export interface RfoItem {
  id: number;
  ticketNumber: string;
  problemId?: number | null;
  companyId?: number | null;
  deviceId?: number | null;
  rfoDate: string;
  startTime: string;
  endTime: string;
  cause: string;
  impact: string;
  solution: string;
  status: string;
  notes?: string | null;
  createdBy: number;
  createdAt: string;
  companyName?: string | null;
  deviceName?: string | null;
  deviceLocation?: string | null;
  creatorName?: string | null;
}

export interface KpiCompanyOption {
  id: number;
  name: string;
  devices: { id: number; deviceName: string; location?: string | null }[];
}

export function RfoWorkspace({ user }: { user: PortalUser }) {
  const [rfos, setRfos] = useState<RfoItem[]>([]);
  const [companies, setCompanies] = useState<KpiCompanyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>("all");

  // Notification Banner
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingRfo, setEditingRfo] = useState<RfoItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    ticketNumber: "",
    problemId: null as number | null,
    companyId: null as number | null,
    deviceId: null as number | null,
    rfoDate: new Date().toISOString().slice(0, 10),
    startTime: "",
    endTime: "",
    cause: "",
    impact: "",
    solution: "",
    status: "",
    notes: ""
  });

  // Load RFO list
  const loadRfos = async () => {
    setLoading(true);
    try {
      const res = await api<{ success: boolean; data: RfoItem[] }>("/ops-telco/rfo");
      if (res.success && Array.isArray(res.data)) {
        setRfos(res.data);
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Gagal memuat daftar RFO." });
    } finally {
      setLoading(false);
    }
  };

  // Load Companies for Dropdown
  const loadCompanies = async () => {
    try {
      const res = await api<{ data: KpiCompanyOption[] }>("/ops-telco/kpi/companies");
      if (res.data) {
        setCompanies(res.data);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadRfos();
    loadCompanies();
  }, []);

  // Filtered RFOs
  const filteredRfos = useMemo(() => {
    return rfos.filter((item) => {
      const matchSearch =
        searchTerm.trim() === "" ||
        item.ticketNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.cause.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.impact.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.solution.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.deviceName && item.deviceName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.companyName && item.companyName.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchCompany =
        selectedCompanyFilter === "all" ||
        String(item.companyId) === selectedCompanyFilter;

      return matchSearch && matchCompany;
    });
  }, [rfos, searchTerm, selectedCompanyFilter]);

  // Next ticket auto-fetch
  const fetchNextTicket = async (date: string) => {
    try {
      const res = await api<{ success: boolean; data: { ticketNumber: string } }>(
        `/ops-telco/rfo/next-ticket?date=${date}`
      );
      if (res.success && res.data?.ticketNumber) {
        setFormData((prev) => ({ ...prev, ticketNumber: res.data.ticketNumber }));
      }
    } catch {
      // fallback
    }
  };

  // Open Create Modal
  const handleOpenCreate = async () => {
    setEditingRfo(null);
    const today = new Date().toISOString().slice(0, 10);
    setFormData({
      ticketNumber: "",
      problemId: null,
      companyId: null,
      deviceId: null,
      rfoDate: today,
      startTime: "",
      endTime: "",
      cause: "",
      impact: "",
      solution: "",
      status: "",
      notes: ""
    });
    setShowModal(true);
    await fetchNextTicket(today);
  };

  // Open Edit Modal
  const handleOpenEdit = (item: RfoItem) => {
    setEditingRfo(item);
    setFormData({
      ticketNumber: item.ticketNumber,
      problemId: item.problemId || null,
      companyId: item.companyId || null,
      deviceId: item.deviceId || null,
      rfoDate: item.rfoDate,
      startTime: item.startTime,
      endTime: item.endTime,
      cause: item.cause,
      impact: item.impact,
      solution: item.solution,
      status: item.status,
      notes: item.notes || ""
    });
    setShowModal(true);
  };

  // Save (Create / Update)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.rfoDate || !formData.startTime || !formData.endTime || !formData.cause || !formData.impact || !formData.solution || !formData.status) {
      setMessage({ type: "error", text: "Mohon lengkapi semua kolom wajib." });
      return;
    }

    setSubmitting(true);
    try {
      if (editingRfo) {
        await api(`/ops-telco/rfo/${editingRfo.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData)
        });
        setMessage({ type: "success", text: `Laporan RFO ${formData.ticketNumber} berhasil diperbarui.` });
      } else {
        await api("/ops-telco/rfo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData)
        });
        setMessage({ type: "success", text: `Laporan RFO baru ${formData.ticketNumber} berhasil diterbitkan.` });
      }
      setShowModal(false);
      loadRfos();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Gagal menyimpan laporan RFO." });
    } finally {
      setSubmitting(false);
    }
  };

  // Delete RFO
  const handleDelete = async (id: number, ticket: string) => {
    if (!confirm(`Yakin ingin menghapus laporan RFO tiket ${ticket}?`)) return;

    try {
      await api(`/ops-telco/rfo/${id}`, { method: "DELETE" });
      setMessage({ type: "success", text: `Laporan RFO ${ticket} berhasil dihapus.` });
      loadRfos();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Gagal menghapus laporan RFO." });
    }
  };

  // Download PDF
  const handleDownloadPdf = (id: number, ticket: string) => {
    const url = `${API_URL}/ops-telco/rfo/${id}/pdf`;
    window.open(url, "_blank");
  };

  // Current devices for selected company in modal
  const modalDevices = useMemo(() => {
    if (!formData.companyId) return [];
    const comp = companies.find((c) => c.id === formData.companyId);
    return comp ? comp.devices : [];
  }, [formData.companyId, companies]);

  return (
    <div className={styles.container}>
      {/* ─── Header ─── */}
      <div className={styles.headerArea}>
        <div className={styles.titleRow}>
          <div>
            <div className={styles.mainTitle}>
              <span>📄</span> Reason For Outage (RFO) Reports
            </div>
            <div className={styles.mainSubtitle}>
              Manajemen laporan resmi gangguan internet & intranet telekomunikasi dengan output PDF presisi.
            </div>
          </div>
          <button className={styles.btnPrimary} onClick={handleOpenCreate}>
            <span>➕</span> Buat Laporan RFO
          </button>
        </div>

        {/* Global Alert Notification */}
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

      {/* ─── Summary Cards ─── */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statTitle}>
            <span>📊</span> Total RFO Diterbitkan
          </div>
          <div className={styles.statValue}>{rfos.length}</div>
          <div className={styles.statDesc}>Akumulasi seluruh laporan gangguan</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTitle}>
            <span>🔗</span> Terhubung KPI Sangatta
          </div>
          <div className={styles.statValue}>
            {rfos.filter((r) => r.problemId != null).length}
          </div>
          <div className={styles.statDesc}>RFO terkait catatan downtime bulanan KPI</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTitle}>
            <span>📅</span> RFO Bulan Ini
          </div>
          <div className={styles.statValue}>
            {
              rfos.filter((r) => {
                const now = new Date();
                const d = new Date(r.rfoDate);
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
              }).length
            }
          </div>
          <div className={styles.statDesc}>Insiden dilaporkan pada bulan berjalan</div>
        </div>
      </div>

      {/* ─── Filter Bar ─── */}
      <div className={styles.filterCard}>
        <div className={styles.filterInputs}>
          <div className={styles.filterGroup} style={{ flex: 2 }}>
            <label>Pencarian</label>
            <input
              type="text"
              className={styles.textInput}
              placeholder="Cari nomor tiket, penyebab, akibat, perangkat..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className={styles.filterGroup}>
            <label>Perusahaan Klien</label>
            <select
              className={styles.selectInput}
              value={selectedCompanyFilter}
              onChange={(e) => setSelectedCompanyFilter(e.target.value)}
            >
              <option value="all">Semua Perusahaan</option>
              {companies.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button className={styles.btnSecondary} onClick={loadRfos} disabled={loading}>
          {loading ? "Memuat..." : "🔄 Segarkan"}
        </button>
      </div>

      {/* ─── Data Table ─── */}
      <div className={styles.tableCard}>
        <div className={styles.tableTitleBar}>
          <div className={styles.tableTitle}>
            <span>📋</span> Daftar Dokumen RFO
          </div>
          <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
            Menampilkan {filteredRfos.length} dari {rfos.length} tiket
          </span>
        </div>

        <div className={styles.tableContainer}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th style={{ width: "40px" }}>No</th>
                <th>Nomor Tiket</th>
                <th>Tanggal Kejadian</th>
                <th>Waktu Kejadian</th>
                <th>Penyebab & Akibat</th>
                <th>Solusi & Status</th>
                <th>Terkait KPI / Klien</th>
                <th style={{ width: "160px", textAlign: "center" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredRfos.length > 0 ? (
                filteredRfos.map((item, idx) => (
                  <tr key={item.id}>
                    <td>{idx + 1}</td>
                    <td>
                      <span className={styles.ticketBadge}>{item.ticketNumber}</span>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{item.rfoDate}</td>
                    <td style={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                      <div>
                        <strong>Mulai:</strong> {item.startTime}
                      </div>
                      <div style={{ marginTop: "0.2rem" }}>
                        <strong>Akhir:</strong> {item.endTime}
                      </div>
                    </td>
                    <td>
                      <div style={{ color: "#ffffff", fontWeight: "600" }}>{item.cause}</div>
                      <div style={{ fontSize: "0.8rem", color: "#f87171", marginTop: "0.2rem" }}>
                        ⚡ {item.impact}
                      </div>
                    </td>
                    <td>
                      <div style={{ color: "#93c5fd" }}>🔧 {item.solution}</div>
                      <div style={{ fontSize: "0.8rem", color: "#34d399", marginTop: "0.2rem" }}>
                        ✓ {item.status}
                      </div>
                    </td>
                    <td>
                      {item.companyName ? (
                        <div>
                          <strong>{item.companyName}</strong>
                          {item.deviceName && (
                            <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                              {item.deviceName}
                            </div>
                          )}
                          {item.problemId && (
                            <span className={styles.kpiTag}>✓ Masalah KPI</span>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: "#64748b", fontSize: "0.8rem" }}>Mandiri</span>
                      )}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <div style={{ display: "flex", gap: "0.4rem", justifyContent: "center", flexWrap: "wrap" }}>
                        <button
                          className={styles.btnPdf}
                          onClick={() => handleDownloadPdf(item.id, item.ticketNumber)}
                          title="Download Dokumen PDF Resmi"
                        >
                          📄 PDF
                        </button>
                        <button
                          className={styles.btnSecondary}
                          style={{ padding: "0.35rem 0.65rem", fontSize: "0.775rem" }}
                          onClick={() => handleOpenEdit(item)}
                          title="Edit RFO"
                        >
                          ✏️
                        </button>
                        <button
                          className={styles.btnDanger}
                          onClick={() => handleDelete(item.id, item.ticketNumber)}
                          title="Hapus RFO"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "3rem", color: "#94a3b8" }}>
                    {loading ? "Memuat dokumen RFO..." : "Belum ada laporan RFO yang sesuai filter."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Create / Edit Modal ─── */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => !submitting && setShowModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                <span>{editingRfo ? "✏️ Edit Laporan RFO" : "📄 Buat Laporan RFO Baru"}</span>
              </div>
              <button
                className={styles.modalClose}
                onClick={() => !submitting && setShowModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className={styles.modalBody}>
                <div className={styles.formGrid}>
                  {/* Nomor Tiket */}
                  <div className={styles.formGroup}>
                    <label>
                      Nomor Gangguan <span className={styles.required}>*</span>
                    </label>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <input
                        type="text"
                        className={styles.textInput}
                        style={{ flex: 1, fontFamily: "monospace" }}
                        placeholder="Contoh: 20260516001"
                        value={formData.ticketNumber}
                        onChange={(e) => setFormData({ ...formData, ticketNumber: e.target.value })}
                        required
                      />
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        onClick={() => fetchNextTicket(formData.rfoDate)}
                        title="Auto-generate nomor tiket berdasarkan tanggal"
                        style={{ padding: "0.4rem 0.75rem", fontSize: "0.8rem" }}
                      >
                        🔄 Auto
                      </button>
                    </div>
                    <span className={styles.hint}>Format output PDF: YYYYMMDD/XXX</span>
                  </div>

                  {/* Tanggal Kejadian */}
                  <div className={styles.formGroup}>
                    <label>
                      Tanggal Kejadian <span className={styles.required}>*</span>
                    </label>
                    <input
                      type="date"
                      className={styles.textInput}
                      value={formData.rfoDate}
                      onChange={(e) => {
                        const newDate = e.target.value;
                        setFormData({ ...formData, rfoDate: newDate });
                        if (!editingRfo) fetchNextTicket(newDate);
                      }}
                      required
                    />
                  </div>

                  {/* Waktu Mulai */}
                  <div className={styles.formGroup}>
                    <label>
                      Mulai Kejadian <span className={styles.required}>*</span>
                    </label>
                    <input
                      type="text"
                      className={styles.textInput}
                      placeholder="Contoh: 16 Mei 2026 13:20 WITA"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      required
                    />
                  </div>

                  {/* Waktu Akhir */}
                  <div className={styles.formGroup}>
                    <label>
                      Akhir Kejadian <span className={styles.required}>*</span>
                    </label>
                    <input
                      type="text"
                      className={styles.textInput}
                      placeholder="Contoh: 16 Mei 2026 17:35 WITA"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      required
                    />
                  </div>

                  {/* Perusahaan Terkait (Opsional) */}
                  <div className={styles.formGroup}>
                    <label>Perusahaan Klien (Opsional)</label>
                    <select
                      className={styles.selectInput}
                      value={formData.companyId || ""}
                      onChange={(e) => {
                        const cId = e.target.value ? Number(e.target.value) : null;
                        setFormData({ ...formData, companyId: cId, deviceId: null });
                      }}
                    >
                      <option value="">-- Pilih Perusahaan --</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Link / Perangkat Terkait (Opsional) */}
                  <div className={styles.formGroup}>
                    <label>Link / Perangkat (Opsional)</label>
                    <select
                      className={styles.selectInput}
                      value={formData.deviceId || ""}
                      onChange={(e) => {
                        const dId = e.target.value ? Number(e.target.value) : null;
                        setFormData({ ...formData, deviceId: dId });
                      }}
                      disabled={!formData.companyId}
                    >
                      <option value="">-- Pilih Perangkat --</option>
                      {modalDevices.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.deviceName} {d.location ? `(${d.location})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Penyebab */}
                  <div className={styles.formGroupFull}>
                    <label>
                      Penyebab (Cause) <span className={styles.required}>*</span>
                    </label>
                    <textarea
                      className={styles.textareaInput}
                      placeholder="Contoh: Link Backbone Sangatta – Bengalon Problem"
                      value={formData.cause}
                      onChange={(e) => setFormData({ ...formData, cause: e.target.value })}
                      required
                    />
                  </div>

                  {/* Akibat */}
                  <div className={styles.formGroupFull}>
                    <label>
                      Akibat (Impact) <span className={styles.required}>*</span>
                    </label>
                    <textarea
                      className={styles.textareaInput}
                      placeholder="Contoh: Layanan Internet ke Bengalon Down"
                      value={formData.impact}
                      onChange={(e) => setFormData({ ...formData, impact: e.target.value })}
                      required
                    />
                  </div>

                  {/* Solusi */}
                  <div className={styles.formGroupFull}>
                    <label>
                      Solusi (Solution) <span className={styles.required}>*</span>
                    </label>
                    <textarea
                      className={styles.textareaInput}
                      placeholder="Contoh: Penggantian Perangkat di Tower"
                      value={formData.solution}
                      onChange={(e) => setFormData({ ...formData, solution: e.target.value })}
                      required
                    />
                  </div>

                  {/* Status */}
                  <div className={styles.formGroupFull}>
                    <label>
                      Status (Resolution Status) <span className={styles.required}>*</span>
                    </label>
                    <textarea
                      className={styles.textareaInput}
                      placeholder="Contoh: Layanan Internet ke Bengalon Kembali Normal"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      required
                    />
                  </div>

                  {/* Catatan Internal */}
                  <div className={styles.formGroupFull}>
                    <label>Catatan Internal / Dokumen Referensi (Opsional)</label>
                    <textarea
                      className={styles.textareaInput}
                      style={{ minHeight: "50px" }}
                      placeholder="Catatan tambahan untuk tim internal (tidak dicetak di PDF)"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                >
                  Batal
                </button>
                <button type="submit" className={styles.btnPrimary} disabled={submitting}>
                  {submitting ? "Menyimpan..." : editingRfo ? "Simpan Perubahan" : "Terbitkan RFO"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
