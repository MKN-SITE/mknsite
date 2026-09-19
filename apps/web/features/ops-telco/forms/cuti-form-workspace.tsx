"use client";

import { useEffect, useState, type FormEvent } from "react";
import { API_URL, api, type PortalUser } from "@/lib/api";
import styles from "./telco-form-workspace.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CutiStatus = "draft" | "submitted" | "cancelled";

export type CutiLeaveType =
  | "tahunan"
  | "sakit"
  | "melahirkan"
  | "penting"
  | "lainnya";

export interface CutiRecord {
  id: number;
  formNumber: string;
  status: CutiStatus;
  data: Record<string, string>;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  isCreator?: boolean;
  isSupervisor?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LEAVE_TYPES: Array<{ value: CutiLeaveType; label: string; color: string }> = [
  { value: "tahunan",    label: "🌴 Cuti Tahunan",        color: "#10b981" },
  { value: "sakit",      label: "🏥 Cuti Sakit",           color: "#f59e0b" },
  { value: "melahirkan", label: "👶 Cuti Melahirkan",      color: "#8b5cf6" },
  { value: "penting",    label: "⚠️ Keperluan Penting",    color: "#ef4444" },
  { value: "lainnya",    label: "📋 Lainnya",              color: "#6b7280" }
];

const statusMeta: Record<CutiStatus, { label: string; bg: string; color: string; border: string }> = {
  draft:     { label: "Draf",      bg: "#f1f5f9", color: "#475569", border: "#cbd5e1" },
  submitted: { label: "Tersimpan", bg: "#f0fdf4", color: "#15803d", border: "#86efac" },
  cancelled: { label: "Dibatalkan",bg: "#fef2f2", color: "#b91c1c", border: "#fca5a5" }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcWorkDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || s > e) return 0;
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function calcBackDate(end: string): string {
  if (!end) return "";
  const e = new Date(end);
  if (isNaN(e.getTime())) return "";
  e.setDate(e.getDate() + 1);
  while (e.getDay() === 0 || e.getDay() === 6) e.setDate(e.getDate() + 1);
  return e.toISOString().split("T")[0];
}

function formatDateDisplay(isoDate: string): string {
  if (!isoDate) return "-";
  try {
    return new Date(isoDate).toLocaleDateString("id-ID", {
      day: "numeric", month: "long", year: "numeric"
    });
  } catch { return isoDate; }
}

function getLeaveTypeMeta(val: string) {
  return LEAVE_TYPES.find((lt) => lt.value === val) ?? LEAVE_TYPES[4];
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CutiFormWorkspace({ user }: { user: PortalUser }) {
  // List state
  const [cutiList, setCutiList] = useState<CutiRecord[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Form state
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [flash, setFlash] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  // Current record
  const [current, setCurrent] = useState<CutiRecord | null>(null);

  // Form fields
  const [leaveType, setLeaveType]   = useState<CutiLeaveType>("tahunan");
  const [startDate, setStartDate]   = useState("");
  const [endDate, setEndDate]       = useState("");
  const [reason, setReason]         = useState("");
  const [contact, setContact]       = useState("");
  const [notes, setNotes]           = useState("");

  // Derived
  const totalDays = calcWorkDays(startDate, endDate);
  const backDate  = calcBackDate(endDate);

  // ─── Fetch list ─────────────────────────────────────────────────────────────
  async function fetchList() {
    setListLoading(true);
    try {
      const res = await api<{ items: CutiRecord[] }>("/ops-telco/cuti-jobs");
      setCutiList(res.items ?? []);
    } catch {
      // non-critical
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => { fetchList(); }, []);

  // ─── Load selected record ───────────────────────────────────────────────────
  async function loadRecord(id: number) {
    try {
      const rec = await api<CutiRecord>(`/ops-telco/cuti-jobs/${id}`);
      setCurrent(rec);
      setSelectedId(id);
      populateForm(rec.data);
    } catch (err: any) {
      showFlash("err", err?.message ?? "Gagal memuat formulir.");
    }
  }

  function populateForm(data: Record<string, string>) {
    setLeaveType((data.leaveType as CutiLeaveType) ?? "tahunan");
    setStartDate(data.leaveStartDate ?? "");
    setEndDate(data.leaveEndDate ?? "");
    setReason(data.reason ?? "");
    setContact(data.contactDuringLeave ?? "");
    setNotes(data.notes ?? "");
  }

  function newForm() {
    setCurrent(null);
    setSelectedId(null);
    setLeaveType("tahunan");
    setStartDate("");
    setEndDate("");
    setReason("");
    setContact("");
    setNotes("");
    setFlash(null);
  }

  function showFlash(type: "ok" | "err", msg: string) {
    setFlash({ type, msg });
    setTimeout(() => setFlash(null), 4500);
  }

  function buildPayload(): Record<string, string> {
    return {
      leaveType,
      leaveStartDate: startDate,
      leaveEndDate: endDate,
      totalDays: String(totalDays),
      reason,
      contactDuringLeave: contact,
      backToWorkDate: backDate,
      notes,
      position: user.roles?.join(", ") ?? ""
    };
  }

  // ─── Save draft ─────────────────────────────────────────────────────────────
  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!startDate || !endDate || !reason.trim()) {
      showFlash("err", "Lengkapi tanggal cuti dan alasan terlebih dahulu.");
      return;
    }
    if (reason.trim().length < 3) {
      showFlash("err", "Alasan cuti wajib diisi minimal 3 karakter.");
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      if (current && current.status === "draft") {
        await api(`/ops-telco/cuti-jobs/${current.id}`, { method: "PUT", body: JSON.stringify(payload) });
        showFlash("ok", "Draf formulir cuti berhasil diperbarui.");
      } else {
        const res = await api<{ id: number; formNumber: string }>("/ops-telco/cuti-jobs", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        await loadRecord(res.id);
        showFlash("ok", `Formulir cuti ${res.formNumber} berhasil dibuat sebagai draf.`);
      }
      await fetchList();
    } catch (err: any) {
      showFlash("err", err?.message ?? "Gagal menyimpan formulir.");
    } finally {
      setSaving(false);
    }
  }

  // ─── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!current) return;
    if (!reason.trim() || !startDate || !endDate) {
      showFlash("err", "Lengkapi semua data sebelum menyimpan formulir.");
      return;
    }
    if (reason.trim().length < 3) {
      showFlash("err", "Alasan cuti wajib diisi minimal 3 karakter.");
      return;
    }
    if (!window.confirm(`Simpan dan kunci formulir cuti ini?\nSetelah disimpan, formulir tidak dapat diubah.`)) return;
    setSubmitting(true);
    try {
      // Save latest data first
      await api(`/ops-telco/cuti-jobs/${current.id}`, {
        method: "PUT",
        body: JSON.stringify(buildPayload())
      });
      await api(`/ops-telco/cuti-jobs/${current.id}/submit`, { method: "POST" });
      showFlash("ok", "Formulir cuti berhasil disimpan ke dalam sistem!");
      await loadRecord(current.id);
      await fetchList();
    } catch (err: any) {
      showFlash("err", err?.message ?? "Gagal menyimpan formulir.");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Delete draft from form action ──────────────────────────────────────────
  async function handleDelete() {
    if (!current) return;
    await handleDeleteItem(current);
  }

  // ─── Delete specific draft item directly from sidebar ───────────────────────
  async function handleDeleteItem(record: CutiRecord) {
    if (!window.confirm(`Hapus draf formulir cuti ${record.formNumber}? Tindakan ini tidak dapat dibatalkan.`)) return;
    setDeleting(true);
    try {
      await api(`/ops-telco/cuti-jobs/${record.id}`, { method: "DELETE" });
      showFlash("ok", `Draf ${record.formNumber} berhasil dihapus.`);
      if (current?.id === record.id) {
        newForm();
      }
      await fetchList();
    } catch (err: any) {
      showFlash("err", err?.message ?? "Gagal menghapus formulir.");
    } finally {
      setDeleting(false);
    }
  }

  const isReadOnly = current?.status === "submitted" || current?.status === "cancelled";

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className={styles.workspaceLayout}>
      {/* ── Sidebar: List ── */}
      <aside className={styles.historySidebar}>
        <div className={styles.sidebarHeader}>
          <span>Formulir Cuti Saya</span>
          <button className={styles.newBtn} onClick={newForm} title="Buat formulir cuti baru">＋ Baru</button>
        </div>
        {listLoading ? (
          <div className={styles.listLoading}>Memuat…</div>
        ) : cutiList.length === 0 ? (
          <div className={styles.listEmpty}>Belum ada formulir cuti.<br /><small>Klik "＋ Baru" untuk mulai.</small></div>
        ) : (
          <ul className={styles.historyList}>
            {cutiList.map((item) => {
              const sm = statusMeta[item.status] ?? statusMeta.draft;
              const lt = getLeaveTypeMeta(item.data.leaveType);
              return (
                <li
                  key={item.id}
                  className={`${styles.historyItem} ${selectedId === item.id ? styles.historyItemActive : ""}`}
                  onClick={() => loadRecord(item.id)}
                >
                  <div className={styles.historyItemTop}>
                    <strong>{item.formNumber}</strong>
                    <div style={{ display: "flex", alignItems: "center", gap: "5px", flexShrink: 0 }}>
                      <span className={styles.statusBadge} style={{ background: sm.bg, color: sm.color, border: `1px solid ${sm.border}` }}>
                        {sm.label}
                      </span>
                      {item.status === "draft" && (
                        <button
                          type="button"
                          className={styles.deleteIconBtn}
                          title="Hapus draf ini"
                          disabled={deleting}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteItem(item);
                          }}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                  <div className={styles.historyItemMeta}>
                    <span>{lt.label}</span>
                    {item.data.leaveStartDate && (
                      <span>📅 {formatDateDisplay(item.data.leaveStartDate)}</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      {/* ── Main Form ── */}
      <main className={styles.formMain}>
        {flash && (
          <div className={`${styles.flashBanner} ${flash.type === "ok" ? styles.flashOk : styles.flashErr}`}>
            {flash.type === "ok" ? "✓" : "⚠"} {flash.msg}
          </div>
        )}

        {/* Header */}
        <div className={styles.formHeader}>
          <div>
            <div className={styles.formEyebrow}>OPS Telco — Form Cuti</div>
            <h2 className={styles.formTitle}>
              {current ? current.formNumber : "Formulir Cuti Baru"}
            </h2>
            {current && (
              <span className={styles.statusBadge} style={{
                background: statusMeta[current.status]?.bg,
                color: statusMeta[current.status]?.color,
                border: `1px solid ${statusMeta[current.status]?.border}`
              }}>
                {statusMeta[current.status]?.label}
              </span>
            )}
          </div>
          {current && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <a
                href={`${API_URL}/ops-telco/cuti-jobs/${current.id}/pdf`}
                target="_blank"
                rel="noreferrer"
                className={styles.btnPrintNow}
                style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px" }}
                title="Unduh Formulir Cuti Resmi (PDF Asli)"
                onClick={(e) => { e.currentTarget.href = `${API_URL}/ops-telco/cuti-jobs/${current.id}/pdf?_t=${Date.now()}`; }}
              >
                <span>📥</span>
                <span>Unduh PDF</span>
              </a>
              <a
                href={`${API_URL}/ops-telco/cuti-jobs/${current.id}/pdf?inline=1`}
                target="_blank"
                rel="noreferrer"
                className={styles.calendarTodayBtn}
                style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px" }}
                title="Buka & Cetak PDF di Tab Baru"
                onClick={(e) => { e.currentTarget.href = `${API_URL}/ops-telco/cuti-jobs/${current.id}/pdf?inline=1&_t=${Date.now()}`; }}
              >
                <span>🖨️</span>
                <span>Cetak</span>
              </a>
            </div>
          )}
        </div>

        <form onSubmit={handleSave} className={styles.formBody}>
          {/* ── Card 1: Identitas Karyawan ── */}
          <section className={styles.formCard}>
            <div className={styles.cardHeader}>
              <span className={styles.cardIcon}>👤</span>
              <div>
                <h3 className={styles.cardTitle}>1. Identitas Karyawan</h3>
                <p className={styles.cardSubtitle}>Data otomatis dari profil akun terdaftar</p>
              </div>
            </div>
            <div className={styles.fieldGrid}>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Nama Lengkap</label>
                <input className={styles.input} value={user.name} readOnly />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>ID KPC</label>
                <input className={styles.input} value={(user as any).kpcId ?? "-"} readOnly />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Divisi / Unit</label>
                <input className={styles.input} value={user.division ?? "-"} readOnly />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Posisi / Jabatan</label>
                <input className={styles.input} value={user.roles?.join(", ") ?? "-"} readOnly />
              </div>
            </div>
          </section>

          {/* ── Card 2: Jenis & Periode Cuti ── */}
          <section className={styles.formCard}>
            <div className={styles.cardHeader}>
              <span className={styles.cardIcon}>📅</span>
              <div>
                <h3 className={styles.cardTitle}>2. Jenis &amp; Periode Cuti</h3>
                <p className={styles.cardSubtitle}>Pilih jenis cuti dan tentukan tanggal cuti</p>
              </div>
            </div>
            <div className={styles.fieldGrid}>
              {/* Leave type pills */}
              <div className={styles.fieldGroupWide}>
                <label className={styles.label}>Jenis Cuti <span className={styles.required}>*</span></label>
                <div className={styles.leaveTypePills}>
                  {LEAVE_TYPES.map((lt) => (
                    <button
                      key={lt.value}
                      type="button"
                      disabled={isReadOnly}
                      onClick={() => setLeaveType(lt.value)}
                      className={`${styles.leaveTypePill} ${leaveType === lt.value ? styles.leaveTypePillActive : ""}`}
                      style={leaveType === lt.value ? { borderColor: lt.color, background: lt.color + "18", color: lt.color } : {}}
                    >
                      {lt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>Tanggal Mulai Cuti <span className={styles.required}>*</span></label>
                <input
                  className={styles.input}
                  type="date"
                  value={startDate}
                  min={new Date().toISOString().split("T")[0]}
                  readOnly={isReadOnly}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Tanggal Selesai Cuti <span className={styles.required}>*</span></label>
                <input
                  className={styles.input}
                  type="date"
                  value={endDate}
                  min={startDate || new Date().toISOString().split("T")[0]}
                  readOnly={isReadOnly}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Duration summary card */}
            {startDate && endDate && totalDays > 0 && (
              <div className={styles.durationCard}>
                <div className={styles.durationMain}>
                  <span className={styles.durationIcon}>🌴</span>
                  <div>
                    <div className={styles.durationValue}>{totalDays} Hari Kerja</div>
                    <div className={styles.durationSub}>{formatDateDisplay(startDate)} s/d {formatDateDisplay(endDate)}</div>
                  </div>
                </div>
                <div className={styles.durationBack}>
                  <span>📌 Kembali Kerja:</span>
                  <strong>{formatDateDisplay(backDate)}</strong>
                </div>
              </div>
            )}
          </section>

          {/* ── Card 3: Alasan & Keterangan ── */}
          <section className={styles.formCard}>
            <div className={styles.cardHeader}>
              <span className={styles.cardIcon}>📝</span>
              <div>
                <h3 className={styles.cardTitle}>3. Alasan &amp; Keterangan</h3>
                <p className={styles.cardSubtitle}>Jelaskan alasan pengajuan cuti</p>
              </div>
            </div>
            <div className={styles.fieldGrid}>
              <div className={styles.fieldGroupWide}>
                <label className={styles.label}>Alasan Cuti <span className={styles.required}>*</span></label>
                <textarea
                  className={styles.textarea}
                  rows={4}
                  value={reason}
                  readOnly={isReadOnly}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Jelaskan keperluan atau alasan mengambil cuti..."
                  required
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Kontak Selama Cuti</label>
                <input
                  className={styles.input}
                  type="text"
                  value={contact}
                  readOnly={isReadOnly}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="Nomor HP / WhatsApp aktif"
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Catatan Tambahan</label>
                <input
                  className={styles.input}
                  type="text"
                  value={notes}
                  readOnly={isReadOnly}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Misal: ada handover ke rekan, dll."
                />
              </div>
            </div>

            {/* Note about hidden calc features */}
            <div className={styles.infoNotice}>
              <span>ℹ️</span>
              <span>Perhitungan sisa hak cuti dikelola oleh Supervisor / HR dan akan aktif pada pengembangan berikutnya.</span>
            </div>
          </section>

          {/* ── Actions ── */}
          {!isReadOnly && (
            <div className={styles.actionBar}>
              <button type="submit" className={styles.btnPrimary} disabled={saving}>
                {saving ? "⏳ Menyimpan…" : "💾 Simpan Draf"}
              </button>
              {current?.status === "draft" && (
                <button
                  type="button"
                  className={styles.btnSuccess}
                  disabled={submitting}
                  onClick={handleSubmit}
                >
                  {submitting ? "⏳ Memproses…" : "✅ Simpan ke Sistem"}
                </button>
              )}
              {current?.status === "draft" && (
                <button
                  type="button"
                  className={styles.btnDanger}
                  disabled={deleting}
                  onClick={handleDelete}
                >
                  {deleting ? "⏳ Menghapus…" : "🗑️ Hapus Draf"}
                </button>
              )}
            </div>
          )}

          {/* Read-only notice */}
          {isReadOnly && (
            <div className={styles.readOnlyNotice}>
              <span>🔒</span>
              <span>
                Formulir ini sudah tersimpan dalam sistem dan tidak dapat diubah.
                Formulir Cuti Anda tercatat dan akan dipertimbangkan dalam penjadwalan oncall.
              </span>
            </div>
          )}

          {/* ── Saved Summary ── */}
          {current?.status === "submitted" && (
            <section className={styles.formCard} style={{ borderColor: "#86efac", background: "#f0fdf4" }}>
              <div className={styles.cardHeader} style={{ justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span className={styles.cardIcon}>✅</span>
                  <div>
                    <h3 className={styles.cardTitle}>Ringkasan Formulir Tersimpan</h3>
                    <p className={styles.cardSubtitle}>Data berikut telah dicatat dalam sistem dan siap dicetak</p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <a
                    href={`${API_URL}/ops-telco/cuti-jobs/${current.id}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.btnPrintNow}
                    style={{ textDecoration: "none" }}
                    title="Unduh Formulir Cuti Resmi (PDF Asli)"
                    onClick={(e) => { e.currentTarget.href = `${API_URL}/ops-telco/cuti-jobs/${current.id}/pdf?_t=${Date.now()}`; }}
                  >
                    📥 Unduh PDF
                  </a>
                  <a
                    href={`${API_URL}/ops-telco/cuti-jobs/${current.id}/pdf?inline=1`}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.calendarTodayBtn}
                    style={{ textDecoration: "none" }}
                    title="Buka & Cetak PDF di Tab Baru"
                    onClick={(e) => { e.currentTarget.href = `${API_URL}/ops-telco/cuti-jobs/${current.id}/pdf?inline=1&_t=${Date.now()}`; }}
                  >
                    🖨️ Cetak
                  </a>
                </div>
              </div>
              <div className={styles.summaryGrid}>
                <SummaryRow label="Nomor Formulir" value={current.formNumber} />
                <SummaryRow label="Karyawan" value={current.data.employeeName ?? user.name} />
                <SummaryRow label="ID KPC" value={current.data.kpcId ?? "-"} />
                <SummaryRow label="Jenis Cuti" value={getLeaveTypeMeta(current.data.leaveType)?.label ?? "-"} />
                <SummaryRow label="Periode Cuti" value={`${formatDateDisplay(current.data.leaveStartDate)} — ${formatDateDisplay(current.data.leaveEndDate)}`} />
                <SummaryRow label="Durasi" value={`${current.data.totalDays ?? "?"} hari kerja`} />
                <SummaryRow label="Kembali Kerja" value={formatDateDisplay(current.data.backToWorkDate)} />
                <SummaryRow label="Kontak" value={current.data.contactDuringLeave || "-"} />
                <SummaryRow label="Alasan" value={current.data.reason} wide />
              </div>
            </section>
          )}
        </form>
      </main>
    </div>
  );
}

// ─── Small helper component ──────────────────────────────────────────────────

function SummaryRow({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? styles.summaryRowWide : styles.summaryRow}>
      <span className={styles.summaryLabel}>{label}</span>
      <span className={styles.summaryValue}>{value}</span>
    </div>
  );
}
