export type OpsTelcoFormType = "oncall" | "overtime" | "cuti";

export type OpsTelcoFormRecord = {
  id: number;
  formType: OpsTelcoFormType;
  formNumber: string;
  status: "draft" | "submitted" | "approved" | "rejected" | "deferred";
  data: Record<string, string>;
  duplicatedFromId?: number | null;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
};

export type FormFieldDefinition = {
  key: string;
  label: string;
  type?: "text" | "date" | "time" | "number" | "textarea" | "select";
  options?: Array<{ value: string; label: string }>;
  wide?: boolean;
  readOnly?: boolean;
};

export type OncallJobStatus =
  | "draft"
  | "technician_signing"
  | "submitted"
  | "revision_requested"
  | "approved"
  | "rejected";

export type OncallParticipant = {
  id: number;
  formId: number;
  userId: number;
  participantRole: "pic" | "member";
  nameSnapshot: string;
  kpcIdSnapshot: string | null;
  createdAt: string;
};

export type OncallSignature = {
  id: number;
  formId: number;
  signerUserId: number;
  signerType: "technician" | "supervisor";
  workflowVersion: number;
  nameSnapshot: string;
  kpcIdSnapshot: string | null;
  signatureFile: string;
  signatureSha256: string;
  signedPayloadHash: string;
  signedAt: string;
};

export type OncallApprovalHistory = {
  id: number;
  formId: number;
  supervisorUserId: number;
  workflowVersion: number;
  decision: "approved" | "revision_requested" | "rejected";
  note: string | null;
  signatureId: number | null;
  decidedAt: string;
};

export type OncallJobRecord = {
  id: number;
  formNumber: string;
  status: OncallJobStatus;
  jobOrderNo: string | null;
  workflowVersion: number;
  data: Record<string, string>;
  lockedAt: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  isLegacy: boolean;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  participants: OncallParticipant[];
  signatures: OncallSignature[];
  approvalHistory: OncallApprovalHistory[];
  isPic?: boolean;
  isParticipant?: boolean;
  isSupervisor?: boolean;
  picName?: string;
  picKpcId?: string | null;
  totalParticipants?: number;
  signaturesCount?: number;
};

export type EligibleTechnician = {
  id: number;
  name: string;
  kpcId: string | null;
  email: string;
  division: string | null;
  isOnCuti?: boolean;
};

