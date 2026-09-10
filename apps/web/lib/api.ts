export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type PortalUser = {
  id: number;
  name: string;
  email: string;
  actorType: "user" | "admin";
  roles: string[];
  permissions: string[];
};

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(data.message ?? "Permintaan tidak dapat diproses.", response.status, data);
  }
  return data as T;
}

