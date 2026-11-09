import { Pool } from 'pg';
import type { PoolClient, QueryResultRow } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export type RowDataPacket = QueryResultRow;

const connectionString =
  process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL || '';
const dbUrl = connectionString ? new URL(connectionString) : null;
const dbConfig = {
  database: dbUrl?.pathname.replace(/^\//, '') || 'postgres',
  host: dbUrl?.hostname || '',
  port: Number(dbUrl?.port || 5432),
  user: dbUrl?.username ? decodeURIComponent(dbUrl.username) : '',
};

const pgPool = connectionString
  ? new Pool({
      connectionString,
      // Supabase's pooler requires TLS; its certificate chain is not trusted by this Node runtime.
      ssl: { rejectUnauthorized: false },
      max: 10,
      connectionTimeoutMillis: 10000,
    })
  : null;

pgPool?.on('error', (error) => {
  console.warn('[PostgreSQL Pool Warning]:', error.message);
});

function toPostgresPlaceholders(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

export class DatabaseConnection {
  constructor(private readonly client: PoolClient) {}

  async query<T = RowDataPacket[]>(sql: string, values: any[] = []): Promise<[T]> {
    const result = await this.client.query(toPostgresPlaceholders(sql), values);
    return [result.rows as T];
  }

  async beginTransaction(): Promise<void> {
    await this.client.query('BEGIN');
  }

  async commit(): Promise<void> {
    await this.client.query('COMMIT');
  }

  async rollback(): Promise<void> {
    await this.client.query('ROLLBACK');
  }

  release(): void {
    this.client.release();
  }
}

export const pool = {
  async getConnection(): Promise<DatabaseConnection> {
    if (!pgPool) {
      throw new Error('Falta SUPABASE_DATABASE_URL en el archivo .env.');
    }
    return new DatabaseConnection(await pgPool.connect());
  },
};

export interface DbStatus {
  connected: boolean;
  database: string;
  host: string;
  port: number;
  user: string;
  error?: string;
  pingMs?: number;
  tablesCount?: number;
  counts?: {
    clientes: number;
    prestamos: number;
    cuotas: number;
    pagos: number;
  };
}

export async function testDbConnection(companyId?: number): Promise<DbStatus> {
  const start = Date.now();
  let connection: DatabaseConnection | undefined;

  try {
    connection = await pool.getConnection();
    const pingMs = Date.now() - start;
    const [tables] = await connection.query<{ count: string }[]>(
      `SELECT COUNT(*) AS count
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
    );
    let counts: DbStatus['counts'];
    if (companyId !== undefined) {
      const [cCount] = await connection.query<{ count: string }[]>(
        'SELECT COUNT(*) AS count FROM clientes WHERE empresa_id = ? AND deleted_at IS NULL',
        [companyId]
      );
      const [pCount] = await connection.query<{ count: string }[]>(
        'SELECT COUNT(*) AS count FROM prestamos_creditos WHERE empresa_id = ?',
        [companyId]
      );
      const [qCount] = await connection.query<{ count: string }[]>(
        'SELECT COUNT(*) AS count FROM prestamos_cronogramas WHERE empresa_id = ?',
        [companyId]
      );
      const [payCount] = await connection.query<{ count: string }[]>(
        'SELECT COUNT(*) AS count FROM prestamos_pagos WHERE empresa_id = ?',
        [companyId]
      );
      counts = {
        clientes: Number(cCount[0]?.count || 0),
        prestamos: Number(pCount[0]?.count || 0),
        cuotas: Number(qCount[0]?.count || 0),
        pagos: Number(payCount[0]?.count || 0),
      };
    }

    return {
      connected: true,
      database: dbConfig.database,
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      pingMs,
      tablesCount: Number(tables[0]?.count || 0),
      counts,
    };
  } catch (error: unknown) {
    return {
      connected: false,
      database: dbConfig.database,
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      error: error instanceof Error ? error.message : 'Error de conexión con Supabase',
    };
  } finally {
    connection?.release();
  }
}
