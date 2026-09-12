import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

export type PermissionSummaryDto = {
  id: number;
  name: string;
  slug: string;
  roleCount: number;
  menuCount: number;
  isSystem: boolean;
  createdAt: string;
};

export function usePermissions() {
  const [permissions, setPermissions] = useState<PermissionSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchPermissions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api<{ data: PermissionSummaryDto[] }>("/admin/rbac/permissions");
      setPermissions(result.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Gagal memuat daftar izin.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void fetchPermissions(); }, [fetchPermissions]);
  return { permissions, loading, error, refresh: fetchPermissions };
}
