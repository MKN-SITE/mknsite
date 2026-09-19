"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalWorkspaceLayout } from "@/components/layout/portal-workspace-layout";
import { api, ApiError, type PortalUser } from "@/lib/api";
import { RfoWorkspace } from "@/features/ops-telco/forms/rfo-workspace";
import { HelpdeskDashboard } from "./helpdesk-dashboard";
import { HelpdeskTicketsWorkspace } from "./helpdesk-tickets-workspace";
import { HelpdeskContactsWorkspace } from "./helpdesk-contacts-workspace";
import styles from "./helpdesk-app.module.css";

export type HelpdeskSection = "dashboard" | "rfo" | "tickets" | "contacts";

interface MenuItem {
  id: HelpdeskSection;
  title: string;
  badge: string;
  description: string;
  icon: string;
}

const MENU_ITEMS: { group: string; items: MenuItem[] }[] = [
  {
    group: "Layanan & Gangguan",
    items: [
      {
        id: "rfo",
        title: "Reason For Outage (RFO)",
        badge: "RF",
        description: "Laporan investigasi resmi padamnya link/jaringan & generate PDF.",
        icon: "⚡"
      },
      {
        id: "tickets",
        title: "Tiket Gangguan / Insiden",
        badge: "TK",
        description: "Pencatatan dan pemantauan tiket layanan bantuan IT & Telco.",
        icon: "🎫"
      }
    ]
  },
  {
    group: "Monitoring & Informasi",
    items: [
      {
        id: "dashboard",
        title: "Ringkasan Helpdesk",
        badge: "DB",
        description: "Statistik tiket, SLA, dan metrik penanganan gangguan.",
        icon: "📊"
      },
      {
        id: "contacts",
        title: "Kontak & Eskalasi",
        badge: "ES",
        description: "Daftar teknisi oncall, hotline darurat, dan PIC sistem.",
        icon: "📞"
      }
    ]
  }
];

export function HelpdeskApp({ initialSection }: { initialSection?: HelpdeskSection }) {
  const router = useRouter();
  const [user, setUser] = useState<PortalUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [currentSection, setCurrentSection] = useState<HelpdeskSection>(initialSection || "dashboard");

  useEffect(() => {
    if (initialSection) {
      setCurrentSection(initialSection);
    }
  }, [initialSection]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadUser() {
      try {
        setLoading(true);
        setError(null);
        const res = await api<{ user: PortalUser }>("/auth/me", {
          signal: controller.signal
        });
        setUser(res.user);
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "Gagal memuat profil pengguna.");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadUser();

    return () => {
      controller.abort();
    };
  }, [router]);

  async function handleLogout() {
    try {
      setLoggingOut(true);
      await api("/auth/logout", { method: "POST" });
      router.replace("/login");
    } catch {
      router.replace("/login");
    } finally {
      setLoggingOut(false);
    }
  }

  const navigateTo = (section: HelpdeskSection) => {
    setCurrentSection(section);
    // Update URL shallowly or use router push
    if (section === "rfo") {
      router.push("/portal/helpdesk/rfo");
    } else if (section === "tickets") {
      router.push("/portal/helpdesk/tickets");
    } else {
      router.push("/portal/helpdesk");
    }
  };

  if (loading) {
    return (
      <main className="loading-page">
        <div className="loading-block" />
        <div className="loading-block short" />
      </main>
    );
  }

  if (error || !user) {
    return (
      <main className="portal-error-page">
        <div className="portal-error-card">
          <h1>Gagal Memuat Portal Helpdesk</h1>
          <p>{error ?? "Pengguna tidak terautentikasi."}</p>
          <div className="portal-error-actions">
            <Link href="/portal" className="portal-btn">
              Kembali ke Portal Hub
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <PortalWorkspaceLayout
      user={user}
      portalTitle="Portal Helpdesk"
      portalSubtitle="IT & Operations Support"
      portalIcon="🎧"
      portalColor="sky"
      breadcrumbs={[
        { label: "Helpdesk", href: "/portal/helpdesk" },
        ...(currentSection !== "dashboard"
          ? [
              {
                label:
                  currentSection === "rfo"
                    ? "Reason For Outage (RFO)"
                    : currentSection === "tickets"
                    ? "Tiket Gangguan"
                    : "Kontak & Eskalasi"
              }
            ]
          : [])
      ]}
      sidebarGroups={MENU_ITEMS.map((group) => ({
        group: group.group,
        items: group.items.map((item) => ({
          id: item.id,
          title: item.title,
          badge: item.badge,
          description: item.description,
          isActive: currentSection === item.id,
          onClick: () => navigateTo(item.id)
        }))
      }))}
      sidebarFooterLinks={[
        {
          href: "/portal/ops-telco",
          label: "Buka Portal OPS Telco →",
          icon: <span>📡</span>
        }
      ]}
      onLogout={handleLogout}
      loggingOut={loggingOut}
      headerEyebrow="Helpdesk & Support"
      headerTitle={
        currentSection === "rfo"
          ? "Reason For Outage (RFO)"
          : currentSection === "tickets"
          ? "Tiket Gangguan"
          : currentSection === "contacts"
          ? "Kontak & Eskalasi"
          : "Portal Helpdesk"
      }
      headerDescription={
        currentSection === "rfo"
          ? "Laporan resmi pemadaman/gangguan link, investigasi root cause, dan ekspor PDF."
          : currentSection === "tickets"
          ? "Pusat pelaporan dan tracking tiket bantuan IT & Telco operasional."
          : currentSection === "contacts"
          ? "Informasi nomor hotline, radio dispatch, dan PIC eskalasi darurat."
          : "Pusat layanan bantuan IT, tiket kendala operasional, dan laporan outage jaringan."
      }
    >
      {currentSection === "rfo" ? (
        <RfoWorkspace user={user} />
      ) : currentSection === "tickets" ? (
        <HelpdeskTicketsWorkspace />
      ) : currentSection === "contacts" ? (
        <HelpdeskContactsWorkspace />
      ) : (
        <HelpdeskDashboard
          user={user}
          onNavigate={(sec) => navigateTo(sec)}
        />
      )}
    </PortalWorkspaceLayout>
  );
}
