"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { SearchBar } from "@/components/ui/search-bar";
import { connectRealtime } from "@/lib/sse";
import { getAvatarUrl, type PortalUser } from "@/lib/api";
import { fetchDivisionMembers, type DivisionSummaryDto } from "../hooks/use-divisions";
import type { UserSummaryDto } from "../hooks/use-users";
import { UserDetailModal } from "./user-detail-modal";
import styles from "./division-members-modal.module.css";

export type DivisionMembersModalProps = {
  open: boolean;
  division: DivisionSummaryDto | null;
  currentAdmin?: PortalUser | null;
  onClose: () => void;
  onUserUpdated?: () => void;
};

export function DivisionMembersModal({
  open,
  division,
  currentAdmin,
  onClose,
  onUserUpdated
}: DivisionMembersModalProps) {
  const [members, setMembers] = useState<UserSummaryDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserSummaryDto | null>(null);

  const divisionId = division?.id;

  const loadMembers = useCallback(async () => {
    if (!divisionId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetchDivisionMembers(divisionId);
      setMembers(res.data);
    } catch (err: any) {
      setError(err?.message ?? "Gagal memuat anggota divisi.");
    } finally {
      setLoading(false);
    }
  }, [divisionId]);

  useEffect(() => {
    if (open && divisionId) {
      setSearch("");
      loadMembers();
    } else {
      setMembers([]);
      setError(null);
    }
  }, [open, divisionId, loadMembers]);

  // Realtime subscription: perbarui data saat ada perubahan pengguna admin
  useEffect(() => {
    if (!open || !divisionId) return;

    const disconnect = connectRealtime("admin", {
      onAdminUsersUpdated: () => {
        loadMembers();
      }
    });

    return () => {
      disconnect();
    };
  }, [open, divisionId, loadMembers]);

  const query = search.trim().toLowerCase();
  const filteredMembers = useMemo(() => {
    if (!query) return members;
    return members.filter((m) => {
      const nameMatch = m.name.toLowerCase().includes(query);
      const emailMatch = m.email.toLowerCase().includes(query);
      const roleMatch = m.roles.some((r) => r.name.toLowerCase().includes(query));
      return nameMatch || emailMatch || roleMatch;
    });
  }, [members, query]);

  function handleUserUpdated() {
    loadMembers();
    onUserUpdated?.();
  }

  function formatLoginDate(isoString?: string | null) {
    if (!isoString) return "Belum pernah login";
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return isoString;
      return `Login: ${date.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      })}`;
    } catch {
      return isoString;
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={`Anggota Divisi — ${division?.name ?? ""}`}
        size="lg"
        footer={
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            <span style={{ fontSize: "12px", color: "var(--ink-soft, #617384)" }}>
              {members.length} anggota terdaftar di divisi ini
            </span>
            <Button variant="secondary" size="md" onClick={onClose}>
              Tutup
            </Button>
          </div>
        }
      >
        <div className={styles.container}>
          {division && (
            <div className={styles.divisionHeader}>
              <div className={styles.divisionHeaderTop}>
                <h4 className={styles.divisionTitle}>{division.name}</h4>
                <Badge variant={members.length > 0 ? "accent" : "neutral"}>
                  {members.length} Anggota Terhubung
                </Badge>
              </div>
              <p className={styles.divisionDesc}>
                {division.description || "Tidak ada keterangan deskripsi divisi."}
              </p>
            </div>
          )}

          <div className={styles.toolbar}>
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Cari nama, email, atau role anggota..."
              className={styles.searchBar}
            />
            <Button
              variant="secondary"
              size="sm"
              loading={loading}
              loadingText="Memuat..."
              onClick={loadMembers}
            >
              Muat ulang
            </Button>
          </div>

          {error && (
            <div className={styles.errorBanner} role="alert">
              <span>{error}</span>
              <Button variant="secondary" size="sm" onClick={loadMembers}>
                Coba lagi
              </Button>
            </div>
          )}

          {loading && (
            <div className={styles.skeletonList} aria-label="Memuat anggota divisi...">
              {[1, 2, 3].map((i) => (
                <div key={i} className={styles.skeletonItem} />
              ))}
            </div>
          )}

          {!loading && !error && (
            <>
              {filteredMembers.length === 0 ? (
                <EmptyState
                  title={query ? "Tidak ada anggota yang cocok" : "Belum Ada Anggota Terhubung"}
                  description={
                    query
                      ? "Coba gunakan kata kunci nama atau email anggota yang lain."
                      : "Divisi ini belum memiliki karyawan atau administrator yang ditugaskan. Anda dapat menetapkan divisi pada saat membuat atau mengedit profil pengguna di menu Pengguna."
                  }
                />
              ) : (
                <div className={styles.memberList}>
                  {filteredMembers.map((member) => (
                    <article key={member.id} className={styles.memberCard}>
                      <div className={styles.memberInfo}>
                        <div className={styles.avatarWrapper}>
                          {member.avatarUrl ? (
                            <img
                              src={getAvatarUrl(member.avatarUrl)}
                              alt=""
                              className={styles.avatarImg}
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          ) : (
                            member.name.charAt(0).toUpperCase()
                          )}
                          <span
                            className={`${styles.onlineDot} ${
                              member.isOnline ? styles.online : styles.offline
                            }`}
                            title={member.isOnline ? "Online (Sesi Aktif)" : "Offline"}
                          />
                        </div>

                        <div className={styles.memberDetails}>
                          <div className={styles.memberNameRow}>
                            <span className={styles.memberName}>{member.name}</span>
                            <Badge variant={member.accountType === "admin" ? "accent" : "neutral"}>
                              {member.accountType === "admin" ? "Administrator" : "Karyawan"}
                            </Badge>
                            <Badge variant={member.isActive ? "success" : "danger"}>
                              {member.isActive ? "Aktif" : "Nonaktif"}
                            </Badge>
                          </div>

                          <span className={styles.memberEmail}>{member.email}</span>

                          <div className={styles.memberMeta}>
                            <span>{formatLoginDate(member.lastLoginAt)}</span>
                            {member.roles && member.roles.length > 0 && (
                              <div className={styles.rolesList}>
                                {member.roles.map((r) => (
                                  <Badge key={r.id} variant="neutral">
                                    {r.name}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className={styles.memberActions}>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setSelectedUser(member)}
                        >
                          Detail Pengguna
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </Modal>

      {/* Modal Detail Pengguna saat tombol Detail Pengguna diklik */}
      <UserDetailModal
        open={Boolean(selectedUser)}
        user={selectedUser}
        currentAdmin={currentAdmin}
        onClose={() => setSelectedUser(null)}
        onUpdated={handleUserUpdated}
      />
    </>
  );
}
