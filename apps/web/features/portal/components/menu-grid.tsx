"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import mknLogoImg from "@/public/assets/Logo MKN.png";
import { api, type PortalUser } from "@/lib/api";
import { RealtimeStatus } from "@/components/realtime-status";
import { PortalIcon } from "./portal-icons";
import styles from "./menu-grid.module.css";

export type PortalMenuDto = {
  id: number;
  title: string;
  icon: string | null;
  description: string | null;
  url: string | null;
  requiredPermission: string | null;
  sortOrder: number;
  isActive: number;
  badgeCount: number;
  badgeColor: string;
};

export type MenuGridProps = {
  user: PortalUser;
  onLogout: () => void;
};

export function MenuGrid({ user, onLogout }: MenuGridProps) {
  const [menus, setMenus] = useState<PortalMenuDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const supportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    api<{ data: PortalMenuDto[] }>("/menus")
      .then((res) => {
        if (mounted) {
          // Sort by sortOrder ASC
          const sorted = [...res.data].sort((a, b) => a.sortOrder - b.sortOrder);
          setMenus(sorted);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err?.message ?? "Gagal memuat daftar menu.");
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Close dropdown & support popover on outside click or Escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
      if (supportRef.current && !supportRef.current.contains(event.target as Node)) {
        setSupportOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDropdownOpen(false);
        setSupportOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const getBadgeClass = (color: string) => {
    switch (color) {
      case "blue":
        return styles.badgeBlue;
      case "red":
        return styles.badgeRed;
      case "green":
        return styles.badgeGreen;
      case "orange":
      default:
        return styles.badgeOrange;
    }
  };

  const firstName = user.name.split(" ")[0] ?? user.name;
  const initial = user.name.charAt(0).toUpperCase();

  return (
    <div className={styles.portalShell}>
      {/* Header Gradient */}
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <Link href="/portal" className={styles.brandWrap}>
            <div className={styles.brandLogo}>
              <Image
                src={mknLogoImg}
                alt="Logo PT Multi Kontrol Nusantara"
                width={51}
                height={38}
                className={styles.brandLogoImg}
                priority
              />
            </div>
            <div className={styles.brandText}>
              <span className={styles.brandName}>MKN Site</span>
              <span className={styles.brandSub}>PT Multi Kontrol Nusantara</span>
            </div>
          </Link>

          <div className={styles.headerRight} ref={dropdownRef}>
            <RealtimeStatus loginPath="/login" />

            <button
              type="button"
              className={styles.userMenuTrigger}
              onClick={() => setDropdownOpen((prev) => !prev)}
              aria-expanded={dropdownOpen}
              aria-haspopup="true"
              aria-label="Menu profil pengguna"
            >
              <div className={styles.avatarCircle} aria-hidden="true">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className={styles.avatarImg} />
                ) : (
                  initial
                )}
              </div>
              <span className={styles.userName}>{user.name}</span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`${styles.chevronIcon} ${dropdownOpen ? styles.chevronOpen : ""}`}
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {dropdownOpen && (
              <div className={styles.userDropdown} role="menu">
                <div className={styles.userDropdownInfo}>
                  <strong className={styles.dropdownUserName}>{user.name}</strong>
                  {user.division && (
                    <span className={styles.dropdownUserDivision}>{user.division}</span>
                  )}
                  <span className={styles.dropdownUserRoles}>{user.roles.join(", ")}</span>
                </div>
                <button
                  type="button"
                  className={styles.logoutBtn}
                  onClick={() => {
                    setDropdownOpen(false);
                    onLogout();
                  }}
                  role="menuitem"
                >
                  Keluar Akun
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Welcome Banner */}
        <div className={styles.welcomeBanner}>
          <h1 className={styles.welcomeTitle}>Welcome, {firstName}</h1>
          <p className={styles.welcomeSubtitle}>
            Empower your business with real-time insights.
          </p>
        </div>
      </header>

      {/* Main Content Area */}
      <main className={styles.mainContent} id="main">
        <div className={styles.canvasSheet}>
          {loading && (
            <div className={styles.grid} aria-label="Memuat menu portal...">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
                <div key={item} className={styles.skeletonCard} data-skeleton="true">
                  <div className={styles.skeletonIcon} />
                  <div className={styles.skeletonText} />
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <div className={styles.emptyCard} role="alert">
              <h2 className={styles.emptyTitle}>Gagal memuat menu</h2>
              <p className={styles.emptyDesc}>{error}</p>
            </div>
          )}

          {!loading && !error && menus.length === 0 && (
            <div className={styles.emptyCard}>
              <h2 className={styles.emptyTitle}>Belum ada modul yang tersedia</h2>
              <p className={styles.emptyDesc}>
                Akun Anda belum memiliki akses ke modul bisnis aktif. Hubungi administrator sistem.
              </p>
            </div>
          )}

          {!loading && !error && menus.length > 0 && (
            <div className={styles.grid} role="list" aria-label="Daftar Modul Karyawan">
              {menus.map((menu) => {
                const hasBadge = menu.badgeCount > 0;
                const targetUrl = menu.url || "/portal";

                return (
                  <Link
                    key={menu.id}
                    href={targetUrl}
                    className={styles.card}
                    role="listitem"
                    aria-label={`${menu.title}${hasBadge ? `, ${menu.badgeCount} notifikasi` : ""}`}
                  >
                    <div className={styles.iconWrapper}>
                      <PortalIcon name={menu.icon} size={64} />
                    </div>

                    <div className={styles.titleRow}>
                      <span
                        className={`${styles.cardLabel} ${hasBadge ? styles.cardLabelOrange : ""}`}
                      >
                        {menu.title}
                      </span>
                      {hasBadge && (
                        <span
                          className={`${styles.badgePill} ${getBadgeClass(menu.badgeColor)}`}
                          aria-hidden="true"
                        >
                          {menu.badgeCount}
                        </span>
                      )}
                    </div>

                    {menu.description && (
                      <span className={styles.cardDesc}>{menu.description}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Floating Action Button (FAB Support & Helpdesk) */}
      <div className={styles.fabContainer} ref={supportRef}>
        {supportOpen && (
          <div
            className={styles.supportPopover}
            role="dialog"
            aria-labelledby="support-title"
            aria-modal="false"
          >
            <div className={styles.supportHeader}>
              <div className={styles.supportHeaderTitle}>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#0284c7"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <span id="support-title">Pusat Bantuan & Layanan IT</span>
              </div>
              <button
                type="button"
                className={styles.supportCloseBtn}
                onClick={() => setSupportOpen(false)}
                aria-label="Tutup pusat bantuan"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <p className={styles.supportDesc}>
              Mengalami kendala login, otorisasi modul, atau akses operasional? Tim IT Helpdesk MKN siap membantu.
            </p>
            <div className={styles.supportMeta}>
              <div className={styles.supportMetaItem}>
                <span className={styles.supportMetaLabel}>Email Helpdesk</span>
                <a href="mailto:helpdesk@mknsite.online" className={styles.supportMetaValue}>
                  helpdesk@mknsite.online
                </a>
              </div>
              <div className={styles.supportMetaItem}>
                <span className={styles.supportMetaLabel}>Ekstensi</span>
                <span className={styles.supportMetaValue}>Ext. 1010 / 1012</span>
              </div>
              <div className={styles.supportMetaItem}>
                <span className={styles.supportMetaLabel}>Jam Layanan</span>
                <span className={styles.supportMetaValue}>Senin – Jumat (08:00 – 17:00)</span>
              </div>
            </div>
            <a
              href="mailto:helpdesk@mknsite.online?subject=Permintaan%20Bantuan%20MKN%20Site"
              className={styles.supportActionBtn}
            >
              Kirim Tiket Bantuan
            </a>
          </div>
        )}

        <button
          type="button"
          className={styles.fabButton}
          onClick={() => setSupportOpen((prev) => !prev)}
          aria-expanded={supportOpen}
          aria-label="Pusat Bantuan & IT Support"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
