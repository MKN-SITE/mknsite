import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { generateHrPdf, type HrFormData } from "../src/services/hr-pdf.service";

// Synthetic examples for visual QA; no database or employee information is read.
const output = resolve(Bun.argv[2] ?? "../../tmp/pdfs");
await mkdir(output, { recursive: true });
const work = { employeeName: "Teknisi A / KPC001", dateRequired: "2026-09-14", customerRequestBy: "Petugas Site / KPC100", actualHours: "2.5", startTime: "18:30", endTime: "21:00", totalHours: "2.5", jobOrder: "OC-2026-00001", workOrder: "WO-12345", equipment: "BTS-001", location: "Site Balikpapan", description: "Pemeriksaan perangkat dan koneksi jaringan sesuai permintaan pelanggan.", workDone: "Perangkat diperiksa, koneksi diuji dan layanan kembali normal.", supervisorName: "Supervisor / KPC002", hcName: "HC / KPC003" };
const cuti: HrFormData = { employeeName: "Teknisi A", employeeId: "KPC001", employmentStartDate: "2020-01-02", department: "Telekomunikasi", position: "Teknisi", leaveStartDate: "2026-10-01", leaveEndDate: "2026-10-02", workDays: "2", leaveType: "paid", reason: "Keperluan keluarga", leaveAddress: "Balikpapan", phone: "08123456789", handoverTo: "Teknisi B", applicantSignatureName: "Teknisi A", submittedDate: "2026-09-14", hrCheckedBy: "Petugas HR", hrCheckedDate: "2026-09-15", approvedDays: "2", deferredDays: "0", approvalNote: "Disetujui sesuai jadwal", hrApprover: "Petugas HR", departmentApprover: "Kepala Telco", financeApprover: "Direktur Keuangan" };
for (const key of ["previousYear", "currentYear", "totalEntitlement", "leaveRequest", "remainingBefore", "deferred", "remaining"]) {
  cuti[`${key}Period`] = "2026";
  if (key !== "totalEntitlement") { cuti[`${key}Balance`] = "12"; cuti[`${key}Used`] = "2"; }
}
Object.assign(cuti, { fiveYearBalance: "0", fiveYearUsed: "0", totalEntitlement: "12", totalUsed: "2" });
for (const type of ["oncall", "overtime", "cuti"] as const) {
  const data = type === "cuti" ? cuti : { ...work, jobOrder: type === "oncall" ? "OC-2026-00001" : "OT-2026-00002" };
  await Bun.write(resolve(output, `${type}.pdf`), await generateHrPdf(type, data));
  console.log(`Created ${type}.pdf`);
}
