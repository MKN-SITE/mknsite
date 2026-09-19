"use client";

import { useEffect, useState, useMemo } from "react";
import { API_URL, api, type PortalUser } from "@/lib/api";
import styles from "./telco-form-workspace.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CutiStatus = "draft" | "submitted" | "cancelled";

export interface CutiReportItem {
  id: number;
  formNumber: string;
  status: CutiStatus;
  data: Record<string, string>;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  creatorName: string | null;
  creatorKpcId: string | null;
  creatorDivision: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LEAVE_TYPE_LABELS: Record<string, string> = {
  tahunan:    "🌴 Cuti Tahunan",
  sakit:      "🏥 Cuti Sakit",
  melahirkan: "👶 Cuti Melahirkan",
  penting:    "⚠️ Keperluan Penting",
  lainnya:    "📋 Lainnya"
};

const LEAVE_TYPE_COLORS: Record<string, string> = {
  tahunan:    "#059669",
  sakit:      "#d97706",
  melahirkan: "#7c3aed",
  penting:    "#dc2626",
  lainnya:    "#475569"
};

const LEAVE_TYPE_ICONS: Record<string, string> = {
  tahunan:    "🌴",
  sakit:      "🏥",
  melahirkan: "👶",
  penting:    "⚠️",
  lainnya:    "📋"
};

const WEEKDAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateIndo(dateStr: string | undefined): string {
  if (!dateStr) return "-";
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  } catch {
    return dateStr;
  }
}

function formatDateShort(iso: string | undefined): string {
  if (!iso) return "-";
  try {
    const parts = iso.split("T")[0].split("-");
    if (parts.length === 3) {
      const [y, m, d] = parts.map(Number);
      return new Date(y, m - 1, d).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      });
    }
    return new Date(iso).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  } catch {
    return iso;
  }
}

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isCutiActiveToday(item: CutiReportItem): boolean {
  const today = toDateString(new Date());
  const s = item.data.leaveStartDate;
  const e = item.data.leaveEndDate;
  return !!s && !!e && today >= s && today <= e;
}

function isCutiUpcoming(item: CutiReportItem): boolean {
  const today = toDateString(new Date());
  return !!item.data.leaveStartDate && item.data.leaveStartDate > today;
}

function isCutiPast(item: CutiReportItem): boolean {
  const today = toDateString(new Date());
  return !!item.data.leaveEndDate && item.data.leaveEndDate < today;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CutiReportSupervisor({ user: _user }: { user: PortalUser }) {
  const [items, setItems]               = useState<CutiReportItem[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [viewMode, setViewMode]         = useState<"calendar" | "list">("calendar");
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(() => toDateString(new Date()));
  const [flash, setFlash]               = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  async function fetchData() {
    setLoading(true);
    try {
      // Backend guarantees status: submitted, but we also filter strictly
      const res = await api<{ items: CutiReportItem[] }>("/ops-telco/cuti-jobs/report/all");
      setItems((res.items ?? []).filter((i) => i.status === "submitted"));
    } catch (err: any) {
      showFlash("err", err?.message ?? "Gagal memuat data report cuti.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  function showFlash(type: "ok" | "err", msg: string) {
    setFlash({ type, msg });
    setTimeout(() => setFlash(null), 4500);
  }

  // Strictly submitted forms only (no drafts in supervisor report)
  const submittedItems = useMemo(() => {
    return items.filter((i) => i.status === "submitted");
  }, [items]);

  // ─── Calendar Grid Generation ────────────────────────────────────────────────
  const calendarCells = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    // Senin = 0, ..., Minggu = 6
    const dayOfWeek = (firstDay.getDay() + 6) % 7;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    // Trailing days from previous month
    for (let i = dayOfWeek - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, d);
      cells.push({
        dateStr: toDateString(prevDate),
        dayNum: d,
        isCurrentMonth: false
      });
    }

    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      const currDate = new Date(year, month, d);
      cells.push({
        dateStr: toDateString(currDate),
        dayNum: d,
        isCurrentMonth: true
      });
    }

    // Leading days from next month to complete standard 35 or 42 grid
    const totalCells = cells.length <= 35 ? 35 : 42;
    const remaining = totalCells - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(year, month + 1, d);
      cells.push({
        dateStr: toDateString(nextDate),
        dayNum: d,
        isCurrentMonth: false
      });
    }

    return cells;
  }, [currentMonth]);

  // Helper: Get active cuti on any given date
  function getCutiOnDate(dateStr: string) {
    return submittedItems.filter((item) => {
      const s = item.data.leaveStartDate;
      const e = item.data.leaveEndDate;
      if (!s || !e) return false;
      const matchRange = dateStr >= s && dateStr <= e;
      if (!matchRange) return false;

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (item.creatorName ?? "").toLowerCase().includes(q) ||
        (item.creatorKpcId ?? "").toLowerCase().includes(q) ||
        (item.data.reason ?? "").toLowerCase().includes(q)
      );
    });
  }

  // Navigation handlers
  function handlePrevMonth() {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }

  function handleNextMonth() {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }

  function handleToday() {
    const today = new Date();
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(toDateString(today));
  }

  // ─── Stats ───────────────────────────────────────────────────────────────────
  const activeNow = useMemo(() => submittedItems.filter(isCutiActiveToday).length, [submittedItems]);
  const upcomingN = useMemo(() => submittedItems.filter(isCutiUpcoming).length, [submittedItems]);

  const monthRangeStr = useMemo(() => {
    const y = currentMonth.getFullYear();
    const m = String(currentMonth.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }, [currentMonth]);

  const monthLeavesCount = useMemo(() => {
    return submittedItems.filter((item) => {
      const s = item.data.leaveStartDate;
      const e = item.data.leaveEndDate;
      if (!s || !e) return false;
      const sMonth = s.slice(0, 7);
      const eMonth = e.slice(0, 7);
      return monthRangeStr >= sMonth && monthRangeStr <= eMonth;
    }).length;
  }, [submittedItems, monthRangeStr]);

  // Items for selected date
  const selectedDateLeaves = useMemo(() => {
    return getCutiOnDate(selectedDate);
  }, [selectedDate, submittedItems, search]);

  // Filtered items for list view
  const listFiltered = useMemo(() => {
    if (!search.trim()) return submittedItems;
    const q = search.toLowerCase();
    return submittedItems.filter((item) => {
      return (
        (item.creatorName ?? "").toLowerCase().includes(q) ||
        (item.creatorKpcId ?? "").toLowerCase().includes(q) ||
        item.formNumber.toLowerCase().includes(q) ||
        (item.data.leaveType ?? "").toLowerCase().includes(q) ||
        (item.data.reason ?? "").toLowerCase().includes(q)
      );
    });
  }, [submittedItems, search]);

  const todayStr = toDateString(new Date());

  const currentMonthTitle = useMemo(() => {
    return currentMonth.toLocaleDateString("id-ID", {
      month: "long",
      year: "numeric"
    });
  }, [currentMonth]);

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className={styles.reportLayout}>
      {/* Flash Banner */}
      {flash && (
        <div
          className={`${styles.flashBanner} ${flash.type === "ok" ? styles.flashOk : styles.flashErr}`}
          style={{ marginBottom: 16 }}
        >
          {flash.type === "ok" ? "✓" : "⚠"} {flash.msg}
        </div>
      )}

      {/* Header */}
      <div className={styles.reportHeader}>
        <div>
          <div className={styles.formEyebrow}>OPS Telco — Supervisor</div>
          <h2 className={styles.formTitle}>Report Cuti Teknisi (Kalender)</h2>
          <p className={styles.formSubtitle}>
            Pantau jadwal cuti seluruh teknisi secara langsung di kalender bulanan. Draf teknisi tidak dimasukkan.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className={styles.viewToggleGroup}>
            <button
              type="button"
              className={`${styles.viewToggleBtn} ${viewMode === "calendar" ? styles.viewToggleBtnActive : ""}`}
              onClick={() => setViewMode("calendar")}
            >
              📅 Kalender Cuti
            </button>
            <button
              type="button"
              className={`${styles.viewToggleBtn} ${viewMode === "list" ? styles.viewToggleBtnActive : ""}`}
              onClick={() => setViewMode("list")}
            >
              📋 Daftar Formulir
            </button>
          </div>
          <button className={styles.refreshBtn} onClick={fetchData} title="Muat ulang data">
            ⟳ Muat Ulang
          </button>
        </div>
      </div>

      {/* ── Stats Bar (Strictly submitted data) ── */}
      <div className={styles.statsBar}>
        <div className={styles.statCard} style={{ borderColor: "#ef4444", background: "rgba(239, 68, 68, 0.05)" }}>
          <span className={styles.statIcon}>🔴</span>
          <span className={styles.statValue} style={{ color: "#ef4444" }}>{activeNow}</span>
          <span className={styles.statLabel}>Sedang Cuti Hari Ini</span>
        </div>
        <div className={styles.statCard} style={{ borderColor: "#0284c7", background: "rgba(2, 132, 199, 0.05)" }}>
          <span className={styles.statIcon}>📅</span>
          <span className={styles.statValue} style={{ color: "#0284c7" }}>{monthLeavesCount}</span>
          <span className={styles.statLabel}>Cuti Bulan Ini</span>
        </div>
        <div className={styles.statCard} style={{ borderColor: "#f59e0b", background: "rgba(245, 158, 11, 0.05)" }}>
          <span className={styles.statIcon}>🟡</span>
          <span className={styles.statValue} style={{ color: "#f59e0b" }}>{upcomingN}</span>
          <span className={styles.statLabel}>Cuti Mendatang</span>
        </div>
        <div className={styles.statCard} style={{ borderColor: "#10b981", background: "rgba(16, 185, 129, 0.05)" }}>
          <span className={styles.statIcon}>✅</span>
          <span className={styles.statValue} style={{ color: "#10b981" }}>{submittedItems.length}</span>
          <span className={styles.statLabel}>Total Formulir Cuti</span>
        </div>
      </div>

      {/* ── Search Bar ── */}
      <div className={styles.filterRow}>
        <input
          className={styles.searchInput}
          type="search"
          placeholder="🔍 Cari nama teknisi, ID KPC, alasan cuti..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className={styles.filterHint}>
          {search ? `Menyaring berdasarkan: "${search}"` : `${submittedItems.length} formulir cuti tersimpan`}
        </span>
      </div>

      {/* ── Loading State ── */}
      {loading ? (
        <div className={styles.loadingState}>⏳ Memuat kalender report cuti teknisi…</div>
      ) : viewMode === "calendar" ? (
        /* ════════════════════════════════════════════════════════════════════════
           CALENDAR VIEW
           ════════════════════════════════════════════════════════════════════════ */
        <div className={styles.calendarWrapper}>
          <div className={styles.calendarCard}>
            {/* Calendar Toolbar: Month Nav & Legend */}
            <div className={styles.calendarToolbar}>
              <div className={styles.calendarMonthNav}>
                <button
                  type="button"
                  className={styles.calendarNavBtn}
                  onClick={handlePrevMonth}
                  title="Bulan sebelumnya"
                >
                  ◀
                </button>
                <h3 className={styles.calendarMonthTitle}>{currentMonthTitle}</h3>
                <button
                  type="button"
                  className={styles.calendarNavBtn}
                  onClick={handleNextMonth}
                  title="Bulan berikutnya"
                >
                  ▶
                </button>
                <button
                  type="button"
                  className={styles.calendarTodayBtn}
                  onClick={handleToday}
                  title="Ke hari ini"
                >
                  Hari Ini
                </button>
              </div>

              {/* Legend */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 11 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#059669" }} />
                  Tahunan
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#d97706" }} />
                  Sakit
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#7c3aed" }} />
                  Melahirkan
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#dc2626" }} />
                  Penting
                </span>
              </div>
            </div>

            {/* Calendar Table Grid */}
            <table className={styles.calendarTable}>
              <thead>
                <tr className={styles.calendarWeekdayRow}>
                  {WEEKDAYS.map((wd) => (
                    <th key={wd} className={styles.calendarWeekdayCell}>
                      {wd}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: calendarCells.length / 7 }).map((_, rowIndex) => {
                  const rowCells = calendarCells.slice(rowIndex * 7, (rowIndex + 1) * 7);
                  return (
                    <tr key={rowIndex}>
                      {rowCells.map((cell) => {
                        const cellLeaves = getCutiOnDate(cell.dateStr);
                        const isToday = cell.dateStr === todayStr;
                        const isSelected = cell.dateStr === selectedDate;
                        const hasLeaves = cellLeaves.length > 0;

                        return (
                          <td
                            key={cell.dateStr}
                            className={`
                              ${styles.calendarDayCell}
                              ${!cell.isCurrentMonth ? styles.calendarDayOtherMonth : ""}
                              ${isToday ? styles.calendarDayToday : ""}
                              ${isSelected ? styles.calendarDaySelected : ""}
                              ${hasLeaves ? styles.calendarDayHasLeave : ""}
                            `}
                            onClick={() => setSelectedDate(cell.dateStr)}
                          >
                            <div className={styles.calendarDayTop}>
                              <span
                                className={`
                                  ${styles.calendarDayNum}
                                  ${isToday ? styles.calendarDayNumToday : ""}
                                `}
                              >
                                {cell.dayNum}
                              </span>
                              {hasLeaves && (
                                <span className={styles.calendarLeavePill}>
                                  {cellLeaves.length} Cuti
                                </span>
                              )}
                            </div>

                            {/* Chips showing technician names directly on calendar */}
                            <div className={styles.calendarChipsContainer}>
                              {cellLeaves.slice(0, 3).map((item) => {
                                const lType = item.data.leaveType ?? "lainnya";
                                const color = LEAVE_TYPE_COLORS[lType] ?? "#475569";
                                const icon = LEAVE_TYPE_ICONS[lType] ?? "📋";
                                const techName = item.creatorName || item.data.employeeName || "Teknisi";

                                return (
                                  <div
                                    key={item.id}
                                    className={styles.calendarTechChip}
                                    style={{
                                      background: `${color}16`,
                                      color: color,
                                      border: `1px solid ${color}35`
                                    }}
                                    title={`${techName} (${LEAVE_TYPE_LABELS[lType] || lType}) - ${item.data.reason || ""}`}
                                  >
                                    <span>{icon}</span>
                                    <span className={styles.calendarTechChipText}>
                                      {techName}
                                    </span>
                                  </div>
                                );
                              })}
                              {cellLeaves.length > 3 && (
                                <div className={styles.moreChip}>
                                  +{cellLeaves.length - 3} lainnya
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Day Detail Panel ── */}
          <div className={styles.dayDetailCard}>
            <div className={styles.dayDetailHeader}>
              <div>
                <h4 className={styles.dayDetailTitle}>
                  <span>📅 Detail Cuti Teknisi:</span>
                  <span style={{ color: "#0284c7" }}>{formatDateIndo(selectedDate)}</span>
                </h4>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  {selectedDateLeaves.length > 0
                    ? `Ada ${selectedDateLeaves.length} teknisi yang sedang cuti pada tanggal ini`
                    : "Tidak ada teknisi cuti pada tanggal yang dipilih"}
                </div>
              </div>
              {selectedDate === todayStr && (
                <span className={styles.activePill}>● Hari Ini</span>
              )}
            </div>

            {selectedDateLeaves.length === 0 ? (
              <div className={styles.dayDetailEmpty}>
                <span>✅ Tidak ada teknisi yang cuti pada tanggal ini. Seluruh personel aktif dan siap untuk jadwal oncall.</span>
              </div>
            ) : (
              <div className={styles.dayDetailGrid}>
                {selectedDateLeaves.map((item) => {
                  const ltColor = LEAVE_TYPE_COLORS[item.data.leaveType] ?? "#475569";
                  const ltLabel = LEAVE_TYPE_LABELS[item.data.leaveType] ?? "Lainnya";
                  const active = isCutiActiveToday(item);

                  return (
                    <div key={item.id} className={styles.dayDetailItem}>
                      <div className={styles.dayDetailEmpRow}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div className={styles.reportAvatar}>
                            {(item.creatorName ?? "?").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <strong style={{ fontSize: 14, color: "#0f2738" }}>
                              {item.creatorName ?? item.data.employeeName ?? "Teknisi"}
                            </strong>
                            <div style={{ fontSize: 11, color: "#64748b" }}>
                              ID KPC: {item.creatorKpcId ?? item.data.kpcId ?? "-"} &nbsp;·&nbsp; {item.creatorDivision ?? item.data.division ?? "OPS Telco"}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <a
                            href={`${API_URL}/ops-telco/cuti-jobs/${item.id}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                            className={styles.deleteIconBtn}
                            title="Unduh Formulir Cuti Resmi (PDF Asli)"
                            style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                            onClick={(e) => { e.currentTarget.href = `${API_URL}/ops-telco/cuti-jobs/${item.id}/pdf?_t=${Date.now()}`; }}
                          >
                            📥
                          </a>
                          <a
                            href={`${API_URL}/ops-telco/cuti-jobs/${item.id}/pdf?inline=1`}
                            target="_blank"
                            rel="noreferrer"
                            className={styles.deleteIconBtn}
                            title="Buka & Cetak PDF di Tab Baru"
                            style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                            onClick={(e) => { e.currentTarget.href = `${API_URL}/ops-telco/cuti-jobs/${item.id}/pdf?inline=1&_t=${Date.now()}`; }}
                          >
                            🖨️
                          </a>
                        </div>
                      </div>

                      <div className={styles.reportLeaveDetails}>
                        <span
                          className={styles.leaveTypeBadge}
                          style={{
                            color: ltColor,
                            background: `${ltColor}18`,
                            border: `1px solid ${ltColor}40`
                          }}
                        >
                          {ltLabel}
                        </span>
                        <span className={styles.reportDateRange}>
                          📅 {formatDateShort(item.data.leaveStartDate)} — {formatDateShort(item.data.leaveEndDate)}
                        </span>
                        {item.data.totalDays && (
                          <span className={styles.reportDuration}>
                            ⏱ {item.data.totalDays} hari kerja
                          </span>
                        )}
                      </div>

                      <div className={styles.expandedGrid} style={{ marginBottom: 0, marginTop: 4 }}>
                        <ExpandRow label="Alasan Cuti" value={item.data.reason || "-"} />
                        <ExpandRow label="Kembali Kerja" value={formatDateIndo(item.data.backToWorkDate)} />
                        <ExpandRow label="Kontak" value={item.data.contactDuringLeave || "-"} />
                        <ExpandRow label="Nomor Form" value={item.formNumber} />
                      </div>

                      {active && (
                        <div className={styles.activeWarning} style={{ padding: "6px 10px", fontSize: 11 }}>
                          🔴 Sedang cuti hari ini — <strong>tidak dapat ditugaskan oncall</strong>.
                        </div>
                      )}

                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
                        <a
                          href={`${API_URL}/ops-telco/cuti-jobs/${item.id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className={styles.btnPrintNow}
                          style={{ fontSize: 11, padding: "5px 12px", textDecoration: "none" }}
                          title="Unduh Formulir Cuti Resmi (PDF Asli)"
                          onClick={(e) => { e.currentTarget.href = `${API_URL}/ops-telco/cuti-jobs/${item.id}/pdf?_t=${Date.now()}`; }}
                        >
                          📥 Unduh PDF
                        </a>
                        <a
                          href={`${API_URL}/ops-telco/cuti-jobs/${item.id}/pdf?inline=1`}
                          target="_blank"
                          rel="noreferrer"
                          className={styles.calendarTodayBtn}
                          style={{ fontSize: 11, padding: "5px 12px", textDecoration: "none" }}
                          title="Buka & Cetak PDF di Tab Baru"
                          onClick={(e) => { e.currentTarget.href = `${API_URL}/ops-telco/cuti-jobs/${item.id}/pdf?inline=1&_t=${Date.now()}`; }}
                        >
                          🖨️ Cetak PDF
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ════════════════════════════════════════════════════════════════════════
           LIST VIEW (ALTERNATIVE VIEW)
           ════════════════════════════════════════════════════════════════════════ */
        listFiltered.length === 0 ? (
          <div className={styles.emptyState}>
            <span>📋</span>
            <p>
              {search
                ? "Tidak ada data cuti yang cocok dengan pencarian."
                : "Belum ada formulir cuti tersimpan."}
            </p>
          </div>
        ) : (
          <div className={styles.reportGrid}>
            {listFiltered.map((item) => {
              const ltColor = LEAVE_TYPE_COLORS[item.data.leaveType] ?? "#6b7280";
              const ltLabel = LEAVE_TYPE_LABELS[item.data.leaveType] ?? "Lainnya";
              const active = isCutiActiveToday(item);
              const upcoming = isCutiUpcoming(item);
              const past = isCutiPast(item);

              return (
                <div
                  key={item.id}
                  className={styles.reportCard}
                  style={
                    active
                      ? { borderLeft: "4px solid #ef4444" }
                      : upcoming
                      ? { borderLeft: "4px solid #f59e0b" }
                      : {}
                  }
                >
                  <div className={styles.reportCardTop}>
                    <div>
                      <span className={styles.reportCardNumber}>{item.formNumber}</span>
                      {active && <span className={styles.activePill}>● Sedang Cuti</span>}
                      {upcoming && !active && <span className={styles.upcomingPill}>↑ Mendatang</span>}
                      {past && <span className={styles.pastPill}>✓ Selesai</span>}
                    </div>
                    <div className={styles.reportCardActions}>
                      <span
                        className={styles.statusBadge}
                        style={{
                          background: "#f0fdf4",
                          color: "#15803d",
                          border: "1px solid #86efac"
                        }}
                      >
                        Tersimpan
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <a
                          href={`${API_URL}/ops-telco/cuti-jobs/${item.id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className={styles.deleteIconBtn}
                          title="Unduh Formulir Cuti Resmi (PDF Asli)"
                          style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                          onClick={(e) => { e.currentTarget.href = `${API_URL}/ops-telco/cuti-jobs/${item.id}/pdf?_t=${Date.now()}`; }}
                        >
                          📥
                        </a>
                        <a
                          href={`${API_URL}/ops-telco/cuti-jobs/${item.id}/pdf?inline=1`}
                          target="_blank"
                          rel="noreferrer"
                          className={styles.deleteIconBtn}
                          title="Buka & Cetak PDF di Tab Baru"
                          style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                          onClick={(e) => { e.currentTarget.href = `${API_URL}/ops-telco/cuti-jobs/${item.id}/pdf?inline=1&_t=${Date.now()}`; }}
                        >
                          🖨️
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className={styles.reportEmployeeRow}>
                      <div className={styles.reportAvatar}>
                        {(item.creatorName ?? "?").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className={styles.reportEmployeeName}>{item.creatorName ?? "-"}</div>
                        <div className={styles.reportEmployeeMeta}>
                          ID: {item.creatorKpcId ?? "-"} &nbsp;·&nbsp; {item.creatorDivision ?? "-"}
                        </div>
                      </div>
                    </div>

                    <div className={styles.reportLeaveDetails}>
                      <span
                        className={styles.leaveTypeBadge}
                        style={{
                          color: ltColor,
                          background: `${ltColor}18`,
                          border: `1px solid ${ltColor}40`
                        }}
                      >
                        {ltLabel}
                      </span>
                      <span className={styles.reportDateRange}>
                        📅 {formatDateShort(item.data.leaveStartDate)} — {formatDateShort(item.data.leaveEndDate)}
                      </span>
                      {item.data.totalDays && (
                        <span className={styles.reportDuration}>⏱ {item.data.totalDays} hari kerja</span>
                      )}
                    </div>

                    <div className={styles.reportExpanded} style={{ marginTop: 12 }}>
                      <hr />
                      <div className={styles.expandedGrid}>
                        <ExpandRow label="Alasan" value={item.data.reason || "-"} />
                        <ExpandRow label="Kembali Kerja" value={formatDateIndo(item.data.backToWorkDate)} />
                        <ExpandRow label="Kontak" value={item.data.contactDuringLeave || "-"} />
                        <ExpandRow label="Dibuat" value={formatDateShort(item.createdAt)} />
                      </div>
                      <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                        <a
                          href={`${API_URL}/ops-telco/cuti-jobs/${item.id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className={styles.btnPrintNow}
                          style={{ textDecoration: "none" }}
                          title="Unduh Formulir Cuti Resmi (PDF Asli)"
                          onClick={(e) => { e.currentTarget.href = `${API_URL}/ops-telco/cuti-jobs/${item.id}/pdf?_t=${Date.now()}`; }}
                        >
                          📥 Unduh PDF
                        </a>
                        <a
                          href={`${API_URL}/ops-telco/cuti-jobs/${item.id}/pdf?inline=1`}
                          target="_blank"
                          rel="noreferrer"
                          className={styles.calendarTodayBtn}
                          style={{ textDecoration: "none" }}
                          title="Buka & Cetak PDF di Tab Baru"
                          onClick={(e) => { e.currentTarget.href = `${API_URL}/ops-telco/cuti-jobs/${item.id}/pdf?inline=1&_t=${Date.now()}`; }}
                        >
                          🖨️ Cetak PDF
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    );
  }

// ─── Small helper component ──────────────────────────────────────────────────

function ExpandRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.expandRow}>
      <span className={styles.expandLabel}>{label}</span>
      <span className={styles.expandValue}>{value}</span>
    </div>
  );
}
