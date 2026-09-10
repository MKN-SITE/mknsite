import { t } from "elysia";

export type MenuSummaryDto = {
  id: number;
  title: string;
  icon: string | null;
  description: string | null;
  url: string | null;
  requiredPermission: string | null;
  sortOrder: number;
  isActive: boolean;
  badgeCount: number;
  badgeColor: string;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
};

export type MenuListResponseDto = {
  data: MenuSummaryDto[];
};

export type MenuDetailResponseDto = {
  data: MenuSummaryDto;
};

export const MenuSummarySchema = t.Object({
  id: t.Integer({ description: "ID menu" }),
  title: t.String({ description: "Judul menu" }),
  icon: t.Nullable(t.String({ description: "Nama icon SVG" })),
  description: t.Nullable(t.String({ description: "Deskripsi menu" })),
  url: t.Nullable(t.String({ description: "URL atau rute tujuan portal" })),
  requiredPermission: t.Nullable(t.String({ description: "Slug permission yang disyaratkan" })),
  sortOrder: t.Integer({ description: "Urutan tampilan menu" }),
  isActive: t.Boolean({ description: "Status keaktifan menu" }),
  badgeCount: t.Integer({ description: "Jumlah notifikasi badge" }),
  badgeColor: t.String({ description: "Warna badge notifikasi" }),
  createdBy: t.Nullable(t.Integer({ description: "ID user pembuat menu" })),
  createdAt: t.String({ description: "Waktu pembuatan dalam format ISO" }),
  updatedAt: t.String({ description: "Waktu pembaruan terakhir dalam format ISO" })
});

export const MenuListResponseSchema = t.Object({
  data: t.Array(MenuSummarySchema, { description: "Daftar menu portal" })
});

export const MenuDetailResponseSchema = t.Object({
  data: MenuSummarySchema
});

export const CreateMenuSchema = t.Object({
  title: t.String({ minLength: 1, maxLength: 100, description: "Judul menu (1-100 karakter)" }),
  icon: t.Optional(t.Nullable(t.String({ maxLength: 100, description: "Nama icon (maks 100 karakter)" }))),
  description: t.Optional(t.Nullable(t.String({ maxLength: 255, description: "Deskripsi menu (maks 255 karakter)" }))),
  url: t.Optional(t.Nullable(t.String({ maxLength: 500, description: "URL atau rute tujuan (maks 500 karakter)" }))),
  requiredPermission: t.Optional(t.Nullable(t.String({ maxLength: 140, description: "Slug permission yang disyaratkan (maks 140 karakter)" }))),
  sortOrder: t.Optional(t.Integer({ default: 0, description: "Urutan tampilan (default 0)" })),
  isActive: t.Optional(t.Boolean({ default: true, description: "Status aktif (default true)" })),
  badgeCount: t.Optional(t.Integer({ default: 0, minimum: 0, description: "Jumlah notifikasi badge" })),
  badgeColor: t.Optional(t.String({ maxLength: 20, default: "orange", description: "Warna badge (maks 20 karakter)" }))
});

export type CreateMenuDto = typeof CreateMenuSchema.static;

export const UpdateMenuSchema = t.Object({
  title: t.Optional(t.String({ minLength: 1, maxLength: 100, description: "Judul menu (1-100 karakter)" })),
  icon: t.Optional(t.Nullable(t.String({ maxLength: 100, description: "Nama icon (maks 100 karakter)" }))),
  description: t.Optional(t.Nullable(t.String({ maxLength: 255, description: "Deskripsi menu (maks 255 karakter)" }))),
  url: t.Optional(t.Nullable(t.String({ maxLength: 500, description: "URL atau rute tujuan (maks 500 karakter)" }))),
  requiredPermission: t.Optional(t.Nullable(t.String({ maxLength: 140, description: "Slug permission yang disyaratkan" }))),
  sortOrder: t.Optional(t.Integer({ description: "Urutan tampilan" })),
  isActive: t.Optional(t.Boolean({ description: "Status aktif" })),
  badgeCount: t.Optional(t.Integer({ minimum: 0, description: "Jumlah notifikasi badge" })),
  badgeColor: t.Optional(t.String({ maxLength: 20, description: "Warna badge" }))
});

export type UpdateMenuDto = typeof UpdateMenuSchema.static;

export function mapMenuSummary(menu: {
  id: number;
  title: string;
  icon: string | null;
  description: string | null;
  url: string | null;
  requiredPermission: string | null;
  sortOrder: number;
  isActive: number;
  badgeCount: number | null;
  badgeColor: string | null;
  createdBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}): MenuSummaryDto {
  return {
    id: menu.id,
    title: menu.title,
    icon: menu.icon,
    description: menu.description,
    url: menu.url,
    requiredPermission: menu.requiredPermission,
    sortOrder: menu.sortOrder,
    isActive: Boolean(menu.isActive),
    badgeCount: menu.badgeCount ?? 0,
    badgeColor: menu.badgeColor ?? "orange",
    createdBy: menu.createdBy,
    createdAt: menu.createdAt.toISOString(),
    updatedAt: menu.updatedAt.toISOString()
  };
}
