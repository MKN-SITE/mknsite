"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { API_URL, api, type PortalUser } from "@/lib/api";
import { SignaturePad } from "./signature-pad";
import { OncallParticipantsList } from "./oncall-participants-list";
import type {
  EligibleTechnician,
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

const statusMeta: Record<OvertimeJobStatus, { label: string; bg: string; color: string; border: string }> = {
  draft: { label: "Draf", bg: "#f1f5f9", color: "#475569", border: "#cbd5e1" },
  technician_signing: { label: "Menunggu TTD", bg: "#fef9c3", color: "#854d0e", border: "#fde047" },
  submitted: { label: "Menunggu SPV", bg: "#e0f2fe", color: "#0369a1", border: "#7dd3fc" },
  revision_requested: { label: "Perlu Revisi", bg: "#fff7ed", color: "#c2410c", border: "#fdba74" },
  approved: { label: "Disetujui", bg: "#f0fdf4", color: "#15803d", border: "#86efac" },
  rejected: { label: "Ditolak", bg: "#fef2f2", color: "#b91c1c", border: "#fca5a5" }
};

function calculateDurationHours(startTime: string, endTime: string, hasBreak = false): string {
  if (!startTime || !endTime) return "";
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) return "";

  const startTotal = startH * 60 + startM;
  let endTotal = endH * 60 + endM;

  if (endTotal < startTotal) {
    // Crosses midnight (e.g. 23:00 to 02:00)
    endTotal += 24 * 60;
  }

  const diffMinutes = endTotal - startTotal;
  let hours = Math.round((diffMinutes / 60) * 100) / 100;
  if (hasBreak) {
    hours = Math.max(0, Math.round((hours - 1) * 100) / 100);
  }
  return hours.toString();
}

export function OvertimeJobWorkspace({ user }: { user?: PortalUser | null }) {
  const [jobs, setJobs] = useState<OvertimeJobRecord[]>([]);
  const [selectedJob, setSelectedJob] = useState<OvertimeJobRecord | null>(null);
  const [eligibleTechs, setEligibleTechs] = useState<EligibleTechnician[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filter & Search state
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Edit / Form state
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [editJobOrderNo, setEditJobOrderNo] = useState<string>("");
  const [hasBreak, setHasBreak] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [selectedInitialTechIds, setSelectedInitialTechIds] = useState<number[]>([]);
  const [initialTechSearch, setInitialTechSearch] = useState<string>("");

  const isSupervisorUser = useMemo(() => {
    if (!user) return false;
    return (
      user.roles.includes("ops-telco-supervisor") ||
      user.permissions.includes("ops_telco.forms.manage") ||
      user.permissions.includes("ops_telco.oncall.approve") ||
      user.permissions.includes("ops_telco.overtime.approve")
    );
  }, [user]);

  // Load jobs and eligible technicians
  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [jobsRes, techsRes] = await Promise.all([
        api<{ data: OvertimeJobRecord[] }>("/ops-telco/overtime-jobs"),
        api<{ data: EligibleTechnician[] }>("/ops-telco/overtime-jobs/eligible-technicians")
      ]);

      setJobs(jobsRes.data);
      setEligibleTechs(techsRes.data);

      if (jobsRes.data.length > 0 && !selectedJob && !isCreating) {
        selectJob(jobsRes.data[0]);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal memuat data formulir Overtime.");
    } finally {
      setLoading(false);
    }
  }

  async function selectJob(jobSummary: OvertimeJobRecord) {
    setIsCreating(false);
    setIsBusy(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await api<{ data: OvertimeJobRecord }>(`/ops-telco/overtime-jobs/${jobSummary.id}`);
      const fullJob = res.data;
      setSelectedJob(fullJob);
      setEditJobOrderNo(fullJob.jobOrderNo || "");
      setEditValues(fullJob.data || {});
      setHasBreak(!!fullJob.data?.hasBreak);
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal memuat rincian pekerjaan.");
    } finally {
      setIsBusy(false);
    }
  }

  function startCreateJob() {
    setSelectedJob(null);
    setIsCreating(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setEditJobOrderNo("");
    setHasBreak(false);
    setSelectedInitialTechIds(user ? [user.id] : []);
    setInitialTechSearch("");

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const todayStr = `${yyyy}-${mm}-${dd}`;

    setEditValues({
      dateRequired: todayStr,
      startTime: "",
      endTime: "",
      actualHours: "",
      workOrder: "",
      equipment: "",
      supervisorName: "",
      location: "",
      description: "",
      workDone: ""
    });
  }

  const handleFieldChange = (field: string, value: string) => {
    setEditValues((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "startTime" || field === "endTime") {
        const start = field === "startTime" ? value : next.startTime;
        const end = field === "endTime" ? value : next.endTime;
        if (start && end) {
          next.actualHours = calculateDurationHours(start, end, hasBreak);
        }
      }
      return next;
    });
  };

  const handleToggleBreak = (checked: boolean) => {
    setHasBreak(checked);
    setEditValues((prev) => {
      const start = prev.startTime;
      const end = prev.endTime;
      if (start && end) {
        return {
          ...prev,
          actualHours: calculateDurationHours(start, end, checked)
        };
      }
      return prev;
    });
  };

  async function handleSaveJob(e: FormEvent) {
    e.preventDefault();
    setIsBusy(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payloadData: Record<string, string> = {
        ...editValues,
        hasBreak: hasBreak ? "true" : ""
      };

      if (isCreating) {
        const res = await api<{ data: OvertimeJobRecord }>("/ops-telco/overtime-jobs", {
          method: "POST",
          body: JSON.stringify({
            jobOrderNo: editJobOrderNo.trim() || undefined,
            data: payloadData,
            initialParticipantUserIds: selectedInitialTechIds
          })
        });

        setSuccessMessage("Job Overtime baru berhasil dibuat!");
        await loadData();
        selectJob(res.data);
      } else if (selectedJob) {
        const res = await api<{ data: OvertimeJobRecord }>(`/ops-telco/overtime-jobs/${selectedJob.id}`, {
          method: "PUT",
          body: JSON.stringify({
            jobOrderNo: editJobOrderNo.trim() || undefined,
            data: payloadData
          })
        });

        setSuccessMessage("Perubahan data Job Overtime berhasil disimpan!");
        await loadData();
        selectJob(res.data);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal menyimpan formulir Overtime.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDeleteJob(jobToDelete: OvertimeJobRecord, e?: React.MouseEvent) {
    if (e) {
      e.stopPropagation();
    }
    const label = jobToDelete.jobOrderNo || jobToDelete.formNumber;
    if (!confirm(`Hapus formulir draf "${label}" secara permanen? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await api(`/ops-telco/overtime-jobs/${jobToDelete.id}`, { method: "DELETE" });
      setSuccessMessage(`Formulir draf "${label}" berhasil dihapus.`);

      const remaining = jobs.filter((j) => j.id !== jobToDelete.id);
      setJobs(remaining);

      if (selectedJob?.id === jobToDelete.id) {
        if (remaining.length > 0) {
          selectJob(remaining[0]);
        } else {
          startCreateJob();
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal menghapus formulir draf.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleAddParticipant(userId: number) {
    if (!selectedJob) return;
    try {
      const res = await api<{ data: OvertimeJobRecord }>(`/ops-telco/overtime-jobs/${selectedJob.id}/participants`, {
        method: "POST",
        body: JSON.stringify({ userId, role: "member" })
      });
      setSelectedJob(res.data);
      setSuccessMessage("Teknisi berhasil ditambahkan ke tim!");
    } catch (err: any) {
      throw err;
    }
  }

  async function handleRemoveParticipant(userId: number) {
    if (!selectedJob) return;
    try {
      const res = await api<{ data: OvertimeJobRecord }>(
        `/ops-telco/overtime-jobs/${selectedJob.id}/participants/${userId}`,
        { method: "DELETE" }
      );
      setSelectedJob(res.data);
      setSuccessMessage("Teknisi berhasil dihapus dari tim.");
    } catch (err: any) {
      throw err;
    }
  }

  async function handleTechnicianSign(signatureDataUrl: string) {
    if (!selectedJob) return;
    setIsBusy(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await api<{ data: OvertimeJobRecord }>(`/ops-telco/overtime-jobs/${selectedJob.id}/sign`, {
        method: "POST",
        body: JSON.stringify({ signatureDataUrl })
      });
      setSelectedJob(res.data);
      setSuccessMessage("Tanda tangan digital berhasil dibubuhkan!");
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal membubuhkan tanda tangan.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSubmitToSupervisor() {
    if (!selectedJob) return;
    if (!confirm("Ajukan formulir Job Overtime ini ke Supervisor untuk verifikasi dan approval?")) {
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await api<{ data: OvertimeJobRecord }>(`/ops-telco/overtime-jobs/${selectedJob.id}/submit`, {
        method: "POST"
      });
      setSelectedJob(res.data);
      setSuccessMessage("Formulir berhasil diajukan ke Supervisor! Menunggu approval.");
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal mengajukan formulir ke Supervisor.");
    } finally {
      setIsBusy(false);
    }
  }

  const isPic = selectedJob?.isPic || (selectedJob && user && selectedJob.createdBy === user.id);
  const isParticipant = selectedJob?.isParticipant || isPic;
  const canEditJobData =
    isCreating ||
    ((isPic || isSupervisorUser) &&
      selectedJob &&
      (selectedJob.status === "draft" || selectedJob.status === "revision_requested"));

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (statusFilter !== "all" && job.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNumber = job.formNumber.toLowerCase().includes(q);
        const matchJobOrder = job.jobOrderNo ? job.jobOrderNo.toLowerCase().includes(q) : false;
        const matchPic = job.picName ? job.picName.toLowerCase().includes(q) : false;
        return matchNumber || matchJobOrder || matchPic;
      }
      return true;
    });
  }, [jobs, statusFilter, searchQuery]);

  return (
    <div className={styles.workspace} style={{ gap: "20px" }}>
      {/* Kolom Kiri: Form Editor & Rincian Pekerjaan */}
      <section className={styles.editor}>
        {/* Header Editor Toolbar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "16px"
          }}
        >
          <div>
            <span
              style={{
                fontSize: "10px",
                fontWeight: 800,
                color: "#c2410c",
                letterSpacing: "0.08em",
                textTransform: "uppercase"
              }}
            >
              FORMULIR OPERASIONAL TELCO
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "2px" }}>
              <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#102f42" }}>
                {isCreating
                  ? "Buat Job Overtime Baru"
                  : `Job Overtime: ${selectedJob?.jobOrderNo || selectedJob?.formNumber || "Pilih Pekerjaan"}`}
              </h2>
              {selectedJob && !isCreating && (
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

          <button
            type="button"
            onClick={startCreateJob}
            className={styles.primaryButton}
            style={{
              padding: "8px 16px",
              fontSize: "12px",
              fontWeight: 800,
              background: "#c2410c",
              border: "none",
              borderRadius: "8px",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <span>+</span> Buat Job Baru
          </button>
        </div>

        {/* Notifikasi Sukses / Error */}
        {errorMessage && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "8px",
              background: "#fff2f2",
              border: "1px solid #ffd1d1",
              color: "#c33030",
              fontSize: "13px",
              marginBottom: "16px"
            }}
          >
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "8px",
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              color: "#166534",
              fontSize: "13px",
              marginBottom: "16px"
            }}
          >
            {successMessage}
          </div>
        )}

        {/* Informasi Status Khusus jika Revision / Rejected */}
        {selectedJob?.status === "revision_requested" && selectedJob.approvalHistory.length > 0 && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "10px",
              background: "#fff7ed",
              border: "1px solid #fdba74",
              marginBottom: "16px"
            }}
          >
            <div style={{ fontWeight: 800, color: "#c2410c", fontSize: "13px" }}>
              ⚠️ Catatan Revisi dari Supervisor:
            </div>
            <div style={{ fontSize: "12px", color: "#9a3412", marginTop: "4px" }}>
              "{selectedJob.approvalHistory[0].note}"
            </div>
          </div>
        )}

        {/* Form Isi Data Pekerjaan Overtime */}
        {(selectedJob || isCreating) && (
          <form onSubmit={handleSaveJob} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Bagian 1: Identitas & Referensi Pekerjaan */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderLeft: "4px solid #ea580c",
                borderRadius: "12px",
                padding: "18px 20px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#1e293b", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>📋</span> 1. Identitas & Referensi Pekerjaan
                </h4>
                <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>Nomor Penugasan & Referensi</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "5px" }}>
                    Nomor Job Order (Operasional)
                  </label>
                  <input
                    type="text"
                    value={editJobOrderNo}
                    onChange={(e) => setEditJobOrderNo(e.target.value)}
                    placeholder="Contoh: JO-2026-OT-0812"
                    disabled={!canEditJobData}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      background: canEditJobData ? "#ffffff" : "#f8fafc",
                      color: "#0f172a"
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "5px" }}>
                    Nomor Form Sistem (Otomatis)
                  </label>
                  <input
                    type="text"
                    value={selectedJob?.formNumber || "Dihasilkan otomatis saat simpan"}
                    disabled
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                      fontSize: "13px",
                      background: "#f1f5f9",
                      color: "#64748b"
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "5px" }}>
                    Supervisor (Nama & Badge)
                  </label>
                  <input
                    type="text"
                    value={editValues.supervisorName || ""}
                    onChange={(e) => handleFieldChange("supervisorName", e.target.value)}
                    placeholder="Contoh: Rahmansyah - Z110997"
                    disabled={!canEditJobData}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      background: canEditJobData ? "#ffffff" : "#f8fafc",
                      color: "#0f172a"
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "5px" }}>
                    Work Order No. (WO)
                  </label>
                  <input
                    type="text"
                    value={editValues.workOrder || ""}
                    onChange={(e) => handleFieldChange("workOrder", e.target.value)}
                    placeholder="Contoh: WO-88219"
                    disabled={!canEditJobData}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      background: canEditJobData ? "#ffffff" : "#f8fafc",
                      color: "#0f172a"
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "5px" }}>
                    Equipment No. (Unit / Alat)
                  </label>
                  <input
                    type="text"
                    value={editValues.equipment || ""}
                    onChange={(e) => handleFieldChange("equipment", e.target.value)}
                    placeholder="Contoh: EQ-RAD-04"
                    disabled={!canEditJobData}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      background: canEditJobData ? "#ffffff" : "#f8fafc",
                      color: "#0f172a"
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Bagian 2: Waktu & Jadwal Pelaksanaan */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderLeft: "4px solid #f97316",
                borderRadius: "12px",
                padding: "18px 20px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#1e293b", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>⏱️</span> 2. Waktu & Jadwal Pelaksanaan
                </h4>
                <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>Durasi & Istirahat</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "5px" }}>
                    Tanggal Pelaksanaan
                  </label>
                  <input
                    type="date"
                    value={editValues.dateRequired || ""}
                    onChange={(e) => handleFieldChange("dateRequired", e.target.value)}
                    disabled={!canEditJobData}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      background: canEditJobData ? "#ffffff" : "#f8fafc",
                      color: "#0f172a"
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "5px" }}>
                    Jam Mulai
                  </label>
                  <input
                    type="time"
                    value={editValues.startTime || ""}
                    onChange={(e) => handleFieldChange("startTime", e.target.value)}
                    disabled={!canEditJobData}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      background: canEditJobData ? "#ffffff" : "#f8fafc",
                      color: "#0f172a"
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "5px" }}>
                    Jam Selesai
                  </label>
                  <input
                    type="time"
                    value={editValues.endTime || ""}
                    onChange={(e) => handleFieldChange("endTime", e.target.value)}
                    disabled={!canEditJobData}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      background: canEditJobData ? "#ffffff" : "#f8fafc",
                      color: "#0f172a"
                    }}
                  />
                </div>
              </div>

              {/* Kalkulasi Jam Otomatis & Checkbox Istirahat */}
              {(editValues.startTime || editValues.endTime || editValues.actualHours) && (
                <div
                  style={{
                    marginTop: "14px",
                    padding: "12px 14px",
                    borderRadius: "8px",
                    background: "#fff7ed",
                    border: "1px solid #fed7aa",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "#9a3412" }}>
                        ⏱️ Lama Pekerjaan (Actual Hours):
                      </span>
                      <span
                        style={{
                          fontSize: "14px",
                          fontWeight: 800,
                          color: "#c2410c",
                          background: "#ffffff",
                          padding: "2px 10px",
                          borderRadius: "6px",
                          border: "1px solid #fdba74"
                        }}
                      >
                        {editValues.actualHours || "0"} Jam
                      </span>
                      <span style={{ fontSize: "11px", color: "#ea580c", fontWeight: 700 }}>
                        (OTOMATIS)
                      </span>
                    </div>

                    <label
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "#9a3412",
                        cursor: canEditJobData ? "pointer" : "default"
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={hasBreak}
                        onChange={(e) => handleToggleBreak(e.target.checked)}
                        disabled={!canEditJobData}
                        style={{ width: "15px", height: "15px", accentColor: "#ea580c" }}
                      />
                      <span>Istirahat (dikurangi 1 jam)</span>
                    </label>
                  </div>

                  {hasBreak && (
                    <div style={{ fontSize: "11px", color: "#c2410c", fontStyle: "italic" }}>
                      * Total durasi kerja otomatis dipotong 1 jam untuk waktu istirahat teknisi.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bagian 3: Lokasi & Uraian Pekerjaan */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderLeft: "4px solid #10b981",
                borderRadius: "12px",
                padding: "18px 20px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#1e293b", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>📍</span> 3. Lokasi & Uraian Pekerjaan
                </h4>
                <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>Detail Pelaksanaan</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "5px" }}>
                    Lokasi Pekerjaan
                  </label>
                  <input
                    type="text"
                    value={editValues.location || ""}
                    onChange={(e) => handleFieldChange("location", e.target.value)}
                    placeholder="Contoh: KPC Sangatta - Pit Timur Substation"
                    disabled={!canEditJobData}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      background: canEditJobData ? "#ffffff" : "#f8fafc",
                      color: "#0f172a"
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "5px" }}>
                    Keterangan Pekerjaan / Masalah yang Dihadapi
                  </label>
                  <textarea
                    rows={3}
                    value={editValues.description || ""}
                    onChange={(e) => handleFieldChange("description", e.target.value)}
                    placeholder="Uraikan kendala, permintaan pekerjaan, atau permasalahan teknis..."
                    disabled={!canEditJobData}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      background: canEditJobData ? "#ffffff" : "#f8fafc",
                      color: "#0f172a",
                      resize: "vertical"
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "5px" }}>
                    Penyelesaian Pekerjaan / Solusi Tindakan
                  </label>
                  <textarea
                    rows={3}
                    value={editValues.workDone || ""}
                    onChange={(e) => handleFieldChange("workDone", e.target.value)}
                    placeholder="Uraikan tindakan perbaikan, penggantian suku cadang, dan hasil pengetesan..."
                    disabled={!canEditJobData}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      background: canEditJobData ? "#ffffff" : "#f8fafc",
                      color: "#0f172a",
                      resize: "vertical"
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Bagian 4: Tim Teknisi Pelaksana (Hanya saat Buat Baru) */}
            {isCreating && (
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderLeft: "4px solid #6366f1",
                  borderRadius: "12px",
                  padding: "18px 20px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#1e293b", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span>👥</span> 4. Tim Teknisi Pelaksana
                  </h4>
                  <span style={{ fontSize: "11px", color: "#c2410c", fontWeight: 700 }}>
                    👑 Anda otomatis terdaftar sebagai PIC
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>
                    Pilih Teknisi Tambahan (Opsional):
                  </label>
                  {selectedInitialTechIds.length > 0 && (
                    <span style={{ fontSize: "11px", fontWeight: 800, color: "#c2410c", background: "#fff7ed", padding: "2px 8px", borderRadius: "10px" }}>
                      ✓ {selectedInitialTechIds.length} personil dipilih
                    </span>
                  )}
                </div>

                <div style={{ marginBottom: "10px" }}>
                  <input
                    type="text"
                    placeholder="🔍 Cari nama atau KPC teknisi..."
                    value={initialTechSearch}
                    onChange={(e) => setInitialTechSearch(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "12px",
                      background: "#fff",
                      color: "#0f172a"
                    }}
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                    gap: "8px",
                    maxHeight: "170px",
                    overflowY: "auto",
                    padding: "10px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "10px",
                    background: "#f8fafc"
                  }}
                >
                  {eligibleTechs
                    .filter((t) => t.id !== user?.id)
                    .filter((t) => {
                      if (!initialTechSearch.trim()) return true;
                      const q = initialTechSearch.toLowerCase();
                      return (
                        t.name.toLowerCase().includes(q) ||
                        (t.kpcId && t.kpcId.toLowerCase().includes(q))
                      );
                    })
                    .map((t) => {
                      const isChecked = selectedInitialTechIds.includes(t.id);
                      return (
                        <label
                          key={t.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            fontSize: "12px",
                            cursor: "pointer",
                            padding: "6px 10px",
                            borderRadius: "7px",
                            background: isChecked ? "#fff7ed" : "#ffffff",
                            border: `1px solid ${isChecked ? "#fdba74" : "#e2e8f0"}`,
                            transition: "all 0.15s ease"
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedInitialTechIds([...selectedInitialTechIds, t.id]);
                              } else {
                                setSelectedInitialTechIds(
                                  selectedInitialTechIds.filter((id) => id !== t.id)
                                );
                              }
                            }}
                            style={{ width: "15px", height: "15px", accentColor: "#ea580c" }}
                          />
                          <span style={{ fontWeight: isChecked ? 700 : 500, color: isChecked ? "#9a3412" : "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {t.name} {t.kpcId && `(${t.kpcId})`}
                          </span>
                        </label>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Action Buttons for Form Save */}
            <div className={styles.actions} style={{ marginTop: "4px" }}>
              {canEditJobData && (
                <button
                  type="submit"
                  disabled={isBusy}
                  className={styles.primaryButton}
                  style={{
                    background: "#c2410c",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 22px",
                    fontSize: "13px",
                    fontWeight: 800,
                    borderRadius: "8px",
                    boxShadow: "0 2px 4px rgba(194, 65, 12, 0.2)"
                  }}
                >
                  <span>💾</span>
                  <span>{isCreating ? "Simpan Draf Job Baru" : "Simpan Perubahan Data"}</span>
                </button>
              )}

              {/* PDF Download Button */}
              {selectedJob && (
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
                    padding: "10px 18px",
                    fontSize: "13px",
                    fontWeight: 700,
                    borderRadius: "8px"
                  }}
                >
                  <span>{selectedJob.status === "approved" ? "📥" : "📄"}</span>
                  <span>{selectedJob.status === "approved" ? "Unduh PDF Final" : "Lihat Draf PDF (Watermark)"}</span>
                </a>
              )}
            </div>
          </form>
        )}

        {/* Tim Teknisi Pelaksana List Component */}
        {selectedJob && (
          <div style={{ marginTop: "24px" }}>
            <OncallParticipantsList
              participants={selectedJob.participants}
              signatures={selectedJob.signatures}
              workflowVersion={selectedJob.workflowVersion}
              isPicOrSpv={isPic || isSupervisorUser}
              canManage={isSupervisorUser}
              canEdit={selectedJob.status === "draft" || selectedJob.status === "revision_requested"}
              eligibleTechnicians={eligibleTechs}
              onAddParticipant={handleAddParticipant}
              onRemoveParticipant={handleRemoveParticipant}
              currentUserId={user?.id}
            />
          </div>
        )}

        {/* Technician Digital Signature Area (if needed) */}
        {selectedJob &&
          selectedJob.status === "technician_signing" &&
          isParticipant && (
            <div style={{ marginTop: "24px" }}>
              <SignaturePad
                onSave={handleTechnicianSign}
                title="Tanda Tangan Pelaksanaan Lembur"
                subtitle={`Sebagai teknisi (${user?.name}), bubuhkan tanda tangan digital untuk memvalidasi pekerjaan lembur ini.`}
                submitLabel="Bubuhkan Tanda Tangan"
                disabled={isBusy}
              />
            </div>
          )}

        {/* Workflow Progression Actions */}
        {selectedJob && (
          <div
            style={{
              marginTop: "24px",
              padding: "16px",
              borderRadius: "12px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px"
            }}
          >
            <div>
              <div style={{ fontSize: "13px", fontWeight: 800, color: "#1e293b" }}>
                Status Alur Kerja: {statusMeta[selectedJob.status].label}
              </div>
              <div style={{ fontSize: "11px", color: "#64748b" }}>
                Versi Dokumen: {selectedJob.workflowVersion}
                {selectedJob.lockedAt && ` • Dikunci: ${new Date(selectedJob.lockedAt).toLocaleDateString("id-ID")}`}
                {selectedJob.submittedAt && ` • Diajukan: ${new Date(selectedJob.submittedAt).toLocaleDateString("id-ID")}`}
                {selectedJob.approvedAt && ` • Disetujui: ${new Date(selectedJob.approvedAt).toLocaleDateString("id-ID")}`}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {/* Tombol Ajukan ke Supervisor */}
              {(isPic || isSupervisorUser) &&
                (selectedJob.status === "draft" ||
                  selectedJob.status === "technician_signing" ||
                  selectedJob.status === "revision_requested") && (
                  <button
                    type="button"
                    onClick={handleSubmitToSupervisor}
                    disabled={isBusy}
                    className={styles.primaryButton}
                    style={{ background: "#16a34a", cursor: "pointer" }}
                    title="Ajukan formulir Job Overtime ini ke Supervisor untuk approval"
                  >
                    📤 Ajukan ke Supervisor
                  </button>
                )}

              {/* Tombol Hapus Draf: Khusus status draft */}
              {selectedJob.status === "draft" && (isPic || isSupervisorUser) && (
                <button
                  type="button"
                  onClick={() => handleDeleteJob(selectedJob)}
                  disabled={isBusy}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "8px",
                    border: "1px solid #fca5a5",
                    background: "#fef2f2",
                    color: "#dc2626",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: isBusy ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                  title="Hapus formulir draf ini"
                >
                  🗑️ Hapus Draf
                </button>
              )}

              {/* Status Submitted: Menunggu persetujuan supervisor */}
              {selectedJob.status === "submitted" && (
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "12px", color: "#b45309", fontWeight: 700 }}>
                    ⏳ Menunggu Approval Supervisor
                  </span>
                  {isSupervisorUser && (
                    <a
                      href="/portal/ops-telco/approval-form-overtime"
                      className={styles.primaryButton}
                      style={{
                        background: "#c2410c",
                        textDecoration: "none",
                        fontSize: "12px",
                        padding: "6px 14px"
                      }}
                    >
                      Buka Menu Approval Supervisor →
                    </a>
                  )}
                </div>
              )}

              {/* Status Approved */}
              {selectedJob.status === "approved" && (
                <span style={{ fontSize: "12px", color: "#16a34a", fontWeight: 700 }}>
                  ✓ Telah Disetujui oleh Supervisor
                </span>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Kolom Kanan: Daftar Job (List & Filter) */}
      <aside className={styles.history}>
        <div className={styles.historyHeader}>
          <div>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 800 }}>Daftar Job Overtime</h3>
            <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#64748b" }}>
              {isSupervisorUser ? "Semua Pekerjaan" : "Pekerjaan Ditugaskan"}
            </p>
          </div>
          <span>{filteredJobs.length}</span>
        </div>

        {/* Filter & Search */}
        <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <input
            type="text"
            placeholder="Cari No Job / PIC..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: "6px 10px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              fontSize: "12px",
              width: "100%",
              background: "#fff"
            }}
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: "6px 10px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              fontSize: "12px",
              width: "100%",
              background: "#fff"
            }}
          >
            <option value="all">Semua Status</option>
            <option value="draft">Draf</option>
            <option value="technician_signing">Menunggu TTD</option>
            <option value="submitted">Menunggu SPV</option>
            <option value="revision_requested">Perlu Revisi</option>
            <option value="approved">Disetujui</option>
            <option value="rejected">Ditolak</option>
          </select>
        </div>

        {/* List of Jobs */}
        <div className={styles.recordList}>
          {filteredJobs.length === 0 ? (
            <div style={{ padding: "20px 12px", textAlign: "center", color: "#94a3b8", fontSize: "12px" }}>
              Tidak ada pekerjaan ditemukan.
            </div>
          ) : (
            filteredJobs.map((job) => {
              const isSelected = selectedJob?.id === job.id;
              const meta = statusMeta[job.status] || statusMeta.draft;

              return (
                <div
                  key={job.id}
                  onClick={() => selectJob(job)}
                  className={`${styles.record} ${isSelected ? styles.selected : ""}`}
                  style={{ cursor: "pointer", position: "relative" }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      selectJob(job);
                    }
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                    <span style={{ fontWeight: 800, fontSize: "13px", color: "#102f42", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {job.jobOrderNo || job.formNumber}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: "5px", flexShrink: 0 }}>
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
                      {job.status === "draft" && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteJob(job, e)}
                          title="Hapus formulir draf ini"
                          disabled={isBusy}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "22px",
                            height: "22px",
                            borderRadius: "5px",
                            border: "1px solid #fecaca",
                            background: "#fff",
                            color: "#ef4444",
                            fontSize: "11px",
                            cursor: isBusy ? "not-allowed" : "pointer",
                            padding: 0,
                            lineHeight: 1,
                            transition: "all 0.15s ease"
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#fee2e2";
                            e.currentTarget.style.borderColor = "#f87171";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "#fff";
                            e.currentTarget.style.borderColor = "#fecaca";
                          }}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                    PIC: {job.picName || "Belum ditentukan"}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: "10px",
                      color: "#94a3b8",
                      marginTop: "4px"
                    }}
                  >
                    <span>{job.formNumber}</span>
                    <span>
                      👥 {job.totalParticipants || 1} Personil
                    </span>
                  </div>

                  {job.isLegacy && (
                    <span
                      style={{
                        fontSize: "9px",
                        color: "#6b7280",
                        background: "#f3f4f6",
                        padding: "1px 4px",
                        borderRadius: "3px",
                        alignSelf: "flex-start",
                        marginTop: "4px"
                      }}
                    >
                      Riwayat Lama
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}
