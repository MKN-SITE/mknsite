import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

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

let cachedDivisions: DivisionSummaryDto[] | null = null;
let inFlightRequest: Promise<DivisionSummaryDto[]> | null = null;

export function useDivisions() {
  const [divisions, setDivisions] = useState<DivisionSummaryDto[]>(() => cachedDivisions ?? []);
  const [loading, setLoading] = useState<boolean>(() => cachedDivisions === null);
  const [error, setError] = useState<string | null>(null);

  const fetchDivisions = useCallback(async (force = false) => {
    if (!force && cachedDivisions !== null) {
      setDivisions(cachedDivisions);
      setLoading(false);
      return;
    }

    setLoading(true);
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
    fetchDivisions();
  }, [fetchDivisions]);

  const refresh = useCallback(() => fetchDivisions(true), [fetchDivisions]);

  return {
    divisions,
    loading,
    error,
    refresh
  };
}
