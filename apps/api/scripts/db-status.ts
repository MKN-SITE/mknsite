import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";
import { db, pool } from "../src/db";

interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

interface JournalFile {
  version: string;
  dialect: string;
  entries: JournalEntry[];
}

interface DrizzleMigrationRow {
  id: number;
  hash: string;
  created_at: number | null;
}

const MIGRATION_DESCRIPTIONS: Record<string, string> = {
  "0000_confused_power_man": "Skema dasar RBAC (users, roles, permissions, role_permissions, user_roles, audit_logs)",
  "0001_funny_marvex": "Tabel Better Auth (auth_user, auth_session, auth_account, auth_verification)",
  "0002_strong_korath": "Tabel Navigasi & Menu Dinamis (menus)",
  "0003_powerful_puppet_master": "Master Divisi (divisions) & kolom profil user (division, avatar_url, last_login_at)"
};

function parseSqlSummary(sqlContent: string): string {
  const lines = sqlContent.split("\n");
  const actions: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("CREATE TABLE")) {
      const match = trimmed.match(/CREATE TABLE `([^`]+)`/i);
      if (match) actions.push(`+tabel:${match[1]}`);
    } else if (trimmed.startsWith("ALTER TABLE")) {
      const match = trimmed.match(/ALTER TABLE `([^`]+)`\s+ADD\s+`([^`]+)`/i);
      if (match) actions.push(`+kolom:${match[1]}.${match[2]}`);
    }
  }
  return actions.length > 0 ? actions.join(", ") : "Perubahan skema DDL";
}

async function showMigrationStatus() {
  console.log("\n===============================================================");
  console.log("             MKN SITE - STATUS MIGRASI DATABASE                ");
  console.log("===============================================================\n");

  const journalPath = resolve(import.meta.dir, "../drizzle/meta/_journal.json");
  if (!existsSync(journalPath)) {
    console.error("File journal migrasi tidak ditemukan di:", journalPath);
    await pool.end();
    return;
  }

  const journal: JournalFile = JSON.parse(readFileSync(journalPath, "utf-8"));

  let dbMigrations: DrizzleMigrationRow[] = [];
  try {
    const [rows] = await pool.query("SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY created_at ASC");
    dbMigrations = rows as DrizzleMigrationRow[];
  } catch (err) {
    console.warn("Tabel __drizzle_migrations belum ada atau belum dapat diakses.");
  }

  const appliedMap = new Map<number, DrizzleMigrationRow>();
  for (const row of dbMigrations) {
    if (row.created_at) {
      appliedMap.set(Number(row.created_at), row);
    }
  }

  console.log(`Total Migrasi di Kode (Journal) : ${journal.entries.length}`);
  console.log(`Total Migrasi di Database (__drizzle_migrations) : ${dbMigrations.length}\n`);

  console.log("------------------------------------------------------------------------------------------------------------------");
  console.log("| Idx | Tag / Berkas Migrasi           | Status       | Waktu Dijalankan    | Fitur / Perubahan Skema");
  console.log("------------------------------------------------------------------------------------------------------------------");

  for (const entry of journal.entries) {
    const applied = appliedMap.get(entry.when);
    const isApplied = !!applied;
    const statusStr = isApplied ? "\x1b[32mTERPASANG\x1b[0m   " : "\x1b[33mPENDING\x1b[0m     ";
    const dateStr = applied && applied.created_at
      ? new Date(Number(applied.created_at)).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })
      : "-                  ";

    let desc = MIGRATION_DESCRIPTIONS[entry.tag];
    if (!desc) {
      const sqlFile = resolve(import.meta.dir, `../drizzle/${entry.tag}.sql`);
      if (existsSync(sqlFile)) {
        desc = parseSqlSummary(readFileSync(sqlFile, "utf-8"));
      } else {
        desc = "Deskripsi belum terdata";
      }
    }

    const idxStr = String(entry.idx).padEnd(3);
    const tagStr = entry.tag.padEnd(30);

    console.log(`| ${idxStr} | ${tagStr} | ${statusStr} | ${dateStr.padEnd(19)} | ${desc}`);
  }
  console.log("------------------------------------------------------------------------------------------------------------------\n");

  const journalTimestamps = new Set(journal.entries.map((e) => e.when));
  const orphans = dbMigrations.filter((m) => m.created_at && !journalTimestamps.has(Number(m.created_at)));
  if (orphans.length > 0) {
    console.warn("\x1b[31m[PERINGATAN] Ditemukan migrasi orphan di database (tidak terdaftar di journal kode):\x1b[0m");
    for (const orphan of orphans) {
      console.warn(`  - ID: ${orphan.id}, Hash: ${orphan.hash}, CreatedAt: ${orphan.created_at}`);
    }
    console.warn("  -> Ini biasanya terjadi setelah git revert. Jalankan pembersihan row database sesuai database-ops.md.\n");
  }

  await pool.end();
}

showMigrationStatus().catch(async (e) => {
  console.error("Gagal memeriksa status migrasi:", e);
  await pool.end();
  process.exit(1);
});
