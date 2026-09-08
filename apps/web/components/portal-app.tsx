"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, PortalUser } from "@/lib/api";
import { Brand } from "./brand";
import { RealtimeStatus } from "./realtime-status";

const modules = [
  { permission: "dashboard.view", label: "Ringkasan", token: "HM" },
  { permission: "hr.view", label: "HR", token: "HR" },
  { permission: "ops_telco.view", label: "OPS Telco", token: "OT" },
  { permission: "ops_workshop.view", label: "OPS Workshop", token: "OW" },
  { permission: "project.view", label: "PRJ Project", token: "PR" }
];

const work = [
  ["Preventive maintenance Site BPN-042", "OPS Telco", "Berjalan"],
  ["Persetujuan cuti tim regional", "HR", "Perlu tinjau"],
  ["Renovasi workshop regional", "PRJ Project", "Berjalan"]
];

export function PortalApp() {
  const router = useRouter();
  const [user, setUser] = useState<PortalUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState("dashboard.view");

  useEffect(() => {
    api<{ user: PortalUser }>("/auth/me")
      .then(({ user }) => setUser(user))
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  async function logout() {
    await api("/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  if (loading) return <main className="loading-page"><div className="loading-block" /><div className="loading-block short" /></main>;
  if (!user) return null;
  const allowed = modules.filter((module) => user.permissions.includes(module.permission));
  const current = allowed.find((module) => module.permission === active) ?? allowed[0];

  return (
    <main className="app-shell" id="main">
      <aside className="sidebar" style={{ "--nav-count": allowed.length } as React.CSSProperties}>
        <Brand />
        <nav className="sidebar-nav" aria-label="Menu portal">
          {allowed.map((module) => <button key={module.permission} className={`nav-button ${current?.permission === module.permission ? "active" : ""}`} onClick={() => setActive(module.permission)}><span className="nav-token">{module.token}</span><span className="nav-label">{module.label}</span></button>)}
        </nav>
        <div className="sidebar-bottom"><strong>{user.name}</strong><span>{user.roles.join(", ")}</span><button onClick={logout}>Keluar</button></div>
      </aside>
      <section className="app-main">
        <header className="topbar"><h1>{current?.label}</h1><div className="topbar-meta"><RealtimeStatus loginPath="/login" /><span className="role-badge">{user.roles[0]}</span></div></header>
        <div className="content">
          <div className="welcome"><div><h2>{current?.permission === "dashboard.view" ? `Selamat datang, ${user.name.split(" ")[0]}` : current?.label}</h2><p>{current?.permission === "dashboard.view" ? "Berikut ringkasan ruang kerja sesuai akses Anda." : "Kelola aktivitas dan tindak lanjut unit Anda."}</p></div><Link className="button button-secondary button-small" href="/">Halaman publik</Link></div>
          <div className="metric-grid"><article className="metric"><span>Modul aktif</span><strong>{allowed.length - 1}</strong></article><article className="metric"><span>Tugas berjalan</span><strong>18</strong></article><article className="metric"><span>Perlu ditinjau</span><strong>4</strong></article><article className="metric"><span>Pembaruan hari ini</span><strong>11</strong></article></div>
          <section className="panel"><div className="panel-head"><div><h3>Aktivitas terbaru</h3><p>Data contoh sampai modul bisnis tersambung ke API.</p></div></div><ul className="work-list">{work.map((row, index) => <li className="work-row" key={row[0]}><div className="work-title"><strong>{row[0]}</strong><span>Diperbarui hari ini</span></div><span className="work-meta">{row[1]}</span><span className={`status ${index === 1 ? "warning" : ""}`}>{row[2]}</span></li>)}</ul></section>
        </div>
      </section>
    </main>
  );
}
