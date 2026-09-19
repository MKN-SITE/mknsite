export type OpsTelcoFormType = "oncall" | "overtime" | "cuti";
export type OpsTelcoFormData = Record<string, string>;

export class OpsTelcoFormError extends Error {
  constructor(public status: 403 | 404 | 409 | 422, message: string) {
    super(message);
  }
}

// Backwards compatibility alias
export const HrError = OpsTelcoFormError;

export const protectedApprovalFields = new Set([
  "hrCheckedBy", "hrCheckedDate", "approvedDays", "deferredDays", "approvalNote",
  "hrApprover", "departmentApprover", "financeApprover", "previousYearPeriod",
  "previousYearBalance", "previousYearUsed", "currentYearPeriod", "currentYearBalance",
  "currentYearUsed", "fiveYearBalance", "fiveYearUsed", "totalEntitlementPeriod",
  "totalEntitlement", "totalUsed", "leaveRequestPeriod", "leaveRequestBalance",
  "leaveRequestUsed", "remainingBeforePeriod", "remainingBeforeBalance", "remainingBeforeUsed",
  "deferredPeriod", "deferredBalance", "deferredUsed", "remainingPeriod", "remainingBalance", "remainingUsed"
]);

// Alias for backwards compatibility
export const protectedHrFields = protectedApprovalFields;

const operationalFields = [
  "dateRequired", "customerRequestBy", "actualHours", "startTime", "endTime", "hasBreak",
  "jobOrder", "workOrder", "equipment", "location", "description", "workDone",
  "employeeName", "supervisorName", "hcName"
];

const cutiFields = [
  "employeeName", "employeeId", "employmentStartDate", "department", "position",
  "leaveStartDate", "leaveEndDate", "workDays", "leaveType", "reason",
  "leaveAddress", "phone", "handoverTo", "applicantSignatureName", "submittedDate",
  ...protectedApprovalFields
];

const dateFields = new Set([
  "dateRequired", "employmentStartDate", "leaveStartDate", "leaveEndDate",
  "submittedDate", "hrCheckedDate"
]);

const numericFields = new Set([
  "actualHours", "workDays", "approvedDays", "deferredDays",
  ...[...protectedApprovalFields].filter((key) => /Balance$|Used$|^totalEntitlement$/.test(key))
]);

export function formatEmployeeIdentity(name: string, kpcId: string): string {
  return `${name.trim()} - ${kpcId.trim().toUpperCase()}`;
}

export function editableData(input: OpsTelcoFormData, manage: boolean): OpsTelcoFormData {
  return Object.fromEntries(
    Object.entries(input).filter(([key]) => manage || !protectedApprovalFields.has(key))
  );
}

export function duplicateOpsTelcoData(type: OpsTelcoFormType, input: OpsTelcoFormData): OpsTelcoFormData {
  // Copy work details, never identities, signature labels, or approval decisions.
  const keys = type === "cuti"
    ? ["leaveStartDate", "leaveEndDate", "leaveType", "reason"]
    : ["dateRequired", "customerRequestBy", "actualHours", "startTime", "endTime", "hasBreak", "workOrder", "equipment", "location", "description", "workDone"];
  return Object.fromEntries(keys.filter((key) => key in input).map((key) => [key, input[key]]));
}

// Alias for backwards compatibility
export const duplicateData = duplicateOpsTelcoData;

export function validateOpsTelcoData(type: OpsTelcoFormType, input: OpsTelcoFormData): OpsTelcoFormData {
  const sanitizedInput = { ...input };
  if (type === "oncall") {
    delete sanitizedInput.totalHours;
  }
  const allowed = new Set(
    type === "cuti"
      ? cutiFields
      : operationalFields.filter((key) => {
          if (type === "oncall") return key !== "totalHours";
          return !["customerRequestBy", "totalHours"].includes(key);
        })
  );
  const data: OpsTelcoFormData = {};
  for (const [key, raw] of Object.entries(sanitizedInput)) {
    if (!allowed.has(key)) {
      throw new OpsTelcoFormError(422, `Kolom ${key} tidak tersedia untuk formulir ini.`);
    }
    const value = raw.trim();
    if (value.length > 2000 || /[\x00-\x08\x0b-\x1f\x7f]/.test(value)) {
      throw new OpsTelcoFormError(422, `Isian ${key} terlalu panjang atau mengandung karakter kontrol.`);
    }
    if (value && dateFields.has(key) && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value || value < "1900-01-01" || value > "2199-12-31")) {
      throw new OpsTelcoFormError(422, `Tanggal ${key} tidak valid.`);
    }
    if (value && ["startTime", "endTime"].includes(key) && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
      throw new OpsTelcoFormError(422, `Jam ${key} tidak valid.`);
    }
    if (value && numericFields.has(key) && (!/^\d+(\.\d{1,2})?$/.test(value) || Number(value) > 9999)) {
      throw new OpsTelcoFormError(422, `Isian ${key} harus berupa angka 0–9999, maksimal dua desimal.`);
    }
    if (key === "leaveType" && value && !["paid", "unpaid"].includes(value)) {
      throw new OpsTelcoFormError(422, "Jenis cuti tidak valid.");
    }
    data[key] = value;
  }
  if (data.leaveStartDate && data.leaveEndDate && data.leaveEndDate < data.leaveStartDate) {
    throw new OpsTelcoFormError(422, "Tanggal selesai cuti harus sama atau setelah tanggal mulai.");
  }
  if ((type === "oncall" || type === "overtime") && data.startTime && data.endTime && !data.actualHours) {
    const [startH, startM] = data.startTime.split(":").map(Number);
    const [endH, endM] = data.endTime.split(":").map(Number);
    if (!isNaN(startH) && !isNaN(startM) && !isNaN(endH) && !isNaN(endM)) {
      const startTotal = startH * 60 + startM;
      let endTotal = endH * 60 + endM;
      if (endTotal < startTotal) {
        endTotal += 24 * 60;
      }
      const diffMinutes = endTotal - startTotal;
      let hours = Math.round((diffMinutes / 60) * 100) / 100;
      if (data.hasBreak === "1" || data.hasBreak === "true") {
        hours = Math.max(0, Math.round((hours - 1) * 100) / 100);
      }
      data.actualHours = hours > 0 ? hours.toString() : "0";
    }
  }
  return data;
}

// Alias for backwards compatibility
export const validateHrData = validateOpsTelcoData;

export function requireSubmission(type: OpsTelcoFormType, data: OpsTelcoFormData) {
  const required = type === "cuti"
    ? ["employeeName", "employeeId", "leaveStartDate", "leaveEndDate", "workDays", "leaveType", "reason"]
    : ["employeeName", "dateRequired", "startTime", "endTime", "description"];
  for (const key of required) {
    if (!data[key]?.trim()) {
      throw new OpsTelcoFormError(422, `Lengkapi ${key} sebelum mengajukan formulir.`);
    }
  }
  if (type === "cuti" && Number(data.workDays) <= 0) {
    throw new OpsTelcoFormError(422, "Jumlah hari cuti yang diajukan harus lebih dari nol.");
  }
}
