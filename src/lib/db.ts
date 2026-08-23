import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

// Node's built-in SQLite driver (stable enough for this app, and — unlike
// Prisma or better-sqlite3 — needs no native binary download, so it works
// even on networks that block third-party binary hosts. Requires Node >= 22.5.
// See package.json "engines".

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'pisau.db');

declare global {
  // eslint-disable-next-line no-var
  var __pisauDb: DatabaseSync | undefined;
}

// "CREATE TABLE IF NOT EXISTS" di schema.sql tidak menambah kolom baru ke
// tabel yang sudah ada dari database lama — jadi kolom yang ditambahkan
// setelah database pertama kali dibuat perlu di-ALTER manual di sini supaya
// database yang sudah pernah di-seed sebelumnya tetap kompatibel tanpa perlu
// `npm run db:reset`.
function migrate(database: DatabaseSync): void {
  const stageCols = database.prepare('PRAGMA table_info(order_stages)').all() as { name: string }[];
  const existingStageCols = new Set(stageCols.map((c) => c.name));
  for (const [name, ddl] of [
    ['material_cost', 'ALTER TABLE order_stages ADD COLUMN material_cost INTEGER NOT NULL DEFAULT 0'],
    ['shipping_cost', 'ALTER TABLE order_stages ADD COLUMN shipping_cost INTEGER NOT NULL DEFAULT 0'],
    ['extra_cost', 'ALTER TABLE order_stages ADD COLUMN extra_cost INTEGER NOT NULL DEFAULT 0'],
  ] as const) {
    if (!existingStageCols.has(name)) database.exec(ddl);
  }

  const orderCols = database.prepare('PRAGMA table_info(orders)').all() as { name: string }[];
  const existingOrderCols = new Set(orderCols.map((c) => c.name));
  for (const [name, ddl] of [
    ['archived', 'ALTER TABLE orders ADD COLUMN archived INTEGER NOT NULL DEFAULT 0'],
    ['archived_at', 'ALTER TABLE orders ADD COLUMN archived_at TEXT'],
  ] as const) {
    if (!existingOrderCols.has(name)) database.exec(ddl);
  }
}

function openDb(): DatabaseSync {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const database = new DatabaseSync(DB_PATH);
  database.exec('PRAGMA journal_mode = WAL;');
  database.exec('PRAGMA foreign_keys = ON;');
  const schema = fs.readFileSync(path.join(process.cwd(), 'src', 'lib', 'schema.sql'), 'utf8');
  database.exec(schema);
  migrate(database);
  return database;
}

// Cache on globalThis so Next.js dev-mode module reloads (and multiple route
// modules importing this file) all share one connection/file handle.
function currentDb(): DatabaseSync {
  return globalThis.__pisauDb ?? (globalThis.__pisauDb = openDb());
}

// `db` is exported as a thin Proxy over the live connection rather than the
// connection object itself. Every repo/* file across the app does
// `import { db } from '@/lib/db'` and calls `db.prepare(...)` etc. directly —
// with a plain object export, closing and reopening the connection (needed
// after a database restore, see src/lib/backup.ts) would leave every one of
// those already-imported references pointing at a closed, stale instance.
// The Proxy instead re-resolves `currentDb()` on every property access, so
// after `closeDb()` clears the cache, the very next `db.prepare(...)` call
// anywhere in the app transparently opens a fresh connection to whatever
// file is now on disk — no code outside this file needs to change, and no
// process restart is needed after a restore.
export const db: DatabaseSync = new Proxy(
  {},
  {
    get(_target, prop) {
      const real = currentDb() as unknown as Record<string | symbol, unknown>;
      const value = real[prop];
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(real) : value;
    },
  }
) as DatabaseSync;

/** Menutup koneksi aktif (kalau ada) dan membersihkan cache-nya. Dipakai
 * sebelum file database ditimpa oleh proses restore backup — akses `db.*`
 * berikutnya (dari mana pun) otomatis membuka koneksi baru ke file yang
 * baru lewat `currentDb()` di atas. Lihat src/lib/backup.ts. */
export function closeDb(): void {
  const existing = globalThis.__pisauDb;
  if (existing) {
    try {
      existing.close();
    } catch {
      // koneksi lama mungkin sudah tidak valid (misal file sudah dihapus) — aman diabaikan
    }
  }
  globalThis.__pisauDb = undefined;
}

export function dbFilePath(): string {
  return DB_PATH;
}

export function uploadsDir(): string {
  const dir = path.join(process.cwd(), 'uploads');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
