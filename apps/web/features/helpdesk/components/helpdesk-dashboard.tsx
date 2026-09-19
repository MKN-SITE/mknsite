"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { api, type PortalUser } from "@/lib/api";
import styles from "./helpdesk-app.module.css";

interface HelpdeskDashboardProps {
  user: PortalUser;
  onNavigate: (section: "rfo" | "tickets" | "contacts") => void;
}

export function HelpdeskDashboard({ user, onNavigate }: HelpdeskDashboardProps) {
  const [rfoCount, setRfoCount] = useState<number>(0);

  useEffect(() => {
    api<{ success: boolean; data: any[] }>("/ops-telco/rfo")
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          setRfoCount(res.data.length);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Header Banner */}
      <div className={styles.hubHeader}>
        <div className={styles.hubKicker}>Pusat Layanan Terpadu</div>
        <h1 className={styles.hubTitle}>Portal Helpdesk Operasional</h1>
        <p className={styles.hubDesc}>
          Kelola laporan kendala jaringan, dokumen resmi <strong>Reason For Outage (RFO)</strong>, pemantauan tiket gangguan,
          serta eskalasi dukungan teknis lapangan secara terpusat.
        </p>
      </div>

      {/* Quick Action Navigation Cards */}
      <div className={styles.hubGrid}>
        {/* Card 1: Reason For Outage (RFO) */}
        <div className={styles.hubCard} onClick={() => onNavigate("rfo")} style={{ cursor: "pointer" }}>
          <div className={styles.hubCardTop}>
            <div className={styles.hubCardIconBox} style={{ background: "rgba(239, 68, 68, 0.15)", borderColor: "rgba(239, 68, 68, 0.3)" }}>
              <span style={{ fontSize: "1.35rem" }}>⚡</span>
            </div>
            <span className={styles.hubCardBadge} style={{ background: "rgba(239, 68, 68, 0.2)", color: "#f87171" }}>
              {rfoCount} Dokumen
            </span>
          </div>
          <div>
            <h3 className={styles.hubCardTitle}>Reason For Outage (RFO)</h3>
            <p className={styles.hubCardDesc}>
              Laporan investigasi resmi pemadaman/gangguan jaringan (SWG, Pinang, D8), analisis akar masalah, durasi downtime,
              dan ekspor PDF resmi bertanda tangan.
            </p>
          </div>
          <div className={styles.hubCardAction} style={{ color: "#f87171" }}>
            Buka Modul RFO →
          </div>
        </div>

        {/* Card 2: Helpdesk Tickets */}
        <div className={styles.hubCard} onClick={() => onNavigate("tickets")} style={{ cursor: "pointer" }}>
          <div className={styles.hubCardTop}>
            <div className={styles.hubCardIconBox} style={{ background: "rgba(2, 132, 199, 0.15)", borderColor: "rgba(2, 132, 199, 0.3)" }}>
              <span style={{ fontSize: "1.35rem" }}>🎫</span>
            </div>
            <span className={styles.hubCardBadge}>Aktif</span>
          </div>
          <div>
            <h3 className={styles.hubCardTitle}>Tiket Bantuan & Insiden</h3>
            <p className={styles.hubCardDesc}>
              Pencatatan kendala harian, permintaan penggantian peralatan, dukungan konfigurasi radio, dan monitoring penanganan insiden.
            </p>
          </div>
          <div className={styles.hubCardAction}>
            Lihat Daftar Tiket →
          </div>
        </div>

        {/* Card 3: Escalation Contacts */}
        <div className={styles.hubCard} onClick={() => onNavigate("contacts")} style={{ cursor: "pointer" }}>
          <div className={styles.hubCardTop}>
            <div className={styles.hubCardIconBox} style={{ background: "rgba(16, 185, 129, 0.15)", borderColor: "rgba(16, 185, 129, 0.3)" }}>
              <span style={{ fontSize: "1.35rem" }}>📞</span>
            </div>
            <span className={styles.hubCardBadge} style={{ background: "rgba(16, 185, 129, 0.2)", color: "#4ade80" }}>
              24/7 Siaga
            </span>
          </div>
          <div>
            <h3 className={styles.hubCardTitle}>Kontak & Jalur Eskalasi</h3>
            <p className={styles.hubCardDesc}>
              Informasi hotline darurat, PIC supervisor oncall, jadwal radio dispatch, dan matriks eskalasi penanganan masalah telco & IT.
            </p>
          </div>
          <div className={styles.hubCardAction} style={{ color: "#4ade80" }}>
            Buka Jalur Kontak →
          </div>
        </div>
      </div>

      {/* Operational Highlights Section */}
      <div
        style={{
          background: "rgba(30, 41, 59, 0.35)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "1rem",
          padding: "1.5rem"
        }}
      >
        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#ffffff", margin: "0 0 1rem 0" }}>
          ℹ️ Petunjuk Alur Penanganan Insiden (SOP RFO & Helpdesk)
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.25rem" }}>
          <div style={{ background: "rgba(15, 23, 42, 0.5)", padding: "1rem", borderRadius: "0.5rem", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
            <div style={{ fontWeight: 700, color: "#38bdf8", marginBottom: "0.25rem" }}>1. Deteksi & Log Insiden</div>
            <p style={{ fontSize: "0.825rem", color: "#94a3b8", margin: 0 }}>
              Catat waktu mulai padam (Start Time), site terdampak, dan informasi awal ke Helpdesk.
            </p>
          </div>
          <div style={{ background: "rgba(15, 23, 42, 0.5)", padding: "1rem", borderRadius: "0.5rem", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
            <div style={{ fontWeight: 700, color: "#facc15", marginBottom: "0.25rem" }}>2. Dispatch Teknisi Oncall</div>
            <p style={{ fontSize: "0.825rem", color: "#94a3b8", margin: 0 }}>
              Koordinasikan dengan personil yang bertugas sesuai jadwal oncall telco untuk investigasi fisik di lapangan.
            </p>
          </div>
          <div style={{ background: "rgba(15, 23, 42, 0.5)", padding: "1rem", borderRadius: "0.5rem", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
            <div style={{ fontWeight: 700, color: "#4ade80", marginBottom: "0.25rem" }}>3. Normalisasi & Terbitkan RFO</div>
            <p style={{ fontSize: "0.825rem", color: "#94a3b8", margin: 0 }}>
              Setelah link pulih (End Time), buat laporan RFO, isikan root cause, impact, dan unduh dokumen PDF bertanda tangan.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
