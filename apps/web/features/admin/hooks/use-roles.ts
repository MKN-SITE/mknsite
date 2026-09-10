import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

export type RoleSummaryDto = {
  id: number;
  name: string;
  slug: string;
  permissions: string[];
};

export type RoleListResponseDto = {
  data: RoleSummaryDto[];
};

let cachedRoles: RoleSummaryDto[] | null = null;
let inFlightRequest: Promise<RoleSummaryDto[]> | null = null;

export function useRoles() {
  const [roles, setRoles] = useState<RoleSummaryDto[]>(() => cachedRoles ?? []);
  const [loading, setLoading] = useState<boolean>(() => cachedRoles === null);
  const [error, setError] = useState<string | null>(null);

  const fetchRoles = useCallback(async (force = false) => {
    if (!force && cachedRoles !== null) {
      setRoles(cachedRoles);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (!inFlightRequest || force) {
        inFlightRequest = api<RoleListResponseDto>("/admin/roles")
          .then((res) => {
            cachedRoles = res.data;
            inFlightRequest = null;
            return res.data;
          })
          .catch((err) => {
            inFlightRequest = null;
            throw err;
          });
      }

      const data = await inFlightRequest;
      setRoles(data);
    } catch (err: any) {
      setError(err?.message ?? "Gagal memuat daftar role.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  return {
    roles,
    loading,
    error,
    refresh: () => fetchRoles(true)
  };
}
