import { t, type Static } from "elysia";

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

export type DivisionSummaryDto = {
  id: number;
  name: string;
  description: string | null;
  userCount: number;
  createdAt: string;
  updatedAt: string;
};
