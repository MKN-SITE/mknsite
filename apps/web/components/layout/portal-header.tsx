"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useRef, useState, type ReactNode } from "react";
import mknLogo from "@/public/assets/mkn-logo.webp";
import { Button } from "@/components/ui/button";
import styles from "./portal-header.module.css";

export type PortalHeaderProps = {
  homeHref: string;
  name: string;
  role: string;
  eyebrow: string;
  title: string;
  description: string;
  status?: ReactNode;
  onLogout: () => void;
  loggingOut?: boolean;
};

export function PortalHeader({ homeHref, name, role, eyebrow, title, description, status, onLogout, loggingOut }: PortalHeaderProps) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  return (
    <header className={styles.header}>
      <div className={styles.top}>
        <Link href={homeHref} className={styles.brand} aria-label="MKN Site — beranda admin">
          <span className={styles.logo}><Image src={mknLogo} alt="" width={34} height={34} priority /></span>
          <span><strong>MKN Site</strong><small>PT Multi Kontrol Nusantara</small></span>
        </Link>
        <div className={styles.accountArea}>
          <span className={styles.status}>{status}</span>
          <div className={styles.account}
            onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
            onKeyDown={(event) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } }}>
            <button ref={trigger} type="button" className={styles.accountTrigger} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
              <span className={styles.avatar} aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
              <span className={styles.accountName}>{name}</span><span aria-hidden="true">⌄</span>
            </button>
            {open && <div className={styles.dropdown} id={panelId}>
              <strong>{name}</strong><span>{role}</span>
              <Button variant="danger" onClick={onLogout} loading={loggingOut} loadingText="Keluar...">Keluar admin</Button>
            </div>}
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
