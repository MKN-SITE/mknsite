import { t, type Static } from "elysia";
import { UserSummarySchema, type UserSummaryDto } from "./admin.dto";

export const CreateDivisionSchema = t.Object({
  name: t.String({ minLength: 1, maxLength: 100, description: "Nama divisi" }),
  description: t.Optional(t.Nullable(t.String({ maxLength: 255, description: "Deskripsi divisi" })))
});

export type CreateDivisionDto = Static<typeof CreateDivisionSchema>;

export const UpdateDivisionSchema = t.Object({
  name: t.Optional(t.String({ minLength: 1, maxLength: 100, description: "Nama divisi" })),
  description: t.Optional(t.Nullable(t.String({ maxLength: 255, description: "Deskripsi divisi" })))
});

export type UpdateDivisionDto = Static<typeof UpdateDivisionSchema>;

export const DivisionSummarySchema = t.Object({
  id: t.Integer({ description: "ID divisi" }),
  name: t.String({ description: "Nama divisi" }),
  description: t.Optional(t.Nullable(t.String({ description: "Deskripsi divisi" }))),
  userCount: t.Integer({ description: "Jumlah pengguna di divisi ini" }),
  createdAt: t.String({ description: "Waktu pembuatan dalam format ISO 8601" }),
  updatedAt: t.String({ description: "Waktu pembaruan dalam format ISO 8601" })
});

export type DivisionSummaryDto = {
  id: number;
  name: string;
  description: string | null;
  userCount: number;
  createdAt: string;
  updatedAt: string;
};

export const DivisionMembersResponseSchema = t.Object({
  data: t.Array(UserSummarySchema, { description: "Daftar anggota pengguna di divisi ini" }),
  division: DivisionSummarySchema,
  total: t.Integer({ description: "Total anggota divisi" })
});

export type DivisionMembersResponseDto = {
  data: UserSummaryDto[];
  division: DivisionSummaryDto;
  total: number;
};
