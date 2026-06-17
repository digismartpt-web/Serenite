/**
 * Database layer — pg.Pool direct connection.
 *
 * Remplace l'ancien proxy CLI Supabase par une connexion PostgreSQL
 * directe via pg.Pool, avec gestion des transactions réelles.
 *
 * Variables d'environnement :
 *   DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD / DB_POOL_MAX
 */

import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  max: parseInt(process.env.DB_POOL_MAX || '10', 10),
  ssl: process.env.DB_SSL !== 'false'
    ? { rejectUnauthorized: false }
    : false,
});

// ─── Type réexporté pour compatibilité ─────────────────────

export interface TransactionClient {
  query<T = any>(text: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number }>;
}

// ─── Requêtes ─────────────────────────────────────────────

/** Exécute une requête et retourne toutes les lignes. */
export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
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
 * Utilise une vraie connexion PostgreSQL avec BEGIN/COMMIT/ROLLBACK.
 */
export async function withTransaction<T>(
  fn: (client: TransactionClient) => Promise<T>
): Promise<T> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Vérifie la connexion à la base (utilisé au démarrage). */
export async function checkConnection(): Promise<void> {
  try {
    const result = await pool.query('SELECT 1 AS ok');
    console.log('[DB] Connexion PostgreSQL établie via pg.Pool');
  } catch (e: any) {
    console.error('[DB] Échec de connexion PostgreSQL :', e.message);
    throw e;
  }
}

/** Export par défaut pour compatibilité. */
const defaultExport = { query, queryOne, withTransaction, checkConnection };
export default defaultExport;
