"use client";

import React, { useEffect, useMemo, useState } from "react";
import { API_URL, api, type PortalUser } from "@/lib/api";
import { SignaturePad } from "./signature-pad";
import type {
  OncallApprovalHistory,
  OncallJobRecord,
  OncallJobStatus
} from "./telco-form-types";
import styles from "./telco-form-workspace.module.css";

const statusMeta: Record<
  OncallJobStatus,
  { label: string; bg: string; color: string; border: string }
> = {
  draft: { label: "Draf", bg: "#f1f5f9", color: "#475569", border: "#cbd5e1" },
  technician_signing: { label: "Menunggu TTD", bg: "#e0f2fe", color: "#0369a1", border: "#bae6fd" },
  submitted: { label: "Menunggu Persetujuan", bg: "#fef3c7", color: "#b45309", border: "#fde68a" },
  revision_requested: { label: "Perlu Revisi", bg: "#ffedd5", color: "#c2410c", border: "#fed7aa" },
  approved: { label: "Disetujui", bg: "#dcfce7", color: "#15803d", border: "#bbf7d0" },
  rejected: { label: "Ditolak", bg: "#fee2e2", color: "#b91c1c", border: "#fca5a5" }
};

const DEFAULT_SPV_MASTER_SIGNATURE =
  "data:image/png;base64,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";

interface SpvMasterProfile {
  id: string;
  name: string;
  badge: string;
  title: string;
  dataUrl: string;
}

const DEFAULT_SPV_PROFILES: SpvMasterProfile[] = [
  {
    id: "spv-rahmansyah",
    name: "Rahmansyah",
    badge: "Z110997",
    title: "Supervisor OPS Telco (Baku Utama)",
    dataUrl: DEFAULT_SPV_MASTER_SIGNATURE
  }
];

function formatIndonesianDate(dateStr?: string): string {
  if (!dateStr) return "-";
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric"
        });
      }
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

function getInitials(name?: string): string {
  if (!name) return "T";
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

interface OncallApprovalPanelProps {
  user?: PortalUser | null;
}

export function OncallApprovalPanel({ user }: OncallApprovalPanelProps) {
  const [jobs, setJobs] = useState<OncallJobRecord[]>([]);
  const [selectedJob, setSelectedJob] = useState<OncallJobRecord | null>(null);
  const [activeTab, setActiveTab] = useState<"submitted" | "revision_requested" | "approved" | "rejected" | "all">("submitted");
  const [message, setMessage] = useState<{ type: "info" | "error" | "success"; text: string } | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  // Master Signature States
  const [selectedMasterId, setSelectedMasterId] = useState<string>("spv-rahmansyah");
  const [signatureMode, setSignatureMode] = useState<"master" | "manual">("master");
  const [customMaster, setCustomMaster] = useState<{ name: string; badge: string; dataUrl: string } | null>(null);
  const [saveAsCustomMaster, setSaveAsCustomMaster] = useState(false);

  // Load custom master from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("mkn_spv_custom_master_sig");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.dataUrl) {
          setCustomMaster(parsed);
        }
      }
    } catch {}
  }, []);

  const masterProfiles = useMemo(() => {
    const list = [...DEFAULT_SPV_PROFILES];
    if (customMaster) {
      list.push({
        id: "spv-custom",
        name: customMaster.name || (user?.name ?? "Supervisor"),
        badge: customMaster.badge || (user?.kpcId ?? "KPC"),
        title: "Tanda Tangan Master Kustom Saya",
        dataUrl: customMaster.dataUrl
      });
    }
    return list;
  }, [customMaster, user]);

  const activeMaster = useMemo(() => {
    return masterProfiles.find((p) => p.id === selectedMasterId) || masterProfiles[0];
  }, [masterProfiles, selectedMasterId]);

  // Modals for actions
  const [showSignPad, setShowSignPad] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState<"revision_requested" | "rejected" | null>(null);
  const [decisionNote, setDecisionNote] = useState("");

  const loadJobs = async () => {
    try {
      const res = await api<{ data: OncallJobRecord[] }>("/ops-telco/oncall-jobs");
      setJobs(res.data);
      if (selectedJob) {
        const refreshed = res.data.find((j) => j.id === selectedJob.id);
        if (refreshed) {
          const detail = await api<{ data: OncallJobRecord }>(`/ops-telco/oncall-jobs/${selectedJob.id}`);
          setSelectedJob(detail.data);
        }
      }
    } catch {
      setMessage({ type: "error", text: "Gagal memuat data persetujuan." });
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const selectJob = async (job: OncallJobRecord) => {
    setMessage(null);
    setShowSignPad(false);
    setShowNoteModal(null);
    setIsBusy(true);
    try {
      const res = await api<{ data: OncallJobRecord }>(`/ops-telco/oncall-jobs/${job.id}`);
      setSelectedJob(res.data);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Gagal memuat detail pekerjaan." });
    } finally {
      setIsBusy(false);
    }
  };

  // Tab counts
  const counts = useMemo(() => {
    return {
      submitted: jobs.filter((j) => j.status === "submitted").length,
      revision_requested: jobs.filter((j) => j.status === "revision_requested").length,
      approved: jobs.filter((j) => j.status === "approved").length,
      rejected: jobs.filter((j) => j.status === "rejected").length,
      all: jobs.length
    };
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    if (activeTab === "all") return jobs;
    return jobs.filter((j) => j.status === activeTab);
  }, [jobs, activeTab]);

  // Handler: Approve with Signature
  const handleApprove = async (dataUrl: string) => {
    if (!selectedJob) return;
    setIsBusy(true);
    setMessage(null);
    try {
      const res = await api<{ data: OncallJobRecord }>(
        `/ops-telco/oncall-jobs/${selectedJob.id}/decision`,
        {
          method: "POST",
          body: JSON.stringify({
            decision: "approved",
            signatureDataUrl: dataUrl
          })
        }
      );
      setMessage({ type: "success", text: "Pekerjaan berhasil disetujui dan ditandatangani." });
      setShowSignPad(false);
      setSelectedJob(res.data);
      await loadJobs();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Gagal menyetujui pekerjaan." });
    } finally {
      setIsBusy(false);
    }
  };

  const handleApproveWithMaster = () => {
    if (!activeMaster?.dataUrl) {
      setMessage({ type: "error", text: "Tanda tangan master belum tersedia." });
      return;
    }
    handleApprove(activeMaster.dataUrl);
  };

  const handleSaveManualAndApprove = (dataUrl: string, saveAsMaster = false) => {
    if (saveAsMaster) {
      try {
        const profile = {
          name: user?.name || "Supervisor",
          badge: user?.kpcId || "KPC",
          dataUrl
        };
        localStorage.setItem("mkn_spv_custom_master_sig", JSON.stringify(profile));
        setCustomMaster(profile);
        setSelectedMasterId("spv-custom");
      } catch {}
    }
    handleApprove(dataUrl);
  };

  // Handler: Revision or Reject with Note
  const handleDecisionWithNote = async () => {
    if (!selectedJob || !showNoteModal) return;
    const note = decisionNote.trim();
    if (note.length < 3) {
      alert("Catatan/alasan wajib diisi minimal 3 karakter.");
      return;
    }

    setIsBusy(true);
    setMessage(null);
    try {
      const res = await api<{ data: OncallJobRecord }>(
        `/ops-telco/oncall-jobs/${selectedJob.id}/decision`,
        {
          method: "POST",
          body: JSON.stringify({
            decision: showNoteModal,
            note
          })
        }
      );
      setMessage({
        type: "success",
        text: showNoteModal === "revision_requested" ? "Permintaan revisi berhasil diajukan ke PIC." : "Pekerjaan telah ditolak."
      });
      setShowNoteModal(null);
      setDecisionNote("");
      setSelectedJob(res.data);
      await loadJobs();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Gagal memproses keputusan." });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className={styles.workspace}>
      {/* Kolom Utama: Rincian Pemeriksaan & Tindakan Approval */}
      <section className={styles.editor}>
        <div className={styles.toolbar} style={{ paddingBottom: "16px", borderBottom: "1px solid #e2e8f0" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 800, color: "#0284c7", letterSpacing: "0.5px", textTransform: "uppercase" }}>
              <span>🛡️</span> Verifikasi & Persetujuan Supervisor
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "4px", flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#0f172a" }}>
                {selectedJob
                  ? selectedJob.jobOrderNo
                    ? `Job Order #${selectedJob.jobOrderNo}`
                    : `Formulir ${selectedJob.formNumber}`
                  : "Pilih Formulir untuk Diperiksa"}
              </h2>
              {selectedJob?.jobOrderNo && (
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#64748b",
                    background: "#f1f5f9",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    border: "1px solid #e2e8f0"
                  }}
                >
                  {selectedJob.formNumber}
                </span>
              )}
            </div>
          </div>

          {selectedJob && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 800,
                  padding: "6px 14px",
                  borderRadius: "20px",
                  background: statusMeta[selectedJob.status].bg,
                  color: statusMeta[selectedJob.status].color,
                  border: `1px solid ${statusMeta[selectedJob.status].border}`,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                <span
                  style={{
                    width: "7px",
                    height: "7px",
                    borderRadius: "50%",
                    background: statusMeta[selectedJob.status].color
                  }}
                />
                {statusMeta[selectedJob.status].label}
              </span>
              <a
                href={`${API_URL}/ops-telco/oncall-jobs/${selectedJob.id}/pdf`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "7px 16px",
                  borderRadius: "8px",
                  background: selectedJob.status === "approved" ? "#15803d" : "#0284c7",
                  color: "#ffffff",
                  fontSize: "12px",
                  fontWeight: 800,
                  textDecoration: "none",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                  whiteSpace: "nowrap"
                }}
              >
                <span>{selectedJob.status === "approved" ? "📥" : "📄"}</span>
                <span>{selectedJob.status === "approved" ? "Unduh PDF Final" : "Lihat Draf PDF"}</span>
              </a>
            </div>
          )}
        </div>

        {message && (
          <div
            className={styles.message}
            style={{
              background: message.type === "error" ? "#fff2f2" : message.type === "success" ? "#f0fdf4" : "#edf7fc",
              color: message.type === "error" ? "#c33030" : message.type === "success" ? "#15803d" : "#075d91",
              border: `1px solid ${message.type === "error" ? "#ffd1d1" : message.type === "success" ? "#bbf7d0" : "#c4e2f3"}`
            }}
          >
            {message.text}
          </div>
        )}

        {selectedJob ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginTop: "16px" }}>
            {/* Overview Data Bersama */}
            <div
              style={{
                background: "#ffffff",
                borderRadius: "14px",
                border: "1px solid #e2e8f0",
                padding: "20px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", paddingBottom: "10px", borderBottom: "1px solid #f1f5f9" }}>
                <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#1e293b", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>📋</span> Rincian Pelaksanaan Pekerjaan
                </h4>
                <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>
                  Data Verifikasi Form Oncall
                </span>
              </div>

              {/* Grid Mini-Metric Cards */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "12px",
                  marginBottom: "16px"
                }}
              >
                {/* Metric 1: No. Job Order */}
                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    padding: "10px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "3px"
                  }}
                >
                  <span style={{ fontSize: "10px", fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Nomor Job Order
                  </span>
                  <span style={{ fontSize: "15px", fontWeight: 800, color: "#0f172a" }}>
                    {selectedJob.jobOrderNo || "-"}
                  </span>
                </div>

                {/* Metric 2: No. Formulir */}
                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    padding: "10px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "3px"
                  }}
                >
                  <span style={{ fontSize: "10px", fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Nomor Formulir
                  </span>
                  <span style={{ fontSize: "13px", fontWeight: 800, color: "#0f172a", fontFamily: "monospace" }}>
                    {selectedJob.formNumber}
                  </span>
                </div>

                {/* Metric 3: Tanggal Pelaksanaan */}
                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    padding: "10px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "3px"
                  }}
                >
                  <span style={{ fontSize: "10px", fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Tanggal Pelaksanaan
                  </span>
                  <span style={{ fontSize: "13px", fontWeight: 800, color: "#0f172a" }}>
                    {formatIndonesianDate(selectedJob.data.dateRequired)}
                  </span>
                </div>

                {/* Metric 4: Waktu & Durasi Kerja */}
                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    padding: "10px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "3px"
                  }}
                >
                  <span style={{ fontSize: "10px", fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Waktu & Durasi
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "13px", fontWeight: 800, color: "#0f172a" }}>
                      {selectedJob.data.startTime || "--:--"} - {selectedJob.data.endTime || "--:--"}
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 800,
                        color: "#0369a1",
                        background: "#e0f2fe",
                        padding: "2px 7px",
                        borderRadius: "5px"
                      }}
                    >
                      ⏱️ {selectedJob.data.actualHours || "-"} Jam
                    </span>
                    {(selectedJob.data.hasBreak === "1" || selectedJob.data.hasBreak === "true") && (
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          color: "#c2410c",
                          background: "#ffedd5",
                          padding: "2px 6px",
                          borderRadius: "4px"
                        }}
                      >
                        ☕ Istirahat 1 Jam
                      </span>
                    )}
                  </div>
                </div>

                {/* Metric 5: Customer Request By */}
                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    padding: "10px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "3px"
                  }}
                >
                  <span style={{ fontSize: "10px", fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Diminta Oleh (Customer)
                  </span>
                  <span style={{ fontSize: "13px", fontWeight: 800, color: "#0f172a" }}>
                    {selectedJob.data.customerRequestBy || "-"}
                  </span>
                </div>

                {/* Metric 6: WO & Equipment */}
                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    padding: "10px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "3px"
                  }}
                >
                  <span style={{ fontSize: "10px", fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Work Order & Equipment
                  </span>
                  <span style={{ fontSize: "13px", fontWeight: 800, color: "#0f172a" }}>
                    WO: {selectedJob.data.workOrder || "-"} | EQ: {selectedJob.data.equipment || "-"}
                  </span>
                </div>
              </div>

              {/* Lokasi Pekerjaan Banner */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  background: "#f1f5f9",
                  border: "1px solid #e2e8f0",
                  marginBottom: "16px",
                  fontSize: "12px"
                }}
              >
                <span style={{ fontSize: "15px" }}>📍</span>
                <span style={{ fontWeight: 700, color: "#475569" }}>Lokasi Pekerjaan:</span>
                <span style={{ fontWeight: 800, color: "#0f172a" }}>
                  {selectedJob.data.location || "-"}
                </span>
              </div>

              {/* Text Blocks: Keterangan & Penyelesaian Pekerjaan */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "14px" }}>
                {/* Keterangan Pekerjaan */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px"
                  }}
                >
                  <div style={{ fontSize: "12px", fontWeight: 800, color: "#334155", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>📝</span> Keterangan Pekerjaan / Masalah
                  </div>
                  <div
                    style={{
                      background: "#fafafa",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      padding: "12px 14px",
                      fontSize: "13px",
                      lineHeight: "1.5",
                      color: "#1e293b",
                      whiteSpace: "pre-wrap",
                      minHeight: "70px"
                    }}
                  >
                    {selectedJob.data.description || "-"}
                  </div>
                </div>

                {/* Penyelesaian Pekerjaan */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px"
                  }}
                >
                  <div style={{ fontSize: "12px", fontWeight: 800, color: "#166534", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>✅</span> Tindakan & Penyelesaian Pekerjaan
                  </div>
                  <div
                    style={{
                      background: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      borderRadius: "8px",
                      padding: "12px 14px",
                      fontSize: "13px",
                      lineHeight: "1.5",
                      color: "#14532d",
                      whiteSpace: "pre-wrap",
                      minHeight: "70px"
                    }}
                  >
                    {selectedJob.data.workDone || "-"}
                  </div>
                </div>
              </div>
            </div>

            {/* Tim Teknisi Pelaksana */}
            <div
              style={{
                background: "#ffffff",
                borderRadius: "14px",
                border: "1px solid #e2e8f0",
                padding: "20px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "6px" }}>
                <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#1e293b", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>👥</span> Tim Teknisi Pelaksana
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 800,
                      color: "#0369a1",
                      background: "#e0f2fe",
                      padding: "2px 8px",
                      borderRadius: "12px",
                      border: "1px solid #bae6fd"
                    }}
                  >
                    {selectedJob.participants.length} Teknisi
                  </span>
                </h4>
              </div>
              <p style={{ margin: "0 0 14px", fontSize: "12px", color: "#64748b" }}>
                Daftar teknisi yang bertugas. Tanda tangan teknisi dibubuhkan secara manual pada formulir fisik setelah dicetak.
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: "10px"
                }}
              >
                {selectedJob.participants.map((p) => {
                  const isPic = p.participantRole === "pic";
                  const initials = getInitials(p.nameSnapshot);

                  return (
                    <div
                      key={p.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "10px 14px",
                        borderRadius: "10px",
                        background: isPic ? "#f0f9ff" : "#f8fafc",
                        border: `1px solid ${isPic ? "#bae6fd" : "#e2e8f0"}`
                      }}
                    >
                      {/* Avatar Initials */}
                      <div
                        style={{
                          width: "38px",
                          height: "38px",
                          borderRadius: "50%",
                          background: isPic ? "#0284c7" : "#64748b",
                          color: "#ffffff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 800,
                          fontSize: "13px",
                          flexShrink: 0
                        }}
                      >
                        {initials}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontSize: "13px", fontWeight: 800, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {p.nameSnapshot}
                          </span>
                          <span
                            style={{
                              fontSize: "10px",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: isPic ? "#0284c7" : "#e2e8f0",
                              color: isPic ? "#ffffff" : "#475569",
                              fontWeight: 800,
                              flexShrink: 0
                            }}
                          >
                            {isPic ? "PIC" : "Anggota"}
                          </span>
                        </div>
                        <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                          KPC ID: <span style={{ fontWeight: 700, color: "#334155" }}>{p.kpcIdSnapshot || "-"}</span>
                        </div>
                      </div>

                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          color: "#64748b",
                          background: "#ffffff",
                          border: "1px solid #cbd5e1",
                          padding: "3px 6px",
                          borderRadius: "5px",
                          whiteSpace: "nowrap"
                        }}
                      >
                        ✍️ TTD Fisik
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Riwayat Keputusan Supervisor */}
            {selectedJob.approvalHistory.length > 0 && (
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "14px",
                  border: "1px solid #e2e8f0",
                  padding: "20px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", paddingBottom: "8px", borderBottom: "1px solid #f1f5f9" }}>
                  <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#1e293b", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>🛡️</span> Riwayat Keputusan Supervisor
                  </h4>
                  <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>
                    Log Audit Approval
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {selectedJob.approvalHistory.map((h) => {
                    const isApproved = h.decision === "approved";
                    const isRev = h.decision === "revision_requested";
                    const borderColor = isApproved ? "#22c55e" : isRev ? "#f97316" : "#ef4444";
                    const bgBadge = isApproved ? "#dcfce7" : isRev ? "#ffedd5" : "#fee2e2";
                    const textBadge = isApproved ? "#15803d" : isRev ? "#c2410c" : "#b91c1c";
                    const labelText = isApproved ? "Disetujui" : isRev ? "Permintaan Revisi" : "Ditolak";
                    const icon = isApproved ? "✅" : isRev ? "⚠️" : "✕";

                    return (
                      <div
                        key={h.id}
                        style={{
                          padding: "12px 14px",
                          borderRadius: "10px",
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          borderLeft: `4px solid ${borderColor}`
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 800,
                              color: textBadge,
                              background: bgBadge,
                              padding: "3px 8px",
                              borderRadius: "6px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px"
                            }}
                          >
                            <span>{icon}</span> {labelText}
                          </span>
                          <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>
                            🕒 {new Date(h.decidedAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                          </span>
                        </div>
                        {h.note && (
                          <div
                            style={{
                              marginTop: "8px",
                              padding: "8px 12px",
                              borderRadius: "6px",
                              background: "#ffffff",
                              border: "1px solid #e2e8f0",
                              fontSize: "12px",
                              color: "#334155"
                            }}
                          >
                            <strong>Catatan:</strong> {h.note}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}


            {/* Action Bar: Supervisor Decision Controls */}
            {/* Action Bar: Supervisor Decision Controls */}
            {selectedJob.status === "submitted" && (
              <div
                style={{
                  padding: "20px",
                  borderRadius: "14px",
                  background: "#fffbeb",
                  border: "1.5px solid #fde68a",
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                  boxShadow: "0 2px 8px rgba(245, 158, 11, 0.08)"
                }}
              >
                {/* Header Persetujuan */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                  <div>
                    <div style={{ fontSize: "15px", fontWeight: 800, color: "#92400e", display: "flex", alignItems: "center", gap: "6px" }}>
                      <span>🛡️</span> Persetujuan & Pengesahan Supervisor OPS Telco
                    </div>
                    <div style={{ fontSize: "12px", color: "#b45309", marginTop: "2px" }}>
                      Pekerjaan ini menunggu persetujuan Anda. Tanda tangan baku telah disiapkan secara otomatis.
                    </div>
                  </div>

                  {/* Mode Selector Toggle */}
                  <div
                    style={{
                      display: "flex",
                      background: "#fef3c7",
                      padding: "3px",
                      borderRadius: "8px",
                      border: "1px solid #fcd34d"
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setSignatureMode("master")}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "6px",
                        border: "none",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                        background: signatureMode === "master" ? "#15803d" : "transparent",
                        color: signatureMode === "master" ? "#ffffff" : "#92400e",
                        transition: "all 0.15s ease"
                      }}
                    >
                      ✓ TTD Master Baku
                    </button>
                    <button
                      type="button"
                      onClick={() => setSignatureMode("manual")}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "6px",
                        border: "none",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                        background: signatureMode === "manual" ? "#0284c7" : "transparent",
                        color: signatureMode === "manual" ? "#ffffff" : "#92400e",
                        transition: "all 0.15s ease"
                      }}
                    >
                      ✍️ Gambar Manual
                    </button>
                  </div>
                </div>

                {signatureMode === "master" ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "14px",
                      background: "#ffffff",
                      border: "1px solid #fed7aa",
                      borderRadius: "12px",
                      padding: "16px"
                    }}
                  >
                    {/* Master Profile Picker */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                      <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>
                        Pilihan Master Tanda Tangan SPV:
                      </label>
                      <select
                        value={selectedMasterId}
                        onChange={(e) => setSelectedMasterId(e.target.value)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: "6px",
                          border: "1px solid #cbd5e1",
                          fontSize: "12px",
                          fontWeight: 700,
                          color: "#1e293b",
                          background: "#f8fafc",
                          cursor: "pointer"
                        }}
                      >
                        {masterProfiles.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.badge}) - {p.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Preview Box of Master Signature */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "14px 20px",
                        borderRadius: "10px",
                        border: "1.5px dashed #cbd5e1",
                        background: "#fafaf9",
                        flexWrap: "wrap",
                        gap: "16px"
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                          Supervisor Penandatangan
                        </div>
                        <div style={{ fontSize: "15px", fontWeight: 800, color: "#0f172a", marginTop: "2px" }}>
                          {activeMaster.name}
                        </div>
                        <div style={{ fontSize: "12px", color: "#475569" }}>
                          KPC ID: <span style={{ fontWeight: 700 }}>{activeMaster.badge}</span> | {activeMaster.title}
                        </div>
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            marginTop: "8px",
                            fontSize: "11px",
                            fontWeight: 700,
                            color: "#166534",
                            background: "#dcfce7",
                            padding: "3px 8px",
                            borderRadius: "6px",
                            border: "1px solid #bbf7d0"
                          }}
                        >
                          ✓ Master TTD Terverifikasi & Baku
                        </div>
                      </div>

                      {/* Signature image */}
                      <div
                        style={{
                          background: "#ffffff",
                          border: "1px solid #e2e8f0",
                          borderRadius: "8px",
                          padding: "8px 16px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          minWidth: "160px",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
                        }}
                      >
                        <img
                          src={activeMaster.dataUrl}
                          alt="Master Tanda Tangan"
                          style={{ maxHeight: "85px", maxWidth: "220px", objectFit: "contain" }}
                        />
                      </div>
                    </div>

                    {/* Button Controls */}
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", paddingTop: "4px" }}>
                      <button
                        type="button"
                        onClick={handleApproveWithMaster}
                        disabled={isBusy}
                        style={{
                          padding: "10px 22px",
                          borderRadius: "8px",
                          background: "#16a34a",
                          color: "#fff",
                          border: "none",
                          fontWeight: 800,
                          fontSize: "13px",
                          cursor: isBusy ? "not-allowed" : "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          boxShadow: "0 2px 4px rgba(22, 163, 74, 0.25)"
                        }}
                      >
                        {isBusy ? "Memproses..." : "✓ Sahkan & Setujui Sekarang"}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowNoteModal("revision_requested");
                          setDecisionNote("");
                        }}
                        disabled={isBusy}
                        style={{
                          padding: "10px 16px",
                          borderRadius: "8px",
                          background: "#ea580c",
                          color: "#fff",
                          border: "none",
                          fontWeight: 800,
                          fontSize: "13px",
                          cursor: isBusy ? "not-allowed" : "pointer"
                        }}
                      >
                        ⚠️ Minta Revisi
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowNoteModal("rejected");
                          setDecisionNote("");
                        }}
                        disabled={isBusy}
                        style={{
                          padding: "10px 16px",
                          borderRadius: "8px",
                          background: "#dc2626",
                          color: "#fff",
                          border: "none",
                          fontWeight: 800,
                          fontSize: "13px",
                          cursor: isBusy ? "not-allowed" : "pointer"
                        }}
                      >
                        ✕ Tolak Pengajuan
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <SignaturePad
                      onSave={(dataUrl) => handleSaveManualAndApprove(dataUrl, saveAsCustomMaster)}
                      onCancel={() => setSignatureMode("master")}
                      title="Tanda Tangan Manual Supervisor"
                      subtitle="Goreskan tanda tangan Anda jika ingin menggunakan tanda tangan baru atau spesifik."
                      submitLabel="Sahkan & Setujui Sekarang"
                      disabled={isBusy}
                    />

                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "#334155",
                        cursor: "pointer",
                        background: "#f1f5f9",
                        padding: "8px 12px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        width: "fit-content"
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={saveAsCustomMaster}
                        onChange={(e) => setSaveAsCustomMaster(e.target.checked)}
                        style={{ width: "16px", height: "16px", cursor: "pointer" }}
                      />
                      Simpan tanda tangan ini sebagai Tanda Tangan Master Baku Saya untuk ke depan
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: "60px 20px", textAlign: "center", color: "#64748b" }}>
            Pilih salah satu formulir dari daftar di sebelah kanan untuk meninjau rincian pekerjaan dan melakukan persetujuan.
          </div>
        )}
      </section>

      {/* Kolom Kanan: Daftar Tab & Antrean */}
      <aside className={styles.history}>
        <div className={styles.historyHeader}>
          <div>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 800 }}>Antrean Persetujuan</h3>
            <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#64748b" }}>
              {counts.submitted} formulir menunggu
            </p>
          </div>
          <span>{filteredJobs.length}</span>
        </div>

        {/* Tab Buttons */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", padding: "8px 10px", borderBottom: "1px solid #e2e8f0" }}>
          <button
            type="button"
            onClick={() => setActiveTab("submitted")}
            style={{
              padding: "4px 8px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
              border: "1px solid",
              background: activeTab === "submitted" ? "#fef3c7" : "#fff",
              color: activeTab === "submitted" ? "#92400e" : "#64748b",
              borderColor: activeTab === "submitted" ? "#fde68a" : "#cbd5e1"
            }}
          >
            Menunggu ({counts.submitted})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("revision_requested")}
            style={{
              padding: "4px 8px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
              border: "1px solid",
              background: activeTab === "revision_requested" ? "#ffedd5" : "#fff",
              color: activeTab === "revision_requested" ? "#c2410c" : "#64748b",
              borderColor: activeTab === "revision_requested" ? "#fed7aa" : "#cbd5e1"
            }}
          >
            Revisi ({counts.revision_requested})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("approved")}
            style={{
              padding: "4px 8px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
              border: "1px solid",
              background: activeTab === "approved" ? "#dcfce7" : "#fff",
              color: activeTab === "approved" ? "#15803d" : "#64748b",
              borderColor: activeTab === "approved" ? "#bbf7d0" : "#cbd5e1"
            }}
          >
            Disetujui ({counts.approved})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            style={{
              padding: "4px 8px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
              border: "1px solid",
              background: activeTab === "all" ? "#f1f5f9" : "#fff",
              color: activeTab === "all" ? "#334155" : "#64748b",
              borderColor: activeTab === "all" ? "#94a3b8" : "#cbd5e1"
            }}
          >
            Semua ({counts.all})
          </button>
        </div>

        {/* List of Approval Items */}
        <div className={styles.recordList}>
          {filteredJobs.length === 0 ? (
            <div style={{ padding: "24px 12px", textAlign: "center", color: "#94a3b8", fontSize: "12px" }}>
              Tidak ada formulir dalam tab ini.
            </div>
          ) : (
            filteredJobs.map((job) => {
              const isSelected = selectedJob?.id === job.id;
              const meta = statusMeta[job.status] || statusMeta.draft;

              return (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => selectJob(job)}
                  className={`${styles.record} ${isSelected ? styles.selected : ""}`}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 800, fontSize: "13px", color: "#102f42" }}>
                      {job.jobOrderNo || job.formNumber}
                    </span>
                    <span
                      style={{
                        fontSize: "9px",
                        fontWeight: 800,
                        padding: "2px 6px",
                        borderRadius: "4px",
                        background: meta.bg,
                        color: meta.color,
                        border: `1px solid ${meta.border}`
                      }}
                    >
                      {meta.label}
                    </span>
                  </div>

                  <div style={{ fontSize: "11px", color: "#64748b" }}>
                    PIC: {job.picName || "Belum ditentukan"}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: "10px",
                      color: "#94a3b8",
                      marginTop: "2px"
                    }}
                  >
                    <span>{job.formNumber}</span>
                    <span style={{ fontWeight: 600, color: "#64748b" }}>👥 {job.totalParticipants || 1} Teknisi</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Modal for Revision / Reject Reason */}
      {showNoteModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(16, 47, 66, 0.45)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "16px"
          }}
          onClick={() => setShowNoteModal(null)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              padding: "24px",
              maxWidth: "440px",
              width: "100%",
              boxShadow: "0 16px 36px rgba(0, 0, 0, 0.2)",
              textAlign: "left"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: 800, color: "#102f42" }}>
              {showNoteModal === "revision_requested" ? "Permintaan Revisi Formulir" : "Tolak Pengajuan Job Oncall"}
            </h3>
            <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 14px" }}>
              {showNoteModal === "revision_requested"
                ? "Tuliskan rincian apa yang perlu diperbaiki oleh PIC atau teknisi sebelum formulir dapat disetujui."
                : "Tuliskan alasan penolakan formulir pekerjaan ini secara jelas."}
            </p>

            <textarea
              rows={4}
              placeholder="Tuliskan catatan Anda di sini..."
              value={decisionNote}
              onChange={(e) => setDecisionNote(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "13px",
                boxSizing: "border-box",
                fontFamily: "inherit",
                resize: "vertical"
              }}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "18px" }}>
              <button
                type="button"
                onClick={() => setShowNoteModal(null)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#475569",
                  background: "#f1f5f9",
                  border: "1px solid #cbd5e1",
                  cursor: "pointer"
                }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDecisionWithNote}
                disabled={decisionNote.trim().length < 3 || isBusy}
                style={{
                  padding: "8px 18px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: 800,
                  color: "#ffffff",
                  background: showNoteModal === "revision_requested" ? "#ea580c" : "#dc2626",
                  border: "none",
                  cursor: decisionNote.trim().length >= 3 && !isBusy ? "pointer" : "not-allowed",
                  opacity: decisionNote.trim().length >= 3 && !isBusy ? 1 : 0.5
                }}
              >
                {isBusy ? "Memproses..." : showNoteModal === "revision_requested" ? "Kirim Permintaan Revisi" : "Tolak Formulir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
