"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalHeader } from "@/components/layout/portal-header";
import { RealtimeStatus } from "@/components/realtime-status";
import { api, ApiError, type PortalUser } from "@/lib/api";
import styles from "./ops-telco-app.module.css";

export type OpsTelcoSection =
  | "assign-job"
  | "assign-jadwal-oncall"
  | "form-pto"
  | "jadwal-oncall"
  | "auto-report-wag"
  | "estimasi-quotation"
  | "dokumentasi-pekerjaan";

type MenuItem = {
  id: OpsTelcoSection;
  group: "supervisor" | "technician";
  title: string;
  description: string;
  permission: string;
  badge: string;
};

const menuItems: MenuItem[] = [
  { id: "assign-job", group: "supervisor", title: "Assign Job Oncall & Overtime", description: "Buat dan distribusikan penugasan oncall atau overtime kepada teknisi.", permission: "ops_telco.job_assignment.view", badge: "AJ" },
  { id: "assign-jadwal-oncall", group: "supervisor", title: "Assign Jadwal Oncall", description: "Susun jadwal oncall dan tetapkan teknisi yang bertugas.", permission: "ops_telco.schedule.manage", badge: "AS" },
  { id: "form-pto", group: "supervisor", title: "Form PTO", description: "Buat dan kelola dokumen PTO untuk kebutuhan pekerjaan Telco.", permission: "ops_telco.pto.view", badge: "PT" },
  { id: "jadwal-oncall", group: "technician", title: "View Jadwal Oncall", description: "Lihat jadwal oncall dan rincian giliran teknisi.", permission: "ops_telco.schedule.view", badge: "JO" },
  { id: "auto-report-wag", group: "technician", title: "Auto Report Job to WAG", description: "Siapkan laporan pekerjaan untuk diteruskan ke WhatsApp Group.", permission: "ops_telco.wag_report.view", badge: "WA" },
  { id: "estimasi-quotation", group: "technician", title: "Estimasi dan Quotation", description: "Catat kebutuhan, estimasi biaya, dan data quotation pekerjaan.", permission: "ops_telco.estimate.view", badge: "EQ" },
  { id: "dokumentasi-pekerjaan", group: "technician", title: "Report Dokumentasi Pekerjaan", description: "Simpan laporan dan dokumentasi hasil pekerjaan lapangan.", permission: "ops_telco.documentation.view", badge: "DP" }
];

export function OpsTelcoApp({ activeSection }: { activeSection?: OpsTelcoSection }) {
  const router = useRouter();
  const [user, setUser] = useState<PortalUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const selected = activeSection ? menuItems.find((item) => item.id === activeSection) : undefined;

  useEffect(() => {
    const controller = new AbortController();
    const accessPath = activeSection ? `/workspace/ops-telco/${activeSection}` : "/workspace/ops-telco";
    Promise.all([
      api<{ user: PortalUser }>("/auth/me", { signal: controller.signal }),
      api(accessPath, { signal: controller.signal })
    ])
      .then(([session]) => setUser(session.user))
      .catch((reason) => {
        if (reason instanceof ApiError && reason.status === 401) return router.replace("/login");
        if (reason instanceof ApiError && reason.status === 403) setError("Akun Anda tidak memiliki izin untuk membuka bagian OPS Telco ini.");
        else if (reason?.name !== "AbortError") setError("Modul OPS Telco belum dapat dimuat.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [activeSection, router]);

  async function logout() {
    setLoggingOut(true);
    try {
      await api("/auth/logout", { method: "POST" });
      router.replace("/login");
    } finally { setLoggingOut(false); }
  }

  if (loading) return <main className="loading-page" aria-label="Memuat OPS Telco"><div className="loading-block" /><div className="loading-block short" /></main>;

  if (error || !user) return (
    <main className={styles.errorPage}>
      <div className={styles.errorCard}><span>OPS TELCO</span><h1>Akses tidak tersedia</h1><p>{error ?? "Sesi pengguna tidak tersedia."}</p><Link href="/portal/ops-telco">Kembali ke OPS Telco</Link></div>
    </main>
  );

  const supervisorItems = menuItems.filter((item) => item.group === "supervisor" && user.permissions.includes(item.permission));
  const technicianItems = menuItems.filter((item) => item.group === "technician" && user.permissions.includes(item.permission));

  return (
    <div className={styles.shell}>
      <PortalHeader
        homeHref="/portal"
        homeLabel="MKN Site — kembali ke portal karyawan"
        name={user.name}
        role={user.roles.join(", ")}
        eyebrow="Operations"
        title={selected?.title ?? "OPS Telco"}
        description={selected?.description ?? "Ruang kerja operasional telekomunikasi dan layanan teknis lapangan."}
        status={<RealtimeStatus loginPath="/login" tone="inverse" />}
        onLogout={logout}
        loggingOut={loggingOut}
        logoutLabel="Keluar akun"
      />
      <main className={styles.main} id="main">
        <section className={styles.sheet}>
          <Link href={selected ? "/portal/ops-telco" : "/portal"} className={styles.backLink}><span aria-hidden="true">←</span>{selected ? "Menu OPS Telco" : "Portal utama"}</Link>
          {selected ? (
            <div className={styles.workspace}>
              <SectionNavigation
                active={selected.id}
                supervisorItems={supervisorItems}
                technicianItems={technicianItems}
              />
              <SectionPlaceholder item={selected} />
            </div>
          ) : (
            <>
              <div className={styles.heading}><p className={styles.kicker}>Akses berbasis role</p><h2>Menu OPS Telco</h2><p>Menu ditampilkan sesuai permission akun yang sedang login.</p></div>
              {supervisorItems.length > 0 && <MenuGroup title="Supervisor" description="Penugasan dan pengelolaan jadwal tim." items={supervisorItems} />}
              {technicianItems.length > 0 && <MenuGroup title="Teknisi" description="Jadwal, pelaporan, estimasi, dan dokumentasi pekerjaan." items={technicianItems} />}
              {supervisorItems.length === 0 && technicianItems.length === 0 && <div className={styles.empty}>Belum ada submenu OPS Telco yang diberikan kepada akun ini.</div>}
            </>
          )}
        </section>
      </main>
    </div>
  );
}

function SectionNavigation({ active, supervisorItems, technicianItems }: {
  active: OpsTelcoSection;
  supervisorItems: MenuItem[];
  technicianItems: MenuItem[];
}) {
  return (
    <aside className={styles.sidebar} aria-label="Navigasi submenu OPS Telco">
      <div className={styles.sidebarTitle}><span>Menu aktif</span><strong>OPS Telco</strong></div>
      {supervisorItems.length > 0 && <NavigationGroup title="Supervisor" items={supervisorItems} active={active} />}
      {technicianItems.length > 0 && <NavigationGroup title="Teknisi" items={technicianItems} active={active} />}
    </aside>
  );
}

function NavigationGroup({ title, items, active }: { title: string; items: MenuItem[]; active: OpsTelcoSection }) {
  return (
    <details className={styles.navGroup} open>
      <summary><span>{title}</span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 8 4 4 4-4" /></svg></summary>
      <nav>
        {items.map((item) => (
          <Link key={item.id} href={`/portal/ops-telco/${item.id}`} aria-current={item.id === active ? "page" : undefined} className={item.id === active ? styles.activeNav : undefined}>
            <span>{item.badge}</span><strong>{item.title}</strong>
          </Link>
        ))}
      </nav>
    </details>
  );
}

function MenuGroup({ title, description, items }: { title: string; description: string; items: MenuItem[] }) {
  return (
    <section className={styles.menuGroup} aria-labelledby={`group-${title.toLowerCase()}`}>
      <div className={styles.groupHeading}><div><h3 id={`group-${title.toLowerCase()}`}>{title}</h3><p>{description}</p></div><span>{items.length} menu</span></div>
      <div className={styles.grid}>
        {items.map((item) => <Link href={`/portal/ops-telco/${item.id}`} className={styles.card} key={item.id}><span className={styles.cardIcon}>{item.badge}</span><span className={styles.cardBody}><strong>{item.title}</strong><small>{item.description}</small></span><span className={styles.arrow} aria-hidden="true">→</span></Link>)}
      </div>
    </section>
  );
}

function SectionPlaceholder({ item }: { item: MenuItem }) {
  return (
    <section className={styles.placeholder}>
      <span className={styles.largeIcon}>{item.badge}</span><p className={styles.kicker}>{item.group === "supervisor" ? "Menu Supervisor" : "Menu Teknisi"}</p>
      <h2>{item.title}</h2><p>{item.description}</p><div className={styles.notice}>Hak akses halaman sudah aktif. Form dan alur kerja untuk menu ini dapat ditambahkan pada tahap berikutnya.</div>
    </section>
  );
}
