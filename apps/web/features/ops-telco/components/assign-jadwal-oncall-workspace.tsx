"use client";

import React, { useEffect, useState, useTransition } from "react";
import styles from "./assign-jadwal-oncall-workspace.module.css";

interface UserProfile {
  id: number;
  name: string;
  email: string;
  roles: string[];
  permissions: string[];
}

interface ScheduleSummary {
  id: number;
  title: string;
  periodLabel: string;
  periodIndex: number;
  year: number;
  startDate: string;
  endDate: string;
  status: string;
}

interface SlotDetail {
  id: number;
  slotNumber: number;
  startDate: string;
  endDate: string;
  date1: string;
  date2: string;
  date3: string;
  dates?: string[];
  datesJson?: string;
  telcoUserId: number;
  telcoUserName: string;
  ospUserId: number;
  ospUserName: string;
  telcoOnCuti?: boolean;
  telcoCutiReason?: string;
  ospOnCuti?: boolean;
  ospCutiReason?: string;
  isOverride: boolean;
  overrideReason?: string;
  notes?: string;
}

interface CrewMember {
  id: number;
  userId: number;
  crewType: "telco" | "osp";
  sequenceOrder: number;
  displayName?: string | null;
  name: string;
}

export function AssignJadwalOncallWorkspace({ user }: { user: UserProfile }) {
  const [schedules, setSchedules] = useState<ScheduleSummary[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  const [slots, setSlots] = useState<SlotDetail[]>([]);
  const [telcoCrews, setTelcoCrews] = useState<CrewMember[]>([]);
  const [ospCrews, setOspCrews] = useState<CrewMember[]>([]);
  const [availableUsers, setAvailableUsers] = useState<{ id: number; name: string; email: string }[]>([]);

  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // ── 1. Edit Slot Modal State (Fleksibel Tambah / Kurang Hari) ──
  const [editingSlot, setEditingSlot] = useState<SlotDetail | null>(null);
  const [editTelcoId, setEditTelcoId] = useState<number>(0);
  const [editOspId, setEditOspId] = useState<number>(0);
  const [editCascade, setEditCascade] = useState<boolean>(true);
  const [editDates, setEditDates] = useState<string[]>([]);
  const [editReason, setEditReason] = useState("");

  // ── 2. Edit Crew Member Modal State (Ganti Nama Teknisi / Akun) ──
  const [editingCrew, setEditingCrew] = useState<CrewMember | null>(null);
  const [editCrewDisplayName, setEditCrewDisplayName] = useState("");
  const [editCrewUserId, setEditCrewUserId] = useState<number>(0);

  // ── 3. Quick Move Oncall Modal & Drag-and-Drop State ──
  const [quickMoveSlot, setQuickMoveSlot] = useState<SlotDetail | null>(null);
  const [quickMoveCrew, setQuickMoveCrew] = useState<CrewMember | null>(null);
  const [quickMoveCascade, setQuickMoveCascade] = useState<boolean>(true);
  const [draggedInfo, setDraggedInfo] = useState<{ slotId: number; crewType: "telco" | "osp"; fromUserId: number } | null>(null);
  const [dragOverTargetKey, setDragOverTargetKey] = useState<string | null>(null);

  // ── 4. Auto-Generate Modal State ──
  const [showGenModal, setShowGenModal] = useState(false);
  const [genYear, setGenYear] = useState(2026);
  const [genMonth, setGenMonth] = useState(8);
  const [genDay, setGenDay] = useState(16);

  // 1. Fetch all schedules
  const loadSchedules = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api-backend/ops-telco/oncall-schedules");
      if (!res.ok) throw new Error("Gagal memuat jadwal oncall.");
      const json = await res.json();
      const list: ScheduleSummary[] = json.data || [];
      setSchedules(list);

      if (list.length > 0) {
        setSelectedScheduleId((prev) => (prev && list.some((s) => s.id === prev) ? prev : list[0].id));
      }
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Gagal memuat data." });
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch users list for selection
  const loadUsersList = async () => {
    try {
      const res = await fetch("/api-backend/ops-telco/oncall-schedules/users-list");
      if (res.ok) {
        const json = await res.json();
        setAvailableUsers(json.data || []);
      }
    } catch {
      // ignore
    }
  };

  // 3. Load schedule detail
  const loadScheduleDetail = async (id: number) => {
    try {
      const res = await fetch(`/api-backend/ops-telco/oncall-schedules/${id}`);
      if (!res.ok) throw new Error("Gagal memuat rincian jadwal.");
      const json = await res.json();
      setSlots(json.slots || []);
      setTelcoCrews(json.telcoCrews || []);
      setOspCrews(json.ospCrews || []);
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Gagal memuat rincian jadwal." });
    }
  };

  useEffect(() => {
    loadSchedules();
    loadUsersList();
  }, []);

  useEffect(() => {
    if (selectedScheduleId) {
      loadScheduleDetail(selectedScheduleId);
    }
  }, [selectedScheduleId]);

  const activeSchedule = schedules.find((s) => s.id === selectedScheduleId);

  // Helper get slot dates array
  const getSlotDates = (slot: SlotDetail): string[] => {
    if (slot.dates && slot.dates.length > 0) return slot.dates;
    const fallback = [slot.date1, slot.date2, slot.date3].filter(Boolean);
    return fallback.length > 0 ? fallback : [slot.startDate];
  };

  // Open Edit Slot Modal
  const handleOpenEditSlot = (slot: SlotDetail) => {
    setEditingSlot(slot);
    setEditTelcoId(slot.telcoUserId);
    setEditOspId(slot.ospUserId);
    setEditCascade(true);
    setEditDates(getSlotDates(slot));
    setEditReason(slot.overrideReason || "");
  };

  // Add Day to Slot
  const handleAddDateToSlot = () => {
    let nextDateStr = "";
    if (editDates.length > 0) {
      const last = editDates[editDates.length - 1];
      const d = new Date(last);
      if (!isNaN(d.getTime())) {
        d.setDate(d.getDate() + 1);
        nextDateStr = d.toISOString().split("T")[0];
      }
    }
    if (!nextDateStr) {
      nextDateStr = new Date().toISOString().split("T")[0];
    }
    setEditDates([...editDates, nextDateStr]);
  };

  // Remove Day from Slot
  const handleRemoveDateFromSlot = (idx: number) => {
    if (editDates.length <= 1) {
      alert("Setiap slot wajib memiliki minimal 1 hari.");
      return;
    }
    setEditDates(editDates.filter((_, i) => i !== idx));
  };

  // Update specific date in Slot
  const handleUpdateDateInSlot = (idx: number, val: string) => {
    const updated = [...editDates];
    updated[idx] = val;
    setEditDates(updated);
  };

  // Save Slot Changes
  const handleSaveSlot = async () => {
    if (!editingSlot || !selectedScheduleId) return;

    startTransition(async () => {
      try {
        // 1. Update dates (dynamic list)
        const dateRes = await fetch(
          `/api-backend/ops-telco/oncall-schedules/${selectedScheduleId}/slots/${editingSlot.id}/dates`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dates: editDates })
          }
        );
        if (!dateRes.ok) {
          const errJson = await dateRes.json();
          throw new Error(errJson.message || "Gagal menyesuaikan tanggal slot.");
        }

        // 2. Update crew assignment & cascade
        const slotRes = await fetch(
          `/api-backend/ops-telco/oncall-schedules/${selectedScheduleId}/slots/${editingSlot.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              telcoUserId: editTelcoId,
              ospUserId: editOspId,
              cascade: editCascade,
              overrideReason: editReason
            })
          }
        );

        if (!slotRes.ok) {
          const errJson = await slotRes.json();
          throw new Error(errJson.message || "Gagal memperbarui posisi oncall.");
        }

        setStatusMessage({ type: "success", text: "Slot jadwal oncall berhasil diperbarui." });
        setEditingSlot(null);
        await loadScheduleDetail(selectedScheduleId);
      } catch (err: any) {
        setStatusMessage({ type: "error", text: err.message || "Gagal memperbarui slot." });
      }
    });
  };

  // Delete Slot Row
  const handleDeleteSlotRow = async (slotId: number) => {
    if (!selectedScheduleId) return;
    if (!confirm("Hapus baris slot ini dari jadwal? Jumlah hari dalam periode akan berkurang.")) return;

    startTransition(async () => {
      try {
        const res = await fetch(`/api-backend/ops-telco/oncall-schedules/${selectedScheduleId}/slots/${slotId}`, {
          method: "DELETE"
        });
        if (!res.ok) {
          const errJson = await res.json();
          throw new Error(errJson.message || "Gagal menghapus slot.");
        }
        setStatusMessage({ type: "success", text: "Baris slot berhasil dihapus." });
        setEditingSlot(null);
        await loadScheduleDetail(selectedScheduleId);
      } catch (err: any) {
        setStatusMessage({ type: "error", text: err.message || "Gagal menghapus baris slot." });
      }
    });
  };

  // Add New Slot Row (Perpanjang Periode Hari)
  const handleAddSlotRow = async () => {
    if (!selectedScheduleId) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api-backend/ops-telco/oncall-schedules/${selectedScheduleId}/slots`, {
          method: "POST"
        });
        if (!res.ok) {
          const errJson = await res.json();
          throw new Error(errJson.message || "Gagal menambah baris slot baru.");
        }
        setStatusMessage({ type: "success", text: "Baris slot baru berhasil ditambahkan! Periode bertambah." });
        await loadScheduleDetail(selectedScheduleId);
      } catch (err: any) {
        setStatusMessage({ type: "error", text: err.message || "Gagal menambah baris slot." });
      }
    });
  };

  // Open Edit Crew Member Modal
  const handleOpenEditCrew = (crew: CrewMember) => {
    setEditingCrew(crew);
    setEditCrewDisplayName(crew.displayName || crew.name);
    setEditCrewUserId(crew.userId);
  };

  // Save Crew Member (Nama & Akun)
  const handleSaveCrew = async () => {
    if (!editingCrew || !selectedScheduleId) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api-backend/ops-telco/oncall-schedules/crew-members/${editingCrew.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName: editCrewDisplayName.trim(),
            userId: editCrewUserId
          })
        });
        if (!res.ok) {
          const errJson = await res.json();
          throw new Error(errJson.message || "Gagal mengubah data teknisi.");
        }
        setStatusMessage({ type: "success", text: `Data teknisi ${editCrewDisplayName} berhasil diperbarui!` });
        setEditingCrew(null);
        await loadScheduleDetail(selectedScheduleId);
      } catch (err: any) {
        setStatusMessage({ type: "error", text: err.message || "Gagal mengubah teknisi." });
      }
    });
  };

  // Handle Cell Click (Direct Move or Open Modal)
  const handleCellClick = (slot: SlotDetail, crew: CrewMember) => {
    const isCurrentOncall =
      crew.crewType === "telco"
        ? slot.telcoUserId === crew.userId
        : slot.ospUserId === crew.userId;

    if (isCurrentOncall) {
      // Clicked on the oncall cell: open edit modal
      handleOpenEditSlot(slot);
    } else {
      // Clicked on an empty cell: trigger quick move prompt to this technician
      setQuickMoveSlot(slot);
      setQuickMoveCrew(crew);
      setQuickMoveCascade(true);
    }
  };

  // Execute Quick Move Oncall
  const handleExecuteQuickMove = async () => {
    if (!quickMoveSlot || !quickMoveCrew || !selectedScheduleId) return;

    startTransition(async () => {
      try {
        const res = await fetch(
          `/api-backend/ops-telco/oncall-schedules/${selectedScheduleId}/slots/${quickMoveSlot.id}/move-oncall`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              crewType: quickMoveCrew.crewType,
              targetUserId: quickMoveCrew.userId,
              cascade: quickMoveCascade
            })
          }
        );

        if (!res.ok) {
          const errJson = await res.json();
          throw new Error(errJson.message || "Gagal memindahkan posisi oncall.");
        }

        const crewName = quickMoveCrew.displayName || quickMoveCrew.name;
        setStatusMessage({
          type: "success",
          text: `Oncall Slot ${quickMoveSlot.slotNumber} berhasil dipindahkan ke ${crewName}!`
        });
        setQuickMoveSlot(null);
        setQuickMoveCrew(null);
        await loadScheduleDetail(selectedScheduleId);
      } catch (err: any) {
        setStatusMessage({ type: "error", text: err.message || "Gagal memindahkan oncall." });
      }
    });
  };

  // Handle Auto Generate 1 Year
  const handleGenerateYear = async () => {
    startTransition(async () => {
      try {
        const res = await fetch("/api-backend/ops-telco/oncall-schedules/generate-year", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startYear: genYear,
            startMonth: genMonth,
            startDay: genDay
          })
        });

        if (!res.ok) {
          const errJson = await res.json();
          throw new Error(errJson.message || "Gagal auto-generate jadwal 1 tahun.");
        }

        setStatusMessage({ type: "success", text: "Jadwal oncall 1 tahun berhasil dibuat otomatis!" });
        setShowGenModal(false);
        await loadSchedules();
      } catch (err: any) {
        setStatusMessage({ type: "error", text: err.message || "Gagal membuat jadwal." });
      }
    });
  };

  // Handle PDF Download
  const handleDownloadPdf = async () => {
    if (!selectedScheduleId) return;
    try {
      const res = await fetch(`/api-backend/ops-telco/oncall-schedules/${selectedScheduleId}/pdf`);
      if (!res.ok) throw new Error("Gagal mengunduh dokumen PDF.");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `jadwal oncall - ${activeSchedule?.periodLabel || "resmi"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Gagal mengunduh PDF." });
    }
  };

  // Format Display Date (e.g. 16-Agu-26)
  const formatDisplay = (isoStr: string) => {
    if (!isoStr) return "";
    const parts = isoStr.split("-");
    if (parts.length !== 3) return isoStr;
    const yearShort = parts[0].slice(2);
    const mIdx = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const mNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    return `${day}-${mNames[mIdx] || parts[1]}-${yearShort}`;
  };

  return (
    <div className={styles.container}>
      {/* ── Top Toolbar ── */}
      <div className={styles.topToolbar}>
        <div className={styles.toolbarTitleGroup}>
          <h2 className={styles.toolbarTitle}>
            <span>🗓️</span> Assign Jadwal Oncall
          </h2>
          <p className={styles.toolbarSubtitle}>
            Pengelolaan giliran oncall OSP & Telco Crew. Klik / geser sel kuning untuk memindahkan posisi, tambah hari periode, dan ganti nama teknisi.
          </p>
        </div>

        <div className={styles.toolbarActions}>
          {schedules.length > 0 && (
            <div className={styles.periodSelector}>
              <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 700 }}>Periode:</span>
              <select
                className={styles.periodSelect}
                value={selectedScheduleId ?? ""}
                onChange={(e) => setSelectedScheduleId(Number(e.target.value))}
              >
                {schedules.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.periodLabel}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => setShowGenModal(true)}
            disabled={isPending}
          >
            <span>⚡</span> Auto Generate 1 Tahun
          </button>

          <button
            type="button"
            className={styles.btnPrimary}
            onClick={handleDownloadPdf}
            disabled={!selectedScheduleId || isPending}
          >
            <span>📄</span> Cetak / Download PDF
          </button>
        </div>
      </div>

      {/* ── Alerts ── */}
      {statusMessage && (
        <div
          className={statusMessage.type === "success" ? styles.alertSuccess : styles.alertError}
          role="alert"
        >
          {statusMessage.text}
        </div>
      )}

      {/* ── Schedule Card / Table ── */}
      {loading ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyStateTitle}>Memuat jadwal oncall...</p>
        </div>
      ) : schedules.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyStateTitle}>Belum ada jadwal oncall yang dibuat.</p>
          <p>Klik tombol di bawah untuk membuat rotasi otomatis 1 tahun penuh.</p>
          <button
            type="button"
            className={styles.btnPrimary}
            style={{ marginTop: "12px" }}
            onClick={() => setShowGenModal(true)}
          >
            <span>⚡</span> Generate Jadwal 1 Tahun Sekarang
          </button>
        </div>
      ) : (
        <div className={styles.scheduleCard}>
          {/* Header Banner */}
          <div className={styles.scheduleHeaderInfo}>
            <div className={styles.scheduleHeaderMain}>
              <img
                src="/assets/Logo MKN.png"
                alt="Logo MKN"
                className={styles.scheduleLogo}
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
              <div className={styles.scheduleTitleGroup}>
                <h3>Jadwal On Call OSP & Telco Crew</h3>
                <p>PT Mandiri Karya Nusantara — Operasional Telekomunikasi</p>
              </div>
            </div>

            <div className={styles.schedulePeriodBadge}>
              <span>📅</span> Periode : {activeSchedule?.periodLabel}
            </div>
          </div>

          {/* Table */}
          <div className={styles.tableResponsive}>
            <table className={styles.oncallTable}>
              <thead>
                <tr>
                  <th rowSpan={2} className={`${styles.thHeaderGroup} ${styles.thColNo}`}>
                    No
                  </th>
                  <th rowSpan={2} className={`${styles.thHeaderGroup} ${styles.thColPeriode}`}>
                    Periode
                  </th>
                  <th colSpan={5} className={styles.thHeaderGroup}>
                    Crew Telco
                  </th>
                  <th colSpan={4} className={styles.thHeaderGroup}>
                    Crew OSP
                  </th>
                </tr>
                <tr>
                  {/* Telco Sub-headers with rename button */}
                  {telcoCrews.slice(0, 5).map((crew) => (
                    <th key={`telco-th-${crew.id}`} className={styles.thSubHeader}>
                      <div className={styles.thContent}>
                        <span>{crew.displayName || crew.name}</span>
                        <button
                          type="button"
                          className={styles.thEditBtn}
                          title="Ganti nama atau akun teknisi"
                          onClick={() => handleOpenEditCrew(crew)}
                        >
                          ✎
                        </button>
                      </div>
                    </th>
                  ))}
                  {/* OSP Sub-headers with rename button */}
                  {ospCrews.slice(0, 4).map((crew) => (
                    <th key={`osp-th-${crew.id}`} className={styles.thSubHeader}>
                      <div className={styles.thContent}>
                        <span>{crew.displayName || crew.name}</span>
                        <button
                          type="button"
                          className={styles.thEditBtn}
                          title="Ganti nama atau akun teknisi"
                          onClick={() => handleOpenEditCrew(crew)}
                        >
                          ✎
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slots.map((slot) => {
                  const slotDates = getSlotDates(slot);

                  return (
                    <tr key={`slot-row-${slot.id}`} className={styles.tableRow}>
                      {/* Slot No with Edit Dates button */}
                      <td className={styles.tdNo}>
                        <div>{slot.slotNumber}</div>
                        <button
                          type="button"
                          className={styles.slotActionBtn}
                          title="Edit tanggal atau slot"
                          onClick={() => handleOpenEditSlot(slot)}
                        >
                          ✎ Edit
                        </button>
                      </td>

                      {/* Flexible Dates List */}
                      <td
                        className={styles.tdPeriode}
                        onClick={() => handleOpenEditSlot(slot)}
                        title="Klik untuk mengubah atau menambah hari pada slot ini"
                        style={{ cursor: "pointer" }}
                      >
                        {slotDates.map((d, i) => (
                          <span key={`date-${slot.id}-${i}`} className={styles.dateRow}>
                            {formatDisplay(d)}
                          </span>
                        ))}
                      </td>

                      {/* Telco columns */}
                      {telcoCrews.slice(0, 5).map((crew) => {
                        const isOncall = crew.userId === slot.telcoUserId;
                        const cellKey = `${slot.id}-${crew.userId}`;
                        const isDragOver = dragOverTargetKey === cellKey;

                        return (
                          <td
                            key={`slot-${slot.id}-telco-${crew.userId}`}
                            className={`${isOncall ? styles.cellOncall : styles.cellRegular} ${
                              isDragOver ? styles.cellDragOver : ""
                            }`}
                            onClick={() => handleCellClick(slot, crew)}
                            draggable={isOncall}
                            onDragStart={(e) => {
                              if (!isOncall) return;
                              e.dataTransfer.setData(
                                "application/json",
                                JSON.stringify({ slotId: slot.id, crewType: "telco", fromUserId: crew.userId })
                              );
                              setDraggedInfo({ slotId: slot.id, crewType: "telco", fromUserId: crew.userId });
                            }}
                            onDragEnd={() => {
                              setDraggedInfo(null);
                              setDragOverTargetKey(null);
                            }}
                            onDragOver={(e) => {
                              if (draggedInfo && draggedInfo.slotId === slot.id && draggedInfo.crewType === "telco") {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = "move";
                                if (dragOverTargetKey !== cellKey) setDragOverTargetKey(cellKey);
                              }
                            }}
                            onDragLeave={() => {
                              if (dragOverTargetKey === cellKey) setDragOverTargetKey(null);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              setDragOverTargetKey(null);
                              if (
                                draggedInfo &&
                                draggedInfo.slotId === slot.id &&
                                draggedInfo.crewType === "telco" &&
                                draggedInfo.fromUserId !== crew.userId
                              ) {
                                setQuickMoveSlot(slot);
                                setQuickMoveCrew(crew);
                                setQuickMoveCascade(true);
                              }
                            }}
                            title={
                              isOncall
                                ? "Sedang ONCALL. Klik untuk edit rincian atau GESER (drag) ke kolom teknisi lain"
                                : `Klik atau drop di sini untuk memindahkan ONCALL ke ${crew.displayName || crew.name}`
                            }
                          >
                            {isOncall ? (
                              <div className={styles.cellActionOverlay}>
                                <span className={styles.dragHandleIcon}>⠿</span>
                                <span>ONCALL</span>
                              </div>
                            ) : (
                              <span className={styles.cellHoverHint}>Pindah ke sini</span>
                            )}
                            {isOncall && slot.telcoOnCuti && (
                              <div className={styles.cutiWarningPill} title={slot.telcoCutiReason}>
                                ⚠️ Cuti
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {/* OSP columns */}
                      {ospCrews.slice(0, 4).map((crew) => {
                        const isOncall = crew.userId === slot.ospUserId;
                        const cellKey = `${slot.id}-${crew.userId}`;
                        const isDragOver = dragOverTargetKey === cellKey;

                        return (
                          <td
                            key={`slot-${slot.id}-osp-${crew.userId}`}
                            className={`${isOncall ? styles.cellOncall : styles.cellRegular} ${
                              isDragOver ? styles.cellDragOver : ""
                            }`}
                            onClick={() => handleCellClick(slot, crew)}
                            draggable={isOncall}
                            onDragStart={(e) => {
                              if (!isOncall) return;
                              e.dataTransfer.setData(
                                "application/json",
                                JSON.stringify({ slotId: slot.id, crewType: "osp", fromUserId: crew.userId })
                              );
                              setDraggedInfo({ slotId: slot.id, crewType: "osp", fromUserId: crew.userId });
                            }}
                            onDragEnd={() => {
                              setDraggedInfo(null);
                              setDragOverTargetKey(null);
                            }}
                            onDragOver={(e) => {
                              if (draggedInfo && draggedInfo.slotId === slot.id && draggedInfo.crewType === "osp") {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = "move";
                                if (dragOverTargetKey !== cellKey) setDragOverTargetKey(cellKey);
                              }
                            }}
                            onDragLeave={() => {
                              if (dragOverTargetKey === cellKey) setDragOverTargetKey(null);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              setDragOverTargetKey(null);
                              if (
                                draggedInfo &&
                                draggedInfo.slotId === slot.id &&
                                draggedInfo.crewType === "osp" &&
                                draggedInfo.fromUserId !== crew.userId
                              ) {
                                setQuickMoveSlot(slot);
                                setQuickMoveCrew(crew);
                                setQuickMoveCascade(true);
                              }
                            }}
                            title={
                              isOncall
                                ? "Sedang ONCALL. Klik untuk edit rincian atau GESER (drag) ke kolom teknisi lain"
                                : `Klik atau drop di sini untuk memindahkan ONCALL ke ${crew.displayName || crew.name}`
                            }
                          >
                            {isOncall ? (
                              <div className={styles.cellActionOverlay}>
                                <span className={styles.dragHandleIcon}>⠿</span>
                                <span>ONCALL</span>
                              </div>
                            ) : (
                              <span className={styles.cellHoverHint}>Pindah ke sini</span>
                            )}
                            {isOncall && slot.ospOnCuti && (
                              <div className={styles.cutiWarningPill} title={slot.ospCutiReason}>
                                ⚠️ Cuti
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Bottom Action Bar */}
          <div className={styles.tableBottomActions}>
            <button
              type="button"
              className={styles.btnAddSlot}
              onClick={handleAddSlotRow}
              disabled={isPending}
              title="Tambahkan baris slot baru di akhir periode ini jika jumlah hari bertambah"
            >
              <span>➕</span> Tambah Baris Slot (Perpanjang Hari Periode)
            </button>

            <span className={styles.tableHelpText}>
              💡 Tip: Klik sel kosong atau seret (drag & drop) kotak kuning ONCALL untuk memindahkan tugas giliran seketika.
            </span>
          </div>

          {/* Notes Section */}
          <div className={styles.notesSection}>
            <p className={styles.notesTitle}>
              <span>📌</span> Note:
            </p>
            <ul className={styles.notesList}>
              <li># Dilarang merubah jadwal Oncall tanpa sepengetahuan atasan</li>
              <li># Tidak keluar kota saat giliran Oncall kecuali emergency dan melapor ke atasan</li>
              <li># Tidak mematikan Handphone pada saat giliran Oncall</li>
            </ul>
          </div>

          {/* Officials Signatures */}
          <div className={styles.officialsGrid}>
            <div className={styles.officialCol}>
              <span className={styles.officialRole}>Telco</span>
              <div className={styles.signatureSpacer} />
              <span className={styles.officialName}>Rahmansyah</span>
              <span className={styles.officialPhone}>( 0852 4691 9549 )</span>
            </div>

            <div className={styles.officialCol}>
              <span className={styles.officialRole}>OSP</span>
              <div className={styles.signatureSpacer} />
              <span className={styles.officialName}>Bronson H.</span>
              <span className={styles.officialPhone}>(081254700404)</span>
            </div>

            <div className={styles.officialCol}>
              <span className={styles.officialRole}>Mengetahui</span>
              <div className={styles.signatureSpacer} />
              <span className={styles.officialName}>( Wanto )</span>
              <span className={styles.officialPhone}>Superintendent</span>
            </div>
          </div>
        </div>
      )}

      {/* ── 1. Edit Slot Modal (Fleksibel Tambah Hari / Ubah Petugas) ── */}
      {editingSlot && (
        <div className={styles.modalOverlay} onClick={() => setEditingSlot(null)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h4>✏️ Edit Posisi Oncall & Tanggal (Slot {editingSlot.slotNumber})</h4>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setEditingSlot(null)}
              >
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              {/* Tanggal Slot (Daftar Hari Fleksibel) */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  Tanggal Bertugas Pada Slot Ini ({editDates.length} Hari):
                </label>
                <div className={styles.datesList}>
                  {editDates.map((dateStr, idx) => (
                    <div key={`edit-date-${idx}`} className={styles.dateRowItem}>
                      <span className={styles.dateIndexLabel}>Hari {idx + 1}:</span>
                      <input
                        type="date"
                        className={`${styles.formInput} ${styles.dateInputFlex}`}
                        value={dateStr}
                        onChange={(e) => handleUpdateDateInSlot(idx, e.target.value)}
                      />
                      <button
                        type="button"
                        className={styles.btnRemoveDate}
                        onClick={() => handleRemoveDateFromSlot(idx)}
                        title="Hapus hari ini dari slot"
                      >
                        ✕ Hapus
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    className={styles.btnAddDate}
                    onClick={handleAddDateToSlot}
                  >
                    <span>➕</span> Tambah Hari ke Slot Ini
                  </button>
                </div>
              </div>

              {/* Pilih Teknisi Telco */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Petugas Oncall Crew Telco:</label>
                <select
                  className={styles.formSelect}
                  value={editTelcoId}
                  onChange={(e) => setEditTelcoId(Number(e.target.value))}
                >
                  {availableUsers.map((u) => (
                    <option key={`opt-telco-${u.id}`} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Pilih Teknisi OSP */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Petugas Oncall Crew OSP:</label>
                <select
                  className={styles.formSelect}
                  value={editOspId}
                  onChange={(e) => setEditOspId(Number(e.target.value))}
                >
                  {availableUsers.map((u) => (
                    <option key={`opt-osp-${u.id}`} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Alasan / Catatan */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Alasan / Keterangan Penyesuaian:</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="Misal: Tukar shift atau penyesuaian darurat"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                />
              </div>

              {/* Cascade Checkbox */}
              <label className={styles.checkboxContainer}>
                <input
                  type="checkbox"
                  className={styles.checkboxInput}
                  checked={editCascade}
                  onChange={(e) => setEditCascade(e.target.checked)}
                />
                <div className={styles.checkboxLabelGroup}>
                  <span className={styles.checkboxTitle}>
                    Terapkan ke jadwal berikutnya secara berurutan (Cascade Rotation)
                  </span>
                  <span className={styles.checkboxDesc}>
                    Rotasi slot-slot setelahnya akan otomatis melanjutkan giliran dari teknisi yang baru dipilih, menjaga keadilan antrean giliran.
                  </span>
                </div>
              </label>
            </div>

            <div className={styles.modalFooter}>
              {slots.length > 1 && (
                <button
                  type="button"
                  className={styles.btnDanger}
                  onClick={() => handleDeleteSlotRow(editingSlot.id)}
                  disabled={isPending}
                  style={{ marginRight: "auto" }}
                >
                  🗑️ Hapus Slot Ini
                </button>
              )}

              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setEditingSlot(null)}
                disabled={isPending}
              >
                Batal
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={handleSaveSlot}
                disabled={isPending}
              >
                {isPending ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. Quick Move Oncall Modal (Klik / Seret Sel Kuning) ── */}
      {quickMoveSlot && quickMoveCrew && (
        <div
          className={styles.modalOverlay}
          onClick={() => {
            setQuickMoveSlot(null);
            setQuickMoveCrew(null);
          }}
        >
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h4>🔀 Pindahkan Giliran Oncall</h4>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => {
                  setQuickMoveSlot(null);
                  setQuickMoveCrew(null);
                }}
              >
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              <p style={{ margin: 0, fontSize: "13.5px", color: "#475569" }}>
                Anda akan memindahkan giliran bertugas <strong>Slot #{quickMoveSlot.slotNumber}</strong> (
                {getSlotDates(quickMoveSlot).map(formatDisplay).join(", ")}) untuk kru{" "}
                <strong>{quickMoveCrew.crewType.toUpperCase()}</strong>:
              </p>

              <div className={styles.quickMoveCompare}>
                <div className={styles.compareCard}>
                  <span className={styles.compareLabel}>Petugas Sebelumnya</span>
                  <span className={styles.compareName}>
                    {quickMoveCrew.crewType === "telco"
                      ? quickMoveSlot.telcoUserName
                      : quickMoveSlot.ospUserName}
                  </span>
                </div>

                <span className={styles.compareArrow}>➜</span>

                <div className={styles.compareCardActive}>
                  <span className={styles.compareLabel}>Dipindahkan Ke</span>
                  <span className={styles.compareName}>
                    {quickMoveCrew.displayName || quickMoveCrew.name}
                  </span>
                </div>
              </div>

              {/* Cascade Checkbox */}
              <label className={styles.checkboxContainer}>
                <input
                  type="checkbox"
                  className={styles.checkboxInput}
                  checked={quickMoveCascade}
                  onChange={(e) => setQuickMoveCascade(e.target.checked)}
                />
                <div className={styles.checkboxLabelGroup}>
                  <span className={styles.checkboxTitle}>
                    Terapkan ke jadwal berikutnya secara berurutan (Cascade Rotation)
                  </span>
                  <span className={styles.checkboxDesc}>
                    Rotasi giliran pada slot-slot sesudahnya akan langsung melanjutkan dari urutan giliran teknisi baru ini.
                  </span>
                </div>
              </label>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => {
                  setQuickMoveSlot(null);
                  setQuickMoveCrew(null);
                }}
                disabled={isPending}
              >
                Batal
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={handleExecuteQuickMove}
                disabled={isPending}
              >
                {isPending ? "Memindahkan..." : "Pindahkan Oncall Sekarang"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. Edit Crew Member Modal (Ganti Nama Teknisi / Akun) ── */}
      {editingCrew && (
        <div className={styles.modalOverlay} onClick={() => setEditingCrew(null)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h4>👤 Ganti Nama / Akun Teknisi ({editingCrew.crewType.toUpperCase()})</h4>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setEditingCrew(null)}
              >
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Nama Tampilan di Kolom Tabel & PDF:</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={editCrewDisplayName}
                  onChange={(e) => setEditCrewDisplayName(e.target.value)}
                  placeholder="Contoh: Kala, Asrianto, Jacky"
                  required
                />
                <span style={{ fontSize: "11.5px", color: "#64748b" }}>
                  Nama ini akan langsung tampil di kolom tabel jadwal dan cetakan PDF resmi.
                </span>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Tautkan ke Akun Pengguna Sistem:</label>
                <select
                  className={styles.formSelect}
                  value={editCrewUserId}
                  onChange={(e) => setEditCrewUserId(Number(e.target.value))}
                >
                  {availableUsers.map((u) => (
                    <option key={`crew-opt-${u.id}`} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: "11.5px", color: "#64748b" }}>
                  Teknisi pemilik akun ini akan melihat notifikasi gilirannya di menu Teknisi: View Jadwal Oncall.
                </span>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setEditingCrew(null)}
                disabled={isPending}
              >
                Batal
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={handleSaveCrew}
                disabled={isPending || !editCrewDisplayName.trim()}
              >
                {isPending ? "Menyimpan..." : "Simpan Perubahan Nama"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 4. Auto Generate 1-Year Modal ── */}
      {showGenModal && (
        <div className={styles.modalOverlay} onClick={() => setShowGenModal(false)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h4>⚡ Auto-Generate Jadwal Oncall 1 Tahun</h4>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setShowGenModal(false)}
              >
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              <p style={{ fontSize: "13.5px", color: "#475569", lineHeight: 1.5, margin: 0 }}>
                Sistem akan menyusun 12 periode jadwal bulanan (masing-masing 10 slot x 3 hari = 30 hari)
                secara otomatis dengan perputaran siklus 5 teknisi Telco & 4 teknisi OSP, serta
                memeriksa dan melompati teknisi yang sedang cuti resmi.
              </p>

              <div className={styles.datesRowGroup}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Tahun Mulai:</label>
                  <input
                    type="number"
                    className={styles.formInput}
                    value={genYear}
                    onChange={(e) => setGenYear(Number(e.target.value))}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Bulan Mulai (1-12):</label>
                  <input
                    type="number"
                    className={styles.formInput}
                    min={1}
                    max={12}
                    value={genMonth}
                    onChange={(e) => setGenMonth(Number(e.target.value))}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Hari Mulai (1-31):</label>
                  <input
                    type="number"
                    className={styles.formInput}
                    min={1}
                    max={31}
                    value={genDay}
                    onChange={(e) => setGenDay(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setShowGenModal(false)}
                disabled={isPending}
              >
                Batal
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={handleGenerateYear}
                disabled={isPending}
              >
                {isPending ? "Menyusun Jadwal..." : "Mulai Generate 1 Tahun"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
