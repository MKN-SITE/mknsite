"use client";

import React, { useEffect, useMemo, useState } from "react";
import { API_URL, api, type PortalUser } from "@/lib/api";
import { SignaturePad } from "./signature-pad";
import type {
  OncallApprovalHistory,
  OncallParticipant,
  OncallSignature
} from "./telco-form-types";
import styles from "./telco-form-workspace.module.css";

export type OvertimeJobStatus =
  | "draft"
  | "technician_signing"
  | "submitted"
  | "revision_requested"
  | "approved"
  | "rejected";

export interface OvertimeJobRecord {
  id: number;
  formNumber: string;
  status: OvertimeJobStatus;
  jobOrderNo: string | null;
  workflowVersion: number;
  lockedAt: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  isLegacy: boolean;
  createdBy: number;
  creatorName?: string;
  creatorKpcId?: string | null;
  picName?: string;
  picKpcId?: string | null;
  totalParticipants?: number;
  signaturesCount?: number;
  data: Record<string, string>;
  participants: OncallParticipant[];
  signatures: OncallSignature[];
  approvalHistory: OncallApprovalHistory[];
  isPic?: boolean;
  isParticipant?: boolean;
  isSupervisor?: boolean;
  createdAt: string;
  updatedAt: string;
}

const statusMeta: Record<
  OvertimeJobStatus,
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

interface OvertimeApprovalPanelProps {
  user?: PortalUser | null;
}

export function OvertimeApprovalPanel({ user }: OvertimeApprovalPanelProps) {
  const [jobs, setJobs] = useState<OvertimeJobRecord[]>([]);
  const [selectedJob, setSelectedJob] = useState<OvertimeJobRecord | null>(null);
  const [activeTab, setActiveTab] = useState<"submitted" | "revision_requested" | "approved" | "rejected" | "all">("submitted");
  const [message, setMessage] = useState<{ type: "info" | "error" | "success"; text: string } | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  // Master Signature States
  const [selectedMasterId, setSelectedMasterId] = useState<string>("spv-rahmansyah");
  const [signatureMode, setSignatureMode] = useState<"master" | "manual">("master");
  const [customMaster, setCustomMaster] = useState<{ name: string; badge: string; dataUrl: string } | null>(null);
  const [saveAsCustomMaster, setSaveAsCustomMaster] = useState(false);

  // Modal dialog states
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionNote, setRevisionNote] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectNote, setRejectNote] = useState("");

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

  useEffect(() => {
    loadJobs();
  }, []);

  async function loadJobs() {
    setIsBusy(true);
    setMessage(null);
    try {
      const res = await api<{ data: OvertimeJobRecord[] }>("/ops-telco/overtime-jobs");
      setJobs(res.data);
      if (res.data.length > 0 && !selectedJob) {
        // Select first job if none selected
        loadJobDetail(res.data[0].id);
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Gagal memuat antrean persetujuan Overtime." });
    } finally {
      setIsBusy(false);
    }
  }

  async function loadJobDetail(id: number) {
    setIsBusy(true);
    try {
      const res = await api<{ data: OvertimeJobRecord }>(`/ops-telco/overtime-jobs/${id}`);
      setSelectedJob(res.data);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Gagal memuat rincian pekerjaan Overtime." });
    } finally {
      setIsBusy(false);
    }
  }

  const filteredJobs = useMemo(() => {
    if (activeTab === "all") return jobs;
    return jobs.filter((j) => j.status === activeTab);
  }, [jobs, activeTab]);

  const counts = useMemo(() => {
    return {
      submitted: jobs.filter((j) => j.status === "submitted").length,
      revision_requested: jobs.filter((j) => j.status === "revision_requested").length,
      approved: jobs.filter((j) => j.status === "approved").length,
      rejected: jobs.filter((j) => j.status === "rejected").length,
      all: jobs.length
    };
  }, [jobs]);

  async function handleDecision(decision: "approved" | "revision_requested" | "rejected", sigDataUrl?: string, note?: string) {
    if (!selectedJob) return;

    if (decision === "approved" && !sigDataUrl) {
      setMessage({ type: "error", text: "Tanda tangan Supervisor diperlukan untuk persetujuan." });
      return;
    }

    setIsBusy(true);
    setMessage(null);

    try {
      const res = await api<{ data: OvertimeJobRecord }>(`/ops-telco/overtime-jobs/${selectedJob.id}/decision`, {
        method: "POST",
        body: JSON.stringify({
          decision,
          signatureDataUrl: sigDataUrl,
          note: note?.trim() || undefined
        })
      });

      setSelectedJob(res.data);
      setMessage({
        type: "success",
        text:
          decision === "approved"
            ? "Formulir Overtime berhasil disetujui & ditandatangani!"
            : decision === "revision_requested"
              ? "Catatan revisi berhasil dikirim ke teknisi."
              : "Formulir Overtime telah ditolak."
      });

      setShowRevisionModal(false);
      setShowRejectModal(false);
      setRevisionNote("");
      setRejectNote("");

      // Reload jobs list
      const updatedList = await api<{ data: OvertimeJobRecord[] }>("/ops-telco/overtime-jobs");
      setJobs(updatedList.data);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Gagal memproses keputusan." });
    } finally {
      setIsBusy(false);
    }
  }

  function handleApproveWithMaster() {
    if (!activeMaster?.dataUrl) {
      setMessage({ type: "error", text: "Data tanda tangan master baku tidak tersedia." });
      return;
    }
    handleDecision("approved", activeMaster.dataUrl);
  }

  function handleManualSignatureSave(dataUrl: string) {
    if (saveAsCustomMaster) {
      try {
        const customObj = {
          name: user?.name || "Supervisor",
          badge: user?.kpcId || "KPC",
          dataUrl
        };
        localStorage.setItem("mkn_spv_custom_master_sig", JSON.stringify(customObj));
        setCustomMaster(customObj);
        setSelectedMasterId("spv-custom");
      } catch {}
    }
    handleDecision("approved", dataUrl);
  }

  return (
    <div className={styles.workspace} style={{ gap: "20px" }}>
      {/* Kolom Kiri: Panel Detail Formulir & Approval Action */}
      <section className={styles.editor}>
        {/* Header Toolbar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
          <div>
            <span style={{ fontSize: "10px", fontWeight: 800, color: "#ea580c", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              🛡️ VERIFIKASI & PERSETUJUAN SUPERVISOR
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "2px" }}>
              <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#102f42" }}>
                {selectedJob ? `Job Order #${selectedJob.jobOrderNo || selectedJob.formNumber}` : "Pilih Dokumen"}
              </h2>
              {selectedJob && (
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    padding: "3px 8px",
                    borderRadius: "6px",
                    background: statusMeta[selectedJob.status].bg,
                    color: statusMeta[selectedJob.status].color,
                    border: `1px solid ${statusMeta[selectedJob.status].border}`
                  }}
                >
                  {statusMeta[selectedJob.status].label}
                </span>
              )}
            </div>
          </div>

          {selectedJob && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <a
                href={`${API_URL}/ops-telco/overtime-jobs/${selectedJob.id}/pdf`}
                target="_blank"
                rel="noreferrer"
                className={styles.pdfButton}
                style={{
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 14px",
                  fontSize: "12px",
                  fontWeight: 700,
                  borderRadius: "8px"
                }}
              >
                <span>{selectedJob.status === "approved" ? "📥" : "📄"}</span>
                <span>{selectedJob.status === "approved" ? "Unduh PDF Final" : "Lihat Draf PDF"}</span>
              </a>
            </div>
          )}
        </div>

        {/* Notifikasi Pesan */}
        {message && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "8px",
              background: message.type === "error" ? "#fff2f2" : message.type === "success" ? "#f0fdf4" : "#e0f2fe",
              border: `1px solid ${message.type === "error" ? "#ffd1d1" : message.type === "success" ? "#bbf7d0" : "#bae6fd"}`,
              color: message.type === "error" ? "#c33030" : message.type === "success" ? "#166534" : "#0369a1",
              fontSize: "13px",
              marginBottom: "16px"
            }}
          >
            {message.text}
          </div>
        )}

        {selectedJob ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Kartu Ringkasan Dokumen */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderLeft: "4px solid #ea580c",
                borderRadius: "12px",
                padding: "18px 20px"
              }}
            >
              <h4 style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: 800, color: "#1e293b", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>📋</span> Rincian Penugasan Job Overtime
              </h4>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", fontSize: "12px" }}>
                <div>
                  <span style={{ color: "#64748b", display: "block" }}>Nomor Form Sistem:</span>
                  <span style={{ fontWeight: 800, color: "#1e293b" }}>{selectedJob.formNumber}</span>
                </div>
                <div>
                  <span style={{ color: "#64748b", display: "block" }}>Job Order (Operasional):</span>
                  <span style={{ fontWeight: 800, color: "#ea580c" }}>{selectedJob.jobOrderNo || "-"}</span>
                </div>
                <div>
                  <span style={{ color: "#64748b", display: "block" }}>Work Order No:</span>
                  <span style={{ fontWeight: 700, color: "#1e293b" }}>{selectedJob.data?.workOrder || "-"}</span>
                </div>
                <div>
                  <span style={{ color: "#64748b", display: "block" }}>Equipment No:</span>
                  <span style={{ fontWeight: 700, color: "#1e293b" }}>{selectedJob.data?.equipment || "-"}</span>
                </div>
                <div>
                  <span style={{ color: "#64748b", display: "block" }}>Tanggal Pelaksanaan:</span>
                  <span style={{ fontWeight: 700, color: "#1e293b" }}>{formatIndonesianDate(selectedJob.data?.dateRequired)}</span>
                </div>
                <div>
                  <span style={{ color: "#64748b", display: "block" }}>Jam Kerja:</span>
                  <span style={{ fontWeight: 700, color: "#1e293b" }}>
                    {selectedJob.data?.startTime || "--:--"} s/d {selectedJob.data?.endTime || "--:--"} ({selectedJob.data?.actualHours || "0"} Jam)
                    {selectedJob.data?.hasBreak && (
                      <span style={{ color: "#ea580c", fontWeight: 800, marginLeft: "4px" }}>
                        (Termasuk istirahat 1 jam)
                      </span>
                    )}
                  </span>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <span style={{ color: "#64748b", display: "block" }}>Lokasi Pekerjaan:</span>
                  <span style={{ fontWeight: 700, color: "#1e293b" }}>{selectedJob.data?.location || "-"}</span>
                </div>
              </div>
            </div>

            {/* Kartu Uraian Masalah & Penyelesaian */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "18px 20px"
              }}
            >
              <h4 style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: 800, color: "#1e293b", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>🔧</span> Uraian & Hasil Penyelesaian Lapangan
              </h4>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "12px" }}>
                <div>
                  <span style={{ fontWeight: 700, color: "#475569", display: "block" }}>
                    Keterangan Pekerjaan / Masalah yang Dihadapi:
                  </span>
                  <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0", marginTop: "4px", color: "#1e293b", whiteSpace: "pre-wrap" }}>
                    {selectedJob.data?.description || "Tidak ada keterangan pekerjaan tercatat."}
                  </div>
                </div>

                <div>
                  <span style={{ fontWeight: 700, color: "#475569", display: "block" }}>
                    Penyelesaian Pekerjaan / Solusi:
                  </span>
                  <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0", marginTop: "4px", color: "#1e293b", whiteSpace: "pre-wrap" }}>
                    {selectedJob.data?.workDone || "Tidak ada penyelesaian tercatat."}
                  </div>
                </div>
              </div>
            </div>

            {/* Kartu Tim Teknisi Pelaksana */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "18px 20px"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#1e293b", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>👥</span> Tim Teknisi Pelaksana
                </h4>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#475569", background: "#f1f5f9", padding: "2px 8px", borderRadius: "10px" }}>
                  {selectedJob.participants.length} Teknisi
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "8px" }}>
                {selectedJob.participants.map((p) => {
                  const isPic = p.participantRole === "pic";
                  return (
                    <div
                      key={p.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                        background: isPic ? "#fff7ed" : "#f8fafc"
                      }}
                    >
                      <div
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "50%",
                          background: isPic ? "#ea580c" : "#64748b",
                          color: "#fff",
                          display: "grid",
                          placeItems: "center",
                          fontSize: "12px",
                          fontWeight: 800,
                          flexShrink: 0
                        }}
                      >
                        {getInitials(p.nameSnapshot)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: "12px", fontWeight: 700, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.nameSnapshot}
                        </div>
                        <div style={{ fontSize: "11px", color: isPic ? "#c2410c" : "#64748b" }}>
                          {isPic ? "👑 PIC Utama" : "Anggota"} {p.kpcIdSnapshot ? `• ${p.kpcIdSnapshot}` : ""}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Riwayat Approval & Catatan */}
            {selectedJob.approvalHistory.length > 0 && (
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  padding: "18px 20px"
                }}
              >
                <h4 style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: 800, color: "#1e293b", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>📜</span> Riwayat Persetujuan & Keputusan
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {selectedJob.approvalHistory.map((h) => (
                    <div
                      key={h.id}
                      style={{
                        padding: "10px 12px",
                        borderRadius: "8px",
                        background: h.decision === "approved" ? "#f0fdf4" : h.decision === "revision_requested" ? "#fff7ed" : "#fef2f2",
                        border: `1px solid ${h.decision === "approved" ? "#bbf7d0" : h.decision === "revision_requested" ? "#fed7aa" : "#fca5a5"}`
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px" }}>
                        <span style={{ fontWeight: 800, color: h.decision === "approved" ? "#166534" : h.decision === "revision_requested" ? "#c2410c" : "#991b1b" }}>
                          {h.decision === "approved" ? "✓ Disetujui" : h.decision === "revision_requested" ? "⚠️ Diminta Revisi" : "✕ Ditolak"}
                        </span>
                        <span style={{ fontSize: "11px", color: "#64748b" }}>
                          {new Date(h.decidedAt).toLocaleString("id-ID")}
                        </span>
                      </div>
                      {h.note && (
                        <div style={{ fontSize: "12px", color: "#334155", marginTop: "4px" }}>
                          Catatan: "{h.note}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Panel Keputusan Supervisor (Hanya muncul jika submitted atau revision_requested) */}
            {(selectedJob.status === "submitted" || selectedJob.status === "revision_requested") && (
              <div
                style={{
                  background: "#ffffff",
                  border: "2px solid #ea580c",
                  borderRadius: "14px",
                  padding: "20px",
                  boxShadow: "0 4px 12px rgba(234, 88, 12, 0.08)"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#102f42" }}>
                      Tindakan Persetujuan Supervisor
                    </h3>
                    <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>
                      Pilih tanda tangan master baku atau tanda tangan manual untuk mengesahkan formulir ini.
                    </p>
                  </div>
                </div>

                {/* Mode Pemilihan Tanda Tangan */}
                <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
                  <button
                    type="button"
                    onClick={() => setSignatureMode("master")}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: `2px solid ${signatureMode === "master" ? "#ea580c" : "#e2e8f0"}`,
                      background: signatureMode === "master" ? "#fff7ed" : "#ffffff",
                      color: signatureMode === "master" ? "#c2410c" : "#475569",
                      fontWeight: 800,
                      fontSize: "12px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px"
                    }}
                  >
                    <span>⚡</span> 1-Click Master TTD (Otomatis Baku)
                  </button>

                  <button
                    type="button"
                    onClick={() => setSignatureMode("manual")}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: `2px solid ${signatureMode === "manual" ? "#ea580c" : "#e2e8f0"}`,
                      background: signatureMode === "manual" ? "#fff7ed" : "#ffffff",
                      color: signatureMode === "manual" ? "#c2410c" : "#475569",
                      fontWeight: 800,
                      fontSize: "12px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px"
                    }}
                  >
                    <span>✍️</span> Gambar Manual Baru
                  </button>
                </div>

                {signatureMode === "master" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {/* Kartu Profil Master TTD */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 16px",
                        borderRadius: "10px",
                        border: "1px solid #fed7aa",
                        background: "#fffaf5"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ border: "1px dashed #fdba74", background: "#ffffff", borderRadius: "6px", padding: "4px" }}>
                          <img
                            src={activeMaster.dataUrl}
                            alt="Pratinjau TTD Master"
                            style={{ width: "120px", height: "40px", objectFit: "contain" }}
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: 800, color: "#1e293b" }}>
                            {activeMaster.name} ({activeMaster.badge})
                          </div>
                          <div style={{ fontSize: "11px", color: "#64748b" }}>
                            {activeMaster.title}
                          </div>
                        </div>
                      </div>

                      {masterProfiles.length > 1 && (
                        <select
                          value={selectedMasterId}
                          onChange={(e) => setSelectedMasterId(e.target.value)}
                          style={{
                            padding: "6px 10px",
                            borderRadius: "6px",
                            border: "1px solid #cbd5e1",
                            fontSize: "12px"
                          }}
                        >
                          {masterProfiles.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Tombol Aksi Utama */}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "4px" }}>
                      <button
                        type="button"
                        onClick={handleApproveWithMaster}
                        disabled={isBusy}
                        style={{
                          flex: 2,
                          background: "#16a34a",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "8px",
                          padding: "12px 16px",
                          fontSize: "13px",
                          fontWeight: 800,
                          cursor: isBusy ? "not-allowed" : "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px",
                          boxShadow: "0 2px 4px rgba(22, 163, 74, 0.25)"
                        }}
                      >
                        <span>✓</span> Sahkan & Setujui Sekarang (1-Click)
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowRevisionModal(true)}
                        disabled={isBusy}
                        style={{
                          flex: 1,
                          background: "#fff7ed",
                          color: "#c2410c",
                          border: "1px solid #fdba74",
                          borderRadius: "8px",
                          padding: "12px 16px",
                          fontSize: "13px",
                          fontWeight: 700,
                          cursor: isBusy ? "not-allowed" : "pointer"
                        }}
                      >
                        ⚠️ Minta Revisi
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowRejectModal(true)}
                        disabled={isBusy}
                        style={{
                          flex: 1,
                          background: "#fef2f2",
                          color: "#dc2626",
                          border: "1px solid #fca5a5",
                          borderRadius: "8px",
                          padding: "12px 16px",
                          fontSize: "13px",
                          fontWeight: 700,
                          cursor: isBusy ? "not-allowed" : "pointer"
                        }}
                      >
                        ✕ Tolak
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <SignaturePad
                      onSave={handleManualSignatureSave}
                      title="Gambar Tanda Tangan Supervisor"
                      subtitle="Bubuhkan tanda tangan Anda pada canvas untuk menyetujui dokumen ini."
                      submitLabel="Sahkan & Simpan TTD Manual"
                      disabled={isBusy}
                    />

                    <div style={{ marginTop: "10px" }}>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#475569", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={saveAsCustomMaster}
                          onChange={(e) => setSaveAsCustomMaster(e.target.checked)}
                          style={{ accentColor: "#ea580c" }}
                        />
                        <span>Simpan tanda tangan ini sebagai Tanda Tangan Master Baku Saya untuk ke depan</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "#94a3b8" }}>
            Pilih formulir dari antrean di sebelah kanan untuk melihat rincian dan melakukan verifikasi.
          </div>
        )}

        {/* Modal Catatan Revisi */}
        {showRevisionModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.6)",
              display: "grid",
              placeItems: "center",
              zIndex: 9999,
              padding: "16px"
            }}
          >
            <div
              style={{
                background: "#ffffff",
                borderRadius: "14px",
                padding: "24px",
                maxWidth: "480px",
                width: "100%",
                boxShadow: "0 10px 25px rgba(0,0,0,0.15)"
              }}
            >
              <h3 style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: 800, color: "#1e293b" }}>
                ⚠️ Minta Revisi Pekerjaan Overtime
              </h3>
              <p style={{ margin: "0 0 16px", fontSize: "12px", color: "#64748b" }}>
                Tuliskan instruksi perbaikan yang jelas agar teknisi PIC dapat memperbaiki data pekerjaan.
              </p>

              <textarea
                rows={4}
                value={revisionNote}
                onChange={(e) => setRevisionNote(e.target.value)}
                placeholder="Contoh: Mohon perjelas jam selesai dan rincian penyelesaian core FO..."
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "13px",
                  marginBottom: "16px"
                }}
              />

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowRevisionModal(false)}
                  disabled={isBusy}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#475569",
                    fontWeight: 700,
                    fontSize: "12px",
                    cursor: "pointer"
                  }}
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => handleDecision("revision_requested", undefined, revisionNote)}
                  disabled={isBusy || !revisionNote.trim()}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#ea580c",
                    color: "#ffffff",
                    fontWeight: 800,
                    fontSize: "12px",
                    cursor: isBusy || !revisionNote.trim() ? "not-allowed" : "pointer"
                  }}
                >
                  Kirim Permintaan Revisi
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Penolakan */}
        {showRejectModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.6)",
              display: "grid",
              placeItems: "center",
              zIndex: 9999,
              padding: "16px"
            }}
          >
            <div
              style={{
                background: "#ffffff",
                borderRadius: "14px",
                padding: "24px",
                maxWidth: "480px",
                width: "100%",
                boxShadow: "0 10px 25px rgba(0,0,0,0.15)"
              }}
            >
              <h3 style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: 800, color: "#dc2626" }}>
                ✕ Tolak Formulir Overtime
              </h3>
              <p style={{ margin: "0 0 16px", fontSize: "12px", color: "#64748b" }}>
                Tuliskan alasan penolakan formulir ini secara jelas.
              </p>

              <textarea
                rows={4}
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="Contoh: Pekerjaan lembur tidak ada persetujuan sebelumnya / WO tidak valid..."
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "13px",
                  marginBottom: "16px"
                }}
              />

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  disabled={isBusy}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#475569",
                    fontWeight: 700,
                    fontSize: "12px",
                    cursor: "pointer"
                  }}
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => handleDecision("rejected", undefined, rejectNote)}
                  disabled={isBusy || !rejectNote.trim()}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#dc2626",
                    color: "#ffffff",
                    fontWeight: 800,
                    fontSize: "12px",
                    cursor: isBusy || !rejectNote.trim() ? "not-allowed" : "pointer"
                  }}
                >
                  Tolak Formulir
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Kolom Kanan: Antrean Formulir Overtime Masuk */}
      <aside className={styles.history}>
        <div className={styles.historyHeader}>
          <div>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 800 }}>Antrean Overtime</h3>
            <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#64748b" }}>
              Verifikasi & Persetujuan
            </p>
          </div>
          <span>{filteredJobs.length}</span>
        </div>

        {/* Tab Filters */}
        <div style={{ display: "flex", gap: "4px", padding: "8px 12px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
          <button
            type="button"
            onClick={() => setActiveTab("submitted")}
            style={{
              flex: 1,
              padding: "6px 2px",
              fontSize: "11px",
              fontWeight: activeTab === "submitted" ? 800 : 600,
              borderRadius: "6px",
              border: "none",
              background: activeTab === "submitted" ? "#ffffff" : "transparent",
              color: activeTab === "submitted" ? "#b45309" : "#64748b",
              boxShadow: activeTab === "submitted" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              cursor: "pointer"
            }}
          >
            Menunggu ({counts.submitted})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("revision_requested")}
            style={{
              flex: 1,
              padding: "6px 2px",
              fontSize: "11px",
              fontWeight: activeTab === "revision_requested" ? 800 : 600,
              borderRadius: "6px",
              border: "none",
              background: activeTab === "revision_requested" ? "#ffffff" : "transparent",
              color: activeTab === "revision_requested" ? "#c2410c" : "#64748b",
              boxShadow: activeTab === "revision_requested" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              cursor: "pointer"
            }}
          >
            Revisi ({counts.revision_requested})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("approved")}
            style={{
              flex: 1,
              padding: "6px 2px",
              fontSize: "11px",
              fontWeight: activeTab === "approved" ? 800 : 600,
              borderRadius: "6px",
              border: "none",
              background: activeTab === "approved" ? "#ffffff" : "transparent",
              color: activeTab === "approved" ? "#15803d" : "#64748b",
              boxShadow: activeTab === "approved" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              cursor: "pointer"
            }}
          >
            Disetujui ({counts.approved})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("all")}
            style={{
              flex: 1,
              padding: "6px 2px",
              fontSize: "11px",
              fontWeight: activeTab === "all" ? 800 : 600,
              borderRadius: "6px",
              border: "none",
              background: activeTab === "all" ? "#ffffff" : "transparent",
              color: activeTab === "all" ? "#1e293b" : "#64748b",
              boxShadow: activeTab === "all" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              cursor: "pointer"
            }}
          >
            Semua ({counts.all})
          </button>
        </div>

        {/* List of Jobs */}
        <div className={styles.recordList}>
          {filteredJobs.length === 0 ? (
            <div style={{ padding: "30px 12px", textAlign: "center", color: "#94a3b8", fontSize: "12px" }}>
              Tidak ada dokumen pada tab ini.
            </div>
          ) : (
            filteredJobs.map((job) => {
              const isSelected = selectedJob?.id === job.id;
              const meta = statusMeta[job.status] || statusMeta.draft;

              return (
                <div
                  key={job.id}
                  onClick={() => loadJobDetail(job.id)}
                  className={`${styles.record} ${isSelected ? styles.selected : ""}`}
                  style={{ cursor: "pointer" }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") loadJobDetail(job.id);
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                    <span style={{ fontWeight: 800, fontSize: "13px", color: "#102f42", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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

                  <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                    PIC: {job.picName || "Belum ditentukan"}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "10px", color: "#94a3b8", marginTop: "4px" }}>
                    <span>{job.formNumber}</span>
                    <span>👥 {job.totalParticipants || 1} Personil</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}
