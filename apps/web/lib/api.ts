export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type PortalUser = {
  id: number;
  name: string;
  email: string;
  actorType: "user" | "admin";
  roles: string[];
  permissions: string[];
};

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? "Permintaan tidak dapat diproses.");
  return data as T;
}
