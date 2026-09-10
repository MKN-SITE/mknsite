import "dotenv/config";

const rawAppOrigins = (process.env.APP_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const isProduction = process.env.NODE_ENV === "production";

export const config = {
  port: Number(process.env.PORT ?? 3001),
  appOrigin: rawAppOrigins[0] ?? "http://localhost:3000",
  allowedOrigins: [
    ...new Set([
      ...rawAppOrigins,
      "https://mknsite.online",
      "https://www.mknsite.online",
      ...(isProduction ? [] : ["http://localhost:3000", "http://127.0.0.1:3000"])
    ])
  ],
  apiOrigin: process.env.BETTER_AUTH_URL ?? `http://localhost:${process.env.PORT ?? 3001}`,
  databaseUrl: process.env.DATABASE_URL ?? "mysql://mknsite:mknsite-local-only@localhost:3306/mknsite",
  isProduction,
  enableSwagger: process.env.ENABLE_SWAGGER === "true" || !isProduction,
  docsProvider: (process.env.DOCS_PROVIDER as "swagger-ui" | "scalar") || "swagger-ui",
  cookieDomain: process.env.COOKIE_DOMAIN || undefined
} as const;

