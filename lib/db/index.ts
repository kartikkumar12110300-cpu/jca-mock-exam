import fs from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { sql } from "drizzle-orm";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { hashPassword } from "../auth/password";
import { seedAccounts } from "../auth/seed";
import * as schema from "./schema";
import { seedRows } from "./seed-data";

export type DB = LibSQLDatabase<typeof schema>;

interface Connection {
  client: Client;
  url: string;
  isLocal: boolean;
}

/**
 * Turso in production, a local file for development and the portable build.
 * The same schema and queries work against both.
 */
function resolveConnection(): Connection {
  const remote = process.env.TURSO_DATABASE_URL?.trim();

  if (remote) {
    return {
      client: createClient({
        url: remote,
        authToken: process.env.TURSO_AUTH_TOKEN?.trim() || undefined,
      }),
      url: remote,
      isLocal: false,
    };
  }

  // `path.resolve` keeps the default relative to the process working directory
  // without giving the build tracer a literal `process.cwd()/data` to embed.
  const dataDir = path.resolve(process.env.DATA_DIR ?? "data");
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, "app.db").replaceAll("\\", "/");

  return {
    client: createClient({ url: `file:${file}` }),
    url: `file:${file}`,
    isLocal: true,
  };
}

async function hasUsersTable(client: Client): Promise<boolean> {
  const result = await client.execute(
    "select name from sqlite_master where type = 'table' and name = 'users' limit 1",
  );
  return result.rows.length > 0;
}

/** Seed the fixed accounts. Existing usernames are left untouched. */
async function seedUsersOnFirstBoot(database: DB): Promise<void> {
  const existing = new Set(
    (await database.select({ username: schema.users.username }).from(schema.users).all()).map(
      (row) => row.username,
    ),
  );

  const missing = seedAccounts().filter((account) => !existing.has(account.username));
  if (missing.length === 0) return;

  const rows = await Promise.all(
    missing.map(async (account) => ({
      id: crypto.randomUUID(),
      username: account.username,
      displayName: account.displayName,
      passwordHash: await hashPassword(account.password),
      role: account.role,
    })),
  );

  await database.insert(schema.users).values(rows).onConflictDoNothing().run();
}

/**
 * A brand-new database (fresh install, portable zip, Docker volume, Turso)
 * starts empty. Seed the hand-written bank and any bundled `content/*.json` so
 * the app is playable immediately — no terminal commands needed.
 */
async function bootstrapQuestions(database: DB): Promise<void> {
  const row = await database
    .select({ n: sql<number>`count(*)` })
    .from(schema.questions)
    .get();
  if (Number(row?.n ?? 0) > 0) return;

  await database.insert(schema.questions).values(seedRows()).run();

  const contentDir = path.join(process.cwd(), "content");
  if (!fs.existsSync(contentDir)) return;

  // Dynamic import keeps the seed path out of the import pipeline's module
  // cycle (import.ts also opens the database).
  const { importFileSchema, importPayload } = await import("../import");

  for (const file of fs.readdirSync(contentDir).filter((name) => name.endsWith(".json"))) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(contentDir, file), "utf8"));
      const parsed = importFileSchema.safeParse(raw);
      if (parsed.success) {
        await importPayload(parsed.data, { file }, database);
      }
    } catch {
      // A malformed content file must never stop the app from starting.
    }
  }
}

async function initialize(client: Client, database: DB, isLocal: boolean): Promise<void> {
  if (isLocal) {
    await client.execute("PRAGMA foreign_keys = ON");
    await client.execute("PRAGMA journal_mode = WAL");
  }

  const migrationsFolder = path.join(process.cwd(), "drizzle");
  if (fs.existsSync(migrationsFolder)) {
    try {
      await migrate(database, { migrationsFolder });
    } catch (error) {
      // Two cold serverless instances can race the first migration. If the
      // schema is already there, the other instance won the race.
      if (!(await hasUsersTable(client))) throw error;
      console.warn("Migration skipped — schema already present.", error);
    }
  }

  await seedUsersOnFirstBoot(database);
  await bootstrapQuestions(database);
}

interface Instance {
  db: DB;
  ready: Promise<void>;
}

function createDb(): Instance {
  const connection = resolveConnection();
  const db = drizzle(connection.client, { schema });

  const ready = initialize(connection.client, db, connection.isLocal);
  // Avoid an unhandled rejection at import time; callers await `dbReady`, which
  // still surfaces the original error.
  ready.catch(() => {});

  return { db, ready };
}

// Next dev re-evaluates modules on hot reload; keep one connection per process.
const globalForDb = globalThis as unknown as { __jcaDb?: Instance };
const instance = globalForDb.__jcaDb ?? createDb();
globalForDb.__jcaDb = instance;

export const db: DB = instance.db;

/**
 * Migration + first-boot seeding. Every public data function awaits this, so
 * queries never run against a half-created schema.
 */
export const dbReady: Promise<void> = instance.ready;

export const dbUrl = resolveConnectionUrl();

function resolveConnectionUrl(): string {
  const remote = process.env.TURSO_DATABASE_URL?.trim();
  if (remote) return remote.replace(/\/\/.*@/, "//");
  // `path.resolve` keeps the default relative to the process working directory
  // without giving the build tracer a literal `process.cwd()/data` to embed.
  const dataDir = path.resolve(process.env.DATA_DIR ?? "data");
  return `file:${path.join(dataDir, "app.db")}`;
}
