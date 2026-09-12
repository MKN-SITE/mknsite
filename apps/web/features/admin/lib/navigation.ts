export type AdminView = "home" | "users" | "divisions" | "roles" | "permissions" | "menus" | "settings";
export const userManagementLinks = [
  { view: "users", label: "Pengguna", description: "Akun dan akses pengguna", icon: "users", href: "/admin/user-management/users" },
  { view: "divisions", label: "Divisi", description: "Kelola divisi & departemen tim", icon: "folder-kanban", href: "/admin/user-management/divisions" },
  { view: "roles", label: "Role", description: "Peran dan hak akses", icon: "shield", href: "/admin/user-management/roles" },
  { view: "permissions", label: "Izin", description: "Izin yang digunakan role", icon: "clipboard-check", href: "/admin/user-management/permissions" }
] as const;
export const adminViewTitles: Record<AdminView, string> = {
  home: "Admin", users: "Pengguna", divisions: "Divisi", roles: "Role", permissions: "Izin", menus: "Menu", settings: "Pengaturan"
};
export function isUserManagementView(view: AdminView) {
  return userManagementLinks.some((link) => link.view === view);
}
