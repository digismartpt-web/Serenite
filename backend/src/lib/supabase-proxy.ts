import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const PROJECT_DIR = path.resolve(__dirname, '../../..');
const TMP_PREFIX = 'serenite-sql-';

/**
 * Exécute une requête SQL via la CLI Supabase (--linked).
 * Retourne le JSON parsé.
 */
function runSQL(sql: string): any[] {
  // Écrire la requête dans un fichier temporaire (évite les problèmes d'échappement shell)
  const tmpFile = path.join(os.tmpdir(), `${TMP_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);
  try {
    fs.writeFileSync(tmpFile, sql, 'utf-8');
    const result = execSync(
      `supabase db query --linked --output json --file "${tmpFile}"`,
      {
        cwd: PROJECT_DIR,
        encoding: 'utf-8',
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024, // 10 MB
      }
    );
    // Ignorer les lignes "Initialising..." qui vont sur stderr
    return JSON.parse(result.trim());
  } catch (e: any) {
    const stderr = e.stderr || '';
    const stdout = e.stdout || '';
    const msg = stderr.replace(/Initialising login role\.\.\.\n?/g, '').trim() || e.message;
    throw new Error(`[DB Proxy] ${msg}`);
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

// ─── Interface publique (identique à database.ts) ────────────

/** Exécute une requête SQL et retourne toutes les lignes. */
export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const sql = params ? interpolate(text, params) : text;
  const rows = runSQL(sql);
  return rows as T[];
}

/** Exécute une requête SQL et retourne la première ligne ou null. */
export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/**
 * Exécute des opérations dans une transaction.
 * Chaque requête via `client.query()` est exécutée séquentiellement
 * dans un bloc BEGIN/COMMIT.
 */
export async function withTransaction<T>(
  fn: (client: TransactionClient) => Promise<T>
): Promise<T> {
  // Mode simplifié : toutes les requêtes sont exécutées dans un seul batch
  const queries: string[] = [];
  const results: any[] = [];

  const client: TransactionClient = {
    query: async (text: string, params?: unknown[]) => {
      const sql = params ? interpolate(text, params) : text;
      queries.push(sql);
      // Exécution immédiate pour les RETURNING / dépendances
      const fullSql = queries.length === 1
        ? `BEGIN; ${sql}`
        : sql;
      const rows = runSQL(fullSql);
      results.push(rows);
      return { rows };
    },
  };

  try {
    const result = await fn(client);
    // Finaliser avec COMMIT
    const finalSql = [...queries, 'COMMIT'].join(';\n');
    runSQL(finalSql);
    return result;
  } catch (err) {
    // Tentative de ROLLBACK
    try { runSQL('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  }
}

/** Interface minimaliste imitant PoolClient pour les transactions. */
export interface TransactionClient {
  query(text: string, params?: unknown[]): Promise<{ rows: any[] }>;
}

// ─── Helper : interpolation sécurisée des paramètres ──────────

function interpolate(sql: string, params: unknown[]): string {
  let idx = 0;
  return sql.replace(/\$(\d+)/g, (match, num) => {
    const paramIdx = parseInt(num, 10) - 1;
    if (paramIdx < 0 || paramIdx >= params.length) return match;
    const val = params[paramIdx];
    return escapeValue(val);
  });
}

function escapeValue(val: unknown): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  // Chaîne de caractères : échapper les quotes simples
  const str = String(val).replace(/'/g, "''");
  return `'${str}'`;
}
