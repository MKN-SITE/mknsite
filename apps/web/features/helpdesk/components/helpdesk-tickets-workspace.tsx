"use client";

import React, { useState } from "react";
import styles from "./helpdesk-app.module.css";

interface TicketItem {
  id: string;
  title: string;
  category: "Jaringan / Internet" | "Radio & Repeater" | "Hardware / Toolkit" | "Akun & Akses" | "Lainnya";
  requester: string;
  date: string;
  priority: "P1 - Kritis" | "P2 - Tinggi" | "P3 - Sedang" | "P4 - Rendah";
  status: "open" | "in_progress" | "resolved" | "closed";
  assignedTo?: string;
}

const INITIAL_TICKETS: TicketItem[] = [
  {
    id: "HD-2026-0042",
    title: "Gangguan koneksi link microwave Swarga Bara - D8 Tango",
    category: "Jaringan / Internet",
    requester: "Oneal L. P (Teknisi Lapangan)",
    date: "2026-09-18",
    priority: "P1 - Kritis",
    status: "in_progress",
    assignedTo: "Rahmansyah (Spv Telco)"
  },
  {
    id: "HD-2026-0041",
    title: "Permintaan penggantian padlock kunci shelter repeater Pinang",
    category: "Hardware / Toolkit",
    requester: "Januar (Teknisi)",
    date: "2026-09-17",
    priority: "P3 - Sedang",
    status: "resolved",
    assignedTo: "Logistik Telco"
  },
  {
    id: "HD-2026-0040",
    title: "Update frekuensi radio HT channel 8 crew Sangatta",
    category: "Radio & Repeater",
    requester: "Dery Wicaksono",
    date: "2026-09-16",
    priority: "P2 - Tinggi",
    status: "resolved",
    assignedTo: "Rigging Team"
  }
];

export function HelpdeskTicketsWorkspace() {
  const [tickets, setTickets] = useState<TicketItem[]>(INITIAL_TICKETS);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<TicketItem["category"]>("Jaringan / Internet");
  const [newPriority, setNewPriority] = useState<TicketItem["priority"]>("P2 - Tinggi");
  const [newRequester, setNewRequester] = useState("");

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newTicket: TicketItem = {
      id: `HD-2026-00${tickets.length + 43}`,
      title: newTitle.trim(),
      category: newCategory,
      priority: newPriority,
      requester: newRequester.trim() || "Teknisi Telco",
      date: new Date().toISOString().slice(0, 10),
      status: "open",
      assignedTo: "Helpdesk Duty"
    };

    setTickets([newTicket, ...tickets]);
    setNewTitle("");
    setNewRequester("");
    setShowModal(false);
  };

  const filteredTickets = tickets.filter((t) => {
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (
      searchTerm.trim() &&
      !t.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !t.id.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !t.requester.toLowerCase().includes(searchTerm.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const getStatusBadge = (status: TicketItem["status"]) => {
    switch (status) {
      case "open":
        return { label: "Terbuka (Open)", bg: "rgba(239, 68, 68, 0.2)", color: "#f87171" };
      case "in_progress":
        return { label: "Diproses (In Progress)", bg: "rgba(234, 179, 8, 0.2)", color: "#facc15" };
      case "resolved":
        return { label: "Selesai (Resolved)", bg: "rgba(34, 197, 94, 0.2)", color: "#4ade80" };
      case "closed":
        return { label: "Ditutup (Closed)", bg: "rgba(100, 116, 139, 0.2)", color: "#94a3b8" };
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>
            🎫 Tiket Layanan & Bantuan Operasional
          </h2>
          <p style={{ fontSize: "0.875rem", color: "#64748b", margin: "0.25rem 0 0 0" }}>
            Pencatatan kendala teknis, permintaan dukungan alat, dan permohonan bantuan sistem.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          style={{
            background: "#0284c7",
            color: "#ffffff",
            border: "none",
            padding: "0.6rem 1.15rem",
            borderRadius: "0.5rem",
            fontWeight: 600,
            fontSize: "0.875rem",
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(2, 132, 199, 0.25)"
          }}
        >
          ➕ Buat Tiket Baru
        </button>
      </div>

      {/* Filter Bar */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          alignItems: "center",
          flexWrap: "wrap",
          background: "#ffffff",
          padding: "0.85rem 1rem",
          borderRadius: "0.75rem",
          border: "1px solid #e2e8f0",
          boxShadow: "0 2px 10px rgba(0, 0, 0, 0.03)"
        }}
      >
        <input
          type="text"
          placeholder="Cari ID tiket, judul, atau nama pelapor..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            flex: 1,
            minWidth: "220px",
            background: "#ffffff",
            border: "1.5px solid #cbd5e1",
            padding: "0.55rem 0.85rem",
            borderRadius: "0.5rem",
            color: "#0f172a",
            fontSize: "0.85rem",
            outline: "none"
          }}
        />

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>Status:</span>
          {["all", "open", "in_progress", "resolved"].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setFilterStatus(st)}
              style={{
                padding: "0.35rem 0.75rem",
                borderRadius: "0.375rem",
                border: "1px solid",
                borderColor: filterStatus === st ? "#0284c7" : "#e2e8f0",
                background: filterStatus === st ? "#0284c7" : "#f8fafc",
                color: filterStatus === st ? "#ffffff" : "#475569",
                fontSize: "0.775rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease"
              }}
            >
              {st === "all" ? "Semua" : st === "open" ? "Terbuka" : st === "in_progress" ? "Diproses" : "Selesai"}
            </button>
          ))}
        </div>
      </div>

      {/* Tickets Table */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "0.875rem",
          overflow: "hidden",
          boxShadow: "0 2px 10px rgba(0, 0, 0, 0.03)"
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", color: "#1e293b" }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              <th style={{ padding: "0.85rem 1rem", textAlign: "left", color: "#475569", fontWeight: 700 }}>ID Tiket</th>
              <th style={{ padding: "0.85rem 1rem", textAlign: "left", color: "#475569", fontWeight: 700 }}>Perihal / Masalah</th>
              <th style={{ padding: "0.85rem 1rem", textAlign: "left", color: "#475569", fontWeight: 700 }}>Kategori</th>
              <th style={{ padding: "0.85rem 1rem", textAlign: "left", color: "#475569", fontWeight: 700 }}>Prioritas</th>
              <th style={{ padding: "0.85rem 1rem", textAlign: "left", color: "#475569", fontWeight: 700 }}>Pelapor</th>
              <th style={{ padding: "0.85rem 1rem", textAlign: "left", color: "#475569", fontWeight: 700 }}>Status</th>
              <th style={{ padding: "0.85rem 1rem", textAlign: "left", color: "#475569", fontWeight: 700 }}>PIC</th>
            </tr>
          </thead>
          <tbody>
            {filteredTickets.map((t) => {
              const badge = getStatusBadge(t.status);
              return (
                <tr key={t.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "0.85rem 1rem", fontFamily: "monospace", color: "#0284c7", fontWeight: 700 }}>
                    {t.id}
                  </td>
                  <td style={{ padding: "0.85rem 1rem", fontWeight: 600, color: "#0f172a" }}>
                    <div>{t.title}</div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "2px" }}>Tanggal: {t.date}</div>
                  </td>
                  <td style={{ padding: "0.85rem 1rem", color: "#475569" }}>{t.category}</td>
                  <td style={{ padding: "0.85rem 1rem" }}>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        color: t.priority.startsWith("P1") ? "#dc2626" : t.priority.startsWith("P2") ? "#d97706" : "#0284c7"
                      }}
                    >
                      {t.priority}
                    </span>
                  </td>
                  <td style={{ padding: "0.85rem 1rem", color: "#1e293b" }}>{t.requester}</td>
                  <td style={{ padding: "0.85rem 1rem" }}>
                    <span
                      style={{
                        padding: "0.25rem 0.6rem",
                        borderRadius: "999px",
                        fontSize: "0.725rem",
                        fontWeight: 700,
                        background: badge.bg,
                        color: badge.color
                      }}
                    >
                      {badge.label}
                    </span>
                  </td>
                  <td style={{ padding: "0.85rem 1rem", color: "#64748b" }}>{t.assignedTo || "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal Buat Tiket */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "1rem",
              padding: "1.75rem",
              width: "100%",
              maxWidth: "540px",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.15)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#0f172a", margin: "0 0 1rem 0" }}>
              ➕ Buat Tiket Layanan Baru
            </h3>
            <form onSubmit={handleCreateTicket} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.825rem", color: "#334155", fontWeight: 600, marginBottom: "0.35rem" }}>
                  Judul Permintaan / Kendala
                </label>
                <input
                  type="text"
                  required
                  placeholder="Deskripsikan kendala secara singkat..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.6rem",
                    borderRadius: "0.5rem",
                    border: "1.5px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#0f172a",
                    outline: "none"
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.825rem", color: "#334155", fontWeight: 600, marginBottom: "0.35rem" }}>
                    Kategori
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    style={{
                      width: "100%",
                      padding: "0.6rem",
                      borderRadius: "0.5rem",
                      border: "1.5px solid #cbd5e1",
                      background: "#ffffff",
                      color: "#0f172a",
                      outline: "none"
                    }}
                  >
                    <option value="Jaringan / Internet">Jaringan / Internet</option>
                    <option value="Radio & Repeater">Radio & Repeater</option>
                    <option value="Hardware / Toolkit">Hardware / Toolkit</option>
                    <option value="Akun & Akses">Akun & Akses</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.825rem", color: "#334155", fontWeight: 600, marginBottom: "0.35rem" }}>
                    Prioritas
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    style={{
                      width: "100%",
                      padding: "0.6rem",
                      borderRadius: "0.5rem",
                      border: "1.5px solid #cbd5e1",
                      background: "#ffffff",
                      color: "#0f172a",
                      outline: "none"
                    }}
                  >
                    <option value="P1 - Kritis">🔴 P1 - Kritis (Layanan Putus)</option>
                    <option value="P2 - Tinggi">🟡 P2 - Tinggi (Penurunan Kualitas)</option>
                    <option value="P3 - Sedang">🔵 P3 - Sedang (Kendala Parsial)</option>
                    <option value="P4 - Rendah">⚪ P4 - Rendah (Permintaan Info/Alat)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.825rem", color: "#334155", fontWeight: 600, marginBottom: "0.35rem" }}>
                  Nama Pelapor / Teknisi
                </label>
                <input
                  type="text"
                  placeholder="Nama pelapor..."
                  value={newRequester}
                  onChange={(e) => setNewRequester(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.6rem",
                    borderRadius: "0.5rem",
                    border: "1.5px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#0f172a",
                    outline: "none"
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #cbd5e1",
                    padding: "0.55rem 1rem",
                    borderRadius: "0.5rem",
                    color: "#334155",
                    cursor: "pointer",
                    fontWeight: 600
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  style={{
                    background: "#0284c7",
                    border: "none",
                    padding: "0.55rem 1.25rem",
                    borderRadius: "0.5rem",
                    color: "#ffffff",
                    fontWeight: 600,
                    cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(2, 132, 199, 0.25)"
                  }}
                >
                  Simpan Tiket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
