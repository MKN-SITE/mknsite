"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalWorkspaceLayout } from "@/components/layout/portal-workspace-layout";
import { api, ApiError, type PortalUser } from "@/lib/api";
import { TowerListWorkspace } from "./tower-list-workspace";
import styles from "./master-sistem-app.module.css";

export type MasterSection = "towers" | "shelters" | "radios";

interface MenuItem {
  id: MasterSection;
  title: string;
  badge: string;
  description: string;
  isAvailable?: boolean;
}

const MENU_GROUPS: { group: string; items: MenuItem[] }[] = [
  {
    group: "Operasional",
    items: [
      {
        id: "towers",
        title: "List Tower (Menara Telco)",
        badge: "TW",
        description: "Daftar koordinat, ketinggian, dan foto dokumentasi menara telekomunikasi.",
        isAvailable: true
      },
      {
        id: "shelters",
        title: "Shelter & Repeater",
        badge: "SH",
        description: "Data titik shelter repeater, catu daya, dan genset operasional.",
        isAvailable: false
      }
    ]
  },
  {
    group: "Aset & Perangkat",
    items: [
      {
        id: "radios",
        title: "Master Radio & Frekuensi",
        badge: "RD",
        description: "Alokasi kanal frekuensi, perangkat radio dispatch, dan base station.",
        isAvailable: false
      }
    ]
  }
];

export function MasterSistemApp() {
  const router = useRouter();
  const [user, setUser] = useState<PortalUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [currentSection, setCurrentSection] = useState<MasterSection>("towers");

  useEffect(() => {
    const controller = new AbortController();

    async function loadUser() {
      try {
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
          <h1>Gagal Memuat Portal Master Sistem</h1>
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
      portalTitle="Master Sistem"
      portalSubtitle="Data Master & Aset Site"
      portalIcon="🏢"
      portalColor="indigo"
      breadcrumbs={[
        { label: "Master Sistem", href: "/portal/master-sistem" },
        { label: "Operasional" },
        { label: currentSection === "towers" ? "List Tower" : currentSection === "shelters" ? "Shelter & Repeater" : "Master Radio" }
      ]}
      sidebarGroups={MENU_GROUPS.map((group) => ({
        group: group.group,
        items: group.items.map((item) => ({
          id: item.id,
          title: item.title,
          badge: item.badge,
          description: item.description,
          isActive: currentSection === item.id,
          tag: !item.isAvailable ? "Segera" : undefined,
          onClick: () => {
            if (item.isAvailable) {
              setCurrentSection(item.id);
            } else {
              alert(`Modul "${item.title}" sedang dalam tahap pengembangan.`);
            }
          }
        }))
      }))}
      sidebarFooterLinks={[
        {
          href: "/portal/ops-telco",
          label: "Buka Portal OPS Telco →",
          icon: <span>📡</span>
        },
        {
          href: "/portal/helpdesk",
          label: "Buka Portal Helpdesk →",
          icon: <span>🎧</span>
        }
      ]}
      onLogout={handleLogout}
      loggingOut={loggingOut}
      headerEyebrow="Master Data & Aset Operasional"
      headerTitle="Portal Master Sistem"
      headerDescription="Pusat inventarisasi data master aset, infrastruktur site, menara telekomunikasi (Tower), dan profil operasional."
    >
      {/* Active Workspace */}
      {currentSection === "towers" && <TowerListWorkspace user={user} />}
    </PortalWorkspaceLayout>
  );
}
