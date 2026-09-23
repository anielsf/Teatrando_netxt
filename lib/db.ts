import { Pool, PoolClient } from 'pg';
import parseAddress from 'pg-connection-string'; // Extractor nativo incluido en la suite de 'pg'
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

    // 1. Descomponer la URL de Supabase en un objeto de configuración limpio
    const connectionOptions = parseAddress.parse(connectionString);

    // 2. Eliminar explícitamente el parámetro sslmode de texto que inyecta Supabase
    delete connectionOptions.sslmode;

    // 3. Forzar la configuración SSL pura compatible con los servidores de Vercel
    const finalConfig = {
      ...connectionOptions,
      ssl: {
        rejectUnauthorized: false
      },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };

    // Inicializar el Pool con la configuración limpia libre de interferencias por texto
    pool = new Pool(finalConfig);

    pool.on('error', (err) => {
      logger.error('Pool de PostgreSQL error inesperado', { message: err.message });
    });
  }
  return pool;
}
