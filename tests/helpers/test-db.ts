import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { vi } from "vitest";
import type { DB } from "../../lib/db";

export interface TestDb {
  db: DB;
  dir: string;
  close: () => Promise<void>;
}

/**
 * A fresh libSQL file database per test file.
 *
 * `lib/db` reads `DATA_DIR` when it is first imported, so the environment has to
 * be set before the dynamic import. `vi.resetModules()` keeps each test file
 * from inheriting the previous module graph.
 */
export async function createTestDb(): Promise<TestDb> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jca-test-"));
  process.env.DATA_DIR = dir;
  delete process.env.TURSO_DATABASE_URL;
  delete process.env.TURSO_AUTH_TOKEN;

  delete (globalThis as { __jcaDb?: unknown }).__jcaDb;
  vi.resetModules();

  const dbModule = await import("../../lib/db");
  await dbModule.dbReady;

  // Drizzle's libSQL type does not expose the underlying client, but it is there
  // at runtime and closing it lets Windows release the temp file.
  const client = (dbModule.db as unknown as { $client?: { close: () => void } }).$client;

  return {
    db: dbModule.db,
    dir,
    async close() {
      try {
        client?.close();
      } catch {
        // Closing twice is harmless; the temp folder still gets removed below.
      }
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // Windows can hold the WAL file briefly. A leftover temp folder is fine.
      }
    },
  };
}
