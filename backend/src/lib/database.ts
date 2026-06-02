import { Pool, PoolClient } from 'pg';

// ─── Pool principal ───────────────────────────────────────────
// Utilise les variables d'env individuelles pour Coolify
// (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD)
const pool = new Pool({
  host:                   process.env.DB_HOST     ?? 'localhost',
  port:                   parseInt(process.env.DB_PORT ?? '5432', 10),
  database:               process.env.DB_NAME     ?? 'serenite',
  user:                   process.env.DB_USER     ?? 'postgres',
  password:               process.env.DB_PASSWORD ?? '',
  options:                '-c search_path=sereno',
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
      : false,
  // Pool sizing
  max:                    parseInt(process.env.DB_POOL_MAX ?? '20', 10),
  idleTimeoutMillis:      30_000,
  connectionTimeoutMillis: 3_000,
});

// Log des erreurs de pool (jamais les credentials)
pool.on('error', (err) => {
  console.error('[DB] Erreur inattendue sur un client idle :', err.message);
});

// ─── Helpers typés ────────────────────────────────────────────

export default pool;

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
 *
 * @example
 * const result = await withTransaction(async (client) => {
 *   await client.query('INSERT INTO users …', […]);
 *   await client.query('INSERT INTO consents …', […]);
 *   return { ok: true };
 * });
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Vérifie la connexion à la base (utilisé au démarrage). */
export async function checkConnection(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    console.log('[DB] Connexion PostgreSQL établie');
  } finally {
    client.release();
  }
}
