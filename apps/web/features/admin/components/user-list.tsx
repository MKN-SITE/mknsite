"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { SearchBar } from "@/components/ui/search-bar";
import { connectRealtime } from "@/lib/sse";
import { useUsers, type UserSummaryDto } from "../hooks/use-users";
import styles from "./user-list.module.css";

export function UserList() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [accountType, setAccountType] = useState<"all" | "employee" | "admin">("all");

  const { data, pagination, loading, error, refresh } = useUsers({
    page,
    search,
    status,
    accountType
  });

  // Realtime subscription: auto-refresh user list on admin.users.updated
  useEffect(() => {
    const disconnect = connectRealtime("admin", {
      onAdminUsersUpdated: () => {
        refresh();
      }
    });

    return () => {
      disconnect();
    };
  }, [refresh]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatus(e.target.value as "all" | "active" | "inactive");
    setPage(1);
  };

  const handleAccountTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setAccountType(e.target.value as "all" | "employee" | "admin");
    setPage(1);
  };

  const columns: Column<UserSummaryDto>[] = [
    {
      key: "name",
      header: "Nama",
      render: (row) => (
        <div className={styles.nameCell}>
          <span className={styles.avatar} aria-hidden="true">
            {row.name.charAt(0).toUpperCase()}
          </span>
          <span className={styles.userName}>{row.name}</span>
        </div>
      )
    },
    {
      key: "email",
      header: "Email",
      render: (row) => <span className={styles.emailCell}>{row.email}</span>
    },
    {
      key: "accountType",
      header: "Tipe Akun",
      render: (row) => (
        <span className={styles.accountType}>
          {row.accountType === "admin" ? "Administrator" : "Karyawan"}
        </span>
      )
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <Badge variant={row.isActive ? "success" : "danger"}>
          {row.isActive ? "Aktif" : "Nonaktif"}
        </Badge>
      )
    },
    {
      key: "roles",
      header: "Role",
      render: (row) => (
        <div className={styles.roleList}>
          {row.roles && row.roles.length > 0 ? (
            row.roles.map((role) => (
              <Badge key={role.id} variant="accent">
                {role.name}
              </Badge>
            ))
          ) : (
            <span className={styles.noRole}>-</span>
          )}
        </div>
      )
    },
    {
      key: "createdAt",
      header: "Dibuat",
      render: (row) => {
        try {
          const date = new Date(row.createdAt);
          return isNaN(date.getTime())
            ? row.createdAt
            : date.toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric"
              });
        } catch {
          return row.createdAt;
        }
      }
    },
    {
      key: "actions",
      header: "Aksi",
      render: (row) => (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            // eslint-disable-next-line no-console
            console.log("Detail user ID:", row.id);
          }}
        >
          Detail
        </Button>
      )
    }
  ];

  return (
    <section className={styles.userListSection} aria-label="Manajemen Pengguna">
      <div className={styles.headerRow}>
        <div>
          <h3 className={styles.sectionTitle}>Pengguna Portal</h3>
          <p className={styles.sectionSubtitle}>
            Kelola akun, status akses, dan role pengguna di sistem MKN.
            {!loading && (
              <span className={styles.totalBadge}> Total: {pagination.total}</span>
            )}
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          disabled
          title="Fitur tambah pengguna akan aktif pada tiket selanjutnya"
        >
          + Tambah Pengguna
        </Button>
      </div>

      <div className={styles.toolbar}>
        <SearchBar
          value={search}
          onChange={handleSearchChange}
          placeholder="Cari nama atau email..."
          className={styles.searchBar}
        />

        <div className={styles.filterGroup}>
          <select
            className={styles.filterSelect}
            value={status}
            onChange={handleStatusChange}
            aria-label="Filter status pengguna"
          >
            <option value="all">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>

          <select
            className={styles.filterSelect}
            value={accountType}
            onChange={handleAccountTypeChange}
            aria-label="Filter tipe akun"
          >
            <option value="all">Semua Tipe Akun</option>
            <option value="employee">Karyawan</option>
            <option value="admin">Administrator</option>
          </select>
        </div>
      </div>

      {error && (
        <div className={styles.errorBanner} role="alert">
          <span>{error}</span>
          <Button variant="secondary" size="sm" onClick={() => refresh()}>
            Coba lagi
          </Button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        emptyState={
          <EmptyState
            title="Tidak ada pengguna"
            description={
              search || status !== "all" || accountType !== "all"
                ? "Tidak ada data pengguna yang cocok dengan kriteria filter yang dipilih."
                : "Belum ada data pengguna yang terdaftar."
            }
          />
        }
      />

      {pagination.totalPages > 1 && (
        <div className={styles.paginationWrap}>
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={(newPage) => setPage(newPage)}
          />
        </div>
      )}
    </section>
  );
}
