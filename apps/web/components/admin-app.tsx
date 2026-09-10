"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, PortalUser } from "@/lib/api";
import { UserList } from "@/features/admin/components/user-list";
import { RolePermissionViewer } from "@/features/admin/components/role-permission-viewer";
import { MenuManager } from "@/features/admin/components/menu-manager";
import { Brand } from "./brand";
import { RealtimeStatus } from "./realtime-status";

export function AdminApp() {
  const router = useRouter();
  const [admin, setAdmin] = useState<PortalUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState("roles");

  useEffect(() => {
    api<{ user: PortalUser }>("/auth/admin/me")
      .then(({ user }) => setAdmin(user))
      .catch(() => router.replace("/admin/login"))
      .finally(() => setLoading(false));
  }, [router]);

  async function logout() {
    await api("/auth/admin/logout", { method: "POST" });
    router.replace("/admin/login");
  }

  if (loading) return <main className="loading-page"><div className="loading-block" /><div className="loading-block short" /></main>;
  if (!admin) return null;

  return (
    <main className="app-shell admin-shell" id="main">
      <aside className="sidebar"><Brand /><div className="admin-kicker">Administrator</div><nav className="sidebar-nav" aria-label="Menu admin">{[["users", "Pengguna", "US"], ["menus", "Menu Portal", "MN"], ["roles", "Role & Izin", "RB"], ["settings", "Pengaturan", "ST"]].map(([key, label, token]) => <button key={key} className={`nav-button ${active === key ? "active" : ""}`} onClick={() => setActive(key)}><span className="nav-token">{token}</span><span className="nav-label">{label}</span></button>)}</nav><div className="sidebar-bottom"><strong>{admin.name}</strong><span>Administrator</span><button onClick={logout}>Keluar admin</button></div></aside>
      <section className="app-main"><header className="topbar"><h1>Administrasi Sistem</h1><div className="topbar-meta"><RealtimeStatus loginPath="/admin/login" /><span className="role-badge">Area Admin</span></div></header><div className="content"><div className="welcome"><div><h2>{active === "roles" ? "Role & Izin" : active === "users" ? "Pengguna" : active === "menus" ? "Menu Portal" : "Pengaturan"}</h2><p>Perubahan sistem hanya dikelola dari area administrator.</p></div></div>{active === "roles" ? <RolePermissionViewer /> : active === "users" ? <UserList currentAdmin={admin} /> : active === "menus" ? <MenuManager /> : <section className="admin-card"><h3>Keamanan sesi</h3><p>Sesi administrator dan karyawan memakai Better Auth session cookie terpisah.</p><div className="role-row"><div><strong>Mode produksi</strong><span>Secure, HTTP-only cookie</span></div><span className="role-badge">Aktif</span></div></section>}</div></section>
    </main>
  );
}

