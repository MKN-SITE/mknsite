import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 3001),
  appOrigin: process.env.APP_ORIGIN ?? "http://localhost:3000",
  apiOrigin: process.env.BETTER_AUTH_URL ?? `http://localhost:${process.env.PORT ?? 3001}`,
  databaseUrl: process.env.DATABASE_URL ?? "mysql://mknsite:mknsite-local-only@localhost:3306/mknsite",
  isProduction: process.env.NODE_ENV === "production",
  enableSwagger: process.env.ENABLE_SWAGGER === "true" || process.env.NODE_ENV !== "production",
  docsProvider: (process.env.DOCS_PROVIDER as "swagger-ui" | "scalar") || "swagger-ui",
  cookieDomain: process.env.COOKIE_DOMAIN || undefined
} as const;
