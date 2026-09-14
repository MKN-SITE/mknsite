"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { API_URL, api } from "@/lib/api";
import type { HrSection } from "./hr-app";
import styles from "./hr-form-workspace.module.css";

type HrRecord = {
  id: number;
  formType: HrSection;
  formNumber: string;
  status: string;
  data: Record<string, string>;
  duplicatedFromId?: number | null;
  createdAt: string;
  updatedAt: string;
};

type Field = {
  key: string;
  label: string;
  type?: "text" | "date" | "time" | "number" | "textarea" | "select";
  options?: Array<{ value: string; label: string }>;
  wide?: boolean;
};

const operationalFields: Field[] = [
  { key: "dateRequired", label: "Tanggal pelaksanaan", type: "date" },
  { key: "customerRequestBy", label: "Call out diminta oleh (nama & badge)" },
  { key: "actualHours", label: "Lama pekerjaan (jam)", type: "number" },
  { key: "startTime", label: "Jam mulai", type: "time" },
  { key: "endTime", label: "Jam selesai", type: "time" },
  { key: "totalHours", label: "Total jam", type: "number" },
  { key: "jobOrder", label: "Job Order No." },
  { key: "workOrder", label: "Work Order No." },
  { key: "equipment", label: "Equipment No." },
  { key: "location", label: "Lokasi pekerjaan", wide: true },
  { key: "description", label: "Keterangan pekerjaan", type: "textarea", wide: true },
  { key: "workDone", label: "Penyelesaian pekerjaan", type: "textarea", wide: true },
  { key: "employeeName", label: "Employee — nama & badge" },
  { key: "supervisorName", label: "Supervisor — nama & badge" },
  { key: "hcName", label: "HC — nama & badge" }
];

const cutiFields: Field[] = [
  { key: "employeeName", label: "Nama karyawan" },
  { key: "employeeId", label: "No. ID" },
  { key: "employmentStartDate", label: "Tanggal mulai bekerja", type: "date" },
  { key: "department", label: "Departemen" },
  { key: "position", label: "Posisi" },
  { key: "leaveStartDate", label: "Mulai cuti", type: "date" },
  { key: "leaveEndDate", label: "Selesai cuti", type: "date" },
  { key: "workDays", label: "Jumlah hari kerja", type: "number" },
  { key: "leaveType", label: "Jenis izin", type: "select", options: [
    { value: "paid", label: "Cuti tahunan / izin dengan upah" },
    { value: "unpaid", label: "Izin tanpa upah" }
  ] },
  { key: "reason", label: "Penjelasan / alasan cuti", type: "textarea", wide: true },
  { key: "leaveAddress", label: "Alamat selama cuti", wide: true },
  { key: "phone", label: "Nomor telepon selama cuti" },
  { key: "handoverTo", label: "Tugas diserahkan kepada" },
  { key: "applicantSignatureName", label: "Nama pemohon untuk tanda tangan" },
  { key: "submittedDate", label: "Tanggal diajukan", type: "date" },
  { key: "hrCheckedBy", label: "Diperiksa HRD oleh" },
  { key: "hrCheckedDate", label: "Tanggal pemeriksaan HRD", type: "date" },
  { key: "approvedDays", label: "Cuti diberikan (hari)", type: "number" },
  { key: "deferredDays", label: "Cuti ditangguhkan (hari)", type: "number" },
  { key: "approvalNote", label: "Keterangan persetujuan", type: "textarea", wide: true },
  { key: "hrApprover", label: "Nama HRD" },
  { key: "departmentApprover", label: "Nama Kepala Dept. / Unit" },
  { key: "financeApprover", label: "Nama Direktur Keuangan" }
];

const hrBalanceFields: Field[] = [
  { key: "previousYearPeriod", label: "Sisa tahun kerja — periode" }, { key: "previousYearBalance", label: "Sisa tahun kerja — hak" }, { key: "previousYearUsed", label: "Sisa tahun kerja — terpakai" },
  { key: "currentYearPeriod", label: "Hak tahun ini — periode" }, { key: "currentYearBalance", label: "Hak tahun ini — hak" }, { key: "currentYearUsed", label: "Hak tahun ini — terpakai" },
  { key: "fiveYearBalance", label: "Hak lima tahun — hak" }, { key: "fiveYearUsed", label: "Hak lima tahun — terpakai" },
  { key: "totalEntitlementPeriod", label: "Jumlah hak — periode" }, { key: "totalEntitlement", label: "Jumlah hak — hak" }, { key: "totalUsed", label: "Jumlah hak — terpakai" },
  { key: "leaveRequestPeriod", label: "Pengajuan — periode" }, { key: "leaveRequestBalance", label: "Pengajuan — hak" }, { key: "leaveRequestUsed", label: "Pengajuan — terpakai" },
  { key: "remainingBeforePeriod", label: "Sisa belum diambil — periode" }, { key: "remainingBeforeBalance", label: "Sisa belum diambil — hak" }, { key: "remainingBeforeUsed", label: "Sisa belum diambil — terpakai" },
  { key: "deferredPeriod", label: "Ditangguhkan — periode" }, { key: "deferredBalance", label: "Ditangguhkan — hak" }, { key: "deferredUsed", label: "Ditangguhkan — terpakai" },
  { key: "remainingPeriod", label: "Sisa hak — periode" }, { key: "remainingBalance", label: "Sisa hak — hak" }, { key: "remainingUsed", label: "Sisa hak — terpakai" }
];

export function HrFormWorkspace({ type, userName }: { type: HrSection; userName: string }) {
  const [records, setRecords] = useState<HrRecord[]>([]);
  const [current, setCurrent] = useState<HrRecord | null>(null);
  const [values, setValues] = useState<Record<string, string>>({ employeeName: userName });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fields = useMemo(() => type === "cuti" ? cutiFields : operationalFields.filter((field) => type === "oncall" || !["customerRequestBy", "totalHours"].includes(field.key)), [type]);

  async function loadRecords() {
    const result = await api<{ data: HrRecord[] }>(`/hr/forms?type=${type}`);
    setRecords(result.data);
  }

  useEffect(() => { loadRecords().catch(() => setMessage("Riwayat formulir belum dapat dimuat.")); }, [type]);

  function change(key: string, value: string) {
    setValues((existing) => ({ ...existing, [key]: value }));
    setMessage(null);
  }

  function newForm() {
    setCurrent(null);
    setValues({ employeeName: userName });
    setMessage("Formulir baru siap diisi.");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = current
        ? await api<{ data: HrRecord }>(`/hr/forms/${current.id}`, { method: "PATCH", body: JSON.stringify({ data: values }) })
        : await api<{ data: HrRecord }>("/hr/forms", { method: "POST", body: JSON.stringify({ formType: type, data: values }) });
      setCurrent(result.data);
      setValues(result.data.data);
      setMessage(`Tersimpan sebagai ${result.data.formNumber}.`);
      await loadRecords();
    } catch {
      setMessage("Formulir gagal disimpan. Periksa isian dan coba lagi.");
    } finally { setBusy(false); }
  }

  async function duplicate() {
    if (!current) return;
    setBusy(true);
    try {
      const result = await api<{ data: HrRecord }>(`/hr/forms/${current.id}/duplicate`, { method: "POST" });
      setCurrent(result.data);
      setValues(result.data.data);
      setMessage(`Salinan dibuat sebagai ${result.data.formNumber}. Isi nama teknisi lalu simpan.`);
      await loadRecords();
    } finally { setBusy(false); }
  }

  async function downloadPdf() {
    if (!current) return;
    setBusy(true);
    try {
      const response = await fetch(`${API_URL}/hr/forms/${current.id}/pdf`, { credentials: "include" });
      if (!response.ok) throw new Error("PDF gagal dibuat");
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${current.formNumber}.pdf`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("PDF berhasil dibuat dari template asli.");
    } catch { setMessage("PDF belum dapat dibuat. Simpan formulir lalu coba lagi."); }
    finally { setBusy(false); }
  }

  function selectRecord(record: HrRecord) {
    setCurrent(record);
    setValues(record.data);
    setMessage(null);
  }

  return (
    <div className={styles.workspace}>
      <section className={styles.editor}>
        <div className={styles.toolbar}>
          <div><p className={styles.eyebrow}>Formulir digital</p><h2>{current?.formNumber ?? "Formulir baru"}</h2></div>
          <button type="button" className={styles.secondaryButton} onClick={newForm}>+ Form baru</button>
        </div>
        <form onSubmit={save}>
          <div className={styles.formGrid}>
            {fields.map((field) => <FormField key={field.key} field={field} value={values[field.key] ?? ""} onChange={(value) => change(field.key, value)} />)}
          </div>
          {type === "cuti" && (
            <details className={styles.balancePanel}>
              <summary>Rincian perhitungan hak cuti oleh HRD</summary>
              <div className={styles.formGrid}>{hrBalanceFields.map((field) => <FormField key={field.key} field={field} value={values[field.key] ?? ""} onChange={(value) => change(field.key, value)} />)}</div>
            </details>
          )}
          {message && <p className={styles.message} role="status">{message}</p>}
          <div className={styles.actions}>
            <button className={styles.primaryButton} disabled={busy}>{busy ? "Memproses…" : current ? "Simpan perubahan" : "Simpan formulir"}</button>
            <button type="button" className={styles.secondaryButton} onClick={duplicate} disabled={!current || busy}>Duplikasi teknisi</button>
            <button type="button" className={styles.pdfButton} onClick={downloadPdf} disabled={!current || busy}>Unduh PDF</button>
          </div>
        </form>
      </section>

      <aside className={styles.history}>
        <div className={styles.historyHeader}><div><p className={styles.eyebrow}>Tercatat</p><h3>Riwayat formulir</h3></div><span>{records.length}</span></div>
        <div className={styles.recordList}>
          {records.length === 0 && <p className={styles.empty}>Belum ada formulir tersimpan.</p>}
          {records.map((record) => (
            <button type="button" key={record.id} onClick={() => selectRecord(record)} className={`${styles.record} ${current?.id === record.id ? styles.selected : ""}`}>
              <strong>{record.formNumber}</strong><span>{record.data.employeeName || "Nama belum diisi"}</span><small>{new Date(record.updatedAt).toLocaleDateString("id-ID")}</small>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}

function FormField({ field, value, onChange }: { field: Field; value: string; onChange: (value: string) => void }) {
  const className = field.wide ? styles.wide : undefined;
  if (field.type === "textarea") return <label className={className}><span>{field.label}</span><textarea rows={3} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
  if (field.type === "select") return <label className={className}><span>{field.label}</span><select value={value} onChange={(event) => onChange(event.target.value)}><option value="">Pilih jenis izin</option>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
  return <label className={className}><span>{field.label}</span><input type={field.type ?? "text"} step={field.type === "number" ? "0.5" : undefined} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
