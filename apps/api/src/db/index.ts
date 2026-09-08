import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL wajib diisi");

export const pool = mysql.createPool({ uri: process.env.DATABASE_URL, connectionLimit: 10 });
export const db = drizzle({ client: pool });
