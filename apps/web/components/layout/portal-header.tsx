"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useRef, useState } from "react";
import mknLogo from "@/public/assets/Logo MKN.png";
import { Button } from "@/components/ui/button";
import styles from "./portal-header.module.css";

export type PortalHeaderProps = {
  homeHref: string;
  name: string;
  role: string;
  eyebrow: string;
  title: string;
  description: string;
  onLogout: () => void;
  loggingOut?: boolean;
};

export function PortalHeader({ homeHref, name, role, eyebrow, title, description, onLogout, loggingOut }: PortalHeaderProps) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  return (
    <header className={styles.header}>
      <div className={styles.top}>
        <Link href={homeHref} className={styles.brand} aria-label="MKN Site — beranda admin">
          <span className={styles.logo}><Image src={mknLogo} alt="Multi Kontrol Nusantara" priority /></span>
        </Link>
        <div className={styles.accountArea}>
          <div className={styles.account}
            onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
            onKeyDown={(event) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } }}>
            <button ref={trigger} type="button" className={styles.accountTrigger} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
              <span className={styles.avatar} aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
              <span className={styles.accountName}>{name}</span>
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
                  <span>{role}</span>
                </div>
                <Button variant="danger" onClick={onLogout} loading={loggingOut} loadingText="Keluar...">
                  Keluar admin
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className={styles.intro}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1>{title}</h1><p className={styles.description}>{description}</p>
      </div>
    </header>
  );
}
