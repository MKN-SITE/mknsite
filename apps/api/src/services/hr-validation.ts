import type { HrFormData, HrFormType } from "./hr-pdf.service";

export class HrError extends Error {
  constructor(public status: 403 | 404 | 409 | 422, message: string) { super(message); }
}
export const protectedHrFields = new Set([
  "hrCheckedBy", "hrCheckedDate", "approvedDays", "deferredDays", "approvalNote",
  "hrApprover", "departmentApprover", "financeApprover", "previousYearPeriod",
  "previousYearBalance", "previousYearUsed", "currentYearPeriod", "currentYearBalance",
  "currentYearUsed", "fiveYearBalance", "fiveYearUsed", "totalEntitlementPeriod",
  "totalEntitlement", "totalUsed", "leaveRequestPeriod", "leaveRequestBalance",
  "leaveRequestUsed", "remainingBeforePeriod", "remainingBeforeBalance", "remainingBeforeUsed",
  "deferredPeriod", "deferredBalance", "deferredUsed", "remainingPeriod", "remainingBalance", "remainingUsed"
]);
const operationalFields = ["dateRequired", "customerRequestBy", "actualHours", "startTime", "endTime", "totalHours", "jobOrder", "workOrder", "equipment", "location", "description", "workDone", "employeeName", "supervisorName", "hcName"];
const cutiFields = ["employeeName", "employeeId", "employmentStartDate", "department", "position", "leaveStartDate", "leaveEndDate", "workDays", "leaveType", "reason", "leaveAddress", "phone", "handoverTo", "applicantSignatureName", "submittedDate", ...protectedHrFields];
const dateFields = new Set(["dateRequired", "employmentStartDate", "leaveStartDate", "leaveEndDate", "submittedDate", "hrCheckedDate"]);
const numericFields = new Set(["actualHours", "totalHours", "workDays", "approvedDays", "deferredDays", ...[...protectedHrFields].filter((key) => /Balance$|Used$|^totalEntitlement$/.test(key))]);

export function editableData(input: HrFormData, manage: boolean): HrFormData {
  return Object.fromEntries(Object.entries(input).filter(([key]) => manage || !protectedHrFields.has(key)));
}
export function duplicateData(type: HrFormType, input: HrFormData): HrFormData {
  // Copy work details, never identities, signature labels or HR decisions.
  const keys = type === "cuti" ? ["leaveStartDate", "leaveEndDate", "leaveType", "reason"]
    : ["dateRequired", "customerRequestBy", "actualHours", "startTime", "endTime", "totalHours", "workOrder", "equipment", "location", "description", "workDone"];
  return Object.fromEntries(keys.filter((key) => key in input).map((key) => [key, input[key]]));
}
export function validateHrData(type: HrFormType, input: HrFormData): HrFormData {
  const allowed = new Set(type === "cuti" ? cutiFields : operationalFields.filter((key) => type === "oncall" || !["customerRequestBy", "totalHours"].includes(key)));
  const data: HrFormData = {};
  for (const [key, raw] of Object.entries(input)) {
    if (!allowed.has(key)) throw new HrError(422, `Kolom ${key} tidak tersedia untuk formulir ini.`);
    const value = raw.trim();
    if (value.length > 2000 || /[\x00-\x08\x0b-\x1f\x7f]/.test(value)) throw new HrError(422, `Isian ${key} terlalu panjang atau mengandung karakter kontrol.`);
    if (value && dateFields.has(key) && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value || value < "1900-01-01" || value > "2199-12-31")) throw new HrError(422, `Tanggal ${key} tidak valid.`);
    if (value && ["startTime", "endTime"].includes(key) && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new HrError(422, `Jam ${key} tidak valid.`);
    if (value && numericFields.has(key) && (!/^\d+(\.\d{1,2})?$/.test(value) || Number(value) > 9999)) throw new HrError(422, `Isian ${key} harus berupa angka 0–9999, maksimal dua desimal.`);
    if (key === "leaveType" && value && !["paid", "unpaid"].includes(value)) throw new HrError(422, "Jenis cuti tidak valid.");
    data[key] = value;
  }
  if (data.leaveStartDate && data.leaveEndDate && data.leaveEndDate < data.leaveStartDate) throw new HrError(422, "Tanggal selesai cuti harus sama atau setelah tanggal mulai.");
  return data;
}
export function requireSubmission(type: HrFormType, data: HrFormData) {
  const required = type === "cuti" ? ["employeeName", "employeeId", "leaveStartDate", "leaveEndDate", "workDays", "leaveType", "reason"]
    : ["employeeName", "dateRequired", "startTime", "endTime", "description"];
  for (const key of required) if (!data[key]?.trim()) throw new HrError(422, `Lengkapi ${key} sebelum mengajukan formulir.`);
  if (type === "cuti" && Number(data.workDays) <= 0) throw new HrError(422, "Jumlah hari cuti yang diajukan harus lebih dari nol.");
}
