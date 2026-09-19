export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api-backend";

export type PortalUser = {
  id: number;
  name: string;
  email: string;
  actorType: "user" | "admin";
  kpcId?: string | null;
  username?: string | null;
  phone?: string | null;
  startDate?: string | null;
  emailVerified?: boolean;
  division?: string | null;
  avatarUrl?: string | null;
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
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const defaultHeaders: Record<string, string> = isFormData ? {} : { "Content-Type": "application/json" };
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const base = API_URL ? (API_URL.endsWith("/") ? API_URL.slice(0, -1) : API_URL) : "";
  const response = await fetch(`${base}${cleanPath}`, {
    ...init,
    credentials: "include",
    headers: { ...defaultHeaders, ...init?.headers }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(data.message ?? "Permintaan tidak dapat diproses.", response.status, data);
  }
  return data as T;
}

export function getAvatarUrl(url?: string | null): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
    return url;
  }
  const cleanUrl = url.startsWith("/") ? url : `/${url}`;
  if (API_URL.startsWith("/")) {
    return cleanUrl;
  }
  const base = API_URL ? (API_URL.endsWith("/") ? API_URL.slice(0, -1) : API_URL) : "";
  return `${base}${cleanUrl}`;
}

