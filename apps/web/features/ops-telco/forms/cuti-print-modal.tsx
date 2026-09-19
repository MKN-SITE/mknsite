"use client";

import React from "react";
import styles from "./telco-form-workspace.module.css";
import type { CutiRecord } from "./cuti-form-workspace";

interface CutiPrintModalProps {
  record: CutiRecord;
  onClose: () => void;
}

const LEAVE_LABEL_MAP: Record<string, string> = {
  tahunan: "Cuti Tahunan (Annual Leave)",
  sakit: "Cuti Sakit (Sick Leave)",
  melahirkan: "Cuti Melahirkan (Maternity Leave)",
  penting: "Keperluan Penting (Urgent Matters)",
  lainnya: "Lainnya (Other)"
};

function formatDate(iso: string | undefined): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  } catch {
    return iso;
  }
}

export function CutiPrintModal({ record, onClose }: CutiPrintModalProps) {
  const d = record.data || {};
  const leaveLabel = LEAVE_LABEL_MAP[d.leaveType] || d.leaveType || "Cuti";

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={styles.printModalOverlay} onClick={onClose}>
      <div className={styles.printModalContent} onClick={(e) => e.stopPropagation()}>
        {/* Modal Toolbar (hidden on print) */}
        <div className={styles.printToolbar}>
          <div className={styles.printToolbarInfo}>
            <strong>🖨️ Pratinjau Cetak Formulir Cuti</strong>
            <span>{record.formNumber} • {record.status === "submitted" ? "Tersimpan" : "Draf"}</span>
          </div>
          <div className={styles.printToolbarActions}>
            <button type="button" className={styles.btnPrintNow} onClick={handlePrint}>
              🖨️ Cetak / Unduh PDF
            </button>
            <button type="button" className={styles.btnPrintClose} onClick={onClose}>
              ✕ Tutup
            </button>
          </div>
        </div>

        {/* The Formal Document Sheet */}
        <div className={styles.printSheet} id="printable-cuti-sheet">
          {/* Header */}
          <div className={styles.printDocHeader}>
            <div className={styles.printCompanyInfo}>
              <div className={styles.printCompanyLogo}>MKN</div>
              <div>
                <h1 className={styles.printCompanyName}>PT. MANDIRI KARYA NUGRAHA</h1>
                <p className={styles.printSubHeader}>Telecommunication & Operations Field Services</p>
              </div>
            </div>
            <div className={styles.printDocMeta}>
              <table className={styles.printMetaTable}>
                <tbody>
                  <tr>
                    <td>No. Formulir</td>
                    <td>:</td>
                    <td><strong>{record.formNumber}</strong></td>
                  </tr>
                  <tr>
                    <td>Tanggal Dibuat</td>
                    <td>:</td>
                    <td>{formatDate(record.createdAt)}</td>
                  </tr>
                  <tr>
                    <td>Status Form</td>
                    <td>:</td>
                    <td>{record.status === "submitted" ? "TERCATAT / FINAL" : "DRAF"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className={styles.printDocTitleSection}>
            <h2 className={styles.printDocTitle}>FORMULIR PERMOHONAN CUTI KARYAWAN</h2>
            <div className={styles.printDocTitleUnderline} />
          </div>

          {/* Section 1: Data Karyawan */}
          <div className={styles.printSection}>
            <h3 className={styles.printSectionTitle}>I. DATA KARYAWAN</h3>
            <table className={styles.printDataTable}>
              <tbody>
                <tr>
                  <td style={{ width: "24%" }}>Nama Karyawan</td>
                  <td style={{ width: "2%" }}>:</td>
                  <td style={{ width: "34%" }}><strong>{d.employeeName || "-"}</strong></td>
                  <td style={{ width: "18%" }}>ID KPC</td>
                  <td style={{ width: "2%" }}>:</td>
                  <td style={{ width: "20%" }}><strong>{d.kpcId || "-"}</strong></td>
                </tr>
                <tr>
                  <td>Posisi / Jabatan</td>
                  <td>:</td>
                  <td>{d.position || "-"}</td>
                  <td>Divisi</td>
                  <td>:</td>
                  <td>{d.division || "-"}</td>
                </tr>
                <tr>
                  <td>Tanggal Mulai Kerja</td>
                  <td>:</td>
                  <td>{formatDate(d.startDate)}</td>
                  <td>Kontak Pemohon</td>
                  <td>:</td>
                  <td>{d.contactDuringLeave || "-"}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section 2: Rincian Permohonan Cuti */}
          <div className={styles.printSection}>
            <h3 className={styles.printSectionTitle}>II. RINCIAN PERMOHONAN CUTI</h3>
            <table className={styles.printDataTable}>
              <tbody>
                <tr>
                  <td style={{ width: "24%" }}>Jenis Cuti</td>
                  <td style={{ width: "2%" }}>:</td>
                  <td colSpan={4}><strong>{leaveLabel}</strong></td>
                </tr>
                <tr>
                  <td>Periode Cuti</td>
                  <td>:</td>
                  <td colSpan={4}>
                    <strong>{formatDate(d.leaveStartDate)}</strong> s/d <strong>{formatDate(d.leaveEndDate)}</strong>
                  </td>
                </tr>
                <tr>
                  <td>Durasi Cuti</td>
                  <td>:</td>
                  <td><strong>{d.totalDays || 0} Hari Kerja</strong></td>
                  <td style={{ width: "18%" }}>Kembali Masuk Kerja</td>
                  <td style={{ width: "2%" }}>:</td>
                  <td><strong>{formatDate(d.backToWorkDate)}</strong></td>
                </tr>
                <tr>
                  <td style={{ verticalAlign: "top" }}>Alasan Cuti</td>
                  <td style={{ verticalAlign: "top" }}>:</td>
                  <td colSpan={4} style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                    {d.reason || "-"}
                  </td>
                </tr>
                {d.notes && (
                  <tr>
                    <td style={{ verticalAlign: "top" }}>Catatan Tambahan</td>
                    <td style={{ verticalAlign: "top" }}>:</td>
                    <td colSpan={4} style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                      {d.notes}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Section 3: Integrasi Operasional & Hak Cuti */}
          <div className={styles.printSection}>
            <h3 className={styles.printSectionTitle}>III. KETERANGAN OPERASIONAL & HAK CUTI</h3>
            <div className={styles.printNoticeBox}>
              <p>
                <strong>Catatan Sistem:</strong> Formulir ini telah terhubung dengan sistem penjadwalan Oncall OPS Telco. 
                Selama masa cuti ({formatDate(d.leaveStartDate)} s/d {formatDate(d.leaveEndDate)}), 
                karyawan bersangkutan berstatus <em>Sedang Cuti</em> dan tidak dapat dijadwalkan pada pekerjaan oncall.
              </p>
              <p style={{ marginTop: "4px", fontSize: "11px", color: "#64748b" }}>
                * Perhitungan sisa hak cuti tahunan dikelola dan ditinjau secara berkala oleh Supervisor & Human Resources.
              </p>
            </div>
          </div>

          {/* Section 4: Kolom Tanda Tangan */}
          <div className={styles.printSignaturesSection}>
            <div className={styles.printSignCol}>
              <div className={styles.printSignRole}>Pemohon (Karyawan)</div>
              <div className={styles.printSignSpace} />
              <div className={styles.printSignName}>({d.employeeName || ".............................."})</div>
              <div className={styles.printSignDate}>Tanggal: {formatDate(record.createdAt)}</div>
            </div>

            <div className={styles.printSignCol}>
              <div className={styles.printSignRole}>Mengetahui (Supervisor)</div>
              <div className={styles.printSignSpace} />
              <div className={styles.printSignName}>(..........................................)</div>
              <div className={styles.printSignDate}>Tanggal: ..............................</div>
            </div>

            <div className={styles.printSignCol}>
              <div className={styles.printSignRole}>Menyetujui (HR / Management)</div>
              <div className={styles.printSignSpace} />
              <div className={styles.printSignName}>(..........................................)</div>
              <div className={styles.printSignDate}>Tanggal: ..............................</div>
            </div>
          </div>

          {/* Document Footer */}
          <div className={styles.printDocFooter}>
            <span>Dokumen Resmi OPS Telco — PT. Mandiri Karya Nugraha</span>
            <span>Dicetak otomatis pada: {new Date().toLocaleString("id-ID")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
