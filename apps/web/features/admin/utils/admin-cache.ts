import { clearDivisionCache } from "../hooks/use-divisions";
import { clearRoleCache } from "../hooks/use-roles";
import { clearPermissionCache } from "../hooks/use-permissions";
import { clearUserCache } from "../hooks/use-users";
import { clearMenuCache } from "../hooks/use-menus";

/**
 * Invalidate all in-memory admin caches across User Management and Menus.
 * Useful when mutations (delete user, change role, edit division, menu changes) occur.
 */
export function clearAllAdminCaches() {
  clearUserCache();
  clearDivisionCache();
  clearRoleCache();
  clearPermissionCache();
  clearMenuCache();
}
