import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "mysql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "mysql://mknsite:mknsite-local-only@localhost:3306/mknsite" },
  strict: true,
  verbose: true
});
