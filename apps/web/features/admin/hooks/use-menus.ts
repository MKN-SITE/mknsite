import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

export type MenuSummaryDto = {
  id: number;
  title: string;
  icon: string | null;
  description: string | null;
  url: string | null;
  requiredPermission: string | null;
  sortOrder: number;
  isActive: number;
  badgeCount: number;
  badgeColor: string;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
};

export type MenuListResponseDto = {
  data: MenuSummaryDto[];
};

export function useMenus() {
  const [menus, setMenus] = useState<MenuSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMenus = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await api<MenuListResponseDto>("/admin/menus");
      // Sort by sortOrder ASC, then id ASC
      const sorted = [...res.data].sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) {
          return a.sortOrder - b.sortOrder;
        }
        return a.id - b.id;
      });
      setMenus(sorted);
    } catch (err: any) {
      setError(err?.message ?? "Gagal memuat daftar menu.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMenus();
  }, [fetchMenus]);

  const toggleStatus = useCallback(
    async (id: number, currentActive: number) => {
      const nextActive = currentActive ? 0 : 1;
      // Optimistic update
      setMenus((prev) =>
        prev.map((item) => (item.id === id ? { ...item, isActive: nextActive } : item))
      );

      try {
        await api(`/admin/menus/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ isActive: nextActive })
        });
        await fetchMenus();
      } catch (err: any) {
        setError(err?.message ?? "Gagal mengubah status menu.");
        await fetchMenus();
        throw err;
      }
    },
    [fetchMenus]
  );

  const reorderMenu = useCallback(
    async (id: number, direction: "up" | "down") => {
      const currentIndex = menus.findIndex((m) => m.id === id);
      if (currentIndex === -1) return;

      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= menus.length) return;

      const currentItem = menus[currentIndex];
      const neighborItem = menus[targetIndex];

      let newCurrentSort = neighborItem.sortOrder;
      let newNeighborSort = currentItem.sortOrder;

      // Handle edge-case where both had identical sort orders
      if (newCurrentSort === newNeighborSort) {
        if (direction === "up") {
          newCurrentSort = Math.max(0, newNeighborSort - 1);
        } else {
          newCurrentSort = newNeighborSort + 1;
        }
      }

      try {
        await Promise.all([
          api(`/admin/menus/${currentItem.id}`, {
            method: "PATCH",
            body: JSON.stringify({ sortOrder: newCurrentSort })
          }),
          api(`/admin/menus/${neighborItem.id}`, {
            method: "PATCH",
            body: JSON.stringify({ sortOrder: newNeighborSort })
          })
        ]);
        await fetchMenus();
      } catch (err: any) {
        setError(err?.message ?? "Gagal mengubah urutan menu.");
        await fetchMenus();
        throw err;
      }
    },
    [menus, fetchMenus]
  );

  const deleteMenu = useCallback(
    async (id: number) => {
      try {
        await api(`/admin/menus/${id}`, {
          method: "DELETE"
        });
        await fetchMenus();
      } catch (err: any) {
        setError(err?.message ?? "Gagal menghapus menu.");
        throw err;
      }
    },
    [fetchMenus]
  );

  return {
    menus,
    loading,
    error,
    refresh: fetchMenus,
    toggleStatus,
    reorderMenu,
    deleteMenu
  };
}
