/**
 * Database layer — Supabase CLI proxy.
 *
 * Utilise `supabase db query --linked` qui passe par l'API Management.
 * Chaque appel exécute les requêtes dans une connexion PostgreSQL
 * unique — les CTE (WITH) permettent les opérations multi-tables.
 *
 * Variables d'environnement (non utilisées directement ici — la
 * connexion passe par la config `supabase link` dans le dossier) :
 *   DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const PROJECT_DIR = path.resolve(__dirname, '../../..');

// ─── Interface TransactionClient ──────────────────────────────

export interface TransactionClient {
  query<T = any>(text: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number }>;
}

// ─── Proxy CLI Supabase ───────────────────────────────────────

function interpolate(sql: string, params: unknown[]): string {
  return sql.replace(/\$(\d+)/g, (_match, num) => {
    const idx = parseInt(num, 10) - 1;
    if (idx < 0 || idx >= params.length) return _match;
    const val = params[idx];
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return String(val);
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    const str = String(val).replace(/'/g, "''");
    return `'${str}'`;
  });
}

function runSQL(sql: string): any[] {
  const tmpFile = path.join(os.tmpdir(), `serenite-sql-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);
  try {
    fs.writeFileSync(tmpFile, sql, 'utf-8');
    const result = execSync(
      `supabase db query --linked --output json --file "${tmpFile}"`,
      {
        cwd: PROJECT_DIR,
        encoding: 'utf-8',
        timeout: 60000,
        maxBuffer: 10 * 1024 * 1024,
      }
    );
    const trimmed = result.trim();
    if (!trimmed || trimmed === '[]') return [];
    return JSON.parse(trimmed);
  } catch (e: any) {
    const stderr = e.stderr || '';
    const stdout = e.stdout || '';
    const msg = stderr.replace(/Initialising login role\.\.\.\n?/g, '').trim() || e.message;
    throw new Error(`[DB Proxy] ${msg}`);
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

// ─── Requêtes ─────────────────────────────────────────────────

/** Exécute une requête et retourne toutes les lignes. */
export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const sql = params ? interpolate(text, params) : text;
  return runSQL(sql) as T[];
}

/** Exécute une requête et retourne la première ligne ou null. */
export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/**
 * Exécute un ensemble d'opérations dans une transaction atomique.
 *
 * Collecte toutes les requêtes et les exécute en UN SEUL appel CLI,
 * ce qui garantit une vraie transaction (BEGIN + requêtes + COMMIT
 * dans la même connexion PostgreSQL).
 *
 * ATTENTION : chaque client.query() retourne un résultat VIDE
 * (placeholders) — les vraies valeurs ne sont visibles qu'après
 * COMMIT. Les routes qui utilisent withTransaction doivent être
 * adaptées avec des CTE en une seule requête.
 */
export async function withTransaction<T>(
  fn: (client: TransactionClient) => Promise<T>
): Promise<T> {
  const queryParts: string[] = [];

  const client: TransactionClient = {
    query: async <TResult = any>(text: string, params?: unknown[]) => {
      const sql = params ? interpolate(text, params) : text;
      queryParts.push(sql);
      return { rows: [] as TResult[], rowCount: 0 };
    },
  };

  try {
    const result = await fn(client);
    if (queryParts.length === 0) return result;
    const fullSQL = `BEGIN;\n${queryParts.join(';\n')};\nCOMMIT;`;
    runSQL(fullSQL);
    return result;
  } catch (err) {
    try { runSQL('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  }
}

/** Vérifie la connexion à la base (utilisé au démarrage). */
export async function checkConnection(): Promise<void> {
  try {
    const rows = runSQL('SELECT 1 AS ok');
    console.log('[DB] Connexion Supabase établie via proxy CLI');
  } catch (e: any) {
    console.error('[DB] Échec de connexion Supabase :', e.message);
    throw e;
  }
}

/** Export par défaut pour compatibilité. */
const defaultExport = { query, queryOne, withTransaction, checkConnection };
export default defaultExport;
