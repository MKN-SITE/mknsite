export type AdminView = "home" | "users" | "roles" | "permissions" | "menus" | "settings";
export const userManagementLinks = [
  { view: "users", label: "Pengguna", description: "Akun dan akses pengguna", icon: "users", href: "/admin/user-management/users" },
  { view: "roles", label: "Role", description: "Peran dan hak akses", icon: "shield", href: "/admin/user-management/roles" },
  { view: "permissions", label: "Izin", description: "Izin yang digunakan role", icon: "clipboard-check", href: "/admin/user-management/permissions" }
] as const;
export const adminViewTitles: Record<AdminView, string> = {
  home: "Portal Admin", users: "Pengguna", roles: "Role", permissions: "Izin", menus: "Menu Portal", settings: "Pengaturan"
};
export function isUserManagementView(view: AdminView) {
  return userManagementLinks.some((link) => link.view === view);
}
