/**
 * Pool de conexión PostgreSQL directa a Supabase
 * Para queries complejas con aggregaciones (json_agg, GROUP BY, etc.)
 * que son difíciles de expresar con el Supabase JS SDK
 */
import { Pool, PoolClient } from 'pg';
import { logger } from './logger';

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString =
      process.env.POSTGRES_URL ||
      process.env.DATABASE_URL ||
      process.env.SUPABASE_DB_URL;

    if (!connectionString || connectionString === 'PENDIENTE_CONFIGURAR') {
      throw new Error(
        'POSTGRES_URL no configurada. Agrega la variable en .env.local o en Vercel Dashboard.'
      );
    }

    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });

    pool.on('error', (err) => {
      logger.error('Pool de PostgreSQL error inesperado', { message: err.message });
    });
  }
  return pool;
}

/**
 * Ejecuta una query SQL con parámetros y retorna las filas resultantes.
 * Manejo de errores centralizado via logger.
 */
export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const client: PoolClient = await getPool().connect();
  try {
    const result = await client.query(text, params);
    return result.rows as T[];
  } catch (err: unknown) {
    const error = err as Error;
    logger.error('PostgreSQL query error', {
      message: error.message,
      query: text.substring(0, 200),
    });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Ejecuta múltiples queries en una transacción atómica
 */
export async function transaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
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
