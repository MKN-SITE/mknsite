import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { connectRealtime } from "@/lib/sse";

export type RolePermissionDetailDto = {
  id: number;
  name: string;
  slug: string;
};

export type RoleUserRefDto = {
  id: number;
  name: string;
  email: string;
};

export type RoleSummaryDto = {
  id: number;
  name: string;
  slug: string;
  permissions: string[];
  permissionDetails?: RolePermissionDetailDto[];
  permissionIds: number[];
  userCount: number;
  users?: RoleUserRefDto[];
  isSystem: boolean;
};

export type RoleListResponseDto = {
  data: RoleSummaryDto[];
};

let cachedRoles: RoleSummaryDto[] | null = null;
let inFlightRequest: Promise<RoleSummaryDto[]> | null = null;

export function clearRoleCache() {
  cachedRoles = null;
  inFlightRequest = null;
}

export function useRoles() {
  const [roles, setRoles] = useState<RoleSummaryDto[]>(() => cachedRoles ?? []);
  const [loading, setLoading] = useState<boolean>(() => cachedRoles === null);
  const [error, setError] = useState<string | null>(null);

  const fetchRoles = useCallback(async (force = false) => {
    if (cachedRoles === null || force) {
      if (!cachedRoles) {
        setLoading(true);
      }
    }
    setError(null);

    try {
      if (!inFlightRequest || force) {
        inFlightRequest = api<RoleListResponseDto>("/admin/rbac/roles")
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
    // Always fetch fresh data on mount (revalidate in background)
    void fetchRoles(true);

    // Realtime live update: listen to user changes and rbac changes
    const disconnect = connectRealtime("admin", {
      onAdminUsersUpdated: () => {
        clearRoleCache();
        void fetchRoles(true);
      },
      onAdminRbacUpdated: () => {
        clearRoleCache();
        void fetchRoles(true);
      }
    });

    return () => {
      disconnect();
    };
  }, [fetchRoles]);

  return {
    roles,
    loading,
    error,
    refresh: () => fetchRoles(true)
  };
}
