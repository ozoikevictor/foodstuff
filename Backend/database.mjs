import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

export function openDatabase(
  path = process.env.DATABASE_PATH || new URL("./data/marketplace.sqlite", import.meta.url),
) {
  if (path !== ":memory:") mkdirSync(dirname(path instanceof URL ? fileURLToPath(path) : resolve(path)), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
  );
  const directory = new URL("./migrations/", import.meta.url);
  for (const name of readdirSync(directory)
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    if (db.prepare("SELECT 1 FROM schema_migrations WHERE name=?").get(name)) continue;
    transaction(db, () => {
      db.exec(readFileSync(new URL(name, directory), "utf8"));
      db.prepare("INSERT INTO schema_migrations (name) VALUES (?)").run(name);
    });
  }
  return db;
}
export const id = () => randomUUID();
export function transaction(db, fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
