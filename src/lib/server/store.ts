import fs from 'fs';
import { Pool } from 'pg';
import { attachDatabasePool } from '@vercel/functions';
import { db } from './db';
import { ensureCredentials } from './credentials';

/**
 * Postgres persistence for the workspace (Neon Lakebase Postgres over the pooled DATABASE_URL).
 * The whole workspace is stored as one versioned JSONB row. Without DATABASE_URL
 * (local dev) everything stays in memory, as before.
 */

const WORKSPACE_ID = 'default';

export interface StoredState {
  version: number;
  data: Record<string, unknown[]> | null;
}

export const hasDatabase = () => Boolean(process.env.DATABASE_URL);

import path from 'path';

const isServerless = Boolean(
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.LAMBDA_TASK_ROOT
);

// Fallback when no database is configured (local dev): keep state in this server process,
// mirrored to local workspace state file so all worker threads and server restarts retain accounts.
// On serverless / Vercel platforms, route exclusively to writable /tmp scratch directory or remain safely in-memory.
const localFile: string | undefined = (() => {
  if (process.env.LOCAL_STATE_FILE) return process.env.LOCAL_STATE_FILE;
  if (process.env.DATABASE_URL) return undefined;
  if (isServerless) return path.join('/tmp', '.workspace_state.json');
  return path.join(process.cwd(), '.workspace_state.json');
})();

let memoryState: StoredState = loadLocalFile();

function loadLocalFile(): StoredState {
  if (!localFile) return { version: 0, data: null };
  try {
    if (!fs.existsSync(localFile)) return { version: 0, data: null };
    return JSON.parse(fs.readFileSync(localFile, 'utf8')) as StoredState;
  } catch {
    return { version: 0, data: null };
  }
}

// One pool per server instance. On Vercel Fluid compute, attachDatabasePool closes idle
// clients before the instance is suspended so connections are not leaked.
let pool: Pool | null = null;
let schemaReady: Promise<unknown> | null = null;

function getPool() {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
    attachDatabasePool(pool);
  }
  return pool;
}

async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const p = getPool();
  if (!schemaReady) {
    schemaReady = p
      .query(
        `CREATE TABLE IF NOT EXISTS workspace_state (
           id text PRIMARY KEY,
           version integer NOT NULL,
           data jsonb NOT NULL,
           updated_at timestamptz NOT NULL DEFAULT now()
         );
         CREATE TABLE IF NOT EXISTS attachment_files (
           id text PRIMARY KEY,
           mime text NOT NULL,
           filename text NOT NULL,
           size integer NOT NULL,
           sha256 text NOT NULL,
           bytes bytea NOT NULL,
           created_at timestamptz NOT NULL DEFAULT now()
         );`
      )
      .catch((err) => {
        // Let the next request try again instead of caching the failure
        schemaReady = null;
        throw err;
      });
  }
  await schemaReady;
  const res = await p.query(text, params);
  return res.rows as T[];
}

export async function readState(): Promise<StoredState> {
  if (!hasDatabase()) {
    if (localFile && fs.existsSync(localFile)) {
      try {
        memoryState = JSON.parse(fs.readFileSync(localFile, 'utf8')) as StoredState;
      } catch {
        // use memoryState
      }
    }
    return memoryState;
  }
  const rows = await query<{ version: number; data: Record<string, unknown[]> }>(
    'SELECT version, data FROM workspace_state WHERE id = $1',
    [WORKSPACE_ID]
  );
  if (rows.length === 0) return { version: 0, data: null };
  return { version: rows[0].version, data: rows[0].data };
}

/** Writes state if the stored version still equals baseVersion. Returns the new version, or null on conflict. */
export async function writeState(baseVersion: number, data: Record<string, unknown[]>): Promise<number | null> {
  if (!hasDatabase()) {
    if (baseVersion !== memoryState.version) return null;
    memoryState = { version: baseVersion + 1, data: JSON.parse(JSON.stringify(data)) };
    if (localFile) {
      try {
        fs.writeFileSync(localFile, JSON.stringify(memoryState));
      } catch (err) {
        console.warn('Workspace state local file write skipped:', err);
      }
    }
    return memoryState.version;
  }
  const json = JSON.stringify(data);
  const rows =
    baseVersion === 0
      ? await query<{ version: number }>(
          `INSERT INTO workspace_state (id, version, data) VALUES ($1, 1, $2::jsonb)
           ON CONFLICT (id) DO NOTHING RETURNING version`,
          [WORKSPACE_ID, json]
        )
      : await query<{ version: number }>(
          `UPDATE workspace_state SET version = version + 1, data = $2::jsonb, updated_at = now()
           WHERE id = $1 AND version = $3 RETURNING version`,
          [WORKSPACE_ID, json, baseVersion]
        );
  return rows.length ? rows[0].version : null;
}

// Server-side API routes: load the latest workspace into the server db before handling a request
let serverVersion = 0;

export async function syncIn() {
  const state = await readState();
  if (state.data) db.importState(JSON.parse(JSON.stringify(state.data)));
  serverVersion = state.version;
  // First run, or users added without a password: store their hashes straight away
  if (ensureCredentials()) await syncOut();
}

export const currentVersion = () => serverVersion;

export async function syncOut() {
  const v = await writeState(serverVersion, db.exportState());
  if (v === null) throw new Error('Workspace was changed by someone else. Please retry.');
  serverVersion = v;
}

// Attachment file contents, kept apart from the workspace state so saves stay small
const memoryFiles = new Map<string, { mime: string; filename: string; bytes: Buffer }>();

export async function saveFile(file: { id: string; mime: string; filename: string; sha256: string; bytes: Buffer }) {
  if (!hasDatabase()) {
    memoryFiles.set(file.id, { mime: file.mime, filename: file.filename, bytes: file.bytes });
    return;
  }
  await query(
    `INSERT INTO attachment_files (id, mime, filename, size, sha256, bytes) VALUES ($1, $2, $3, $4, $5, $6)`,
    [file.id, file.mime, file.filename, file.bytes.length, file.sha256, file.bytes]
  );
}

export async function readFile(id: string): Promise<{ mime: string; filename: string; bytes: Buffer } | null> {
  if (!hasDatabase()) return memoryFiles.get(id) ?? null;
  const rows = await query<{ mime: string; filename: string; bytes: Buffer }>(
    'SELECT mime, filename, bytes FROM attachment_files WHERE id = $1',
    [id]
  );
  return rows[0] ?? null;
}
