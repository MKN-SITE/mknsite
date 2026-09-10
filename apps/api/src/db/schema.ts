import { boolean, index, int, mysqlTable, primaryKey, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  email: varchar("email", { length: 191 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  accountType: varchar("account_type", { length: 24 }).notNull().default("employee"),
  isActive: int("is_active").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
}, (table) => [uniqueIndex("users_email_unique").on(table.email), index("users_account_type_idx").on(table.accountType)]);

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
}, (table) => [uniqueIndex("auth_session_token_unique").on(table.token), index("auth_session_user_idx").on(table.userId)]);

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
}, (table) => [index("audit_actor_idx").on(table.actorId), index("audit_created_idx").on(table.createdAt)]);

export const menus = mysqlTable("menus", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 100 }).notNull(),
  icon: varchar("icon", { length: 100 }),
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
  index("menus_sort_order_idx").on(table.sortOrder),
  index("menus_is_active_idx").on(table.isActive),
  index("menus_required_permission_idx").on(table.requiredPermission)
]);

