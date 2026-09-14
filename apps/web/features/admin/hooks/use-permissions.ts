import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { connectRealtime } from "@/lib/sse";

export type PermissionRoleRefDto = {
  id: number;
  name: string;
  slug: string;
};

export type PermissionMenuRefDto = {
  id: number;
  title: string;
  url: string | null;
};

export type PermissionSummaryDto = {
  id: number;
  name: string;
  slug: string;
  roleCount: number;
  menuCount: number;
  isSystem: boolean;
  roles?: PermissionRoleRefDto[];
  menus?: PermissionMenuRefDto[];
  createdAt: string;
};

let cachedPermissions: PermissionSummaryDto[] | null = null;
let inFlightPermissions: Promise<PermissionSummaryDto[]> | null = null;

export function clearPermissionCache() {
  cachedPermissions = null;
  inFlightPermissions = null;
}

export function usePermissions() {
  const [permissions, setPermissions] = useState<PermissionSummaryDto[]>(() => cachedPermissions ?? []);
  const [loading, setLoading] = useState<boolean>(() => cachedPermissions === null);
  const [error, setError] = useState<string | null>(null);

  const fetchPermissions = useCallback(async (force = false) => {
    if (cachedPermissions === null || force) {
      if (!cachedPermissions) {
        setLoading(true);
      }
    }
    setError(null);

    try {
      if (!inFlightPermissions || force) {
        inFlightPermissions = api<{ data: PermissionSummaryDto[] }>("/admin/rbac/permissions")
          .then((res) => {
            cachedPermissions = res.data;
            inFlightPermissions = null;
            return res.data;
          })
          .catch((err) => {
            inFlightPermissions = null;
            throw err;
          });
      }

      const data = await inFlightPermissions;
      setPermissions(data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Gagal memuat daftar izin.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Always fetch fresh data on mount (revalidate in background)
    void fetchPermissions(true);

    // Realtime live update: listen to rbac and user changes
    const disconnect = connectRealtime("admin", {
      onAdminRbacUpdated: () => {
        clearPermissionCache();
        void fetchPermissions(true);
      },
      onAdminUsersUpdated: () => {
        clearPermissionCache();
        void fetchPermissions(true);
      }
    });

    return () => {
      disconnect();
    };
  }, [fetchPermissions]);

  return { permissions, loading, error, refresh: () => fetchPermissions(true) };
}
