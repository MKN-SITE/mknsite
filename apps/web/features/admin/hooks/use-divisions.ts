import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { connectRealtime } from "@/lib/sse";
import type { UserSummaryDto } from "./use-users";

export type DivisionSummaryDto = {
  id: number;
  name: string;
  description: string | null;
  userCount: number;
  createdAt: string;
  updatedAt: string;
};

export type DivisionListResponseDto = {
  data: DivisionSummaryDto[];
};

export type DivisionMembersResponseDto = {
  data: UserSummaryDto[];
  division: DivisionSummaryDto;
  total: number;
};

export async function fetchDivisionMembers(divisionId: number, search?: string): Promise<DivisionMembersResponseDto> {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  return api<DivisionMembersResponseDto>(`/admin/divisions/${divisionId}/members${query}`);
}

let cachedDivisions: DivisionSummaryDto[] | null = null;
let inFlightRequest: Promise<DivisionSummaryDto[]> | null = null;

export function clearDivisionCache() {
  cachedDivisions = null;
  inFlightRequest = null;
}

export function useDivisions() {
  const [divisions, setDivisions] = useState<DivisionSummaryDto[]>(() => cachedDivisions ?? []);
  const [loading, setLoading] = useState<boolean>(() => cachedDivisions === null);
  const [error, setError] = useState<string | null>(null);

  const fetchDivisions = useCallback(async (force = false) => {
    // Stale-while-revalidate: only show blocking loading skeleton if there is no cached data
    if (cachedDivisions === null || force) {
      if (!cachedDivisions) {
        setLoading(true);
      }
    }
    setError(null);

    try {
      if (!inFlightRequest || force) {
        inFlightRequest = api<DivisionListResponseDto>("/admin/divisions")
          .then((res) => {
            cachedDivisions = res.data;
            inFlightRequest = null;
            return res.data;
          })
          .catch((err) => {
            inFlightRequest = null;
            throw err;
          });
      }

      const data = await inFlightRequest;
      setDivisions(data);
    } catch (err: any) {
      setError(err?.message ?? "Gagal memuat daftar divisi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Always fetch fresh data on mount (revalidate in background)
    void fetchDivisions(true);

    // Realtime live update: listen to user and division changes
    const disconnect = connectRealtime("admin", {
      onAdminUsersUpdated: () => {
        clearDivisionCache();
        void fetchDivisions(true);
      },
      onAdminDivisionsUpdated: () => {
        clearDivisionCache();
        void fetchDivisions(true);
      }
    });

    return () => {
      disconnect();
    };
  }, [fetchDivisions]);

  const refresh = useCallback(() => fetchDivisions(true), [fetchDivisions]);

  return {
    divisions,
    loading,
    error,
    refresh
  };
}
