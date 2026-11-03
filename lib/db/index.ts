import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { sql } from "drizzle-orm";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { importFileSchema, importPayload } from "../import";
import * as schema from "./schema";
import { seedRows } from "./seed-data";

export type DB = BetterSQLite3Database<typeof schema>;

/**
 * A brand-new database (fresh install, portable zip, Docker volume) starts
 * empty. Seed the hand-written bank and any bundled `content/*.json` so the app
 * is playable immediately — no terminal commands needed.
 */
function bootstrap(database: DB) {
  const row = database
    .select({ n: sql<number>`count(*)` })
    .from(schema.questions)
    .get();
  if ((row?.n ?? 0) > 0) return;

  database.insert(schema.questions).values(seedRows()).run();

  const contentDir = path.join(process.cwd(), "content");
  if (!fs.existsSync(contentDir)) return;

  for (const file of fs.readdirSync(contentDir).filter((name) => name.endsWith(".json"))) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(contentDir, file), "utf8"));
      const parsed = importFileSchema.safeParse(raw);
      if (parsed.success) {
        importPayload(parsed.data, { file }, database);
      }
    } catch {
      // A malformed content file must never stop the app from starting.
    }
  }
}

function createDb(): DB {
  const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const sqlite = new Database(path.join(dataDir, "app.db"));
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });

  // The whole app state is this one file, so migrations run on boot.
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  if (fs.existsSync(migrationsFolder)) {
    migrate(db, { migrationsFolder });
  }

  bootstrap(db);

  return db;
}

// Next dev re-evaluates modules on hot reload; keep one connection per process.
const globalForDb = globalThis as unknown as { __jcaDb?: DB };

export const db: DB = globalForDb.__jcaDb ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__jcaDb = db;
}
