"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type {
  EligibleTechnician,
  OncallParticipant,
  OncallSignature
} from "./telco-form-types";

interface OncallParticipantsListProps {
  participants: OncallParticipant[];
  signatures: OncallSignature[];
  workflowVersion: number;
  isPicOrSpv: boolean;
  canManage: boolean;
  canEdit: boolean;
  eligibleTechnicians?: EligibleTechnician[];
  onAddParticipant?: (userId: number) => Promise<void>;
  onRemoveParticipant?: (userId: number) => Promise<void>;
  currentUserId?: number;
}

export function OncallParticipantsList({
  participants,
  signatures,
  workflowVersion,
  isPicOrSpv,
  canManage,
  canEdit,
  eligibleTechnicians = [],
  onAddParticipant,
  onRemoveParticipant,
  currentUserId
}: OncallParticipantsListProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Filter signatures to current workflowVersion
  const currentSignatures = signatures.filter(
    (s) => s.workflowVersion === workflowVersion && s.signerType === "technician"
  );
  const signedUserIds = new Set(currentSignatures.map((s) => s.signerUserId));

  const total = participants.length;

  // Available technicians not already assigned
  const assignedUserIds = new Set(participants.map((p) => p.userId));
  const availableTechnicians = useMemo(
    () => eligibleTechnicians.filter((t) => !assignedUserIds.has(t.id)),
    [eligibleTechnicians, assignedUserIds]
  );

  // Filter available technicians based on search query
  const filteredTechnicians = useMemo(() => {
    if (!searchQuery.trim()) return availableTechnicians;
    const q = searchQuery.toLowerCase();
    return availableTechnicians.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.kpcId && t.kpcId.toLowerCase().includes(q)) ||
        (t.division && t.division.toLowerCase().includes(q))
    );
  }, [availableTechnicians, searchQuery]);

  const handleAdd = async (userIdToAdd?: number) => {
    const targetId = userIdToAdd ?? (selectedUserId ? Number(selectedUserId) : null);
    if (!targetId || !onAddParticipant) return;
    setIsAdding(true);
    setActionError(null);
    try {
      await onAddParticipant(targetId);
      setSelectedUserId("");
      setSearchQuery("");
      setIsDropdownOpen(false);
    } catch (err: any) {
      setActionError(err.message || "Gagal menambahkan teknisi.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (userId: number, name: string) => {
    if (!onRemoveParticipant) return;
    if (!confirm(`Hapus ${name} dari daftar teknisi pekerjaan ini?`)) return;
    setActionError(null);
    try {
      await onRemoveParticipant(userId);
    } catch (err: any) {
      setActionError(err.message || "Gagal menghapus teknisi.");
    }
  };

  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #dbe6ed",
        borderRadius: "14px",
        padding: "18px",
        display: "flex",
        flexDirection: "column",
        gap: "14px"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#102f42" }}>
            Tim Teknisi Pelaksana
          </h4>
          <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#617d8e" }}>
            Daftar tim teknisi yang bertugas pada Job Oncall ini.
          </p>
        </div>
        <div
          style={{
            fontSize: "12px",
            fontWeight: 800,
            padding: "4px 10px",
            borderRadius: "20px",
            background: "#edf7fc",
            color: "#075d91",
            border: "1px solid #c4e2f3"
          }}
        >
          {total} Teknisi
        </div>
      </div>

      {actionError && (
        <div
          style={{
            padding: "8px 12px",
            borderRadius: "8px",
            background: "#fff2f2",
            border: "1px solid #ffd1d1",
            color: "#c33030",
            fontSize: "12px"
          }}
        >
          {actionError}
        </div>
      )}

      {/* Participant Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {participants.map((p) => {
          const isSigned = signedUserIds.has(p.userId);
          const sig = currentSignatures.find((s) => s.signerUserId === p.userId);
          const canDelete =
            (isPicOrSpv || canManage) &&
            canEdit &&
            p.participantRole !== "pic";

          return (
            <div
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                borderRadius: "10px",
                background: p.userId === currentUserId ? "#f4f9fd" : "#fbfdff",
                border: "1px solid #e1ecf2",
                gap: "12px"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    background: p.participantRole === "pic" ? "#075d91" : "#89a3b2",
                    color: "#fff",
                    display: "grid",
                    placeItems: "center",
                    fontSize: "12px",
                    fontWeight: 800,
                    flexShrink: 0
                  }}
                >
                  {p.nameSnapshot.charAt(0).toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: 750,
                        color: "#102f42",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                      }}
                    >
                      {p.nameSnapshot}
                    </span>
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 800,
                        padding: "2px 6px",
                        borderRadius: "6px",
                        textTransform: "uppercase",
                        background: p.participantRole === "pic" ? "#e0f2fe" : "#f1f5f9",
                        color: p.participantRole === "pic" ? "#0369a1" : "#475569"
                      }}
                    >
                      {p.participantRole === "pic" ? "PIC" : "Anggota"}
                    </span>
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748b" }}>
                    {p.kpcIdSnapshot ? `KPC: ${p.kpcIdSnapshot}` : "Tanpa KPC ID"}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
                {isSigned && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "#15803d",
                      background: "#f0fdf4",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      border: "1px solid #bbf7d0"
                    }}
                  >
                    ✓ TTD Digital
                  </span>
                )}

                {canDelete && (
                  <button
                    type="button"
                    onClick={() => handleRemove(p.userId, p.nameSnapshot)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#ef4444",
                      cursor: "pointer",
                      fontSize: "16px",
                      padding: "2px 6px",
                      borderRadius: "4px"
                    }}
                    title="Hapus teknisi ini"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Participant Selector with Search Mode */}
      {isPicOrSpv && canEdit && onAddParticipant && (
        <div
          ref={containerRef}
          style={{
            position: "relative",
            paddingTop: "12px",
            borderTop: "1px dashed #cbd5e1"
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}
            >
              <label
                style={{
                  fontSize: "12px",
                  fontWeight: 750,
                  color: "#334155",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                <span>➕ Tambah Teknisi ke Pekerjaan</span>
              </label>
              <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>
                {availableTechnicians.length} teknisi tersedia
              </span>
            </div>

            {availableTechnicians.length === 0 ? (
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: "8px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  fontSize: "12px",
                  color: "#64748b",
                  fontStyle: "italic"
                }}
              >
                Semua teknisi yang memenuhi syarat sudah ditambahkan ke tim ini.
              </div>
            ) : (
              <div style={{ position: "relative" }}>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <div style={{ position: "relative", flex: 1 }}>
                    <input
                      type="text"
                      value={searchQuery}
                      placeholder="🔍 Cari nama atau KPC teknisi..."
                      onFocus={() => setIsDropdownOpen(true)}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setIsDropdownOpen(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && filteredTechnicians.length > 0) {
                          e.preventDefault();
                          handleAdd(filteredTechnicians[0].id);
                        } else if (e.key === "Escape") {
                          setIsDropdownOpen(false);
                        }
                      }}
                      disabled={isAdding}
                      style={{
                        width: "100%",
                        padding: "8px 32px 8px 12px",
                        borderRadius: "8px",
                        border: isDropdownOpen ? "1.5px solid #0284c7" : "1px solid #cbd5e1",
                        background: "#ffffff",
                        fontSize: "12.5px",
                        color: "#0f172a",
                        outline: "none",
                        boxShadow: isDropdownOpen ? "0 0 0 3px rgba(2, 132, 199, 0.15)" : "none",
                        transition: "all 0.15s ease"
                      }}
                    />
                    {searchQuery ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery("");
                          setIsDropdownOpen(true);
                        }}
                        style={{
                          position: "absolute",
                          right: "8px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "none",
                          border: "none",
                          color: "#94a3b8",
                          cursor: "pointer",
                          fontSize: "13px",
                          padding: "2px 4px"
                        }}
                        title="Hapus pencarian"
                      >
                        ✕
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsDropdownOpen((prev) => !prev)}
                        style={{
                          position: "absolute",
                          right: "8px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "none",
                          border: "none",
                          color: "#64748b",
                          cursor: "pointer",
                          fontSize: "10px",
                          padding: "2px 4px"
                        }}
                        title={isDropdownOpen ? "Tutup daftar" : "Buka daftar"}
                      >
                        {isDropdownOpen ? "▲" : "▼"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Dropdown Hasil Pencarian */}
                {isDropdownOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 5px)",
                      left: 0,
                      right: 0,
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: "10px",
                      boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.15), 0 8px 10px -6px rgba(15, 23, 42, 0.1)",
                      maxHeight: "220px",
                      overflowY: "auto",
                      zIndex: 60,
                      padding: "6px"
                    }}
                  >
                    {filteredTechnicians.length === 0 ? (
                      <div
                        style={{
                          padding: "14px",
                          textAlign: "center",
                          color: "#64748b",
                          fontSize: "12px"
                        }}
                      >
                        <p style={{ margin: "0 0 2px", fontWeight: 700, color: "#334155" }}>
                          Tidak ditemukan teknisi
                        </p>
                        <p style={{ margin: 0, fontSize: "11px" }}>
                          Tidak ada teknisi bernama &ldquo;{searchQuery}&rdquo; yang belum ditugaskan.
                        </p>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        <div
                          style={{
                            padding: "4px 8px",
                            fontSize: "10px",
                            fontWeight: 750,
                            color: "#64748b",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            borderBottom: "1px solid #f1f5f9"
                          }}
                        >
                          Pilih teknisi untuk ditambahkan ({filteredTechnicians.length}):
                        </div>
                        {filteredTechnicians.map((t) => {
                          const onCuti = !!t.isOnCuti;
                          return (
                            <div
                              key={t.id}
                              onClick={() => {
                                if (onCuti) {
                                  setActionError(`Teknisi ${t.name} sedang dalam masa cuti pada tanggal pelaksanaan oncall ini dan tidak dapat ditugaskan.`);
                                  return;
                                }
                                if (!isAdding) handleAdd(t.id);
                              }}
                              title={onCuti ? "Teknisi sedang cuti pada tanggal pelaksanaan oncall ini" : undefined}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "7px 10px",
                                borderRadius: "7px",
                                cursor: onCuti ? "not-allowed" : isAdding ? "default" : "pointer",
                                transition: "background 0.15s ease",
                                background: onCuti ? "#fffbeb" : "transparent",
                                opacity: onCuti ? 0.75 : 1,
                                gap: "10px"
                              }}
                              onMouseEnter={(e) => {
                                if (!onCuti) e.currentTarget.style.background = "#f0f9ff";
                              }}
                              onMouseLeave={(e) => {
                                if (!onCuti) e.currentTarget.style.background = "transparent";
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                                <div
                                  style={{
                                    width: "26px",
                                    height: "26px",
                                    borderRadius: "50%",
                                    background: onCuti ? "#fef3c7" : "#e0f2fe",
                                    color: onCuti ? "#b45309" : "#0369a1",
                                    display: "grid",
                                    placeItems: "center",
                                    fontSize: "11px",
                                    fontWeight: 800,
                                    flexShrink: 0
                                  }}
                                >
                                  {t.name.charAt(0).toUpperCase()}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <div
                                    style={{
                                      fontSize: "12.5px",
                                      fontWeight: 750,
                                      color: onCuti ? "#92400e" : "#0f172a",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "6px"
                                    }}
                                  >
                                    <span>{t.name}</span>
                                    {onCuti && (
                                      <span
                                        style={{
                                          fontSize: "10px",
                                          fontWeight: 800,
                                          padding: "1px 5px",
                                          borderRadius: "4px",
                                          background: "#fde68a",
                                          color: "#78350f"
                                        }}
                                      >
                                        🌴 Cuti
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: "11px", color: onCuti ? "#b45309" : "#64748b" }}>
                                    {t.kpcId ? `KPC: ${t.kpcId}` : "Tanpa KPC ID"}
                                    {t.division && ` • ${t.division}`}
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                disabled={isAdding || onCuti}
                                style={{
                                  padding: "4px 10px",
                                  borderRadius: "6px",
                                  background: onCuti ? "#e2e8f0" : "#0284c7",
                                  color: onCuti ? "#94a3b8" : "#ffffff",
                                  border: "none",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  cursor: onCuti ? "not-allowed" : "pointer",
                                  flexShrink: 0
                                }}
                              >
                                {onCuti ? "🌴 Cuti" : "+ Tambah"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
