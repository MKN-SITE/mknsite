"use client";

import React from "react";
import styles from "./helpdesk-app.module.css";

interface ContactItem {
  unit: string;
  role: string;
  pic: string;
  contact: string;
  channel: string;
  coverage: string;
  status: "active" | "standby";
}

const CONTACTS: ContactItem[] = [
  {
    unit: "Telco Operations Sangatta",
    role: "Act. Supervisor Telco",
    pic: "Rahmansyah",
    contact: "+62 811-5800-997",
    channel: "WhatsApp / Call",
    coverage: "24/7 Escalation & Outage Approval",
    status: "active"
  },
  {
    unit: "Telco Field Crew",
    role: "Teknisi Oncall Site",
    pic: "Teknisi Oncall Roster",
    contact: "Sesuai Jadwal Oncall Harian",
    channel: "Radio HT Telco Ch-08 / WA Group",
    coverage: "Area Swarga Bara, Pinang, D8 Tango",
    status: "active"
  },
  {
    unit: "IT Infrastructure & Security",
    role: "System Administrator",
    pic: "IT NOC Team",
    contact: "noc@mknsite.online / Ext 4410",
    channel: "Ticket Portal & Email",
    coverage: "Server, Database, Auth & Network Core",
    status: "standby"
  },
  {
    unit: "Radio & Repeater Team",
    role: "Specialist Rigging & Repeater",
    pic: "MKN Rigging Crew",
    contact: "Ext 4415 / Repeater Swarga",
    channel: "Radio Dispatch Telco",
    coverage: "Tower, Antena Pointing, Solar/Genset Outage",
    status: "active"
  }
];

export function HelpdeskContactsWorkspace() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#ffffff", margin: 0 }}>
          📞 Pusat Kontak & Jalur Eskalasi Bantuan
        </h2>
        <p style={{ fontSize: "0.875rem", color: "#94a3b8", margin: "0.25rem 0 0 0" }}>
          Informasi nomor kontak darurat, eskalasi tiket gangguan telco, dan personel penanggung jawab.
        </p>
      </div>

      <div
        style={{
          background: "rgba(30, 41, 59, 0.4)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "0.875rem",
          overflow: "hidden"
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", color: "#e2e8f0" }}>
          <thead>
            <tr style={{ background: "rgba(15, 23, 42, 0.7)", borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
              <th style={{ padding: "0.85rem 1rem", textAlign: "left", color: "#94a3b8", fontWeight: 600 }}>Unit / Divisi</th>
              <th style={{ padding: "0.85rem 1rem", textAlign: "left", color: "#94a3b8", fontWeight: 600 }}>Peran</th>
              <th style={{ padding: "0.85rem 1rem", textAlign: "left", color: "#94a3b8", fontWeight: 600 }}>PIC</th>
              <th style={{ padding: "0.85rem 1rem", textAlign: "left", color: "#94a3b8", fontWeight: 600 }}>Kontak / Hotline</th>
              <th style={{ padding: "0.85rem 1rem", textAlign: "left", color: "#94a3b8", fontWeight: 600 }}>Saluran Komunikasi</th>
              <th style={{ padding: "0.85rem 1rem", textAlign: "left", color: "#94a3b8", fontWeight: 600 }}>Cakupan / Jam</th>
            </tr>
          </thead>
          <tbody>
            {CONTACTS.map((c, idx) => (
              <tr key={idx} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                <td style={{ padding: "0.85rem 1rem", fontWeight: 600, color: "#f8fafc" }}>{c.unit}</td>
                <td style={{ padding: "0.85rem 1rem", color: "#38bdf8" }}>{c.role}</td>
                <td style={{ padding: "0.85rem 1rem" }}>{c.pic}</td>
                <td style={{ padding: "0.85rem 1rem", fontFamily: "monospace" }}>{c.contact}</td>
                <td style={{ padding: "0.85rem 1rem" }}>{c.channel}</td>
                <td style={{ padding: "0.85rem 1rem", color: "#94a3b8" }}>{c.coverage}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        style={{
          background: "rgba(2, 132, 199, 0.1)",
          border: "1px solid rgba(56, 189, 248, 0.25)",
          borderRadius: "0.75rem",
          padding: "1rem 1.25rem",
          fontSize: "0.85rem",
          color: "#bae6fd",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem"
        }}
      >
        <span style={{ fontSize: "1.25rem" }}>💡</span>
        <div>
          Untuk pelaporan insiden darurat atau pemadaman jaringan (outage) yang berdampak masif, segera terbitkan dokumen{" "}
          <strong>Reason For Outage (RFO)</strong> agar tim teknis lapangan dan manajemen dapat mengambil tindakan terkoordinasi.
        </div>
      </div>
    </div>
  );
}
