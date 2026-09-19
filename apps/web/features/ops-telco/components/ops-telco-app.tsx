"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalWorkspaceLayout } from "@/components/layout/portal-workspace-layout";
import { api, ApiError, type PortalUser } from "@/lib/api";
import { OncallJobWorkspace } from "../forms/oncall-job-workspace";
import { OncallApprovalPanel } from "../forms/oncall-approval-panel";
import { OvertimeJobWorkspace } from "../forms/overtime-job-workspace";
import { OvertimeApprovalPanel } from "../forms/overtime-approval-panel";
import { CutiFormWorkspace } from "../forms/cuti-form-workspace";
import { CutiReportSupervisor } from "../forms/cuti-report-supervisor";
import { PtoFormWorkspace } from "../forms/pto-form-workspace";
import { KpiBaoWorkspace } from "../forms/kpi-bao-workspace";
import { HandoverWorkspace } from "../forms/handover-workspace";
import { InspeksiWorkspace } from "../forms/inspeksi-workspace";
import { JsaWorkspace } from "../forms/jsa-workspace";
import { AssignJadwalOncallWorkspace } from "./assign-jadwal-oncall-workspace";
import { ViewJadwalOncallWorkspace } from "./view-jadwal-oncall-workspace";
import styles from "./ops-telco-app.module.css";

export type OpsTelcoSection =
  | "assign-jadwal-oncall"
  | "form-pto"
  | "approval-form-oncall"
  | "approval-form-overtime"
  | "report-cuti-teknisi"
  | "kpi-bao-report"
  | "jadwal-oncall"
  | "auto-report-wag"
  | "estimasi-quotation"
  | "dokumentasi-pekerjaan"
  | "form-oncall"
  | "form-overtime"
  | "form-cuti"
  | "form-jsa"
  | "serah-terima-report"
  | "inspeksi-tools"
  | "inspeksi-special-tools"
  | "inspeksi-genset-tools"
  | "inspeksi-apd"
  | "inspeksi-double-lanyard"
  | "inspeksi-full-body-harness"
  | "inspeksi-katrol"
  | "inspeksi-padlock"
  | "inspeksi-pole-harness"
  | "inspeksi-single-lanyard"
  | "inspeksi-tali-karmantle"
  | "inspeksi-tangga";

type MenuItem = {
  id: OpsTelcoSection;
  group: "supervisor" | "technician" | "inspeksi";
  title: string;
  description: string;
  permission: string;
  badge: string;
};

const menuItems: MenuItem[] = [
  { id: "assign-jadwal-oncall", group: "supervisor", title: "Assign Jadwal Oncall", description: "Susun jadwal oncall dan tetapkan teknisi yang bertugas.", permission: "ops_telco.schedule.manage", badge: "AS" },
  { id: "form-pto", group: "supervisor", title: "Form PTO", description: "Buat dan kelola dokumen PTO untuk kebutuhan pekerjaan Telco.", permission: "ops_telco.pto.view", badge: "PT" },
  { id: "approval-form-oncall", group: "supervisor", title: "Approval Form Oncall", description: "Verifikasi, revisi, dan persetujuan bertanda tangan untuk formulir Oncall teknisi.", permission: "ops_telco.oncall.approve", badge: "AO" },
  { id: "approval-form-overtime", group: "supervisor", title: "Approval Form Overtime", description: "Verifikasi, revisi, dan persetujuan bertanda tangan untuk formulir Overtime teknisi.", permission: "ops_telco.forms.manage", badge: "OV" },
  { id: "report-cuti-teknisi", group: "supervisor", title: "Report Cuti Teknisi", description: "Pantau jadwal cuti seluruh teknisi dan dampaknya terhadap jadwal oncall.", permission: "ops_telco.forms.manage", badge: "RC" },
  { id: "kpi-bao-report", group: "supervisor", title: "KPI & BAO Sangatta Report", description: "Laporan bulanan availability jaringan 100% dan Berita Acara Operasi Sangatta.", permission: "ops_telco.kpi.manage", badge: "KB" },
  { id: "form-oncall", group: "technician", title: "Form Oncall", description: "Formulir permintaan dan laporan pekerjaan oncall teknisi berbasis Job Order.", permission: "ops_telco.forms.view", badge: "OC" },
  { id: "form-overtime", group: "technician", title: "Form Overtime", description: "Formulir lembur dan penugasan overtime teknisi berbasis Job Order.", permission: "ops_telco.forms.view", badge: "OT" },
  { id: "form-cuti", group: "technician", title: "Form Cuti", description: "Formulir permohonan cuti dan izin kerja teknisi.", permission: "ops_telco.forms.view", badge: "CT" },
  { id: "form-jsa", group: "technician", title: "Job Safety Analisis", description: "Formulir Analisis Keselamatan Kerja (JSA) teknisi lapangan.", permission: "ops_telco.forms.view", badge: "JS" },
  { id: "jadwal-oncall", group: "technician", title: "View Jadwal Oncall", description: "Lihat jadwal oncall dan rincian giliran teknisi.", permission: "ops_telco.schedule.view", badge: "JO" },
  { id: "auto-report-wag", group: "technician", title: "Auto Report Job to WAG", description: "Siapkan laporan pekerjaan untuk diteruskan ke WhatsApp Group.", permission: "ops_telco.wag_report.view", badge: "WA" },
  { id: "estimasi-quotation", group: "technician", title: "Estimasi dan Quotation", description: "Catat kebutuhan, estimasi biaya, dan data quotation pekerjaan.", permission: "ops_telco.estimate.view", badge: "EQ" },
  { id: "dokumentasi-pekerjaan", group: "technician", title: "Report Dokumentasi Pekerjaan", description: "Simpan laporan dan dokumentasi hasil pekerjaan lapangan.", permission: "ops_telco.documentation.view", badge: "DP" },
  { id: "serah-terima-report", group: "technician", title: "Laporan Serah Terima", description: "Catat dan laporkan serah terima perangkat atau pekerjaan beserta dokumentasi foto.", permission: "ops_telco.forms.view", badge: "ST" },
  { id: "inspeksi-tools", group: "inspeksi", title: "Tool", description: "Pemeriksaan kelayakan, fungsi, dan inventaris toolkit teknisi telco.", permission: "ops_telco.forms.view", badge: "TL" },
  { id: "inspeksi-special-tools", group: "inspeksi", title: "Special Tool", description: "Pemeriksaan alat ukur, splicer, OTDR, dan special tools telco crew.", permission: "ops_telco.forms.view", badge: "ST" },
  { id: "inspeksi-genset-tools", group: "inspeksi", title: "Genset Tool", description: "Pemeriksaan toolset pemeliharaan genset dan kelistrikan telco.", permission: "ops_telco.forms.view", badge: "GT" },
  { id: "inspeksi-apd", group: "inspeksi", title: "APD", description: "Pemeriksaan kelengkapan dan kondisi Alat Pelindung Diri K3 personil.", permission: "ops_telco.forms.view", badge: "AP" },
  { id: "inspeksi-double-lanyard", group: "inspeksi", title: "Double Lanyard", description: "Pemeriksaan keselamatan double lanyard, energy absorber, dan lifeline.", permission: "ops_telco.forms.view", badge: "DL" },
  { id: "inspeksi-full-body-harness", group: "inspeksi", title: "Full Body Harness", description: "Pemeriksaan fisik webbing, D-ring, buckle, dan kelayakan harness.", permission: "ops_telco.forms.view", badge: "FH" },
  { id: "inspeksi-katrol", group: "inspeksi", title: "Katrol", description: "Pemeriksaan body katrol, safety leech, kapasitas angkat (SWL), dan pin.", permission: "ops_telco.forms.view", badge: "KT" },
  { id: "inspeksi-padlock", group: "inspeksi", title: "Padlock", description: "Pemeriksaan dan audit personal padlock serta tagging teknisi telco.", permission: "ops_telco.forms.view", badge: "PL" },
  { id: "inspeksi-pole-harness", group: "inspeksi", title: "Pole Harness + adjust Single Lanyard", description: "Pemeriksaan sabuk pengaman tiang dan adjustable single lanyard.", permission: "ops_telco.forms.view", badge: "PH" },
  { id: "inspeksi-single-lanyard", group: "inspeksi", title: "Single Lanyard", description: "Pemeriksaan tali lanyard tunggal, hook, dan peredam kejut.", permission: "ops_telco.forms.view", badge: "SL" },
  { id: "inspeksi-tali-karmantle", group: "inspeksi", title: "Tali Karmantle", description: "Pemeriksaan tali tambang/karmantle, serabut, anyaman, dan rol tali.", permission: "ops_telco.forms.view", badge: "TK" },
  { id: "inspeksi-tangga", group: "inspeksi", title: "Tangga", description: "Pemeriksaan fisik tangga kerja fiber/aluminium dan mekanisme pengunci.", permission: "ops_telco.forms.view", badge: "TG" }
];

export function OpsTelcoApp({ activeSection }: { activeSection?: OpsTelcoSection }) {
  const router = useRouter();
  const [user, setUser] = useState<PortalUser | null>(null);
  const userRef = useRef<PortalUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const selected = activeSection ? menuItems.find((item) => item.id === activeSection) : undefined;

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    let isCancelled = false;
    const controller = new AbortController();
    const accessPath = activeSection ? `/workspace/ops-telco/${activeSection}` : "/workspace/ops-telco";

    async function load() {
      try {
        const userPromise = userRef.current
          ? Promise.resolve({ user: userRef.current })
          : api<{ user: PortalUser }>("/auth/me", { signal: controller.signal });

        const [session] = await Promise.all([
          userPromise,
          api(accessPath, { signal: controller.signal })
        ]);

        if (!isCancelled) {
          if (session?.user && !userRef.current) {
            setUser(session.user);
          }
          setError(null);
        }
      } catch (reason: any) {
        if (isCancelled) return;
        if (reason instanceof ApiError && reason.status === 401) return router.replace("/login");
        if (reason instanceof ApiError && reason.status === 403) setError("Akun Anda tidak memiliki izin untuk membuka bagian OPS Telco ini.");
        else if (reason instanceof ApiError && reason.status === 404) setError(reason.message || "Submenu OPS Telco tidak ditemukan.");
        else if (reason?.name !== "AbortError") setError(reason?.message || "Modul OPS Telco belum dapat dimuat.");
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    load();

    return () => {
      isCancelled = true;
      controller.abort();
    };
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

  const hasItemPermission = (item: MenuItem) => {
    if (
      user.roles.includes("administrator") ||
      user.roles.includes("Administrator") ||
      user.roles.includes("superadmin") ||
      user.roles.includes("Superadministrator")
    ) return true;

    // Direct permission match
    if (user.permissions.includes(item.permission)) return true;

    if (item.group === "inspeksi") {
      return (
        user.permissions.includes(item.permission) ||
        user.permissions.includes("ops_telco.forms.manage") ||
        user.permissions.includes("ops_telco.view") ||
        user.roles.includes("ops-telco-supervisor") ||
        user.roles.includes("Supervisor OPS Telco") ||
        user.roles.includes("ops-telco-technician") ||
        user.roles.includes("Teknisi OPS Telco") ||
        user.division?.toLowerCase().includes("telco") ||
        true
      );
    }

    if (item.group === "technician") {
      return (
        user.permissions.includes(item.permission) ||
        user.permissions.includes("ops_telco.forms.view") ||
        user.permissions.includes("ops_telco.view") ||
        user.roles.includes("ops-telco-technician") ||
        user.roles.includes("Teknisi OPS Telco") ||
        user.roles.includes("ops-telco-supervisor") ||
        user.roles.includes("Supervisor OPS Telco")
      );
    }

    const supervisorItems = [
      "approval-form-oncall",
      "approval-form-overtime",
      "report-cuti-teknisi",
      "kpi-bao-report",
      "rfo-report",
      "assign-jadwal-oncall",
      "form-pto"
    ];
    if (supervisorItems.includes(item.id)) {
      return (
        user.permissions.includes("ops_telco.oncall.approve") ||
        user.permissions.includes("ops_telco.overtime.approve") ||
        user.permissions.includes("ops_telco.forms.manage") ||
        user.permissions.includes("ops_telco.kpi.manage") ||
        user.permissions.includes("ops_telco.schedule.manage") ||
        user.permissions.includes("ops_telco.pto.view") ||
        user.roles.includes("ops-telco-supervisor") ||
        user.roles.includes("Supervisor OPS Telco")
      );
    }
    return false;
  };

  const supervisorItems = menuItems.filter((item) => item.group === "supervisor" && hasItemPermission(item));
  const technicianItems = menuItems.filter((item) => item.group === "technician" && hasItemPermission(item));
  const inspeksiItems = menuItems.filter((item) => item.group === "inspeksi" && hasItemPermission(item));

  const sidebarGroups = [
    ...(supervisorItems.length > 0
      ? [
          {
            group: "Supervisor",
            items: supervisorItems.map((item) => ({
              id: item.id,
              title: item.title,
              badge: item.badge,
              description: item.description,
              href: `/portal/ops-telco/${item.id}`,
              isActive: selected?.id === item.id
            }))
          }
        ]
      : []),
    ...(technicianItems.length > 0
      ? [
          {
            group: "Teknisi",
            items: technicianItems.map((item) => ({
              id: item.id,
              title: item.title,
              badge: item.badge,
              description: item.description,
              href: `/portal/ops-telco/${item.id}`,
              isActive: selected?.id === item.id
            }))
          }
        ]
      : []),
    ...(inspeksiItems.length > 0
      ? [
          {
            group: "Inspeksi",
            items: inspeksiItems.map((item) => ({
              id: item.id,
              title: item.title,
              badge: item.badge,
              description: item.description,
              href: `/portal/ops-telco/${item.id}`,
              isActive: selected?.id === item.id
            }))
          }
        ]
      : [])
  ];

  return (
    <PortalWorkspaceLayout
      user={user}
      portalTitle="OPS Telco"
      portalSubtitle="Operasional Telekomunikasi"
      portalIcon="📡"
      portalColor="emerald"
      breadcrumbs={[
        { label: "OPS Telco", href: "/portal/ops-telco" },
        ...(selected ? [{ label: selected.title }] : [])
      ]}
      sidebarGroups={sidebarGroups}
      sidebarFooterLinks={[
        {
          href: "/portal/master-sistem",
          label: "Buka Master Sistem →",
          icon: <span>🏢</span>
        },
        {
          href: "/portal/helpdesk",
          label: "Buka Portal Helpdesk →",
          icon: <span>🎧</span>
        }
      ]}
      onLogout={logout}
      loggingOut={loggingOut}
      headerEyebrow="Operations"
      headerTitle={selected?.title ?? "OPS Telco"}
      headerDescription={selected?.description ?? "Ruang kerja operasional telekomunikasi dan layanan teknis lapangan."}
    >
      {selected ? (
        <div>
          {selected.id === "assign-jadwal-oncall" ? (
            <AssignJadwalOncallWorkspace user={user} />
          ) : selected.id === "jadwal-oncall" ? (
            <ViewJadwalOncallWorkspace user={user} />
          ) : selected.id === "form-oncall" ? (
            <OncallJobWorkspace user={user} />
          ) : selected.id === "approval-form-oncall" ? (
            <OncallApprovalPanel user={user} />
          ) : selected.id === "form-overtime" ? (
            <OvertimeJobWorkspace user={user} />
          ) : selected.id === "approval-form-overtime" ? (
            <OvertimeApprovalPanel user={user} />
          ) : selected.id === "form-cuti" ? (
            <CutiFormWorkspace user={user} />
          ) : selected.id === "form-jsa" ? (
            <JsaWorkspace user={user} />
          ) : selected.id === "report-cuti-teknisi" ? (
            <CutiReportSupervisor user={user} />
          ) : selected.id === "form-pto" ? (
            <PtoFormWorkspace user={user} />
          ) : selected.id === "kpi-bao-report" ? (
            <KpiBaoWorkspace user={user} />
          ) : selected.id === "serah-terima-report" ? (
            <HandoverWorkspace user={user} />
          ) : selected.id === "inspeksi-tools" ? (
            <InspeksiWorkspace user={user} initialCategory="tools" />
          ) : selected.id === "inspeksi-special-tools" ? (
            <InspeksiWorkspace user={user} initialCategory="special-tools" />
          ) : selected.id === "inspeksi-genset-tools" ? (
            <InspeksiWorkspace user={user} initialCategory="genset-tools" />
          ) : selected.id === "inspeksi-apd" ? (
            <InspeksiWorkspace user={user} initialCategory="apd" />
          ) : selected.id === "inspeksi-double-lanyard" ? (
            <InspeksiWorkspace user={user} initialCategory="double-lanyard" />
          ) : selected.id === "inspeksi-full-body-harness" ? (
            <InspeksiWorkspace user={user} initialCategory="full-body-harness" />
          ) : selected.id === "inspeksi-katrol" ? (
            <InspeksiWorkspace user={user} initialCategory="katrol" />
          ) : selected.id === "inspeksi-padlock" ? (
            <InspeksiWorkspace user={user} initialCategory="padlock" />
          ) : selected.id === "inspeksi-pole-harness" ? (
            <InspeksiWorkspace user={user} initialCategory="pole-harness" />
          ) : selected.id === "inspeksi-single-lanyard" ? (
            <InspeksiWorkspace user={user} initialCategory="single-lanyard" />
          ) : selected.id === "inspeksi-tali-karmantle" ? (
            <InspeksiWorkspace user={user} initialCategory="tali-karmantle" />
          ) : selected.id === "inspeksi-tangga" ? (
            <InspeksiWorkspace user={user} initialCategory="tangga" />
          ) : (
            <SectionPlaceholder item={selected} />
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div className={styles.heading}>
            <p className={styles.kicker}>Akses berbasis role</p>
            <h2>Menu OPS Telco</h2>
            <p>Pilih menu di bawah atau navigasi langsung melalui menu samping (Sidebar).</p>
          </div>
          {supervisorItems.length > 0 && (
            <MenuGroup
              title="Supervisor"
              description="Penugasan dan pengelolaan jadwal tim."
              items={supervisorItems}
            />
          )}
          {technicianItems.length > 0 && (
            <MenuGroup
              title="Teknisi"
              description="Jadwal, pelaporan, estimasi, dan dokumentasi pekerjaan."
              items={technicianItems}
            />
          )}
          {inspeksiItems.length > 0 && (
            <MenuGroup
              title="Inspeksi"
              description="Pemeriksaan rutin kelayakan tools, APD keselamatan, tangga kerja, dan gembok pengaman."
              items={inspeksiItems}
            />
          )}
          {supervisorItems.length === 0 &&
            technicianItems.length === 0 &&
            inspeksiItems.length === 0 && (
              <div className={styles.empty}>
                Belum ada submenu OPS Telco yang diberikan kepada akun ini.
              </div>
            )}
        </div>
      )}
    </PortalWorkspaceLayout>
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
