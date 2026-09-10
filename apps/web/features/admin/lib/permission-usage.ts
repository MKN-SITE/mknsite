import type { RoleSummaryDto } from "../hooks/use-roles";

export type PermissionUsage = { slug: string; roles: { id: number; name: string }[] };
export function getPermissionUsage(roles: RoleSummaryDto[]): PermissionUsage[] {
  const permissions = new Map<string, PermissionUsage>();
  for (const role of roles) {
    for (const slug of new Set(role.permissions)) {
      const entry = permissions.get(slug) ?? { slug, roles: [] };
      entry.roles.push({ id: role.id, name: role.name });
      permissions.set(slug, entry);
    }
  }
  return [...permissions.values()].sort((a, b) => a.slug.localeCompare(b.slug));
}
