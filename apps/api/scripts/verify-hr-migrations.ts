import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";

const sourceUrl = new URL(process.env.DATABASE_URL ?? "mysql://invalid/invalid");
if (process.env.ALLOW_TEST_DATABASE !== "1" || !sourceUrl.pathname.endsWith("_test") || process.env.NODE_ENV === "production") throw new Error("Use an explicitly authorized disposable test MySQL server.");
const root = await mysql.createConnection(sourceUrl.toString());
const migrations = resolve(import.meta.dir, "../drizzle");
const journal = JSON.parse(await readFile(resolve(migrations, "meta/_journal.json"), "utf8"));
const oldFolder = await mkdtemp(resolve(tmpdir(), "mkn-migrations-"));
await mkdir(resolve(oldFolder, "meta"));
await writeFile(resolve(oldFolder, "meta/_journal.json"), JSON.stringify({ ...journal, entries: journal.entries.filter((entry: { idx: number }) => entry.idx <= 3) }));
for (const entry of journal.entries.filter((entry: { idx: number }) => entry.idx <= 3)) await copyFile(resolve(migrations, `${entry.tag}.sql`), resolve(oldFolder, `${entry.tag}.sql`));

try {
  for (const scenario of ["fresh", "legacy", "pushed"] as const) {
    const name = `mkn_hr_${scenario}_${Date.now()}_test`;
    assert.match(name, /^mkn_hr_(fresh|legacy|pushed)_\d+_test$/);
    await root.query(`CREATE DATABASE \`${name}\``);
    const url = new URL(sourceUrl); url.pathname = `/${name}`;
    const connection = await mysql.createConnection(url.toString());
    const orm = drizzle(connection);
    try {
      if (scenario !== "fresh") {
        await migrate(orm, { migrationsFolder: oldFolder });
        await connection.query("INSERT INTO users (name,email,password_hash) VALUES ('Keep employee','hr@mknsite.online','not-a-login-hash')");
        await connection.query("INSERT INTO menus (title,url,required_permission) VALUES ('Custom HR','/portal/hr','hr.view')");
        await connection.query("INSERT INTO hr_forms (form_type,form_number,data,created_by) VALUES ('cuti','CT-KEEP','{}',1)");
        await connection.query("INSERT INTO permissions(name,slug) VALUES ('Portal Telco','ops_telco.view')");
        await connection.query("INSERT INTO roles(name,slug) VALUES ('Custom technician name','ops-telco'),('Manager','manager')");
        await connection.query("INSERT INTO role_permissions(role_id,permission_id) VALUES (1,1),(2,1)");
        const [before]: any = await connection.query("SELECT DELETE_RULE FROM information_schema.referential_constraints WHERE constraint_schema=? AND table_name='hr_forms'", [name]);
        assert.equal(before[0].DELETE_RULE, "CASCADE");
        if (scenario === "pushed") {
          await connection.query("ALTER TABLE users ADD division varchar(100), ADD avatar_url varchar(500), ADD last_login_at timestamp NULL, ADD INDEX users_division_idx(division)");
          await connection.query("ALTER TABLE menus MODIFY icon text");
          await connection.query("CREATE TABLE divisions (id int AUTO_INCREMENT PRIMARY KEY,name varchar(100) NOT NULL,description varchar(255),created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,CONSTRAINT divisions_name_unique UNIQUE(name))");
          await connection.query("INSERT INTO divisions (name,description) VALUES ('Custom Division','Keep this')");
        }
      }
      await migrate(orm, { migrationsFolder: migrations });
      await migrate(orm, { migrationsFolder: migrations });
      const [fk]: any = await connection.query("SELECT DELETE_RULE FROM information_schema.referential_constraints WHERE constraint_schema=? AND table_name='hr_forms'", [name]);
      assert.equal(fk[0].DELETE_RULE, "RESTRICT");
      const [columns]: any = await connection.query("SELECT column_name FROM information_schema.columns WHERE table_schema=? AND table_name='users'", [name]);
      for (const field of ["division", "avatar_url", "last_login_at"]) assert(columns.some((column: any) => column.COLUMN_NAME === field));
      const seed = () => Bun.spawn([process.execPath, "src/db/seed.ts"], { cwd: resolve(import.meta.dir, ".."), env: { ...process.env, DATABASE_URL: url.toString() }, stdout: "ignore", stderr: "inherit" }).exited;
      assert.equal(await seed(), 0);
      // Existing RBAC edits must survive every subsequent seed run.
      await connection.query("DELETE rp FROM role_permissions rp JOIN roles r ON r.id=rp.role_id JOIN permissions p ON p.id=rp.permission_id WHERE r.slug='ops-telco' AND p.slug='ops_telco.schedule.view'");
      assert.equal(await seed(), 0);
      const [grants]: any = await connection.query("SELECT p.slug FROM role_permissions rp JOIN roles r ON r.id=rp.role_id JOIN permissions p ON p.id=rp.permission_id WHERE r.slug='ops-telco'");
      assert(!grants.some((p: any) => p.slug === "ops_telco.schedule.view"));
      assert(!grants.some((p: any) => p.slug === "ops_telco.pto.view"));
      if (scenario !== "fresh") {
        const [employee]: any = await connection.query("SELECT * FROM users WHERE email='hr@mknsite.online'");
        assert.equal(employee[0].password_hash, "not-a-login-hash");
        const [menu]: any = await connection.query("SELECT title FROM menus WHERE url='/portal/hr'");
        assert.equal(menu[0].title, "Custom HR");
        const [form]: any = await connection.query("SELECT form_number FROM hr_forms");
        assert.equal(form[0].form_number, "CT-KEEP");
        const [role]: any = await connection.query("SELECT name FROM roles WHERE slug='ops-telco'");
        assert.equal(role[0].name, "Custom technician name");
        if (scenario === "pushed") {
          const [division]: any = await connection.query("SELECT description FROM divisions WHERE name='Custom Division'");
          assert.equal(division[0].description, "Keep this");
        }
      }
      console.log(`PASS ${scenario}: migrations repeat safely; schema, HR ownership, accounts, menus and configured RBAC preserved.`);
    } finally {
      await connection.end();
      await root.query(`DROP DATABASE \`${name}\``);
    }
  }
} finally { await root.end(); await rm(oldFolder, { recursive: true }); }
