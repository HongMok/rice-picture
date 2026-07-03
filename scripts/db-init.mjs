// 本地一键初始化数据库：建表 + 预置演示账号
// 用法: node scripts/db-init.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 手动读取 .env.local（dotenv 默认只读 .env）
try {
  const envLocal = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
  for (const line of envLocal.split('\n')) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {
  /* .env.local 不存在则忽略 */
}

const connectionString =
  process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL;
if (!connectionString) {
  console.error('❌ 缺少数据库连接串（POSTGRES_URL / DATABASE_URL），请在 .env.local 中配置');
  process.exit(1);
}

const needSsl = /sslmode=require|neon\.tech|vercel/i.test(connectionString);
const pool = new pg.Pool({
  connectionString,
  ssl: needSsl ? { rejectUnauthorized: false } : undefined,
});

const DEMO_USER = 'demo';
const DEMO_PASS = 'demo1234';

async function main() {
  console.log('→ 连接数据库…');
  const sql = readFileSync(join(__dirname, '..', 'sql', 'init.sql'), 'utf8');

  console.log('→ 执行建表脚本 sql/init.sql …');
  await pool.query(sql);

  console.log('→ 预置演示账号…');
  const hash = await bcrypt.hash(DEMO_PASS, 10);
  await pool.query(
    `insert into users (username, password, nickname)
     values ($1, $2, $3)
     on conflict (username) do update set password = excluded.password, nickname = excluded.nickname`,
    [DEMO_USER, hash, 'Miss Li']
  );

  console.log('\n✅ 初始化完成！');
  console.log(`   演示账号: ${DEMO_USER}`);
  console.log(`   演示密码: ${DEMO_PASS}\n`);
  await pool.end();
}

main().catch((err) => {
  console.error('❌ 初始化失败:', err.message);
  process.exit(1);
});
