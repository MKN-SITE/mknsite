import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

export type UserRoleDto = {
  id: number;
  name: string;
  slug: string;
};

export type UserSummaryDto = {
  id: number;
  name: string;
  email: string;
  accountType: "employee" | "admin";
  isActive: boolean;
  roles: UserRoleDto[];
  createdAt: string;
  updatedAt: string;
};

export type PaginationMetaDto = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type UserListResponseDto = {
  data: UserSummaryDto[];
  pagination: PaginationMetaDto;
};

export type UseUsersOptions = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: "all" | "active" | "inactive";
  accountType?: "all" | "employee" | "admin";
};

export function useUsers({
  page = 1,
  pageSize = 20,
  search = "",
  status = "all",
  accountType = "all"
}: UseUsersOptions = {}) {
  const [data, setData] = useState<UserSummaryDto[]>([]);
  const [pagination, setPagination] = useState<PaginationMetaDto>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (search.trim()) params.set("search", search.trim());
      if (status !== "all") params.set("status", status);
      if (accountType !== "all") params.set("accountType", accountType);

      const response = await api<UserListResponseDto>(`/admin/users?${params.toString()}`);
      setData(response.data);
      setPagination(response.pagination);
    } catch (err: any) {
      setError(err?.message ?? "Gagal memuat daftar pengguna.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, status, accountType]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return {
    data,
    pagination,
    loading,
    error,
    refresh: fetchUsers
  };
}
