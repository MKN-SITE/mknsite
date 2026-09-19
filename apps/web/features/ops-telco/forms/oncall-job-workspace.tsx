"use client";

import React, { useEffect, useMemo, useState } from "react";
import { API_URL, api, type PortalUser } from "@/lib/api";
import { OncallParticipantsList } from "./oncall-participants-list";
import { SignaturePad } from "./signature-pad";
import type {
  EligibleTechnician,
  FormFieldDefinition,
  OncallJobRecord,
  OncallJobStatus
} from "./telco-form-types";
import styles from "./telco-form-workspace.module.css";

const operationalFields: FormFieldDefinition[] = [
  { key: "dateRequired", label: "Tanggal pelaksanaan", type: "date" },
  { key: "customerRequestBy", label: "Call out diminta oleh (nama & badge)" },
  { key: "startTime", label: "Jam mulai", type: "time" },
  { key: "endTime", label: "Jam selesai", type: "time" },
  { key: "actualHours", label: "Lama pekerjaan / actual hours (jam)", type: "number", wide: true },
  { key: "workOrder", label: "Work Order No." },
  { key: "equipment", label: "Equipment No." },
  { key: "supervisorName", label: "Supervisor — nama & badge", wide: true },
  { key: "location", label: "Lokasi pekerjaan", wide: true },
  { key: "description", label: "Keterangan pekerjaan", type: "textarea", wide: true },
  { key: "workDone", label: "Penyelesaian pekerjaan", type: "textarea", wide: true }
];

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

const statusMeta: Record<
  OncallJobStatus,
  { label: string; bg: string; color: string; border: string }
> = {
  draft: { label: "Draf", bg: "#f1f5f9", color: "#475569", border: "#cbd5e1" },
  technician_signing: {
    label: "Menunggu TTD",
    bg: "#e0f2fe",
    color: "#0369a1",
    border: "#bae6fd"
  },
  submitted: {
    label: "Menunggu Approval SPV",
    bg: "#fef3c7",
    color: "#b45309",
    border: "#fde68a"
  },
  revision_requested: {
    label: "Perlu Revisi",
    bg: "#ffedd5",
    color: "#c2410c",
    border: "#fed7aa"
  },
  approved: {
    label: "Disetujui",
    bg: "#dcfce7",
    color: "#15803d",
    border: "#bbf7d0"
  },
  rejected: {
    label: "Ditolak",
    bg: "#fee2e2",
    color: "#b91c1c",
    border: "#fca5a5"
  }
};

interface OncallJobWorkspaceProps {
  user?: PortalUser | null;
}

export function OncallJobWorkspace({ user }: OncallJobWorkspaceProps) {
  const [jobs, setJobs] = useState<OncallJobRecord[]>([]);
  const [selectedJob, setSelectedJob] = useState<OncallJobRecord | null>(null);
  const [eligibleTechs, setEligibleTechs] = useState<EligibleTechnician[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [message, setMessage] = useState<{ type: "info" | "error" | "success"; text: string } | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  // Form edit values
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [jobOrderNoInput, setJobOrderNoInput] = useState("");
  const [selectedInitialTechIds, setSelectedInitialTechIds] = useState<number[]>([]);
  const [initialTechSearch, setInitialTechSearch] = useState("");
  const [dirty, setDirty] = useState(false);

  // Load jobs and eligible technicians
  const loadJobs = async () => {
    try {
      const res = await api<{ data: OncallJobRecord[] }>("/ops-telco/oncall-jobs");
      setJobs(res.data);
      if (selectedJob) {
        const refreshed = res.data.find((j) => j.id === selectedJob.id);
        if (refreshed) {
          // Fetch full detail for selected
          const detailRes = await api<{ data: OncallJobRecord }>(`/ops-telco/oncall-jobs/${selectedJob.id}`);
          setSelectedJob(detailRes.data);
          setEditValues(detailRes.data.data || {});
          setJobOrderNoInput(detailRes.data.jobOrderNo || "");
        }
      }
    } catch {
      setMessage({ type: "error", text: "Gagal memuat daftar pekerjaan Oncall." });
    }
  };

  const activeDate = isCreating
    ? editValues.dateRequired
    : (selectedJob?.data?.dateRequired || editValues.dateRequired);

  useEffect(() => {
    loadJobs();
  }, []);

  useEffect(() => {
    const q = activeDate ? `?date=${encodeURIComponent(activeDate)}` : "";
    api<{ data: EligibleTechnician[] }>(`/ops-telco/oncall-jobs/eligible-technicians${q}`)
      .then((res) => setEligibleTechs(res.data))
      .catch(() => {});
  }, [activeDate]);

  const isCurrentUserOnCuti = useMemo(() => {
    if (!user || !eligibleTechs.length) return false;
    const me = eligibleTechs.find((t) => t.id === user.id);
    return !!me?.isOnCuti;
  }, [user, eligibleTechs]);

  const selectJob = async (job: OncallJobRecord) => {
    setIsCreating(false);
    setMessage(null);
    setDirty(false);
    setIsBusy(true);
    try {
      const res = await api<{ data: OncallJobRecord }>(`/ops-telco/oncall-jobs/${job.id}`);
      setSelectedJob(res.data);
      setEditValues(res.data.data || {});
      setJobOrderNoInput(res.data.jobOrderNo || "");
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Gagal memuat detail pekerjaan." });
    } finally {
      setIsBusy(false);
    }
  };

  const startCreateNew = () => {
    setSelectedJob(null);
    setIsCreating(true);
    setJobOrderNoInput("");
    setEditValues({
      dateRequired: new Date().toISOString().slice(0, 10),
      startTime: "",
      endTime: "",
      actualHours: "",
      location: "",
      description: "",
      workDone: ""
    });
    setSelectedInitialTechIds([]);
    setInitialTechSearch("");
    setDirty(false);
    setMessage({ type: "info", text: "Isi data pekerjaan Job Oncall baru. Anda akan otomatis menjadi PIC." });
  };

  // Roles & Permissions check
  const isPic = useMemo(() => {
    if (!selectedJob || !user) return false;
    return (
      selectedJob.participants.some(
        (p) => p.userId === user.id && p.participantRole === "pic"
      ) || selectedJob.createdBy === user.id
    );
  }, [selectedJob, user]);

  const isSupervisorUser = useMemo(() => {
    if (!user) return false;
    return (
      user.permissions.includes("ops_telco.forms.manage") ||
      user.permissions.includes("ops_telco.oncall.approve") ||
      user.roles.includes("ops-telco-supervisor")
    );
  }, [user]);

  const isParticipant = useMemo(() => {
    if (!selectedJob || !user) return false;
    return selectedJob.participants.some((p) => p.userId === user.id);
  }, [selectedJob, user]);

  const canEditJobData = useMemo(() => {
    if (isCreating) return true;
    if (!selectedJob) return false;
    if (selectedJob.status === "approved" || selectedJob.status === "rejected") return false;
    if (selectedJob.status === "submitted") return false;
    return isPic || isSupervisorUser;
  }, [isCreating, selectedJob, isPic, isSupervisorUser]);

  // Check if current user has already signed for current workflowVersion
  const hasUserSignedCurrentVersion = useMemo(() => {
    if (!selectedJob || !user) return false;
    return selectedJob.signatures.some(
      (s) =>
        s.signerUserId === user.id &&
        s.signerType === "technician" &&
        s.workflowVersion === selectedJob.workflowVersion
    );
  }, [selectedJob, user]);

  // Check if all technicians have signed
  const allTechniciansSigned = useMemo(() => {
    if (!selectedJob || selectedJob.participants.length === 0) return false;
    const currentSigs = selectedJob.signatures.filter(
      (s) => s.signerType === "technician" && s.workflowVersion === selectedJob.workflowVersion
    );
    const signedUserIds = new Set(currentSigs.map((s) => s.signerUserId));
    return selectedJob.participants.every((p) => signedUserIds.has(p.userId));
  }, [selectedJob]);

  // Filter jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter((j) => {
      if (statusFilter !== "all" && j.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNumber = j.formNumber.toLowerCase().includes(q);
        const matchJob = (j.jobOrderNo || "").toLowerCase().includes(q);
        const matchPic = (j.picName || "").toLowerCase().includes(q);
        return matchNumber || matchJob || matchPic;
      }
      return true;
    });
  }, [jobs, statusFilter, searchQuery]);

  // Handlers
  const handleFieldChange = (key: string, value: string) => {
    setEditValues((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "startTime" || key === "endTime") {
        const start = key === "startTime" ? value : next.startTime;
        const end = key === "endTime" ? value : next.endTime;
        const hasBreak = next.hasBreak === "1" || next.hasBreak === "true";
        if (start && end) {
          const calculated = calculateDurationHours(start, end, hasBreak);
          if (calculated) {
            next.actualHours = calculated;
          }
        } else {
          next.actualHours = "";
        }
      }
      return next;
    });
    setDirty(true);
  };

  const handleBreakToggle = (checked: boolean) => {
    setEditValues((prev) => {
      const next: Record<string, string> = { ...prev, hasBreak: checked ? "1" : "0" };
      const start = next.startTime;
      const end = next.endTime;
      if (start && end) {
        const calculated = calculateDurationHours(start, end, checked);
        if (calculated) {
          next.actualHours = calculated;
        }
      } else if (next.actualHours && !isNaN(Number(next.actualHours))) {
        const currentVal = Number(next.actualHours);
        const adjusted = checked ? Math.max(0, currentVal - 1) : currentVal + 1;
        next.actualHours = adjusted.toString();
      }
      return next;
    });
    setDirty(true);
  };

  const handleSaveJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsBusy(true);
    setMessage(null);
    try {
      const finalData = { ...editValues };
      const hasBreak = finalData.hasBreak === "1" || finalData.hasBreak === "true";
      if (finalData.startTime && finalData.endTime && !finalData.actualHours) {
        finalData.actualHours = calculateDurationHours(finalData.startTime, finalData.endTime, hasBreak);
      }
      if (isCreating) {
        const res = await api<{ data: OncallJobRecord }>("/ops-telco/oncall-jobs", {
          method: "POST",
          body: JSON.stringify({
            jobOrderNo: jobOrderNoInput.trim() || undefined,
            data: finalData,
            participantUserIds: selectedInitialTechIds
          })
        });
        setMessage({ type: "success", text: "Job Oncall berhasil dibuat sebagai draf." });
        setIsCreating(false);
        await loadJobs();
        await selectJob(res.data);
      } else if (selectedJob) {
        const res = await api<{ data: OncallJobRecord }>(
          `/ops-telco/oncall-jobs/${selectedJob.id}/details`,
          {
            method: "PATCH",
            body: JSON.stringify({
              jobOrderNo: jobOrderNoInput.trim() || undefined,
              data: finalData
            })
          }
        );
        setMessage({ type: "success", text: "Data pekerjaan berhasil diperbarui." });
        setDirty(false);
        await loadJobs();
        setSelectedJob(res.data);
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Gagal menyimpan data." });
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeleteJob = async (job: OncallJobRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const jobName = job.jobOrderNo || job.formNumber;
    if (!window.confirm(`Apakah Anda yakin ingin menghapus formulir draf "${jobName}"? Data yang dihapus tidak dapat dipulihkan kembali.`)) {
      return;
    }

    setIsBusy(true);
    setMessage(null);
    try {
      await api(`/ops-telco/oncall-jobs/${job.id}`, {
        method: "DELETE"
      });
      setMessage({ type: "success", text: `Formulir draf ${jobName} berhasil dihapus.` });
      if (selectedJob?.id === job.id) {
        setSelectedJob(null);
        setEditValues({});
        setDirty(false);
      }
      await loadJobs();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Gagal menghapus formulir draf." });
    } finally {
      setIsBusy(false);
    }
  };

  const handleLockForSigning = async () => {
    if (!selectedJob) return;
    if (!confirm("Kunci data pekerjaan dan minta tanda tangan seluruh teknisi? Data tidak dapat diubah tanpa mereset tanda tangan.")) return;
    setIsBusy(true);
    setMessage(null);
    try {
      const res = await api<{ data: OncallJobRecord }>(
        `/ops-telco/oncall-jobs/${selectedJob.id}/lock`,
        { method: "POST" }
      );
      setMessage({ type: "success", text: "Pekerjaan dikunci. Seluruh teknisi kini dapat menandatangani form." });
      setSelectedJob(res.data);
      await loadJobs();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Gagal mengunci pekerjaan." });
    } finally {
      setIsBusy(false);
    }
  };

  const handleTechnicianSign = async (dataUrl: string) => {
    if (!selectedJob) return;
    setIsBusy(true);
    setMessage(null);
    try {
      const res = await api<{ data: OncallJobRecord }>(
        `/ops-telco/oncall-jobs/${selectedJob.id}/sign`,
        {
          method: "POST",
          body: JSON.stringify({ signatureDataUrl: dataUrl })
        }
      );
      setMessage({ type: "success", text: "Tanda tangan Anda berhasil dicatat dan diverifikasi." });
      setSelectedJob(res.data);
      await loadJobs();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Gagal menandatangani form." });
    } finally {
      setIsBusy(false);
    }
  };

  const handleSubmitToSupervisor = async () => {
    if (!selectedJob) return;
    if (!confirm("Ajukan formulir Job Oncall ini ke Supervisor untuk verifikasi dan persetujuan akhir?")) return;
    setIsBusy(true);
    setMessage(null);
    try {
      const res = await api<{ data: OncallJobRecord }>(
        `/ops-telco/oncall-jobs/${selectedJob.id}/submit`,
        { method: "POST" }
      );
      setMessage({ type: "success", text: "Formulir berhasil diajukan ke Supervisor." });
      setSelectedJob(res.data);
      await loadJobs();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Gagal mengajukan formulir." });
    } finally {
      setIsBusy(false);
    }
  };

  const handleAddParticipant = async (userId: number) => {
    if (!selectedJob) return;
    const res = await api<{ data: OncallJobRecord }>(
      `/ops-telco/oncall-jobs/${selectedJob.id}/participants`,
      {
        method: "POST",
        body: JSON.stringify({ userId, role: "member" })
      }
    );
    setSelectedJob(res.data);
    await loadJobs();
  };

  const handleRemoveParticipant = async (userId: number) => {
    if (!selectedJob) return;
    const res = await api<{ data: OncallJobRecord }>(
      `/ops-telco/oncall-jobs/${selectedJob.id}/participants/${userId}`,
      { method: "DELETE" }
    );
    setSelectedJob(res.data);
    await loadJobs();
  };

  // Latest revision note if any
  const latestRevisionNote = useMemo(() => {
    if (!selectedJob || selectedJob.status !== "revision_requested") return null;
    const revItem = selectedJob.approvalHistory.find(
      (h) => h.decision === "revision_requested"
    );
    return revItem?.note || null;
  }, [selectedJob]);

  return (
    <div className={styles.workspace}>
      {/* Kolom Kiri / Utama: Form Editor & Rincian */}
      <section className={styles.editor}>
        <div className={styles.toolbar}>
          <div>
            <p className={styles.eyebrow}>Formulir Operasional Telco</p>
            <h2>
              {isCreating
                ? "Buat Job Oncall Baru"
                : selectedJob
                ? `Job Oncall: ${selectedJob.jobOrderNo || selectedJob.formNumber}`
                : "Pilih atau Buat Job Oncall"}
            </h2>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {selectedJob && (
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 800,
                  padding: "5px 12px",
                  borderRadius: "20px",
                  background: statusMeta[selectedJob.status].bg,
                  color: statusMeta[selectedJob.status].color,
                  border: `1px solid ${statusMeta[selectedJob.status].border}`
                }}
              >
                {statusMeta[selectedJob.status].label}
                {selectedJob.isLegacy && " (Riwayat Lama)"}
              </span>
            )}
            <button
              type="button"
              onClick={startCreateNew}
              className={styles.secondaryButton}
              style={{ background: "#075d91", color: "#fff", border: "none" }}
            >
              + Buat Job Baru
            </button>
          </div>
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

        {/* Catatan Revisi dari Supervisor */}
        {latestRevisionNote && (
          <div
            style={{
              margin: "16px 0",
              padding: "14px 16px",
              borderRadius: "10px",
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              color: "#9a3412"
            }}
          >
            <div style={{ fontWeight: 800, fontSize: "13px", marginBottom: "4px" }}>
              ⚠️ Permintaan Revisi dari Supervisor:
            </div>
            <div style={{ fontSize: "12px", lineHeight: "1.5" }}>{latestRevisionNote}</div>
          </div>
        )}

        {/* Peringatan Cuti untuk Pembuat Form */}
        {isCreating && isCurrentUserOnCuti && (
          <div
            style={{
              margin: "16px 0",
              padding: "14px 16px",
              borderRadius: "10px",
              background: "#fef2f2",
              border: "1.5px solid #fca5a5",
              color: "#991b1b"
            }}
          >
            <div style={{ fontWeight: 800, fontSize: "13px", marginBottom: "4px" }}>
              ⛔ Anda Tercatat Sedang Cuti
            </div>
            <div style={{ fontSize: "12px", lineHeight: "1.5" }}>
              Anda memiliki cuti aktif pada tanggal pelaksanaan ({editValues.dateRequired}). Sesuai kebijakan operasional, teknisi yang sedang cuti tidak dapat bertugas atau menjadi PIC Oncall.
            </div>
          </div>
        )}

        {/* Form Isi Data Pekerjaan */}
        {(selectedJob || isCreating) && (
          <form onSubmit={handleSaveJob} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Bagian 1: Identitas & Referensi Pekerjaan */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "14px",
                padding: "20px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "16px",
                  paddingBottom: "10px",
                  borderBottom: "1px solid #f1f5f9"
                }}
              >
                <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#1e293b", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>📋</span> 1. Identitas & Referensi Pekerjaan
                </h4>
                <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>
                  Nomor Penugasan & Referensi
                </span>
              </div>

              <div className={styles.formGrid}>
                {/* Nomor Job Order (Operasional) */}
                <div className={styles.fieldset}>
                  <label>
                    <span style={{ fontWeight: 700, color: "#334155" }}>Nomor Job Order (Operasional)</span>
                    <input
                      type="text"
                      placeholder="Contoh: JO-2026-0812"
                      value={jobOrderNoInput}
                      onChange={(e) => {
                        setJobOrderNoInput(e.target.value);
                        setDirty(true);
                      }}
                      readOnly={!canEditJobData}
                    />
                  </label>
                </div>

                {/* Nomor Form Sistem (Otomatis) */}
                <div className={styles.fieldset}>
                  <label>
                    <span style={{ fontWeight: 700, color: "#334155" }}>Nomor Form Sistem (Otomatis)</span>
                    <input
                      type="text"
                      value={selectedJob ? selectedJob.formNumber : "🔒 Dihasilkan otomatis saat simpan"}
                      readOnly
                      style={{ background: "#f8fafc", color: "#64748b" }}
                    />
                  </label>
                </div>

                {/* Customer Request By */}
                <div className={styles.fieldset}>
                  <label>
                    <span style={{ fontWeight: 700, color: "#334155" }}>Call Out Diminta Oleh (Nama & Badge)</span>
                    <input
                      type="text"
                      placeholder="Nama customer / pemohon & badge"
                      value={editValues.customerRequestBy || ""}
                      onChange={(e) => handleFieldChange("customerRequestBy", e.target.value)}
                      readOnly={!canEditJobData}
                    />
                  </label>
                </div>

                {/* Supervisor Yang Dituju */}
                <div className={styles.fieldset}>
                  <label>
                    <span style={{ fontWeight: 700, color: "#334155" }}>Supervisor (Nama & Badge)</span>
                    <input
                      type="text"
                      placeholder="Contoh: Rahmansyah - Z110997"
                      value={editValues.supervisorName || ""}
                      onChange={(e) => handleFieldChange("supervisorName", e.target.value)}
                      readOnly={!canEditJobData}
                    />
                  </label>
                </div>

                {/* Work Order No */}
                <div className={styles.fieldset}>
                  <label>
                    <span style={{ fontWeight: 700, color: "#334155" }}>Work Order No. (WO)</span>
                    <input
                      type="text"
                      placeholder="Nomor Work Order (jika ada)"
                      value={editValues.workOrder || ""}
                      onChange={(e) => handleFieldChange("workOrder", e.target.value)}
                      readOnly={!canEditJobData}
                    />
                  </label>
                </div>

                {/* Equipment No */}
                <div className={styles.fieldset}>
                  <label>
                    <span style={{ fontWeight: 700, color: "#334155" }}>Equipment No. (Unit / Alat)</span>
                    <input
                      type="text"
                      placeholder="Nomor unit alat / perangkat"
                      value={editValues.equipment || ""}
                      onChange={(e) => handleFieldChange("equipment", e.target.value)}
                      readOnly={!canEditJobData}
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Bagian 2: Waktu & Jadwal Pelaksanaan */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "14px",
                padding: "20px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "16px",
                  paddingBottom: "10px",
                  borderBottom: "1px solid #f1f5f9"
                }}
              >
                <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#1e293b", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>⏱️</span> 2. Waktu & Jadwal Pelaksanaan
                </h4>
                <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>
                  Durasi & Istirahat
                </span>
              </div>

              <div className={styles.formGrid}>
                {/* Tanggal Pelaksanaan */}
                <div className={`${styles.fieldset} ${styles.wide}`}>
                  <label>
                    <span style={{ fontWeight: 700, color: "#334155" }}>Tanggal Pelaksanaan</span>
                    <input
                      type="date"
                      value={editValues.dateRequired || ""}
                      onChange={(e) => handleFieldChange("dateRequired", e.target.value)}
                      readOnly={!canEditJobData}
                    />
                  </label>
                </div>

                {/* Jam Mulai */}
                <div className={styles.fieldset}>
                  <label>
                    <span style={{ fontWeight: 700, color: "#334155" }}>Jam Mulai</span>
                    <input
                      type="time"
                      value={editValues.startTime || ""}
                      onChange={(e) => handleFieldChange("startTime", e.target.value)}
                      readOnly={!canEditJobData}
                    />
                  </label>
                </div>

                {/* Jam Selesai */}
                <div className={styles.fieldset}>
                  <label>
                    <span style={{ fontWeight: 700, color: "#334155" }}>Jam Selesai</span>
                    <input
                      type="time"
                      value={editValues.endTime || ""}
                      onChange={(e) => handleFieldChange("endTime", e.target.value)}
                      readOnly={!canEditJobData}
                    />
                  </label>
                </div>

                {/* Actual Hours (Otomatis) & Checkbox Istirahat */}
                {(Boolean(editValues.startTime && editValues.endTime) || Boolean(editValues.actualHours)) && (
                  <div
                    className={`${styles.fieldset} ${styles.wide}`}
                    style={{
                      background: "#f0f9ff",
                      border: "1px solid #bae6fd",
                      borderRadius: "12px",
                      padding: "14px 18px",
                      marginTop: "4px"
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-end",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: "14px"
                      }}
                    >
                      <label style={{ flex: "1 1 200px", minWidth: "160px" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "#0369a1", fontWeight: 750 }}>
                          <span>⏱️ Lama Pekerjaan (Actual Hours)</span>
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 700,
                              background: "#0284c7",
                              color: "#fff",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              textTransform: "uppercase"
                            }}
                          >
                            Otomatis
                          </span>
                        </span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={editValues.actualHours || ""}
                          placeholder="Otomatis dihitung dari jam"
                          onChange={(e) => handleFieldChange("actualHours", e.target.value)}
                          readOnly={!canEditJobData}
                          style={{
                            background: "#ffffff",
                            borderColor: "#7dd3fc",
                            fontWeight: 700,
                            fontSize: "15px",
                            color: "#0f172a"
                          }}
                        />
                      </label>

                      <label
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "8px 14px",
                          background: editValues.hasBreak === "1" || editValues.hasBreak === "true" ? "#ffedd5" : "#ffffff",
                          border: editValues.hasBreak === "1" || editValues.hasBreak === "true" ? "1px solid #fdba74" : "1px solid #cbd5e1",
                          borderRadius: "9px",
                          fontSize: "13px",
                          fontWeight: 650,
                          color: editValues.hasBreak === "1" || editValues.hasBreak === "true" ? "#c2410c" : "#334155",
                          cursor: canEditJobData ? "pointer" : "default",
                          userSelect: "none",
                          transition: "all 0.2s ease"
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={editValues.hasBreak === "1" || editValues.hasBreak === "true"}
                          disabled={!canEditJobData}
                          onChange={(e) => handleBreakToggle(e.target.checked)}
                          style={{
                            width: "17px",
                            height: "17px",
                            accentColor: "#ea580c",
                            cursor: canEditJobData ? "pointer" : "default"
                          }}
                        />
                        <span>Istirahat (dikurangi 1 jam)</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bagian 3: Lokasi & Uraian Pekerjaan */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "14px",
                padding: "20px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "16px",
                  paddingBottom: "10px",
                  borderBottom: "1px solid #f1f5f9"
                }}
              >
                <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#1e293b", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>📍</span> 3. Lokasi & Uraian Pekerjaan
                </h4>
                <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>
                  Detail Masalah & Tindakan
                </span>
              </div>

              <div className={styles.formGrid}>
                {/* Lokasi Pekerjaan */}
                <div className={`${styles.fieldset} ${styles.wide}`}>
                  <label>
                    <span style={{ fontWeight: 700, color: "#334155" }}>Lokasi Pekerjaan</span>
                    <input
                      type="text"
                      placeholder="Contoh: Pit Pelikan / Repeater Surya / Kantor Telco"
                      value={editValues.location || ""}
                      onChange={(e) => handleFieldChange("location", e.target.value)}
                      readOnly={!canEditJobData}
                    />
                  </label>
                </div>

                {/* Keterangan Pekerjaan */}
                <div className={`${styles.fieldset} ${styles.wide}`}>
                  <label>
                    <span style={{ fontWeight: 700, color: "#334155" }}>Keterangan Pekerjaan / Masalah</span>
                    <textarea
                      rows={3}
                      placeholder="Jelaskan kendala, kerusakan, atau rincian order pekerjaan oncall..."
                      value={editValues.description || ""}
                      onChange={(e) => handleFieldChange("description", e.target.value)}
                      readOnly={!canEditJobData}
                    />
                  </label>
                </div>

                {/* Penyelesaian Pekerjaan */}
                <div className={`${styles.fieldset} ${styles.wide}`}>
                  <label>
                    <span style={{ fontWeight: 700, color: "#166534" }}>Penyelesaian Pekerjaan (Work Done)</span>
                    <textarea
                      rows={3}
                      placeholder="Jelaskan tindakan perbaikan, penggantian part, atau hasil pekerjaan yang telah diselesaikan..."
                      value={editValues.workDone || ""}
                      onChange={(e) => handleFieldChange("workDone", e.target.value)}
                      readOnly={!canEditJobData}
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Bagian 4: Tim Teknisi Pelaksana (Saat Mode Buat Baru) */}
            {isCreating && (
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "14px",
                  padding: "20px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "14px",
                    paddingBottom: "10px",
                    borderBottom: "1px solid #f1f5f9"
                  }}
                >
                  <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#1e293b", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span>👥</span> 4. Tim Teknisi Pelaksana
                  </h4>
                  <span style={{ fontSize: "11px", color: "#0284c7", fontWeight: 700 }}>
                    👑 Anda otomatis terdaftar sebagai PIC
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>
                    Pilih Teknisi Tambahan (Opsional):
                  </label>
                  {selectedInitialTechIds.length > 0 && (
                    <span style={{ fontSize: "11px", fontWeight: 800, color: "#0284c7", background: "#e0f2fe", padding: "2px 8px", borderRadius: "10px" }}>
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
                      const onCuti = !!t.isOnCuti;
                      return (
                        <label
                          key={t.id}
                          title={onCuti ? "Teknisi sedang dalam masa cuti pada tanggal oncall ini" : undefined}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            fontSize: "12px",
                            cursor: onCuti ? "not-allowed" : "pointer",
                            padding: "6px 10px",
                            borderRadius: "7px",
                            background: onCuti ? "#fffbeb" : isChecked ? "#e0f2fe" : "#ffffff",
                            border: `1px solid ${onCuti ? "#fde68a" : isChecked ? "#7dd3fc" : "#e2e8f0"}`,
                            opacity: onCuti ? 0.75 : 1,
                            transition: "all 0.15s ease"
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={onCuti}
                            onChange={(e) => {
                              if (onCuti) return;
                              if (e.target.checked) {
                                setSelectedInitialTechIds([...selectedInitialTechIds, t.id]);
                              } else {
                                setSelectedInitialTechIds(
                                  selectedInitialTechIds.filter((id) => id !== t.id)
                                );
                              }
                            }}
                            style={{ width: "15px", height: "15px", accentColor: "#0284c7" }}
                          />
                          <span style={{ fontWeight: isChecked ? 700 : 500, color: onCuti ? "#92400e" : isChecked ? "#0369a1" : "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {t.name} {t.kpcId && `(${t.kpcId})`} {onCuti && "🌴 Cuti"}
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
                    background: "#0284c7",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 22px",
                    fontSize: "13px",
                    fontWeight: 800,
                    borderRadius: "8px",
                    boxShadow: "0 2px 4px rgba(2, 132, 199, 0.2)"
                  }}
                >
                  <span>💾</span>
                  <span>{isCreating ? "Simpan Draf Job Baru" : "Simpan Perubahan Data"}</span>
                </button>
              )}

              {/* PDF Download Button */}
              {selectedJob && (
                <a
                  href={`${API_URL}/ops-telco/oncall-jobs/${selectedJob.id}/pdf`}
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

        {/* Technician Digital Signature Area */}
        {selectedJob &&
          selectedJob.status === "technician_signing" &&
          isParticipant &&
          !hasUserSignedCurrentVersion && (
            <div style={{ marginTop: "24px" }}>
              <SignaturePad
                onSave={handleTechnicianSign}
                title="Tanda Tangan Pelaksanaan Pekerjaan"
                subtitle={`Sebagai teknisi (${user?.name}), bubuhkan tanda tangan digital untuk memvalidasi pekerjaan ini.`}
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
              {/* Tombol Ajukan ke Supervisor: Dapat langsung diajukan dari status draft, revision_requested, maupun technician_signing */}
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
                    title="Ajukan formulir Job Oncall ini ke Supervisor untuk approval"
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
                      href="/portal/ops-telco/approval-form-oncall"
                      className={styles.primaryButton}
                      style={{
                        background: "#0284c7",
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
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 800 }}>Daftar Job Oncall</h3>
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
