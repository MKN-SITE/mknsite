import { getAuthenticatedProfile } from "../auth/auth";
import { config } from "../config/env";

export function isAllowedOrigin(originHeader: string | null): boolean {
  if (!originHeader) return true;
  const allowed = [
    config.appOrigin,
    config.apiOrigin,
    `http://localhost:${config.port}`,
    `http://127.0.0.1:${config.port}`,
    `http://localhost:3000`,
    `http://127.0.0.1:3000`,
    `http://localhost:3100`,
    `http://127.0.0.1:3100`
  ];
  return allowed.includes(originHeader);
}

export type AdminAuthFailure = {
  status: 401 | 403;
  error: { code: string; message: string };
};

export type AdminAuthResult =
  | { success: true; admin: NonNullable<Awaited<ReturnType<typeof getAuthenticatedProfile>>> }
  | { success: false; failure: AdminAuthFailure };

export async function authorizeAdmin(request: Request): Promise<AdminAuthResult> {
  const method = request.method.toUpperCase();
  if (["POST", "PATCH", "PUT", "DELETE"].includes(method)) {
    const origin = request.headers.get("origin");
    if (origin && !isAllowedOrigin(origin)) {
      return {
        success: false,
        failure: {
          status: 403,
          error: { code: "INVALID_ORIGIN", message: "Origin permintaan tidak diizinkan." }
        }
      };
    }
  }

  const admin = await getAuthenticatedProfile(request.headers, "admin");
  if (!admin) {
    return {
      success: false,
      failure: {
        status: 401,
        error: { code: "UNAUTHORIZED", message: "Sesi administrator tidak valid atau belum login." }
      }
    };
  }

  if (!admin.permissions.includes("admin.manage")) {
    return {
      success: false,
      failure: {
        status: 403,
        error: { code: "FORBIDDEN", message: "Izin administrator (admin.manage) diperlukan." }
      }
    };
  }

  return { success: true, admin };
}

export async function authorizeSuperadmin(request: Request): Promise<AdminAuthResult> {
  const baseAuth = await authorizeAdmin(request);
  if (!baseAuth.success) return baseAuth;

  if (!baseAuth.admin.permissions.includes("admin.security.manage")) {
    return {
      success: false,
      failure: {
        status: 403,
        error: {
          code: "SUPERADMIN_PERMISSION_REQUIRED",
          message: "Hak akses superadministrator (admin.security.manage) diperlukan."
        }
      }
    };
  }

  return baseAuth;
}

