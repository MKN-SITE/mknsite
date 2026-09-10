"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import mknLogo from "@/public/assets/mkn-logo.webp";
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
  const dropdownRef = useRef<HTMLDivElement>(null);

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
          setError(err?.message ?? "Gagal memuat daftar menu portal.");
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

  // Close user dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
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
                src={mknLogo}
                alt="Logo PT Multi Kontrol Nusantara"
                width={32}
                height={32}
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
                {initial}
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
            Empower your business with integrated operations and enterprise modules.
          </p>
        </div>
      </header>

      {/* Main Content Grid */}
      <main className={styles.mainContent} id="main">
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
                  {hasBadge && (
                    <div className={styles.badgeWrap} aria-hidden="true">
                      <span className={`${styles.badgePill} ${getBadgeClass(menu.badgeColor)}`}>
                        {menu.badgeCount}
                      </span>
                    </div>
                  )}

                  <div className={styles.iconWrapper}>
                    <PortalIcon name={menu.icon} size={64} />
                  </div>

                  <span
                    className={`${styles.cardLabel} ${hasBadge ? styles.cardLabelOrange : ""}`}
                  >
                    {menu.title}
                  </span>

                  {menu.description && (
                    <span className={styles.cardDesc}>{menu.description}</span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
