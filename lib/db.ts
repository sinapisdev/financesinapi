// Acesso ao Postgres. Hoje aponta para o banco local; para ir ao Supabase
// basta trocar DATABASE_URL — nenhuma consulta muda.
import { Pool, types } from 'pg';

// Por padrão o driver devolve bigint (OID 20) como STRING, para não perder
// precisão em números acima de 2^53. Nossos ids não chegam perto disso, e a
// string quebra comparações silenciosamente: `"1" !== 1`.
types.setTypeParser(types.builtins.INT8, (v) => (v === null ? null : Number(v)));

declare global { var _pool: Pool | undefined; }

// O Supabase exige TLS e apresenta certificado de uma CA própria, que o Node
// não tem na lista padrão. `rejectUnauthorized: false` mantém a conexão
// criptografada e aceita esse certificado — é o modo que o próprio Supabase
// documenta. Em local (sem DATABASE_URL) não há TLS nenhum.
const ehRemoto = !!process.env.DATABASE_URL;
export const pool =
  global._pool ??
  new Pool(
    ehRemoto
      ? {
          connectionString: process.env.DATABASE_URL,
          ssl: { rejectUnauthorized: false },
          max: Number(process.env.DB_POOL_MAX ?? 10),
          idleTimeoutMillis: 30_000,
          connectionTimeoutMillis: 10_000,
        }
      : { database: 'silvereng_dev' }
  );
if (process.env.NODE_ENV !== 'production') global._pool = pool;

export async function q<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  const { rows } = await pool.query(sql, params);
  return rows as T[];
}

export const brl = (v: number | string | null | undefined) =>
  (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// o pg devolve DATE como objeto Date quando a query não faz ::text.
// Aceitar os dois evita "Invalid Date" espalhado pelas telas.
export const dataBR = (v: string | Date | null | undefined) => {
  if (!v) return '—';
  const d = v instanceof Date ? v : new Date(String(v).slice(0, 10) + 'T12:00:00');
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
};
