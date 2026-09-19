"use client";

import React, { useEffect, useState } from "react";
import styles from "./view-jadwal-oncall-workspace.module.css";

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
  telcoUserId: number;
  telcoUserName: string;
  ospUserId: number;
  ospUserName: string;
  isOverride: boolean;
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

export function ViewJadwalOncallWorkspace({ user }: { user: UserProfile }) {
  const [schedules, setSchedules] = useState<ScheduleSummary[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  const [slots, setSlots] = useState<SlotDetail[]>([]);
  const [telcoCrews, setTelcoCrews] = useState<CrewMember[]>([]);
  const [ospCrews, setOspCrews] = useState<CrewMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. Fetch schedules
  const loadSchedules = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api-backend/ops-telco/oncall-schedules");
      if (!res.ok) throw new Error("Gagal memuat daftar jadwal oncall.");
      const json = await res.json();
      const list: ScheduleSummary[] = json.data || [];
      setSchedules(list);

      if (list.length > 0) {
        setSelectedScheduleId((prev) => (prev && list.some((s) => s.id === prev) ? prev : list[0].id));
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch schedule detail
  const loadScheduleDetail = async (id: number) => {
    try {
      const res = await fetch(`/api-backend/ops-telco/oncall-schedules/${id}`);
      if (!res.ok) throw new Error("Gagal memuat rincian jadwal.");
      const json = await res.json();
      setSlots(json.slots || []);
      setTelcoCrews(json.telcoCrews || []);
      setOspCrews(json.ospCrews || []);
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal memuat data.");
    }
  };

  useEffect(() => {
    loadSchedules();
  }, []);

  useEffect(() => {
    if (selectedScheduleId) {
      loadScheduleDetail(selectedScheduleId);
    }
  }, [selectedScheduleId]);

  const activeSchedule = schedules.find((s) => s.id === selectedScheduleId);

  // Check if current logged in user has a turn in this period
  const myTurns = slots.filter(
    (s) => s.telcoUserId === user.id || s.ospUserId === user.id
  );

  // Download official PDF
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
      alert(err.message || "Gagal mengunduh PDF.");
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

  // Helper get slot dates array
  const getSlotDates = (slot: SlotDetail): string[] => {
    if (slot.dates && slot.dates.length > 0) return slot.dates;
    const fallback = [slot.date1, slot.date2, slot.date3].filter(Boolean);
    return fallback.length > 0 ? fallback : [slot.startDate];
  };

  return (
    <div className={styles.container}>
      {/* ── Top Toolbar ── */}
      <div className={styles.topToolbar}>
        <div className={styles.toolbarTitleGroup}>
          <h2 className={styles.toolbarTitle}>
            <span>🗓️</span> View Jadwal Oncall
          </h2>
          <p className={styles.toolbarSubtitle}>
            Informasi giliran oncall resmi teknisi OSP & Telco Crew berdasarkan penetapan supervisor.
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
            className={styles.btnPrimary}
            onClick={handleDownloadPdf}
            disabled={!selectedScheduleId}
          >
            <span>📄</span> Download PDF Jadwal
          </button>
        </div>
      </div>

      {/* ── Personal Oncall Alert Banner ── */}
      {myTurns.length > 0 && (
        <div className={styles.myTurnBanner}>
          <div className={styles.myTurnInfo}>
            <span className={styles.myTurnIcon}>🔔</span>
            <div>
              <p className={styles.myTurnTitle}>Pemberitahuan Giliran Oncall Anda</p>
              <p className={styles.myTurnDates}>
                Anda bertugas oncall pada:{" "}
                <strong>
                  {myTurns
                    .map((t) => {
                      const dates = getSlotDates(t);
                      const start = formatDisplay(dates[0]);
                      const end = formatDisplay(dates[dates.length - 1]);
                      return `Slot ${t.slotNumber} (${start === end ? start : `${start} s/d ${end}`})`;
                    })
                    .join(", ")}
                </strong>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Schedule Card / Table ── */}
      {loading ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyStateTitle}>Memuat jadwal oncall...</p>
        </div>
      ) : schedules.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyStateTitle}>Belum ada jadwal oncall yang ditetapkan oleh Supervisor.</p>
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
                  {/* Telco Sub-headers */}
                  {telcoCrews.slice(0, 5).map((crew) => (
                    <th key={`telco-th-${crew.id}`} className={styles.thSubHeader}>
                      {crew.name}
                    </th>
                  ))}
                  {/* OSP Sub-headers */}
                  {ospCrews.slice(0, 4).map((crew) => (
                    <th key={`osp-th-${crew.id}`} className={styles.thSubHeader}>
                      {crew.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slots.map((slot) => {
                  const isMySlot = slot.telcoUserId === user.id || slot.ospUserId === user.id;
                  const slotDates = getSlotDates(slot);

                  return (
                    <tr
                      key={`slot-row-${slot.id}`}
                      className={isMySlot ? styles.rowMyTurn : undefined}
                    >
                      <td className={styles.tdNo}>{slot.slotNumber}</td>
                      <td className={styles.tdPeriode}>
                        {slotDates.map((d, i) => (
                          <span key={`slot-date-${slot.id}-${i}`} className={styles.dateRow}>
                            {formatDisplay(d)}
                          </span>
                        ))}
                      </td>

                      {/* Telco columns */}
                      {telcoCrews.slice(0, 5).map((crew) => {
                        const isOncall = crew.userId === slot.telcoUserId;
                        return (
                          <td
                            key={`slot-${slot.id}-telco-${crew.userId}`}
                            className={isOncall ? styles.cellOncall : styles.cellRegular}
                          >
                            {isOncall ? "Oncall" : ""}
                          </td>
                        );
                      })}

                      {/* OSP columns */}
                      {ospCrews.slice(0, 4).map((crew) => {
                        const isOncall = crew.userId === slot.ospUserId;
                        return (
                          <td
                            key={`slot-${slot.id}-osp-${crew.userId}`}
                            className={isOncall ? styles.cellOncall : styles.cellRegular}
                          >
                            {isOncall ? "Oncall" : ""}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
    </div>
  );
}
