/**
 * Database layer — Supabase CLI proxy.
 * Utilise `supabase db query --linked` qui passe par l'API Management.
 * Plus fiable que pg.Pool direct (pas de gestion de mot de passe).
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const SUPABASE_PROJECT = path.join(__dirname, '..', '..', '..');
const DB_POOL_MAX = parseInt(process.env.DB_POOL_MAX || '10', 10);
let activeConnections = 0;

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

function runSQL(sql: string): QueryResult {
  const tmpFile = path.join(
    '/tmp',
    `serenite-db-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`
  );
  try {
    fs.writeFileSync(tmpFile, sql, 'utf-8');
    const output = execSync(
      `supabase db query --linked --output json --file "${tmpFile}"`,
      { encoding: 'utf-8', timeout: 30000, cwd: SUPABASE_PROJECT }
    );
    const parsed = JSON.parse(output);
    const rows = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.rows) ? parsed.rows : []);
    return {
      rows,
      rowCount: rows.length,
    };
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch {}
  }
}

export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  let sql = text;
  if (params && params.length > 0) {
    // PASS 1: Replace $N placeholders with ##N## markers
    // This prevents bcrypt hashes ($2a$10$...) from being corrupted
    for (let i = 0; i < params.length; i++) {
      const re = new RegExp(`\\$${i + 1}(?![0-9])`, 'g');
      sql = sql.replace(re, `##${i + 1}##`);
    }
    // PASS 2: Replace ##N## markers with actual values
    for (let i = 0; i < params.length; i++) {
      const val = params[i];
      const strVal =
        val === null
          ? 'NULL'
          : val === undefined
          ? 'NULL'
          : typeof val === 'string'
          ? `'${val.replace(/'/g, "''")}'`
          : String(val);
      sql = sql.replace(`##${i + 1}##`, strVal);
    }
  }
  const result = runSQL(sql);
  return result.rows as unknown as T[];
}

export async function queryOne<T = any>(
  text: string,
  params?: any[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return (rows[0] as T) ?? null;
}

export interface TransactionClient {
  query: <T = any>(text: string, params?: any[]) => Promise<{ rows: T[]; rowCount: number }>;
  release: () => void;
}

export async function withTransaction<T>(
  fn: (client: TransactionClient) => Promise<T>
): Promise<T> {
  const client = {
    query: async <T = any>(text: string, params?: any[]) => {
      const result = await query<T>(text, params);
      return { rows: result, rowCount: result.length };
    },
    release: () => {},
  };
  return fn(client);
}

export async function checkConnection(): Promise<boolean> {
  try {
    const result = runSQL('SELECT 1 as test');
    console.log('[DB] Connexion Supabase etablie via proxy CLI');
    return true;
  } catch (err: any) {
    console.error('[DB] Echec de connexion Supabase :', err.message);
    return false;
  }
}
export default { query, queryOne, withTransaction, checkConnection };
