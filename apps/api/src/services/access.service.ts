import { eq } from "drizzle-orm";
import { db } from "../db";
import { permissions, rolePermissions, roles, userRoles, users } from "../db/schema";

export async function getProfile(userId: number) {
  const [account] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      accountType: users.accountType,
      division: users.division,
      avatarUrl: users.avatarUrl,
      isActive: users.isActive
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!account || !account.isActive) return null;

  const grants = await db
    .select({ role: roles.name, permission: permissions.slug })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(userRoles.userId, userId));

  return {
    id: account.id,
    name: account.name,
    email: account.email,
    actorType: account.accountType === "admin" ? ("admin" as const) : ("user" as const),
    division: account.division ?? null,
    avatarUrl: account.avatarUrl ?? null,
    roles: [...new Set(grants.map((grant) => grant.role))],
    permissions: [...new Set(grants.map((grant) => grant.permission))]
  };
}
