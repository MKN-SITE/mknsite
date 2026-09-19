import { boolean, date, foreignKey, index, int, mysqlTable, primaryKey, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  email: varchar("email", { length: 191 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  accountType: varchar("account_type", { length: 24 }).notNull().default("employee"),
  kpcId: varchar("kpc_id", { length: 32 }),
  username: varchar("username", { length: 32 }),
  phone: varchar("phone", { length: 32 }),
  startDate: date("start_date", { mode: "string" }),
  division: varchar("division", { length: 100 }),
  avatarUrl: varchar("avatar_url", { length: 500 }),
  isActive: int("is_active").notNull().default(1),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
}, (table) => [
  uniqueIndex("users_email_unique").on(table.email),
  uniqueIndex("users_kpc_id_unique").on(table.kpcId),
  uniqueIndex("users_username_unique").on(table.username),
  index("users_account_type_idx").on(table.accountType),
  index("users_division_idx").on(table.division)
]);

export const accountAliases = mysqlTable("account_aliases", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  aliasType: varchar("alias_type", { length: 24 }).notNull(),
  normalizedValue: varchar("normalized_value", { length: 191 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow()
}, (table) => [
  uniqueIndex("account_aliases_normalized_unique").on(table.normalizedValue),
  index("account_aliases_user_idx").on(table.userId),
  index("account_aliases_type_idx").on(table.aliasType)
]);

// Better Auth owns opaque database sessions. MKN account type and RBAC remain
// in the existing users, roles, and permissions tables.
export const authUsers = mysqlTable("auth_user", {
  id: varchar("id", { length: 36 }).primaryKey(),
  // Nullable because Better Auth must be able to construct its native user
  // record. MKN never creates an identity without setting this link.
  mknUserId: int("mkn_user_id").references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  email: varchar("email", { length: 191 }).notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: varchar("image", { length: 500 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
}, (table) => [uniqueIndex("auth_user_mkn_user_unique").on(table.mknUserId), uniqueIndex("auth_user_email_unique").on(table.email)]);

export const authSessions = mysqlTable("auth_session", {
  id: varchar("id", { length: 36 }).primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: varchar("token", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  ipAddress: varchar("ip_address", { length: 64 }),
  userAgent: varchar("user_agent", { length: 500 }),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => authUsers.id, { onDelete: "cascade" })
}, (table) => [
  uniqueIndex("auth_session_token_unique").on(table.token),
  index("auth_session_user_idx").on(table.userId),
  index("auth_session_expires_at_idx").on(table.expiresAt)
]);

export const authAccounts = mysqlTable("auth_account", {
  id: varchar("id", { length: 36 }).primaryKey(),
  accountId: varchar("account_id", { length: 255 }).notNull(),
  providerId: varchar("provider_id", { length: 100 }).notNull(),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: varchar("scope", { length: 500 }),
  password: varchar("password", { length: 255 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
}, (table) => [index("auth_account_user_idx").on(table.userId), uniqueIndex("auth_account_provider_unique").on(table.providerId, table.accountId)]);

export const authVerifications = mysqlTable("auth_verification", {
  id: varchar("id", { length: 36 }).primaryKey(),
  identifier: varchar("identifier", { length: 255 }).notNull(),
  value: varchar("value", { length: 500 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
}, (table) => [index("auth_verification_identifier_idx").on(table.identifier)]);

export const roles = mysqlTable("roles", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow()
}, (table) => [uniqueIndex("roles_slug_unique").on(table.slug)]);

export const permissions = mysqlTable("permissions", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 140 }).notNull(),
  slug: varchar("slug", { length: 140 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow()
}, (table) => [uniqueIndex("permissions_slug_unique").on(table.slug)]);

export const userRoles = mysqlTable("user_roles", {
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  roleId: int("role_id").notNull().references(() => roles.id, { onDelete: "cascade" })
}, (table) => [primaryKey({ columns: [table.userId, table.roleId] })]);

export const rolePermissions = mysqlTable("role_permissions", {
  roleId: int("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  permissionId: int("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" })
}, (table) => [primaryKey({ columns: [table.roleId, table.permissionId] })]);

export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  actorId: int("actor_id").references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 120 }).notNull(),
  resource: varchar("resource", { length: 120 }).notNull(),
  resourceId: varchar("resource_id", { length: 120 }),
  ipAddress: varchar("ip_address", { length: 64 }),
  createdAt: timestamp("created_at").notNull().defaultNow()
}, (table) => [
  index("audit_actor_idx").on(table.actorId),
  index("audit_created_idx").on(table.createdAt),
  index("audit_logs_action_created_idx").on(table.action, table.createdAt)
]);

export const menus = mysqlTable("menus", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 100 }).notNull(),
  icon: text("icon"),
  description: varchar("description", { length: 255 }),
  url: varchar("url", { length: 500 }),
  requiredPermission: varchar("required_permission", { length: 140 }),
  sortOrder: int("sort_order").notNull().default(0),
  isActive: int("is_active").notNull().default(1),
  badgeCount: int("badge_count").default(0),
  badgeColor: varchar("badge_color", { length: 20 }).default("orange"),
  createdBy: int("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
}, (table) => [
  uniqueIndex("menus_url_unique").on(table.url),
  index("menus_sort_order_idx").on(table.sortOrder),
  index("menus_is_active_idx").on(table.isActive),
  index("menus_required_permission_idx").on(table.requiredPermission)
]);

export const opsTelcoForms = mysqlTable("ops_telco_forms", {
  id: int("id").autoincrement().primaryKey(),
  formType: varchar("form_type", { length: 24 }).notNull(),
  formNumber: varchar("form_number", { length: 80 }).notNull(),
  status: varchar("status", { length: 24 }).notNull().default("draft"),
  data: text("data").notNull(),
  createdBy: int("created_by").notNull(),
  duplicatedFromId: int("duplicated_from_id"),
  jobOrderNo: varchar("job_order_no", { length: 100 }),
  leaveStartDate: date("leave_start_date", { mode: "string" }),
  leaveEndDate: date("leave_end_date", { mode: "string" }),
  workflowVersion: int("workflow_version").notNull().default(1),
  lockedAt: timestamp("locked_at"),
  submittedAt: timestamp("submitted_at"),
  approvedAt: timestamp("approved_at"),
  isLegacy: boolean("is_legacy").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
}, (table) => [
  uniqueIndex("ops_telco_forms_number_unique").on(table.formNumber),
  foreignKey({ name: "ops_telco_forms_owner_users_fk", columns: [table.createdBy], foreignColumns: [users.id] }).onDelete("restrict"),
  index("ops_telco_forms_type_idx").on(table.formType),
  index("ops_telco_forms_created_by_idx").on(table.createdBy),
  index("ops_telco_forms_created_at_idx").on(table.createdAt),
  index("ops_telco_forms_job_order_no_idx").on(table.jobOrderNo),
  index("ops_telco_forms_type_status_idx").on(table.formType, table.status, table.createdAt),
  index("ops_telco_forms_leave_dates_idx").on(table.formType, table.createdBy, table.leaveStartDate, table.leaveEndDate)
]);

export const opsTelcoFormParticipants = mysqlTable("ops_telco_form_participants", {
  id: int("id").autoincrement().primaryKey(),
  formId: int("form_id").notNull().references(() => opsTelcoForms.id, { onDelete: "cascade" }),
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  participantRole: varchar("participant_role", { length: 16 }).notNull().default("member"),
  nameSnapshot: varchar("name_snapshot", { length: 160 }).notNull(),
  kpcIdSnapshot: varchar("kpc_id_snapshot", { length: 32 }),
  createdAt: timestamp("created_at").notNull().defaultNow()
}, (table) => [
  uniqueIndex("ops_telco_form_participants_form_user_unique").on(table.formId, table.userId),
  index("ops_telco_form_participants_form_idx").on(table.formId),
  index("ops_telco_form_participants_user_idx").on(table.userId)
]);

export const opsTelcoFormSignatures = mysqlTable("ops_telco_form_signatures", {
  id: int("id").autoincrement().primaryKey(),
  formId: int("form_id").notNull().references(() => opsTelcoForms.id, { onDelete: "cascade" }),
  signerUserId: int("signer_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  signerType: varchar("signer_type", { length: 24 }).notNull(),
  workflowVersion: int("workflow_version").notNull().default(1),
  nameSnapshot: varchar("name_snapshot", { length: 160 }).notNull(),
  kpcIdSnapshot: varchar("kpc_id_snapshot", { length: 32 }),
  signatureFile: varchar("signature_file", { length: 500 }).notNull(),
  signatureSha256: varchar("signature_sha256", { length: 64 }).notNull(),
  signedPayloadHash: varchar("signed_payload_hash", { length: 64 }).notNull(),
  signedAt: timestamp("signed_at").notNull().defaultNow()
}, (table) => [
  uniqueIndex("ops_telco_form_signatures_form_user_version_unique").on(table.formId, table.signerUserId, table.workflowVersion),
  index("ops_telco_form_signatures_form_idx").on(table.formId),
  index("ops_telco_form_signatures_user_idx").on(table.signerUserId)
]);

export const opsTelcoFormApprovalHistory = mysqlTable("ops_telco_form_approval_history", {
  id: int("id").autoincrement().primaryKey(),
  formId: int("form_id").notNull().references(() => opsTelcoForms.id, { onDelete: "cascade" }),
  supervisorUserId: int("supervisor_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  workflowVersion: int("workflow_version").notNull(),
  decision: varchar("decision", { length: 32 }).notNull(),
  note: text("note"),
  signatureId: int("signature_id").references(() => opsTelcoFormSignatures.id, { onDelete: "set null" }),
  decidedAt: timestamp("decided_at").notNull().defaultNow()
}, (table) => [
  index("ops_telco_form_approval_history_form_idx").on(table.formId),
  index("ops_telco_form_approval_history_supervisor_idx").on(table.supervisorUserId)
]);

export const divisions = mysqlTable("divisions", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: varchar("description", { length: 255 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
}, (table) => [uniqueIndex("divisions_name_unique").on(table.name)]);

export const oncallCrewMembers = mysqlTable("oncall_crew_members", {
  id: int("id").autoincrement().primaryKey(),
  crewType: varchar("crew_type", { length: 24 }).notNull(), // 'telco' | 'osp'
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sequenceOrder: int("sequence_order").notNull().default(0),
  displayName: varchar("display_name", { length: 100 }),
  isActive: int("is_active").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
}, (table) => [
  uniqueIndex("oncall_crew_members_crew_user_unique").on(table.crewType, table.userId),
  index("oncall_crew_members_crew_type_idx").on(table.crewType),
  index("oncall_crew_members_sequence_idx").on(table.sequenceOrder)
]);

export const oncallSchedules = mysqlTable("oncall_schedules", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 160 }).notNull(),
  periodLabel: varchar("period_label", { length: 100 }).notNull(),
  periodIndex: int("period_index").notNull().default(1),
  year: int("year").notNull().default(2026),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  status: varchar("status", { length: 24 }).notNull().default("active"),
  notes: text("notes"),
  telcoSupervisorName: varchar("telco_supervisor_name", { length: 100 }).notNull().default("Rahmansyah"),
  telcoSupervisorPhone: varchar("telco_supervisor_phone", { length: 50 }).notNull().default("( 0852 4691 9549 )"),
  ospSupervisorName: varchar("osp_supervisor_name", { length: 100 }).notNull().default("Bronson H."),
  ospSupervisorPhone: varchar("osp_supervisor_phone", { length: 50 }).notNull().default("(081254700404)"),
  superintendentName: varchar("superintendent_name", { length: 100 }).notNull().default("( Wanto )"),
  createdBy: int("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
}, (table) => [
  index("oncall_schedules_year_period_idx").on(table.year, table.periodIndex),
  index("oncall_schedules_status_idx").on(table.status),
  index("oncall_schedules_created_by_idx").on(table.createdBy)
]);

export const oncallScheduleSlots = mysqlTable("oncall_schedule_slots", {
  id: int("id").autoincrement().primaryKey(),
  scheduleId: int("schedule_id").notNull().references(() => oncallSchedules.id, { onDelete: "cascade" }),
  slotNumber: int("slot_number").notNull(),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  date1: date("date_1", { mode: "string" }).notNull(),
  date2: date("date_2", { mode: "string" }).notNull(),
  date3: date("date_3", { mode: "string" }).notNull(),
  datesJson: text("dates_json"),
  telcoUserId: int("telco_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  ospUserId: int("osp_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  isOverride: boolean("is_override").notNull().default(false),
  overrideReason: varchar("override_reason", { length: 255 }),
  notes: varchar("notes", { length: 255 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
}, (table) => [
  uniqueIndex("oncall_slots_schedule_slot_unique").on(table.scheduleId, table.slotNumber),
  index("oncall_slots_schedule_idx").on(table.scheduleId),
  index("oncall_slots_telco_user_idx").on(table.telcoUserId),
  index("oncall_slots_osp_user_idx").on(table.ospUserId)
]);
export const employeeContracts = mysqlTable("employee_contracts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  contractNumber: varchar("contract_number", { length: 80 }).notNull(),
  sequenceNumber: int("sequence_number").notNull().default(1),
  contractType: varchar("contract_type", { length: 50 }).notNull().default("PKWT"),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  status: varchar("status", { length: 24 }).notNull().default("active"),
  position: varchar("position", { length: 100 }),
  notes: text("notes"),
  reminderSentAt: timestamp("reminder_sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
}, (table) => [
  index("employee_contracts_user_idx").on(table.userId),
  index("employee_contracts_dates_idx").on(table.endDate, table.status)
]);

export const kpiCompanies = mysqlTable("kpi_companies", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  type: varchar("type", { length: 32 }).notNull().default("kpc"), // 'kpc' | 'non-kpc'
  clientCompanyName: varchar("client_company_name", { length: 200 }),
  clientAddress: text("client_address"),
  contractTitle: text("contract_title"),
  serviceDescription: text("service_description"),
  mknSignerName: varchar("mkn_signer_name", { length: 120 }),
  mknSignerRole: varchar("mkn_signer_role", { length: 120 }),
  clientSignerName: varchar("client_signer_name", { length: 120 }),
  clientSignerRole: varchar("client_signer_role", { length: 120 }),
  clientSignerLocation: varchar("client_signer_location", { length: 120 }),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
}, (table) => [
  index("kpi_companies_type_idx").on(table.type),
  index("kpi_companies_active_idx").on(table.isActive)
]);

export const kpiDevices = mysqlTable("kpi_devices", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("company_id").notNull().references(() => kpiCompanies.id, { onDelete: "cascade" }),
  deviceName: varchar("device_name", { length: 160 }).notNull(),
  location: varchar("location", { length: 160 }),
  orderIndex: int("order_index").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
}, (table) => [
  index("kpi_devices_company_idx").on(table.companyId)
]);

export const kpiHolidays = mysqlTable("kpi_holidays", {
  id: int("id").autoincrement().primaryKey(),
  holidayDate: date("holiday_date", { mode: "string" }).notNull(),
  description: varchar("description", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
}, (table) => [
  uniqueIndex("kpi_holidays_date_unique").on(table.holidayDate)
]);

export const kpiReports = mysqlTable("kpi_reports", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("company_id").notNull().references(() => kpiCompanies.id, { onDelete: "cascade" }),
  year: int("year").notNull(),
  month: int("month").notNull(),
  overallAvailability: varchar("overall_availability", { length: 32 }).notNull().default("100.00"),
  baoDate: date("bao_date", { mode: "string" }),
  baoNumber: varchar("bao_number", { length: 100 }),
  status: varchar("status", { length: 32 }).notNull().default("draft"),
  createdBy: int("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
}, (table) => [
  uniqueIndex("kpi_reports_company_period_unique").on(table.companyId, table.year, table.month),
  index("kpi_reports_company_idx").on(table.companyId),
  index("kpi_reports_period_idx").on(table.year, table.month)
]);

export const kpiReportProblems = mysqlTable("kpi_report_problems", {
  id: int("id").autoincrement().primaryKey(),
  reportId: int("report_id").notNull().references(() => kpiReports.id, { onDelete: "cascade" }),
  deviceId: int("device_id").notNull().references(() => kpiDevices.id, { onDelete: "cascade" }),
  problemDate: date("problem_date", { mode: "string" }).notNull(),
  downtimeHours: int("downtime_hours").notNull().default(0),
  downtimeMinutes: int("downtime_minutes").notNull().default(0),
  downtimeSeconds: int("downtime_seconds").notNull().default(0),
  totalSeconds: int("total_seconds").notNull().default(0),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
}, (table) => [
  index("kpi_report_problems_report_idx").on(table.reportId),
  index("kpi_report_problems_device_idx").on(table.deviceId),
  index("kpi_report_problems_date_idx").on(table.problemDate)
]);

export const opsTelcoRfos = mysqlTable("ops_telco_rfos", {
  id: int("id").autoincrement().primaryKey(),
  ticketNumber: varchar("ticket_number", { length: 50 }).notNull(),
  problemId: int("problem_id").references(() => kpiReportProblems.id, { onDelete: "set null" }),
  companyId: int("company_id").references(() => kpiCompanies.id, { onDelete: "set null" }),
  deviceId: int("device_id").references(() => kpiDevices.id, { onDelete: "set null" }),
  rfoDate: date("rfo_date", { mode: "string" }).notNull(),
  startTime: varchar("start_time", { length: 80 }).notNull(),
  endTime: varchar("end_time", { length: 80 }).notNull(),
  cause: text("cause").notNull(),
  impact: text("impact").notNull(),
  solution: text("solution").notNull(),
  status: text("status").notNull(),
  notes: text("notes"),
  createdBy: int("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
}, (table) => [
  uniqueIndex("ops_telco_rfos_ticket_unique").on(table.ticketNumber),
  index("ops_telco_rfos_problem_idx").on(table.problemId),
  index("ops_telco_rfos_company_idx").on(table.companyId),
  index("ops_telco_rfos_date_idx").on(table.rfoDate)
]);

export const opsTelcoHandovers = mysqlTable("ops_telco_handovers", {
  id: int("id").autoincrement().primaryKey(),
  handoverDate: date("handover_date", { mode: "string" }).notNull(),
  description: text("description").notNull(),
  photos: text("photos"), // JSON string array of image URLs
  createdBy: int("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
}, (table) => [
  index("ops_telco_handovers_date_idx").on(table.handoverDate),
  index("ops_telco_handovers_created_by_idx").on(table.createdBy)
]);

export const opsTelcoInspections = mysqlTable("ops_telco_inspections", {
  id: int("id").autoincrement().primaryKey(),
  category: varchar("category", { length: 50 }).notNull(), // 'tools' | 'apd' | 'tangga' | 'padlock'
  inspectionDate: date("inspection_date", { mode: "string" }).notNull(),
  itemName: varchar("item_name", { length: 255 }).notNull(),
  itemCondition: varchar("item_condition", { length: 50 }).notNull().default("baik"), // 'baik' | 'rusak_ringan' | 'rusak_berat' | 'hilang'
  location: varchar("location", { length: 255 }),
  notes: text("notes"),
  actionTaken: text("action_taken"),
  photos: text("photos"), // JSON string array of image URLs
  inspectedBy: int("inspected_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
}, (table) => [
  index("ops_telco_inspections_cat_idx").on(table.category),
  index("ops_telco_inspections_date_idx").on(table.inspectionDate),
  index("ops_telco_inspections_cond_idx").on(table.itemCondition),
  index("ops_telco_inspections_user_idx").on(table.inspectedBy)
]);

export const opsTelcoJsaForms = mysqlTable("ops_telco_jsa_forms", {
  id: int("id").autoincrement().primaryKey(),
  jsaNumber: varchar("jsa_number", { length: 100 }).notNull(),
  jobNumber: varchar("job_number", { length: 100 }),
  jobTitle: varchar("job_title", { length: 255 }).notNull(),
  personTitle: varchar("person_title", { length: 255 }),
  location: varchar("location", { length: 255 }).notNull(),
  jsaDate: date("jsa_date", { mode: "string" }).notNull(),
  jsaType: varchar("jsa_type", { length: 50 }), // 'new' | 'review' | 'urgent' | 'normal'
  ppeRequirements: text("ppe_requirements"),
  analysedBy: varchar("analysed_by", { length: 160 }),
  analysedByBadge: varchar("analysed_by_badge", { length: 50 }),
  reviewedBy: varchar("reviewed_by", { length: 160 }),
  reviewedByBadge: varchar("reviewed_by_badge", { length: 50 }),
  approvedBy: varchar("approved_by", { length: 160 }),
  approvedByBadge: varchar("approved_by_badge", { length: 50 }),
  supervisorName: varchar("supervisor_name", { length: 160 }),
  leadWorkerName: varchar("lead_worker_name", { length: 160 }),
  fpeElements: text("fpe_elements"), // JSON array of selected FPE keys
  jobPermits: text("job_permits"), // JSON array of selected permit keys
  workers: text("workers"), // JSON array of { name, badgeNumber }
  status: varchar("status", { length: 50 }).notNull().default("completed"),
  createdBy: int("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
}, (table) => [
  uniqueIndex("ops_telco_jsa_number_unique").on(table.jsaNumber),
  index("ops_telco_jsa_date_idx").on(table.jsaDate),
  index("ops_telco_jsa_created_by_idx").on(table.createdBy),
  index("ops_telco_jsa_location_idx").on(table.location)
]);

export const opsTelcoJsaSteps = mysqlTable("ops_telco_jsa_steps", {
  id: int("id").autoincrement().primaryKey(),
  jsaId: int("jsa_id").notNull().references(() => opsTelcoJsaForms.id, { onDelete: "cascade" }),
  stepNumber: int("step_number").notNull(),
  sequence: int("sequence").notNull().default(1),
  stepDescription: text("step_description").notNull(),
  hazardNo: varchar("hazard_no", { length: 100 }),
  hazardDescription: text("hazard_description"),
  actionNo: varchar("action_no", { length: 100 }),
  actionDescription: text("action_description"),
  observation: varchar("observation", { length: 10 }), // 'YES' | 'NO'
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
}, (table) => [
  index("ops_telco_jsa_steps_jsa_idx").on(table.jsaId),
  index("ops_telco_jsa_steps_step_idx").on(table.stepNumber)
]);

export const masterTowers = mysqlTable("master_towers", {
  id: int("id").autoincrement().primaryKey(),
  towerNo: int("tower_no"),
  towerCode: varchar("tower_code", { length: 50 }).notNull(),
  towerName: varchar("tower_name", { length: 160 }).notNull(),
  towerType: varchar("tower_type", { length: 100 }),
  height: varchar("height", { length: 50 }),
  heightMeters: int("height_meters"),
  locationKecamatan: varchar("location_kecamatan", { length: 100 }),
  locationKabupaten: varchar("location_kabupaten", { length: 100 }).default("Kutai Timur"),
  locationProvince: varchar("location_province", { length: 100 }).default("Kal-Tim"),
  latitude: varchar("latitude", { length: 100 }),
  longitude: varchar("longitude", { length: 100 }),
  altitude: varchar("altitude", { length: 50 }),
  latitudeDec: varchar("latitude_dec", { length: 50 }),
  longitudeDec: varchar("longitude_dec", { length: 50 }),
  operationalStatus: varchar("operational_status", { length: 50 }).notNull().default("Aktif"),
  description: text("description"),
  primaryPhotoUrl: varchar("primary_photo_url", { length: 500 }),
  createdBy: int("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
}, (table) => [
  uniqueIndex("master_towers_code_unique").on(table.towerCode),
  index("master_towers_name_idx").on(table.towerName),
  index("master_towers_type_idx").on(table.towerType),
  index("master_towers_kecamatan_idx").on(table.locationKecamatan)
]);

export const masterTowerPhotos = mysqlTable("master_tower_photos", {
  id: int("id").autoincrement().primaryKey(),
  towerId: int("tower_id").notNull().references(() => masterTowers.id, { onDelete: "cascade" }),
  photoUrl: varchar("photo_url", { length: 500 }).notNull(),
  caption: varchar("caption", { length: 255 }),
  isCover: boolean("is_cover").notNull().default(false),
  uploadedBy: int("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow()
}, (table) => [
  index("master_tower_photos_tower_idx").on(table.towerId)
]);

// ==========================================
// PORTAL: LV MKN
// ==========================================
export const lvGpsInfo = mysqlTable("lv_gps_info", {
  id: int("id").autoincrement().primaryKey(),
  imei: varchar("imei", { length: 50 }).notNull(),
  lvNumber: varchar("lv_number", { length: 50 }).notNull(),
  gsmNumber: varchar("gsm_number", { length: 50 }).notNull(),
  simProvider: varchar("sim_provider", { length: 50 }).default("Telkomsel"),
  activeUntil: date("active_until", { mode: "string" }),
  notes: text("notes"),
  createdBy: int("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
}, (table) => [
  uniqueIndex("lv_gps_info_imei_unique").on(table.imei),
  index("lv_gps_info_lv_number_idx").on(table.lvNumber)
]);

export const lvOverspeedLogs = mysqlTable("lv_overspeed_logs", {
  id: int("id").autoincrement().primaryKey(),
  lvNumber: varchar("lv_number", { length: 50 }).notNull(),
  location: varchar("255", { length: 255 }).notNull(),
  speed: int("speed").notNull(),
  speedLimit: int("speed_limit").notNull().default(60),
  occurredAt: timestamp("occurred_at").notNull().defaultNow(),
  driverName: varchar("driver_name", { length: 160 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow()
}, (table) => [
  index("lv_overspeed_logs_lv_number_idx").on(table.lvNumber),
  index("lv_overspeed_logs_occurred_at_idx").on(table.occurredAt)
]);

export const lvCommissioning = mysqlTable("lv_commissioning", {
  id: int("id").autoincrement().primaryKey(),
  lvNumber: varchar("lv_number", { length: 50 }).notNull(),
  kpcCommissioningNo: varchar("kpc_commissioning_no", { length: 100 }),
  validityDate: date("validity_date", { mode: "string" }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("Aktif"),
  reminderEmail: varchar("reminder_email", { length: 191 }),
  lastReminderSentAt: timestamp("last_reminder_sent_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
}, (table) => [
  index("lv_commissioning_lv_number_idx").on(table.lvNumber),
  index("lv_commissioning_validity_date_idx").on(table.validityDate)
]);

// ==========================================
// PORTAL: SAFETY
// ==========================================
export const safetyPermits = mysqlTable("safety_permits", {
  id: int("id").autoincrement().primaryKey(),
  permitNumber: varchar("permit_number", { length: 100 }).notNull(),
  permitType: varchar("permit_type", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  location: varchar("location", { length: 255 }).notNull(),
  gpsCoordinates: varchar("gps_coordinates", { length: 100 }),
  startDate: date("start_date", { mode: "string" }),
  endDate: date("end_date", { mode: "string" }),
  status: varchar("status", { length: 50 }).notNull().default("Draft"),
  picName: varchar("pic_name", { length: 160 }),
  picPhone: varchar("pic_phone", { length: 50 }),
  scannedDocUrl: varchar("scanned_doc_url", { length: 500 }),
  description: text("description"),
  additionalData: text("additional_data"),
  createdBy: int("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
}, (table) => [
  index("safety_permits_permit_type_idx").on(table.permitType),
  index("safety_permits_status_idx").on(table.status),
  uniqueIndex("safety_permits_number_unique").on(table.permitNumber)
]);

export const safetyTrainings = mysqlTable("safety_trainings", {
  id: int("id").autoincrement().primaryKey(),
  courseCode: varchar("course_code", { length: 50 }).notNull(),
  courseTitle: varchar("course_title", { length: 255 }).notNull(),
  category: varchar("category", { length: 100 }).notNull().default("SAFETY"),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow()
}, (table) => [
  uniqueIndex("safety_trainings_code_unique").on(table.courseCode)
]);

export const safetyEmployeeTrainings = mysqlTable("safety_employee_trainings", {
  id: int("id").autoincrement().primaryKey(),
  badgeNumber: varchar("badge_number", { length: 50 }).notNull(),
  employeeName: varchar("employee_name", { length: 160 }).notNull(),
  positionTitle: varchar("position_title", { length: 160 }),
  department: varchar("department", { length: 100 }),
  courseCode: varchar("course_code", { length: 50 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("c"),
  trainingDate: date("training_date", { mode: "string" }),
  expiryDate: date("expiry_date", { mode: "string" }),
  certificateUrl: varchar("certificate_url", { length: 500 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
}, (table) => [
  index("safety_emp_trainings_badge_idx").on(table.badgeNumber),
  index("safety_emp_trainings_course_idx").on(table.courseCode)
]);

export const safetyMessages = mysqlTable("safety_messages", {
  id: int("id").autoincrement().primaryKey(),
  monthYear: varchar("month_year", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content"),
  documentUrl: varchar("document_url", { length: 500 }),
  attendeeName: varchar("attendee_name", { length: 160 }),
  attendeeBadge: varchar("attendee_badge", { length: 50 }),
  signatureData: text("signature_data"),
  signedAt: timestamp("signed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
}, (table) => [
  index("safety_messages_month_year_idx").on(table.monthYear)
]);



