"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { PortalHeader } from "@/components/layout/portal-header";
import { RealtimeStatus } from "@/components/realtime-status";
import { api, ApiError, type PortalUser } from "@/lib/api";
import styles from "./hr-app.module.css";
import { HrFormWorkspace } from "./hr-form-workspace";

export type HrSection = "oncall" | "overtime" | "cuti";

const sections: Array<{
  id: HrSection;
  title: string;
  description: string;
  href: string;
  tone: "blue" | "orange" | "green";
  icon: ReactNode;
}> = [
  {
    id: "oncall",
    title: "Form Oncall",
    description: "Pengajuan dan pencatatan jadwal tugas on-call karyawan.",
    href: "/portal/hr/oncall",
    tone: "blue",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 2v3M16 2v3M4 9h16M5 4h14a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
        <path d="M12 12v4l2 1" />
      </svg>
    )
  },
  {
    id: "overtime",
    title: "Form Overtime",
    description: "Pengajuan lembur beserta waktu dan kebutuhan pekerjaan.",
    href: "/portal/hr/overtime",
    tone: "orange",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2M18.5 5.5 20 4" />
      </svg>
    )
  },
  {
    id: "cuti",
    title: "Form Cuti",
    description: "Pengajuan cuti dan pemantauan status persetujuan karyawan.",
    href: "/portal/hr/cuti",
    tone: "green",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
        <circle cx="9.5" cy="7" r="4" />
        <path d="m16 11 2 2 4-4" />
      </svg>
    )
  }
];

export function HrApp({ activeSection }: { activeSection?: HrSection }) {
  const router = useRouter();
  const [user, setUser] = useState<PortalUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      api<{ user: PortalUser }>("/auth/me", { signal: controller.signal }),
      api("/workspace/hr", { signal: controller.signal })
    ])
      .then(([session]) => setUser(session.user))
      .catch((reason) => {
        if (reason instanceof ApiError && reason.status === 401) {
          router.replace("/login");
          return;
        }
        if (reason instanceof ApiError && reason.status === 403) {
          setError("Akun Anda belum memiliki izin untuk membuka modul HR.");
          return;
        }
        if (reason?.name !== "AbortError") {
          setError("Modul HR belum dapat dimuat. Periksa koneksi lalu coba lagi.");
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [router]);

  async function logout() {
    setLoggingOut(true);
    try {
      await api("/auth/logout", { method: "POST" });
      router.replace("/login");
    } finally {
      setLoggingOut(false);
    }
  }

  if (loading) {
    return (
      <main className="loading-page" aria-label="Memuat modul HR">
        <div className="loading-block" />
        <div className="loading-block short" />
      </main>
    );
  }

  if (error || !user) {
    return (
      <main className={styles.errorPage}>
        <div className={styles.errorCard}>
          <span className={styles.errorCode}>HR</span>
          <h1>Modul tidak dapat dibuka</h1>
          <p>{error ?? "Sesi pengguna tidak tersedia."}</p>
          <Link href="/portal" className={styles.primaryAction}>Kembali ke portal</Link>
        </div>
      </main>
    );
  }

  const selected = activeSection ? sections.find((section) => section.id === activeSection) : undefined;
  const title = selected?.title ?? "Menu HR";
  const description = selected?.description ?? "Kelola kebutuhan administrasi Human Resources dalam satu ruang kerja.";

  return (
    <div className={styles.shell}>
      <PortalHeader
        homeHref="/portal"
        homeLabel="MKN Site — kembali ke portal karyawan"
        name={user.name}
        role={user.roles.join(", ")}
        eyebrow="Human Resources"
        title={title}
        description={description}
        status={<RealtimeStatus loginPath="/login" tone="inverse" />}
        onLogout={logout}
        loggingOut={loggingOut}
        logoutLabel="Keluar akun"
      />

      <main className={styles.main} id="main">
        <div className={styles.sheet}>
          {selected ? (
            <section aria-labelledby="section-title">
              <Link href="/portal/hr" className={styles.backLink}>
                <span aria-hidden="true">←</span> Menu HR
              </Link>
              <div className={styles.formHeading}>
                <div className={`${styles.heroIcon} ${styles[selected.tone]}`}>{selected.icon}</div>
                <div>
                  <p className={styles.kicker}>Template resmi MKN</p>
                  <h2 id="section-title">{selected.title}</h2>
                  <p>{selected.description} Isian tersimpan dan hasil unduh memakai PDF asli.</p>
                </div>
              </div>
              <HrFormWorkspace type={selected.id} userName={user.name} />
            </section>
          ) : (
            <>
              <div className={styles.sectionHeader}>
                <div>
                  <Link href="/portal" className={styles.backLink}>
                    <span aria-hidden="true">←</span> Portal utama
                  </Link>
                  <p className={styles.kicker}>Layanan HR</p>
                  <h2>Pilih kebutuhan Anda</h2>
                  <p className={styles.sectionDescription}>Buka layanan HR yang ingin diajukan atau dikelola.</p>
                </div>
                <span className={styles.countBadge}>3 layanan</span>
              </div>

              <div className={styles.grid} role="list" aria-label="Submenu HR">
                {sections.map((section) => (
                  <Link key={section.id} href={section.href} className={styles.card} role="listitem">
                    <div className={`${styles.cardIcon} ${styles[section.tone]}`}>{section.icon}</div>
                    <div className={styles.cardContent}>
                      <span className={styles.cardStatus}>Tersedia</span>
                      <h3>{section.title}</h3>
                      <p>{section.description}</p>
                    </div>
                    <span className={styles.cardArrow} aria-hidden="true">→</span>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
