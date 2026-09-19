"use client";

import React, { useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { PortalHeader } from "@/components/layout/portal-header";
import { RealtimeStatus } from "@/components/realtime-status";
import { type PortalUser } from "@/lib/api";
import styles from "./portal-workspace-layout.module.css";

export interface PortalWorkspaceNavItem {
  id: string;
  title: string;
  badge: string;
  description?: string;
  tag?: string;
  href?: string;
  onClick?: () => void;
  isActive?: boolean;
  disabled?: boolean;
}

export interface PortalWorkspaceNavGroup {
  group: string;
  items: PortalWorkspaceNavItem[];
}

export interface PortalWorkspaceFooterLink {
  href: string;
  label: string;
  icon?: ReactNode;
  isPrimary?: boolean;
}

export interface PortalWorkspaceBreadcrumb {
  label: string;
  href?: string;
}

export interface PortalWorkspaceLayoutProps {
  user: PortalUser;
  portalTitle: string;
  portalSubtitle: string;
  portalIcon: ReactNode;
  portalColor?: "indigo" | "sky" | "ocean" | "emerald" | "amber" | "rose" | "violet" | "slate";
  sidebarGroups?: PortalWorkspaceNavGroup[];
  sidebarFooterLinks?: PortalWorkspaceFooterLink[];
  customSidebar?: ReactNode;
  breadcrumbs: PortalWorkspaceBreadcrumb[];
  actions?: ReactNode;
  onLogout: () => void;
  loggingOut?: boolean;
  headerEyebrow?: string;
  headerTitle?: string;
  headerDescription?: string;
  children: ReactNode;
}

export function PortalWorkspaceLayout({
  user,
  portalTitle,
  portalSubtitle,
  portalIcon,
  portalColor = "indigo",
  sidebarGroups,
  sidebarFooterLinks,
  customSidebar,
  breadcrumbs,
  actions,
  onLogout,
  loggingOut = false,
  headerEyebrow,
  headerTitle,
  headerDescription,
  children
}: PortalWorkspaceLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile drawer on resize
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth > 960) {
        setMobileOpen(false);
      }
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const themeClass =
    portalColor === "sky" || portalColor === "ocean"
      ? styles.themeSky
      : portalColor === "emerald"
      ? styles.themeEmerald
      : portalColor === "amber"
      ? styles.themeAmber
      : portalColor === "rose"
      ? styles.themeRose
      : portalColor === "violet"
      ? styles.themeViolet
      : portalColor === "slate"
      ? styles.themeSlate
      : styles.themeIndigo;

  return (
    <div className={`${styles.shell} ${themeClass}`}>
      {/* ── Top Portal Header (Standardized across all apps) ── */}
      <PortalHeader
        homeHref="/portal"
        contextLabel="KARYAWAN"
        avatarUrl={user.avatarUrl}
        division={user.division}
        homeLabel="MKN Site — kembali ke portal utama"
        name={user.name || "User"}
        role={user.roles?.join(", ") || "Karyawan"}
        eyebrow={headerEyebrow || portalSubtitle}
        title={headerTitle || portalTitle}
        description={headerDescription || ""}
        status={<RealtimeStatus loginPath="/login" tone="inverse" />}
        onLogout={onLogout}
        loggingOut={loggingOut}
        logoutLabel="Keluar akun"
      />

      <div className={styles.layout}>
        {/* Mobile Backdrop */}
        {mobileOpen && (
          <div
            className={styles.sidebarBackdrop}
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* ── Sidebar Navigation ── */}
        <aside
          className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ""}`}
          aria-label={`${portalTitle} Navigation`}
        >
          {/* Sidebar Header */}
          <div className={styles.sidebarHeader}>
            <div className={styles.portalIconBox}>{portalIcon}</div>
            <div>
              <h2 className={styles.portalTitle}>{portalTitle}</h2>
              <div className={styles.portalSub}>{portalSubtitle}</div>
            </div>
          </div>

          {/* Prominent Back to Portal Hub Navigation Button */}
          <Link
            href="/portal"
            className={styles.sidebarBackPortalBtn}
            title="Kembali langsung ke Portal Utama MKN Site"
            onClick={() => setMobileOpen(false)}
          >
            <span className={styles.sidebarBackIcon}>
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </span>
            <span>Kembali ke Portal</span>
          </Link>

          {/* Custom Sidebar Content (if provided) */}
          {customSidebar}

          {/* Sidebar Navigation Groups */}
          {sidebarGroups &&
            sidebarGroups.map((group, gIdx) => (
              <div key={gIdx} className={styles.navGroup}>
                <div className={styles.navGroupTitle}>{group.group}</div>
                {group.items.map((item) => {
                  const content = (
                    <>
                      <span className={styles.navBadge}>{item.badge}</span>
                      <span className={styles.navItemText}>{item.title}</span>
                      {item.tag && <span className={styles.navItemTag}>{item.tag}</span>}
                    </>
                  );

                  if (item.href) {
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        className={`${styles.navItem} ${item.isActive ? styles.navItemActive : ""}`}
                        onClick={() => setMobileOpen(false)}
                      >
                        {content}
                      </Link>
                    );
                  }

                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={item.disabled}
                      className={`${styles.navItem} ${item.isActive ? styles.navItemActive : ""}`}
                      onClick={() => {
                        if (item.onClick) item.onClick();
                        setMobileOpen(false);
                      }}
                      title={item.description}
                    >
                      {content}
                    </button>
                  );
                })}
              </div>
            ))}

          {/* Sidebar Footer Links */}
          <div className={styles.sidebarFooter}>
            <Link
              href="/portal"
              className={`${styles.sidebarFooterLink} ${styles.sidebarFooterLinkPrimary}`}
              title="Kembali ke Portal Utama MKN Site"
              onClick={() => setMobileOpen(false)}
            >
              <span>🏠</span>
              <span>Kembali ke Portal Utama</span>
            </Link>
            {sidebarFooterLinks?.map((fl, fIdx) => (
              <Link
                key={fIdx}
                href={fl.href}
                className={`${styles.sidebarFooterLink} ${
                  fl.isPrimary ? styles.sidebarFooterLinkPrimary : ""
                }`}
                onClick={() => setMobileOpen(false)}
              >
                {fl.icon && <span>{fl.icon}</span>}
                <span>{fl.label}</span>
              </Link>
            ))}
          </div>
        </aside>

        {/* ── Main Content Area ── */}
        <main className={styles.main} id="main-content">
          {/* Top Navigation & Breadcrumb Bar */}
          <div className={styles.navBar}>
            <div className={styles.navBarLeft}>
              {/* Mobile Sidebar Toggle Button */}
              <button
                type="button"
                className={styles.mobileMenuToggle}
                onClick={() => setMobileOpen((prev) => !prev)}
                aria-label="Buka navigasi menu samping"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>

              {/* Prominent Back to Portal Button in Header */}
              <Link
                href="/portal"
                className={styles.backHomeBtn}
                title="Kembali ke Portal Utama MKN Site"
              >
                <span className={styles.backIconBadge}>
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12 19 5 12 12 5" />
                  </svg>
                </span>
                <span className={styles.backHomeLabel}>Kembali ke Portal</span>
              </Link>

              {/* Breadcrumbs Trail */}
              <nav className={styles.topBreadcrumb} aria-label="Breadcrumb">
                <Link href="/portal" className={styles.breadcrumbLink}>
                  Portal Utama
                </Link>
                {breadcrumbs.map((bc, idx) => (
                  <React.Fragment key={idx}>
                    <span className={styles.breadcrumbDivider}>/</span>
                    {bc.href && idx < breadcrumbs.length - 1 ? (
                      <Link href={bc.href} className={styles.breadcrumbLink}>
                        {bc.label}
                      </Link>
                    ) : (
                      <span className={styles.breadcrumbCurrent}>{bc.label}</span>
                    )}
                  </React.Fragment>
                ))}
              </nav>
            </div>

            {actions && <div className={styles.navBarRight}>{actions}</div>}
          </div>

          {/* Workspace Content */}
          {children}
        </main>
      </div>
    </div>
  );
}
