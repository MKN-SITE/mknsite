import "dotenv/config";
import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/mysql2";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { migrate } from "drizzle-orm/mysql2/migrator";

export async function migrateDatabase(connection: Connection, migrationsFolder = resolve(import.meta.dir, "../../drizzle")) {
  const exists = async (sql: string, params: unknown[] = []) => {
    const [rows] = await connection.query<RowDataPacket[]>(sql, params);
    return Number(rows[0]?.n ?? 0) > 0;
  };
  const [lock] = await connection.query<RowDataPacket[]>("SELECT GET_LOCK(CONCAT(DATABASE(), ':migrations'), 30) AS acquired");
  if (Number(lock[0]?.acquired) !== 1) throw new Error("Migrasi sedang dijalankan proses lain. Coba lagi setelah selesai.");
  try {
    const files = readMigrationFiles({ migrationsFolder });
    const mainMigration = files.find((file) => file.folderMillis === 1789439834977);
    const journalExists = await exists("SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='__drizzle_migrations'");
    if (mainMigration && journalExists) {
      const [applied] = await connection.query<RowDataPacket[]>("SELECT COALESCE(MAX(created_at),0) AS latest FROM __drizzle_migrations");
      const partialMainSchema = await exists("SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='users' AND column_name IN ('division','avatar_url','last_login_at')")
        || await exists("SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='divisions'");
      if (Number(applied[0].latest) < mainMigration.folderMillis && partialMainSchema) {
        // PR #35 introduced a migration for fields previously installed via db:push.
        // Complete its exact schema effects before recording the original migration hash.
        // SQL/history from main stays immutable; only known already-present DDL is skipped.
        if (!await exists("SELECT COUNT(*) AS n FROM __drizzle_migrations WHERE created_at=1789025983020")) throw new Error("Schema manual tanpa baseline 0002 tidak dapat dimigrasikan otomatis. Periksa riwayat database.");
        for (const statement of mainMigration.sql) {
          const table = /CREATE TABLE `([^`]+)`/.exec(statement)?.[1];
          const column = /ALTER TABLE `users` ADD `([^`]+)`/.exec(statement)?.[1];
          const index = /CREATE INDEX `([^`]+)` ON `users`/.exec(statement)?.[1];
          if (table && await exists("SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?", [table])) continue;
          if (column && await exists("SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='users' AND column_name=?", [column])) continue;
          if (index && await exists("SELECT COUNT(*) AS n FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='users' AND index_name=?", [index])) continue;
          if (!table && !column && !index && !/ALTER TABLE `menus` MODIFY COLUMN `icon` text/.test(statement)) throw new Error("DDL rekonsiliasi main tidak dikenali; hentikan untuk review.");
          await connection.query(statement);
        }
        await connection.query("INSERT INTO __drizzle_migrations (hash,created_at) VALUES (?,?)", [mainMigration.hash, mainMigration.folderMillis]);
        console.log("Schema manual PR #35 direkonsiliasi; baseline migrasi main tercatat.");
      }
    }
    await migrate(drizzle(connection), { migrationsFolder });
  } finally { await connection.query("SELECT RELEASE_LOCK(CONCAT(DATABASE(), ':migrations'))"); }
}

if (import.meta.main) {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL wajib diisi.");
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try { await migrateDatabase(connection); console.log("Migrasi selesai."); }
  catch (error) { console.error("Migrasi gagal:", error); process.exitCode = 1; }
  finally { await connection.end(); }
}
