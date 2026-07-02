import { Pool, QueryResultRow, types } from 'pg';

// pg 默认把 bigint(int8, OID 20) 当字符串返回，导致 id 类型不一致。
// 这里在安全整数范围内解析为 number（本项目 id 远不会超过 2^53）。
types.setTypeParser(20, (val) => (val === null ? null : Number(val)));

// 全局单例连接池（避免 Next.js 热更新/serverless 重复创建）
declare global {
  // eslint-disable-next-line no-var
  var __ricePicturePool: Pool | undefined;
}

function createPool() {
  // 兼容多种命名：POSTGRES_URL（本地/Vercel Postgres）、DATABASE_URL（Neon 默认）
  const connectionString =
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL;
  if (!connectionString) {
    throw new Error('缺少数据库连接串（POSTGRES_URL / DATABASE_URL）');
  }
  // Neon / Vercel Postgres 走 TLS；本地无 sslmode 时不启用
  const needSsl = /sslmode=require|neon\.tech|vercel/i.test(connectionString);
  return new Pool({
    connectionString,
    ssl: needSsl ? { rejectUnauthorized: false } : undefined,
    max: 5,
  });
}

export function getDb(): Pool {
  if (!global.__ricePicturePool) {
    global.__ricePicturePool = createPool();
  }
  return global.__ricePicturePool;
}

/** 便捷查询：返回行数组 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const res = await getDb().query<T>(text, params);
  return res.rows;
}

/** 便捷查询：返回单行或 null */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: any[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
