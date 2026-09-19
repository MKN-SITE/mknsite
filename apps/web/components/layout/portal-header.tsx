"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import mknLogo from "@/public/assets/mkn-logo-white-hd.png";
import { Button } from "@/components/ui/button";
import { getAvatarUrl } from "@/lib/api";

import styles from "./portal-header.module.css";

export type PortalHeaderProps = {
  homeHref: string;
  homeLabel?: string;
  status?: ReactNode;
  contextLabel?: string;
  name: string;
  role: string;
  eyebrow: string;
  title: string;
  description: string;
  avatarUrl?: string | null;
  division?: string | null;
  onLogout: () => void;
  loggingOut?: boolean;
  accountActions?: ReactNode;
  logoutLabel?: string;
};

export function PortalHeader({
  homeHref,
  homeLabel = "MKN Site",
  status,
  name,
  role,
  eyebrow,
  title,
  description,
  avatarUrl,
  division,
  onLogout,
  loggingOut,
  accountActions,
  logoutLabel = "Keluar Akun"
}: PortalHeaderProps) {
  const [open, setOpen] = useState(false);
  const [avatarImgError, setAvatarImgError] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const account = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !account.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  return (
    <header className={styles.header}>
      <div className={styles.top}>
        <Link href={homeHref} className={styles.brand} aria-label={homeLabel}>
          <span className={styles.brandLogo}>
            <Image
              src={mknLogo}
              alt="Multi Kontrol Nusantara - A Bakrie Company"
              width={200}
              height={148}
              priority
              className={styles.brandLogoImg}
            />
          </span>
          <span className={styles.brandDivider} aria-hidden="true" />
          <div className={styles.brandText}>
            <span className={styles.brandTitle}>MKN Site</span>
          </div>
        </Link>

        <div className={styles.accountArea}>
          {status}
          {accountActions}

          <div
            ref={account}
            className={styles.account}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setOpen(false);
                trigger.current?.focus();
              }
            }}
          >
            <button
              ref={trigger}
              type="button"
              className={styles.accountTrigger}
              aria-expanded={open}
              aria-label={`Menu akun ${name}`}
              aria-controls={panelId}
              onClick={() => setOpen(!open)}
            >
              <span className={styles.avatar} aria-hidden="true">
                {avatarUrl && !avatarImgError ? (
                  <img
                    src={getAvatarUrl(avatarUrl)}
                    alt=""
                    className={styles.avatarImg}
                    onError={() => setAvatarImgError(true)}
                  />
                ) : (
                  (name || "U").charAt(0).toUpperCase()
                )}
              </span>
              <span className={styles.accountName}>{name || "User"}</span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {open && (
              <div className={styles.dropdown} id={panelId}>
                <div className={styles.dropdownInfo}>
                  <strong>{name}</strong>
                  {division && <span className={styles.dropdownDivision}>{division}</span>}
                  <span>{role}</span>
                </div>
                <Button variant="danger" onClick={onLogout} loading={loggingOut} loadingText="Keluar...">
                  {logoutLabel}
                </Button>
              </div>
            )}
          </div>

          <button
            type="button"
            className={styles.quickSignoutBtn}
            onClick={onLogout}
            disabled={loggingOut}
            title="Keluar / Sign Out dari sistem"
            aria-label="Keluar / Sign Out"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={styles.quickSignoutIcon}
              aria-hidden="true"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span className={styles.quickSignoutText}>
              {loggingOut ? "Keluar..." : "Keluar"}
            </span>
          </button>
        </div>
      </div>

      <div className={styles.intro}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1>{title}</h1>
        <p className={styles.description}>{description}</p>
      </div>
    </header>
  );
}
