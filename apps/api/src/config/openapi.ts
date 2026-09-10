export const openApiSecuritySchemes = {
  employeeSession: {
    type: "apiKey" as const,
    in: "cookie" as const,
    name: "mkn_employee.session_token",
    description: "Session cookie untuk portal karyawan MKN."
  },
  adminSession: {
    type: "apiKey" as const,
    in: "cookie" as const,
    name: "mkn_admin.session_token",
    description: "Session cookie untuk area administrator MKN."
  }
};

export const openApiTags = [
  { name: "Health", description: "Pemeriksaan ketersediaan proses API" },
  { name: "Auth Employee", description: "Autentikasi dan sesi portal karyawan" },
  { name: "Auth Admin", description: "Autentikasi dan sesi terisolasi administrator" },
  { name: "Workspace", description: "Data modul bisnis berbasis otorisasi RBAC" },
  { name: "Admin", description: "Operasi administratif dan manajemen pengguna" },
  { name: "Realtime", description: "Streaming event langsung Server-Sent Events (SSE)" },
  { name: "Menus", description: "Pengelolaan menu portal karyawan dan menu gerbang dinamis" }
];


export const openApiSchemas: Record<string, unknown> = {
  ErrorResponse: {
    type: "object",
    required: ["message"],
    properties: {
      message: { type: "string", description: "Deskripsi pesan error", example: "Sesi tidak valid." },
      code: { type: "string", description: "Kode error sistem (opsional)", example: "UNAUTHORIZED" }
    }
  },
  BadRequestError: {
    type: "object",
    description: "HTTP 400 - Request tidak dapat diproses atau format input salah",
    required: ["message"],
    properties: {
      message: { type: "string", example: "Satu atau lebih role tidak ditemukan." },
      code: { type: "string", example: "BAD_REQUEST" }
    }
  },
  UnauthorizedError: {
    type: "object",
    description: "HTTP 401 - Pengguna belum terautentikasi atau session cookie kedaluwarsa",
    required: ["message"],
    properties: {
      message: { type: "string", example: "Sesi tidak valid." },
      code: { type: "string", example: "UNAUTHORIZED" }
    }
  },
  ForbiddenError: {
    type: "object",
    description: "HTTP 403 - Akses ditolak (izin tidak cukup atau proteksi CSRF/Origin gagal)",
    required: ["message"],
    properties: {
      message: { type: "string", example: "Anda tidak memiliki izin untuk modul ini." },
      code: { type: "string", example: "FORBIDDEN" }
    }
  },
  NotFoundError: {
    type: "object",
    description: "HTTP 404 - Sumber daya atau modul yang diminta tidak ditemukan",
    required: ["message"],
    properties: {
      message: { type: "string", example: "Pengguna tidak ditemukan." },
      code: { type: "string", example: "NOT_FOUND" }
    }
  },
  ValidationError: {
    type: "object",
    description: "HTTP 422 - Validasi skema input gagal",
    required: ["message"],
    properties: {
      message: { type: "string", example: "Format email tidak valid atau password kurang dari panjang minimum." },
      code: { type: "string", example: "VALIDATION_FAILED" }
    }
  },
  ConflictError: {
    type: "object",
    description: "HTTP 409 - Terjadi konflik data bisnis (misal email sudah terdaftar)",
    required: ["message"],
    properties: {
      message: { type: "string", example: "Email sudah terdaftar dalam sistem." },
      code: { type: "string", example: "EMAIL_ALREADY_EXISTS" }
    }
  },
  InternalServerError: {
    type: "object",
    description: "HTTP 500 - Kegagalan internal server (disanitasi tanpa SQL atau stack trace)",
    required: ["message"],
    properties: {
      message: { type: "string", example: "Terjadi kesalahan internal pada server. Silakan coba kembali nanti." }
    }
  },
  HealthResponse: {
    type: "object",
    required: ["status", "service"],
    properties: {
      status: { type: "string", example: "ok" },
      service: { type: "string", example: "mknsite-api" }
    }
  },
  UserProfileResponse: {
    type: "object",
    required: ["user"],
    properties: {
      user: {
        type: "object",
        required: ["id", "name", "email", "actorType", "roles", "permissions"],
        properties: {
          id: { type: "integer", example: 1 },
          name: { type: "string", example: "Ayu Prameswari" },
          email: { type: "string", example: "hr@mknsite.online" },
          actorType: { type: "string", enum: ["user", "admin"], example: "user" },
          roles: { type: "array", items: { type: "string" }, example: ["HR"] },
          permissions: { type: "array", items: { type: "string" }, example: ["dashboard.view", "hr.view", "hr.manage"] }
        }
      }
    }
  },
  BetterAuthLoginResponse: {
    type: "object",
    required: ["redirect", "token", "user"],
    properties: {
      redirect: { type: "boolean", example: false },
      token: { type: "string", example: "P0SY5tRHXBgZDef7UaBX8x7gcE8qFngK" },
      user: {
        type: "object",
        required: ["id", "name", "email"],
        properties: {
          id: { type: "string", example: "09737743-f78c-47c9-927d-72c34fbbdeab" },
          name: { type: "string", example: "Ayu Prameswari" },
          email: { type: "string", example: "hr@mknsite.online" },
          emailVerified: { type: "boolean", example: true },
          image: { type: "string", nullable: true, example: null },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" }
        }
      }
    }
  },
  SuccessResponse: {
    type: "object",
    required: ["success"],
    properties: {
      success: { type: "boolean", example: true }
    }
  },
  WorkspaceModuleResponse: {
    type: "object",
    required: ["module", "permission", "items"],
    properties: {
      module: { type: "string", example: "hr" },
      permission: { type: "string", example: "hr.view" },
      items: { type: "array", items: { type: "object" }, example: [] }
    }
  },
  UserSummary: {
    type: "object",
    description: "Ringkasan profil pengguna yang aman tanpa data kredensial",
    required: ["id", "name", "email", "accountType", "isActive", "roles", "createdAt", "updatedAt"],
    properties: {
      id: { type: "integer", example: 1 },
      name: { type: "string", example: "Ayu Prameswari" },
      email: { type: "string", example: "hr@mknsite.online" },
      accountType: { type: "string", enum: ["employee", "admin"], example: "employee" },
      isActive: { type: "boolean", example: true },
      roles: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "name", "slug"],
          properties: {
            id: { type: "integer", example: 1 },
            name: { type: "string", example: "HR" },
            slug: { type: "string", example: "hr" }
          }
        }
      },
      createdAt: { type: "string", format: "date-time", example: "2026-09-07T11:53:50.000Z" },
      updatedAt: { type: "string", format: "date-time", example: "2026-09-07T11:53:50.000Z" }
    }
  },
  UserListResponse: {
    type: "object",
    description: "Response daftar pengguna dengan metadata pagination",
    required: ["data", "pagination"],
    properties: {
      data: {
        type: "array",
        items: { $ref: "#/components/schemas/UserSummary" }
      },
      pagination: {
        type: "object",
        required: ["page", "pageSize", "total", "totalPages"],
        properties: {
          page: { type: "integer", example: 1 },
          pageSize: { type: "integer", example: 20 },
          total: { type: "integer", example: 6 },
          totalPages: { type: "integer", example: 1 }
        }
      }
    }
  },
  UserDetailResponse: {
    type: "object",
    description: "Response detail pengguna tunggal",
    required: ["data"],
    properties: {
      data: { $ref: "#/components/schemas/UserSummary" }
    }
  },
  RoleListResponse: {
    type: "object",
    description: "Response daftar role beserta izin akses modulnya",
    required: ["data"],
    properties: {
      data: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "name", "slug", "permissions"],
          properties: {
            id: { type: "integer", example: 1 },
            name: { type: "string", example: "HR" },
            slug: { type: "string", example: "hr" },
            permissions: {
              type: "array",
              items: { type: "string" },
              example: ["dashboard.view", "hr.view", "hr.manage"]
            }
          }
        }
      }
    }
  },
  MenuSummary: {
    type: "object",
    description: "Informasi detail satu item menu portal",
    required: ["id", "title", "sortOrder", "isActive", "badgeCount", "badgeColor", "createdAt", "updatedAt"],
    properties: {
      id: { type: "integer", example: 1 },
      title: { type: "string", example: "HR" },
      icon: { type: "string", nullable: true, example: "users" },
      description: { type: "string", nullable: true, example: "Manajemen Karyawan dan Organisasi" },
      url: { type: "string", nullable: true, example: "/portal/hr" },
      requiredPermission: { type: "string", nullable: true, example: "hr.view" },
      sortOrder: { type: "integer", example: 1 },
      isActive: { type: "boolean", example: true },
      badgeCount: { type: "integer", example: 0 },
      badgeColor: { type: "string", example: "orange" },
      createdBy: { type: "integer", nullable: true, example: 1 },
      createdAt: { type: "string", format: "date-time", example: "2026-09-07T11:53:50.000Z" },
      updatedAt: { type: "string", format: "date-time", example: "2026-09-07T11:53:50.000Z" }
    }
  },
  MenuListResponse: {
    type: "object",
    description: "Response daftar menu portal",
    required: ["data"],
    properties: {
      data: {
        type: "array",
        items: { $ref: "#/components/schemas/MenuSummary" }
      }
    }
  },
  MenuDetailResponse: {
    type: "object",
    description: "Response detail item menu tunggal",
    required: ["data"],
    properties: {
      data: { $ref: "#/components/schemas/MenuSummary" }
    }
  }
};

